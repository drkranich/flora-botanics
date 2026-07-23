"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import { storefrontSupabase } from "@/lib/supabase-browser";

interface WishlistRow {
  id: string;
  product_id: string;
  created_at: string;
  products: ProductCardProduct | ProductCardProduct[] | null;
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function FavoritesPanel({
  tenantId,
  storageBase,
}: {
  tenantId: string;
  storageBase: string;
}) {
  const supabase = useMemo(() => storefrontSupabase(), []);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [rows, setRows] = useState<ProductCardProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        if (mounted) {
          setAuthenticated(false);
          setRows([]);
          setLoading(false);
        }
        return;
      }

      const { data, error: wishlistError } = await supabase
        .from("wishlist_items")
        .select(
          `id, product_id, created_at,
           products(id, slug, name, subtitle, type, brand_line, tags,
             product_variants(id, price_cents, currency, is_default),
             product_media(role, sort_order, media(storage_path, alt)))`
        )
        .eq("tenant_id", tenantId)
        .eq("profile_id", userId)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (wishlistError) {
        setError(wishlistError.message);
        setRows([]);
      } else {
        const products = ((data ?? []) as unknown as WishlistRow[])
          .map((item) => first(item.products))
          .filter((product): product is ProductCardProduct => Boolean(product));
        setRows(products);
      }

      setAuthenticated(true);
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [supabase, tenantId]);

  if (loading) {
    return (
      <section className="wishlist-empty-card">
        <span className="eyebrow">Favoritos</span>
        <h1>Carregando seus cuidados salvos</h1>
        <p>Estamos sincronizando sua lista com a sua conta Flora.</p>
      </section>
    );
  }

  if (!authenticated) {
    return (
      <section className="wishlist-empty-card">
        <span className="eyebrow">Favoritos</span>
        <h1>Entre para salvar seus produtos</h1>
        <p>Crie ou acesse sua conta para manter sua lista sincronizada em todos os dispositivos.</p>
        <Link href="/conta" className="btn">
          Entrar ou criar conta
        </Link>
      </section>
    );
  }

  if (error) {
    return (
      <section className="wishlist-empty-card">
        <span className="eyebrow">Favoritos</span>
        <h1>Nao foi possivel carregar</h1>
        <p>{error}</p>
        <Link href="/produtos" className="btn">
          Ver catalogo
        </Link>
      </section>
    );
  }

  return (
    <section className="wishlist-section">
      <div className="wishlist-heading">
        <div>
          <span className="eyebrow">Favoritos</span>
          <h1>Lista de desejos</h1>
        </div>
        <Link href="/produtos" className="btn btn-secondary">
          Continuar comprando
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="wishlist-empty-card">
          <h2>Sua lista ainda esta vazia</h2>
          <p>Toque no coracao dos produtos para montar sua selecao pessoal.</p>
          <Link href="/produtos" className="btn">
            Explorar catalogo
          </Link>
        </div>
      ) : (
        <div className="category-grid wishlist-grid">
          {rows.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              storageBase={storageBase}
              tenantId={tenantId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
