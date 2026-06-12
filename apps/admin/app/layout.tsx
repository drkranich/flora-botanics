import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "./Shell";
import { getStaffSession } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Flora · Admin",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();

  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Shell isPlatformAdmin={session?.role === "platform_admin"}>{children}</Shell>
      </body>
    </html>
  );
}
