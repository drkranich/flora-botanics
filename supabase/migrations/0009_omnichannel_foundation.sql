-- ============================================================
-- FLORA ECOSYSTEM · Migration 9: Fundação omnichannel
-- Tabelas prontas para as integrações futuras:
-- canais conectados, conversas, mensagens e movimentações de estoque.
-- ============================================================

-- ---------- conexões de canais externos ----------
create table public.channel_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null check (channel in (
    'site','whatsapp','instagram','email','mercado_livre','shopee',
    'amazon','tiktok','google_merchant','facebook'
  )),
  status text not null default 'disconnected'
    check (status in ('connected','disconnected','error','pending_auth')),
  display_name text,
  credentials jsonb,            -- tokens/segredos: gravados apenas por service role
  settings jsonb not null default '{}'::jsonb, -- regras: preço por canal, estoque reservado, sync
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, channel)
);
create trigger trg_channel_accounts_updated before update on public.channel_accounts
  for each row execute function public.set_updated_at();

alter table public.channel_accounts enable row level security;
create policy channels_staff_read on public.channel_accounts for select
  using (public.is_tenant_admin(tenant_id));
create policy channels_staff_settings on public.channel_accounts for update
  using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
-- insert/delete (conexão real com tokens): apenas service role / edge functions

-- ---------- conversas (inbox) ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null,
  channel_account_id uuid references public.channel_accounts(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  contact_name text,
  contact_handle text,           -- telefone, @usuario ou e-mail
  status text not null default 'new'
    check (status in ('new','open','waiting','resolved')),
  assigned_to uuid references public.profiles(id) on delete set null,
  tags text[] not null default '{}',
  unread_count int not null default 0,
  last_message_preview text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_conversations_tenant on public.conversations(tenant_id, status, last_message_at desc);
create trigger trg_conversations_updated before update on public.conversations
  for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
create policy conversations_staff_all on public.conversations for all
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

-- ---------- mensagens ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('in','out','note')),
  sender_name text,
  body text not null,
  attachments jsonb,
  external_id text,              -- id da mensagem na plataforma de origem
  created_at timestamptz not null default now()
);
create index idx_messages_conversation on public.messages(conversation_id, created_at);

alter table public.messages enable row level security;
create policy messages_staff_read on public.messages for select
  using (public.is_tenant_staff(tenant_id));
create policy messages_staff_send on public.messages for insert
  with check (public.is_tenant_staff(tenant_id) and direction in ('out','note'));
-- mensagens recebidas ('in'): apenas service role (webhooks dos canais)

-- ---------- movimentações de estoque ----------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  type text not null check (type in (
    'entrada','venda','ajuste','devolucao','perda','transferencia','reserva'
  )),
  delta int not null,            -- variação com sinal (+entrada / -saída)
  balance_after int,             -- saldo após a movimentação
  reason text,
  order_id uuid references public.orders(id) on delete set null,
  channel text,                  -- origem: site, mercado_livre, manual…
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_stock_movements_tenant on public.stock_movements(tenant_id, created_at desc);
create index idx_stock_movements_variant on public.stock_movements(variant_id, created_at desc);

alter table public.stock_movements enable row level security;
create policy stock_movements_staff_read on public.stock_movements for select
  using (public.is_tenant_admin(tenant_id));
create policy stock_movements_staff_insert on public.stock_movements for insert
  with check (public.is_tenant_admin(tenant_id));

-- registra o canal "site" como conectado (verdade desde o dia 1)
insert into public.channel_accounts (tenant_id, channel, status, display_name)
select id, 'site', 'connected', 'Site próprio' from public.tenants where slug = 'flora-botanics'
on conflict (tenant_id, channel) do nothing;
