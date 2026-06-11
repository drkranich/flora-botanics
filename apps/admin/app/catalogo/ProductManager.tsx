"use client";

import { useState, useTransition } from "react";
import { createProduct, updateProduct, archiveProduct, type ProductForm } from "@/lib/catalog/actions";
import { MediaLibraryModal } from "@/components/MediaPicker";

export type ProductRow = {
  id: string;
  name: string;
  subtitle: string | null;
  slug: string;
  status: string;
  variant_id: string;
  sku: string;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number;
  category_id: string | null;
  cover_url: string | null;
  cover_media_id: string | null;
};

type Category = { id: string; name: string };

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ProductManager({
  initial,
  categories,
  tenantId,
}: {
  initial: ProductRow[];
  categories: Category[];
  tenantId: string;
}) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {initial.map((p, i) => (
        <div key={p.id} className={`glass rise rise-${Math.min(i + 1, 4)}`} style={{ padding: "16px 22px" }}>
          {editing === p.id ? (
            <ProductFormFields
              tenantId={tenantId}
              categories={categories}
              defaults={p}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSubmit={(form) =>
                run(() => updateProduct(p.id, p.variant_id, form), "Produto atualizado.")
              }
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 12,
                  flexShrink: 0,
                  background: p.cover_url
                    ? `url("${p.cover_url}") center / cover`
                    : "rgba(10,22,11,0.45)",
                  border: "1px solid var(--glass-border)",
                }}
              />
              <div style={{ flex: 1, minWidth: 160 }}>
                <strong style={{ fontSize: 14.5 }}>{p.name}</strong>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                  {money(p.price_cents)} · estoque {p.stock} · {p.sku}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={`chip ${p.status === "published" ? "chip-live" : "chip-draft"}`}>
                  {p.status === "published" ? "À venda" : p.status === "draft" ? "Rascunho" : "Arquivado"}
                </span>
                <button className="btn-icon" title="Editar" onClick={() => { setEditing(p.id); setCreating(false); }}>
                  ✎
                </button>
                <button
                  className="btn-icon"
                  title={p.status === "archived" ? "Restaurar" : "Arquivar"}
                  style={{ color: p.status === "archived" ? "var(--gold-light)" : "#e8a0a0" }}
                  onClick={() =>
                    run(
                      () => archiveProduct(p.id, p.status !== "archived"),
                      p.status === "archived" ? "Produto restaurado." : "Produto arquivado."
                    )
                  }
                >
                  {p.status === "archived" ? "↺" : "▣"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {creating ? (
        <div className="glass rise" style={{ padding: 22 }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Novo produto</p>
          <ProductFormFields
            tenantId={tenantId}
            categories={categories}
            pending={pending}
            onCancel={() => setCreating(false)}
            onSubmit={(form) => run(() => createProduct(form), "Produto criado.")}
          />
        </div>
      ) : (
        <button
          className="btn btn-ghost"
          onClick={() => { setCreating(true); setEditing(null); }}
          style={{ padding: 16, borderStyle: "dashed" }}
        >
          + Novo produto
        </button>
      )}

      {msg ? (
        <p className="rise" style={{ fontSize: 12, color: "var(--gold-light)", textAlign: "center" }}>{msg}</p>
      ) : null}
    </div>
  );
}

function ProductFormFields({
  defaults,
  categories,
  tenantId,
  pending,
  onSubmit,
  onCancel,
}: {
  defaults?: ProductRow;
  categories: Category[];
  tenantId: string;
  pending: boolean;
  onSubmit: (form: ProductForm) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaults?.name ?? "");
  const [subtitle, setSubtitle] = useState(defaults?.subtitle ?? "");
  const [price, setPrice] = useState(defaults ? (defaults.price_cents / 100).toFixed(2) : "");
  const [compareAt, setCompareAt] = useState(
    defaults?.compare_at_cents ? (defaults.compare_at_cents / 100).toFixed(2) : ""
  );
  const [stock, setStock] = useState(String(defaults?.stock ?? 0));
  const [categoryId, setCategoryId] = useState(defaults?.category_id ?? "");
  const [published, setPublished] = useState((defaults?.status ?? "draft") === "published");
  const [coverUrl, setCoverUrl] = useState(defaults?.cover_url ?? "");
  const [coverId, setCoverId] = useState<string | null>(defaults?.cover_media_id ?? null);
  const [libOpen, setLibOpen] = useState(false);

  return (
    <form
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          subtitle,
          price_cents: Math.round(parseFloat(price.replace(",", ".")) * 100),
          compare_at_cents: compareAt
            ? Math.round(parseFloat(compareAt.replace(",", ".")) * 100)
            : null,
          stock: parseInt(stock || "0", 10),
          category_id: categoryId || null,
          media_id: coverId,
          status: published ? "published" : "draft",
        });
      }}
    >
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setLibOpen(true)}
          title="Escolher foto"
          style={{
            width: 96,
            height: 96,
            borderRadius: 14,
            flexShrink: 0,
            border: "1px dashed var(--glass-border)",
            background: coverUrl ? `url("${coverUrl}") center / cover` : "rgba(10,22,11,0.45)",
            color: "var(--cream-dim)",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          {coverUrl ? "" : "+"}
        </button>

        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <span className="field-label">Nome</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <span className="field-label">Subtítulo (opcional)</span>
            <input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <div className="field">
          <span className="field-label">Preço (R$)</span>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="89.90" required />
        </div>
        <div className="field">
          <span className="field-label">Preço &quot;de&quot; (opcional)</span>
          <input className="input" inputMode="decimal" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="119.90" />
        </div>
        <div className="field">
          <span className="field-label">Estoque</span>
          <input className="input" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
        <div className="field">
          <span className="field-label">Categoria</span>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— sem categoria —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--cream-soft)" }}>
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Publicado na loja
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "11px 22px" }}>
          {pending ? "…" : "Salvar produto"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost" style={{ padding: "11px 20px" }}>
          Cancelar
        </button>
      </div>

      {libOpen ? (
        <MediaLibraryModal
          tenantId={tenantId}
          onClose={() => setLibOpen(false)}
          onSelect={(url, mediaId) => {
            setCoverUrl(url);
            setCoverId(mediaId ?? null);
            setLibOpen(false);
          }}
        />
      ) : null}
    </form>
  );
}
