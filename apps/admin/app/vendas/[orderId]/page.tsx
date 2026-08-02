import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { StatusChip, STATUS_LABEL } from "../Tabs";
import { money } from "@/lib/format";
import { ChooseQuoteButton, RequestLabelButton, RequestQuotesButton, ShipmentButtons } from "@/app/backoffice/logistica/ShippingActions";
import { OrderManagementPanel, type ManagedOrder } from "./OrderManagementPanel";
import { TransitionBar } from "./TransitionBar";
import { TrackingPanel } from "./TrackingPanel";
import { getShippingEvents } from "./tracking-actions";

type MaybeArray<T> = T | T[];

interface CustomerRow {
  email: string;
  full_name: string | null;
  phone: string | null;
}

interface OrderItemRow {
  id: string;
  product_snapshot: { name?: string; sku?: string; kind?: string; notes?: string } | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

interface PaymentRow {
  id: string;
  provider: string;
  status: string;
  amount_cents: number;
  raw: Record<string, unknown> | null;
  created_at: string;
}

interface ShippingQuoteRow {
  id: string;
  provider_key: string;
  service: string;
  service_name: string | null;
  status: string;
  cost_cents: number;
  price_cents: number;
  currency: string;
  deadline_days: number | null;
  error: string | null;
}

interface ShipmentRow {
  id: string;
  provider_key: string | null;
  carrier: string | null;
  service: string | null;
  tracking_code: string | null;
  status: string;
  label_status: string;
  label_url: string | null;
  label_pdf_url: string | null;
  label_format: string | null;
  service_cost_cents: number | null;
  expected_delivery_days: number | null;
  last_error: string | null;
  created_at: string;
}

interface AuditRow {
  id: string;
  action: string;
  reason: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

interface OrderRow extends ManagedOrder {
  number: string | number;
  status: string;
  source_channel: string | null;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  shipping_address: Record<string, string> | null;
  billing_address: Record<string, string> | null;
  created_at: string;
  placed_at: string | null;
  archive_reason: string | null;
  delete_reason: string | null;
  customers: MaybeArray<CustomerRow> | null;
}

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const { orderId } = await params;
  const supabase = await supabaseServer();

  const { data: orderData } = await supabase
    .from("orders")
    .select(
      [
        "id",
        "number",
        "status",
        "source_channel",
        "origin_label",
        "manual_channel",
        "payment_status",
        "payment_summary",
        "delivery_summary",
        "fiscal_summary",
        "commission_summary",
        "internal_tags",
        "subtotal_cents",
        "discount_cents",
        "shipping_cents",
        "total_cents",
        "currency",
        "shipping_address",
        "billing_address",
        "notes",
        "placed_at",
        "created_at",
        "archived_at",
        "archive_reason",
        "deleted_at",
        "delete_reason",
        "customers(email, full_name, phone)",
      ].join(", ")
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!orderData) notFound();
  const order = orderData as unknown as OrderRow;

  const [itemsRes, paymentsRes, quotesRes, shipmentsRes, auditRes, shippingEvents] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, product_snapshot, quantity, unit_price_cents, total_cents")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("id, provider, status, amount_cents, raw, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("shipping_quotes")
      .select("id, provider_key, service, service_name, status, cost_cents, price_cents, currency, deadline_days, error")
      .eq("order_id", orderId)
      .in("status", ["quoted", "selected", "failed"])
      .order("cost_cents", { ascending: true }),
    supabase
      .from("shipments")
      .select("id, provider_key, carrier, service, tracking_code, status, label_status, label_url, label_pdf_url, label_format, service_cost_cents, expected_delivery_days, last_error, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_audit_events")
      .select("id, action, reason, previous_value, new_value, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(30),
    getShippingEvents(orderId),
  ]);

