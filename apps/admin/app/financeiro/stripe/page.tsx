import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GlassSelect } from "@/components/GlassSelect";
import { effectiveTenantId } from "@/lib/cms/actions";
import { money } from "@/lib/format";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { enqueueStripeCatalogJob, saveManualStripeLink } from "./actions";

type StripeProductRow = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  name: string;
  sku: string | null;
  environment: string;
  stripe_product_id: string | null;
  lookup_key_base: string | null;
  sync_status: string;
  last_synced_at: string | null;
  last_error: string | null;
};

type StripePriceRow = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  environment: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  lookup_key: string | null;
  currency: string;
  unit_amount_cents: number;
  billing_type: string;
  recurring_interval: string | null;
  recurring_interval_count: number;
  channel: string | null;
  status: string;
  active: boolean;
  is_default: boolean;
  last_synced_at: string | null;
  last_error: string | null;
};

type JobRow = {
  id: string;
  action: string;
  environment: string;
  entity_type: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
};

type ConflictRow = {
  id: string;
  conflict_type: string;
  field_name: string | null;
  environment: string;
  severity: string;
  status: string;
  suggested_action: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  environment: string;
  status: string;
  created_at: string;
  last_error: string | null;
};

type ConnectionRow = {
  id: string;
  environment: string;
  status: string;
  credentials_status: string;
  last_sync_at: string | null;
  last_error: string | null;
  auto_sync_enabled: boolean;
};

type ProductCandidate = {
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  status: string;
  sku: string;
  priceCents: number;
  currency: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  stripeLookupKey: string | null;
  stripeSyncStatus: string;
  stripeLastSyncAt: string | null;
  stripeLastError: string | null;
};

const ENV_OPTIONS = [
  { value: "test", label: "Teste" },
  { value: "production", label: "Produção" },
];

const BILLING_OPTIONS = [
  { value: "one_time", label: "Avulso" },
  { value: "recurring", label: "Recorrente" },
  { value: "custom_quote", label: "Orçamento aprovado" },
];

const INTERVAL_OPTIONS = [
  { value: "", label: "Sem recorrência" },
  { value: "month", label: "Mensal" },
  { value: "year", label: "Anual" },
  { value: "week", label: "Semanal" },
  { value: "day", label: "Diário" },
];

const CHANNEL_OPTIONS = [
  { value: "", label: "Canal padrão" },
  { value: "site", label: "E-commerce próprio" },
  { value: "marketplace", label: "Marketplace" },
  { value: "b2b", label: "B2B" },
  { value: "wholesale", label: "Atacado" },
  { value: "physical_store", label: "Loja física" },
  { value: "subscription", label: "Assinatura" },
  { value: "campaign", label: "Campanha" },
];

const STATUS_LABEL: Record<string, string> = {
  not_linked: "Não conectado",
  connected: "Conectado",
  synced: "Sincronizado",
  pending_change: "Alteração pendente",
  divergent: "Divergente",
  archived: "Arquivado",
  inactive: "Inativo",
  auth_error: "Erro de autenticação",
  sync_error: "Erro de sincronização",
  active: "Ativo",
  future: "Agendado",
  error: "Erro",
  queued: "Na fila",
  running: "Executando",
  succeeded: "Concluído",
  failed: "Falhou",
  dead: "Fila morta",
  cancelled: "Cancelado",
  received: "Recebido",
  processed: "Processado",
  ignored: "Ignorado",
  open: "Aberto",
  resolved: "Resolvido",
  acknowledged: "Reconhecido",
};

const ACTION_LABEL: Record<string, string> = {
  test_connection: "Testar conexão",
  search_stripe: "Buscar no Stripe",
  link_existing: "Vincular existente",
  unlink: "Desvincular",
  create_product: "Criar Product",
  create_price: "Criar Price",
  publish_catalog: "Publicar catálogo",
  sync_now: "Sincronizar agora",
  replace_price: "Substituir Price",
  archive_price: "Arquivar Price",
  activate_price: "Ativar",
  compare_data: "Comparar dados",
  reconcile_catalog: "Reconciliar catálogo",
  copy_test_to_production: "Duplicar teste → produção",
  test_checkout: "Testar checkout",
  import_from_stripe: "Importar do Stripe",
};

function fallbackLookupKey(row: ProductCandidate) {
  return `flora_${row.slug.replace(/[^a-z0-9]+/g, "_")}_${row.currency.toLowerCase()}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function stripeDashboardUrl(environment: string, productId: string | null) {
  if (!productId) return null;
  return environment === "test"
    ? `https://dashboard.stripe.com/test/products/${productId}`
    : `https://dashboard.stripe.com/products/${productId}`;
}

