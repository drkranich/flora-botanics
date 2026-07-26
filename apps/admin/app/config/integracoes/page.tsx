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
  {
    key: "integration_resend",
    providerKey: "resend",
    icon: "@",
    title: "Resend",
    description: "E-mails transacionais, carrinhos abandonados, templates e automações.",
    docsUrl: "https://resend.com/docs",
    fields: [
      {
        name: "from_email",
        label: "Remetente padrão",
        placeholder: "Flora Botanics <contato@florabotanics.com.br>",
        hint: "Use o domínio já verificado no Resend. A chave RESEND_API_KEY continua como secret do Worker.",
      },
      {
        name: "webhook_secret_ref",
        label: "Referência do webhook",
        placeholder: "RESEND_WEBHOOK_SECRET",
        type: "password",
        hint: "Não cole secrets rastreáveis no git. Use apenas uma referência operacional.",
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
        name: "api_url",
        label: "URL da API",
        placeholder: "https://graph.facebook.com/v19.0",
        type: "url",
        hint: "URL base da Cloud API do WhatsApp. Geralmente https://graph.facebook.com/v19.0",
      },
      {
        name: "phone_number_id",
        label: "Phone Number ID",
        placeholder: "123456789012345",
        hint: "ID do número de telefone no Meta for Developers → WhatsApp → API Setup.",
      },
      {
        name: "access_token",
        label: "Access Token permanente",
        placeholder: "EAAx…",
        type: "password",
        hint: "Token de acesso permanente do seu App de negócios Meta.",
      },
    ],
  },
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
        hint: "URL de redirecionamento cadastrada no app do Mercado Livre.",
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
        hint: "ID da sua loja Shopee (obtido após autorização OAuth).",
        required: false,
      },
      {
        name: "access_token",
        label: "Access Token",
        placeholder: "shopee_access_token…",
        type: "password",
        hint: "Token de acesso obtido após o fluxo OAuth da Shopee.",
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
        label: "Instagram Page ID",
        placeholder: "17841400000000000",
        hint: "ID da conta profissional do Instagram (pode ser encontrado nas Configurações).",
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
        hint: "ID do marketplace. Brasil = A2Q3Y263D00KWC",
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
        hint: "Client Secret do seu app LWA (Login with Amazon).",
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
        hint: "Access Token obtido após o OAuth do lojista com o app.",
        required: false,
      },
      {
        name: "shop_id",
        label: "Shop ID",
        placeholder: "123456789",
        hint: "ID da loja TikTok Shop (obtido após OAuth).",
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
        hint: "ID da conta no Google Merchant Center. Aparece no canto superior direito do Merchant Center.",
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
  {
    key: "integration_correios",
    providerKey: "correios",
    icon: "CE",
    title: "Correios",
    description: "Cotação, etiquetas, prazos, postagem e rastreamento nacional.",
    docsUrl: "https://www.correios.com.br",
    fields: [
      { name: "contract_code", label: "Código do contrato", placeholder: "1234567890" },
      { name: "postcard", label: "Cartão de postagem", placeholder: "0067599079", required: false },
      { name: "api_token_ref", label: "Referência do token", placeholder: "CORREIOS_API_TOKEN", type: "password" },
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
      { name: "account_code", label: "Código da conta", placeholder: "AZUL-123" },
      { name: "api_token_ref", label: "Referência do token", placeholder: "AZUL_CARGO_TOKEN", type: "password" },
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
      { name: "company_id", label: "Company ID", placeholder: "123456" },
      { name: "api_token_ref", label: "Referência do token", placeholder: "LOGGI_API_TOKEN", type: "password" },
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
      { name: "customer_code", label: "Código do cliente", placeholder: "JT-CLIENTE" },
      { name: "api_token_ref", label: "Referência do token", placeholder: "JT_EXPRESS_TOKEN", type: "password" },
    ],
  },
  {
    key: "integration_melhor_envio",
    providerKey: "melhor_envio",
    icon: "ME",
    title: "Melhor Envio",
    description: "Gateway logístico para cotação, etiquetas e múltiplas transportadoras.",
    docsUrl: "https://docs.melhorenvio.com.br",
    fields: [
      { name: "client_id", label: "Client ID", placeholder: "me_client_id" },
      { name: "client_secret_ref", label: "Referência do secret", placeholder: "MELHOR_ENVIO_SECRET", type: "password" },
      { name: "access_token_ref", label: "Referência do access token", placeholder: "MELHOR_ENVIO_TOKEN", type: "password", required: false },
    ],
  },
  {
    key: "integration_sefaz",
    providerKey: "sefaz",
    icon: "NF",
    title: "SEFAZ / NF-e",
    description: "Emissão fiscal, XML, DANFE, cancelamento, inutilização e carta de correção.",
    fields: [
      { name: "environment", label: "Ambiente fiscal", placeholder: "homologação ou produção" },
      { name: "certificate_ref", label: "Referência do certificado A1", placeholder: "SEFAZ_CERTIFICATE_PFX", type: "password" },
      { name: "certificate_password_ref", label: "Referência da senha do certificado", placeholder: "SEFAZ_CERTIFICATE_PASSWORD", type: "password" },
    ],
  },
  {
    key: "integration_shopify",
    providerKey: "shopify",
    icon: "SF",
    title: "Shopify",
    description: "Catálogo, estoque, preços, pedidos e webhooks.",
    docsUrl: "https://shopify.dev/docs/api",
    fields: [
      { name: "shop_domain", label: "Domínio da loja", placeholder: "flora.myshopify.com", type: "url" },
      { name: "access_token_ref", label: "Referência do token", placeholder: "SHOPIFY_ACCESS_TOKEN", type: "password" },
    ],
  },
  {
    key: "integration_woocommerce",
    providerKey: "woocommerce",
    icon: "WC",
    title: "WooCommerce",
    description: "Catálogo, estoque e pedidos via REST API.",
    docsUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs",
    fields: [
      { name: "store_url", label: "URL da loja", placeholder: "https://loja.com.br", type: "url" },
      { name: "consumer_key_ref", label: "Referência Consumer Key", placeholder: "WOO_CONSUMER_KEY", type: "password" },
      { name: "consumer_secret_ref", label: "Referência Consumer Secret", placeholder: "WOO_CONSUMER_SECRET", type: "password" },
    ],
  },
  {
    key: "integration_nuvemshop",
    providerKey: "nuvemshop",
    icon: "NS",
    title: "Nuvemshop",
    description: "Catálogo, estoque, preços, pedidos e webhooks.",
    docsUrl: "https://tiendanube.github.io/api-documentation",
    fields: [
      { name: "store_id", label: "Store ID", placeholder: "123456" },
      { name: "access_token_ref", label: "Referência do token", placeholder: "NUVEMSHOP_ACCESS_TOKEN", type: "password" },
    ],
  },
  {
    key: "integration_tray",
    providerKey: "tray",
    icon: "TR",
    title: "Tray",
    description: "Catálogo, estoque, preços e pedidos centralizados.",
    fields: [
      { name: "store_url", label: "URL da loja", placeholder: "https://minhaloja.commercesuite.com.br", type: "url" },
      { name: "access_token_ref", label: "Referência do token", placeholder: "TRAY_ACCESS_TOKEN", type: "password" },
    ],
  },
  {
    key: "integration_loja_integrada",
    providerKey: "loja_integrada",
    icon: "LI",
    title: "Loja Integrada",
    description: "Produtos, estoque, preços e pedidos.",
    fields: [
      { name: "store_url", label: "URL da loja", placeholder: "https://minhaloja.com.br", type: "url" },
      { name: "api_key_ref", label: "Referência da chave", placeholder: "LOJA_INTEGRADA_API_KEY", type: "password" },
    ],
  },
  {
    key: "integration_vtex",
    providerKey: "vtex",
    icon: "VX",
    title: "VTEX",
    description: "Catálogo, estoque, preços, OMS e pedidos.",
    docsUrl: "https://developers.vtex.com",
    fields: [
      { name: "account_name", label: "Account name", placeholder: "florabotanics" },
      { name: "app_key_ref", label: "Referência App Key", placeholder: "VTEX_APP_KEY", type: "password" },
      { name: "app_token_ref", label: "Referência App Token", placeholder: "VTEX_APP_TOKEN", type: "password" },
    ],
  },
  {
    key: "integration_magento",
    providerKey: "magento",
    icon: "MG",
    title: "Magento / Adobe Commerce",
    description: "Catálogo, estoque, preços, pedidos e webhooks.",
    docsUrl: "https://developer.adobe.com/commerce",
    fields: [
      { name: "store_url", label: "URL da loja", placeholder: "https://commerce.exemplo.com.br", type: "url" },
      { name: "access_token_ref", label: "Referência do token", placeholder: "MAGENTO_ACCESS_TOKEN", type: "password" },
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
