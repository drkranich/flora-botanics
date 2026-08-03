import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { CustomerForm } from "./CustomerForm";

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

const CONVERSATION_CHANNEL_LABELS: Record<string, string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "E-mail",
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  tiktok: "TikTok",
  google_merchant: "Google Merchant",
  facebook: "Facebook",
};

const MARKETING_EVENT_LABELS: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregue",
  opened: "Aberto",
  clicked: "Clique",
  failure: "Falha",
  conversion: "Conversão",
  consent: "Consentimento",
  tracking_sent: "Rastreamento enviado",
  post_purchase: "Pós-venda",
};

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

interface CustomerDetail {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  birthday: string | null;
  notes: string | null;
  tags: string[];
  accepts_marketing: boolean;
  created_at: string;
}

interface OrderRow {
  id: string;
  number: string;
  status: string;
  total_cents: number;
  placed_at: string | null;
  created_at: string;
}

interface ConversationRow {
  id: string;
  channel: string;
  status: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface AddressRow {
  id: string;
  label: string | null;
  recipient: string | null;
  street: string;
  number: string | null;
  district: string | null;
  city: string;
  state: string;
  zip: string;
  is_default_shipping: boolean;
}

interface MarketingTimelineRow {
  id: string;
  channel: string | null;
  event_type: string;
  title: string;
  description: string | null;
  occurred_at: string;
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();

  const { data: customerData } = await supabase
    .from("customers")
    .select("id, full_name, email, phone, whatsapp, birthday, notes, tags, accepts_marketing, created_at")
    .eq("id", id)
    .eq("tenant_id", staff.tenantId)
    .maybeSingle();

  if (!customerData) notFound();
  const customer = customerData as CustomerDetail;

  const [ordersRes, conversationsRes, addressesRes, timelineRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, status, total_cents, placed_at, created_at")
      .eq("tenant_id", staff.tenantId)
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("conversations")
      .select("id, channel, status, last_message_preview, last_message_at, unread_count")
      .eq("tenant_id", staff.tenantId)
      .eq("customer_id", id)
      .order("last_message_at", { ascending: false })
      .limit(20),
    supabase
      .from("addresses")
      .select("id, label, recipient, street, number, district, city, state, zip, is_default_shipping")
      .eq("tenant_id", staff.tenantId)
      .eq("customer_id", id),
    supabase
      .from("marketing_customer_timeline")
      .select("id, channel, event_type, title, description, occurred_at")
      .eq("tenant_id", staff.tenantId)
      .eq("customer_id", id)
      .order("occurred_at", { ascending: false })
      .limit(30),
  ]);

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const conversations = (conversationsRes.data ?? []) as ConversationRow[];
  const addresses = (addressesRes.data ?? []) as AddressRow[];
  const timeline = (timelineRes.data ?? []) as MarketingTimelineRow[];

  const totalSpent = orders
    .filter((o) => ["paid", "processing", "shipped", "delivered"].includes(o.status))
    .reduce((sum, o) => sum + o.total_cents, 0);

  const canceledCount = orders.filter((o) => o.status === "canceled").length;

  return (
    <div style={{ display: "grid", gap: 16, padding: "24px 28px 48px" }}>
      <div>
        <Link href="/inbox/clientes" style={{ fontSize: 13, color: "var(--cream-dim)" }}>
          ← Clientes
        </Link>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, margin: "4px 0" }}>
          {customer.full_name ?? "Cliente sem nome"}
        </h1>
        <p style={{ margin: 0, color: "var(--cream-dim)", fontSize: 14 }}>
          {customer.email}
          {customer.phone ? ` · ${customer.phone}` : ""} · cliente desde {formatDate(customer.created_at)}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "var(--cream-dim)" }}>Total gasto</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{formatBRL(totalSpent)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "var(--cream-dim)" }}>Pedidos</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{orders.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "var(--cream-dim)" }}>Cancelamentos</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{canceledCount}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "var(--cream-dim)" }}>Conversas</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{conversations.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "var(--cream-dim)" }}>Relacionamento</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{timeline.length}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) 1fr", gap: 16 }}>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Dados de CRM</h2>
          <CustomerForm
            customerId={customer.id}
            birthday={customer.birthday}
            whatsapp={customer.whatsapp}
            notes={customer.notes}
            tags={customer.tags ?? []}
            acceptsMarketing={customer.accepts_marketing}
          />
        </section>

        <div style={{ display: "grid", gap: 16 }}>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Endereços</h2>
            {addresses.length === 0 ? (
              <p style={emptyStyle}>Nenhum endereço cadastrado.</p>
            ) : (
              <ul style={listStyle}>
                {addresses.map((a) => (
                  <li key={a.id} style={{ ...listItemStyle, alignItems: "flex-start", flexDirection: "column", gap: 2 }}>
                    <strong>
                      {a.label ?? "Endereço"} {a.is_default_shipping ? "· padrão" : ""}
                    </strong>
                    <span style={{ color: "var(--cream-dim)" }}>
                      {a.street}, {a.number ?? "s/n"} {a.district ? `· ${a.district}` : ""} · {a.city}/{a.state} · {a.zip}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Pedidos</h2>
            {orders.length === 0 ? (
              <p style={emptyStyle}>Nenhum pedido ainda.</p>
            ) : (
              <ul style={listStyle}>
                {orders.map((o) => (
                  <li key={o.id} style={listItemStyle}>
                    <span>
                      #{o.number} · {formatDate(o.placed_at ?? o.created_at)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "var(--cream-dim)" }}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                      <strong>{formatBRL(o.total_cents)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Conversas / Mensagens</h2>
            {conversations.length === 0 ? (
              <p style={emptyStyle}>Nenhuma conversa registrada.</p>
            ) : (
              <ul style={listStyle}>
                {conversations.map((c) => (
                  <li key={c.id} style={{ ...listItemStyle, alignItems: "flex-start", flexDirection: "column", gap: 2 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                      <strong>{CONVERSATION_CHANNEL_LABELS[c.channel] ?? c.channel}</strong>
                      <span style={{ color: "var(--cream-dim)" }}>{formatDateTime(c.last_message_at)}</span>
                    </span>
                    {c.last_message_preview && (
                      <span style={{ color: "var(--cream-dim)" }}>{c.last_message_preview}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Linha do tempo de relacionamento</h2>
            {timeline.length === 0 ? (
              <p style={emptyStyle}>Nenhum evento de marketing ou relacionamento registrado para este cliente.</p>
            ) : (
              <ul style={listStyle}>
                {timeline.map((event) => (
                  <li key={event.id} style={{ ...listItemStyle, alignItems: "flex-start", flexDirection: "column", gap: 4 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 12 }}>
                      <strong>{event.title}</strong>
                      <span style={{ color: "var(--cream-dim)", whiteSpace: "nowrap" }}>{formatDateTime(event.occurred_at)}</span>
                    </span>
                    <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="chip chip-live">{CONVERSATION_CHANNEL_LABELS[event.channel ?? ""] ?? event.channel ?? "Canal"}</span>
                      <span className="chip chip-draft">{MARKETING_EVENT_LABELS[event.event_type] ?? event.event_type}</span>
                    </span>
                    {event.description ? <span style={{ color: "var(--cream-dim)" }}>{event.description}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
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
  borderBottom: "1px solid rgba(242, 236, 223, 0.08)",
  paddingBottom: 8,
};

const emptyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--cream-dim)",
};
