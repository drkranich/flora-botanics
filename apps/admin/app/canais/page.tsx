import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

/**
 * Canais de venda — status REAIS. O site próprio é o único conectado hoje;
 * os demais mostram seu estado verdadeiro (não conectado) e entram nas
 * fases de integração do roadmap. Cada card já tem o ponto de conexão.
 */
export default async function CanaisPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ count: products }, { count: orders }, { data: domain }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "published").is("deleted_at", null),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("tenant_domains").select("domain").eq("tenant_id", tenantId).eq("is_primary", true).maybeSingle(),
  ]);

  const channels = [
    {
      name: "Site próprio",
      icon: "✺",
      desc: `${domain?.domain ?? "—"} · ${products ?? 0} produtos à venda · ${orders ?? 0} pedidos`,
      status: "connected" as const,
      features: ["Produtos", "Pedidos", "Checkout Stripe", "Leads"],
      cta: { label: "Gerenciar", href: "/catalogo" },
    },
    {
      name: "WhatsApp Business",
      icon: "✆",
      desc: "Mensagens, recuperação de carrinho e atendimento.",
      status: "soon" as const,
      phase: "Fase 3 do roadmap",
      features: ["Mensagens", "Automações"],
    },
    {
      name: "Instagram Shop",
      icon: "◎",
      desc: "Vitrine no Instagram e DMs integradas à Inbox.",
      status: "soon" as const,
      phase: "Fase de canais",
      features: ["Produtos", "Mensagens"],
    },
    {
      name: "Mercado Livre",
      icon: "◈",
      desc: "Sincronize produtos, estoque, pedidos e perguntas.",
      status: "soon" as const,
      phase: "Fase de marketplaces",
      features: ["Produtos", "Estoque", "Pedidos", "Mensagens"],
    },
    {
      name: "Shopee",
      icon: "❖",
      desc: "Publicação de catálogo e importação de pedidos.",
      status: "soon" as const,
      phase: "Fase de marketplaces",
      features: ["Produtos", "Pedidos"],
    },
    {
      name: "Amazon",
      icon: "▣",
      desc: "Catálogo e pedidos no maior marketplace global.",
      status: "soon" as const,
      phase: "Fase de marketplaces",
      features: ["Produtos", "Pedidos"],
    },
    {
      name: "TikTok Shop",
      icon: "♪",
      desc: "Venda direto dos vídeos e lives.",
      status: "soon" as const,
      phase: "Fase de marketplaces",
      features: ["Produtos", "Pedidos"],
    },
    {
      name: "Google Merchant",
      icon: "✦",
      desc: "Produtos no Google Shopping e na busca.",
      status: "soon" as const,
      phase: "Fase de canais",
      features: ["Produtos", "Feed"],
    },
  ];

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Canais de venda</h1>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          Um catálogo, vários canais. Conecte cada plataforma quando a
          integração estiver disponível — o estoque e os pedidos convergem aqui.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {channels.map((c, i) => (
          <div key={c.name} className={`glass rise rise-${Math.min(i + 1, 4)}`} style={{ padding: "22px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 20, color: "var(--gold-light)" }}>{c.icon}</span>
              {c.status === "connected" ? (
                <span className="chip chip-live">Conectado</span>
              ) : (
                <span className="chip chip-draft">Não conectado</span>
              )}
            </div>
            <h2 style={{ fontSize: 14, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>{c.name}</h2>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>{c.desc}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {c.features.map((f) => (
                <span key={f} style={{ fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, border: "1px solid var(--glass-border)", color: "var(--cream-dim)" }}>
                  {f}
                </span>
              ))}
            </div>
            <div style={{ marginTop: "auto", paddingTop: 8 }}>
              {c.status === "connected" && c.cta ? (
                <Link href={c.cta.href} className="btn btn-gold" style={{ padding: "10px 20px", fontSize: 10 }}>
                  {c.cta.label}
                </Link>
              ) : (
                <span className="muted" style={{ fontSize: 10.5 }}>⏳ {c.phase}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
