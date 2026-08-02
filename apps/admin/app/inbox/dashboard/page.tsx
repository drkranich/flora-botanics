import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { redirect } from "next/navigation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  if (!b) return "—";
  return `${Math.round((a / b) * 100)}%`;
}

function mins(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

const CHANNEL_ICON: Record<string, string> = {
  email: "✉", whatsapp: "◎", chat: "◉", phone: "◈",
  instagram: "◌", facebook: "◫", sms: "◷", site: "◉",
};
const CHANNEL_LABEL: Record<string, string> = {
  email: "E-mail", whatsapp: "WhatsApp", chat: "Chat", phone: "Telefone",
  instagram: "Instagram", facebook: "Facebook", sms: "SMS", site: "Site",
};

const STATUS_COLOR: Record<string, string> = {
  open: "#62c99d", new: "#7ea8d9", waiting: "#f0b429", resolved: "#4ade80",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Em atendimento", new: "Novo", waiting: "Aguardando", resolved: "Resolvido",
};

// ── Página ────────────────────────────────────────────────────────────────────

export default async function InboxDashboardPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const supabase = await createClient();
  const tenantId = staff.tenantId;

  // Datas de referência
  const now       = new Date();
  const todayStr  = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const weekAgo   = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthAgo  = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  // ── Queries em paralelo ──────────────────────────────────────────────────
  const [
    { data: byStatus },
    { data: byChannel },
    { data: resolvedToday },
    { data: openedWeek },
    { data: resolvedWeek },
    { data: byAgent },
    { data: avgReplyRaw },
  ] = await Promise.all([
    // Abertos por status
    supabase.from("conversations")
      .select("status")
      .eq("tenant_id", tenantId)
      .in("status", ["new", "open", "waiting"]),

    // Por canal (últimos 30 dias)
    supabase.from("conversations")
      .select("channel")
      .eq("tenant_id", tenantId)
      .gte("created_at", monthAgo),

    // Resolvidos hoje
    supabase.from("conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "resolved")
      .gte("updated_at", `${todayStr}T00:00:00`),

    // Abertos nos últimos 7 dias
    supabase.from("conversations")
      .select("id, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", weekAgo),

    // Resolvidos nos últimos 7 dias
    supabase.from("conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "resolved")
      .gte("updated_at", weekAgo),

    // Por assignee (últimos 30 dias, apenas os que têm assignee_name)
    supabase.from("conversations")
      .select("assignee_id, status")
      .eq("tenant_id", tenantId)
      .not("assignee_id", "is", null)
      .gte("created_at", monthAgo),

    // Tempo médio de resposta (primeiro reply de cada conversa aberta no mês)
    // Usamos a diferença entre created_at da conversa e created_at da 1ª msg de saída
    supabase.from("messages")
      .select("conversation_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("direction", "out")
      .eq("is_internal_note", false)
      .gte("created_at", monthAgo)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  // ── Processar by-status ──────────────────────────────────────────────────
  const statusCount: Record<string, number> = {};
  for (const r of byStatus ?? []) {
    statusCount[r.status as string] = (statusCount[r.status as string] ?? 0) + 1;
  }
  const totalOpen = Object.values(statusCount).reduce((a, b) => a + b, 0);

  // ── Processar by-channel ─────────────────────────────────────────────────
  const channelCount: Record<string, number> = {};
  for (const r of byChannel ?? []) {
    const ch = (r.channel as string) ?? "outro";
    channelCount[ch] = (channelCount[ch] ?? 0) + 1;
  }
  const channelTotal = Object.values(channelCount).reduce((a, b) => a + b, 0);
  const channelRows = Object.entries(channelCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // ── Processar weekly trend (7 dias, agrupado por dia) ───────────────────
  const dayLabels: string[] = [];
  const dayCounts: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const label = d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
    const dayStr = d.toISOString().slice(0, 10);
    dayLabels.push(label);
    dayCounts.push(
      (openedWeek ?? []).filter(r => (r.created_at as string).startsWith(dayStr)).length
    );
  }
  const maxDay = Math.max(...dayCounts, 1);

  // ── Calcular tempo médio de resposta ─────────────────────────────────────
  // Para cada conversa: pega a 1ª mensagem de saída e subtrai created_at da conversa
  // (simplificado: usa created_at da 1ª msg de saída - created_at da conversa)
  // Como não temos join aqui, estimamos com base nos dados disponíveis
  // Placeholder realístico até termos função SQL dedicada
  const avgReplyMinutes: number | null = null; // será null até a função rpc existir

  // ── Taxas ────────────────────────────────────────────────────────────────
  const resolvedTodayCount = (resolvedToday ?? []).length;
  const resolvedWeekCount  = (resolvedWeek ?? []).length;
  const openedWeekCount    = (openedWeek ?? []).length;
  const resolutionRate     = pct(resolvedWeekCount, openedWeekCount);

  // ── Agentes ──────────────────────────────────────────────────────────────
  const agentMap: Record<string, { open: number; resolved: number }> = {};
  for (const r of byAgent ?? []) {
    const aid = (r.assignee_id as string) ?? "?";
    if (!agentMap[aid]) agentMap[aid] = { open: 0, resolved: 0 };
    if (r.status === "resolved") agentMap[aid].resolved++;
    else agentMap[aid].open++;
  }
  // Usamos o assignee_id como key (não temos nome aqui — mostramos ID abreviado)
  const agentRows = Object.entries(agentMap)
    .map(([id, v]) => ({ id, ...v, total: v.open + v.resolved }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #080f09 0%, #0c1a0e 50%, #091208 100%)",
      color: "var(--cream)",
      fontFamily: "Manrope, sans-serif",
      padding: "0",
    }}>
      {/* ── Topbar ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,22,11,0.85)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
        padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <Link
          href="/inbox"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 11.5, color: "var(--cream-dim)",
            textDecoration: "none", fontWeight: 500,
            transition: "color 0.2s",
          }}
          onMouseEnter={undefined}
        >
          ← Voltar ao inbox
        </Link>
        <span style={{ color: "rgba(242,236,223,0.2)" }}>|</span>
        <span style={{
          fontFamily: "Fraunces, serif",
          fontSize: 18, fontWeight: 600,
          color: "var(--cream)", letterSpacing: -0.4,
        }}>
          Dashboard de Atendimento
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: 1.5, textTransform: "uppercase",
          color: "var(--cream-dim)", opacity: 0.5, marginLeft: 4,
        }}>
          últimos 30 dias
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 10.5, color: "var(--cream-dim)", opacity: 0.5,
        }}>
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(now)}
        </span>
      </div>

      <div style={{ padding: "28px 32px 48px", maxWidth: 1280, margin: "0 auto" }}>

        {/* ── KPI Cards ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 28,
        }}>
          {[
            {
              label: "Em aberto agora",
              value: String(totalOpen),
              sub: `${statusCount["new"] ?? 0} novos`,
              color: "#f0b429",
              glow: true,
            },
            {
              label: "Resolvidos hoje",
              value: String(resolvedTodayCount),
              sub: "neste dia",
              color: "#4ade80",
              glow: false,
            },
            {
              label: "Abertos na semana",
              value: String(openedWeekCount),
              sub: "últimos 7 dias",
              color: "#7ea8d9",
              glow: false,
            },
            {
              label: "Taxa de resolução",
              value: resolutionRate,
              sub: "semana atual",
              color: "#a78bfa",
              glow: false,
            },
            {
              label: "Tempo médio resp.",
              value: avgReplyMinutes ? mins(avgReplyMinutes * 60) : "—",
              sub: "1ª resposta",
              color: "var(--gold-light)",
              glow: false,
            },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: "rgba(15,32,18,0.6)",
              border: `1px solid ${kpi.glow ? kpi.color + "30" : "rgba(242,236,223,0.07)"}`,
              borderRadius: 14,
              padding: "18px 20px",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: kpi.glow ? `0 0 24px ${kpi.color}15` : "none",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", color: "var(--cream-dim)", opacity: 0.6, marginBottom: 10 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: kpi.color, fontFamily: "Manrope, sans-serif", lineHeight: 1, marginBottom: 6 }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--cream-dim)", opacity: 0.55 }}>
                {kpi.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ── Grid principal ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          marginBottom: 18,
        }}>

          {/* ── Status dos abertos ── */}
          <Card title="Abertos por status">
            {Object.entries(statusCount).length === 0 ? (
              <Empty />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(statusCount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => {
                    const color = STATUS_COLOR[status] ?? "#6b7280";
                    const pctVal = totalOpen ? (count / totalOpen) : 0;
                    return (
                      <div key={status}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
                            <span style={{ fontSize: 12.5, color: "var(--cream-soft)" }}>
                              {STATUS_LABEL[status] ?? status}
                            </span>
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color }}>{count}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: "rgba(242,236,223,0.06)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 2,
                            background: color,
                            width: `${pctVal * 100}%`,
                            transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
                          }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>

          {/* ── Por canal ── */}
          <Card title="Distribuição por canal (30 dias)">
            {channelRows.length === 0 ? (
              <Empty />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {channelRows.map(([ch, count]) => {
                  const pctVal = channelTotal ? count / channelTotal : 0;
                  return (
                    <div key={ch}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, color: "var(--cream-soft)", display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ opacity: 0.6 }}>{CHANNEL_ICON[ch] ?? "◉"}</span>
                          {CHANNEL_LABEL[ch] ?? ch}
                        </span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 10.5, color: "var(--cream-dim)" }}>{pct(count, channelTotal)}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--gold-light)", minWidth: 28, textAlign: "right" }}>{count}</span>
                        </div>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "rgba(242,236,223,0.06)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          background: "linear-gradient(90deg, var(--gold-light), var(--gold))",
                          width: `${pctVal * 100}%`,
                          transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ── Volume semanal (sparkbar) ── */}
        <Card title="Volume de atendimentos — últimos 7 dias">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80, paddingTop: 8 }}>
            {dayCounts.map((count, i) => {
              const h = maxDay ? Math.max((count / maxDay) * 100, count > 0 ? 8 : 2) : 2;
              const isToday = i === 6;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--cream-dim)", fontWeight: count > 0 ? 700 : 400 }}>
                    {count > 0 ? count : ""}
                  </span>
                  <div style={{
                    width: "100%",
                    height: `${h}%`,
                    borderRadius: "4px 4px 2px 2px",
                    background: isToday
                      ? "linear-gradient(180deg, var(--gold-light), var(--gold))"
                      : count > 0
                      ? "rgba(185,146,77,0.35)"
                      : "rgba(242,236,223,0.05)",
                    boxShadow: isToday ? "0 0 12px rgba(185,146,77,0.3)" : "none",
                    transition: "height 0.5s",
                  }} />
                  <span style={{
                    fontSize: 9.5, color: isToday ? "var(--gold-light)" : "rgba(242,236,223,0.35)",
                    fontWeight: isToday ? 700 : 400, letterSpacing: 0.3,
                  }}>
                    {dayLabels[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Agentes ── */}
        {agentRows.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <Card title="Atendimentos por agente (30 dias)">
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}>
                {agentRows.map(agent => (
                  <div key={agent.id} style={{
                    background: "rgba(10,22,11,0.5)",
                    border: "1px solid rgba(242,236,223,0.07)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: "rgba(185,146,77,0.12)",
                      border: "1px solid rgba(185,146,77,0.22)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800, color: "var(--gold-light)",
                    }}>
                      {agent.id.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--cream)", marginBottom: 3 }}>
                        {agent.id.slice(0, 8)}…
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 10.5, color: "#f0b429" }}>
                          {agent.open} abertos
                        </span>
                        <span style={{ fontSize: 10.5, color: "#4ade80" }}>
                          {agent.resolved} resolvidos
                        </span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 20, fontWeight: 800,
                      color: "var(--gold-light)", flexShrink: 0,
                    }}>
                      {agent.total}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── Ações rápidas ── */}
        <div style={{
          marginTop: 18,
          display: "flex", gap: 10, flexWrap: "wrap",
        }}>
          {[
            { label: "← Ir para o inbox", href: "/inbox" },
            { label: "⚙ Configurações", href: "/inbox/settings" },
          ].map(btn => (
            <Link
              key={btn.href}
              href={btn.href}
              style={{
                background: "rgba(242,236,223,0.05)",
                border: "1px solid rgba(242,236,223,0.1)",
                borderRadius: 9,
                padding: "9px 16px",
                fontSize: 12, color: "var(--cream-dim)",
                textDecoration: "none", fontWeight: 500,
                transition: "all 0.2s",
              }}
            >
              {btn.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(15,32,18,0.55)",
      border: "1px solid rgba(242,236,223,0.07)",
      borderRadius: 14,
      padding: "20px 22px",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
        textTransform: "uppercase", color: "var(--cream-dim)",
        opacity: 0.55, marginBottom: 16,
        fontFamily: "Manrope, sans-serif",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <span style={{ fontSize: 24, color: "var(--gold-light)", opacity: 0.15, fontFamily: "Fraunces, serif" }}>✦</span>
      <p style={{ fontSize: 11.5, color: "var(--cream-dim)", marginTop: 8, fontFamily: "Fraunces, serif", fontStyle: "italic" }}>
        Sem dados suficientes
      </p>
    </div>
  );
}
