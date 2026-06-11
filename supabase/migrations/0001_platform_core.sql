-- ============================================================
-- FLORA ECOSYSTEM · Migration 1: Platform Core
-- tenants, domínios, temas, profiles, audit, funções helper
-- (aplicada em 2026-06-11 via MCP)
-- ============================================================

create or replace function public.auth_tenant_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

create or replace function public.auth_role()
returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable as $$
  select public.auth_role() = 'platform_admin'
$$;

create or replace function public.is_tenant_staff(t uuid)
returns boolean language sql stable as $$
  select public.is_platform_admin()
      or (public.auth_tenant_id() = t
          and public.auth_role() in ('tenant_owner','tenant_admin','tenant_editor'))
$$;

create or replace function public.is_tenant_admin(t uuid)
returns boolean language sql stable as $$
  select public.is_platform_admin()
      or (public.auth_tenant_id() = t
          and public.auth_role() in ('tenant_owner','tenant_admin'))
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  status text not null default 'active' check (status in ('active','suspended')),
  plan text not null default 'internal' check (plan in ('internal','pro','enterprise')),
  default_locale text not null default 'pt-BR',
  default_currency text not null default 'BRL',
  order_seq bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_tenants_updated before update on public.tenants
  for each row execute function public.set_updated_at();

create table public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_tenant_domains_tenant on public.tenant_domains(tenant_id);

create table public.tenant_themes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  tokens jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger trg_tenant_themes_updated before update on public.tenant_themes
  for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  role text not null default 'customer'
    check (role in ('platform_admin','tenant_owner','tenant_admin','tenant_editor','customer')),
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_tenant on public.profiles(tenant_id);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, tenant_id, role, full_name)
  values (
    new.id,
    nullif(new.raw_app_meta_data ->> 'tenant_id','')::uuid,
    coalesce(nullif(new.raw_app_meta_data ->> 'role',''), 'customer'),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_tenant_time on public.audit_logs(tenant_id, created_at desc);
