"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStorefrontUrl } from "@/lib/storefront-url";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ThemeController } from "@/components/ThemeController";
import { ThemePicker } from "@/components/ThemePicker";

type NavItem = { href: string; label: string; icon: string; match: (p: string) => boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Início", icon: "◉", match: (p) => p === "/" },
  { href: "/cms", label: "Site", icon: "✺", match: (p) => p.startsWith("/cms") },
  { href: "/catalogo", label: "Catálogo", icon: "❖", match: (p) => p.startsWith("/catalogo") },
  { href: "/vendas", label: "Vendas", icon: "◈", match: (p) => p.startsWith("/vendas") },
  { href: "/contabilidade", label: "Contabilidade", icon: "$", match: (p) => p.startsWith("/contabilidade") },
  { href: "/financeiro", label: "Financeiro", icon: "%", match: (p) => p.startsWith("/financeiro") },
  { href: "/marketing", label: "Marketing", icon: "◌", match: (p) => p.startsWith("/marketing") },
  { href: "/inbox", label: "Inbox", icon: "✉", match: (p) => p.startsWith("/inbox") },
  { href: "/canais", label: "Canais", icon: "⌬", match: (p) => p.startsWith("/canais") },
  { href: "/operacoes", label: "Operações", icon: "▤", match: (p) => p.startsWith("/operacoes") },
  { href: "/config", label: "Configurações", icon: "✦", match: (p) => p.startsWith("/config") },
  { href: "/dicionario", label: "Dicionário", icon: "ABC", match: (p) => p.startsWith("/dicionario") },
  { href: "/backoffice", label: "Backoffice", icon: "▣", match: (p) => p.startsWith("/backoffice") },
  { href: "/pdv", label: "PDV", icon: "🛒", match: (p) => p.startsWith("/pdv") },
  { href: "/documentos", label: "Documentos", icon: "📄", match: (p) => p.startsWith("/documentos") },
];

/** Visível apenas para o superadmin (platform_admin). */
const NAV_PLATFORM: NavItem = {
  href: "/plataforma",
  label: "Plataforma",
  icon: "♛",
  match: (p) => p.startsWith("/plataforma"),
};

const COMMANDS = [
  { label: "Ir para Início", href: "/" },
  { label: "Ir para Site — Páginas", href: "/cms" },
  { label: "Ir para Catálogo — Produtos", href: "/catalogo" },
  { label: "Ir para Catálogo — Categorias", href: "/catalogo/categorias" },
  { label: "Ir para Vendas — Pedidos", href: "/vendas" },
  { label: "Ir para Vendas — Clientes", href: "/vendas/clientes" },
  { label: "Ir para Vendas — Cupons", href: "/vendas/cupons" },
  { label: "Ir para Vendas — Carrinhos abandonados", href: "/vendas/carrinhos" },
  { label: "Ir para Contabilidade", href: "/contabilidade" },
  { label: "Ir para Financeiro, Precificação e Orçamentos", href: "/financeiro" },
  { label: "Ir para Marketing e Relacionamento", href: "/marketing" },
  { label: "Ir para Marketing — Campanhas", href: "/marketing/campanhas" },
  { label: "Ir para Marketing — Templates", href: "/marketing/templates" },
  { label: "Ir para Marketing — Segmentos", href: "/marketing/segmentos" },
  { label: "Ir para Marketing — Jornadas", href: "/marketing/jornadas" },
  { label: "Ir para Marketing — Consentimentos", href: "/marketing/consentimentos" },
  { label: "Ir para Inbox", href: "/inbox" },
  { label: "Ir para Canais de venda", href: "/canais" },
  { label: "Ir para Operações — Estoque", href: "/operacoes" },
  { label: "Ir para Configurações", href: "/config" },
  { label: "Ir para Dicionário de siglas", href: "/dicionario" },
  { label: "Ir para Backoffice", href: "/backoffice" },
  { label: "Ir para Backoffice — Clientes (CRM)", href: "/backoffice/clientes" },
  { label: "Ir para Backoffice — Pedidos", href: "/backoffice/pedidos" },
  { label: "Ir para Backoffice — Logística", href: "/backoffice/logistica" },
  { label: "Ir para Backoffice — Fiscal e Tributário", href: "/backoffice/notas-fiscais" },
  { label: "Ir para Backoffice — Marketplaces", href: "/backoffice/marketplaces" },
  { label: "Ir para Backoffice — Mensagens", href: "/backoffice/mensagens" },
  { label: "Ir para Backoffice — Logs", href: "/backoffice/logs" },
  { label: "Ir para Backoffice — Config fiscal", href: "/backoffice/config" },
  { label: "Ir para PDV — Ponto de Venda", href: "/pdv" },
  { label: "Ir para Plataforma (superadmin)", href: "/plataforma" },
  { label: "Ver site ao vivo (nova aba)", href: "__site__" },
  { label: "Sair da conta", href: "__logout__" },
];

