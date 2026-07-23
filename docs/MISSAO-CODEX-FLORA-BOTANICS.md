# Missao Codex - Flora Botanics

Data da auditoria inicial: 2026-07-22

Este documento transforma o PDF `Missao Codex - Flora Botanics.pdf` em um plano tecnico executavel dentro do repositorio atual. Ele nao substitui o `BLUEPRINT-FLORA-ECOSYSTEM.md`; ele atualiza a prioridade pratica da Flora Botanics como tenant 1 e organiza o que deve ser implementado por fases.

## 1. Pedido central do PDF

Transformar a Flora Botanics em um e-commerce premium, sofisticado, confiavel, escalavel e visualmente comparavel a grandes marcas internacionais de cosmeticos e skincare, sem criar uma aplicacao paralela e sem quebrar o que ja funciona.

Diretrizes obrigatorias:

- analisar o repositorio antes de alterar arquivos;
- preservar rotas, autenticacao, pedidos, pagamentos e dados existentes;
- nao deixar dados mockados onde deve haver integracao real;
- criar migracoes seguras;
- trabalhar por fases;
- registrar alteracoes, riscos e pendencias;
- manter identidade premium botanica, cientifica e brasileira;
- nao expor secrets no repositorio;
- nao confiar em preco enviado pelo navegador.

## 2. Estado atual encontrado no repositorio

Arquitetura local confirmada:

- monorepo `flora-ecosystem` com pnpm workspaces;
- `apps/admin`: painel administrativo, CMS, catalogo, vendas, inbox, canais, backoffice;
- `apps/storefront`: site publico multi-tenant por dominio;
- `packages/db`: helpers de Supabase, tenant, paginas publicadas, menus e settings;
- `packages/core`: schemas Zod de blocos do CMS;
- `supabase/migrations`: migrations 0001 ate 0020;
- `supabase/functions/cart-recovery`: Edge Function de recuperacao de carrinho.

Rotas principais ja existentes:

- Admin: `/cms`, `/catalogo`, `/vendas`, `/vendas/carrinhos`, `/inbox`, `/canais`, `/backoffice`, `/config`, `/plataforma`, `/login`.
- Storefront: `/`, `/preview`, `/produtos`, `/produtos/[slug]`, `/categorias/[slug]`, `/p/[slug]`, `/conta`, `/[...slug]`, `/api/cart`.

Banco modelado nas migrations:

- plataforma multi-tenant: `tenants`, `tenant_domains`, `tenant_themes`, `profiles`, `audit_logs`;
- catalogo: `media`, `categories`, `products`, `product_variants`, `product_categories`, `product_media`, `collections`, `inventory`;
- CMS: `pages`, `page_versions`, `menus`, `site_settings`;
- comercio: `customers`, `addresses`, `carts`, `cart_items`, `coupons`, `orders`, `order_items`, `payments`, `subscriptions`, `shipments`, `leads`, `jobs`;
- omnichannel/backoffice: `channel_accounts`, `conversations`, `messages`, `stock_movements`, `system_logs`, `fiscal_configs`, `nfe_documents`, `marketplace_listings`, `message_templates`, `automations`, `automation_runs`.

## 3. O que ja atende parcialmente ao PDF

- CMS por blocos com paginas versionadas.
- Storefront renderizando paginas publicadas por tenant.
- Preview lateral no editor via iframe `/preview`.
- Editor de texto rico inicial com H2, H3, negrito, italico, underline, listas, link, alinhamento e HTML.
- Controle de tipografia por secao: fonte de titulo, fonte de texto, alinhamento, largura, tamanho e entrelinha.
- Controle de enquadramento da imagem do manifesto: modo, altura, posicao horizontal e vertical.
- Favicon global via `site_settings`.
- Biblioteca de midia basica.
- Rotas publicas dinamicas para slugs do CMS.
- Carrinhos abandonados com migration e Edge Function.
- Inbox com conversas e mensagens.
- Resend parcialmente integrado para envio real de e-mail.
- Backoffice com notas fiscais em rascunho, marketplaces, mensagens, logs e configuracao fiscal.

## 4. Lacunas principais contra o PDF

### Produto, kits e catalogo

- Kits ainda nao aparecem como modulo dedicado completo.
- Falta construtor visual de kits.
- Falta calculo real de estoque de kits por componentes.
- Falta modelagem operacional de embalagens premium, transporte e presente.
- Falta filtro avancado de produtos com URL persistente, drawer mobile, ordenacao e estado vazio inteligente.
- Falta busca completa com autocomplete e busca por beneficio, ingrediente, rotina, categoria e conteudo.

### Storefront premium

- A direcao visual ainda precisa ser consolidada em design system unico.
- Cards de produto ainda sao simples frente ao PDF.
- Pagina de produto ainda nao cobre galeria, zoom, video, beneficios, rotina, frete, FAQ, reviews e barra mobile.
- Pagina de kit ainda nao existe com profundidade propria.
- Home ainda precisa evoluir para narrativa premium completa: hero, rotinas, produtos, kits, ciencia, ingredientes, beneficios, avaliacoes, editorial, sustentabilidade e newsletter.

### Carrinho e checkout

- Carrinho precisa ser redesenhado com sugestoes, barra de frete gratis, cupons, estimativa de frete e persistencia robusta.
- Checkout precisa confirmar fluxo completo com identificacao, endereco, entrega, pagamento, revisao e confirmacao.
- Falta PIX e carteiras digitais quando o provedor estiver definido.
- Falta endurecer regra de preco sempre no servidor.

