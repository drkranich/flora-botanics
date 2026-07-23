-- ============================================================
-- Product kits foundation
-- ============================================================
-- A product with products.type = 'kit' is sold through its default
-- product_variant, but its real availability is calculated from the
-- stock of the component variants below.

create table public.product_kit_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kit_product_id uuid not null references public.products(id) on delete cascade,
  component_variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity int not null check (quantity > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kit_product_id, component_variant_id)
);

create index idx_product_kit_items_tenant on public.product_kit_items(tenant_id);
create index idx_product_kit_items_kit on public.product_kit_items(kit_product_id, sort_order);
create index idx_product_kit_items_component on public.product_kit_items(component_variant_id);

create trigger trg_product_kit_items_updated before update on public.product_kit_items
  for each row execute function public.set_updated_at();

create or replace function public.validate_product_kit_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  kit_tenant uuid;
  kit_type text;
  component_tenant uuid;
begin
  select tenant_id, type
    into kit_tenant, kit_type
  from public.products
  where id = new.kit_product_id;

  if kit_tenant is null then
    raise exception 'Kit product not found';
  end if;

  if kit_type <> 'kit' then
    raise exception 'Kit product must have type kit';
  end if;

  select tenant_id
    into component_tenant
  from public.product_variants
  where id = new.component_variant_id;

  if component_tenant is null then
    raise exception 'Component variant not found';
  end if;

  if new.tenant_id <> kit_tenant or component_tenant <> kit_tenant then
    raise exception 'Kit and component must belong to the same tenant';
  end if;

  return new;
end $$;

create trigger trg_validate_product_kit_item
  before insert or update on public.product_kit_items
  for each row execute function public.validate_product_kit_item();

create or replace function public.product_kit_available_quantity(p_kit_product_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(
    min(
      floor(
        greatest(coalesce(i.quantity, 0) - coalesce(i.reserved, 0), 0)::numeric
        / nullif(ki.quantity, 0)
      )
    )::int,
    0
  )
  from public.product_kit_items ki
  left join public.inventory i on i.variant_id = ki.component_variant_id
  where ki.kit_product_id = p_kit_product_id;
$$;

alter table public.product_kit_items enable row level security;

create policy product_kit_items_public_read on public.product_kit_items
  for select
  using (
    exists (
      select 1
      from public.products p
      where p.id = kit_product_id
        and p.status = 'published'
        and p.deleted_at is null
    )
    or public.is_tenant_staff(tenant_id)
  );

create policy product_kit_items_staff_write on public.product_kit_items
  for all
  using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));
