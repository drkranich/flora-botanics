# FLORA ECOSYSTEM — Blueprint Técnico

**Versão:** 1.0 · **Data:** 2026-06-11 · **Autor:** Arquitetura assistida (Claude Cowork) + Gustavo
**Status:** Documento de referência — válido até ser revisado

---

## 1. Visão e Princípios

### 1.1 O que estamos construindo

Uma plataforma SaaS multi-tenant para operar marcas de e-commerce premium. A **Flora Botanics** é o tenant nº 1 e a marca-laboratório que valida o sistema. O ativo de longo prazo é o **núcleo da plataforma**, não a loja.

### 1.2 O que NÃO estamos construindo (no MVP)

Marketplace multi-vendedor, motor visual de automações, e-mail marketing próprio, WhatsApp, LMS, booking, ERP, app mobile, white label público. Esses são módulos de fases futuras. Tentar construí-los agora mataria o projeto.

### 1.3 Princípios de arquitetura

1. **Multi-tenant desde o dia 1, no dado — não na feature.** Toda tabela de negócio carrega `tenant_id` com Row Level Security. Adicionar a segunda marca custa uma linha em `tenants`, não uma reescrita.
2. **Núcleo fino, módulos plugáveis.** O core sabe de: tenants, usuários, permissões, mídia, catálogo, pedidos e páginas. Tudo o mais é módulo que depende do core, nunca o contrário.
3. **CMS por blocos, não por templates.** Páginas são listas ordenadas de seções JSON validadas por schema. O front renderiza blocos; o admin edita blocos. Sem page-builder drag-and-drop no MVP (caro, frágil) — formulários estruturados com preview ao vivo entregam 90% do valor por 10% do custo.
4. **Stripe é a fonte da verdade de pagamento.** Pedido só vira `paid` via webhook. Nunca confiar no client.
5. **Boring tech, decisões reversíveis.** Postgres resolve filas, busca e cache até provar que não resolve. Nada de Kafka/Redis/microsserviços antes de tração.
6. **Tudo versionável e auditável.** Conteúdo publicado tem versão; ações administrativas têm audit log.

### 1.4 Posicionamento visual (tenant Flora Botanics)

Luxo europeu (Chanel, Aesop, Prada Beauty) × biodiversidade brasileira (Natura, Costa Brazil).

| Token | Valor | Uso |
|---|---|---|
| `forest-900` | `#0f2012` | Fundos hero, footer |
| `forest-700` | `#21351d` | Superfícies escuras |
| `cream` | `#f2ecdf` | Fundo principal |
| `cream-dark` | `#e6ddcb` | Seções alternadas |
| `gold` | `#b9924d` | CTAs, acentos |
| `gold-dark` | `#96763f` | Hover |
| `ink` | `#28251d` | Texto |

Tipografia: **Cormorant Garamond** (display) + **Montserrat** (UI/corpo). Esses tokens já existem no `index.html` atual — o design system nasce deles. Importante: cada tenant tem seu próprio conjunto de tokens (tabela `tenant_themes`); estes são os defaults da Flora.

---

## 2. Arquitetura Geral

```
                         ┌──────────────────────────────┐
                         │   CLOUDFLARE (borda)         │
                         │   CDN · WAF · Rate Limiting  │
                         │   Turnstile · R2 (mídia)     │
                         └──────────────┬───────────────┘
                                        │
            ┌───────────────────────────┼───────────────────────────┐
            │                           │                           │
   ┌────────▼────────┐       ┌──────────▼─────────┐       ┌─────────▼────────┐
   │ STOREFRONT      │       │ ADMIN (Backoffice) │       │ EDGE FUNCTIONS   │
   │ Next.js (SSR/   │       │ Next.js (SPA-ish)  │       │ Supabase/Workers │
   │ ISR) por tenant │       │ admin.flora...     │       │ checkout, webhook│
   └────────┬────────┘       └──────────┬─────────┘       └─────────┬────────┘
            │                           │                           │
            └───────────────┬───────────┴───────────────┬───────────┘
                            │                           │
                  ┌─────────▼──────────┐      ┌─────────▼─────────┐
                  │ SUPABASE           │      │ STRIPE            │
                  │ Postgres + RLS     │      │ Checkout ·        │
                  │ Auth · Storage     │      │ Subscriptions ·   │
                  │ Realtime           │      │ Webhooks          │
                  └────────────────────┘      └───────────────────┘
```

