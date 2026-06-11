import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flora Ecosystem — Admin",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: "Montserrat, system-ui, sans-serif",
          background: "#f2ecdf",
          color: "#28251d",
          margin: 0,
        }}
      >
        {children}
      </body>
    </html>
  );
}
