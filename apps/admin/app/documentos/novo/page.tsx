/**
 * /documentos/novo — Criar novo documento comercial
 * Reutiliza CommercialQuoteForm (Server Action createCommercialQuote) do /financeiro
 */
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { CommercialQuoteForm } from "../../financeiro/CommercialQuoteForm";
import type { GlassSelectOption } from "@/components/GlassSelect";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NovoDocumentoPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/documentos");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: calcs } = await supabase
    .from("finance_calculations")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80);

  const calculations: GlassSelectOption[] = (calcs ?? []).map((c) => ({
    value: c.id,
    label: c.name ?? c.id,
  }));

  return (
    <div style={{ maxWidth: 780 }}>
      <nav style={{ fontSize: 12, color: "var(--color-muted, #8a9580)", marginBottom: 20, display: "flex", gap: 8, alignItems: "center" }}>
        <Link href="/documentos" style={{ color: "inherit", textDecoration: "none" }}>Documentos</Link>
        <span>/</span>
        <span style={{ color: "var(--color-text, #e8e3d9)" }}>Novo documento</span>
      </nav>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-heading, #f1ede5)", marginBottom: 24 }}>
        Novo documento comercial
      </h1>

      <div className="glass" style={{ padding: 24, borderRadius: 12 }}>
        <CommercialQuoteForm calculations={calculations} />
      </div>
    </div>
  );
}
