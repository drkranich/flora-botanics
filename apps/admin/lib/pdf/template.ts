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
