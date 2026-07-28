import { NextResponse, type NextRequest } from "next/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

type QuoteRow = {
  number: number;
  kind: string;
  status: string;
  customer_name: string;
  company_name: string | null;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  seller_name: string | null;
  channel: string | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  valid_until: string | null;
  totals: Record<string, number>;
  terms: string | null;
  notes: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  budget: "Orçamento",
  quote: "Cotação",
  proposal: "Proposta comercial",
};

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
    ...lines.slice(1, 48).flatMap((line) => ["0 -17 Td", `(${pdfText(line)}) Tj`]),
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getStaffSession();
  if (!session || session.role === "tenant_editor") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("commercial_quotes")
    .select("number, kind, status, customer_name, company_name, document_number, phone, email, address, seller_name, channel, payment_terms, delivery_terms, valid_until, totals, terms, notes, created_at")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  const quote = data as QuoteRow;
  const totals = quote.totals ?? {};
  const lines = [
    `Flora Botanics - ${KIND_LABEL[quote.kind] ?? quote.kind} #${quote.number}`,
    `Cliente: ${quote.customer_name}`,
    quote.company_name ? `Empresa: ${quote.company_name}` : "",
    quote.document_number ? `CPF/CNPJ: ${quote.document_number}` : "",
    quote.email ? `E-mail: ${quote.email}` : "",
    quote.phone ? `Telefone: ${quote.phone}` : "",
    quote.address ? `Endereco: ${quote.address}` : "",
    "",
    `Status: ${quote.status}`,
    `Canal: ${quote.channel ?? "sem canal"}`,
    `Vendedor: ${quote.seller_name ?? "nao informado"}`,
    `Validade: ${quote.valid_until ?? "sem validade definida"}`,
    `Pagamento: ${quote.payment_terms ?? "nao informado"}`,
    `Entrega: ${quote.delivery_terms ?? "nao informado"}`,
    "",
    "Resumo financeiro:",
    `Receita liquida: ${money(totals.netRevenueCents ?? 0)}`,
    `Custo total: ${money(totals.totalCostCents ?? 0)}`,
    `Lucro liquido: ${money(totals.netProfitCents ?? 0)}`,
    `Margem: ${Number(totals.netMarginPercent ?? 0).toFixed(1)}%`,
    "",
    "Termos comerciais:",
    ...(quote.terms ?? "Sem termos registrados.").split(/\r?\n/).slice(0, 8),
    "",
    "Observacoes internas:",
    ...(quote.notes ?? "Sem observacoes internas.").split(/\r?\n/).slice(0, 8),
  ].filter(Boolean);

  return new Response(buildPdf(lines), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="flora-documento-${quote.number}.pdf"`,
    },
  });
}
