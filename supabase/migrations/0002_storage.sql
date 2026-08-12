-- ===========================================================================
-- 0002_storage.sql — private "media" bucket + owner-scoped access.
-- Object paths are namespaced by user id: <uid>/<media_id>/<file>.
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Users may read/write only within their own top-level folder (their uid).
create policy "media_objects_select_own"
  on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media_objects_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media_objects_update_own"
  on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media_objects_delete_own"
  on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
