-- ============================================================
-- FLORA BOTANICS · SEO Engine — Fundação Completa
-- Versão: 2026-08-04
--
-- Tabelas novas:
--   blog_categories, blog_articles, blog_article_tags,
--   seo_redirects, seo_keywords, seo_internal_links,
--   seo_audits, seo_scores, seo_schema_overrides,
--   seo_sitemap_config, seo_robots_rules, seo_ai_scores
--
-- Colunas adicionadas (ADD COLUMN IF NOT EXISTS):
--   categories.seo, categories.description_rich,
--   categories.banner_id, categories.content_rich,
--   categories.faq, categories.intro_rich
-- ============================================================

-- ── helpers ────────────────────────────────────────────────────────────────────
-- set_updated_at() já existe desde migration 0001

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. AMPLIAR CATEGORIES com campos SEO e conteúdo rico
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.categories
  add column if not exists seo            jsonb not null default '{}'::jsonb,
  add column if not exists content_rich   jsonb,
  add column if not exists intro_rich     jsonb,
  add column if not exists faq            jsonb not null default '[]'::jsonb,
  add column if not exists banner_id      uuid references public.media(id) on delete set null,
  add column if not exists keywords       text[] not null default '{}';

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. AMPLIAR PRODUCTS com campos SEO estendidos
-- (products.seo jsonb já existe — adicionamos campos complementares)
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.products
  add column if not exists faq              jsonb not null default '[]'::jsonb,
  add column if not exists benefits         text[] not null default '{}',
  add column if not exists ingredients_rich jsonb,
  add column if not exists usage_rich       jsonb,
  add column if not exists warnings         text,
  add column if not exists gtin             text,
  add column if not exists keywords         text[] not null default '{}';

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. BLOG — Categorias
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.blog_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  slug        text not null,
  name        text not null,
  description text,
  seo         jsonb not null default '{}'::jsonb,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists idx_blog_categories_tenant
  on public.blog_categories(tenant_id);
drop trigger if exists trg_blog_categories_updated on public.blog_categories;
create trigger trg_blog_categories_updated before update on public.blog_categories
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. BLOG — Artigos
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.blog_articles (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  category_id     uuid references public.blog_categories(id) on delete set null,

  -- Identidade
  slug            text not null,
  title           text not null,
  subtitle        text,
  cover_id        uuid references public.media(id) on delete set null,
  status          text not null default 'draft'
                    check (status in ('draft','published','archived')),

  -- Conteúdo
  body_rich       jsonb,
  excerpt         text,
  reading_time_min int,
  faq             jsonb not null default '[]'::jsonb,
  references_list jsonb not null default '[]'::jsonb,   -- [{title, url}]
  related_product_ids uuid[] not null default '{}',

  -- Autoria
  author_name     text,
  author_role     text,
  author_avatar   text,

  -- SEO
  seo             jsonb not null default '{}'::jsonb,
  keywords        text[] not null default '{}',

  -- Schema / IA
  ai_score        int,
  ai_feedback     jsonb not null default '{}'::jsonb,

  -- Datas
  published_at    timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (tenant_id, slug)
);
create index if not exists idx_blog_articles_tenant_status
  on public.blog_articles(tenant_id, status, published_at desc);
create index if not exists idx_blog_articles_category
  on public.blog_articles(tenant_id, category_id);
create index if not exists idx_blog_articles_search
  on public.blog_articles using gin(
    to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(subtitle,'') || ' ' || coalesce(excerpt,''))
  );
drop trigger if exists trg_blog_articles_updated on public.blog_articles;
create trigger trg_blog_articles_updated before update on public.blog_articles
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. BLOG — Tags (many-to-many)
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.blog_tags (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  slug       text not null,
  name       text not null,
  unique (tenant_id, slug)
);

create table if not exists public.blog_article_tags (
  article_id uuid not null references public.blog_articles(id) on delete cascade,
  tag_id     uuid not null references public.blog_tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. SEO REDIRECTS — 301/302/307/308
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.seo_redirects (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  from_path   text not null,
  to_path     text not null,
  code        int not null default 301 check (code in (301,302,307,308)),
  reason      text,
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, from_path)
);
create index if not exists idx_seo_redirects_tenant_active
  on public.seo_redirects(tenant_id, active, from_path);
