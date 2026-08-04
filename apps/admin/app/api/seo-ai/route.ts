import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/supabase/server";

const systemPrompt = `Você é um especialista em SEO para e-commerce de cosméticos e produtos naturais.
Gere meta tags otimizadas para a Flora Botanics, uma marca brasileira de cosméticos naturais.
Responda APENAS com JSON válido, sem texto adicional, sem markdown, sem code blocks.`;

export async function POST(req: NextRequest) {
  // Auth
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (session.role === "tenant_editor") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });

  const body = await req.json() as {
    entityType: string;
    name: string;
    description?: string;
    keywords?: string[];
    category?: string;
  };

  const userPrompt = `Entidade: ${body.entityType}
Nome: ${body.name}
${body.description ? `Descrição: ${body.description}` : ""}
${body.category ? `Categoria: ${body.category}` : ""}
${body.keywords?.length ? `Palavras-chave existentes: ${body.keywords.join(", ")}` : ""}

Gere um JSON com exatamente estes campos:
{
  "title": "título SEO (50-60 chars, inclua a palavra-chave principal e 'Flora Botanics')",
  "description": "meta description (140-160 chars, inclua CTA, benefício e palavra-chave)",
  "og_title": "título para redes sociais (pode ser mais longo e persuasivo)",
  "og_description": "descrição para redes sociais",
  "keywords": ["palavra1", "palavra2", "até 8 palavras-chave"],
  "faq": [
    {"q": "pergunta relevante sobre o produto", "a": "resposta detalhada"},
    {"q": "segunda pergunta", "a": "resposta"}
  ]
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.status.toString());
      return NextResponse.json({ error: `Anthropic API error ${res.status}: ${err}` }, { status: 502 });
    }

    const json = await res.json() as { content: { type: string; text: string }[] };
    const text = json.content?.[0]?.text ?? "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "Resposta da IA não contém JSON válido" }, { status: 502 });

    return NextResponse.json(JSON.parse(match[0]));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: msg.includes("abort") ? "Tempo esgotado (>25s). Tente novamente." : msg }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
