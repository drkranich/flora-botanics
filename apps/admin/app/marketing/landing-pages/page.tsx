import { redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStorefrontUrl } from "@/lib/storefront-url";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { LandingPageStudio, type LandingPageRow } from "./LandingPageStudio";

type CampaignRow = {
  id: string;
  title: string;
};

export default async function MarketingLandingPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const { edit } = await searchParams;
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: pages, error: pagesError }, { data: campaigns, error: campaignsError }] = await Promise.all([
    supabase
      .from("marketing_landing_pages")
      .select("id, campaign_id, slug, title, template_key, content, seo, utm, status, publish_at, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("campaigns")
      .select("id, title")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  if (pagesError || campaignsError) {
    return (
      <main style={{ padding: "32px 28px 80px", display: "grid", gap: 18 }}>
        <section
          className="glass"
          style={{
            padding: 24,
            borderColor: "rgba(232, 160, 160, 0.45)",
            background: "rgba(232, 160, 160, 0.08)",
          }}
        >
          <p className="eyebrow" style={{ color: "#e8a0a0", marginBottom: 8 }}>
            Migration pendente
          </p>
          <h1 className="display" style={{ fontSize: 34, marginBottom: 10 }}>
            Landing pages indisponíveis
          </h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            A tabela de marketing ainda não está acessível para este tenant. Aplique a fundação de
            Marketing e Relacionamento e recarregue a página.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={{ padding: "32px 28px 80px", display: "grid", gap: 18 }}>
      <LandingPageStudio
        pages={(pages ?? []) as LandingPageRow[]}
        campaigns={(campaigns ?? []) as CampaignRow[]}
        publicBaseUrl={getStorefrontUrl()}
        initialPageId={edit ?? null}
      />
    </main>
  );
}
