import type { Metadata } from "next";
import "./globals.css";
import { currentTenant, db } from "@/lib/tenant";
import { getTenantTheme } from "@flora/db";
import { TranslateProvider } from "@/blocks/TranslateProvider";

export const metadata: Metadata = {
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
      <body>
        {children}
        <TranslateProvider />
      </body>
    </html>
  );
}
