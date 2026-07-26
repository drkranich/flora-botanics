import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { RequestLabelButton, ShipmentButtons } from "./ShippingActions";

interface OrderRow {
  id: string;
  number: string;
  status: string;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
  customers: { email: string; full_name: string | null } | null;
}

interface ShipmentRow {
  id: string;
  order_id: string;
  provider_key: string | null;
  carrier: string | null;
  service: string | null;
  tracking_code: string | null;
  status: string;
  label_status: string;
  label_url: string | null;
  label_pdf_url: string | null;
  label_format: string;
  service_cost_cents: number;
  expected_delivery_days: number | null;
  last_error: string | null;
  created_at: string;
  orders: { number: string; status: string; customers: { email: string; full_name: string | null } | null } | null;
}

interface ShippingRule {
  id: string;
  name: string;
  priority: number;
  status: string;
  provider_key: string | null;
  service: string | null;
  strategy: string;
}

const orderStatusLabel: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  processing: "Em separação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

const shipmentStatusLabel: Record<string, string> = {
  pending: "Pendente",
  label_created: "Etiqueta criada",
  shipped: "Enviado",
  in_transit: "Em trânsito",
  delivered: "Entregue",
  returned: "Retornado",
};

const labelStatusLabel: Record<string, string> = {
  not_requested: "Não solicitada",
  queued: "Na fila",
  generating: "Gerando",
  created: "Criada",
  failed: "Falhou",
  cancelled: "Cancelada",
  printed: "Impressa",
};

