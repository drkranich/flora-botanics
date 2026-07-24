/** Bloco de e-mail — espelha o tipo Block de TemplateStudio.tsx */
type Block =
  | { type: "image"; url: string; alt: string; link: string; width: string }
  | { type: "heading"; text: string }
  | { type: "text"; html: string }
  | { type: "cta"; label: string; url: string; color: string }
  | { type: "divider" }
  | { type: "spacer" };

function b(...blocks: Block[]): string {
  return JSON.stringify({ blocks });
}

const totalBox = (label: string, value: string) =>
  `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e0d4;border-radius:8px;margin:4px 0;"><tr><td style="padding:14px 20px;font-weight:700;font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#374937;">${label}</td><td style="padding:14px 20px;text-align:right;font-weight:700;font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#374937;">${value}</td></tr></table>`;

const couponBox = (code: string) =>
  `<div style="text-align:center;margin:8px 0;padding:18px;background:#f7f3ed;border:2px dashed #d4cdc3;border-radius:8px;"><span style="font-family:Montserrat,Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:4px;color:#2a4a2c;">${code}</span></div>`;

export type TemplatePreset = {
  id: string;
  title: string;
  description: string;
  triggerLabel: string;
  template: {
    name: string;
    channel: "email" | "whatsapp" | "instagram" | "sms";
    subject: string | null;
    body: string;
    variables: string[];
  };
};

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "email-carrinho-abandonado",
    title: "Carrinho abandonado",
    description: "Recupera compras paradas com um tom elegante, direto e sem parecer spam.",
    triggerLabel: "Carrinho",
    template: {
      name: "Flora - Carrinho abandonado",
      channel: "email",
      subject: "Você esqueceu algo, {{nome}} 🌿",
      body: b(
        { type: "heading", text: "Você esqueceu algo, {{nome}} 🌿" },
        {
          type: "text",
          html: "<p>Notamos que você deixou produtos incríveis no seu carrinho. Eles ainda estão disponíveis — mas o estoque é limitado!</p>",
        },
        { type: "text", html: totalBox("Total do carrinho", "{{total}}") },
        {
          type: "cta",
          label: "Finalizar minha compra →",
          url: "{{checkout_url}}",
          color: "#1a2e1c",
        }
      ),
      variables: ["nome", "total", "checkout_url"],
    },
  },
  {
    id: "email-boas-vindas",
    title: "Boas-vindas à conta Flora",
    description: "Primeiro contato para clientes que criaram conta no site público.",
    triggerLabel: "Conta",
    template: {
      name: "Flora - Boas-vindas",
      channel: "email",
      subject: "Bem-vinda à Flora, {{nome}} ✨",
      body: b(
        { type: "heading", text: "Bem-vinda à Flora, {{nome}} ✨" },
        {
          type: "text",
          html: "<p>Sua conta Flora Botanics está pronta. Agora você pode acompanhar pedidos, salvar endereços e ter acesso antecipado aos nossos lançamentos.</p>",
        },
        { type: "spacer" },
        {
          type: "cta",
          label: "Acessar minha conta",
          url: "{{conta_url}}",
          color: "#2a4a2c",
        }
      ),
      variables: ["nome", "conta_url"],
    },
  },
  {
    id: "email-pedido-confirmado",
    title: "Pedido confirmado",
    description: "Confirma pagamento e abre caminho para acompanhamento do pedido.",
    triggerLabel: "Venda",
    template: {
      name: "Flora - Pedido confirmado",
      channel: "email",
      subject: "Pedido #{{numero_pedido}} confirmado ✓",
      body: b(
        { type: "heading", text: "Pedido confirmado! ✓" },
        {
          type: "text",
          html: "<p>Recebemos o pagamento do pedido <strong>#{{numero_pedido}}</strong>. Vamos preparar tudo com cuidado e avisar quando o envio estiver a caminho.</p>",
        },
        { type: "text", html: totalBox("Total do pedido", "{{total}}") },
        {
          type: "cta",
          label: "Acompanhar pedido",
          url: "{{pedido_url}}",
          color: "#2a4a2c",
        }
      ),
      variables: ["nome", "numero_pedido", "total", "pedido_url"],
    },
  },
  {
    id: "email-pedido-enviado",
    title: "Pedido enviado",
    description: "Mensagem de expedição com espaço para código de rastreio.",
    triggerLabel: "Logística",
    template: {
      name: "Flora - Pedido enviado",
      channel: "email",
      subject: "Seu pedido #{{numero_pedido}} foi enviado 📦",
      body: b(
        { type: "heading", text: "Seu pedido está a caminho! 📦" },
        {
          type: "text",
          html: "<p>O pedido <strong>#{{numero_pedido}}</strong> saiu para entrega. Acompanhe em tempo real pelo link abaixo.</p>",
        },
        {
          type: "text",
          html: totalBox("Código de rastreio", "{{codigo_rastreio}}"),
        },
        {
          type: "cta",
          label: "Rastrear meu pedido",
          url: "{{rastreamento_url}}",
          color: "#2a4a2c",
        }
      ),
      variables: ["nome", "numero_pedido", "codigo_rastreio", "rastreamento_url"],
    },
  },
  {
    id: "email-aniversario",
    title: "Aniversário do cliente",
    description: "Disparo afetivo para relacionamento e recompra.",
    triggerLabel: "CRM",
    template: {
      name: "Flora - Aniversário",
      channel: "email",
      subject: "Um cuidado especial para você, {{nome}} 🎂",
      body: b(
        { type: "heading", text: "Feliz aniversário, {{nome}} 🎂" },
        {
          type: "text",
          html: "<p>A Flora Botanics separou um gesto especial para celebrar você. Use o cupom abaixo na sua próxima compra e escolha um cuidado que combine com este novo ciclo.</p>",
        },
        { type: "text", html: couponBox("{{cupom}}") },
        {
          type: "cta",
          label: "Ver presentes especiais",
          url: "https://florabotanics.com.br",
          color: "#2a4a2c",
        }
      ),
      variables: ["nome", "cupom"],
    },
  },
  {
    id: "email-pos-compra",
    title: "Pós-compra",
    description: "Acompanha a experiência depois da entrega e abre conversa com suporte.",
    triggerLabel: "Atendimento",
    template: {
      name: "Flora - Pós-compra",
      channel: "email",
      subject: "Como foi sua experiência com a Flora?",
      body: b(
        { type: "heading", text: "Como foi sua experiência, {{nome}}?" },
        {
          type: "text",
          html: "<p>Queremos saber como foi sua experiência com o pedido <strong>#{{numero_pedido}}</strong>. Se algo não saiu como esperado, responda este e-mail e nossa equipe acompanha de perto.</p>",
        },
        { type: "divider" },
        {
          type: "text",
          html: "<p style='font-size:13px;color:#6b7c6b;'>Sua opinião nos ajuda a cuidar melhor de cada cliente. 🌿</p>",
        }
      ),
      variables: ["nome", "numero_pedido"],
    },
  },
  {
    id: "email-newsletter-editorial",
    title: "Newsletter editorial",
    description: "Modelo para conteúdos de marca, lançamentos e campanhas do CMS.",
    triggerLabel: "Conteúdo",
    template: {
      name: "Flora - Newsletter editorial",
      channel: "email",
      subject: "{{titulo}}",
      body: b(
        { type: "heading", text: "{{titulo}}" },
        {
          type: "text",
          html: "<p>{{introducao}}</p>",
        },
        {
          type: "text",
          html: "<p>{{conteudo}}</p>",
        },
        {
          type: "cta",
          label: "Saiba mais",
          url: "{{cta_url}}",
          color: "#2a4a2c",
        }
      ),
      variables: ["nome", "titulo", "introducao", "conteudo", "cta_url"],
    },
  },
  {
    id: "email-estoque-baixo",
    title: "Alerta interno de estoque",
    description: "Aviso operacional para reposição antes de ruptura.",
    triggerLabel: "Estoque",
    template: {
      name: "Flora - Estoque baixo",
      channel: "email",
      subject: "⚠️ Estoque baixo: {{produto}}",
      body: b(
        { type: "heading", text: "⚠️ Alerta de estoque" },
        {
          type: "text",
          html: "<p>O produto <strong>{{produto}}</strong> (SKU: {{sku}}) está abaixo do nível mínimo e precisa de reposição.</p>",
        },
        { type: "text", html: totalBox("Estoque atual", "{{estoque_atual}} unidades") },
        { type: "text", html: totalBox("Estoque mínimo", "{{estoque_minimo}} unidades") }
      ),
      variables: ["produto", "sku", "estoque_atual", "estoque_minimo"],
    },
  },
  {
    id: "whatsapp-carrinho-abandonado",
    title: "WhatsApp de recuperação",
    description: "Texto curto para quando o canal WhatsApp for conectado.",
    triggerLabel: "WhatsApp",
    template: {
      name: "Flora - WhatsApp carrinho",
      channel: "whatsapp",
      subject: null,
      body: "Olá {{nome}}, vimos que seu carrinho ficou esperando por você na Flora Botanics. Para continuar: {{checkout_url}}",
      variables: ["nome", "checkout_url"],
    },
  },
];
