"use client";

import Link from "next/link";
import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ColorPickerField, type ColorSwatch } from "@/components/ColorPickerField";
import { GlassSelect, type GlassSelectOption } from "@/components/GlassSelect";
import {
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

const folderColorSwatches: ColorSwatch[] = [
  { label: "Dourado Flora", value: "#b9924d" },
  { label: "Dourado escuro", value: "#96763f" },
  { label: "Verde profundo", value: "#0f2812" },
  { label: "Verde médio", value: "#21351d" },
  { label: "Rosa fiscal", value: "#d8766e" },
  { label: "Creme", value: "#f2ecdf" },
  { label: "Texto suave", value: "#5e584b" },
];

const legacyFolderColors: Record<string, string> = {
  gold: "#b9924d",
  green: "#21351d",
  rose: "#d8766e",
  cream: "#f2ecdf",
};

function resolveFolderColor(value: string | null | undefined) {
  if (!value) return "#b9924d";
  return legacyFolderColors[value] ?? value;
}

function readableColorLabel(value: string | null | undefined) {
  const resolved = resolveFolderColor(value).toLowerCase();
  return folderColorSwatches.find((swatch) => swatch.value.toLowerCase() === resolved)?.label ?? resolved;
}

function folderHref(folderId: string) {
  return `/backoffice/notas-fiscais/cofre?folder=${encodeURIComponent(folderId)}#cofre`;
}

function adminApiPath(path: string) {
  const configuredBase = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH?.replace(/\/+$/, "");
  if (configuredBase) return `${configuredBase}${path}`;
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) return `/admin${path}`;
  return path;
}

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
  const [color, setColor] = useState(resolveFolderColor(folder?.color));
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
      <input type="hidden" name="color" value={color} />
      <div style={{ gridColumn: "span 2", minWidth: 0 }}>
        <ColorPickerField
          label="Cor da pasta"
          value={color}
          onChange={setColor}
          allowClear={false}
          swatches={folderColorSwatches}
        />
      </div>
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
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(folders.length === 0);
  const [actionMessage, setActionMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const editing = folders.find((folder) => folder.id === editingId);

  function toggleArchive(folder: VaultFolderManagerRow) {
    const isArchived = Boolean(folder.archivedAt);
    const verb = isArchived ? "desarquivar" : "arquivar";
    if (!confirm(`${isArchived ? "Desarquivar" : "Arquivar"} a pasta "${folder.name}"? Os documentos continuam preservados.`)) return;
    setActionMessage("");
    startTransition(async () => {
      const res = await fetch(adminApiPath(`/api/fiscal-vault-folders/${folder.id}/archive`), {
        method: isArchived ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: `${isArchived ? "Desarquivamento" : "Arquivamento"} solicitado no gerenciador do cofre.` }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setActionMessage(data?.error ?? `Não foi possível ${verb} a pasta.`);
        return;
      }
      setActionMessage(isArchived ? "Pasta desarquivada." : "Pasta arquivada.");
      router.refresh();
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

      {actionMessage ? <span style={hintStyle}>{actionMessage}</span> : null}

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
            <article key={folder.id} style={folderCardStyle(folder.color)}>
              <div>
                <div style={folderHeaderLineStyle}>
                  <span className={`fiscal-chip fiscal-chip-${folder.archivedAt ? "warn" : "ok"}`}>
                    {folder.archivedAt ? "Arquivada" : "Ativa"}
                  </span>
                  <span style={folderColorBadgeStyle(folder.color)}>
                    <span style={folderColorDotStyle(folder.color)} />
                    {readableColorLabel(folder.color)}
                  </span>
                </div>
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
                <Link href={folderHref(folder.id)} className="btn btn-gold" style={buttonStyle}>Abrir pasta</Link>
                <button type="button" className="btn btn-ghost" style={buttonStyle} onClick={() => setEditingId(folder.id)}>Editar</button>
                <button type="button" className="btn btn-ghost" style={buttonStyle} onClick={() => toggleArchive(folder)} disabled={pending}>
                  {folder.archivedAt ? "Desarquivar" : "Arquivar"}
                </button>
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

function folderCardStyle(color: string | null | undefined): CSSProperties {
  const resolved = resolveFolderColor(color);
  return {
  display: "grid",
  gap: 12,
    border: `1px solid color-mix(in srgb, ${resolved} 55%, rgba(242, 236, 223, 0.18))`,
  borderRadius: 14,
    background: `linear-gradient(135deg, color-mix(in srgb, ${resolved} 15%, rgba(10, 22, 11, 0.62)), rgba(10, 22, 11, 0.48))`,
    boxShadow: `inset 3px 0 0 ${resolved}, 0 14px 34px rgba(0, 0, 0, 0.18)`,
  padding: 14,
  };
}

const folderHeaderLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

function folderColorBadgeStyle(color: string | null | undefined): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid var(--glass-border)",
    borderRadius: 999,
    padding: "4px 9px",
    color: "var(--cream-dim)",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    background: `color-mix(in srgb, ${resolveFolderColor(color)} 18%, rgba(10, 22, 11, 0.45))`,
  };
}

function folderColorDotStyle(color: string | null | undefined): CSSProperties {
  const resolved = resolveFolderColor(color);
  return {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: resolved,
    boxShadow: `0 0 14px ${resolved}`,
    flex: "0 0 auto",
  };
}

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

const hintStyle: CSSProperties = {
  color: "var(--cream-dim)",
  fontSize: 11,
};
