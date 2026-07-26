-- ============================================================
-- FLORA ECOSYSTEM · Logística, transportadoras e etiquetas
-- Fundação para cotação, escolha automática, etiqueta, impressão,
-- rastreamento e expedição integrada.
-- ============================================================

alter table public.shipments
  add column if not exists provider_key text references public.integration_providers(key) on delete set null,
  add column if not exists quote_id uuid,
  add column if not exists label_status text not null default 'not_requested'
    check (label_status in ('not_requested','queued','generating','created','failed','cancelled','printed')),
  add column if not exists label_pdf_url text,
  add column if not exists label_zpl text,
  add column if not exists label_format text not null default 'a4'
    check (label_format in ('a4','thermal','zpl','pdf')),
  add column if not exists barcode text,
  add column if not exists qr_code text,
  add column if not exists weight_grams integer check (weight_grams is null or weight_grams >= 0),
  add column if not exists package_width_cm numeric(10,2) check (package_width_cm is null or package_width_cm >= 0),
  add column if not exists package_height_cm numeric(10,2) check (package_height_cm is null or package_height_cm >= 0),
  add column if not exists package_length_cm numeric(10,2) check (package_length_cm is null or package_length_cm >= 0),
  add column if not exists recipient_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists sender_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists service_cost_cents integer not null default 0,
  add column if not exists expected_delivery_days integer,
  add column if not exists last_error text,
  add column if not exists printed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_shipments_updated on public.shipments;
create trigger trg_shipments_updated before update on public.shipments
  for each row execute function public.set_updated_at();

create index if not exists idx_shipments_tenant_status
  on public.shipments(tenant_id, status, label_status, created_at desc);
create index if not exists idx_shipments_provider
  on public.shipments(tenant_id, provider_key, created_at desc);

-- Regras por tenant para seleção automática de transportadora.
create table if not exists public.shipping_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  priority integer not null default 100,
  status text not null default 'active' check (status in ('active','paused','archived')),
  provider_key text references public.integration_providers(key) on delete set null,
  service text,
  conditions jsonb not null default '{}'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  strategy text not null default 'best_cost'
    check (strategy in ('best_cost','best_deadline','best_margin','manual','fallback')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shipping_rules_tenant_priority
  on public.shipping_rules(tenant_id, status, priority);

drop trigger if exists trg_shipping_rules_updated on public.shipping_rules;
create trigger trg_shipping_rules_updated before update on public.shipping_rules
  for each row execute function public.set_updated_at();

-- Cotações de frete recebidas de providers.
create table if not exists public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  provider_key text not null references public.integration_providers(key) on delete restrict,
  service text not null,
  service_name text,
  status text not null default 'quoted' check (status in ('quoted','selected','expired','failed')),
  cost_cents integer not null default 0,
  price_cents integer not null default 0,
  currency text not null default 'BRL',
  deadline_days integer,
  payload jsonb not null default '{}'::jsonb,
  error text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipping_quotes_order
  on public.shipping_quotes(order_id, status, cost_cents, deadline_days);
create index if not exists idx_shipping_quotes_tenant_created
  on public.shipping_quotes(tenant_id, created_at desc);

-- Pacotes/volumes por remessa.
create table if not exists public.shipment_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  sequence integer not null default 1,
  weight_grams integer not null default 0 check (weight_grams >= 0),
  width_cm numeric(10,2) not null default 0 check (width_cm >= 0),
  height_cm numeric(10,2) not null default 0 check (height_cm >= 0),
  length_cm numeric(10,2) not null default 0 check (length_cm >= 0),
  declared_value_cents integer not null default 0,
  items jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (shipment_id, sequence)
);

create index if not exists idx_shipment_packages_shipment
  on public.shipment_packages(shipment_id, sequence);

-- Trabalhos de impressão e reimpressão.
create table if not exists public.shipping_label_print_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete cascade,
  format text not null default 'a4' check (format in ('a4','thermal','zpl','pdf')),
  status text not null default 'queued'
    check (status in ('queued','printing','printed','failed','cancelled')),
  copies integer not null default 1 check (copies > 0),
  printer_name text,
  payload jsonb not null default '{}'::jsonb,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  printed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipping_label_print_jobs_tenant_status
  on public.shipping_label_print_jobs(tenant_id, status, created_at desc);

-- Auditoria logística específica.
create table if not exists public.shipping_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  event_type text not null,
  previous_value jsonb,
  new_value jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipping_audit_events_order
  on public.shipping_audit_events(tenant_id, order_id, created_at desc);

-- RLS
alter table public.shipping_rules enable row level security;
alter table public.shipping_quotes enable row level security;
alter table public.shipment_packages enable row level security;
alter table public.shipping_label_print_jobs enable row level security;
alter table public.shipping_audit_events enable row level security;

drop policy if exists shipping_rules_staff_read on public.shipping_rules;
drop policy if exists shipping_rules_admin_write on public.shipping_rules;
create policy shipping_rules_staff_read on public.shipping_rules
  for select using (public.is_tenant_staff(tenant_id));
create policy shipping_rules_admin_write on public.shipping_rules
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists shipping_quotes_staff_read on public.shipping_quotes;
drop policy if exists shipping_quotes_admin_write on public.shipping_quotes;
create policy shipping_quotes_staff_read on public.shipping_quotes
  for select using (public.is_tenant_staff(tenant_id));
create policy shipping_quotes_admin_write on public.shipping_quotes
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists shipment_packages_staff_read on public.shipment_packages;
drop policy if exists shipment_packages_admin_write on public.shipment_packages;
create policy shipment_packages_staff_read on public.shipment_packages
  for select using (public.is_tenant_staff(tenant_id));
create policy shipment_packages_admin_write on public.shipment_packages
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists shipping_label_print_jobs_staff_read on public.shipping_label_print_jobs;
drop policy if exists shipping_label_print_jobs_admin_write on public.shipping_label_print_jobs;
create policy shipping_label_print_jobs_staff_read on public.shipping_label_print_jobs
  for select using (public.is_tenant_staff(tenant_id));
create policy shipping_label_print_jobs_admin_write on public.shipping_label_print_jobs
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists shipping_audit_events_staff_read on public.shipping_audit_events;
drop policy if exists shipping_audit_events_admin_insert on public.shipping_audit_events;
create policy shipping_audit_events_staff_read on public.shipping_audit_events
  for select using (public.is_tenant_staff(tenant_id));
create policy shipping_audit_events_admin_insert on public.shipping_audit_events
  for insert with check (public.is_tenant_admin(tenant_id));

-- Regras iniciais para tenants ativos.
insert into public.shipping_rules (tenant_id, name, priority, provider_key, service, strategy, conditions, constraints)
select
  t.id,
  seed.name,
  seed.priority,
  seed.provider_key,
  seed.service,
  seed.strategy,
  seed.conditions,
  seed.constraints
from public.tenants t
cross join (
  values
    ('Menor custo nacional', 100, 'melhor_envio', 'best_rate', 'best_cost', '{"country":"BR"}'::jsonb, '{}'::jsonb),
    ('Entrega rápida urbana', 80, 'loggi', 'express', 'best_deadline', '{"region":"metropolitana"}'::jsonb, '{}'::jsonb),
    ('Fallback Correios', 500, 'correios', 'pac', 'fallback', '{}'::jsonb, '{}'::jsonb)
) as seed(name, priority, provider_key, service, strategy, conditions, constraints)
where t.status = 'active'
on conflict do nothing;
