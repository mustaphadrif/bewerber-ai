-- CV-only migration: enable the reference template id and optional CV photo storage.
-- Does not touch auth, profiles, or any other app table.

-- 1) cv_documents.template: allow the new default template "referenz".
alter table public.cv_documents drop constraint if exists cv_documents_template_check;
alter table public.cv_documents
  add constraint cv_documents_template_check
  check (template in ('referenz', 'klar', 'klassisch', 'modern'));
alter table public.cv_documents alter column template set default 'referenz';

-- 2) Optional photo storage: public bucket (read via CDN) with owner-scoped writes.
--    Path convention: {user_id}/cv-*.jpg|png  → storage.foldername(name)[1] = user_id.
insert into storage.buckets (id, name, public)
values ('cv-photos', 'cv-photos', true)
on conflict (id) do nothing;

drop policy if exists "cv_photos_insert_own" on storage.objects;
create policy "cv_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'cv-photos'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "cv_photos_update_own" on storage.objects;
create policy "cv_photos_update_own" on storage.objects
  for update using (
    bucket_id = 'cv-photos'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "cv_photos_delete_own" on storage.objects;
create policy "cv_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'cv-photos'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "cv_photos_select_own" on storage.objects;
create policy "cv_photos_select_own" on storage.objects
  for select using (
    bucket_id = 'cv-photos'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );
