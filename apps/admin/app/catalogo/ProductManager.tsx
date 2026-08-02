"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createProduct,
  updateProduct,
  archiveProduct,
  deleteProduct,
  type ProductEditorialCard,
  type ProductEditorialContent,
  type ProductFaqItem,
  type ProductForm,
} from "@/lib/catalog/actions";
import { getStorefrontUrl } from "@/lib/storefront-url";
import { GlassSelect } from "@/components/GlassSelect";
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
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  stripe_lookup_key: string | null;
  stripe_sync_status: string;
  stripe_last_sync_at: string | null;
  stripe_last_error: string | null;
  editorial_content: ProductEditorialContent | null;
  cover_url: string | null;
  cover_media_id: string | null;
  gallery_images: Array<{ id: string; url: string; role?: string }>;
};

type Category = { id: string; name: string };

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DEFAULT_EDITORIAL: ProductEditorialContent = {
  cards: [
    {
      eyebrow: "Benefícios",
      title: "Cuidado Flora Botanics",
      body: "Organize aqui os benefícios reais deste produto, com linguagem clara e elegante para a página pública.",
    },
    {
      eyebrow: "Rotina",
      title: "Como encaixar no cuidado diário",
      body: "Explique como usar este produto na rotina, em qual etapa aplicar e com quais cuidados Flora ele combina.",
    },
    {
      eyebrow: "Compra",
      title: "Dados seguros do catálogo",
      body: "Use este espaço para reforçar segurança, entrega, conservação ou qualquer informação importante da compra.",
    },
  ],
  faq_title: "Dúvidas rápidas",
  faq: [
    {
      question: "Como incluir este produto na rotina?",
      answer: "Use conforme a orientação do rótulo e complemente com os demais cuidados Flora.",
    },
    {
      question: "Como vejo prazo e entrega?",
      answer: "A entrega e o endereço são tratados no carrinho e no checkout.",
    },
    {
      question: "Este produto tem compra segura?",
      answer: "Sim. O preço e os dados do pedido são recalculados no servidor.",
    },
  ],
};

function normalizeEditableEditorial(value?: ProductEditorialContent | null): ProductEditorialContent {
  const cards = value?.cards?.length ? value.cards : DEFAULT_EDITORIAL.cards;
  const faq = value?.faq?.length ? value.faq : DEFAULT_EDITORIAL.faq;

  return {
    cards: cards.slice(0, 6).map((card, index) => ({
      eyebrow: card.eyebrow ?? DEFAULT_EDITORIAL.cards[index]?.eyebrow ?? "",
      title: card.title ?? DEFAULT_EDITORIAL.cards[index]?.title ?? "",
      body: card.body ?? DEFAULT_EDITORIAL.cards[index]?.body ?? "",
    })),
    faq_title: value?.faq_title || DEFAULT_EDITORIAL.faq_title,
    faq: faq.slice(0, 10).map((item, index) => ({
      question: item.question ?? DEFAULT_EDITORIAL.faq[index]?.question ?? "",
      answer: item.answer ?? DEFAULT_EDITORIAL.faq[index]?.answer ?? "",
    })),
  };
}

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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [payLink, setPayLink] = useState<{ id: string; url: string } | null>(null);

  const storefrontBase = getStorefrontUrl();

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

  function handlePayLink(p: ProductRow) {
    const url = `${storefrontBase}/produto/${p.slug}`;
    setPayLink({ id: p.id, url });
    void navigator.clipboard?.writeText(url).catch(() => null);
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
            <div style={{ display: "grid", gap: 14 }}>
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
                  {/* Link de pagamento */}
                  <button
                    className="btn-icon"
                    title="Copiar link do produto"
                    style={{ color: payLink?.id === p.id ? "var(--gold-light)" : "rgba(255,255,255,0.55)", fontSize: 14 }}
                    onClick={() => handlePayLink(p)}
                  >
                    {payLink?.id === p.id ? "✓" : "🔗"}
                  </button>
                  {/* Editar */}
                  <button className="btn-icon" title="Editar" onClick={() => { setEditing(p.id); setCreating(false); }}>
                    ✎
                  </button>
                  {/* Arquivar / Restaurar */}
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
                  {/* Excluir */}
                  {confirmDelete === p.id ? (
                    <>
                      <button
                        className="btn-icon"
                        title="Confirmar exclusão"
                        style={{ color: "#ef4444", fontWeight: 700, fontSize: 12 }}
                        onClick={() => {
                          setConfirmDelete(null);
                          run(() => deleteProduct(p.id), "Produto excluído.");
                        }}
                      >
                        ✓
                      </button>
                      <button
                        className="btn-icon"
                        title="Cancelar exclusão"
                        style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}
                        onClick={() => setConfirmDelete(null)}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-icon"
                      title="Excluir produto"
                      style={{ color: "#ef4444", opacity: 0.7, fontSize: 14 }}
                      onClick={() => setConfirmDelete(p.id)}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>

              <div style={stripeSummaryStyle}>
                <span>
                  <span className="eyebrow" style={{ fontSize: 8.5 }}>Integração Stripe</span>
                  <span className="muted" style={{ display: "block", fontSize: 10.5, marginTop: 3 }}>
                    {p.stripe_last_error ?? "Product, Price e Lookup Key controlados no Financeiro."}
                  </span>
                </span>
                <span className={p.stripe_sync_status === "synced" || p.stripe_sync_status === "connected" ? "chip chip-live" : "chip chip-draft"}>
                  {p.stripe_sync_status === "connected" ? "Conectado" : p.stripe_sync_status === "synced" ? "Sincronizado" : "Não conectado"}
                </span>
                <code style={codePillStyle}>{p.stripe_product_id ?? "prod_..."}</code>
                <code style={codePillStyle}>{p.stripe_price_id ?? "price_..."}</code>
                <Link href="/financeiro/stripe" className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 9 }}>
                  Gerenciar
                </Link>
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

      {/* Toast: link copiado */}
      {payLink && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "rgba(18,22,18,0.97)",
            border: "1px solid rgba(212,175,55,0.4)",
            borderRadius: 12,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            maxWidth: "calc(100vw - 48px)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--gold-light)", fontWeight: 600 }}>🔗 Link copiado!</span>
          <code style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
            {payLink.url}
          </code>
          <a
            href={payLink.url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
            style={{ padding: "5px 10px", fontSize: 10, flexShrink: 0 }}
          >
            Abrir ↗
          </a>
          <button
            className="btn-icon"
            style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }}
            onClick={() => setPayLink(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

const stripeSummaryStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1fr) repeat(3, minmax(120px, auto)) auto",
  gap: 10,
  alignItems: "center",
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(255,248,234,0.035)",
};

