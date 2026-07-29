"use client";

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GlassDateInput } from "@/components/GlassDateInput";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import {
  deleteVaultDocument,
  moveVaultDocumentToFolder,
  registerVaultDocumentShare,
  updateVaultDocument,
} from "./actions";
import { FiscalFileUpload } from "./FiscalFileUpload";

type VaultControlDocument = {
  id: string;
  folderId: string | null;
  folderName: string | null;
  name: string;
  documentType: string;
  category: string | null;
  department: string | null;
  competence: string | null;
  issuedAt: string | null;
  dueDate: string | null;
  value: string;
  cnpj: string | null;
  cpf: string | null;
  accessKey: string | null;
  number: string | null;
  series: string | null;
  origin: string;
  status: string;
  archivedAt: string | null;
  verificationStatus: string;
  visibilityStatus: string;
  storagePath: string | null;
  tags: string[];
  notes: string | null;
};

export type VaultFolderControlOption = GlassSelectOption & {
  uploadPath: string;
};

const viewOptions: GlassSelectOption[] = [
  { value: "lista", label: "Lista confortável" },
  { value: "compacto", label: "Lista compacta" },
  { value: "grade", label: "Cards grandes" },
  { value: "detalhes", label: "Detalhes" },
];

const statusOptions: GlassSelectOption[] = [
  { value: "todos", label: "Todos os status" },
  { value: "received", label: "Recebidos" },
  { value: "review", label: "Em análise" },
  { value: "verified", label: "Verificados" },
  { value: "verified_with_notes", label: "Com ressalvas" },
  { value: "archived", label: "Arquivados" },
];

const departmentOptions: GlassSelectOption[] = [
  { value: "todos", label: "Todos os departamentos" },
  { value: "fiscal", label: "Fiscal" },
  { value: "accounting", label: "Contábil" },
  { value: "payroll", label: "Departamento Pessoal" },
  { value: "finance", label: "Financeiro" },
  { value: "legal", label: "Jurídico" },
  { value: "logistics", label: "Logística" },
  { value: "sales", label: "Vendas" },
  { value: "management", label: "Diretoria" },
];

const sortOptions: GlassSelectOption[] = [
  { value: "recentes", label: "Mais recentes" },
  { value: "vencimento", label: "Vencimento" },
  { value: "competencia", label: "Competência" },
  { value: "valor", label: "Maior valor" },
  { value: "nome", label: "Nome A-Z" },
];

const vaultStatusOptions: GlassSelectOption[] = [
  { value: "received", label: "Recebido" },
  { value: "open", label: "Em aberto" },
  { value: "review", label: "Em análise" },
  { value: "verified", label: "Verificado" },
  { value: "verified_with_notes", label: "Verificado com ressalvas" },
  { value: "archived", label: "Arquivado" },
];

const verificationOptions: GlassSelectOption[] = [
  { value: "pending", label: "Não verificado" },
  { value: "review", label: "Em análise" },
  { value: "verified", label: "Verificado" },
  { value: "verified_with_notes", label: "Verificado com ressalvas" },
  { value: "rejected", label: "Rejeitado" },
];

const visibilityOptions: GlassSelectOption[] = [
  { value: "unread", label: "Não lido" },
  { value: "read", label: "Lido" },
  { value: "shared", label: "Compartilhado" },
  { value: "restricted", label: "Restrito" },
  { value: "deleted", label: "Excluído" },
];

const paymentStatuses: GlassSelectOption[] = [
  { value: "not_applicable", label: "Não se aplica" },
  { value: "unclassified", label: "Sem classificação" },
  { value: "unpaid", label: "Não pago" },
  { value: "open", label: "Em aberto" },
  { value: "waiting_approval", label: "Aguardando aprovação" },
  { value: "approved_for_payment", label: "Aprovado para pagamento" },
  { value: "scheduled", label: "Programada" },
  { value: "near_due", label: "Próxima do vencimento" },
  { value: "due_today", label: "Vence hoje" },
  { value: "overdue", label: "Vencida" },
  { value: "partial", label: "Parcialmente paga" },
  { value: "paid", label: "Paga" },
  { value: "paid_with_interest", label: "Paga com juros" },
  { value: "paid_with_discount", label: "Paga com desconto" },
  { value: "compensated", label: "Compensada" },
  { value: "installment", label: "Parcelada" },
  { value: "suspended", label: "Suspensa" },
  { value: "cancelled", label: "Cancelada" },
  { value: "disputed", label: "Contestada" },
  { value: "reversed", label: "Estornada" },
  { value: "refunded", label: "Reembolsada" },
  { value: "reconciled", label: "Conciliada" },
  { value: "divergent", label: "Divergente" },
  { value: "waiting_receipt", label: "Aguardando comprovante" },
  { value: "receipt_review", label: "Comprovante em verificação" },
];

