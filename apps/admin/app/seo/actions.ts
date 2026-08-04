"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

// ── Auth helper ────────────────────────────────────────────────────────────────
async function requireAdmin() {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autenticado");
  if (session.role === "tenant_editor") throw new Error("Sem permissão");
  return session;
}

// ════════════════════════════════════════════════════════════════════════════════
// SEO META — upsert nos campos seo jsonb de products, pages, categories
// ════════════════════════════════════════════════════════════════════════════════

export type SeoMeta = {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  twitter_card?: string;
  twitter_title?: string;
  twitter_description?: string;
  keywords?: string[];
  faq?: { q: string; a: string }[];
  schema_type?: string; // "Product" | "Article" | "FAQPage" | "Organization"
};

export type EntityType = "product" | "category" | "page" | "article";

export async function saveSeoMeta(
  entityType: EntityType,
  entityId: string,
  meta: SeoMeta,
) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const tableMap: Record<EntityType, string> = {
    product: "products",
    category: "categories",
    page: "pages",
    article: "blog_articles",
  };

  const table = tableMap[entityType];

  const { error } = await supabase
    .from(table)
    .update({ seo: meta })
    .eq("id", entityId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  revalidatePath("/seo");
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════════════════
// REDIRECTS
// ════════════════════════════════════════════════════════════════════════════════

export async function saveSeoRedirect(data: {
  id?: string;
  from_path: string;
  to_path: string;
  code?: number;
  reason?: string;
  active?: boolean;
}) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  if (data.id) {
    const { error } = await supabase
      .from("seo_redirects")
      .update({
        from_path: data.from_path,
        to_path: data.to_path,
        code: data.code ?? 301,
        reason: data.reason,
        active: data.active ?? true,
      })
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("seo_redirects").insert({
      tenant_id: tenantId,
      from_path: data.from_path,
      to_path: data.to_path,
      code: data.code ?? 301,
      reason: data.reason,
      active: data.active ?? true,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/seo/redirecionamentos");
  return { ok: true };
}

export async function deleteSeoRedirect(id: string) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("seo_redirects")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  revalidatePath("/seo/redirecionamentos");
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════════════════
// SITEMAP CONFIG
// ════════════════════════════════════════════════════════════════════════════════

export async function saveSitemapConfig(configs: {
  entity_type: string;
  included: boolean;
  priority: number;
  change_frequency: string;
}[]) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  for (const cfg of configs) {
    await supabase.from("seo_sitemap_config").upsert(
      { tenant_id: tenantId, ...cfg },
      { onConflict: "tenant_id,entity_type" },
    );
  }

  revalidatePath("/seo/sitemap");
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════════════════
// ROBOTS RULES
// ════════════════════════════════════════════════════════════════════════════════

export async function saveRobotsRule(data: {
  id?: string;
  user_agent: string;
  directive: "allow" | "disallow";
  path: string;
  sort_order?: number;
  active?: boolean;
}) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  if (data.id) {
    const { error } = await supabase
      .from("seo_robots_rules")
      .update({ ...data })
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("seo_robots_rules")
      .insert({ tenant_id: tenantId, ...data });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/seo/robots");
  return { ok: true };
}

export async function deleteRobotsRule(id: string) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  await supabase
    .from("seo_robots_rules")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  revalidatePath("/seo/robots");
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════════════════
// SEO AUDIT — analisa uma entidade e grava issues em seo_audits
// ════════════════════════════════════════════════════════════════════════════════

export type AuditIssue = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  field?: string;
};

function auditSeoMeta(seo: SeoMeta): AuditIssue[] {
  const issues: AuditIssue[] = [];

  const title = seo.title ?? "";
  const desc = seo.description ?? "";

  if (!title) {
    issues.push({ code: "missing_title", severity: "error", message: "Título SEO ausente", field: "title" });
  } else if (title.length < 30) {
    issues.push({ code: "short_title", severity: "warning", message: `Título muito curto (${title.length} chars — ideal 50-60)`, field: "title" });
  } else if (title.length > 70) {
    issues.push({ code: "long_title", severity: "warning", message: `Título muito longo (${title.length} chars — ideal ≤60)`, field: "title" });
  }

  if (!desc) {
    issues.push({ code: "missing_description", severity: "error", message: "Meta description ausente", field: "description" });
  } else if (desc.length < 100) {
    issues.push({ code: "short_description", severity: "warning", message: `Description muito curta (${desc.length} chars — ideal 140-160)`, field: "description" });
  } else if (desc.length > 170) {
    issues.push({ code: "long_description", severity: "warning", message: `Description muito longa (${desc.length} chars — ideal ≤160)`, field: "description" });
  }

  if (!seo.og_title && !title) {
    issues.push({ code: "missing_og_title", severity: "info", message: "og:title ausente — usará o título da página", field: "og_title" });
  }

  if (!seo.og_image) {
    issues.push({ code: "missing_og_image", severity: "warning", message: "og:image ausente — compartilhamentos não terão imagem", field: "og_image" });
  }

  if (!seo.canonical) {
    issues.push({ code: "missing_canonical", severity: "info", message: "URL canônica não configurada — será gerada automaticamente" });
  }

  if (!seo.keywords || seo.keywords.length === 0) {
    issues.push({ code: "no_keywords", severity: "info", message: "Nenhuma palavra-chave associada", field: "keywords" });
  }

  return issues;
}

function scoreFromIssues(issues: AuditIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "error") score -= 20;
    else if (issue.severity === "warning") score -= 8;
    else score -= 2;
  }
  return Math.max(0, score);
}

