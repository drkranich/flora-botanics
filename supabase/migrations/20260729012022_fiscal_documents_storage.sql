-- ============================================================
-- FLORA ECOSYSTEM · Storage fiscal privado
-- Guias, XML, DANFE, comprovantes e documentos contábeis
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values (
  'fiscal-documents',
  'fiscal-documents',
  false,
  20971520 -- 20 MB
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

comment on column public.fiscal_guides.guide_path is
  'Caminho privado no bucket fiscal-documents para PDF/XML da guia.';

comment on column public.fiscal_guides.receipt_path is
  'Caminho privado no bucket fiscal-documents para comprovante de pagamento.';

comment on column public.fiscal_vault_documents.storage_path is
  'Caminho privado no bucket fiscal-documents para arquivo arquivado no cofre fiscal.';
