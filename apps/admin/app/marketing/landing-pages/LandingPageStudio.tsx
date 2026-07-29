"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import {
  archiveMarketingLandingPage,
  createMarketingLandingPage,
  deleteMarketingLandingPage,
  duplicateMarketingLandingPage,
  updateMarketingLandingPage,
} from "../actions";

type LandingBlock = {
  type?: string;
  title?: string | null;
  text?: string | null;
  label?: string | null;
  url?: string | null;
};

type LandingContent = {
  eyebrow?: string | null;
  headline?: string | null;
  intro?: string | null;
  body?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  blocks?: LandingBlock[];
};

type LandingSeo = {
  title?: string | null;
  description?: string | null;
};

type LandingUtm = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
};

export type LandingPageRow = {
  id: string;
  campaign_id: string | null;
  slug: string;
  title: string;
  template_key: string | null;
  content: LandingContent | null;
  seo: LandingSeo | null;
  utm: LandingUtm | null;
  status: string;
  publish_at: string | null;
  created_at: string;
  updated_at: string;
};

type CampaignOption = {
  id: string;
  title: string;
};

type LandingPreset = {
  key: string;
  category: string;
  title: string;
  slug: string;
  description: string;
  eyebrow: string;
  headline: string;
  intro: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  accent: string;
  blocks: LandingBlock[];
};

const STATUS_OPTIONS: GlassSelectOption[] = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendada" },
  { value: "published", label: "Publicada" },
  { value: "paused", label: "Pausada" },
  { value: "archived", label: "Arquivada" },
];

const BLOCK_TYPE_OPTIONS: GlassSelectOption[] = [
  { value: "benefit", label: "Benefício" },
  { value: "product", label: "Produto ou kit" },
  { value: "testimonial", label: "Depoimento" },
  { value: "cta", label: "Chamada para ação" },
  { value: "faq", label: "Pergunta frequente" },
  { value: "image", label: "Imagem editorial" },
];

const VIEW_OPTIONS: GlassSelectOption[] = [
  { value: "grid", label: "Cards grandes" },
  { value: "compact", label: "Lista compacta" },
];

