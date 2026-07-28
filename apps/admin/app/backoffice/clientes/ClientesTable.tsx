"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GlassDateInput } from "@/components/GlassDateInput";
import {
  updateCustomerFull,
  archiveCustomer,
  unarchiveCustomer,
  deleteCustomer,
} from "./actions";

export interface CustomerRow {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  birthday: string | null;
  notes: string | null;
  tags: string[];
  accepts_marketing: boolean;
  archived_at: string | null;
}

const inputS: React.CSSProperties = {
  background: "rgba(10,22,11,0.5)",
  border: "1px solid var(--glass-border)",
  borderRadius: 7,
  padding: "7px 10px",
  color: "var(--cream)",
  fontSize: 12,
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
};

const labelS: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--cream-dim)",
  display: "block",
  marginBottom: 3,
};

function formatBirthday(v: string | null) {
  if (!v) return "—";
  const [, month, day] = v.split("-");
  return `${day}/${month}`;
}

function CustomerEditRow({
  customer,
  onClose,
}: {
  customer: CustomerRow;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateCustomerFull(customer.id, formData);
      if (res.ok) {
        setOk(true);
        setTimeout(() => { setOk(false); onClose(); }, 800);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <tr>
      <td
        colSpan={7}
        style={{
          padding: 0,
          background: "rgba(10,22,11,0.6)",
          borderTop: "1px solid rgba(185,146,77,0.25)",
          borderBottom: "1px solid rgba(185,146,77,0.25)",
        }}
      >
        <div style={{ padding: "18px 20px" }}>
          <form action={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelS}>Nome completo</label>
                <input name="full_name" defaultValue={customer.full_name ?? ""} style={inputS} placeholder="Nome" />
              </div>
              <div>
                <label style={labelS}>E-mail *</label>
                <input name="email" type="email" required defaultValue={customer.email} style={inputS} placeholder="email@exemplo.com" />
              </div>
              <div>
                <label style={labelS}>Telefone</label>
                <input name="phone" defaultValue={customer.phone ?? ""} style={inputS} placeholder="(11) 99999-0000" />
              </div>
              <div>
                <label style={labelS}>WhatsApp</label>
                <input name="whatsapp" defaultValue={customer.whatsapp ?? ""} style={inputS} placeholder="+55 11 99999-0000" />
              </div>
              <div>
                <label style={labelS}>Aniversário</label>
                <GlassDateInput
                  name="birthday"
                  defaultValue={customer.birthday ?? ""}
                  placeholder="dd/mm/aaaa"
                  inlinePopover
                />
              </div>
              <div>
                <label style={labelS}>Tags (vírgula)</label>
                <input name="tags" defaultValue={(customer.tags ?? []).join(", ")} style={inputS} placeholder="vip, atacado…" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelS}>Observações internas</label>
                <textarea
                  name="notes"
                  defaultValue={customer.notes ?? ""}
                  rows={2}
                  style={{ ...inputS, resize: "vertical" }}
                  placeholder="Notas visíveis apenas para a equipe"
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id={`mkt-${customer.id}`}
                  name="accepts_marketing"
                  defaultChecked={customer.accepts_marketing}
                  style={{ accentColor: "var(--gold)", width: 14, height: 14 }}
                />
                <label htmlFor={`mkt-${customer.id}`} style={{ ...labelS, marginBottom: 0 }}>
                  Aceita marketing
                </label>
              </div>
            </div>

            {error && (
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#e8a0a0" }}>{error}</p>
            )}
            {ok && (
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#8fd486", fontWeight: 700 }}>
                ✓ Salvo
              </p>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={isPending}
                className="btn btn-gold"
                style={{ padding: "8px 20px", fontSize: 11 }}
              >
                {isPending ? "Salvando…" : "Salvar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost"
                style={{ padding: "8px 16px", fontSize: 11 }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

function CustomerRow({
  customer,
  showArchived,
}: {
  customer: CustomerRow;
  showArchived: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [isArchiving, startArchive] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const isArchived = !!customer.archived_at;

  function handleArchive() {
    startArchive(async () => {
      if (isArchived) {
        await unarchiveCustomer(customer.id);
      } else {
        await archiveCustomer(customer.id);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir permanentemente "${customer.full_name ?? customer.email}"?\n\nEsta ação não pode ser desfeita.`)) return;
    startDelete(async () => {
      await deleteCustomer(customer.id);
    });
  }

  return (
    <>
      <tr
        style={{
          borderTop: "1px solid rgba(242,236,223,0.08)",
          opacity: isArchived ? 0.55 : 1,
          background: editOpen ? "rgba(185,146,77,0.06)" : "transparent",
          transition: "background 0.15s",
        }}
      >
        {/* Nome */}
        <td style={{ padding: "10px 14px" }}>
          <Link
            href={`/backoffice/clientes/${customer.id}`}
            style={{ color: "var(--cream)", fontWeight: 600, fontSize: 13 }}
          >
            {customer.full_name ?? "—"}
          </Link>
          {isArchived && (
            <span style={{ marginLeft: 6, fontSize: 10, color: "#d4aa5a", fontWeight: 700 }}>
              ARQUIVADO
            </span>
          )}
        </td>

        {/* E-mail */}
        <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--cream-dim)" }}>
          {customer.email}
        </td>

        {/* WhatsApp */}
        <td style={{ padding: "10px 14px", fontSize: 13 }}>
          {customer.whatsapp ?? "—"}
        </td>

        {/* Aniversário */}
        <td style={{ padding: "10px 14px", fontSize: 13 }}>
          {formatBirthday(customer.birthday)}
        </td>

        {/* Tags */}
        <td style={{ padding: "10px 14px", fontSize: 13 }}>
          {customer.tags?.length ? (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {customer.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 10,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: "rgba(185,146,77,0.12)",
                    border: "1px solid rgba(185,146,77,0.3)",
                    color: "var(--gold-light)",
                    fontWeight: 600,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : "—"}
        </td>

        {/* Marketing */}
        <td style={{ padding: "10px 14px", fontSize: 13 }}>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 6,
              fontWeight: 700,
              background: customer.accepts_marketing
                ? "rgba(143,212,134,0.12)"
                : "rgba(242,236,223,0.06)",
              color: customer.accepts_marketing ? "#8fd486" : "var(--cream-dim)",
            }}
          >
            {customer.accepts_marketing ? "Sim" : "Não"}
          </span>
        </td>

        {/* Ações */}
        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {/* Editar */}
            <button
              type="button"
              onClick={() => setEditOpen((v) => !v)}
              title="Editar"
              style={{
                background: editOpen ? "rgba(185,146,77,0.18)" : "rgba(242,236,223,0.06)",
                border: `1px solid ${editOpen ? "rgba(185,146,77,0.4)" : "var(--glass-border)"}`,
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 12,
                color: editOpen ? "var(--gold-light)" : "var(--cream)",
                cursor: "pointer",
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              ✏
            </button>

            {/* Arquivar / Restaurar */}
            <button
              type="button"
              onClick={handleArchive}
              disabled={isArchiving}
              title={isArchived ? "Restaurar" : "Arquivar"}
              style={{
                background: "rgba(242,236,223,0.06)",
                border: "1px solid var(--glass-border)",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 12,
                color: isArchived ? "#d4aa5a" : "var(--cream-dim)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {isArchived ? "↩" : "📦"}
            </button>

            {/* Excluir */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Excluir permanentemente"
              style={{
                background: "none",
                border: "1px solid rgba(232,160,160,0.25)",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 12,
                color: "#e8a0a0",
                cursor: "pointer",
                fontWeight: 600,
                opacity: isDeleting ? 0.5 : 1,
              }}
            >
              🗑
            </button>
          </div>
        </td>
      </tr>

      {editOpen && (
        <CustomerEditRow customer={customer} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}

export function ClientesTable({
  customers,
  totalCount,
}: {
  customers: CustomerRow[];
  totalCount: number;
}) {
  const [showArchived, setShowArchived] = useState(false);

  const active = customers.filter((c) => !c.archived_at);
  const archived = customers.filter((c) => !!c.archived_at);
  const visible = showArchived ? customers : active;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header com contagem e toggle de arquivados */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <p style={{ margin: 0, color: "var(--cream-dim)", fontSize: 14 }}>
          {active.length} cliente(s) ativo(s)
          {archived.length > 0 && ` · ${archived.length} arquivado(s)`}
        </p>
        {archived.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="btn btn-ghost"
            style={{ padding: "6px 14px", fontSize: 11 }}
          >
            {showArchived ? "Ocultar arquivados" : `Mostrar arquivados (${archived.length})`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            background: "var(--glass-bg-strong)",
            border: "1px solid var(--glass-border)",
            borderRadius: 12,
            padding: 20,
            fontSize: 14,
            color: "var(--cream-dim)",
          }}
        >
          {showArchived
            ? "Nenhum cliente arquivado."
            : "Nenhum cliente ativo. Os clientes aparecem conforme fazem pedidos no site."}
        </div>
      ) : (
        <div
          style={{
            background: "var(--glass-bg-strong)",
            border: "1px solid var(--glass-border)",
            borderRadius: 12,
            backdropFilter: "blur(18px) saturate(1.25)",
            WebkitBackdropFilter: "blur(18px) saturate(1.25)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "rgba(242,236,223,0.06)", textAlign: "left" }}>
                {["Nome", "E-mail", "WhatsApp", "Aniversário", "Tags", "Marketing", "Ações"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--cream-dim)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <CustomerRow key={c.id} customer={c} showArchived={showArchived} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalCount > customers.length && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--cream-dim)" }}>
          Exibindo {customers.length} de {totalCount} registros.
        </p>
      )}
    </div>
  );
}
