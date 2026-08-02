/**
 * /financeiro/documentos — Listagem de orçamentos, cotações e propostas comerciais
 */

import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { CommercialQuoteForm } from "../CommercialQuoteForm";
import { FinanceiroDocumentRowActions } from "./FinanceiroDocumentRowActions";

export const dynamic = "force-dynamic";

type QuoteRow = {
  id: string;
  number: number;
  kind: string;
  status: string;
  customer_name: string;
  company_name: string | null;
  document_number: string | null;
  channel: string | null;
  valid_until: string | null;
  totals: Record<string, number>;
  created_at: string;
};

type SigRow = { quote_id: string; public_token: string };

const KIND_LABEL: Record<string, string> = {
  quote:    "Cotação",
  budget:   "Orçamento",
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

const STATUS_COLOR: Record<string, string> = {
  draft:     "#555",
  review:    "#7a6a2a",
  sent:      "#2a6a8a",
  viewed:    "#2a5a7a",
  approved:  "#2a7a4a",
  rejected:  "#8a2a2a",
  expired:   "#6a4a2a",
  cancelled: "#5a4a4a",
  converted: "#3a7a3a",
};

const pageStyle: CSSProperties = { padding: "32px 24px", maxWidth: 1100, margin: "0 auto" };
const headStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 };
const titleStyle: CSSProperties = { fontSize: 22, fontWeight: 700, color: "var(--color-heading, #f1ede5)" };
const mutedStyle: CSSProperties = { fontSize: 12, color: "var(--color-muted, #8a9580)", marginTop: 4 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: CSSProperties = {
  textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600,
  color: "var(--color-muted, #8a9580)", borderBottom: "1px solid rgba(255,255,255,0.08)",
  textTransform: "uppercase", letterSpacing: "0.05em",
};
const tdStyle: CSSProperties = {
  padding: "13px 14px", fontSize: 13, color: "var(--color-text, #e8e3d9)",
  borderBottom: "1px solid rgba(255,255,255,0.05)", verticalAlign: "middle",
};

function badge(status: string) {
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background: STATUS_COLOR[status] ?? "#444",
    color: "#fff",
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
  };
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("pt-BR"); } catch { return v; }
}

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "draft", label: "Rascunho" },
  { key: "sent", label: "Enviados" },
  { key: "approved", label: "Aprovados" },
  { key: "rejected", label: "Rejeitados" },
  { key: "converted", label: "Convertidos" },
];

