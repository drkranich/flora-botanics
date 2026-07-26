import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { effectiveTenantId } from "@/lib/cms/actions";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { deleteCampaign, updateCampaign } from "../actions";
import { CampaignForm, type CampaignFormValues } from "../CampaignForm";

export default async function CampanhaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const { id } = await params;
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!campaign) notFound();

  const updateAction = updateCampaign.bind(null, campaign.id);
  const deleteAction = deleteCampaign.bind(null, campaign.id);

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/vendas/campanhas" className="eyebrow" style={{ opacity: 0.8 }}>← Campanhas</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>{campaign.title}</h1>
      </header>

      <CampaignForm action={updateAction} values={campaign as CampaignFormValues} submitLabel="Salvar campanha" />

      <form action={deleteAction} className="glass" style={{ marginTop: 16, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Exclua apenas campanhas criadas por engano. O histórico de métricas será removido desta visão.
        </p>
        <button type="submit" className="btn btn-ghost" style={{ color: "#e8a0a0", borderColor: "rgba(232,160,160,0.4)" }}>
          Excluir
        </button>
      </form>
    </main>
  );
}
