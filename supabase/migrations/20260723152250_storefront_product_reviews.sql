-- Avaliacoes de produtos da loja publica.
-- Clientes autenticados enviam avaliacoes pendentes; a loja publica mostra somente aprovadas.

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null,
  display_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id, profile_id)
);

create index if not exists idx_product_reviews_product_status
  on public.product_reviews(tenant_id, product_id, status, created_at desc);

create index if not exists idx_product_reviews_profile
  on public.product_reviews(profile_id, created_at desc);

drop trigger if exists trg_product_reviews_updated on public.product_reviews;
create trigger trg_product_reviews_updated before update on public.product_reviews
  for each row execute function public.set_updated_at();

alter table public.product_reviews enable row level security;

drop policy if exists product_reviews_public_approved on public.product_reviews;
create policy product_reviews_public_approved on public.product_reviews
  for select
  to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1
      from public.products p
      where p.id = product_reviews.product_id
        and p.tenant_id = product_reviews.tenant_id
        and p.status = 'published'
        and p.deleted_at is null
    )
  );

drop policy if exists product_reviews_owner_select on public.product_reviews;
create policy product_reviews_owner_select on public.product_reviews
  for select
  to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists product_reviews_owner_insert on public.product_reviews;
create policy product_reviews_owner_insert on public.product_reviews
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1
      from public.products p
      where p.id = product_reviews.product_id
        and p.tenant_id = product_reviews.tenant_id
        and p.status = 'published'
        and p.deleted_at is null
    )
    and (
      customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.id = product_reviews.customer_id
          and c.tenant_id = product_reviews.tenant_id
          and c.profile_id = (select auth.uid())
      )
    )
  );

drop policy if exists product_reviews_owner_update_pending on public.product_reviews;
create policy product_reviews_owner_update_pending on public.product_reviews
  for update
  to authenticated
  using (
    profile_id = (select auth.uid())
    and status in ('pending', 'rejected')
  )
  with check (
    profile_id = (select auth.uid())
    and status = 'pending'
  );

drop policy if exists product_reviews_owner_delete on public.product_reviews;
create policy product_reviews_owner_delete on public.product_reviews
  for delete
  to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists product_reviews_staff_all on public.product_reviews;
create policy product_reviews_staff_all on public.product_reviews
  for all
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

grant select on public.product_reviews to anon;
grant select, insert, update, delete on public.product_reviews to authenticated;
