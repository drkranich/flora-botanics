/**
 * Integração com a API do Resend (envio de e-mail transacional).
 *
 * Variáveis de ambiente (configuradas como Secrets do Worker `flora-admin`
 * via `wrangler secret put` ou no Dashboard da Cloudflare):
 *   - RESEND_API_KEY      -> chave de API do Resend (obrigatória)
 *   - RESEND_FROM_EMAIL   -> remetente, ex: "Flora Botanics <contato@florabotanics.com.br>"
 *   - RESEND_WEBHOOK_SECRET -> usado pelo webhook de e-mails recebidos (fase 2)
 *
 * IMPORTANTE: no opennextjs-cloudflare, Secrets e Vars do Worker NÃO ficam
 * disponíveis em process.env. É necessário usar getCloudflareContext() da
 * própria lib para acessá-los em runtime. process.env serve de fallback para
 * desenvolvimento local via `next dev` com .env.local.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

const RESEND_API_URL = "https://api.resend.com/emails";
const LEGACY_FROM_DOMAIN = "florabotanics.com";
const VERIFIED_FROM_DOMAIN = "florabotanics.com.br";

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

function normalizeFromEmail(from: string): string {
  return from.replace(
    new RegExp(`@${LEGACY_FROM_DOMAIN.replace(".", "\\.")}(?=[>\\s]|$)`, "i"),
    `@${VERIFIED_FROM_DOMAIN}`
  );
}

function formatResendError(message: string | undefined, status: number): string {
  const fallback = `Resend retornou ${status}`;
  const error = message ?? fallback;

  if (/domain is not verified|add and verify your domain/i.test(error)) {
    return `O remetente RESEND_FROM_EMAIL usa um domínio não verificado no Resend. Use "Flora Botanics <contato@${VERIFIED_FROM_DOMAIN}>" ou outro e-mail do dominio ${VERIFIED_FROM_DOMAIN} ja verificado.`;
  }

  return error;
}

/**
 * Lê RESEND_API_KEY e RESEND_FROM_EMAIL do contexto do Worker em runtime.
 * Tenta getCloudflareContext primeiro (produção / wrangler dev); cai em
 * process.env como fallback para `next dev` local.
 */
async function getResendEnv(): Promise<{ apiKey: string; from: string } | null> {
  // Tentativa 1: contexto do Worker (Cloudflare runtime)
  try {
    const { env } = await getCloudflareContext({ async: true });
    const apiKey = (env as Record<string, string>).RESEND_API_KEY;
    const from = (env as Record<string, string>).RESEND_FROM_EMAIL;
    if (apiKey && from) return { apiKey, from: normalizeFromEmail(from) };
  } catch {
    // getCloudflareContext lança fora do Worker (ex: next dev puro)
  }

  // Tentativa 2: process.env (desenvolvimento local com .env.local)
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (apiKey && from) return { apiKey, from: normalizeFromEmail(from) };

  return null;
}

/**
 * Indica se as variáveis necessárias para enviar e-mail via Resend
 * estão configuradas no ambiente atual. É async porque precisa consultar
 * o contexto do Worker em runtime.
 */
export async function isResendConfigured(): Promise<boolean> {
  return (await getResendEnv()) !== null;
}

/**
 * Envia um e-mail via Resend. Retorna { ok: false, error } em qualquer
 * falha (configuração ausente, erro de rede, erro retornado pela API)
 * para que a UI possa mostrar uma mensagem clara em vez de quebrar.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resendEnv = await getResendEnv();

  if (!resendEnv) {
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
        Authorization: `Bearer ${resendEnv.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendEnv.from,
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
        error: formatResendError(data?.message, res.status),
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
 * Variáveis sem valor correspondente permanecem como {{nome}}.
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
