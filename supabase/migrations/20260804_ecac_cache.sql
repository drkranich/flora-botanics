-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: ecac_cache
-- Cache local das consultas ao e-CAC via SERPRO Integra Contador.
-- Credenciais (Consumer Key/Secret) ficam em site_settings key "integration_ecac".
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabela de cache de consultas e-CAC
create table if not exists public.ecac_cache (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  tipo            text not null,   -- "situacao-fiscal" | "cnd" | "caixa-postal" | "simples-nacional"
  cnpj            text not null,   -- 14 dígitos, sem máscara
  dados           jsonb not null default '{}',
  consultado_at   timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  -- uma entrada por tenant + tipo + cnpj (upsert)
  unique (tenant_id, tipo, cnpj)
);

-- Índices
create index if not exists ecac_cache_tenant_idx on public.ecac_cache(tenant_id);
create index if not exists ecac_cache_tipo_idx   on public.ecac_cache(tenant_id, tipo);

-- RLS
alter table public.ecac_cache enable row level security;

create policy "tenant staff pode ler cache ecac"
  on public.ecac_cache for select
  using (
    tenant_id in (
      select tenant_id from public.staff_members
      where user_id = auth.uid()
    )
  );

create policy "service role gerencia cache ecac"
  on public.ecac_cache for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- Configuração das credenciais SERPRO em site_settings
-- key: "integration_ecac"
-- value: {
--   consumer_key:    string,   -- Consumer Key do contrato SERPRO
--   consumer_secret: string,   -- Consumer Secret do contrato SERPRO
--   cnpj_contratante: string,  -- CNPJ do contabilista/contratante (se diferente do contribuinte)
--   ativo: boolean             -- habilita/desabilita a integração
-- }
--
-- Não inserimos dados aqui — o usuário preenche pelo frontend quando tiver o contrato.
-- ─────────────────────────────────────────────────────────────────────────────

comment on table public.ecac_cache is
  'Cache local das consultas ao e-CAC via SERPRO Integra Contador. '
  'Credenciais SERPRO ficam em site_settings com key "integration_ecac".';
