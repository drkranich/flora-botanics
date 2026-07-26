-- ============================================================
-- FLORA ECOSYSTEM · Stripe Catalog Foundation
-- Integra catálogo comercial Flora ↔ Stripe com ambientes,
-- múltiplos preços, histórico, filas, webhooks e conflitos.
-- ============================================================

alter table public.products
  add column if not exists stripe_product_id text,
  add column if not exists stripe_lookup_key text,
  add column if not exists stripe_sync_status text not null default 'not_linked'
    check (stripe_sync_status in ('not_linked','connected','synced','pending_change','divergent','archived','inactive','auth_error','sync_error')),
  add column if not exists stripe_last_sync_at timestamptz,
  add column if not exists stripe_last_error text;

alter table public.product_variants
  add column if not exists stripe_product_id text,
  add column if not exists stripe_lookup_key text,
  add column if not exists stripe_sync_status text not null default 'not_linked'
    check (stripe_sync_status in ('not_linked','connected','synced','pending_change','divergent','archived','inactive','auth_error','sync_error')),
  add column if not exists stripe_last_sync_at timestamptz,
  add column if not exists stripe_last_error text;

create table if not exists public.stripe_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'product',
    'product_variant',
    'kit',
    'combo',
    'gift_box',
    'subscription_plan',
    'service',
    'premium_packaging',
    'custom_item',
    'b2b_offer',
    'campaign_offer',
    'wholesale_product',
    'physical_store_product',
    'marketplace_product',
    'one_off_charge',
    'recurring_item',
    'price_table',
    'commercial_quote'
  )),
  entity_id uuid,
  internal_code text,
  sku text,
  slug text,
  name text not null,
  description text,
  environment text not null default 'test' check (environment in ('test','production')),
  stripe_product_id text,
  lookup_key_base text,
  source_of_truth text not null default 'flora'
    check (source_of_truth in ('flora','stripe','approval')),
  sync_status text not null default 'not_linked'
    check (sync_status in ('not_linked','connected','synced','pending_change','divergent','archived','inactive','auth_error','sync_error')),
  stripe_status text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  last_changed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stripe_products_entity_env_unique
  on public.stripe_products(tenant_id, entity_type, entity_id, environment)
  where entity_id is not null;
create unique index if not exists stripe_products_stripe_id_env_unique
  on public.stripe_products(environment, stripe_product_id)
  where stripe_product_id is not null;
create index if not exists idx_stripe_products_tenant_status
  on public.stripe_products(tenant_id, environment, sync_status, updated_at desc);
create index if not exists idx_stripe_products_lookup
  on public.stripe_products(tenant_id, environment, lookup_key_base);

drop trigger if exists trg_stripe_products_updated on public.stripe_products;
create trigger trg_stripe_products_updated before update on public.stripe_products
  for each row execute function public.set_updated_at();

create table if not exists public.commercial_price_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  price_table_id uuid references public.finance_price_tables(id) on delete cascade,
  entity_type text not null default 'product_variant',
  entity_id uuid,
  sku text,
  channel text,
  currency text not null default 'BRL',
  unit_amount_cents integer not null default 0 check (unit_amount_cents >= 0),
  min_quantity numeric(14,4) not null default 1 check (min_quantity > 0),
  discount_percent numeric(9,4) not null default 0,
  commission_percent numeric(9,4) not null default 0,
  minimum_margin_percent numeric(9,4) not null default 0,
  valid_from date,
  valid_until date,
  approval_required boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_price_entries_table
  on public.commercial_price_entries(price_table_id, entity_type, entity_id);
create index if not exists idx_commercial_price_entries_tenant_channel
  on public.commercial_price_entries(tenant_id, channel, valid_from desc);

drop trigger if exists trg_commercial_price_entries_updated on public.commercial_price_entries;
create trigger trg_commercial_price_entries_updated before update on public.commercial_price_entries
  for each row execute function public.set_updated_at();

