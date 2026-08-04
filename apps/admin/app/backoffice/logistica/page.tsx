import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { MarketplaceLabelSettings, type MarketplaceLabelSettingRow } from "./MarketplaceLabelSettings";
import { PrintQueue, type PrintQueueItem } from "./PrintQueue";
import {
  ChooseQuoteButton,
  ProductLabelButtons,
  RequestLabelButton,
  RequestQuotesButton,
  ShipmentButtons,
} from "./ShippingActions";

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
  recipient_snapshot: Record<string, unknown> | null;
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

interface ShippingQuoteRow {
  id: string;
  order_id: string | null;
  provider_key: string;
  service: string;
  service_name: string | null;
  status: string;
  cost_cents: number;
  price_cents: number;
  currency: string;
  deadline_days: number | null;
  error: string | null;
  expires_at: string | null;
  created_at: string;
}

interface InventorySnapshot {
  quantity: number;
  reserved: number | null;
  track: boolean | null;
}

interface ProductVariantRow {
  id: string;
  product_id: string;
  sku: string;
  name: string | null;
  weight_g: number | null;
  products: { name: string; status: string } | null;
  inventory: InventorySnapshot | InventorySnapshot[] | null;
}

interface ProductLabelJobRow {
  id: string;
  variant_id: string | null;
  status: string;
  format: string;
  copies: number;
  barcode_value: string | null;
  label_payload: Record<string, unknown> | null;
  created_at: string;
  product_variants: { sku: string; name: string | null; products: { name: string } | null } | null;
}

interface ShippingPrintJobRow {
  id: string;
  shipment_id: string | null;
  status: string;
  format: string;
  copies: number;
  payload: Record<string, unknown> | null;
  created_at: string;
  shipments: {
    tracking_code: string | null;
    barcode: string | null;
    recipient_snapshot: Record<string, unknown> | null;
    service: string | null;
    carrier: string | null;
    provider_key: string | null;
    orders: { number: string; customers: { email: string; full_name: string | null } | null } | null;
  } | null;
}

interface MarketplaceProviderRow {
  key: string;
  display_name: string;
}

interface IntegrationConnectionRow {
  provider_key: string;
  status: string;
  credentials_status: string;
  last_sync_at: string | null;
  last_error: string | null;
}

interface MarketplaceLabelDbRow {
  provider_key: string;
  status: string;
  source_preference: string;
  external_label_formats: unknown;
  default_print_template: string;
  default_queue_format: string;
  tracking_source: string;
  fallback_enabled: boolean;
  auto_queue_external_label: boolean;
  store_original_label: boolean;
  reprint_original_enabled: boolean;
  notes: string | null;
  last_sync_at: string | null;
  last_error: string | null;
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

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
}

