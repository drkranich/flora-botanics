# Configuração de Secrets — Flora Botanics Workers

> Execute os comandos abaixo com `wrangler` na pasta `apps/admin` (para flora-admin)
> ou `apps/storefront` (para flora-storefront).
> Secrets são armazenados de forma encriptada no Cloudflare — nunca aparecem em git.

---

## 1 · Resend (e-mail transacional)

```bash
# Na pasta apps/admin
cd apps/admin
pnpm wrangler secret put RESEND_API_KEY
# Cole a chave: re_xxxxx (dashboard resend.com → API Keys)

pnpm wrangler secret put RESEND_FROM_EMAIL
# Cole: floreria@florabotanics.com.br (após verificar domínio no Resend)
```

**Pré-requisito:** verificar o domínio `florabotanics.com.br` em resend.com → Domains antes de usar.

---

## 2 · Supabase Service Role (operações admin / triggers internos)

```bash
cd apps/admin
pnpm wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Cole a service_role key do Supabase Dashboard → Settings → API
```

---

## 3 · Melhor Envio (cotação e emissão de etiquetas)

```bash
# Admin (emissão de etiquetas)
cd apps/admin
pnpm wrangler secret put MELHOR_ENVIO_TOKEN
# Cole o token de produção (app.melhorenvio.com.br → Configurações → Tokens)

pnpm wrangler secret put MELHOR_ENVIO_SECRET
# Cole o client_secret do app OAuth (se usar fluxo server-side)

# Storefront (cotação de frete no checkout)
cd apps/storefront
pnpm wrangler secret put MELHOR_ENVIO_TOKEN
# Mesmo token de produção

pnpm wrangler secret put MELHOR_ENVIO_FROM_CEP
# CEP de origem: ex: 01310100

pnpm wrangler secret put MELHOR_ENVIO_FROM_NAME
# Nome do remetente: Flora Botanics

pnpm wrangler secret put MELHOR_ENVIO_SANDBOX
# Valor: false (produção)
```

---

## 4 · WhatsApp Business API

```bash
cd apps/admin
pnpm wrangler secret put WHATSAPP_API_TOKEN
# Token permanente do app Meta Business

pnpm wrangler secret put WHATSAPP_API_URL
# Ex: https://graph.facebook.com/v19.0/PHONE_NUMBER_ID/messages

pnpm wrangler secret put WHATSAPP_PROVIDER_TOKEN
# Token do provedor (se usar intermediário: Zapi, WppConnect, etc.)

pnpm wrangler secret put WHATSAPP_WEBHOOK_SECRET
# Segredo de verificação do webhook Meta
```

---

## 5 · Stripe

```bash
cd apps/admin

# Chaves de teste (usar primeiro para validar)
pnpm wrangler secret put STRIPE_TEST_SECRET_KEY
# sk_test_xxxx

pnpm wrangler secret put STRIPE_TEST_WEBHOOK_SECRET
# whsec_test_xxxx (gerado no Stripe Dashboard → Webhooks)

# Chaves de produção (após testes)
pnpm wrangler secret put STRIPE_LIVE_SECRET_KEY
# sk_live_xxxx

pnpm wrangler secret put STRIPE_LIVE_WEBHOOK_SECRET
# whsec_live_xxxx

# Variável de controle: qual ambiente usar
pnpm wrangler secret put STRIPE_CHECKOUT_ENVIRONMENT
# Valor: test  (trocar para live quando pronto)
```

**Aliases:** o código também lê `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` como fallback
(leia `apps/storefront/lib/server-runtime.ts` para ver a lógica de prioridade).

---

## 6 · NFe / Fiscal (SEFAZ)

> O certificado A1 (.pfx) **nunca deve ser commitado**. Veja `CERTIFICADO_A1.md`
> para instruções de como disponibilizá-lo em produção.

```bash
cd apps/admin

pnpm wrangler secret put SEFAZ_CERTIFICATE_PASSWORD
# Senha do certificado A1 .pfx

# O arquivo .pfx em si vai como base64:
pnpm wrangler secret put SEFAZ_CERTIFICATE_PFX
# Cole o conteúdo base64 do arquivo .pfx:
# base64 -i seu_certificado.pfx | pbcopy  (macOS)
# base64 -w 0 seu_certificado.pfx | xclip  (Linux)
```

---

## 7 · Staging (ambiente de teste)

Para configurar secrets no Worker de staging, adicione `--env staging`:

```bash
pnpm wrangler secret put RESEND_API_KEY --env staging
pnpm wrangler secret put STRIPE_TEST_SECRET_KEY --env staging
# etc.
```

---

## Verificar secrets configurados

```bash
pnpm wrangler secret list          # produção
pnpm wrangler secret list --env staging
```

---

## Ordem recomendada para ativar receita

1. `RESEND_API_KEY` + `RESEND_FROM_EMAIL` → e-mails de confirmação funcionam
2. `STRIPE_TEST_SECRET_KEY` + `STRIPE_TEST_WEBHOOK_SECRET` → testar checkout completo
3. `STRIPE_LIVE_*` → ir para produção após testes
4. `MELHOR_ENVIO_TOKEN` → cotação e emissão de etiquetas reais
5. `WHATSAPP_*` → notificações por WhatsApp
6. `SEFAZ_*` → emissão de NFe (requer Certificado A1 válido)
