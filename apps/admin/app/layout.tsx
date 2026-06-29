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
      </head>
      <body>
        <Shell role={session?.role}>{children}</Shell>
      </body>
    </html>
  );
}
