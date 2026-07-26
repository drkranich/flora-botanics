import { NextResponse, type NextRequest } from "next/server";
import { getStaffSession } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { buildAccountingReport, customerName, type AccountingSearch } from "@/lib/accounting/report";
import { money } from "@/lib/format";

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
        new Date(entry.occurred_at).toLocaleString("pt-BR"),
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
        new Date(order.created_at).toLocaleString("pt-BR"),
      ])
    ),
  ];

  return `\uFEFF${rows.join("\r\n")}`;
}

function pdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdf(report: Awaited<ReturnType<typeof buildAccountingReport>>) {
  const lines = [
    "Flora Botanics - Contabilidade",
    `Período: ${report.range.label}`,
    "",
    `Receita por pedidos: ${money(report.totals.grossRevenue)}`,
    `Receita manual: ${money(report.totals.manualIncome)}`,
    `Receita ajustada: ${money(report.totals.adjustedRevenue)}`,
    `Custos estimados: ${money(report.totals.estimatedCosts)}`,
    `Custos manuais: ${money(report.totals.manualExpenses)}`,
    `Lucro ajustado: ${money(report.totals.adjustedProfit)}`,
    `MRR ativo: ${money(report.totals.mrr)}`,
    `Descontos concedidos: ${money(report.totals.discounts)}`,
    "",
    "Razão contábil:",
    ...report.ledgerRows.slice(0, 24).map((entry) => {
      const signal = entry.type === "income" ? "+" : "-";
      return `${entry.source} - ${entry.channel ?? "sem canal"} - ${entry.description} - ${signal} ${money(entry.amount_cents, entry.currency)}`;
    }),
    "",
    "Últimas receitas:",
    ...report.realizedOrders.slice(0, 12).map((order) => {
      return `Pedido #${order.number} - ${customerName(order)} - ${money(order.total_cents, order.currency)}`;
    }),
  ];

  const content = [
    "BT",
    "/F1 18 Tf",
    "50 780 Td",
    `(${pdfText(lines[0])}) Tj`,
    "/F1 10 Tf",
    ...lines.slice(1).flatMap((line) => ["0 -18 Td", `(${pdfText(line)}) Tj`]),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
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
    return new Response(buildPdf(report), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="flora-contabilidade-${report.range.period}.pdf"`,
      },
    });
  }

  return new Response(buildCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="flora-contabilidade-${report.range.period}.csv"`,
    },
  });
}