create table if not exists public.stripe_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stripe_product_ref uuid references public.stripe_products(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  stripe_product_id text,
  stripe_price_id text,
  lookup_key text,
  environment text not null default 'test' check (environment in ('test','production')),
  currency text not null default 'BRL',
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  billing_type text not null default 'one_time'
    check (billing_type in ('one_time','recurring','custom_quote')),
  recurring_interval text check (recurring_interval is null or recurring_interval in ('day','week','month','year')),
  recurring_interval_count integer not null default 1 check (recurring_interval_count > 0),
  collection_mode text not null default 'checkout'
    check (collection_mode in ('checkout','invoice','subscription','payment_link','manual')),
  channel text,
  price_table_id uuid references public.finance_price_tables(id) on delete set null,
  commercial_price_entry_id uuid references public.commercial_price_entries(id) on delete set null,
  campaign_id uuid,
  status text not null default 'not_linked'
    check (status in ('not_linked','active','future','archived','inactive','divergent','error')),
  active boolean not null default true,
  is_default boolean not null default false,
  valid_from timestamptz,
  valid_until timestamptz,
  source text not null default 'flora' check (source in ('flora','stripe','manual','webhook','reconciliation')),
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  last_changed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stripe_prices_stripe_id_env_unique
  on public.stripe_prices(environment, stripe_price_id)
  where stripe_price_id is not null;
create unique index if not exists stripe_prices_lookup_env_unique
  on public.stripe_prices(environment, lookup_key)
  where lookup_key is not null;
create index if not exists idx_stripe_prices_entity
  on public.stripe_prices(tenant_id, entity_type, entity_id, environment, status);
create index if not exists idx_stripe_prices_product_ref
  on public.stripe_prices(stripe_product_ref, status, valid_from desc);
create index if not exists idx_stripe_prices_channel
  on public.stripe_prices(tenant_id, channel, billing_type, status);

drop trigger if exists trg_stripe_prices_updated on public.stripe_prices;
create trigger trg_stripe_prices_updated before update on public.stripe_prices
  for each row execute function public.set_updated_at();

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stripe_price_ref uuid references public.stripe_prices(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  environment text not null default 'test' check (environment in ('test','production')),
  stripe_product_id text,
  previous_stripe_price_id text,
  new_stripe_price_id text,
  lookup_key text,
  previous_amount_cents integer,
  new_amount_cents integer,
  currency text not null default 'BRL',
  billing_type text,
  recurring_interval text,
  recurring_interval_count integer,
  channel text,
  status text not null default 'recorded'
    check (status in ('recorded','scheduled','active','archived','cancelled')),
  reason text,
  promotion_ref text,
  valid_from timestamptz,
  valid_until timestamptz,
  before_data jsonb,
  after_data jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_price_history_entity
  on public.price_history(tenant_id, entity_type, entity_id, created_at desc);
create index if not exists idx_price_history_price
  on public.price_history(stripe_price_ref, created_at desc);

create table if not exists public.stripe_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null,
  environment text not null default 'test' check (environment in ('test','production')),
  action text not null check (action in (
    'test_connection',
    'search_stripe',
    'link_existing',
    'unlink',
    'create_product',
    'create_price',
    'publish_catalog',
    'sync_now',
    'replace_price',
    'archive_price',
    'activate_price',
    'compare_data',
    'reconcile_catalog',
    'copy_test_to_production',
    'test_checkout',
    'import_from_stripe'
  )),
  entity_type text,
  entity_id uuid,
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','cancelled','dead')),
  idempotency_key text not null,
  priority integer not null default 50 check (priority between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts > 0),
  next_attempt_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists idx_stripe_sync_jobs_queue
  on public.stripe_sync_jobs(status, priority desc, next_attempt_at, created_at)
  where status in ('queued','failed');
create index if not exists idx_stripe_sync_jobs_tenant
  on public.stripe_sync_jobs(tenant_id, environment, action, created_at desc);

drop trigger if exists trg_stripe_sync_jobs_updated on public.stripe_sync_jobs;
create trigger trg_stripe_sync_jobs_updated before update on public.stripe_sync_jobs
  for each row execute function public.set_updated_at();

create table if not exists public.stripe_sync_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid references public.stripe_sync_jobs(id) on delete cascade,
  environment text not null default 'test' check (environment in ('test','production')),
  action text not null,
  level text not null default 'info' check (level in ('debug','info','warning','error')),
  message text not null,
  entity_type text,
  entity_id uuid,
  previous_data jsonb,
  next_data jsonb,
  request_payload jsonb,
  response_payload jsonb,
  error_code text,
  error_message text,
  duration_ms integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_stripe_sync_logs_job
  on public.stripe_sync_logs(job_id, created_at desc);
create index if not exists idx_stripe_sync_logs_tenant_level
  on public.stripe_sync_logs(tenant_id, level, created_at desc);

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  stripe_event_id text not null,
  event_type text not null,
  environment text not null default 'test' check (environment in ('test','production')),
  livemode boolean not null default false,
  api_version text,
  status text not null default 'received'
    check (status in ('received','processing','processed','ignored','failed','dead')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts > 0),
  next_attempt_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_event_id)
);

