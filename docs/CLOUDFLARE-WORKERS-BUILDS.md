# Cloudflare Workers Builds - Flora Botanics

Use estas configuracoes no painel da Cloudflare para evitar que o build rode no
app errado dentro do monorepo.

## Worker `flora-botanics`

- Repositorio: `drkranich/flora-botanics`
- Branch de producao: `main`
- Caminho: `/`
- Comando da build: `pnpm run build:cf:storefront`
- Comando de implantacao: `pnpm run deploy:cf:storefront`
- Comando de implantacao da ramificacao de nao producao: `pnpm run deploy:cf:storefront -- --dry-run`

## Worker `flora-admin`

- Repositorio: `drkranich/flora-botanics`
- Branch de producao: `main`
- Caminho: `/`
- Comando da build: `pnpm run build:cf:admin`
- Comando de implantacao: `pnpm run deploy:cf:admin`
- Comando de implantacao da ramificacao de nao producao: `pnpm run deploy:cf:admin -- --dry-run`

## Observacoes

- Nao use `pnpm run build` como comando da Cloudflare Build dos Workers.
  Esse script roda o monorepo inteiro via Turbo e nao gera o bundle OpenNext
  do Worker especifico.
- Nao use `npx wrangler deploy` a partir da raiz. Ele pode ler o
  `wrangler.jsonc` errado.
- Secrets ficam em Cloudflare Workers > Settings > Variables and Secrets, nao
  neste arquivo.
