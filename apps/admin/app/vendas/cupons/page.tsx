import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { SalesTabs } from "../Tabs";
import { CouponManager } from "./CouponManager";

export default async function CouponsPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, code, type, value, min_subtotal_cents, used_count, max_uses, ends_at, status")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Vendas</h1>
      </header>

      <SalesTabs />

      <CouponManager initial={coupons ?? []} />
    </main>
  );
}