const PRESETS: LandingPreset[] = [
  {
    key: "editorial-launch",
    category: "Lançamento",
    title: "Lançamento editorial",
    slug: "lancamento-editorial",
    description: "Página premium para apresentar um produto novo, ritual ou coleção Flora.",
    eyebrow: "Novo ritual Flora",
    headline: "A inteligência da natureza em uma nova rotina",
    intro: "Uma landing elegante para explicar benefício, textura, ativos e convite de compra sem parecer uma página genérica.",
    body: "Use esta página para construir desejo antes da compra: apresente o conceito, destaque a sensorialidade, conecte os ativos ao resultado esperado e conduza o visitante para o catálogo.",
    ctaLabel: "Conhecer lançamento",
    ctaUrl: "/produtos",
    accent: "#d9b87a",
    blocks: [
      { type: "benefit", title: "Benefício central", text: "Explique o ganho principal para a pele em linguagem clara e editorial." },
      { type: "product", title: "Produto em destaque", text: "Conecte o produto, o kit ou a rotina aos argumentos da campanha." },
      { type: "testimonial", title: "Confiança antes da compra", text: "Use avaliação, prova social, garantia ou nota técnica resumida." },
    ],
  },
  {
    key: "vip-access",
    category: "Captação",
    title: "Lista VIP e acesso antecipado",
    slug: "lista-vip-acesso-antecipado",
    description: "Modelo para captar leads antes de lançamentos, datas especiais e kits limitados.",
    eyebrow: "Acesso antecipado",
    headline: "Entre antes na lista Flora",
    intro: "Convide visitantes a receber novidades, benefícios e acesso antecipado com uma promessa objetiva.",
    body: "Ideal para lançamento, reposição limitada ou campanha com benefício para quem chega primeiro.",
    ctaLabel: "Quero entrar na lista",
    ctaUrl: "/conta",
    accent: "#7fbf9e",
    blocks: [
      { type: "benefit", title: "Desconto de lançamento", text: "Informe o benefício de entrada sem exagero promocional." },
      { type: "benefit", title: "Amostras e conteúdos", text: "Mostre o valor de relacionamento além da venda imediata." },
      { type: "cta", title: "Chamada final", text: "Reforce privacidade, frequência e consentimento.", label: "Cadastrar interesse", url: "/conta" },
    ],
  },
  {
    key: "b2b-proposal",
    category: "B2B",
    title: "Proposta para lojas e parceiros",
    slug: "proposta-b2b-parceiros",
    description: "Modelo comercial para clínicas, hotéis, lojas, revendedores e presentes corporativos.",
    eyebrow: "Flora para parceiros",
    headline: "Produtos botânicos para operações que valorizam cuidado",
    intro: "Apresente a Flora como parceira comercial, com condições, curadoria e logística preparada.",
    body: "Use esta landing para leads B2B: explique linhas, kits, personalização, prazos, volumes mínimos e canais de contato.",
    ctaLabel: "Solicitar proposta",
    ctaUrl: "/contato",
    accent: "#e28d80",
    blocks: [
      { type: "product", title: "Linhas e kits", text: "Mostre linhas indicadas para varejo, hotelaria, clínicas e presentes corporativos." },
      { type: "benefit", title: "Condição comercial", text: "Inclua prazo, volume, embalagem, suporte e personalização." },
      { type: "cta", title: "Próximo passo", text: "Direcione para orçamento ou atendimento comercial.", label: "Falar com comercial", url: "/contato" },
    ],
  },
  {
    key: "abandoned-cart",
    category: "Remarketing",
    title: "Carrinho salvo",
    slug: "carrinho-salvo",
    description: "Página curta para recuperar carrinhos com benefício, prova social e retorno ao checkout.",
    eyebrow: "Seu ritual ficou salvo",
    headline: "Ainda dá tempo de finalizar com calma",
    intro: "Uma página de recuperação para explicar benefício, remover dúvida e trazer o cliente de volta.",
    body: "Combine com e-mails de carrinho abandonado, cupons controlados e links diretos para o carrinho.",
    ctaLabel: "Voltar ao carrinho",
    ctaUrl: "/carrinho",
    accent: "#d5796f",
    blocks: [
      { type: "benefit", title: "Compra segura", text: "Explique checkout, pagamento e privacidade em poucas linhas." },
      { type: "faq", title: "Dúvida rápida", text: "Tire objeções comuns: entrega, pagamento, troca ou uso." },
      { type: "cta", title: "Retomar compra", text: "Use um botão direto para o carrinho ou produto.", label: "Finalizar compra", url: "/carrinho" },
    ],
  },
  {
    key: "post-sale-ritual",
    category: "Pós-venda",
    title: "Guia de uso pós-venda",
    slug: "guia-pos-venda",
    description: "Página educativa para orientar rotina, recompra e avaliação após a entrega.",
    eyebrow: "Depois da entrega",
    headline: "Como incluir seu ritual Flora na rotina",
    intro: "Um modelo para reduzir dúvidas, aumentar satisfação e preparar recompra no momento certo.",
    body: "Use em jornadas pós-venda: instruções de uso, frequência, cuidados, avaliação e sugestão de complemento.",
    ctaLabel: "Ver rotina completa",
    ctaUrl: "/produtos",
    accent: "#b9924d",
    blocks: [
      { type: "benefit", title: "Primeiros dias", text: "Explique como começar o uso sem excesso de promessa." },
      { type: "faq", title: "Perguntas comuns", text: "Inclua aplicação, conservação, combinação e frequência." },
      { type: "cta", title: "Avaliar experiência", text: "Direcione para avaliação ou atendimento.", label: "Enviar avaliação", url: "/conta" },
    ],
  },
  {
    key: "seasonal-campaign",
    category: "Data comemorativa",
    title: "Campanha sazonal",
    slug: "campanha-sazonal",
    description: "Modelo para Dia das Mães, Natal, Black Friday, aniversário da marca e ações especiais.",
    eyebrow: "Edição especial",
    headline: "Um cuidado Flora para marcar a data",
    intro: "Combine oferta, kit, prazo de entrega e urgência com estética editorial.",
    body: "Este modelo organiza benefício, kit, prazo, presenteabilidade e CTA sem virar uma página poluída.",
    ctaLabel: "Ver seleção especial",
    ctaUrl: "/produtos",
    accent: "#f2ecdf",
    blocks: [
      { type: "product", title: "Seleção da data", text: "Mostre os kits, combos ou produtos relacionados à campanha." },
      { type: "benefit", title: "Prazo e disponibilidade", text: "Informe estoque, data limite e condições com clareza." },
      { type: "cta", title: "Escolha seu presente", text: "Finalize com uma chamada objetiva.", label: "Comprar seleção", url: "/produtos" },
    ],
  },
];

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function formatDate(iso: string | null) {
  if (!iso) return "Sem agendamento";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function publicLink(baseUrl: string, slug: string) {
  return `${baseUrl.replace(/\/+$/, "")}/l/${slug.replace(/^\/+/, "")}`;
}

function blocksFromPage(page: LandingPageRow): LandingBlock[] {
  const blocks = page.content?.blocks;
  if (Array.isArray(blocks) && blocks.length) return blocks;
  return [{ type: "benefit", title: "Primeiro bloco", text: "Edite este bloco para começar a página." }];
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function LandingPageStudio({
  pages,
  campaigns,
  publicBaseUrl,
}: {
  pages: LandingPageRow[];
  campaigns: CampaignOption[];
  publicBaseUrl: string;
}) {
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(pages[0]?.id ?? "");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const selected = pages.find((page) => page.id === selectedId) ?? pages[0] ?? null;

  const filteredPages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return pages;
    return pages.filter((page) => {
      return [page.title, page.slug, page.template_key, page.status]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(normalized));
    });
  }, [pages, query]);

  async function copyLandingLink(page: LandingPageRow) {
    await navigator.clipboard.writeText(publicLink(publicBaseUrl, page.slug));
    setCopiedId(page.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section style={heroStyle}>
        <div>
          <Link href="/marketing" className="eyebrow" style={{ opacity: 0.82 }}>
            ← Marketing
          </Link>
          <p className="eyebrow" style={{ marginTop: 18 }}>Landing pages</p>
          <h1 className="display" style={{ fontSize: 42, marginTop: 8 }}>
            Páginas de campanha editáveis
          </h1>
          <p className="muted" style={{ maxWidth: 720, lineHeight: 1.7, fontSize: 14 }}>
            Crie modelos prontos, edite blocos, publique links de campanha e mantenha cada landing
            conectada ao marketing da Flora.
          </p>
        </div>
        <div style={heroStatsStyle}>
          <Metric label="Total" value={pages.length} />
          <Metric label="Publicadas" value={pages.filter((page) => page.status === "published").length} />
          <Metric label="Rascunhos" value={pages.filter((page) => page.status === "draft").length} />
        </div>
      </section>

      <section style={panelStyle}>
        <div style={sectionHeadStyle}>
          <div>
            <p className="eyebrow">Modelos prontos Flora</p>
            <h2 style={sectionTitleStyle}>Crie uma página editável sem começar do zero</h2>
          </div>
          <Link href="/marketing/templates" className="btn btn-ghost" style={smallButtonStyle}>
            Ver templates de e-mail
          </Link>
        </div>

        <div style={presetGridStyle}>
          {PRESETS.map((preset) => (
            <PresetCard key={preset.key} preset={preset} />
          ))}
        </div>
      </section>

      <section style={panelStyle}>
        <div style={sectionHeadStyle}>
          <div>
            <p className="eyebrow">Páginas criadas</p>
            <h2 style={sectionTitleStyle}>Links, status e ações</h2>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar landing..."
              style={{ ...inputStyle, width: 220 }}
            />
            <GlassSelect
              value={view}
              onChange={setView}
              options={VIEW_OPTIONS}
              ariaLabel="Visualização das landing pages"
              inlineMenu
              style={{ width: 180 }}
            />
          </div>
        </div>

        {filteredPages.length === 0 ? (
          <div style={emptyStyle}>
            Nenhuma landing page encontrada. Use um modelo pronto acima para criar a primeira.
          </div>
        ) : (
          <div style={view === "grid" ? pageGridStyle : compactListStyle}>
            {filteredPages.map((page) => (
              <LandingCard
                key={page.id}
                page={page}
                publicBaseUrl={publicBaseUrl}
                copied={copiedId === page.id}
                selected={selected?.id === page.id}
                onCopy={() => void copyLandingLink(page)}
                onEdit={() => setSelectedId(page.id)}
              />
            ))}
          </div>
        )}
      </section>

      <LandingEditor
        key={selected?.id ?? "empty"}
        page={selected}
        campaigns={campaigns}
        publicBaseUrl={publicBaseUrl}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricStyle}>
      <strong style={{ color: "var(--gold-light)", fontSize: 24 }}>{value}</strong>
      <span className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
    </div>
  );
}

