"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type MediaRow = {
  id: string;
  storage_path: string;
  alt: string | null;
  created_at: string;
};

function publicUrl(path: string) {
  const supabase = supabaseBrowser();
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/** Campo de imagem premium: thumbnail + biblioteca + upload. */
export function ImageField({
  value,
  tenantId,
  onChange,
}: {
  value: string;
  tenantId: string;
  onChange: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const src = value
    ? value.startsWith("http")
      ? value
      : `/${value.replace(/^\//, "")}`
    : "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        onClick={() => setOpen(true)}
        title="Trocar imagem"
        style={{
          width: 86,
          height: 60,
          borderRadius: 10,
          border: "1px solid var(--glass-border)",
          background: src
            ? `url("${src}") center / cover`
            : "rgba(10,22,11,0.45)",
          cursor: "pointer",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          color: "var(--cream-dim)",
          fontSize: 18,
          transition: "border-color 0.3s var(--ease)",
        }}
      >
        {src ? "" : "+"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="URL da imagem ou escolha na biblioteca"
          style={{ fontSize: 11.5 }}
        />
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen(true)}
        style={{ padding: "10px 16px", fontSize: 9.5, flexShrink: 0 }}
      >
        Biblioteca
      </button>
      {open ? (
        <MediaLibraryModal
          tenantId={tenantId}
          onClose={() => setOpen(false)}
          onSelect={(url) => {
            onChange(url);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MediaLibraryModal({
  tenantId,
  onClose,
  onSelect,
}: {
  tenantId: string;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const supabase = supabaseBrowser();
    const { data } = await supabase
      .from("media")
      .select("id, storage_path, alt, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(60);
    setItems((data ?? []) as MediaRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const clean = file.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9.]+/g, "-");
      const path = `${tenantId}/${Date.now()}-${clean}`;

      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("media").insert({
        tenant_id: tenantId,
        storage_path: path,
        provider: "supabase",
        mime: file.type,
        byte_size: file.size,
        alt: file.name.replace(/\.[^.]+$/, ""),
      });
      if (dbErr) throw dbErr;

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5, 12, 6, 0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        className="glass rise"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: "rgba(15, 32, 18, 0.92)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          <div>
            <p className="eyebrow">Biblioteca de mídia</p>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Clique em uma imagem para usá-la, ou envie uma nova.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn btn-gold"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              style={{ padding: "10px 20px", fontSize: 10 }}
            >
              {uploading ? "Enviando…" : "↑ Enviar imagem"}
            </button>
            <button type="button" className="btn-icon" onClick={onClose} title="Fechar">
              ✕
            </button>
          </div>
        </header>

        {error ? (
          <p style={{ color: "#e8a0a0", fontSize: 12, padding: "10px 24px 0" }}>{error}</p>
        ) : null}

        <div
          style={{
            overflowY: "auto",
            padding: 24,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 14,
          }}
        >
          {loading ? (
            <p className="muted" style={{ fontSize: 12 }}>Carregando…</p>
          ) : items.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, gridColumn: "1 / -1" }}>
              Biblioteca vazia — envie a primeira imagem.
            </p>
          ) : (
            items.map((m) => {
              const url = publicUrl(m.storage_path);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect(url)}
                  title={m.alt ?? ""}
                  style={{
                    aspectRatio: "4 / 3",
                    borderRadius: 12,
                    border: "1px solid var(--glass-border)",
                    background: `url("${url}") center / cover`,
                    cursor: "pointer",
                    transition: "transform 0.25s var(--ease), border-color 0.25s var(--ease)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gold)";
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--glass-border)";
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
