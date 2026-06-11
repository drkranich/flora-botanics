# Flora Ecosystem

Plataforma multi-tenant para marcas premium. **Flora Botanics** é o tenant nº 1.
Arquitetura completa em [`BLUEPRINT-FLORA-ECOSYSTEM.md`](./BLUEPRINT-FLORA-ECOSYSTEM.md).

## Estrutura

```
apps/storefront    Site + loja (Next.js, multi-tenant, renderiza páginas do CMS)
apps/admin         Backoffice (placeholder — Fase 1)
packages/core      Schemas Zod dos blocos do CMS e regras de negócio
packages/db        Cliente Supabase tipado
supabase/migrations  SQL versionado (já aplicado no projeto mbpvzhcrimdwcqkqvoqr)
index.html         Site estático original (legado — será aposentado pelo storefront)
```

## Rodar localmente

Pré-requisitos: Node 20+, pnpm (`npm i -g pnpm`).

```bash
pnpm install
# crie apps/storefront/.env.local a partir de .env.example
pnpm dev
```

Storefront: http://localhost:3000 — a home vem do CMS no Supabase.

## Banco de dados

As migrações em `supabase/migrations/` já foram aplicadas via MCP.
Para alterações futuras: criar novo arquivo SQL aqui E aplicar via Cowork/CLI —
o repositório é a fonte da verdade.

## Deploy

Cloudflare Workers (OpenNext) — configuração na Fase 1.
Secrets já criados no GitHub Actions e no Cloudflare.

## Fluxo de trabalho (GitHub Desktop)

1. Cowork gera/edita arquivos nesta pasta.
2. GitHub Desktop mostra as mudanças → revisar → Commit to main → Push origin.
3. Nunca commitar `.env.local` (já está no .gitignore).
