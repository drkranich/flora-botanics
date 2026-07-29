-- ============================================================
-- FLORA BOTANICS · Centro Fiscal, Tributário e Documental
-- Fundação para NF-e/NFC-e/NFS-e, eventos fiscais, apurações,
-- guias, obrigações, cofre documental e colaboração contábil.
-- ============================================================

-- ---------- documentos fiscais genéricos ----------
create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nfe_document_id uuid references public.nfe_documents(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  document_type text not null default 'nfe_sale',
  direction text not null default 'out' check (direction in ('in','out','internal')),
  number text,
  series text,
  access_key text,
  protocol text,
  status text not null default 'draft',
  environment text not null default 'homologacao' check (environment in ('homologacao','producao')),
  party_name text,
  party_document text,
  competence text,
  issued_at timestamptz,
  due_date date,
  total_cents bigint not null default 0,
  tax_total_cents bigint not null default 0,
  payment_status text not null default 'open',
  verification_status text not null default 'pending',
  origin text not null default 'manual',
  source_channel text,
  xml_path text,
  danfe_path text,
  attachments jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  responsible_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fiscal_documents_tenant_status_idx
  on public.fiscal_documents(tenant_id, status, created_at desc);
create index if not exists fiscal_documents_search_idx
  on public.fiscal_documents(tenant_id, document_type, competence, due_date);
create unique index if not exists fiscal_documents_unique_access_key_idx
  on public.fiscal_documents(tenant_id, access_key)
  where access_key is not null;
drop trigger if exists trg_fiscal_documents_updated on public.fiscal_documents;
create trigger trg_fiscal_documents_updated before update on public.fiscal_documents
  for each row execute function public.set_updated_at();

-- ---------- regras fiscais versionadas ----------
create table if not exists public.fiscal_product_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  scope text not null default 'product',
  ncm text,
  cest text,
  origin_code text,
  commercial_unit text,
  taxable_unit text,
  gtin text,
  cfop_in text,
  cfop_out text,
  cfop_interstate text,
  cst text,
  csosn text,
  ipi_code text,
  icms_percent numeric(9,4) not null default 0,
  ipi_percent numeric(9,4) not null default 0,
  pis_percent numeric(9,4) not null default 0,
  cofins_percent numeric(9,4) not null default 0,
  fcp_percent numeric(9,4) not null default 0,
  base_reduction_percent numeric(9,4) not null default 0,
  fiscal_benefit text,
  has_st boolean not null default false,
  has_monophase boolean not null default false,
  state_scope text,
  tax_regime text,
  effective_from date,
  effective_until date,
  notes text,
  version integer not null default 1,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fiscal_product_rules_tenant_idx
  on public.fiscal_product_rules(tenant_id, status, ncm, effective_from desc);
drop trigger if exists trg_fiscal_product_rules_updated on public.fiscal_product_rules;
create trigger trg_fiscal_product_rules_updated before update on public.fiscal_product_rules
  for each row execute function public.set_updated_at();

-- ---------- memória de cálculo fiscal ----------
create table if not exists public.fiscal_calculations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid references public.fiscal_documents(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  calculation_type text not null default 'document',
  status text not null default 'simulated',
  input jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  explanation jsonb not null default '[]'::jsonb,
  source text not null default 'internal_engine',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists fiscal_calculations_tenant_idx
  on public.fiscal_calculations(tenant_id, created_at desc);

-- ---------- eventos fiscais: CC-e, cancelamento, inutilização, retificação ----------
create table if not exists public.fiscal_document_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid references public.fiscal_documents(id) on delete cascade,
  nfe_document_id uuid references public.nfe_documents(id) on delete set null,
  event_type text not null,
  status text not null default 'draft',
  justification text not null,
  payload jsonb not null default '{}'::jsonb,
  protocol text,
  response_payload jsonb,
  occurred_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fiscal_document_events_tenant_idx
  on public.fiscal_document_events(tenant_id, event_type, status, created_at desc);
drop trigger if exists trg_fiscal_document_events_updated on public.fiscal_document_events;
create trigger trg_fiscal_document_events_updated before update on public.fiscal_document_events
  for each row execute function public.set_updated_at();

-- ---------- rejeições e divergências ----------
create table if not exists public.fiscal_rejections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid references public.fiscal_documents(id) on delete cascade,
  code text,
  message text not null,
  step text,
  field_path text,
  probable_cause text,
  recommendation text,
  attempts integer not null default 0,
  responsible_id uuid references auth.users(id) on delete set null,
  status text not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fiscal_rejections_tenant_idx
  on public.fiscal_rejections(tenant_id, status, created_at desc);
drop trigger if exists trg_fiscal_rejections_updated on public.fiscal_rejections;
create trigger trg_fiscal_rejections_updated before update on public.fiscal_rejections
  for each row execute function public.set_updated_at();

-- ---------- certificados: só metadados e referência segura ----------
create table if not exists public.fiscal_certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  holder_name text not null,
  holder_document text,
  certificate_type text not null default 'A1',
  issuer text,
  serial_number text,
  valid_until date,
  environment text not null default 'homologacao' check (environment in ('homologacao','producao')),
  status text not null default 'pending',
  last_used_at timestamptz,
  responsible_id uuid references auth.users(id) on delete set null,
  company_label text,
  secure_secret_ref text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fiscal_certificates_tenant_idx
  on public.fiscal_certificates(tenant_id, status, valid_until);
drop trigger if exists trg_fiscal_certificates_updated on public.fiscal_certificates;
create trigger trg_fiscal_certificates_updated before update on public.fiscal_certificates
  for each row execute function public.set_updated_at();

-- ---------- apurações e obrigações ----------
create table if not exists public.fiscal_tax_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  assessment_type text not null,
  competence text not null,
  establishment text,
  status text not null default 'not_started',
  source_summary jsonb not null default '{}'::jsonb,
  debit_cents bigint not null default 0,
  credit_cents bigint not null default 0,
  compensation_cents bigint not null default 0,
  balance_cents bigint not null default 0,
  receipt_path text,
  declaration_path text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fiscal_tax_assessments_tenant_idx
  on public.fiscal_tax_assessments(tenant_id, assessment_type, competence desc);
drop trigger if exists trg_fiscal_tax_assessments_updated on public.fiscal_tax_assessments;
create trigger trg_fiscal_tax_assessments_updated before update on public.fiscal_tax_assessments
  for each row execute function public.set_updated_at();

create table if not exists public.fiscal_obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  obligation_type text not null,
  competence text,
  period_start date,
  period_end date,
  due_date date,
  company_label text,
  establishment text,
  responsible_id uuid references auth.users(id) on delete set null,
  recurrence text,
  dependencies jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  priority text not null default 'normal',
  applicability jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fiscal_obligations_tenant_idx
  on public.fiscal_obligations(tenant_id, status, due_date);
drop trigger if exists trg_fiscal_obligations_updated on public.fiscal_obligations;
create trigger trg_fiscal_obligations_updated before update on public.fiscal_obligations
  for each row execute function public.set_updated_at();

-- ---------- guias, pagamentos e conciliação ----------
create table if not exists public.fiscal_guides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obligation_id uuid references public.fiscal_obligations(id) on delete set null,
  assessment_id uuid references public.fiscal_tax_assessments(id) on delete set null,
  guide_type text not null,
  document_name text not null,
  competence text,
  due_date date,
  original_cents bigint not null default 0,
  interest_cents bigint not null default 0,
  penalty_cents bigint not null default 0,
  updated_cents bigint not null default 0,
  paid_cents bigint not null default 0,
  payment_status text not null default 'open',
  verification_status text not null default 'pending',
  payment_date date,
  bank_account text,
  payment_method text,
  barcode text,
  digitable_line text,
  qr_code text,
  official_identifier text,
  receipt_path text,
  guide_path text,
  memory jsonb not null default '{}'::jsonb,
  notes text,
  responsible_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fiscal_guides_tenant_idx
  on public.fiscal_guides(tenant_id, payment_status, due_date);
drop trigger if exists trg_fiscal_guides_updated on public.fiscal_guides;
create trigger trg_fiscal_guides_updated before update on public.fiscal_guides
  for each row execute function public.set_updated_at();

-- ---------- cofre fiscal/documental ----------
create table if not exists public.fiscal_vault_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  fiscal_document_id uuid references public.fiscal_documents(id) on delete set null,
  guide_id uuid references public.fiscal_guides(id) on delete set null,
  obligation_id uuid references public.fiscal_obligations(id) on delete set null,
  name text not null,
  document_type text not null,
  category text,
  department text,
  competence text,
  issued_at date,
  due_date date,
  paid_at date,
  value_cents bigint not null default 0,
  cnpj text,
  cpf text,
  access_key text,
  number text,
  series text,
  origin text not null default 'manual',
  status text not null default 'received',
  visibility_status text not null default 'unread',
  verification_status text not null default 'pending',
  storage_path text,
  hash text,
  version integer not null default 1,
  retention_until date,
  tags jsonb not null default '[]'::jsonb,
  relationships jsonb not null default '[]'::jsonb,
  extracted_fields jsonb not null default '{}'::jsonb,
  classification_confidence numeric(5,2),
  notes text,
  responsible_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fiscal_vault_documents_tenant_idx
  on public.fiscal_vault_documents(tenant_id, status, competence, due_date);
create index if not exists fiscal_vault_documents_hash_idx
  on public.fiscal_vault_documents(tenant_id, hash)
  where hash is not null;
drop trigger if exists trg_fiscal_vault_documents_updated on public.fiscal_vault_documents;
create trigger trg_fiscal_vault_documents_updated before update on public.fiscal_vault_documents
  for each row execute function public.set_updated_at();

-- ---------- contador, solicitações, mensagens, aprovações ----------
create table if not exists public.accountant_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  office_name text,
  legal_name text,
  cnpj text,
  main_contact text,
  fiscal_contact text,
  accounting_contact text,
  payroll_contact text,
  financial_contact text,
  phone text,
  email text,
  business_hours text,
  address text,
  services jsonb not null default '[]'::jsonb,
  sla_rules jsonb not null default '{}'::jsonb,
  access_settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_accountant_profiles_updated on public.accountant_profiles;
create trigger trg_accountant_profiles_updated before update on public.accountant_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.accountant_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  request_type text not null default 'document',
  competence text,
  due_date date,
  priority text not null default 'normal',
  status text not null default 'open',
  department text,
  responsible_id uuid references auth.users(id) on delete set null,
  fiscal_document_id uuid references public.fiscal_documents(id) on delete set null,
  vault_document_id uuid references public.fiscal_vault_documents(id) on delete set null,
  attachments jsonb not null default '[]'::jsonb,
  response text,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists accountant_requests_tenant_idx
  on public.accountant_requests(tenant_id, status, due_date);
drop trigger if exists trg_accountant_requests_updated on public.accountant_requests;
create trigger trg_accountant_requests_updated before update on public.accountant_requests
  for each row execute function public.set_updated_at();

create table if not exists public.accountant_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid references public.accountant_requests(id) on delete cascade,
  fiscal_document_id uuid references public.fiscal_documents(id) on delete set null,
  guide_id uuid references public.fiscal_guides(id) on delete set null,
  message_type text not null default 'question',
  body text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  attachments jsonb not null default '[]'::jsonb,
  read_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists accountant_messages_tenant_idx
  on public.accountant_messages(tenant_id, status, created_at desc);

create table if not exists public.fiscal_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  reason text not null,
  approval_type text not null default 'simple',
  status text not null default 'pending',
  requested_by uuid references auth.users(id) on delete set null,
  approver_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  decision_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fiscal_approvals_tenant_idx
  on public.fiscal_approvals(tenant_id, status, created_at desc);
drop trigger if exists trg_fiscal_approvals_updated on public.fiscal_approvals;
create trigger trg_fiscal_approvals_updated before update on public.fiscal_approvals
  for each row execute function public.set_updated_at();

-- ---------- filas, alertas, auditoria e fechamento ----------
create table if not exists public.fiscal_queue_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_type text not null,
  entity_type text,
  entity_id uuid,
  status text not null default 'queued',
  priority integer not null default 50 check (priority between 0 and 100),
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);
create index if not exists fiscal_queue_jobs_queue_idx
  on public.fiscal_queue_jobs(status, priority desc, next_attempt_at, created_at)
  where status in ('queued','failed');
drop trigger if exists trg_fiscal_queue_jobs_updated on public.fiscal_queue_jobs;
create trigger trg_fiscal_queue_jobs_updated before update on public.fiscal_queue_jobs
  for each row execute function public.set_updated_at();

create table if not exists public.fiscal_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  severity text not null default 'warning',
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  status text not null default 'open',
  due_at timestamptz,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fiscal_alerts_tenant_idx
  on public.fiscal_alerts(tenant_id, status, severity, created_at desc);
drop trigger if exists trg_fiscal_alerts_updated on public.fiscal_alerts;
create trigger trg_fiscal_alerts_updated before update on public.fiscal_alerts
  for each row execute function public.set_updated_at();

create table if not exists public.fiscal_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  justification text,
  integration text,
  protocol text,
  environment text,
  result text not null default 'success',
  error text,
  created_at timestamptz not null default now()
);
create index if not exists fiscal_audit_events_tenant_idx
  on public.fiscal_audit_events(tenant_id, created_at desc);

