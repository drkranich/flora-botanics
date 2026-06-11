import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { SalesTabs, StatusChip, money } from "./Tabs";

export default async function OrdersPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, number, status, total_cents, currency, created_at, customers(email, full_name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Vendas</h1>
      </header>

      <SalesTabs />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(orders ?? []).map((o, i) => {
          const customer = o.customers as unknown as { email: string; full_name: string | null } | null;
          return (
            <Link key={o.id} href={`/vendas/${o.id}`}>
              <div
                className={`glass glass-hover rise rise-${Math.min(i + 1, 4)}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  padding: "18px 24px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong style={{ fontSize: 15 }}>Pedido #{o.number}</strong>
                  <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                    {customer?.full_name ?? customer?.email ?? "—"} ·{" "}
                    {new Date(o.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <strong style={{ fontSize: 14, color: "var(--gold-light)" }}>
                    {money(o.total_cents, o.currency)}
                  </strong>
                  <StatusChip status={o.status} />
                </div>
              </div>
            </Link>
          );
        })}
        {(orders ?? []).length === 0 ? (
          <div className="glass rise" style={{ padding: "44px 28px", textAlign: "center" }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>Nenhum pedido ainda</p>
            <p className="muted" style={{ fontSize: 12 }}>
              Os pedidos aparecerão aqui automaticamente assim que o checkout
              Stripe entrar no ar — próxima etapa do roadmap.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
