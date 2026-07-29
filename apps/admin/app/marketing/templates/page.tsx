import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import {
  createMarketingLandingPage,
  createMarketingTemplate,
  installAllMarketingTemplateBlueprints,
  installMarketingTemplateBlueprint,
} from "../actions";

type BlueprintRow = {
  id: string;
  name: string;
  channel: string;
  category: string;
  subject: string | null;
  description: string;
  variables: string[];
};

type TemplateRow = {
  id: string;
  name: string;
  channel: string;
  category: string | null;
  subject: string | null;
  status: string;
  preview: string | null;
  variables: string[] | null;
  updated_at: string;
};

const CHANNEL_OPTIONS: GlassSelectOption[] = [
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "internal", label: "Interno" },
];

const STATUS_OPTIONS: GlassSelectOption[] = [
  { value: "draft", label: "Rascunho" },
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
  { value: "archived", label: "Arquivado" },
];

const LANDING_TEMPLATE_PRESETS = [
  {
    key: "lancamento-editorial",
    category: "Lançamento",
    title: "Lançamento editorial",
    eyebrow: "Nova campanha Flora",
    headline: "Uma rotina apresentada como editorial de marca",
    intro: "Página com narrativa premium, benefício principal, produto em destaque e CTA para compra.",
    cta: "Conhecer campanha",
    tone: "editorial",
  },
  {
    key: "captacao-leads",
    category: "Leads",
    title: "Captação de leads",
    eyebrow: "Lista de espera",
    headline: "Receba acesso antecipado",
    intro: "Modelo para lançamento, newsletter, lista VIP, campanha paga ou conteúdo de skincare.",
    cta: "Entrar na lista",
    tone: "lead",
  },
  {
    key: "b2b-proposta",
    category: "B2B",
    title: "Proposta para parceiros",
    eyebrow: "Flora para empresas",
    headline: "Uma proposta comercial com cuidado e rastreabilidade",
    intro: "Página para lojas, clínicas, hotéis, farmácias, eventos e presentes corporativos.",
    cta: "Solicitar proposta",
    tone: "b2b",
  },
  {
    key: "carrinho-retorno",
    category: "Remarketing",
    title: "Retorno ao carrinho",
    eyebrow: "Seu ritual ficou salvo",
    headline: "Volte para concluir sua compra",
    intro: "Modelo curto para recuperar carrinhos com benefício, prova social e botão direto.",
    cta: "Voltar ao carrinho",
    tone: "remarketing",
  },
];

