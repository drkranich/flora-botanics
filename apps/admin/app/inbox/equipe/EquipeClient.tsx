"use client";

import { useState, useTransition } from "react";
import type { AgentProfile, InboxTeam } from "./actions";
import { updateAgentProfile, inviteAgent, removeAgent } from "./actions";
import { GlassSelect } from "@/components/GlassSelect";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  platform_admin: "Admin da Plataforma",
  tenant_owner: "Proprietário",
  tenant_admin: "Administrador",
  tenant_editor: "Editor",
};

const ROLE_COLOR: Record<string, string> = {
  platform_admin: "#f0b429",
  tenant_owner: "#d9b87a",
  tenant_admin: "#60a5fa",
  tenant_editor: "#4ade80",
};

const PERM_LABELS: Record<string, string> = {
  can_reply:               "Responder conversas",
  can_assign:              "Atribuir conversas",
  can_resolve:             "Resolver conversas",
  can_delete:              "Excluir mensagens",
  can_export:              "Exportar histórico",
  view_all_conversations:  "Ver todas as conversas",
  view_team_conversations: "Ver conversas da equipe",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(10,22,11,0.6)",
  border: "1px solid rgba(242,236,223,0.1)",
  borderRadius: 8, padding: "8px 11px",
  color: "var(--cream)", fontSize: 12.5,
  fontFamily: "Manrope, sans-serif",
  outline: "none", width: "100%", boxSizing: "border-box",
};

function Avatar({ name, size = 36 }: { name: string | null; size?: number }) {
  const initials = (name ?? "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, rgba(185,146,77,0.3), rgba(185,146,77,0.1))",
      border: "1px solid rgba(185,146,77,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Manrope, sans-serif", fontWeight: 800,
      fontSize: size * 0.35, color: "var(--gold-light)",
    }}>
      {initials}
    </div>
  );
}

// ── Painel de edição do agente ────────────────────────────────────────────────