/** Módulos visíveis para o papel Editor (tenant_editor). */
const EDITOR_HREFS = ["/", "/cms", "/catalogo", "/dicionario", "/backoffice"];

export function Shell({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: string;
}) {
  const path = usePathname();
  const isLogin = path.startsWith("/login");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const isPlatformAdmin = role === "platform_admin";
  const isEditor = role === "tenant_editor";
  const navItems = isEditor
    ? NAV.filter((n) => EDITOR_HREFS.includes(n.href))
    : isPlatformAdmin
      ? [...NAV, NAV_PLATFORM]
      : NAV;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isPDV = path.startsWith("/pdv");
  if (isLogin || isPDV) return <ThemeController>{children}</ThemeController>;

  return (
    <ThemeController>
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside className="shell-sidebar glass">
        <Link href="/" className="side-logo" title="Flora Ecosystem">
          <span style={{ fontWeight: 800, letterSpacing: -1.5, fontSize: 21 }}>
            FL<span style={{ color: "var(--gold-light)" }}>•</span>RA
          </span>
          <span className="side-logo-sub">ECOSYSTEM</span>
        </Link>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {navItems.map((item) => {
            const active = item.match(path);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`side-item ${active ? "side-item-active" : ""}`}
              >
                <span className="side-icon">{item.icon}</span>
                <span className="side-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/perfil"
          className={`side-item ${path.startsWith("/perfil") ? "side-item-active" : ""}`}
        >
          <span className="side-icon">◐</span>
          <span className="side-label">Meu perfil</span>
        </Link>

        <button className="side-item" onClick={() => setPaletteOpen(true)} title="Busca rápida">
          <span className="side-icon">⌘</span>
          <span className="side-label">
            Buscar <kbd className="side-kbd">Ctrl K</kbd>
          </span>
        </button>

        <ThemePicker />

        <LogoutItem />
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>

      {paletteOpen ? (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          isPlatformAdmin={isPlatformAdmin}
          isEditor={isEditor}
        />
      ) : null}
    </div>
    </ThemeController>
  );
}

function LogoutItem() {
  return (
    <button
      className="side-item"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        // window.location evita bug basePath do opennextjs-cloudflare
        window.location.href = "/admin/login";
      }}
    >
      <span className="side-icon">↩</span>
      <span className="side-label">Sair</span>
    </button>
  );
}

function CommandPalette({
  onClose,
  isPlatformAdmin,
  isEditor,
}: {
  onClose: () => void;
  isPlatformAdmin: boolean;
  isEditor: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    let base = isPlatformAdmin
      ? COMMANDS
      : COMMANDS.filter((c) => c.href !== "/plataforma");
    if (isEditor) {
      base = base.filter(
        (c) =>
          c.href.startsWith("__") ||
          EDITOR_HREFS.some((h) => (h === "/" ? c.href === "/" : c.href.startsWith(h)))
      );
    }
    const q = query.trim().toLowerCase();
    return q ? base.filter((c) => c.label.toLowerCase().includes(q)) : base;
  }, [query, isPlatformAdmin, isEditor]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  async function execute(href: string) {
    onClose();
    if (href === "__logout__") {
      await supabaseBrowser().auth.signOut();
      // window.location evita bug basePath do opennextjs-cloudflare
      window.location.href = "/admin/login";
      return;
    }
    if (href === "__site__") {
      window.open(getStorefrontUrl(), "_blank");
      return;
    }
    router.push(href);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5, 12, 6, 0.6)",
        backdropFilter: "blur(8px)",
        zIndex: 200,
        display: "flex",
        justifyContent: "center",
        paddingTop: "16vh",
      }}
    >
      <div
        className="glass rise"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, calc(100vw - 40px))",
          height: "fit-content",
          maxHeight: "55vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "rgba(15, 32, 18, 0.92)",
        }}
      >
        <input
          ref={inputRef}
          className="input"
          placeholder="O que você quer fazer?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter" && results[cursor]) {
              execute(results[cursor].href);
            }
          }}
          style={{
            border: 0,
            borderBottom: "1px solid var(--glass-border)",
            borderRadius: 0,
            background: "transparent",
            padding: "18px 22px",
            fontSize: 15,
          }}
        />
        <div style={{ overflowY: "auto", padding: 8 }}>
          {results.map((c, i) => (
            <button
              key={c.label}
              onClick={() => execute(c.href)}
              onMouseEnter={() => setCursor(i)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "12px 16px",
                borderRadius: 10,
                border: 0,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
                color: i === cursor ? "var(--forest-950)" : "var(--cream-soft)",
                background:
                  i === cursor
                    ? "linear-gradient(135deg, var(--gold-light), var(--gold))"
                    : "transparent",
                transition: "background 0.15s",
              }}
            >
              {c.label}
            </button>
          ))}
          {results.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, padding: 16 }}>Nada encontrado.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
