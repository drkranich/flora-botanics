"use client";

import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import {
  archiveVaultFolder,
  createVaultFolder,
  deleteVaultFolder,
  updateVaultFolder,
} from "./actions";

export type VaultFolderManagerRow = {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  department: string | null;
  retentionRule: string | null;
  accessLevel: string;
  tags: string[];
  archivedAt: string | null;
  documentCount: number;
};

const departmentOptions: GlassSelectOption[] = [
  { value: "fiscal", label: "Fiscal" },
  { value: "accounting", label: "Contábil" },
  { value: "payroll", label: "Departamento Pessoal" },
  { value: "finance", label: "Financeiro" },
  { value: "legal", label: "Jurídico" },
  { value: "logistics", label: "Logística" },
  { value: "sales", label: "Vendas" },
  { value: "management", label: "Diretoria" },
];

const accessOptions: GlassSelectOption[] = [
  { value: "internal", label: "Interno" },
  { value: "restricted", label: "Restrito" },
  { value: "accounting", label: "Contador" },
  { value: "management", label: "Diretoria" },
];

const colorOptions: GlassSelectOption[] = [
  { value: "gold", label: "Dourado" },
  { value: "green", label: "Verde" },
  { value: "rose", label: "Rosa fiscal" },
  { value: "cream", label: "Creme" },
];

function folderOptions(folders: VaultFolderManagerRow[], currentId?: string): GlassSelectOption[] {
  return [
    { value: "", label: "Sem pasta superior" },
    ...folders
      .filter((folder) => folder.id !== currentId && !folder.archivedAt)
      .map((folder) => ({ value: folder.id, label: folder.name })),
  ];
}

function FolderForm({
  folders,
  folder,
  onCancel,
}: {
  folders: VaultFolderManagerRow[];
  folder?: VaultFolderManagerRow;
  onCancel?: () => void;
}) {
  const action = folder ? updateVaultFolder.bind(null, folder.id) : createVaultFolder;
  return (
    <form action={action} style={formStyle}>
      <Field label="Nome da pasta">
        <input name="name" required defaultValue={folder?.name ?? ""} className="input" style={inputStyle} placeholder="DCTFWeb, DANFE, contratos..." />
      </Field>
      <Field label="Pasta superior">
        <GlassSelect name="parent_id" options={folderOptions(folders, folder?.id)} defaultValue={folder?.parentId ?? ""} inlineMenu />
      </Field>
      <Field label="Departamento">
        <GlassSelect name="department" options={departmentOptions} defaultValue={folder?.department ?? "fiscal"} inlineMenu />
      </Field>
      <Field label="Acesso">
        <GlassSelect name="access_level" options={accessOptions} defaultValue={folder?.accessLevel ?? "internal"} inlineMenu />
      </Field>
      <Field label="Cor">
        <GlassSelect name="color" options={colorOptions} defaultValue={folder?.color ?? "gold"} inlineMenu />
      </Field>
      <Field label="Ícone">
        <input name="icon" defaultValue={folder?.icon ?? "pasta"} className="input" style={inputStyle} placeholder="pasta, guia, xml..." />
      </Field>
      <Field label="Retenção">
        <input name="retention_rule" defaultValue={folder?.retentionRule ?? ""} className="input" style={inputStyle} placeholder="Guardar por 5 anos, permanente..." />
      </Field>
      <Field label="Tags">
        <input name="tags" defaultValue={folder?.tags.join(", ") ?? ""} className="input" style={inputStyle} placeholder="DCTFWeb, contador, mensal" />
      </Field>
      <Field label="Descrição">
        <textarea name="description" rows={3} defaultValue={folder?.description ?? ""} className="input" style={{ ...inputStyle, resize: "vertical" }} placeholder="O que deve ser guardado nesta pasta." />
      </Field>
      <div style={buttonRowStyle}>
        <button className="btn btn-gold" style={buttonStyle}>{folder ? "Salvar pasta" : "Criar pasta"}</button>
        {onCancel ? <button type="button" className="btn btn-ghost" style={buttonStyle} onClick={onCancel}>Cancelar</button> : null}
      </div>
    </form>
  );
}

