-- Serial processing support: timestamp + atomic single-row claim.

-- Add a timestamp so the UI can show elapsed processing time.
alter table public.calls
  add column if not exists processing_started_at timestamptz;

-- Preserve the user-uploaded filename so the worker can still extract a
-- phone hint from it (storage path is just <uuid>.<ext>).
alter table public.calls
  add column if not exists original_filename text;

-- How long the AI took (in seconds). Set when the row reaches 'done'.
-- Used to compute a median-based ETA for currently-processing calls.
alter table public.calls
  add column if not exists processing_seconds int;

-- Atomically claim the oldest pending call. Returns the row that was
-- claimed (status flipped to 'analyzing' + processing_started_at set),
-- or no rows if there's nothing pending or another worker grabbed it.
--
-- FOR UPDATE SKIP LOCKED is the standard Postgres pattern for safe
-- concurrent queue consumption — two callers will never claim the same row.
create or replace function public.claim_next_call()
returns table (
  id uuid,
  audio_path text,
  original_filename text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_path text;
  v_name text;
begin
  with claimed as (
    select c.id
    from public.calls c
    where c.status = 'pending'
      and c.audio_path <> 'pending'  -- skip rows whose upload hasn't finished
    order by c.created_at asc
    for update skip locked
    limit 1
  )
  update public.calls c
    set status = 'analyzing',
        processing_started_at = now(),
        error_message = null
    from claimed
    where c.id = claimed.id
    returning c.id, c.audio_path, c.original_filename
    into v_id, v_path, v_name;

  if v_id is null then
    return;
  end if;
  id := v_id;
  audio_path := v_path;
  original_filename := v_name;
  return next;
end;
$$;

-- Service-role and authenticated users can call it.
revoke all on function public.claim_next_call() from public;
grant execute on function public.claim_next_call() to service_role;
grant execute on function public.claim_next_call() to authenticated;

-- Backfill processing_started_at for any rows already in flight from older
-- code (so the UI doesn't show negative/garbage elapsed time).
update public.calls
  set processing_started_at = coalesce(processing_started_at, created_at)
  where status in ('analyzing', 'transcribing');
