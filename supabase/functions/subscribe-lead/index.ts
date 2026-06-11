// FLORA ECOSYSTEM · Edge Function: subscribe-lead
// (deployada em 2026-06-11 via MCP — versão 1)
// Recebe inscrições da newsletter do storefront e grava em public.leads.
// Proteções: honeypot (campo 'website'), validação de e-mail, upsert idempotente.
// Turnstile (anti-bot da Cloudflare) entra na fase de deploy.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  try {
    const { email, name, tenant_slug, website } = await req.json();

    // honeypot: bots preenchem o campo oculto — fingimos sucesso
    if (website) return json({ ok: true });

    const e = String(email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e) || e.length > 200) {
      return json({ error: "e-mail inválido" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", String(tenant_slug ?? "flora-botanics"))
      .eq("status", "active")
      .maybeSingle();
    if (!tenant) return json({ error: "loja não encontrada" }, 400);

    const { error } = await admin.from("leads").upsert(
      {
        tenant_id: tenant.id,
        email: e,
        name: String(name ?? "").trim() || null,
        source: "newsletter",
        consent_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,email" }
    );
    if (error) return json({ error: "falha ao salvar" }, 500);

    return json({ ok: true });
  } catch {
    return json({ error: "requisição inválida" }, 400);
  }
});
