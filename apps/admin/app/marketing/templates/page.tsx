import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { createMarketingTemplate, installMarketingTemplateBlueprint } from "../actions";

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
            <p className="eyebrow" style={{ marginBottom: 8 }}>Biblioteca completa de modelos</p>
            <h2 style={{ margin: 0, fontSize: 28 }}>Instalar modelos prontos da Flora</h2>
          </div>
          <Link href="../marketing" className="btn btn-ghost" style={smallButtonStyle}>Voltar ao Marketing</Link>
        </div>

        <div style={blueprintGridStyle}>
          {blueprintRows.map((template) => {
            const installed = installedNames.has(template.name);
            return (
              <article key={template.id} style={templateCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <span className={installed ? "chip chip-live" : "chip chip-draft"}>
                    {installed ? "Instalado" : template.category}
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>{channelLabel(template.channel)}</span>
                </div>
                <h3 style={{ margin: "12px 0 8px", fontSize: 20 }}>{template.name}</h3>
                <p className="muted" style={{ margin: 0, lineHeight: 1.65, fontSize: 12.5 }}>{template.description}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                  {template.variables.slice(0, 5).map((variable) => (
                    <span key={variable} style={variableStyle}>{`{{${variable}}}`}</span>
                  ))}
                </div>
                <form action={installMarketingTemplateBlueprint} style={{ marginTop: 16 }}>
                  <input type="hidden" name="blueprint_id" value={template.id} />
                  <button className={installed ? "btn btn-ghost" : "btn btn-gold"} style={smallButtonStyle}>
                    {installed ? "Atualizar modelo" : "Instalar no tenant"}
                  </button>
                </form>
              </article>
            );
          })}
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
            <Link href="../backoffice/mensagens" className="btn btn-ghost" style={smallButtonStyle}>Editor visual</Link>
          </div>
          {templateRows.length === 0 ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Nenhum template salvo. Instale um modelo Flora ou crie um modelo próprio.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {templateRows.slice(0, 20).map((template) => (
                <div key={template.id} style={rowStyle}>
                  <span className="chip chip-draft">{template.category ?? channelLabel(template.channel)}</span>
                  <strong>{template.name}</strong>
                  <span className="muted">{template.subject ?? template.preview ?? "Sem assunto"}</span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {(template.variables ?? []).slice(0, 4).map((item) => `{{${item}}}`).join(" · ") || "Sem variáveis"}
                  </span>
                </div>
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
      <Link href="../marketing" className="eyebrow" style={{ opacity: 0.8 }}>← Marketing e Relacionamento</Link>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
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
};

const blueprintGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const templateCardStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(255,248,234,0.045)",
  minHeight: 230,
  display: "flex",
  flexDirection: "column",
};

const variableStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 10,
  color: "var(--cream-dim)",
  background: "rgba(10,22,11,0.38)",
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
  padding: "8px 14px",
  fontSize: 10,
  whiteSpace: "nowrap",
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
