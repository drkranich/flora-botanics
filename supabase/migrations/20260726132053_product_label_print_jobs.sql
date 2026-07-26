-- ============================================================
-- FLORA ECOSYSTEM · Etiquetas internas de produto e estoque
-- SKU, lote, validade, código de barras próprio e impressão
-- A4/térmica para operação direta da Flora Botanics.
-- ============================================================

create table if not exists public.product_label_print_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  template text not null default 'product_stock'
    check (template in ('product_stock','barcode','shelf','batch','gift','marketplace')),
  format text not null default 'thermal' check (format in ('a4','thermal','zpl','pdf')),
  status text not null default 'queued'
    check (status in ('queued','printing','printed','failed','cancelled')),
  copies integer not null default 1 check (copies > 0),
  barcode_value text,
  label_payload jsonb not null default '{}'::jsonb,
  printer_name text,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  printed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_label_print_jobs_tenant_status
  on public.product_label_print_jobs(tenant_id, status, created_at desc);
create index if not exists idx_product_label_print_jobs_variant
  on public.product_label_print_jobs(variant_id, created_at desc);
create index if not exists idx_product_label_print_jobs_product
  on public.product_label_print_jobs(product_id, created_at desc);

alter table public.product_label_print_jobs enable row level security;

drop policy if exists product_label_print_jobs_staff_read on public.product_label_print_jobs;
drop policy if exists product_label_print_jobs_admin_write on public.product_label_print_jobs;

create policy product_label_print_jobs_staff_read on public.product_label_print_jobs
  for select using (public.is_tenant_staff(tenant_id));

create policy product_label_print_jobs_admin_write on public.product_label_print_jobs
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));
