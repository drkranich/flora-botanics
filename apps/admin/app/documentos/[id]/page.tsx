/**
 * /documentos/[id] — Detalhe do documento comercial estilo Zoho Books
 * Com geração de PDF Flora via template centralizado
 */
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import {
  convertCommercialQuoteToOrder,
  duplicateCommercialQuote,
  updateCommercialQuoteStatus,
} from "../../financeiro/actions";
import { DocumentPDFButton } from "./DocumentPDFButton";

export const dynamic = "force-dynamic";

type QuoteRow = {
  id: string;
  number: number;
  kind: string;
  status: string;
  customer_name: string;
  company_name: string | null;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  responsible_contact: string | null;
  seller_name: string | null;
  channel: string | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  valid_until: string | null;
  items: LineItem[];
  totals: Record<string, number>;
  terms: string | null;
  notes: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  converted_order_id: string | null;
  created_at: string;
};

type LineItem = {
  description?: string;
  product_name?: string;
  quantity?: number;
  unit_price_cents?: number;
  total_cents?: number;
  unit?: string;
  notes?: string;
};

const KIND_LABEL: Record<string, string> = {
  budget:   "Orçamento",
  quote:    "Cotação",
  proposal: "Proposta Comercial",
};

const STATUS_LABEL: Record<string, string> = {
  draft:     "Rascunho",
  review:    "Em revisão",
  sent:      "Enviado",
  viewed:    "Visualizado",
  approved:  "Aprovado",
  rejected:  "Rejeitado",
  expired:   "Expirado",
  cancelled: "Cancelado",
  converted: "Convertido",
};

const STATUS_FLOW = [
  { status: "review",    label: "Enviar p/ revisão" },
  { status: "sent",      label: "Marcar enviado" },
  { status: "approved",  label: "Aprovar" },
  { status: "rejected",  label: "Reprovar" },
  { status: "cancelled", label: "Cancelar" },
];

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v.includes("T") ? v : `${v}T12:00:00`);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