### 2.1 Componentes

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Storefront | Next.js 15 + React + TypeScript + Tailwind + Framer Motion | Site institucional + loja, renderizado por tenant (domínio → tenant), SSR/ISR para SEO e performance |
| Admin | Next.js (mesmo monorepo, app separado) | Backoffice: CMS, catálogo, pedidos, clientes, configurações |
| Banco | Supabase Postgres | Dados de todos os tenants, RLS como camada de isolamento |
| Auth | Supabase Auth | Email/senha, Google, Apple, magic link. JWT carrega claims de tenant/role |
| Mídia | Cloudflare R2 (+ Supabase Storage como alternativa inicial) | Imagens de produto/CMS, com transformação de imagem na borda |
| Lógica server | Supabase Edge Functions | Checkout session, webhook Stripe, operações privilegiadas |
| Pagamentos | Stripe | Checkout, assinaturas, cupons, reembolsos |
| Borda | Cloudflare | DNS, CDN, WAF, rate limiting, Turnstile em formulários |

### 2.2 Decisões e trade-offs registrados

- **Hospedagem do Next.js:** Cloudflare Workers (via OpenNext) — mantém tudo na Cloudflare, que você já usa. Alternativa aceitável: Vercel (DX melhor, custo maior em escala). Decisão reversível.
- **Monorepo:** pnpm workspaces + Turborepo. Apps: `storefront`, `admin`. Packages: `ui`, `db`, `core`.
- **PIX:** fora do MVP por decisão sua (Stripe-only). A camada de pagamento será abstraída (`payment_provider` em `payments`) para plugar um gateway BR depois sem refatorar pedidos. *Risco registrado: no Brasil, PIX é ~40%+ do e-commerce; espere conversão menor até resolver isso.*
- **Busca:** Postgres full-text (`tsvector`) no MVP. Typesense/Meilisearch só se o catálogo passar de ~50k produtos.
- **Filas/jobs:** `pg_cron` + tabela `jobs` no MVP. Sem Redis.

---

## 3. Multi-Tenancy

### 3.1 Modelo: shared database, shared schema, RLS

Todas as marcas no mesmo Postgres, todas as tabelas com `tenant_id uuid not null`. Isolamento garantido por Row Level Security — não por disciplina de código.

**Por quê:** é o modelo do Shopify nos primeiros anos. Custo operacional mínimo, migração única, backup único. Schema-per-tenant ou DB-per-tenant só se um dia houver um cliente enterprise exigindo isolamento físico (aí vira feature paga).

### 3.2 Resolução de tenant

```
Request → Host header (florabotanics.com.br | marca2.com | *.floraecosystem.app)
        → lookup em tenant_domains (cacheado na borda)
        → tenant_id injetado no contexto da request
        → queries sempre filtradas por RLS + tenant_id
```

### 3.3 Papéis e permissões

| Papel | Escopo | Pode |
|---|---|---|
| `platform_admin` | Plataforma | Tudo, em todos os tenants (você) |
| `tenant_owner` | Tenant | Tudo no seu tenant, incl. billing e equipe |
| `tenant_admin` | Tenant | CMS, catálogo, pedidos, clientes |
| `tenant_editor` | Tenant | Apenas CMS e blog |
| `customer` | Tenant | Própria conta, próprios pedidos |

Claims no JWT (`app_metadata`): `{ tenant_id, role }`. RLS lê via `auth.jwt()`.

### 3.4 Regra de ouro do RLS

Política padrão em TODA tabela de negócio:

```sql
-- leitura pública (ex.: produtos publicados no storefront)
create policy "public_read" on products for select
  using (tenant_id = current_tenant_id() and status = 'published');

-- escrita apenas por staff do tenant
create policy "staff_write" on products for all
  using (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid
         and (auth.jwt()->'app_metadata'->>'role') in ('tenant_owner','tenant_admin'));
```

