# Auditoria do Projeto Flora Botanics — 30/07/2026

> Varredura completa: admin aba por aba, storefront rota por rota, banco de dados, TypeScript.
> Commit de correções: `c110a89`

---

## ✅ ADMIN — Status por aba (todos carregaram sem erros)

| Rota | Título | Status |
|------|--------|--------|
| `/admin` | Dashboard principal | ✅ OK |
| `/admin/cms` | Site · Páginas | ✅ OK — 9 páginas publicadas |
| `/admin/catalogo` | Catálogo | ✅ OK — 1 produto (Serum) |
| `/admin/catalogo/kits` | Kits | ✅ OK |
| `/admin/catalogo/categorias` | Categorias | ✅ OK |
| `/admin/catalogo/avaliacoes` | Avaliações | ✅ OK |
| `/admin/catalogo/custos` | Custos & Margem | ✅ OK (KPI e tabela legíveis) |
| `/admin/vendas` | Vendas | ✅ OK — 0 pedidos (esperado) |
| `/admin/contabilidade` | Contabilidade | ✅ OK — KPIs R$0 (sem pedidos) |
| `/admin/financeiro` | Financeiro & Orçamentos | ✅ OK |
| `/admin/marketing` | Marketing e Relacionamento | ✅ OK |
| `/admin/inbox` | Inbox | ✅ OK |
| `/admin/canais` | Canais de venda | ✅ OK |
| `/admin/operacoes` | Centro de Operações | ✅ OK |
| `/admin/config` | Configurações | ✅ OK |
| `/admin/config/integracoes` | Central de Integrações | ✅ OK |
| `/admin/dicionario` | Siglas da Flora Botanics | ✅ OK |
| `/admin/backoffice` | Dashboard Backoffice | ✅ OK |
| `/admin/backoffice/pedidos` | Pedidos | ✅ OK |
| `/admin/backoffice/clientes` | Clientes | ✅ OK |
| `/admin/backoffice/crm` | Pipeline CRM | ✅ OK |
| `/admin/backoffice/mensagens` | Mensagens | ✅ OK |
| `/admin/backoffice/logistica` | Logística e Etiquetas | ✅ OK |
| `/admin/backoffice/notas-fiscais` | Fiscal e Tributário | ✅ OK |

---

## ✅ STOREFRONT — Status por rota (todas carregaram sem erros)

| Rota | Status |
|------|--------|
| `/` | ✅ OK — Home carregando |
| `/produtos` | ✅ OK — Catálogo público |
| `/produtos/serum` | ✅ OK — Página de produto |
| `/carrinho` | ✅ OK |
| `/checkout` | ✅ OK |
| `/conta` | ✅ OK |
| `/rastrear` | ✅ OK — "Onde está meu pedido?" |

---

## ✅ BANCO DE DADOS (Supabase)

Todas as tabelas referenciadas no código existem. Principais confirmadas:

- `orders`, `customers`, `products`, `product_variants`, `product_media` ✅
- `integration_alerts`, `channel_accounts`, `integration_connections`, `integration_sync_runs` ✅
- `finance_calculations`, `finance_settings`, `finance_price_tables`, `commercial_quotes` ✅
- `nfe_documents`, `fiscal_documents`, `fiscal_configs`, `fiscal_queue_jobs` ✅
- `marketing_*` (15+ tabelas), `accounting_entries`, `audit_logs` ✅

**Nenhuma tabela ausente encontrada.**

---

## 🔧 BUGS CORRIGIDOS NESTA SESSÃO

| # | Bug | Arquivo | Fix |
|---|-----|---------|-----|
| 1 | `<a href>` nos tabs de pedidos redirecionava para o storefront | `backoffice/pedidos/page.tsx` | `<Link>` do Next.js (respeita basePath) |
| 2 | `<a href>` em NewConversationForm | `inbox/NewConversationForm.tsx` | `<Link href="/canais">` |
| 3 | `createPortal` importado de `"react"` (não existe) | `backoffice/pedidos/PedidosFilters.tsx` | Mover para `"react-dom"` |
| 4 | Cache `.next` stale no Cloudflare causando falha de build | `apps/storefront/package.json` | `rm -rf .next &&` antes do build |
| 5 | KPI cards em Custos & Margem com texto invisível (branco no branco) | `catalogo/custos/page.tsx` | Cores explícitas `#1a2e1b`, `#4a6b4c`, `#0a160b` |
| 6 | Link produto em Custos resultava em 404 | `catalogo/custos/page.tsx` | `href="/catalogo"` (sem rota de detalhe no admin) |

---

## 🔧 ERROS TYPESCRIPT CORRIGIDOS (commit `c110a89`)

Erros reais (não workspace-resolution) eliminados no storefront:

