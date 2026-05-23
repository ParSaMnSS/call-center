-- Call Center Analysis: initial schema
-- Run this in the Supabase SQL editor (or via supabase CLI) after creating the project.

-- ============ Extensions ============
create extension if not exists "pgcrypto";

-- ============ Enums ============
do $$ begin
  create type call_status as enum ('pending', 'transcribing', 'analyzing', 'done', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sentiment_level as enum ('positive', 'neutral', 'negative');
exception when duplicate_object then null; end $$;

-- ============ Table ============
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null,

  audio_path text not null,
  audio_duration_sec int,

  status call_status not null default 'pending',
  error_message text,

  transcript text,
  caller_name text,
  caller_phone text,
  agent_name text,
  issue_summary text,
  resolved boolean,
  category text,
  tags text[] default '{}',
  agent_behavior text,
  caller_behavior text,
  sentiment_agent sentiment_level,
  sentiment_caller sentiment_level,
  follow_up_needed boolean,
  notes text
);

-- ============ Indexes ============
create index if not exists calls_created_at_idx on public.calls (created_at desc);
create index if not exists calls_agent_name_idx on public.calls (agent_name);
create index if not exists calls_resolved_idx on public.calls (resolved);
create index if not exists calls_category_idx on public.calls (category);
create index if not exists calls_status_idx on public.calls (status);

-- Full text search index (simple dictionary works fine for Farsi substring matching)
create index if not exists calls_fts_idx on public.calls
  using gin (to_tsvector('simple',
    coalesce(transcript,'') || ' ' ||
    coalesce(issue_summary,'') || ' ' ||
    coalesce(caller_name,'') || ' ' ||
    coalesce(agent_name,'') || ' ' ||
    coalesce(notes,'')
  ));

-- ============ RLS ============
alter table public.calls enable row level security;

drop policy if exists "authenticated can read all calls" on public.calls;
create policy "authenticated can read all calls"
  on public.calls for select
  to authenticated
  using (true);

drop policy if exists "authenticated can insert" on public.calls;
create policy "authenticated can insert"
  on public.calls for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

drop policy if exists "uploader can update" on public.calls;
create policy "uploader can update"
  on public.calls for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "uploader can delete" on public.calls;
create policy "uploader can delete"
  on public.calls for delete
  to authenticated
  using (auth.uid() = uploaded_by);

-- ============ Storage bucket ============
insert into storage.buckets (id, name, public)
values ('call-audio', 'call-audio', false)
on conflict (id) do nothing;

-- Storage policies: authenticated users can read/write objects in this bucket
drop policy if exists "authenticated can read call audio" on storage.objects;
create policy "authenticated can read call audio"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'call-audio');

drop policy if exists "authenticated can upload call audio" on storage.objects;
create policy "authenticated can upload call audio"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'call-audio');

drop policy if exists "authenticated can delete own call audio" on storage.objects;
create policy "authenticated can delete own call audio"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'call-audio' and owner = auth.uid());

-- ============ Realtime ============
-- Enable realtime broadcasts for calls table changes
alter publication supabase_realtime add table public.calls;
