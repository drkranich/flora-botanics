import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cep = req.nextUrl.searchParams.get("cep")?.replace(/\D/g, "") ?? "";
  if (cep.length !== 8) {
    return NextResponse.json({ ok: false, error: "CEP inválido." }, { status: 400 });
  }
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error("ViaCEP indisponível");
    const data = (await res.json()) as Record<string, string>;
    if (data.erro) {
      return NextResponse.json({ ok: false, error: "CEP não encontrado." }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      street: data.logradouro ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao consultar CEP." }, { status: 502 });
  }
}
