import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { money } from "@/lib/format";
import { NfeEmissaoClient } from "../NfeEmissaoClient";
import {
  emitirNFeAction,
  emitirNFeTesteAction,
  deleteNfeAction,
  archiveNfeAction,
} from "../emitir-action";
import { createDraftNfe, cancelNfeDraft } from "../actions";
import { NfeCopyButton } from "../NfeRowActions";
import { FISCAL_SECTIONS } from "../FiscalCenterPage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number | null | undefined) {
  if (cents == null) return "—";
  return money(Number(cents));
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(d);
}

const NFE_STATUS: Record<string, string> = {
  rascunho: "Rascunho", enviando: "Enviando",
  autorizada: "Autorizada", rejeitada: "Rejeitada",
  cancelada: "Cancelada", inutilizada: "Inutilizada",
};

function tone(s: string) {
  if (["autorizada", "authorized"].includes(s)) return "ok";
  if (["rejeitada", "rejected", "cancelada", "inutilizada"].includes(s)) return "danger";
  if (["enviando"].includes(s)) return "warn";
  return "draft";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EmissaoPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const supabase = await createClient();
  const tenantId = staff.tenantId;

  // Config fiscal
  const { data: fiscal } = await supabase
    .from("fiscal_configs")
    .select("cnpj, ambiente, serie_nfe, proximo_numero_nfe, certificado_valido_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // Configurações SEFAZ (emitente)
  const { data: sefazSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "integration_sefaz")
    .maybeSingle();
  const sefaz = (sefazSetting?.value ?? {}) as Record<string, string>;
  const ambienteAtual = (sefaz.environment === "producao" ? "1" : "2") as "1" | "2";
  const cMunFG = sefaz.codigo_ibge_municipio ?? "";

  // Pedidos pagos sem NF-e
  const ELIGIBLE = ["paid", "processing", "shipped", "delivered"];
  const { data: pedidos } = await supabase
    .from("orders")
    .select("id, number, total_cents, placed_at, created_at")
    .eq("tenant_id", tenantId)
    .in("status", ELIGIBLE)
    .is("nfe_documents.id", null) // left join filtering
    .order("placed_at", { ascending: false })
    .limit(20);

  // NF-e ativas (não arquivadas)
  const { data: nfes } = await supabase
    .from("nfe_documents")
    .select("id, numero, serie, ambiente, status, valor_total_cents, chave_acesso, protocolo, motivo_status, emitida_at, created_at, orders(number)")
    .eq("tenant_id", tenantId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  const activeNfes = nfes ?? [];
  const pendingOrders = pedidos ?? [];

  const serie   = (fiscal?.serie_nfe as number) ?? 1;
  const proxNum = (fiscal?.proximo_numero_nfe as number) ?? 1;

  // ── Nav lateral (mesma do FiscalCenterPage) ─────────────────────────────────
  const navStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: 4,
    position: "sticky", top: 80, maxHeight: "calc(100vh - 100px)", overflowY: "auto",
  };

  const smallBtnStyle: React.CSSProperties = {
    fontSize: 11, padding: "5px 12px", borderRadius: 7,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 0, padding: "32px 28px 80px 0" }}>

      {/* ── Sidebar nav ── */}
      <nav style={navStyle}>
        {/* Voltar */}
        <Link
          href="/backoffice/notas-fiscais"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 12px", borderRadius: 8, fontSize: 12,
            color: "rgba(245,236,220,0.45)", textDecoration: "none",
            marginBottom: 8, border: "1px solid transparent",
          }}
        >
          ← Fiscal e Tributário
        </Link>
        <p className="eyebrow" style={{ fontSize: 10, opacity: 0.4, marginBottom: 4, paddingLeft: 12 }}>FISCAL</p>
        {FISCAL_SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={`/backoffice/notas-fiscais${s.href.replace("/backoffice/notas-fiscais", "")}`}
            style={{
              padding: "7px 12px", borderRadius: 8, fontSize: 13,
              background: s.id === "emissao" ? "rgba(201,169,110,0.15)" : "transparent",
              color: s.id === "emissao" ? "var(--gold-light)" : "var(--cream)",
              border: s.id === "emissao" ? "1px solid rgba(201,169,110,0.25)" : "1px solid transparent",
              textDecoration: "none",
            }}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {/* ── Conteúdo ── */}
      <main style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <header>
          <p className="eyebrow" style={{ opacity: 0.55, letterSpacing: "2px", marginBottom: 6 }}>NOTAS FISCAIS</p>
          <h1 className="display" style={{ fontSize: 34, color: "var(--cream)", margin: 0 }}>Emissão de NF-e</h1>
          <p style={{ fontSize: 13, color: "rgba(245,236,220,0.55)", marginTop: 6 }}>
            {ambienteAtual === "1" ? "🟢 Produção" : "🟡 Homologação — NF-e sem valor fiscal"}
            {fiscal?.certificado_valido_at && (
              <> · Certificado válido até {formatDateTime(fiscal.certificado_valido_at)}</>
            )}
          </p>
        </header>

        {/* ── Pedidos pagos sem nota ── */}
        <section className="glass" style={{ padding: 24, borderRadius: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 4, fontSize: 10 }}>FILA DE EMISSÃO</p>
              <h2 style={{ fontSize: 20, color: "var(--cream)", margin: 0 }}>Pedidos pagos sem NF-e</h2>
            </div>
            <form action={emitirNFeTesteAction}>
              <button
                className="btn btn-ghost"
                style={smallBtnStyle}
                title="Emite NF-e de R$1 no ambiente de homologação"
              >
                🧪 Emitir teste (homologação)
              </button>
            </form>
          </div>

          {pendingOrders.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(245,236,220,0.4)", textAlign: "center", padding: "20px 0" }}>
              Nenhum pedido aguardando NF-e.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {pendingOrders.map((order) => (
                <div key={order.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px",
                }}>
                  <span>
                    <strong style={{ fontSize: 13, color: "var(--cream)" }}>Pedido #{order.number}</strong>
                    <br />
                    <small style={{ color: "rgba(245,236,220,0.5)", fontSize: 11 }}>
                      {formatDateTime(order.placed_at ?? order.created_at)} · {formatBRL(order.total_cents)}
                    </small>
                  </span>
                  <form action={createDraftNfe.bind(null, order.id)}>
                    <button className="btn btn-gold" disabled={!fiscal} style={smallBtnStyle}>
                      Criar NF-e
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── NF-e emitidas ── */}
        <section className="glass" style={{ padding: 24, borderRadius: 14 }}>
          <h2 style={{ fontSize: 20, color: "var(--cream)", margin: "0 0 16px" }}>NF-e emitidas / rascunhos</h2>
          {activeNfes.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(245,236,220,0.4)", textAlign: "center", padding: "20px 0" }}>
              Nenhuma NF-e ainda. Use os pedidos acima ou emita avulsa abaixo.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {activeNfes.map((nfe) => {
                const isProd = nfe.ambiente === "producao";
                const orders = nfe.orders as { number: string } | null;
                return (
                  <div key={nfe.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
                    background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px",
                  }}>
                    <span>
                      <strong style={{ fontSize: 13, color: "var(--cream)" }}>
                        NF-e {nfe.numero ?? "—"}{nfe.serie ? ` / S${nfe.serie}` : ""}
                      </strong>
                      {orders?.number && <span style={{ fontSize: 11, color: "rgba(245,236,220,0.5)" }}>{" · Pedido #"}{orders.number}</span>}
                      <br />
                      <small style={{ fontSize: 11, color: "rgba(245,236,220,0.5)" }}>
                        {formatBRL(nfe.valor_total_cents)} · {formatDateTime(nfe.emitida_at ?? nfe.created_at)}
                        {!isProd && <span style={{ color: "#e8a020", fontWeight: 600 }}> · homologação</span>}
                      </small>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span className={`fiscal-chip fiscal-chip-${tone(nfe.status)}`}>
                        {NFE_STATUS[nfe.status] ?? nfe.status}
                      </span>

                      {nfe.status === "rascunho" && (
                        <>
                          <form action={emitirNFeAction.bind(null, nfe.id)}>
                            <button className="btn btn-gold" style={smallBtnStyle}>Emitir</button>
                          </form>
                          <form action={cancelNfeDraft.bind(null, nfe.id)}>
                            <button className="btn btn-ghost" style={smallBtnStyle}>Cancelar</button>
                          </form>
                          <form action={deleteNfeAction.bind(null, nfe.id)}>
                            <button className="btn btn-ghost" style={{ ...smallBtnStyle, color: "rgba(232,160,160,0.9)" }}>Excluir</button>
                          </form>
                        </>
                      )}

                      {nfe.status === "autorizada" && nfe.chave_acesso && (
                        <>
                          <span style={{ fontSize: 10, color: "#4caf50" }} title={nfe.chave_acesso}>
                            ✓ {nfe.chave_acesso.slice(-8)}
                          </span>
                          <NfeCopyButton chaveAcesso={nfe.chave_acesso} />
                          <form action={archiveNfeAction.bind(null, nfe.id)}>
                            <button className="btn btn-ghost" style={smallBtnStyle}>Arquivar</button>
                          </form>
                          {!isProd && (
                            <form action={deleteNfeAction.bind(null, nfe.id)}>
                              <button className="btn btn-ghost" style={{ ...smallBtnStyle, color: "rgba(232,160,160,0.9)" }}>Excluir</button>
                            </form>
                          )}
                        </>
                      )}

                      {nfe.status === "rejeitada" && (
                        <>
                          {nfe.motivo_status && (
                            <span style={{ fontSize: 11, color: "rgba(232,160,160,0.9)" }} title={nfe.motivo_status}>
                              ✗ {nfe.motivo_status.length > 50 ? nfe.motivo_status.slice(0, 50) + "…" : nfe.motivo_status}
                            </span>
                          )}
                          <form action={deleteNfeAction.bind(null, nfe.id)}>
                            <button className="btn btn-ghost" style={{ ...smallBtnStyle, color: "rgba(232,160,160,0.9)" }}>Excluir</button>
                          </form>
                          <form action={archiveNfeAction.bind(null, nfe.id)}>
                            <button className="btn btn-ghost" style={smallBtnStyle}>Arquivar</button>
                          </form>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Emissão avulsa ── */}
        <section className="glass" style={{ padding: 24, borderRadius: 14 }}>
          <div style={{ marginBottom: 20 }}>
            <p className="eyebrow" style={{ marginBottom: 4, fontSize: 10 }}>NF-e AVULSA</p>
            <h2 style={{ fontSize: 20, color: "var(--cream)", margin: 0 }}>Emissão manual sem pedido</h2>
            <p style={{ fontSize: 12, color: "rgba(245,236,220,0.45)", marginTop: 6 }}>
              Preencha destinatário, itens e pagamentos. O certificado A1 é carregado automaticamente.
            </p>
          </div>

          {!sefaz.cnpj ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontSize: 14, color: "rgba(245,236,220,0.5)" }}>
                Configure o emitente em{" "}
                <Link href="/backoffice/config" style={{ color: "var(--gold-light)" }}>
                  Backoffice → Configurações → SEFAZ
                </Link>
                {" "}antes de emitir.
              </p>
            </div>
          ) : (
            <NfeEmissaoClient
              ambiente={ambienteAtual}
              serie={serie}
              proximoNumero={proxNum}
              cMunFG={cMunFG}
            />
          )}
        </section>

      </main>
    </div>
  );
}
