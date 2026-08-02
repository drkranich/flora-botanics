/**
 * /documentos — Listagem estilo Zoho Books
 * Filtra por kind (budget/quote/proposal) e status via searchParams
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { DocumentRowActions } from "./DocumentRowActions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  quote:    "Cotação",
  budget:   "Orçamento",
  proposal: "Proposta",
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
  draft:     "#6a6a6a",
  review:    "#7a6a2a",
  sent:      "#2a6a8a",
  viewed:    "#2a5a7a",
  approved:  "#2a7a4a",
  rejected:  "#8a2a2a",
  expired:   "#6a4a2a",
  cancelled: "#5a4a4a",
  converted: "#3a7a3a",
};

type QuoteRow = {
  id: string;
  number: number;
  kind: string;
  status: string;
  customer_name: string;
  company_name: string | null;
  channel: string | null;
  valid_until: string | null;
  totals: Record<string, number>;
  created_at: string;
};

type SigRow = { quote_id: string; public_token: string };

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(`${v}T12:00:00`);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const kind   = String(params.kind   ?? "").toLowerCase().trim();
  const status = String(params.status ?? "").toLowerCase().trim();

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  let query = supabase
    .from("commercial_quotes")
    .select("id, number, kind, status, customer_name, company_name, channel, valid_until, totals, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(150);

  if (kind)   query = query.eq("kind", kind);
  if (status) query = query.eq("status", status);

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

  const kindTitle = kind ? (KIND_LABEL[kind] ?? kind) + "s" : "Todos os documentos";
  const statusTitle = status ? ` · ${STATUS_LABEL[status] ?? status}` : "";
  const origin = "https://florabotanics.com.br"; // domínio público

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-heading, #f1ede5)", margin: 0 }}>
            {kindTitle}{statusTitle}
          </h1>
          <p style={{ fontSize: 12, color: "var(--color-muted, #8a9580)", marginTop: 4 }}>
            {rows.length} documento{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/documentos/novo"
          style={{
            padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            textDecoration: "none", background: "var(--gold-light, #c8a84b)", color: "#1a2e1a",
          }}
        >
          + Novo documento
        </Link>
      </div>

      {/* Tabela */}
      <div className="glass" style={{ padding: 0, borderRadius: 12, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 24px", color: "var(--color-muted, #8a9580)", fontSize: 14 }}>
            Nenhum documento encontrado.
            <br />
            <Link href="/documentos/novo" style={{ color: "var(--color-gold, #c8a84b)", marginTop: 12, display: "inline-block" }}>
              Criar primeiro documento →
            </Link>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Tipo</Th>
                <Th>Cliente</Th>
                <Th>Canal</Th>
                <Th>Validade</Th>
                <Th>Valor líquido</Th>
                <Th>Status</Th>
                <Th>Criado</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const token = sigMap[q.id];
                const signingUrl = token ? `${origin}/assinar/${token}` : null;
                return (
                  <tr key={q.id}>
                    <Td>
                      <Link href={`/documentos/${q.id}`} style={{ color: "var(--color-gold, #c8a84b)", textDecoration: "none", fontWeight: 700 }}>
                        #{q.number}
                      </Link>
                    </Td>
                    <Td muted small>{KIND_LABEL[q.kind] ?? q.kind}</Td>
                    <Td>
                      <Link href={`/documentos/${q.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        <strong>{q.customer_name}</strong>
                        {q.company_name && (
                          <span style={{ display: "block", fontSize: 11, color: "var(--color-muted, #8a9580)" }}>
                            {q.company_name}
                          </span>
                        )}
                      </Link>
                    </Td>
                    <Td muted small>{q.channel ?? "—"}</Td>
                    <Td small>{fmtDate(q.valid_until)}</Td>
                    <Td>
                      <span style={{ fontWeight: 600, color: "var(--color-gold, #c8a84b)" }}>
                        {money(q.totals?.netRevenueCents ?? 0)}
                      </span>
                    </Td>
                    <Td>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 4,
                        fontSize: 11, fontWeight: 600,
                        background: STATUS_COLOR[q.status] ?? "#555",
                        color: "#fff",
                      }}>
                        {STATUS_LABEL[q.status] ?? q.status}
                      </span>
                    </Td>
                    <Td muted small>{fmtDate(q.created_at.slice(0, 10))}</Td>
                    <Td>
                      <DocumentRowActions
                        id={q.id}
                        number={q.number}
                        status={q.status}
                        signingUrl={signingUrl}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{
      textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600,
      color: "var(--color-muted, #8a9580)", borderBottom: "1px solid rgba(255,255,255,0.08)",
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {children}
    </th>
  );
}

function Td({ children, muted, small }: { children: React.ReactNode; muted?: boolean; small?: boolean }) {
  return (
    <td style={{
      padding: "13px 14px",
      fontSize: small ? 12 : 13,
      color: muted ? "var(--color-muted, #8a9580)" : "var(--color-text, #e8e3d9)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      verticalAlign: "middle",
    }}>
      {children}
    </td>
  );
}
