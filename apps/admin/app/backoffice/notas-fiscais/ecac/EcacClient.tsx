"use client";

import { useState, useTransition } from "react";
import {
  salvarCredenciaisEcacAction,
  consultarEcacAction,
  testarConexaoEcacAction,
} from "./ecac-actions";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EcacConfig = {
  consumer_key:     string;
  consumer_secret:  string;
  cnpj_contratante: string;
  ativo:            boolean;
};

type CacheEntry = {
  tipo:         string;
  dados:        Record<string, unknown>;
  consultado_at: string;
};

type Props = {
  config:      EcacConfig | null;
  cnpjEmitente: string;
  cache:        CacheEntry[];
};

// ─── Labels ───────────────────────────────────────────────────────────────────

const ACOES = [
  { id: "situacao-fiscal", label: "Situação Fiscal",   icon: "📊", desc: "Pendências na RFB e PGFN" },
  { id: "cnd",             label: "CND",               icon: "📄", desc: "Certidão Negativa de Débitos" },
  { id: "caixa-postal",    label: "Caixa Postal",      icon: "📬", desc: "Mensagens do e-CAC" },
  { id: "simples-nacional",label: "Simples Nacional",  icon: "🧾", desc: "Extrato DAS / consultas SN" },
] as const;

// ─── Componente ───────────────────────────────────────────────────────────────

