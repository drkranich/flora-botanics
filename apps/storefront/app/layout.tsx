import type { Metadata } from "next";
import "./globals.css";
import { currentTenant, db } from "@/lib/tenant";
import { getTenantTheme, getSiteSetting } from "@flora/db";

/** Metadata dinâmica: inclui favicon da marca se configurado no CMS. */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await currentTenant();
    const faviconSetting = await getSiteSetting<{ url: string }>(db(), tenant.tenantId, "favicon");
    const faviconUrl = faviconSetting?.url;
    return {
      title: "Flora Botanics",
      description: "Cosméticos inspirados pela biodiversidade brasileira.",
      ...(faviconUrl
        ? { icons: { icon: faviconUrl, apple: faviconUrl, shortcut: faviconUrl } }
        : {}),
    };
  } catch {
    return {
      title: "Flora Botanics",
      description: "Cosméticos inspirados pela biodiversidade brasileira.",
    };
  }
}

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
  const tokens = await getTenantTheme(db(), tenant.tenantId);

  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Montserrat:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: themeToCssVars(tokens) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