`current_tenant_id()` é uma função `stable` que resolve o tenant do contexto (header `x-tenant-id` setado pelo middleware, validado contra `tenant_domains`). Service role (Edge Functions) bypassa RLS — por isso toda Edge Function valida tenant explicitamente.

---

## 4. Schema do Banco de Dados (núcleo MVP)

Convenções: PK `id uuid default gen_random_uuid()`, timestamps `created_at/updated_at`, soft delete via `deleted_at` onde indicado. Toda tabela de negócio tem `tenant_id uuid not null references tenants(id)` + índice composto `(tenant_id, ...)`.

### 4.1 Plataforma

```sql
tenants            -- as marcas/lojas
  id, slug, name, status (active|suspended), plan (internal|pro|enterprise),
  default_locale, default_currency, created_at

tenant_domains     -- resolução domínio → tenant
  id, tenant_id, domain (unique), is_primary, verified_at

tenant_themes      -- tokens de design por tenant
  id, tenant_id, tokens jsonb  -- {colors:{...}, fonts:{...}, radius,...}

profiles           -- espelho de auth.users com dados de app
  id (= auth.users.id), tenant_id, role, full_name, phone, avatar_url

audit_logs
  id, tenant_id, actor_id, action, entity_type, entity_id, diff jsonb, created_at
```

### 4.2 Catálogo

```sql
categories
  id, tenant_id, parent_id, slug, name, description, image_id, sort_order, status

products
  id, tenant_id, slug, name, subtitle, description_rich jsonb,
  type (simple|variable|kit|digital|subscription),
  status (draft|published|archived), brand_line, tags text[],
  seo jsonb, search tsvector (generated), deleted_at

product_variants   -- todo produto tem ≥1 variante (a "default")
  id, tenant_id, product_id, sku (unique per tenant), name,
  options jsonb,            -- {tamanho:"50ml"}
  price_cents int, compare_at_cents int, currency,
  stripe_price_id,          -- espelho no Stripe
  weight_g, is_default

product_categories (join)   product_id, category_id
product_media (join)        product_id, media_id, sort_order, role (gallery|cover)

collections        -- curadoria editorial ("Lançamentos", "Rotina Noturna")
  id, tenant_id, slug, name, description, image_id, rules jsonb, status

collection_products (join)  collection_id, product_id, sort_order

inventory
  id, tenant_id, variant_id (unique), quantity int, reserved int,
  low_stock_threshold int, track (bool)
```

### 4.3 Mídia

```sql
media
  id, tenant_id, storage_path, provider (r2|supabase), mime, width, height,
  alt, blurhash, byte_size, created_by
```

### 4.4 CMS

```sql
pages
  id, tenant_id, slug, title, type (home|landing|institutional|blog_post),
  status (draft|published), published_version_id, seo jsonb

page_versions      -- versionamento: publicar = apontar published_version_id
  id, tenant_id, page_id, version int, sections jsonb, created_by, created_at
  -- sections: [ {id, block:"hero", props:{title, image_id, cta:{...}}}, ... ]

menus
  id, tenant_id, location (header|footer_1|footer_2), items jsonb

site_settings      -- chave/valor tipado por tenant
  id, tenant_id, key (unique per tenant), value jsonb
  -- ex.: logo, redes sociais, aviso de frete, scripts de analytics
```

### 4.5 Clientes e pedidos

