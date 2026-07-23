"use client";

import { useMemo, useState, useTransition } from "react";
import { archiveKit, saveKit, type KitForm } from "@/lib/catalog/kit-actions";
import { MediaLibraryModal } from "@/components/MediaPicker";

export type ComponentVariantRow = {
  id: string;
  product_id: string;
  product_name: string;
  variant_name: string | null;
  sku: string;
  price_cents: number;
  currency: string;
  stock: number;
};

export type KitItemRow = {
  id?: string;
  component_variant_id: string;
  quantity: number;
};

export type KitRow = {
  id: string;
  name: string;
  subtitle: string | null;
  slug: string;
  status: string;
  variant_id: string;
  sku: string;
  price_cents: number;
  compare_at_cents: number | null;
  cover_url: string | null;
  cover_media_id: string | null;
  available_stock: number;
  items: KitItemRow[];
};

const money = (cents: number, currency = "BRL") =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });

function kitAvailability(items: KitItemRow[], components: Map<string, ComponentVariantRow>) {
  if (items.length === 0) return 0;
  return Math.min(
    ...items.map((item) => {
      const component = components.get(item.component_variant_id);
      if (!component) return 0;
      return Math.floor(component.stock / Math.max(item.quantity, 1));
    })
  );
}

export function KitManager({
  initial,
  components,
  tenantId,
  migrationMissing,
}: {
  initial: KitRow[];
  components: ComponentVariantRow[];
  tenantId: string;
  migrationMissing: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const componentMap = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);

  function run(fn: () => Promise<void>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setMsg(ok);
        setEditing(null);
        setCreating(false);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro inesperado.");
      }
    });
  }

  if (migrationMissing) {
    return (
      <section className="glass rise" style={{ padding: 22, borderColor: "rgba(185, 146, 77, 0.28)" }}>
        <p className="eyebrow" style={{ color: "var(--gold-light)", marginBottom: 10 }}>Migration pendente</p>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
          A tabela <code>product_kit_items</code> ainda nao existe no banco publicado. Aplique a migration
          <code> supabase/migrations/20260723122212_product_kits_foundation.sql</code> no Supabase para liberar o
          construtor de kits.
        </p>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="glass rise" style={{ padding: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Construtor de kits</p>
        <p className="muted" style={{ margin: 0, maxWidth: 720, lineHeight: 1.6 }}>
          Monte kits a partir das variantes existentes. O estoque do kit e calculado pelos componentes, sem duplicar
          produto nem quebrar o controle atual de SKU.
        </p>
      </section>

      {initial.map((kit, i) => {
        const items = kit.items.map((item) => ({
          ...item,
          component: componentMap.get(item.component_variant_id),
        }));

        return (
          <div key={kit.id} className={`glass rise rise-${Math.min(i + 1, 4)}`} style={{ padding: "16px 22px" }}>
            {editing === kit.id ? (
              <KitFormFields
                defaults={kit}
                components={components}
                tenantId={tenantId}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSubmit={(form) => run(() => saveKit(form), "Kit atualizado.")}
              />
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
                      flexShrink: 0,
                      background: kit.cover_url ? `url("${kit.cover_url}") center / cover` : "rgba(10,22,11,0.45)",
                      border: "1px solid var(--glass-border)",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 190 }}>
                    <strong style={{ fontSize: 15 }}>{kit.name}</strong>
                    <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                      {money(kit.price_cents)} · SKU {kit.sku} · disponibilidade {kit.available_stock}
                    </p>
                  </div>
                  <span className={`chip ${kit.status === "published" ? "chip-live" : "chip-draft"}`}>
                    {kit.status === "published" ? "A venda" : kit.status === "draft" ? "Rascunho" : "Arquivado"}
                  </span>
                  <button className="btn-icon" title="Editar kit" onClick={() => { setEditing(kit.id); setCreating(false); }}>
                    Editar
                  </button>
                  <button
                    className="btn-icon"
                    title={kit.status === "archived" ? "Restaurar" : "Arquivar"}
                    style={{ color: kit.status === "archived" ? "var(--gold-light)" : "#e8a0a0" }}
                    onClick={() =>
                      run(
                        () => archiveKit(kit.id, kit.status !== "archived"),
                        kit.status === "archived" ? "Kit restaurado." : "Kit arquivado."
                      )
                    }
                  >
                    {kit.status === "archived" ? "Restaurar" : "Arquivar"}
                  </button>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {items.length === 0 ? (
                    <p className="muted" style={{ fontSize: 12, margin: 0 }}>Sem componentes cadastrados.</p>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.component_variant_id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "9px 12px",
                          border: "1px solid var(--glass-border)",
                          borderRadius: 10,
                          background: "rgba(242, 236, 223, 0.045)",
                          fontSize: 12,
                        }}
                      >
                        <span>{item.component?.product_name ?? "Componente removido"}</span>
                        <span className="muted">
                          {item.quantity} un. · estoque {item.component?.stock ?? 0}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {creating ? (
        <div className="glass rise" style={{ padding: 22 }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Novo kit</p>
          <KitFormFields
            components={components}
            tenantId={tenantId}
            pending={pending}
            onCancel={() => setCreating(false)}
            onSubmit={(form) => run(() => saveKit(form), "Kit criado.")}
          />
        </div>
      ) : (
        <button
          className="btn btn-ghost"
          onClick={() => { setCreating(true); setEditing(null); }}
          style={{ padding: 16, borderStyle: "dashed" }}
        >
          + Novo kit
        </button>
      )}

      {msg ? (
        <p className="rise" style={{ fontSize: 12, color: "var(--gold-light)", textAlign: "center" }}>{msg}</p>
      ) : null}
    </div>
  );
}

function KitFormFields({
  defaults,
  components,
  tenantId,
  pending,
  onSubmit,
  onCancel,
}: {
  defaults?: KitRow;
  components: ComponentVariantRow[];
  tenantId: string;
  pending: boolean;
  onSubmit: (form: KitForm) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaults?.name ?? "");
  const [subtitle, setSubtitle] = useState(defaults?.subtitle ?? "");
  const [price, setPrice] = useState(defaults ? (defaults.price_cents / 100).toFixed(2) : "");
  const [compareAt, setCompareAt] = useState(
    defaults?.compare_at_cents ? (defaults.compare_at_cents / 100).toFixed(2) : ""
  );
  const [sku, setSku] = useState(defaults?.sku ?? "");
  const [published, setPublished] = useState((defaults?.status ?? "draft") === "published");
  const [coverUrl, setCoverUrl] = useState(defaults?.cover_url ?? "");
  const [coverId, setCoverId] = useState<string | null | undefined>(defaults?.cover_media_id ?? undefined);
  const [items, setItems] = useState<KitItemRow[]>(
    defaults?.items.length ? defaults.items : [{ component_variant_id: components[0]?.id ?? "", quantity: 1 }]
  );
  const [libOpen, setLibOpen] = useState(false);
  const componentMap = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);
  const available = kitAvailability(items.filter((item) => item.component_variant_id), componentMap);

  function updateItem(index: number, patch: Partial<KitItemRow>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <form
      style={{ display: "grid", gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          product_id: defaults?.id,
          variant_id: defaults?.variant_id,
          name,
          subtitle,
          sku,
          price_cents: Math.round(parseFloat(price.replace(",", ".")) * 100),
          compare_at_cents: compareAt ? Math.round(parseFloat(compareAt.replace(",", ".")) * 100) : null,
          status: published ? "published" : "draft",
          media_id: coverId,
          items: items
            .filter((item) => item.component_variant_id)
            .map((item) => ({
              component_variant_id: item.component_variant_id,
              quantity: Math.max(1, Number(item.quantity) || 1),
            })),
        });
      }}
    >
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setLibOpen(true)}
          title="Escolher imagem"
          style={{
            width: 104,
            height: 104,
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

        <div style={{ flex: 1, minWidth: 260, display: "grid", gap: 12 }}>
          <div className="field">
            <span className="field-label">Nome do kit</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <span className="field-label">Subtitulo</span>
            <input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div className="field">
          <span className="field-label">Preco do kit (R$)</span>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div className="field">
          <span className="field-label">Preco de referencia</span>
          <input className="input" inputMode="decimal" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />
        </div>
        <div className="field">
          <span className="field-label">SKU do kit</span>
          <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="gerado automaticamente" />
        </div>
        <div className="field">
          <span className="field-label">Disponivel pelo estoque</span>
          <input className="input" value={`${available} kits`} readOnly />
        </div>
      </div>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <p className="eyebrow">Componentes</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setItems((current) => [...current, { component_variant_id: components[0]?.id ?? "", quantity: 1 }])}
            style={{ padding: "8px 14px", fontSize: 10 }}
            disabled={components.length === 0}
          >
            + componente
          </button>
        </div>

        {components.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Cadastre produtos simples com variantes antes de montar kits.
          </p>
        ) : (
          items.map((item, index) => {
            const component = componentMap.get(item.component_variant_id);
            return (
              <div
                key={`${item.component_variant_id}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1fr) 110px auto",
                  gap: 10,
                  alignItems: "end",
                }}
              >
                <div className="field">
                  <span className="field-label">Produto componente</span>
                  <select
                    className="input"
                    value={item.component_variant_id}
                    onChange={(e) => updateItem(index, { component_variant_id: e.target.value })}
                  >
                    {components.map((componentOption) => (
                      <option key={componentOption.id} value={componentOption.id}>
                        {componentOption.product_name} · {componentOption.sku}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="field-label">Qtd.</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  style={{ padding: "10px 14px", fontSize: 10, color: "#e8a0a0" }}
                >
                  Remover
                </button>
                <p className="muted" style={{ gridColumn: "1 / -1", fontSize: 11, margin: "-4px 0 2px" }}>
                  Estoque do componente: {component?.stock ?? 0}
                </p>
              </div>
            );
          })
        )}
      </section>

      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--cream-soft)" }}>
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Publicado na loja
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={pending || components.length === 0} className="btn btn-gold" style={{ padding: "11px 22px" }}>
          {pending ? "Salvando..." : "Salvar kit"}
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
