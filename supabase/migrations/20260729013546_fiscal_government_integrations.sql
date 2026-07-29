-- ============================================================
-- FLORA ECOSYSTEM · Integrações fiscais governamentais
-- Receita/e-CAC, DCTFWeb, PGDAS, SEFAZ, GNRE, ISS e FGTS Digital
-- ============================================================

insert into public.integration_providers (
  key,
  category,
  display_name,
  description,
  capabilities,
  supports_test,
  supports_production,
  docs_url
)
values
  (
    'receita_ecac',
    'fiscal',
    'Receita Federal / e-CAC',
    'Conector fiscal federal para caixa postal, procuração, certidões, DARF e débitos federais quando houver canal autorizado.',
    '["procuracao_rfb","certificado_digital","caixa_postal","debitos_federais","darf","dctfweb","mit","efd_reinf","esocial"]'::jsonb,
    true,
    true,
    'https://www.gov.br/receitafederal/pt-br/canais_atendimento/atendimento-virtual'
  ),
  (
    'dctfweb',
    'fiscal',
    'DCTFWeb / MIT',
    'Sincronização de declaração, débitos consolidados, DARF numerado e status de transmissão a partir das escriturações oficiais.',
    '["dctfweb","mit","darf","debitos","pagamentos","retificacoes"]'::jsonb,
    true,
    true,
    'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/dctfweb'
  ),
  (
    'pgdas_simples',
    'fiscal',
    'PGDAS-D / Simples Nacional',
    'Consulta de apuração mensal, DAS, vencimentos, situação de pagamento e histórico do Simples Nacional.',
    '["pgdas","das","simples_nacional","apuracao","pagamentos"]'::jsonb,
    false,
    true,
    'https://www8.receita.fazenda.gov.br/SimplesNacional/'
  ),
  (
    'sefaz_sp_icms',
    'fiscal',
    'SEFAZ SP / ICMS',
    'Conector estadual para ICMS, ICMS-ST, DIFAL, FCP, GIA/EFD ICMS/IPI e guias estaduais quando habilitado.',
    '["icms","icms_st","difal","fcp","gia","efd_icms_ipi","gnre","guias_estaduais"]'::jsonb,
    true,
    true,
    'https://portal.fazenda.sp.gov.br/'
  ),
  (
    'gnre',
    'fiscal',
    'GNRE',
    'Guias nacionais de recolhimento de tributos estaduais para operações interestaduais.',
    '["gnre","icms_st","difal","fcp","barcode","linha_digitavel"]'::jsonb,
    true,
    true,
    'https://www.gnre.pe.gov.br/'
  ),
  (
    'prefeitura_iss',
    'fiscal',
    'Prefeitura / ISS e NFS-e',
    'Integração municipal para ISS, NFS-e, guias e obrigações municipais conforme provedor da cidade.',
    '["iss","nfse","guias_municipais","obrigacoes_municipais"]'::jsonb,
    true,
    true,
    null
  ),
  (
    'fgts_digital',
    'fiscal',
    'FGTS Digital',
    'Consulta de guia FGTS Digital, vencimentos e comprovantes quando houver credencial/procuração habilitada.',
    '["fgts","folha","guia","pagamentos"]'::jsonb,
    false,
    true,
    'https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital'
  )
on conflict (key) do update set
  category = excluded.category,
  display_name = excluded.display_name,
  description = excluded.description,
  capabilities = excluded.capabilities,
  supports_test = excluded.supports_test,
  supports_production = excluded.supports_production,
  docs_url = excluded.docs_url,
  is_active = true,
  updated_at = now();

alter table public.fiscal_guides
  add column if not exists provider_key text references public.integration_providers(key) on delete set null,
  add column if not exists external_id text,
  add column if not exists source_system text,
  add column if not exists synced_at timestamptz;

create index if not exists fiscal_guides_provider_idx
  on public.fiscal_guides(tenant_id, provider_key, synced_at desc);

create unique index if not exists fiscal_guides_external_unique_idx
  on public.fiscal_guides(tenant_id, provider_key, external_id)
  where provider_key is not null and external_id is not null;

insert into public.integration_connections (
  tenant_id,
  provider_key,
  display_name,
  environment,
  status,
  credentials_status,
  settings,
  sync_interval_minutes
)
select
  tenants.id,
  providers.key,
  providers.display_name,
  'production',
  'offline',
  'missing',
  jsonb_build_object(
    'scope', 'fiscal_government',
    'requires_certificate', providers.key in ('receita_ecac','dctfweb','sefaz_sp_icms','gnre','prefeitura_iss','fgts_digital'),
    'requires_procurement', providers.key in ('receita_ecac','dctfweb','pgdas_simples','fgts_digital'),
    'auto_create_guides', true
  ),
  360
from public.tenants
cross join public.integration_providers providers
where providers.key in (
  'receita_ecac',
  'dctfweb',
  'pgdas_simples',
  'sefaz_sp_icms',
  'gnre',
  'prefeitura_iss',
  'fgts_digital'
)
on conflict (tenant_id, provider_key, environment) do nothing;
