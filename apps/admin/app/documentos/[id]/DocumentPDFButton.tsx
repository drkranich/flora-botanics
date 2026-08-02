"use client";

import { buildFloraKraftPDF, openAndPrint, type PdfCategory } from "@/lib/pdf/template";
import { getPdfConfig } from "@/lib/pdf/actions";
import { money } from "@/lib/format";

type LineItem = {
  description?: string;
  product_name?: string;
  quantity?: number;
  unit_price_cents?: number;
  total_cents?: number;
  unit?: string;
  notes?: string;
};

type QuoteForPDF = {
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
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  budget:   "Orçamento",
  quote:    "Cotação",
  proposal: "Proposta Comercial",
};

// Mapeia kind do documento para PdfCategory do template
const KIND_CATEGORY: Record<string, PdfCategory> = {
  budget:   "orcamento",
  quote:    "cotacao",
  proposal: "proposta_comercial",
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

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v.includes("T") ? v : `${v}T12:00:00`);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

export function DocumentPDFButton({ quote }: { quote: QuoteForPDF }) {
  async function handlePDF() {
    const items: LineItem[] = Array.isArray(quote.items) ? quote.items : [];
    const totals = quote.totals ?? {};
    const kindLabel = KIND_LABEL[quote.kind] ?? quote.kind;
    const statusLabel = STATUS_LABEL[quote.status] ?? quote.status;

    // ── Seção: dados do documento ──────────────────────────────────────────
    const headerSection = `
      <div class="section">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;margin-bottom:20px">
          <div>
            <div class="section-title" style="font-size:18px;border:none;padding:0;margin-bottom:6px">
              ${kindLabel} #${quote.number}
            </div>
            <div style="font-size:12px;color:#6b5c4a">
              Emitido em ${fmtDate(quote.created_at.slice(0, 10))}
              ${quote.valid_until ? ` · Válido até ${fmtDate(quote.valid_until)}` : ""}
            </div>
          </div>
          <span class="badge" style="margin:0">${statusLabel}</span>
        </div>
      </div>`;

    // ── Seção: cliente + condições ─────────────────────────────────────────
    const clientSection = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:24px">
        <div class="section">
          <div class="section-title">Cliente</div>
          <div style="font-size:14px;font-weight:bold;color:#2a4a2c;margin-bottom:8px">${quote.customer_name}</div>
          ${quote.company_name      ? `<div style="margin-bottom:3px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7a6a">Empresa</span><br>${quote.company_name}</div>` : ""}
          ${quote.document_number   ? `<div style="margin-bottom:3px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7a6a">CPF/CNPJ</span><br>${quote.document_number}</div>` : ""}
          ${quote.responsible_contact ? `<div style="margin-bottom:3px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7a6a">Contato</span><br>${quote.responsible_contact}</div>` : ""}
          ${quote.email             ? `<div style="margin-bottom:3px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7a6a">E-mail</span><br>${quote.email}</div>` : ""}
          ${quote.phone             ? `<div style="margin-bottom:3px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7a6a">Telefone</span><br>${quote.phone}</div>` : ""}
          ${quote.address           ? `<div style="margin-bottom:3px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7a6a">Endereço</span><br>${quote.address}</div>` : ""}
        </div>
        <div class="section">
          <div class="section-title">Condições Comerciais</div>
          ${quote.payment_terms   ? `<div style="margin-bottom:5px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7a6a">Pagamento</span><br>${quote.payment_terms}</div>` : ""}
          ${quote.delivery_terms  ? `<div style="margin-bottom:5px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7a6a">Logística / Entrega</span><br>${quote.delivery_terms}</div>` : ""}
          ${quote.channel         ? `<div style="margin-bottom:5px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7a6a">Canal</span><br>${quote.channel}</div>` : ""}
          ${quote.seller_name     ? `<div style="margin-bottom:5px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7a6a">Vendedor</span><br>${quote.seller_name}</div>` : ""}
          ${!quote.payment_terms && !quote.delivery_terms && !quote.channel && !quote.seller_name ? "<div style='color:#8b7a6a;font-size:12px'>—</div>" : ""}
        </div>
      </div>`;

    // ── Seção: itens ───────────────────────────────────────────────────────
    let itemsSection = "";
    if (items.length > 0) {
      const rows = items.map((item) => `
        <tr>
          <td>
            <strong>${item.product_name ?? item.description ?? "—"}</strong>
            ${item.notes ? `<br><span style="font-size:11px;color:#6b5c4a">${item.notes}</span>` : ""}
          </td>
          <td style="text-align:center">${item.quantity ?? "—"}</td>
          <td style="text-align:center">${item.unit ?? "un"}</td>
          <td style="text-align:right">${money(item.unit_price_cents ?? 0)}</td>
          <td style="text-align:right;font-weight:bold;color:#2a4a2c">${money(item.total_cents ?? 0)}</td>
        </tr>`).join("");

      itemsSection = `
        <div class="section">
          <div class="section-title">Itens</div>
          <table>
            <thead><tr>
              <th>Descrição</th>
              <th style="text-align:center;width:60px">Qtd</th>
              <th style="text-align:center;width:60px">Unid.</th>
              <th style="text-align:right;width:120px">Preço unit.</th>
              <th style="text-align:right;width:120px">Total</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    // ── Seção: totais ──────────────────────────────────────────────────────
    const totaisSection = `
      <div class="section">
        <div class="section-title">Resultado Financeiro</div>
        <table style="width:380px;margin-left:auto">
          <tbody>
            <tr><td>Receita líquida</td><td style="text-align:right;font-weight:bold;color:#2a4a2c">${money(totals.netRevenueCents ?? 0)}</td></tr>
            <tr><td>Custo total</td><td style="text-align:right">${money(totals.totalCostCents ?? 0)}</td></tr>
            <tr><td>Lucro líquido</td><td style="text-align:right">${money(totals.netProfitCents ?? 0)}</td></tr>
            <tr><td>Margem</td><td style="text-align:right">${Number(totals.netMarginPercent ?? 0).toFixed(1)}%</td></tr>
          </tbody>
        </table>
      </div>`;

    // ── Seção: termos ──────────────────────────────────────────────────────
    const termsSection = quote.terms ? `
      <div class="section">
        <div class="section-title">Termos Comerciais</div>
        <p style="font-size:12px;line-height:1.8;white-space:pre-wrap;color:#3a2a1a">${quote.terms}</p>
      </div>` : "";

    // ── Assinaturas ────────────────────────────────────────────────────────
    const signaturesSection = `
      <div style="margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px">
        <div style="border-top:1px solid rgba(90,62,43,0.35);padding-top:10px">
          <div style="font-size:11px;color:#6b5c4a">Cliente / Aprovação</div>
          <div style="font-size:11px;color:#6b5c4a;margin-top:4px">Data: ___/___/______</div>
        </div>
        <div style="border-top:1px solid rgba(90,62,43,0.35);padding-top:10px">
          <div style="font-size:11px;color:#6b5c4a">Flora Botanics · ${quote.seller_name ?? "Responsável comercial"}</div>
          <div style="font-size:11px;color:#6b5c4a;margin-top:4px">Data: ___/___/______</div>
        </div>
      </div>`;

    const body = headerSection + clientSection + itemsSection + totaisSection + termsSection + signaturesSection;

    const config = await getPdfConfig();
    const html = buildFloraKraftPDF({
      title: `${kindLabel} #${quote.number}`,
      subtitle: `Cliente: ${quote.customer_name}${quote.company_name ? ` · ${quote.company_name}` : ""}`,
      maxWidth: 1100,
      category: KIND_CATEGORY[quote.kind],
      department: "Comercial",
      responsible: quote.seller_name ?? undefined,
      responsibleRole: quote.seller_name ? "Vendedor" : undefined,
      config,
      body,
    });

    openAndPrint(html);
  }

  return (
    <button
      onClick={() => void handlePDF()}
      className="btn btn-ghost"
      style={{ padding: "7px 18px", fontSize: 12, fontWeight: 700 }}
    >
      📄 Gerar PDF
    </button>
  );
}
