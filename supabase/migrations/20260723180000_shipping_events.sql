-- Eventos de rastreamento de pedido (rota de entrega).
-- Cada linha = uma etapa da jornada (saiu do CD, chegou em São Paulo, saiu para entrega, etc.)

create table if not exists public.shipping_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  order_id     uuid not null references public.orders(id) on delete cascade,

  -- Evento
  status       text not null check (status in (
    'preparing',       -- Preparando pedido
    'dispatched',      -- Enviado / postado
    'in_transit',      -- Em trânsito (mudança de cidade)
    'out_for_delivery',-- Saiu para entrega
    'delivered',       -- Entregue
    'exception'        -- Ocorrência / problema
  )),
  city         text,
  state        text,
  description  text,                       -- Mensagem customizada para o evento

  -- Rastreamento da transportadora
  carrier      text,                       -- ex: "Correios", "Jadlog"
  tracking_code text,

  -- WhatsApp
  whatsapp_sent     boolean not null default false,
  whatsapp_sent_at  timestamptz,
  whatsapp_phone    text,                  -- número que recebeu

  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id)
);

-- Índices
create index if not exists shipping_events_order_id_idx   on public.shipping_events(order_id);
create index if not exists shipping_events_tenant_id_idx  on public.shipping_events(tenant_id);

-- RLS: staff do tenant pode tudo; cliente lê apenas seus próprios pedidos
alter table public.shipping_events enable row level security;

create policy "staff_all" on public.shipping_events
  for all
  using (
    tenant_id in (
      select tenant_id from public.profiles
      where id = auth.uid()
        and role in ('platform_admin','tenant_owner','tenant_admin','tenant_editor')
    )
  );

create policy "customer_read" on public.shipping_events
  for select
  using (
    order_id in (
      select o.id from public.orders o
      join public.customers c on c.id = o.customer_id
      where c.profile_id = auth.uid()
    )
  );