function adminApiPath(path: string) {
  const configuredBase = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH?.replace(/\/+$/, "");
  if (configuredBase) return `${configuredBase}${path}`;
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) return `/admin${path}`;
  return path;
}

function setParam(params: URLSearchParams, key: string, value: string) {
  if (!value || value === "todos" || (key === "vaultView" && value === "lista") || (key === "sort" && value === "recentes")) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
}

export function VaultToolbar({
  total,
  filtered,
  folders = [],
}: {
  total: number;
  filtered: number;
  folders?: VaultFolderControlOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const view = searchParams.get("vaultView") ?? "lista";
  const status = searchParams.get("status") ?? "todos";
  const department = searchParams.get("department") ?? "todos";
  const folder = searchParams.get("folder") ?? "todos";
  const sort = searchParams.get("sort") ?? "recentes";

  function update(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) setParam(params, key, value);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  function submitSearch() {
    const params = new URLSearchParams(searchParams.toString());
    setParam(params, "q", query.trim());
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  return (
    <div className="glass" style={toolbarStyle}>
      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Filtro do cofre</p>
        <strong style={{ color: "var(--cream)", fontSize: 18 }}>{filtered} de {total} documento(s)</strong>
      </div>
      <div style={toolbarGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Buscar</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
            className="input"
            placeholder="Nome, arquivo, categoria, tag..."
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Visualização</span>
          <GlassSelect value={view} options={viewOptions} onChange={(value) => update({ vaultView: value })} inlineMenu />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Status</span>
          <GlassSelect value={status} options={statusOptions} onChange={(value) => update({ status: value })} inlineMenu />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Departamento</span>
          <GlassSelect value={department} options={departmentOptions} onChange={(value) => update({ department: value })} inlineMenu />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Pasta</span>
          <GlassSelect
            value={folder}
            options={[{ value: "todos", label: "Todas as pastas" }, { value: "sem-pasta", label: "Sem pasta" }, ...folders]}
            onChange={(value) => update({ folder: value })}
            inlineMenu
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Ordenar</span>
          <GlassSelect value={sort} options={sortOptions} onChange={(value) => update({ sort: value })} inlineMenu />
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-gold" style={smallButtonStyle} onClick={submitSearch}>Filtrar</button>
          <button type="button" className="btn btn-ghost" style={smallButtonStyle} onClick={() => {
            setQuery("");
            router.replace(pathname, { scroll: false });
          }}>
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}

export function VaultDocumentControls({
  document,
  folders = [],
}: {
  document: VaultControlDocument;
  folders?: VaultFolderControlOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit" | "details" | "move" | "archive" | "delete">("idle");
  const [shareMessage, setShareMessage] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState(document.folderId ?? folders[0]?.value ?? "");
  const [pending, startTransition] = useTransition();
  const isArchived = Boolean(document.archivedAt || document.status === "archived");
  const fileHref = document.storagePath
    ? adminApiPath(`/api/fiscal-files?path=${encodeURIComponent(document.storagePath)}`)
    : "";

  const tags = useMemo(() => document.tags.join(", "), [document.tags]);
  const moveFolderOptions = useMemo<GlassSelectOption[]>(() => {
    const hasDefaultFolder = folders.some((folder) => folder.label === "Entrada geral");
    return hasDefaultFolder ? folders : [{ value: "__entrada_geral__", label: "Entrada geral" }, ...folders];
  }, [folders]);

  async function share() {
    if (!fileHref) {
      setShareMessage("Sem arquivo para compartilhar.");
      return;
    }
    const absolute = `${window.location.origin}${fileHref}`;
    await navigator.clipboard.writeText(absolute);
    setShareMessage("Link interno copiado.");
    startTransition(async () => {
      await registerVaultDocumentShare(document.id);
    });
  }

  function toggleArchive() {
    const nextAction = isArchived ? "desarquivar" : "arquivar";
    if (!confirm(`${isArchived ? "Desarquivar" : "Arquivar"} "${document.name}" no cofre fiscal?`)) return;
    setShareMessage("");
    startTransition(async () => {
      const res = await fetch(adminApiPath(`/api/fiscal-vault-documents/${document.id}/archive`), {
        method: isArchived ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: `${isArchived ? "Desarquivamento" : "Arquivamento"} rápido pelo cofre fiscal.` }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setShareMessage(data?.error ?? `Não foi possível ${nextAction} o documento.`);
        return;
      }
      setMode("idle");
      setShareMessage(isArchived ? "Documento desarquivado." : "Documento arquivado.");
      router.refresh();
    });
  }

  return (
    <div style={actionsShellStyle}>
      <div style={buttonRailStyle}>
        {fileHref ? (
          <a href={fileHref} target="_blank" rel="noreferrer" className="btn btn-gold" style={actionButtonStyle}>
            Abrir
          </a>
        ) : null}
        <button type="button" className="btn btn-ghost" style={actionButtonStyle} onClick={() => setMode(mode === "details" ? "idle" : "details")}>Detalhes</button>
        <button type="button" className="btn btn-ghost" style={actionButtonStyle} onClick={() => setMode(mode === "edit" ? "idle" : "edit")}>Editar</button>
        <button type="button" className="btn btn-ghost" style={actionButtonStyle} onClick={() => setMode(mode === "move" ? "idle" : "move")}>Mover para pasta</button>
        <button type="button" className="btn btn-ghost" style={actionButtonStyle} onClick={share} disabled={pending}>Compartilhar</button>
        <button type="button" className="btn btn-ghost" style={actionButtonStyle} onClick={toggleArchive} disabled={pending}>
          {isArchived ? "Desarquivar" : "Arquivar"}
        </button>
        <button type="button" className="btn btn-ghost" style={dangerButtonStyle} onClick={() => setMode(mode === "delete" ? "idle" : "delete")}>Excluir</button>
      </div>
      {shareMessage ? <span style={hintStyle}>{shareMessage}</span> : null}

      {mode === "details" ? (
        <div style={panelStyle}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Detalhes do documento</p>
          <dl style={detailsGridStyle}>
            <Meta label="Nome" value={document.name} />
            <Meta label="Tipo" value={document.documentType} />
            <Meta label="Pasta" value={document.folderName ?? "Entrada geral"} />
            <Meta label="Categoria" value={document.category} />
            <Meta label="Departamento" value={document.department} />
            <Meta label="Competência" value={document.competence} />
            <Meta label="Emissão" value={document.issuedAt} />
            <Meta label="Vencimento" value={document.dueDate} />
            <Meta label="Valor" value={document.value} />
            <Meta label="Origem" value={document.origin} />
            <Meta label="Número" value={document.number} />
            <Meta label="Série" value={document.series} />
            <Meta label="Tags" value={tags || "—"} />
          </dl>
          {document.notes ? <p style={notesStyle}>{document.notes}</p> : null}
        </div>
      ) : null}

      {mode === "move" ? (
        <form action={moveVaultDocumentToFolder.bind(null, document.id)} style={panelStyle}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Mover documento para pasta</p>
          <div style={editGridStyle}>
            <Field label="Documento"><input value={document.name} className="input" style={inputStyle} readOnly /></Field>
            <Field label="Pasta atual"><input value={document.folderName ?? "Entrada geral"} className="input" style={inputStyle} readOnly /></Field>
            <Field label="Nova pasta">
              <GlassSelect
                name="folder_id"
                options={moveFolderOptions}
                defaultValue={document.folderId ?? moveFolderOptions[0]?.value ?? "__entrada_geral__"}
                inlineMenu
              />
            </Field>
            <Field label="Motivo"><input name="reason" className="input" style={inputStyle} placeholder="Competência, contador, pagamento..." /></Field>
          </div>
          <div style={formActionsStyle}>
            <button className="btn btn-gold" style={smallButtonStyle}>Mover documento</button>
            <button type="button" className="btn btn-ghost" style={smallButtonStyle} onClick={() => setMode("idle")}>Cancelar</button>
          </div>
        </form>
      ) : null}

      {mode === "edit" ? (
        <form action={updateVaultDocument.bind(null, document.id)} style={panelStyle}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Editar documento</p>
          <div style={editGridStyle}>
            <Field label="Nome"><input name="name" required defaultValue={document.name} className="input" style={inputStyle} /></Field>
            <Field label="Tipo"><input name="document_type" required defaultValue={document.documentType} className="input" style={inputStyle} /></Field>
            <Field label="Categoria"><input name="category" defaultValue={document.category ?? ""} className="input" style={inputStyle} /></Field>
            <Field label="Pasta do cofre">
              <GlassSelect
                name="folder_id"
                options={folders.length ? folders : [{ value: "", label: "Entrada geral" }]}
                value={selectedFolderId}
                onChange={setSelectedFolderId}
                inlineMenu
              />
            </Field>
            <Field label="Departamento"><GlassSelect name="department" options={departmentOptions.filter((item) => item.value !== "todos")} defaultValue={document.department ?? "fiscal"} inlineMenu /></Field>
            <Field label="Competência"><input name="competence" defaultValue={document.competence ?? ""} className="input" style={inputStyle} /></Field>
            <Field label="Emissão"><GlassDateInput name="issued_at" defaultValue={document.issuedAt ?? ""} placeholder="Data de emissão" inlinePopover /></Field>
            <Field label="Vencimento"><GlassDateInput name="due_date" defaultValue={document.dueDate ?? ""} placeholder="Opcional" inlinePopover /></Field>
            <Field label="Valor"><input name="value" defaultValue={document.value.replace("R$", "").trim()} className="input" style={inputStyle} /></Field>
            <Field label="Status financeiro"><GlassSelect name="payment_status" options={paymentStatuses} defaultValue="open" inlineMenu /></Field>
            <Field label="Status do cofre"><GlassSelect name="status" options={vaultStatusOptions} defaultValue={document.status} inlineMenu /></Field>
            <Field label="Verificação"><GlassSelect name="verification_status" options={verificationOptions} defaultValue={document.verificationStatus} inlineMenu /></Field>
            <Field label="Visibilidade"><GlassSelect name="visibility_status" options={visibilityOptions} defaultValue={document.visibilityStatus} inlineMenu /></Field>
            <Field label="CNPJ"><input name="cnpj" defaultValue={document.cnpj ?? ""} className="input" style={inputStyle} /></Field>
            <Field label="CPF"><input name="cpf" defaultValue={document.cpf ?? ""} className="input" style={inputStyle} /></Field>
            <Field label="Chave"><input name="access_key" defaultValue={document.accessKey ?? ""} className="input" style={inputStyle} /></Field>
            <Field label="Número"><input name="number" defaultValue={document.number ?? ""} className="input" style={inputStyle} /></Field>
            <Field label="Série"><input name="series" defaultValue={document.series ?? ""} className="input" style={inputStyle} /></Field>
            <Field label="Origem"><input name="origin" defaultValue={document.origin} className="input" style={inputStyle} /></Field>
            <Field label="Tags"><input name="tags" defaultValue={tags} className="input" style={inputStyle} /></Field>
            <Field label="Substituir arquivo">
              <FiscalFileUpload
                name="storage_path"
                label="Enviar novo arquivo"
                kind="cofre"
                folder={folders.find((folder) => folder.value === selectedFolderId)?.uploadPath ?? "entrada-geral"}
                defaultPath={document.storagePath}
                compact
              />
            </Field>
            <Field label="Observações"><textarea name="notes" rows={3} defaultValue={document.notes ?? ""} className="input" style={{ ...inputStyle, resize: "vertical" }} /></Field>
          </div>
          <div style={formActionsStyle}>
            <button className="btn btn-gold" style={smallButtonStyle}>Salvar edição</button>
            <button type="button" className="btn btn-ghost" style={smallButtonStyle} onClick={() => setMode("idle")}>Cancelar</button>
          </div>
        </form>
      ) : null}

      {mode === "delete" ? (
        <form
          action={deleteVaultDocument.bind(null, document.id)}
          style={panelStyle}
          onSubmit={(event) => {
            if (!confirm("Excluir este documento do cofre? O arquivo fica removido da tela e a ação será auditada.")) {
              event.preventDefault();
            }
          }}
        >
          <p className="eyebrow" style={{ marginBottom: 8 }}>Excluir documento</p>
          <input name="reason" className="input" style={inputStyle} placeholder="Motivo da exclusão" />
          <div style={formActionsStyle}>
            <button className="btn btn-gold" style={dangerSubmitStyle}>Excluir documento</button>
            <button type="button" className="btn btn-ghost" style={smallButtonStyle} onClick={() => setMode("idle")}>Cancelar</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt style={labelStyle}>{label}</dt>
      <dd style={{ margin: "4px 0 0", color: "var(--cream)", overflowWrap: "anywhere" }}>{value || "—"}</dd>
    </div>
  );
}

const toolbarStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  padding: 18,
  minWidth: 0,
  overflow: "visible",
};

const toolbarGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  alignItems: "end",
  minWidth: 0,
};

const actionsShellStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const buttonRailStyle: CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-start",
  minWidth: 0,
};

const panelStyle: CSSProperties = {
  marginTop: 6,
  padding: 14,
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  background: "rgba(10, 22, 11, 0.62)",
  boxShadow: "0 14px 36px rgba(0,0,0,0.24)",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
  margin: 0,
};

const editGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const formActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  color: "var(--cream-dim)",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 1.1,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  minHeight: 38,
  fontSize: 11,
};

const smallButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: "8px 12px",
  fontSize: 9,
  whiteSpace: "nowrap",
};

const actionButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  minHeight: 34,
  padding: "7px 11px",
};

const dangerButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  color: "#e8a0a0",
  borderColor: "rgba(232,160,160,0.42)",
};

const dangerSubmitStyle: CSSProperties = {
  ...smallButtonStyle,
  background: "linear-gradient(135deg, #d9756d, #b74c43)",
};

const hintStyle: CSSProperties = {
  color: "var(--cream-dim)",
  fontSize: 10,
};

const notesStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "var(--cream-dim)",
  fontSize: 12,
  lineHeight: 1.6,
};
