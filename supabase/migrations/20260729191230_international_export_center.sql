-- Centro Internacional de Exportação, Tributação e Landed Cost
-- Fundação multi-tenant para /admin/backoffice/notas-fiscais#comercio-exterior.

create table if not exists public.jurisdictions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  scope text not null default 'country',
  parent_code text,
  bloc text,
  country_code text,
  subdivision_code text,
  currency text not null default 'BRL',
  language text not null default 'pt-BR',
  tax_system text,
  package_status text not null default 'draft',
  confidence_status text not null default 'simulation',
  official_sources jsonb not null default '[]'::jsonb,
  obligations jsonb not null default '{}'::jsonb,
  documents jsonb not null default '{}'::jsonb,
  alerts jsonb not null default '[]'::jsonb,
  effective_from date,
  effective_until date,
  version text not null default '1.0',
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  validated_by uuid references auth.users(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.jurisdiction_regions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  jurisdiction_id uuid not null references public.jurisdictions(id) on delete cascade,
  code text not null,
  name text not null,
  region_type text not null default 'state',
  parent_code text,
  tax_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, jurisdiction_id, code)
);

create table if not exists public.jurisdiction_rule_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  jurisdiction_id uuid not null references public.jurisdictions(id) on delete cascade,
  name text not null,
  sale_channel text,
  customer_type text,
  operation_type text,
  incoterm text,
  responsibility text,
  status text not null default 'draft',
  confidence_status text not null default 'simulation',
  official_source text,
  source_url text,
  effective_from date,
  effective_until date,
  version text not null default '1.0',
  rules jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.international_tax_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  jurisdiction_id uuid references public.jurisdictions(id) on delete cascade,
  name text not null,
  tax_kind text not null,
  base_kind text not null default 'customs_value',
  calculation_method text not null default 'percent',
  status text not null default 'draft',
  official_source text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.international_tax_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  jurisdiction_id uuid not null references public.jurisdictions(id) on delete cascade,
  rule_set_id uuid references public.jurisdiction_rule_sets(id) on delete set null,
  tax_type_id uuid references public.international_tax_types(id) on delete set null,
  tax_name text not null,
  tax_kind text not null default 'vat',
  product_scope text,
  ncm text,
  hs_code text,
  local_tariff_code text,
  customer_type text,
  sale_channel text,
  operation_type text,
  incoterm text,
  responsibility text not null default 'buyer',
  base_kind text not null default 'customs_value',
  rate_percent numeric(9,4) not null default 0,
  fixed_amount_cents integer not null default 0,
  threshold_cents integer not null default 0,
  currency text not null default 'BRL',
  rounding_rule text not null default 'standard',
  rule_status text not null default 'simulation',
  official_source text,
  source_url text,
  effective_from date,
  effective_until date,
  version text not null default '1.0',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customs_tariff_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  jurisdiction_id uuid not null references public.jurisdictions(id) on delete cascade,
  tariff_system text not null,
  code text not null,
  description text,
  duty_percent numeric(9,4) not null default 0,
  fixed_amount_cents integer not null default 0,
  currency text not null default 'BRL',
  source text,
  source_url text,
  status text not null default 'simulation',
  effective_from date,
  effective_until date,
  version text not null default '1.0',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customs_classifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  jurisdiction_id uuid references public.jurisdictions(id) on delete set null,
  classification_system text not null,
  code text not null,
  description text not null,
  source text,
  status text not null default 'suggested',
  confidence_status text not null default 'needs_review',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  justification text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_customs_classifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  jurisdiction_id uuid references public.jurisdictions(id) on delete set null,
  classification_id uuid references public.customs_classifications(id) on delete set null,
  ncm text,
  hs_code text,
  local_code text,
  status text not null default 'pending_review',
  effective_from date,
  effective_until date,
  source text,
  justification text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incoterms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  seller_responsibilities jsonb not null default '[]'::jsonb,
  buyer_responsibilities jsonb not null default '[]'::jsonb,
  risk_transfer_point text,
  freight_responsibility text,
  insurance_responsibility text,
  customs_responsibility text,
  tax_responsibility text,
  required_documents jsonb not null default '[]'::jsonb,
  review_warning text,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.export_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  operation_number text not null,
  title text not null,
  status text not null default 'draft',
  sale_type text not null default 'b2c',
  sale_channel text not null default 'ecommerce_flora',
  origin_country text not null default 'BR',
  origin_state text,
  destination_jurisdiction_id uuid references public.jurisdictions(id) on delete set null,
  destination_country text not null,
  destination_region text,
  destination_city text,
  destination_postal_code text,
  entry_point text,
  port text,
  airport text,
  customs_office text,
  exporter_name text,
  buyer_name text,
  consignee_name text,
  importer_of_record text,
  broker_name text,
  carrier_name text,
  marketplace_name text,
  fiscal_representative text,
  incoterm text not null default 'DAP',
  tax_responsibility text not null default 'buyer',
  currency text not null default 'USD',
  destination_currency text not null default 'USD',
  exchange_rate numeric(18,8) not null default 1,
  exchange_source text,
  exchange_date date,
  payment_terms text,
  notes text,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, operation_number)
);

