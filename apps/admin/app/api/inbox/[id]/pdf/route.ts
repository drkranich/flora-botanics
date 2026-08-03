/**
 * GET /api/inbox/[id]/pdf
 *
 * Gera um PDF da conversa completa (mensagens + metadados).
 * Acessível apenas para staff autenticado.
 */

import { NextRequest, NextResponse } from "next/server";
import { getConversationPdfData } from "@/app/inbox/inbox-actions";

// Helpers de formatação
function fmt(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const CHANNEL_LABEL: Record<string, string> = {
  email: "E-mail", whatsapp: "WhatsApp", chat: "Chat",
  phone: "Telefone", instagram: "Instagram", facebook: "Facebook", sms: "SMS",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  const { conv, timeline } = await getConversationPdfData(conversationId);

  if (!conv) {
    return new NextResponse("Conversa não encontrada.", { status: 404 });
  }

  // Monta HTML que será convertido em PDF pelo browser (print stylesheet)
  // O cliente vai abrir /api/inbox/[id]/pdf numa nova aba e usar Ctrl+P / window.print()
  // Para geração server-side real usaríamos puppeteer — aqui usamos HTML imprimível
  const messages = timeline.filter(t => t.kind === "message" || t.kind === "note");

  const rows = messages.map(msg => {
    const isContact = msg.sender_is_contact;
    const isNote    = msg.is_internal_note;
    const atts      = msg.attachments ?? [];

    const attHtml = atts.map(a =>
      `<div class="att">📎 <a href="${a.url}" target="_blank">${a.name}</a> (${fmtSize(a.size)})</div>`
    ).join("");

    return `
      <div class="msg ${isContact ? "in" : isNote ? "note" : "out"}">
        <div class="meta">
          <strong>${msg.sender_name ?? "?"}</strong>
          ${isNote ? '<span class="tag-note">Nota interna</span>' : ""}
          <span class="ts">${fmt(msg.created_at)}</span>
        </div>
        <div class="body">${(msg.body ?? "").replace(/\n/g, "<br>")}</div>
        ${attHtml}
      </div>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Conversa — ${conv.contact_name ?? conv.contact_handle ?? "Lead"}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 12px; color: #1a1a1a; background: #fff;
    padding: 32px 40px;
  }
  header {
    border-bottom: 2px solid #b9924d;
    padding-bottom: 16px; margin-bottom: 24px;
  }
  header h1 {
    font-size: 18px; font-weight: 700; color: #7a5c1e;
    letter-spacing: -0.3px;
  }
  header h1 span { color: #1a1a1a; font-weight: 400; }
  .meta-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 4px 20px; margin-top: 10px;
    font-size: 11px; color: #555;
  }
  .meta-grid b { color: #1a1a1a; }
  .msgs { display: flex; flex-direction: column; gap: 14px; }
  .msg {
    border-radius: 8px; padding: 10px 14px;
    border-left: 3px solid #ccc;
    background: #f9f9f9;
    page-break-inside: avoid;
  }
  .msg.in  { border-color: #b9924d; background: #fffbf5; }
  .msg.out { border-color: #4ade80; background: #f5fff8; }
  .msg.note { border-color: #f0b429; background: #fffbee; }
  .meta {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 6px; font-size: 10.5px; color: #666;
  }
  .meta strong { color: #1a1a1a; font-size: 11.5px; }
  .tag-note {
    background: #fef3c7; border: 1px solid #f0b429;
    border-radius: 4px; padding: 1px 5px;
    font-size: 9px; font-weight: 700; color: #92400e;
    letter-spacing: 0.5px; text-transform: uppercase;
  }
  .ts { margin-left: auto; color: #999; font-size: 10px; white-space: nowrap; }
  .body { line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
  .att { margin-top: 6px; font-size: 10.5px; color: #555; }
  .att a { color: #7a5c1e; }
  footer {
    margin-top: 32px; padding-top: 12px;
    border-top: 1px solid #e0d5c5;
    font-size: 10px; color: #999; text-align: center;
  }
  @media print {
    body { padding: 20px; }
    .msg { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<header>
  <h1>Flora Botanics — <span>Conversa de Atendimento</span></h1>
  <div class="meta-grid">
    <div><b>Canal:</b> ${CHANNEL_LABEL[conv.channel] ?? conv.channel}</div>
    <div><b>Status:</b> ${conv.status}</div>
    <div><b>Contato:</b> ${conv.contact_name ?? "—"}</div>
    <div><b>Handle:</b> ${conv.contact_handle ?? "—"}</div>
    <div><b>Aberto em:</b> ${fmt(conv.created_at)}</div>
    <div><b>Mensagens:</b> ${messages.length}</div>
    ${conv.tags?.length ? `<div style="grid-column:1/-1"><b>Tags:</b> ${conv.tags.join(", ")}</div>` : ""}
  </div>
</header>

<div class="msgs">
  ${rows || '<p style="color:#999;font-style:italic">Nenhuma mensagem nesta conversa.</p>'}
</div>

<footer>
  Gerado em ${fmt(new Date().toISOString())} · Flora Botanics Helpdesk
</footer>

<script>window.onload = () => window.print();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="conversa-${conversationId.slice(0, 8)}.pdf"`,
    },
  });
}
