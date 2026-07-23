import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "./Shell";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";

export const metadata: Metadata = {
  title: "Flora · Admin",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();
  let faviconUrl: string | null = null;

  if (session) {
    try {
      const tenantId = await effectiveTenantId();
      const supabase = await supabaseServer();
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("tenant_id", tenantId)
        .eq("key", "favicon")
        .maybeSingle();
      faviconUrl = ((data?.value as { url?: string } | null)?.url ?? null) as string | null;
    } catch {
      faviconUrl = null;
    }
  }

  return (
    <html lang="pt-BR">
      <head>
        {faviconUrl ? <link rel="icon" href={faviconUrl} /> : null}
        {faviconUrl ? <link rel="shortcut icon" href={faviconUrl} /> : null}
        {faviconUrl ? <link rel="apple-touch-icon" href={faviconUrl} /> : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Anti-flash: aplica o tema salvo antes da hidratação do React */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k="flora_admin_theme";var m={ambar:["#b9924d","#d9b87a","#96763f","185,146,77"],esmeralda:["#3d9b73","#62c99d","#2d7a58","61,155,115"],indigo:["#5b7bd5","#839fe8","#3e5db5","91,123,213"],rosa:["#c46b8a","#de93aa","#a04d6c","196,107,138"],violeta:["#8b5cf6","#a98af8","#6d3fd4","139,92,246"],cobre:["#b5622d","#d4884f","#8f4c22","181,98,45"],ardosia:["#6b83a0","#90a8c3","#4d6380","107,131,160"],coral:["#c05e52","#de8479","#9a4438","192,94,82"]};var id=localStorage.getItem(k)||"ambar";var t=m[id]||m.ambar;var r=document.documentElement;r.style.setProperty("--gold",t[0]);r.style.setProperty("--gold-light",t[1]);r.style.setProperty("--gold-dark",t[2]);r.style.setProperty("--gold-rgb",t[3]);r.style.setProperty("--glass-border-hover","rgba("+t[3]+",0.45)");r.style.setProperty("--shadow-glow","0 0 42px rgba("+t[3]+",0.18)");r.setAttribute("data-theme",id);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Shell role={session?.role}>{children}</Shell>
      </body>
    </html>
  );
}
