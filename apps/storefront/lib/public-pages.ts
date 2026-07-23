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
    title: "Sobre Nos",
    intro:
      "A Flora Botanics nasce da aproximacao entre botanica, ciencia cosmetica e cuidado cotidiano.",
    paragraphs: [
      "Criamos formulas inspiradas pela biodiversidade brasileira, com uma linguagem visual silenciosa, precisa e sensorial.",
      "Cada pagina institucional podera ser substituida por conteudo editorial completo no CMS. Ate la, o site publico apresenta uma base limpa, coerente e segura para navegacao.",
    ],
  },
  ingredientes: {
    eyebrow: "Ciencia Botanica",
    title: "Ingredientes",
    intro:
      "Ativos botanicos, texturas inteligentes e escolhas de formulacao com proposito.",
    paragraphs: [
      "Esta area sera dedicada aos ingredientes principais da marca, com beneficios, origem, modo de uso e relacao com cada rotina.",
      "O CMS deve evoluir para permitir fichas editoriais de ingredientes, produtos relacionados e conteudo tecnico sem aparencia de texto solto.",
    ],
  },
  sustentabilidade: {
    eyebrow: "Responsabilidade",
    title: "Sustentabilidade",
    intro:
      "Compromissos ambientais devem ser comunicados com clareza, sem exagero e sem promessas vazias.",
    paragraphs: [
      "A pagina definitiva deve publicar apenas praticas verificaveis: embalagem, cadeia de fornecimento, descarte, logistica e escolhas de producao.",
      "Enquanto o conteudo final e estruturado no CMS, esta rota permanece viva e coerente com a identidade publica da Flora.",
    ],
  },
  blog: {
    eyebrow: "Editorial",
    title: "Blog",
    intro:
      "Guias, rituais e conteudos de skincare devem funcionar como extensao da experiencia da marca.",
    paragraphs: [
      "O modulo editorial definitivo deve suportar artigos, ingredientes, rotinas, perguntas frequentes, SEO e produtos relacionados.",
    ],
  },
  "perguntas-frequentes": {
    eyebrow: "Ajuda",
    title: "Perguntas Frequentes",
    intro: "Respostas claras para compra, envio, pagamento, produtos e atendimento.",
    paragraphs: [
      "A estrutura final deve ser editavel no CMS, com blocos de FAQ, dados estruturados e busca por assunto.",
    ],
  },
  "trocas-e-devolucoes": {
    eyebrow: "Ajuda",
    title: "Trocas e Devolucoes",
    intro:
      "Uma politica de troca precisa ser facil de entender antes e depois da compra.",
    paragraphs: [
      "Esta pagina deve receber a politica oficial da marca no CMS, incluindo prazos, condicoes, atendimento e excecoes.",
    ],
  },
  "politica-de-privacidade": {
    eyebrow: "Privacidade",
    title: "Politica de Privacidade",
    intro:
      "Dados de clientes, consentimento e comunicacoes devem seguir uma politica clara e versionada.",
    paragraphs: [
      "A versao juridica final deve ser publicada no CMS. O fluxo publico e o super admin devem permanecer separados por permissao e por contexto de autenticacao.",
    ],
  },
  "fale-conosco": {
    eyebrow: "Atendimento",
    title: "Fale Conosco",
    intro:
      "Atendimento da Flora para duvidas sobre produtos, pedidos, envio e parcerias.",
    paragraphs: [
      "A etapa seguinte e ligar esta pagina ao Inbox, para que mensagens publicas criem conversas reais no painel.",
    ],
    cta: { label: "Ir para a conta", href: "/conta" },
  },
  instagram: {
    eyebrow: "Rede social",
    title: "Instagram",
    intro: "O link oficial do Instagram sera configurado no CMS.",
    paragraphs: ["Enquanto isso, esta rota evita erro publico e mantem a navegacao consistente."],
  },
  facebook: {
    eyebrow: "Rede social",
    title: "Facebook",
    intro: "O link oficial do Facebook sera configurado no CMS.",
    paragraphs: ["Enquanto isso, esta rota evita erro publico e mantem a navegacao consistente."],
  },
  pinterest: {
    eyebrow: "Rede social",
    title: "Pinterest",
    intro: "O link oficial do Pinterest sera configurado no CMS.",
    paragraphs: ["Enquanto isso, esta rota evita erro publico e mantem a navegacao consistente."],
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
      intro: "Esta pagina esta reservada para conteudo editorial da Flora Botanics.",
      paragraphs: [
        "O conteudo definitivo deve ser publicado pelo CMS. A rota ja esta viva para evitar links quebrados no site publico.",
      ],
    }
  );
}
