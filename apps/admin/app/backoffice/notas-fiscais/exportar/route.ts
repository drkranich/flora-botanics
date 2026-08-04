import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { buildFloraKraftPDF } from "@/lib/pdf/template";
import { getPdfConfig } from "@/lib/pdf/actions";

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

type ExportOperationExport = {
  operation_number: string;
  title: string;
  status: string;
  sale_type: string;
  sale_channel: string;
  destination_country: string;
  destination_region: string | null;
  incoterm: string;
  tax_responsibility: string;
  currency: string;
  created_at: string;
};

type LandedCostExport = {
  scenario_name: string;
  total_landed_cost_cents: number;
  recommended_price_cents: number;
  profit_net_cents: number;
  margin_net_percent: number;
  taxes_paid_by_flora_cents: number;
  taxes_paid_by_buyer_cents: number;
  currency: string;
  created_at: string;
};

type InternationalDocumentExport = {
  document_scope: string;
  document_type: string;
  title: string;
  document_number: string | null;
  country_code: string | null;
  status: string;
  requirement_status: string;
  expires_at: string | null;
};

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values: (string | number | null | undefined)[]) {
  return values.map(csvCell).join(",");
}

function esc(s: string | number | null | undefined) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  const [
    { data: documents },
    { data: guides },
    { data: obligations },
    { data: vault },
    { data: exportOperations },
    { data: landedCosts },
    { data: internationalDocuments },
  ] = await Promise.all([
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
    supabase
      .from("export_operations")
      .select("operation_number, title, status, sale_type, sale_channel, destination_country, destination_region, incoterm, tax_responsibility, currency, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("landed_cost_calculations")
      .select("scenario_name, total_landed_cost_cents, recommended_price_cents, profit_net_cents, margin_net_percent, taxes_paid_by_flora_cents, taxes_paid_by_buyer_cents, currency, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("international_documents")
      .select("document_scope, document_type, title, document_number, country_code, status, requirement_status, expires_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const docRows = (documents ?? []) as unknown as FiscalDocExport[];
  const guideRows = (guides ?? []) as unknown as GuideExport[];
  const obligationRows = (obligations ?? []) as unknown as ObligationExport[];
  const vaultRows = (vault ?? []) as unknown as VaultExport[];
  const exportOperationRows = (exportOperations ?? []) as unknown as ExportOperationExport[];
  const landedCostRows = (landedCosts ?? []) as unknown as LandedCostExport[];
  const internationalDocumentRows = (internationalDocuments ?? []) as unknown as InternationalDocumentExport[];
  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  if (format === "json") {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      documents: docRows,
      guides: guideRows,
      obligations: obligationRows,
      vault: vaultRows,
      exportOperations: exportOperationRows,
      landedCosts: landedCostRows,
      internationalDocuments: internationalDocumentRows,
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
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(exportOperationRows.map((row) => ({
        Operação: row.operation_number,
        Título: row.title,
        Status: row.status,
        Venda: row.sale_type,
        Canal: row.sale_channel,
        Destino: row.destination_country,
        Região: row.destination_region ?? "",
        Incoterm: row.incoterm,
        Tributos: row.tax_responsibility,
        Moeda: row.currency,
        Criado: row.created_at,
      }))),
      "Comércio Exterior"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(landedCostRows.map((row) => ({
        Cenário: row.scenario_name,
        "Landed cost": row.total_landed_cost_cents / 100,
        "Preço recomendado": row.recommended_price_cents / 100,
        "Lucro líquido": row.profit_net_cents / 100,
        "Margem líquida": row.margin_net_percent,
        "Tributos Flora": row.taxes_paid_by_flora_cents / 100,
        "Tributos comprador": row.taxes_paid_by_buyer_cents / 100,
        Moeda: row.currency,
        Criado: row.created_at,
      }))),
      "Landed Cost"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(internationalDocumentRows.map((row) => ({
        Escopo: row.document_scope,
        Tipo: row.document_type,
        Título: row.title,
        Número: row.document_number ?? "",
        País: row.country_code ?? "",
        Status: row.status,
        Obrigatoriedade: row.requirement_status,
        Validade: row.expires_at ?? "",
      }))),
      "Docs Internacionais"
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
    const docTableRows = docRows.slice(0, 50).map((row) => `<tr>
      <td>${esc(row.document_type)}</td>
      <td>${esc(row.number ?? "—")}</td>
      <td>${esc(row.party_name ?? "—")}</td>
      <td>${esc(row.competence ?? "—")}</td>
      <td>${money(row.total_cents)}</td>
      <td>${esc(row.status)}</td>
    </tr>`).join("");

    const guideTableRows = guideRows.slice(0, 50).map((row) => `<tr>
      <td>${esc(row.document_name)}</td>
      <td>${esc(row.guide_type)}</td>
      <td>${esc(row.competence ?? "—")}</td>
      <td>${esc(formatDate(row.due_date) || "—")}</td>
      <td>${money(row.updated_cents)}</td>
      <td>${esc(row.payment_status)}</td>
    </tr>`).join("");

    const obligationTableRows = obligationRows.slice(0, 50).map((row) => `<tr>
      <td>${esc(row.name)}</td>
      <td>${esc(row.obligation_type)}</td>
      <td>${esc(row.competence ?? "—")}</td>
      <td>${esc(formatDate(row.due_date) || "—")}</td>
      <td>${esc(row.status)}</td>
      <td>${esc(row.priority)}</td>
    </tr>`).join("");

    const exportTableRows = exportOperationRows.slice(0, 30).map((row) => `<tr>
      <td>${esc(row.operation_number)}</td>
      <td>${esc(row.title)}</td>
      <td>${esc(row.destination_country)}</td>
      <td>${esc(row.incoterm)}</td>
      <td>${esc(row.tax_responsibility)}</td>
      <td>${esc(row.status)}</td>
    </tr>`).join("");

    const landedTableRows = landedCostRows.slice(0, 30).map((row) => `<tr>
      <td>${esc(row.scenario_name)}</td>
      <td>${money(row.total_landed_cost_cents, row.currency)}</td>
      <td>${money(row.recommended_price_cents, row.currency)}</td>
      <td>${money(row.profit_net_cents, row.currency)}</td>
      <td>${Number(row.margin_net_percent ?? 0).toFixed(1)}%</td>
      <td>${esc(row.currency)}</td>
    </tr>`).join("");

    const vaultTableRows = vaultRows.slice(0, 30).map((row) => `<tr>
      <td>${esc(row.name)}</td>
      <td>${esc(row.document_type)}</td>
      <td>${esc(row.department ?? "—")}</td>
      <td>${esc(row.competence ?? "—")}</td>
      <td>${money(row.value_cents)}</td>
      <td>${esc(row.status)}</td>
    </tr>`).join("");

    const body = `
      ${docRows.length > 0 ? `
      <div class="section">
        <div class="section-title">Documentos Fiscais (${docRows.length})</div>
        <table>
          <thead><tr>
            <th>Tipo</th><th>Número</th><th>Parte</th><th>Competência</th><th>Valor</th><th>Situação</th>
          </tr></thead>
          <tbody>${docTableRows}</tbody>
        </table>
      </div>` : ""}

      ${guideRows.length > 0 ? `
      <div class="section">
        <div class="section-title">Guias e Pagamentos (${guideRows.length})</div>
        <table>
          <thead><tr>
            <th>Documento</th><th>Tipo</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Pagamento</th>
          </tr></thead>
          <tbody>${guideTableRows}</tbody>
        </table>
      </div>` : ""}

      ${obligationRows.length > 0 ? `
      <div class="section">
        <div class="section-title">Obrigações Fiscais (${obligationRows.length})</div>
        <table>
          <thead><tr>
            <th>Obrigação</th><th>Tipo</th><th>Competência</th><th>Vencimento</th><th>Status</th><th>Prioridade</th>
          </tr></thead>
          <tbody>${obligationTableRows}</tbody>
        </table>
      </div>` : ""}

      ${vaultRows.length > 0 ? `
      <div class="section">
        <div class="section-title">Cofre Fiscal (${vaultRows.length})</div>
        <table>
          <thead><tr>
            <th>Nome</th><th>Tipo</th><th>Departamento</th><th>Competência</th><th>Valor</th><th>Status</th>
          </tr></thead>
          <tbody>${vaultTableRows}</tbody>
        </table>
      </div>` : ""}

      ${exportOperationRows.length > 0 ? `
      <div class="section">
        <div class="section-title">Comércio Exterior (${exportOperationRows.length})</div>
        <table>
          <thead><tr>
            <th>Operação</th><th>Título</th><th>Destino</th><th>Incoterm</th><th>Tributos</th><th>Status</th>
          </tr></thead>
          <tbody>${exportTableRows}</tbody>
        </table>
      </div>` : ""}

      ${landedCostRows.length > 0 ? `
      <div class="section">
        <div class="section-title">Landed Cost (${landedCostRows.length})</div>
        <table>
          <thead><tr>
            <th>Cenário</th><th>Landed Cost</th><th>Preço Rec.</th><th>Lucro Líq.</th><th>Margem</th><th>Moeda</th>
          </tr></thead>
          <tbody>${landedTableRows}</tbody>
        </table>
      </div>` : ""}
    `;

    const pdfConfig = await getPdfConfig();
    const html = buildFloraKraftPDF({
      title: "Centro Fiscal e Tributário",
      subtitle: "Documentos fiscais, guias, obrigações, cofre, comércio exterior e landed cost",
      category: "fiscal",
      department: "Fiscal / Tributário",
      config: pdfConfig,
      body,
    });

    return new Response(
      html + `<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
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
    csvLine([]),
    csvLine(["Comércio Exterior"]),
    csvLine(["Operação", "Título", "Status", "Venda", "Canal", "Destino", "Região", "Incoterm", "Tributos", "Moeda", "Criado"]),
    ...exportOperationRows.map((row) => csvLine([
      row.operation_number,
      row.title,
      row.status,
      row.sale_type,
      row.sale_channel,
      row.destination_country,
      row.destination_region,
      row.incoterm,
      row.tax_responsibility,
      row.currency,
      row.created_at,
    ])),
    csvLine([]),
    csvLine(["Memória de landed cost"]),
    csvLine(["Cenário", "Landed cost", "Preço recomendado", "Lucro líquido", "Margem líquida", "Tributos Flora", "Tributos comprador", "Moeda", "Criado"]),
    ...landedCostRows.map((row) => csvLine([
      row.scenario_name,
      money(row.total_landed_cost_cents, row.currency),
      money(row.recommended_price_cents, row.currency),
      money(row.profit_net_cents, row.currency),
      `${row.margin_net_percent}%`,
      money(row.taxes_paid_by_flora_cents, row.currency),
      money(row.taxes_paid_by_buyer_cents, row.currency),
      row.currency,
      row.created_at,
    ])),
    csvLine([]),
    csvLine(["Documentos internacionais"]),
    csvLine(["Escopo", "Tipo", "Título", "Número", "País", "Status", "Obrigatoriedade", "Validade"]),
    ...internationalDocumentRows.map((row) => csvLine([
      row.document_scope,
      row.document_type,
      row.title,
      row.document_number,
      row.country_code,
      row.status,
      row.requirement_status,
      formatDate(row.expires_at),
    ])),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"flora-centro-fiscal.csv\"",
    },
  });
}