function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function providerLabel(value: string | null) {
  if (!value) return "Automático";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toneForStatus(status: string) {
  if (["created", "printed", "label_created", "shipped", "delivered", "active"].includes(status)) return "ok";
  if (["queued", "generating", "pending"].includes(status)) return "warn";
  if (["failed", "cancelled", "returned", "paused"].includes(status)) return "danger";
  return "neutral";
}

export default async function LogisticaPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();

  const [{ data: orderData }, { data: shipmentData, error: shipmentError }, { data: rulesData, error: rulesError }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, number, status, shipping_cents, total_cents, currency, created_at, customers(email, full_name)")
        .eq("tenant_id", staff.tenantId)
        .in("status", ["paid", "processing"])
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("shipments")
        .select(
          "id, order_id, provider_key, carrier, service, tracking_code, status, label_status, label_url, label_pdf_url, label_format, service_cost_cents, expected_delivery_days, last_error, created_at, orders(number, status, customers(email, full_name))"
        )
        .eq("tenant_id", staff.tenantId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("shipping_rules")
        .select("id, name, priority, status, provider_key, service, strategy")
        .eq("tenant_id", staff.tenantId)
        .order("priority", { ascending: true }),
    ]);

  const shipments = shipmentError ? [] : ((shipmentData ?? []) as unknown as ShipmentRow[]);
  const shippedOrderIds = new Set(shipments.map((shipment) => shipment.order_id));
  const candidateOrders = ((orderData ?? []) as unknown as OrderRow[]).filter((order) => !shippedOrderIds.has(order.id));
  const rules = rulesError ? [] : ((rulesData ?? []) as ShippingRule[]);
  const queued = shipments.filter((shipment) => ["queued", "generating"].includes(shipment.label_status)).length;
  const created = shipments.filter((shipment) => ["created", "printed"].includes(shipment.label_status)).length;
  const failed = shipments.filter((shipment) => shipment.label_status === "failed" || shipment.last_error).length;

  return (
    <div style={{ display: "grid", gap: 18, padding: "24px 28px 48px" }}>
      <header>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Logística e Etiquetas</h1>
        <p style={{ margin: 0, color: "var(--cream-dim)", fontSize: 14 }}>
          Cotação, escolha de transportadora, geração de etiqueta, impressão e rastreamento operacional.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Metric label="Aguardando etiqueta" value={String(candidateOrders.length)} />
        <Metric label="Na fila" value={String(queued)} tone="warn" />
        <Metric label="Criadas/impressas" value={String(created)} tone="ok" />
        <Metric label="Falhas" value={String(failed)} tone={failed ? "danger" : "ok"} />
        <Metric label="Regras ativas" value={String(rules.filter((rule) => rule.status === "active").length)} />
      </div>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p className="eyebrow">Pedidos prontos para expedição</p>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Pedidos pagos ou em separação que ainda não possuem remessa.
            </p>
          </div>
          <Link href="/backoffice/pedidos" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }}>
            Ver pedidos
          </Link>
        </div>
        {candidateOrders.length === 0 ? (
          <EmptyState text="Nenhum pedido aguardando etiqueta." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>Pedido</Th>
                  <Th>Cliente</Th>
                  <Th>Status</Th>
                  <Th>Frete</Th>
                  <Th>Total</Th>
                  <Th>Ação</Th>
                </tr>
              </thead>
              <tbody>
                {candidateOrders.map((order) => {
                  const customer = order.customers as { email: string; full_name: string | null } | null;
                  return (
                    <tr key={order.id}>
                      <Td>
                        <Link href={`/vendas/${order.id}`} style={{ color: "var(--gold-light)", fontWeight: 800 }}>
                          #{order.number}
                        </Link>
                      </Td>
                      <Td>{customer?.full_name ?? customer?.email ?? "—"}</Td>
                      <Td><StatusBadge status={order.status} label={orderStatusLabel[order.status] ?? order.status} /></Td>
                      <Td>{money(order.shipping_cents, order.currency)}</Td>
                      <Td>{money(order.total_cents, order.currency)}</Td>
                      <Td><RequestLabelButton orderId={order.id} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p className="eyebrow">Remessas e etiquetas</p>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Impressão individual, reimpressão A4/térmica e cancelamento operacional.
            </p>
          </div>
        </div>
        {shipments.length === 0 ? (
          <EmptyState text="Nenhuma remessa criada ainda." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>Pedido</Th>
                  <Th>Transportadora</Th>
                  <Th>Etiqueta</Th>
                  <Th>Rastreio</Th>
                  <Th>Custo</Th>
                  <Th>Erro</Th>
                  <Th>Impressão</Th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment) => {
                  const canPrint = ["created", "printed", "label_created"].includes(shipment.label_status) || Boolean(shipment.label_url || shipment.label_pdf_url);
                  return (
                    <tr key={shipment.id}>
                      <Td>
                        <Link href={`/vendas/${shipment.order_id}`} style={{ color: "var(--gold-light)", fontWeight: 800 }}>
                          #{shipment.orders?.number ?? "—"}
                        </Link>
                        <span className="muted" style={{ display: "block", fontSize: 10 }}>
                          {shipmentStatusLabel[shipment.status] ?? shipment.status}
                        </span>
                      </Td>
                      <Td>
                        {providerLabel(shipment.provider_key ?? shipment.carrier)}
                        <span className="muted" style={{ display: "block", fontSize: 10 }}>{shipment.service ?? "serviço automático"}</span>
                      </Td>
                      <Td><StatusBadge status={shipment.label_status} label={labelStatusLabel[shipment.label_status] ?? shipment.label_status} /></Td>
                      <Td>{shipment.tracking_code ?? "—"}</Td>
                      <Td>{money(shipment.service_cost_cents)}</Td>
                      <Td>
                        {shipment.last_error ? (
                          <span style={{ color: "#e8a0a0", fontSize: 11 }}>{shipment.last_error}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </Td>
                      <Td><ShipmentButtons shipmentId={shipment.id} canPrint={canPrint} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p className="eyebrow">Regras de transportadora</p>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Base para escolha automática por custo, prazo, margem ou fallback.
            </p>
          </div>
          <Link href="/config/integracoes" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }}>
            Configurar APIs
          </Link>
        </div>
        {rules.length === 0 ? (
          <EmptyState text="Aplique a migration de logística para criar as regras iniciais." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
            {rules.map((rule) => (
              <article key={rule.id} className="glass" style={{ padding: 16, background: "rgba(10,22,11,0.26)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong>{rule.name}</strong>
                  <StatusBadge status={rule.status} label={rule.status === "active" ? "Ativa" : "Pausada"} />
                </div>
                <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                  {providerLabel(rule.provider_key)} · {rule.service ?? "serviço automático"}
                </p>
                <p className="muted" style={{ fontSize: 10.5, marginTop: 4 }}>
                  Prioridade {rule.priority} · estratégia {rule.strategy}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "ok" | "warn" | "danger" }) {
  const color = tone === "danger" ? "#e8a0a0" : tone === "warn" ? "#e8c08a" : "var(--gold-light)";
  return (
    <div className="glass" style={{ padding: "16px 18px" }}>
      <p className="display" style={{ fontSize: 28, color }}>{value}</p>
      <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>{label}</p>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = toneForStatus(status);
  return (
    <span
      style={{
        display: "inline-flex",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: tone === "danger" ? "#e8a0a0" : tone === "warn" ? "var(--gold-light)" : tone === "ok" ? "#8fd486" : "var(--cream-dim)",
        border: `1px solid ${tone === "danger" ? "rgba(232,160,160,0.35)" : tone === "warn" ? "rgba(185,146,77,0.35)" : tone === "ok" ? "rgba(143,212,134,0.35)" : "var(--glass-border)"}`,
        background: tone === "danger" ? "rgba(232,160,160,0.1)" : tone === "warn" ? "rgba(185,146,77,0.12)" : tone === "ok" ? "rgba(143,212,134,0.1)" : "rgba(242,236,223,0.06)",
      }}
    >
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="muted" style={{ margin: 0, fontSize: 12 }}>{text}</p>;
}

function Th({ children }: { children: ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={tdStyle}>{children}</td>;
}

const cardStyle: React.CSSProperties = {
  background: "var(--glass-bg-strong)",
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  padding: 20,
  backdropFilter: "blur(18px) saturate(1.25)",
  WebkitBackdropFilter: "blur(18px) saturate(1.25)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12.5,
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  color: "var(--cream-dim)",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  fontSize: 10,
  borderBottom: "1px solid var(--glass-border)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid rgba(242,236,223,0.08)",
  verticalAlign: "middle",
};
