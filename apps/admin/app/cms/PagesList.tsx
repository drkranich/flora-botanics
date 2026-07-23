"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { GlassSelect } from "@/components/GlassSelect";
import { createPage } from "@/lib/cms/actions";

export type PageRow = {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  updated_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  home: "Página inicial",
  landing: "Landing page",
  institutional: "Institucional",
  blog_post: "Blog",
};

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "published", label: "No ar" },
  { value: "draft", label: "Rascunho" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "Todos os tipos" },
  { value: "home", label: TYPE_LABEL.home },
  { value: "landing", label: TYPE_LABEL.landing },
  { value: "institutional", label: TYPE_LABEL.institutional },
  { value: "blog_post", label: TYPE_LABEL.blog_post },
];

const NEW_TYPE_OPTIONS = TYPE_OPTIONS.filter((option) => option.value !== "all" && option.value !== "home");

export function PagesList({ rows, storefrontUrl }: { rows: PageRow[]; storefrontUrl: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("landing");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter(
        (p) =>
          (status === "all" || p.status === status) &&
          (type === "all" || p.type === type) &&
          (q.trim() === "" ||
            p.title.toLowerCase().includes(q.toLowerCase()) ||
            p.slug.includes(q.toLowerCase()))
      ),
    [rows, q, status, type]
  );

  const previewHref = (p: PageRow) =>
    p.type === "home" ? storefrontUrl : `${storefrontUrl}/p/${p.slug}`;

  return (
    <div>
      {/* toolbar */}
      <div className="rise" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <input
          className="input"
          placeholder="Buscar página…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <GlassSelect
          value={status}
          options={STATUS_OPTIONS}
          ariaLabel="Filtrar status"
          onChange={setStatus}
          style={{ width: 150 }}
        />
        <GlassSelect
          value={type}
          options={TYPE_OPTIONS}
          ariaLabel="Filtrar tipo de pagina"
          onChange={setType}
          style={{ width: 160 }}
        />
        <button className="btn btn-gold" onClick={() => setCreating((v) => !v)} style={{ padding: "11px 20px" }}>
          + Nova página
        </button>
      </div>

      {creating ? (
        <form
          className="glass rise"
          style={{ padding: 18, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            startTransition(async () => {
              try {
                const id = await createPage({ title: newTitle, type: newType });
                router.push(`/cms/${id}`);
              } catch (er) {
                setErr(er instanceof Error ? er.message : "Erro");
              }
            });
          }}
        >
          <input
            className="input"
            placeholder="Título da página (ex.: Promoções de Inverno)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
            style={{ flex: 1, minWidth: 220 }}
          />
          <GlassSelect
            value={newType}
            options={NEW_TYPE_OPTIONS}
            ariaLabel="Tipo da nova pagina"
            onChange={setNewType}
            style={{ width: 160 }}
          />
          <button type="submit" disabled={pending} className="btn btn-gold" style={{ padding: "11px 22px" }}>
            {pending ? "Criando…" : "Criar e editar"}
          </button>
          {err ? <p style={{ color: "#e8a0a0", fontSize: 12, width: "100%" }}>{err}</p> : null}
        </form>
      ) : null}

      {/* lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((p, i) => (
          <div
            key={p.id}
            className={`glass rise rise-${Math.min(i + 1, 4)}`}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "18px 22px", flexWrap: "wrap" }}
          >
            <div style={{ minWidth: 200 }}>
              <strong style={{ fontSize: 15 }}>{p.title}</strong>
              <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                /{p.slug} · {TYPE_LABEL[p.type] ?? p.type} · editada{" "}
                {new Date(p.updated_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className={`chip ${p.status === "published" ? "chip-live" : "chip-draft"}`}>
                {p.status === "published" ? "No ar" : "Rascunho"}
              </span>
              <a href={previewHref(p)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: "9px 16px", fontSize: 9.5 }}>
                Ver ↗
              </a>
              <Link href={`/cms/${p.id}`} className="btn btn-gold" style={{ padding: "9px 18px", fontSize: 9.5 }}>
                Editar
              </Link>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, padding: 20, textAlign: "center" }}>
            Nenhuma página encontrada com esses filtros.
          </p>
        ) : null}
      </div>
    </div>
  );
}