create table if not exists public.export_operation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.export_operations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  item_type text not null default 'product',
  description text not null,
  sku text,
  ncm text,
  hs_code text,
  local_tariff_code text,
  origin_country text,
  quantity numeric(14,4) not null default 1,
  unit text not null default 'un',
  net_weight_kg numeric(14,4) not null default 0,
  gross_weight_kg numeric(14,4) not null default 0,
  volume_m3 numeric(14,6) not null default 0,
  unit_price_cents integer not null default 0,
  discount_cents integer not null default 0,
  customs_value_cents integer not null default 0,
  material text,
  purpose text,
  brand text,
  batch text,
  expires_at date,
  manufactured_in text,
  compliance_status text not null default 'not_reviewed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landed_cost_calculations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.export_operations(id) on delete cascade,
  scenario_name text not null default 'Cenário principal',
  status text not null default 'draft',
  calculation_version text not null default '1.0',
  product_value_cents integer not null default 0,
  brazilian_cost_cents integer not null default 0,
  export_cost_cents integer not null default 0,
  fob_cents integer not null default 0,
  cif_cents integer not null default 0,
  customs_value_cents integer not null default 0,
  import_duty_cents integer not null default 0,
  destination_tax_cents integer not null default 0,
  sales_tax_cents integer not null default 0,
  logistics_cents integer not null default 0,
  commission_cents integer not null default 0,
  payment_fee_cents integer not null default 0,
  compliance_cents integer not null default 0,
  contingency_cents integer not null default 0,
  total_landed_cost_cents integer not null default 0,
  revenue_gross_cents integer not null default 0,
  revenue_net_cents integer not null default 0,
  profit_gross_cents integer not null default 0,
  profit_net_cents integer not null default 0,
  margin_gross_percent numeric(9,4) not null default 0,
  margin_net_percent numeric(9,4) not null default 0,
  markup_percent numeric(9,4) not null default 0,
  break_even_cents integer not null default 0,
  minimum_price_cents integer not null default 0,
  recommended_price_cents integer not null default 0,
  customer_price_cents integer not null default 0,
  taxes_paid_by_flora_cents integer not null default 0,
  taxes_paid_by_buyer_cents integer not null default 0,
  currency text not null default 'USD',
  destination_currency text not null default 'USD',
  exchange_rate numeric(18,8) not null default 1,
  memory jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landed_cost_components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  calculation_id uuid not null references public.landed_cost_calculations(id) on delete cascade,
  group_key text not null,
  name text not null,
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  payer text not null default 'flora',
  source text,
  confidence_status text not null default 'simulation',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.international_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.export_operations(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  document_scope text not null default 'commercial',
  document_type text not null,
  title text not null,
  document_number text,
  jurisdiction_id uuid references public.jurisdictions(id) on delete set null,
  country_code text,
  status text not null default 'draft',
  requirement_status text not null default 'pending_confirmation',
  language text not null default 'pt-BR',
  version integer not null default 1,
  storage_path text,
  expires_at date,
  issued_at date,
  signed_at timestamptz,
  hash text,
  permissions jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.export_operations(id) on delete cascade,
  invoice_number text not null,
  invoice_date date,
  exporter jsonb not null default '{}'::jsonb,
  consignee jsonb not null default '{}'::jsonb,
  buyer jsonb not null default '{}'::jsonb,
  importer_of_record jsonb not null default '{}'::jsonb,
  currency text not null default 'USD',
  payment_terms text,
  incoterm text,
  transport text,
  origin_country text,
  destination_country text,
  freight_cents integer not null default 0,
  insurance_cents integer not null default 0,
  discount_cents integer not null default 0,
  other_charges_cents integer not null default 0,
  declared_value_cents integer not null default 0,
  net_weight_kg numeric(14,4) not null default 0,
  gross_weight_kg numeric(14,4) not null default 0,
  packages_count integer not null default 0,
  purpose text,
  declaration text,
  signature_name text,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, invoice_number)
);

create table if not exists public.proforma_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.export_operations(id) on delete set null,
  quote_number text not null,
  customer_name text,
  company_name text,
  currency text not null default 'USD',
  valid_until date,
  status text not null default 'draft',
  terms text,
  conversion_targets jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, quote_number)
);

create table if not exists public.packing_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.export_operations(id) on delete cascade,
  packing_number text not null,
  status text not null default 'draft',
  packages jsonb not null default '[]'::jsonb,
  total_net_weight_kg numeric(14,4) not null default 0,
  total_gross_weight_kg numeric(14,4) not null default 0,
  total_volume_m3 numeric(14,6) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, packing_number)
);

create table if not exists public.export_registrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.export_operations(id) on delete set null,
  registration_type text not null,
  authority text,
  country_code text,
  registration_number text,
  status text not null default 'draft',
  effective_from date,
  effective_until date,
  documents jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fiscal_registrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  jurisdiction_id uuid references public.jurisdictions(id) on delete set null,
  registration_kind text not null,
  registration_number text,
  authority text,
  responsible_party text,
  status text not null default 'not_started',
  effective_from date,
  effective_until date,
  renewal_due_at date,
  credentials_ref text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  base_currency text not null,
  quote_currency text not null,
  rate numeric(18,8) not null,
  commercial_rate numeric(18,8),
  spread_percent numeric(9,4) not null default 0,
  fee_cents integer not null default 0,
  source text,
  rate_date date not null default current_date,
  scenario text not null default 'current',
  locked_until date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, base_currency, quote_currency, rate_date, scenario)
);

