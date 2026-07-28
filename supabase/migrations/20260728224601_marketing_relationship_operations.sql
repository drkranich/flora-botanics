-- ============================================================
-- FLORA BOTANICS · Marketing e Relacionamento Operacional
-- Complementa a fundação com cron, webhooks, calendário,
-- aprovações, preferências, custos, timeline e reprocessamento.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.marketing_message_queue
  add column if not exists provider text,
  add column if not exists external_id text,
  add column if not exists provider_event_type text,
  add column if not exists cost_cents integer not null default 0,
  add column if not exists sent_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists clicked_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists dead_reason text;

create index if not exists marketing_message_queue_external_idx
  on public.marketing_message_queue(provider, external_id)
  where external_id is not null;

create table if not exists public.marketing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  provider text not null,
  external_id text not null,
  event_type text not null,
  queue_id uuid references public.marketing_message_queue(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  headers jsonb not null default '{}',
  payload jsonb not null default '{}',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table if not exists public.marketing_customer_timeline (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  queue_id uuid references public.marketing_message_queue(id) on delete set null,
  channel text,
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create table if not exists public.marketing_preference_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  email text,
  phone text,
  token text not null default encode(gen_random_bytes(24), 'hex'),
  email_marketing boolean not null default true,
  sms_marketing boolean not null default false,
  whatsapp_marketing boolean not null default false,
  transactional_messages boolean not null default true,
  ads_personalization boolean not null default false,
  remarketing boolean not null default false,
  frequency text not null default 'normal' check (frequency in ('low','normal','high','paused')),
  interests text[] not null default '{}',
  source text,
  consent_version text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, token)
);

create unique index if not exists marketing_preference_profiles_email_idx
  on public.marketing_preference_profiles(tenant_id, lower(email))
  where email is not null;

create table if not exists public.marketing_calendar_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  title text not null,
  item_type text not null default 'campaign'
    check (item_type in ('campaign','send','ad','launch','holiday','coupon','landing_page','content','task')),
  channel text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'planned'
    check (status in ('planned','draft','review','approved','scheduled','active','done','cancelled')),
  owner_name text,
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_campaign_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reason text,
  decision_notes text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.marketing_cost_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  channel text,
  provider text,
  cost_type text not null default 'media'
    check (cost_type in ('media','message','creative','tool','agency','coupon','shipping','other')),
  description text not null,
  quantity numeric(12,4) not null default 1,
  unit_cost_cents integer not null default 0,
  total_cost_cents integer generated always as ((quantity * unit_cost_cents)::integer) stored,
  occurred_at date not null default current_date,
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_provider_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_key text not null,
  provider_type text not null
    check (provider_type in ('email','sms','whatsapp','meta_ads','google_ads','analytics','crm','webhook')),
  display_name text not null,
  status text not null default 'pending'
    check (status in ('online','offline','pending','error','paused')),
  environment text not null default 'production' check (environment in ('test','production')),
  last_sync_at timestamptz,
  last_error text,
  config jsonb not null default '{}',
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider_key, environment)
);

create table if not exists public.marketing_report_exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  report_type text not null,
  format text not null check (format in ('pdf','csv','xlsx')),
  filters jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','processing','ready','failed')),
  file_url text,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.marketing_webhook_events enable row level security;
alter table public.marketing_customer_timeline enable row level security;
alter table public.marketing_preference_profiles enable row level security;
alter table public.marketing_calendar_items enable row level security;
alter table public.marketing_campaign_approvals enable row level security;
alter table public.marketing_cost_entries enable row level security;
alter table public.marketing_provider_connections enable row level security;
alter table public.marketing_report_exports enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'marketing_webhook_events',
    'marketing_customer_timeline',
    'marketing_preference_profiles',
    'marketing_calendar_items',
    'marketing_campaign_approvals',
    'marketing_cost_entries',
    'marketing_provider_connections',
    'marketing_report_exports'
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

-- Centro de preferências público: acesso por funções com token.
-- A tabela não fica aberta para anon; o token só retorna/atualiza o próprio perfil.
drop function if exists public.get_marketing_preferences(text);
create function public.get_marketing_preferences(preference_token text)
returns table (
  token text,
  email text,
  phone text,
  email_marketing boolean,
  sms_marketing boolean,
  whatsapp_marketing boolean,
  transactional_messages boolean,
  ads_personalization boolean,
  remarketing boolean,
  frequency text,
  interests text[]
)
language sql
security definer
set search_path = public
as $$
  select
    p.token,
    p.email,
    p.phone,
    p.email_marketing,
    p.sms_marketing,
    p.whatsapp_marketing,
    p.transactional_messages,
    p.ads_personalization,
    p.remarketing,
    p.frequency,
    p.interests
  from public.marketing_preference_profiles p
  where p.token = preference_token
  limit 1;
$$;

