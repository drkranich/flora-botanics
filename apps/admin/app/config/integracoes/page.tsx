import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { IntegrationCard, type FieldDef, type IntegrationStatus } from "./IntegrationCard";
import type { IntegrationKey } from "./actions";

interface Integration {
  key: IntegrationKey;
  providerKey: string;
  icon: string;
  title: string;
  description: string;
  docsUrl?: string;
  fields: FieldDef[];
}

interface IntegrationConnectionRow {
  provider_key: string;
  status: string;
  environment: string;
  credentials_status: string;
  auto_sync_enabled: boolean;
  last_sync_at: string | null;
  last_healthcheck_at: string | null;
  last_error: string | null;
  latency_ms: number | null;
  error_count: number | null;
}

interface IntegrationRunRow {
  provider_key: string;
  status: string;
  created_at: string;
}

const INTEGRATIONS: Integration[] = [

  // ─── COMUNICAÇÃO ─────────────────────────────────────────────────────────
  {
    key: "integration_resend",
    providerKey: "resend",
    icon: "@",
    title: "Resend",
    description: "E-mails transacionais, carrinhos abandonados, templates e automações.",
    docsUrl: "https://resend.com/docs",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "re_xxxxxxxxxxxxxxxxx",
        type: "password",
        hint: "Encontre em resend.com → API Keys. Começa com re_.",
      },
      {
        name: "from_email",
        label: "Remetente padrão",
        placeholder: "Flora Botanics <contato@florabotanics.com.br>",
        hint: "Formato: Nome <email@domínio>. Domínio deve estar verificado no Resend.",
      },
      {
        name: "webhook_secret",
        label: "Webhook Secret",
        placeholder: "whsec_xxxxxxxxx",
        type: "password",
        hint: "Gerado em Resend → Webhooks. Valida eventos recebidos.",
        required: false,
      },
    ],
  },
  {
    key: "integration_whatsapp",
    providerKey: "whatsapp",
    icon: "✆",
    title: "WhatsApp Business API",
    description: "Notificações de pedidos, recuperação de carrinho e atendimento via WhatsApp.",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    fields: [
      {
        name: "phone_number_id",
        label: "Phone Number ID",
        placeholder: "123456789012345",
        hint: "ID do número de telefone. Meta for Developers → WhatsApp → API Setup.",
      },
      {
        name: "waba_id",
        label: "WhatsApp Business Account ID (WABA)",
        placeholder: "102290129340398",
        hint: "ID da conta comercial. Diferente do Phone Number ID — encontrado em Meta Business Suite.",
      },
      {
        name: "access_token",
        label: "Access Token permanente",
        placeholder: "EAAx…",
        type: "password",
        hint: "Token de acesso permanente do App Meta Business. Meta for Developers → Ferramentas → Tokens.",
      },
      {
        name: "webhook_verify_token",
        label: "Webhook Verify Token",
        placeholder: "flora_wh_secret_2024",
        type: "password",
        hint: "Segredo que você define. Deve ser idêntico ao configurado em Meta for Developers → Webhooks.",
      },
      {
        name: "api_url",
        label: "URL base da API",
        placeholder: "https://graph.facebook.com/v19.0",
        type: "url",
        hint: "Normalmente https://graph.facebook.com/v19.0. Altere apenas se usar outra versão.",
        required: false,
      },
    ],
  },

  // ─── PAGAMENTO ───────────────────────────────────────────────────────────
  {
    key: "integration_stripe",
    providerKey: "stripe",
    icon: "₿",
    title: "Stripe",
    description: "Checkout, assinaturas, split de pagamento e webhooks.",
    docsUrl: "https://stripe.com/docs/api",
    fields: [
      {
        name: "environment",
        label: "Ambiente",
        placeholder: "test",
        hint: "Use test para homologação e live para produção.",
      },
      {
        name: "publishable_key",
        label: "Publishable Key",
        placeholder: "pk_test_xxxx ou pk_live_xxxx",
        hint: "Chave pública (segura para o frontend). Dashboard Stripe → Developers → API Keys.",
      },
      {
        name: "secret_key",
        label: "Secret Key",
        placeholder: "sk_test_xxxx ou sk_live_xxxx",
        type: "password",
        hint: "Chave secreta do Stripe. Nunca exponha no frontend.",
      },
      {
        name: "webhook_secret",
        label: "Webhook Secret",
        placeholder: "whsec_xxxx",
        type: "password",
        hint: "Gerado em Stripe → Developers → Webhooks ao cadastrar o endpoint.",
        required: false,
      },
    ],
  },

  // ─── MARKETPLACES ────────────────────────────────────────────────────────
  {
    key: "integration_mercadolivre",
    providerKey: "mercado_livre",
    icon: "◈",
    title: "Mercado Livre",
    description: "Sincronize produtos, estoque e pedidos com o Mercado Livre.",
    docsUrl: "https://developers.mercadolibre.com.br/pt_br/inicio",
    fields: [
      {
        name: "app_id",
        label: "App ID (Client ID)",
        placeholder: "1234567890",
        hint: "Encontrado em Mercado Livre Developers → Meus Apps.",
      },
      {
        name: "client_secret",
        label: "Client Secret",
        placeholder: "AbCdEf123…",
        type: "password",
        hint: "Secret gerado junto com o App ID.",
      },
      {
        name: "redirect_uri",
        label: "Redirect URI",
        placeholder: "https://florabotanics.com.br/admin/config/integracoes",
        type: "url",
        hint: "URL cadastrada no app do ML para receber o código OAuth.",
        required: false,
      },
      {
        name: "access_token",
        label: "Access Token",
        placeholder: "APP_USR-xxxx",
        type: "password",
        hint: "Obtido após o fluxo OAuth. Expira em 6 horas — o sistema usa refresh_token para renovar.",
        required: false,
      },
      {
        name: "refresh_token",
        label: "Refresh Token",
        placeholder: "TG-xxxx",
        type: "password",
        hint: "Token de longa duração para renovar o access_token automaticamente.",
        required: false,
      },
    ],
  },
  {
    key: "integration_shopee",
    providerKey: "shopee",
    icon: "❖",
    title: "Shopee",
    description: "Publicação de catálogo e importação de pedidos da Shopee.",
    docsUrl: "https://open.shopee.com/documents",
    fields: [
      {
        name: "partner_id",
        label: "Partner ID",
        placeholder: "12345",
        hint: "Seu Partner ID no Shopee Open Platform.",
      },
      {
        name: "partner_key",
        label: "Partner Key (App Secret)",
        placeholder: "abc123def456…",
        type: "password",
        hint: "Chave do parceiro gerada no painel da Shopee Open Platform.",
      },
      {
        name: "shop_id",
        label: "Shop ID",
        placeholder: "987654",
        hint: "ID da loja Shopee — obtido após o fluxo OAuth.",
        required: false,
      },
      {
        name: "access_token",
        label: "Access Token",
        placeholder: "shopee_access_token…",
        type: "password",
        hint: "Token OAuth da Shopee. Expira em 4 horas.",
        required: false,
      },
      {
        name: "refresh_token",
        label: "Refresh Token",
        placeholder: "shopee_refresh_token…",
        type: "password",
        hint: "Token para renovar o access_token. Expira em 30 dias.",
        required: false,
      },
    ],
  },
  {
    key: "integration_instagram",
    providerKey: "instagram",
    icon: "◎",
    title: "Instagram / Meta",
    description: "Vitrine no Instagram Shop e DMs integradas à Inbox.",
    docsUrl: "https://developers.facebook.com/docs/instagram-api",
    fields: [
      {
        name: "app_id",
        label: "App ID",
        placeholder: "1234567890",
        hint: "ID do App no Meta for Developers.",
      },
      {
        name: "app_secret",
        label: "App Secret",
        placeholder: "abc123…",
        type: "password",
        hint: "Secret do App Meta.",
      },
      {
        name: "page_id",
        label: "Facebook Page ID",
        placeholder: "234567890123456",
        hint: "ID da Página do Facebook vinculada à conta Instagram.",
      },
      {
        name: "instagram_account_id",
        label: "Instagram Business Account ID",
        placeholder: "17841400000000000",
        hint: "ID da conta profissional Instagram. Diferente do Page ID — obtido via GET /me/accounts na Graph API.",
      },
      {
        name: "access_token",
        label: "Long-lived Access Token",
        placeholder: "EAAx…",
        type: "password",
        hint: "Token de longa duração (60 dias). Gere via Graph API Explorer com permissões instagram_basic e pages_show_list.",
      },
    ],
  },
  {
    key: "integration_amazon",
    providerKey: "amazon",
    icon: "▣",
    title: "Amazon",
    description: "Catálogo e pedidos no maior marketplace global.",
    docsUrl: "https://developer-docs.amazon.com/sp-api",
    fields: [
      {
        name: "seller_id",
        label: "Seller ID (Merchant Token)",
        placeholder: "AXXXXXXXXXX",
        hint: "Seu Seller ID na Amazon. Encontrado em Seller Central → Configurações da conta.",
      },
      {
        name: "marketplace_id",
        label: "Marketplace ID",
        placeholder: "A2Q3Y263D00KWC",
        hint: "ID do marketplace. Brasil = A2Q3Y263D00KWC.",
      },
      {
        name: "client_id",
        label: "LWA Client ID",
        placeholder: "amzn1.application-oa2-client…",
        hint: "Client ID gerado ao criar um app na Amazon Developer Console.",
      },
      {
        name: "client_secret",
        label: "LWA Client Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "password",
        hint: "Client Secret do app LWA (Login with Amazon).",
      },
      {
        name: "refresh_token",
        label: "Refresh Token",
        placeholder: "Atzr|…",
        type: "password",
        hint: "Refresh Token obtido após autorizar o acesso SP-API em Seller Central.",
      },
    ],
  },
  {
    key: "integration_tiktok",
    providerKey: "tiktok",
    icon: "♪",
    title: "TikTok Shop",
    description: "Venda direto dos vídeos e lives do TikTok.",
    docsUrl: "https://partner.tiktokshop.com/doc/page/intro",
    fields: [
      {
        name: "app_key",
        label: "App Key",
        placeholder: "6xxxxxxxxxxxxxxxx",
        hint: "App Key do seu aplicativo TikTok Shop no TikTok Seller Center.",
      },
      {
        name: "app_secret",
        label: "App Secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "password",
        hint: "App Secret gerado junto com o App Key.",
      },
      {
        name: "access_token",
        label: "Shop Access Token",
        placeholder: "TikTokAT_…",
        type: "password",
        hint: "Access Token obtido após o OAuth do lojista. Expira em 24 horas.",
        required: false,
      },
      {
        name: "refresh_token",
        label: "Refresh Token",
        placeholder: "TikTokRT_…",
        type: "password",
        hint: "Refresh Token para renovar o access_token. Expira em 30 dias.",
        required: false,
      },
      {
        name: "shop_id",
        label: "Shop ID",
        placeholder: "123456789",
        hint: "ID da loja TikTok Shop — obtido após o fluxo OAuth.",
        required: false,
      },
    ],
  },
  {
    key: "integration_google_merchant",
    providerKey: "google_merchant",
    icon: "✦",
    title: "Google Merchant Center",
    description: "Produtos no Google Shopping e nas buscas do Google.",
    docsUrl: "https://developers.google.com/shopping-content/guides/quickstart",
    fields: [
      {
        name: "merchant_id",
        label: "Merchant Center ID",
        placeholder: "123456789",
        hint: "ID da conta no Google Merchant Center — canto superior direito.",
      },
      {
        name: "target_country",
        label: "País alvo",
        placeholder: "BR",
        hint: "Código ISO 3166-1 alpha-2 do país onde os produtos são vendidos.",
      },
      {
        name: "content_language",
        label: "Idioma",
        placeholder: "pt",
        hint: "Código ISO 639-1 do idioma dos produtos (pt para português).",
      },
      {
        name: "credentials_json",
        label: "Service Account JSON",
        placeholder: '{"type": "service_account", "project_id": "…", …}',
        type: "textarea",
        hint: "JSON completo da conta de serviço com permissão Content API for Shopping. Gere em Google Cloud Console → IAM → Service Accounts.",
      },
    ],
  },

  // ─── LOGÍSTICA ───────────────────────────────────────────────────────────
  {
    key: "integration_melhor_envio",
    providerKey: "melhor_envio",
    icon: "ME",
    title: "Melhor Envio",
    description: "Gateway logístico para cotação, etiquetas e múltiplas transportadoras.",
    docsUrl: "https://docs.melhorenvio.com.br",
    fields: [
      {
        name: "client_id",
        label: "Client ID",
        placeholder: "me_client_id",
        hint: "Client ID do seu app em Melhor Envio → Gerenciar apps.",
      },
      {
        name: "client_secret",
        label: "Client Secret",
        placeholder: "me_client_secret…",
        type: "password",
        hint: "Client Secret gerado junto com o Client ID.",
      },
      {
        name: "access_token",
        label: "Access Token",
        placeholder: "eyJ…",
        type: "password",
        hint: "Token Bearer OAuth 2.0 obtido após autorização. Cole o token completo.",
        required: false,
      },
      {
        name: "refresh_token",
        label: "Refresh Token",
        placeholder: "def50200…",
        type: "password",
        hint: "Token para renovar o access_token automaticamente quando expirar.",
        required: false,
      },
      {
        name: "from_cep",
        label: "CEP de origem",
        placeholder: "01310100",
        hint: "CEP do endereço de despacho dos pedidos. Somente números.",
      },
      {
        name: "from_name",
        label: "Nome do remetente",
        placeholder: "Flora Botanics",
        hint: "Nome exibido nas etiquetas como remetente.",
      },
      {
        name: "sandbox",
        label: "Modo sandbox",
        placeholder: "false",
        hint: "true = ambiente de testes (sandbox.melhorenvio.com.br) | false = produção.",
      },
    ],
  },
  {
    key: "integration_correios",
    providerKey: "correios",
    icon: "CE",
    title: "Correios",
    description: "Cotação, etiquetas, prazos, postagem e rastreamento nacional.",
    docsUrl: "https://www.correios.com.br",
    fields: [
      {
        name: "cnpj_cpf",
        label: "CNPJ / CPF do contratante",
        placeholder: "00000000000000",
        hint: "CNPJ ou CPF cadastrado na conta Meu Correios. Somente números.",
      },
      {
        name: "password",
        label: "Senha Meu Correios",
        placeholder: "sua_senha",
        type: "password",
        hint: "Senha de acesso ao Meu Correios. A API gera o hash internamente.",
      },
      {
        name: "contract_code",
        label: "Código do contrato",
        placeholder: "1234567890",
        hint: "Número do contrato de postagem dos Correios.",
      },
      {
        name: "postcard",
        label: "Cartão de postagem",
        placeholder: "0067599079",
        hint: "Número do cartão de postagem vinculado ao contrato.",
        required: false,
      },
    ],
  },
  {
    key: "integration_azul_cargo",
    providerKey: "azul_cargo",
    icon: "AZ",
    title: "Azul Cargo Express",
    description: "Cotação, coleta, etiqueta e rastreamento para cargas expressas.",
    docsUrl: "https://www.azulcargoexpress.com.br",
    fields: [
      {
        name: "cnpj",
        label: "CNPJ do cliente",
        placeholder: "00000000000000",
        hint: "CNPJ da empresa cadastrado na Azul Cargo. Somente números.",
      },
      {
        name: "account_code",
        label: "Código da conta",
        placeholder: "AZUL-123",
        hint: "Código de conta fornecido pela Azul Cargo ao firmar contrato.",
      },
      {
        name: "api_token",
        label: "API Token",
        placeholder: "azul_token_xxxx",
        type: "password",
        hint: "Token de acesso à API da Azul Cargo. Obtido no painel do cliente.",
      },
    ],
  },
  {
    key: "integration_loggi",
    providerKey: "loggi",
    icon: "LG",
    title: "Loggi",
    description: "Coletas urbanas, cotação, etiqueta e rastreamento.",
    docsUrl: "https://docs.api.loggi.com",
    fields: [
      {
        name: "email",
        label: "E-mail da conta Loggi",
        placeholder: "contato@florabotanics.com.br",
        hint: "E-mail de login da conta Loggi Business.",
      },
      {
        name: "api_key",
        label: "API Key",
        placeholder: "loggi_live_xxxx",
        type: "password",
        hint: "Gerada em Loggi Business → Integrações → API Keys.",
      },
      {
        name: "company_id",
        label: "Company ID",
        placeholder: "123456",
        hint: "ID da empresa na Loggi — encontrado em Configurações da conta.",
        required: false,
      },
    ],
  },
  {
    key: "integration_jt_express",
    providerKey: "jt_express",
    icon: "JT",
    title: "J&T Express",
    description: "Remessas, etiquetas, rastreamento e atualização de status.",
    docsUrl: "https://www.jtexpress.com.br",
    fields: [
      {
        name: "customer_code",
        label: "Código do cliente",
        placeholder: "JT-CLIENTE",
        hint: "Código de cliente fornecido pela J&T Express ao firmar contrato.",
      },
      {
        name: "api_key",
        label: "API Key",
        placeholder: "jt_api_key_xxxx",
        type: "password",
        hint: "Chave de acesso à API da J&T Express.",
      },
      {
        name: "api_secret",
        label: "API Secret",
        placeholder: "jt_secret_xxxx",
        type: "password",
        hint: "Secret para assinar as requisições à API da J&T.",
      },
    ],
  },

  // ─── FISCAL ──────────────────────────────────────────────────────────────
  {
    key: "integration_sefaz",
    providerKey: "sefaz",
    icon: "NF",
    title: "SEFAZ / NF-e",
    description: "Emissão fiscal, XML, DANFE, cancelamento, inutilização e carta de correção.",
    fields: [
      {
        name: "environment",
        label: "Ambiente fiscal",
        placeholder: "homologacao",
        hint: "homologacao para testes | producao para emissão real.",
      },
      {
        name: "cnpj",
        label: "CNPJ do emitente",
        placeholder: "00000000000000",
        hint: "CNPJ da empresa emitente das notas fiscais. Somente números.",
      },
      {
        name: "uf",
        label: "UF (estado fiscal)",
        placeholder: "SP",
        hint: "Sigla do estado onde a empresa está inscrita (ex: SP, RJ, MG).",
      },
      {
        name: "crt",
        label: "Código de Regime Tributário",
        placeholder: "1",
        hint: "1 = Simples Nacional | 2 = Simples Nacional – excesso | 3 = Regime Normal.",
      },
      {
        name: "certificate_pfx_base64",
        label: "Certificado A1 (base64)",
        placeholder: "MIIKvAIBAzCCCn…",
        type: "textarea",
        hint: "Conteúdo do .pfx convertido para base64. No PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes('cert.pfx')) | Set-Clipboard",
      },
      {
        name: "certificate_password",
        label: "Senha do certificado A1",
        placeholder: "senha_do_pfx",
        type: "password",
        hint: "Senha definida ao exportar o certificado A1 da ICP-Brasil.",
      },
    ],
  },

];