function PresetCard({ preset }: { preset: LandingPreset }) {
  return (
    <article style={presetCardStyle}>
      <div style={miniPreviewStyle}>
        <div style={{ ...miniPreviewHeaderStyle, background: `linear-gradient(135deg, #102314, ${preset.accent}44)` }}>
          <span>{preset.eyebrow}</span>
        </div>
        <div style={miniPreviewBodyStyle}>
          <strong>{preset.headline}</strong>
          <p>{preset.intro}</p>
          <span style={{ ...miniPreviewButtonStyle, borderColor: preset.accent }}>{preset.ctaLabel}</span>
        </div>
      </div>
      <div style={presetContentStyle}>
        <span className="chip chip-draft">{preset.category}</span>
        <h3 style={cardTitleStyle}>{preset.title}</h3>
        <p className="muted" style={cardTextStyle}>{preset.description}</p>
        <form action={createMarketingLandingPage} style={{ marginTop: "auto" }}>
          <input type="hidden" name="title" value={preset.title} />
          <input type="hidden" name="slug" value={preset.slug} />
          <input type="hidden" name="template_key" value={preset.key} />
          <input type="hidden" name="status" value="draft" />
          <input type="hidden" name="eyebrow" value={preset.eyebrow} />
          <input type="hidden" name="headline" value={preset.headline} />
          <input type="hidden" name="intro" value={preset.intro} />
          <input type="hidden" name="body" value={preset.body} />
          <input type="hidden" name="cta_label" value={preset.ctaLabel} />
          <input type="hidden" name="cta_url" value={preset.ctaUrl} />
          <input type="hidden" name="seo_title" value={preset.headline} />
          <input type="hidden" name="seo_description" value={preset.intro} />
          <input type="hidden" name="utm_source" value="cms" />
          <input type="hidden" name="utm_medium" value="landing-page" />
          <input type="hidden" name="utm_campaign" value={preset.slug} />
          <input type="hidden" name="blocks" value={JSON.stringify(preset.blocks)} />
          <button className="btn btn-gold" style={wideButtonStyle}>
            Criar landing editável
          </button>
        </form>
      </div>
    </article>
  );
}

