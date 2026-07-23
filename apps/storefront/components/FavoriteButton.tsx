"use client";

import { useEffect, useState, useTransition } from "react";
import { storefrontSupabase } from "@/lib/supabase-browser";

export function FavoriteButton({
  tenantId,
  productId,
  label = "Favoritar",
  compact = false,
}: {
  tenantId: string;
  productId: string;
  label?: string;
  compact?: boolean;
}) {
  const supabase = storefrontSupabase();
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        if (mounted) setReady(true);
        return;
      }

      const { data } = await supabase
        .from("wishlist_items")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("profile_id", userId)
        .eq("product_id", productId)
        .maybeSingle();

      if (mounted) {
        setActive(Boolean(data));
        setReady(true);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [productId, supabase, tenantId]);

  function toggle() {
    startTransition(async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        window.location.href = "/conta";
        return;
      }

      if (active) {
        const { error } = await supabase
          .from("wishlist_items")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("profile_id", userId)
          .eq("product_id", productId);

        if (!error) setActive(false);
        return;
      }

      const { error } = await supabase.from("wishlist_items").insert({
        tenant_id: tenantId,
        profile_id: userId,
        product_id: productId,
      });

      if (!error) setActive(true);
    });
  }

  return (
    <button
      type="button"
      className={compact ? "favorite-button is-compact" : "favorite-button"}
      data-active={active ? "true" : "false"}
      disabled={pending || !ready}
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      title={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      <span aria-hidden="true">{active ? "♥" : "♡"}</span>
      {compact ? null : <em>{active ? "Favorito" : label}</em>}
    </button>
  );
}
