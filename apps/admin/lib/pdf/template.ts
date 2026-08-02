/**
 * Flora Botanics — Template centralizado de PDF
 *
 * Todos os relatórios do sistema (Auditoria, CRM, Orçamentos…) usam esta função.
 * Exceção: etiquetas de envio/produto — fundo branco puro, sem watermark.
 *
 * Resultado: HTML string pronto para window.open + window.print()
 */

export interface PdfConfig {
  /** Nome completo da empresa (rodapé) */
  companyName?: string;
  /** Endereço completo */
  address?: string;
  /** CNPJ */
  cnpj?: string;
  /** Telefone / WhatsApp */
  phone?: string;
  /** E-mail de contato */
  email?: string;
  /** URL do site */
  website?: string;
  /** Observações padrão (aparece no rodapé de todos os PDFs) */
  defaultNotes?: string;
}

export interface PdfBuildOptions {
  /** Título do documento (ex.: "Auditoria do Pedido #123") */
  title: string;
  /** Subtítulo / metadata linha única */
  subtitle?: string;
  /** HTML do conteúdo principal (tabelas, listas, seções) */
  body: string;
  /** Configurações de identidade visual e rodapé */
  config?: PdfConfig;
  /** Largura máxima do conteúdo em px (padrão: 900) */
  maxWidth?: number;
}

// ─── Logo Flora Botanics — Base64 pré-computado ─────────────────────────────
// SVG de folhas/pétalas estilizadas em espelho (identidade Flora Botanics).
// Embutido como Base64 para garantir renderização correta em qualquer browser
// e em qualquer contexto (servidor / cliente / popup de impressão).
const FLORA_LOGO_DATA_URI =
  "data:image/png;base64,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";

// ─── Construtor principal ────────────────────────────────────────────────────

export function buildFloraKraftPDF(options: PdfBuildOptions): string {
  const {
    title,
    subtitle,
    body,
    config = {},
    maxWidth = 1100,
  } = options;

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const logoUri = FLORA_LOGO_DATA_URI;

  const companyName = config.companyName || "Flora Botanics";
  const footerParts: string[] = [companyName];
  if (config.cnpj) footerParts.push(`CNPJ: ${config.cnpj}`);
  if (config.address) footerParts.push(config.address);
  if (config.phone) footerParts.push(config.phone);
  if (config.email) footerParts.push(config.email);
  if (config.website) footerParts.push(config.website);

  const footerLine = footerParts.join(" · ");
  const notes = config.defaultNotes ?? "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Forçar cores na impressão / Save as PDF ── */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    /* ── Página: fundo kraft mesmo ao salvar como PDF ── */
    @page { margin: 0; background: #f2e8d9; }

    /* ── Fundo kraft / papel reciclado ── */
    html, body {
      background: #f2e8d9 !important;
      color: #1a1a1a;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 13px;
      line-height: 1.65;
      min-height: 100%;
    }

    /* ── Wrapper que contém a marca d'água e o conteúdo ── */
    .page-wrap {
      position: relative;
      min-height: 100vh;
      background: #f2e8d9 !important;
    }

    /* ── Marca d'água: DIV real com <img> para garantir renderização no PDF ── */
    .watermark {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
    }
    .watermark-inner {
      position: absolute;
      inset: -20px;
      background-image: url('${logoUri}');
      background-repeat: repeat;
      background-size: 260px auto;
      opacity: 0.06;
    }

    /* ── Conteúdo acima da marca d'água ── */
    .page {
      position: relative;
      z-index: 1;
      max-width: ${maxWidth}px;
      margin: 0 auto;
      padding: 44px 64px 72px;
    }

    /* ── Cabeçalho ── */
    .pdf-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #5a3e2b;
      padding-bottom: 16px;
      margin-bottom: 28px;
      gap: 24px;
    }
    .pdf-header-brand h1 {
      font-size: 22px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #2a4a2c;
      margin-bottom: 2px;
    }
    .pdf-header-brand .subtitle {
      font-size: 11px;
      color: #6b5c4a;
    }
    .pdf-header-meta {
      text-align: right;
      font-size: 11px;
      color: #6b5c4a;
      flex-shrink: 0;
    }
    .pdf-title {
      font-size: 18px;
      font-weight: bold;
      color: #2a4a2c;
      margin-bottom: 4px;
    }
    .pdf-subtitle {
      font-size: 11px;
      color: #6b5c4a;
      margin-bottom: 24px;
    }

    /* ── Tabelas ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      margin-bottom: 28px;
      font-size: 12.5px;
    }
    th {
      background: #2a4a2c;
      color: #f2e8d9;
      text-align: left;
      padding: 10px 14px;
      font-size: 11.5px;
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    td {
      padding: 9px 14px;
      border-bottom: 1px solid rgba(90,62,43,0.18);
      vertical-align: top;
      color: #1a1a1a;
    }
    tr:nth-child(even) td {
      background: rgba(90,62,43,0.04);
    }
    tr:last-child td {
      border-bottom: none;
    }

    /* ── Seções ── */
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      color: #2a4a2c;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(90,62,43,0.25);
    }

    /* ── Badge ── */
    .badge {
      display: inline-block;
      background: rgba(42,74,44,0.12);
      color: #2a4a2c;
      border: 1px solid rgba(42,74,44,0.3);
      padding: 2px 10px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    /* ── pre / código ── */
    pre {
      background: rgba(90,62,43,0.07);
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 10px;
      white-space: pre-wrap;
      word-break: break-all;
      color: #3a2a1a;
      border-left: 3px solid rgba(90,62,43,0.3);
    }

    /* ── Observações e notas ── */
    .notes-box {
      background: rgba(185,146,77,0.08);
      border: 1px solid rgba(185,146,77,0.3);
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 11px;
      color: #4a3a20;
      margin-top: 20px;
    }
    .notes-box strong {
      display: block;
      margin-bottom: 4px;
      font-size: 10px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #8b6914;
    }

    /* ── Rodapé ── */
    .pdf-footer {
      margin-top: 40px;
      border-top: 1px solid rgba(90,62,43,0.25);
      padding-top: 12px;
      font-size: 10px;
      color: #8b7a6a;
      text-align: center;
    }
    .pdf-footer .footer-main {
      margin-bottom: 4px;
    }
    .pdf-footer .footer-gen {
      font-size: 9px;
      opacity: 0.75;
    }

    /* ── Impressão ── */
    @media print {
      html, body, .page-wrap { background: #f2e8d9 !important; }
      .page { padding: 24px 40px 40px; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page-wrap">
  <div class="watermark"><div class="watermark-inner"></div></div>
  <div class="page">

    <div class="pdf-header">
      <div class="pdf-header-brand">
        <h1>${companyName}</h1>
        <div class="subtitle">Sistema de Gestão · Admin</div>
      </div>
      <div class="pdf-header-meta">
        Gerado em ${now}<br/>
        ${config.website ?? "florabotanics.com.br"}
      </div>
    </div>

    <div class="pdf-title">${title}</div>
    ${subtitle ? `<div class="pdf-subtitle">${subtitle}</div>` : ""}

    <div class="badge">Flora Botanics · Documento interno</div>

    ${body}

    ${notes ? `<div class="notes-box"><strong>Observações</strong>${notes}</div>` : ""}

    <div class="pdf-footer">
      <div class="footer-main">${footerLine}</div>
      <div class="footer-gen">Documento gerado automaticamente pelo sistema Flora Botanics. Não possui valor fiscal.</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── Helper: abrir + imprimir ────────────────────────────────────────────────

export function openAndPrint(html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup bloqueado. Permita popups para este site e tente novamente.");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
