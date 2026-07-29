-- ============================================================
-- FLORA ECOSYSTEM · Políticas de storage fiscal para staff
-- Permite upload/download autenticado quando o Worker não tiver
-- SUPABASE_SERVICE_ROLE_KEY disponível.
-- ============================================================

drop policy if exists fiscal_documents_staff_read on storage.objects;
create policy fiscal_documents_staff_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'fiscal-documents'
  and public.is_tenant_staff((storage.foldername(name))[1]::uuid)
);

drop policy if exists fiscal_documents_staff_insert on storage.objects;
create policy fiscal_documents_staff_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fiscal-documents'
  and public.is_tenant_admin((storage.foldername(name))[1]::uuid)
);

drop policy if exists fiscal_documents_staff_update on storage.objects;
create policy fiscal_documents_staff_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fiscal-documents'
  and public.is_tenant_admin((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'fiscal-documents'
  and public.is_tenant_admin((storage.foldername(name))[1]::uuid)
);

drop policy if exists fiscal_documents_staff_delete on storage.objects;
create policy fiscal_documents_staff_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'fiscal-documents'
  and public.is_tenant_admin((storage.foldername(name))[1]::uuid)
);
