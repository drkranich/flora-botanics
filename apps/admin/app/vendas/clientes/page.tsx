import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { SalesTabs } from "../Tabs";

export default async function CustomersPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: customers }, { data: leads }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, email, full_name, phone, accepts_marketing, tags, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("leads")
      .select("id, email, name, source, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Vendas</h1>
      </header>

      <SalesTabs />

      <p className="eyebrow" style={{ marginBottom: 14 }}>Clientes</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 34 }}>
        {(customers ?? []).map((c) => (
          <div key={c.id} className="glass" style={{ padding: "16px 22px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong style={{ fontSize: 14 }}>{c.full_name ?? c.email}</strong>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                {c.email}{c.phone ? ` · ${c.phone}` : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {c.accepts_marketing ? <span className="chip chip-live">Aceita marketing</span> : null}
              {(c.tags ?? []).map((t: string) => (
                <span key={t} className="chip chip-draft">{t}</span>
              ))}
            </div>
          </div>
        ))}
        {(customers ?? []).length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>
            Nenhum cliente ainda — eles nascem junto com os pedidos do checkout.
          </p>
        ) : null}
      </div>

      <p className="eyebrow" style={{ marginBottom: 14 }}>Leads (newsletter)</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(leads ?? []).map((l) => (
          <div key={l.id} className="glass" style={{ padding: "14px 22px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <strong style={{ fontSize: 13 }}>{l.name ?? l.email}</strong>
              <p className="muted" style={{ fontSize: 11, marginTop: 2 }}>{l.email}</p>
            </div>
            <span className="chip chip-draft">{l.source}</span>
          </div>
        ))}
        {(leads ?? []).length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>
            Nenhum lead ainda — o formulário do site será ligado a esta lista na
            etapa de captura de leads.
          </p>
        ) : null}
      </div>
    </main>
  );
}