```sql
customers          -- separado de profiles: lead pode não ter login
  id, tenant_id, profile_id (nullable), email, full_name, phone,
  accepts_marketing bool, stripe_customer_id, tags text[]

addresses
  id, tenant_id, customer_id, label, recipient, street, number, complement,
  district, city, state, zip, country, is_default_shipping, is_default_billing

carts
  id, tenant_id, customer_id (nullable), session_id, status (open|converted|abandoned),
  currency, expires_at

cart_items
  id, cart_id, variant_id, quantity, unit_price_cents  -- preço congelado

orders
  id, tenant_id, number (sequencial por tenant), customer_id,
  status (pending|paid|processing|shipped|delivered|canceled|refunded),
  subtotal_cents, discount_cents, shipping_cents, total_cents, currency,
  shipping_address jsonb, billing_address jsonb,   -- snapshot, não FK
  coupon_id, notes, placed_at

order_items
  id, order_id, variant_id, product_snapshot jsonb,  -- nome/preço congelados
  quantity, unit_price_cents, total_cents

payments
  id, tenant_id, order_id, provider (stripe), provider_payment_id,
  status (pending|succeeded|failed|refunded), amount_cents, raw jsonb

subscriptions
  id, tenant_id, customer_id, stripe_subscription_id, status,
  variant_id, interval, current_period_end

coupons
  id, tenant_id, code (unique per tenant), type (percent|fixed|free_shipping),
  value, min_subtotal_cents, max_uses, used_count, starts_at, ends_at, status

shipments
  id, tenant_id, order_id, carrier, service, tracking_code,
  status, label_url, shipped_at, delivered_at
```

### 4.6 Leads (semente do CRM — fase 2, mas a tabela nasce no MVP)

```sql
leads
  id, tenant_id, email, name, phone, source (newsletter|checkout|landing|import),
  consent_at, converted_customer_id, tags text[]
```

O formulário "Receba acesso antecipado" do site atual grava aqui desde o dia 1. Quando o CRM chegar (fase 2), os dados já existem.

### 4.7 Jobs

```sql
jobs
  id, tenant_id, type, payload jsonb, status (queued|running|done|failed),
  run_at, attempts, last_error
-- processado por pg_cron + Edge Function worker a cada minuto
```

### 4.8 Diagrama de relacionamento (essencial)

```
tenants ─┬─ tenant_domains
         ├─ tenant_themes
         ├─ profiles ──── customers ─┬─ addresses
         │                           ├─ carts ── cart_items ── product_variants
         │                           ├─ orders ─┬─ order_items
         │                           │          ├─ payments
         │                           │          └─ shipments
         │                           └─ subscriptions
         ├─ products ─┬─ product_variants ── inventory
         │            ├─ product_categories ── categories
         │            └─ product_media ── media
         ├─ collections ── collection_products
         ├─ pages ── page_versions
         ├─ menus / site_settings
         ├─ coupons / leads / jobs / audit_logs
```

---

## 5. CMS por Blocos

### 5.1 Conceito

Uma página = lista ordenada de **seções**. Cada seção é uma instância de um **bloco** do registro de blocos, com props validadas por schema (Zod). O storefront tem um componente React por bloco; o admin gera o formulário de edição a partir do mesmo schema.

```
Registro de blocos (MVP — espelha o site atual):
  hero            {title, subtitle, image_id, overlay, cta:{label, href}}
  category_grid   {heading, items:[{category_id | custom}]}
  ingredient_grid {heading, text, cta, items:[{media_id, title, text}]}
  manifesto       {eyebrow, title, text, image_id, cta}
  benefits        {items:[{icon, title, text}]}
  newsletter      {title, text, perks:[string]}
  product_carousel{heading, source: collection_id | manual[]}
  rich_text       {content}
  banner          {media_id, href, full_width}
  faq             {items:[{q, a}]}
```

### 5.2 Fluxo de edição

```
Admin abre página → carrega versão draft (ou clona a publicada)
  → edita seções via formulários estruturados (adicionar/remover/reordenar/duplicar)
  → preview ao vivo: iframe do storefront em ?preview=<version_id> (token assinado)
  → "Publicar" → pages.published_version_id = versão → revalidação ISR do path
  → rollback = apontar para versão anterior (1 clique)
```

### 5.3 Por que sem drag-and-drop livre no MVP

Page-builders livres (estilo Webflow) custam meses e produzem páginas inconsistentes com a marca. Blocos estruturados garantem que **qualquer coisa que o admin publique já nasce com a estética Chanel/Aesop** definida no design system. Drag-and-drop de *reordenação* de seções: sim (trivial). Posicionamento livre de elementos: não.

