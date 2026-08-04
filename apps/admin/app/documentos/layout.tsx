/**
 * /documentos — Layout raiz estilo Zoho Books
 * Sidebar com seções: Orçamentos, Cotações, Propostas, (futuro: Pedidos de Compra)
 */
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

const SECTIONS = [
  {
    group: "Documentos comerciais",
    items: [
      { href: "/documentos", label: "Todos", kind: "" },
      { href: "/documentos?kind=budget", label: "Orçamentos", kind: "budget" },
      { href: "/documentos?kind=quote", label: "Cotações", kind: "quote" },
      { href: "/documentos?kind=proposal", label: "Propostas", kind: "proposal" },
    ],
  },
  {
    group: "Por status",
    items: [
      { href: "/documentos?status=draft", label: "Rascunhos", kind: "" },
      { href: "/documentos?status=sent", label: "Enviados", kind: "" },
      { href: "/documentos?status=approved", label: "Aprovados", kind: "" },
      { href: "/documentos?status=converted", label: "Convertidos", kind: "" },
    ],
  },
  {
    group: "Fiscais",
    items: [
      { href: "/documentos/fiscais",   label: "📁 Documentos fiscais", kind: "" },
      { href: "/documentos/recebidos", label: "📥 Documentos recebidos", kind: "" },
    ],
  },
];

function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const kind = searchParams.get("kind") ?? "";
  const status = searchParams.get("status") ?? "";

  function isActive(href: string) {
    const url = new URL(href, "http://x");
    const hKind = url.searchParams.get("kind") ?? "";
    const hStatus = url.searchParams.get("status") ?? "";
    const hPath = url.pathname;
    // Rota sem query params (ex: /documentos/fiscais)
    if (!url.search) return pathname === hPath;
    if (hPath !== pathname) return false;
    return hKind === kind && hStatus === status;
  }

  return (
    <aside style={sidebarStyle}>
      <div style={{ padding: "20px 16px 12px" }}>
        <Link href="/documentos" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--cream, #f2e8d9)", letterSpacing: "-0.3px" }}>
            📄 Documentos
          </span>
        </Link>
      </div>

      <Link
        href="/documentos/novo"
        style={{
          display: "block", margin: "0 12px 16px",
          padding: "9px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
          textAlign: "center", textDecoration: "none",
          background: "var(--gold-light, #c8a84b)", color: "#1a2e1a",
        }}
      >
        + Novo documento
      </Link>

      {SECTIONS.map((section) => (
        <div key={section.group} style={{ marginBottom: 16 }}>
          <p style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
            padding: "0 16px", margin: "0 0 4px",
          }}>
            {section.group}
          </p>
          {section.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "block", padding: "8px 16px",
                  fontSize: 13, textDecoration: "none",
                  borderRadius: 6, margin: "1px 8px",
                  color: active ? "var(--gold-light, #c8a84b)" : "var(--cream-dim, #b0a898)",
                  background: active ? "rgba(200,168,75,0.12)" : "transparent",
                  fontWeight: active ? 600 : 400,
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}

      <div style={{ margin: "16px 8px 0", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
        <Link
          href="/financeiro"
          style={{ display: "block", padding: "8px 16px", fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}
        >
          ← Financeiro
        </Link>
      </div>
    </aside>
  );
}

export default function DocumentosLayout({ children }: { children: ReactNode }) {
  return (
    <div style={rootStyle}>
      <Suspense fallback={<aside style={sidebarStyle} />}>
        <Sidebar />
      </Suspense>
      <main style={mainStyle}>{children}</main>
    </div>
  );
}

const rootStyle = {
  display: "flex",
  minHeight: "100vh",
  gap: 0,
} as const;

const sidebarStyle = {
  width: 220,
  flexShrink: 0,
  borderRight: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(0,0,0,0.15)",
  paddingBottom: 40,
} as const;

const mainStyle = {
  flex: 1,
  minWidth: 0,
  padding: "32px 28px 80px",
} as const;