create table if not exists public.fiscal_monthly_closings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  competence text not null,
  status text not null default 'open',
  progress_percent numeric(5,2) not null default 0,
  missing_documents jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, competence)
);
create index if not exists fiscal_monthly_closings_tenant_idx
  on public.fiscal_monthly_closings(tenant_id, competence desc);
drop trigger if exists trg_fiscal_monthly_closings_updated on public.fiscal_monthly_closings;
create trigger trg_fiscal_monthly_closings_updated before update on public.fiscal_monthly_closings
  for each row execute function public.set_updated_at();

-- ---------- RLS e grants ----------
alter table public.fiscal_documents enable row level security;
alter table public.fiscal_product_rules enable row level security;
alter table public.fiscal_calculations enable row level security;
alter table public.fiscal_document_events enable row level security;
alter table public.fiscal_rejections enable row level security;
alter table public.fiscal_certificates enable row level security;
alter table public.fiscal_tax_assessments enable row level security;
alter table public.fiscal_obligations enable row level security;
alter table public.fiscal_guides enable row level security;
alter table public.fiscal_vault_documents enable row level security;
alter table public.accountant_profiles enable row level security;
alter table public.accountant_requests enable row level security;
alter table public.accountant_messages enable row level security;
alter table public.fiscal_approvals enable row level security;
alter table public.fiscal_queue_jobs enable row level security;
alter table public.fiscal_alerts enable row level security;
alter table public.fiscal_audit_events enable row level security;
alter table public.fiscal_monthly_closings enable row level security;

