import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { buildFloraKraftPDF } from "@/lib/pdf/template";
import { getPdfConfig } from "@/lib/pdf/actions";

type CampaignRow = {
  title: string;
  status: string;
  channel: string | null;
  budget_cents: number | null;
  cost_cents: number | null;
  revenue_cents: number | null;
  starts_at: string | null;
  created_at: string;
};

type EventRow = {
  event_type: string;
  channel: string | null;
  provider: string | null;
  revenue_cents: number | null;
  cost_cents: number | null;
  occurred_at: string;
};

type QueueRow = {
  channel: string;
  recipient: string;
  status: string;
  provider: string | null;
  attempts: number;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  last_error: string | null;
};

type ConsentRow = {
  email: string | null;
  phone: string | null;
  channel: string;
  status: string;
  source: string | null;
  changed_at: string;
};

type CostRow = {
  channel: string | null;
  provider: string | null;
  cost_type: string;
  description: string;
  quantity: number;
  total_cost_cents: number;
  occurred_at: string;
};

type TimelineRow = {
  channel: string | null;
  event_type: string;
  title: string;
  description: string | null;
  occurred_at: string;
};

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values: (string | number | null | undefined)[]) {
  return values.map(csvCell).join(",");
}

function dateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function esc(s: string | number | null | undefined) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function filename(format: string) {
  const day = new Date().toISOString().slice(0, 10);
  return `flora-marketing-${day}.${format}`;
}

