/**
 * Integração com a API do Resend (envio de e-mail transacional).
 *
 * Variáveis de ambiente (configuradas como Secrets/Vars do Worker
 * `flora-admin` na Cloudflare):
 *   - RESEND_API_KEY      -> chave de API do Resend (obrigatória)
 *   - RESEND_FROM_EMAIL   -> remetente, ex: "Flora Botanics <contato@florabotanics.com.br>"
 *   - RESEND_WEBHOOK_SECRET -> usado pelo webhook de e-mails recebidos (fase 2)
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Indica se as variáveis necessárias para enviar e-mail via Resend
 * estão configuradas no ambiente atual.
 */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/**
 * Envia um e-mail via Resend. Retorna { ok: false, error } em qualquer
 * falha (configuração ausente, erro de rede, erro retornado pela API)
 * para que a UI possa mostrar uma mensagem clara em vez de quebrar.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "Resend não está configurado (faltam RESEND_API_KEY e/ou RESEND_FROM_EMAIL nas variáveis do Worker).",
    };
  }

  if (!input.html && !input.text) {
    return { ok: false, error: "Mensagem vazia: informe html ou text." };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        ...(input.html ? { html: input.html } : {}),
        ...(input.text ? { text: input.text } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!res.ok) {
      return {
        ok: false,
        error: data?.message ?? `Resend retornou ${res.status}`,
      };
    }

    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha de rede ao chamar a API do Resend.",
    };
  }
}

/**
 * Substitui variáveis no formato {{nome}} pelos valores fornecidos.
 * Variáveis sem valor correspondente permanecem como {{nome}} (visível,
 * útil para revisar templates antes de configurar todas as variáveis).
 */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    return key in vars ? vars[key] : match;
  });
}

/** Converte texto simples (com quebras de linha) em HTML básico para e-mail. */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escaped}</div>`;
}
