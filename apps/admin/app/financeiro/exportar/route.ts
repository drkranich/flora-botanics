import { NextResponse, type NextRequest } from "next/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

type CalcRow = {
  title: string;
  calculation_mode: string;
  sale_model: string;
  channel: string;
  quantity: number;
  totals: Record<string, number>;
  created_at: string;
};

type QuoteRow = {
  number: number;
  kind: string;
  status: string;
  customer_name: string;
  company_name: string | null;
  channel: string | null;
  totals: Record<string, number>;
  created_at: string;
};

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values: (string | number | null | undefined)[]) {
  return values.map(csvCell).join(",");
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

function buildPdf(lines: string[]) {
  const content = [
    "BT",
    "/F1 18 Tf",
    "50 780 Td",
    `(${pdfText(lines[0] ?? "Flora Botanics")}) Tj`,
    "/F1 10 Tf",
    ...lines.slice(1, 42).flatMap((line) => ["0 -18 Td", `(${pdfText(line)}) Tj`]),
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
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();
  const [{ data: calculations }, { data: quotes }] = await Promise.all([
    supabase
      .from("finance_calculations")
      .select("title, calculation_mode, sale_model, channel, quantity, totals, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("commercial_quotes")
      .select("number, kind, status, customer_name, company_name, channel, totals, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const calcRows = (calculations ?? []) as unknown as CalcRow[];
  const quoteRows = (quotes ?? []) as unknown as QuoteRow[];
  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  if (format === "pdf") {
    const lines = [
      "Flora Botanics - Financeiro, Precificacao e Orcamentos",
      `Emitido em: ${new Date().toLocaleString("pt-BR")}`,
      "",
      "Cenarios salvos:",
      ...calcRows.slice(0, 18).map((row) => {
        const totals = row.totals ?? {};
        return `${row.title} - ${row.sale_model}/${row.channel} - receita ${money(totals.netRevenueCents ?? 0)} - lucro ${money(totals.netProfitCents ?? 0)}`;
      }),
      "",
      "Orcamentos e propostas:",
      ...quoteRows.slice(0, 14).map((row) => {
        const totals = row.totals ?? {};
        return `#${row.number} - ${row.customer_name} - ${row.status} - ${money(totals.netRevenueCents ?? 0)}`;
      }),
    ];
    return new Response(buildPdf(lines), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"flora-financeiro.pdf\"",
      },
    });
  }

  const csv = [
    csvLine(["Flora Botanics - Financeiro, Precificacao e Orcamentos"]),
    csvLine([]),
    csvLine(["Cenarios"]),
    csvLine(["Titulo", "Tipo", "Modelo", "Canal", "Quantidade", "Receita liquida", "Custo total", "Lucro liquido", "Margem", "Criado em"]),
    ...calcRows.map((row) => {
      const totals = row.totals ?? {};
      return csvLine([
        row.title,
        row.calculation_mode,
        row.sale_model,
        row.channel,
        row.quantity,
        money(totals.netRevenueCents ?? 0),
        money(totals.totalCostCents ?? 0),
        money(totals.netProfitCents ?? 0),
        `${Number(totals.netMarginPercent ?? 0).toFixed(1)}%`,
        new Date(row.created_at).toLocaleString("pt-BR"),
      ]);
    }),
    csvLine([]),
    csvLine(["Documentos comerciais"]),
    csvLine(["Numero", "Tipo", "Status", "Cliente", "Empresa", "Canal", "Valor", "Criado em"]),
    ...quoteRows.map((row) => csvLine([
      row.number,
      row.kind,
      row.status,
      row.customer_name,
      row.company_name,
      row.channel,
      money(row.totals?.netRevenueCents ?? 0),
      new Date(row.created_at).toLocaleString("pt-BR"),
    ])),
  ].join("\r\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"flora-financeiro.csv\"",
    },
  });
}
