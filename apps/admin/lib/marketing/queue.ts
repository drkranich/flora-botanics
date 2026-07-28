import { renderTemplate, textToHtml } from "@/lib/email/resend";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type TemplateBlock = {
  type?: string;
  text?: string;
  html?: string;
  label?: string;
  url?: string;
  src?: string;
  alt?: string;
};

export type MarketingTemplate = {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  variables?: unknown;
  blocks?: unknown;
};

export type RenderedMarketingEmail =
  | { ok: true; subject: string; html: string; text: string }
  | { ok: false; error: string };

export function flattenPayload(payload: unknown): Record<string, string> {
  const out: Record<string, string> = {};

  function walk(value: unknown, path: string) {
    if (value === null || value === undefined) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[path] = String(value);
      return;
    }
    if (Array.isArray(value)) {
      out[path] = value.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ");
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, JsonValue>)) {
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  }

  walk(payload, "");
  return out;
}

export function extractTemplateVariables(input: string): string[] {
  const found = new Set<string>();
  for (const match of input.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseBlocks(template: MarketingTemplate): TemplateBlock[] {
  if (Array.isArray(template.blocks) && template.blocks.length > 0) return template.blocks as TemplateBlock[];

  try {
    const parsed = JSON.parse(template.body) as { blocks?: unknown };
    if (Array.isArray(parsed.blocks)) return parsed.blocks as TemplateBlock[];
  } catch {
    // Corpo livre, tratado como texto/HTML logo abaixo.
  }

  return [];
}

function blocksToHtml(blocks: TemplateBlock[], vars: Record<string, string>): string {
  return blocks
    .map((block) => {
      if (block.type === "heading") {
        return `<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;font-weight:400;color:#1a1a1a;line-height:1.2;">${escapeHtml(renderTemplate(block.text ?? "", vars))}</h1>`;
      }
      if (block.type === "cta") {
        const label = escapeHtml(renderTemplate(block.label ?? "Acessar", vars));
        const url = escapeHtml(renderTemplate(block.url ?? "https://florabotanics.com.br", vars));
        return `<p style="margin:28px 0;text-align:center;"><a href="${url}" style="display:inline-block;background:#1a1a1a;color:#c9a96e;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:16px 40px;border-radius:4px;">${label} &rarr;</a></p>`;
      }
      if (block.type === "image" && block.src) {
        const src = escapeHtml(renderTemplate(block.src, vars));
        const alt = escapeHtml(renderTemplate(block.alt ?? "", vars));
        return `<img src="${src}" alt="${alt}" style="display:block;width:100%;max-width:520px;border-radius:10px;margin:20px auto;" />`;
      }
      if (block.type === "divider") {
        return `<hr style="border:0;border-top:1px solid #ece8e1;margin:26px 0;" />`;
      }
      if (block.type === "spacer") {
        return `<div style="height:24px;"></div>`;
      }
      const html = block.html ?? (block.text ? `<p>${escapeHtml(block.text)}</p>` : "");
      return renderTemplate(html, vars);
    })
    .join("\n");
}

function wrapFloraEmail(contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:6px;color:#c9a96e;font-family:Georgia,serif;">FL&bull;RA</p>
            <p style="margin:4px 0 0;font-size:9px;letter-spacing:4px;color:#888;text-transform:uppercase;">BOTANICS</p>
          </td>
        </tr>
        <tr><td style="padding:40px 40px 32px;color:#555;font-size:15px;line-height:1.65;">${contentHtml}</td></tr>
        <tr>
          <td style="background:#f9f6f2;padding:24px 40px;text-align:center;border-top:1px solid #ece8e1;">
            <p style="margin:0;font-size:11px;color:#999;line-height:1.6;">Você recebeu este e-mail porque possui relacionamento com a Flora Botanics.<br>Preferências e descadastro serão respeitados pela plataforma.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function plainTextFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function requiredVariables(template: MarketingTemplate, bodySource: string): string[] {
  const declared = Array.isArray(template.variables) ? template.variables.map(String) : [];
  return [...new Set([...declared, ...extractTemplateVariables(template.subject ?? ""), ...extractTemplateVariables(bodySource)])];
}

export function renderMarketingEmail(template: MarketingTemplate, payload: unknown): RenderedMarketingEmail {
  if (template.channel !== "email") {
    return { ok: false, error: "Este template não é de e-mail." };
  }

  const vars = flattenPayload(payload);
  const blocks = parseBlocks(template);
  const rawBody = blocks.length > 0 ? blocksToHtml(blocks, vars) : renderTemplate(template.body, vars);
  const subject = renderTemplate(template.subject || template.name, vars);
  const missing = requiredVariables(template, template.body)
    .filter((name) => !(name in vars))
    .filter((name) => extractTemplateVariables(template.subject ?? "").includes(name) || template.body.includes(`{{${name}`) || template.body.includes(`{{ ${name}`));

  if (missing.length > 0) {
    return { ok: false, error: `Variáveis ausentes: ${missing.join(", ")}.` };
  }

  if (/\{\{\s*[\w.]+\s*\}\}/.test(subject) || /\{\{\s*[\w.]+\s*\}\}/.test(rawBody)) {
    return { ok: false, error: "O template ainda possui variáveis sem valor no payload." };
  }

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(rawBody);
  const contentHtml = looksLikeHtml ? rawBody : textToHtml(rawBody);
  const html = wrapFloraEmail(contentHtml);
  const text = plainTextFromHtml(contentHtml);

  return { ok: true, subject, html, text };
}

export function nextRetryIso(attempts: number): string {
  const minutes = Math.min(720, Math.max(5, 2 ** attempts * 5));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}
