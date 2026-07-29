export const CHANNEL_LABEL: Record<string, string> = {
  site: "Site",
  email: "E-mail",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  sms: "SMS",
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  tiktok: "TikTok",
  google_merchant: "Google Merchant",
  facebook: "Facebook",
};

export const CONVERSATION_STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  open: "Em atendimento",
  waiting: "Aguardando",
  resolved: "Resolvido",
};

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} d`;
}
