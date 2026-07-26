export type PublicFallbackPage = {
  title: string;
  eyebrow: string;
  intro: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
};

const PAGES: Record<string, PublicFallbackPage> = {
  "sobre-nos": {
    eyebrow: "Flora Botanics",
    title: "Sobre Nós",
    intro:
      "A Flora Botanics nasce da aproximação entre botânica, ciência cosmética e cuidado cotidiano.",
    paragraphs: [
      "Criamos fórmulas inspiradas pela biodiversidade brasileira, com uma linguagem visual silenciosa, precisa e sensorial.",
      "Cada página institucional poderá ser substituida por conteúdo editorial completo no CMS. Até lá, o site público apresenta uma base limpa, coerente e segura para navegação.",
    ],
  },
  ingredientes: {
    eyebrow: "Ciência Botânica",
    title: "Ingredientes",
    intro:
      "Ativos botânicos, texturas inteligentes e escolhas de formulação com propósito.",
    paragraphs: [
      "Esta área será dedicada aos ingredientes principais da marca, com benefícios, origem, modo de uso e relação com cada rotina.",
      "O CMS deve evoluir para permitir fichas editoriais de ingredientes, produtos relacionados e conteúdo técnico sem aparência de texto solto.",
    ],
  },
  sustentabilidade: {
    eyebrow: "Responsabilidade",
    title: "Sustentabilidade",
    intro:
      "Compromissos ambientais devem ser comunicados com clareza, sem exagero e sem promessas vazias.",
    paragraphs: [
      "A página definitiva deve publicar apenas práticas verificáveis: embalagem, cadeia de fornecimento, descarte, logística e escolhas de produção.",
      "Enquanto o conteúdo final é estruturado no CMS, esta rota permanece viva e coerente com a identidade publica da Flora.",
    ],
  },
  blog: {
    eyebrow: "Editorial",
    title: "Blog",
    intro:
      "Guias, rituais e conteúdos de skincare devem funcionar como extensão da experiência da marca.",
    paragraphs: [
      "O módulo editorial definitivo deve suportar artigos, ingredientes, rotinas, perguntas frequentes, SEO e produtos relacionados.",
    ],
  },
  "perguntas-frequentes": {
    eyebrow: "Ajuda",
    title: "Perguntas Frequentes",
    intro: "Respostas claras para compra, envio, pagamento, produtos e atendimento.",
    paragraphs: [
      "A estrutura final deve ser editável no CMS, com blocos de FAQ, dados estruturados e busca por assunto.",
    ],
  },
  "trocas-e-devolucoes": {
    eyebrow: "Ajuda",
    title: "Trocas e Devoluções",
    intro:
      "Uma política de troca precisa ser fácil de entender antes e depois da compra.",
    paragraphs: [
      "Esta página deve receber a política oficial da marca no CMS, incluindo prazos, condições, atendimento e exceções.",
    ],
  },
  "política-de-privacidade": {
    eyebrow: "Privacidade",
    title: "Política de Privacidade",
    intro:
      "Dados de clientes, consentimento e comunicações devem seguir uma política clara e versionada.",
    paragraphs: [
      "A versão jurídica final deve ser publicada no CMS. O fluxo público e o super admin devem permanecer separados por permissão e por contexto de autenticação.",
    ],
  },
  "fale-conosco": {
    eyebrow: "Atendimento",
    title: "Fale Conosco",
    intro:
      "Atendimento da Flora para dúvidas sobre produtos, pedidos, envio e parcerias.",
    paragraphs: [
      "A etapa seguinte é ligar esta página ao Inbox, para que mensagens públicas criem conversas reais no painel.",
    ],
    cta: { label: "Ir para a conta", href: "/conta" },
  },
  instagram: {
    eyebrow: "Rede social",
    title: "Instagram",
    intro: "O link oficial do Instagram será configurado no CMS.",
    paragraphs: ["Enquanto isso, esta rota evita erro público e mantém a navegação consistente."],
  },
  facebook: {
    eyebrow: "Rede social",
    title: "Facebook",
    intro: "O link oficial do Facebook será configurado no CMS.",
    paragraphs: ["Enquanto isso, esta rota evita erro público e mantém a navegação consistente."],
  },
  pinterest: {
    eyebrow: "Rede social",
    title: "Pinterest",
    intro: "O link oficial do Pinterest será configurado no CMS.",
    paragraphs: ["Enquanto isso, esta rota evita erro público e mantém a navegação consistente."],
  },
};

export function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function publicFallbackPage(slug: string): PublicFallbackPage {
  return (
    PAGES[slug] ?? {
      eyebrow: "Flora Botanics",
      title: titleFromSlug(slug),
      intro: "Esta página está reservada para conteúdo editorial da Flora Botanics.",
      paragraphs: [
        "O conteúdo definitivo deve ser publicado pelo CMS. A rota já está viva para evitar links quebrados no site público.",
      ],
    }
  );
}
