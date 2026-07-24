import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { IntegrationCard, type FieldDef } from "./IntegrationCard";
import type { IntegrationKey } from "./actions";

interface Integration {
  key: IntegrationKey;
  icon: string;
  title: string;
  description: string;
  docsUrl?: string;
  fields: FieldDef[];
}

const INTEGRATIONS: Integration[] = [
  {
    key: "integration_whatsapp",
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
];

export default async function IntegracoesPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const keys = INTEGRATIONS.map((i) => i.key);

  const { data: settings } = await supabase
    .from("site_settings")
    .select("key, value")
    .eq("tenant_id", tenantId)
    .in("key", keys);

  const settingsMap = Object.fromEntries(
    (settings ?? []).map((s) => [s.key, s.value as Record<string, string> | null])
  );

  const connectedCount = INTEGRATIONS.filter(
    (i) => settingsMap[i.key] && Object.keys(settingsMap[i.key]!).length > 0
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
          Integrações de marketplace
        </h1>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Salve aqui as credenciais de API de cada plataforma. As chaves ficam armazenadas
          com segurança no banco de dados e nunca entram no código-fonte.
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
          />
        ))}
      </div>

      <div
        className="glass"
        style={{ marginTop: 24, padding: "16px 22px", borderRadius: 12 }}
      >
        <p style={{ margin: 0, fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--cream)" }}>Segurança:</strong> as credenciais são
          salvas na tabela <code style={{ fontSize: 11 }}>site_settings</code> do Supabase
          com Row Level Security ativa. Apenas administradores da sua conta têm acesso.
          Nunca são expostas no código-fonte ou em variáveis de ambiente rastreadas pelo git.
        </p>
      </div>
    </main>
  );
}
