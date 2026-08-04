import { NextResponse, type NextRequest } from "next/server";
import { getStaffSession } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { buildAccountingReport, customerName, type AccountingSearch } from "@/lib/accounting/report";
import { money } from "@/lib/format";
import { buildFloraKraftPDF } from "@/lib/pdf/template";
import { getPdfConfig } from "@/lib/pdf/actions";

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values: (string | number | null | undefined)[]) {
  return values.map(csvCell).join(",");
}

function buildCsv(report: Awaited<ReturnType<typeof buildAccountingReport>>) {
  const rows = [
    csvLine(["Relatório de contabilidade", report.range.label]),
    csvLine([]),
    csvLine(["Indicador", "Valor"]),
    csvLine(["Receita por pedidos", money(report.totals.grossRevenue)]),
    csvLine(["Receita manual", money(report.totals.manualIncome)]),
    csvLine(["Receita ajustada", money(report.totals.adjustedRevenue)]),
    csvLine(["Custos estimados", money(report.totals.estimatedCosts)]),
    csvLine(["Custos manuais", money(report.totals.manualExpenses)]),
    csvLine(["Custos ajustados", money(report.totals.adjustedCosts)]),
    csvLine(["Lucro ajustado", money(report.totals.adjustedProfit)]),
    csvLine(["MRR ativo", money(report.totals.mrr)]),
    csvLine(["Descontos concedidos", money(report.totals.discounts)]),
    csvLine([]),
    csvLine(["Razão contábil"]),
    csvLine(["Origem", "Canal", "Tipo", "Categoria", "Descrição", "Centro de custo", "Valor", "Data"]),
    ...report.ledgerRows.map((entry) =>
      csvLine([
        entry.source === "automatic" ? "automático" : "manual",
        entry.channel ?? "",
        entry.type,
        entry.category,
        entry.description,
        entry.cost_center ?? "",
        `${entry.type === "income" ? "+" : "-"} ${money(entry.amount_cents, entry.currency)}`,
        new Date(entry.occurred_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      ])
    ),
    csvLine([]),
    csvLine(["Pedidos de venda"]),
    csvLine(["Pedido", "Cliente", "Status", "Subtotal", "Desconto", "Frete", "Total", "Criado em"]),
    ...report.realizedOrders.map((order) =>
      csvLine([
        `#${order.number}`,
        customerName(order),
        order.status,
        money(order.subtotal_cents, order.currency),
        money(order.discount_cents, order.currency),
        money(order.shipping_cents, order.currency),
        money(order.total_cents, order.currency),
        new Date(order.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      ])
    ),
  ];

  return `\uFEFF${rows.join("\r\n")}`;
}

function esc(s: string | number | null | undefined) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role === "tenant_editor") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search: AccountingSearch = {
    period: url.searchParams.get("period") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };
  const format = url.searchParams.get("format") ?? "csv";
  const tenantId = await effectiveTenantId();
  const report = await buildAccountingReport(tenantId, search);

  if (format === "pdf") {
    const kpiRows = `
      <tr><td>Receita por pedidos</td><td>${money(report.totals.grossRevenue)}</td></tr>
      <tr><td>Receita manual</td><td>${money(report.totals.manualIncome)}</td></tr>
      <tr><td>Receita ajustada</td><td>${money(report.totals.adjustedRevenue)}</td></tr>
      <tr><td>Custos estimados</td><td>${money(report.totals.estimatedCosts)}</td></tr>
      <tr><td>Custos manuais</td><td>${money(report.totals.manualExpenses)}</td></tr>
      <tr><td>Lucro ajustado</td><td>${money(report.totals.adjustedProfit)}</td></tr>
      <tr><td>MRR ativo</td><td>${money(report.totals.mrr)}</td></tr>
      <tr><td>Descontos concedidos</td><td>${money(report.totals.discounts)}</td></tr>
    `;

    const ledgerRows = report.ledgerRows.slice(0, 50).map((entry) => {
      const signal = entry.type === "income" ? "+" : "-";
      return `<tr>
        <td>${esc(entry.source === "automatic" ? "automático" : "manual")}</td>
        <td>${esc(entry.channel ?? "—")}</td>
        <td>${esc(entry.description)}</td>
        <td>${esc(entry.cost_center ?? "—")}</td>
        <td>${signal} ${money(entry.amount_cents, entry.currency)}</td>
      </tr>`;
    }).join("");

    const orderRows = report.realizedOrders.slice(0, 50).map((order) => `<tr>
      <td>#${esc(order.number)}</td>
      <td>${esc(customerName(order))}</td>
      <td>${money(order.total_cents, order.currency)}</td>
      <td>${new Date(order.created_at).toLocaleDateString("pt-BR")}</td>
    </tr>`).join("");

    const body = `
      <div class="section">
        <div class="section-title">Indicadores — ${esc(report.range.label)}</div>
        <table>
          <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
          <tbody>${kpiRows}</tbody>
        </table>
      </div>

      ${report.ledgerRows.length > 0 ? `
      <div class="section">
        <div class="section-title">Razão Contábil (${report.ledgerRows.length})</div>
        <table>
          <thead><tr><th>Origem</th><th>Canal</th><th>Descrição</th><th>Centro de custo</th><th>Valor</th></tr></thead>
          <tbody>${ledgerRows}</tbody>
        </table>
      </div>` : ""}

      ${report.realizedOrders.length > 0 ? `
      <div class="section">
        <div class="section-title">Pedidos Realizados (${report.realizedOrders.length})</div>
        <table>
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Data</th></tr></thead>
          <tbody>${orderRows}</tbody>
        </table>
      </div>` : ""}
    `;

    const pdfConfig = await getPdfConfig();
    const html = buildFloraKraftPDF({
      title: "Relatório Contábil",
      subtitle: `Período: ${report.range.label}`,
      category: "contabil",
      department: "Contabilidade / Financeiro",
      config: pdfConfig,
      body,
    });

    return new Response(
      html + `<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new Response(buildCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="flora-contabilidade-${report.range.period}.csv"`,
    },
  });
}
