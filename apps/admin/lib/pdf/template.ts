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

  // ── Estilos visuais ──────────────────────────────────────────────────────
  /** Cor de fundo da página (padrão: #f2e8d9 — kraft) */
  bgColor?: string;
  /** Cor de destaque: cabeçalho de tabelas, títulos (padrão: #2a4a2c — verde) */
  accentColor?: string;
  /** Cor da borda do cabeçalho (padrão: #5a3e2b — marrom) */
  headerBorderColor?: string;
  /** Família de fonte (padrão: Georgia, serif) */
  fontFamily?: string;
  /** Opacidade da marca d'água 0–100 (padrão: 6) */
  watermarkOpacity?: number;
  /** Tamanho da marca d'água em px (padrão: 260) */
  watermarkSize?: number;
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

  // ── Variáveis de estilo (com fallbacks kraft) ──────────────────────────
  const bgColor          = config.bgColor          || "#f2e8d9";
  const accentColor      = config.accentColor      || "#2a4a2c";
  const headerBorderColor = config.headerBorderColor || "#5a3e2b";
  const fontFamily       = config.fontFamily       || "Georgia, 'Times New Roman', serif";
  const wmOpacity        = ((config.watermarkOpacity ?? 6) / 100).toFixed(2);
  const wmSize           = config.watermarkSize    ?? 260;

  // Derivar variantes tonais a partir das cores base
  const accentRgb = hexToRgb(accentColor);
  const borderRgb = hexToRgb(headerBorderColor);
  const accentBg  = `rgba(${accentRgb},0.12)`;
  const accentBd  = `rgba(${accentRgb},0.3)`;
  const borderFaint = `rgba(${borderRgb},0.18)`;
  const borderMid   = `rgba(${borderRgb},0.25)`;

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

    /* ── Página: fundo configurável mesmo ao salvar como PDF ── */
    @page { margin: 0; background: ${bgColor}; }

    /* ── Fundo configurável ── */
    html, body {
      background: ${bgColor} !important;
      color: #1a1a1a;
      font-family: ${fontFamily};
      font-size: 13px;
      line-height: 1.65;
      min-height: 100%;
    }

    /* ── Wrapper que contém a marca d'água e o conteúdo ── */
    .page-wrap {
      position: relative;
      min-height: 100vh;
      background: ${bgColor} !important;
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
      background-size: ${wmSize}px auto;
      opacity: ${wmOpacity};
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
      border-bottom: 2px solid ${headerBorderColor};
      padding-bottom: 16px;
      margin-bottom: 28px;
      gap: 24px;
    }
    .pdf-header-brand h1 {
      font-size: 22px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: ${accentColor};
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
      color: ${accentColor};
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
      background: ${accentColor};
      color: ${bgColor};
      text-align: left;
      padding: 10px 14px;
      font-size: 11.5px;
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    td {
      padding: 9px 14px;
      border-bottom: 1px solid ${borderFaint};
      vertical-align: top;
      color: #1a1a1a;
    }
    tr:nth-child(even) td {
      background: rgba(${borderRgb},0.04);
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
      color: ${accentColor};
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid ${borderMid};
    }

    /* ── Badge ── */
    .badge {
      display: inline-block;
      background: ${accentBg};
      color: ${accentColor};
      border: 1px solid ${accentBd};
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
      html, body, .page-wrap { background: ${bgColor} !important; }
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

// ─── Helper: converter hex → "r,g,b" para rgba() ────────────────────────────

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
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
