import type { Metadata } from "next";
import "./globals.css";
import { currentTenant, db } from "@/lib/tenant";
import { getTenantTheme, getSiteSetting } from "@flora/db";
import { ChatWidget } from "@/components/ChatWidget";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "https://florabotanics.com.br"),
  title: "Flora Botanics",
  description: "Cosméticos inspirados pela biodiversidade brasileira.",
};

function themeToCssVars(tokens: Record<string, unknown>): string {
  const colors = (tokens.colors ?? {}) as Record<string, string>;
  const map: Record<string, string> = {
    "forest-900": "--green-900",
    "forest-800": "--green-800",
    "forest-700": "--green-700",
    cream: "--cream",
    "cream-dark": "--cream-dark",
    gold: "--gold",
    "gold-dark": "--gold-dark",
    ink: "--text",
    muted: "--muted",
    white: "--white",
  };
  const lines = Object.entries(colors)
    .filter(([k]) => map[k])
    .map(([k, v]) => `${map[k]}: ${v};`);
  return `:root { ${lines.join(" ")} }`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await currentTenant();
  const [tokens, faviconSetting] = await Promise.all([
    getTenantTheme(db(), tenant.tenantId),
    getSiteSetting<{ url: string }>(db(), tenant.tenantId, "favicon").catch(() => null),
  ]);

  const faviconUrl = faviconSetting?.url ?? null;

  return (
    <html lang="pt-BR">
      <head>
        {faviconUrl && <link rel="icon" type="image/png" href={faviconUrl} />}
        {faviconUrl && <link rel="shortcut icon" href={faviconUrl} />}
        {faviconUrl && <link rel="apple-touch-icon" href={faviconUrl} />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700;800&family=Lora:wght@400;500;600&family=Montserrat:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: themeToCssVars(tokens) }} />
      </head>
      <body>
        <div className="site-shell">{children}</div>
        <ChatWidget />
      </body>
    </html>
  );
}