export async function runSeoAudit(entityType: EntityType, entityId: string) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const tableMap: Record<EntityType, string> = {
    product: "products",
    category: "categories",
    page: "pages",
    article: "blog_articles",
  };

  const { data: row } = await supabase
    .from(tableMap[entityType])
    .select("seo")
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .single();

  const seo = (row?.seo ?? {}) as SeoMeta;
  const issues = auditSeoMeta(seo);
  const score = scoreFromIssues(issues);

  await supabase.from("seo_audits").insert({
    tenant_id: tenantId,
    entity_type: entityType,
    entity_id: entityId,
    issues,
    score,
  });

  revalidatePath("/seo/auditoria");
  return { ok: true, score, issues };
}

export async function runSeoAuditBulk(entityType: EntityType) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const tableMap: Record<EntityType, string> = {
    product: "products",
    category: "categories",
    page: "pages",
    article: "blog_articles",
  };

  const { data: rows } = await supabase
    .from(tableMap[entityType])
    .select("id, seo")
    .eq("tenant_id", tenantId)
    .limit(200);

  const results = [];
  for (const row of rows ?? []) {
    const seo = (row.seo ?? {}) as SeoMeta;
    const issues = auditSeoMeta(seo);
    const score = scoreFromIssues(issues);
    results.push({ entity_type: entityType, entity_id: row.id, issues, score, tenant_id: tenantId });
  }

  if (results.length > 0) {
    await supabase.from("seo_audits").insert(results);
  }

  revalidatePath("/seo/auditoria");
  return { ok: true, audited: results.length };
}

// ════════════════════════════════════════════════════════════════════════════════
// AI VISIBILITY — avalia potencial de aparição em respostas de IA
// ════════════════════════════════════════════════════════════════════════════════

function computeAiScore(row: {
  seo?: SeoMeta | null;
  faq?: unknown[] | null;
  body_rich?: unknown;
  author_name?: string | null;
  published_at?: string | null;
}): { score: number; breakdown: Record<string, boolean | number> } {
  const seo = row.seo ?? {};
  const hasFaq    = Array.isArray(row.faq) && row.faq.length > 0;
  const hasSchema = !!(seo as SeoMeta).schema_type;
  const hasBody   = !!row.body_rich;
  const hasEntities = Array.isArray((seo as SeoMeta).keywords) && ((seo as SeoMeta).keywords?.length ?? 0) > 0;
  const hasAuthor = !!row.author_name;

  let score = 0;
  if (hasFaq)      score += 25;
  if (hasSchema)   score += 20;
  if (hasBody)     score += 20;
  if (hasEntities) score += 20;
  if (hasAuthor)   score += 15;

  return {
    score,
    breakdown: { hasFaq, hasSchema, hasBody, hasEntities, hasAuthor },
  };
}

// Bulk: calcula todos de um tipo em uma única invocação (sem loop de subrequests)
export async function runAiVisibilityScoreBulk(entityType: EntityType) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const tableMap: Record<EntityType, { table: string; cols: string }> = {
    product:  { table: "products",      cols: "id,seo,faq" },
    category: { table: "categories",    cols: "id,seo,faq" },
    page:     { table: "pages",         cols: "id,seo" },
    article:  { table: "blog_articles", cols: "id,seo,faq,body_rich,author_name,published_at" },
  };

  const { table, cols } = tableMap[entityType];
  const { data: rows } = await supabase
    .from(table)
    .select(cols)
    .eq("tenant_id", tenantId)
    .limit(200);

  if (!rows || rows.length === 0) return { ok: true, scored: 0 };

  const records = (rows as unknown as Record<string, unknown>[]).map((row) => {
    const { score, breakdown } = computeAiScore(row as Parameters<typeof computeAiScore>[0]);
    return {
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: row.id as string,
      ai_score: score,
      has_faq:       !!(breakdown.hasFaq),
      has_schema:    !!(breakdown.hasSchema),
      has_rich_body: !!(breakdown.hasBody),
      has_entities:  !!(breakdown.hasEntities),
      has_author:    !!(breakdown.hasAuthor),
      feedback: breakdown,
    };
  });

  // Único upsert em batch — sem loop, sem subrequests extras
  await supabase
    .from("seo_ai_scores")
    .upsert(records, { onConflict: "tenant_id,entity_type,entity_id" });

  revalidatePath("/seo/ai-visibility");
  return { ok: true, scored: records.length };
}