drop trigger if exists trg_seo_redirects_updated on public.seo_redirects;
create trigger trg_seo_redirects_updated before update on public.seo_redirects
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. SEO KEYWORDS — banco de palavras-chave por tenant
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.seo_keywords (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  keyword      text not null,
  intent       text not null default 'informational'
                 check (intent in ('informational','navigational','transactional','commercial')),
  priority     text not null default 'medium' check (priority in ('low','medium','high','critical')),
  difficulty   int check (difficulty between 0 and 100),
  volume_est   int,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, keyword)
);
create index if not exists idx_seo_keywords_tenant
  on public.seo_keywords(tenant_id, priority);
drop trigger if exists trg_seo_keywords_updated on public.seo_keywords;
create trigger trg_seo_keywords_updated before update on public.seo_keywords
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. SEO INTERNAL LINKS — grafo de links internos
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.seo_internal_links (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  from_type    text not null,   -- 'product','category','page','article'
  from_id      uuid not null,
  from_path    text not null,
  to_type      text not null,
  to_id        uuid not null,
  to_path      text not null,
  anchor_text  text,
  auto         boolean not null default false,  -- sugerido pela IA
  created_at   timestamptz not null default now()
);
create index if not exists idx_seo_internal_links_tenant
  on public.seo_internal_links(tenant_id, from_type, from_id);
create index if not exists idx_seo_internal_links_to
  on public.seo_internal_links(tenant_id, to_type, to_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 9. SEO AUDITS — registros de auditoria automática
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.seo_audits (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  entity_type  text not null,   -- 'product','category','page','article','site'
  entity_id    uuid,            -- null = auditoria global
  entity_path  text,
  issues       jsonb not null default '[]'::jsonb,
  -- cada issue: {code, severity: 'error'|'warning'|'info', message, field}
  score        int check (score between 0 and 100),
  ran_at       timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists idx_seo_audits_tenant_entity
  on public.seo_audits(tenant_id, entity_type, entity_id, ran_at desc);
create index if not exists idx_seo_audits_tenant_recent
  on public.seo_audits(tenant_id, ran_at desc);

-- ══════════════════════════════════════════════════════════════════════════════
-- 10. SEO AI SCORES — pontuação AI Visibility por entidade
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.seo_ai_scores (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  entity_type    text not null,
  entity_id      uuid not null,
  entity_path    text,
  ai_score       int check (ai_score between 0 and 100),
  -- breakdown por critério
  has_faq        boolean not null default false,
  has_schema     boolean not null default false,
  has_rich_body  boolean not null default false,
  has_entities   boolean not null default false,
  has_author     boolean not null default false,
  freshness_days int,
  feedback       jsonb not null default '{}'::jsonb,
  evaluated_at   timestamptz not null default now(),
  unique (tenant_id, entity_type, entity_id)
);
create index if not exists idx_seo_ai_scores_tenant
  on public.seo_ai_scores(tenant_id, entity_type, ai_score desc);

-- ══════════════════════════════════════════════════════════════════════════════
-- 11. SEO SCHEMA OVERRIDES — JSON-LD manual por entidade
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.seo_schema_overrides (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  entity_type  text not null,
  entity_id    uuid not null,
  schema_type  text not null,   -- 'Product','Organization','LocalBusiness' etc.
  schema_json  jsonb not null default '{}'::jsonb,
  active       boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, entity_type, entity_id, schema_type)
);
drop trigger if exists trg_seo_schema_updated on public.seo_schema_overrides;
create trigger trg_seo_schema_updated before update on public.seo_schema_overrides
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- 12. SEO SITEMAP CONFIG — prioridade e frequência por tipo de entidade
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.seo_sitemap_config (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  entity_type      text not null,   -- 'product','category','page','article' etc.
  included         boolean not null default true,
  priority         numeric(2,1) not null default 0.5
                     check (priority between 0.0 and 1.0),
  change_frequency text not null default 'weekly'
                     check (change_frequency in
                       ('always','hourly','daily','weekly','monthly','yearly','never')),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, entity_type)
);
drop trigger if exists trg_seo_sitemap_config_updated on public.seo_sitemap_config;
create trigger trg_seo_sitemap_config_updated before update on public.seo_sitemap_config
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- 13. SEO ROBOTS RULES — regras customizadas por tenant
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.seo_robots_rules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_agent  text not null default '*',
  directive   text not null check (directive in ('allow','disallow')),
  path        text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_seo_robots_rules_tenant
  on public.seo_robots_rules(tenant_id, active, sort_order);
