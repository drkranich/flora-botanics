-- ============================================================
-- FLORA BOTANICS · Marketing e Relacionamento
-- Fundação para campanhas, públicos, segmentos, jornadas,
-- consentimentos, filas, atribuição, logs e biblioteca de templates.
-- ============================================================

create extension if not exists pgcrypto;

-- Compatibilidade: a aplicação já usa campaigns, mas a migration
-- fundadora não estava presente no histórico local.
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  subtitle text,
  status text not null default 'draft',
  channel text,
  target_cities text[] not null default '{}',
  target_regions text[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  views integer not null default 0,
  clicks integer not null default 0,
  orders integer not null default 0,
  revenue_cents integer not null default 0,
  budget_cents integer not null default 0,
  body text,
  cta_label text,
  cta_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

alter table public.campaigns
  add column if not exists internal_code text,
  add column if not exists objective text,
  add column if not exists audience_id uuid,
  add column if not exists product_id uuid,
  add column if not exists kit_id uuid,
  add column if not exists combo_id uuid,
  add column if not exists subscription_id uuid,
  add column if not exists coupon_id uuid,
  add column if not exists landing_page_id uuid,
  add column if not exists cost_cents integer not null default 0,
  add column if not exists owner_name text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists goals jsonb not null default '{}',
  add column if not exists indicators jsonb not null default '{}',
  add column if not exists attachments jsonb not null default '[]',
  add column if not exists notes text,
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz;

create index if not exists campaigns_tenant_status_idx on public.campaigns(tenant_id, status);
create index if not exists campaigns_period_idx on public.campaigns(tenant_id, starts_at, ends_at);

alter table public.campaigns enable row level security;
drop policy if exists campaigns_staff_read on public.campaigns;
drop policy if exists campaigns_admin_write on public.campaigns;
create policy campaigns_staff_read on public.campaigns
  for select using (public.is_tenant_staff(tenant_id));
create policy campaigns_admin_write on public.campaigns
  for all using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- Enriquecimento da biblioteca de templates já existente.
alter table public.message_templates
  add column if not exists category text,
  add column if not exists version integer not null default 1,
  add column if not exists status text not null default 'draft',
  add column if not exists language text not null default 'pt-BR',
  add column if not exists preview text,
  add column if not exists blocks jsonb not null default '[]',
  add column if not exists metadata jsonb not null default '{}';

create table if not exists public.marketing_template_blueprints (
  id text primary key,
  name text not null,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'internal')),
  category text not null,
  subject text,
  description text not null,
  variables text[] not null default '{}',
  blocks jsonb not null default '[]',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.marketing_template_blueprints enable row level security;
drop policy if exists marketing_template_blueprints_read on public.marketing_template_blueprints;
create policy marketing_template_blueprints_read on public.marketing_template_blueprints
  for select to authenticated using (true);

insert into public.marketing_template_blueprints
  (id, name, channel, category, subject, description, variables, blocks)
