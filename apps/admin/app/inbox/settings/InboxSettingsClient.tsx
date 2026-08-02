"use client";

import { useState, useTransition } from "react";
import type { SlaPolicy } from "./page";
import { createSlaPolicy, toggleSlaPolicy, deleteSlaPolicy } from "./actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mins(m: number) {
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

const PRIORITIES = ["low", "normal", "high", "urgent", "critical"] as const;
const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente", critical: "Crítica",
};
const PRIORITY_COLOR: Record<string, string> = {
  low: "#4ade80", normal: "rgba(242,236,223,0.5)", high: "#f0b429",
  urgent: "#fb923c", critical: "#ef4444",
};

const TABS = ["SLA", "Geral"] as const;
type Tab = typeof TABS[number];

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  slaPolicies: SlaPolicy[];
  tenantId: string;
}

export function InboxSettingsClient({ slaPolicies: initial }: Props) {
  const [tab, setTab]             = useState<Tab>("SLA");
  const [policies, setPolicies]   = useState<SlaPolicy[]>(initial);
  const [showForm, setShowForm]   = useState(false);
  const [isPending, start]        = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createSlaPolicy(fd);
      if (!res.ok) { setFormError(res.error); return; }
      // Reload — revalidatePath já está configurado, mas aqui adicionamos optimistic
      setShowForm(false);
      // A página revalidará via next.js, mas para UX imediata adicionamos temporariamente
      const newPolicy: SlaPolicy = {
        id: res.data,
        name: String(fd.get("name")),
        description: String(fd.get("description") || ""),
        active: true,
        first_response_minutes: {
          low: parseInt(String(fd.get("fr_low") ?? "480"), 10),
          normal: parseInt(String(fd.get("fr_normal") ?? "240"), 10),
          high: parseInt(String(fd.get("fr_high") ?? "60"), 10),
          urgent: parseInt(String(fd.get("fr_urgent") ?? "30"), 10),
          critical: parseInt(String(fd.get("fr_critical") ?? "15"), 10),
        },
        next_response_minutes: { low: 1440, normal: 480, high: 120, urgent: 60, critical: 30 },
        resolution_minutes: {
          low: parseInt(String(fd.get("res_low") ?? "10080"), 10),
          normal: parseInt(String(fd.get("res_normal") ?? "2880"), 10),
          high: parseInt(String(fd.get("res_high") ?? "480"), 10),
          urgent: parseInt(String(fd.get("res_urgent") ?? "240"), 10),
          critical: parseInt(String(fd.get("res_critical") ?? "60"), 10),
        },
        business_hours_only: fd.get("business_hours_only") === "on",
        business_hours_start: String(fd.get("bh_start") ?? "08:00"),
        business_hours_end: String(fd.get("bh_end") ?? "18:00"),
        business_days: [1, 2, 3, 4, 5],
        escalate_at_percent: parseInt(String(fd.get("escalate_pct") ?? "80"), 10),
        applies_to_channels: null,
      };
      setPolicies(prev => [...prev, newPolicy]);
    });
  }

  function handleToggle(id: string, active: boolean) {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, active } : p));
    start(async () => { await toggleSlaPolicy(id, active); });
  }

  function handleDelete(id: string) {
    setPolicies(prev => prev.filter(p => p.id !== id));
    start(async () => { await deleteSlaPolicy(id); });
  }

  return (
    <div>
      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 18px",
              background: tab === t ? "rgba(185,146,77,0.13)" : "rgba(242,236,223,0.04)",
              border: `1px solid ${tab === t ? "rgba(185,146,77,0.3)" : "rgba(242,236,223,0.08)"}`,
              borderRadius: 9,
              color: tab === t ? "var(--gold-light)" : "var(--cream-dim)",
              fontFamily: "Manrope, sans-serif",
              fontSize: 12.5, fontWeight: tab === t ? 700 : 500,
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══ Aba SLA ══════════════════════════════════════════════════════════ */}
      {tab === "SLA" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, color: "var(--cream)", letterSpacing: -0.4 }}>
                Políticas de SLA
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--cream-dim)", opacity: 0.6 }}>
                Define prazos de resposta e resolução por prioridade.
              </p>
            </div>
            <button
              onClick={() => setShowForm(v => !v)}
              style={{
                background: showForm ? "rgba(242,236,223,0.06)" : "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
                border: showForm ? "1px solid rgba(242,236,223,0.1)" : "none",
                borderRadius: 10,
                color: showForm ? "var(--cream-dim)" : "var(--forest-950)",
                fontFamily: "Manrope, sans-serif",
                fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
                padding: "10px 18px", cursor: "pointer",
                boxShadow: showForm ? "none" : "0 4px 14px rgba(185,146,77,0.3)",
                transition: "all 0.2s",
              }}
            >
              {showForm ? "Cancelar" : "+ Nova política"}
            </button>
          </div>

          {/* Formulário de criação */}
          {showForm && (
            <form
              onSubmit={handleCreate}
              style={{
                background: "rgba(15,32,18,0.6)",
                border: "1px solid rgba(185,146,77,0.18)",
                borderRadius: 14,
                padding: "22px 24px",
                marginBottom: 20,
                backdropFilter: "blur(20px)",
              }}
            >
              <h3 style={{ margin: "0 0 16px", fontFamily: "Fraunces, serif", fontSize: 16, color: "var(--cream)", fontWeight: 600 }}>
                Nova política de SLA
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label="Nome *">
                  <input name="name" required placeholder="ex: Padrão, Urgente, VIP…" style={inputStyle} />
                </Field>
                <Field label="Descrição">
                  <input name="description" placeholder="Opcional" style={inputStyle} />
                </Field>
              </div>

              {/* Tabela de prazos */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--cream-dim)", opacity: 0.6, marginBottom: 10 }}>
                  Prazos (em minutos)
                </div>
                <div style={{
                  background: "rgba(10,22,11,0.5)",
                  border: "1px solid rgba(242,236,223,0.07)",
                  borderRadius: 10, overflow: "hidden",
                }}>
                  {/* Header */}
                  <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr", padding: "8px 14px", borderBottom: "1px solid rgba(242,236,223,0.06)" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--cream-dim)", opacity: 0.5 }}>Prioridade</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--cream-dim)", opacity: 0.5 }}>1ª resposta</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--cream-dim)", opacity: 0.5 }}>Resolução</span>
                  </div>
                  {PRIORITIES.map((p, i) => {
                    const defaults: Record<string, [number, number]> = {
                      low: [480, 10080], normal: [240, 2880],
                      high: [60, 480], urgent: [30, 240], critical: [15, 60],
                    };
                    const [frDef, resDef] = defaults[p];
                    return (
                      <div key={p} style={{
                        display: "grid", gridTemplateColumns: "130px 1fr 1fr",
                        padding: "10px 14px",
                        borderBottom: i < PRIORITIES.length - 1 ? "1px solid rgba(242,236,223,0.04)" : "none",
                        alignItems: "center",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_COLOR[p], display: "inline-block" }} />
                          <span style={{ fontSize: 12, color: PRIORITY_COLOR[p], fontWeight: 600 }}>{PRIORITY_LABEL[p]}</span>
                        </div>
                        <input
                          name={`fr_${p}`}
                          type="number" min={1} defaultValue={frDef}
                          style={{ ...inputStyle, maxWidth: 100 }}
                        />
                        <input
                          name={`res_${p}`}
                          type="number" min={1} defaultValue={resDef}
                          style={{ ...inputStyle, maxWidth: 100 }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Horário comercial */}
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", gap: 12, alignItems: "center", marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox" name="business_hours_only" defaultChecked
                    style={{ width: 14, height: 14, accentColor: "var(--gold)" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>Horário comercial</span>
                </label>
                <Field label="Início">
                  <input name="bh_start" type="time" defaultValue="08:00" style={inputStyle} />
                </Field>
                <Field label="Fim">
                  <input name="bh_end" type="time" defaultValue="18:00" style={inputStyle} />
                </Field>
                <Field label="Escalar em (%)">
                  <input name="escalate_pct" type="number" min={10} max={100} defaultValue={80} style={{ ...inputStyle, maxWidth: 70 }} />
                </Field>
              </div>

              {formError && (
                <p style={{ fontSize: 11.5, color: "#ef4444", marginBottom: 12, fontFamily: "Manrope, sans-serif" }}>{formError}</p>
              )}

              <button
                type="submit" disabled={isPending}
                style={{
                  background: "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
                  border: "none", borderRadius: 9,
                  color: "var(--forest-950)",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
                  padding: "10px 22px", cursor: isPending ? "default" : "pointer",
                  opacity: isPending ? 0.6 : 1,
                  boxShadow: "0 4px 14px rgba(185,146,77,0.3)",
                }}
              >
                {isPending ? "Salvando…" : "Criar política"}
              </button>
            </form>
          )}

          {/* Lista de políticas */}
          {policies.length === 0 && !showForm && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 36, color: "var(--gold-light)", opacity: 0.15, marginBottom: 12, fontFamily: "Fraunces, serif" }}>✦</div>
              <p style={{ fontSize: 13, color: "var(--cream-dim)", fontFamily: "Fraunces, serif", fontStyle: "italic" }}>
                Nenhuma política de SLA criada ainda.
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {policies.map(policy => (
              <div
                key={policy.id}
                style={{
                  background: "rgba(15,32,18,0.55)",
                  border: `1px solid ${policy.active ? "rgba(242,236,223,0.08)" : "rgba(242,236,223,0.04)"}`,
                  borderRadius: 14,
                  padding: "18px 20px",
                  backdropFilter: "blur(20px)",
                  opacity: policy.active ? 1 : 0.55,
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  {/* Toggle ativo */}
                  <button
                    onClick={() => handleToggle(policy.id, !policy.active)}
                    style={{
                      width: 36, height: 20, borderRadius: 10,
                      background: policy.active ? "var(--gold)" : "rgba(242,236,223,0.12)",
                      border: "none", cursor: "pointer",
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: "absolute",
                      top: 3, left: policy.active ? 18 : 3,
                      width: 14, height: 14, borderRadius: "50%",
                      background: policy.active ? "var(--forest-950)" : "rgba(242,236,223,0.4)",
                      transition: "left 0.2s",
                    }} />
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--cream)", fontFamily: "Manrope, sans-serif" }}>
                      {policy.name}
                    </div>
                    {policy.description && (
                      <div style={{ fontSize: 11.5, color: "var(--cream-dim)", marginTop: 2 }}>
                        {policy.description}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 9.5, fontWeight: 700,
                      background: policy.business_hours_only ? "rgba(125,160,217,0.12)" : "rgba(242,236,223,0.06)",
                      border: `1px solid ${policy.business_hours_only ? "rgba(125,160,217,0.25)" : "rgba(242,236,223,0.1)"}`,
                      borderRadius: 5, padding: "2px 8px",
                      color: policy.business_hours_only ? "#7ea8d9" : "var(--cream-dim)",
                      fontFamily: "Manrope, sans-serif",
                    }}>
                      {policy.business_hours_only
                        ? `${policy.business_hours_start}–${policy.business_hours_end}`
                        : "24/7"}
                    </span>
                    <button
                      onClick={() => handleDelete(policy.id)}
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.18)",
                        borderRadius: 6, padding: "4px 10px",
                        fontSize: 10.5, color: "#ef4444",
                        cursor: "pointer", fontFamily: "Manrope, sans-serif",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                {/* Tabela de prazos resumida */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 6,
                }}>
                  {PRIORITIES.map(p => {
                    const fr  = policy.first_response_minutes?.[p];
                    const res = policy.resolution_minutes?.[p];
                    return (
                      <div key={p} style={{
                        background: "rgba(10,22,11,0.5)",
                        border: "1px solid rgba(242,236,223,0.06)",
                        borderRadius: 8, padding: "8px 10px",
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: PRIORITY_COLOR[p], marginBottom: 4, letterSpacing: 0.5 }}>
                          {PRIORITY_LABEL[p].slice(0, 3).toUpperCase()}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--cream)", fontWeight: 700, marginBottom: 1 }}>
                          ↩ {fr ? mins(fr) : "—"}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--cream-dim)" }}>
                          ✓ {res ? mins(res) : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ Aba Geral ════════════════════════════════════════════════════════ */}
      {tab === "Geral" && (
        <div>
          <h2 style={{ margin: "0 0 6px", fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, color: "var(--cream)", letterSpacing: -0.4 }}>
            Configurações Gerais
          </h2>
          <p style={{ margin: "0 0 24px", fontSize: 12, color: "var(--cream-dim)", opacity: 0.6 }}>
            Assinatura de e-mail, horário padrão e preferências de exibição.
          </p>

          {[
            {
              title: "Assinatura de e-mail",
              desc: "Adicionada automaticamente ao final de todas as respostas por e-mail.",
              content: (
                <textarea
                  placeholder={"Atenciosamente,\nEquipe Flora Botanics\ncontato@florabotanics.com.br"}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55, width: "100%", boxSizing: "border-box" }}
                />
              ),
            },
            {
              title: "Horário de atendimento padrão",
              desc: "Usado para cálculo de SLA quando nenhuma política específica for aplicada.",
              content: (
                <div style={{ display: "flex", gap: 12 }}>
                  <Field label="Abertura">
                    <input type="time" defaultValue="08:00" style={{ ...inputStyle, maxWidth: 120 }} />
                  </Field>
                  <Field label="Fechamento">
                    <input type="time" defaultValue="18:00" style={{ ...inputStyle, maxWidth: 120 }} />
                  </Field>
                </div>
              ),
            },
          ].map((section, i) => (
            <div key={i} style={{
              background: "rgba(15,32,18,0.55)",
              border: "1px solid rgba(242,236,223,0.07)",
              borderRadius: 14,
              padding: "20px 22px",
              backdropFilter: "blur(20px)",
              marginBottom: 14,
            }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)", fontFamily: "Manrope, sans-serif", marginBottom: 3 }}>
                  {section.title}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--cream-dim)", opacity: 0.65 }}>
                  {section.desc}
                </div>
              </div>
              {section.content}
              <div style={{ marginTop: 12 }}>
                <button style={{
                  background: "rgba(185,146,77,0.12)",
                  border: "1px solid rgba(185,146,77,0.25)",
                  borderRadius: 8, padding: "7px 16px",
                  fontSize: 11, color: "var(--gold-light)",
                  cursor: "pointer", fontFamily: "Manrope, sans-serif", fontWeight: 600,
                }}>
                  Salvar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers de estilo ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "rgba(10,22,11,0.6)",
  border: "1px solid rgba(242,236,223,0.1)",
  borderRadius: 8, padding: "8px 11px",
  color: "var(--cream)", fontSize: 12.5,
  fontFamily: "Manrope, sans-serif",
  outline: "none", width: "100%", boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 10.5, fontWeight: 700,
        color: "var(--cream-dim)", letterSpacing: 0.5,
        marginBottom: 5, fontFamily: "Manrope, sans-serif",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
