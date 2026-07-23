-- Lista de desejos sincronizada por conta publica.
-- Cada usuario autenticado ve e altera apenas seus favoritos dentro do tenant.

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tenant_id, profile_id, product_id)
);

create index if not exists idx_wishlist_items_profile
  on public.wishlist_items(profile_id, created_at desc);

create index if not exists idx_wishlist_items_tenant_product
  on public.wishlist_items(tenant_id, product_id);

alter table public.wishlist_items enable row level security;

drop policy if exists wishlist_items_owner_select on public.wishlist_items;
create policy wishlist_items_owner_select on public.wishlist_items
  for select
  to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists wishlist_items_owner_insert on public.wishlist_items;
create policy wishlist_items_owner_insert on public.wishlist_items
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.tenant_id = wishlist_items.tenant_id
        and p.status = 'published'
        and p.deleted_at is null
    )
  );

drop policy if exists wishlist_items_owner_delete on public.wishlist_items;
create policy wishlist_items_owner_delete on public.wishlist_items
  for delete
  to authenticated
  using (profile_id = (select auth.uid()));

grant select, insert, delete on public.wishlist_items to authenticated;
