"use client";

import { useRef, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { importProducts, type ImportItem, type ImportResult } from "@/lib/catalog/import";

/**
 * Importação de produtos via planilha (.xlsx, .xls ou .csv).
 *
 * Colunas aceitas (cabeçalho na primeira linha, sem diferença de
 * maiúsculas/acentos): nome*, subtitulo, preco*, preco_de, estoque,
 * categoria, sku, publicado (sim/não).
 */

type ParsedRow = {
  line: number;
  item?: ImportItem;
  error?: string;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]/g, "");

const HEADER_ALIASES: Record<string, string> = {
  nome: "name",
  produto: "name",
  subtitulo: "subtitle",
  descricao: "subtitle",
  preco: "price",
  precode: "compare_at",
  preco_de: "compare_at",
  precoantigo: "compare_at",
  estoque: "stock",
  quantidade: "stock",
  categoria: "category",
  sku: "sku",
  codigo: "sku",
  publicado: "published",
  ativo: "published",
};

function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return v > 0 ? Math.round(v * 100) : null;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[r$\s.]/gi, "").replace(",", "."));
    // remove separador de milhar com cautela: "1.234,56" -> "1234.56"
    const n2 = parseFloat(v.replace(/\./g, "").replace(",", "."));
    const val = Number.isFinite(n2) ? n2 : n;
    return Number.isFinite(val) && val > 0 ? Math.round(val * 100) : null;
  }
  return null;
}

function parseBool(v: unknown): boolean {
  const s = String(v ?? "").toLowerCase().trim();
  return ["sim", "s", "true", "1", "x", "yes"].includes(s);
}

