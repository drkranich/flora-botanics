/**
 * FASE 1 — Backoffice.
 * Roadmap (blueprint seção 10):
 *   1. Login (Supabase Auth) restrito a staff do tenant
 *   2. CMS: lista de páginas -> editor de seções -> preview -> publicar
 *   3. Catálogo: produtos, variantes, estoque, categorias, coleções
 *   4. Vendas: pedidos (máquina de estados), clientes, cupons
 *   5. Dashboard: receita, ticket médio, conversão
 */
export default function AdminHome() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 style={{ fontWeight: 900, letterSpacing: -1 }}>FLORA · ADMIN</h1>
        <p style={{ lineHeight: 1.6 }}>
          Backoffice em construção (Fase 1). O banco, o RLS e o CMS já estão
          ativos no Supabase — este painel será a interface deles.
        </p>
      </div>
    </main>
  );
}
