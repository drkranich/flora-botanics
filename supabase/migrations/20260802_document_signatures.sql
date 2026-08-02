-- ─────────────────────────────────────────────────────────────────────────────
-- Migração: document_signatures
-- Assinaturas digitais de documentos comerciais (orçamentos, propostas, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.document_signatures (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  quote_id        uuid not null references public.commercial_quotes(id) on delete cascade,

  -- Token público único enviado ao cliente (URL de assinatura)
  public_token    uuid not null default gen_random_uuid() unique,

  -- Status do processo
  status          text not null default 'pending'
    check (status in ('pending', 'signed', 'rejected', 'expired')),

  -- Dados do signatário (preenchidos ao assinar)
  signer_name     text,
  signer_email    text,
  signer_ip       text,
  user_agent      text,
  signed_at       timestamptz,

  -- Método usado
  method          text check (method in ('canvas', 'gov_br')),

  -- Gov.br
  gov_br_sub      text,       -- subject do JWT Gov.br (CPF hash)
  gov_br_name     text,       -- nome retornado pelo Gov.br
  gov_br_level    text,       -- nível de autenticação: 'bronze'|'silver'|'gold'

  -- Evidências de autoria
  hash_sha256     text,       -- SHA-256 do conteúdo HTML do documento no momento da assinatura
  signature_image_path text,  -- caminho no bucket 'signatures' (PNG do traço)
  pdf_signed_path text,       -- caminho no bucket 'signatures' (PDF final com assinatura)

  -- Expiração do link
  expires_at      timestamptz not null default (now() + interval '30 days'),

  -- Quem gerou o pedido de assinatura
  requested_by    uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Índices
create index if not exists idx_document_signatures_quote
  on public.document_signatures(quote_id);
create index if not exists idx_document_signatures_token
  on public.document_signatures(public_token);
create index if not exists idx_document_signatures_tenant
  on public.document_signatures(tenant_id, status, created_at desc);

-- Trigger updated_at
drop trigger if exists trg_document_signatures_updated on public.document_signatures;
create trigger trg_document_signatures_updated
  before update on public.document_signatures
  for each row execute function public.update_updated_at_column();

-- RLS
alter table public.document_signatures enable row level security;

-- Staff do tenant pode ver e criar
drop policy if exists document_signatures_staff on public.document_signatures;
create policy document_signatures_staff on public.document_signatures
  for all
  using (
    tenant_id in (
      select tenant_id from public.staff_members
      where user_id = auth.uid()
        and status = 'active'
        and deleted_at is null
    )
  );

-- Acesso anônimo via public_token (para a página de assinatura do cliente)
drop policy if exists document_signatures_public_read on public.document_signatures;
create policy document_signatures_public_read on public.document_signatures
  for select
  to anon
  using (
    status = 'pending'
    and expires_at > now()
  );

-- Anônimo pode atualizar (assinar) somente via public_token — controlado pela API route
-- (não via policy direta — a route usa service_role)