create table if not exists public.international_shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.export_operations(id) on delete cascade,
  provider_key text not null,
  service_name text not null,
  transport_mode text not null default 'courier',
  origin_country text,
  destination_country text,
  real_weight_kg numeric(14,4) not null default 0,
  volumetric_weight_kg numeric(14,4) not null default 0,
  packages_count integer not null default 1,
  freight_cents integer not null default 0,
  insurance_cents integer not null default 0,
  fuel_surcharge_cents integer not null default 0,
  handling_cents integer not null default 0,
  taxes_prepaid_cents integer not null default 0,
  delivery_cents integer not null default 0,
  currency text not null default 'USD',
  estimated_days integer,
  incoterm text,
  tracking_code text,
  tracking_url text,
  status text not null default 'quoted',
  risk_score integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.export_compliance_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.export_operations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  jurisdiction_id uuid references public.jurisdictions(id) on delete set null,
  check_type text not null,
  status text not null default 'not_reviewed',
  severity text not null default 'warning',
  title text not null,
  details text,
  required_documents jsonb not null default '[]'::jsonb,
  due_date date,
  resolved_at timestamptz,
  responsible_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jurisdiction_rule_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  jurisdiction_id uuid references public.jurisdictions(id) on delete cascade,
  rule_table text not null,
  rule_id uuid,
  previous_version text,
  next_version text not null,
  changed_fields jsonb not null default '{}'::jsonb,
  impact_summary text,
  affected_products jsonb not null default '[]'::jsonb,
  affected_operations jsonb not null default '[]'::jsonb,
  approval_status text not null default 'pending',
  source text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.international_custom_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  field_key text not null,
  label text not null,
  field_type text not null,
  options jsonb not null default '[]'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, entity_type, field_key)
);

create table if not exists public.export_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  operation_id uuid references public.export_operations(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  next_value jsonb not null default '{}'::jsonb,
  source text,
  result text not null default 'success',
  created_at timestamptz not null default now()
);

create table if not exists public.export_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.export_operations(id) on delete cascade,
  severity text not null default 'warning',
  title text not null,
  description text,
  status text not null default 'open',
  entity_type text,
  entity_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jurisdictions_tenant_status_idx on public.jurisdictions(tenant_id, package_status, code);
create index if not exists jurisdiction_rule_sets_tenant_idx on public.jurisdiction_rule_sets(tenant_id, jurisdiction_id, status);
create index if not exists international_tax_rules_tenant_idx on public.international_tax_rules(tenant_id, jurisdiction_id, rule_status, effective_from desc);
create index if not exists customs_classifications_tenant_idx on public.customs_classifications(tenant_id, classification_system, code);
create index if not exists product_customs_classifications_tenant_idx on public.product_customs_classifications(tenant_id, product_id, status);
create index if not exists export_operations_tenant_idx on public.export_operations(tenant_id, status, created_at desc);
create index if not exists export_operation_items_operation_idx on public.export_operation_items(tenant_id, operation_id);
create index if not exists landed_cost_calculations_tenant_idx on public.landed_cost_calculations(tenant_id, operation_id, created_at desc);
create index if not exists international_documents_tenant_idx on public.international_documents(tenant_id, document_type, status, created_at desc);
create index if not exists international_shipping_quotes_tenant_idx on public.international_shipping_quotes(tenant_id, operation_id, status);
create index if not exists export_compliance_checks_tenant_idx on public.export_compliance_checks(tenant_id, status, severity);
create index if not exists export_audit_logs_tenant_idx on public.export_audit_logs(tenant_id, created_at desc);
create index if not exists export_alerts_tenant_idx on public.export_alerts(tenant_id, status, severity, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array[
    'jurisdictions',
    'jurisdiction_regions',
    'jurisdiction_rule_sets',
    'international_tax_types',
    'international_tax_rules',
    'customs_tariff_rules',
    'customs_classifications',
    'product_customs_classifications',
    'incoterms',
    'export_operations',
    'export_operation_items',
    'landed_cost_calculations',
    'landed_cost_components',
    'international_documents',
    'commercial_invoices',
    'proforma_invoices',
    'packing_lists',
    'export_registrations',
    'fiscal_registrations',
    'exchange_rates',
    'international_shipping_quotes',
    'export_compliance_checks',
    'jurisdiction_rule_versions',
    'international_custom_fields',
    'export_audit_logs',
    'export_alerts'
  ] loop
    execute format('drop trigger if exists trg_%I_updated on public.%I', t, t);
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'updated_at'
    ) then
      execute format('create trigger trg_%I_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_tenant_staff(tenant_id))',
      t || '_staff_read',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id))',
      t || '_admin_all',
      t
    );
  end loop;
end $$;
