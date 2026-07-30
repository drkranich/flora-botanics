/**
 * /financeiro/tabelas — Tabelas de preço e regras comerciais
 */

import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { PriceTableForm } from "../PriceTableForm";
import { deletePriceTable } from "../actions";

export const dynamic = "force-dynamic";

type PriceTableRow = {
  id: string;
  name: string;
  table_type: string;
  channel: string | null;
  customer_name: string | null;
  min_quantity: number;
  discount_percent: number;
  commission_percent: number;
  minimum_margin_percent: number;
  approval_required: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export default async function TabelasPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("finance_price_tables")
    .select("id, name, table_type, channel, customer_name, min_quantity, discount_percent, commission_percent, minimum_margin_percent, approval_required, valid_from, valid_until, created_at")
    .eq("tenant_id", session.tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as PriceTableRow[];

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 28px 80px" }}>
      <nav style={{ fontSize: 13, color: "var(--cream-dim, #a09880)", marginBottom: 20, display: "flex", gap: 8 }}>
        <Link href="/financeiro" style={{ color: "inherit", textDecoration: "none" }}>Financeiro</Link>
        <span>/</span>
        <span style={{ color: "var(--color-heading, #f1ede5)" }}>Tabelas de Preço</span>
      </nav>
      <header style={{ marginBottom: 28 }}>
        <h1 className="display" style={{ fontSize: 38 }}>Tabelas de Preço</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Regras de desconto, comissão e aprovação por canal, cliente ou volume.
        </p>
      </header>

      {/* Lista de tabelas */}
      <section className="glass" style={{ padding: 22, borderRadius: 16, marginBottom: 24 }}>
        <p className="eyebrow" style={{ marginBottom: 16 }}>Tabelas ativas</p>
        {rows.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Nenhuma tabela criada ainda. Use o formulário abaixo para criar regras de atacado, B2B, representantes, marketplaces e campanhas.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--glass-border)", color: "var(--cream-dim)" }}>
                  <th style={thStyle}>Nome</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Canal</th>
                  <th style={thStyle}>Mín. qtd</th>
                  <th style={thStyle}>Desconto</th>
                  <th style={thStyle}>Comissão</th>
                  <th style={thStyle}>Margem mín.</th>
                  <th style={thStyle}>Validade</th>
                  <th style={thStyle}>Aprovação</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid rgba(242,236,223,0.06)" }}>
                    <td style={tdStyle}>
                      <strong>{t.name}</strong>
                      {t.customer_name && (
                        <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 2 }}>{t.customer_name}</span>
                      )}
                    </td>
                    <td style={tdStyle}><span className="chip chip-draft">{t.table_type}</span></td>
                    <td style={tdStyle}>{t.channel ?? "—"}</td>
                    <td style={tdStyle}>{t.min_quantity}</td>
                    <td style={tdStyle}>{Number(t.discount_percent).toFixed(1)}%</td>
                    <td style={tdStyle}>{Number(t.commission_percent).toFixed(1)}%</td>
                    <td style={tdStyle}>{Number(t.minimum_margin_percent).toFixed(1)}%</td>
                    <td style={{ ...tdStyle, fontSize: 11 }}>
                      {t.valid_from ? fmtDate(t.valid_from) : "—"}
                      {t.valid_until ? ` → ${fmtDate(t.valid_until)}` : ""}
                    </td>
                    <td style={tdStyle}>
                      <span className={t.approval_required ? "chip" : "chip chip-live"} style={{ fontSize: 11 }}>
                        {t.approval_required ? "Requer" : "Livre"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <form action={deletePriceTable.bind(null, t.id)}>
                        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>
                          Excluir
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Formulário de criação */}
      <PriceTableForm />
    </main>
  );
}

const thStyle: CSSProperties = { padding: "10px 12px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 };
const tdStyle: CSSProperties = { padding: "12px", verticalAlign: "middle" };
