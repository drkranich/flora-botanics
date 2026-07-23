import { NextRequest, NextResponse } from "next/server";
import { currentTenant, db } from "@/lib/tenant";

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase().slice(0, 180);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: unknown; name?: unknown } | null;
    const email = cleanEmail(body?.email);
    const name = String(body?.name ?? "").trim().slice(0, 120) || null;

    if (!validEmail(email)) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }

    const tenant = await currentTenant();
    const client = db();
    const { error } = await client.from("leads").insert({
      tenant_id: tenant.tenantId,
      email,
      name,
      source: "newsletter",
      consent_at: new Date().toISOString(),
      tags: ["newsletter", "site-publico"],
    });

    if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao cadastrar e-mail." },
      { status: 500 }
    );
  }
}
