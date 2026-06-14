import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { setLogResolved } from "./actions";

const LEVEL_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Atenção",
  error: "Erro",
  critical: "Crítico",
};

const LEVEL_FILTERS = ["all", "info", "warning", "error", "critical"] as const;
const RESOLVED_FILTERS = [
  { value: "open", label: "Não resolvidos" },
  { value: "all", label: "Todos" },
  { value: "resolved", label: "Resolvidos" },
] as const;

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
}

function levelBadgeStyle(level: string): React.CSSProperties {
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

interface LogRow {
  id: string;
  level: string;
  source: string;
  message: string;
  context: Record<string, unknown> | null;
  resolved: boolean;
  created_at: string;
}

interface LogsPageProps {
  searchParams: Promise<{ level?: string; resolved?: string }>;
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const { level, resolved } = await searchParams;
  const staff = await currentStaff();
  if (!staff) return null;

  const levelFilter = LEVEL_FILTERS.includes(level as typeof LEVEL_FILTERS[number]) ? level : "all";
  const resolvedFilter = RESOLVED_FILTERS.some((r) => r.value === resolved) ? resolved! : "open";

  const supabase = await createClient();
  let query = supabase
    .from("system_logs")
    .select("id, level, source, message, context, resolved, created_at")
    .eq("tenant_id", staff.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (levelFilter && levelFilter !== "all") {
    query = query.eq("level", levelFilter);
  }
  if (resolvedFilter === "open") {
    query = query.eq("resolved", false);
  } else if (resolvedFilter === "resolved") {
    query = query.eq("resolved", true);
  }

  const { data } = await query;
  const logs = (data ?? []) as LogRow[];

  const buildHref = (overrides: { level?: string; resolved?: string }) => {
    const params = new URLSearchParams();
    const nextLevel = overrides.level ?? levelFilter;
    const nextResolved = overrides.resolved ?? resolvedFilter;
    if (nextLevel && nextLevel !== "all") params.set("level", nextLevel);
    if (nextResolved && nextResolved !== "open") params.set("resolved", nextResolved);
    const qs = params.toString();
    return qs ? `/logs?${qs}` : "/logs";
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Logs</h1>
        <p style={{ margin: 0, color: "#6b6354", fontSize: 14 }}>
          Erros e eventos do sistema (checkout, sincronização de marketplaces, NF-e, automações).
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {LEVEL_FILTERS.map((l) => (
            <Link key={l} href={buildHref({ level: l })} style={filterChipStyle(levelFilter === l)}>
              {l === "all" ? "Todos os níveis" : LEVEL_LABELS[l]}
            </Link>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {RESOLVED_FILTERS.map((r) => (
            <Link key={r.value} href={buildHref({ resolved: r.value })} style={filterChipStyle(resolvedFilter === r.value)}>
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {logs.length === 0 ? (
        <div style={cardStyle}>
          <p style={emptyStyle}>Nenhum log encontrado para este filtro.</p>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f2ecdf", textAlign: "left" }}>
                <th style={thStyle}>Nível</th>
                <th style={thStyle}>Origem</th>
                <th style={thStyle}>Mensagem</th>
                <th style={thStyle}>Quando</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderTop: "1px solid #f2ecdf" }}>
                  <td style={tdStyle}>
                    <span style={levelBadgeStyle(log.level)}>{LEVEL_LABELS[log.level] ?? log.level}</span>
                  </td>
                  <td style={tdStyle}>{log.source}</td>
                  <td style={tdStyle}>
                    {log.message}
                    {log.context && (
                      <div style={{ fontSize: 12, color: "#6b6354", marginTop: 2, fontFamily: "monospace" }}>
                        {JSON.stringify(log.context)}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>{formatDateTime(log.created_at)}</td>
                  <td style={tdStyle}>
                    <form action={setLogResolved.bind(null, log.id, !log.resolved)}>
                      <button type="submit" style={resolveButtonStyle}>
                        {log.resolved ? "Reabrir" : "Marcar resolvido"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e6ddc9",
  borderRadius: 12,
  padding: 20,
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

const emptyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#6b6354",
};

const resolveButtonStyle: React.CSSProperties = {
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

function filterChipStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid " + (active ? "#28251d" : "#e6ddc9"),
    background: active ? "#28251d" : "#fff",
    color: active ? "#fdfbf6" : "#28251d",
    textDecoration: "none",
  };
}