### 5.4 O que o admin edita sem programar (checklist MVP)

Banner/hero da home (imagem, texto, CTA) · todas as seções da home · landing pages novas a partir de blocos · produtos, preços, fotos, estoque · categorias e coleções · menus · textos institucionais · cupons · SEO por página · blog (rich_text + capa).

---

## 6. E-commerce — Fluxos Críticos

### 6.1 Checkout (Stripe Checkout hospedado — MVP)

```
Carrinho → Edge Function create-checkout-session
  valida estoque + preços no servidor (nunca confia no client)
  cria/recupera stripe_customer
  cria Checkout Session (line_items dos stripe_price_id, cupom, metadata: tenant_id, cart_id)
→ redirect para Stripe → pagamento
→ Webhook checkout.session.completed (Edge Function stripe-webhook):
  verifica assinatura do evento → idempotência (provider_payment_id unique)
  → cria order (status paid) + order_items (snapshot) + payment
  → decrementa inventory (reserved → committed)
  → marca cart converted
  → job: e-mail de confirmação
→ Página /pedido/confirmado?session_id=...
```

Stripe Checkout hospedado no MVP (PCI, parcelamento, wallets resolvidos). Checkout embedded customizado: fase 2, se a conversão justificar.

### 6.2 Assinaturas

Produto `type=subscription` → Stripe Price recorrente → Stripe Billing gerencia ciclo. Webhooks `invoice.paid` geram um pedido por ciclo (entrega física do kit). Portal do cliente Stripe para cancelamento/troca de cartão no MVP (zero código).

### 6.3 Carrinho abandonado (preparação, não automação)

`carts.status=abandoned` setado por job após 3h sem atividade. No MVP isso só alimenta dados (relatório + lead). A automação de recuperação (e-mail/WhatsApp) é fase 2/3 — mas chegará com histórico acumulado desde o dia 1.

### 6.4 Pedido — máquina de estados

```
pending → paid → processing → shipped → delivered
   └→ canceled        paid → refunded (total/parcial)
```

Transições só via Edge Functions/admin com permissão; cada transição grava `audit_logs`.

---

## 7. Front-end e Design System

### 7.1 Monorepo

```
flora-ecosystem/
├── apps/
│   ├── storefront/          # Next.js — site + loja (multi-tenant por domínio)
│   │   ├── app/
│   │   │   ├── (site)/                # home, páginas CMS, blog
│   │   │   ├── (shop)/produtos/...    # PLP, PDP, carrinho, conta
│   │   │   └── api/
│   │   ├── blocks/                    # 1 componente por bloco do CMS
│   │   └── middleware.ts              # host → tenant
│   └── admin/               # Next.js — backoffice
│       └── app/
│           ├── (auth)/login
│           ├── cms/          # páginas, menus, mídia
│           ├── catalogo/     # produtos, categorias, coleções, estoque
│           ├── vendas/       # pedidos, clientes, cupons, assinaturas
│           ├── config/       # tema, domínios, equipe, integrações
│           └── dashboard/    # KPIs
├── packages/
│   ├── ui/                  # design system (tokens, componentes, tailwind preset)
│   ├── db/                  # tipos gerados do Supabase, client, queries
│   ├── core/                # schemas Zod dos blocos, regras de negócio puras
│   └── config/              # eslint, tsconfig compartilhados
└── supabase/
    ├── migrations/          # SQL versionado
    └── functions/           # edge functions
```

### 7.2 Design system (`packages/ui`)

Base: **shadcn/ui + Tailwind**, re-tematizado com os tokens da Seção 1.4 via CSS variables — o que torna o tema **trocável por tenant em runtime**. Componentes: Button, Input, Select, Card, Table, Modal, Drawer, Toast, Tabs, Badge, EmptyState, Skeleton, Chart (Recharts), MediaPicker, RichTextEditor (Tiptap), SectionEditor. Animações Framer Motion com presets discretos (fade-up, parallax sutil) — luxo é contenção.

### 7.3 Performance (não negociável para "premium")