export default async function MarketingTemplatesPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: blueprints, error: blueprintError }, { data: templates, error: templateError }] = await Promise.all([
    supabase
      .from("marketing_template_blueprints")
      .select("id, name, channel, category, subject, description, variables")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("message_templates")
      .select("id, name, channel, category, subject, status, preview, variables, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false }),
  ]);

  if (blueprintError || templateError) {
    return (
      <main style={pageStyle}>
        <Header />
        <section className="glass" style={{ ...cardStyle, borderColor: "rgba(232,160,160,0.45)" }}>
          <p className="eyebrow" style={{ color: "#e8a0a0", marginBottom: 8 }}>Migration pendente</p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            A biblioteca de templates depende da fundação de Marketing e Relacionamento.
            Aplique a migration mais recente e recarregue esta página.
          </p>
        </section>
      </main>
    );
  }

  const blueprintRows = (blueprints ?? []) as BlueprintRow[];
  const templateRows = (templates ?? []) as TemplateRow[];
  const installedNames = new Set(templateRows.map((template) => template.name));
  const categories = Array.from(new Set(blueprintRows.map((template) => template.category)));
  const slugSuffix = Date.now().toString(36);

  return (
    <main style={pageStyle}>
      <Header />

      <section className="rise" style={kpiGridStyle}>
        <Kpi label="Modelos Flora" value={`${blueprintRows.length}`} note={`${categories.length} categorias prontas`} />
        <Kpi label="Templates editáveis" value={`${templateRows.length}`} note="salvos no tenant atual" />
        <Kpi label="E-mails" value={`${templateRows.filter((template) => template.channel === "email").length}`} note="compatíveis com Resend" />
        <Kpi label="Canais" value={`${new Set(templateRows.map((template) => template.channel)).size}`} note="e-mail, SMS, WhatsApp e interno" />
      </section>

      <section className="glass rise rise-1" style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Biblioteca editorial</p>
            <h2 style={{ margin: 0, fontSize: 30 }}>Modelos prontos com prévia real</h2>
            <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.7, maxWidth: 760 }}>
              Instale modelos de e-mail, SMS, WhatsApp e mensagens transacionais já estruturados para
              Resend e para o editor visual. Nada de montar corpo técnico na mão.
            </p>
          </div>
          <div style={buttonClusterStyle}>
            <form action={installAllMarketingTemplateBlueprints}>
              <button className="btn btn-gold" style={smallButtonStyle}>Instalar todos</button>
            </form>
            <Link href="/backoffice/mensagens" className="btn btn-ghost" style={smallButtonStyle}>Editor visual</Link>
            <Link href="/marketing" className="btn btn-ghost" style={smallButtonStyle}>Voltar</Link>
          </div>
        </div>

        <div style={blueprintGridStyle}>
          {blueprintRows.map((template) => {
            const installed = installedNames.has(template.name);
            return (
              <article key={template.id} style={templateCardStyle}>
                <EmailTemplatePreview template={template} installed={installed} />
                <form action={installMarketingTemplateBlueprint} style={{ marginTop: "auto", paddingTop: 16 }}>
                  <input type="hidden" name="blueprint_id" value={template.id} />
                  <button className={installed ? "btn btn-ghost" : "btn btn-gold"} style={fullWidthButtonStyle}>
                    {installed ? "Atualizar modelo" : "Instalar modelo"}
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      </section>

      <section className="glass rise rise-2" style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Landing pages prontas</p>
            <h2 style={{ margin: 0, fontSize: 28 }}>Modelos publicáveis para campanhas</h2>
            <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.7, maxWidth: 760 }}>
              Crie páginas editáveis para lançamento, captura de leads, B2B e remarketing usando a
              mesma base de landing pages do Marketing.
            </p>
          </div>
        </div>
        <div style={landingGridStyle}>
          {LANDING_TEMPLATE_PRESETS.map((preset) => (
            <LandingTemplateCard key={preset.key} preset={preset} slugSuffix={slugSuffix} />
          ))}
        </div>
      </section>

      <div style={twoColumnStyle}>
        <section className="glass rise" style={cardStyle}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Novo template</p>
          <h2 style={{ margin: "0 0 16px", fontSize: 24 }}>Criar modelo próprio</h2>
          <form action={createMarketingTemplate} style={formGridStyle}>
            <Field label="Nome">
              <input name="name" required style={inputStyle} placeholder="Flora - Pós-venda premium" />
            </Field>
            <Field label="Canal">
              <GlassSelect name="channel" options={CHANNEL_OPTIONS} ariaLabel="Canal do template" inlineMenu />
            </Field>
            <Field label="Categoria">
              <input name="category" style={inputStyle} placeholder="pós-venda" />
            </Field>
            <Field label="Status">
              <GlassSelect name="status" options={STATUS_OPTIONS} ariaLabel="Status do template" inlineMenu />
            </Field>
            <Field label="Assunto">
              <input name="subject" style={inputStyle} placeholder="Como foi sua experiência, {{customer.first_name}}?" />
            </Field>
            <Field label="Idioma">
              <input name="language" defaultValue="pt-BR" style={inputStyle} />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Variáveis disponíveis</label>
              <textarea name="variables" rows={3} style={textareaStyle} placeholder="customer.first_name, order.number, cta.url" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Prévia</label>
              <textarea name="preview" rows={2} style={textareaStyle} placeholder="Resumo interno do uso deste template." />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Conteúdo</label>
              <textarea
                name="body"
                rows={7}
                required
                style={textareaStyle}
                placeholder="<p>Olá {{customer.first_name}}, seu pedido #{{order.number}}...</p>"
              />
            </div>
            <button className="btn btn-gold" style={buttonStyle}>Criar template</button>
          </form>
        </section>

        <section className="glass rise" style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>Templates do tenant</p>
              <h2 style={{ margin: 0, fontSize: 24 }}>Modelos editáveis</h2>
            </div>
            <Link href="/backoffice/mensagens" className="btn btn-ghost" style={smallButtonStyle}>Editor visual</Link>
          </div>
          {templateRows.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Nenhum template salvo. Instale um modelo Flora ou crie um modelo próprio.
            </p>
          ) : (
            <div style={installedGridStyle}>
              {templateRows.slice(0, 20).map((template) => (
                <article key={template.id} style={installedTemplateStyle}>
                  <div style={miniMailStyle}>
                    <div style={miniMailHeaderStyle}>{template.name.slice(0, 2).toUpperCase()}</div>
                    <div style={miniLineStyle} />
                    <div style={{ ...miniLineStyle, width: "72%" }} />
                    <div style={miniButtonStyle} />
                  </div>
                  <span className="chip chip-draft" style={{ width: "fit-content" }}>
                    {template.category ?? channelLabel(template.channel)}
                  </span>
                  <h3 style={{ margin: "10px 0 6px", fontSize: 18 }}>{template.name}</h3>
                  <p className="muted" style={{ margin: 0, lineHeight: 1.55, fontSize: 12.5 }}>
                    {template.subject ?? template.preview ?? "Modelo pronto para editar no Studio visual."}
                  </p>
                  <Link href="/backoffice/mensagens" className="btn btn-ghost" style={{ ...fullWidthButtonStyle, marginTop: "auto" }}>
                    Editar modelo
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="rise" style={{ marginBottom: 26 }}>
      <Link href="/marketing" className="eyebrow" style={{ opacity: 0.8 }}>← Marketing e Relacionamento</Link>
      <h1 className="display" style={{ fontSize: 42, marginTop: 10 }}>Templates de e-mail e mensagens</h1>
      <p className="muted" style={{ maxWidth: 820, lineHeight: 1.7, marginTop: 10 }}>
        Biblioteca de modelos Flora para Resend, SMS, WhatsApp e mensagens transacionais,
        com variáveis dinâmicas e instalação direta no tenant atual.
      </p>
    </header>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="glass" style={kpiStyle}>
      <p className="eyebrow" style={{ marginBottom: 10 }}>{label}</p>
      <strong className="display" style={{ fontSize: 30 }}>{value}</strong>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{note}</p>
    </div>
  );
}

function EmailTemplatePreview({ template, installed }: { template: BlueprintRow; installed: boolean }) {
  const variables = visibleVariables(template.variables).slice(0, 4);

  return (
    <>
      <div style={emailPreviewShellStyle}>
        <div style={emailPreviewHeaderStyle}>
          <span>Flora Botanics</span>
        </div>
        <div style={emailPreviewBodyStyle}>
          <p style={emailPreviewEyebrowStyle}>{template.category}</p>
          <h3 style={emailPreviewTitleStyle}>{template.subject ?? template.name}</h3>
          <p style={emailPreviewTextStyle}>{template.description}</p>
          <span style={emailPreviewCtaStyle}>{ctaLabelForTemplate(template.category)}</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 14 }}>
        <span className={installed ? "chip chip-live" : "chip chip-draft"}>
          {installed ? "Instalado" : template.category}
        </span>
        <span className="muted" style={{ fontSize: 11 }}>{channelLabel(template.channel)}</span>
      </div>
      <h3 style={templateTitleStyle}>{template.name}</h3>
      <p className="muted" style={templateDescriptionStyle}>{template.description}</p>
      {variables.length ? (
        <div style={templateVariableRowStyle}>
          {variables.map((variable) => (
            <span key={variable} style={variableStyle}>{variableLabel(variable)}</span>
          ))}
        </div>
      ) : (
        <div style={templateVariableRowStyle} aria-hidden="true" />
      )}
    </>
  );
}

function LandingTemplateCard({
  preset,
  slugSuffix,
}: {
  preset: (typeof LANDING_TEMPLATE_PRESETS)[number];
  slugSuffix: string;
}) {
  const slug = `${preset.key}-${slugSuffix}`;

  return (
    <article style={landingCardStyle}>
      <div style={landingPreviewStyle}>
        <div style={landingNavStyle}>
          <span>FLORA</span>
          <span style={{ opacity: 0.65 }}>Campanha</span>
        </div>
        <div style={landingHeroStyle}>
          <p style={emailPreviewEyebrowStyle}>{preset.eyebrow}</p>
          <h3 style={{ margin: "8px 0", fontSize: 23, lineHeight: 1.05, color: "#fff8ea" }}>
            {preset.headline}
          </h3>
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "rgba(255,248,234,0.70)" }}>
            {preset.intro}
          </p>
        </div>
      </div>
      <span className="chip chip-draft" style={{ width: "fit-content" }}>{preset.category}</span>
      <h3 style={landingTitleStyle}>{preset.title}</h3>
      <p className="muted" style={landingDescriptionStyle}>{preset.intro}</p>
      <form action={createMarketingLandingPage} style={{ marginTop: "auto", paddingTop: 16 }}>
        <input type="hidden" name="title" value={preset.title} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="status" value="draft" />
        <input type="hidden" name="template_key" value={preset.key} />
        <input type="hidden" name="eyebrow" value={preset.eyebrow} />
        <input type="hidden" name="headline" value={preset.headline} />
        <input type="hidden" name="intro" value={preset.intro} />
        <input type="hidden" name="body" value={landingBodyFor(preset.tone)} />
        <input type="hidden" name="cta_label" value={preset.cta} />
        <input type="hidden" name="cta_url" value="/produtos" />
        <input type="hidden" name="benefit_title" value="Benefício principal" />
        <input type="hidden" name="benefit_text" value="Explique o benefício comercial ou editorial desta campanha." />
        <input type="hidden" name="product_title" value="Produto ou kit em destaque" />
        <input type="hidden" name="product_text" value="Conecte a campanha ao produto, kit, coleção ou oferta." />
        <input type="hidden" name="testimonial_title" value="Prova social" />
        <input type="hidden" name="testimonial_text" value="Inclua avaliação, garantia, ingrediente ou argumento de confiança." />
        <input type="hidden" name="seo_title" value={preset.title} />
        <input type="hidden" name="seo_description" value={preset.intro} />
        <div style={cardActionRowStyle}>
          <button className="btn btn-gold" style={fullWidthButtonStyle}>Criar landing editável</button>
          <Link href="/marketing/landing-pages" className="btn btn-ghost" style={fullWidthButtonStyle}>Editar landings</Link>
        </div>
      </form>
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ctaLabelForTemplate(category: string) {
  const labels: Record<string, string> = {
    "carrinho abandonado": "Finalizar compra",
    "pedido expedido": "Rastrear pedido",
    "pedido aprovado": "Acompanhar pedido",
    aniversário: "Escolher presente",
    "boas-vindas": "Acessar conta",
    assinatura: "Gerenciar assinatura",
    avaliação: "Avaliar agora",
    lançamento: "Ver novidade",
    remarketing: "Finalizar compra",
    b2b: "Ver proposta",
    orçamento: "Aprovar orçamento",
  };
  return labels[category.toLowerCase()] ?? "Ver mensagem";
}

function variableLabel(variable: string) {
  const labels: Record<string, string> = {
    "customer.first_name": "Nome do cliente",
    "customer.name": "Cliente",
    "order.number": "Pedido",
    "shipment.tracking_code": "Rastreio",
    "shipment.tracking_url": "Link de rastreio",
    "coupon.code": "Cupom",
    "cart.url": "Carrinho",
    "cart.link": "Carrinho",
    "review.url": "Avaliação",
    "review.link": "Avaliação",
    "quote.number": "Orçamento",
    "cta.url": "Botão",
  };
  return labels[variable] ?? variable.replaceAll("_", " ").replaceAll(".", " ");
}

function visibleVariables(variables: string[]) {
  return variables.filter((variable) => !variable.toLowerCase().includes("cta"));
}

function landingBodyFor(tone: string) {
  const bodies: Record<string, string> = {
    editorial: "Apresente a história da campanha, destaque a promessa principal e conduza o visitante para o produto ou kit central.",
    lead: "Explique o benefício de entrar na lista, o que será enviado e quando o contato receberá novidades.",
    b2b: "Descreva a oportunidade comercial, as condições, a personalização e o próximo passo para falar com a equipe.",
    remarketing: "Relembre o valor do carrinho salvo, mostre o benefício de voltar agora e reduza fricção para concluir a compra.",
  };
  return bodies[tone] ?? "Edite esta página com a narrativa e o CTA da campanha.";
}

function channelLabel(value: string) {
  const labels: Record<string, string> = {
    email: "E-mail",
    sms: "SMS",
    whatsapp: "WhatsApp",
    internal: "Interno",
  };
  return labels[value] ?? value;
}

const pageStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "48px 28px 80px",
};

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const kpiStyle: CSSProperties = {
  padding: 20,
  minHeight: 128,
};

const cardStyle: CSSProperties = {
  padding: 22,
  borderRadius: 16,
  marginBottom: 18,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
  flexWrap: "wrap",
};

const blueprintGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gridAutoRows: "1fr",
  gap: 14,
  alignItems: "stretch",
};

const templateCardStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(145deg, rgba(255,248,234,0.075), rgba(10,22,11,0.34))",
  minHeight: 560,
  height: "100%",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
};

const templateTitleStyle: CSSProperties = {
  margin: "12px 0 8px",
  minHeight: 50,
  fontSize: 20,
  lineHeight: 1.2,
};

const templateDescriptionStyle: CSSProperties = {
  margin: 0,
  minHeight: 62,
  lineHeight: 1.65,
  fontSize: 12.5,
};

const templateVariableRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  alignContent: "flex-start",
  minHeight: 74,
  marginTop: 14,
};

const variableStyle: CSSProperties = {
  border: "1px solid rgba(217, 184, 122, 0.34)",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 10,
  color: "var(--gold-light)",
  background: "rgba(185,146,77,0.10)",
  fontWeight: 800,
};

const emailPreviewShellStyle: CSSProperties = {
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(242,236,223,0.18)",
  background: "#f4efe5",
  boxShadow: "0 18px 36px rgba(0,0,0,0.24)",
  minHeight: 294,
  display: "grid",
  gridTemplateRows: "auto 1fr",
};

const emailPreviewHeaderStyle: CSSProperties = {
  padding: "16px 18px",
  textAlign: "center",
  background: "#172b17",
  color: "#f2ecdf",
  fontFamily: "serif",
  fontWeight: 800,
  letterSpacing: 3,
  textTransform: "uppercase",
  fontSize: 14,
};