create index if not exists idx_stripe_webhook_events_status
  on public.stripe_webhook_events(status, next_attempt_at, created_at)
  where status in ('received','failed');
create index if not exists idx_stripe_webhook_events_tenant_type
  on public.stripe_webhook_events(tenant_id, event_type, created_at desc);

drop trigger if exists trg_stripe_webhook_events_updated on public.stripe_webhook_events;
create trigger trg_stripe_webhook_events_updated before update on public.stripe_webhook_events
  for each row execute function public.set_updated_at();

create table if not exists public.stripe_catalog_conflicts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stripe_product_ref uuid references public.stripe_products(id) on delete cascade,
  stripe_price_ref uuid references public.stripe_prices(id) on delete cascade,
  environment text not null default 'test' check (environment in ('test','production')),
  entity_type text not null,
  entity_id uuid,
  conflict_type text not null check (conflict_type in (
    'missing_product',
    'missing_price',
    'price_mismatch',
    'currency_mismatch',
    'recurrence_mismatch',
    'product_mismatch',
    'environment_mismatch',
    'lookup_key_duplicate',
    'metadata_mismatch',
    'archived_object',
    'permission_error',
    'api_error'
  )),
  field_name text,
  flora_value jsonb,
  stripe_value jsonb,
  severity text not null default 'warning' check (severity in ('info','warning','error','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved','ignored')),
  suggested_action text,
  resolution text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stripe_catalog_conflicts_tenant_status
  on public.stripe_catalog_conflicts(tenant_id, environment, status, severity, created_at desc);

drop trigger if exists trg_stripe_catalog_conflicts_updated on public.stripe_catalog_conflicts;
create trigger trg_stripe_catalog_conflicts_updated before update on public.stripe_catalog_conflicts
  for each row execute function public.set_updated_at();

create table if not exists public.stripe_environment_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  test_stripe_product_id text,
  production_stripe_product_id text,
  test_stripe_price_id text,
  production_stripe_price_id text,
  test_lookup_key text,
  production_lookup_key text,
  copy_status text not null default 'not_copied'
    check (copy_status in ('not_copied','queued','copied','divergent','failed')),
  last_copied_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, entity_type, entity_id)
);

create index if not exists idx_stripe_environment_mappings_status
  on public.stripe_environment_mappings(tenant_id, copy_status, updated_at desc);

drop trigger if exists trg_stripe_environment_mappings_updated on public.stripe_environment_mappings;
create trigger trg_stripe_environment_mappings_updated before update on public.stripe_environment_mappings
  for each row execute function public.set_updated_at();

alter table public.stripe_products enable row level security;
alter table public.commercial_price_entries enable row level security;
alter table public.stripe_prices enable row level security;
alter table public.price_history enable row level security;
alter table public.stripe_sync_jobs enable row level security;
alter table public.stripe_sync_logs enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_catalog_conflicts enable row level security;
alter table public.stripe_environment_mappings enable row level security;

drop policy if exists stripe_products_staff_read on public.stripe_products;
drop policy if exists stripe_products_admin_write on public.stripe_products;
create policy stripe_products_staff_read on public.stripe_products
  for select using (public.is_tenant_staff(tenant_id));
create policy stripe_products_admin_write on public.stripe_products
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists commercial_price_entries_staff_read on public.commercial_price_entries;
drop policy if exists commercial_price_entries_admin_write on public.commercial_price_entries;
create policy commercial_price_entries_staff_read on public.commercial_price_entries
  for select using (public.is_tenant_staff(tenant_id));
create policy commercial_price_entries_admin_write on public.commercial_price_entries
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists stripe_prices_staff_read on public.stripe_prices;
drop policy if exists stripe_prices_admin_write on public.stripe_prices;
create policy stripe_prices_staff_read on public.stripe_prices
  for select using (public.is_tenant_staff(tenant_id));