ISR para páginas CMS e PDPs (revalidação on-publish) · imagens AVIF/WebP via Cloudflare com `blurhash` placeholder · LCP < 2.0s, CLS < 0.1 · fonts self-hosted com `font-display: swap` · zero JS de terceiros no storefront além de analytics leve.

---

## 8. Edge Functions (inventário MVP)

| Função | Trigger | Faz |
|---|---|---|
| `create-checkout-session` | POST do storefront | Valida carrinho, cria sessão Stripe |
| `stripe-webhook` | Stripe | Pedidos, pagamentos, assinaturas (idempotente) |
| `subscribe-lead` | POST formulário (com Turnstile) | Grava em `leads`, double opt-in |
| `media-upload-url` | Admin | URL assinada para upload direto ao R2 |
| `publish-page` | Admin | Publica versão + revalida ISR |
| `jobs-worker` | pg_cron (1 min) | Processa fila `jobs` |
| `order-transition` | Admin | Transições de status com validação + audit |

---

## 9. Segurança

1. **RLS em 100% das tabelas** — testes automatizados de isolamento entre tenants (tentar ler dados do tenant B autenticado no tenant A precisa falhar no CI).
2. **Service role nunca no client.** Edge Functions validam tenant + role explicitamente.
3. **Turnstile** em newsletter, login e checkout (anti-bot).
4. **Rate limiting** na Cloudflare: auth (5/min), checkout (10/min), APIs públicas (100/min).
5. **WAF** com managed rules; bloqueio geográfico se fizer sentido.
6. **Webhooks Stripe:** verificação de assinatura + idempotência por event id.
7. **Secrets** só em env de Edge Functions/CI; nunca em `NEXT_PUBLIC_*`.
8. **LGPD:** consentimento registrado (`consent_at`), export/delete de dados do cliente por solicitação, política de privacidade versionada no CMS.
9. **Backups:** PITR do Supabase habilitado; teste de restore trimestral.
10. **`get_advisors` do Supabase** rodado a cada migração (security + performance).

---

## 10. Roadmap

### Fase 0 — Fundação (1–2 semanas de trabalho com IA)

Monorepo + CI · projeto Supabase + migrações do schema da Seção 4 · RLS + testes de isolamento · Auth com claims de tenant · seed da Flora Botanics como tenant 1 · deploy básico na Cloudflare · **← É AQUI que conectamos Supabase e Cloudflare ao Cowork.**

### Fase 1 — MVP: CMS + E-commerce (o que você escolheu)

**Entregável: Flora Botanics vendendo de verdade, com tudo editável pelo admin.**

- CMS: blocos da Seção 5.1, versionamento, preview, publicação
- Catálogo completo + estoque + busca
- Carrinho + Stripe Checkout + assinaturas básicas + cupons
- Área do cliente (pedidos, endereços, assinatura via portal Stripe)
- Admin: dashboard (receita, pedidos, ticket médio, conversão), gestão de pedidos com máquina de estados, gestão de equipe
- Leads (newsletter → tabela `leads`)
- E-mails transacionais (confirmação, envio) via Resend

**Critérios de aceite do MVP:**
1. Admin troca o banner da home e a mudança vai ao ar em <60s sem deploy.
2. Compra completa (PDP → Stripe → pedido `paid` → e-mail) sem intervenção manual.
3. Teste de isolamento multi-tenant passa no CI (tenant fake B não vê nada da Flora).
4. Lighthouse mobile da home ≥ 90 performance.
5. Pedido cancelado/reembolsado reflete estoque e audit log.

### Fase 2 — CRM + Conversão

Clientes/leads unificados, tags, segmentos · campanhas de e-mail (Resend Broadcasts antes de construir motor próprio) · relatório de carrinho abandonado + recuperação por e-mail · reviews de produto · checkout embedded se a conversão pedir · gateway PIX (decisão adiada da Seção 2.2).

### Fase 3 — Automações + WhatsApp