const emailPreviewBodyStyle: CSSProperties = {
  padding: 20,
  minHeight: 224,
  display: "grid",
  gridTemplateRows: "auto minmax(58px, auto) minmax(58px, 1fr) auto",
  alignContent: "start",
};

const emailPreviewEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#b9924d",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 1.6,
  textTransform: "uppercase",
};

const emailPreviewTitleStyle: CSSProperties = {
  margin: "10px 0",
  color: "#172b17",
  fontSize: 24,
  lineHeight: 1.1,
  fontFamily: "serif",
  minHeight: 58,
};

const emailPreviewTextStyle: CSSProperties = {
  color: "#4c5b4c",
  fontSize: 12,
  lineHeight: 1.55,
  margin: "0 0 18px",
  minHeight: 58,
};

const emailPreviewCtaStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "end",
  width: "fit-content",
  minHeight: 34,
  borderRadius: 999,
  padding: "0 18px",
  background: "#172b17",
  color: "#f2ecdf",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 1.5,
  textTransform: "uppercase",
};

const landingGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gridAutoRows: "1fr",
  gap: 14,
  alignItems: "stretch",
};

const landingCardStyle: CSSProperties = {
  ...templateCardStyle,
  minHeight: 490,
};

const landingTitleStyle: CSSProperties = {
  margin: "12px 0 8px",
  minHeight: 48,
  fontSize: 20,
  lineHeight: 1.2,
};

