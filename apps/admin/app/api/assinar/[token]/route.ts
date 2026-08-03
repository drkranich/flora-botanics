/**
 * POST /api/assinar/[token]
 *
 * Endpoint público (sem auth de sessão) que recebe a assinatura do cliente e
 * grava na tabela document_signatures via service_role (bypassa RLS).
 * Após salvar, envia e-mail de confirmação ao signatário e notificação interna
 * via Resend.
 *
 * Body: { sigId, name, email, signatureImage (base64 PNG) }
 */
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Service role — necessário pois anônimo não pode fazer UPDATE via RLS
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars ausentes.");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Lê env com suporte a Cloudflare Workers runtime
async function getEnv(): Promise<Record<string, string | undefined>> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as Record<string, string | undefined>;
  } catch {
    return process.env;
  }
}

// Envia e-mail via Resend API diretamente (sem SDK — compatível com CF Workers)
async function sendSignatureEmail(opts: {
  resendKey: string;
  fromEmail: string;
  signerName: string;
  signerEmail: string;
  docTitle: string;
  docNumber: string | null;
  signedAt: string;
  adminEmail: string | null;
  adminUrl: string;
}) {
  const {
    resendKey, fromEmail,
    signerName, signerEmail,
    docTitle, docNumber, signedAt,
    adminEmail, adminUrl,
  } = opts;

  const formattedDate = new Date(signedAt).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const docLabel = docNumber ? `${docTitle} #${docNumber}` : docTitle;

  // E-mail para o signatário
  const signerHtml = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #faf7f2; padding: 40px 36px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="font-size: 28px; font-weight: 700; letter-spacing: -0.5px; color: #1a2e1b;">Flora Botanics</div>
        <div style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #7a8a7b; margin-top: 4px;">Confirmação de Assinatura</div>
      </div>
      <p style="color: #2d3e2e; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Olá, <strong>${signerName}</strong>.</p>
      <p style="color: #2d3e2e; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Sua assinatura digital foi registrada com sucesso no seguinte documento:
      </p>
      <div style="background: #fff; border: 1px solid #d4c9a8; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px;">
        <div style="font-size: 16px; font-weight: 700; color: #1a2e1b; margin-bottom: 6px;">${docLabel}</div>
        <div style="font-size: 13px; color: #7a8a7b;">Assinado em: ${formattedDate} (horário de Brasília)</div>
      </div>
      <p style="color: #5a6b5b; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
        Este e-mail serve como comprovante da sua assinatura digital. Guarde-o para seus registros.
      </p>
      <hr style="border: none; border-top: 1px solid #e0d9c8; margin: 32px 0;" />
      <p style="color: #9a9a8a; font-size: 11px; text-align: center; margin: 0;">
        Flora Botanics · contato@florabotanics.com.br
      </p>
    </div>
  `;

  // Notificação interna para o admin
  const adminHtml = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #0c1a0e; padding: 40px 36px; border-radius: 12px; color: #f2ecdf;">
      <div style="font-size: 20px; font-weight: 700; color: #d9b87a; margin-bottom: 6px;">✦ Documento Assinado</div>
      <div style="font-size: 12px; color: rgba(242,236,223,0.5); margin-bottom: 28px; letter-spacing: 1px; text-transform: uppercase;">Notificação interna Flora Botanics</div>
      <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(242,236,223,0.1); border-radius: 10px; padding: 20px 24px; margin-bottom: 20px;">
        <div style="font-size: 15px; font-weight: 700; color: #f2ecdf; margin-bottom: 10px;">${docLabel}</div>
        <div style="font-size: 13px; color: rgba(242,236,223,0.65); margin-bottom: 6px;">Signatário: <strong style="color:#d9b87a;">${signerName}</strong> &lt;${signerEmail}&gt;</div>
        <div style="font-size: 13px; color: rgba(242,236,223,0.65);">Data: ${formattedDate}</div>
      </div>
      <a href="${adminUrl}" style="display: inline-block; background: linear-gradient(135deg, #d9b87a, #b9924d); color: #0c1a0e; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">
        Ver documento no admin →
      </a>
    </div>
  `;

  const sends = [
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [signerEmail],
        subject: `✦ Confirmação de assinatura — ${docLabel}`,
        html: signerHtml,
      }),
    }),
  ];

  if (adminEmail) {
    sends.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [adminEmail],
          subject: `[Assinatura] ${docLabel} — ${signerName}`,
          html: adminHtml,
        }),
      })
    );
  }

  await Promise.allSettled(sends);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json() as {
      sigId?: string;
      name?: string;
      email?: string;
      signatureImage?: string;
    };

    const { sigId, name, email, signatureImage } = body;

    // Validações básicas
    if (!sigId || !name?.trim() || !email?.trim() || !signatureImage) {
      return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }

    const supabase = serviceClient();

    // Verifica se o registro existe, está pending e não expirou
    const { data: sig } = await supabase
      .from("document_signatures")
      .select("id, status, expires_at, public_token")
      .eq("id", sigId)
      .eq("public_token", token)   // dupla verificação: id + token
      .maybeSingle();

    if (!sig) {
      return NextResponse.json({ error: "Registro de assinatura não encontrado." }, { status: 404 });
    }
    if (sig.status !== "pending") {
      return NextResponse.json({ error: "Este documento já foi assinado ou rejeitado." }, { status: 409 });
    }
    if (new Date(sig.expires_at as string) < new Date()) {
      return NextResponse.json({ error: "Link de assinatura expirado." }, { status: 410 });
    }

    // Captura IP do signatário
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = request.headers.get("user-agent") ?? "";

    // Salva a imagem da assinatura no bucket 'signatures'
    let signatureImagePath: string | null = null;
    try {
      const base64Data = signatureImage.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const filePath = `signatures/${sigId}/assinatura.png`;

      const { error: uploadErr } = await supabase.storage
        .from("signatures")
        .upload(filePath, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (!uploadErr) signatureImagePath = filePath;
    } catch {
      // Falha no upload não bloqueia o registro
    }

    // Atualiza o registro com os dados da assinatura
    const { error: updateErr } = await supabase
      .from("document_signatures")
      .update({
        status: "signed",
        signer_name: name.trim(),
        signer_email: email.trim().toLowerCase(),
        signer_ip: ip,
        user_agent: userAgent,
        signed_at: new Date().toISOString(),
        method: "canvas",
        signature_image_path: signatureImagePath,
      })
      .eq("id", sigId);

    if (updateErr) {
      console.error("[assinar] update error:", updateErr);
      return NextResponse.json({ error: "Erro ao registrar assinatura." }, { status: 500 });
    }

    // ── Envio de e-mail de confirmação (fire-and-forget) ─────────────────────
    void (async () => {
      try {
        const env = await getEnv();
        const resendKey  = env.RESEND_API_KEY ?? "";
        const fromEmail  = env.RESEND_FROM_EMAIL ?? "no-reply@florabotanics.com.br";
        const adminEmail = env.ADMIN_NOTIFICATION_EMAIL ?? null;
        const baseUrl    = env.NEXT_PUBLIC_ADMIN_URL ?? "https://admin.florabotanics.com.br";

        if (!resendKey) return;

        // Busca dados do documento associado
        const { data: fullSig } = await supabase
          .from("document_signatures")
          .select("quote_id, signer_name, signer_email, signed_at")
          .eq("id", sigId)
          .maybeSingle();

        if (!fullSig?.quote_id) return;

        const { data: doc } = await supabase
          .from("commercial_quotes")
          .select("title, quote_number")
          .eq("id", fullSig.quote_id)
          .maybeSingle();

        await sendSignatureEmail({
          resendKey,
          fromEmail,
          signerName:  fullSig.signer_name ?? name.trim(),
          signerEmail: fullSig.signer_email ?? email.trim(),
          docTitle:    (doc as { title?: string } | null)?.title ?? "Documento",
          docNumber:   (doc as { quote_number?: string } | null)?.quote_number ?? null,
          signedAt:    (fullSig.signed_at as string) ?? new Date().toISOString(),
          adminEmail,
          adminUrl:    `${baseUrl}/documentos/${fullSig.quote_id}`,
        });
      } catch (e) {
        console.warn("[assinar] falha ao enviar e-mail:", e);
      }
    })();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[assinar] unexpected error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