WhatsApp Business API (Meta) — disparos transacionais e recuperação de carrinho · motor de automação **declarativo** (gatilho → condições → ações, em JSON, sem editor visual ainda) · editor visual de fluxos só depois que ≥5 automações reais estiverem rodando.

### Fase 4 — Marketplace + Multi-loja

Segundo tenant real (Flora Men / marca parceira) — o teste de fogo do multi-tenant · vendedores externos: dashboard, Stripe Connect (split), repasses · módulo logístico avançado (transportadoras, etiquetas).

### Fase 5 — Plataforma White Label

Onboarding self-service de tenants · billing da plataforma (cobrar os tenants) · domínios custom automatizados · catálogo de blocos extensível · API pública + webhooks para terceiros · Central de IA (geração de descrições, SEO, campanhas) — a essa altura, com dados reais para alimentá-la.

> **Regra de avanço de fase:** só se inicia a fase N+1 quando a fase N está em produção com uso real. Wishlist não puxa roadmap; dado puxa.

---

## 11. Escalabilidade

| Estágio | Usuários | O que muda |
|---|---|---|
| MVP | até ~50k/mês | Nada — stack atual aguenta com folga |
| Crescimento | ~500k/mês | Read replicas Supabase, cache de catálogo na borda (Cloudflare KV), Typesense para busca |
| Escala | milhões/mês | Particionamento de `orders`/`audit_logs` por tenant+data, fila dedicada (Cloudflare Queues), observabilidade (Sentry + Axiom), possivelmente DB dedicado para tenants enterprise |

O desenho de RLS + `tenant_id` em tudo é o que permite essa progressão sem reescrita.

---

## 12. Riscos Principais

| Risco | Mitigação |
|---|---|
| Escopo inflar de novo (a wishlist é sedutora) | Este documento. Regra de avanço de fase. MVP fechado na Seção 10 |
| Stripe-only sem PIX reduz conversão BR | Camada de pagamento abstraída; gateway PIX na fase 2 |
| RLS mal configurado vaza dados entre tenants | Testes de isolamento obrigatórios no CI desde a fase 0 |
| WhatsApp API: custo/aprovação Meta | Fase 3; iniciar processo de verificação do business cedo |
| Conteúdo "premium" depende de fotografia real | Orçar produção de imagens; CMS pronto não salva foto ruim |
| Dependência de uma pessoa (você) | Documentação como esta + audit logs + IaC desde o início |

---

## 13. Próximos Passos Imediatos

1. **Você valida este blueprint** (especialmente: blocos do CMS na 5.1, schema na Seção 4, critérios de aceite na 10).
2. **Conectar Supabase ao Cowork** → eu crio o projeto, rodo as migrações e os testes de RLS (Fase 0). *Aviso combinado: este é o momento.*
3. **Conectar Cloudflare** → DNS, R2 e deploy.
4. Criar conta Stripe (modo teste) — chaves entram como secrets nas Edge Functions.
5. Eu gero o monorepo (Fase 0) e portamos o `index.html` atual para os blocos do CMS — a home da Flora vira o primeiro conteúdo real do sistema.

---

## 14. Addendum — Painel Admin/CRM + ERP próprio (registrado em 2026-06-14)

Decisão do tenant 1 (Flora Botanics): antecipar parte das Fases 2-4 para construir, dentro do próprio CMS/admin, um conjunto de funções equivalentes ao Bling (NF-e, etiquetas, estoque, marketplaces) — eliminando a dependência de ferramentas externas de ERP. Isso amplia o escopo da Seção 1.2 (que excluía NF-e/ERP/WhatsApp/marketplace do MVP) e antecipa trechos das Fases 2-4 da Seção 10.

**Reconciliação com a "regra de avanço de fase" (Seção 10):** a regra continua válida para o *catálogo/loja* (Fase 1 — ainda vazio, sem uso real). O painel admin/CRM, porém, não depende de catálogo populado: ele opera sobre clientes, pedidos, logs e conexões — pode ser construído em paralelo sem violar o espírito da regra (não estamos abandonando a Fase 1, estamos abrindo uma segunda frente de fundação de dados). Catálogo/loja real continua sendo pré-requisito para Fases 4-5 (marketplaces com vendas reais, white label).

