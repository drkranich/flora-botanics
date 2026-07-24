import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { StatusChip, STATUS_LABEL, money } from "@/app/vendas/Tabs";
import { OrderActions } from "./OrderActions";

const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "canceled", "refunded"] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

interface OrderRow {
  id: string;
  number: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  placed_at: string | null;
  customers: { email: string; full_name: string | null } | null;
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const staff = await currentStaff();
  if (!staff) return null;

  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("id, number, status, total_cents, currency, created_at, placed_at, customers(email, full_name)")
    .eq("tenant_id", staff.tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }

  const [ordersRes, allRes] = await Promise.all([
    query,
    supabase.from("orders").select("status").eq("tenant_id", staff.tenantId),
  ]);

  const rows = (ordersRes.data ?? []) as unknown as OrderRow[];
  const counts: Record<string, number> = {};
  for (const o of allRes.data ?? []) {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }
  const total = (allRes.data ?? []).length;

  return (
    <div style={{ display: "grid", gap: 16, padding: "24px 28px 48px" }}>
      <div>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Pedidos</h1>
        <p style={{ margin: 0, color: "var(--cream-dim)", fontSize: 14 }}>
          Vendas, cancelamentos, devoluções e máquina de estados dos pedidos do site.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
        {STATUSES.map((s) => (
          <div key={s} className="glass" style={{ padding: "14px 16px" }}>
            <p className="display" style={{ fontSize: 22, color: "var(--gold-light)" }}>{counts[s] ?? 0}</p>
            <p className="muted" style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>
              {STATUS_LABEL[s]}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/backoffice/pedidos" className={!status ? "btn btn-gold" : "btn btn-ghost"} style={{ padding: "8px 16px", fontSize: 10 }}>
          Todos ({total})
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/backoffice/pedidos?status=${s}`}
            className={status === s ? "btn btn-gold" : "btn btn-ghost"}
            style={{ padding: "8px 16px", fontSize: 10 }}
          >
            {STATUS_LABEL[s]} ({counts[s] ?? 0})
          </Link>
        ))}
      </div>

      <section style={cardStyle}>
        {rows.length === 0 ? (
          <p style={emptyStyle}>Nenhum pedido encontrado para este filtro.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "rgba(242, 236, 223, 0.08)", textAlign: "left" }}>
                  <th style={thStyle}>Pedido</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Data</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const customer = o.customers as unknown as { email: string; full_name: string | null } | null;
                  return (
                    <tr key={o.id} style={{ borderTop: "1px solid rgba(242, 236, 223, 0.08)" }}>
                      <td style={tdStyle}>#{o.number}</td>
                      <td style={tdStyle}>{customer?.full_name ?? customer?.email ?? "—"}</td>
                      <td style={tdStyle}>{formatDate(o.placed_at ?? o.created_at)}</td>
                      <td style={tdStyle}>{money(o.total_cents, o.currency)}</td>
                      <td style={tdStyle}>
                        <StatusChip status={o.status} />
                      </td>
                      <td style={tdStyle}>
                        <OrderActions orderId={o.id} status={o.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={{ ...cardStyle, borderColor: "rgba(185, 146, 77, 0.22)", background: "rgba(185, 146, 77, 0.10)" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--cream-dim)" }}>
          Pedidos vindos de marketplaces (Mercado Livre, Shopee, Amazon…) aparecerão aqui
          automaticamente assim que os canais forem conectados em{" "}
          <Link href="/canais" style={{ color: "var(--gold-light)" }}>Canais</Link>. Por enquanto, esta
          lista reflete os pedidos do site próprio.
        </p>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--glass-bg-strong)",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  padding: 20,
  backdropFilter: "blur(18px) saturate(1.25)",
  WebkitBackdropFilter: "blur(18px) saturate(1.25)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
};

const emptyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--cream-dim)",
};

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--cream-dim)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 16px",
  verticalAlign: "top",
};
