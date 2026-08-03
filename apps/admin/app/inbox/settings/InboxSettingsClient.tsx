"use client";

import { useState, useTransition } from "react";
import type { SlaPolicy, Team, BusinessHour, EmailSignature, StaffProfile, EmailChannel } from "./page";
import { GlassSelect } from "@/components/GlassSelect";
import {
  createSlaPolicy, toggleSlaPolicy, deleteSlaPolicy,
  createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember,
  saveBusinessHours, saveEmailSignature, deleteEmailSignature,
  saveEmailChannel, deleteEmailChannel,
} from "./actions";

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

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TEAM_COLORS = ["#4ade80", "#60a5fa", "#f472b6", "#fb923c", "#a78bfa", "#34d399", "#f0b429"];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza", "America/Recife"];

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

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(15,32,18,0.55)",
      border: "1px solid rgba(242,236,223,0.07)",
      borderRadius: 14, padding: "20px 22px",
      backdropFilter: "blur(20px)", marginBottom: 14,
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)", fontFamily: "Manrope, sans-serif", marginBottom: 3 }}>
          {title}
        </div>
        {desc && (
          <div style={{ fontSize: 11.5, color: "var(--cream-dim)", opacity: 0.65 }}>{desc}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function GoldBtn({ onClick, children, disabled, danger }: {
  onClick?: () => void; children: React.ReactNode; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: danger
          ? "rgba(239,68,68,0.1)"
          : "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
        border: danger ? "1px solid rgba(239,68,68,0.25)" : "none",
        borderRadius: 9,
        color: danger ? "#ef4444" : "var(--forest-950)",
        fontFamily: "Manrope, sans-serif",
        fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" as const,
        padding: "9px 18px", cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        boxShadow: danger ? "none" : "0 4px 14px rgba(185,146,77,0.3)",
        transition: "all 0.2s",
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: on ? "var(--gold)" : "rgba(242,236,223,0.12)",
        border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 18 : 3,
        width: 14, height: 14, borderRadius: "50%",
        background: on ? "var(--forest-950)" : "rgba(242,236,223,0.4)",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = ["SLA", "Equipes", "Horário", "Assinatura", "Canais"] as const;
type Tab = typeof TABS[number];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  slaPolicies: SlaPolicy[];
  tenantId: string;
  teams: Team[];
  businessHours: BusinessHour[];
  signatures: EmailSignature[];
  allProfiles: StaffProfile[];
  emailChannels: EmailChannel[];
  webhookUrl: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════════════════════════

export function InboxSettingsClient({
  slaPolicies: initialPolicies,
  teams: initialTeams,
  businessHours: initialHours,
  signatures: initialSigs,
  allProfiles,
  emailChannels: initialChannels,
  webhookUrl,
}: Props) {
  const [tab, setTab] = useState<Tab>("SLA");
  const [isPending, start] = useTransition();

  // ── SLA state ────────────────────────────────────────────────────────────
  const [policies, setPolicies]     = useState<SlaPolicy[]>(initialPolicies);
  const [showSlaForm, setShowSlaForm] = useState(false);
  const [slaError, setSlaError]     = useState<string | null>(null);
  const [bhStart, setBhStart]       = useState("08:00");
  const [bhEnd, setBhEnd]           = useState("18:00");

  // ── Teams state ──────────────────────────────────────────────────────────
  const [teams, setTeams]           = useState<Team[]>(initialTeams);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeam, setEditingTeam]   = useState<Team | null>(null);
  const [teamName, setTeamName]         = useState("");
  const [teamDesc, setTeamDesc]         = useState("");
  const [teamColor, setTeamColor]       = useState(TEAM_COLORS[0]);
  const [teamError, setTeamError]       = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [addMemberId, setAddMemberId]   = useState("");
  const [addMemberRole, setAddMemberRole] = useState<"agent" | "lead">("agent");

  // ── Business Hours state ─────────────────────────────────────────────────
  const [hours, setHours]           = useState<BusinessHour[]>(initialHours);
  const [hoursSaved, setHoursSaved] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [tz, setTz]                 = useState(initialHours[0]?.timezone ?? "America/Sao_Paulo");

  // ── Signatures state ─────────────────────────────────────────────────────
  const [sigs, setSigs]             = useState<EmailSignature[]>(initialSigs);
  const [editingSig, setEditingSig] = useState<EmailSignature | null>(null);
  const [sigName, setSigName]       = useState("");
  const [sigBody, setSigBody]       = useState("");
  const [sigDefault, setSigDefault] = useState(false);
  const [sigError, setSigError]     = useState<string | null>(null);
  const [showSigForm, setShowSigForm] = useState(false);

  // ── Channels state ───────────────────────────────────────────────────────
  const [channels, setChannels]         = useState<EmailChannel[]>(initialChannels);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [editingChannel, setEditingChannel]   = useState<EmailChannel | null>(null);
  const [channelName, setChannelName]         = useState("");
  const [channelEmail, setChannelEmail]       = useState("");
  const [channelAutoReply, setChannelAutoReply] = useState(false);
  const [channelAutoReplyMsg, setChannelAutoReplyMsg] = useState("");
  const [channelError, setChannelError]       = useState<string | null>(null);
  const [channelCopied, setChannelCopied]     = useState(false);

  // ────────────────────────────────────────────────────────────────────────
  // SLA handlers
  // ────────────────────────────────────────────────────────────────────────

  async function handleCreateSla(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSlaError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createSlaPolicy(fd);
      if (!res.ok) { setSlaError(res.error); return; }
      setShowSlaForm(false);
      const newP: SlaPolicy = {
        id: res.data, name: String(fd.get("name")),
        description: String(fd.get("description") || ""),
        active: true,
        first_response_minutes: { low: +String(fd.get("fr_low")), normal: +String(fd.get("fr_normal")), high: +String(fd.get("fr_high")), urgent: +String(fd.get("fr_urgent")), critical: +String(fd.get("fr_critical")) },
        next_response_minutes: { low: 1440, normal: 480, high: 120, urgent: 60, critical: 30 },
        resolution_minutes: { low: +String(fd.get("res_low")), normal: +String(fd.get("res_normal")), high: +String(fd.get("res_high")), urgent: +String(fd.get("res_urgent")), critical: +String(fd.get("res_critical")) },
        business_hours_only: fd.get("business_hours_only") === "on",
        business_hours_start: String(fd.get("bh_start")),
        business_hours_end: String(fd.get("bh_end")),
        business_days: [1,2,3,4,5],
        escalate_at_percent: +String(fd.get("escalate_pct")),
        applies_to_channels: null,
      };
      setPolicies(prev => [...prev, newP]);
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Teams handlers
  // ────────────────────────────────────────────────────────────────────────

  function openNewTeam() {
    setEditingTeam(null); setTeamName(""); setTeamDesc(""); setTeamColor(TEAM_COLORS[0]);
    setTeamError(null); setShowTeamForm(true);
  }
  function openEditTeam(t: Team) {
    setEditingTeam(t); setTeamName(t.name); setTeamDesc(t.description ?? ""); setTeamColor(t.color ?? TEAM_COLORS[0]);
    setTeamError(null); setShowTeamForm(true);
  }

  async function handleSaveTeam() {
    setTeamError(null);
    start(async () => {
      if (editingTeam) {
        const res = await updateTeam(editingTeam.id, teamName, teamDesc, teamColor);
        if (!res.ok) { setTeamError(res.error); return; }
        setTeams(prev => prev.map(t => t.id === editingTeam.id ? { ...t, name: teamName, description: teamDesc, color: teamColor } : t));
      } else {
        const res = await createTeam(teamName, teamDesc, teamColor);
        if (!res.ok) { setTeamError(res.error); return; }
        setTeams(prev => [...prev, { id: res.data, name: teamName, description: teamDesc, color: teamColor, active: true, members: [] }]);
      }
      setShowTeamForm(false);
    });
  }

  async function handleDeleteTeam(id: string) {
    start(async () => {
      await deleteTeam(id);
      setTeams(prev => prev.filter(t => t.id !== id));
    });
  }

  async function handleAddMember(teamId: string) {
    if (!addMemberId) return;
    start(async () => {
      const res = await addTeamMember(teamId, addMemberId, addMemberRole);
      if (!res.ok) return;
      const profile = allProfiles.find(p => p.id === addMemberId);
      setTeams(prev => prev.map(t => t.id === teamId
        ? { ...t, members: [...t.members.filter(m => m.profile_id !== addMemberId), { profile_id: addMemberId, full_name: profile?.full_name ?? null, email: profile?.email ?? null, role: addMemberRole }] }
        : t
      ));
      setAddMemberId("");
    });
  }

  async function handleRemoveMember(teamId: string, profileId: string) {
    start(async () => {
      await removeTeamMember(teamId, profileId);
      setTeams(prev => prev.map(t => t.id === teamId
        ? { ...t, members: t.members.filter(m => m.profile_id !== profileId) }
        : t
      ));
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Business Hours handlers
  // ────────────────────────────────────────────────────────────────────────

  function setHourField(day: number, field: keyof BusinessHour, value: string | boolean) {
    setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: value } : h));
    setHoursSaved(false);
  }

  async function handleSaveHours() {
    setHoursError(null);
    start(async () => {
      const res = await saveBusinessHours(hours.map(h => ({ ...h, timezone: tz })));
      if (!res.ok) { setHoursError(res.error); return; }
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 2500);
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Signatures handlers
  // ────────────────────────────────────────────────────────────────────────

  function openNewSig() {
    setEditingSig(null); setSigName("Padrão"); setSigBody(""); setSigDefault(false);
    setSigError(null); setShowSigForm(true);
  }
  function openEditSig(s: EmailSignature) {
    setEditingSig(s); setSigName(s.name); setSigBody(s.body); setSigDefault(s.is_default);
    setSigError(null); setShowSigForm(true);
  }

  async function handleSaveSig() {
    setSigError(null);
    start(async () => {
      const res = await saveEmailSignature(editingSig?.id ?? null, sigName, sigBody, sigDefault);
      if (!res.ok) { setSigError(res.error); return; }
      const updated: EmailSignature = { id: res.data, name: sigName, body: sigBody, is_default: sigDefault, profile_id: null };
      if (sigDefault) setSigs(prev => prev.map(s => ({ ...s, is_default: false })));
      if (editingSig) {
        setSigs(prev => prev.map(s => s.id === editingSig.id ? updated : s));
      } else {
        setSigs(prev => [...prev, updated]);
      }
      setShowSigForm(false);
    });
  }

  async function handleDeleteSig(id: string) {
    start(async () => {
      await deleteEmailSignature(id);
      setSigs(prev => prev.filter(s => s.id !== id));
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Channels handlers
  // ────────────────────────────────────────────────────────────────────────

  function openNewChannel() {
    setEditingChannel(null); setChannelName(""); setChannelEmail("");
    setChannelAutoReply(false); setChannelAutoReplyMsg(""); setChannelError(null);
    setShowChannelForm(true);
  }
  function openEditChannel(c: EmailChannel) {
    setEditingChannel(c); setChannelName(c.name); setChannelEmail(c.identifier);
    setChannelAutoReply(c.auto_reply_enabled); setChannelAutoReplyMsg(c.auto_reply_message ?? "");
    setChannelError(null); setShowChannelForm(true);
  }

  async function handleSaveChannel() {
    setChannelError(null);
    start(async () => {
      const res = await saveEmailChannel(
        editingChannel?.id ?? null,
        channelName, channelEmail, channelAutoReply, channelAutoReplyMsg,
      );
      if (!res.ok) { setChannelError(res.error); return; }
      const updated: EmailChannel = {
        id: res.data,
        name: channelName || channelEmail,
        identifier: channelEmail.toLowerCase().trim(),
        status: "connected",
        auto_reply_enabled: channelAutoReply,
        auto_reply_message: channelAutoReply ? channelAutoReplyMsg : null,
        active: true,
      };
      if (editingChannel) {
        setChannels(prev => prev.map(c => c.id === editingChannel.id ? updated : c));
      } else {
        setChannels(prev => [...prev, updated]);
      }
      setShowChannelForm(false);
    });
  }

  async function handleDeleteChannel(id: string) {
    start(async () => {
      await deleteEmailChannel(id);
      setChannels(prev => prev.filter(c => c.id !== id));
    });
  }

  function handleCopyWebhook() {
    void navigator.clipboard.writeText(webhookUrl);
    setChannelCopied(true);
    setTimeout(() => setChannelCopied(false), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{
            padding: "8px 18px",
            background: tab === t ? "rgba(185,146,77,0.13)" : "rgba(242,236,223,0.04)",
            border: `1px solid ${tab === t ? "rgba(185,146,77,0.3)" : "rgba(242,236,223,0.08)"}`,
            borderRadius: 9,
            color: tab === t ? "var(--gold-light)" : "var(--cream-dim)",
            fontFamily: "Manrope, sans-serif",
            fontSize: 12.5, fontWeight: tab === t ? 700 : 500,
            cursor: "pointer", transition: "all 0.2s",
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: SLA
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "SLA" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, color: "var(--cream)", letterSpacing: -0.4 }}>
                Políticas de SLA
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--cream-dim)", opacity: 0.6 }}>
                Prazos de resposta e resolução por prioridade.
              </p>
            </div>
            <GoldBtn onClick={() => setShowSlaForm(v => !v)}>{showSlaForm ? "Cancelar" : "+ Nova política"}</GoldBtn>
          </div>

          {showSlaForm && (
            <form onSubmit={handleCreateSla} style={{
              background: "rgba(15,32,18,0.6)", border: "1px solid rgba(185,146,77,0.18)",
              borderRadius: 14, padding: "22px 24px", marginBottom: 20, backdropFilter: "blur(20px)",
            }}>
              <h3 style={{ margin: "0 0 16px", fontFamily: "Fraunces, serif", fontSize: 16, color: "var(--cream)", fontWeight: 600 }}>
                Nova política de SLA
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label="Nome *"><input name="name" required placeholder="ex: Padrão, VIP…" style={inputStyle} /></Field>
                <Field label="Descrição"><input name="description" placeholder="Opcional" style={inputStyle} /></Field>
              </div>

              {/* Tabela de prazos */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--cream-dim)", opacity: 0.6, marginBottom: 10 }}>
                  Prazos (em minutos)
                </div>
                <div style={{ background: "rgba(10,22,11,0.5)", border: "1px solid rgba(242,236,223,0.07)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr", padding: "8px 14px", borderBottom: "1px solid rgba(242,236,223,0.06)" }}>
                    {["Prioridade", "1ª resposta", "Resolução"].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--cream-dim)", opacity: 0.5 }}>{h}</span>
                    ))}
                  </div>
                  {PRIORITIES.map((p, i) => {
                    const defs: Record<string, [number, number]> = { low: [480, 10080], normal: [240, 2880], high: [60, 480], urgent: [30, 240], critical: [15, 60] };
                    const [fr, res] = defs[p];
                    return (
                      <div key={p} style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr", padding: "10px 14px", borderBottom: i < 4 ? "1px solid rgba(242,236,223,0.04)" : "none", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_COLOR[p], display: "inline-block" }} />
                          <span style={{ fontSize: 12, color: PRIORITY_COLOR[p], fontWeight: 600 }}>{PRIORITY_LABEL[p]}</span>
                        </div>
                        <input name={`fr_${p}`} type="number" min={1} defaultValue={fr} style={{ ...inputStyle, maxWidth: 100 }} />
                        <input name={`res_${p}`} type="number" min={1} defaultValue={res} style={{ ...inputStyle, maxWidth: 100 }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", gap: 12, alignItems: "center", marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" name="business_hours_only" defaultChecked style={{ width: 14, height: 14, accentColor: "var(--gold)" }} />
                  <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>Horário comercial</span>
                </label>
                <Field label="Início">
                  <input type="hidden" name="bh_start" value={bhStart} />
                  <GlassSelect value={bhStart} options={HOUR_OPTIONS.map(h => ({ value: h, label: h }))} onChange={setBhStart} inlineMenu />
                </Field>
                <Field label="Fim">
                  <input type="hidden" name="bh_end" value={bhEnd} />
                  <GlassSelect value={bhEnd} options={HOUR_OPTIONS.map(h => ({ value: h, label: h }))} onChange={setBhEnd} inlineMenu />
                </Field>
                <Field label="Escalar em (%)">
                  <input name="escalate_pct" type="number" min={10} max={100} defaultValue={80} style={{ ...inputStyle, maxWidth: 70 }} />
                </Field>
              </div>

              {slaError && <p style={{ fontSize: 11.5, color: "#ef4444", marginBottom: 12 }}>{slaError}</p>}
              <GoldBtn disabled={isPending}>{isPending ? "Salvando…" : "Criar política"}</GoldBtn>
            </form>
          )}

          {policies.length === 0 && !showSlaForm && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 36, color: "var(--gold-light)", opacity: 0.15, marginBottom: 12, fontFamily: "Fraunces, serif" }}>✦</div>
              <p style={{ fontSize: 13, color: "var(--cream-dim)", fontFamily: "Fraunces, serif", fontStyle: "italic" }}>Nenhuma política de SLA criada ainda.</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {policies.map(policy => (
              <div key={policy.id} style={{
                background: "rgba(15,32,18,0.55)", border: `1px solid ${policy.active ? "rgba(242,236,223,0.08)" : "rgba(242,236,223,0.04)"}`,
                borderRadius: 14, padding: "18px 20px", backdropFilter: "blur(20px)",
                opacity: policy.active ? 1 : 0.55, transition: "all 0.2s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <Toggle on={policy.active} onChange={v => {
                    setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, active: v } : p));
                    start(async () => { await toggleSlaPolicy(policy.id, v); });
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--cream)" }}>{policy.name}</div>
                    {policy.description && <div style={{ fontSize: 11.5, color: "var(--cream-dim)", marginTop: 2 }}>{policy.description}</div>}
                  </div>
                  <span style={{
                    fontSize: 9.5, fontWeight: 700,
                    background: policy.business_hours_only ? "rgba(125,160,217,0.12)" : "rgba(242,236,223,0.06)",
                    border: `1px solid ${policy.business_hours_only ? "rgba(125,160,217,0.25)" : "rgba(242,236,223,0.1)"}`,
                    borderRadius: 5, padding: "2px 8px",
                    color: policy.business_hours_only ? "#7ea8d9" : "var(--cream-dim)",
                  }}>
                    {policy.business_hours_only ? `${policy.business_hours_start}–${policy.business_hours_end}` : "24/7"}
                  </span>
                  <button type="button" onClick={() => {
                    setPolicies(prev => prev.filter(p => p.id !== policy.id));
                    start(async () => { await deleteSlaPolicy(policy.id); });
                  }} style={{
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)",
                    borderRadius: 6, padding: "4px 10px", fontSize: 10.5, color: "#ef4444",
                    cursor: "pointer",
                  }}>Excluir</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                  {PRIORITIES.map(p => (
                    <div key={p} style={{ background: "rgba(10,22,11,0.5)", border: "1px solid rgba(242,236,223,0.06)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: PRIORITY_COLOR[p], marginBottom: 4, letterSpacing: 0.5 }}>{PRIORITY_LABEL[p].slice(0, 3).toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: "var(--cream)", fontWeight: 700, marginBottom: 1 }}>↩ {policy.first_response_minutes?.[p] ? mins(policy.first_response_minutes[p]) : "—"}</div>
                      <div style={{ fontSize: 10.5, color: "var(--cream-dim)" }}>✓ {policy.resolution_minutes?.[p] ? mins(policy.resolution_minutes[p]) : "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: EQUIPES
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Equipes" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, color: "var(--cream)", letterSpacing: -0.4 }}>Equipes</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--cream-dim)", opacity: 0.6 }}>Agrupe agentes por especialidade e roteie conversas automaticamente.</p>
            </div>
            <GoldBtn onClick={openNewTeam}>+ Nova equipe</GoldBtn>
          </div>

          {/* Formulário nova/editar equipe */}
          {showTeamForm && (
            <SectionCard title={editingTeam ? "Editar equipe" : "Nova equipe"}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <Field label="Nome *">
                  <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="ex: Atendimento, Logística…" style={inputStyle} />
                </Field>
                <Field label="Descrição">
                  <input value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="Opcional" style={inputStyle} />
                </Field>
              </div>
              <Field label="Cor do chip">
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {TEAM_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setTeamColor(c)} style={{
                      width: 24, height: 24, borderRadius: "50%", background: c, border: teamColor === c ? "2px solid var(--gold)" : "2px solid transparent", cursor: "pointer",
                    }} />
                  ))}
                </div>
              </Field>
              {teamError && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 10 }}>{teamError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <GoldBtn onClick={handleSaveTeam} disabled={isPending || !teamName.trim()}>
                  {isPending ? "Salvando…" : editingTeam ? "Salvar alterações" : "Criar equipe"}
                </GoldBtn>
                <button type="button" onClick={() => setShowTeamForm(false)} style={{
                  background: "rgba(242,236,223,0.06)", border: "1px solid rgba(242,236,223,0.1)", borderRadius: 9,
                  color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 600,
                  padding: "9px 16px", cursor: "pointer",
                }}>Cancelar</button>
              </div>
            </SectionCard>
          )}

          {teams.length === 0 && !showTeamForm && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 36, color: "var(--gold-light)", opacity: 0.15, marginBottom: 12, fontFamily: "Fraunces, serif" }}>✦</div>
              <p style={{ fontSize: 13, color: "var(--cream-dim)", fontFamily: "Fraunces, serif", fontStyle: "italic" }}>Nenhuma equipe criada ainda.</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {teams.map(team => {
              const expanded = expandedTeam === team.id;
              return (
                <div key={team.id} style={{
                  background: "rgba(15,32,18,0.55)", border: "1px solid rgba(242,236,223,0.08)",
                  borderRadius: 14, overflow: "hidden", backdropFilter: "blur(20px)",
                }}>
                  {/* Cabeçalho da equipe */}
                  <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: team.color, flexShrink: 0, boxShadow: `0 0 8px ${team.color}66` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)" }}>{team.name}</div>
                      {team.description && <div style={{ fontSize: 11.5, color: "var(--cream-dim)", marginTop: 2 }}>{team.description}</div>}
                    </div>
                    <span style={{
                      fontSize: 10.5, color: "var(--cream-dim)", background: "rgba(242,236,223,0.06)",
                      border: "1px solid rgba(242,236,223,0.1)", borderRadius: 6, padding: "3px 8px",
                    }}>
                      {team.members.length} membro{team.members.length !== 1 ? "s" : ""}
                    </span>
                    <button type="button" onClick={() => setExpandedTeam(expanded ? null : team.id)} style={{
                      background: "rgba(242,236,223,0.06)", border: "1px solid rgba(242,236,223,0.1)",
                      borderRadius: 7, padding: "5px 10px", fontSize: 11.5, color: "var(--cream-dim)", cursor: "pointer",
                    }}>
                      {expanded ? "▲ Fechar" : "▼ Membros"}
                    </button>
                    <button type="button" onClick={() => openEditTeam(team)} style={{
                      background: "rgba(185,146,77,0.1)", border: "1px solid rgba(185,146,77,0.2)",
                      borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "var(--gold-light)", cursor: "pointer",
                    }}>Editar</button>
                    <button type="button" onClick={() => handleDeleteTeam(team.id)} style={{
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)",
                      borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "#ef4444", cursor: "pointer",
                    }}>Excluir</button>
                  </div>

                  {/* Membros (expansível) */}
                  {expanded && (
                    <div style={{ borderTop: "1px solid rgba(242,236,223,0.06)", padding: "14px 20px" }}>
                      {team.members.length === 0 && (
                        <p style={{ fontSize: 12, color: "var(--cream-dim)", opacity: 0.5, margin: "0 0 12px" }}>
                          Nenhum membro ainda.
                        </p>
                      )}
                      {team.members.map(m => (
                        <div key={m.profile_id} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                          borderBottom: "1px solid rgba(242,236,223,0.04)",
                        }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: "rgba(185,146,77,0.2)", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: "var(--gold-light)",
                          }}>
                            {(m.full_name ?? m.email ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12.5, color: "var(--cream)", fontWeight: 600 }}>{m.full_name ?? m.email}</div>
                            {m.full_name && <div style={{ fontSize: 10.5, color: "var(--cream-dim)" }}>{m.email}</div>}
                          </div>
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                            color: m.role === "lead" ? "var(--gold-light)" : "var(--cream-dim)",
                            background: m.role === "lead" ? "rgba(185,146,77,0.12)" : "rgba(242,236,223,0.06)",
                            border: `1px solid ${m.role === "lead" ? "rgba(185,146,77,0.25)" : "rgba(242,236,223,0.1)"}`,
                            borderRadius: 5, padding: "2px 8px",
                          }}>
                            {m.role === "lead" ? "Líder" : "Agente"}
                          </span>
                          <button type="button" onClick={() => handleRemoveMember(team.id, m.profile_id)} style={{
                            background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: "0 4px",
                          }}>×</button>
                        </div>
                      ))}

                      {/* Adicionar membro */}
                      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                          <Field label="Adicionar membro">
                            <GlassSelect
                              value={addMemberId}
                              options={[
                                { value: "", label: "Selecione um agente…" },
                                ...allProfiles
                                  .filter(p => !team.members.find(m => m.profile_id === p.id))
                                  .map(p => ({ value: p.id, label: p.full_name ?? p.email ?? p.id })),
                              ]}
                              onChange={setAddMemberId}
                              inlineMenu
                            />
                          </Field>
                        </div>
                        <div>
                          <Field label="Papel">
                            <GlassSelect
                              value={addMemberRole}
                              options={[{ value: "agent", label: "Agente" }, { value: "lead", label: "Líder" }]}
                              onChange={v => setAddMemberRole(v as "agent" | "lead")}
                              inlineMenu
                            />
                          </Field>
                        </div>
                        <GoldBtn onClick={() => handleAddMember(team.id)} disabled={!addMemberId || isPending}>
                          + Adicionar
                        </GoldBtn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: HORÁRIO
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Horário" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, color: "var(--cream)", letterSpacing: -0.4 }}>Horário de Atendimento</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--cream-dim)", opacity: 0.6 }}>
                Defina os dias e horários em que sua equipe está disponível.
              </p>
            </div>
          </div>

          <SectionCard title="Fuso horário" desc="Aplicado a todos os cálculos de SLA e notificações.">
            <GlassSelect
              value={tz}
              options={TIMEZONES.map(t => ({ value: t, label: t.replace("America/", "").replace("_", " ") }))}
              onChange={setTz}
              inlineMenu
            />
          </SectionCard>

          <div style={{ background: "rgba(15,32,18,0.55)", border: "1px solid rgba(242,236,223,0.07)", borderRadius: 14, overflow: "hidden", backdropFilter: "blur(20px)", marginBottom: 14 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "80px 60px 1fr 1fr", padding: "10px 20px", borderBottom: "1px solid rgba(242,236,223,0.06)" }}>
              {["Dia", "Aberto", "Início", "Fim"].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--cream-dim)", opacity: 0.5, letterSpacing: 0.8 }}>{h.toUpperCase()}</span>
              ))}
            </div>
            {hours.map((h, idx) => (
              <div key={h.day_of_week} style={{
                display: "grid", gridTemplateColumns: "80px 60px 1fr 1fr",
                padding: "12px 20px", alignItems: "center",
                borderBottom: idx < hours.length - 1 ? "1px solid rgba(242,236,223,0.04)" : "none",
                background: h.open ? "transparent" : "rgba(0,0,0,0.15)",
                transition: "background 0.2s",
              }}>
                <span style={{ fontSize: 13, fontWeight: h.open ? 700 : 400, color: h.open ? "var(--cream)" : "var(--cream-dim)" }}>
                  {DAYS_PT[h.day_of_week]}
                </span>
                <Toggle on={h.open} onChange={v => setHourField(h.day_of_week, "open", v)} />
                <div style={{ opacity: h.open ? 1 : 0.35, transition: "opacity 0.2s" }}>
                  <GlassSelect
                    value={h.start_time}
                    options={HOUR_OPTIONS.map(o => ({ value: o, label: o }))}
                    onChange={v => setHourField(h.day_of_week, "start_time", v)}
                    inlineMenu
                  />
                </div>
                <div style={{ opacity: h.open ? 1 : 0.35, transition: "opacity 0.2s" }}>
                  <GlassSelect
                    value={h.end_time}
                    options={HOUR_OPTIONS.map(o => ({ value: o, label: o }))}
                    onChange={v => setHourField(h.day_of_week, "end_time", v)}
                    inlineMenu
                  />
                </div>
              </div>
            ))}
          </div>

          {hoursError && <p style={{ fontSize: 11.5, color: "#ef4444", marginBottom: 12 }}>{hoursError}</p>}

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <GoldBtn onClick={handleSaveHours} disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar horário"}
            </GoldBtn>
            {hoursSaved && (
              <span style={{ fontSize: 12, color: "#4ade80", fontFamily: "Manrope, sans-serif" }}>
                ✓ Horário salvo
              </span>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: ASSINATURA
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Assinatura" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, color: "var(--cream)", letterSpacing: -0.4 }}>Assinaturas de E-mail</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--cream-dim)", opacity: 0.6 }}>
                Adicionada automaticamente ao final de respostas por e-mail.
              </p>
            </div>
            <GoldBtn onClick={openNewSig}>+ Nova assinatura</GoldBtn>
          </div>

          {/* Formulário nova/editar assinatura */}
          {showSigForm && (
            <SectionCard title={editingSig ? "Editar assinatura" : "Nova assinatura"}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 14, alignItems: "end" }}>
                <Field label="Nome *">
                  <input value={sigName} onChange={e => setSigName(e.target.value)} placeholder="ex: Padrão, Comercial, Suporte…" style={inputStyle} />
                </Field>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingBottom: 8 }}>
                  <input type="checkbox" checked={sigDefault} onChange={e => setSigDefault(e.target.checked)} style={{ width: 14, height: 14, accentColor: "var(--gold)" }} />
                  <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>Padrão</span>
                </label>
              </div>
              <Field label="Corpo da assinatura">
                <textarea
                  value={sigBody}
                  onChange={e => setSigBody(e.target.value)}
                  placeholder={"Atenciosamente,\nEquipe Flora Botanics\ncontato@florabotanics.com.br"}
                  rows={5}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
                />
              </Field>
              {/* Preview */}
              {sigBody.trim() && (
                <div style={{ marginTop: 12, background: "rgba(10,22,11,0.5)", border: "1px solid rgba(242,236,223,0.07)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold-light)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Preview</div>
                  <pre style={{ margin: 0, fontSize: 12, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", whiteSpace: "pre-wrap" }}>{sigBody}</pre>
                </div>
              )}
              {sigError && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 10 }}>{sigError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <GoldBtn onClick={handleSaveSig} disabled={isPending || !sigName.trim()}>
                  {isPending ? "Salvando…" : editingSig ? "Salvar" : "Criar assinatura"}
                </GoldBtn>
                <button type="button" onClick={() => setShowSigForm(false)} style={{
                  background: "rgba(242,236,223,0.06)", border: "1px solid rgba(242,236,223,0.1)", borderRadius: 9,
                  color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 600,
                  padding: "9px 16px", cursor: "pointer",
                }}>Cancelar</button>
              </div>
            </SectionCard>
          )}

          {sigs.length === 0 && !showSigForm && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 36, color: "var(--gold-light)", opacity: 0.15, marginBottom: 12, fontFamily: "Fraunces, serif" }}>✦</div>
              <p style={{ fontSize: 13, color: "var(--cream-dim)", fontFamily: "Fraunces, serif", fontStyle: "italic" }}>Nenhuma assinatura criada ainda.</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sigs.map(sig => (
              <div key={sig.id} style={{
                background: "rgba(15,32,18,0.55)", border: "1px solid rgba(242,236,223,0.08)",
                borderRadius: 14, padding: "18px 20px", backdropFilter: "blur(20px)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)", display: "flex", alignItems: "center", gap: 8 }}>
                      {sig.name}
                      {sig.is_default && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                          background: "rgba(185,146,77,0.15)", border: "1px solid rgba(185,146,77,0.3)",
                          borderRadius: 5, padding: "2px 7px", color: "var(--gold-light)",
                        }}>Padrão</span>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => openEditSig(sig)} style={{
                    background: "rgba(185,146,77,0.1)", border: "1px solid rgba(185,146,77,0.2)",
                    borderRadius: 7, padding: "5px 12px", fontSize: 11, color: "var(--gold-light)", cursor: "pointer",
                  }}>Editar</button>
                  <button type="button" onClick={() => handleDeleteSig(sig.id)} style={{
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)",
                    borderRadius: 7, padding: "5px 12px", fontSize: 11, color: "#ef4444", cursor: "pointer",
                  }}>Excluir</button>
                </div>
                {sig.body && (
                  <pre style={{
                    margin: 0, fontSize: 12, color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif",
                    whiteSpace: "pre-wrap", lineHeight: 1.55,
                    background: "rgba(10,22,11,0.4)", borderRadius: 8, padding: "10px 14px",
                    border: "1px solid rgba(242,236,223,0.06)",
                  }}>{sig.body.slice(0, 200)}{sig.body.length > 200 ? "…" : ""}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: CANAIS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "Canais" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, color: "var(--cream)", letterSpacing: -0.4 }}>
                Canais de E-mail
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--cream-dim)", opacity: 0.6 }}>
                Configure endereços de e-mail para receber mensagens no helpdesk via Resend.
              </p>
            </div>
            <GoldBtn onClick={openNewChannel}>+ Novo canal</GoldBtn>
          </div>

          {/* Card URL do webhook */}
          <div style={{
            background: "rgba(15,32,18,0.55)", border: "1px solid rgba(185,146,77,0.18)",
            borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(20px)", marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--gold-light)", marginBottom: 10, opacity: 0.8 }}>
              URL do Webhook (Resend)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <code style={{
                flex: 1, fontFamily: "monospace", fontSize: 12.5, color: "var(--cream)",
                background: "rgba(10,22,11,0.6)", border: "1px solid rgba(242,236,223,0.1)",
                borderRadius: 8, padding: "9px 12px", overflowX: "auto", whiteSpace: "nowrap",
              }}>
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyWebhook}
                style={{
                  flexShrink: 0, background: channelCopied ? "rgba(74,222,128,0.12)" : "rgba(185,146,77,0.1)",
                  border: `1px solid ${channelCopied ? "rgba(74,222,128,0.3)" : "rgba(185,146,77,0.25)"}`,
                  borderRadius: 8, padding: "9px 14px", fontSize: 11, fontWeight: 700,
                  color: channelCopied ? "#4ade80" : "var(--gold-light)", cursor: "pointer",
                  transition: "all 0.2s", fontFamily: "Manrope, sans-serif", letterSpacing: 0.5,
                }}
              >
                {channelCopied ? "✓ Copiado" : "Copiar"}
              </button>
            </div>

            {/* Instruções */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(242,236,223,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cream-dim)", marginBottom: 10, letterSpacing: 0.3 }}>
                Como configurar no Resend:
              </div>
              {[
                "Acesse resend.com → Webhooks → Add Webhook",
                "Cole a URL acima no campo Endpoint URL",
                "Marque o evento email.received",
                "Copie o Signing Secret gerado e adicione como RESEND_WEBHOOK_SECRET no painel do Cloudflare",
                "Em Domains → seu domínio, configure o MX record para inbound.resend.com (prioridade 10)",
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 7, alignItems: "flex-start" }}>
                  <span style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                    background: "rgba(185,146,77,0.2)", border: "1px solid rgba(185,146,77,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9.5, fontWeight: 800, color: "var(--gold-light)",
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.55 }}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Formulário novo/editar canal */}
          {showChannelForm && (
            <SectionCard title={editingChannel ? "Editar canal" : "Novo canal de e-mail"}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <Field label="Nome do canal">
                  <input
                    value={channelName}
                    onChange={e => setChannelName(e.target.value)}
                    placeholder="ex: Suporte, Vendas…"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Endereço de e-mail *">
                  <input
                    value={channelEmail}
                    onChange={e => setChannelEmail(e.target.value)}
                    placeholder="suporte@florabotanics.com.br"
                    type="email"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: channelAutoReply ? 14 : 0 }}>
                <Toggle on={channelAutoReply} onChange={setChannelAutoReply} />
                <span style={{ fontSize: 12.5, color: "var(--cream-dim)" }}>Auto-resposta ativa</span>
              </div>

              {channelAutoReply && (
                <div style={{ marginTop: 14 }}>
                  <Field label="Mensagem de auto-resposta">
                    <textarea
                      value={channelAutoReplyMsg}
                      onChange={e => setChannelAutoReplyMsg(e.target.value)}
                      placeholder={"Olá! Recebemos sua mensagem e retornaremos em breve.\n\nEquipe Flora Botanics"}
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
                    />
                  </Field>
                </div>
              )}

              {channelError && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 10 }}>{channelError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <GoldBtn onClick={handleSaveChannel} disabled={isPending || !channelEmail.trim()}>
                  {isPending ? "Salvando…" : editingChannel ? "Salvar alterações" : "Adicionar canal"}
                </GoldBtn>
                <button type="button" onClick={() => setShowChannelForm(false)} style={{
                  background: "rgba(242,236,223,0.06)", border: "1px solid rgba(242,236,223,0.1)", borderRadius: 9,
                  color: "var(--cream-dim)", fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 600,
                  padding: "9px 16px", cursor: "pointer",
                }}>Cancelar</button>
              </div>
            </SectionCard>
          )}

          {/* Lista de canais */}
          {channels.length === 0 && !showChannelForm && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 36, color: "var(--gold-light)", opacity: 0.15, marginBottom: 12, fontFamily: "Fraunces, serif" }}>✉</div>
              <p style={{ fontSize: 13, color: "var(--cream-dim)", fontFamily: "Fraunces, serif", fontStyle: "italic" }}>
                Nenhum canal de e-mail configurado ainda.
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {channels.map(ch => {
              const statusColor: Record<string, string> = {
                connected: "#4ade80", disconnected: "#f0b429", error: "#ef4444",
              };
              const color = statusColor[ch.status] ?? "rgba(242,236,223,0.4)";
              return (
                <div key={ch.id} style={{
                  background: "rgba(15,32,18,0.55)", border: "1px solid rgba(242,236,223,0.08)",
                  borderRadius: 14, padding: "16px 20px", backdropFilter: "blur(20px)",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  {/* Status dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: color,
                    flexShrink: 0, boxShadow: `0 0 6px ${color}88`,
                  }} />

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)", marginBottom: 2 }}>
                      {ch.name || ch.identifier}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--cream-dim)", display: "flex", alignItems: "center", gap: 10 }}>
                      <span>{ch.identifier}</span>
                      {ch.auto_reply_enabled && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                          background: "rgba(125,160,217,0.12)", border: "1px solid rgba(125,160,217,0.25)",
                          borderRadius: 5, padding: "1px 6px", color: "#7ea8d9",
                        }}>Auto-resposta</span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                    color, background: `${color}18`, border: `1px solid ${color}44`,
                    borderRadius: 5, padding: "3px 9px",
                  }}>
                    {ch.status === "connected" ? "Conectado" : ch.status === "disconnected" ? "Desconectado" : "Erro"}
                  </span>

                  <button type="button" onClick={() => openEditChannel(ch)} style={{
                    background: "rgba(185,146,77,0.1)", border: "1px solid rgba(185,146,77,0.2)",
                    borderRadius: 7, padding: "5px 12px", fontSize: 11, color: "var(--gold-light)", cursor: "pointer",
                  }}>Editar</button>
                  <button type="button" onClick={() => handleDeleteChannel(ch.id)} style={{
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)",
                    borderRadius: 7, padding: "5px 12px", fontSize: 11, color: "#ef4444", cursor: "pointer",
                  }}>Remover</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
