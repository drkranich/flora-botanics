-- ============================================================
-- FLORA ECOSYSTEM · Central de integrações, Event Bus e fila
-- Fundação para transportadoras, SEFAZ, marketplaces, Stripe,
-- e-commerce hub, automações e monitoramento operacional.
-- ============================================================

-- ---------- catálogo de providers disponíveis ----------
create table if not exists public.integration_providers (
  key text primary key,
  category text not null check (category in (
    'payments',
    'shipping',
    'marketplace',
    'ecommerce',
    'fiscal',
    'messaging',
    'analytics',
    'internal'
  )),
  display_name text not null,
  description text,
  capabilities jsonb not null default '[]'::jsonb,
  supports_test boolean not null default true,
  supports_production boolean not null default true,
  docs_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_integration_providers_updated on public.integration_providers;
create trigger trg_integration_providers_updated before update on public.integration_providers
  for each row execute function public.set_updated_at();

-- ---------- conexões por tenant/site ----------
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_key text not null references public.integration_providers(key) on delete restrict,
  channel_account_id uuid references public.channel_accounts(id) on delete set null,
  display_name text,
  environment text not null default 'test' check (environment in ('test','production')),
  status text not null default 'offline'
    check (status in ('online','offline','error','pending_auth','paused')),
  credentials_status text not null default 'missing'
    check (credentials_status in ('missing','stored','expired','invalid')),
  credentials_ref text,
  credentials_preview jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  auto_sync_enabled boolean not null default false,
  sync_interval_minutes integer not null default 30 check (sync_interval_minutes > 0),
  last_sync_at timestamptz,
  last_healthcheck_at timestamptz,
  last_error text,
  latency_ms integer,
  error_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider_key, environment)
);

create index if not exists idx_integration_connections_tenant_status
  on public.integration_connections(tenant_id, status, provider_key);
create index if not exists idx_integration_connections_auto_sync
  on public.integration_connections(auto_sync_enabled, status, last_sync_at)
  where auto_sync_enabled = true;

drop trigger if exists trg_integration_connections_updated on public.integration_connections;
create trigger trg_integration_connections_updated before update on public.integration_connections
  for each row execute function public.set_updated_at();