export async function runAiVisibilityScore(entityType: EntityType, entityId: string) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const tableMap: Record<EntityType, { table: string; cols: string }> = {
    product: { table: "products", cols: "id,seo,faq" },
    category: { table: "categories", cols: "id,seo,faq" },
    page: { table: "pages", cols: "id,seo" },
    article: { table: "blog_articles", cols: "id,seo,faq,body_rich,author_name,published_at" },
  };

  const { table, cols } = tableMap[entityType];
  const { data: row } = await supabase
    .from(table)
    .select(cols)
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .single();

  const { score, breakdown } = computeAiScore((row ?? {}) as Parameters<typeof computeAiScore>[0]);

  await supabase.from("seo_ai_scores").upsert(
    {
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      ai_score: score,
      has_faq: !!(breakdown.hasFaq),
      has_schema: !!(breakdown.hasSchema),
      has_rich_body: !!(breakdown.hasBody),
      has_entities: !!(breakdown.hasEntities),
      has_author: !!(breakdown.hasAuthor),
      feedback: breakdown,
    },
    { onConflict: "tenant_id,entity_type,entity_id" },
  );

  return { ok: true, score, breakdown };
}

// ════════════════════════════════════════════════════════════════════════════════
// AI — Gerar sugestões de meta via Anthropic Claude API
// ════════════════════════════════════════════════════════════════════════════════

export async function generateSeoWithAI(context: {
  entityType: EntityType;
  name: string;
  description?: string;
  keywords?: string[];
  category?: string;
}) {
  await requireAdmin();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const systemPrompt = `Você é um especialista em SEO para e-commerce de cosméticos e produtos naturais.
Gere meta tags otimizadas para a Flora Botanics, uma marca brasileira de cosméticos naturais.
Responda APENAS com JSON válido, sem texto adicional, sem markdown, sem code blocks.`;

  const userPrompt = `Entidade: ${context.entityType}
Nome: ${context.name}
${context.description ? `Descrição: ${context.description}` : ""}
${context.category ? `Categoria: ${context.category}` : ""}
${context.keywords?.length ? `Palavras-chave existentes: ${context.keywords.join(", ")}` : ""}

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
  const timeout = setTimeout(() => controller.abort(), 25000); // 25s — dentro do limite de 30s do Worker

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
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
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString());
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const json = await res.json() as { content: { type: string; text: string }[] };
  const text = json.content?.[0]?.text ?? "{}";

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta da IA não contém JSON válido");

  return JSON.parse(match[0]) as SeoMeta & { faq?: { q: string; a: string }[] };
}

// ════════════════════════════════════════════════════════════════════════════════
// BLOG ARTICLES — CRUD
// ════════════════════════════════════════════════════════════════════════════════

export async function saveBlogArticle(data: {
  id?: string;
  title: string;
  slug: string;
  subtitle?: string;
  excerpt?: string;
  body_rich?: unknown;
  category_id?: string | null;
  status?: "draft" | "published" | "archived";
  keywords?: string[];
  seo?: SeoMeta;
  faq?: { q: string; a: string }[];
  author_name?: string;
  author_role?: string;
  published_at?: string | null;
  reading_time_min?: number;
}) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const payload = {
    tenant_id: tenantId,
    title: data.title,
    slug: data.slug,
    subtitle: data.subtitle,
    excerpt: data.excerpt,
    body_rich: data.body_rich,
    category_id: data.category_id ?? null,
    status: data.status ?? "draft",
    keywords: data.keywords ?? [],
    seo: data.seo ?? {},
    faq: data.faq ?? [],
    author_name: data.author_name,
    author_role: data.author_role,
    published_at: data.published_at ?? null,
    reading_time_min: data.reading_time_min ?? null,
  };

  if (data.id) {
    const { error } = await supabase
      .from("blog_articles")
      .update(payload)
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("blog_articles")
      .insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/seo/blog");
  revalidatePath("/cms/blog");
  return { ok: true };
}

export async function deleteBlogArticle(id: string) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("blog_articles")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  revalidatePath("/seo/blog");
  return { ok: true };
}

export async function saveBlogCategory(data: {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  seo?: SeoMeta;
  sort_order?: number;
}) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const payload = {
    tenant_id: tenantId,
    name: data.name,
    slug: data.slug,
    description: data.description,
    seo: data.seo ?? {},
    sort_order: data.sort_order ?? 0,
  };

  if (data.id) {
    await supabase.from("blog_categories").update(payload).eq("id", data.id).eq("tenant_id", tenantId);
  } else {
    await supabase.from("blog_categories").insert(payload);
  }

  revalidatePath("/seo/blog");
  return { ok: true };
}

export async function deleteBlogCategory(id: string) {
  await requireAdmin();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("blog_categories")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  revalidatePath("/seo/blog");
  return { ok: true };
}