const landingDescriptionStyle: CSSProperties = {
  margin: 0,
  minHeight: 68,
  lineHeight: 1.65,
  fontSize: 12.5,
};

const landingPreviewStyle: CSSProperties = {
  height: 220,
  minHeight: 220,
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(242,236,223,0.18)",
  background: "radial-gradient(circle at 85% 20%, rgba(185,146,77,0.35), transparent 32%), linear-gradient(135deg, #0f2812, #1b351d)",
  boxShadow: "0 18px 36px rgba(0,0,0,0.24)",
  marginBottom: 14,
};

const landingNavStyle: CSSProperties = {
  minHeight: 46,
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  color: "#fff8ea",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  borderBottom: "1px solid rgba(242,236,223,0.12)",
};

const landingHeroStyle: CSSProperties = {
  padding: "26px 20px",
  display: "grid",
  gridTemplateRows: "auto minmax(54px, auto) 1fr",
  alignContent: "start",
};

const buttonClusterStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  alignItems: "center",
};

const installedGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gridAutoRows: "1fr",
  gap: 12,
  alignItems: "stretch",
};

const installedTemplateStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  padding: 14,
  background: "rgba(255,248,234,0.045)",
  minHeight: 310,
  height: "100%",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const miniMailStyle: CSSProperties = {
  borderRadius: 12,
  background: "#f4efe5",
  padding: 10,
  marginBottom: 12,
  minHeight: 96,
};

