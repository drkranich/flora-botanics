/**
 * /financeiro — Hub do módulo Financeiro
 * Cada módulo tem sua própria página.
 */

import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FinanceiroHubPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const supabase = await supabaseServer();
  const tenantId = session.tenantId;

  const [{ count: numCenarios }, { count: numQuotes }, { count: numTabelas }, { data: calcSummary }] =
    await Promise.all([
      supabase
        .from("finance_calculations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("commercial_quotes")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("finance_price_tables")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("finance_calculations")
        .select("totals")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const totalRevenue = (calcSummary ?? []).reduce(
    (s: number, r: { totals?: Record<string, number> }) => s + (r.totals?.netRevenueCents ?? 0),
    0,
  );

  const modules = [
    {
      href: "/financeiro/calculadora",
      emoji: "🧮",
      title: "Calculadora de Custos",
      desc: "Monte cenários de preço com margens, impostos, comissões e frete.",
      badge: numCenarios ? `${numCenarios} cenários` : null,
    },
    {
      href: "/financeiro/cenarios",
      emoji: "📊",
      title: "Cenários Salvos",
      desc: "Histórico de simulações com receita, custo, lucro e alertas.",
      badge: totalRevenue > 0 ? money(totalRevenue) : null,
    },
    {
      href: "/financeiro/tabelas",
      emoji: "🏷️",
      title: "Tabelas de Preço",
      desc: "Regras por canal, cliente, volume: atacado, B2B, representantes.",
      badge: numTabelas ? `${numTabelas} tabelas` : null,
    },
    {
      href: "/financeiro/documentos",
      emoji: "📄",
      title: "Documentos Comerciais",
      desc: "Orçamentos, cotações e propostas com rastreamento de status.",
      badge: numQuotes ? `${numQuotes} documentos` : null,
    },
    {
      href: "/financeiro/configuracoes",
      emoji: "⚙️",
      title: "Configurações",
      desc: "Margem alvo, impostos, taxas de pagamento e overhead padrão.",
      badge: null,
    },
    {
      href: "/financeiro/stripe",
      emoji: "💳",
      title: "Stripe: Catálogo e Preços",
      desc: "Sincronize produtos e preços com o Stripe para pagamentos online.",
      badge: null,
    },
    {
      href: "/contabilidade",
      emoji: "📒",
      title: "Contabilidade",
      desc: "Receitas reais, custos, fluxo de caixa e exportação contábil.",
      badge: null,
    },
    {
      href: "/financeiro/exportar",
      emoji: "📤",
      title: "Exportar Relatórios",
      desc: "Exporte cenários, margens e documentos em CSV, PDF ou XLSX.",
      badge: null,
    },
  ];

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 32 }}>
        <Link href="/" style={backLinkStyle}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 42, marginTop: 10 }}>Financeiro</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Precificação, margens, orçamentos, tabelas comerciais e integração de pagamento.
        </p>
      </header>

      <div style={gridStyle}>
        {modules.map((mod) => (
          <Link key={mod.href} href={mod.href} style={{ textDecoration: "none" }}>
            <article className="glass" style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>{mod.emoji}</span>
                {mod.badge && (
                  <span className="chip chip-draft" style={{ fontSize: 11 }}>{mod.badge}</span>
                )}
              </div>
              <h2 style={cardTitleStyle}>{mod.title}</h2>
              <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.6 }}>{mod.desc}</p>
            </article>
          </Link>
        ))}
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: "48px 28px 80px" };
const backLinkStyle: CSSProperties = { fontSize: 13, opacity: 0.7, textDecoration: "none", color: "var(--cream-dim, #a09880)" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 };
const cardStyle: CSSProperties = { padding: "22px 22px 20px", borderRadius: 16, cursor: "pointer", height: "100%", display: "flex", flexDirection: "column", transition: "opacity .15s" };
const cardTitleStyle: CSSProperties = { fontSize: 16, fontWeight: 700, color: "var(--color-heading, #f1ede5)", margin: "0 0 8px" };