  const items = (itemsRes.data ?? []) as unknown as OrderItemRow[];
  const payments = (paymentsRes.data ?? []) as unknown as PaymentRow[];
  const quotes = (quotesRes.data ?? []) as unknown as ShippingQuoteRow[];
  const shipments = (shipmentsRes.data ?? []) as unknown as ShipmentRow[];
  const audits = (auditRes.data ?? []) as unknown as AuditRow[];
  const customer = first(order.customers);
  const paidTotal = payments
    .filter((payment) => payment.status === "succeeded")
    .reduce((sum, payment) => sum + Number(payment.amount_cents ?? 0), 0);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 28px 150px" }}>
      <header className="rise" style={{ marginBottom: 24 }}>
        <Link href="/vendas" className="eyebrow" style={{ opacity: 0.8 }}>← Pedidos</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
          <div>
            <h1 className="display" style={{ fontSize: 42 }}>Pedido #{order.number}</h1>
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Criado em {formatDate(order.created_at)}
              {order.placed_at ? ` · lançado em ${formatDate(order.placed_at)}` : " · rascunho operacional"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <StatusChip status={order.status} />
            <StatusPill label={`Pagamento: ${paymentLabel(order.payment_status ?? "pending")}`} tone={order.payment_status === "paid" ? "ok" : order.payment_status === "partial" ? "warn" : "neutral"} />
          </div>
        </div>
      </header>

      <section style={metricGrid}>
        <Metric label="Total do pedido" value={money(order.total_cents, order.currency)} />
        <Metric label="Recebido" value={money(paidTotal, order.currency)} tone={paidTotal >= order.total_cents ? "ok" : "warn"} />
        <Metric label="Saldo" value={money(Math.max(0, order.total_cents - paidTotal), order.currency)} tone={paidTotal >= order.total_cents ? "ok" : "danger"} />
        <Metric label="Origem" value={order.origin_label ?? order.manual_channel ?? order.source_channel ?? "Site"} compact />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.8fr) minmax(320px, 1.2fr)", gap: 16, marginTop: 16 }}>
        <InfoCard title="Cliente">
          <p style={{ fontSize: 15, margin: 0 }}>{customer?.full_name ?? "Cliente sem nome"}</p>
          <p className="muted" style={{ fontSize: 12, margin: "5px 0 0" }}>{customer?.email ?? "Sem e-mail"}</p>
          {customer?.phone ? <p className="muted" style={{ fontSize: 12, margin: "3px 0 0" }}>{customer.phone}</p> : null}
        </InfoCard>

        <InfoCard title="Entrega">
          {order.shipping_address ? (
            <Address address={order.shipping_address} />
          ) : (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>Sem endereço registrado.</p>
          )}
          {stringValue(order.delivery_summary, "customer_observation") ? (
            <p style={{ margin: "12px 0 0", color: "var(--gold-light)", fontSize: 12 }}>
              Observação do cliente: {stringValue(order.delivery_summary, "customer_observation")}
            </p>
          ) : null}
        </InfoCard>
      </div>