**Sequenciamento aprovado:**
1. **Painel Admin/CRM** (prioridade 1) — clientes (aniversário, WhatsApp, tags, histórico de pedidos/cancelamentos/upsell), dashboard de vendas, logs de erro, conexões de canais.
2. **Schema de fundação** (migration 0016) para CRM + logs + NF-e + marketplaces + automações (sem UI ainda).
3. NF-e, marketplaces (Shopee → Instagram/WhatsApp → Mercado Livre) e automações de mensagens entram em UI conforme demanda, reaproveitando a fundação omnichannel já criada na migration 0009 (`channel_accounts`, `conversations`, `messages`, `stock_movements`).

**NF-e — decisão: sistema próprio, sem Bling e sem serviço externo de emissão.** Registrado conforme solicitado: emissão e gestão de NF-e construídas internamente (tabelas `fiscal_configs` e `nfe_documents`, Seção 14.1). Ressalva técnica que não muda a decisão, apenas o que ela implica: a emissão *válida* perante a SEFAZ exige (a) certificado digital A1/A3 do CNPJ do tenant e (b) comunicação com os webservices da SEFAZ por UF (XML assinado, protocolo de autorização). Essas duas exigências existem independente de usar Bling/PlugNotas ou um sistema próprio — não são "funcionalidades do Bling", são regras da SEFAZ. O sistema próprio vai modelar o documento fiscal, número/série, status e vínculo com o pedido desde já (migration 0016); a integração com o webservice da SEFAZ (envio/assinatura/contingência) entra como módulo separado quando o certificado digital do CNPJ estiver disponível.

**Marketplaces priorizados:** Shopee, Instagram/WhatsApp (vendas por mensagem), Mercado Livre — nessa ordem. Modelagem via `marketplace_listings` (Seção 14.1), ligando `product_variants` a SKUs externos, usando os `channel_accounts` já existentes (que já cobrem `shopee`, `instagram`, `whatsapp`, `mercado_livre`).

**Automações de mensagens** (email, WhatsApp, Instagram, redes sociais): tabelas `automations` + `automation_runs` + `message_templates` (Seção 14.1), motor declarativo (gatilho → condição → ação em JSON), conforme já previsto para a Fase 3 — antecipado aqui apenas no nível de schema.

### 14.1 Novas tabelas (migration 0016)

Todas com `tenant_id uuid not null references tenants(id)`, RLS via `is_tenant_admin`/`is_tenant_staff`, e trigger `set_updated_at` onde houver `updated_at` — seguindo o padrão das migrations 0001/0009.

- **`customers`** (alteração): + `birthday date`, `whatsapp text`, `notes text`.
- **`system_logs`**: `level` (info/warning/error/critical), `source`, `message`, `context jsonb`, `resolved boolean`, `created_at` — alimentado pelas Edge Functions e RPCs existentes.
- **`fiscal_configs`**: 1 por tenant — CNPJ, razão social, IE/IM, regime tributário, endereço, ambiente (homologação/produção), série e próximo número de NF-e, metadados do certificado (validade/nome — nunca o certificado em si).
- **`nfe_documents`**: vínculo com `orders`, número/série, status (rascunho/enviando/autorizada/rejeitada/cancelada/inutilizada), chave de acesso, protocolo, XML/DANFE (URLs), totais.
- **`marketplace_listings`**: vínculo `product_variants` ↔ `channel_accounts`, SKU/ID externo, preço por canal, status de sincronização, último erro.
- **`message_templates`**: nome, canal (email/whatsapp/instagram/sms), assunto/corpo, variáveis.
- **`automations`**: nome, gatilho (aniversário, carrinho abandonado, pedido pago, manual...), condições/ações em jsonb, status.
- **`automation_runs`**: log de disparos por automação/cliente — status, canal, erro, timestamps (alimenta `system_logs` em caso de falha).

---

*Documento gerado para servir de contrato de escopo entre as fases. Alterações de arquitetura devem ser registradas aqui antes de virar código.*
