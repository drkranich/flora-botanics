alter table public.orders
  add column if not exists source_channel text not null default 'site',
  add column if not exists source_account_id uuid references public.channel_accounts(id) on delete set null;

create index if not exists idx_orders_tenant_source_channel
  on public.orders(tenant_id, source_channel, created_at desc);

create table if not exists public.accounting_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'tax', 'fee', 'product_cost', 'shipping_cost', 'packaging_cost', 'operational_cost', 'adjustment')),
  category text not null,
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  occurred_at timestamptz not null default now(),
  period_start date,
  period_end date,
  vendor_name text,
  document_number text,
  payment_method text,
  cost_center text,
  source_channel text,
  source_kind text not null default 'manual' check (source_kind in ('manual', 'automatic')),
  order_id uuid references public.orders(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  notes text,
  tags text[] not null default '{}',
  is_recurring boolean not null default false,
  recurrence_interval text check (recurrence_interval is null or recurrence_interval in ('monthly', 'quarterly', 'yearly')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounting_entries_tenant_date
  on public.accounting_entries(tenant_id, occurred_at desc);

create index if not exists idx_accounting_entries_tenant_type
  on public.accounting_entries(tenant_id, type, occurred_at desc);

create index if not exists idx_accounting_entries_order
  on public.accounting_entries(order_id)
  where order_id is not null;

drop trigger if exists trg_accounting_entries_updated on public.accounting_entries;
create trigger trg_accounting_entries_updated before update on public.accounting_entries
  for each row execute function public.set_updated_at();

alter table public.accounting_entries enable row level security;

drop policy if exists accounting_entries_staff_read on public.accounting_entries;
drop policy if exists accounting_entries_staff_all on public.accounting_entries;

create policy accounting_entries_staff_read on public.accounting_entries
  for select
  using (public.is_tenant_admin(tenant_id));

create policy accounting_entries_staff_all on public.accounting_entries
  for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));