function parseRows(rows: Record<string, unknown>[]): ParsedRow[] {
  return rows.map((raw, idx) => {
    const line = idx + 2; // 1 = cabeçalho
    const mapped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = HEADER_ALIASES[norm(k)];
      if (key) mapped[key] = v;
    }

    const name = String(mapped.name ?? "").trim();
    if (!name) return { line, error: "coluna 'nome' vazia" };
    if (name.length > 120) return { line, error: "nome com mais de 120 caracteres" };

    const price = parsePrice(mapped.price);
    if (!price) return { line, error: "preço inválido (use ex.: 89,90)" };

    const compareAt = mapped.compare_at != null && String(mapped.compare_at).trim() !== ""
      ? parsePrice(mapped.compare_at)
      : null;

    const stockNum = parseInt(String(mapped.stock ?? "0"), 10);
    const stock = Number.isFinite(stockNum) && stockNum >= 0 ? stockNum : null;
    if (stock === null) return { line, error: "estoque inválido (inteiro ≥ 0)" };

    return {
      line,
      item: {
        name,
        subtitle: String(mapped.subtitle ?? "").trim() || null,
        price_cents: price,
        compare_at_cents: compareAt,
        stock,
        category_key: String(mapped.category ?? "").trim() || null,
        sku: String(mapped.sku ?? "").trim() || null,
        published: parseBool(mapped.published),
      },
    };
  });
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["nome", "subtitulo", "preco", "preco_de", "estoque", "categoria", "sku", "publicado"],
    ["Sérum de Andiroba", "Regenera e acalma a pele", "129,90", "159,90", 50, "Sérums", "SER-AND-30", "sim"],
    ["Óleo de Buriti 30ml", "", "89,90", "", 30, "Óleos Botânicos", "", "não"],
  ]);
  ws["!cols"] = [{ wch: 26 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  XLSX.writeFile(wb, "modelo-produtos-flora.xlsx");
}

export function ImportProducts() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (json.length === 0) {
        setError("Planilha vazia ou sem cabeçalho na primeira linha.");
        return;
      }
      if (json.length > 500) {
        setError("Máximo de 500 linhas por importação — divida a planilha.");
        return;
      }
      setRows(parseRows(json));
    } catch {
      setError("Não consegui ler o arquivo. Use .xlsx, .xls ou .csv.");
    }
  }

  function confirm() {
    if (!rows) return;
    const valid = rows.filter((r) => r.item).map((r) => r.item!) as ImportItem[];
    startTransition(async () => {
      try {
        const res = await importProducts(valid);
        setResult(res);
        setRows(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro na importação");
      }
    });
  }

  const validCount = rows?.filter((r) => r.item).length ?? 0;
  const errorRows = rows?.filter((r) => r.error) ?? [];

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)} style={{ padding: "9px 20px", fontSize: 10 }}>
        ⇪ Importar planilha
      </button>

      {open ? (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(5,12,6,0.7)", backdropFilter: "blur(6px)",
            display: "grid", placeItems: "center", padding: 24,
          }}
        >
          <div
            className="glass rise"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 100%)", maxHeight: "84vh",
              display: "flex", flexDirection: "column",
              background: "rgba(15,32,18,0.94)",
            }}
          >
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "22px 26px", borderBottom: "1px solid var(--glass-border)" }}>
              <div>
                <p className="eyebrow">Importar produtos via planilha</p>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 6, maxWidth: 420, lineHeight: 1.6 }}>
                  Aceita .xlsx, .xls e .csv (até 500 linhas). Colunas: <b>nome</b> e{" "}
                  <b>preco</b> obrigatórias; subtitulo, preco_de, estoque, categoria
                  (nome ou slug), sku e publicado (sim/não) opcionais. Produtos com
                  nome repetido são pulados, nunca sobrescritos.
                </p>
              </div>
              <button className="btn-icon" onClick={() => setOpen(false)} title="Fechar">✕</button>
            </header>

            <div style={{ padding: 26, overflowY: "auto" }}>
              {!rows && !result ? (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                  <button className="btn btn-gold" onClick={() => fileRef.current?.click()} style={{ padding: "12px 24px" }}>
                    Escolher arquivo
                  </button>
                  <button className="btn btn-ghost" onClick={downloadTemplate} style={{ padding: "12px 22px" }}>
                    ⬇ Baixar modelo (.xlsx)
                  </button>
                </div>
              ) : null}

              {rows ? (
                <div>
                  <p style={{ fontSize: 13, marginBottom: 12 }}>
                    <b style={{ color: "var(--gold-light)" }}>{validCount}</b> linhas válidas
                    {errorRows.length > 0 ? (
                      <> · <b style={{ color: "#e8a0a0" }}>{errorRows.length}</b> com erro (serão ignoradas)</>
                    ) : null}
                  </p>

                  {errorRows.length > 0 ? (
                    <div style={{ border: "1px dashed rgba(232,160,160,0.4)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                      {errorRows.slice(0, 8).map((r) => (
                        <p key={r.line} style={{ fontSize: 11.5, color: "#e8a0a0" }}>
                          Linha {r.line}: {r.error}
                        </p>
                      ))}
                      {errorRows.length > 8 ? (
                        <p className="muted" style={{ fontSize: 11 }}>… e mais {errorRows.length - 8}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 16 }}>
                    {rows.filter((r) => r.item).slice(0, 50).map((r) => (
                      <div key={r.line} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 4px", borderBottom: "1px solid var(--glass-border)", fontSize: 12 }}>
                        <span>{r.item!.name}</span>
                        <span className="muted">
                          {(r.item!.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          {" · "}{r.item!.stock} un.
                          {r.item!.published ? " · publicado" : " · rascunho"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-gold" disabled={pending || validCount === 0} onClick={confirm} style={{ padding: "12px 24px" }}>
                      {pending ? "Importando…" : `Importar ${validCount} produtos`}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setRows(null)} style={{ padding: "12px 20px" }}>
                      Trocar arquivo
                    </button>
                  </div>
                </div>
              ) : null}

              {result ? (
                <div>
                  <p style={{ fontSize: 14, marginBottom: 10 }}>
                    ✓ <b style={{ color: "var(--gold-light)" }}>{result.created}</b> produtos criados.
                  </p>
                  {result.skipped.length > 0 ? (
                    <div style={{ border: "1px dashed var(--glass-border)", borderRadius: 12, padding: 14 }}>
                      <p className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
                        {result.skipped.length} pulados:
                      </p>
                      {result.skipped.slice(0, 10).map((s, i) => (
                        <p key={i} style={{ fontSize: 11.5 }}>
                          {s.name} — <span className="muted">{s.reason}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <button className="btn btn-gold" onClick={() => { setOpen(false); setResult(null); }} style={{ padding: "12px 24px", marginTop: 16 }}>
                    Concluir
                  </button>
                </div>
              ) : null}

              {error ? (
                <p style={{ color: "#e8a0a0", fontSize: 12.5, marginTop: 14 }}>{error}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
