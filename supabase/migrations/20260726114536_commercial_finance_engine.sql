create table if not exists public.finance_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  default_currency text not null default 'BRL',
  target_margin_percent numeric(9,4) not null default 55,
  minimum_margin_percent numeric(9,4) not null default 35,
  default_tax_percent numeric(9,4) not null default 8,
  default_payment_fee_percent numeric(9,4) not null default 3.99,
  default_payment_fixed_cents integer not null default 39,
  default_logistics_percent numeric(9,4) not null default 6,
  default_overhead_percent numeric(9,4) not null default 5,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

create table if not exists public.finance_calculations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  calculation_mode text not null default 'unit'
    check (calculation_mode in ('unit', 'batch', 'kit', 'combo', 'order', 'customer', 'channel', 'b2b', 'b2c', 'campaign', 'subscription')),
  sale_model text not null default 'retail'
    check (sale_model in ('retail', 'wholesale', 'b2b', 'b2c', 'consignment', 'marketplace', 'physical_store', 'representative', 'subscription', 'corporate')),
  channel text not null default 'site',
  customer_name text,
  seller_name text,
  quantity numeric(14,4) not null default 1 check (quantity > 0),
  currency text not null default 'BRL',
  status text not null default 'draft' check (status in ('draft', 'saved', 'approved', 'archived')),
  input jsonb not null default '{}'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  alerts jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_cost_components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  calculation_id uuid references public.finance_calculations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  component_group text not null
    check (component_group in ('production', 'packaging', 'logistics', 'tax', 'commission', 'channel_fee', 'fixed_expense', 'variable_expense', 'labor', 'investment', 'custom')),
  category text not null,
  description text not null,
  quantity numeric(14,4) not null default 1,
  unit text not null default 'un',
  unit_cost_cents integer not null default 0 check (unit_cost_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  supplier text,
  allocation_method text not null default 'direct'
    check (allocation_method in ('direct', 'unit', 'batch', 'order', 'revenue', 'quantity', 'period', 'manual')),
  recurrence text check (recurrence is null or recurrence in ('once', 'monthly', 'quarterly', 'yearly')),
  effective_from date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_price_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  table_type text not null default 'retail'
    check (table_type in ('retail', 'wholesale', 'distributor', 'representative', 'physical_store', 'marketplace', 'b2b', 'special_customer', 'campaign', 'subscription', 'region', 'export')),
  channel text,
  customer_name text,
  min_quantity numeric(14,4) not null default 1,
  discount_percent numeric(9,4) not null default 0,
  commission_percent numeric(9,4) not null default 0,
  minimum_margin_percent numeric(9,4) not null default 30,
  valid_from date,
  valid_until date,
  approval_required boolean not null default false,
  rules jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number bigint generated always as identity,
  kind text not null default 'quote' check (kind in ('quote', 'budget', 'proposal')),
  status text not null default 'draft'
    check (status in ('draft', 'review', 'sent', 'viewed', 'approved', 'rejected', 'expired', 'cancelled', 'converted')),
  customer_name text not null,
  company_name text,
  document_number text,
  state_registration text,
  phone text,
  email text,
  address text,
  responsible_contact text,
  seller_name text,
  channel text,
  payment_terms text,
  delivery_terms text,
  valid_until date,
  items jsonb not null default '[]'::jsonb,
  calculation_id uuid references public.finance_calculations(id) on delete set null,
  totals jsonb not null default '{}'::jsonb,
  terms text,
  notes text,
  public_token uuid not null default gen_random_uuid(),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  converted_order_id uuid references public.orders(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create table if not exists public.finance_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_calculations_tenant_created
  on public.finance_calculations(tenant_id, created_at desc);

create index if not exists idx_finance_components_tenant_group
  on public.finance_cost_components(tenant_id, component_group, created_at desc);

create index if not exists idx_finance_price_tables_tenant_type
  on public.finance_price_tables(tenant_id, table_type, created_at desc);

create index if not exists idx_commercial_quotes_tenant_status
  on public.commercial_quotes(tenant_id, status, created_at desc);

create index if not exists idx_finance_audit_tenant_entity
  on public.finance_audit_events(tenant_id, entity_type, entity_id, created_at desc);

drop trigger if exists trg_finance_settings_updated on public.finance_settings;
create trigger trg_finance_settings_updated before update on public.finance_settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_finance_calculations_updated on public.finance_calculations;
create trigger trg_finance_calculations_updated before update on public.finance_calculations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_finance_cost_components_updated on public.finance_cost_components;
create trigger trg_finance_cost_components_updated before update on public.finance_cost_components
  for each row execute function public.set_updated_at();

drop trigger if exists trg_finance_price_tables_updated on public.finance_price_tables;
create trigger trg_finance_price_tables_updated before update on public.finance_price_tables
  for each row execute function public.set_updated_at();

drop trigger if exists trg_commercial_quotes_updated on public.commercial_quotes;
create trigger trg_commercial_quotes_updated before update on public.commercial_quotes
  for each row execute function public.set_updated_at();

alter table public.finance_settings enable row level security;
alter table public.finance_calculations enable row level security;
alter table public.finance_cost_components enable row level security;
alter table public.finance_price_tables enable row level security;
alter table public.commercial_quotes enable row level security;
alter table public.finance_audit_events enable row level security;

drop policy if exists finance_settings_staff_all on public.finance_settings;
drop policy if exists finance_calculations_staff_all on public.finance_calculations;
drop policy if exists finance_components_staff_all on public.finance_cost_components;
drop policy if exists finance_price_tables_staff_all on public.finance_price_tables;
drop policy if exists commercial_quotes_staff_all on public.commercial_quotes;
drop policy if exists finance_audit_staff_read on public.finance_audit_events;
drop policy if exists finance_audit_staff_insert on public.finance_audit_events;

create policy finance_settings_staff_all on public.finance_settings
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

create policy finance_calculations_staff_all on public.finance_calculations
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

create policy finance_components_staff_all on public.finance_cost_components
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

create policy finance_price_tables_staff_all on public.finance_price_tables
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

create policy commercial_quotes_staff_all on public.commercial_quotes
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

create policy finance_audit_staff_read on public.finance_audit_events
  for select using (public.is_tenant_admin(tenant_id));

create policy finance_audit_staff_insert on public.finance_audit_events
  for insert with check (public.is_tenant_admin(tenant_id));
