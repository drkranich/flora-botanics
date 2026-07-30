-- Adiciona coluna de arquivamento em nfe_documents
alter table public.nfe_documents
  add column if not exists archived_at timestamptz;