### Cliente e conta

- Area `/conta` existe, mas precisa ficar visualmente premium e sem textos desnecessarios.
- Falta area completa do cliente: perfil, pedidos, rastreamento, enderecos, pagamentos, assinaturas, favoritos, avaliacoes, cupons, preferencias e privacidade.
- Falta politica clara de seguranca entre conta publica e super admin.

### CMS

- Editor visual melhorou, mas ainda nao e equivalente a Wix.
- Precisa autosave seguro, historico de alteracoes, duplicacao de secoes, revisao, agendamento e rollback com UI.
- Precisa mais blocos editoriais: artigos, guias, ingredientes, rotinas, FAQ, banners, campanhas e blocos de produto relacionados.
- Preview em rascunho deve refletir todas as mudancas imediatamente, sem depender de publicar.

### Operacao/ERP

- Estoque ainda e basico.
- Modulo financeiro/custos ainda nao esta completo.
- Notas fiscais existem como base, mas emissao SEFAZ real depende de certificado e modulo fiscal proprio.
- Logistica ainda nao tem camada por provedores.
- Marketplaces ainda estao como estrutura inicial, sem conectores reais.

### Marketing e automacoes

- Templates de e-mail prontos ainda precisam virar biblioteca dentro da plataforma.
- Automacoes existem no schema, mas ainda precisam de motor e UI operacional.
- Carrinho abandonado envia/agenda, mas precisa painel de confiabilidade, logs, opt-out e templates editaveis.

### SEO, performance, acessibilidade e testes

- Precisa sitemap, robots, canonical, Open Graph, dados estruturados, Product Schema, FAQ Schema e Article Schema.
- Precisa medir Core Web Vitals depois das mudancas visuais.
- Precisa testes de RLS, carrinho, checkout, kits, estoque, permissoes, busca e filtros.
- Precisa estados padronizados de loading, vazio, erro, sessao expirada e integracao indisponivel.

## 5. Reconciliação com o blueprint antigo

O blueprint antigo defendia CMS por blocos estruturados e evitava um editor livre estilo Webflow/Wix no MVP. O PDF agora pede um editor muito mais poderoso.

Decisao tecnica recomendada:

- manter blocos estruturados como fonte de verdade;
- evoluir o editor para ter controles ricos por bloco, nao uma tela livre sem limites;
- adicionar controles de tipografia, espacamento, imagem, alinhamento, CTA, layout e responsividade dentro de cada bloco;
- evitar posicionamento absolutamente livre, porque isso pode destruir consistencia visual e responsividade;
- criar presets premium da Flora para que qualquer pagina publicada continue parecendo marca madura.

Assim atendemos a ambicao do PDF sem transformar o CMS em um construtor fragil e inconsistente.

## 6. Dez frentes de implementacao apos esta auditoria

1. Design system premium publico: tokens, tipografia, botoes, grids, footer, headers, estados e responsividade.
2. CMS editorial avancado: preview real, blocos premium, rich text robusto, autosave e controle visual por secao.
3. Catalogo e produtos: cards, filtros, busca, PDP, galeria, hover image, SEO de produto.
4. Kits e assinaturas: schema operacional, construtor, estoque por componentes e paginas dedicadas.
5. Carrinho e checkout: carrinho premium, recuperacao, cupons, frete, Stripe e validacao server-side.
6. Conta do cliente: login/criacao premium, Google, pedidos, enderecos, favoritos e seguranca.
7. Backoffice operacional: pedidos, clientes, estoque, notas fiscais, logs, permissoes e auditoria.
8. Marketing e omnichannel: inbox, canais, Resend, templates, automacoes e carrinho abandonado.
9. Logistica e financeiro: provedores de frete, etiquetas, rastreio, custos, margem e relatorios.
10. SEO, analytics, performance e testes: schemas, sitemap, Core Web Vitals, acessibilidade, RLS e CI.

## 7. Primeira fase executavel

Antes de mexer em telas grandes, a primeira fase deve fechar estes itens:

1. Garantir que preview do CMS renderize rascunho em tempo real para todos os blocos.
2. Corrigir os caminhos de visualizacao do CMS para `https://florabotanics.com.br/`.
3. Corrigir storefront publico: footer baixo, botoes visiveis, rotas do footer e pagina de catalogo compacta.
4. Consolidar favicon e biblioteca de midia sem sobreposicao de modais.
5. Criar um design system publico minimo e consistente para a Flora.
6. Rodar typecheck/build dos apps antes de commit.

## 8. Criterio para cada entrega

Toda entrega deve informar:

- arquivos criados;
- arquivos modificados;
- migrations, se houver;
- variaveis de ambiente, se houver;
- comandos necessarios;
- testes executados;
- riscos e pendencias;
- commit criado.

## 9. Observacoes de seguranca

- Secrets de Resend, Stripe, Supabase e Cloudflare nunca entram em arquivo versionado.
- Recuperacao de senha do super admin deve depender do Supabase Auth e enviar apenas para o e-mail real cadastrado.
- Usuario publico e staff/admin devem ter fluxos separados.
- A area `/admin` no dominio publico deve encaminhar ao admin sem expor `workers.dev` para o usuario final.
- RLS deve ser validado sempre que uma tabela nova for criada.
