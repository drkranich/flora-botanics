"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

export function LogoutButton() {
  return (
    <button
      className="btn btn-ghost"
      style={{ padding: "10px 22px" }}
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        // window.location evita o bug basePath do opennextjs-cloudflare
        window.location.href = "/admin/login";
      }}
    >
      Sair
    </button>
  );
}
