-- Pacotes iniciais editáveis para o Centro Internacional de Exportação.
-- Idempotente: pode ser reaplicado sem duplicar registros.

with active_tenants as (
  select id
  from public.tenants
  where status = 'active'
),
packages as (
  select *
  from (
    values
      (
        'BR',
        'Brasil',
        'country',
        'BR',
        null,
        'BRL',
        'pt-BR',
        'NF-e de exportação, CFOP, NCM, DU-E, LPCO e Portal Único Siscomex.',
        'operational',
        'official_imported',
        '["SEFAZ","Portal Único Siscomex","Receita Federal"]'::jsonb,
        '{"brasil":["NF-e de exportação","DU-E","LPCO quando aplicável","DANFE","XML"]}'::jsonb,
        '{"exports":["CFOP iniciado por 7 quando aplicável","unidade estatística compatível com NCM"]}'::jsonb,
        '["Não transmitir sem certificado e integração oficial."]'::jsonb
      ),
      (
        'EU',
        'União Europeia',
        'bloc',
        null,
        'EU',
        'EUR',
        'multi',
        'VAT, IOSS, OSS, EORI, TARIC, import VAT e customs duty.',
        'needs_review',
        'simulation',
        '["Comissão Europeia","TARIC","autoridades fiscais nacionais"]'::jsonb,
        '{"commercial":["Commercial Invoice","Packing List","comprovante IOSS quando aplicável"]}'::jsonb,
        '{"warning":"IOSS é regime específico para vendas à distância dentro do limite aplicável."}'::jsonb,
        '["Não usar alíquota única para todos os países europeus."]'::jsonb
      ),
      (
        'GB',
        'Reino Unido',
        'country',
        'GB',
        null,
        'GBP',
        'en-GB',
        'UK VAT, UK EORI, customs duty, import VAT e HMRC.',
        'needs_review',
        'simulation',
        '["HMRC","UK Global Tariff"]'::jsonb,
        '{"commercial":["Commercial Invoice","Packing List","UK EORI quando aplicável"]}'::jsonb,
        '{"registration":"Pode exigir registro de VAT conforme venda direta, marketplace, valor e localização dos bens."}'::jsonb,
        '["Separar Reino Unido da União Europeia."]'::jsonb
      ),
      (
        'US',
        'Estados Unidos',
        'country',
        'US',
        null,
        'USD',
        'en-US',
        'HTS, customs duty, MPF, HMF quando aplicável, Sales Tax estadual/local e nexus.',
        'needs_review',
        'simulation',
        '["CBP","HTS","autoridades estaduais de Sales Tax"]'::jsonb,
        '{"commercial":["Commercial Invoice","Packing List","documentos do importador"]}'::jsonb,
        '{"sales_tax":"Sales Tax não é imposto federal; avaliar nexus, marketplace facilitator e registros locais."}'::jsonb,
        '["Não ignorar tarifas federais de importação nem mudanças de de minimis."]'::jsonb
      ),
      (
        'CA',
        'Canadá',
        'country',
        'CA',
        null,
        'CAD',
        'en-CA/fr-CA',
        'GST, HST, PST, QST, tarifas e CBSA.',
        'draft',
        'simulation',
        '["CBSA","CRA","províncias"]'::jsonb,
        '{"commercial":["Commercial Invoice","Packing List","documentos CBSA"]}'::jsonb,
        '{"taxes":"Separar GST/HST/PST/QST por província."}'::jsonb,
        '["Pacote estrutural: validar fontes antes de operação."]'::jsonb
      )
  ) as item(
    code,
    name,
    scope,
    country_code,
    bloc,
    currency,
    language,
    tax_system,
    package_status,
    confidence_status,
    official_sources,
    documents,
    obligations,
    alerts
  )
)
insert into public.jurisdictions (
  tenant_id,
  code,
  name,
  scope,
  country_code,
  bloc,
  currency,
  language,
  tax_system,
  package_status,
  confidence_status,
  official_sources,
  documents,
  obligations,
  alerts,
  version,
  last_reviewed_at,
  updated_at
)
select
  active_tenants.id,
  packages.code,
  packages.name,
  packages.scope,
  packages.country_code,
  packages.bloc,
  packages.currency,
  packages.language,
  packages.tax_system,
  packages.package_status,
  packages.confidence_status,
  packages.official_sources,
  packages.documents,
  packages.obligations,
  packages.alerts,
  '1.0',
  now(),
  now()
from active_tenants
cross join packages
on conflict (tenant_id, code) do update set
  name = excluded.name,
  scope = excluded.scope,
  country_code = excluded.country_code,
  bloc = excluded.bloc,
  currency = excluded.currency,
  language = excluded.language,
  tax_system = excluded.tax_system,
  package_status = excluded.package_status,
  confidence_status = excluded.confidence_status,
  official_sources = excluded.official_sources,
  documents = excluded.documents,
  obligations = excluded.obligations,
  alerts = excluded.alerts,
  version = excluded.version,
  last_reviewed_at = excluded.last_reviewed_at,
  updated_at = now();

with active_tenants as (
  select id
  from public.tenants
  where status = 'active'
),
incoterm_packages as (
  select *
  from (
    values
      ('EXW', 'Ex Works', 'Comprador assume coleta, exportação, frete, seguro e importação.'),
      ('FCA', 'Free Carrier', 'Vendedor entrega ao transportador indicado; riscos mudam no ponto acordado.'),
      ('CPT', 'Carriage Paid To', 'Vendedor paga transporte principal; risco transfere antes.'),
      ('CIP', 'Carriage and Insurance Paid To', 'Vendedor paga transporte e seguro.'),
      ('DAP', 'Delivered at Place', 'Vendedor entrega no local; comprador assume importação e tributos.'),
      ('DPU', 'Delivered at Place Unloaded', 'Vendedor entrega descarregado no destino.'),
      ('DDP', 'Delivered Duty Paid', 'Vendedor assume entrega, desembaraço e tributos no destino.'),
      ('FAS', 'Free Alongside Ship', 'Uso marítimo; vendedor entrega ao lado do navio.'),
      ('FOB', 'Free on Board', 'Uso marítimo; risco muda quando mercadoria embarca.'),
      ('CFR', 'Cost and Freight', 'Uso marítimo; vendedor paga frete, comprador assume risco no embarque.'),
      ('CIF', 'Cost, Insurance and Freight', 'Uso marítimo; vendedor paga frete e seguro.')
  ) as item(code, name, review_warning)
)
insert into public.incoterms (
  tenant_id,
  code,
  name,
  seller_responsibilities,
  buyer_responsibilities,
  required_documents,
  review_warning,
  status
)
select
  active_tenants.id,
  incoterm_packages.code,
  incoterm_packages.name,
  '["Validar responsabilidades no contrato antes da venda."]'::jsonb,
  '["Confirmar importador, documentos e tributos no destino."]'::jsonb,
  '["Commercial Invoice","Packing List","documentos de transporte"]'::jsonb,
  incoterm_packages.review_warning,
  'active'
from active_tenants
cross join incoterm_packages
on conflict (tenant_id, code) do update set
  name = excluded.name,
  seller_responsibilities = excluded.seller_responsibilities,
  buyer_responsibilities = excluded.buyer_responsibilities,
  required_documents = excluded.required_documents,
  review_warning = excluded.review_warning,
  status = excluded.status,
  updated_at = now();
