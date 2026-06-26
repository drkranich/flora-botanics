import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/supabase/server";
import { SalesTabs } from "@/app/vendas/Tabs";
import { listAbandonedCarts, getCartStats, type CartItem } from "@/lib/carts/actions";
import { RecoveryButton, DismissButton } from "./CartActions";

export const revalidate = 0;

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function timeAgo(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

function StatusChip({ status, sent }: { status: string; sent: boolean }) {
  if (status === "recovered") return <span className="chip chip-live">Recuperado</span>;
  if (status === "converted") return <span className="chip chip-live">Convertido</span>;
  if (sent) return <span className="chip chip-draft">Email enviado</span>;
  return <span className="chip chip-draft">Aguardando</span>;
}

export default async function CarrinhosPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  // A tabela carts pode ainda não existir se a migration 0019 não foi aplicada
  let carts: Awaited<ReturnType<typeof listAbandonedCarts>> = [];
  let stats = { totalAbandoned: 0, totalValueCents: 0, emailSent: 0, recovered: 0, recoveryRate: 0 };
  let migrationPending = false;

  try {
    [carts, stats] = await Promise.all([listAbandonedCarts(), getCartStats()]);
  } catch {
    migrationPending = true;
  }

  const abandoned30 = carts.filter((c) => c.minutes_abandoned >= 30);
  const recent = carts.filter((c) => c.minutes_abandoned < 30);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 28px 80px" }}>
      <SalesTabs />

      <h1 className="display" style={{ fontSize: 32, marginBottom: 28 }}>
        Carrinhos Abandonados
      </h1>

      {/* ── Aviso: migration pendente ── */}
      {migrationPending && (
        <div
          className="glass"
          style={{ padding: "24px 28px", borderRadius: 10, borderLeft: "3px solid #f87171", marginBottom: 28 }}
        >
          <p className="eyebrow" style={{ marginBottom: 8, color: "#f87171" }}>
            Migration pendente
          </p>
          <p className="muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.7 }}>
            A tabela <code>carts</code> ainda não existe no banco de dados.
            Aplique a migration abrindo o SQL Editor do Supabase e colando o conteúdo de{" "}
            <code>supabase/migrations/0019_abandoned_carts.sql</code>.
            <br />
            <a
              href="https://supabase.com/dashboard/project/mbpvzhcrimdwcqkqvoqr/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--gold-light)" }}
            >
              Abrir SQL Editor →
            </a>
          </p>
        </div>
      )}

      {/* ── Stats ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 32,
        }}
      >
        {[
          {
            label: "Abandonados",
            value: stats.totalAbandoned,
            sub: "há mais de 30min",
            accent: stats.totalAbandoned > 0,
          },
          {
            label: "Valor em risco",
            value: money(stats.totalValueCents),
            sub: "soma dos carrinhos",
            accent: stats.totalValueCents > 0,
          },
          {
            label: "E-mails enviados",
            value: stats.emailSent,
            sub: "recuperação enviada",
            accent: false,
          },
          {
            label: "Taxa de recuperação",
            value: `${stats.recoveryRate}%`,
            sub: `${stats.recovered} recuperado${stats.recovered !== 1 ? "s" : ""}`,
            accent: stats.recoveryRate > 0,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="glass"
            style={{ padding: "20px 22px", borderRadius: 10 }}
          >
            <p className="eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>
              {s.label}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                color: s.accent ? "var(--gold-light)" : "inherit",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.value}
            </p>
            <p className="muted" style={{ fontSize: 10, margin: "4px 0 0" }}>
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── Carrinhos prontos para remarketing ── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <p className="eyebrow" style={{ margin: 0 }}>Prontos para remarketing</p>
          {abandoned30.length > 0 && (
            <span
              style={{
                background: "var(--gold-light)",
                color: "#1a1a1a",
                borderRadius: 20,
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {abandoned30.length}
            </span>
          )}
        </div>

        {abandoned30.length === 0 ? (
          <div
            className="glass"
            style={{ padding: "32px 24px", textAlign: "center", borderRadius: 10 }}
          >
            <p className="muted" style={{ margin: 0 }}>
              Nenhum carrinho abandonado há mais de 30 minutos. 🎉
            </p>
          </div>
        ) : (
          <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  {["Cliente", "Itens", "Valor", "Abandonado há", "Status", "Ações"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        opacity: 0.6,
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {abandoned30.map((cart, i) => {
                  const items = cart.items as CartItem[];
                  const firstItem = items[0];
                  return (
                    <tr
                      key={cart.id}
                      style={{
                        borderBottom:
                          i < abandoned30.length - 1
                            ? "1px solid var(--glass-border)"
                            : "none",
                      }}
                    >
                      {/* Cliente */}
                      <td style={{ padding: "14px 16px" }}>
                        {cart.customer_email ? (
                          <>
                            <p style={{ margin: 0, fontWeight: 500 }}>
                              {cart.customer_name ?? "—"}
                            </p>
                            <p className="muted" style={{ margin: 0, fontSize: 11 }}>
                              {cart.customer_email}
                            </p>
                          </>
                        ) : (
                          <span className="muted" style={{ fontSize: 11 }}>
                            Anônimo (sem e-mail)
                          </span>
                        )}
                      </td>

                      {/* Itens */}
                      <td style={{ padding: "14px 16px" }}>
                        {firstItem ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {firstItem.image && (
                              <img
                                src={firstItem.image}
                                alt=""
                                width={36}
                                height={36}
                                style={{ borderRadius: 4, objectFit: "cover" }}
                              />
                            )}
                            <div>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 500 }}>
                                {firstItem.name}
                              </p>
                              {items.length > 1 && (
                                <p className="muted" style={{ margin: 0, fontSize: 10 }}>
                                  +{items.length - 1} produto{items.length > 2 ? "s" : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: 11 }}>Vazio</span>
                        )}
                      </td>

                      {/* Valor */}
                      <td style={{ padding: "14px 16px", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {money(cart.subtotal_cents)}
                      </td>

                      {/* Tempo */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            color:
                              cart.minutes_abandoned > 120
                                ? "#f87171"
                                : "var(--gold-light)",
                            fontWeight: 500,
                          }}
                        >
                          {timeAgo(cart.minutes_abandoned)}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px" }}>
                        <StatusChip
                          status={cart.status}
                          sent={!!cart.recovery_email_sent_at}
                        />
                        {cart.recovery_email_count > 0 && (
                          <p className="muted" style={{ margin: "4px 0 0", fontSize: 10 }}>
                            {cart.recovery_email_count}× enviado
                          </p>
                        )}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <RecoveryButton
                            cartId={cart.id}
                            hasEmail={!!cart.customer_email}
                          />
                          <DismissButton cartId={cart.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Carrinhos ativos recentes ── */}
      {recent.length > 0 && (
        <section>
          <p className="eyebrow" style={{ marginBottom: 14 }}>
            Carrinhos ativos (últimos 30min)
          </p>
          <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  {["Cliente", "Itens", "Valor", "Ativo há", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        opacity: 0.6,
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((cart, i) => {
                  const items = cart.items as CartItem[];
                  return (
                    <tr
                      key={cart.id}
                      style={{
                        borderBottom:
                          i < recent.length - 1
                            ? "1px solid var(--glass-border)"
                            : "none",
                        opacity: 0.75,
                      }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        {cart.customer_email ?? (
                          <span className="muted" style={{ fontSize: 11 }}>Anônimo</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>
                        {items.length} produto{items.length !== 1 ? "s" : ""}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                        {money(cart.subtotal_cents)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className="muted" style={{ fontSize: 11 }}>
                          {timeAgo(cart.minutes_abandoned)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className="chip chip-live" style={{ fontSize: 9 }}>Ativo</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Instrução do automático ── */}
      <div
        className="glass"
        style={{ marginTop: 32, padding: "20px 24px", borderRadius: 10, borderLeft: "3px solid var(--gold-light)" }}
      >
        <p className="eyebrow" style={{ marginBottom: 6 }}>Remarketing automático</p>
        <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.7 }}>
          Para envio automático a cada 30 minutos, execute a Edge Function <code>cart-recovery</code> no Supabase
          ou rode o comando abaixo na pasta do projeto:
          <br />
          <code style={{ fontSize: 11 }}>
            supabase functions deploy cart-recovery --project-ref mbpvzhcrimdwcqkqvoqr
          </code>
          <br />
          Em seguida, configure um pg_cron no SQL Editor para chamar a função automaticamente.
        </p>
      </div>
    </main>
  );
}
