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
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTQwIj48bGluZSB4MT0iNjAiIHkxPSIxMzAiIHgyPSI2MCIgeTI9IjQwIiBzdHJva2U9IiM1YTNlMmIiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTYwIDc1IEMzOCA1NSwyMCAzMCwzMCAxNSBDNDAgNSw1NSAyNSw2MCA0NSBaIiBmaWxsPSIjMmE0YTJjIiBvcGFjaXR5PSIwLjg1Ii8+PHBhdGggZD0iTTYwIDc1IEM4MiA1NSwxMDAgMzAsOTAgMTUgQzgwIDUsNjUgMjUsNjAgNDUgWiIgZmlsbD0iIzJhNGEyYyIgb3BhY2l0eT0iMC44NSIvPjxwYXRoIGQ9Ik02MCAxMDAgQzQyIDg1LDI4IDY1LDM1IDUyIEM0MiA0Miw1NyA1OCw2MCA3NSBaIiBmaWxsPSIjMmE0YTJjIiBvcGFjaXR5PSIwLjYiLz48cGF0aCBkPSJNNjAgMTAwIEM3OCA4NSw5MiA2NSw4NSA1MiBDNzggNDIsNjMgNTgsNjAgNzUgWiIgZmlsbD0iIzJhNGEyYyIgb3BhY2l0eT0iMC42Ii8+PHBhdGggZD0iTTYwIDEyNSBDNDggMTE1LDQwIDEwMCw1MCA5MiBDNTYgODgsNjAgMTAwLDYwIDExNSBaIiBmaWxsPSIjYjk5MjRkIiBvcGFjaXR5PSIwLjUiLz48cGF0aCBkPSJNNjAgMTI1IEM3MiAxMTUsODAgMTAwLDcwIDkyIEM2NCA4OCw2MCAxMDAsNjAgMTE1IFoiIGZpbGw9IiNiOTkyNGQiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==";

// ─── Construtor principal ────────────────────────────────────────────────────

export function buildFloraKraftPDF(options: PdfBuildOptions): string {
  const {
    title,
    subtitle,
    body,
    config = {},
    maxWidth = 900,
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

    /* ── Fundo kraft / papel reciclado ── */
    html, body {
      background: #f2e8d9;
      color: #1a1a1a;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12px;
      line-height: 1.6;
    }

    /* ── Marca d'água tileada — logo Flora quase transparente ── */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url('${logoUri}');
      background-repeat: repeat;
      background-size: 140px 164px;
      opacity: 0.05;
      pointer-events: none;
      z-index: 0;
    }

    /* ── Textura de papel kraft ── */
    body::after {
      content: '';
      position: fixed;
      inset: 0;
      background-image:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 3px,
          rgba(139,105,70,0.025) 3px,
          rgba(139,105,70,0.025) 4px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 7px,
          rgba(139,105,70,0.015) 7px,
          rgba(139,105,70,0.015) 8px
        );
      pointer-events: none;
      z-index: 0;
    }

    /* ── Conteúdo acima da marca d'água ── */
    .page {
      position: relative;
      z-index: 1;
      max-width: ${maxWidth}px;
      margin: 0 auto;
      padding: 40px 48px 60px;
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
      margin-top: 12px;
      margin-bottom: 24px;
      font-size: 11px;
    }
    th {
      background: #2a4a2c;
      color: #f2e8d9;
      text-align: left;
      padding: 8px 10px;
      font-size: 10.5px;
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    td {
      padding: 7px 10px;
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
      html, body { background: #f2e8d9 !important; }
      body::before { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 24px 32px 40px; }
    }
  </style>
</head>
<body>
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