export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role === "tenant_editor") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();
  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  const [campaignsRes, eventsRes, queueRes, consentsRes, costsRes, timelineRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("title, status, channel, budget_cents, cost_cents, revenue_cents, starts_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("marketing_events")
      .select("event_type, channel, provider, revenue_cents, cost_cents, occurred_at")
      .eq("tenant_id", tenantId)
      .order("occurred_at", { ascending: false })
      .limit(1000),
    supabase
      .from("marketing_message_queue")
      .select("channel, recipient, status, provider, attempts, sent_at, delivered_at, opened_at, clicked_at, last_error")
      .eq("tenant_id", tenantId)
      .order("run_at", { ascending: false })
      .limit(1000),
    supabase
      .from("marketing_consents")
      .select("email, phone, channel, status, source, changed_at")
      .eq("tenant_id", tenantId)
      .order("changed_at", { ascending: false })
      .limit(1000),
    supabase
      .from("marketing_cost_entries")
      .select("channel, provider, cost_type, description, quantity, total_cost_cents, occurred_at")
      .eq("tenant_id", tenantId)
      .order("occurred_at", { ascending: false })
      .limit(1000),
    supabase
      .from("marketing_customer_timeline")
      .select("channel, event_type, title, description, occurred_at")
      .eq("tenant_id", tenantId)
      .order("occurred_at", { ascending: false })
      .limit(1000),
  ]);

  const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
  const events = (eventsRes.data ?? []) as EventRow[];
  const queue = (queueRes.data ?? []) as QueueRow[];
  const consents = (consentsRes.data ?? []) as ConsentRow[];
  const costs = (costsRes.data ?? []) as CostRow[];
  const timeline = (timelineRes.data ?? []) as TimelineRow[];

  const totalRevenue = campaigns.reduce((sum, row) => sum + (row.revenue_cents ?? 0), 0);
  const totalCost = costs.reduce((sum, row) => sum + (row.total_cost_cents ?? 0), 0);
  const sent = queue.filter((row) => row.status === "sent").length;
  const failures = queue.filter((row) => row.status === "failed" || row.status === "dead").length;

  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(campaigns.map((row) => ({
      Campanha: row.title,
      Status: row.status,
      Canal: row.channel ?? "",
      Orçamento: (row.budget_cents ?? 0) / 100,
      Custo: (row.cost_cents ?? 0) / 100,
      Receita: (row.revenue_cents ?? 0) / 100,
      Início: dateTime(row.starts_at),
      "Criada em": dateTime(row.created_at),
    }))), "Campanhas");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(queue.map((row) => ({
      Canal: row.channel,
      Destinatário: row.recipient,
      Status: row.status,
      Provedor: row.provider ?? "",
      Tentativas: row.attempts,
      Enviado: dateTime(row.sent_at),
      Entregue: dateTime(row.delivered_at),
      Aberto: dateTime(row.opened_at),
      Clicado: dateTime(row.clicked_at),
      Erro: row.last_error ?? "",
    }))), "Envios");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(events.map((row) => ({
      Evento: row.event_type,
      Canal: row.channel ?? "",
      Provedor: row.provider ?? "",
      Receita: (row.revenue_cents ?? 0) / 100,
      Custo: (row.cost_cents ?? 0) / 100,
      Data: dateTime(row.occurred_at),
    }))), "Eventos");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(consents.map((row) => ({
      "E-mail": row.email ?? "",
      Telefone: row.phone ?? "",
      Canal: row.channel,
      Status: row.status,
      Origem: row.source ?? "",
      Data: dateTime(row.changed_at),
    }))), "Consentimentos");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(costs.map((row) => ({
      Canal: row.channel ?? "",
      Provedor: row.provider ?? "",
      Tipo: row.cost_type,
      Descrição: row.description,
      Quantidade: row.quantity,
      Total: row.total_cost_cents / 100,
      Data: dateTime(row.occurred_at),
    }))), "Custos");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(timeline.map((row) => ({
      Canal: row.channel ?? "",
      Evento: row.event_type,
      Título: row.title,
      Descrição: row.description ?? "",
      Data: dateTime(row.occurred_at),
    }))), "Timeline");

    const workbookBytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    return new Response(workbookBytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename("xlsx")}"`,
      },
    });
  }

  if (format === "pdf") {
    const campaignRows = campaigns.slice(0, 50).map((row) => `<tr>
      <td>${esc(row.title)}</td>
      <td>${esc(row.channel ?? "—")}</td>
      <td>${esc(row.status)}</td>
      <td>${money(row.budget_cents ?? 0)}</td>
      <td>${money(row.cost_cents ?? 0)}</td>
      <td>${money(row.revenue_cents ?? 0)}</td>
    </tr>`).join("");

    const queueRows = queue.slice(0, 50).map((row) => `<tr>
      <td>${esc(row.channel)}</td>
      <td>${esc(row.recipient)}</td>
      <td>${esc(row.status)}</td>
      <td>${esc(dateTime(row.sent_at))}</td>
    </tr>`).join("");

    const timelineRows = timeline.slice(0, 30).map((row) => `<tr>
      <td>${esc(row.title)}</td>
      <td>${esc(row.event_type)}</td>
      <td>${esc(dateTime(row.occurred_at))}</td>
    </tr>`).join("");

    const body = `
      <div class="section">
        <div class="section-title">Indicadores</div>
        <table>
          <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
          <tbody>
            <tr><td>Campanhas</td><td>${campaigns.length}</td></tr>
            <tr><td>Mensagens enviadas</td><td>${sent}</td></tr>
            <tr><td>Falhas</td><td>${failures}</td></tr>
            <tr><td>Receita atribuída</td><td>${money(totalRevenue)}</td></tr>
            <tr><td>Custo registrado</td><td>${money(totalCost)}</td></tr>
          </tbody>
        </table>
      </div>

      ${campaigns.length > 0 ? `
      <div class="section">
        <div class="section-title">Campanhas (${campaigns.length})</div>
        <table>
          <thead><tr><th>Título</th><th>Canal</th><th>Status</th><th>Orçamento</th><th>Custo</th><th>Receita</th></tr></thead>
          <tbody>${campaignRows}</tbody>
        </table>
      </div>` : ""}

      ${queue.length > 0 ? `
      <div class="section">
        <div class="section-title">Envios (${queue.length})</div>
        <table>
          <thead><tr><th>Canal</th><th>Destinatário</th><th>Status</th><th>Enviado em</th></tr></thead>
          <tbody>${queueRows}</tbody>
        </table>
      </div>` : ""}

      ${timeline.length > 0 ? `
      <div class="section">
        <div class="section-title">Linha do Tempo (${timeline.length})</div>
        <table>
          <thead><tr><th>Título</th><th>Evento</th><th>Data</th></tr></thead>
          <tbody>${timelineRows}</tbody>
        </table>
      </div>` : ""}
    `;

    const pdfConfig = await getPdfConfig();
    const html = buildFloraKraftPDF({
      title: "Marketing e Relacionamento",
      subtitle: "Campanhas, envios e linha do tempo",
      category: "relatorio_crm",
      department: "Marketing / Relacionamento",
      config: pdfConfig,
      body,
    });

    return new Response(
      html + `<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const csv = [
    csvLine(["Flora Botanics - Marketing e Relacionamento"]),
    csvLine(["Emitido em", new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })]),
    csvLine([]),
    csvLine(["Resumo"]),
    csvLine(["Campanhas", campaigns.length]),
    csvLine(["Mensagens enviadas", sent]),
    csvLine(["Falhas", failures]),
    csvLine(["Receita atribuída", money(totalRevenue)]),
    csvLine(["Custo registrado", money(totalCost)]),
    csvLine([]),
    csvLine(["Campanhas"]),
    csvLine(["Campanha", "Status", "Canal", "Orçamento", "Custo", "Receita", "Início", "Criada em"]),
    ...campaigns.map((row) => csvLine([
      row.title,
      row.status,
      row.channel,
      money(row.budget_cents ?? 0),
      money(row.cost_cents ?? 0),
      money(row.revenue_cents ?? 0),
      dateTime(row.starts_at),
      dateTime(row.created_at),
    ])),
    csvLine([]),
    csvLine(["Envios"]),
    csvLine(["Canal", "Destinatário", "Status", "Provedor", "Tentativas", "Enviado", "Entregue", "Aberto", "Clicado", "Erro"]),
    ...queue.map((row) => csvLine([
      row.channel,
      row.recipient,
      row.status,
      row.provider,
      row.attempts,
      dateTime(row.sent_at),
      dateTime(row.delivered_at),
      dateTime(row.opened_at),
      dateTime(row.clicked_at),
      row.last_error,
    ])),
    csvLine([]),
    csvLine(["Eventos"]),
    csvLine(["Evento", "Canal", "Provedor", "Receita", "Custo", "Data"]),
    ...events.map((row) => csvLine([
      row.event_type,
      row.channel,
      row.provider,
      money(row.revenue_cents ?? 0),
      money(row.cost_cents ?? 0),
      dateTime(row.occurred_at),
    ])),
    csvLine([]),
    csvLine(["Consentimentos"]),
    csvLine(["E-mail", "Telefone", "Canal", "Status", "Origem", "Data"]),
    ...consents.map((row) => csvLine([row.email, row.phone, row.channel, row.status, row.source, dateTime(row.changed_at)])),
    csvLine([]),
    csvLine(["Custos"]),
    csvLine(["Canal", "Provedor", "Tipo", "Descrição", "Quantidade", "Total", "Data"]),
    ...costs.map((row) => csvLine([row.channel, row.provider, row.cost_type, row.description, row.quantity, money(row.total_cost_cents), dateTime(row.occurred_at)])),
    csvLine([]),
    csvLine(["Linha do tempo"]),
    csvLine(["Canal", "Evento", "Título", "Descrição", "Data"]),
    ...timeline.map((row) => csvLine([row.channel, row.event_type, row.title, row.description, dateTime(row.occurred_at)])),
  ].join("\r\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename("csv")}"`,
    },
  });
}
