-- ============================================================
-- FLORA BOTANICS · Pedidos manuais e controle financeiro documental
-- Fundações para venda assistida, cofre documental e baixa financeira
-- centralizada em qualquer upload com valor a pagar/receber.
-- ============================================================

-- ---------- extensões seguras em pedidos ----------
alter table public.orders
  add column if not exists origin_label text,
  add column if not exists manual_channel text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_summary jsonb not null default '{}'::jsonb,
  add column if not exists delivery_summary jsonb not null default '{}'::jsonb,
  add column if not exists fiscal_summary jsonb not null default '{}'::jsonb,
  add column if not exists commission_summary jsonb not null default '[]'::jsonb,
  add column if not exists internal_tags text[] not null default '{}',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists delete_reason text;

create index if not exists idx_orders_manual_channel
  on public.orders(tenant_id, manual_channel, created_at desc)
  where manual_channel is not null;

create index if not exists idx_orders_payment_status
  on public.orders(tenant_id, payment_status, created_at desc);

create index if not exists idx_orders_archived
  on public.orders(tenant_id, archived_at desc)
  where archived_at is not null;

-- Staff precisa conseguir criar pedidos assistidos e itens.
drop policy if exists customers_staff_insert on public.customers;
create policy customers_staff_insert on public.customers
  for insert
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists orders_staff_insert on public.orders;
create policy orders_staff_insert on public.orders
  for insert
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists order_items_staff_insert on public.order_items;
create policy order_items_staff_insert on public.order_items
  for insert
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_id
        and public.is_tenant_admin(o.tenant_id)
    )
  );

drop policy if exists payments_staff_insert on public.payments;
create policy payments_staff_insert on public.payments
  for insert
  with check (public.is_tenant_admin(tenant_id));

-- Auditoria específica de pedidos, sem apagar o histórico operacional.
create table if not exists public.order_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_audit_events_order
  on public.order_audit_events(tenant_id, order_id, created_at desc);

alter table public.order_audit_events enable row level security;

drop policy if exists order_audit_events_staff_read on public.order_audit_events;
drop policy if exists order_audit_events_admin_insert on public.order_audit_events;

create policy order_audit_events_staff_read on public.order_audit_events
  for select using (public.is_tenant_staff(tenant_id));

create policy order_audit_events_admin_insert on public.order_audit_events
  for insert with check (public.is_tenant_admin(tenant_id));