values
  ('launch-editorial', 'Lançamento editorial', 'email', 'lançamento', 'Conheça {{campaign.name}}', 'Apresenta novos produtos, kits ou coleções com estética editorial Flora.', array['customer.first_name','campaign.name','product.name','cta.url'], '[{"type":"heading","text":"{{campaign.name}}"},{"type":"text","html":"<p>Uma nova rotina Flora está disponível para você.</p>"},{"type":"cta","label":"Conhecer lançamento","url":"{{cta.url}}"}]'),
  ('promo-benefit', 'Promoção com benefício', 'email', 'promoção', '{{coupon.code}} para sua próxima compra', 'Modelo promocional com cupom, validade e chamada de recompra.', array['customer.first_name','coupon.code','coupon.expires_at','cta.url'], '[{"type":"heading","text":"Um benefício Flora para você"},{"type":"text","html":"<p>Use o cupom <strong>{{coupon.code}}</strong> até {{coupon.expires_at}}.</p>"},{"type":"cta","label":"Usar cupom","url":"{{cta.url}}"}]'),
  ('welcome-account', 'Boas-vindas à conta', 'email', 'boas-vindas', 'Bem-vinda à Flora, {{customer.first_name}}', 'Primeiro contato para clientes que criaram conta.', array['customer.first_name','account.url'], '[{"type":"heading","text":"Bem-vinda à Flora"},{"type":"text","html":"<p>Sua conta foi criada com segurança.</p>"},{"type":"cta","label":"Acessar conta","url":"{{account.url}}"}]'),
  ('order-approved', 'Pedido aprovado', 'email', 'pedido aprovado', 'Pedido #{{order.number}} aprovado', 'Confirma pagamento e início da preparação.', array['customer.first_name','order.number','order.total','order.url'], '[{"type":"heading","text":"Pedido aprovado"},{"type":"text","html":"<p>Recebemos o pagamento do pedido <strong>#{{order.number}}</strong>.</p>"},{"type":"cta","label":"Acompanhar pedido","url":"{{order.url}}"}]'),
  ('order-preparing', 'Pedido em preparação', 'email', 'pedido em preparação', 'Seu pedido #{{order.number}} está em preparação', 'Atualização transacional para separação e embalagem.', array['customer.first_name','order.number'], '[{"type":"heading","text":"Seu ritual está sendo preparado"},{"type":"text","html":"<p>Estamos separando seu pedido com cuidado.</p>"}]'),
  ('order-shipped', 'Pedido expedido', 'email', 'pedido expedido', 'Pedido #{{order.number}} enviado', 'Envio de transportadora, código e link de rastreamento.', array['customer.first_name','order.number','shipment.tracking_code','shipment.tracking_url','shipment.carrier'], '[{"type":"heading","text":"Seu pedido está a caminho"},{"type":"text","html":"<p>Transportadora: {{shipment.carrier}}<br/>Código: {{shipment.tracking_code}}</p>"},{"type":"cta","label":"Rastrear pedido","url":"{{shipment.tracking_url}}"}]'),
  ('order-delivered', 'Pedido entregue', 'email', 'pedido entregue', 'Seu pedido #{{order.number}} foi entregue', 'Confirma entrega e inicia pós-venda.', array['customer.first_name','order.number','review.url'], '[{"type":"heading","text":"Pedido entregue"},{"type":"text","html":"<p>Esperamos que sua rotina Flora seja especial.</p>"},{"type":"cta","label":"Avaliar experiência","url":"{{review.url}}"}]'),
  ('review-request', 'Pedido de avaliação', 'email', 'avaliação', 'Como foi sua experiência?', 'Solicita avaliação após uso inicial.', array['customer.first_name','order.number','review.url'], '[{"type":"heading","text":"Conte como foi sua experiência"},{"type":"text","html":"<p>Sua opinião ajuda a Flora a cuidar melhor.</p>"},{"type":"cta","label":"Avaliar agora","url":"{{review.url}}"}]'),
  ('repurchase', 'Recompra sugerida', 'email', 'recompra', 'Hora de repor seu cuidado Flora?', 'Sugere recompra perto do ciclo estimado do produto.', array['customer.first_name','product.name','cta.url'], '[{"type":"heading","text":"Seu cuidado pode estar perto do fim"},{"type":"text","html":"<p>{{product.name}} pode ser reposto com poucos cliques.</p>"},{"type":"cta","label":"Comprar novamente","url":"{{cta.url}}"}]'),
  ('abandoned-cart', 'Carrinho abandonado', 'email', 'carrinho abandonado', 'Você esqueceu algo, {{customer.first_name}}', 'Recupera carrinhos com link direto de checkout.', array['customer.first_name','cart.total','cart.url'], '[{"type":"heading","text":"Você esqueceu algo"},{"type":"text","html":"<p>Seu carrinho ainda está reservado por pouco tempo.</p>"},{"type":"cta","label":"Finalizar compra","url":"{{cart.url}}"}]'),
  ('subscription-next', 'Próxima assinatura', 'email', 'assinatura', 'Sua próxima entrega Flora', 'Lembrete de cobrança e entrega recorrente.', array['customer.first_name','subscription.next_billing_date','subscription.next_delivery_date'], '[{"type":"heading","text":"Sua próxima entrega Flora"},{"type":"text","html":"<p>Próxima cobrança: {{subscription.next_billing_date}}.</p>"}]'),
  ('payment-refused', 'Pagamento recusado', 'email', 'pagamento recusado', 'Atualize o pagamento do pedido #{{order.number}}', 'Mensagem segura para falha de pagamento.', array['customer.first_name','order.number','payment.url'], '[{"type":"heading","text":"Pagamento não aprovado"},{"type":"text","html":"<p>Você pode atualizar o método de pagamento com segurança.</p>"},{"type":"cta","label":"Atualizar pagamento","url":"{{payment.url}}"}]'),
  ('birthday', 'Aniversário', 'email', 'aniversário', 'Um cuidado especial para você', 'Relacionamento e benefício em aniversário.', array['customer.first_name','coupon.code','cta.url'], '[{"type":"heading","text":"Um cuidado especial para você"},{"type":"text","html":"<p>Use {{coupon.code}} para celebrar seu novo ciclo.</p>"},{"type":"cta","label":"Escolher presente","url":"{{cta.url}}"}]'),
  ('reactivation', 'Reativação', 'email', 'reativação', 'Sentimos sua falta na Flora', 'Reativa clientes inativos.', array['customer.first_name','cta.url'], '[{"type":"heading","text":"Sentimos sua falta"},{"type":"text","html":"<p>Há novidades na Flora para sua rotina.</p>"},{"type":"cta","label":"Voltar para Flora","url":"{{cta.url}}"}]'),
  ('b2b-proposal', 'Proposta B2B', 'email', 'B2B', 'Proposta Flora Botanics para {{company.name}}', 'Modelo para lojas, clínicas, hotéis e parceiros.', array['company.name','proposal.number','proposal.url'], '[{"type":"heading","text":"Proposta comercial Flora Botanics"},{"type":"text","html":"<p>Preparamos uma condição para {{company.name}}.</p>"},{"type":"cta","label":"Ver proposta","url":"{{proposal.url}}"}]'),
  ('quote-sent', 'Orçamento enviado', 'email', 'orçamento', 'Orçamento #{{quote.number}}', 'Envia orçamento com link e validade.', array['customer.first_name','quote.number','quote.expires_at','quote.url'], '[{"type":"heading","text":"Seu orçamento Flora"},{"type":"text","html":"<p>O orçamento #{{quote.number}} vale até {{quote.expires_at}}.</p>"},{"type":"cta","label":"Ver orçamento","url":"{{quote.url}}"}]'),
  ('post-sale-routine', 'Rotina pós-venda', 'email', 'pós-venda', 'Como encaixar seus produtos Flora na rotina', 'Instruções editoriais alguns dias após a entrega.', array['customer.first_name','product.name'], '[{"type":"heading","text":"Sua rotina Flora"},{"type":"text","html":"<p>Use {{product.name}} conforme a orientação do rótulo e combine com uma rotina simples.</p>"}]'),
  ('holiday-date', 'Data comemorativa', 'email', 'datas comemorativas', '{{campaign.name}} chegou à Flora', 'Campanha sazonal com presente, kit ou oferta.', array['customer.first_name','campaign.name','cta.url'], '[{"type":"heading","text":"{{campaign.name}}"},{"type":"text","html":"<p>Uma seleção especial Flora para esta data.</p>"},{"type":"cta","label":"Ver seleção","url":"{{cta.url}}"}]')
