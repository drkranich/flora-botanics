export type IntegrationKey =
  | "integration_resend"
  | "integration_whatsapp"
  | "integration_stripe"
  | "integration_mercadolivre"
  | "integration_shopee"
  | "integration_instagram"
  | "integration_amazon"
  | "integration_tiktok"
  | "integration_google_merchant"
  | "integration_correios"
  | "integration_azul_cargo"
  | "integration_loggi"
  | "integration_jt_express"
  | "integration_melhor_envio"
  | "integration_sefaz"
;

export const PROVIDER_BY_INTEGRATION: Record<IntegrationKey, string> = {
  integration_resend: "resend",
  integration_whatsapp: "whatsapp",
  integration_stripe: "stripe",
  integration_mercadolivre: "mercado_livre",
  integration_shopee: "shopee",
  integration_instagram: "instagram",
  integration_amazon: "amazon",
  integration_tiktok: "tiktok",
  integration_google_merchant: "google_merchant",
  integration_correios: "correios",
  integration_azul_cargo: "azul_cargo",
  integration_loggi: "loggi",
  integration_jt_express: "jt_express",
  integration_melhor_envio: "melhor_envio",
  integration_sefaz: "sefaz",
};

export function providerForIntegration(integrationKey: IntegrationKey) {
  return PROVIDER_BY_INTEGRATION[integrationKey];
}