-- ---------- controle financeiro universal de documentos ----------
create table if not exists public.document_financial_controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_module text not null,
  source_table text not null,
  source_id uuid,
  document_name text not null,
  financial_nature text not null default 'not_applicable'
    check (financial_nature in (
      'not_applicable',
      'unclassified',
      'payable',
      'receivable',
      'needs_review',
      'proof',
      'fiscal_document',
      'tax_guide',
      'boleto',
      'receipt',
      'budget',
      'financial_contract',
      'installment',
      'other'
    )),
  document_category text,
  counterparty_name text,
  counterparty_document text,
  document_number text,
  competence text,
  issued_at date,
  due_date date,
  original_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  interest_cents bigint not null default 0,
  penalty_cents bigint not null default 0,
  adjustment_cents bigint not null default 0,
  updated_cents bigint not null default 0,
  paid_cents bigint not null default 0,
  remaining_cents bigint not null default 0,
  currency text not null default 'BRL',
  payment_status text not null default 'unclassified'
    check (payment_status in (
      'not_applicable',
      'unclassified',
      'unpaid',
      'open',
      'waiting_approval',
      'approved_for_payment',
      'scheduled',
      'near_due',
      'due_today',
      'overdue',
      'partial',
      'paid',
      'paid_with_interest',
      'paid_with_discount',
      'compensated',
      'installment',
      'suspended',
      'disputed',
      'cancelled',
      'reversed',
      'refunded',
      'reconciled',
      'divergent',
      'waiting_receipt',
      'receipt_review'
    )),
  proof_status text not null default 'missing'
    check (proof_status in ('missing','sent','review','verified','rejected','divergent')),
  reconciliation_status text not null default 'not_reconciled'
    check (reconciliation_status in ('not_reconciled','suggested','reconciled','divergent','manual')),
  payment_method text,
  bank_account text,
  cost_center text,
  department text,
  responsible_id uuid references auth.users(id) on delete set null,
  approver_id uuid references auth.users(id) on delete set null,
  accounting_entry_id uuid references public.accounting_entries(id) on delete set null,
  guide_id uuid references public.fiscal_guides(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  storage_path text,
  receipt_paths jsonb not null default '[]'::jsonb,
  extracted_fields jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_document_financial_controls_source
  on public.document_financial_controls(tenant_id, source_table, source_id);

create index if not exists idx_document_financial_controls_status
  on public.document_financial_controls(tenant_id, payment_status, due_date);

drop trigger if exists trg_document_financial_controls_updated on public.document_financial_controls;
create trigger trg_document_financial_controls_updated before update on public.document_financial_controls
  for each row execute function public.set_updated_at();

alter table public.document_financial_controls enable row level security;

drop policy if exists document_financial_controls_staff_read on public.document_financial_controls;
drop policy if exists document_financial_controls_admin_all on public.document_financial_controls;

create policy document_financial_controls_staff_read on public.document_financial_controls
  for select using (public.is_tenant_staff(tenant_id));

create policy document_financial_controls_admin_all on public.document_financial_controls
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

create table if not exists public.document_financial_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  control_id uuid not null references public.document_financial_controls(id) on delete cascade,
  payment_kind text not null default 'full'
    check (payment_kind in ('full','partial','scheduled','receipt','reversal','compensation')),
  status text not null default 'registered'
    check (status in ('scheduled','registered','verified','rejected','reversed','cancelled')),
  amount_cents bigint not null default 0,
  paid_at date,
  scheduled_for date,
  bank_account text,
  payment_method text,
  transaction_identifier text,
  authentication_code text,
  barcode text,
  digitable_line text,
  pix_code text,
  installment_number integer,
  installment_total integer,
  proof_paths jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_financial_payments_control
  on public.document_financial_payments(control_id, created_at desc);

alter table public.document_financial_payments enable row level security;

drop policy if exists document_financial_payments_staff_read on public.document_financial_payments;
drop policy if exists document_financial_payments_admin_all on public.document_financial_payments;

create policy document_financial_payments_staff_read on public.document_financial_payments
  for select using (public.is_tenant_staff(tenant_id));

create policy document_financial_payments_admin_all on public.document_financial_payments
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- ---------- cofre documental: pastas, versões, compartilhamento e auditoria ----------
create table if not exists public.document_vault_folders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid references public.document_vault_folders(id) on delete set null,
  name text not null,
  description text,
  icon text,
  color text,
  department text,
  responsible_id uuid references auth.users(id) on delete set null,
  retention_rule text,
  access_level text not null default 'internal',
  tags text[] not null default '{}',
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_document_vault_folders_tenant_parent
  on public.document_vault_folders(tenant_id, parent_id, name)
  where deleted_at is null;

drop trigger if exists trg_document_vault_folders_updated on public.document_vault_folders;
create trigger trg_document_vault_folders_updated before update on public.document_vault_folders
  for each row execute function public.set_updated_at();

alter table public.document_vault_folders enable row level security;

drop policy if exists document_vault_folders_staff_read on public.document_vault_folders;
drop policy if exists document_vault_folders_admin_all on public.document_vault_folders;

create policy document_vault_folders_staff_read on public.document_vault_folders
  for select using (public.is_tenant_staff(tenant_id));

create policy document_vault_folders_admin_all on public.document_vault_folders
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

alter table public.fiscal_vault_documents
  add column if not exists folder_id uuid references public.document_vault_folders(id) on delete set null,
  add column if not exists financial_control_id uuid references public.document_financial_controls(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists confidentiality_level text not null default 'internal',
  add column if not exists favorite boolean not null default false;

create table if not exists public.document_vault_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vault_document_id uuid not null references public.fiscal_vault_documents(id) on delete cascade,
  version integer not null,
  storage_path text not null,
  file_name text,
  byte_size bigint,
  hash text,
  reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (vault_document_id, version)
);

create index if not exists idx_document_vault_versions_doc
  on public.document_vault_versions(vault_document_id, version desc);

alter table public.document_vault_versions enable row level security;

drop policy if exists document_vault_versions_staff_read on public.document_vault_versions;
drop policy if exists document_vault_versions_admin_all on public.document_vault_versions;

create policy document_vault_versions_staff_read on public.document_vault_versions
  for select using (public.is_tenant_staff(tenant_id));

create policy document_vault_versions_admin_all on public.document_vault_versions
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

create table if not exists public.document_vault_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vault_document_id uuid references public.fiscal_vault_documents(id) on delete set null,
  folder_id uuid references public.document_vault_folders(id) on delete set null,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_vault_audit_tenant
  on public.document_vault_audit_events(tenant_id, created_at desc);

alter table public.document_vault_audit_events enable row level security;

drop policy if exists document_vault_audit_staff_read on public.document_vault_audit_events;
drop policy if exists document_vault_audit_admin_insert on public.document_vault_audit_events;

create policy document_vault_audit_staff_read on public.document_vault_audit_events
  for select using (public.is_tenant_staff(tenant_id));

create policy document_vault_audit_admin_insert on public.document_vault_audit_events
  for insert with check (public.is_tenant_admin(tenant_id));
