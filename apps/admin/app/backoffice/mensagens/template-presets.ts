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
      subject: "Voce esqueceu algo, {{nome}}",
      body:
        "Ola {{nome}},\n\nNotamos que alguns produtos ficaram no seu carrinho. Eles ainda estao disponiveis, mas o estoque pode mudar rapido.\n\nTotal do carrinho: {{total}}\n\nFinalize sua compra aqui: {{checkout_url}}\n\nCom cuidado,\nFlora Botanics",
      variables: ["nome", "total", "checkout_url"],
    },
  },
  {
    id: "email-boas-vindas",
    title: "Boas-vindas a conta Flora",
    description: "Primeiro contato para clientes que criaram conta no site publico.",
    triggerLabel: "Conta",
    template: {
      name: "Flora - Boas-vindas",
      channel: "email",
      subject: "Sua conta Flora foi criada",
      body:
        "Ola {{nome}},\n\nSua conta Flora Botanics esta pronta. Agora voce pode acompanhar pedidos, recuperar carrinhos e manter seus dados salvos para as proximas compras.\n\nAcesse sua conta: {{conta_url}}\n\nFlora Botanics",
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
      subject: "Pedido {{numero_pedido}} confirmado",
      body:
        "Ola {{nome}},\n\nRecebemos o pagamento do pedido {{numero_pedido}} no valor de {{total}}.\n\nVamos preparar tudo com cuidado e avisar quando o envio estiver a caminho.\n\nAcompanhe seu pedido: {{pedido_url}}\n\nFlora Botanics",
      variables: ["nome", "numero_pedido", "total", "pedido_url"],
    },
  },
  {
    id: "email-pedido-enviado",
    title: "Pedido enviado",
    description: "Mensagem de expedicao com espaco para codigo de rastreio.",
    triggerLabel: "Logistica",
    template: {
      name: "Flora - Pedido enviado",
      channel: "email",
      subject: "Seu pedido {{numero_pedido}} foi enviado",
      body:
        "Ola {{nome}},\n\nSeu pedido {{numero_pedido}} ja saiu para entrega.\n\nCodigo de rastreio: {{codigo_rastreio}}\nLink de acompanhamento: {{rastreamento_url}}\n\nFlora Botanics",
      variables: ["nome", "numero_pedido", "codigo_rastreio", "rastreamento_url"],
    },
  },
  {
    id: "email-aniversario",
    title: "Aniversario do cliente",
    description: "Disparo afetivo para relacionamento e recompra.",
    triggerLabel: "CRM",
    template: {
      name: "Flora - Aniversario",
      channel: "email",
      subject: "Um cuidado especial para voce, {{nome}}",
      body:
        "Ola {{nome}},\n\nHoje a Flora Botanics separou um gesto especial para celebrar voce.\n\nUse o cupom {{cupom}} na sua proxima compra e escolha um cuidado que combine com este novo ciclo.\n\nCom carinho,\nFlora Botanics",
      variables: ["nome", "cupom"],
    },
  },
  {
    id: "email-pos-compra",
    title: "Pos-compra",
    description: "Acompanha a experiencia depois da entrega e abre conversa com suporte.",
    triggerLabel: "Atendimento",
    template: {
      name: "Flora - Pos-compra",
      channel: "email",
      subject: "Como foi sua experiencia com a Flora?",
      body:
        "Ola {{nome}},\n\nQueremos saber como foi sua experiencia com o pedido {{numero_pedido}}.\n\nSe algo nao saiu como esperado, responda este e-mail e nossa equipe acompanha de perto.\n\nFlora Botanics",
      variables: ["nome", "numero_pedido"],
    },
  },
  {
    id: "email-newsletter-editorial",
    title: "Newsletter editorial",
    description: "Modelo para conteudos de marca, lancamentos e campanhas do CMS.",
    triggerLabel: "Conteudo",
    template: {
      name: "Flora - Newsletter editorial",
      channel: "email",
      subject: "{{titulo}}",
      body:
        "Ola {{nome}},\n\n{{introducao}}\n\n{{conteudo}}\n\nVeja mais: {{cta_url}}\n\nFlora Botanics",
      variables: ["nome", "titulo", "introducao", "conteudo", "cta_url"],
    },
  },
  {
    id: "email-estoque-baixo",
    title: "Alerta interno de estoque",
    description: "Aviso operacional para reposicao antes de ruptura.",
    triggerLabel: "Estoque",
    template: {
      name: "Flora - Estoque baixo",
      channel: "email",
      subject: "Estoque baixo: {{produto}}",
      body:
        "Alerta interno Flora Botanics\n\nProduto: {{produto}}\nSKU: {{sku}}\nEstoque atual: {{estoque_atual}}\nEstoque minimo: {{estoque_minimo}}\n\nVerifique reposicao, compra ou producao.",
      variables: ["produto", "sku", "estoque_atual", "estoque_minimo"],
    },
  },
  {
    id: "whatsapp-carrinho-abandonado",
    title: "WhatsApp de recuperacao",
    description: "Texto curto para quando o canal WhatsApp for conectado.",
    triggerLabel: "WhatsApp",
    template: {
      name: "Flora - WhatsApp carrinho",
      channel: "whatsapp",
      subject: null,
      body:
        "Ola {{nome}}, vimos que seu carrinho ficou esperando por voce na Flora Botanics. Para continuar: {{checkout_url}}",
      variables: ["nome", "checkout_url"],
    },
  },
];
