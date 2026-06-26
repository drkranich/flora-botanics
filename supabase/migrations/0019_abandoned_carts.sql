-- ============================================================
-- FLORA ECOSYSTEM · Migration 19: Carrinhos Abandonados
-- Rastreia carrinhos do storefront para remarketing automático.
-- ============================================================

create table public.carts (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,

  -- Identificação da sessão (gerada no storefront, salva em cookie/localStorage)
  session_id              text not null,

  -- Dados do cliente (capturados quando fornecidos, ex: no checkout step 1)
  customer_email          text,
  customer_name           text,

  -- Itens do carrinho: [{product_id, variant_id, name, slug, image, price_cents, quantity}]
  items                   jsonb not null default '[]'::jsonb,

  -- Total em centavos (consistente com orders)
  subtotal_cents          int not null default 0,

  -- Ciclo de vida do carrinho
  status                  text not null default 'active'
    check (status in ('active', 'abandoned', 'recovered', 'converted')),

  -- Rastreamento de e-mail de recuperação
  recovery_email_sent_at  timestamptz,
  recovery_email_count    int not null default 0,

  -- Último toque no carrinho (atualizado no PUT/PATCH do storefront)
  last_activity_at        timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

-- Unicidade: um carrinho ativo por sessão por tenant
create unique index carts_tenant_session_active
  on public.carts(tenant_id, session_id)
  where status = 'active';

-- Índice principal para queries do admin
create index idx_carts_tenant_status
  on public.carts(tenant_id, status, last_activity_at desc);

-- Índice para o cron de detecção (busca carrinhos prontos para remarketing)
create index idx_carts_remarketing
  on public.carts(tenant_id, last_activity_at)
  where status = 'active'
    and customer_email is not null
    and recovery_email_sent_at is null;

-- ── RLS ──────────────────────────────────────────────────────

alter table public.carts enable row level security;

-- Staff do tenant: lê/atualiza todos os carrinhos da sua loja
create policy carts_staff_read on public.carts for select
  using (public.is_tenant_staff(tenant_id));

create policy carts_staff_update on public.carts for update
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- Anon/storefront: usa service_role key via API route (sem RLS).
-- As políticas abaixo permitem que o papel anon gerencie o próprio carrinho
-- caso alguma rota use a anon key diretamente.
create policy carts_anon_insert on public.carts for insert
  with check (true);

create policy carts_anon_select on public.carts for select
  using (true);

create policy carts_anon_update on public.carts for update
  using (true)
  with check (true);

-- ── Comentário ───────────────────────────────────────────────
comment on table public.carts is
  'Carrinhos do storefront. Status: active → abandoned (>30min inativo) → recovered (email clicado) → converted (pedido criado).';
comment on column public.carts.items is
  'Array JSON: [{product_id, variant_id, name, slug, image, price_cents, quantity}]';
comment on column public.carts.session_id is
  'UUID gerado no storefront, persistido em cookie httpOnly ou localStorage.';
