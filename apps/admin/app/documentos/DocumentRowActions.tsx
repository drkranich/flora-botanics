"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { archiveDocument, deleteDocument } from "./actions";

export function DocumentRowActions({
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
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleEdit() {
    router.push(`/documentos/${id}`);
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
    });
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    startTransition(async () => {
      await deleteDocument(id);
      setOpen(false);
      setConfirmDelete(false);
    });
  }

  return (
    // position:relative aqui garante que o menu absolute é relativo a este wrapper
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setConfirmDelete(false);
        }}
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
          {/* Backdrop para fechar ao clicar fora */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onClick={() => { setOpen(false); setConfirmDelete(false); }}
          />
          {/* Menu: position absolute relativo ao wrapper, abre à esquerda do botão */}
          <div style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "#1a2e1a",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            minWidth: 200,
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