const codePillStyle: React.CSSProperties = {
  border: "1px solid var(--glass-border)",
  borderRadius: 999,
  padding: "6px 10px",
  color: "var(--cream-dim)",
  background: "rgba(10,22,11,0.45)",
  fontSize: 10,
};

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
  const [editorial, setEditorial] = useState<ProductEditorialContent>(() =>
    normalizeEditableEditorial(defaults?.editorial_content)
  );
  const [galleryImages, setGalleryImages] = useState<Array<{ id: string; url: string }>>(
    defaults?.gallery_images?.length
      ? defaults.gallery_images.map((image) => ({ id: image.id, url: image.url }))
      : defaults?.cover_media_id && defaults.cover_url
        ? [{ id: defaults.cover_media_id, url: defaults.cover_url }]
        : []
  );
  const [libOpen, setLibOpen] = useState(false);
  const coverUrl = galleryImages[0]?.url ?? "";
  const categoryOptions = [
    { value: "", label: "Sem categoria" },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  function addImage(url: string, mediaId?: string) {
    if (!mediaId) return;
    setGalleryImages((current) =>
      current.some((image) => image.id === mediaId) ? current : [...current, { id: mediaId, url }]
    );
  }

  function removeImage(mediaId: string) {
    setGalleryImages((current) => current.filter((image) => image.id !== mediaId));
  }

  function makeCover(mediaId: string) {
    setGalleryImages((current) => {
      const selected = current.find((image) => image.id === mediaId);
      if (!selected) return current;
      return [selected, ...current.filter((image) => image.id !== mediaId)];
    });
  }

  function patchCard(index: number, patch: Partial<ProductEditorialCard>) {
    setEditorial((current) => ({
      ...current,
      cards: current.cards.map((card, cardIndex) =>
        cardIndex === index ? { ...card, ...patch } : card
      ),
    }));
  }

  function patchFaq(index: number, patch: Partial<ProductFaqItem>) {
    setEditorial((current) => ({
      ...current,
      faq: current.faq.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  }

  function addFaq() {
    setEditorial((current) => ({
      ...current,
      faq: [...current.faq, { question: "Nova pergunta", answer: "" }].slice(0, 10),
    }));
  }

  function removeFaq(index: number) {
    setEditorial((current) => ({
      ...current,
      faq: current.faq.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

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
          media_id: galleryImages[0]?.id ?? null,
          gallery_media_ids: galleryImages.map((image) => image.id),
          editorial_content: editorial,
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

      <div className="field">
        <span className="field-label">Reel / galeria de imagens</span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
          {galleryImages.map((image, index) => (
            <div key={image.id} style={{ width: 96, display: "grid", gap: 6 }}>
              <button
                type="button"
                onClick={() => makeCover(image.id)}
                title={index === 0 ? "Imagem de capa" : "Definir como capa"}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 14,
                  border: index === 0 ? "1px solid var(--gold-light)" : "1px solid var(--glass-border)",
                  background: `linear-gradient(rgba(10,22,11,0.05), rgba(10,22,11,0.05)), url("${image.url}") center / cover`,
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {index === 0 ? (
                  <span
                    style={{
                      position: "absolute",
                      left: 8,
                      bottom: 8,
                      borderRadius: 999,
                      padding: "4px 8px",
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      color: "var(--forest-950)",
                      background: "var(--gold-light)",
                    }}
                  >
                    Capa
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => removeImage(image.id)}
                style={{ padding: "6px 8px", fontSize: 9 }}
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLibOpen(true)}
            style={{
              width: 112,
              minHeight: 96,
              padding: "10px 8px",
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderStyle: "dashed",
              border: "1px dashed var(--glass-border)",
              borderRadius: 14,
              background: "rgba(242, 236, 223, 0.055)",
              color: "var(--cream-soft)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 1.1,
              lineHeight: 1.25,
              textAlign: "center",
              textTransform: "uppercase",
              whiteSpace: "normal",
              overflow: "hidden",
              overflowWrap: "break-word",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(217, 184, 122, 0.45)",
                color: "var(--gold-light)",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              +
            </span>
            <span style={{ maxWidth: 82 }}>Adicionar imagem</span>
          </button>
        </div>
        <span className="muted" style={{ fontSize: 10.5 }}>
          Selecione uma ou mais imagens na biblioteca. A primeira imagem vira capa no catálogo e na página do produto.
        </span>
      </div>

      <section className="glass" style={{ padding: 16, display: "grid", gap: 14 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Conteúdo da página pública</p>
          <p className="muted" style={{ fontSize: 11, lineHeight: 1.55, margin: 0 }}>
            Edite os cards e as dúvidas que aparecem na página pública deste produto.
          </p>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {editorial.cards.map((card, index) => (
            <div
              key={`card-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              <input
                className="input"
                value={card.eyebrow}
                onChange={(e) => patchCard(index, { eyebrow: e.target.value })}
                placeholder="Etiqueta"
              />
              <input
                className="input"
                value={card.title}
                onChange={(e) => patchCard(index, { title: e.target.value })}
                placeholder="Título do card"
              />
              <textarea
                className="input"
                value={card.body}
                onChange={(e) => patchCard(index, { body: e.target.value })}
                placeholder="Texto do card"
                rows={3}
                style={{ gridColumn: "1 / -1", resize: "vertical", paddingTop: 10, lineHeight: 1.55 }}
              />
            </div>
          ))}
        </div>

        <div className="field">
          <span className="field-label">Título do FAQ</span>
          <input
            className="input"
            value={editorial.faq_title}
            onChange={(e) => setEditorial((current) => ({ ...current, faq_title: e.target.value }))}
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {editorial.faq.map((item, index) => (
            <div key={`faq-${index}`} style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                <input
                  className="input"
                  value={item.question}
                  onChange={(e) => patchFaq(index, { question: e.target.value })}
                  placeholder="Pergunta"
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => removeFaq(index)}
                  style={{ padding: "0 12px", fontSize: 9 }}
                >
                  Remover
                </button>
              </div>
              <textarea
                className="input"
                value={item.answer}
                onChange={(e) => patchFaq(index, { answer: e.target.value })}
                placeholder="Resposta"
                rows={2}
                style={{ resize: "vertical", paddingTop: 10, lineHeight: 1.55 }}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={addFaq}
            style={{ padding: "10px 14px", fontSize: 10, borderStyle: "dashed" }}
          >
            + Adicionar pergunta
          </button>
        </div>
      </section>

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
          <GlassSelect
            value={categoryId}
            options={categoryOptions}
            ariaLabel="Categoria"
            onChange={setCategoryId}
          />
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
            addImage(url, mediaId);
          }}
        />
      ) : null}
    </form>
  );
}