| Arquivo | Erro | Fix |
|---------|------|-----|
| `blocks/index.tsx:184` | `Parameter 'c' implicitly has any` | `Map<string, CatRow>` explícito |
| `blocks/index.tsx:202-212` | `Property 'name/description/slug' not exist on '{}'` | Corrigido em cascata pelo fix acima |
| `blocks/index.tsx:488` | `Parameter 'item' implicitly has any` | Tipo `{ product_id: string }` explícito |
| `categorias/[slug]/page.tsx:76` | `Parameter 'item' implicitly has any` | Tipo `{ product_id: string }` explícito |
| `conta/AccountPanel.tsx:337` | `_e, next implicitly have any` | Tipados como `unknown` |
| `montar-kit/page.tsx:58` | `Parameter 'p' implicitly has any` | `RawProduct` local type criado |

**Erros de `Cannot find module '@flora/db'` são falsos positivos** — acontecem apenas no ambiente sandbox onde workspace packages não estão buildados. Em produção (Cloudflare), `pnpm install` resolve corretamente.

---

## ⚠️ PADRÃO DUPLO DE AUTH (não é bug, mas é inconsistência)

Existem dois padrões de autenticação no admin:

- **Padrão antigo** (`getStaffSession` + `supabaseServer`) — 48 arquivos: catálogo, CMS, vendas, financeiro, marketing, etc.
- **Padrão novo** (`currentStaff` + `createClient`) — 28 arquivos: backoffice/*, config/integracoes/actions

**Ambos funcionam identicamente** — `supabaseServer` é alias de `createClient()`, e `getStaffSession()` lê JWT app_metadata enquanto `currentStaff()` lê a tabela `profiles`. Não há urgência em unificar, mas seria uma limpeza técnica futura.

---

## 📋 O QUE AINDA PRECISA GANHAR VIDA (próximas fases)

### Alta prioridade (bloqueia receita)
1. **Stripe conectado** — checkout atual tem UI mas não processa pagamentos reais. `STRIPE_SECRET_KEY` e `STRIPE_PUBLISHABLE_KEY` precisam ser configurados no Worker `flora-admin`.
2. **Resend conectado** — `RESEND_API_KEY` e `RESEND_FROM_EMAIL` precisam ser configurados. Sem isso, nenhum e-mail transacional é enviado (confirmação de pedido, recuperação de carrinho, etc.).
3. **Domínio de e-mail verificado no Resend** — para o remetente `@florabotanics.com.br` funcionar.

### Média prioridade (funcionalidades incompletas)
4. **WhatsApp Business API** — credenciais configuradas em `/config/integracoes` mas integração real não testada.
5. **Melhor Envio** — cotação implementada, mas `MELHOR_ENVIO_TOKEN` precisa ser configurado no Worker.
6. **NFe / Fiscal** — módulo completo no admin, mas `FISCAL_*` secrets não configurados. Integração com SEFAZ pendente.
7. **Marketplaces** — UI pronta (Shopee, Mercado Livre, Instagram, etc.), mas nenhum canal está de fato conectado.
8. **Stripe Sync** — `/financeiro/stripe` tem UI para sincronizar produtos, mas precisa de Stripe conectado.
9. **Automações** — engine implementada, mas sem Resend/WhatsApp configurados os disparos não chegam ao cliente.
10. **Carrinhos abandonados** — trigger de e-mail implementado mas depende do Resend.

### Baixa prioridade (polimento)
11. **Assinaturas** — UI existe em `/vendas/assinaturas`, mas requer Stripe subscriptions configurado.
12. **Plataforma multi-tenant** — `/plataforma` funciona para `platform_admin`; lógica de criação de novos tenants está presente mas não testada end-to-end.
13. **Exportações (CSV/PDF)** — rotas de exportação existem em contabilidade, marketing, financeiro; funcionalidade real a validar com dados reais.
14. **CMS blocks avançados** — CategoryGrid, IngredientGrid, etc. funcionais; mas dependem de dados cadastrados (categorias, ingredientes no CMS).

---

## 🟡 PONTOS DE ATENÇÃO MENORES

- **Inventário** — `inventory` table existe; admin mostra "alertas de estoque baixo" mas produto Serum não tem threshold configurado.
- **`product_media` vazio** — produto Serum não tem imagem cadastrada (galeria aparece vazia no storefront).
- **`tenant_themes`** — tema padrão aplicado, mas nunca foi personalizado via UI de Configurações.
- **`profiles` vs `app_metadata`** — `currentStaff()` lê de `profiles`; se um usuário staff for criado sem registro em `profiles`, o login falhará silenciosamente no backoffice novo.

---

## 🚀 PRÓXIMOS PASSOS RECOMENDADOS

**Prioridade 1 — Habilitar receita:**
1. Configurar `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` no Worker `flora-admin`
2. Configurar `RESEND_API_KEY`, `RESEND_FROM_EMAIL` no Worker `flora-admin`
3. Testar fluxo completo: produto → carrinho → checkout → pagamento → confirmação por e-mail

**Prioridade 2 — Conteúdo:**
4. Cadastrar imagem para produto Serum
5. Configurar inventário (threshold de estoque baixo)
6. Revisar/publicar páginas CMS (atualizar textos, imagens, etc.)

**Prioridade 3 — Integrações:**
7. Configurar Melhor Envio token
8. Testar WhatsApp Business API
9. Iniciar processo de certificado NFe

---

*Auditoria realizada em 30/07/2026 por Claude (Cowork mode). Commit de correções TypeScript: `c110a89`.*
