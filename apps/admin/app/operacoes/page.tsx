import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

/** Operações · Estoque — dados 100% reais da tabela inventory. */
export default async function OperacoesPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: inv }, { count: toSeparate }] = await Promise.all([
    supabase
      .from("inventory")
      .select(
        "id, quantity, reserved, low_stock_threshold, track, updated_at, product_variants!inner(sku, products!inner(name, status))"
      )
      .eq("tenant_id", tenantId)
      .order("quantity", { ascending: true }),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "paid"),
  ]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows = (inv ?? []).map((r: any) => {
    const variant = r.product_variants;
    const product = variant?.products;
    const low = r.track && r.quantity > 0 && r.quantity <= r.low_stock_threshold;
    const out = r.track && r.quantity === 0;
    return {
      id: r.id as string,
      name: (product?.name ?? "—") as string,
      sku: (variant?.sku ?? "—") as string,
      qty: r.quantity as number,
      min: r.low_stock_threshold as number,
      reserved: r.reserved as number,
      track: r.track as boolean,
      updated: r.updated_at as string,
      state: out ? "Esgotado" : low ? "Baixo" : "OK",
    };
  });

  const lowCount = rows.filter((r) => r.state === "Baixo").length;
  const outCount = rows.filter((r) => r.state === "Esgotado").length;

  const cards = [
    { label: "Estoque baixo", value: lowCount, tone: lowCount > 0 ? "warn" : "ok" },
    { label: "Esgotados", value: outCount, tone: outCount > 0 ? "warn" : "ok" },
    { label: "Pedidos p/ separar", value: toSeparate ?? 0, tone: (toSeparate ?? 0) > 0 ? "warn" : "ok" },
    { label: "Itens monitorados", value: rows.length, tone: "ok" },
  ];

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Operações · Estoque</h1>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          O estoque baixa automaticamente quando um pedido é pago. Ajustes
          manuais são feitos no Catálogo, editando o produto.
        </p>
      </header>

      <div className="rise" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} className="glass" style={{ padding: "16px 20px" }}>
            <p className="display" style={{ fontSize: 28, color: c.tone === "warn" ? "#e8c08a" : "var(--gold-light)" }}>
              {c.value}
            </p>
            <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className="glass rise rise-2" style={{ padding: "6px 22px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 70px 70px 70px 90px", gap: 10, padding: "14px 0 10px", borderBottom: "1px solid var(--glass-border)" }}>
          {["Produto", "SKU", "Atual", "Mínimo", "Reserva", "Status"].map((h) => (
            <span key={h} className="field-label">{h}</span>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 70px 70px 70px 90px", gap: 10, alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--glass-border)", fontSize: 12.5 }}>
            <span>{r.name}</span>
            <span className="muted" style={{ fontSize: 11 }}>{r.sku}</span>
            <span>{r.track ? r.qty : "∞"}</span>
            <span className="muted">{r.min}</span>
            <span className="muted">{r.reserved}</span>
            <span className={`chip ${r.state === "OK" ? "chip-live" : "chip-draft"}`} style={r.state === "Esgotado" ? { color: "#e8a0a0", borderColor: "rgba(232,160,160,0.4)" } : undefined}>
              {r.state}
            </span>
          </div>
        ))}
        {rows.length === 0 ? (
          <div style={{ padding: "34px 0", textAlign: "center" }}>
            <p style={{ fontSize: 14, marginBottom: 8 }}>Nenhum item em estoque ainda</p>
            <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
              O estoque nasce junto com os produtos do Catálogo.
            </p>
            <Link href="/catalogo" className="btn btn-gold" style={{ padding: "11px 22px" }}>
              Cadastrar produto
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
