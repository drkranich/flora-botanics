/** Constantes de rastreamento — importáveis tanto em Server quanto Client components. */

export const STATUS_EVENT_LABEL: Record<string, string> = {
  preparing: "Preparando pedido",
  dispatched: "Enviado / Postado",
  in_transit: "Em trânsito",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  exception: "Ocorrência",
};

export const STATUS_EVENT_ICON: Record<string, string> = {
  preparing: "📦",
  dispatched: "🚚",
  in_transit: "✈️",
  out_for_delivery: "🛵",
  delivered: "✅",
  exception: "⚠️",
};