export function EcacClient({ config, cnpjEmitente, cache }: Props) {
  const [isPending, startTransition] = useTransition();

  // Formulário de credenciais
  const [consumerKey,    setConsumerKey]    = useState(config?.consumer_key     ?? "");
  const [consumerSecret, setConsumerSecret] = useState(config?.consumer_secret  ?? "");
  const [cnpjContrat,    setCnpjContrat]    = useState(config?.cnpj_contratante ?? "");
  const [credMsg,        setCredMsg]        = useState<{ ok: boolean; text: string } | null>(null);

  // Resultados das consultas
  const [results, setResults] = useState<Record<string, { ok: boolean; data?: unknown; error?: string }>>({});
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const hasCredentials = !!(consumerKey && consumerSecret);
  const credentialsSaved = !!(config?.consumer_key && config?.consumer_secret);

  // Salva credenciais
  function handleSalvar() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("consumer_key",     consumerKey);
      fd.set("consumer_secret",  consumerSecret);
      fd.set("cnpj_contratante", cnpjContrat);
      const res = await salvarCredenciaisEcacAction(fd);
      setCredMsg({ ok: res.ok, text: res.msg });
    });
  }

  // Testa conexão
  function handleTestar() {
    startTransition(async () => {
      setCredMsg(null);
      const res = await testarConexaoEcacAction({ consumerKey, consumerSecret });
      setCredMsg({
        ok: res.ok,
        text: res.ok ? "✅ Conexão com SERPRO confirmada!" : `❌ ${res.error}`,
      });
    });
  }

  // Consulta serviço específico
  function handleConsultar(action: string) {
    setActiveTab(action);
    startTransition(async () => {
      const res = await consultarEcacAction({
        action,
        cnpj:             cnpjEmitente,
        cnpjContratante:  cnpjContrat || cnpjEmitente,
        consumerKey:      config?.consumer_key     || consumerKey,
        consumerSecret:   config?.consumer_secret  || consumerSecret,
      });
      setResults((prev) => ({ ...prev, [action]: res }));
    });
  }

  // ─── Encontra cache para um tipo ──────────────────────────────────────────
  function getCacheEntry(tipo: string): CacheEntry | undefined {
    return cache.find((c) => c.tipo === tipo);
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  }

  // ─── Estilos ──────────────────────────────────────────────────────────────
  const sectionStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)", padding: 20, marginBottom: 16,
  };
  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8, padding: "8px 12px", color: "var(--cream)", fontSize: 13, width: "100%",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: "rgba(245,236,220,0.55)", marginBottom: 4, display: "block",
  };
  const btnGold: React.CSSProperties = {
    background: "var(--gold-light)", color: "#1a1309", fontWeight: 700,
    border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13,
    cursor: "pointer", opacity: isPending ? 0.6 : 1,
  };
  const btnGhost: React.CSSProperties = {
    background: "rgba(255,255,255,0.07)", color: "var(--cream)", fontWeight: 600,
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "9px 18px",
    fontSize: 13, cursor: "pointer", opacity: isPending ? 0.6 : 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Banner: aguardando contrato ── */}
      {!credentialsSaved && (
        <div style={{
          background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.3)",
          borderRadius: 10, padding: "14px 18px", marginBottom: 20,
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>🔑</span>
          <div>
            <p style={{ fontSize: 13, color: "var(--gold-light)", fontWeight: 700, margin: 0 }}>
              Integração e-CAC aguardando credenciais SERPRO
            </p>
            <p style={{ fontSize: 12, color: "rgba(245,236,220,0.6)", margin: "4px 0 0" }}>
              Contrate o <strong>Integra Contador</strong> em{" "}
              <a
                href="https://loja.serpro.gov.br/integra-contador"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--gold-light)" }}
              >
                loja.serpro.gov.br/integra-contador
              </a>
              {" "}e cole o Consumer Key e Consumer Secret abaixo.
              O certificado A1 já está configurado e será reutilizado.
            </p>
          </div>
        </div>
      )}

      {/* ── Configuração de credenciais ── */}
      <div style={sectionStyle}>
        <p className="eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>CREDENCIAIS SERPRO — INTEGRA CONTADOR</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Consumer Key</label>
            <input
              type="password"
              placeholder="djaR21PGoYp1iyK2n2ACOH9REdUb"
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
              style={inputStyle}
              autoComplete="off"
            />
          </div>
          <div>
            <label style={labelStyle}>Consumer Secret</label>
            <input
              type="password"
              placeholder="ObRsAJWOL4fv2Tp27D1vd8fB3Ote"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
              style={inputStyle}
              autoComplete="off"
            />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>CNPJ do contratante (contabilista/escritório — deixe em branco se for o mesmo do emitente)</label>
          <input
            type="text"
            placeholder={cnpjEmitente || "00.000.000/0001-00"}
            value={cnpjContrat}
            onChange={(e) => setCnpjContrat(e.target.value)}
            style={{ ...inputStyle, maxWidth: 260 }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            style={btnGold}
            onClick={handleSalvar}
            disabled={isPending || !hasCredentials}
          >
            {isPending ? "Salvando…" : "💾 Salvar credenciais"}
          </button>
          <button
            style={btnGhost}
            onClick={handleTestar}
            disabled={isPending || !hasCredentials}
          >
            🔌 Testar conexão
          </button>
          {credentialsSaved && (
            <span style={{ fontSize: 12, color: "#4caf50" }}>✓ Credenciais salvas</span>
          )}
        </div>
        {credMsg && (
          <p style={{
            marginTop: 10, fontSize: 13, padding: "8px 12px", borderRadius: 8,
            background: credMsg.ok ? "rgba(76,175,80,0.12)" : "rgba(232,90,90,0.12)",
            color: credMsg.ok ? "#4caf50" : "#e85a5a",
          }}>
            {credMsg.text}
          </p>
        )}
      </div>

      {/* ── Painel de consultas ── */}
      <div style={sectionStyle}>
        <p className="eyebrow" style={{ fontSize: 10, marginBottom: 14 }}>CONSULTAS E-CAC</p>

        {!hasCredentials && !credentialsSaved ? (
          <p style={{ fontSize: 13, color: "rgba(245,236,220,0.4)", textAlign: "center", padding: "16px 0" }}>
            Configure as credenciais acima para habilitar as consultas.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {ACOES.map((acao) => {
              const cached  = getCacheEntry(acao.id);
              const result  = results[acao.id];
              const loading = isPending && activeTab === acao.id;

              return (
                <div
                  key={acao.id}
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: 16,
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{acao.icon}</div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--cream)", margin: "0 0 2px" }}>{acao.label}</p>
                  <p style={{ fontSize: 11, color: "rgba(245,236,220,0.45)", margin: "0 0 10px" }}>{acao.desc}</p>

                  {cached && !result && (
                    <p style={{ fontSize: 10, color: "rgba(245,236,220,0.35)", marginBottom: 8 }}>
                      Última consulta: {formatDate(cached.consultado_at)}
                    </p>
                  )}

                  {result && (
                    <div style={{
                      background: result.ok ? "rgba(76,175,80,0.08)" : "rgba(232,90,90,0.08)",
                      border: `1px solid ${result.ok ? "rgba(76,175,80,0.2)" : "rgba(232,90,90,0.2)"}`,
                      borderRadius: 7, padding: "8px 10px", marginBottom: 10, fontSize: 11,
                      color: result.ok ? "#4caf50" : "#e85a5a",
                      wordBreak: "break-all",
                    }}>
                      {result.ok
                        ? <pre style={{ margin: 0, fontSize: 10, whiteSpace: "pre-wrap", color: "rgba(245,236,220,0.7)" }}>
                            {JSON.stringify(result.data, null, 2).slice(0, 400)}
                            {JSON.stringify(result.data, null, 2).length > 400 ? "\n…" : ""}
                          </pre>
                        : result.error
                      }
                    </div>
                  )}

                  <button
                    style={{ ...btnGhost, padding: "7px 14px", fontSize: 12, width: "100%" }}
                    onClick={() => handleConsultar(acao.id)}
                    disabled={isPending}
                  >
                    {loading ? "Consultando…" : "Consultar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Info técnica ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10, padding: 16,
      }}>
        <p className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>COMO FUNCIONA</p>
        <p style={{ fontSize: 12, color: "rgba(245,236,220,0.45)", lineHeight: 1.6, margin: 0 }}>
          As consultas são feitas via <strong style={{ color: "rgba(245,236,220,0.7)" }}>SERPRO Integra Contador</strong>
          {" "}— API oficial da Receita Federal. O mesmo certificado A1 (.pfx) já armazenado no Storage é usado para
          autenticação mTLS. As credenciais Consumer Key e Consumer Secret identificam o seu contrato com o SERPRO
          e nunca saem dos servidores. Os resultados são cacheados localmente para evitar consultas repetidas.
        </p>
      </div>
    </div>
  );
}
