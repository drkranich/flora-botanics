/**
 * GET /financeiro/documentos/[id]/exportar
 *
 * Retorna página HTML com estética kraft + marca d'água Flora Botanics.
 * Disparada via window.open() — o navegador abre o popup e faz print/save-as-PDF.
 *
 * Motivo de ser HTML e não PDF binário: o PDF via Cloudflare Workers não suporta
 * fontes, backgrounds nem imagens corretamente. O HTML kraft + window.print() é
 * a abordagem que garante estética fiel à identidade Flora Botanics.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { buildFloraKraftPDF } from "@/lib/pdf/template";
import { getPdfConfig } from "@/lib/pdf/actions";

// ─── Tipos ───────────────────────────────────────────────────────────────────

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
  created_at: string;
};

// ─── Labels ──────────────────────────────────────────────────────────────────

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
  rejected:  "Reprovado",
  expired:   "Vencido",
  cancelled: "Cancelado",
  converted: "Convertido",
};

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: quote } = await supabase
    .from("commercial_quotes")
    .select(
      "id, number, kind, status, customer_name, company_name, document_number, phone, email, address, responsible_contact, seller_name, channel, payment_terms, delivery_terms, valid_until, items, totals, terms, notes, created_at"
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!quote) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const q = quote as QuoteRow;
  const totals = q.totals ?? {};
  const kindLabel   = KIND_LABEL[q.kind]     ?? q.kind;
  const statusLabel = STATUS_LABEL[q.status] ?? q.status;
  const validUntil  = q.valid_until
    ? new Date(`${q.valid_until}T12:00:00`).toLocaleDateString("pt-BR")
    : "Sem validade definida";

  const items = Array.isArray(q.items) ? (q.items as Array<Record<string, unknown>>) : [];

  const itemsRows = items.map((item) => `
    <tr>
      <td>${esc(String(item.description ?? item.name ?? "—"))}</td>
      <td style="text-align:center">${item.quantity ?? 1}</td>
      <td style="text-align:right">${money(Number(item.unitPriceCents ?? 0))}</td>
      <td style="text-align:right">${money(Number(item.totalCents ?? 0))}</td>
    </tr>`).join("");

  const body = `
    <div class="section">
      <div class="section-title">Informações do documento</div>
      <table>
        <tr><td width="40%"><strong>Tipo</strong></td><td>${kindLabel}</td></tr>
        <tr><td><strong>Status</strong></td><td>${statusLabel}</td></tr>
        <tr><td><strong>Validade</strong></td><td>${validUntil}</td></tr>
        ${q.channel       ? `<tr><td><strong>Canal</strong></td><td>${esc(q.channel)}</td></tr>` : ""}
        ${q.seller_name   ? `<tr><td><strong>Vendedor</strong></td><td>${esc(q.seller_name)}</td></tr>` : ""}
        ${q.delivery_terms? `<tr><td><strong>Entrega</strong></td><td>${esc(q.delivery_terms)}</td></tr>` : ""}
      </table>
    </div>

    <div class="section">
      <div class="section-title">Cliente</div>
      <table>
        <tr><td width="40%"><strong>Nome</strong></td><td>${esc(q.customer_name)}</td></tr>
        ${q.company_name        ? `<tr><td><strong>Empresa</strong></td><td>${esc(q.company_name)}</td></tr>` : ""}
        ${q.document_number     ? `<tr><td><strong>CPF/CNPJ</strong></td><td>${esc(q.document_number)}</td></tr>` : ""}
        ${q.email               ? `<tr><td><strong>E-mail</strong></td><td>${esc(q.email)}</td></tr>` : ""}
        ${q.phone               ? `<tr><td><strong>Telefone</strong></td><td>${esc(q.phone)}</td></tr>` : ""}
        ${q.address             ? `<tr><td><strong>Endereço</strong></td><td>${esc(q.address)}</td></tr>` : ""}
        ${q.responsible_contact ? `<tr><td><strong>Contato</strong></td><td>${esc(q.responsible_contact)}</td></tr>` : ""}
      </table>
    </div>

    ${items.length > 0 ? `
    <div class="section">
      <div class="section-title">Itens</div>
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th style="text-align:center">Qtd</th>
            <th style="text-align:right">Unit.</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
    </div>` : ""}

    <div class="section">
      <div class="section-title">Resumo financeiro</div>
      <table>
        <tr><td width="60%"><strong>Receita líquida</strong></td><td style="text-align:right"><strong>${money(totals.netRevenueCents ?? 0)}</strong></td></tr>
        <tr><td><strong>Custo total</strong></td><td style="text-align:right">${money(totals.totalCostCents ?? 0)}</td></tr>
        <tr><td><strong>Lucro líquido</strong></td><td style="text-align:right">${money(totals.netProfitCents ?? 0)}</td></tr>
        <tr><td><strong>Margem</strong></td><td style="text-align:right">${Number(totals.netMarginPercent ?? 0).toFixed(1)}%</td></tr>
      </table>
    </div>

    ${q.payment_terms ? `
    <div class="section">
      <div class="section-title">Condições de pagamento</div>
      <p style="font-size:12px;line-height:1.8;color:#3a2a1a">${esc(q.payment_terms)}</p>
    </div>` : ""}

    ${q.terms ? `
    <div class="section">
      <div class="section-title">Termos comerciais</div>
      <p style="font-size:12px;line-height:1.8;color:#3a2a1a;white-space:pre-wrap">${esc(q.terms)}</p>
    </div>` : ""}

    ${q.notes ? `
    <div class="notes-box">
      <strong>Observações internas</strong>
      ${esc(q.notes)}
    </div>` : ""}
  `;

  const KIND_CATEGORY: Record<string, string> = {
    budget:   "orcamento",
    quote:    "cotacao",
    proposal: "proposta_comercial",
  };

  const pdfConfig = await getPdfConfig();
  const html = buildFloraKraftPDF({
    title:    `${kindLabel} #${q.number}`,
    subtitle: `Cliente: ${esc(q.customer_name)} · Status: ${statusLabel}`,
    category: (KIND_CATEGORY[q.kind] ?? "interno") as Parameters<typeof buildFloraKraftPDF>[0]["category"],
    department: "Comercial",
    responsible: q.seller_name ?? undefined,
    responsibleRole: q.seller_name ? "Vendedor" : undefined,
    config: pdfConfig,
    body,
  });

  return new Response(
    html + `<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Escapa HTML básico para evitar XSS no template */
function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
