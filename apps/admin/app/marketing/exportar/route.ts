import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

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
  return new Date(value).toLocaleString("pt-BR");
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
    const lines = [
      "Flora Botanics - Marketing e Relacionamento",
      `Emitido em: ${new Date().toLocaleString("pt-BR")}`,
      "",
      `Campanhas: ${campaigns.length}`,
      `Mensagens enviadas: ${sent}`,
      `Falhas: ${failures}`,
      `Receita atribuida: ${money(totalRevenue)}`,
      `Custo registrado: ${money(totalCost)}`,
      "",
      "Campanhas recentes:",
      ...campaigns.slice(0, 14).map((row) => `${row.title} - ${row.status} - ${row.channel ?? "sem canal"} - ${money(row.revenue_cents ?? 0)}`),
      "",
      "Ultimos envios:",
      ...queue.slice(0, 12).map((row) => `${row.channel} - ${row.recipient} - ${row.status} - ${dateTime(row.sent_at)}`),
      "",
      "Linha do tempo:",
      ...timeline.slice(0, 10).map((row) => `${row.title} - ${row.event_type} - ${dateTime(row.occurred_at)}`),
    ];
    return new Response(buildPdf(lines), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename("pdf")}"`,
      },
    });
  }

  const csv = [
    csvLine(["Flora Botanics - Marketing e Relacionamento"]),
    csvLine(["Emitido em", new Date().toLocaleString("pt-BR")]),
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
