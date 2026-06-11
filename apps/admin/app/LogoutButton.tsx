"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      style={{
        border: "1px solid #b9924d",
        background: "transparent",
        color: "#b9924d",
        padding: "8px 16px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      Sair
    </button>
  );
}