export function VaultFolderManager({ folders }: { folders: VaultFolderManagerRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(folders.length === 0);
  const [pending, startTransition] = useTransition();
  const editing = folders.find((folder) => folder.id === editingId);

  function archive(folder: VaultFolderManagerRow) {
    if (!confirm(`Arquivar a pasta "${folder.name}"? Os documentos continuam preservados.`)) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("reason", "Arquivamento solicitado no gerenciador do cofre.");
      await archiveVaultFolder(folder.id, formData);
    });
  }

  function remove(folder: VaultFolderManagerRow) {
    if (!confirm(`Excluir a pasta "${folder.name}"? Os documentos serão mantidos no cofre, sem pasta.`)) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("reason", "Exclusão solicitada no gerenciador do cofre.");
      await deleteVaultFolder(folder.id, formData);
    });
  }

  return (
    <section className="glass" style={shellStyle}>
      <div style={headerStyle}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Pastas do cofre</p>
          <h3 style={titleStyle}>Direcione uploads para pastas</h3>
          <p className="muted" style={{ margin: "6px 0 0", lineHeight: 1.55 }}>
            Cada documento arquivado pode nascer dentro de uma pasta fiscal, contábil, jurídica ou de gestão.
          </p>
        </div>
        <button type="button" className="btn btn-gold" style={buttonStyle} onClick={() => setShowCreate((value) => !value)}>
          + Adicionar pasta
        </button>
      </div>

      {showCreate ? (
        <div style={panelStyle}>
          <FolderForm folders={folders} onCancel={() => setShowCreate(false)} />
        </div>
      ) : null}

      {editing ? (
        <div style={panelStyle}>
          <FolderForm folders={folders} folder={editing} onCancel={() => setEditingId(null)} />
        </div>
      ) : null}

      {folders.length === 0 ? (
        <div style={emptyStyle}>Crie a primeira pasta para separar XML, DANFE, guias, comprovantes, contratos e documentos do contador.</div>
      ) : (
        <div style={folderGridStyle}>
          {folders.map((folder) => (
            <article key={folder.id} style={folderCardStyle}>
              <div>
                <span className={`fiscal-chip fiscal-chip-${folder.archivedAt ? "warn" : "ok"}`}>
                  {folder.archivedAt ? "Arquivada" : "Ativa"}
                </span>
                <h4 style={folderTitleStyle}>{folder.name}</h4>
                <p className="muted" style={{ margin: "5px 0 0", lineHeight: 1.45 }}>{folder.description ?? "Sem descrição."}</p>
              </div>
              <div style={metaGridStyle}>
                <span>{folder.documentCount} documento(s)</span>
                <span>{folder.department ?? "sem departamento"}</span>
                <span>{folder.accessLevel}</span>
                <span>{folder.retentionRule ?? "sem retenção"}</span>
              </div>
              <div style={buttonRowStyle}>
                <button type="button" className="btn btn-ghost" style={buttonStyle} onClick={() => setEditingId(folder.id)}>Editar</button>
                <button type="button" className="btn btn-ghost" style={buttonStyle} onClick={() => archive(folder)} disabled={pending || Boolean(folder.archivedAt)}>Arquivar</button>
                <button type="button" className="btn btn-ghost" style={dangerButtonStyle} onClick={() => remove(folder)} disabled={pending}>Excluir</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
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

const shellStyle: CSSProperties = {
  padding: 18,
  display: "grid",
  gap: 14,
  minWidth: 0,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  color: "var(--cream)",
  fontSize: 20,
  lineHeight: 1.15,
  margin: 0,
};

const panelStyle: CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  background: "rgba(242, 236, 223, 0.055)",
  padding: 14,
};

const formStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  color: "var(--cream-dim)",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  minHeight: 40,
  width: "100%",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const buttonStyle: CSSProperties = {
  minHeight: 34,
  padding: "7px 12px",
  fontSize: 9,
};

const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  color: "#e8a0a0",
  borderColor: "rgba(232,160,160,0.42)",
};

const emptyStyle: CSSProperties = {
  border: "1px dashed var(--glass-border)",
  borderRadius: 12,
  padding: 14,
  color: "var(--cream-dim)",
  fontSize: 12,
};

const folderGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const folderCardStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  border: "1px solid var(--glass-border)",
  borderRadius: 14,
  background: "rgba(10, 22, 11, 0.48)",
  padding: 14,
};

const folderTitleStyle: CSSProperties = {
  color: "var(--cream)",
  fontSize: 17,
  lineHeight: 1.2,
  margin: "8px 0 0",
};

const metaGridStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  color: "var(--cream-dim)",
  fontSize: 11,
  lineHeight: 1.45,
};
