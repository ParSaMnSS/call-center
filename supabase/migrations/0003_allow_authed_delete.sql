-- Allow any authenticated user to delete any call. Matches the read policy
-- (any authenticated user can read all calls) and reflects the intended
-- product: this is an internal tool, not multi-tenant.
--
-- Safe to re-run: every policy is dropped before re-creation.

drop policy if exists "uploader can delete" on public.calls;
drop policy if exists "authenticated can delete" on public.calls;
create policy "authenticated can delete" on public.calls
  for delete
  to authenticated
  using (true);

-- Same for storage objects in the call-audio bucket.
drop policy if exists "authenticated can delete own call audio" on storage.objects;
drop policy if exists "authenticated can delete call audio" on storage.objects;
create policy "authenticated can delete call audio" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'call-audio');