export default async function FinanceiroDocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const statusFilter = String(params.status ?? "");
  const kindFilter = String(params.kind ?? "");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  let query = supabase
    .from("commercial_quotes")
    .select("id, number, kind, status, customer_name, company_name, document_number, channel, valid_until, totals, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(150);

  if (statusFilter) query = query.eq("status", statusFilter);
  if (kindFilter) query = query.eq("kind", kindFilter);

  const [{ data }, { data: sigs }] = await Promise.all([
    query,
    supabase
      .from("document_signatures")
      .select("quote_id, public_token")
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),
  ]);

  const rows = (data ?? []) as QuoteRow[];
  const sigMap = Object.fromEntries(
    ((sigs ?? []) as SigRow[]).map((s) => [s.quote_id, s.public_token])
  );
  const origin = "https://florabotanics.com.br";

  const summary = {
    total: rows.length,
    aprovados: rows.filter((r) => r.status === "approved").length,
    convertidos: rows.filter((r) => r.status === "converted").length,
    valorTotal: rows.reduce((s, r) => s + (r.totals?.netRevenueCents ?? 0), 0),
  };

  return (
    <main style={pageStyle}>
      {/* Breadcrumb */}
      <nav style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--color-muted, #8a9580)", marginBottom: 20 }}>
        <Link href="/financeiro" style={{ color: "inherit", textDecoration: "none" }}>Financeiro</Link>
        <span>/</span>
        <span style={{ color: "var(--color-text, #e8e3d9)" }}>Documentos Comerciais</span>
      </nav>

      {/* Header */}
      <div style={headStyle}>
        <div>
          <div style={titleStyle}>Documentos Comerciais</div>
          <div style={mutedStyle}>
            {summary.total} documento{summary.total !== 1 ? "s" : ""} ·{" "}
            {summary.aprovados} aprovado{summary.aprovados !== 1 ? "s" : ""} ·{" "}
            {summary.convertidos} convertido{summary.convertidos !== 1 ? "s" : ""} ·{" "}
            Total: {money(summary.valorTotal)}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <a href="/financeiro/exportar/download?format=csv" style={{ padding: "8px 14px", fontSize: 12 }} className="btn btn-ghost">
            CSV
          </a>
          <a href="/financeiro/exportar/download?format=xlsx" style={{ padding: "8px 14px", fontSize: 12 }} className="btn btn-gold">
            Excel
          </a>
        </div>
      </div>

      {/* Filtros de status */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {FILTERS.map((f) => {
          const active = statusFilter === f.key;
          const href = f.key ? `?status=${f.key}` : "?";
          return (
            <Link
              key={f.key}
              href={href}
              className={`fiscal-chip ${active ? "fiscal-chip-authorized" : "fiscal-chip-draft"}`}
              style={{ textDecoration: "none" }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Filtro por tipo */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { key: "", label: "Todos os tipos" },
          { key: "quote", label: "Cotações" },
          { key: "budget", label: "Orçamentos" },
          { key: "proposal", label: "Propostas" },
        ].map((k) => {
          const active = kindFilter === k.key;
          const baseStatus = statusFilter ? `&status=${statusFilter}` : "";
          const href = k.key ? `?kind=${k.key}${baseStatus}` : `?${baseStatus.slice(1)}`;
          return (
            <Link
              key={k.key}
              href={href}
              className={`fiscal-chip ${active ? "fiscal-chip-authorized" : "fiscal-chip-draft"}`}
              style={{ textDecoration: "none", fontSize: 12 }}
            >
              {k.label}
            </Link>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="glass" style={{ padding: 0, borderRadius: 12, overflow: "visible" }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--color-muted, #8a9580)", fontSize: 14 }}>
            Nenhum documento encontrado.
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Cliente</th>
                <th style={thStyle}>Canal</th>
                <th style={thStyle}>Validade</th>
                <th style={thStyle}>Valor líquido</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Criado</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const token = sigMap[q.id];
                const signingUrl = token ? `${origin}/assinar/${token}` : null;
                return (
                  <tr key={q.id} style={{ cursor: "pointer" }}>
                    <td style={tdStyle}>
                      <Link href={`/financeiro/documentos/${q.id}`} style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>
                        #{q.number}
                      </Link>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "var(--color-muted, #8a9580)" }}>
                      {KIND_LABEL[q.kind] ?? q.kind}
                    </td>
                    <td style={tdStyle}>
                      <Link href={`/financeiro/documentos/${q.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        <strong>{q.customer_name}</strong>
                        {q.company_name && (
                          <span style={{ display: "block", fontSize: 11, color: "var(--color-muted, #8a9580)" }}>
                            {q.company_name}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{q.channel ?? "—"}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{fmtDate(q.valid_until)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "var(--color-gold, #c8a84b)" }}>
                      {money(q.totals?.netRevenueCents ?? 0)}
                    </td>
                    <td style={tdStyle}>
                      <span style={badge(q.status)}>{STATUS_LABEL[q.status] ?? q.status}</span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "var(--color-muted, #8a9580)" }}>
                      {fmtDate(q.created_at)}
                    </td>
                    <td style={{ ...tdStyle, width: 48 }}>
                      <FinanceiroDocumentRowActions
                        id={q.id}
                        number={q.number}
                        status={q.status}
                        signingUrl={signingUrl}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Formulário para novo documento */}
      {session.role !== "tenant_editor" && (
        <details style={{ marginTop: 24 }}>
          <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--color-gold, #c8a84b)", marginBottom: 12 }}>
            + Novo documento comercial
          </summary>
          <div className="glass" style={{ padding: 24, marginTop: 12, borderRadius: 12 }}>
            <CommercialQuoteForm calculations={[]} />
          </div>
        </details>
      )}
    </main>
  );
}
