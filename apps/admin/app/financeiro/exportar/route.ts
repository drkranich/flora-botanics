import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
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

type PriceTableRow = {
  name: string;
  table_type: string;
  channel: string | null;
  customer_name: string | null;
  min_quantity: number;
  discount_percent: number;
  commission_percent: number;
  minimum_margin_percent: number;
  approval_required: boolean;
  valid_from: string | null;
  valid_until: string | null;
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
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();
  const [{ data: calculations }, { data: quotes }, { data: priceTables }] = await Promise.all([
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
    supabase
      .from("finance_price_tables")
      .select("name, table_type, channel, customer_name, min_quantity, discount_percent, commission_percent, minimum_margin_percent, approval_required, valid_from, valid_until, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const calcRows = (calculations ?? []) as unknown as CalcRow[];
  const quoteRows = (quotes ?? []) as unknown as QuoteRow[];
  const priceRows = (priceTables ?? []) as unknown as PriceTableRow[];
  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(calcRows.map((row) => ({
        Título: row.title,
        Tipo: row.calculation_mode,
        Modelo: row.sale_model,
        Canal: row.channel,
        Quantidade: row.quantity,
        "Receita líquida": (row.totals?.netRevenueCents ?? 0) / 100,
        "Custo total": (row.totals?.totalCostCents ?? 0) / 100,
        "Lucro líquido": (row.totals?.netProfitCents ?? 0) / 100,
        "Margem %": Number(row.totals?.netMarginPercent ?? 0),
        "Criado em": new Date(row.created_at).toLocaleString("pt-BR"),
      }))),
      "Cenários"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(priceRows.map((row) => ({
        Nome: row.name,
        Tipo: row.table_type,
        Canal: row.channel ?? "",
        Cliente: row.customer_name ?? "",
        "Quantidade mínima": row.min_quantity,
        "Desconto %": Number(row.discount_percent ?? 0),
        "Comissão %": Number(row.commission_percent ?? 0),
        "Margem mínima %": Number(row.minimum_margin_percent ?? 0),
        "Exige aprovação": row.approval_required ? "Sim" : "Não",
        "Vigente desde": row.valid_from ?? "",
        "Vigente até": row.valid_until ?? "",
      }))),
      "Tabelas"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(quoteRows.map((row) => ({
        Numero: row.number,
        Tipo: row.kind,
        Status: row.status,
        Cliente: row.customer_name,
        Empresa: row.company_name ?? "",
        Canal: row.channel ?? "",
        Valor: (row.totals?.netRevenueCents ?? 0) / 100,
        "Criado em": new Date(row.created_at).toLocaleString("pt-BR"),
      }))),
      "Documentos"
    );
    const workbookBytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    return new Response(workbookBytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"flora-financeiro.xlsx\"",
      },
    });
  }

  if (format === "pdf") {
    const lines = [
      "Flora Botanics - Financeiro, Precificação e Orçamentos",
      `Emitido em: ${new Date().toLocaleString("pt-BR")}`,
      "",
      "Cenários salvos:",
      ...calcRows.slice(0, 18).map((row) => {
        const totals = row.totals ?? {};
        return `${row.title} - ${row.sale_model}/${row.channel} - receita ${money(totals.netRevenueCents ?? 0)} - lucro ${money(totals.netProfitCents ?? 0)}`;
      }),
      "",
      "Orçamentos e propostas:",
      ...quoteRows.slice(0, 14).map((row) => {
        const totals = row.totals ?? {};
        return `#${row.number} - ${row.customer_name} - ${row.status} - ${money(totals.netRevenueCents ?? 0)}`;
      }),
      "",
      "Tabelas de preço:",
      ...priceRows.slice(0, 8).map((row) => {
        return `${row.name} - ${row.table_type}/${row.channel ?? "sem canal"} - desc ${Number(row.discount_percent).toFixed(1)}% - margem min ${Number(row.minimum_margin_percent).toFixed(1)}%`;
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
    csvLine(["Flora Botanics - Financeiro, Precificação e Orçamentos"]),
    csvLine([]),
    csvLine(["Cenários"]),
    csvLine(["Título", "Tipo", "Modelo", "Canal", "Quantidade", "Receita líquida", "Custo total", "Lucro líquido", "Margem", "Criado em"]),
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
    csvLine([]),
    csvLine(["Tabelas de preço"]),
    csvLine(["Nome", "Tipo", "Canal", "Cliente", "Quantidade mínima", "Desconto", "Comissão", "Margem mínima", "Aprovação", "Vigente desde", "Vigente até"]),
    ...priceRows.map((row) => csvLine([
      row.name,
      row.table_type,
      row.channel,
      row.customer_name,
      row.min_quantity,
      `${Number(row.discount_percent ?? 0).toFixed(1)}%`,
      `${Number(row.commission_percent ?? 0).toFixed(1)}%`,
      `${Number(row.minimum_margin_percent ?? 0).toFixed(1)}%`,
      row.approval_required ? "Sim" : "Não",
      row.valid_from,
      row.valid_until,
    ])),
  ].join("\r\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"flora-financeiro.csv\"",
    },
  });
}


