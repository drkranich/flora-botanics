import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { setListingStatus } from "./actions";

const CHANNEL_LABELS: Record<string, string> = {
  shopee: "Shopee",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  mercado_livre: "Mercado Livre",
  site: "Site próprio",
  email: "E-mail",
  amazon: "Amazon",
  tiktok: "TikTok",
  google_merchant: "Google Merchant",
  facebook: "Facebook",
};

// Ordem de prioridade definida na Seção 14 do blueprint:
// Shopee -> Instagram/WhatsApp -> Mercado Livre -> demais canais.
const CHANNEL_PRIORITY = [
  "shopee",
  "instagram",
  "whatsapp",
  "mercado_livre",
  "site",
  "email",
  "amazon",
  "tiktok",
  "google_merchant",
  "facebook",
];

const STATUS_LABELS: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Erro",
  pending_auth: "Aguardando autenticação",
};

const LISTING_STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  error: "Erro",
};

const SYNC_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  synced: "Sincronizado",
  error: "Erro",
};

function formatBRL(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function badgeStyle(kind: "connected" | "warning" | "neutral" | "error"): React.CSSProperties {
  const colors: Record<typeof kind, { bg: string; fg: string }> = {
    connected: { bg: "#e6f0ea", fg: "#2f6b4a" },
    warning: { bg: "#fbf0d9", fg: "#8a6512" },
    neutral: { bg: "#f2ecdf", fg: "#6b6354" },
    error: { bg: "#fbeaea", fg: "#9a3232" },
  };
  const c = colors[kind];
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

function channelStatusBadge(status: string): React.CSSProperties {
  if (status === "connected") return badgeStyle("connected");
  if (status === "error") return badgeStyle("error");
  if (status === "pending_auth") return badgeStyle("warning");
  return badgeStyle("neutral");
}

function listingStatusBadge(status: string): React.CSSProperties {
  if (status === "active") return badgeStyle("connected");
  if (status === "error") return badgeStyle("error");
  return badgeStyle("neutral");
}

function syncStatusBadge(status: string): React.CSSProperties {
  if (status === "synced") return badgeStyle("connected");
  if (status === "error") return badgeStyle("error");
  return badgeStyle("warning");
}

interface ChannelAccountRow {
  id: string;
  channel: string;
  status: string;
  display_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
}

interface ListingRow {
  id: string;
  external_id: string | null;
  external_url: string | null;
  price_cents: number | null;
  status: string;
  sync_status: string;
  last_synced_at: string | null;
  last_error: string | null;
  channel_accounts: { channel: string; display_name: string | null } | null;
  product_variants: {
    sku: string;
    name: string | null;
    products: { name: string } | null;
  } | null;
}

export default async function MarketplacesPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();

  const [channelsRes, listingsRes] = await Promise.all([
    supabase
      .from("channel_accounts")
      .select("id, channel, status, display_name, last_sync_at, last_error")
      .eq("tenant_id", staff.tenantId),
    supabase
      .from("marketplace_listings")
      .select(
        "id, external_id, external_url, price_cents, status, sync_status, last_synced_at, last_error, channel_accounts(channel, display_name), product_variants(sku, name, products(name))",
      )
      .eq("tenant_id", staff.tenantId)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const channels = (channelsRes.data ?? []) as ChannelAccountRow[];
  const listings = (listingsRes.data ?? []) as unknown as ListingRow[];

  const sortedChannels = [...channels].sort((a, b) => {
    const ia = CHANNEL_PRIORITY.indexOf(a.channel);
    const ib = CHANNEL_PRIORITY.indexOf(b.channel);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const errorListings = listings.filter((l) => l.sync_status === "error" || l.status === "error");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Marketplaces</h1>
        <p style={{ margin: 0, color: "#6b6354", fontSize: 14 }}>
          Conexões com canais externos e sincronização de anúncios/estoque. Ordem de prioridade:
          Shopee → Instagram/WhatsApp → Mercado Livre.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {sortedChannels.map((c) => (
          <div key={c.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{CHANNEL_LABELS[c.channel] ?? c.channel}</strong>
              <span style={channelStatusBadge(c.status)}>{STATUS_LABELS[c.status] ?? c.status}</span>
            </div>
            <div style={{ fontSize: 12, color: "#6b6354", marginTop: 6 }}>
              {c.display_name ?? "Sem nome de exibição"}
            </div>
            <div style={{ fontSize: 12, color: "#6b6354", marginTop: 4 }}>
              Última sincronização: {formatDateTime(c.last_sync_at)}
            </div>
            {c.last_error && (
              <div style={{ fontSize: 12, color: "#9a3232", marginTop: 4 }}>Erro: {c.last_error}</div>
            )}
            {c.status !== "connected" && (
              <div style={{ fontSize: 12, color: "#6b6354", marginTop: 8 }}>
                Conexão de API pendente — configurável em <Link href="/config">Configurações</Link> quando
                a integração com este canal estiver disponível.
              </div>
            )}
          </div>
        ))}
        {sortedChannels.length === 0 && (
          <div style={cardStyle}>
            <p style={emptyStyle}>Nenhum canal cadastrado ainda.</p>
          </div>
        )}
      </div>

      {errorListings.length > 0 && (
        <section style={{ ...cardStyle, borderColor: "#f5dede" }}>
          <h2 style={sectionTitleStyle}>Anúncios com erro de sincronização</h2>
          <ul style={listStyle}>
            {errorListings.map((l) => (
              <li key={l.id} style={listItemStyle}>
                <span>
                  {l.product_variants?.products?.name ?? "—"}
                  {l.product_variants?.name ? ` · ${l.product_variants.name}` : ""}{" "}
                  <span style={{ color: "#6b6354" }}>
                    ({CHANNEL_LABELS[l.channel_accounts?.channel ?? ""] ?? l.channel_accounts?.channel})
                  </span>
                </span>
                <span style={{ color: "#9a3232" }}>{l.last_error ?? "Erro desconhecido"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Anúncios sincronizados</h2>
        {listings.length === 0 ? (
          <p style={emptyStyle}>
            Nenhum anúncio vinculado ainda. Conforme os canais forem conectados, os anúncios
            sincronizados com variantes do catálogo aparecerão aqui.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f2ecdf", textAlign: "left" }}>
                  <th style={thStyle}>Produto</th>
                  <th style={thStyle}>Canal</th>
                  <th style={thStyle}>Preço</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Sincronização</th>
                  <th style={thStyle}>Última sync</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id} style={{ borderTop: "1px solid #f2ecdf" }}>
                    <td style={tdStyle}>
                      {l.product_variants?.products?.name ?? "—"}
                      {l.product_variants?.name ? ` · ${l.product_variants.name}` : ""}
                      <div style={{ fontSize: 12, color: "#6b6354" }}>{l.product_variants?.sku}</div>
                    </td>
                    <td style={tdStyle}>{CHANNEL_LABELS[l.channel_accounts?.channel ?? ""] ?? l.channel_accounts?.channel}</td>
                    <td style={tdStyle}>{formatBRL(l.price_cents)}</td>
                    <td style={tdStyle}>
                      <span style={listingStatusBadge(l.status)}>{LISTING_STATUS_LABELS[l.status] ?? l.status}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={syncStatusBadge(l.sync_status)}>{SYNC_STATUS_LABELS[l.sync_status] ?? l.sync_status}</span>
                    </td>
                    <td style={tdStyle}>{formatDateTime(l.last_synced_at)}</td>
                    <td style={tdStyle}>
                      <form action={setListingStatus.bind(null, l.id, l.status === "active" ? "paused" : "active")}>
                        <button type="submit" style={toggleButtonStyle}>
                          {l.status === "active" ? "Pausar" : "Ativar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 12,
  fontWeight: 700,
  color: "#6b6354",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 16px",
  verticalAlign: "top",
};

const toggleButtonStyle: React.CSSProperties = {
  background: "#f2ecdf",
  border: "1px solid #e6ddc9",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "#28251d",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
