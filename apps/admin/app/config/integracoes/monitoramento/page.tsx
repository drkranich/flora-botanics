import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

interface ConnectionRow {
  provider_key: string;
  display_name: string | null;
  environment: string;
  status: string;
  credentials_status: string;
  auto_sync_enabled: boolean;
  last_sync_at: string | null;
  last_healthcheck_at: string | null;
  last_error: string | null;
  latency_ms: number | null;
  error_count: number | null;
}

interface SyncRunRow {
  id: string;
  provider_key: string;
  action: string;
  trigger: string;
  status: string;
  records_in: number;
  records_out: number;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface EventRow {
  id: string;
  event_type: string;
  source: string;
  aggregate_type: string | null;
  aggregate_id: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

interface AlertRow {
  id: string;
  provider_key: string | null;
  severity: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
}

const statusLabel: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  error: "Erro",
  pending_auth: "Aguardando autenticação",
  paused: "Pausado",
  queued: "Na fila",
  running: "Executando",
  succeeded: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
  dead: "Encerrado",
  open: "Aberto",
  acknowledged: "Reconhecido",
  resolved: "Resolvido",
};

function formatDateTime(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatProvider(value: string | null) {
  if (!value) return "Sistema";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function badgeStyle(status: string): React.CSSProperties {
  const danger = ["error", "failed", "dead", "critical"].includes(status);
  const success = ["online", "succeeded", "resolved"].includes(status);
  const warning = ["pending_auth", "queued", "running", "warning", "open"].includes(status);
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    border: `1px solid ${
      danger ? "rgba(232,160,160,0.4)" : success ? "rgba(143,212,134,0.35)" : warning ? "rgba(185,146,77,0.35)" : "var(--glass-border)"
    }`,
    color: danger ? "#e8a0a0" : success ? "#8fd486" : warning ? "var(--gold-light)" : "var(--cream-dim)",
    background: danger
      ? "rgba(232,160,160,0.1)"
      : success
        ? "rgba(143,212,134,0.1)"
        : warning
          ? "rgba(185,146,77,0.12)"
          : "rgba(242,236,223,0.06)",
  };
}

export default async function IntegracoesMonitoramentoPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: connections }, { data: runs }, { data: events }, { data: alerts }] = await Promise.all([
    supabase
      .from("integration_connections")
      .select(
        "provider_key, display_name, environment, status, credentials_status, auto_sync_enabled, last_sync_at, last_healthcheck_at, last_error, latency_ms, error_count"
      )
      .eq("tenant_id", tenantId)
      .order("provider_key"),
    supabase
      .from("integration_sync_runs")
      .select("id, provider_key, action, trigger, status, records_in, records_out, error, duration_ms, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("integration_events")
      .select("id, event_type, source, aggregate_type, aggregate_id, status, attempts, last_error, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("integration_alerts")
      .select("id, provider_key, severity, title, message, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const connectionRows = (connections ?? []) as ConnectionRow[];
  const runRows = (runs ?? []) as SyncRunRow[];
  const eventRows = (events ?? []) as EventRow[];
  const alertRows = (alerts ?? []) as AlertRow[];
  const online = connectionRows.filter((row) => row.status === "online").length;
  const withError = connectionRows.filter((row) => row.status === "error" || (row.error_count ?? 0) > 0).length;
  const queued = runRows.filter((row) => row.status === "queued" || row.status === "running").length;
  const openAlerts = alertRows.filter((row) => row.status === "open").length;

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 28 }}>
        <Link href="/config/integracoes" className="eyebrow" style={{ opacity: 0.8 }}>
          ← Central de Integrações
        </Link>
        <h1 className="display" style={{ fontSize: 42, marginTop: 10, marginBottom: 6 }}>
          Monitoramento
        </h1>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Status operacional das APIs, fila de sincronização, eventos internos e alertas por tenant.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 }}>
        <Metric label="Conexões" value={String(connectionRows.length)} detail="providers mapeados" />
        <Metric label="Online" value={String(online)} detail="ativos agora" tone="success" />
        <Metric label="Fila" value={String(queued)} detail="execuções em aberto" tone="warning" />
        <Metric label="Alertas" value={String(openAlerts)} detail={`${withError} com erro`} tone={openAlerts || withError ? "danger" : "neutral"} />
      </section>

      <section className="glass" style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <p className="eyebrow">Conexões por provider</p>
          <span className="muted" style={{ fontSize: 11 }}>produção e teste ficam separados no banco</span>
        </div>
        {connectionRows.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>Provider</Th>
                  <Th>Status</Th>
                  <Th>Credenciais</Th>
                  <Th>Auto sync</Th>
                  <Th>Última sync</Th>
                  <Th>Latência</Th>
                  <Th>Erros</Th>
                </tr>
              </thead>
              <tbody>
                {connectionRows.map((row) => (
                  <tr key={`${row.provider_key}-${row.environment}`} style={trStyle}>
                    <Td>
                      <strong>{row.display_name ?? formatProvider(row.provider_key)}</strong>
                      <span className="muted" style={{ display: "block", fontSize: 10 }}>{row.environment}</span>
                    </Td>
                    <Td><span style={badgeStyle(row.status)}>{statusLabel[row.status] ?? row.status}</span></Td>
                    <Td>{row.credentials_status === "stored" ? "Salvas" : "Ausentes"}</Td>
                    <Td>{row.auto_sync_enabled ? "Ativa" : "Manual"}</Td>
                    <Td>{formatDateTime(row.last_sync_at)}</Td>
                    <Td>{row.latency_ms ? `${row.latency_ms} ms` : "—"}</Td>
                    <Td>{row.error_count ?? 0}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <LogPanel title="Últimas sincronizações" rows={runRows}>
          {(row) => (
            <LogItem
              key={row.id}
              title={`${formatProvider(row.provider_key)} · ${row.action}`}
              meta={`${statusLabel[row.trigger] ?? row.trigger} · ${formatDateTime(row.created_at)}`}
              status={row.status}
              detail={row.error ?? `${row.records_in} entrada(s), ${row.records_out} saída(s)`}
            />
          )}
        </LogPanel>

        <LogPanel title="Event Bus" rows={eventRows}>
          {(row) => (
            <LogItem
              key={row.id}
              title={row.event_type}
              meta={`${row.source} · ${formatDateTime(row.created_at)}`}
              status={row.status}
              detail={row.last_error ?? `${row.aggregate_type ?? "evento"} ${row.aggregate_id ?? ""}`.trim()}
            />
          )}
        </LogPanel>

        <LogPanel title="Alertas" rows={alertRows}>
          {(row) => (
            <LogItem
              key={row.id}
              title={row.title}
              meta={`${formatProvider(row.provider_key)} · ${formatDateTime(row.created_at)}`}
              status={row.status}
              detail={row.message}
              severity={row.severity}
            />
          )}
        </LogPanel>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const color = tone === "success" ? "#8fd486" : tone === "danger" ? "#e8a0a0" : "var(--gold-light)";
  return (
    <div className="glass" style={{ padding: 18 }}>
      <p className="eyebrow" style={{ marginBottom: 8 }}>{label}</p>
      <strong className="display" style={{ fontSize: 30, color }}>{value}</strong>
      <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>{detail}</p>
    </div>
  );
}

function LogPanel<T>({ title, rows, children }: { title: string; rows: T[]; children: (row: T) => ReactNode }) {
  return (
    <section className="glass" style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <p className="eyebrow">{title}</p>
      </div>
      {rows.length === 0 ? <EmptyState /> : <div style={{ display: "grid", gap: 10 }}>{rows.map(children)}</div>}
    </section>
  );
}

function LogItem({
  title,
  meta,
  status,
  detail,
  severity,
}: {
  title: string;
  meta: string;
  status: string;
  detail: string;
  severity?: string;
}) {
  return (
    <article style={logItemStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <strong style={{ fontSize: 12.5 }}>{title}</strong>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 10.5 }}>{meta}</p>
        </div>
        <span style={badgeStyle(severity ?? status)}>{statusLabel[status] ?? status}</span>
      </div>
      <p style={{ margin: "8px 0 0", color: "var(--cream-dim)", fontSize: 11.5, lineHeight: 1.5 }}>
        {detail || "Sem detalhes adicionais."}
      </p>
    </article>
  );
}

function EmptyState() {
  return <p className="muted" style={{ margin: 0, fontSize: 12 }}>Nenhum registro encontrado.</p>;
}

function Th({ children }: { children: ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={tdStyle}>{children}</td>;
}

const cardStyle: React.CSSProperties = {
  padding: 22,
  marginBottom: 16,
  overflow: "visible",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
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
  verticalAlign: "top",
};

const trStyle: React.CSSProperties = {
  background: "rgba(10,22,11,0.18)",
};

const logItemStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(242,236,223,0.1)",
  background: "rgba(10,22,11,0.28)",
};