      <section className="glass rise rise-2" style={{ padding: 22, marginTop: 16 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Itens do pedido</p>
        {items.length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>Nenhum item registrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((item) => {
              const snap = item.product_snapshot ?? {};
              return (
                <div key={item.id} style={rowStyle}>
                  <div>
                    <strong>{item.quantity}x {snap.name ?? "Item"}</strong>
                    <p className="muted" style={{ margin: "3px 0 0", fontSize: 11 }}>
                      {snap.sku ? `SKU ${snap.sku}` : "Sem SKU"} · unitário {money(item.unit_price_cents, order.currency)}
                    </p>
                  </div>
                  <strong style={{ color: "var(--gold-light)" }}>{money(item.total_cents, order.currency)}</strong>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ borderTop: "1px solid var(--glass-border)", marginTop: 14, paddingTop: 14, display: "grid", gap: 6 }}>
          <Row label="Subtotal" value={money(order.subtotal_cents, order.currency)} />
          <Row label="Desconto" value={order.discount_cents > 0 ? `− ${money(order.discount_cents, order.currency)}` : money(0, order.currency)} />
          <Row label="Frete" value={money(order.shipping_cents, order.currency)} />
          <Row label="Total" value={money(order.total_cents, order.currency)} strong />
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)", gap: 16, marginTop: 16 }}>
        <PaymentHistory payments={payments} currency={order.currency} />
        <ShippingBox orderId={order.id} quotes={quotes} shipments={shipments} currency={order.currency} />
      </div>

      {order.notes ? (
        <InfoCard title="Observações internas" style={{ marginTop: 16 }}>
          <p className="muted" style={{ fontSize: 12.5, whiteSpace: "pre-wrap", margin: 0 }}>{order.notes}</p>
        </InfoCard>
      ) : null}

      <TrackingPanel
        orderId={order.id}
        customerPhone={customer?.phone ?? null}
        initialEvents={shippingEvents}
        trackingCode={shipments[0]?.tracking_code ?? null}
        carrier={shipments[0]?.carrier ?? null}
      />

      <OrderManagementPanel order={order} />

      <AuditTimeline audits={audits} />

      <TransitionBar orderId={order.id} status={order.status} statusLabel={STATUS_LABEL} />
    </main>
  );
}

function first<T>(value: MaybeArray<T> | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function stringValue(summary: Record<string, unknown> | null | undefined, key: string) {
  const value = summary?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

function paymentLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "pendente",
    partial: "parcial",
    paid: "pago",
    scheduled: "agendado",
    failed: "falhou",
    refunded: "reembolsado",
  };
  return labels[status] ?? status;
}

function providerLabel(value: string | null) {
  if (!value) return "Transportadora";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function Metric({ label, value, tone = "neutral", compact }: { label: string; value: string; tone?: "neutral" | "ok" | "warn" | "danger"; compact?: boolean }) {
  const color = tone === "danger" ? "#e8a0a0" : tone === "ok" ? "#8fd486" : tone === "warn" ? "var(--gold-light)" : "var(--cream)";
  return (
    <div className="glass" style={{ padding: "18px 20px" }}>
      <p className="display" style={{ fontSize: compact ? 21 : 29, color, lineHeight: 1.1 }}>{value}</p>
      <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 5 }}>{label}</p>
    </div>
  );
}

function InfoCard({ title, children, style }: { title: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section className="glass rise rise-1" style={{ padding: 22, ...style }}>
      <p className="eyebrow" style={{ marginBottom: 10 }}>{title}</p>
      {children}
    </section>
  );
}

function Address({ address }: { address: Record<string, string> }) {
  return (
    <p className="muted" style={{ fontSize: 12, lineHeight: 1.7, margin: 0 }}>
      {address.recipient ?? "Destinatário não informado"}<br />
      {address.street}, {address.number} {address.complement}<br />
      {address.district ? `${address.district} · ` : ""}{address.city}/{address.state}<br />
      CEP {address.zip}
    </p>
  );
}

function PaymentHistory({ payments, currency }: { payments: PaymentRow[]; currency: string }) {
  return (
    <InfoCard title="Histórico financeiro">
      {payments.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>Nenhum pagamento registrado ainda.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {payments.map((payment) => (
            <div key={payment.id} style={rowStyle}>
              <div>
                <strong>{money(payment.amount_cents, currency)}</strong>
                <p className="muted" style={{ margin: "3px 0 0", fontSize: 11 }}>
                  {payment.provider} · {formatDate(payment.created_at)}
                </p>
              </div>
              <StatusPill label={payment.status === "succeeded" ? "Recebido" : payment.status} tone={payment.status === "succeeded" ? "ok" : "warn"} />
            </div>
          ))}
        </div>
      )}
    </InfoCard>
  );
}

