import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { ClientesTable, type CustomerRow } from "./ClientesTable";

export default async function ClientesPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();

  // Busca ativos + arquivados (para o toggle "mostrar arquivados")
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
    <div style={{ display: "grid", gap: 16, padding: "24px 28px 48px" }}>
      <div>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Clientes</h1>
      </div>

      <ClientesTable customers={customers} totalCount={count ?? customers.length} />
    </div>
  );
}
