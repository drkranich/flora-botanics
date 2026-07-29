import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import {
  convertCommercialQuoteToOrder,
  duplicateCommercialQuote,
  updateCommercialQuoteStatus,
} from "../../actions";

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
  items: unknown;
  totals: Record<string, number>;
  terms: string | null;
  notes: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  converted_order_id: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  budget: "Orçamento",
  quote: "Cotação",
  proposal: "Proposta comercial",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  review: "Revisão",
  sent: "Enviado",
  viewed: "Visualizado",
  approved: "Aprovado",
  rejected: "Reprovado",
  expired: "Vencido",
  cancelled: "Cancelado",
  converted: "Convertido",
};

const STATUS_FLOW = [
  { status: "review", label: "Enviar para revisão" },
  { status: "sent", label: "Marcar como enviado" },
  { status: "approved", label: "Aprovar" },
  { status: "rejected", label: "Reprovar" },
  { status: "cancelled", label: "Cancelar" },
];

export default async function CommercialDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const { id } = await params;
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: quote } = await supabase
    .from("commercial_quotes")
    .select(
      "id, number, kind, status, customer_name, company_name, document_number, phone, email, address, responsible_contact, seller_name, channel, payment_terms, delivery_terms, valid_until, items, totals, terms, notes, sent_at, viewed_at, accepted_at, converted_order_id, created_at"
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!quote) notFound();

  const row = quote as QuoteRow;
  const totals = row.totals ?? {};
  const createdAt = new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const validUntil = row.valid_until
    ? new Date(`${row.valid_until}T12:00:00`).toLocaleDateString("pt-BR")
    : "Sem validade definida";

  return (
    <main style={pageStyle}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/financeiro#documentos" className="eyebrow" style={{ opacity: 0.8 }}>
          ← Financeiro
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
          <div>
            <h1 className="display" style={{ fontSize: 40 }}>
              {KIND_LABEL[row.kind] ?? row.kind} #{row.number}
            </h1>
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Criado em {createdAt} · validade: {validUntil}
            </p>
          </div>
          <span className={row.status === "approved" || row.status === "converted" ? "chip chip-live" : "chip chip-draft"}>
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
        </div>
      </header>

      <section className="glass rise rise-1" style={actionCardStyle}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Operação do documento</p>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            Controle revisão, envio, aprovação e conversão em pedido sem perder auditoria.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {row.status !== "converted"
            ? STATUS_FLOW.map((item) => (
                <form key={item.status} action={updateCommercialQuoteStatus.bind(null, row.id, item.status)}>
                  <button className={item.status === "approved" ? "btn btn-gold" : "btn btn-ghost"} style={smallButtonStyle}>
                    {item.label}
                  </button>
                </form>
              ))
            : null}
          <form action={duplicateCommercialQuote.bind(null, row.id)}>
            <button className="btn btn-ghost" style={smallButtonStyle}>Duplicar</button>
          </form>
          <Link href={`/financeiro/documentos/${row.id}/exportar`} className="btn btn-ghost" style={smallButtonStyle}>
            PDF
          </Link>
          {row.status === "approved" ? (
            <form action={convertCommercialQuoteToOrder.bind(null, row.id)}>
              <button className="btn btn-gold" style={smallButtonStyle}>Converter em pedido</button>
            </form>
          ) : null}
          {row.converted_order_id ? (
            <Link href={`/vendas/${row.converted_order_id}`} className="btn btn-gold" style={smallButtonStyle}>
              Ver pedido
            </Link>
          ) : null}
        </div>
      </section>

      <section style={gridStyle}>
        <div className="glass rise rise-2" style={cardStyle}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Cliente</p>
          <h2 className="display" style={{ fontSize: 28 }}>{row.customer_name}</h2>
          <Detail label="Empresa" value={row.company_name} />
          <Detail label="CPF / CNPJ" value={row.document_number} />
          <Detail label="Contato responsável" value={row.responsible_contact} />
          <Detail label="E-mail" value={row.email} />
          <Detail label="Telefone" value={row.phone} />
          <Detail label="Endereço" value={row.address} />
        </div>

        <div className="glass rise rise-3" style={cardStyle}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Condições</p>
          <Detail label="Canal" value={row.channel} />
          <Detail label="Vendedor" value={row.seller_name} />
          <Detail label="Pagamento" value={row.payment_terms} />
          <Detail label="Logística / entrega" value={row.delivery_terms} />
          <Detail label="Enviado em" value={formatDateTime(row.sent_at)} />
          <Detail label="Aprovado em" value={formatDateTime(row.accepted_at)} />
        </div>
      </section>

      <section className="glass rise rise-4" style={cardStyle}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Resultado financeiro</p>
        <div style={totalsGridStyle}>
          <Kpi label="Receita líquida" value={money(totals.netRevenueCents ?? 0)} />
          <Kpi label="Custo total" value={money(totals.totalCostCents ?? 0)} />
          <Kpi label="Lucro líquido" value={money(totals.netProfitCents ?? 0)} />
          <Kpi label="Margem" value={`${Number(totals.netMarginPercent ?? 0).toFixed(1)}%`} />
        </div>
      </section>

      <section style={gridStyle}>
        <TextCard title="Termos comerciais" text={row.terms} />
        <TextCard title="Observações internas" text={row.notes} />
      </section>
    </main>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6 }}>
      <span className="muted" style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
      {value || "—"}
    </p>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--glass-border)", borderRadius: 12, padding: 16 }}>
      <p className="muted" style={{ margin: 0, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{label}</p>
      <p className="display" style={{ margin: "8px 0 0", fontSize: 26, color: "var(--gold-light)" }}>{value}</p>
    </div>
  );
}

function TextCard({ title, text }: { title: string; text: string | null }) {
  return (
    <div className="glass" style={cardStyle}>
      <p className="eyebrow" style={{ marginBottom: 12 }}>{title}</p>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 }}>
        {text || "Nada registrado."}
      </p>
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1040,
  margin: "0 auto",
  padding: "48px 28px 110px",
};

const cardStyle: CSSProperties = {
  padding: 22,
};

const actionCardStyle: CSSProperties = {
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 16,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginBottom: 16,
};

const totalsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const smallButtonStyle: CSSProperties = {
  padding: "8px 14px",
  fontSize: 10,
};
