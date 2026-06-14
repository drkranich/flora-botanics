import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

const REVENUE_STATUSES = ["paid", "processing", "shipped", "delivered"];

const LOG_LEVEL_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Atenção",
  error: "Erro",
  critical: "Crítico",
};

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

interface OrderRow {
  status: string;
  total_cents: number;
  created_at: string;
}

interface InventoryRow {
  variant_id: string;
  quantity: number;
  low_stock_threshold: number;
  product_variants: {
    sku: string;
    name: string | null;
    products: { name: string } | null;
  } | null;
}

interface LogRow {
  id: string;
  level: string;
  source: string;
  message: string;
  created_at: string;
}

export default async function DashboardPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [ordersRes, newCustomersRes, abandonedCartsRes, inventoryRes, logsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("status, total_cents, created_at")
      .eq("tenant_id", staff.tenantId),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", staff.tenantId)
      .gte("created_at", since30),
    supabase
      .from("carts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", staff.tenantId)
      .eq("status", "abandoned"),
    supabase
      .from("inventory")
      .select("variant_id, quantity, low_stock_threshold, product_variants(sku, name, products(name))")
      .eq("tenant_id", staff.tenantId)
      .eq("track", true),
    supabase
      .from("system_logs")
      .select("id, level, source, message, created_at")
      .eq("tenant_id", staff.tenantId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const ordersLast30 = orders.filter((o) => o.created_at >= since30);

  const revenue30 = ordersLast30
    .filter((o) => REVENUE_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + o.total_cents, 0);

  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const inventory = (inventoryRes.data ?? []) as unknown as InventoryRow[];
  const lowStock = inventory.filter((i) => i.quantity <= i.low_stock_threshold);

  const logs = (logsRes.data ?? []) as LogRow[];

  const kpis = [
    { label: "Vendas (30 dias)", value: formatBRL(revenue30) },
    { label: "Pedidos (30 dias)", value: String(ordersLast30.length) },
    { label: "Novos clientes (30 dias)", value: String(newCustomersRes.count ?? 0) },
    { label: "Carrinhos abandonados", value: String(abandonedCartsRes.count ?? 0) },
  ];

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ margin: 0, color: "#6b6354", fontSize: 14 }}>
          Visão geral dos últimos 30 dias.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={cardStyle}>
            <div style={{ fontSize: 13, color: "#6b6354" }}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Pedidos por status</h2>
          {orders.length === 0 ? (
            <p style={emptyStyle}>Nenhum pedido ainda.</p>
          ) : (
            <ul style={listStyle}>
              {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
                <li key={status} style={listItemStyle}>
                  <span>{label}</span>
                  <strong>{statusCounts[status] ?? 0}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Alertas de estoque baixo</h2>
          {lowStock.length === 0 ? (
            <p style={emptyStyle}>Nenhum alerta de estoque.</p>
          ) : (
            <ul style={listStyle}>
              {lowStock.map((item) => (
                <li key={item.variant_id} style={listItemStyle}>
                  <span>
                    {item.product_variants?.products?.name ?? "—"}
                    {item.product_variants?.name ? ` · ${item.product_variants.name}` : ""}{" "}
                    <span style={{ color: "#6b6354" }}>({item.product_variants?.sku})</span>
                  </span>
                  <strong>{item.quantity}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Logs recentes (não resolvidos)</h2>
          {logs.length === 0 ? (
            <p style={emptyStyle}>Nenhum log pendente — tudo certo.</p>
          ) : (
            <ul style={listStyle}>
              {logs.map((log) => (
                <li key={log.id} style={{ ...listItemStyle, alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{log.message}</div>
                    <div style={{ fontSize: 12, color: "#6b6354" }}>
                      {log.source} · {formatDateTime(log.created_at)}
                    </div>
                  </div>
                  <span style={logBadgeStyle(log.level)}>{LOG_LEVEL_LABELS[log.level] ?? log.level}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e6ddc9",
  borderRadius: 12,
  padding: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  margin: "0 0 12px",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 8,
};

const listItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 14,
  borderBottom: "1px solid #f2ecdf",
  paddingBottom: 8,
};

const emptyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#6b6354",
};

function logBadgeStyle(level: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    info: { bg: "#e6f0ea", fg: "#2f6b4a" },
    warning: { bg: "#fbf0d9", fg: "#8a6512" },
    error: { bg: "#fbeaea", fg: "#9a3232" },
    critical: { bg: "#f5dede", fg: "#7a1f1f" },
  };
  const c = colors[level] ?? colors.info;
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 6,
    background: c.bg,
    color: c.fg,
    whiteSpace: "nowrap",
  };
}
