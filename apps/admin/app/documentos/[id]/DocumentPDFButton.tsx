"use client";

import { buildFloraKraftPDF, openAndPrint } from "@/lib/pdf/template";
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

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v.includes("T") ? v : `${v}T12:00:00`);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

export function DocumentPDFButton({ quote }: { quote: QuoteForPDF }) {
  function handlePDF() {
    const items: LineItem[] = Array.isArray(quote.items) ? quote.items : [];
    const totals = quote.totals ?? {};
    const kindLabel = KIND_LABEL[quote.kind] ?? quote.kind;

    // Tabela de itens
    let itemsTable = "";
    if (items.length > 0) {
      const rows = items
        .map((item) => {
          const desc = item.product_name ?? item.description ?? "—";
          const qty  = item.quantity ?? "—";
          const unit = item.unit ?? "un";
          const up   = money(item.unit_price_cents ?? 0);
          const tot  = money(item.total_cents ?? 0);
          return `<tr>
            <td>${desc}${item.notes ? `<br><small style="color:#8a9580">${item.notes}</small>` : ""}</td>
            <td style="text-align:center">${qty}</td>
            <td style="text-align:center">${unit}</td>
            <td style="text-align:right">${up}</td>
            <td style="text-align:right;font-weight:700;color:#c8a84b">${tot}</td>
          </tr>`;
        })
        .join("");

      itemsTable = `
        <h3 style="font-size:13px;font-weight:700;margin:28px 0 10px;color:#2a4a2c">ITENS</h3>
        <table>
          <thead><tr>
            <th>Descrição</th>
            <th style="text-align:center">Qtd</th>
            <th style="text-align:center">Unid.</th>
            <th style="text-align:right">Preço unit.</th>
            <th style="text-align:right">Total</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    // Totais
    const totaisHtml = `
      <div style="margin-top:20px;border-top:2px solid #2a4a2c;padding-top:16px">
        <table style="width:340px;margin-left:auto">
          <tbody>
            <tr><td style="padding:4px 0;color:#555">Receita líquida</td><td style="text-align:right;font-weight:700;color:#2a4a2c">${money(totals.netRevenueCents ?? 0)}</td></tr>
            <tr><td style="padding:4px 0;color:#555">Custo total</td><td style="text-align:right">${money(totals.totalCostCents ?? 0)}</td></tr>
            <tr><td style="padding:4px 0;color:#555">Lucro líquido</td><td style="text-align:right">${money(totals.netProfitCents ?? 0)}</td></tr>
            <tr><td style="padding:4px 0;color:#555">Margem</td><td style="text-align:right">${Number(totals.netMarginPercent ?? 0).toFixed(1)}%</td></tr>
          </tbody>
        </table>
      </div>`;

    // Condições
    const conditions = [
      quote.payment_terms   ? `<strong>Pagamento:</strong> ${quote.payment_terms}` : null,
      quote.delivery_terms  ? `<strong>Entrega:</strong> ${quote.delivery_terms}` : null,
      quote.channel         ? `<strong>Canal:</strong> ${quote.channel}` : null,
      quote.seller_name     ? `<strong>Vendedor:</strong> ${quote.seller_name}` : null,
      quote.valid_until     ? `<strong>Validade:</strong> ${fmtDate(quote.valid_until)}` : null,
    ].filter(Boolean).join("&emsp;·&emsp;");

    // Termos
    const termsHtml = quote.terms
      ? `<div style="margin-top:24px;padding:16px;background:#f9f5ef;border-radius:8px;border-left:3px solid #2a4a2c">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#2a4a2c;margin:0 0 8px">Termos Comerciais</p>
          <p style="font-size:12px;line-height:1.8;color:#444;white-space:pre-wrap;margin:0">${quote.terms}</p>
         </div>`
      : "";

    const body = `
      <!-- Cabeçalho do documento -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2a4a2c;padding-bottom:18px;margin-bottom:22px">
        <div>
          <h1 style="font-size:26px;font-weight:900;color:#2a4a2c;margin:0">${kindLabel} #${quote.number}</h1>
          <p style="font-size:12px;color:#666;margin:4px 0 0">Emitido em ${fmtDate(quote.created_at.slice(0, 10))}</p>
        </div>
        <div style="text-align:right">
          <span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;background:#2a7a4a;color:#fff;text-transform:uppercase">
            ${quote.status}
          </span>
        </div>
      </div>

      <!-- Cliente -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
        <div>
          <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#2a4a2c;margin:0 0 8px">Cliente</p>
          <p style="font-size:15px;font-weight:700;color:#1a2e1a;margin:0 0 4px">${quote.customer_name}</p>
          ${quote.company_name ? `<p style="font-size:12px;color:#555;margin:0 0 4px">${quote.company_name}</p>` : ""}
          ${quote.document_number ? `<p style="font-size:11px;color:#777;margin:0">CPF/CNPJ: ${quote.document_number}</p>` : ""}
          ${quote.phone ? `<p style="font-size:11px;color:#777;margin:2px 0 0">Tel: ${quote.phone}</p>` : ""}
          ${quote.email ? `<p style="font-size:11px;color:#777;margin:2px 0 0">${quote.email}</p>` : ""}
          ${quote.address ? `<p style="font-size:11px;color:#777;margin:2px 0 0">${quote.address}</p>` : ""}
        </div>
        <div>
          <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#2a4a2c;margin:0 0 8px">Condições</p>
          <p style="font-size:12px;line-height:1.9;color:#444;margin:0">${conditions || "—"}</p>
        </div>
      </div>

      ${itemsTable}
      ${totaisHtml}
      ${termsHtml}

      <!-- Assinatura -->
      <div style="margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px">
        <div style="border-top:1px solid #ccc;padding-top:8px">
          <p style="font-size:11px;color:#888;margin:0">Aprovado por / Assinatura do cliente</p>
          <p style="font-size:11px;color:#888;margin:4px 0 0">Data: ___/___/______</p>
        </div>
        <div style="border-top:1px solid #ccc;padding-top:8px">
          <p style="font-size:11px;color:#888;margin:0">Flora Botanics — ${quote.seller_name ?? "Responsável comercial"}</p>
          <p style="font-size:11px;color:#888;margin:4px 0 0">Data: ___/___/______</p>
        </div>
      </div>
    `;

    const html = buildFloraKraftPDF({
      title: `${kindLabel} #${quote.number}`,
      maxWidth: 1100,
      body,
    });

    openAndPrint(html);
  }

  return (
    <button
      onClick={handlePDF}
      className="btn btn-ghost"
      style={{ padding: "7px 18px", fontSize: 12, fontWeight: 700 }}
    >
      📄 Gerar PDF
    </button>
  );
}