-- ---------- execuções de sincronização ----------
create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null,
  provider_key text not null references public.integration_providers(key) on delete restrict,
  action text not null,
  trigger text not null default 'manual'
    check (trigger in ('manual','automatic','webhook','event','retry')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','cancelled')),
  records_in integer not null default 0,
  records_out integer not null default 0,
  request_payload jsonb,
  response_payload jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_sync_runs_tenant_created
  on public.integration_sync_runs(tenant_id, created_at desc);
create index if not exists idx_integration_sync_runs_connection_status
  on public.integration_sync_runs(connection_id, status, created_at desc);

-- ---------- Event Bus interno ----------
create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null,
  source text not null,
  source_id text,
  aggregate_type text,
  aggregate_id text,
  status text not null default 'queued'
    check (status in ('queued','processing','succeeded','failed','dead','cancelled')),
  priority integer not null default 50 check (priority between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts > 0),
  next_attempt_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists idx_integration_events_queue
  on public.integration_events(status, priority desc, next_attempt_at, created_at)
  where status in ('queued','failed');
create index if not exists idx_integration_events_tenant_type
  on public.integration_events(tenant_id, event_type, created_at desc);

drop trigger if exists trg_integration_events_updated on public.integration_events;
create trigger trg_integration_events_updated before update on public.integration_events
  for each row execute function public.set_updated_at();

-- ---------- entregas do evento para providers/adapters ----------
create table if not exists public.integration_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_id uuid not null references public.integration_events(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null,
  provider_key text references public.integration_providers(key) on delete restrict,
  action text not null,
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','skipped','dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts > 0),
  next_attempt_at timestamptz not null default now(),
  request_payload jsonb,
  response_payload jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_event_deliveries_queue
  on public.integration_event_deliveries(status, next_attempt_at, created_at)
  where status in ('queued','failed');
create index if not exists idx_integration_event_deliveries_event
  on public.integration_event_deliveries(event_id, created_at desc);

-- ---------- alertas operacionais ----------
create table if not exists public.integration_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null,
  provider_key text references public.integration_providers(key) on delete restrict,
  severity text not null default 'warning'
    check (severity in ('info','warning','error','critical')),
  title text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  context jsonb not null default '{}'::jsonb,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integration_alerts_tenant_status
  on public.integration_alerts(tenant_id, status, severity, created_at desc);

drop trigger if exists trg_integration_alerts_updated on public.integration_alerts;
create trigger trg_integration_alerts_updated before update on public.integration_alerts
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.integration_providers enable row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.integration_events enable row level security;
alter table public.integration_event_deliveries enable row level security;
alter table public.integration_alerts enable row level security;

drop policy if exists integration_providers_read on public.integration_providers;
create policy integration_providers_read on public.integration_providers
  for select using (true);

drop policy if exists integration_connections_staff_read on public.integration_connections;
drop policy if exists integration_connections_admin_write on public.integration_connections;
create policy integration_connections_staff_read on public.integration_connections
  for select using (public.is_tenant_staff(tenant_id));
create policy integration_connections_admin_write on public.integration_connections
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists integration_sync_runs_staff_read on public.integration_sync_runs;
drop policy if exists integration_sync_runs_admin_insert on public.integration_sync_runs;
drop policy if exists integration_sync_runs_admin_update on public.integration_sync_runs;
create policy integration_sync_runs_staff_read on public.integration_sync_runs
  for select using (public.is_tenant_staff(tenant_id));
create policy integration_sync_runs_admin_insert on public.integration_sync_runs
  for insert with check (public.is_tenant_admin(tenant_id));
create policy integration_sync_runs_admin_update on public.integration_sync_runs
  for update using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists integration_events_staff_read on public.integration_events;
drop policy if exists integration_events_admin_insert on public.integration_events;
drop policy if exists integration_events_admin_update on public.integration_events;
create policy integration_events_staff_read on public.integration_events
  for select using (public.is_tenant_staff(tenant_id));
create policy integration_events_admin_insert on public.integration_events
  for insert with check (public.is_tenant_admin(tenant_id));
create policy integration_events_admin_update on public.integration_events
  for update using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists integration_event_deliveries_staff_read on public.integration_event_deliveries;
drop policy if exists integration_event_deliveries_admin_insert on public.integration_event_deliveries;
drop policy if exists integration_event_deliveries_admin_update on public.integration_event_deliveries;
create policy integration_event_deliveries_staff_read on public.integration_event_deliveries
  for select using (public.is_tenant_staff(tenant_id));
create policy integration_event_deliveries_admin_insert on public.integration_event_deliveries
  for insert with check (public.is_tenant_admin(tenant_id));
create policy integration_event_deliveries_admin_update on public.integration_event_deliveries
  for update using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists integration_alerts_staff_read on public.integration_alerts;
drop policy if exists integration_alerts_admin_write on public.integration_alerts;
create policy integration_alerts_staff_read on public.integration_alerts
  for select using (public.is_tenant_staff(tenant_id));
create policy integration_alerts_admin_write on public.integration_alerts
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- ---------- providers iniciais pedidos na missão ----------
insert into public.integration_providers (key, category, display_name, description, capabilities, docs_url)
values
  ('stripe', 'payments', 'Stripe', 'Pagamentos, checkout, webhooks, PIX, cartão, assinaturas e reembolsos.', '["checkout","webhooks","pix","card","wallets","subscriptions","refunds","recurring_billing"]'::jsonb, 'https://docs.stripe.com'),
  ('resend', 'messaging', 'Resend', 'E-mails transacionais, automações, carrinhos abandonados e templates.', '["send_email","transactional_email","templates","webhooks"]'::jsonb, 'https://resend.com/docs'),
  ('whatsapp', 'messaging', 'WhatsApp Business API', 'Atendimento, avisos de pedido, recuperação de carrinho e mensagens transacionais.', '["send_message","templates","webhooks","inbox"]'::jsonb, 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started'),
  ('instagram', 'messaging', 'Instagram / Meta', 'DMs, vitrine social, catálogo e atendimento integrado.', '["messages","catalog","webhooks","inbox"]'::jsonb, 'https://developers.facebook.com/docs/instagram-api'),
  ('correios', 'shipping', 'Correios', 'Cotação, etiquetas, rastreamento e postagem nacional.', '["quote_shipping","labels","tracking","deadline","cost"]'::jsonb, 'https://www.correios.com.br'),
  ('azul_cargo', 'shipping', 'Azul Cargo Express', 'Cotação, etiquetas e rastreamento via Azul Cargo Express.', '["quote_shipping","labels","tracking","deadline","cost"]'::jsonb, 'https://www.azulcargoexpress.com.br'),
  ('loggi', 'shipping', 'Loggi', 'Cotação, coleta, etiquetas e rastreamento urbano/nacional.', '["quote_shipping","labels","tracking","pickup","deadline","cost"]'::jsonb, 'https://docs.api.loggi.com'),
  ('jt_express', 'shipping', 'J&T Express', 'Cotação, etiquetas, rastreamento e remessas J&T Express.', '["quote_shipping","labels","tracking","deadline","cost"]'::jsonb, 'https://www.jtexpress.com.br'),
  ('melhor_envio', 'shipping', 'Melhor Envio', 'Gateway logístico para cotação, etiqueta, rastreamento e múltiplas transportadoras.', '["quote_shipping","labels","tracking","multi_carrier","deadline","cost"]'::jsonb, 'https://docs.melhorenvio.com.br'),
  ('sefaz', 'fiscal', 'SEFAZ / NF-e', 'Emissão fiscal, XML, DANFE, cancelamento, inutilização e carta de correção.', '["nfe","xml","danfe","cancel","correction_letter","manifestation"]'::jsonb, null),
  ('mercado_livre', 'marketplace', 'Mercado Livre', 'Produtos, estoque, preços, pedidos e anúncios.', '["products","stock","prices","orders","listings","webhooks"]'::jsonb, 'https://developers.mercadolivre.com.br/pt_br/inicio'),
  ('shopee', 'marketplace', 'Shopee', 'Produtos, estoque, preços, pedidos e anúncios.', '["products","stock","prices","orders","listings","webhooks"]'::jsonb, 'https://open.shopee.com/documents'),
  ('amazon', 'marketplace', 'Amazon', 'Produtos, estoque, pedidos e anúncios via SP-API.', '["products","stock","prices","orders","listings","webhooks"]'::jsonb, 'https://developer-docs.amazon.com/sp-api'),
  ('tiktok', 'marketplace', 'TikTok Shop', 'Produtos, estoque, preços, pedidos, vídeos e lives comerciais.', '["products","stock","prices","orders","listings","webhooks"]'::jsonb, 'https://partner.tiktokshop.com/doc/page/intro'),
  ('google_merchant', 'marketplace', 'Google Merchant Center', 'Produtos no Google Shopping e busca, com feed e disponibilidade.', '["products","stock","prices","feed","diagnostics"]'::jsonb, 'https://developers.google.com/shopping-content/guides/quickstart'),
  ('magalu', 'marketplace', 'Magalu', 'Produtos, estoque, preços e pedidos.', '["products","stock","prices","orders","listings"]'::jsonb, null),
  ('americanas', 'marketplace', 'Americanas', 'Produtos, estoque, preços e pedidos.', '["products","stock","prices","orders","listings"]'::jsonb, null),
  ('casas_bahia', 'marketplace', 'Casas Bahia', 'Produtos, estoque, preços e pedidos.', '["products","stock","prices","orders","listings"]'::jsonb, null),
  ('carrefour', 'marketplace', 'Carrefour', 'Produtos, estoque, preços e pedidos.', '["products","stock","prices","orders","listings"]'::jsonb, null),
  ('shopify', 'ecommerce', 'Shopify', 'Catálogo, estoque, preços e pedidos centralizados.', '["products","stock","prices","orders","webhooks"]'::jsonb, 'https://shopify.dev/docs/api'),
  ('woocommerce', 'ecommerce', 'WooCommerce', 'Catálogo, estoque, preços e pedidos centralizados.', '["products","stock","prices","orders","webhooks"]'::jsonb, 'https://woocommerce.github.io/woocommerce-rest-api-docs'),
  ('nuvemshop', 'ecommerce', 'Nuvemshop', 'Catálogo, estoque, preços e pedidos centralizados.', '["products","stock","prices","orders","webhooks"]'::jsonb, 'https://tiendanube.github.io/api-documentation'),
  ('tray', 'ecommerce', 'Tray', 'Catálogo, estoque, preços e pedidos centralizados.', '["products","stock","prices","orders","webhooks"]'::jsonb, null),
  ('loja_integrada', 'ecommerce', 'Loja Integrada', 'Catálogo, estoque, preços e pedidos centralizados.', '["products","stock","prices","orders","webhooks"]'::jsonb, null),
  ('vtex', 'ecommerce', 'VTEX', 'Catálogo, estoque, preços e pedidos centralizados.', '["products","stock","prices","orders","webhooks"]'::jsonb, 'https://developers.vtex.com'),
  ('magento', 'ecommerce', 'Magento / Adobe Commerce', 'Catálogo, estoque, preços e pedidos centralizados.', '["products","stock","prices","orders","webhooks"]'::jsonb, 'https://developer.adobe.com/commerce')
on conflict (key) do update set
  category = excluded.category,
  display_name = excluded.display_name,
  description = excluded.description,
  capabilities = excluded.capabilities,
  docs_url = excluded.docs_url,
  is_active = true,
  updated_at = now();

-- Conexões internas mínimas para tenants existentes.
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
  p.key,
  p.display_name,
  'production',
  case when p.key in ('resend') then 'pending_auth' else 'offline' end,
  'missing',
  '{}'::jsonb,
  false
from public.tenants t
cross join public.integration_providers p
where t.status = 'active'
  and p.key in (
    'resend','whatsapp','instagram','stripe','sefaz',
    'correios','azul_cargo','loggi','jt_express','melhor_envio',
    'mercado_livre','shopee','amazon','tiktok','google_merchant',
    'shopify','woocommerce','nuvemshop','tray','loja_integrada','vtex','magento'
  )
on conflict (tenant_id, provider_key, environment) do nothing;
