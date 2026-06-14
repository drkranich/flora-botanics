"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Transferência de propriedade da marca.
 * — Proprietário: escolhe sucessor(a), lê o termo, reconfirma a senha e solicita.
 * — Destinatária: vê a pendência, lê o termo, reconfirma a senha e aprova/recusa.
 * Cada passo é uma assinatura eletrônica registrada em audit_logs (banco).
 */

type Member = { id: string; email: string; full_name: string | null; role: string };
type Transfer = {
  id: string;
  from_owner: string;
  to_user: string;
  status: string;
  term_text: string;
  requested_at: string;
};

export function TransferOwnership({
  userId,
  email,
  fullName,
  role,
}: {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}) {
  const [team, setTeam] = useState<Member[]>([]);
  const [incoming, setIncoming] = useState<Transfer | null>(null);
  const [outgoing, setOutgoing] = useState<Transfer | null>(null);
  const [fromName, setFromName] = useState<string>("");
  const [target, setTarget] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data: me } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.tenant_id) return;

    const [{ data: transfers }, { data: members }] = await Promise.all([
      supabase
        .from("ownership_transfers")
        .select("id, from_owner, to_user, status, term_text, requested_at")
        .eq("tenant_id", me.tenant_id)
        .eq("status", "pending"),
      role === "tenant_owner" ? supabase.rpc("team_list", { t: me.tenant_id }) : Promise.resolve({ data: [] }),
    ]);

    const pend = (transfers ?? []) as Transfer[];
    const inc = pend.find((t) => t.to_user === userId) ?? null;
    setIncoming(inc);
    setOutgoing(pend.find((t) => t.from_owner === userId) ?? null);
    setTeam(((members ?? []) as Member[]).filter((m) => m.id !== userId && m.role !== "tenant_editor"));

    if (inc) {
      const { data: from } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", inc.from_owner)
        .maybeSingle();
      setFromName(from?.full_name || from?.email || "Proprietário(a)");
    }
  }, [userId, role]);

  useEffect(() => {
    load();
  }, [load]);

  /** Reconfirma a senha — a "assinatura" exige provar que é você. */
  async function reauth(): Promise<boolean> {
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setErr("Senha incorreta — a assinatura exige confirmar sua senha.");
      return false;
    }
    return true;
  }

  function term(successor: Member) {
    return (
      `Eu, ${fullName || email} (${email}), transfiro a propriedade desta marca para ` +
      `${successor.full_name || successor.email} (${successor.email}) e estou ciente de que ` +
      `deixarei de ser proprietário(a), passando ao papel de Administrador(a). ` +
      `Assinatura eletrônica registrada em ${new Date().toLocaleString("pt-BR")}.`
    );
  }

  async function request() {
    const successor = team.find((m) => m.id === target);
    if (!successor) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!(await reauth())) return;
      const { error } = await supabaseBrowser().rpc("request_ownership_transfer", {
        target: successor.id,
        term: term(successor),
      });
      if (error) {
        setErr(error.message.replace(/^.*?:\s*/, ""));
        return;
      }
      setMsg("Pedido registrado. Agora falta a aprovação da pessoa escolhida.");
      setPassword("");
      setAgreed(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function decide(approve: boolean) {
    if (!incoming) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!(await reauth())) return;
      const { error } = await supabaseBrowser().rpc("decide_ownership_transfer", {
        transfer: incoming.id,
        approve,
      });
      if (error) {
        setErr(error.message.replace(/^.*?:\s*/, ""));
        return;
      }
      setMsg(
        approve
          ? "Transferência aprovada — você agora é proprietária(o) da marca. Saia e entre de novo para o novo papel valer."
          : "Transferência recusada."
      );
      setPassword("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!outgoing) return;
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabaseBrowser().rpc("cancel_ownership_transfer", {
        transfer: outgoing.id,
      });
      if (error) setErr(error.message.replace(/^.*?:\s*/, ""));
      else {
        setMsg("Pedido cancelado.");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  const pwInput = (
    <div className="field">
      <label className="field-label">Confirme sua senha para assinar</label>
      <input
        className="input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
      />
    </div>
  );

  /* ---------- pendência recebida (qualquer papel elegível) ---------- */
  if (incoming) {
    return (
      <section className="glass rise rise-2" style={{ padding: 26, marginTop: 18, border: "1px solid rgba(203, 178, 122, 0.45)" }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>♛ Transferência de propriedade aguardando você</p>
        <p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
          <strong>{fromName}</strong> quer transferir a propriedade da marca para você.
        </p>
        <blockquote style={{ fontSize: 12.5, lineHeight: 1.8, padding: "14px 18px", borderLeft: "3px solid var(--gold)", background: "rgba(203, 178, 122, 0.07)", borderRadius: "0 12px 12px 0", marginBottom: 16 }}>
          {incoming.term_text}
        </blockquote>
        {pwInput}
        {err ? <p style={{ color: "#e8a0a0", fontSize: 12, marginTop: 10 }}>{err}</p> : null}
        {msg ? <p style={{ color: "var(--gold-light)", fontSize: 12, marginTop: 10 }}>{msg}</p> : null}
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="btn btn-gold" disabled={busy || !password} onClick={() => decide(true)} style={{ padding: "11px 24px" }}>
            {busy ? "…" : "Assinar e aceitar a propriedade"}
          </button>
          <button className="btn btn-ghost" disabled={busy || !password} onClick={() => decide(false)} style={{ padding: "11px 18px" }}>
            Recusar
          </button>
        </div>
      </section>
    );
  }

  if (role !== "tenant_owner") return msg ? <p style={{ color: "var(--gold-light)", fontSize: 12, marginTop: 14 }}>{msg}</p> : null;

  /* ---------- proprietário: pedido em andamento ---------- */
  if (outgoing) {
    return (
      <section className="glass rise rise-2" style={{ padding: 26, marginTop: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Transferência de propriedade</p>
        <p style={{ fontSize: 13, lineHeight: 1.7 }}>
          Seu pedido está <strong>aguardando a assinatura</strong> da pessoa escolhida
          (solicitado em {new Date(outgoing.requested_at).toLocaleString("pt-BR")}).
        </p>
        {err ? <p style={{ color: "#e8a0a0", fontSize: 12, marginTop: 10 }}>{err}</p> : null}
        {msg ? <p style={{ color: "var(--gold-light)", fontSize: 12, marginTop: 10 }}>{msg}</p> : null}
        <button className="btn btn-ghost" disabled={busy} onClick={cancel} style={{ padding: "10px 18px", marginTop: 14 }}>
          Cancelar pedido
        </button>
      </section>
    );
  }

  /* ---------- proprietário: solicitar ---------- */
  const successor = team.find((m) => m.id === target);
  return (
    <section className="glass rise rise-2" style={{ padding: 26, marginTop: 18 }}>
      <p className="eyebrow" style={{ marginBottom: 8 }}>Transferir propriedade da marca</p>
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
        Necessário antes de excluir sua conta. A pessoa escolhida precisa assinar
        eletronicamente aceitando — só então ela vira proprietária e você passa a
        Administrador. Tudo fica registrado na auditoria.
      </p>

      {team.length === 0 ? (
        <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "#e8c9a0" }}>
          Não há outra pessoa elegível (proprietária ou administradora) na equipe.
          Convide alguém como Administrador em Configurações → Equipe primeiro.
        </p>
      ) : (
        <>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label">Quem assume a marca</label>
            <select className="input" value={target} onChange={(e) => { setTarget(e.target.value); setAgreed(false); }}>
              <option value="">Escolha…</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email} ({m.email})
                </option>
              ))}
            </select>
          </div>

          {successor ? (
            <>
              <blockquote style={{ fontSize: 12.5, lineHeight: 1.8, padding: "14px 18px", borderLeft: "3px solid var(--gold)", background: "rgba(203, 178, 122, 0.07)", borderRadius: "0 12px 12px 0", marginBottom: 14 }}>
                {term(successor)}
              </blockquote>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.6, cursor: "pointer", marginBottom: 14 }}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
                Li e concordo com o termo acima.
              </label>
              {pwInput}
            </>
          ) : null}

          {err ? <p style={{ color: "#e8a0a0", fontSize: 12, marginTop: 10 }}>{err}</p> : null}
          {msg ? <p style={{ color: "var(--gold-light)", fontSize: 12, marginTop: 10 }}>{msg}</p> : null}

          <button
            className="btn btn-gold"
            disabled={busy || !successor || !agreed || !password}
            onClick={request}
            style={{ padding: "11px 24px", marginTop: 14 }}
          >
            {busy ? "Assinando…" : "Assinar e solicitar transferência"}
          </button>
        </>
      )}
    </section>
  );
}
