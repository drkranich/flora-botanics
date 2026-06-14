import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import {
  createTemplate,
  deleteTemplate,
  createAutomation,
  setAutomationStatus,
  deleteAutomation,
} from "./actions";

const TEMPLATE_CHANNEL_LABELS: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  sms: "SMS",
};

const TRIGGER_LABELS: Record<string, string> = {
  birthday: "Aniversário do cliente",
  abandoned_cart: "Carrinho abandonado",
  order_paid: "Pedido pago",
  order_cancelled: "Pedido cancelado",
  low_stock: "Estoque baixo",
  manual: "Disparo manual",
};

const AUTOMATION_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
};

const RUN_STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Ignorado",
};

function badgeStyle(kind: "ok" | "warning" | "neutral" | "error"): React.CSSProperties {
  const colors: Record<typeof kind, { bg: string; fg: string }> = {
    ok: { bg: "#e6f0ea", fg: "#2f6b4a" },
    warning: { bg: "#fbf0d9", fg: "#8a6512" },
    neutral: { bg: "#f2ecdf", fg: "#6b6354" },
    error: { bg: "#fbeaea", fg: "#9a3232" },
  };
  const c = colors[kind];
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 6,
    background: c.bg,
    color: c.fg,
    whiteSpace: "nowrap",
  };
}

function automationStatusBadge(status: string): React.CSSProperties {
  if (status === "active") return badgeStyle("ok");
  if (status === "paused") return badgeStyle("warning");
  return badgeStyle("neutral");
}

