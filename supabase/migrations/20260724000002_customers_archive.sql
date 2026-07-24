-- ============================================================
-- FLORA ECOSYSTEM · Migration 22: customers.archived_at
-- Permite arquivar clientes sem excluí-los do banco.
-- ============================================================

alter table public.customers
  add column if not exists archived_at timestamptz;

-- Index para consultas comuns (lista de ativos)
create index if not exists idx_customers_not_archived
  on public.customers(tenant_id, created_at desc)
  where archived_at is null;