export default async function StripeCatalogPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [
    { data: products },
    { data: stripeProducts },
    { data: stripePrices },
    { data: jobs },
    { data: conflicts },
    { data: events },
    { data: connections },
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, name, slug, status, stripe_product_id, stripe_lookup_key, stripe_sync_status, stripe_last_sync_at, stripe_last_error,
         product_variants(id, sku, price_cents, currency, is_default, stripe_product_id, stripe_price_id, stripe_lookup_key, stripe_sync_status, stripe_last_sync_at, stripe_last_error)`
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("stripe_products")
      .select("id, entity_type, entity_id, name, sku, environment, stripe_product_id, lookup_key_base, sync_status, last_synced_at, last_error")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("stripe_prices")
      .select("id, entity_type, entity_id, environment, stripe_product_id, stripe_price_id, lookup_key, currency, unit_amount_cents, billing_type, recurring_interval, recurring_interval_count, channel, status, active, is_default, last_synced_at, last_error")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(120),
    supabase
      .from("stripe_sync_jobs")
      .select("id, action, environment, entity_type, status, attempts, max_attempts, last_error, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("stripe_catalog_conflicts")
      .select("id, conflict_type, field_name, environment, severity, status, suggested_action, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("stripe_webhook_events")
      .select("id, stripe_event_id, event_type, environment, status, created_at, last_error")
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("integration_connections")
      .select("id, environment, status, credentials_status, last_sync_at, last_error, auto_sync_enabled")
      .eq("tenant_id", tenantId)
      .eq("provider_key", "stripe")
      .order("environment"),
  ]);

  const candidates: ProductCandidate[] = (products ?? []).flatMap((product) => {
    const variants = (product.product_variants ?? []) as unknown as Array<{
      id: string;
      sku: string;
      price_cents: number;
      currency: string;
      is_default: boolean;
      stripe_product_id: string | null;
      stripe_price_id: string | null;
      stripe_lookup_key: string | null;
      stripe_sync_status: string;
      stripe_last_sync_at: string | null;
      stripe_last_error: string | null;
    }>;
    const defaultVariant = variants.find((variant) => variant.is_default) ?? variants[0];
    if (!defaultVariant) return [];
    return [{
      productId: product.id,
      variantId: defaultVariant.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      sku: defaultVariant.sku,
      priceCents: defaultVariant.price_cents,
      currency: defaultVariant.currency ?? "BRL",
      stripeProductId: defaultVariant.stripe_product_id ?? product.stripe_product_id ?? null,
      stripePriceId: defaultVariant.stripe_price_id ?? null,
      stripeLookupKey: defaultVariant.stripe_lookup_key ?? product.stripe_lookup_key ?? null,
      stripeSyncStatus: defaultVariant.stripe_sync_status ?? product.stripe_sync_status ?? "not_linked",
      stripeLastSyncAt: defaultVariant.stripe_last_sync_at ?? product.stripe_last_sync_at ?? null,
      stripeLastError: defaultVariant.stripe_last_error ?? product.stripe_last_error ?? null,
    }];
  });

  const productRows = (stripeProducts ?? []) as StripeProductRow[];
  const priceRows = (stripePrices ?? []) as StripePriceRow[];
  const jobRows = (jobs ?? []) as JobRow[];
  const conflictRows = (conflicts ?? []) as ConflictRow[];
  const eventRows = (events ?? []) as EventRow[];
  const connectionRows = (connections ?? []) as ConnectionRow[];
  const syncedCount = productRows.filter((row) => row.sync_status === "synced").length;
  const unlinkedCount = candidates.filter((row) => !row.stripeProductId && !row.stripePriceId).length;
  const errorCount =
    productRows.filter((row) => row.sync_status.includes("error") || row.last_error).length +
    priceRows.filter((row) => row.status === "error" || row.last_error).length;
  const archivedPrices = priceRows.filter((row) => row.status === "archived" || !row.active).length;
  const recurringPrices = priceRows.filter((row) => row.billing_type === "recurring").length;

  return (
    <main style={pageStyle}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/financeiro" className="eyebrow" style={{ opacity: 0.8 }}>← Financeiro</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 18, marginTop: 10 }}>
          <div>
            <h1 className="display" style={{ fontSize: 42 }}>Stripe · Catálogo e Preços</h1>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6, maxWidth: 760 }}>
              Central para vincular Products, Prices, Lookup Keys, ambientes, histórico, filas, webhooks e reconciliação sem abrir o painel do Stripe a cada ajuste.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <QuickJob action="test_connection" label="Testar conexão" />
            <QuickJob action="reconcile_catalog" label="Reconciliar" />
            <QuickJob action="publish_catalog" label="Publicar catálogo" tone="gold" />
          </div>
        </div>
      </header>

      <section className="rise" style={kpiGridStyle}>
        <Kpi label="Products vinculados" value={`${productRows.length}`} note={`${syncedCount} sincronizados`} />
        <Kpi label="Prices mapeados" value={`${priceRows.length}`} note={`${archivedPrices} arquivados/inativos`} />
        <Kpi label="Não vinculados" value={`${unlinkedCount}`} note="itens internos sem Stripe" />
        <Kpi label="Assinaturas" value={`${recurringPrices}`} note="prices recorrentes" />
        <Kpi label="Divergências" value={`${conflictRows.filter((row) => row.status === "open").length}`} note="pendentes de decisão" />
        <Kpi label="Erros" value={`${errorCount}`} note="catálogo, preço ou fila" danger={errorCount > 0} />
      </section>

      <section className="glass rise rise-1" style={{ padding: 18, marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Conexões Stripe</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {connectionRows.length ? connectionRows.map((connection) => (
            <div key={connection.id} style={miniCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{connection.environment === "test" ? "Teste" : "Produção"}</strong>
                <StatusChip status={connection.status} />
              </div>
              <p className="muted" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 8 }}>
                Credenciais: {connection.credentials_status} · Auto sync: {connection.auto_sync_enabled ? "ativo" : "desligado"} · Última sync: {formatDate(connection.last_sync_at)}
              </p>
              {connection.last_error ? <p style={errorTextStyle}>{connection.last_error}</p> : null}
            </div>
          )) : (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              A migration cria conexões Stripe para teste e produção. Depois de aplicar no Supabase, elas aparecem aqui.
            </p>
          )}
        </div>
      </section>

      <section className="glass rise rise-2" style={{ padding: 22, marginBottom: 18 }}>
        <SectionTitle eyebrow="Catálogo interno" title="Itens prontos para vincular ao Stripe" />
        <div style={{ display: "grid", gap: 14 }}>
          {candidates.map((row) => (
            <article key={row.variantId} style={itemCardStyle}>
              <div style={{ minWidth: 220 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 15 }}>{row.name}</strong>
                  <StatusChip status={row.stripeSyncStatus} />
                </div>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>
                  SKU {row.sku || "—"} · {money(row.priceCents)} · slug {row.slug}
                </p>
                {row.stripeLastError ? <p style={errorTextStyle}>{row.stripeLastError}</p> : null}
              </div>

              <form action={saveManualStripeLink} style={linkFormStyle}>
                <input type="hidden" name="entity_type" value="product_variant" />
                <input type="hidden" name="entity_id" value={row.variantId} />
                <input type="hidden" name="name" value={row.name} />
                <input type="hidden" name="sku" value={row.sku} />
                <input type="hidden" name="slug" value={row.slug} />
                <input type="hidden" name="currency" value={row.currency} />
                <input type="hidden" name="unit_amount_cents" value={row.priceCents} />
                <label className="field">
                  <span>Ambiente</span>
                  <GlassSelect name="environment" defaultValue="test" options={ENV_OPTIONS} ariaLabel={`Ambiente Stripe ${row.name}`} inlineMenu />
                </label>
                <label className="field">
                  <span>Product ID</span>
                  <input className="input" name="stripe_product_id" defaultValue={row.stripeProductId ?? ""} placeholder="prod_..." />
                </label>
                <label className="field">
                  <span>Price ID ativo</span>
                  <input className="input" name="stripe_price_id" defaultValue={row.stripePriceId ?? ""} placeholder="price_..." />
                </label>
                <label className="field">
                  <span>Lookup Key</span>
                  <input className="input" name="lookup_key" defaultValue={row.stripeLookupKey ?? fallbackLookupKey(row)} />
                </label>
                <label className="field">
                  <span>Tipo de preço</span>
                  <GlassSelect name="billing_type" defaultValue="one_time" options={BILLING_OPTIONS} ariaLabel={`Tipo de preço ${row.name}`} inlineMenu />
                </label>
                <label className="field">
                  <span>Recorrência</span>
                  <GlassSelect name="recurring_interval" defaultValue="" options={INTERVAL_OPTIONS} ariaLabel={`Recorrência ${row.name}`} inlineMenu />
                </label>
                <input type="hidden" name="recurring_interval_count" value="1" />
                <label className="field">
                  <span>Canal</span>
                  <GlassSelect name="channel" defaultValue="site" options={CHANNEL_OPTIONS} ariaLabel={`Canal ${row.name}`} inlineMenu />
                </label>
                <button className="btn btn-gold" style={{ padding: "10px 16px", fontSize: 10 }}>
                  Salvar vínculo
                </button>
              </form>

              <div style={actionGridStyle}>
                <ItemJob row={row} action="create_product" label="Criar no Stripe" />
                <ItemJob row={row} action="create_price" label="Criar Price" />
                <ItemJob row={row} action="sync_now" label="Sincronizar" />
                <ItemJob row={row} action="replace_price" label="Substituir Price" />
                <ItemJob row={row} action="archive_price" label="Arquivar Price" danger />
                <ItemJob row={row} action="search_stripe" label="Buscar no Stripe" />
                {stripeDashboardUrl("test", row.stripeProductId) ? (
                  <a href={stripeDashboardUrl("test", row.stripeProductId) ?? "#"} target="_blank" rel="noreferrer" className="btn btn-ghost" style={smallButtonStyle}>
                    Abrir no Stripe
                  </a>
                ) : null}
              </div>
            </article>
          ))}
          {candidates.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>Nenhum produto comercial encontrado no catálogo.</p>
          ) : null}
        </div>
      </section>

      <div style={twoColumnStyle}>
        <section className="glass rise rise-3" style={{ padding: 22 }}>
          <SectionTitle eyebrow="Prices" title="Múltiplos preços por item" />
          <DataList empty="Nenhum Price mapeado ainda.">
            {priceRows.slice(0, 14).map((price) => (
              <div key={price.id} style={listRowStyle}>
                <span>
                  <strong>{price.lookup_key ?? price.stripe_price_id ?? "Price sem lookup"}</strong>
                  <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 3 }}>
                    {price.environment} · {price.billing_type} · {price.channel ?? "canal padrão"} · {money(price.unit_amount_cents)}
                    {price.recurring_interval ? ` / ${price.recurring_interval_count} ${price.recurring_interval}` : ""}
                  </span>
                </span>
                <StatusChip status={price.status} />
              </div>
            ))}
          </DataList>
        </section>

        <section className="glass rise rise-3" style={{ padding: 22 }}>
          <SectionTitle eyebrow="Fila" title="Sincronizações e retentativas" />
          <DataList empty="Nenhuma tarefa Stripe na fila.">
            {jobRows.map((job) => (
              <div key={job.id} style={listRowStyle}>
                <span>
                  <strong>{ACTION_LABEL[job.action] ?? job.action}</strong>
                  <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 3 }}>
                    {job.environment} · {job.entity_type ?? "catálogo"} · tentativa {job.attempts}/{job.max_attempts} · {formatDate(job.created_at)}
                  </span>
                  {job.last_error ? <span style={errorTextStyle}>{job.last_error}</span> : null}
                </span>
                <StatusChip status={job.status} />
              </div>
            ))}
          </DataList>
        </section>
      </div>

      <div style={twoColumnStyle}>
        <section className="glass rise rise-4" style={{ padding: 22 }}>
          <SectionTitle eyebrow="Reconciliação" title="Conflitos de catálogo" />
          <DataList empty="Nenhuma divergência registrada.">
            {conflictRows.map((conflict) => (
              <div key={conflict.id} style={listRowStyle}>
                <span>
                  <strong>{conflict.conflict_type}</strong>
                  <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 3 }}>
                    {conflict.environment} · {conflict.field_name ?? "campo geral"} · {conflict.suggested_action ?? "aguardando análise"}
                  </span>
                </span>
                <StatusChip status={conflict.status} danger={conflict.severity === "error" || conflict.severity === "critical"} />
              </div>
            ))}
          </DataList>
        </section>

        <section className="glass rise rise-4" style={{ padding: 22 }}>
          <SectionTitle eyebrow="Webhooks" title="Eventos recentes do Stripe" />
          <DataList empty="Nenhum webhook recebido ainda.">
            {eventRows.map((event) => (
              <div key={event.id} style={listRowStyle}>
                <span>
                  <strong>{event.event_type}</strong>
                  <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 3 }}>
                    {event.environment} · {event.stripe_event_id} · {formatDate(event.created_at)}
                  </span>
                  {event.last_error ? <span style={errorTextStyle}>{event.last_error}</span> : null}
                </span>
                <StatusChip status={event.status} />
              </div>
            ))}
          </DataList>
        </section>
      </div>

      <section className="glass rise rise-4" style={{ padding: 22, marginTop: 18, borderColor: "rgba(185,146,77,0.28)" }}>
        <SectionTitle eyebrow="Regra crítica" title="Preço seguro no servidor" />
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.8, margin: 0 }}>
          O frontend nunca deve enviar valor, moeda, Product ID ou Price ID arbitrário para pagamento. O checkout deve receber apenas identificadores internos,
          e o backend valida o item, canal, vigência, ambiente, estoque e Price ativo antes de criar uma nova Checkout Session.
        </p>
      </section>
    </main>
  );
}

function QuickJob({ action, label, tone }: { action: string; label: string; tone?: "gold" }) {
  return (
    <form action={enqueueStripeCatalogJob}>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="environment" value="test" />
      <button className={tone === "gold" ? "btn btn-gold" : "btn btn-ghost"} style={smallButtonStyle}>
        {label}
      </button>
    </form>
  );
}

function ItemJob({ row, action, label, danger }: { row: ProductCandidate; action: string; label: string; danger?: boolean }) {
  return (
    <form action={enqueueStripeCatalogJob}>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="environment" value="test" />
      <input type="hidden" name="entity_type" value="product_variant" />
      <input type="hidden" name="entity_id" value={row.variantId} />
      <input type="hidden" name="entity_name" value={row.name} />
      <input type="hidden" name="sku" value={row.sku} />
      <input type="hidden" name="lookup_key" value={row.stripeLookupKey ?? fallbackLookupKey(row)} />
      <button className={danger ? "btn btn-ghost" : "btn btn-ghost"} style={{ ...smallButtonStyle, ...(danger ? dangerButtonStyle : {}) }}>
        {label}
      </button>
    </form>
  );
}

function Kpi({ label, value, note, danger }: { label: string; value: string; note: string; danger?: boolean }) {
  return (
    <div className="glass" style={{ padding: "18px 20px", minHeight: 112 }}>
      <p className="muted" style={{ fontSize: 10, letterSpacing: 1.2, margin: 0, textTransform: "uppercase" }}>{label}</p>
      <p className="display" style={{ fontSize: 30, color: danger ? "#e8a0a0" : "var(--gold-light)", margin: "10px 0 0" }}>{value}</p>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{note}</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p className="eyebrow" style={{ marginBottom: 7 }}>{eyebrow}</p>
      <h2 className="display" style={{ fontSize: 28 }}>{title}</h2>
    </div>
  );
}

function StatusChip({ status, danger }: { status: string; danger?: boolean }) {
  const label = STATUS_LABEL[status] ?? status;
  const isLive = ["online", "synced", "connected", "active", "processed", "succeeded", "resolved"].includes(status);
  const isDanger = danger || ["error", "failed", "dead", "auth_error", "sync_error", "divergent"].includes(status);
  return (
    <span
      className={isLive ? "chip chip-live" : "chip chip-draft"}
      style={isDanger ? { color: "#e8a0a0", borderColor: "rgba(232,160,160,0.42)" } : undefined}
    >
      {label}
    </span>
  );
}

function DataList({ children, empty }: { children: ReactNode; empty: string }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  if (!list.length) {
    return <p className="muted" style={{ fontSize: 12, margin: 0 }}>{empty}</p>;
  }
  return <div style={{ display: "grid", gap: 10 }}>{children}</div>;
}

const pageStyle: CSSProperties = { maxWidth: 1280, margin: "0 auto", padding: "48px 28px 80px" };
const kpiGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 };
const twoColumnStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18, marginTop: 18 };
const miniCardStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  padding: 14,
  background: "rgba(255,248,234,0.04)",
};
const itemCardStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 16,
  padding: 16,
  background: "rgba(255,248,234,0.045)",
  display: "grid",
  gap: 16,
};
const linkFormStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  alignItems: "end",
};
const actionGridStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const smallButtonStyle: CSSProperties = { padding: "9px 14px", fontSize: 10, whiteSpace: "nowrap" };
const dangerButtonStyle: CSSProperties = { color: "#e8a0a0", borderColor: "rgba(232,160,160,0.42)" };
const listRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1fr) auto",
  gap: 12,
  alignItems: "center",
  padding: "12px 14px",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  background: "rgba(255,248,234,0.035)",
};
const errorTextStyle: CSSProperties = {
  display: "block",
  color: "#e8a0a0",
  fontSize: 11,
  lineHeight: 1.5,
  marginTop: 6,
};
