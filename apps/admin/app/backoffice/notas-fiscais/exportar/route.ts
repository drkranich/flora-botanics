import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

type FiscalDocExport = {
  document_type: string;
  number: string | null;
  series: string | null;
  party_name: string | null;
  party_document: string | null;
  competence: string | null;
  due_date: string | null;
  total_cents: number;
  tax_total_cents: number;
  payment_status: string;
  verification_status: string;
  status: string;
  origin: string;
  updated_at: string;
};

type GuideExport = {
  guide_type: string;
  document_name: string;
  competence: string | null;
  due_date: string | null;
  original_cents: number;
  updated_cents: number;
  paid_cents: number;
  payment_status: string;
  verification_status: string;
};

type ObligationExport = {
  name: string;
  obligation_type: string;
  competence: string | null;
  due_date: string | null;
  status: string;
  priority: string;
};

type VaultExport = {
  name: string;
  document_type: string;
  category: string | null;
  department: string | null;
  competence: string | null;
  due_date: string | null;
  value_cents: number;
  status: string;
  verification_status: string;
  origin: string;
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

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("pt-BR");
}

export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role === "tenant_editor") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = await supabaseServer();
  const tenantId = await effectiveTenantId();
  const [{ data: documents }, { data: guides }, { data: obligations }, { data: vault }] = await Promise.all([
    supabase
      .from("fiscal_documents")
      .select("document_type, number, series, party_name, party_document, competence, due_date, total_cents, tax_total_cents, payment_status, verification_status, status, origin, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("fiscal_guides")
      .select("guide_type, document_name, competence, due_date, original_cents, updated_cents, paid_cents, payment_status, verification_status")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500),
    supabase
      .from("fiscal_obligations")
      .select("name, obligation_type, competence, due_date, status, priority")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500),
    supabase
      .from("fiscal_vault_documents")
      .select("name, document_type, category, department, competence, due_date, value_cents, status, verification_status, origin")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  const docRows = (documents ?? []) as unknown as FiscalDocExport[];
  const guideRows = (guides ?? []) as unknown as GuideExport[];
  const obligationRows = (obligations ?? []) as unknown as ObligationExport[];
  const vaultRows = (vault ?? []) as unknown as VaultExport[];
  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  if (format === "json") {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      documents: docRows,
      guides: guideRows,
      obligations: obligationRows,
      vault: vaultRows,
    });
  }

  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(docRows.map((row) => ({
        Tipo: row.document_type,
        Número: row.number ?? "",
        Série: row.series ?? "",
        Parte: row.party_name ?? "",
        Documento: row.party_document ?? "",
        Competência: row.competence ?? "",
        Vencimento: row.due_date ?? "",
        Valor: row.total_cents / 100,
        Tributos: row.tax_total_cents / 100,
        Pagamento: row.payment_status,
        Verificação: row.verification_status,
        Situação: row.status,
        Origem: row.origin,
      }))),
      "Documentos"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(guideRows.map((row) => ({
        Tipo: row.guide_type,
        Documento: row.document_name,
        Competência: row.competence ?? "",
        Vencimento: row.due_date ?? "",
        Original: row.original_cents / 100,
        Atualizado: row.updated_cents / 100,
        Pago: row.paid_cents / 100,
        Pagamento: row.payment_status,
        Verificação: row.verification_status,
      }))),
      "Guias"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(obligationRows.map((row) => ({
        Obrigação: row.name,
        Tipo: row.obligation_type,
        Competência: row.competence ?? "",
        Vencimento: row.due_date ?? "",
        Status: row.status,
        Prioridade: row.priority,
      }))),
      "Obrigações"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(vaultRows.map((row) => ({
        Nome: row.name,
        Tipo: row.document_type,
        Categoria: row.category ?? "",
        Departamento: row.department ?? "",
        Competência: row.competence ?? "",
        Vencimento: row.due_date ?? "",
        Valor: row.value_cents / 100,
        Status: row.status,
        Verificação: row.verification_status,
        Origem: row.origin,
      }))),
      "Cofre"
    );
    const workbookBytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    return new Response(workbookBytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"flora-centro-fiscal.xlsx\"",
      },
    });
  }

  if (format === "pdf") {
    const lines = [
      "Flora Botanics - Centro Fiscal e Tributario",
      `Emitido em: ${new Date().toLocaleString("pt-BR")}`,
      "",
      "Documentos fiscais:",
      ...docRows.slice(0, 15).map((row) => `${row.document_type} ${row.number ?? ""} - ${row.party_name ?? "sem parte"} - ${money(row.total_cents)} - ${row.status}`),
      "",
      "Guias e pagamentos:",
      ...guideRows.slice(0, 12).map((row) => `${row.document_name} - vence ${formatDate(row.due_date)} - ${money(row.updated_cents)} - ${row.payment_status}`),
      "",
      "Obrigacoes:",
      ...obligationRows.slice(0, 8).map((row) => `${row.name} - ${row.competence ?? ""} - ${formatDate(row.due_date)} - ${row.status}`),
    ];
    return new Response(buildPdf(lines), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"flora-centro-fiscal.pdf\"",
      },
    });
  }

  const csv = [
    csvLine(["Flora Botanics - Centro Fiscal e Tributário"]),
    csvLine(["Emitido em", new Date().toLocaleString("pt-BR")]),
    csvLine([]),
    csvLine(["Documentos fiscais"]),
    csvLine(["Tipo", "Número", "Série", "Parte", "CPF/CNPJ", "Competência", "Vencimento", "Valor", "Tributos", "Pagamento", "Verificação", "Situação", "Origem"]),
    ...docRows.map((row) => csvLine([
      row.document_type,
      row.number,
      row.series,
      row.party_name,
      row.party_document,
      row.competence,
      formatDate(row.due_date),
      money(row.total_cents),
      money(row.tax_total_cents),
      row.payment_status,
      row.verification_status,
      row.status,
      row.origin,
    ])),
    csvLine([]),
    csvLine(["Guias"]),
    csvLine(["Tipo", "Documento", "Competência", "Vencimento", "Original", "Atualizado", "Pago", "Pagamento", "Verificação"]),
    ...guideRows.map((row) => csvLine([
      row.guide_type,
      row.document_name,
      row.competence,
      formatDate(row.due_date),
      money(row.original_cents),
      money(row.updated_cents),
      money(row.paid_cents),
      row.payment_status,
      row.verification_status,
    ])),
    csvLine([]),
    csvLine(["Obrigações"]),
    csvLine(["Obrigação", "Tipo", "Competência", "Vencimento", "Status", "Prioridade"]),
    ...obligationRows.map((row) => csvLine([
      row.name,
      row.obligation_type,
      row.competence,
      formatDate(row.due_date),
      row.status,
      row.priority,
    ])),
    csvLine([]),
    csvLine(["Cofre fiscal"]),
    csvLine(["Nome", "Tipo", "Categoria", "Departamento", "Competência", "Vencimento", "Valor", "Status", "Verificação", "Origem"]),
    ...vaultRows.map((row) => csvLine([
      row.name,
      row.document_type,
      row.category,
      row.department,
      row.competence,
      formatDate(row.due_date),
      money(row.value_cents),
      row.status,
      row.verification_status,
      row.origin,
    ])),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"flora-centro-fiscal.csv\"",
    },
  });
}