function AgentDrawer({
  agent,
  onClose,
  onSaved,
  canManage,
}: {
  agent: AgentProfile;
  onClose: () => void;
  onSaved: () => void;
  canManage: boolean;
}) {
  const [fullName,   setFullName]   = useState(agent.full_name ?? "");
  const [phone,      setPhone]      = useState(agent.phone ?? "");
  const [whatsapp,   setWhatsapp]   = useState(agent.whatsapp ?? "");
  const [department, setDepartment] = useState(agent.department ?? "");
  const [jobTitle,   setJobTitle]   = useState(agent.job_title ?? "");
  const [perms,      setPerms]      = useState({ ...agent.inbox_permissions });
  const [err,        setErr]        = useState<string | null>(null);
  const [isPending,  start]         = useTransition();

  function togglePerm(key: keyof typeof perms) {
    setPerms(p => ({ ...p, [key]: !p[key] }));
  }

  function save() {
    setErr(null);
    start(async () => {
      const res = await updateAgentProfile(agent.id, {
        full_name: fullName, phone, whatsapp, department, job_title: jobTitle,
        inbox_permissions: perms,
      });
      if (!res.ok) { setErr(res.error); return; }
      onSaved();
      onClose();
    });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "min(560px, 94vw)",
        background: "rgba(10,22,11,0.98)",
        border: "1px solid rgba(242,236,223,0.1)",
        borderRadius: 18, padding: "26px 28px 24px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
        backdropFilter: "blur(24px)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <Avatar name={agent.full_name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, color: "var(--cream)" }}>
              {agent.full_name ?? "Agente"}
            </div>
            <div style={{ fontSize: 11, color: "var(--cream-dim)", marginTop: 2 }}>{agent.email}</div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(242,236,223,0.06)", border: "1px solid rgba(242,236,223,0.1)",
            borderRadius: 8, color: "var(--cream-dim)", fontSize: 16, cursor: "pointer",
            width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Dados pessoais */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--gold-light)", opacity: 0.7, marginBottom: 12 }}>
            Dados pessoais
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", marginBottom: 4 }}>Nome completo</label>
              <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} disabled={!canManage} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", marginBottom: 4 }}>Telefone</label>
              <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} disabled={!canManage} placeholder="(51) 9xxxx-xxxx" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", marginBottom: 4 }}>WhatsApp</label>
              <input style={inputStyle} value={whatsapp} onChange={e => setWhatsapp(e.target.value)} disabled={!canManage} placeholder="(51) 9xxxx-xxxx" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", marginBottom: 4 }}>Cargo / Função</label>
              <input style={inputStyle} value={jobTitle} onChange={e => setJobTitle(e.target.value)} disabled={!canManage} placeholder="Atendente, Supervisor…" />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", marginBottom: 4 }}>Setor / Departamento</label>
              <input style={inputStyle} value={department} onChange={e => setDepartment(e.target.value)} disabled={!canManage} placeholder="Vendas, Suporte, Financeiro…" />
            </div>
          </div>
        </div>

        {/* Equipes */}
        {agent.teams.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--gold-light)", opacity: 0.7, marginBottom: 10 }}>
              Equipes
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {agent.teams.map(t => (
                <span key={t.id} style={{
                  background: `${t.color}18`, border: `1px solid ${t.color}40`,
                  borderRadius: 6, padding: "3px 10px",
                  fontSize: 11, fontWeight: 600, color: t.color,
                  fontFamily: "Manrope, sans-serif",
                }}>{t.name}</span>
              ))}
            </div>
          </div>
        )}

        {/* Permissões do inbox */}
        {canManage && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--gold-light)", opacity: 0.7, marginBottom: 12 }}>
              Permissões no chat
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(Object.keys(PERM_LABELS) as (keyof typeof perms)[]).map(key => (
                <label key={key} style={{
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  padding: "8px 12px",
                  background: perms[key] ? "rgba(185,146,77,0.07)" : "rgba(242,236,223,0.03)",
                  border: `1px solid ${perms[key] ? "rgba(185,146,77,0.2)" : "rgba(242,236,223,0.06)"}`,
                  borderRadius: 8, transition: "all 0.15s",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    background: perms[key] ? "var(--gold-light)" : "rgba(242,236,223,0.08)",
                    border: `1.5px solid ${perms[key] ? "var(--gold-light)" : "rgba(242,236,223,0.2)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {perms[key] && <span style={{ color: "#0a160b", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                  <input type="checkbox" checked={perms[key]} onChange={() => togglePerm(key)} style={{ display: "none" }} />
                  <span style={{ fontSize: 12.5, color: perms[key] ? "var(--cream)" : "var(--cream-dim)", fontFamily: "Manrope, sans-serif" }}>
                    {PERM_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {err && <p style={{ fontSize: 11.5, color: "#ef4444", marginBottom: 12 }}>{err}</p>}

        {canManage && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onClose} style={{
              background: "none", border: "none", fontSize: 12,
              color: "var(--cream-dim)", cursor: "pointer", padding: "8px 14px",
            }}>Cancelar</button>
            <button onClick={save} disabled={isPending} style={{
              background: "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
              border: "none", borderRadius: 8, color: "var(--forest-950)",
              fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 800,
              letterSpacing: 1, textTransform: "uppercase", padding: "9px 22px",
              cursor: isPending ? "wait" : "pointer", opacity: isPending ? 0.6 : 1,
              boxShadow: "0 4px 14px rgba(185,146,77,0.3)",
            }}>
              {isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal de convite ──────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email,      setEmail]      = useState("");
  const [role,       setRole]       = useState<"tenant_admin" | "tenant_editor">("tenant_editor");
  const [department, setDepartment] = useState("");
  const [jobTitle,   setJobTitle]   = useState("");
  const [msg,        setMsg]        = useState<string | null>(null);
  const [err,        setErr]        = useState<string | null>(null);
  const [isPending,  start]         = useTransition();

  function submit() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await inviteAgent(email, role, department || undefined, jobTitle || undefined);
      if (!res.ok) { setErr(res.error); return; }
      setMsg(res.data?.applied ? "Acesso concedido imediatamente." : "Convite enviado por e-mail.");
      onInvited();
      setTimeout(onClose, 1500);
    });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "min(440px, 94vw)",
        background: "rgba(10,22,11,0.98)",
        border: "1px solid rgba(242,236,223,0.1)",
        borderRadius: 18, padding: "26px 28px 24px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
        backdropFilter: "blur(24px)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, color: "var(--cream)" }}>
            Convidar agente
          </div>
          <button onClick={onClose} style={{
            background: "rgba(242,236,223,0.06)", border: "1px solid rgba(242,236,223,0.1)",
            borderRadius: 8, color: "var(--cream-dim)", fontSize: 16, cursor: "pointer",
            width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", marginBottom: 4 }}>E-mail *</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="agente@florabotanics.com" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", marginBottom: 4 }}>Nível de acesso</label>
            <GlassSelect
              value={role}
              onChange={v => setRole(v as "tenant_admin" | "tenant_editor")}
              options={[
                { value: "tenant_editor", label: "Editor — atende e edita conteúdo" },
                { value: "tenant_admin", label: "Administrador — acesso total" },
              ]}
              ariaLabel="Nível de acesso"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", marginBottom: 4 }}>Cargo / Função</label>
            <input style={inputStyle} value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Atendente, Supervisor…" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--cream-dim)", marginBottom: 4 }}>Setor</label>
            <input style={inputStyle} value={department} onChange={e => setDepartment(e.target.value)} placeholder="Vendas, Suporte, Financeiro…" />
          </div>
        </div>

        {msg && <p style={{ fontSize: 11.5, color: "#4ade80", marginTop: 12 }}>✓ {msg}</p>}
        {err && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 12 }}>{err}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 12,
            color: "var(--cream-dim)", cursor: "pointer", padding: "8px 14px",
          }}>Cancelar</button>
          <button onClick={submit} disabled={isPending || !email.trim()} style={{
            background: "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
            border: "none", borderRadius: 8, color: "var(--forest-950)",
            fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 800,
            letterSpacing: 1, textTransform: "uppercase", padding: "9px 22px",
            cursor: (isPending || !email.trim()) ? "default" : "pointer",
            opacity: (isPending || !email.trim()) ? 0.5 : 1,
            boxShadow: "0 4px 14px rgba(185,146,77,0.3)",
          }}>
            {isPending ? "Enviando…" : "Convidar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  agents: AgentProfile[];
  teams: InboxTeam[];
  myId: string;
  canManage: boolean;
}

export function EquipeClient({ agents, teams, myId, canManage }: Props) {
  const [view,         setView]         = useState<"agentes" | "setores">("agentes");
  const [editing,      setEditing]      = useState<AgentProfile | null>(null);
  const [showInvite,   setShowInvite]   = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterDept,   setFilterDept]   = useState("todos");
  const [localAgents,  setLocalAgents]  = useState(agents);
  const [localTeams,   setLocalTeams]   = useState(teams);
  const [isPending,    start]           = useTransition();

  const departments = ["todos", ...Array.from(new Set(localAgents.map(a => a.department).filter(Boolean) as string[]))];

  const filtered = localAgents.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || (a.full_name ?? "").toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q) || (a.department ?? "").toLowerCase().includes(q);
    const matchDept = filterDept === "todos" || a.department === filterDept;
    return matchSearch && matchDept;
  });

  function refresh() {
    start(async () => {
      const { getAgents, getTeamsWithMembers } = await import("./actions");
      const [ag, tm] = await Promise.all([getAgents(), getTeamsWithMembers()]);
      setLocalAgents(ag);
      setLocalTeams(tm);
    });
  }

  function handleRemove(agentId: string) {
    if (!confirm("Remover este agente do tenant?")) return;
    start(async () => {
      const res = await removeAgent(agentId);
      if (!res.ok) alert(res.error);
      else refresh();
    });
  }

  return (
    <div style={{ padding: "28px 32px 48px", maxWidth: 1000, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600, color: "var(--cream)", margin: 0, letterSpacing: -0.5 }}>
            Equipe de Atendimento
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--cream-dim)", margin: "4px 0 0", opacity: 0.6 }}>
            Gerencie agentes, setores e permissões do chat.
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowInvite(true)} style={{
            background: "linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-dark))",
            border: "none", borderRadius: 10, color: "var(--forest-950)",
            fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 10,
            letterSpacing: 1.5, textTransform: "uppercase", padding: "10px 20px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 4px 16px rgba(185,146,77,0.3)",
          }}>
            <span style={{ fontSize: 14 }}>+</span> Convidar agente
          </button>
        )}
      </div>

      {/* Tabs view */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {(["agentes", "setores"] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? "rgba(185,146,77,0.13)" : "rgba(242,236,223,0.04)",
            border: `1px solid ${view === v ? "rgba(185,146,77,0.3)" : "rgba(242,236,223,0.08)"}`,
            borderRadius: 8, color: view === v ? "var(--gold-light)" : "var(--cream-dim)",
            fontFamily: "Manrope, sans-serif", fontSize: 12.5, fontWeight: view === v ? 700 : 500,
            padding: "7px 16px", cursor: "pointer", transition: "all 0.2s",
            textTransform: "capitalize",
          }}>
            {v === "agentes" ? `◉ Agentes (${localAgents.length})` : `⬡ Por Setor`}
          </button>
        ))}
      </div>

      {/* ── Vista: Agentes ── */}
      {view === "agentes" && (
        <>
          {/* Filtros */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              style={{ ...inputStyle, maxWidth: 260 }}
              placeholder="Buscar por nome, e-mail ou setor…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
            <GlassSelect
              value={filterDept}
              onChange={v => setFilterDept(v)}
              options={departments.map(d => ({ value: d, label: d === "todos" ? "Todos os setores" : d }))}
              ariaLabel="Filtrar por setor"
              style={{ ...inputStyle, maxWidth: 200 }}
            />
          </div>

          {/* Tabela */}
          <div style={{
            background: "rgba(15,32,18,0.55)",
            border: "1px solid rgba(242,236,223,0.07)",
            borderRadius: 14, overflow: "hidden",
            backdropFilter: "blur(20px)",
          }}>
            {/* Cabeçalho */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
              padding: "10px 18px",
              borderBottom: "1px solid rgba(242,236,223,0.06)",
              fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase",
              color: "var(--cream-dim)", opacity: 0.6,
            }}>
              <span>Agente</span><span>Setor</span><span>Cargo</span><span>Nível</span><span></span>
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--cream-dim)", fontSize: 12.5, fontStyle: "italic", opacity: 0.5 }}>
                Nenhum agente encontrado.
              </div>
            )}

            {filtered.map((agent, idx) => (
              <div key={agent.id} style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                padding: "13px 18px", alignItems: "center", gap: 10,
                borderBottom: idx < filtered.length - 1 ? "1px solid rgba(242,236,223,0.04)" : "none",
                background: agent.id === myId ? "rgba(185,146,77,0.04)" : "transparent",
                transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(242,236,223,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = agent.id === myId ? "rgba(185,146,77,0.04)" : "transparent")}
              >
                {/* Nome */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Avatar name={agent.full_name} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cream)", fontFamily: "Manrope, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {agent.full_name ?? "—"}
                      {agent.id === myId && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--gold-light)", fontWeight: 700, letterSpacing: 0.5 }}>VOCÊ</span>}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--cream-dim)", opacity: 0.55 }}>{agent.email}</div>
                  </div>
                </div>

                {/* Setor */}
                <span style={{ fontSize: 12, color: agent.department ? "var(--cream-soft)" : "rgba(242,236,223,0.25)", fontFamily: "Manrope, sans-serif" }}>
                  {agent.department ?? "—"}
                </span>

                {/* Cargo */}
                <span style={{ fontSize: 12, color: agent.job_title ? "var(--cream-soft)" : "rgba(242,236,223,0.25)", fontFamily: "Manrope, sans-serif" }}>
                  {agent.job_title ?? "—"}
                </span>

                {/* Nível */}
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                  color: ROLE_COLOR[agent.role] ?? "var(--cream-dim)",
                  background: `${ROLE_COLOR[agent.role] ?? "#6b7280"}15`,
                  border: `1px solid ${ROLE_COLOR[agent.role] ?? "#6b7280"}30`,
                  borderRadius: 5, padding: "2px 8px",
                  fontFamily: "Manrope, sans-serif", whiteSpace: "nowrap",
                }}>
                  {ROLE_LABEL[agent.role] ?? agent.role}
                </span>

                {/* Ações */}
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => setEditing(agent)}
                    title="Editar"
                    style={{
                      background: "rgba(185,146,77,0.08)", border: "1px solid rgba(185,146,77,0.2)",
                      borderRadius: 7, color: "var(--gold-light)", cursor: "pointer",
                      fontSize: 11, padding: "5px 10px", fontFamily: "Manrope, sans-serif",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(185,146,77,0.15)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(185,146,77,0.08)")}
                  >✏</button>
                  {canManage && agent.id !== myId && !["tenant_owner", "platform_admin"].includes(agent.role) && (
                    <button
                      onClick={() => handleRemove(agent.id)}
                      title="Remover"
                      style={{
                        background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)",
                        borderRadius: 7, color: "#ef4444", cursor: "pointer",
                        fontSize: 11, padding: "5px 10px",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.14)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.07)")}
                    >✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Vista: Por Setor (Equipes) ── */}
      {view === "setores" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Agentes sem equipe */}
          {(() => {
            const inTeam = new Set(localTeams.flatMap(t => t.members.map(m => m.id)));
            const solo = localAgents.filter(a => !inTeam.has(a.id));
            if (!solo.length) return null;
            return (
              <div style={{
                background: "rgba(15,32,18,0.55)", border: "1px solid rgba(242,236,223,0.07)",
                borderRadius: 14, padding: "16px 20px", backdropFilter: "blur(20px)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6b7280" }} />
                  <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>Sem equipe atribuída</span>
                  <span style={{ fontSize: 10, color: "var(--cream-dim)", background: "rgba(242,236,223,0.08)", borderRadius: 5, padding: "2px 7px" }}>{solo.length}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {solo.map(a => (
                    <div key={a.id} onClick={() => setEditing(a)} style={{
                      display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                      background: "rgba(242,236,223,0.04)", border: "1px solid rgba(242,236,223,0.07)",
                      borderRadius: 8, padding: "7px 12px", transition: "background 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(242,236,223,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(242,236,223,0.04)")}
                    >
                      <Avatar name={a.full_name} size={24} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cream)", fontFamily: "Manrope, sans-serif" }}>{a.full_name ?? "—"}</div>
                        <div style={{ fontSize: 10, color: "var(--cream-dim)", opacity: 0.5 }}>{a.job_title ?? a.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {localTeams.map(team => (
            <div key={team.id} style={{
              background: "rgba(15,32,18,0.55)", border: "1px solid rgba(242,236,223,0.07)",
              borderRadius: 14, padding: "16px 20px", backdropFilter: "blur(20px)",
            }}>
              {/* Header do setor */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: team.color, boxShadow: `0 0 8px ${team.color}66` }} />
                <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>{team.name}</span>
                <span style={{
                  fontSize: 10, color: team.color, background: `${team.color}15`,
                  border: `1px solid ${team.color}35`, borderRadius: 5, padding: "2px 7px",
                }}>{team.members.length} agente{team.members.length !== 1 ? "s" : ""}</span>
                {team.description && (
                  <span style={{ fontSize: 11, color: "var(--cream-dim)", opacity: 0.5, marginLeft: 4 }}>{team.description}</span>
                )}
              </div>

              {team.members.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--cream-dim)", opacity: 0.4, fontStyle: "italic", margin: 0 }}>Nenhum agente nesta equipe.</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {team.members.map(agent => (
                    <div key={agent.id} onClick={() => setEditing(agent)} style={{
                      display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                      background: "rgba(242,236,223,0.04)", border: "1px solid rgba(242,236,223,0.07)",
                      borderRadius: 8, padding: "8px 12px", transition: "background 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(242,236,223,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(242,236,223,0.04)")}
                    >
                      <Avatar name={agent.full_name} size={28} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--cream)", fontFamily: "Manrope, sans-serif" }}>
                          {agent.full_name ?? "—"}
                          {agent.id === myId && <span style={{ marginLeft: 5, fontSize: 9, color: team.color }}>VOCÊ</span>}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--cream-dim)", opacity: 0.5 }}>{agent.job_title ?? agent.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {localTeams.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--cream-dim)", fontSize: 12.5, fontStyle: "italic", opacity: 0.4 }}>
              Nenhuma equipe criada ainda. Configure equipes em{" "}
              <a href="/inbox/settings" style={{ color: "var(--gold-light)", textDecoration: "none" }}>Configurações de Atendimento</a>.
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {editing && (
        <AgentDrawer
          agent={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
          canManage={canManage}
        />
      )}
      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onInvited={refresh} />
      )}
    </div>
  );
}