function ShippingBox({ orderId, quotes, shipments, currency }: { orderId: string; quotes: ShippingQuoteRow[]; shipments: ShipmentRow[]; currency: string }) {
  return (
    <InfoCard title="Cotação, etiqueta e remessa">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <RequestQuotesButton orderId={orderId} />
        <RequestLabelButton orderId={orderId} />
        <Link href="/backoffice/logistica" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }}>
          Central logística
        </Link>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {quotes.length ? (
          quotes.slice(0, 4).map((quote) => (
            <div key={quote.id} style={rowStyle}>
              <div>
                <strong>{providerLabel(quote.provider_key)} · {quote.service_name ?? quote.service}</strong>
                <p className="muted" style={{ margin: "3px 0 0", fontSize: 11 }}>
                  {money(quote.cost_cents, quote.currency ?? currency)} · {quote.deadline_days ? `${quote.deadline_days} dias` : "prazo a confirmar"}
                </p>
                {quote.error ? <p style={{ margin: "4px 0 0", color: "#e8a0a0", fontSize: 11 }}>{quote.error}</p> : null}
              </div>
              {quote.status === "selected" ? <StatusPill label="Escolhida" tone="ok" /> : <ChooseQuoteButton quoteId={quote.id} />}
            </div>
          ))
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>Nenhuma cotação criada para este pedido.</p>
        )}

        {shipments.map((shipment) => (
          <div key={shipment.id} style={{ ...rowStyle, alignItems: "flex-start" }}>
            <div>
              <strong>{providerLabel(shipment.provider_key ?? shipment.carrier)} · {shipment.service ?? "Serviço"}</strong>
              <p className="muted" style={{ margin: "3px 0 0", fontSize: 11 }}>
                Rastreio {shipment.tracking_code ?? "pendente"} · etiqueta {shipment.label_status}
              </p>
              {shipment.last_error ? <p style={{ margin: "4px 0 0", color: "#e8a0a0", fontSize: 11 }}>{shipment.last_error}</p> : null}
            </div>
            <ShipmentButtons shipmentId={shipment.id} canPrint={shipment.label_status === "created" || shipment.label_status === "printed"} canDispatch={shipment.status !== "shipped" && shipment.status !== "delivered"} />
          </div>
        ))}
      </div>
    </InfoCard>
  );
}

function AuditTimeline({ audits }: { audits: AuditRow[] }) {
  return (
    <section className="glass rise" style={{ padding: 22, marginTop: 16 }}>
      <p className="eyebrow" style={{ marginBottom: 12 }}>Auditoria do pedido</p>
      {audits.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>Nenhum evento auditável registrado ainda.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {audits.map((audit) => (
            <div key={audit.id} style={rowStyle}>
              <div>
                <strong>{audit.action.replace(/_/g, " ")}</strong>
                <p className="muted" style={{ margin: "3px 0 0", fontSize: 11 }}>{formatDate(audit.created_at)}</p>
                {audit.reason ? <p style={{ margin: "5px 0 0", color: "var(--cream-dim)", fontSize: 12 }}>Motivo: {audit.reason}</p> : null}
              </div>
              <StatusPill label="Auditado" tone="ok" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "ok" | "warn" | "danger" }) {
  const color = tone === "danger" ? "#e8a0a0" : tone === "ok" ? "#8fd486" : tone === "warn" ? "var(--gold-light)" : "var(--cream-dim)";
  return (
    <span
      style={{
        border: `1px solid ${tone === "neutral" ? "var(--glass-border)" : color}`,
        background: "rgba(242,236,223,0.06)",
        color,
        borderRadius: 999,
        padding: "6px 11px",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: strong ? 800 : 500 }}>
      <span className={strong ? undefined : "muted"}>{label}</span>
      <span style={{ color: strong ? "var(--gold-light)" : undefined }}>{value}</span>
    </div>
  );
}

const metricGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: "11px 0",
  borderBottom: "1px solid var(--glass-border)",
  fontSize: 13,
};