export default async function LogisticaPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();

  const [
    { data: orderData },
    { data: shipmentData, error: shipmentError },
    { data: quoteData, error: quoteError },
    { data: rulesData, error: rulesError },
    { data: variantData, error: variantError },
    { data: productLabelData, error: productLabelError },
    { data: shippingPrintData, error: shippingPrintError },
    { data: marketplaceProviderData, error: marketplaceProviderError },
    { data: integrationConnectionData, error: integrationConnectionError },
    { data: marketplaceLabelData, error: marketplaceLabelError },
  ] = await Promise.all([
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
          "id, order_id, provider_key, carrier, service, tracking_code, status, label_status, label_url, label_pdf_url, label_format, recipient_snapshot, service_cost_cents, expected_delivery_days, last_error, created_at, orders(number, status, customers(email, full_name))"
        )
        .eq("tenant_id", staff.tenantId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("order_shipping_quotes")
        .select("id, order_id, provider_key, service, service_name, status, cost_cents, price_cents, currency, deadline_days, error, expires_at, created_at")
        .eq("tenant_id", staff.tenantId)
        .in("status", ["quoted", "selected", "failed"])
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("shipping_rules")
        .select("id, name, priority, status, provider_key, service, strategy")
        .eq("tenant_id", staff.tenantId)
        .order("priority", { ascending: true }),
      supabase
        .from("product_variants")
        .select("id, product_id, sku, name, weight_g, products(name, status), inventory(quantity, reserved, track)")
        .eq("tenant_id", staff.tenantId)
        .order("sku", { ascending: true })
        .limit(30),
      supabase
        .from("product_label_print_jobs")
        .select("id, variant_id, status, format, copies, barcode_value, label_payload, created_at, product_variants(sku, name, products(name))")
        .eq("tenant_id", staff.tenantId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("shipping_label_print_jobs")
        .select("id, shipment_id, status, format, copies, payload, created_at, shipments(tracking_code, barcode, recipient_snapshot, service, carrier, provider_key, orders(number, customers(email, full_name)))")
        .eq("tenant_id", staff.tenantId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("integration_providers")
        .select("key, display_name")
        .eq("category", "marketplace")
        .eq("is_active", true)
        .order("display_name", { ascending: true }),
      supabase
        .from("integration_connections")
        .select("provider_key, status, credentials_status, last_sync_at, last_error")
        .eq("tenant_id", staff.tenantId)
        .eq("environment", "production"),
      supabase
        .from("marketplace_label_settings")
        .select("provider_key, status, source_preference, external_label_formats, default_print_template, default_queue_format, tracking_source, fallback_enabled, auto_queue_external_label, store_original_label, reprint_original_enabled, notes, last_sync_at, last_error")
        .eq("tenant_id", staff.tenantId),
    ]);

  const shipments = shipmentError ? [] : ((shipmentData ?? []) as unknown as ShipmentRow[]);
  const quotes = quoteError ? [] : ((quoteData ?? []) as unknown as ShippingQuoteRow[]);
  const variants = variantError ? [] : ((variantData ?? []) as unknown as ProductVariantRow[]);
  const productLabelJobs = productLabelError ? [] : ((productLabelData ?? []) as unknown as ProductLabelJobRow[]);
  const shippingPrintJobs = shippingPrintError ? [] : ((shippingPrintData ?? []) as unknown as ShippingPrintJobRow[]);
  const marketplaceProviders = marketplaceProviderError ? [] : ((marketplaceProviderData ?? []) as MarketplaceProviderRow[]);
  const integrationConnections = integrationConnectionError ? [] : ((integrationConnectionData ?? []) as IntegrationConnectionRow[]);
  const marketplaceLabelSettings = marketplaceLabelError ? [] : ((marketplaceLabelData ?? []) as MarketplaceLabelDbRow[]);
  const connectionsByProvider = new Map(integrationConnections.map((connection) => [connection.provider_key, connection]));
  const settingsByProvider = new Map(marketplaceLabelSettings.map((setting) => [setting.provider_key, setting]));
  const marketplaceRows: MarketplaceLabelSettingRow[] = marketplaceProviders.map((provider) => {
    const setting = settingsByProvider.get(provider.key);
    const connection = connectionsByProvider.get(provider.key);
    return {
      providerKey: provider.key,
      displayName: provider.display_name,
      status: setting?.status ?? "active",
      connectionStatus: connection?.status ?? "offline",
      credentialsStatus: connection?.credentials_status ?? "missing",
      sourcePreference: setting?.source_preference ?? "external_then_flora",
      externalLabelFormats: stringArray(setting?.external_label_formats, ["pdf", "zpl", "png"]),
      defaultPrintTemplate: setting?.default_print_template ?? "shipping_100x150",
      defaultQueueFormat: setting?.default_queue_format ?? "thermal",
      trackingSource: setting?.tracking_source ?? "marketplace",
      fallbackEnabled: setting?.fallback_enabled ?? true,
      autoQueueExternalLabel: setting?.auto_queue_external_label ?? true,
      storeOriginalLabel: setting?.store_original_label ?? true,
      reprintOriginalEnabled: setting?.reprint_original_enabled ?? true,
      notes: setting?.notes ?? "",
      lastSyncAt: setting?.last_sync_at ?? connection?.last_sync_at ?? null,
      lastError: setting?.last_error ?? connection?.last_error ?? null,
    };
  });
  const latestProductLabelByVariant = new Map<string, ProductLabelJobRow>();
  for (const job of productLabelJobs) {
    if (job.variant_id && !latestProductLabelByVariant.has(job.variant_id)) {
      latestProductLabelByVariant.set(job.variant_id, job);
    }
  }
  const shippedOrderIds = new Set(shipments.map((shipment) => shipment.order_id));
  const candidateOrders = ((orderData ?? []) as unknown as OrderRow[]).filter((order) => !shippedOrderIds.has(order.id));
  const quotesByOrder = new Map<string, ShippingQuoteRow[]>();
  for (const quote of quotes) {
    if (!quote.order_id) continue;
    const rows = quotesByOrder.get(quote.order_id) ?? [];
    rows.push(quote);
    quotesByOrder.set(quote.order_id, rows);
  }
  const rules = rulesError ? [] : ((rulesData ?? []) as ShippingRule[]);
  const queued = shipments.filter((shipment) => ["queued", "generating"].includes(shipment.label_status)).length;
  const created = shipments.filter((shipment) => ["created", "printed"].includes(shipment.label_status)).length;
  const failed = shipments.filter((shipment) => shipment.label_status === "failed" || shipment.last_error).length;
  const productLabelsQueued = productLabelJobs.filter((job) => ["queued", "printing"].includes(job.status)).length;
  const printQueueItems: PrintQueueItem[] = [
    ...shippingPrintJobs.map((job) => {
      const shipment = job.shipments;
      const recipient = shipment?.recipient_snapshot ?? {};
      const orderNumber = shipment?.orders?.number;
      const customer = shipment?.orders?.customers as { email: string; full_name: string | null } | null;
      const recipientName = text(recipient.name, customer?.full_name ?? customer?.email ?? "Cliente");
      const address = [
        text(recipient.street, ""),
        text(recipient.number, ""),
        text(recipient.district, ""),
        text(recipient.city, ""),
        text(recipient.state, ""),
        text(recipient.zip, ""),
      ].filter(Boolean).join(" · ");

      return {
        id: job.id,
        kind: "shipping" as const,
        status: job.status,
        format: job.format,
        copies: job.copies,
        title: `Pedido #${orderNumber ?? "—"} · ${recipientName}`,
        subtitle: `${providerLabel(shipment?.provider_key ?? shipment?.carrier ?? null)} · ${shipment?.service ?? "serviço automático"}`,
        barcode: shipment?.barcode ?? shipment?.tracking_code ?? `SHIP-${job.id.slice(0, 8).toUpperCase()}`,
        notes: [
          address ? `Endereço: ${address}` : "Endereço não informado",
          recipient.phone ? `Telefone: ${recipient.phone}` : "",
          recipient.observation ? `Observação: ${recipient.observation}` : "",
        ].filter(Boolean) as string[],
        createdAt: job.created_at,
      };
    }),
    ...productLabelJobs.map((job) => {
      const variant = job.product_variants;
      const payload = job.label_payload ?? {};
      const productName = text(payload.product_name, variant?.products?.name ?? variant?.name ?? "Produto Flora");
      const sku = text(payload.sku, variant?.sku ?? job.barcode_value ?? "SKU");

      return {
        id: job.id,
        kind: "product" as const,
        status: job.status,
        format: job.format,
        copies: job.copies,
        title: productName,
        subtitle: `SKU ${sku}`,
        barcode: job.barcode_value ?? sku,
        notes: [
          payload.variant_name ? `Variação: ${payload.variant_name}` : "",
          payload.weight_g ? `Peso: ${payload.weight_g} g` : "",
          "Etiqueta interna de produto/estoque",
        ].filter(Boolean) as string[],
        createdAt: job.created_at,
      };
    }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
        <Metric label="Etiquetas internas" value={String(productLabelsQueued)} tone="warn" />
        <Metric label="Regras ativas" value={String(rules.filter((rule) => rule.status === "active").length)} />
      </div>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p className="eyebrow">Fila de impressão</p>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Etiquetas de envio e etiquetas internas enfileiradas para impressão individual, lote e reimpressão.
            </p>
          </div>
        </div>
        <PrintQueue items={printQueueItems} />
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p className="eyebrow">Etiquetas de marketplaces</p>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Configure como Mercado Livre, Shopee, Amazon e outros canais tratam etiqueta recebida, rastreio externo, reimpressão e fallback Flora.
            </p>
          </div>
          <Link href="/config/integracoes" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }}>
            Ver integrações
          </Link>
        </div>
        <MarketplaceLabelSettings rows={marketplaceRows} migrationReady={!marketplaceLabelError} />
      </section>

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
                  <Th>Cotações</Th>
                  <Th>Ação</Th>
                </tr>
              </thead>
              <tbody>
                {candidateOrders.map((order) => {
                  const customer = order.customers as { email: string; full_name: string | null } | null;
                  const orderQuotes = quotesByOrder.get(order.id) ?? [];
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
                      <Td><QuoteList quotes={orderQuotes} /></Td>
                      <Td>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <RequestQuotesButton orderId={order.id} />
                          <RequestLabelButton orderId={order.id} />
                        </div>
                      </Td>
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
            <p className="eyebrow">Etiquetas de produto e estoque</p>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Geração própria de código de barras para produtos, prateleiras, estoque e impressão A4/térmica.
            </p>
          </div>
          <Link href="/catalogo" className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 10 }}>
            Ver catálogo
          </Link>
        </div>
        {variantError ? (
          <EmptyState text="Não foi possível carregar os produtos para etiquetagem." />
        ) : variants.length === 0 ? (
          <EmptyState text="Nenhum produto cadastrado para gerar etiqueta interna." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>Produto</Th>
                  <Th>SKU / código</Th>
                  <Th>Estoque</Th>
                  <Th>Peso</Th>
                  <Th>Última etiqueta</Th>
                  <Th>Impressão</Th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => {
                  const inventory = first(variant.inventory);
                  const latestJob = latestProductLabelByVariant.get(variant.id);
                  const available = (inventory?.quantity ?? 0) - (inventory?.reserved ?? 0);
                  return (
                    <tr key={variant.id}>
                      <Td>
                        <strong>{variant.products?.name ?? variant.name ?? "Produto Flora"}</strong>
                        <span className="muted" style={{ display: "block", fontSize: 10 }}>
                          {variant.name ?? "Variação padrão"}
                        </span>
                      </Td>
                      <Td>
                        <code style={codeStyle}>{variant.sku}</code>
                        <span className="muted" style={{ display: "block", fontSize: 10 }}>
                          barras: {latestJob?.barcode_value ?? variant.sku}
                        </span>
                      </Td>
                      <Td>
                        {available} disponível
                        <span className="muted" style={{ display: "block", fontSize: 10 }}>
                          {inventory?.reserved ?? 0} reservado
                        </span>
                      </Td>
                      <Td>{variant.weight_g ? `${variant.weight_g} g` : "—"}</Td>
                      <Td>
                        {latestJob ? (
                          <StatusBadge status={latestJob.status} label={`${latestJob.copies}x · ${latestJob.format.toUpperCase()}`} />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </Td>
                      <Td><ProductLabelButtons variantId={variant.id} /></Td>
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
                  <Th>Observação</Th>
                  <Th>Custo</Th>
                  <Th>Erro</Th>
                  <Th>Impressão</Th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment) => {
                  const canPrint = ["created", "printed", "label_created"].includes(shipment.label_status) || Boolean(shipment.label_url || shipment.label_pdf_url);
                  const canDispatch = !["shipped", "in_transit", "delivered", "returned"].includes(shipment.status);
                  const observation = shipment.recipient_snapshot?.observation;
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
                      <Td>
                        {typeof observation === "string" && observation.trim() ? (
                          <span style={{ color: "var(--cream-dim)", fontSize: 11 }}>{observation}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </Td>
                      <Td>{money(shipment.service_cost_cents)}</Td>
                      <Td>
                        {shipment.last_error ? (
                          <span style={{ color: "#e8a0a0", fontSize: 11 }}>{shipment.last_error}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </Td>
                      <Td><ShipmentButtons shipmentId={shipment.id} canPrint={canPrint} canDispatch={canDispatch} /></Td>
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

function QuoteList({ quotes }: { quotes: ShippingQuoteRow[] }) {
  if (quotes.length === 0) {
    return <span className="muted" style={{ fontSize: 11 }}>Sem cotação</span>;
  }

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 250 }}>
      {quotes.slice(0, 3).map((quote) => (
        <div
          key={quote.id}
          className="glass"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 10,
            alignItems: "center",
            padding: "10px 12px",
            background: quote.status === "selected" ? "rgba(185,146,77,0.16)" : "rgba(10,22,11,0.32)",
            borderColor: quote.status === "selected" ? "rgba(217,184,122,0.5)" : "var(--glass-border)",
          }}
        >
          <div>
            <strong style={{ display: "block", fontSize: 12 }}>
              {providerLabel(quote.provider_key)} · {quote.service_name ?? quote.service}
            </strong>
            <span className="muted" style={{ display: "block", fontSize: 10.5, marginTop: 3 }}>
              {money(quote.cost_cents, quote.currency)} · {quote.deadline_days ? `${quote.deadline_days} dias` : "prazo a confirmar"}
            </span>
            {quote.error ? <span style={{ color: "#e8a0a0", fontSize: 10.5 }}>{quote.error}</span> : null}
          </div>
          {quote.status === "selected" ? (
            <StatusBadge status="created" label="Escolhida" />
          ) : (
            <ChooseQuoteButton quoteId={quote.id} />
          )}
        </div>
      ))}
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

const codeStyle: React.CSSProperties = {
  color: "var(--cream)",
  background: "rgba(10,22,11,0.38)",
  border: "1px solid var(--glass-border)",
  borderRadius: 6,
  padding: "3px 7px",
  fontSize: 11,
};
