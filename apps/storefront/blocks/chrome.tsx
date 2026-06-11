import Link from "next/link";
import { currentTenant, db } from "@/lib/tenant";

export function Logo() {
  return (
    <Link href="/" className="logo">
      <span className="logo-main">
        FL<span className="logo-symbol"></span>RA
      </span>
      <span className="logo-sub">BOTANICS</span>
    </Link>
  );
}

export function SiteHeader({ menu }: { menu: Array<{ label: string; href: string }> }) {
  return (
    <header className="header container">
      <Logo />
      <nav className="nav">
        {menu.map((item) => (
          <Link key={item.href + item.label} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <a href="#" aria-label="Conta">
          <svg className="icon" viewBox="0 0 24 24">
            <circle cx="12" cy="7" r="4"></circle>
            <path d="M4 21a8 8 0 0 1 16 0"></path>
          </svg>
        </a>
        <a href="#" aria-label="Sacola">
          <svg className="icon" viewBox="0 0 24 24">
            <path d="M6 8h12l-1 13H7L6 8Z"></path>
            <path d="M9 8a3 3 0 0 1 6 0"></path>
          </svg>
        </a>
        <Link href="/#newsletter" className="btn">
          Avise-me
        </Link>
      </div>
    </header>
  );
}

type FooterColumn = {
  heading: string;
  links: Array<{ label: string; href: string }>;
};

type SocialItem = { label: string; image: string; href: string };

/**
 * Rodapé dinâmico — colunas vêm dos menus footer_1..3 do CMS,
 * redes sociais de site_settings.social (imagem + link, editáveis no admin).
 */
export async function SiteFooter() {
  const tenant = await currentTenant();
  const client = db();

  const [{ data: menus }, { data: socialSetting }] = await Promise.all([
    client
      .from("menus")
      .select("location, items")
      .eq("tenant_id", tenant.tenantId)
      .in("location", ["footer_1", "footer_2", "footer_3"])
      .order("location"),
    client
      .from("site_settings")
      .select("value")
      .eq("tenant_id", tenant.tenantId)
      .eq("key", "social")
      .maybeSingle(),
  ]);

  const columns: FooterColumn[] = (menus ?? [])
    .map((m) => m.items as unknown as FooterColumn)
    .filter((c) => c && Array.isArray(c.links));

  const socials: SocialItem[] =
    ((socialSetting?.value as { items?: SocialItem[] } | null)?.items ?? []).filter(
      (s) => s.href && s.href !== "#"
    );

  return (
    <footer className="footer">
      <div className="container footer-layout">
        <Logo />

        {columns.map((col) => (
          <div key={col.heading}>
            <h4>{col.heading}</h4>
            <ul>
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="footer-link">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4>Siga-nos</h4>
          <div className="socials">
            {(socials.length > 0 ? socials : [{ label: "Instagram", image: "", href: "#" }]).map(
              (s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.label}
                  aria-label={s.label}
                >
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.image}
                      alt={s.label}
                      style={{ width: 14, height: 14, objectFit: "contain" }}
                    />
                  ) : (
                    s.label.charAt(0)
                  )}
                </a>
              )
            )}
          </div>
        </div>
      </div>
      <p className="copyright">
        © {new Date().getFullYear()} {tenant.name}. Todos os direitos reservados.
      </p>
    </footer>
  );
}
