import Link from "next/link";
import { ACRONYM_CATEGORIES, ACRONYMS, type AcronymCategory } from "@/lib/glossary/acronyms";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matches(entry: (typeof ACRONYMS)[number], query: string) {
  if (!query) return true;
  const rawHaystack = [
    entry.acronym,
    entry.meaning,
    entry.category,
    entry.explanation,
    entry.appearsIn.join(" "),
    entry.related?.join(" ") ?? "",
  ].join(" ");
  const haystack = normalize(rawHaystack);
  const compactHaystack = haystack.replace(/[^a-z0-9]+/g, "");
  const compactQuery = query.replace(/[^a-z0-9]+/g, "");
  return haystack.includes(query) || Boolean(compactQuery && compactHaystack.includes(compactQuery));
}

export default async function DicionarioPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; categoria?: string }>;
}) {
  const params = await searchParams;
  const query = normalize(params.busca ?? "");
  const selectedCategory = ACRONYM_CATEGORIES.includes(params.categoria as AcronymCategory)
    ? (params.categoria as AcronymCategory)
    : "";

  const entries = ACRONYMS
    .filter((entry) => !selectedCategory || entry.category === selectedCategory)
    .filter((entry) => matches(entry, query))
    .sort((a, b) => a.acronym.localeCompare(b.acronym, "pt-BR"));

  const fiscalCount = ACRONYMS.filter((entry) => entry.category === "Fiscal").length;
  const internationalCount = ACRONYMS.filter((entry) => entry.category === "Comércio exterior").length;

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "42px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 24 }}>
        <Link href="/" className="eyebrow" style={{ opacity: 0.82 }}>
          ← Painel
        </Link>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <p className="eyebrow">Dicionário operacional</p>
          <h1 className="display" style={{ fontSize: 46, lineHeight: 1.02 }}>
            Siglas da Flora Botanics
          </h1>
          <p className="muted" style={{ maxWidth: 820, fontSize: 14, lineHeight: 1.65 }}>
            Glossário interno para entender siglas fiscais, tributárias, logísticas, financeiras,
            comerciais, técnicas e de marketing usadas no SaaS. Sempre que uma nova sigla entrar
            no sistema, ela deve nascer aqui também.
          </p>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Stat label="Siglas mapeadas" value={String(ACRONYMS.length)} />
        <Stat label="Fiscal e tributário" value={String(fiscalCount)} />
        <Stat label="Comércio exterior" value={String(internationalCount)} />
        <Stat label="Categorias" value={String(ACRONYM_CATEGORIES.length)} />
      </section>

      <section className="glass rise rise-1" style={{ padding: 18, marginBottom: 18, overflow: "visible" }}>
        <form action="/dicionario" style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 7 }}>
            <span className="field-label">Buscar sigla, significado ou módulo</span>
            <input
              name="busca"
              className="input"
              defaultValue={params.busca ?? ""}
              placeholder="Ex.: DAP, NF-e, DCTFWeb, SKU, VAT, PIX..."
              style={{ minHeight: 44 }}
            />
          </label>
          {selectedCategory ? <input type="hidden" name="categoria" value={selectedCategory} /> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn btn-gold" style={{ minHeight: 38, padding: "9px 18px", fontSize: 10 }}>
              Buscar
            </button>
            <Link href="/dicionario" className="btn btn-ghost" style={{ minHeight: 38, padding: "9px 18px", fontSize: 10 }}>
              Limpar
            </Link>
          </div>
        </form>

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FilterChip href={`/dicionario${params.busca ? `?busca=${encodeURIComponent(params.busca)}` : ""}`} active={!selectedCategory}>
            Todas
          </FilterChip>
          {ACRONYM_CATEGORIES.map((category) => {
            const href = `/dicionario?categoria=${encodeURIComponent(category)}${params.busca ? `&busca=${encodeURIComponent(params.busca)}` : ""}`;
            return (
              <FilterChip key={category} href={href} active={selectedCategory === category}>
                {category}
              </FilterChip>
            );
          })}
        </div>
      </section>

      <section style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <p className="eyebrow" style={{ margin: 0 }}>Resultado</p>
          <span className="chip chip-draft">{entries.length} de {ACRONYMS.length} sigla(s)</span>
        </div>

        {entries.length === 0 ? (
          <div className="glass" style={{ padding: 22 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Nenhuma sigla encontrada</h2>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
              Limpe os filtros ou procure por outra palavra ligada ao módulo.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {entries.map((entry) => (
              <article key={`${entry.category}-${entry.acronym}`} className="glass glass-hover" style={{ padding: 18, minHeight: 250, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 6 }}>{entry.category}</p>
                    <h2 className="display" style={{ fontSize: 34, lineHeight: 1 }}>
                      {entry.acronym}
                    </h2>
                  </div>
                  <span className="chip chip-live" style={{ whiteSpace: "nowrap" }}>Glossário</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.25 }}>{entry.meaning}</h3>
                  <p className="muted" style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.58 }}>
                    {entry.explanation}
                  </p>
                </div>
                <div style={{ display: "grid", gap: 8, alignSelf: "end" }}>
                  <div>
                    <p className="field-label" style={{ marginBottom: 6 }}>Onde aparece</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {entry.appearsIn.map((area) => (
                        <span key={area} className="chip chip-draft">{area}</span>
                      ))}
                    </div>
                  </div>
                  {entry.related?.length ? (
                    <div>
                      <p className="field-label" style={{ marginBottom: 6 }}>Relacionadas</p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {entry.related.map((related) => (
                          <span key={related} className="chip">{related}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass" style={{ padding: "16px 18px" }}>
      <p className="display" style={{ fontSize: 28, color: "var(--gold-light)" }}>{value}</p>
      <p className="muted" style={{ marginTop: 4, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </p>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={active ? "btn btn-gold" : "btn btn-ghost"}
      style={{ minHeight: 34, padding: "8px 14px", fontSize: 9.5 }}
    >
      {children}
    </Link>
  );
}
