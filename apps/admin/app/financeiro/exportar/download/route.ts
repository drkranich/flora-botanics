import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { buildFloraKraftPDF } from "@/lib/pdf/template";

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

  const url    = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  const noCenarios   = url.searchParams.get("no_cenarios")   === "1";
  const noTabelas    = url.searchParams.get("no_tabelas")    === "1";
  const noDocumentos = url.searchParams.get("no_documentos") === "1";
  const kindFilter   = url.searchParams.get("kind")   ?? "";
  const statusFilter = url.searchParams.get("status") ?? "";
  const dateFrom     = url.searchParams.get("date_from") ?? "";
  const dateTo       = url.searchParams.get("date_to")   ?? "";

  const calcRows  = noCenarios   ? [] : (calculations ?? []) as unknown as CalcRow[];
  const priceRows = noTabelas    ? [] : (priceTables ?? [])  as unknown as PriceTableRow[];

  let quoteRows: QuoteRow[] = noDocumentos ? [] : (quotes ?? []) as unknown as QuoteRow[];

  // Aplica filtros de documentos
  if (kindFilter)   quoteRows = quoteRows.filter((r) => r.kind   === kindFilter);
  if (statusFilter) quoteRows = quoteRows.filter((r) => r.status === statusFilter);
  if (dateFrom)     quoteRows = quoteRows.filter((r) => r.created_at.slice(0, 10) >= dateFrom);
  if (dateTo)       quoteRows = quoteRows.filter((r) => r.created_at.slice(0, 10) <= dateTo);

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
        "Criado em": new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
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
        Número: row.number,
        Tipo: row.kind,
        Status: row.status,
        Cliente: row.customer_name,
        Empresa: row.company_name ?? "",
        Canal: row.channel ?? "",
        Valor: (row.totals?.netRevenueCents ?? 0) / 100,
        "Criado em": new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
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
    // Cenários
    const cenariosRows = calcRows.slice(0, 50).map((row) => {
      const t = row.totals ?? {};
      return `<tr>
        <td>${esc(row.title)}</td>
        <td>${esc(row.sale_model)} / ${esc(row.channel)}</td>
        <td>${esc(row.quantity)}</td>
        <td>${money(t.netRevenueCents ?? 0)}</td>
        <td>${money(t.netProfitCents ?? 0)}</td>
        <td>${Number(t.netMarginPercent ?? 0).toFixed(1)}%</td>
      </tr>`;
    }).join("");

    // Documentos comerciais
    const docRows = quoteRows.slice(0, 50).map((row) => {
      const t = row.totals ?? {};
      return `<tr>
        <td>#${esc(row.number)}</td>
        <td>${esc(row.kind)}</td>
        <td>${esc(row.customer_name)}${row.company_name ? `<br/><small>${esc(row.company_name)}</small>` : ""}</td>
        <td>${esc(row.channel)}</td>
        <td>${esc(row.status)}</td>
        <td>${money(t.netRevenueCents ?? 0)}</td>
      </tr>`;
    }).join("");

    // Tabelas de preço
    const tabelaRows = priceRows.slice(0, 30).map((row) => {
      return `<tr>
        <td>${esc(row.name)}</td>
        <td>${esc(row.table_type)}</td>
        <td>${esc(row.channel)}</td>
        <td>${Number(row.discount_percent ?? 0).toFixed(1)}%</td>
        <td>${Number(row.commission_percent ?? 0).toFixed(1)}%</td>
        <td>${Number(row.minimum_margin_percent ?? 0).toFixed(1)}%</td>
      </tr>`;
    }).join("");

    const body = `
      ${calcRows.length > 0 ? `
      <div class="section">
        <div class="section-title">Cenários de Precificação (${calcRows.length})</div>
        <table>
          <thead><tr>
            <th>Título</th><th>Modelo / Canal</th><th>Qtd</th>
            <th>Receita Líquida</th><th>Lucro</th><th>Margem</th>
          </tr></thead>
          <tbody>${cenariosRows}</tbody>
        </table>
      </div>` : ""}

      ${quoteRows.length > 0 ? `
      <div class="section">
        <div class="section-title">Documentos Comerciais (${quoteRows.length})</div>
        <table>
          <thead><tr>
            <th>#</th><th>Tipo</th><th>Cliente</th>
            <th>Canal</th><th>Status</th><th>Valor</th>
          </tr></thead>
          <tbody>${docRows}</tbody>
        </table>
      </div>` : ""}

      ${priceRows.length > 0 ? `
      <div class="section">
        <div class="section-title">Tabelas de Preço (${priceRows.length})</div>
        <table>
          <thead><tr>
            <th>Nome</th><th>Tipo</th><th>Canal</th>
            <th>Desconto</th><th>Comissão</th><th>Margem mín.</th>
          </tr></thead>
          <tbody>${tabelaRows}</tbody>
        </table>
      </div>` : ""}
    `;

    const html = buildFloraKraftPDF({
      title: "Relatório Financeiro",
      subtitle: "Cenários de precificação, documentos comerciais e tabelas de preço",
      body,
    });

    return new Response(
      html + `<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    );
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
        new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      ]);
    }),
    csvLine([]),
    csvLine(["Documentos comerciais"]),
    csvLine(["Número", "Tipo", "Status", "Cliente", "Empresa", "Canal", "Valor", "Criado em"]),
    ...quoteRows.map((row) => csvLine([
      row.number,
      row.kind,
      row.status,
      row.customer_name,
      row.company_name,
      row.channel,
      money(row.totals?.netRevenueCents ?? 0),
      new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
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

  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"flora-financeiro.csv\"",
    },
  });
}
