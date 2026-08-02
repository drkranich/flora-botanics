import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { redirect } from "next/navigation";
import { KanbanBoard, type KanbanCustomer } from "./KanbanBoard";

export const dynamic = "force-dynamic";

const STAGE_COLOR: Record<string, string> = {
  lead:       "#7ea8d9",
  contato:    "#f0b429",
  proposta:   "#fb923c",
  cliente:    "#4ade80",
  fidelizado: "#d9b87a",
};

export default async function PipelinePage() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const supabase = await createClient();

  const { data } = await supabase
    .from("customers")
    .select("id, full_name, email, whatsapp, tags, crm_stage")
    .eq("tenant_id", staff.tenantId)
    .order("full_name", { ascending: true })
    .limit(500);

  const customers = (data ?? []) as KanbanCustomer[];
  const total = customers.length;

  const byStage: Record<string, number> = {
    lead:       customers.filter(c => c.crm_stage === "lead").length,
    contato:    customers.filter(c => c.crm_stage === "contato").length,
    proposta:   customers.filter(c => c.crm_stage === "proposta").length,
    cliente:    customers.filter(c => c.crm_stage === "cliente").length,
    fidelizado: customers.filter(c => c.crm_stage === "fidelizado").length,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #080f09 0%, #0c1a0e 50%, #091208 100%)",
      color: "var(--cream)",
      fontFamily: "Manrope, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Topbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,22,11,0.88)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
        padding: "14px 28px",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <Link href="/inbox" style={{
          fontSize: 11.5, color: "var(--cream-dim)", textDecoration: "none", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          ← Voltar ao inbox
        </Link>
        <span style={{ color: "rgba(242,236,223,0.2)" }}>|</span>
        <span style={{
          fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600,
          color: "var(--cream)", letterSpacing: -0.4,
        }}>
          Pipeline CRM
        </span>
        <span style={{ fontSize: 12, color: "var(--cream-dim)", opacity: 0.55, marginLeft: 4 }}>
          — {total} contato{total !== 1 ? "s" : ""}
        </span>

        {/* Mini stats chips */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(byStage).map(([stage, count]) => (
            <div key={stage} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(15,32,18,0.7)",
              border: "1px solid rgba(242,236,223,0.09)",
              borderRadius: 20, padding: "5px 12px",
              fontSize: 11.5,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: STAGE_COLOR[stage] ?? "#6b7280",
                display: "inline-block",
                boxShadow: `0 0 5px ${STAGE_COLOR[stage] ?? "#6b7280"}88`,
              }} />
              <span style={{ color: "var(--cream-dim)", textTransform: "capitalize" }}>{stage}</span>
              <span style={{ fontWeight: 800, color: "var(--cream)", marginLeft: 2 }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, padding: "24px 28px 48px", overflowX: "auto" }}>
        {total === 0 ? (
          <div style={{
            margin: "60px auto", maxWidth: 400, textAlign: "center",
            background: "rgba(15,32,18,0.55)",
            border: "1px solid rgba(242,236,223,0.07)",
            borderRadius: 16, padding: "40px 32px",
            backdropFilter: "blur(20px)",
          }}>
            <div style={{ fontSize: 36, color: "var(--gold-light)", opacity: 0.15, marginBottom: 12, fontFamily: "Fraunces, serif" }}>✦</div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--cream-dim)", fontFamily: "Fraunces, serif", fontStyle: "italic" }}>
              Nenhum cliente cadastrado ainda. Eles aparecerão aqui conforme fizerem pedidos ou forem cadastrados.
            </p>
          </div>
        ) : (
          <KanbanBoard customers={customers} />
        )}
      </div>
    </div>
  );
}