function runStatusBadge(status: string): React.CSSProperties {
  if (status === "sent") return badgeStyle("ok");
  if (status === "failed") return badgeStyle("error");
  if (status === "skipped") return badgeStyle("neutral");
  return badgeStyle("warning");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

interface TemplateRow {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
}

interface AutomationRow {
  id: string;
  name: string;
  trigger: string;
  status: string;
  conditions: unknown;
  actions: unknown;
}

interface AutomationRunRow {
  id: string;
  channel: string;
  status: string;
  error: string | null;
  sent_at: string | null;
  created_at: string;
  automations: { name: string } | null;
  customers: { full_name: string | null; email: string } | null;
}

export default async function MensagensPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();

  const [templatesRes, automationsRes, runsRes] = await Promise.all([
    supabase
      .from("message_templates")
      .select("id, name, channel, subject, body")
      .eq("tenant_id", staff.tenantId)
      .order("name"),
    supabase
      .from("automations")
      .select("id, name, trigger, status, conditions, actions")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("automation_runs")
      .select("id, channel, status, error, sent_at, created_at, automations(name), customers(full_name, email)")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const templates = (templatesRes.data ?? []) as TemplateRow[];
  const automations = (automationsRes.data ?? []) as AutomationRow[];
  const runs = (runsRes.data ?? []) as unknown as AutomationRunRow[];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Mensagens</h1>
        <p style={{ margin: 0, color: "#6b6354", fontSize: 14 }}>
          Templates de mensagem e automações (aniversário, carrinho abandonado, remarketing) para
          e-mail, WhatsApp, Instagram e SMS.
        </p>
      </div>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Templates de mensagem</h2>
        {templates.length === 0 ? (
          <p style={emptyStyle}>Nenhum template criado ainda.</p>
        ) : (
          <ul style={listStyle}>
            {templates.map((t) => (
              <li key={t.id} style={{ ...listItemStyle, alignItems: "flex-start", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <strong>{t.name}</strong>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={badgeStyle("neutral")}>{TEMPLATE_CHANNEL_LABELS[t.channel] ?? t.channel}</span>
                    <form action={deleteTemplate.bind(null, t.id)}>
                      <button type="submit" style={dangerButtonStyle}>Excluir</button>
                    </form>
                  </span>
                </div>
                {t.subject && <span style={{ fontSize: 13, color: "#6b6354" }}>Assunto: {t.subject}</span>}
                <span style={{ fontSize: 13, color: "#6b6354" }}>{t.body}</span>
              </li>
            ))}
          </ul>
        )}

        <form action={createTemplate} style={{ ...formGridStyle, marginTop: 16, borderTop: "1px solid #f2ecdf", paddingTop: 16 }}>
          <div style={sectionLabel}>Novo template</div>
          <div style={rowStyle}>
            <div style={fieldGroup}>
              <label style={labelStyle} htmlFor="tpl-name">Nome</label>
              <input id="tpl-name" name="name" type="text" required placeholder="aniversario-cliente" style={inputStyle} />
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle} htmlFor="tpl-channel">Canal</label>
              <select id="tpl-channel" name="channel" style={inputStyle} defaultValue="email">
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="tpl-subject">Assunto (e-mail)</label>
            <input id="tpl-subject" name="subject" type="text" placeholder="Feliz aniversário, {{nome}}!" style={inputStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="tpl-body">Mensagem</label>
            <textarea
              id="tpl-body"
              name="body"
              required
              rows={3}
              placeholder="Olá {{nome}}, a Flora Botanics deseja um feliz aniversário! Use o cupom {{cupom}}."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="tpl-variables">Variáveis (JSON, opcional)</label>
            <input id="tpl-variables" name="variables" type="text" placeholder='["nome", "cupom"]' style={inputStyle} />
          </div>
          <div>
            <button type="submit" style={buttonStyle}>Criar template</button>
          </div>
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Automações</h2>
        {automations.length === 0 ? (
          <p style={emptyStyle}>Nenhuma automação criada ainda.</p>
        ) : (
          <ul style={listStyle}>
            {automations.map((a) => (
              <li key={a.id} style={listItemStyle}>
                <span>
                  <strong>{a.name}</strong>{" "}
                  <span style={{ color: "#6b6354" }}>· {TRIGGER_LABELS[a.trigger] ?? a.trigger}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={automationStatusBadge(a.status)}>{AUTOMATION_STATUS_LABELS[a.status] ?? a.status}</span>
                  {a.status !== "active" && (
                    <form action={setAutomationStatus.bind(null, a.id, "active")}>
                      <button type="submit" style={actionButtonStyle}>Ativar</button>
                    </form>
                  )}
                  {a.status === "active" && (
                    <form action={setAutomationStatus.bind(null, a.id, "paused")}>
                      <button type="submit" style={actionButtonStyle}>Pausar</button>
                    </form>
                  )}
                  <form action={deleteAutomation.bind(null, a.id)}>
                    <button type="submit" style={dangerButtonStyle}>Excluir</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form action={createAutomation} style={{ ...formGridStyle, marginTop: 16, borderTop: "1px solid #f2ecdf", paddingTop: 16 }}>
          <div style={sectionLabel}>Nova automação</div>
          <div style={rowStyle}>
            <div style={fieldGroup}>
              <label style={labelStyle} htmlFor="auto-name">Nome</label>
              <input id="auto-name" name="name" type="text" required placeholder="Felicitações de aniversário" style={inputStyle} />
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle} htmlFor="auto-trigger">Gatilho</label>
              <select id="auto-trigger" name="trigger" style={inputStyle} defaultValue="manual">
                <option value="birthday">Aniversário do cliente</option>
                <option value="abandoned_cart">Carrinho abandonado</option>
                <option value="order_paid">Pedido pago</option>
                <option value="order_cancelled">Pedido cancelado</option>
                <option value="low_stock">Estoque baixo</option>
                <option value="manual">Disparo manual</option>
              </select>
            </div>
          </div>
          <div style={rowStyle}>
            <div style={fieldGroup}>
              <label style={labelStyle} htmlFor="auto-conditions">Condições (JSON, opcional)</label>
              <input id="auto-conditions" name="conditions" type="text" placeholder='{"tag": "vip"}' style={inputStyle} />
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle} htmlFor="auto-actions">Ações (JSON, opcional)</label>
              <input id="auto-actions" name="actions" type="text" placeholder='[{"channel": "whatsapp", "template": "aniversario-cliente"}]' style={inputStyle} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#6b6354", margin: 0 }}>
            A automação é criada como rascunho. O disparo automático (worker que avalia gatilhos e
            envia mensagens pelos canais conectados) é uma etapa futura — por enquanto, ative/pause
            para registrar a intenção e organizar os templates por gatilho.
          </p>
          <div>
            <button type="submit" style={buttonStyle}>Criar automação</button>
          </div>
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Histórico de disparos</h2>
        {runs.length === 0 ? (
          <p style={emptyStyle}>Nenhum disparo registrado ainda.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f2ecdf", textAlign: "left" }}>
                  <th style={thStyle}>Automação</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Canal</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Quando</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #f2ecdf" }}>
                    <td style={tdStyle}>{r.automations?.name ?? "—"}</td>
                    <td style={tdStyle}>{r.customers?.full_name ?? r.customers?.email ?? "—"}</td>
                    <td style={tdStyle}>{TEMPLATE_CHANNEL_LABELS[r.channel] ?? r.channel}</td>
                    <td style={tdStyle}>
                      <span style={runStatusBadge(r.status)}>{RUN_STATUS_LABELS[r.status] ?? r.status}</span>
                      {r.error && <div style={{ fontSize: 12, color: "#9a3232", marginTop: 2 }}>{r.error}</div>}
                    </td>
                    <td style={tdStyle}>{formatDateTime(r.sent_at ?? r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e6ddc9",
  borderRadius: 12,
  padding: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  margin: "0 0 12px",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 8,
};

const listItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 14,
  borderBottom: "1px solid #f2ecdf",
  paddingBottom: 8,
};

const emptyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#6b6354",
};

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 12,
  fontWeight: 700,
  color: "#6b6354",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 16px",
  verticalAlign: "top",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const fieldGroup: React.CSSProperties = {
  display: "grid",
  gap: 4,
  flex: 1,
  minWidth: 160,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6b6354",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #e6ddc9",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  color: "#28251d",
  background: "#fcfaf5",
  width: "100%",
};

const buttonStyle: React.CSSProperties = {
  background: "#28251d",
  color: "#fdfbf6",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const actionButtonStyle: React.CSSProperties = {
  background: "#f2ecdf",
  border: "1px solid #e6ddc9",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "#28251d",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#fbeaea",
  border: "1px solid #f5dede",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "#9a3232",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