drop function if exists public.update_marketing_preferences(text, boolean, boolean, boolean, boolean, boolean, boolean, text, text[]);
create function public.update_marketing_preferences(
  preference_token text,
  email_marketing_value boolean,
  sms_marketing_value boolean,
  whatsapp_marketing_value boolean,
  ads_personalization_value boolean,
  remarketing_value boolean,
  transactional_messages_value boolean,
  frequency_value text,
  interests_value text[]
)
returns table (ok boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.marketing_preference_profiles p
  set
    email_marketing = coalesce(email_marketing_value, p.email_marketing),
    sms_marketing = coalesce(sms_marketing_value, p.sms_marketing),
    whatsapp_marketing = coalesce(whatsapp_marketing_value, p.whatsapp_marketing),
    ads_personalization = coalesce(ads_personalization_value, p.ads_personalization),
    remarketing = coalesce(remarketing_value, p.remarketing),
    transactional_messages = coalesce(transactional_messages_value, p.transactional_messages),
    frequency = case
      when frequency_value in ('low','normal','high','paused') then frequency_value
      else p.frequency
    end,
    interests = coalesce(interests_value, p.interests),
    revoked_at = case
      when coalesce(email_marketing_value, p.email_marketing) = false
       and coalesce(sms_marketing_value, p.sms_marketing) = false
       and coalesce(whatsapp_marketing_value, p.whatsapp_marketing) = false
       and coalesce(remarketing_value, p.remarketing) = false
      then now()
      else null
    end,
    updated_at = now()
  where p.token = preference_token;

  return query select found;
end;
$$;

create index if not exists marketing_webhook_events_tenant_type_idx
  on public.marketing_webhook_events(tenant_id, provider, event_type, created_at desc);
create index if not exists marketing_customer_timeline_customer_idx
  on public.marketing_customer_timeline(tenant_id, customer_id, occurred_at desc);
create index if not exists marketing_calendar_items_period_idx
  on public.marketing_calendar_items(tenant_id, starts_at, status);
create index if not exists marketing_campaign_approvals_status_idx
  on public.marketing_campaign_approvals(tenant_id, status, requested_at desc);
create index if not exists marketing_cost_entries_campaign_idx
  on public.marketing_cost_entries(tenant_id, campaign_id, occurred_at desc);

grant select, insert, update, delete on
  public.marketing_webhook_events,
  public.marketing_customer_timeline,
  public.marketing_preference_profiles,
  public.marketing_calendar_items,
  public.marketing_campaign_approvals,
  public.marketing_cost_entries,
  public.marketing_provider_connections,
  public.marketing_report_exports
to authenticated;

revoke all on public.marketing_preference_profiles from anon;
grant execute on function public.get_marketing_preferences(text) to anon, authenticated;
grant execute on function public.update_marketing_preferences(text, boolean, boolean, boolean, boolean, boolean, boolean, text, text[]) to anon, authenticated;

-- Conexões iniciais para tenants ativos. Credenciais ficam em secrets,
-- nunca nesta tabela.
insert into public.marketing_provider_connections
  (tenant_id, provider_key, provider_type, display_name, status, config, scopes)
select
  t.id,
  provider.provider_key,
  provider.provider_type,
  provider.display_name,
  provider.status,
  provider.config,
  provider.scopes
from public.tenants t
cross join (
  values
    ('resend', 'email', 'Resend', 'online', '{"secret_names":["RESEND_API_KEY","RESEND_FROM_EMAIL","RESEND_WEBHOOK_SECRET"]}'::jsonb, array['send','webhooks']),
    ('sms_provider', 'sms', 'SMS oficial', 'pending', '{"requires_provider":true}'::jsonb, array['send','delivery_status']),
    ('whatsapp_business', 'whatsapp', 'WhatsApp Business oficial', 'pending', '{"requires_provider":true}'::jsonb, array['send','templates','inbox']),
    ('meta_ads', 'meta_ads', 'Meta Ads', 'pending', '{"requires_oauth":true}'::jsonb, array['campaigns','conversions','audiences']),
    ('google_ads', 'google_ads', 'Google Ads', 'pending', '{"requires_oauth":true}'::jsonb, array['campaigns','conversions','costs'])
) as provider(provider_key, provider_type, display_name, status, config, scopes)
where t.status = 'active'
on conflict (tenant_id, provider_key, environment) do update set
  display_name = excluded.display_name,
  provider_type = excluded.provider_type,
  config = excluded.config,
  scopes = excluded.scopes,
  updated_at = now();

drop policy if exists marketing_landing_pages_public_read on public.marketing_landing_pages;
create policy marketing_landing_pages_public_read on public.marketing_landing_pages
  for select
  to anon, authenticated
  using (
    status = 'published'
    and (publish_at is null or publish_at <= now())
  );

grant select on public.marketing_landing_pages to anon;

-- Cron automático da fila de marketing.
do $$
begin
  perform cron.unschedule('marketing-dispatcher');
exception when others then
  null;
end $$;

select cron.schedule(
  'marketing-dispatcher',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://mbpvzhcrimdwcqkqvoqr.supabase.co/functions/v1/marketing-dispatcher',
      body := '{}'::jsonb,
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 30000
    ) as request_id;
  $$
);
