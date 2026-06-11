"use client";

import { useState, useTransition } from "react";
import { createCategory, updateCategory, deleteCategory } from "@/lib/catalog/actions";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  sort_order: number;
};

export function CategoryManager({ initial }: { initial: Category[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<void>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setMsg(ok);
        setEditing(null);
        setCreating(false);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {initial.map((cat, i) => (
        <div key={cat.id} className={`glass rise rise-${Math.min(i + 1, 4)}`} style={{ padding: "20px 24px" }}>
          {editing === cat.id ? (
            <CategoryForm
              defaults={cat}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSubmit={(form) =>
                run(
                  () => updateCategory(cat.id, { ...form, status: form.status ?? cat.status }),
                  "Categoria atualizada."
                )
              }
            />
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div>
                <strong style={{ fontSize: 15 }}>{cat.name}</strong>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                  /{cat.slug}
                  {cat.description ? ` · ${cat.description}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={`chip ${cat.status === "published" ? "chip-live" : "chip-draft"}`}>
                  {cat.status === "published" ? "Visível" : "Oculta"}
                </span>
                <button className="btn-icon" title="Editar" onClick={() => { setEditing(cat.id); setCreating(false); }}>
                  ✎
                </button>
                <button
                  className="btn-icon"
                  title="Excluir"
                  style={{ color: "#e8a0a0" }}
                  onClick={() => {
                    if (confirm(`Excluir a categoria "${cat.name}"? Produtos vinculados perdem a associação.`)) {
                      run(() => deleteCategory(cat.id), "Categoria excluída.");
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {creating ? (
        <div className="glass rise" style={{ padding: "20px 24px" }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Nova categoria</p>
          <CategoryForm
            pending={pending}
            onCancel={() => setCreating(false)}
            onSubmit={(form) => run(() => createCategory(form), "Categoria criada.")}
          />
        </div>
      ) : (
        <button
          className="btn btn-ghost"
          onClick={() => { setCreating(true); setEditing(null); }}
          style={{ padding: "16px", borderStyle: "dashed" }}
        >
          + Nova categoria
        </button>
      )}

      {msg ? (
        <p className="rise" style={{ fontSize: 12, color: "var(--gold-light)", textAlign: "center" }}>{msg}</p>
      ) : null}
    </div>
  );
}

function CategoryForm({
  defaults,
  pending,
  onSubmit,
  onCancel,
}: {
  defaults?: { name: string; slug: string; description: string | null; status: string };
  pending: boolean;
  onSubmit: (form: { name: string; slug: string; description?: string; status?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaults?.name ?? "");
  const [slug, setSlug] = useState(defaults?.slug ?? "");
  const [description, setDescription] = useState(defaults?.description ?? "");
  const [visible, setVisible] = useState((defaults?.status ?? "published") === "published");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          slug,
          description,
          status: visible ? "published" : "draft",
        });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="field">
          <span className="field-label">Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <span className="field-label">Slug (em branco = automático)</span>
          <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex.: seruns" />
        </div>
      </div>
      <div className="field">
        <span className="field-label">Descrição</span>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--cream-soft)" }}>
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        Visível na loja
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "11px 22px" }}>
          {pending ? "…" : "Salvar"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost" style={{ padding: "11px 20px" }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
