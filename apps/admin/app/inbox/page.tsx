import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

/**
 * Inbox — central de atendimento omnichannel.
 * Estrutura pronta para WhatsApp/Instagram/E-mail (fases de integração).
 * Hoje mostra o canal real existente (leads do site) + uma prévia
 * claramente rotulada de como ficará com os canais conectados.
 */

const DEMO = [
  { nome: "Ana Beatriz", canal: "WhatsApp", msg: "Oi! O sérum de andiroba serve para pele oleosa?", tempo: "há 12 min", status: "Novo" },
  { nome: "Carla M.", canal: "Instagram", msg: "Amei o reels! Quando chega o óleo de buriti?", tempo: "há 1 h", status: "Em atendimento" },
  { nome: "Juliana S.", canal: "E-mail", msg: "Pedido #12 — posso trocar o endereço de entrega?", tempo: "há 3 h", status: "Aguardando" },
];

export default async function InboxPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: leads } = await supabase
    .from("leads")
    .select("email, name, source, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.8 }}>← Painel</Link>
        <h1 className="display" style={{ fontSize: 44, marginTop: 10 }}>Inbox</h1>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          Todas as conversas da marca em um lugar só — WhatsApp, Instagram,
          e-mail e chat do site convergem aqui conforme os canais forem conectados.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(280px, 1fr)", gap: 18 }}>
        {/* canal real: leads do site */}
        <section className="glass rise rise-1" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p className="eyebrow">Site · Leads</p>
            <span className="chip chip-live">Ativo</span>
          </div>
          {(leads ?? []).length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>
              Os cadastros da newsletter aparecem aqui em tempo real.
            </p>
          ) : (
            (leads ?? []).map((l, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--glass-border)" }}>
                <div>
                  <p style={{ fontSize: 13 }}>{l.name ?? l.email}</p>
                  <p className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{l.email}</p>
                </div>
                <span className="muted" style={{ fontSize: 10 }}>
                  {new Date(l.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))
          )}
          <Link href="/vendas/clientes" className="btn btn-ghost" style={{ padding: "10px 18px", fontSize: 9.5, marginTop: 14 }}>
            Ver todos
          </Link>
        </section>

        {/* prévia rotulada dos canais futuros */}
        <section className="glass rise rise-2" style={{ padding: 24, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p className="eyebrow">Conversas</p>
            <span className="chip chip-draft">Prévia · demonstração</span>
          </div>
          <div style={{ opacity: 0.75 }}>
            {DEMO.map((c) => (
              <div key={c.nome} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--glass-border)" }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(185,146,77,0.18)", color: "var(--gold-light)", fontSize: 13, fontWeight: 700 }}>
                  {c.nome.charAt(0)}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{c.nome}</p>
                    <span className="muted" style={{ fontSize: 10 }}>{c.tempo}</span>
                  </div>
                  <p className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.msg}</p>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, border: "1px solid var(--glass-border)", color: "var(--cream-dim)" }}>{c.canal}</span>
                    <span style={{ fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(185,146,77,0.4)", color: "var(--gold-light)" }}>{c.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 16, lineHeight: 1.6 }}>
            Assim ficará sua central quando o WhatsApp Business for conectado
            (Fase 3) — lista de conversas, chat e painel do cliente com pedidos
            e carrinho. As conversas acima são ilustrativas.
          </p>
          <Link href="/canais" className="btn btn-gold" style={{ padding: "10px 20px", fontSize: 10, marginTop: 12 }}>
            Ver canais disponíveis
          </Link>
        </section>
      </div>
    </main>
  );
}
