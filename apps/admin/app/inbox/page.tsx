import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { NewConversationForm } from "./NewConversationForm";
import { CHANNEL_LABEL, CONVERSATION_STATUS_LABEL, formatRelative } from "./constants";

/**
 * Inbox — central de atendimento omnichannel.
 * Conversas reais (tabela `conversations`/`messages`) + leads do site.
 * Canais conectados (hoje: E-mail via Resend) enviam de verdade;
 * os demais ficam registrados aqui até a integração do canal.
 */

interface ConversationRow {
  id: string;
  channel: string;
  contact_name: string | null;
  contact_handle: string | null;
  status: string;
  unread_count: number;
  last_message_preview: string | null;
  last_message_at: string | null;
}

export default async function InboxPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: leads }, { data: conversations }] = await Promise.all([
    supabase
      .from("leads")
      .select("email, name, source, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("conversations")
      .select("id, channel, contact_name, contact_handle, status, unread_count, last_message_preview, last_message_at")
      .eq("tenant_id", tenantId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(30),
  ]);

  const rows = (conversations ?? []) as ConversationRow[];

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

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(280px, 1.4fr)", gap: 18 }}>
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

        {/* conversas reais */}
        <section className="glass rise rise-2" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <p className="eyebrow">Conversas</p>
            <NewConversationForm />
          </div>

          {rows.length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>
              Nenhuma conversa ainda. Crie a primeira com &quot;+ Nova conversa&quot; — para o
              canal E-mail, a mensagem é enviada de verdade via Resend.
            </p>
          ) : (
            rows.map((c) => (
              <Link
                key={c.id}
                href={`/inbox/${c.id}`}
                style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--glass-border)", textDecoration: "none", color: "inherit" }}
              >
                <span style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(185,146,77,0.18)", color: "var(--gold-light)", fontSize: 13, fontWeight: 700 }}>
                  {(c.contact_name ?? c.contact_handle ?? "?").charAt(0).toUpperCase()}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{c.contact_name ?? c.contact_handle ?? "—"}</p>
                    <span className="muted" style={{ fontSize: 10 }}>{formatRelative(c.last_message_at)}</span>
                  </div>
                  <p className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.last_message_preview ?? "—"}
                  </p>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, border: "1px solid var(--glass-border)", color: "var(--cream-dim)" }}>
                      {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </span>
                    <span style={{ fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(185,146,77,0.4)", color: "var(--gold-light)" }}>
                      {CONVERSATION_STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    {c.unread_count > 0 ? (
                      <span style={{ fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, background: "var(--gold)", color: "var(--forest-950)", fontWeight: 700 }}>
                        {c.unread_count} novas
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))
          )}

          <Link href="/canais" className="btn btn-ghost" style={{ padding: "10px 18px", fontSize: 9.5, marginTop: 14, display: "inline-block" }}>
            Ver canais disponíveis
          </Link>
        </section>
      </div>
    </main>
  );
}
