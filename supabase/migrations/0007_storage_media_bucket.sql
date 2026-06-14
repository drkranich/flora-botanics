-- ============================================================
-- FLORA ECOSYSTEM · Migration 7: Bucket de mídia
-- Leitura pública (site), escrita por staff no caminho do tenant
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp','image/avif','image/gif','image/svg+xml']
)
on conflict (id) do nothing;

-- leitura pública dos objetos do bucket media
create policy "media_public_read"
on storage.objects for select
using (bucket_id = 'media');

-- staff escreve apenas dentro da pasta do seu tenant: <tenant_id>/...
create policy "media_staff_insert"
on storage.objects for insert
with check (
  bucket_id = 'media'
  and (
    public.is_platform_admin()
    or (
      public.auth_role() in ('tenant_owner','tenant_admin','tenant_editor')
      and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    )
  )
);

create policy "media_staff_update"
on storage.objects for update
using (
  bucket_id = 'media'
  and (
    public.is_platform_admin()
    or (
      public.auth_role() in ('tenant_owner','tenant_admin','tenant_editor')
      and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    )
  )
);

create policy "media_staff_delete"
on storage.objects for delete
using (
  bucket_id = 'media'
  and (
    public.is_platform_admin()
    or (
      public.auth_role() in ('tenant_owner','tenant_admin','tenant_editor')
      and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    )
  )
);
