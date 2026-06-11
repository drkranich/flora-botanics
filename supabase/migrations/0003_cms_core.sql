-- ============================================================
-- FLORA ECOSYSTEM · Migration 3: CMS
-- (aplicada em 2026-06-11 via MCP)
-- ============================================================

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  type text not null default 'landing'
    check (type in ('home','landing','institutional','blog_post')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_version_id uuid,
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index idx_pages_tenant_status on public.pages(tenant_id, status);
create trigger trg_pages_updated before update on public.pages
  for each row execute function public.set_updated_at();

create table public.page_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  version int not null,
  sections jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (page_id, version)
);
create index idx_page_versions_page on public.page_versions(page_id, version desc);

alter table public.pages
  add constraint fk_pages_published_version
  foreign key (published_version_id) references public.page_versions(id)
  on delete set null;

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location text not null check (location in ('header','footer_1','footer_2','footer_3')),
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (tenant_id, location)
);
create trigger trg_menus_updated before update on public.menus
  for each row execute function public.set_updated_at();

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);
create trigger trg_site_settings_updated before update on public.site_settings
  for each row execute function public.set_updated_at();
