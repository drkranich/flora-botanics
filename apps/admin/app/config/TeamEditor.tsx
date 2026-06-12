"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  inviteTeamMember,
  setTeamRole,
  removeTeamMember,
  revokeInvite,
  type TeamMember,
  type PendingInvite,
} from "@/lib/config/team-actions";

const ROLE_LABEL: Record<string, string> = {
  platform_admin: "Admin da Plataforma",
  tenant_owner: "Proprietário",
  tenant_admin: "Administrador",
  tenant_editor: "Editor",
};

/**
 * O que cada papel pode fazer (aplicado na navegação e nos guards):
 * — Proprietário/Administrador: tudo (site, catálogo, vendas, configurações, equipe)
 * — Editor: Site (CMS) e Catálogo; não vê Vendas, Configurações nem Equipe
 */
const ROLE_HINT: Record<string, string> = {
  tenant_admin: "Acesso total à marca: site, catálogo, vendas, configurações e equipe.",
  tenant_editor: "Edita o site e o catálogo. Sem acesso a vendas e configurações.",
};

export function TeamEditor({
  members,
  invites,
  myId,
  canManage,
}: {
  members: TeamMember[];
  invites: PendingInvite[];
  myId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"tenant_admin" | "tenant_editor">("tenant_editor");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div>
      {/* membros */}
      {members.map((m) => {
        const locked = m.role === "tenant_owner" || m.role === "platform_admin" || m.id === myId;
        return (
          <div
            key={m.id}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--glass-border)", flexWrap: "wrap" }}
          >
            <div style={{ minWidth: 200 }}>
              <p style={{ fontSize: 13.5 }}>{m.full_name || m.email}</p>
              <p className="muted" style={{ fontSize: 11 }}>{m.email}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {canManage && !locked ? (
                <>
                  <select
                    className="input"
                    value={m.role}
                    disabled={pending}
                    onChange={(e) => run(() => setTeamRole(m.id, e.target.value as "tenant_admin" | "tenant_editor"))}
                    style={{ width: "auto", padding: "8px 12px", fontSize: 12 }}
                  >
                    <option value="tenant_admin">Administrador</option>
                    <option value="tenant_editor">Editor</option>
                  </select>
                  <button
                    className="btn btn-ghost"
                    disabled={pending}
                    title="Remover da equipe"
                    style={{ padding: "8px 12px", fontSize: 12, color: "#e8a0a0" }}
                    onClick={() => {
                      if (window.confirm(`Remover ${m.email} da equipe? A pessoa vira cliente comum.`)) {
                        run(() => removeTeamMember(m.id));
                      }
                    }}
                  >
                    Remover
                  </button>
                </>
              ) : (
                <span className="chip chip-draft">{ROLE_LABEL[m.role] ?? m.role}{m.id === myId ? " · você" : ""}</span>
              )}
            </div>
          </div>
        );
      })}

      {/* convites pendentes */}
      {invites.length > 0 ? (
        <>
          <p className="eyebrow" style={{ marginTop: 20, marginBottom: 4 }}>Convites pendentes</p>
          {invites.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--glass-border)" }}>
              <div>
                <p style={{ fontSize: 13 }}>{i.email}</p>
                <p className="muted" style={{ fontSize: 10.5 }}>
                  {ROLE_LABEL[i.role]} · aguardando primeiro acesso
                </p>
              </div>
              {canManage ? (
                <button
                  className="btn btn-ghost"
                  disabled={pending}
                  style={{ padding: "8px 14px", fontSize: 11 }}
                  onClick={() => run(() => revokeInvite(i.id))}
                >
                  Revogar
                </button>
              ) : null}
            </div>
          ))}
        </>
      ) : null}

      {/* convidar */}
      {canManage ? (
        <form
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 22 }}
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const applied = await inviteTeamMember(email, role);
              setEmail("");
              setMsg(
                applied
                  ? "Acesso concedido! A pessoa já tinha conta — basta sair e entrar de novo."
                  : "Convite criado. No primeiro acesso com este e-mail, o papel é aplicado automaticamente."
              );
            });
          }}
        >
          <div style={{ flex: "1 1 220px" }}>
            <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 6 }}>E-mail</label>
            <input
              className="input"
              type="email"
              placeholder="pessoa@florabotanics.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="muted" style={{ fontSize: 11, display: "block", marginBottom: 6 }}>Papel</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as "tenant_admin" | "tenant_editor")}
              style={{ width: "auto", padding: "12px 14px" }}
            >
              <option value="tenant_editor">Editor</option>
              <option value="tenant_admin">Administrador</option>
            </select>
          </div>
          <button type="submit" className="btn btn-gold" disabled={pending} style={{ padding: "12px 22px" }}>
            {pending ? "…" : "Convidar"}
          </button>
          <p className="muted" style={{ fontSize: 11, width: "100%", lineHeight: 1.6 }}>{ROLE_HINT[role]}</p>
        </form>
      ) : null}

      {msg ? <p style={{ color: "var(--gold-light)", fontSize: 12, marginTop: 12 }}>{msg}</p> : null}
      {err ? <p style={{ color: "#e8a0a0", fontSize: 12, marginTop: 12 }}>{err}</p> : null}
    </div>
  );
}
