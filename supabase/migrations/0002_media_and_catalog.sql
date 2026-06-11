-- ============================================================
-- FLORA ECOSYSTEM · Migration 2: Mídia + Catálogo
-- (aplicada em 2026-06-11 via MCP)
-- ============================================================

create table public.media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_path text not null,
  provider text not null default 'supabase' check (provider in ('supabase','r2')),
  mime text,
  width int,
  height int,
  alt text,
  blurhash text,
  byte_size bigint,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index idx_media_tenant on public.media(tenant_id, created_at desc);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete set null,
  slug text not null,
  name text not null,
  description text,
  image_id uuid references public.media(id) on delete set null,
  sort_order int not null default 0,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index idx_categories_tenant on public.categories(tenant_id, status);
create trigger trg_categories_updated before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  name text not null,
  subtitle text,
  description_rich jsonb,
  type text not null default 'simple'
    check (type in ('simple','variable','kit','digital','subscription')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  brand_line text,
  tags text[] not null default '{}',
  seo jsonb not null default '{}'::jsonb,
  search tsvector generated always as (
    to_tsvector('portuguese',
      coalesce(name,'') || ' ' || coalesce(subtitle,'') || ' ' || coalesce(brand_line,''))
  ) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index idx_products_tenant_status on public.products(tenant_id, status) where deleted_at is null;
create index idx_products_search on public.products using gin(search);
create index idx_products_tags on public.products using gin(tags);
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null,
  name text,
  options jsonb not null default '{}'::jsonb,
  price_cents int not null check (price_cents >= 0),
  compare_at_cents int check (compare_at_cents >= 0),
  currency text not null default 'BRL',
  stripe_price_id text,
  weight_g int,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);
create index idx_variants_product on public.product_variants(product_id);
create trigger trg_variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create table public.product_media (
  product_id uuid not null references public.products(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  sort_order int not null default 0,
  role text not null default 'gallery' check (role in ('gallery','cover')),
  primary key (product_id, media_id)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  image_id uuid references public.media(id) on delete set null,
  rules jsonb,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create trigger trg_collections_updated before update on public.collections
  for each row execute function public.set_updated_at();

create table public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order int not null default 0,
  primary key (collection_id, product_id)
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  variant_id uuid not null unique references public.product_variants(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  reserved int not null default 0 check (reserved >= 0),
  low_stock_threshold int not null default 5,
  track boolean not null default true,
  updated_at timestamptz not null default now()
);
create index idx_inventory_tenant on public.inventory(tenant_id);
create trigger trg_inventory_updated before update on public.inventory
  for each row execute function public.set_updated_at();
