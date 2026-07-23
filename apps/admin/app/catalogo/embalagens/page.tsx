import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const LEVEL_LABEL: Record<string, string> = {
  standard: "Padrão",
  premium: "Premium",
  gift: "Presente",
  transport: "Transporte",
};

export default async function EmbalagemPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: packages } = await supabase
    .from("packaging_types")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("level")
    .order("name");

  const rows = packages ?? [];

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/catalogo" className="eyebrow" style={{ opacity: 0.8 }}>← Catálogo</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Embalagens</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>
          Tipos de embalagem disponíveis para produtos e kits.
        </p>
      </header>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn" style={{ fontSize: 14 }}>+ Nova embalagem</button>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--muted)" }}>
          <p style={{ fontSize: 18 }}>Nenhuma embalagem cadastrada.</p>
          <p style={{ fontSize: 14 }}>Cadastre embalagens padrão, premium e de presente.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((pkg) => (
            <div key={pkg.id} style={{
              background: "var(--cream)",
              borderRadius: 10,
              padding: "18px 22px",
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto auto auto",
              alignItems: "center",
              gap: 20,
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{pkg.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {LEVEL_LABEL[pkg.level] ?? pkg.level} · {pkg.code}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Custo</div>
                <div style={{ fontWeight: 600 }}>{money(pkg.cost_cents ?? 0)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Dimensões</div>
                <div style={{ fontSize: 13 }}>
                  {pkg.width_cm}×{pkg.height_cm}×{pkg.depth_cm} cm
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Peso</div>
                <div style={{ fontSize: 13 }}>{pkg.weight_g} g</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Estoque</div>
                <div style={{ fontWeight: 600 }}>{pkg.stock ?? 0}</div>
              </div>
              <div>
                <span style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: 20,
                  fontSize: 12, fontWeight: 600,
                  background: pkg.is_active ? "#2d6a4f22" : "#88888822",
                  color: pkg.is_active ? "#2d6a4f" : "#888",
                }}>
                  {pkg.is_active ? "Ativo" : "Inativo"}
                </span>
                {pkg.is_default && (
                  <span style={{
                    marginLeft: 6, display: "inline-block", padding: "3px 10px", borderRadius: 20,
                    fontSize: 12, fontWeight: 600, background: "#c9a96e22", color: "#c9a96e",
                  }}>Padrão</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
