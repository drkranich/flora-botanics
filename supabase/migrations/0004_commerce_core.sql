-- ============================================================
-- FLORA ECOSYSTEM · Migration 4: Clientes, Vendas, Leads, Jobs
-- (aplicada em 2026-06-11 via MCP)
-- ============================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  email text not null,
  full_name text,
  phone text,
  accepts_marketing boolean not null default false,
  stripe_customer_id text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);
create index idx_customers_tenant on public.customers(tenant_id);
create index idx_customers_profile on public.customers(profile_id);
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  recipient text not null,
  street text not null,
  number text,
  complement text,
  district text,
  city text not null,
  state text not null,
  zip text not null,
  country text not null default 'BR',
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_addresses_customer on public.addresses(customer_id);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  session_id text,
  status text not null default 'open' check (status in ('open','converted','abandoned')),
  currency text not null default 'BRL',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_carts_tenant_status on public.carts(tenant_id, status, updated_at);
create index idx_carts_session on public.carts(session_id);
create trigger trg_carts_updated before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  type text not null check (type in ('percent','fixed','free_shipping')),
  value numeric not null default 0,
  min_subtotal_cents int,
  max_uses int,
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number bigint not null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','paid','processing','shipped','delivered','canceled','refunded')),
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  shipping_cents int not null default 0,
  total_cents int not null default 0,
  currency text not null default 'BRL',
  shipping_address jsonb,
  billing_address jsonb,
  coupon_id uuid references public.coupons(id) on delete set null,
  notes text,
  placed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index idx_orders_tenant_status on public.orders(tenant_id, status, created_at desc);
create index idx_orders_customer on public.orders(customer_id);
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.next_order_number(t uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  update tenants set order_seq = order_seq + 1 where id = t returning order_seq into n;
  return n;
end $$;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_snapshot jsonb not null,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null,
  total_cents int not null,
  created_at timestamptz not null default now()
);
create index idx_order_items_order on public.order_items(order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'stripe',
  provider_payment_id text not null,
  status text not null default 'pending'
    check (status in ('pending','succeeded','failed','refunded','partially_refunded')),
  amount_cents int not null,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index idx_payments_order on public.payments(order_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  stripe_subscription_id text not null unique,
  status text not null,
  variant_id uuid references public.product_variants(id) on delete set null,
  interval text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_subscriptions_customer on public.subscriptions(customer_id);
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  carrier text,
  service text,
  tracking_code text,
  status text not null default 'pending'
    check (status in ('pending','label_created','shipped','in_transit','delivered','returned')),
  label_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_shipments_order on public.shipments(order_id);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  source text not null default 'newsletter'
    check (source in ('newsletter','checkout','landing','import','other')),
  consent_at timestamptz,
  converted_customer_id uuid references public.customers(id) on delete set null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);
create index idx_leads_tenant on public.leads(tenant_id, created_at desc);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','running','done','failed')),
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index idx_jobs_due on public.jobs(status, run_at) where status = 'queued';
