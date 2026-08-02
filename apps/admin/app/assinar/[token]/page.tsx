/**
 * /assinar/[token] — Página pública de assinatura de documento
 *
 * Acessível sem autenticação. Busca o documento pelo public_token
 * (política RLS anon permite SELECT em registros pending não expirados).
 */
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { money } from "@/lib/format";
import { SignerClient } from "./SignerClient";

export const dynamic = "force-dynamic";

// Cliente anônimo — usa apenas a policy RLS pública
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const KIND_LABEL: Record<string, string> = {
  budget:   "Orçamento",
  quote:    "Cotação",
  proposal: "Proposta Comercial",
};

export default async function AssinarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = anonClient();

  // Busca a assinatura pelo token (RLS garante que só retorna pending + não expirada)
  const { data: sig } = await supabase
    .from("document_signatures")
    .select("id, status, expires_at, quote_id, signer_name, signer_email, signed_at")
    .eq("public_token", token)
    .maybeSingle();

  if (!sig) {
    // Token inválido, expirado ou já usado — mostra tela de erro
    return <Expired />;
  }

  // Busca o documento comercial
  const { data: quote } = await supabase
    .from("commercial_quotes")
    .select(
      "id, number, kind, customer_name, company_name, document_number, seller_name, items, totals, terms, notes, valid_until, payment_terms, delivery_terms"
    )
    .eq("id", sig.quote_id)
    .maybeSingle();

  if (!quote) return notFound();

  const kindLabel = KIND_LABEL[quote.kind as string] ?? "Documento";
  const items = Array.isArray(quote.items)
    ? (quote.items as Array<Record<string, unknown>>)
    : [];
  const totals = (quote.totals ?? {}) as Record<string, number>;

  // Já assinado
  if (sig.status === "signed") {
    return <AlreadySigned name={sig.signer_name} signedAt={sig.signed_at} />;
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.brand}>
          <span style={S.brandName}>FLORA BOTANICS</span>
          <span style={S.brandSub}>Assinatura Digital de Documento</span>
        </div>
        <div style={S.headerMeta}>
          <span style={S.docBadge}>{kindLabel} #{quote.number as number}</span>
        </div>
      </header>

      <div style={S.layout}>
        {/* Coluna esquerda: preview do documento */}
        <aside style={S.docPanel}>
          <h2 style={S.panelTitle}>Documento</h2>

          <InfoRow label="Tipo" value={kindLabel} />
          <InfoRow label="Cliente" value={quote.customer_name as string} />
          {quote.company_name && <InfoRow label="Empresa" value={quote.company_name as string} />}
          {quote.document_number && <InfoRow label="CPF/CNPJ" value={quote.document_number as string} />}
          {quote.seller_name && <InfoRow label="Responsável" value={quote.seller_name as string} />}
          {quote.valid_until && (
            <InfoRow
              label="Válido até"
              value={new Date(`${quote.valid_until as string}T12:00:00`).toLocaleDateString("pt-BR")}
            />
          )}
          {quote.payment_terms && <InfoRow label="Pagamento" value={quote.payment_terms as string} />}
          {quote.delivery_terms && <InfoRow label="Entrega" value={quote.delivery_terms as string} />}

          {items.length > 0 && (
            <>
              <h3 style={S.sectionTitle}>Itens</h3>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Descrição</th>
                    <th style={{ ...S.th, textAlign: "center" }}>Qtd</th>
                    <th style={{ ...S.th, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td style={S.td}>{String(item.description ?? item.product_name ?? "—")}</td>
                      <td style={{ ...S.td, textAlign: "center" }}>{String(item.quantity ?? 1)}</td>
                      <td style={{ ...S.td, textAlign: "right" }}>{money(Number(item.total_cents ?? item.totalCents ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {totals.netRevenueCents > 0 && (
            <div style={S.totalBox}>
              <span style={S.totalLabel}>Valor total</span>
              <span style={S.totalValue}>{money(totals.netRevenueCents)}</span>
            </div>
          )}

          {quote.terms && (
            <>
              <h3 style={S.sectionTitle}>Termos e condições</h3>
              <p style={S.termsText}>{quote.terms as string}</p>
            </>
          )}

          {quote.notes && (
            <div style={S.notesBox}>
              <strong style={S.notesLabel}>Observações</strong>
              <p style={{ margin: 0 }}>{quote.notes as string}</p>
            </div>
          )}
        </aside>

        {/* Coluna direita: canvas de assinatura */}
        <SignerClient token={token} sigId={sig.id} />
      </div>

      <footer style={S.footer}>
        Flora Botanics · Assinatura digital com validade jurídica · O seu IP e horário são registrados
      </footer>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.infoRow}>
      <span style={S.infoLabel}>{label}</span>
      <span style={S.infoValue}>{value}</span>
    </div>
  );
}

function Expired() {
  return (
    <div style={S.centerPage}>
      <div style={S.statusCard}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
        <h1 style={S.statusTitle}>Link inválido ou expirado</h1>
        <p style={S.statusText}>
          Este link de assinatura não é válido, já expirou ou o documento já foi assinado.<br />
          Solicite um novo link ao responsável pelo documento.
        </p>
      </div>
    </div>
  );
}

function AlreadySigned({ name, signedAt }: { name: string | null; signedAt: string | null }) {
  const dt = signedAt
    ? new Date(signedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : null;
  return (
    <div style={S.centerPage}>
      <div style={{ ...S.statusCard, borderColor: "rgba(42,106,74,0.4)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ ...S.statusTitle, color: "#2a6a4a" }}>Documento já assinado</h1>
        <p style={S.statusText}>
          {name ? `Assinado por ${name}` : "Assinatura registrada"}
          {dt ? ` em ${dt}` : ""}.
        </p>
        <p style={{ ...S.statusText, marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          O responsável pela Flora Botanics receberá a confirmação por e-mail.
        </p>
      </div>
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const KRAFT = "#f2e8d9";
const GREEN = "#2a4a2c";
const BROWN = "#5a3e2b";
const TEXT  = "#1a1a1a";

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: KRAFT,
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: TEXT,
  },
  header: {
    background: GREEN,
    color: KRAFT,
    padding: "18px 40px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  brand: { display: "flex", flexDirection: "column", gap: 2 },
  brandName: { fontSize: 20, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase" },
  brandSub: { fontSize: 11, opacity: 0.75, letterSpacing: 1 },
  headerMeta: {},
  docBadge: {
    background: "rgba(242,232,217,0.15)",
    border: "1px solid rgba(242,232,217,0.3)",
    borderRadius: 6,
    padding: "4px 14px",
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: 700,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 480px",
    gap: 0,
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 24px",
    alignItems: "start",
  },
  docPanel: {
    background: "rgba(255,255,255,0.45)",
    borderRadius: 12,
    border: `1px solid rgba(${90},${62},${43},0.2)`,
    padding: "28px 32px",
    marginRight: 24,
  },
  panelTitle: { fontSize: 16, fontWeight: 800, color: GREEN, marginBottom: 20, letterSpacing: 1 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: BROWN, margin: "20px 0 10px", borderBottom: `1px solid rgba(${90},${62},${43},0.2)`, paddingBottom: 6 },
  infoRow: { display: "flex", gap: 12, padding: "6px 0", borderBottom: `1px solid rgba(${90},${62},${43},0.08)`, alignItems: "baseline" },
  infoLabel: { fontSize: 11, color: BROWN, minWidth: 100, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 },
  infoValue: { fontSize: 13, color: TEXT, fontWeight: 500 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
  th: { background: GREEN, color: KRAFT, padding: "8px 12px", textAlign: "left", fontSize: 11, letterSpacing: 0.5 },
  td: { padding: "7px 12px", borderBottom: `1px solid rgba(${90},${62},${43},0.12)`, color: TEXT, verticalAlign: "top" },
  totalBox: { display: "flex", justifyContent: "space-between", alignItems: "center", background: `rgba(${42},${74},${44},0.08)`, border: `1px solid rgba(${42},${74},${44},0.2)`, borderRadius: 8, padding: "10px 16px", marginTop: 16 },
  totalLabel: { fontSize: 13, fontWeight: 700, color: GREEN },
  totalValue: { fontSize: 18, fontWeight: 900, color: GREEN },
  termsText: { fontSize: 11.5, lineHeight: 1.8, color: "#3a2a1a", whiteSpace: "pre-wrap", margin: 0 },
  notesBox: { background: "rgba(185,146,77,0.08)", border: "1px solid rgba(185,146,77,0.3)", borderRadius: 6, padding: "10px 14px", marginTop: 16, fontSize: 12 },
  notesLabel: { display: "block", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "#8b6914", marginBottom: 4 },
  footer: { textAlign: "center", padding: "20px", fontSize: 10.5, color: BROWN, borderTop: `1px solid rgba(${90},${62},${43},0.2)`, marginTop: 32, opacity: 0.7 },
  centerPage: { minHeight: "100vh", background: KRAFT, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  statusCard: { background: "rgba(255,255,255,0.6)", border: `1px solid rgba(${90},${62},${43},0.25)`, borderRadius: 16, padding: "48px 40px", maxWidth: 480, textAlign: "center" },
  statusTitle: { fontSize: 22, fontWeight: 800, color: BROWN, marginBottom: 16 },
  statusText: { fontSize: 14, lineHeight: 1.7, color: TEXT, margin: 0 },
};