create policy stripe_prices_admin_write on public.stripe_prices
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists price_history_staff_read on public.price_history;
drop policy if exists price_history_admin_insert on public.price_history;
create policy price_history_staff_read on public.price_history
  for select using (public.is_tenant_staff(tenant_id));
create policy price_history_admin_insert on public.price_history
  for insert with check (public.is_tenant_admin(tenant_id));

drop policy if exists stripe_sync_jobs_staff_read on public.stripe_sync_jobs;
drop policy if exists stripe_sync_jobs_admin_write on public.stripe_sync_jobs;
create policy stripe_sync_jobs_staff_read on public.stripe_sync_jobs
  for select using (public.is_tenant_staff(tenant_id));
create policy stripe_sync_jobs_admin_write on public.stripe_sync_jobs
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists stripe_sync_logs_staff_read on public.stripe_sync_logs;
drop policy if exists stripe_sync_logs_admin_insert on public.stripe_sync_logs;
create policy stripe_sync_logs_staff_read on public.stripe_sync_logs
  for select using (public.is_tenant_staff(tenant_id));
create policy stripe_sync_logs_admin_insert on public.stripe_sync_logs
  for insert with check (public.is_tenant_admin(tenant_id));

drop policy if exists stripe_webhook_events_staff_read on public.stripe_webhook_events;
drop policy if exists stripe_webhook_events_admin_update on public.stripe_webhook_events;
create policy stripe_webhook_events_staff_read on public.stripe_webhook_events
  for select using (tenant_id is null or public.is_tenant_staff(tenant_id));
create policy stripe_webhook_events_admin_update on public.stripe_webhook_events
  for update using (tenant_id is not null and public.is_tenant_admin(tenant_id))
  with check (tenant_id is null or public.is_tenant_admin(tenant_id));

drop policy if exists stripe_catalog_conflicts_staff_read on public.stripe_catalog_conflicts;
drop policy if exists stripe_catalog_conflicts_admin_write on public.stripe_catalog_conflicts;
create policy stripe_catalog_conflicts_staff_read on public.stripe_catalog_conflicts
  for select using (public.is_tenant_staff(tenant_id));
create policy stripe_catalog_conflicts_admin_write on public.stripe_catalog_conflicts
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists stripe_environment_mappings_staff_read on public.stripe_environment_mappings;
drop policy if exists stripe_environment_mappings_admin_write on public.stripe_environment_mappings;
create policy stripe_environment_mappings_staff_read on public.stripe_environment_mappings
  for select using (public.is_tenant_staff(tenant_id));
create policy stripe_environment_mappings_admin_write on public.stripe_environment_mappings
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

insert into public.integration_providers (key, category, display_name, description, capabilities, docs_url)
values (
  'stripe',
  'payments',
  'Stripe',
  'Catálogo, preços, Checkout, webhooks, assinaturas, PIX, cartão, carteiras, reembolsos e reconciliação financeira.',
  '["catalog","products","prices","checkout","webhooks","pix","card","wallets","subscriptions","refunds","recurring_billing","promotion_codes","reconciliation"]'::jsonb,
  'https://docs.stripe.com'
)
on conflict (key) do update set
  category = excluded.category,
  display_name = excluded.display_name,
  description = excluded.description,
  capabilities = excluded.capabilities,
  docs_url = excluded.docs_url,
  is_active = true,
  updated_at = now();

insert into public.integration_connections (
  tenant_id,
  provider_key,
  display_name,
  environment,
  status,
  credentials_status,
  settings,
  auto_sync_enabled
)
select
  t.id,
  'stripe',
  'Stripe · Teste',
  'test',
  'pending_auth',
  'missing',
  '{"catalog_source":"flora","conflict_mode":"approval","allow_live_price_changes":false}'::jsonb,
  false
from public.tenants t
where t.status = 'active'
on conflict (tenant_id, provider_key, environment) do nothing;

insert into public.integration_connections (
  tenant_id,
  provider_key,
  display_name,
  environment,
  status,
  credentials_status,
  settings,
  auto_sync_enabled
)
select
  t.id,
  'stripe',
  'Stripe · Produção',
  'production',
  'pending_auth',
  'missing',
  '{"catalog_source":"flora","conflict_mode":"approval","allow_live_price_changes":false}'::jsonb,
  false
from public.tenants t
where t.status = 'active'
on conflict (tenant_id, provider_key, environment) do nothing;