on conflict (id) do update set
  name = excluded.name,
  channel = excluded.channel,
  category = excluded.category,
  subject = excluded.subject,
  description = excluded.description,
  variables = excluded.variables,
  blocks = excluded.blocks,
  status = excluded.status;

create table if not exists public.marketing_audiences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  audience_type text not null default 'dynamic' check (audience_type in ('static', 'dynamic')),
  filters jsonb not null default '{}',
  size_estimate integer not null default 0,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  tags text[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  audience_id uuid references public.marketing_audiences(id) on delete set null,
  name text not null,
  description text,
  segment_type text not null default 'dynamic' check (segment_type in ('static', 'dynamic')),
  filters jsonb not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  tags text[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_landing_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  slug text not null,
  title text not null,
  template_key text,
  content jsonb not null default '{}',
  seo jsonb not null default '{}',
  utm jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'paused', 'archived')),
  publish_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

alter table public.campaigns
  drop constraint if exists campaigns_audience_id_fkey,
  add constraint campaigns_audience_id_fkey foreign key (audience_id) references public.marketing_audiences(id) on delete set null,
  drop constraint if exists campaigns_landing_page_id_fkey,
  add constraint campaigns_landing_page_id_fkey foreign key (landing_page_id) references public.marketing_landing_pages(id) on delete set null;

create table if not exists public.marketing_campaign_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'internal', 'landing_page', 'coupon', 'meta_ads', 'google_ads', 'remarketing')),
  template_id uuid references public.message_templates(id) on delete set null,
  segment_id uuid references public.marketing_segments(id) on delete set null,
  audience_id uuid references public.marketing_audiences(id) on delete set null,
  subject text,
  preheader text,
  message text,
  send_at timestamptz,
  timezone text not null default 'America/Sao_Paulo',
  utm jsonb not null default '{}',
  metrics jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'sent', 'cancelled', 'failed')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_journeys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  trigger_key text not null,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'scheduled', 'active', 'paused', 'ended', 'archived')),
  filters jsonb not null default '{}',
  schedule_rules jsonb not null default '{}',
  approval_required boolean not null default false,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_journey_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  journey_id uuid not null references public.marketing_journeys(id) on delete cascade,
  step_order integer not null default 1,
  step_type text not null check (step_type in ('send_email', 'send_sms', 'send_whatsapp', 'add_tag', 'remove_tag', 'add_segment', 'create_task', 'create_alert', 'send_coupon', 'wait', 'check_condition', 'end')),
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (journey_id, step_order)
);

