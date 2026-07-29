import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

interface OperationOrder {
  id: string;
  number: string;
  status: string;
  total_cents: number;
  created_at: string;
  customers: { email: string; full_name: string | null } | null;
}

interface IntegrationAlert {
  id: string;
  provider_key: string | null;
  severity: string;
  title: string;
  message: string;
  created_at: string;
}

interface ChannelAccount {
  id: string;
  channel: string;
  status: string;
  last_sync_at: string | null;
}

interface FiscalDoc {
  id: string;
  status: string;
}

interface SyncRun {
  id: string;
  status: string;
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

function providerLabel(value: string | null) {
  if (!value) return "Sistema";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Operações — centro único com pedidos, estoque, fiscal, canais e alertas. */
export default async function OperacoesPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: inv }, { data: orders }, { data: nfeDocs }, { data: alerts }, { data: channels }, { data: syncRuns }] = await Promise.all([
    supabase
      .from("inventory")
      .select(
        "id, quantity, reserved, low_stock_threshold, track, updated_at, product_variants!inner(sku, products!inner(name, status))"
      )
      .eq("tenant_id", tenantId)
      .order("quantity", { ascending: true }),
    supabase
      .from("orders")
      .select("id, number, status, total_cents, created_at, customers(email, full_name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("nfe_documents")
      .select("id, status")
      .eq("tenant_id", tenantId),
    supabase
      .from("integration_alerts")
      .select("id, provider_key, severity, title, message, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("channel_accounts")
      .select("id, channel, status, last_sync_at")
      .eq("tenant_id", tenantId),
    supabase
      .from("integration_sync_runs")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .in("status", ["queued", "running"])
      .limit(50),
  ]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows = (inv ?? []).map((r: any) => {
    const variant = r.product_variants;
    const product = variant?.products;
    const low = r.track && r.quantity > 0 && r.quantity <= r.low_stock_threshold;
    const out = r.track && r.quantity === 0;
    return {
      id: r.id as string,
      name: (product?.name ?? "—") as string,
      sku: (variant?.sku ?? "—") as string,
      qty: r.quantity as number,
      min: r.low_stock_threshold as number,
      reserved: r.reserved as number,
      track: r.track as boolean,
      updated: r.updated_at as string,
      state: out ? "Esgotado" : low ? "Baixo" : "OK",
    };
  });

  const lowCount = rows.filter((r) => r.state === "Baixo").length;
  const outCount = rows.filter((r) => r.state === "Esgotado").length;
  const orderRows = (orders ?? []) as unknown as OperationOrder[];
  const fiscalRows = (nfeDocs ?? []) as FiscalDoc[];
  const alertRows = (alerts ?? []) as IntegrationAlert[];
  const channelRows = (channels ?? []) as ChannelAccount[];
  const syncRows = (syncRuns ?? []) as SyncRun[];
  const toSeparate = orderRows.filter((order) => order.status === "paid").length;
  const fiscalPending = fiscalRows.filter((doc) => ["rascunho", "enviando", "rejeitada"].includes(doc.status)).length;
  const channelsOnline = channelRows.filter((channel) => channel.status === "connected").length;

  const cards = [
    { label: "Pedidos p/ separar", value: toSeparate, detail: "pagos aguardando operação", tone: toSeparate > 0 ? "warn" : "ok" },
    { label: "Estoque baixo", value: lowCount, detail: "itens abaixo do mínimo", tone: lowCount > 0 ? "warn" : "ok" },
    { label: "Esgotados", value: outCount, detail: "sem saldo disponível", tone: outCount > 0 ? "warn" : "ok" },
    { label: "Notas pendentes", value: fiscalPending, detail: "rascunho, envio ou rejeição", tone: fiscalPending > 0 ? "warn" : "ok" },
    { label: "Integrações", value: alertRows.length, detail: "alertas abertos", tone: alertRows.length > 0 ? "warn" : "ok" },
    { label: "Fila", value: syncRows.length, detail: "sincronizações em aberto", tone: syncRows.length > 0 ? "warn" : "ok" },
    { label: "Canais online", value: channelsOnline, detail: `${channelRows.length} canal(is) cadastrado(s)`, tone: "ok" },
  ];

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Centro de Operações</h1>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          Uma tela para acompanhar pedidos, estoque, fiscal, canais, integrações e alertas
          sem abrir módulos isolados.
        </p>
      </header>

      <div className="rise" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} className="glass" style={{ padding: "16px 20px" }}>
            <p className="display" style={{ fontSize: 28, color: c.tone === "warn" ? "#e8c08a" : "var(--gold-light)" }}>
              {c.value}
            </p>
            <p className="muted" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>{c.label}</p>
            <p className="muted" style={{ fontSize: 10.5, marginTop: 4 }}>{c.detail}</p>
          </div>
        ))}
      </div>

      <section className="glass rise rise-1" style={{ padding: 22, marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>Fluxo operacional automático</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {[
            ["Pagamento", "/vendas", "pedidos e status"],
            ["Estoque", "/operacoes", "saldo, reserva e baixo estoque"],
            ["Fiscal", "/backoffice/notas-fiscais", "NF-e, XML e DANFE"],
            ["Expedição", "/backoffice/pedidos", "separação e envio"],
            ["Integrações", "/config/integracoes", "APIs, fila e providers"],
            ["Monitoramento", "/config/integracoes/monitoramento", "eventos, alertas e logs"],
          ].map(([label, href, detail]) => (
            <Link key={label} href={href} className="glass-hover" style={{ padding: 14, borderRadius: 12, textDecoration: "none", border: "1px solid rgba(242,236,223,0.1)", background: "rgba(10,22,11,0.22)" }}>
              <strong style={{ display: "block", color: "var(--cream)", fontSize: 12 }}>{label}</strong>
              <span className="muted" style={{ display: "block", fontSize: 10.5, marginTop: 4 }}>{detail}</span>
            </Link>
          ))}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginBottom: 18 }}>
        <section className="glass rise rise-2" style={{ padding: 22 }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Pedidos recentes</p>
          {orderRows.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>Nenhum pedido encontrado.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {orderRows.slice(0, 6).map((order) => {
                const customer = order.customers as { email: string; full_name: string | null } | null;
                return (
                  <Link key={order.id} href={`/vendas/${order.id}`} style={miniRowStyle}>
                    <span>
                      <strong>#{order.number}</strong>
                      <small className="muted" style={{ display: "block", marginTop: 3 }}>{customer?.full_name ?? customer?.email ?? "Cliente não identificado"}</small>
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <strong>{money(order.total_cents)}</strong>
                      <small className="muted" style={{ display: "block", marginTop: 3 }}>{formatDateTime(order.created_at)}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass rise rise-2" style={{ padding: 22 }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Alertas de integração</p>
          {alertRows.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>Nenhum alerta aberto.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {alertRows.map((alert) => (
                <article key={alert.id} style={miniRowStyle}>
                  <span>
                    <strong>{alert.title}</strong>
                    <small className="muted" style={{ display: "block", marginTop: 3 }}>{providerLabel(alert.provider_key)} · {formatDateTime(alert.created_at)}</small>
                  </span>
                  <span style={{ color: alert.severity === "critical" ? "#e8a0a0" : "var(--gold-light)", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                    {alert.severity}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="glass rise rise-2" style={{ padding: "6px 22px 14px" }}>
        <p className="eyebrow" style={{ paddingTop: 14, marginBottom: 2 }}>Estoque monitorado</p>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 70px 70px 70px 90px", gap: 10, padding: "14px 0 10px", borderBottom: "1px solid var(--glass-border)" }}>
          {["Produto", "SKU", "Atual", "Mínimo", "Reserva", "Status"].map((h) => (
            <span key={h} className="field-label">{h}</span>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 70px 70px 70px 90px", gap: 10, alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--glass-border)", fontSize: 12.5 }}>
            <span>{r.name}</span>
            <span className="muted" style={{ fontSize: 11 }}>{r.sku}</span>
            <span>{r.track ? r.qty : "∞"}</span>
            <span className="muted">{r.min}</span>
            <span className="muted">{r.reserved}</span>
            <span className={`chip ${r.state === "OK" ? "chip-live" : "chip-draft"}`} style={r.state === "Esgotado" ? { color: "#e8a0a0", borderColor: "rgba(232,160,160,0.4)" } : undefined}>
              {r.state}
            </span>
          </div>
        ))}
        {rows.length === 0 ? (
          <div style={{ padding: "34px 0", textAlign: "center" }}>
            <p style={{ fontSize: 14, marginBottom: 8 }}>Nenhum item em estoque ainda</p>
            <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
              O estoque nasce junto com os produtos do Catálogo.
            </p>
            <Link href="/catalogo" className="btn btn-gold" style={{ padding: "11px 22px" }}>
              Cadastrar produto
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

const miniRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(242,236,223,0.1)",
  background: "rgba(10,22,11,0.22)",
  color: "var(--cream)",
  textDecoration: "none",
};
