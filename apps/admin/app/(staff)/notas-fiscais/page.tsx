import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { createDraftNfe, cancelNfeDraft } from "./actions";

const NFE_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviando: "Enviando",
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
  inutilizada: "Inutilizada",
};

function statusBadgeStyle(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    rascunho: { bg: "#f2ecdf", fg: "#6b6354" },
    enviando: { bg: "#fbf0d9", fg: "#8a6512" },
    autorizada: { bg: "#e6f0ea", fg: "#2f6b4a" },
    rejeitada: { bg: "#fbeaea", fg: "#9a3232" },
    cancelada: { bg: "#f5dede", fg: "#7a1f1f" },
    inutilizada: { bg: "#f5dede", fg: "#7a1f1f" },
  };
  const c = colors[status] ?? colors.rascunho;
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

function formatBRL(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

interface NfeRow {
  id: string;
  order_id: string | null;
  numero: number | null;
  serie: number | null;
  ambiente: string;
  status: string;
  valor_total_cents: number | null;
  emitida_at: string | null;
  created_at: string;
  orders: { number: string } | null;
}

interface OrderRow {
  id: string;
  number: string;
  total_cents: number;
  placed_at: string | null;
  created_at: string;
}

const ELIGIBLE_STATUSES = ["paid", "processing", "shipped", "delivered"];

export default async function NotasFiscaisPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();

  const [fiscalRes, nfeRes, ordersRes] = await Promise.all([
    supabase
      .from("fiscal_configs")
      .select("cnpj, ambiente, serie_nfe, proximo_numero_nfe")
      .eq("tenant_id", staff.tenantId)
      .maybeSingle(),
    supabase
      .from("nfe_documents")
      .select("id, order_id, numero, serie, ambiente, status, valor_total_cents, emitida_at, created_at, orders(number)")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("orders")
      .select("id, number, total_cents, placed_at, created_at")
      .eq("tenant_id", staff.tenantId)
      .in("status", ELIGIBLE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const fiscal = fiscalRes.data;
  const nfes = (nfeRes.data ?? []) as unknown as NfeRow[];
  const orders = (ordersRes.data ?? []) as OrderRow[];

  const ordersWithNfe = new Set(nfes.map((n) => n.order_id).filter(Boolean));
  const pendingOrders = orders.filter((o) => !ordersWithNfe.has(o.id));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Notas Fiscais</h1>
        <p style={{ margin: 0, color: "#6b6354", fontSize: 14 }}>
          Emissão e gestão de NF-e em sistema próprio.
        </p>
      </div>

      {!fiscal && (
        <div style={{ ...cardStyle, borderColor: "#fbf0d9", background: "#fffaf0" }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            Configure os dados fiscais do emitente (CNPJ, razão social, endereço, série/numeração) em{" "}
            <Link href="/config">Configurações</Link> antes de criar rascunhos de NF-e.
          </p>
        </div>
      )}

      {fiscal && (
        <div style={{ ...cardStyle, borderColor: "#fbf0d9", background: "#fffaf0" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b6354" }}>
            Ambiente atual: <strong>{fiscal.ambiente === "producao" ? "Produção" : "Homologação"}</strong> ·
            Série {fiscal.serie_nfe} · Próximo número {fiscal.proximo_numero_nfe}. A emissão real
            (assinatura digital e envio à SEFAZ) ainda depende do certificado A1/A3 — etapa futura.
            Por enquanto, as notas ficam em <strong>rascunho</strong> com numeração reservada.
          </p>
        </div>
      )}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Pedidos sem NF-e</h2>
        {pendingOrders.length === 0 ? (
          <p style={emptyStyle}>Nenhum pedido pago pendente de nota fiscal.</p>
        ) : (
          <ul style={listStyle}>
            {pendingOrders.map((o) => (
              <li key={o.id} style={listItemStyle}>
                <span>
                  #{o.number} · {formatDate(o.placed_at ?? o.created_at)} · {formatBRL(o.total_cents)}
                </span>
                <form action={createDraftNfe.bind(null, o.id)}>
                  <button type="submit" style={actionButtonStyle} disabled={!fiscal}>
                    Criar rascunho de NF-e
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Notas emitidas</h2>
        {nfes.length === 0 ? (
          <p style={emptyStyle}>Nenhuma nota fiscal criada ainda.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f2ecdf", textAlign: "left" }}>
                  <th style={thStyle}>Número</th>
                  <th style={thStyle}>Pedido</th>
                  <th style={thStyle}>Ambiente</th>
                  <th style={thStyle}>Valor</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Criada em</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {nfes.map((n) => (
                  <tr key={n.id} style={{ borderTop: "1px solid #f2ecdf" }}>
                    <td style={tdStyle}>
                      {n.numero ?? "—"}
                      {n.serie ? ` / série ${n.serie}` : ""}
                    </td>
                    <td style={tdStyle}>{n.orders?.number ? `#${n.orders.number}` : "—"}</td>
                    <td style={tdStyle}>{n.ambiente === "producao" ? "Produção" : "Homologação"}</td>
                    <td style={tdStyle}>{formatBRL(n.valor_total_cents)}</td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle(n.status)}>{NFE_STATUS_LABELS[n.status] ?? n.status}</span>
                    </td>
                    <td style={tdStyle}>{formatDate(n.created_at)}</td>
                    <td style={tdStyle}>
                      {n.status === "rascunho" && (
                        <form action={cancelNfeDraft.bind(null, n.id)}>
                          <button type="submit" style={actionButtonStyle}>Cancelar</button>
                        </form>
                      )}
                    </td>
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