function LandingCard({
  page,
  publicBaseUrl,
  copied,
  selected,
  onCopy,
  onEdit,
}: {
  page: LandingPageRow;
  publicBaseUrl: string;
  copied: boolean;
  selected: boolean;
  onCopy: () => void;
  onEdit: () => void;
}) {
  const link = publicLink(publicBaseUrl, page.slug);
  return (
    <article style={{ ...pageCardStyle, borderColor: selected ? "rgba(217, 184, 122, 0.58)" : "var(--glass-border)" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <span className={page.status === "published" ? "chip chip-live" : "chip chip-draft"}>
            {statusLabel(page.status)}
          </span>
          <span className="muted" style={{ fontSize: 10 }}>{formatDate(page.publish_at)}</span>
        </div>
        <h3 style={cardTitleStyle}>{page.title}</h3>
        <p className="muted" style={cardTextStyle}>
          {page.content?.intro ?? "Página editável criada para campanha, lead ou relacionamento."}
        </p>
        <div style={linkBoxStyle}>{link}</div>
      </div>

      <div style={buttonRowStyle}>
        <button type="button" className="btn btn-gold" style={smallButtonStyle} onClick={onEdit}>
          Editar
        </button>
        <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost" style={smallButtonStyle}>
          Abrir
        </a>
        <button type="button" className="btn btn-ghost" style={smallButtonStyle} onClick={onCopy}>
          {copied ? "Copiado" : "Copiar link"}
        </button>
        <form action={duplicateMarketingLandingPage.bind(null, page.id)}>
          <button className="btn btn-ghost" style={smallButtonStyle}>Duplicar</button>
        </form>
        {page.status === "archived" ? null : (
          <form action={archiveMarketingLandingPage.bind(null, page.id)}>
            <button className="btn btn-ghost" style={smallButtonStyle}>Arquivar</button>
          </form>
        )}
        <form
          action={deleteMarketingLandingPage.bind(null, page.id)}
          onSubmit={(event) => {
            if (!confirm(`Excluir "${page.title}"? Essa ação remove a landing page do CMS.`)) event.preventDefault();
          }}
        >
          <button className="btn btn-ghost" style={{ ...smallButtonStyle, color: "#e8a0a0", borderColor: "rgba(232,160,160,0.42)" }}>
            Excluir
          </button>
        </form>
      </div>
    </article>
  );
}

function LandingEditor({
  page,
  campaigns,
  publicBaseUrl,
}: {
  page: LandingPageRow | null;
  campaigns: CampaignOption[];
  publicBaseUrl: string;
}) {
  const [title, setTitle] = useState(page?.title ?? "Nova landing Flora");
  const [slug, setSlug] = useState(page?.slug ?? "nova-landing");
  const [status, setStatus] = useState(page?.status ?? "draft");
  const [publishAt, setPublishAt] = useState(page?.publish_at?.slice(0, 16) ?? "");
  const [blocks, setBlocks] = useState<LandingBlock[]>(page ? blocksFromPage(page) : PRESETS[0].blocks);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const content = page?.content ?? {};
  const seo = page?.seo ?? {};
  const utm = page?.utm ?? {};
  const campaignOptions: GlassSelectOption[] = [
    { value: "", label: "Sem campanha vinculada" },
    ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.title })),
  ];

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    setBlocks((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function updateBlock(index: number, patch: Partial<LandingBlock>) {
    setBlocks((current) => current.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  }

  function removeBlock(index: number) {
    setBlocks((current) => current.filter((_, i) => i !== index));
  }

  function addBlock() {
    setBlocks((current) => [...current, { type: "benefit", title: "Nova seção", text: "Edite o conteúdo deste bloco." }]);
  }

  function dropBlock(index: number) {
    if (dragIndex === null || dragIndex === index) return;
    setBlocks((current) => {
      const next = [...current];
      const [item] = next.splice(dragIndex, 1);
      next.splice(index, 0, item);
      return next;
    });
    setDragIndex(null);
  }

  const link = page ? publicLink(publicBaseUrl, page.slug) : `${publicBaseUrl}/l/${slug}`;
  const submitAction = page ? updateMarketingLandingPage.bind(null, page.id) : createMarketingLandingPage;

  return (
    <section style={editorShellStyle}>
      <div style={sectionHeadStyle}>
        <div>
          <p className="eyebrow">Editor visual</p>
          <h2 style={sectionTitleStyle}>{page ? `Editando: ${page.title}` : "Criar landing manual"}</h2>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" style={smallButtonStyle} onClick={addBlock}>
            + Adicionar bloco
          </button>
          <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost" style={smallButtonStyle}>
            Abrir link
          </a>
        </div>
      </div>

      <div style={editorGridStyle}>
        <form action={submitAction} style={formPanelStyle}>
          <div style={formGridStyle}>
            <Field label="Título">
              <input
                name="title"
                required
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (!page) setSlug(slugify(event.target.value));
                }}
                style={inputStyle}
              />
            </Field>
            <Field label="Slug público">
              <input name="slug" required value={slug} onChange={(event) => setSlug(slugify(event.target.value))} style={inputStyle} />
            </Field>
            <Field label="Campanha">
              <GlassSelect
                name="campaign_id"
                defaultValue={page?.campaign_id ?? ""}
                options={campaignOptions}
                ariaLabel="Campanha vinculada"
                inlineMenu
              />
            </Field>
            <Field label="Status">
              <GlassSelect name="status" value={status} onChange={setStatus} options={STATUS_OPTIONS} ariaLabel="Status da landing page" inlineMenu />
            </Field>
            <Field label="Publicar em">
              <GlassDateInput name="publish_at" value={publishAt} onChange={setPublishAt} withTime placeholder="Opcional" inlinePopover />
            </Field>
            <Field label="Modelo">
              <input name="template_key" defaultValue={page?.template_key ?? "manual-flora"} style={inputStyle} />
            </Field>
            <Field label="Chamada curta">
              <input name="eyebrow" defaultValue={content.eyebrow ?? ""} style={inputStyle} placeholder="Lançamento Flora" />
            </Field>
            <Field label="Título principal">
              <input name="headline" defaultValue={content.headline ?? title} style={inputStyle} placeholder="Headline da página" />
            </Field>
            <Field label="Texto do botão">
              <input name="cta_label" defaultValue={content.cta_label ?? ""} style={inputStyle} placeholder="Conhecer produtos" />
            </Field>
            <Field label="Link do botão">
              <input name="cta_url" defaultValue={content.cta_url ?? ""} style={inputStyle} placeholder="/produtos" />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Introdução</label>
              <textarea name="intro" rows={3} defaultValue={content.intro ?? ""} style={textareaStyle} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Texto editorial</label>
              <textarea name="body" rows={5} defaultValue={content.body ?? ""} style={textareaStyle} />
            </div>
            <Field label="SEO título">
              <input name="seo_title" defaultValue={seo.title ?? ""} style={inputStyle} />
            </Field>
            <Field label="SEO descrição">
              <input name="seo_description" defaultValue={seo.description ?? ""} style={inputStyle} />
            </Field>
            <Field label="UTM origem">
              <input name="utm_source" defaultValue={utm.source ?? ""} style={inputStyle} placeholder="newsletter" />
            </Field>
            <Field label="UTM mídia">
              <input name="utm_medium" defaultValue={utm.medium ?? ""} style={inputStyle} placeholder="email" />
            </Field>
            <Field label="UTM campanha">
              <input name="utm_campaign" defaultValue={utm.campaign ?? ""} style={inputStyle} placeholder="lançamento" />
            </Field>
          </div>

          <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            <p className="eyebrow">Blocos da página</p>
            {blocks.map((block, index) => (
              <div
                key={`${block.type}-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropBlock(index)}
                style={blockEditorStyle}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span className="chip chip-draft">Arraste para ordenar</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-ghost" style={tinyButtonStyle} onClick={() => moveBlock(index, -1)}>
                      ↑
                    </button>
                    <button type="button" className="btn btn-ghost" style={tinyButtonStyle} onClick={() => moveBlock(index, 1)}>
                      ↓
                    </button>
                    <button type="button" className="btn btn-ghost" style={{ ...tinyButtonStyle, color: "#e8a0a0" }} onClick={() => removeBlock(index)}>
                      Excluir
                    </button>
                  </div>
                </div>
                <div style={blockFieldsStyle}>
                  <Field label="Tipo">
                    <GlassSelect
                      value={block.type ?? "benefit"}
                      onChange={(value) => updateBlock(index, { type: value })}
                      options={BLOCK_TYPE_OPTIONS}
                      ariaLabel={`Tipo do bloco ${index + 1}`}
                      inlineMenu
                    />
                  </Field>
                  <Field label="Título">
                    <input value={block.title ?? ""} onChange={(event) => updateBlock(index, { title: event.target.value })} style={inputStyle} />
                  </Field>
                  <Field label="Texto">
                    <input value={block.text ?? ""} onChange={(event) => updateBlock(index, { text: event.target.value })} style={inputStyle} />
                  </Field>
                  <Field label="Botão">
                    <input value={block.label ?? ""} onChange={(event) => updateBlock(index, { label: event.target.value })} style={inputStyle} placeholder="Opcional" />
                  </Field>
                  <Field label="URL">
                    <input value={block.url ?? ""} onChange={(event) => updateBlock(index, { url: event.target.value })} style={inputStyle} placeholder="/produtos" />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <button className="btn btn-gold" style={wideButtonStyle}>Salvar página</button>
            <button type="button" className="btn btn-ghost" style={wideButtonStyle} onClick={addBlock}>
              Incluir item na página
            </button>
          </div>
        </form>

        <LandingPreview title={title} status={status} publicLink={link} content={content} blocks={blocks} />
      </div>
    </section>
  );
}

function LandingPreview({
  title,
  status,
  publicLink,
  content,
  blocks,
}: {
  title: string;
  status: string;
  publicLink: string;
  content: LandingContent;
  blocks: LandingBlock[];
}) {
  return (
    <aside style={previewShellStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <div>
          <p className="eyebrow">Prévia</p>
          <h3 style={{ margin: "4px 0 0", fontSize: 22 }}>{title}</h3>
        </div>
        <span className={status === "published" ? "chip chip-live" : "chip chip-draft"}>{statusLabel(status)}</span>
      </div>
      <div style={previewCanvasStyle}>
        <div style={previewHeaderStyle}>FLORA BOTANICS</div>
        <div style={previewBodyStyle}>
          <span style={previewEyebrowStyle}>{content.eyebrow || "Campanha Flora"}</span>
          <h4>{content.headline || title}</h4>
          <p>{content.intro || "Introdução da landing page."}</p>
          <div style={previewBlockGridStyle}>
            {blocks.slice(0, 4).map((block, index) => (
              <div key={index} style={previewBlockStyle}>
                <strong>{block.title || "Seção"}</strong>
                <span>{block.text || "Conteúdo deste bloco."}</span>
              </div>
            ))}
          </div>
          <span style={previewCtaStyle}>{content.cta_label || "Chamada da campanha"}</span>
        </div>
      </div>
      <div style={linkBoxStyle}>{publicLink}</div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 7, alignContent: "start" }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

const heroStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.35fr) minmax(260px, 0.65fr)",
  gap: 18,
  alignItems: "end",
  background: "linear-gradient(135deg, rgba(242,236,223,0.09), rgba(185,146,77,0.10))",
  border: "1px solid var(--glass-border)",
  borderRadius: 18,
  padding: 24,
  boxShadow: "var(--shadow-soft)",
};

const heroStatsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const metricStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minHeight: 78,
  padding: 14,
  background: "rgba(10, 22, 11, 0.38)",
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
};

const panelStyle: CSSProperties = {
  background: "var(--glass-bg-strong)",
  border: "1px solid var(--glass-border)",
  borderRadius: 18,
  padding: 22,
  boxShadow: "var(--shadow-soft)",
  backdropFilter: "blur(18px) saturate(1.25)",
};

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 18,
};

const sectionTitleStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 24,
  lineHeight: 1.1,
};

const presetGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
};

const presetCardStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "185px 1fr",
  minHeight: 455,
  overflow: "hidden",
  border: "1px solid var(--glass-border)",
  borderRadius: 16,
  background: "rgba(10, 22, 11, 0.34)",
};

const presetContentStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minHeight: 0,
  padding: 18,
};

const miniPreviewStyle: CSSProperties = {
  margin: 16,
  marginBottom: 0,
  border: "1px solid rgba(242,236,223,0.24)",
  borderRadius: 14,
  overflow: "hidden",
  background: "var(--cream)",
  color: "#173019",
};

const miniPreviewHeaderStyle: CSSProperties = {
  padding: "18px 20px",
  color: "var(--cream)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 2,
  fontWeight: 900,
};

const miniPreviewBodyStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 18,
  fontSize: 12,
  lineHeight: 1.45,
};

const miniPreviewButtonStyle: CSSProperties = {
  justifySelf: "start",
  border: "1px solid",
  borderRadius: 999,
  padding: "7px 12px",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  fontWeight: 900,
};

const pageGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 12,
};

const compactListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const pageCardStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  minHeight: 275,
  alignContent: "space-between",
  padding: 18,
  border: "1px solid var(--glass-border)",
  borderRadius: 16,
  background: "rgba(255,248,234,0.055)",
};

const cardTitleStyle: CSSProperties = {
  margin: "10px 0 6px",
  fontSize: 21,
  lineHeight: 1.15,
};

const cardTextStyle: CSSProperties = {
  margin: 0,
  lineHeight: 1.6,
  minHeight: 66,
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const smallButtonStyle: CSSProperties = {
  minHeight: 38,
  padding: "9px 16px",
  fontSize: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const tinyButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: "5px 10px",
  fontSize: 9,
};

const wideButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: "10px 18px",
  fontSize: 10,
};

const linkBoxStyle: CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(242,236,223,0.12)",
  background: "rgba(10,22,11,0.38)",
  color: "var(--cream-dim)",
  fontSize: 11,
  wordBreak: "break-all",
};

const emptyStyle: CSSProperties = {
  border: "1px dashed var(--glass-border)",
  borderRadius: 14,
  padding: 22,
  color: "var(--cream-dim)",
};

const editorShellStyle: CSSProperties = {
  ...panelStyle,
  position: "relative",
  overflow: "visible",
};

const editorGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(380px, 1.2fr) minmax(320px, 0.8fr)",
  gap: 18,
  alignItems: "start",
};

const formPanelStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  minWidth: 0,
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const labelStyle: CSSProperties = {
  color: "var(--cream-dim)",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 1.4,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  border: "1px solid var(--glass-border)",
  borderRadius: 10,
  padding: "10px 12px",
  background: "rgba(10, 22, 11, 0.46)",
  color: "var(--cream)",
  outline: "none",
  fontFamily: "inherit",
  fontSize: 13,
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 96,
  resize: "vertical",
  lineHeight: 1.55,
};

const blockEditorStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 14,
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  background: "rgba(255,248,234,0.05)",
  cursor: "grab",
};

const blockFieldsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(130px, 0.6fr) minmax(180px, 1fr) minmax(220px, 1.35fr)",
  gap: 10,
};

const previewShellStyle: CSSProperties = {
  position: "sticky",
  top: 18,
  minWidth: 0,
  padding: 18,
  border: "1px solid var(--glass-border)",
  borderRadius: 16,
  background: "rgba(10, 22, 11, 0.38)",
};

const previewCanvasStyle: CSSProperties = {
  overflow: "hidden",
  border: "1px solid rgba(242,236,223,0.2)",
  borderRadius: 16,
  background: "var(--cream)",
  color: "#173019",
};

const previewHeaderStyle: CSSProperties = {
  padding: "20px 24px",
  background: "linear-gradient(135deg, #102314, #2f3d24)",
  color: "var(--cream)",
  textAlign: "center",
  letterSpacing: 3,
  fontWeight: 900,
};

const previewBodyStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 26,
};

const previewEyebrowStyle: CSSProperties = {
  color: "#b9924d",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 2,
  fontWeight: 900,
};

const previewBlockGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const previewBlockStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minHeight: 100,
  padding: 14,
  border: "1px solid rgba(23,48,25,0.14)",
  background: "rgba(23,48,25,0.05)",
};

const previewCtaStyle: CSSProperties = {
  justifySelf: "start",
  borderRadius: 999,
  padding: "11px 18px",
  background: "#173019",
  color: "var(--cream)",
  textTransform: "uppercase",
  letterSpacing: 1.4,
  fontSize: 10,
  fontWeight: 900,
};