grant select, insert, update, delete on
  public.fiscal_documents,
  public.fiscal_product_rules,
  public.fiscal_calculations,
  public.fiscal_document_events,
  public.fiscal_rejections,
  public.fiscal_certificates,
  public.fiscal_tax_assessments,
  public.fiscal_obligations,
  public.fiscal_guides,
  public.fiscal_vault_documents,
  public.accountant_profiles,
  public.accountant_requests,
  public.accountant_messages,
  public.fiscal_approvals,
  public.fiscal_queue_jobs,
  public.fiscal_alerts,
  public.fiscal_audit_events,
  public.fiscal_monthly_closings
to authenticated;

-- leitura para staff
create policy fiscal_documents_staff_read on public.fiscal_documents for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_product_rules_staff_read on public.fiscal_product_rules for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_calculations_staff_read on public.fiscal_calculations for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_document_events_staff_read on public.fiscal_document_events for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_rejections_staff_read on public.fiscal_rejections for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_certificates_staff_read on public.fiscal_certificates for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_tax_assessments_staff_read on public.fiscal_tax_assessments for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_obligations_staff_read on public.fiscal_obligations for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_guides_staff_read on public.fiscal_guides for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_vault_documents_staff_read on public.fiscal_vault_documents for select using (public.is_tenant_staff(tenant_id));
create policy accountant_profiles_staff_read on public.accountant_profiles for select using (public.is_tenant_staff(tenant_id));
create policy accountant_requests_staff_read on public.accountant_requests for select using (public.is_tenant_staff(tenant_id));
create policy accountant_messages_staff_read on public.accountant_messages for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_approvals_staff_read on public.fiscal_approvals for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_queue_jobs_staff_read on public.fiscal_queue_jobs for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_alerts_staff_read on public.fiscal_alerts for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_audit_events_staff_read on public.fiscal_audit_events for select using (public.is_tenant_staff(tenant_id));
create policy fiscal_monthly_closings_staff_read on public.fiscal_monthly_closings for select using (public.is_tenant_staff(tenant_id));

-- escrita para administradores do tenant/site
create policy fiscal_documents_admin_write on public.fiscal_documents for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_product_rules_admin_write on public.fiscal_product_rules for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_calculations_admin_write on public.fiscal_calculations for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_document_events_admin_write on public.fiscal_document_events for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_rejections_admin_write on public.fiscal_rejections for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_certificates_admin_write on public.fiscal_certificates for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_tax_assessments_admin_write on public.fiscal_tax_assessments for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_obligations_admin_write on public.fiscal_obligations for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_guides_admin_write on public.fiscal_guides for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_vault_documents_admin_write on public.fiscal_vault_documents for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy accountant_profiles_admin_write on public.accountant_profiles for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy accountant_requests_admin_write on public.accountant_requests for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy accountant_messages_admin_write on public.accountant_messages for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_approvals_admin_write on public.fiscal_approvals for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_queue_jobs_admin_write on public.fiscal_queue_jobs for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_alerts_admin_write on public.fiscal_alerts for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_audit_events_admin_write on public.fiscal_audit_events for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy fiscal_monthly_closings_admin_write on public.fiscal_monthly_closings for all using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