create table if not exists public.marketing_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  email text,
  phone text,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'ads', 'personalization', 'cookies', 'remarketing', 'transactional')),
  purpose text not null default 'marketing',
  status text not null check (status in ('granted', 'revoked')),
  source text,
  text_presented text,
  consent_version text,
  ip_address inet,
  user_agent text,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_channel_id uuid references public.marketing_campaign_channels(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  channel text,
  event_type text not null,
  provider text,
  external_id text,
  cost_cents integer not null default 0,
  revenue_cents integer not null default 0,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create table if not exists public.marketing_message_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_channel_id uuid references public.marketing_campaign_channels(id) on delete set null,
  journey_id uuid references public.marketing_journeys(id) on delete set null,
  template_id uuid references public.message_templates(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'internal')),
  recipient text not null,
  payload jsonb not null default '{}',
  idempotency_key text not null,
  priority integer not null default 5,
  run_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'cancelled', 'dead')),
  last_error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table if not exists public.marketing_provider_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  action text not null,
  environment text not null default 'production',
  status text not null default 'success' check (status in ('success', 'warning', 'error')),
  latency_ms integer,
  request_payload jsonb not null default '{}',
  response_payload jsonb not null default '{}',
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_attribution_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  visitor_id text,
  session_id text,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  event_name text not null,
  source text,
  medium text,
  campaign text,
  term text,
  content text,
  model text,
  revenue_cents integer not null default 0,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create table if not exists public.marketing_ab_tests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  name text not null,
  hypothesis text,
  variable text not null,
  sample_size integer,
  winner_metric text,
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'completed', 'cancelled')),
  variants jsonb not null default '[]',
  results jsonb not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices de operação.
create index if not exists marketing_audiences_tenant_status_idx on public.marketing_audiences(tenant_id, status);
create index if not exists marketing_segments_tenant_status_idx on public.marketing_segments(tenant_id, status);
create index if not exists marketing_campaign_channels_campaign_idx on public.marketing_campaign_channels(tenant_id, campaign_id, status);
create index if not exists marketing_journeys_tenant_status_idx on public.marketing_journeys(tenant_id, status);
create index if not exists marketing_events_campaign_idx on public.marketing_events(tenant_id, campaign_id, event_type);
create index if not exists marketing_events_customer_idx on public.marketing_events(tenant_id, customer_id, occurred_at desc);
create index if not exists marketing_message_queue_due_idx on public.marketing_message_queue(status, run_at, priority);
create index if not exists marketing_attribution_order_idx on public.marketing_attribution_events(tenant_id, order_id);

-- RLS e políticas por tenant.
alter table public.marketing_audiences enable row level security;
alter table public.marketing_segments enable row level security;
alter table public.marketing_landing_pages enable row level security;
alter table public.marketing_campaign_channels enable row level security;
alter table public.marketing_journeys enable row level security;
alter table public.marketing_journey_steps enable row level security;
alter table public.marketing_consents enable row level security;
alter table public.marketing_events enable row level security;
alter table public.marketing_message_queue enable row level security;
alter table public.marketing_provider_logs enable row level security;
alter table public.marketing_attribution_events enable row level security;
alter table public.marketing_ab_tests enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'marketing_audiences',
    'marketing_segments',
    'marketing_landing_pages',
    'marketing_campaign_channels',
    'marketing_journeys',
    'marketing_journey_steps',
    'marketing_consents',
    'marketing_events',
    'marketing_message_queue',
    'marketing_provider_logs',
    'marketing_attribution_events',
    'marketing_ab_tests'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_staff_read', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_admin_write', tbl);
    execute format(
      'create policy %I on public.%I for select using (public.is_tenant_staff(tenant_id))',
      tbl || '_staff_read',
      tbl
    );
    execute format(
      'create policy %I on public.%I for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id))',
      tbl || '_admin_write',
      tbl
    );
  end loop;
end $$;

grant select on public.marketing_template_blueprints to authenticated;
grant select, insert, update, delete on
  public.campaigns,
  public.marketing_audiences,
  public.marketing_segments,
  public.marketing_landing_pages,
  public.marketing_campaign_channels,
  public.marketing_journeys,
  public.marketing_journey_steps,
  public.marketing_consents,
  public.marketing_events,
  public.marketing_message_queue,
  public.marketing_provider_logs,
  public.marketing_attribution_events,
  public.marketing_ab_tests
to authenticated;
