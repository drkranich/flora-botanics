import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { MessageForm } from "../MessageForm";
import { StatusSelect } from "../StatusSelect";
import { CHANNEL_LABEL, formatDateTime } from "../constants";

interface MessageRow {
  id: string;
  direction: "in" | "out" | "note";
  sender_name: string | null;
  body: string;
  created_at: string;
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const { id } = await params;
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, channel, contact_name, contact_handle, status, created_at")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id, direction, sender_name, body, created_at")
      .eq("conversation_id", id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
  ]);

  if (!conversation) notFound();

  const rows = (messages ?? []) as MessageRow[];

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 26 }}>
        <Link href="/inbox" className="eyebrow" style={{ opacity: 0.8 }}>← Inbox</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
          <div>
            <h1 className="display" style={{ fontSize: 36 }}>
              {conversation.contact_name ?? conversation.contact_handle ?? "Conversa"}
            </h1>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {CHANNEL_LABEL[conversation.channel] ?? conversation.channel}
              {conversation.contact_handle ? ` · ${conversation.contact_handle}` : ""}
            </p>
          </div>
          <StatusSelect conversationId={conversation.id} status={conversation.status} />
        </div>
      </header>

      <section className="glass rise rise-1" style={{ padding: 24 }}>
        {rows.length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>Nenhuma mensagem ainda.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.direction === "in" ? "flex-start" : "flex-end",
                  maxWidth: "80%",
                  marginLeft: m.direction === "in" ? 0 : "auto",
                  background: m.direction === "in" ? "rgba(242, 236, 223, 0.06)" : "rgba(185, 146, 77, 0.14)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 12,
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--cream-dim)" }}>
                    {m.direction === "in" ? (conversation.contact_name ?? conversation.contact_handle ?? "Contato") : (m.sender_name ?? "Equipe")}
                    {m.direction === "note" ? " · nota interna" : ""}
                  </span>
                  <span className="muted" style={{ fontSize: 10 }}>{formatDateTime(m.created_at)}</span>
                </div>
                <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{m.body}</p>
              </div>
            ))}
          </div>
        )}

        <MessageForm conversationId={conversation.id} channel={conversation.channel} />
      </section>
    </main>
  );
}
