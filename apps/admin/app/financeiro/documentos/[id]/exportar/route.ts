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
  const now         = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
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

  const html = kraftHTML({
    title:    `${kindLabel} #${q.number}`,
    subtitle: `Cliente: ${esc(q.customer_name)} · Status: ${statusLabel}`,
    now,
    body,
  });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
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

/** Gera o HTML completo com estética kraft + marca d'água Flora */
function kraftHTML({
  title, subtitle, now, body,
}: {
  title: string;
  subtitle: string;
  now: string;
  body: string;
}) {
  // Logo em SVG inline (marca d'água — funciona sem carregar arquivo externo)
  // Lettering "FLORa BOTANICS" em estilo minimalista, adequado para tile em grid
  const wm = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="80" viewBox="0 0 220 80">
  <text x="10" y="30" font-family="Georgia,serif" font-size="18" letter-spacing="4" fill="#2a4a2c" opacity="0.9">FLORa</text>
  <text x="10" y="55" font-family="Georgia,serif" font-size="11" letter-spacing="6" fill="#2a4a2c" opacity="0.9">BOTANICS</text>
  <line x1="10" y1="62" x2="210" y2="62" stroke="#5a3e2b" stroke-width="0.5" opacity="0.4"/>
</svg>`)}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    @page{margin:0;background:#f2e8d9}
    html,body{background:#f2e8d9!important;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.65;min-height:100%}

    /* Wrapper + marca d'água */
    .page-wrap{position:relative;min-height:100vh;background:#f2e8d9!important}
    .watermark{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
    .watermark-inner{
      position:absolute;inset:-20px;
      background-image:url('${wm}');
      background-repeat:repeat;
      background-size:220px auto;
      opacity:0.08;
    }

    /* Conteúdo */
    .page{position:relative;z-index:1;max-width:900px;margin:0 auto;padding:44px 64px 72px}

    /* Cabeçalho */
    .pdf-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #5a3e2b;padding-bottom:16px;margin-bottom:28px;gap:24px}
    .pdf-header-brand h1{font-size:22px;letter-spacing:3px;text-transform:uppercase;color:#2a4a2c;margin-bottom:2px}
    .pdf-header-brand .sub{font-size:11px;color:#6b5c4a;letter-spacing:1px}
    .pdf-header-meta{text-align:right;font-size:11px;color:#6b5c4a;flex-shrink:0}
    .pdf-title{font-size:18px;font-weight:bold;color:#2a4a2c;margin-bottom:4px}
    .pdf-subtitle{font-size:11px;color:#6b5c4a;margin-bottom:24px}
    .badge{display:inline-block;background:rgba(42,74,44,.12);color:#2a4a2c;border:1px solid rgba(42,74,44,.3);padding:2px 10px;border-radius:4px;font-size:10px;font-weight:bold;letter-spacing:.5px;text-transform:uppercase;margin-bottom:20px}

    /* Tabelas */
    table{width:100%;border-collapse:collapse;margin-top:14px;margin-bottom:28px;font-size:12.5px}
    th{background:#2a4a2c;color:#f2e8d9;text-align:left;padding:10px 14px;font-size:11.5px;letter-spacing:.5px;font-weight:700}
    td{padding:9px 14px;border-bottom:1px solid rgba(90,62,43,.18);vertical-align:top;color:#1a1a1a}
    tr:nth-child(even) td{background:rgba(90,62,43,.04)}
    tr:last-child td{border-bottom:none}

    /* Seções */
    .section{margin-bottom:28px}
    .section-title{font-size:13px;font-weight:bold;color:#2a4a2c;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(90,62,43,.25)}

    /* Notas */
    .notes-box{background:rgba(185,146,77,.08);border:1px solid rgba(185,146,77,.3);border-radius:6px;padding:10px 14px;font-size:11px;color:#4a3a20;margin-top:20px}
    .notes-box strong{display:block;margin-bottom:4px;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#8b6914}

    /* Rodapé */
    .pdf-footer{margin-top:40px;border-top:1px solid rgba(90,62,43,.25);padding-top:12px;font-size:10px;color:#8b7a6a;text-align:center}
    .pdf-footer .gen{font-size:9px;opacity:.75;margin-top:3px}

    /* Impressão */
    @media print{
      html,body,.page-wrap{background:#f2e8d9!important}
      .page{padding:24px 40px 40px}
      table{page-break-inside:avoid}
    }
  </style>
  <script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>
</head>
<body>
<div class="page-wrap">
  <div class="watermark"><div class="watermark-inner"></div></div>
  <div class="page">

    <div class="pdf-header">
      <div class="pdf-header-brand">
        <h1>Flora Botanics</h1>
        <div class="sub">Sistema de Gestão · Admin</div>
      </div>
      <div class="pdf-header-meta">
        Gerado em ${now}<br/>florabotanics.com.br
      </div>
    </div>

    <div class="pdf-title">${title}</div>
    <div class="pdf-subtitle">${subtitle}</div>
    <div class="badge">Flora Botanics · Documento interno</div>

    ${body}

    <div class="pdf-footer">
      <div>Flora Botanics</div>
      <div class="gen">Documento gerado automaticamente pelo sistema Flora Botanics. Não possui valor fiscal.</div>
    </div>
  </div>
</div>
</body>
</html>`;
}
