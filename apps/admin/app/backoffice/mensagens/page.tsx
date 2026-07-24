import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { isResendConfigured } from "@/lib/email/resend";
import { GlassSelect } from "@/components/GlassSelect";
import {
  createTemplate,
  createTemplateFromPreset,
  deleteTemplate,
  createAutomation,
  setAutomationStatus,
  deleteAutomation,
} from "./actions";
import { TEMPLATE_PRESETS } from "./template-presets";
import { TemplateStudio, type StudioTemplate } from "./TemplateStudio";

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

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso)
  );
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
      .select(
        "id, channel, status, error, sent_at, created_at, automations(name), customers(full_name, email)"
      )
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const templates = (templatesRes.data ?? []) as StudioTemplate[];
  const automations = (automationsRes.data ?? []) as AutomationRow[];
  const runs = (runsRes.data ?? []) as unknown as AutomationRunRow[];
  const resendOk = await isResendConfigured();

  const emailTemplates = templates.filter((t) => t.channel === "email");

  return (
    <div style={{ display: "grid", gap: 24, padding: "24px 28px 48px" }}>
      {/* ── header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Mensagens</h1>
          <p style={{ margin: 0, color: "var(--cream-dim)", fontSize: 14 }}>
            Crie templates de e-mail visualmente, configure automações e acompanhe disparos.
          </p>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            background: resendOk ? "rgba(143,212,134,0.12)" : "rgba(185,146,77,0.12)",
            border: `1px solid ${resendOk ? "rgba(143,212,134,0.35)" : "rgba(185,146,77,0.35)"}`,
            color: resendOk ? "#8fd486" : "#d4aa5a",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: resendOk ? "#8fd486" : "#d4aa5a",
              boxShadow: resendOk ? "0 0 7px #8fd486" : "0 0 7px #d4aa5a",
            }}
          />
          {resendOk ? "Resend conectado" : "Resend não configurado"}
        </span>
      </div>

      {/* ── biblioteca de modelos prontos ── */}
      {TEMPLATE_PRESETS.length > 0 && emailTemplates.length === 0 && (
        <section className="glass" style={{ padding: 20, borderRadius: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <p className="eyebrow" style={{ marginBottom: 4 }}>Biblioteca Flora</p>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Modelos prontos para começar</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {TEMPLATE_PRESETS.map((preset) => (
              <div
                key={preset.id}
                className="glass"
                style={{ padding: 16, borderRadius: 12, display: "grid", gap: 8 }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "var(--gold-light)",
                  }}
                >
                  {preset.triggerLabel}
                </span>
                <strong style={{ fontSize: 13 }}>{preset.title}</strong>
                <p style={{ margin: 0, fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.5 }}>
                  {preset.description}
                </p>
                <form action={createTemplateFromPreset.bind(null, preset.id)}>
                  <button
                    type="submit"
                    className="btn btn-ghost"
                    style={{ padding: "8px 16px", fontSize: 10, width: "100%" }}
                  >
                    Usar este modelo
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── compositor visual de e-mail ── */}
      <section className="glass" style={{ padding: 24, borderRadius: 16 }}>
        <div style={{ marginBottom: 20 }}>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Editor visual</p>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Compositor de e-mail</h2>
        </div>
        <TemplateStudio
          templates={emailTemplates}
          tenantId={staff.tenantId}
          resendOk={resendOk}
        />
      </section>

      {/* ── templates de outros canais ── */}
      {templates.filter((t) => t.channel !== "email").length > 0 && (
        <section className="glass" style={{ padding: 20, borderRadius: 16 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>
            Outros canais (WhatsApp, SMS, Instagram)
          </h2>
          <div style={{ display: "grid", gap: 8 }}>
            {templates
              .filter((t) => t.channel !== "email")
              .map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "14px 0",
                    borderBottom: "1px solid rgba(242,236,223,0.08)",
                  }}
                >
                  <div style={{ display: "grid", gap: 3 }}>
                    <strong style={{ fontSize: 13 }}>{t.name}</strong>
                    <span style={{ fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.5 }}>
                      {t.body?.slice(0, 120)}
                      {t.body?.length > 120 ? "…" : ""}
                    </span>
                  </div>
                  <form action={deleteTemplate.bind(null, t.id)}>
                    <button
                      type="submit"
                      style={{
                        background: "none",
                        border: "1px solid rgba(232,160,160,0.3)",
                        borderRadius: 8,
                        padding: "4px 10px",
                        fontSize: 11,
                        color: "#e8a0a0",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      Excluir
                    </button>
                  </form>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* criar template manual (outros canais) */}
      <details className="glass" style={{ padding: 20, borderRadius: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13, userSelect: "none" }}>
          + Criar template manual (WhatsApp / SMS / Instagram)
        </summary>
        <form
          action={createTemplate}
          style={{ display: "grid", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(242,236,223,0.08)" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--cream-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Nome</label>
              <input name="name" type="text" required placeholder="aniversario-whatsapp" className="input" />
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--cream-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Canal</label>
              <GlassSelect
                name="channel"
                defaultValue="whatsapp"
                options={[
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "instagram", label: "Instagram" },
                  { value: "sms", label: "SMS" },
                ]}
                ariaLabel="Canal"
              />
            </div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--cream-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Mensagem</label>
            <textarea
              name="body"
              required
              rows={3}
              placeholder="Olá {{nome}}, a Flora Botanics tem algo especial pra você! 🌿"
              className="input"
              style={{ resize: "vertical" }}
            />
          </div>
          <div>
            <button type="submit" className="btn btn-ghost" style={{ padding: "10px 20px" }}>
              Criar template
            </button>
          </div>
        </form>
      </details>

      {/* ── automações ── */}
      <section className="glass" style={{ padding: 20, borderRadius: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Automações</h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 999,
              background: "rgba(242,236,223,0.08)",
              color: "var(--cream-dim)",
            }}
          >
            {automations.length} ativa{automations.length !== 1 ? "s" : ""}
          </span>
        </div>

        {automations.length > 0 ? (
          <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
            {automations.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(10,22,11,0.35)",
                  border: "1px solid var(--glass-border)",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong style={{ fontSize: 13 }}>{a.name}</strong>
                  <span style={{ fontSize: 12, color: "var(--cream-dim)", marginLeft: 8 }}>
                    · {TRIGGER_LABELS[a.trigger] ?? a.trigger}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 6,
                      background:
                        a.status === "active"
                          ? "rgba(143,212,134,0.15)"
                          : a.status === "paused"
                          ? "rgba(185,146,77,0.15)"
                          : "rgba(242,236,223,0.08)",
                      color:
                        a.status === "active"
                          ? "#8fd486"
                          : a.status === "paused"
                          ? "#d4aa5a"
                          : "var(--cream-dim)",
                    }}
                  >
                    {AUTOMATION_STATUS_LABELS[a.status] ?? a.status}
                  </span>
                  {a.status !== "active" && (
                    <form action={setAutomationStatus.bind(null, a.id, "active")}>
                      <button type="submit" className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 10 }}>
                        Ativar
                      </button>
                    </form>
                  )}
                  {a.status === "active" && (
                    <form action={setAutomationStatus.bind(null, a.id, "paused")}>
                      <button type="submit" className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 10 }}>
                        Pausar
                      </button>
                    </form>
                  )}
                  <form action={deleteAutomation.bind(null, a.id)}>
                    <button
                      type="submit"
                      style={{
                        background: "none",
                        border: "1px solid rgba(232,160,160,0.3)",
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 10,
                        color: "#e8a0a0",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      Excluir
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--cream-dim)" }}>
            Nenhuma automação criada ainda.
          </p>
        )}

        <details style={{ borderTop: "1px solid rgba(242,236,223,0.08)", paddingTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13, userSelect: "none", marginBottom: 12 }}>
            + Nova automação
          </summary>
          <form action={createAutomation} style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--cream-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Nome</label>
                <input name="name" type="text" required placeholder="Felicitações de aniversário" className="input" />
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--cream-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Gatilho</label>
                <GlassSelect
                  name="trigger"
                  defaultValue="manual"
                  options={[
                    { value: "birthday", label: "Aniversário do cliente" },
                    { value: "abandoned_cart", label: "Carrinho abandonado" },
                    { value: "order_paid", label: "Pedido pago" },
                    { value: "order_cancelled", label: "Pedido cancelado" },
                    { value: "low_stock", label: "Estoque baixo" },
                    { value: "manual", label: "Disparo manual" },
                  ]}
                  ariaLabel="Gatilho"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-ghost" style={{ padding: "10px 20px", justifySelf: "start" }}>
              Criar automação
            </button>
          </form>
        </details>
      </section>

      {/* ── histórico ── */}
      {runs.length > 0 && (
        <section className="glass" style={{ padding: 20, borderRadius: 16 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Histórico de disparos</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(242,236,223,0.06)", textAlign: "left" }}>
                  {["Automação", "Cliente", "Canal", "Status", "Quando"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--cream-dim)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid rgba(242,236,223,0.06)" }}>
                    <td style={{ padding: "10px 16px" }}>{r.automations?.name ?? "—"}</td>
                    <td style={{ padding: "10px 16px" }}>
                      {r.customers?.full_name ?? r.customers?.email ?? "—"}
                    </td>
                    <td style={{ padding: "10px 16px", textTransform: "capitalize" }}>{r.channel}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background:
                            r.status === "sent"
                              ? "rgba(143,212,134,0.15)"
                              : r.status === "failed"
                              ? "rgba(232,160,160,0.15)"
                              : "rgba(242,236,223,0.08)",
                          color:
                            r.status === "sent"
                              ? "#8fd486"
                              : r.status === "failed"
                              ? "#e8a0a0"
                              : "var(--cream-dim)",
                        }}
                      >
                        {RUN_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--cream-dim)" }}>
                      {formatDateTime(r.sent_at ?? r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