function fmtDateTime(v: string | null) {
  if (!v) return null;
  return new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default async function DocumentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: quote } = await supabase
    .from("commercial_quotes")
    .select("id, number, kind, status, customer_name, company_name, document_number, phone, email, address, responsible_contact, seller_name, channel, payment_terms, delivery_terms, valid_until, items, totals, terms, notes, sent_at, viewed_at, accepted_at, converted_order_id, created_at")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!quote) notFound();

  const row = quote as QuoteRow;
  const totals = row.totals ?? {};
  const items: LineItem[] = Array.isArray(row.items) ? row.items : [];

  return (
    <div style={{ maxWidth: 1040 }}>

      {/* Breadcrumb */}
      <nav style={{ fontSize: 12, color: "var(--color-muted, #8a9580)", marginBottom: 20, display: "flex", gap: 8, alignItems: "center" }}>
        <Link href="/documentos" style={{ color: "inherit", textDecoration: "none" }}>Documentos</Link>
        <span>/</span>
        <span style={{ color: "var(--color-text, #e8e3d9)" }}>
          {KIND_LABEL[row.kind] ?? row.kind} #{row.number}
        </span>
      </nav>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-heading, #f1ede5)", margin: 0 }}>
            {KIND_LABEL[row.kind] ?? row.kind} #{row.number}
          </h1>
          <p style={{ fontSize: 12, color: "var(--color-muted, #8a9580)", marginTop: 6 }}>
            Criado em {fmtDate(row.created_at.slice(0, 10))}
            {row.valid_until ? ` · válido até ${fmtDate(row.valid_until)}` : ""}
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>

      {/* Barra de ações */}
      <div className="glass" style={actionBarStyle}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {row.status !== "converted" &&
            STATUS_FLOW.map((item) => (
              <form key={item.status} action={updateCommercialQuoteStatus.bind(null, row.id, item.status)}>
                <button
                  className={item.status === "approved" ? "btn btn-gold" : "btn btn-ghost"}
                  style={{ padding: "7px 14px", fontSize: 11 }}
                >
                  {item.label}
                </button>
              </form>
            ))}
          <form action={duplicateCommercialQuote.bind(null, row.id)}>
            <button className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: 11 }}>
              Duplicar
            </button>
          </form>
          {row.status === "approved" && (
            <form action={convertCommercialQuoteToOrder.bind(null, row.id)}>
              <button className="btn btn-gold" style={{ padding: "7px 14px", fontSize: 11 }}>
                Converter em pedido
              </button>
            </form>
          )}
          {row.converted_order_id && (
            <Link href={`/vendas/${row.converted_order_id}`} className="btn btn-gold" style={{ padding: "7px 14px", fontSize: 11 }}>
              Ver pedido →
            </Link>
          )}
        </div>

        {/* Botão PDF — client component */}
        <DocumentPDFButton quote={row} />
      </div>

      {/* Grid de info */}
      <div style={gridStyle}>
        {/* Cliente */}
        <div className="glass" style={cardStyle}>
          <p style={eyebrowStyle}>Cliente</p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-heading, #f1ede5)", margin: "0 0 12px" }}>
            {row.customer_name}
          </h2>
          <Detail label="Empresa" value={row.company_name} />
          <Detail label="CPF / CNPJ" value={row.document_number} />
          <Detail label="Contato" value={row.responsible_contact} />
          <Detail label="E-mail" value={row.email} />
          <Detail label="Telefone" value={row.phone} />
          <Detail label="Endereço" value={row.address} />
        </div>

        {/* Condições */}
        <div className="glass" style={cardStyle}>
          <p style={eyebrowStyle}>Condições comerciais</p>
          <Detail label="Canal" value={row.channel} />
          <Detail label="Vendedor" value={row.seller_name} />
          <Detail label="Condições de pagamento" value={row.payment_terms} />
          <Detail label="Logística / entrega" value={row.delivery_terms} />
          <Detail label="Enviado em" value={fmtDateTime(row.sent_at)} />
          <Detail label="Visualizado em" value={fmtDateTime(row.viewed_at)} />
          <Detail label="Aprovado em" value={fmtDateTime(row.accepted_at)} />
        </div>
      </div>

      {/* Itens */}
      {items.length > 0 && (
        <div className="glass" style={{ ...cardStyle, padding: 0, overflow: "hidden", marginBottom: 16 }}>
          <p style={{ ...eyebrowStyle, padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            Itens do documento
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Descrição", "Qtd", "Unid.", "Preço unit.", "Total"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 16px", fontSize: 10, fontWeight: 600, color: "var(--color-muted, #8a9580)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={itemTdStyle}>
                    <strong>{item.product_name ?? item.description ?? "—"}</strong>
                    {item.notes && <span style={{ display: "block", fontSize: 11, color: "var(--color-muted, #8a9580)" }}>{item.notes}</span>}
                  </td>
                  <td style={{ ...itemTdStyle, color: "var(--color-muted, #8a9580)" }}>{item.quantity ?? "—"}</td>
                  <td style={{ ...itemTdStyle, color: "var(--color-muted, #8a9580)" }}>{item.unit ?? "un"}</td>
                  <td style={itemTdStyle}>{money(item.unit_price_cents ?? 0)}</td>
                  <td style={{ ...itemTdStyle, fontWeight: 600, color: "var(--color-gold, #c8a84b)" }}>{money(item.total_cents ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totais */}
      <div className="glass" style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={eyebrowStyle}>Resultado financeiro</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 4 }}>
          <Kpi label="Receita líquida" value={money(totals.netRevenueCents ?? 0)} gold />
          <Kpi label="Custo total" value={money(totals.totalCostCents ?? 0)} />
          <Kpi label="Lucro líquido" value={money(totals.netProfitCents ?? 0)} />
          <Kpi label="Margem" value={`${Number(totals.netMarginPercent ?? 0).toFixed(1)}%`} />
        </div>
      </div>

      {/* Termos e obs */}
      <div style={gridStyle}>
        <TextCard title="Termos comerciais" text={row.terms} />
        <TextCard title="Observações internas" text={row.notes} />
      </div>
    </div>
  );
}

// ── sub-componentes ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "#6a6a6a", review: "#7a6a2a", sent: "#2a6a8a", viewed: "#2a5a7a",
    approved: "#2a7a4a", rejected: "#8a2a2a", expired: "#6a4a2a",
    cancelled: "#5a4a4a", converted: "#3a7a3a",
  };
  return (
    <span style={{
      display: "inline-block", padding: "4px 14px", borderRadius: 20,
      fontSize: 12, fontWeight: 700,
      background: colors[status] ?? "#555", color: "#fff",
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <span style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-muted, #8a9580)", marginBottom: 2 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--color-text, #e8e3d9)" }}>{value || "—"}</span>
    </div>
  );
}

function Kpi({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px" }}>
      <p style={{ margin: 0, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-muted, #8a9580)" }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: gold ? "var(--color-gold, #c8a84b)" : "var(--color-text, #e8e3d9)" }}>
        {value}
      </p>
    </div>
  );
}

function TextCard({ title, text }: { title: string; text: string | null }) {
  return (
    <div className="glass" style={cardStyle}>
      <p style={eyebrowStyle}>{title}</p>
      <p style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", color: "var(--color-muted, #8a9580)", margin: 0 }}>
        {text || "Nada registrado."}
      </p>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const cardStyle: CSSProperties = { padding: 20, marginBottom: 16 };
const eyebrowStyle: CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--color-muted, #8a9580)", margin: "0 0 14px",
};
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 16 };
const actionBarStyle: CSSProperties = {
  padding: "14px 18px", marginBottom: 20,
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
};
const itemTdStyle: CSSProperties = {
  padding: "11px 16px", fontSize: 13, color: "var(--color-text, #e8e3d9)",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};
