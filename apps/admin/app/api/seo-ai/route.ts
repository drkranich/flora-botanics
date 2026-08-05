import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/supabase/server";

const systemPrompt = `Você é um especialista em SEO para e-commerce de cosméticos e produtos naturais.
Gere meta tags otimizadas para a Flora Botanics, uma marca brasileira de cosméticos naturais.
Responda APENAS com JSON válido, sem texto adicional, sem markdown, sem code blocks.`;

export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (session.role === "tenant_editor") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });

  const body = await req.json() as {
    entityType: string;
    name: string;
    description?: string;
    keywords?: string[];
    category?: string;
  };

  const userPrompt = `${systemPrompt}

Entidade: ${body.entityType}
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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
        }),
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let friendlyError = `Gemini API error ${res.status}`;
      if (res.status === 429) {
        friendlyError = "Cota da API de IA atingida. Tente novamente em alguns minutos.";
      } else if (res.status === 401 || res.status === 403) {
        friendlyError = "Chave de API inválida ou sem permissão.";
      } else {
        try {
          const errJson = JSON.parse(errText) as { error?: { message?: string } };
          if (errJson?.error?.message) friendlyError = errJson.error.message;
        } catch { /* keep default */ }
      }
      return NextResponse.json({ error: friendlyError }, { status: 502 });
    }

    const json = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
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