const miniMailHeaderStyle: CSSProperties = {
  height: 24,
  borderRadius: "8px 8px 0 0",
  background: "#172b17",
  color: "#f2ecdf",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 2,
};

const miniLineStyle: CSSProperties = {
  height: 7,
  borderRadius: 999,
  background: "#d8d0c3",
  width: "88%",
  marginTop: 10,
};

const miniButtonStyle: CSSProperties = {
  height: 18,
  width: 86,
  borderRadius: 999,
  background: "#b9924d",
  marginTop: 12,
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 18,
  alignItems: "start",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "var(--cream-dim)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--glass-border)",
  borderRadius: 10,
  padding: "10px 12px",
  background: "rgba(10, 22, 11, 0.45)",
  color: "var(--cream)",
  font: "inherit",
  fontSize: 13,
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 92,
  resize: "vertical",
};

const buttonStyle: CSSProperties = {
  padding: "11px 18px",
  fontSize: 10,
  alignSelf: "end",
};

const smallButtonStyle: CSSProperties = {
  minHeight: 38,
  padding: "0 16px",
  fontSize: 10,
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const fullWidthButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  width: "100%",
};

const cardActionRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 8,
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(130px, 1fr)",
  gap: "6px 10px",
  alignItems: "center",
  padding: "12px 14px",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  background: "rgba(255,248,234,0.045)",
};
