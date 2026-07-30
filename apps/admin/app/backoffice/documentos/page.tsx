/**
 * /backoffice/documentos — Cofre Documental
 *
 * Rota destino dos chips de pasta do InternationalTradeCenter.
 * Filtra fiscal_vault_documents por category/pasta e mostra o conteúdo.
 */

import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";

// ─── Mapeamento slug → label legível ──────────────────────────────────────────

const PASTA_LABELS: Record<string, string> = {
  "operacoes":         "Operações",
  "nfe-exportacao":    "NF-e de Exportação",
  "due":               "DU-E",
  "commercial-invoices": "Commercial Invoices",
  "proforma-invoices": "Pro Forma Invoices",
  "packing-lists":     "Packing Lists",
  "certificados-origem": "Certificados de Origem",
  "lpco":              "LPCO",
  "sanitarios":        "Documentos Sanitários",
  "fretes":            "Fretes",
  "seguros":           "Seguros",
  "cambio":            "Câmbio",
  "impostos-destino":  "Impostos no Destino",
  "comprovantes":      "Comprovantes",
  "registros-fiscais": "Registros Fiscais",
  "importadores":      "Importadores",
  "marketplaces":      "Marketplaces",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  padding: "32px 24px",
  maxWidth: 1100,
  margin: "0 auto",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 28,
};

const titleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "var(--color-heading, #f1ede5)",
};

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--color-muted, #8a9580)",
  marginTop: 4,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--color-muted, #8a9580)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: CSSProperties = {
  padding: "12px 12px",
  fontSize: 13,
  color: "var(--color-text, #e8e3d9)",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  verticalAlign: "middle",
};

const badgeStyle = (status: string): CSSProperties => {
  const map: Record<string, string> = {
    received:  "#3a8a3a",
    reviewed:  "#2a6a8a",
    approved:  "#2a7a4a",
    archived:  "#5a5a5a",
    pending:   "#7a6a2a",
    rejected:  "#8a2a2a",
  };
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background: map[status] ?? "#444",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  };
};

const emptyStyle: CSSProperties = {
  textAlign: "center",
  padding: "48px 24px",
  color: "var(--color-muted, #8a9580)",
  fontSize: 14,
};

const breadcrumbStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: 13,
  color: "var(--color-muted, #8a9580)",
  marginBottom: 20,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("pt-BR"); } catch { return v; }
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    received:  "Recebido",
    reviewed:  "Revisado",
    approved:  "Aprovado",
    archived:  "Arquivado",
    pending:   "Pendente",
    rejected:  "Rejeitado",
  };
  return map[s] ?? s;
}

// ─── Component ────────────────────────────────────────────────────────────────

type VaultDoc = {
  id: string;
  name: string;
  document_type: string;
  category: string | null;
  competence: string | null;
  due_date: string | null;
  value_cents: number;
  status: string;
  verification_status: string;
  origin: string;
  updated_at: string;
};

export const dynamic = "force-dynamic";

export default async function BackofficeDocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const params = await searchParams;
  const pasta = String(params.pasta ?? "").toLowerCase();
  const pastaLabel = PASTA_LABELS[pasta] ?? pasta ?? "Todos";

  const supabase = await createClient();

  // Busca pastas do cofre para exibir no sidebar
  const { data: folders } = await supabase
    .from("document_vault_folders")
    .select("id, name, parent_id")
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(80);

  // Busca documentos — filtra por category correspondente ao slug de pasta
  let docsQuery = supabase
    .from("fiscal_vault_documents")
    .select("id, name, document_type, category, competence, due_date, value_cents, status, verification_status, origin, updated_at")
    .eq("tenant_id", staff.tenantId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (pasta) {
    // Tenta filtrar por category (slug) ou pelo label traduzido
    docsQuery = docsQuery.or(`category.ilike.%${pasta}%,category.ilike.%${pastaLabel}%`);
  }

  const { data: docs } = await docsQuery;
  const vaultDocs = (docs ?? []) as VaultDoc[];

  return (
    <div style={pageStyle}>
      {/* Breadcrumb */}
      <nav style={breadcrumbStyle}>
        <Link href="/backoffice/notas-fiscais" style={{ color: "inherit", textDecoration: "none" }}>
          Notas Fiscais
        </Link>
        <span>/</span>
        <Link href="/backoffice/notas-fiscais/cofre" style={{ color: "inherit", textDecoration: "none" }}>
          Cofre Fiscal
        </Link>
        {pasta && (
          <>
            <span>/</span>
            <span style={{ color: "var(--color-text, #e8e3d9)" }}>{pastaLabel}</span>
          </>
        )}
      </nav>

      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>
            {pasta ? `Pasta: ${pastaLabel}` : "Cofre Documental"}
          </div>
          <div style={subtitleStyle}>
            {vaultDocs.length} documento{vaultDocs.length !== 1 ? "s" : ""} encontrado{vaultDocs.length !== 1 ? "s" : ""}
            {pasta && " nesta pasta"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link href="/backoffice/notas-fiscais/cofre" className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 13 }}>
            Ver cofre completo
          </Link>
        </div>
      </div>

      {/* Chips de outras pastas */}
      {(folders ?? []).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          <Link
            href="/backoffice/documentos"
            className={`fiscal-chip ${!pasta ? "fiscal-chip-authorized" : "fiscal-chip-draft"}`}
            style={{ textDecoration: "none" }}
          >
            Todos
          </Link>
          {Object.entries(PASTA_LABELS).map(([slug, label]) => (
            <Link
              key={slug}
              href={`/backoffice/documentos?pasta=${slug}`}
              className={`fiscal-chip ${pasta === slug ? "fiscal-chip-authorized" : "fiscal-chip-draft"}`}
              style={{ textDecoration: "none" }}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Tabela de documentos */}
      <div className="glass" style={{ padding: 0, borderRadius: 12, overflow: "hidden" }}>
        {vaultDocs.length === 0 ? (
          <div style={emptyStyle}>
            {pasta
              ? `Nenhum documento encontrado na pasta "${pastaLabel}".`
              : "Nenhum documento no cofre ainda."}
            <br />
            <Link
              href="/backoffice/notas-fiscais/cofre"
              style={{ color: "var(--color-gold, #c8a84b)", marginTop: 12, display: "inline-block" }}
            >
              Ir para o Cofre Fiscal completo →
            </Link>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Competência</th>
                <th style={thStyle}>Vencimento</th>
                <th style={thStyle}>Valor</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {vaultDocs.map((doc) => (
                <tr key={doc.id}>
                  <td style={tdStyle}>
                    <Link
                      href={`/backoffice/notas-fiscais/cofre`}
                      style={{ color: "inherit", textDecoration: "none", fontWeight: 500 }}
                    >
                      {doc.name}
                    </Link>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--color-muted, #8a9580)", fontSize: 12 }}>
                    {doc.document_type}
                  </td>
                  <td style={tdStyle}>{doc.competence ?? "—"}</td>
                  <td style={tdStyle}>{formatDate(doc.due_date)}</td>
                  <td style={tdStyle}>{money(doc.value_cents)}</td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(doc.status)}>{statusLabel(doc.status)}</span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--color-muted, #8a9580)" }}>
                    {formatDate(doc.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pastas do cofre (fallback de navegação) */}
      {(folders ?? []).length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted, #8a9580)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Pastas no cofre
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(folders ?? []).map((f) => (
              <Link
                key={f.id}
                href="/backoffice/notas-fiscais/cofre"
                className="fiscal-chip fiscal-chip-draft"
                style={{ textDecoration: "none" }}
                title={f.name}
              >
                {f.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