drop trigger if exists trg_seo_robots_rules_updated on public.seo_robots_rules;
create trigger trg_seo_robots_rules_updated before update on public.seo_robots_rules
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- 14. SEEDS — configuração padrão de sitemap por tipo
-- ══════════════════════════════════════════════════════════════════════════════

-- Será inserido via upsert pelo admin quando o tenant configurar.
-- Sem seeds aqui para respeitar multi-tenancy.

-- ══════════════════════════════════════════════════════════════════════════════
-- 15. RLS — Políticas de segurança
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.blog_categories       enable row level security;
alter table public.blog_articles         enable row level security;
alter table public.blog_tags             enable row level security;
alter table public.blog_article_tags     enable row level security;
alter table public.seo_redirects         enable row level security;
alter table public.seo_keywords          enable row level security;
alter table public.seo_internal_links    enable row level security;
alter table public.seo_audits            enable row level security;
alter table public.seo_ai_scores         enable row level security;
alter table public.seo_schema_overrides  enable row level security;
alter table public.seo_sitemap_config    enable row level security;
alter table public.seo_robots_rules      enable row level security;

-- Staff autenticado (tenant_admin / tenant_editor) acessa seu próprio tenant
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'blog_categories','blog_articles','blog_tags','blog_article_tags',
    'seo_redirects','seo_keywords','seo_internal_links',
    'seo_audits','seo_ai_scores','seo_schema_overrides',
    'seo_sitemap_config','seo_robots_rules'
  ]
  loop
    -- drop e recria para evitar duplicatas
    execute format('drop policy if exists "staff_all_%s" on public.%I', tbl, tbl);
    execute format($p$
      create policy "staff_all_%s" on public.%I
        for all to authenticated
        using (
          tenant_id in (
            select s.tenant_id from public.staff s
            where s.user_id = auth.uid()
              and s.status = 'active'
          )
        )
        with check (
          tenant_id in (
            select s.tenant_id from public.staff s
            where s.user_id = auth.uid()
              and s.status = 'active'
          )
        )
    $p$, tbl, tbl);
  end loop;
end $$;

-- Storefront (anon) pode ler blog_articles/categories publicados e redirects
drop policy if exists "anon_read_blog_articles" on public.blog_articles;
create policy "anon_read_blog_articles" on public.blog_articles
  for select to anon
  using (status = 'published');

drop policy if exists "anon_read_blog_categories" on public.blog_categories;
create policy "anon_read_blog_categories" on public.blog_categories
  for select to anon
  using (true);

drop policy if exists "anon_read_seo_redirects" on public.seo_redirects;
create policy "anon_read_seo_redirects" on public.seo_redirects
  for select to anon
  using (active = true);

drop policy if exists "anon_read_seo_robots" on public.seo_robots_rules;
create policy "anon_read_seo_robots" on public.seo_robots_rules
  for select to anon
  using (active = true);

drop policy if exists "anon_read_sitemap_config" on public.seo_sitemap_config;
create policy "anon_read_sitemap_config" on public.seo_sitemap_config
  for select to anon
  using (true);

-- blog_article_tags e blog_tags: leitura anon (para storefront)
drop policy if exists "anon_read_blog_tags" on public.blog_tags;
create policy "anon_read_blog_tags" on public.blog_tags
  for select to anon using (true);

drop policy if exists "anon_read_blog_article_tags" on public.blog_article_tags;
create policy "anon_read_blog_article_tags" on public.blog_article_tags
  for select to anon using (true);
