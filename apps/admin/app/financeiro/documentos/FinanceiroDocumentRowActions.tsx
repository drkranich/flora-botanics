"use client";

/**
 * FinanceiroDocumentRowActions
 * Menu ⋯ com position:fixed para não ser truncado pela tabela (overflow:hidden).
 */
import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { archiveDocument, deleteDocument } from "@/app/documentos/actions";

export function FinanceiroDocumentRowActions({
  id,
  number,
  status,
  signingUrl,
}: {
  id: string;
  number: number;
  status: string;
  signingUrl?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [open]);

  function handleEdit() {
    router.push(`/financeiro/documentos/${id}`);
    setOpen(false);
  }

  function handleShare() {
    const url = signingUrl ?? `${window.location.origin}/assinar/`;
    navigator.clipboard.writeText(url).then(() => alert("Link de assinatura copiado!"));
    setOpen(false);
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveDocument(id);
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    startTransition(async () => {
      await deleteDocument(id);
      setOpen(false);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); setConfirmDelete(false); }}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--color-muted, #8a9580)", fontSize: 18, padding: "2px 8px",
          borderRadius: 4, lineHeight: 1,
        }}
        title="Ações"
        disabled={isPending}
      >
        ⋯
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onClick={() => { setOpen(false); setConfirmDelete(false); }}
          />
          <div style={{
            position: "fixed",
            top: menuPos.top,
            right: menuPos.right,
            background: "#1a2e1a",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            minWidth: 190,
            zIndex: 1000,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}>
            <MenuItem onClick={handleEdit} icon="✏️">Editar</MenuItem>
            {signingUrl && (
              <MenuItem onClick={handleShare} icon="🔗">Copiar link de assinatura</MenuItem>
            )}
            {status !== "cancelled" && (
              <MenuItem onClick={handleArchive} icon="📦" muted>
                {isPending ? "Arquivando…" : "Arquivar"}
              </MenuItem>
            )}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "2px 0" }} />
            <MenuItem onClick={handleDelete} icon="🗑️" danger>
              {confirmDelete ? (isPending ? "Excluindo…" : "Confirmar exclusão") : "Excluir"}
            </MenuItem>
            {confirmDelete && (
              <div style={{ padding: "6px 14px", fontSize: 11, color: "#e57373" }}>
                Clique novamente para confirmar.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children, onClick, icon, danger, muted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: string;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", background: "transparent", border: "none",
        padding: "9px 14px", cursor: "pointer", textAlign: "left",
        fontSize: 13,
        color: danger ? "#e57373" : muted ? "var(--color-muted, #8a9580)" : "var(--color-text, #e8e3d9)",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {children}
    </button>
  );
}
