-- ============================================================
-- FLORA ECOSYSTEM · Migration 16: Fundação CRM/ERP próprio
-- Painel admin/CRM, logs de erro, NF-e (sistema próprio),
-- listagens de marketplace e automações de mensagens.
-- Ver BLUEPRINT-FLORA-ECOSYSTEM.md Seção 14.
-- ============================================================

-- ---------- CRM: dados de cliente para relacionamento ----------
alter table public.customers
  add column birthday date,
  add column whatsapp text,
  add column notes text;

-- ---------- logs de erro / eventos do sistema ----------
create table public.system_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  level text not null default 'error' check (level in ('info','warning','error','critical')),
  source text not null,
  message text not null,
  context jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_system_logs_tenant on public.system_logs(tenant_id, created_at desc);
create index idx_system_logs_unresolved on public.system_logs(tenant_id, resolved) where resolved = false;

alter table public.system_logs enable row level security;
create policy system_logs_staff_read on public.system_logs for select
  using (public.is_tenant_admin(tenant_id));
create policy system_logs_staff_update on public.system_logs for update
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
-- insert: apenas service role (edge functions/rpc registram erros)

-- ---------- NF-e: configuração fiscal do tenant ----------
create table public.fiscal_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  cnpj text not null,
  razao_social text not null,
  nome_fantasia text,
  inscricao_estadual text,
  inscricao_municipal text,
  regime_tributario text not null default 'simples'
    check (regime_tributario in ('simples','presumido','real')),
  endereco jsonb not null default '{}'::jsonb,
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao','producao')),
  serie_nfe int not null default 1,
  proximo_numero_nfe bigint not null default 1,
  certificado_nome text,
  certificado_valido_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_fiscal_configs_updated before update on public.fiscal_configs
  for each row execute function public.set_updated_at();

alter table public.fiscal_configs enable row level security;
create policy fiscal_configs_staff_all on public.fiscal_configs for all
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- ---------- NF-e: documentos emitidos ----------
create table public.nfe_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  numero bigint,
  serie int,
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao','producao')),
  status text not null default 'rascunho'
    check (status in ('rascunho','enviando','autorizada','rejeitada','cancelada','inutilizada')),
  chave_acesso text,
  protocolo text,
  motivo_status text,
  valor_total_cents bigint,
  xml_url text,
  danfe_url text,
  emitida_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_nfe_documents_tenant on public.nfe_documents(tenant_id, created_at desc);
create index idx_nfe_documents_order on public.nfe_documents(order_id);
create trigger trg_nfe_documents_updated before update on public.nfe_documents
  for each row execute function public.set_updated_at();

alter table public.nfe_documents enable row level security;
create policy nfe_documents_staff_all on public.nfe_documents for all
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- ---------- marketplaces: vínculo variante <-> anúncio externo ----------
create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel_account_id uuid not null references public.channel_accounts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  external_id text,
  external_url text,
  price_cents bigint,
  status text not null default 'paused' check (status in ('active','paused','error')),
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','error')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_account_id, variant_id)
);
create index idx_marketplace_listings_tenant on public.marketplace_listings(tenant_id);
create index idx_marketplace_listings_variant on public.marketplace_listings(variant_id);
create trigger trg_marketplace_listings_updated before update on public.marketplace_listings
  for each row execute function public.set_updated_at();

alter table public.marketplace_listings enable row level security;
create policy marketplace_listings_staff_all on public.marketplace_listings for all
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- ---------- automações de mensagens: templates ----------
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('email','whatsapp','instagram','sms')),
  subject text,
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create trigger trg_message_templates_updated before update on public.message_templates
  for each row execute function public.set_updated_at();

alter table public.message_templates enable row level security;
create policy message_templates_staff_all on public.message_templates for all
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- ---------- automações: regras (gatilho -> condições -> ações) ----------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  trigger text not null
    check (trigger in ('birthday','abandoned_cart','order_paid','order_cancelled','low_stock','manual')),
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_automations_tenant on public.automations(tenant_id, status);
create trigger trg_automations_updated before update on public.automations
  for each row execute function public.set_updated_at();

alter table public.automations enable row level security;
create policy automations_staff_all on public.automations for all
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- ---------- automações: log de disparos ----------
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null check (channel in ('email','whatsapp','instagram','sms')),
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_automation_runs_tenant on public.automation_runs(tenant_id, created_at desc);
create index idx_automation_runs_automation on public.automation_runs(automation_id, created_at desc);
create index idx_automation_runs_customer on public.automation_runs(customer_id);

alter table public.automation_runs enable row level security;
create policy automation_runs_staff_read on public.automation_runs for select
  using (public.is_tenant_admin(tenant_id));
-- insert/update: apenas service role (jobs/edge functions registram disparos)