export default async function IntegracoesPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const keys = INTEGRATIONS.map((i) => i.key);
  const providerKeys = INTEGRATIONS.map((i) => i.providerKey);

  const [{ data: settings }, { data: connections }, { data: runs }] = await Promise.all([
    supabase
      .from("site_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", keys),
    supabase
      .from("integration_connections")
      .select(
        "provider_key, status, environment, credentials_status, auto_sync_enabled, last_sync_at, last_healthcheck_at, last_error, latency_ms, error_count"
      )
      .eq("tenant_id", tenantId)
      .eq("environment", "production")
      .in("provider_key", providerKeys),
    supabase
      .from("integration_sync_runs")
      .select("provider_key, status, created_at")
      .eq("tenant_id", tenantId)
      .in("provider_key", providerKeys)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const settingsMap = Object.fromEntries(
    (settings ?? []).map((s) => [s.key, s.value as Record<string, string> | null])
  );

  const latestRunMap = new Map<string, IntegrationRunRow>();
  for (const run of ((runs ?? []) as IntegrationRunRow[])) {
    if (!latestRunMap.has(run.provider_key)) latestRunMap.set(run.provider_key, run);
  }

  const statusMap = Object.fromEntries(
    ((connections ?? []) as IntegrationConnectionRow[]).map((connection) => {
      const run = latestRunMap.get(connection.provider_key);
      const value: IntegrationStatus = {
        providerKey: connection.provider_key,
        status: connection.status,
        environment: connection.environment,
        credentialsStatus: connection.credentials_status,
        autoSyncEnabled: connection.auto_sync_enabled,
        lastSyncAt: connection.last_sync_at,
        lastHealthcheckAt: connection.last_healthcheck_at,
        lastError: connection.last_error,
        latencyMs: connection.latency_ms,
        errorCount: connection.error_count ?? 0,
        latestRunStatus: run?.status ?? null,
        latestRunAt: run?.created_at ?? null,
      };
      return [connection.provider_key, value];
    })
  );

  const connectedCount = INTEGRATIONS.filter(
    (i) =>
      (settingsMap[i.key] && Object.keys(settingsMap[i.key]!).length > 0) ||
      statusMap[i.providerKey]?.credentialsStatus === "stored"
  ).length;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 6 }}>
          <Link href="/config" className="eyebrow" style={{ opacity: 0.8 }}>
            ← Configurações
          </Link>
          <span style={{ opacity: 0.3 }}>/</span>
          <Link href="/canais" className="eyebrow" style={{ opacity: 0.6 }}>
            Canais
          </Link>
        </div>
        <h1 className="display" style={{ fontSize: 40, marginTop: 8, marginBottom: 6 }}>
          Central de Integrações
        </h1>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Conecte APIs externas, acompanhe status, última sincronização, fila operacional
          e histórico de erros por canal. Esta é a base desacoplada para marketplaces,
          mensageria, fiscal, logística e e-commerce hub.
          {connectedCount > 0 && (
            <span style={{ marginLeft: 8, color: "#8fd486", fontWeight: 700 }}>
              {connectedCount} de {INTEGRATIONS.length} configurada{connectedCount !== 1 ? "s" : ""}.
            </span>
          )}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          <Link href="/config/integracoes/monitoramento" className="btn btn-gold" style={{ padding: "10px 18px", fontSize: 10 }}>
            Monitoramento
          </Link>
          <Link href="/config" className="btn btn-ghost" style={{ padding: "10px 18px", fontSize: 10 }}>
            Voltar para configurações
          </Link>
        </div>
      </header>

      <div style={{ display: "grid", gap: 14 }}>
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard
            key={integration.key}
            integrationKey={integration.key}
            icon={integration.icon}
            title={integration.title}
            description={integration.description}
            fields={integration.fields}
            docsUrl={integration.docsUrl}
            initial={settingsMap[integration.key] ?? null}
            status={statusMap[integration.providerKey] ?? null}
          />
        ))}
      </div>

      <div
        className="glass"
        style={{ marginTop: 24, padding: "16px 22px", borderRadius: 12 }}
      >
        <p style={{ margin: 0, fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--cream)" }}>Arquitetura:</strong> as credenciais
          legadas continuam em <code style={{ fontSize: 11 }}>site_settings</code>, mas agora
          cada canal também possui uma conexão operacional em{" "}
          <code style={{ fontSize: 11 }}>integration_connections</code>, com status,
          ambiente, fila de sincronização e eventos auditáveis. Segredos reais não entram
          no código-fonte.
        </p>
      </div>
    </main>
  );
}
