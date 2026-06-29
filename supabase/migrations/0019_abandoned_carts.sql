-- ============================================================
-- FLORA ECOSYSTEM · Migration 19: Carrinhos Abandonados
-- Compatibiliza a tabela carts antiga (0004) com o remarketing.
-- ============================================================

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id text,
  customer_email text,
  customer_name text,
  items jsonb not null default '[]'::jsonb,
  subtotal_cents int not null default 0,
  status text not null default 'active',
  recovery_email_sent_at timestamptz,
  recovery_email_count int not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.carts add column if not exists session_id text;
alter table public.carts add column if not exists customer_email text;
alter table public.carts add column if not exists customer_name text;
alter table public.carts add column if not exists items jsonb;
alter table public.carts add column if not exists subtotal_cents int;
alter table public.carts add column if not exists recovery_email_sent_at timestamptz;
alter table public.carts add column if not exists recovery_email_count int;
alter table public.carts add column if not exists last_activity_at timestamptz;

update public.carts
set
  items = coalesce(items, '[]'::jsonb),
  subtotal_cents = coalesce(subtotal_cents, 0),
  recovery_email_count = coalesce(recovery_email_count, 0),
  last_activity_at = coalesce(last_activity_at, updated_at, created_at, now());

update public.carts c
set
  customer_email = coalesce(c.customer_email, cu.email),
  customer_name = coalesce(c.customer_name, cu.full_name)
from public.customers cu
where c.customer_id = cu.id;

update public.carts c
set
  items = ci.items,
  subtotal_cents = ci.subtotal_cents
from (
  select
    ci.cart_id,
    jsonb_agg(
      jsonb_build_object(
        'product_id', p.id,
        'variant_id', v.id,
        'name', coalesce(p.name, v.name, 'Produto'),
        'slug', p.slug,
        'image', null,
        'price_cents', coalesce(ci.unit_price_cents, v.price_cents, 0),
        'quantity', ci.quantity
      )
      order by ci.created_at
    ) as items,
    coalesce(sum(coalesce(ci.unit_price_cents, v.price_cents, 0) * ci.quantity), 0)::int as subtotal_cents
  from public.cart_items ci
  left join public.product_variants v on v.id = ci.variant_id
  left join public.products p on p.id = v.product_id
  group by ci.cart_id
) ci
where c.id = ci.cart_id
  and (c.items = '[]'::jsonb or jsonb_array_length(c.items) = 0);

alter table public.carts alter column items set default '[]'::jsonb;
alter table public.carts alter column items set not null;
alter table public.carts alter column subtotal_cents set default 0;
alter table public.carts alter column subtotal_cents set not null;
alter table public.carts alter column recovery_email_count set default 0;
alter table public.carts alter column recovery_email_count set not null;
alter table public.carts alter column last_activity_at set default now();
alter table public.carts alter column last_activity_at set not null;
alter table public.carts alter column status set default 'active';

alter table public.carts drop constraint if exists carts_status_check;
update public.carts set status = 'active' where status = 'open';
alter table public.carts add constraint carts_status_check
  check (status in ('active', 'abandoned', 'recovered', 'converted'));

drop index if exists public.idx_carts_tenant_status;
create index if not exists idx_carts_tenant_status
  on public.carts(tenant_id, status, last_activity_at desc);

create index if not exists idx_carts_session on public.carts(session_id);

create unique index if not exists carts_tenant_session_active
  on public.carts(tenant_id, session_id)
  where status = 'active' and session_id is not null;

create index if not exists idx_carts_remarketing
  on public.carts(tenant_id, last_activity_at)
  where status = 'active'
    and customer_email is not null
    and recovery_email_sent_at is null;

alter table public.carts enable row level security;

drop policy if exists carts_staff_read on public.carts;
create policy carts_staff_read on public.carts for select
  to authenticated
  using (public.is_tenant_staff(tenant_id));

drop policy if exists carts_staff_update on public.carts;
create policy carts_staff_update on public.carts for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists carts_anon_insert on public.carts;
create policy carts_anon_insert on public.carts for insert
  to anon
  with check (true);

drop policy if exists carts_anon_select on public.carts;
create policy carts_anon_select on public.carts for select
  to anon
  using (true);

drop policy if exists carts_anon_update on public.carts;
create policy carts_anon_update on public.carts for update
  to anon
  using (true)
  with check (true);

comment on table public.carts is
  'Carrinhos do storefront. Status: active -> abandoned (>30min inativo) -> recovered (email clicado) -> converted (pedido criado).';
comment on column public.carts.items is
  'Array JSON: [{product_id, variant_id, name, slug, image, price_cents, quantity}]';
comment on column public.carts.session_id is
  'UUID gerado no storefront e persistido no navegador.';
