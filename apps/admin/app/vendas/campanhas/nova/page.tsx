import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/supabase/server";
import { createCampaign } from "../actions";
import { CampaignForm } from "../CampaignForm";

export default async function NovaCampanhaPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/vendas/campanhas" className="eyebrow" style={{ opacity: 0.8 }}>← Campanhas</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Nova campanha</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Cadastre campanhas para acompanhar canal, orçamento, período, público e resultado em vendas.
        </p>
      </header>

      <CampaignForm action={createCampaign} submitLabel="Criar campanha" />
    </main>
  );
}
