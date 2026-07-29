import Link from "next/link";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { StatusChip, STATUS_LABEL, money } from "@/app/vendas/Tabs";
import { OrderActions } from "./OrderActions";
import { PedidosFilters } from "./PedidosFilters";

const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "canceled", "refunded"] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

function paymentLabel(status: string | null) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    partial: "Parcial",
    paid: "Pago",
    scheduled: "Agendado",
    failed: "Falhou",
    refunded: "Reembolsado",
  };
  return labels[status ?? "pending"] ?? status ?? "Pendente";
}

interface OrderRow {
  id: string;
  number: string;
  status: string;
  source_channel: string | null;
  origin_label: string | null;
  manual_channel: string | null;
  payment_status: string | null;
  total_cents: number;
  currency: string;
  created_at: string;
  placed_at: string | null;
  customers: { email: string; full_name: string | null } | null;
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
}) {
  const staff = await currentStaff();
  if (!staff) return null;

  const { status, date } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("id, number, status, source_channel, origin_label, manual_channel, payment_status, total_cents, currency, created_at, placed_at, customers(email, full_name)")
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }

  if (date) {
    query = query
      .gte("created_at", `${date}T00:00:00.000Z`)
      .lte("created_at", `${date}T23:59:59.999Z`);
  }

  const [ordersRes, allRes, datesRes] = await Promise.all([
    query,
    supabase.from("orders").select("status").eq("tenant_id", staff.tenantId).is("deleted_at", null),
    supabase.from("orders").select("created_at").eq("tenant_id", staff.tenantId).is("deleted_at", null),
  ]);

  const rows = (ordersRes.data ?? []) as unknown as OrderRow[];
  const counts: Record<string, number> = {};

  for (const o of allRes.data ?? []) {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }

  const total = (allRes.data ?? []).length;
  const orderDates = [...new Set((datesRes.data ?? []).map((o) => o.created_at.substring(0, 10)))];

  return (
    <div style={{ display: "grid", gap: 20, padding: "24px 28px 48px" }}>
      <div>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Pedidos</h1>
        <p style={{ margin: 0, color: "var(--cream-dim)", fontSize: 14 }}>
          Vendas, cancelamentos, devoluções e máquina de estados dos pedidos do site, pedidos manuais e marketplaces.
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

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "start" }}>
        <PedidosFilters
          counts={counts}
          orderDates={orderDates}
          currentStatus={status ?? ""}
          currentDate={date ?? ""}
        />

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--cream-dim)" }}>
              {rows.length === total ? `${total} pedido(s)` : `${rows.length} de ${total} pedido(s)`}
              {date && " · filtrado por data"}
            </p>
          </div>

          <section style={cardStyle}>
            {rows.length === 0 ? (
              <p style={{ margin: 0, padding: 20, fontSize: 13, color: "var(--cream-dim)" }}>
                Nenhum pedido encontrado para este filtro.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "rgba(242,236,223,0.06)", textAlign: "left", borderBottom: "1px solid rgba(242,236,223,0.08)" }}>
                      {["Pedido", "Cliente", "Origem", "Data", "Total", "Pagamento", "Status", ""].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => {
                      const customer = o.customers as unknown as { email: string; full_name: string | null } | null;
                      return (
                        <tr key={o.id} style={{ borderTop: "1px solid rgba(242,236,223,0.06)" }}>
                          <td style={tdStyle}>
                            <Link href={`/vendas/${o.id}`} style={{ fontWeight: 800, color: "var(--gold-light)" }}>
                              #{o.number}
                            </Link>
                          </td>
                          <td style={tdStyle}>{customer?.full_name ?? customer?.email ?? "—"}</td>
                          <td style={tdStyle}>
                            <span className="chip chip-draft">{o.origin_label ?? o.manual_channel ?? o.source_channel ?? "Site"}</span>
                          </td>
                          <td style={{ ...tdStyle, color: "var(--cream-dim)", whiteSpace: "nowrap" }}>
                            {formatDate(o.placed_at ?? o.created_at)}
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{money(o.total_cents, o.currency)}</td>
                          <td style={tdStyle}>
                            <span className={o.payment_status === "paid" ? "chip chip-live" : "chip chip-draft"}>
                              {paymentLabel(o.payment_status)}
                            </span>
                          </td>
                          <td style={tdStyle}><StatusChip status={o.status} /></td>
                          <td style={tdStyle}><OrderActions orderId={o.id} status={o.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div style={tipStyle}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--cream-dim)" }}>
              Pedidos vindos de marketplaces (Mercado Livre, Shopee, Amazon...) aparecerão aqui automaticamente assim que os canais forem conectados em{" "}
              <Link href="/canais" style={{ color: "var(--gold-light)" }}>Canais</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--glass-bg-strong)",
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  padding: 0,
  backdropFilter: "blur(18px) saturate(1.25)",
  WebkitBackdropFilter: "blur(18px) saturate(1.25)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
  overflow: "hidden",
};

const tipStyle: CSSProperties = {
  background: "rgba(185,146,77,0.08)",
  border: "1px solid rgba(185,146,77,0.22)",
  borderRadius: 12,
  padding: "14px 18px",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

const thStyle: CSSProperties = {
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--cream-dim)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const tdStyle: CSSProperties = {
  padding: "10px 16px",
  verticalAlign: "middle",
};
