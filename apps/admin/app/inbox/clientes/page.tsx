import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { ClientesTable, type CustomerRow } from "./ClientesTable";

export default async function InboxClientesPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const supabase = await createClient();

  const { data, count } = await supabase
    .from("customers")
    .select(
      "id, full_name, email, phone, whatsapp, birthday, notes, tags, accepts_marketing, archived_at",
      { count: "exact" }
    )
    .eq("tenant_id", staff.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  const customers = (data ?? []) as CustomerRow[];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #080f09 0%, #0c1a0e 50%, #091208 100%)",
      color: "var(--cream)",
      fontFamily: "Manrope, sans-serif",
    }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,22,11,0.85)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
        padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Link href="/inbox" style={{ fontSize: 11.5, color: "var(--cream-dim)", textDecoration: "none", fontWeight: 500 }}>
          ← Voltar ao inbox
        </Link>
        <span style={{ color: "rgba(242,236,223,0.2)" }}>|</span>
        <span style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, color: "var(--cream)", letterSpacing: -0.4 }}>
          Clientes
        </span>
        {count !== null && (
          <span style={{ fontSize: 10, color: "var(--cream-dim)", background: "rgba(242,236,223,0.06)", border: "1px solid rgba(242,236,223,0.1)", borderRadius: 5, padding: "2px 8px" }}>
            {count} cliente{count !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div style={{ padding: "24px 28px 48px" }}>
        <ClientesTable customers={customers} totalCount={count ?? customers.length} />
      </div>
    </div>
  );
}
