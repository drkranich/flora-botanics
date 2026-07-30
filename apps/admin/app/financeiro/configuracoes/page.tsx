/**
 * /financeiro/configuracoes — Configurações do motor financeiro
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { FinanceSettingsForm, type FinanceSettingsData } from "../FinanceSettingsForm";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesFinanceiroPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const supabase = await supabaseServer();
  const { data: settings } = await supabase
    .from("finance_settings")
    .select("target_margin_percent, minimum_margin_percent, default_tax_percent, default_payment_fee_percent, default_payment_fixed_cents, default_logistics_percent, default_overhead_percent, rules")
    .eq("tenant_id", session.tenantId)
    .maybeSingle();

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 28px 80px" }}>
      <nav style={{ fontSize: 13, color: "var(--cream-dim, #a09880)", marginBottom: 20, display: "flex", gap: 8 }}>
        <Link href="/financeiro" style={{ color: "inherit", textDecoration: "none" }}>Financeiro</Link>
        <span>/</span>
        <span style={{ color: "var(--color-heading, #f1ede5)" }}>Configurações</span>
      </nav>
      <header style={{ marginBottom: 28 }}>
        <h1 className="display" style={{ fontSize: 38 }}>Configurações Financeiras</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Margem alvo, impostos padrão, taxas de pagamento e overhead. Usados como base nos cenários de precificação.
        </p>
      </header>

      <FinanceSettingsForm settings={settings as FinanceSettingsData | null} />
    </main>
  );
}
