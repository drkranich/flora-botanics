import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { KanbanBoard, type KanbanCustomer } from "./KanbanBoard";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from("customers")
    .select("id, full_name, email, whatsapp, tags, crm_stage")
    .eq("tenant_id", staff.tenantId)
    .order("full_name", { ascending: true })
    .limit(500);

  const customers = (data ?? []) as KanbanCustomer[];

  const total = customers.length;
  const byStage = {
    lead: customers.filter((c) => c.crm_stage === "lead").length,
    contato: customers.filter((c) => c.crm_stage === "contato").length,
    proposta: customers.filter((c) => c.crm_stage === "proposta").length,
    cliente: customers.filter((c) => c.crm_stage === "cliente").length,
    fidelizado: customers.filter((c) => c.crm_stage === "fidelizado").length,
  };

  return (
    <div style={{ padding: "24px 28px 48px", display: "grid", gap: 24 }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Pipeline CRM</h1>
          <p style={{ margin: 0, color: "var(--cream-dim)", fontSize: 14 }}>
            Arraste os clientes entre as etapas do funil. {total} contato{total !== 1 ? "s" : ""} no total.
          </p>
        </div>

        {/* mini stats */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(byStage).map(([stage, count]) => (
            <div
              key={stage}
              className="glass"
              style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12 }}
            >
              <span style={{ color: "var(--cream-dim)", textTransform: "capitalize" }}>{stage}</span>
              <span style={{ fontWeight: 800, marginLeft: 8 }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div
          className="glass"
          style={{ padding: 40, textAlign: "center", borderRadius: 16 }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "var(--cream-dim)" }}>
            Nenhum cliente cadastrado ainda. Eles aparecerão aqui conforme fizerem pedidos ou forem cadastrados.
          </p>
        </div>
      ) : (
        <KanbanBoard customers={customers} />
      )}
    </div>
  );
}
