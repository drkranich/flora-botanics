import type { MetadataRoute } from "next";
import { currentSiteUrl } from "@/lib/seo";
import { currentTenant, db } from "@/lib/tenant";

export const revalidate = 3600;

type RobotsRule = {
  user_agent: string;
  directive: "allow" | "disallow";
  path: string;
  sort_order: number;
};

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await currentSiteUrl();

  // Tenta ler regras customizadas do banco — se falhar usa default
  let customRules: RobotsRule[] = [];
  try {
    const tenant = await currentTenant();
    const client = db();
    const { data } = await client
      .from("seo_robots_rules")
      .select("user_agent, directive, path, sort_order")
      .eq("tenant_id", tenant.tenantId)
      .eq("active", true)
      .order("sort_order");
    customRules = (data ?? []) as RobotsRule[];
  } catch {
    // silencioso — usa regras padrão
  }

  // Agrupa por user_agent
  const agentMap = new Map<string, { allow: string[]; disallow: string[] }>();

  // Regras padrão sempre presentes
  const defaultDisallow = ["/api/", "/admin/", "/checkout", "/conta", "/carrinho", "/favoritos"];
  if (!agentMap.has("*")) agentMap.set("*", { allow: ["/"], disallow: [] });
  const defaultEntry = agentMap.get("*")!;
  for (const p of defaultDisallow) {
    if (!defaultEntry.disallow.includes(p)) defaultEntry.disallow.push(p);
  }

  // Aplica regras customizadas (sobrepõem as padrão se conflitarem)
  for (const rule of customRules.sort((a, b) => a.sort_order - b.sort_order)) {
    if (!agentMap.has(rule.user_agent)) {
      agentMap.set(rule.user_agent, { allow: [], disallow: [] });
    }
    const entry = agentMap.get(rule.user_agent)!;
    if (rule.directive === "allow") {
      if (!entry.allow.includes(rule.path)) entry.allow.push(rule.path);
    } else {
      if (!entry.disallow.includes(rule.path)) entry.disallow.push(rule.path);
    }
  }

  const rules: MetadataRoute.Robots["rules"] = Array.from(agentMap.entries()).map(
    ([userAgent, { allow, disallow }]) => ({
      userAgent,
      ...(allow.length ? { allow } : {}),
      ...(disallow.length ? { disallow } : {}),
    }),
  );

  return {
    rules,
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
