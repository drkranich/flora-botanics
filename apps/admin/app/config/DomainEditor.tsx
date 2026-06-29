"use client";

import { useState, useTransition } from "react";
import {
  addTenantDomain,
  removeTenantDomain,
  setPrimaryTenantDomain,
  verifyTenantDomain,
} from "@/lib/config/actions";

export type DomainRow = {
  domain: string;
  is_primary: boolean;
  verified_at: string | null;
};

const inputStyle: React.CSSProperties = {
  minWidth: 240,
  flex: 1,
  border: "1px solid var(--glass-border)",
  borderRadius: 10,
  padding: "11px 14px",
  fontSize: 12,
  fontFamily: "inherit",
  color: "var(--cream)",
  background: "rgba(10, 22, 11, 0.45)",
};

export function DomainEditor({ domains }: { domains: DomainRow[] }) {
  const [domain, setDomain] = useState("florabotanics.com.br");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(action: () => Promise<void>, success: string) {
    setMsg(null);
    startTransition(async () => {
      try {
        await action();
        setMsg(success);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro ao salvar.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form
        action={() => run(() => addTenantDomain(domain), "Domínio adicionado ao CMS.")}
        style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
      >
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="florabotanics.com.br"
          style={inputStyle}
        />
        <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "11px 22px" }}>
          Conectar domínio
        </button>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        {domains.length === 0 ? (
          <div className="glass" style={{ padding: 16, background: "rgba(255, 248, 234, 0.04)" }}>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Nenhum domínio cadastrado para esta marca. Adicione o domínio acima para liberar a conexão no CMS.
            </p>
          </div>
        ) : (
          domains.map((d) => (
            <div
              key={d.domain}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(180px, 1fr) auto",
                gap: 12,
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid var(--glass-border)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, margin: 0, wordBreak: "break-all" }}>{d.domain}</p>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {d.is_primary ? <span className="chip chip-live">Primário</span> : <span className="chip chip-draft">Secundário</span>}
                  {d.verified_at ? <span className="chip chip-live">Verificado</span> : <span className="chip chip-draft">Pendente</span>}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {!d.is_primary ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="btn btn-ghost"
                    onClick={() => run(() => setPrimaryTenantDomain(d.domain), "Domínio definido como primário.")}
                    style={{ padding: "8px 12px", fontSize: 9 }}
                  >
                    Tornar primário
                  </button>
                ) : null}
                {!d.verified_at ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="btn btn-ghost"
                    onClick={() => run(() => verifyTenantDomain(d.domain), "Domínio marcado como verificado.")}
                    style={{ padding: "8px 12px", fontSize: 9 }}
                  >
                    Confirmar DNS
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  className="btn btn-ghost"
                  onClick={() => {
                    if (confirm(`Remover ${d.domain} desta marca?`)) {
                      run(() => removeTenantDomain(d.domain), "Domínio removido.");
                    }
                  }}
                  style={{ padding: "8px 12px", fontSize: 9, color: "#e8a0a0", borderColor: "rgba(232,160,160,0.35)" }}
                >
                  Remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {msg ? <p style={{ margin: 0, color: "var(--gold-light)", fontSize: 12 }}>{msg}</p> : null}
      <p className="muted" style={{ fontSize: 11.5, margin: 0, lineHeight: 1.6 }}>
        Depois de apontar o DNS na Cloudflare, use "Confirmar DNS" para liberar o domínio no CMS.
        O certificado e a rota pública continuam sendo controlados pela Cloudflare.
      </p>
    </div>
  );
}
