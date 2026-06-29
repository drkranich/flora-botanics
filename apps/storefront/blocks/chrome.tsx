import Link from "next/link";
import Image from "next/image";

export interface LogoProps {
  logoUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  /** Cor hex (ex: "#ffffff") ou "" para usar a cor original da imagem. */
  logoColor?: string;
}

export function Logo({ logoUrl, logoWidth = 160, logoHeight = 48, logoColor }: LogoProps) {
  return (
    <Link href="/" className="logo">
      {logoUrl ? (
        logoColor ? (
          <span
            style={{
              display: "inline-block",
              flexShrink: 0,
              width: logoWidth,
              height: logoHeight,
              WebkitMask: `url(${logoUrl}) no-repeat center / contain`,
              mask: `url(${logoUrl}) no-repeat center / contain`,
              backgroundColor: logoColor,
            }}
          />
        ) : (
          <Image
            src={logoUrl}
            alt="Logo"
            width={logoWidth}
            height={logoHeight}
            style={{ objectFit: "contain", maxHeight: logoHeight }}
            priority
          />
        )
      ) : (
        <>
          <span className="logo-main">
            FL<span className="logo-symbol"></span>RA
          </span>
          <span className="logo-sub">BOTANICS</span>
        </>
      )}
    </Link>
  );
}

export function SiteHeader({
  menu,
  logoUrl,
  logoWidth,
  logoHeight,
  logoColor,
}: { menu: Array<{ label: string; href: string }> } & LogoProps) {
  return (
    <header className="header container">
      <Logo logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
      <nav className="nav">
        {menu.map((item) => (
          <Link key={item.href + item.label} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link href="/conta" aria-label="Conta">
          <svg className="icon" viewBox="0 0 24 24">
            <circle cx="12" cy="7" r="4"></circle>
            <path d="M4 21a8 8 0 0 1 16 0"></path>
          </svg>
        </Link>
        <Link href="/carrinho" aria-label="Sacola">
          <svg className="icon" viewBox="0 0 24 24">
            <path d="M6 8h12l-1 13H7L6 8Z"></path>
            <path d="M9 8a3 3 0 0 1 6 0"></path>
          </svg>
        </Link>
        <Link href="/#newsletter" className="btn">
          Avise-me
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter({ logoUrl, logoWidth, logoHeight, logoColor }: LogoProps) {
  const productLinks = [
    { label: "Sérums", href: "/categorias/seruns" },
    { label: "Hidratantes", href: "/categorias/hidratantes" },
    { label: "Limpadores", href: "/categorias/limpadores" },
    { label: "Óleos Botânicos", href: "/categorias/oleos-botanicos" },
  ];
  const institutionalLinks = [
    { label: "Sobre Nós", href: "/p/sobre-nos" },
    { label: "Ingredientes", href: "/p/ingredientes" },
    { label: "Sustentabilidade", href: "/p/sustentabilidade" },
    { label: "Blog", href: "/p/blog" },
  ];
  const helpLinks = [
    { label: "Perguntas Frequentes", href: "/p/perguntas-frequentes" },
    { label: "Trocas e Devoluções", href: "/p/trocas-e-devolucoes" },
    { label: "Política de Privacidade", href: "/p/politica-de-privacidade" },
    { label: "Fale Conosco", href: "/p/fale-conosco" },
  ];

  return (
    <footer className="footer">
      <div className="container footer-layout">
        <Logo logoUrl={logoUrl} logoWidth={logoWidth} logoHeight={logoHeight} logoColor={logoColor} />
        <div>
          <h4>Produtos</h4>
          <ul>
            {productLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Institucional</h4>
          <ul>
            {institutionalLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Ajuda</h4>
          <ul>
            {helpLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Siga-nos</h4>
          <div className="socials">
            <Link href="/p/instagram" aria-label="Instagram">◎</Link>
            <Link href="/p/facebook" aria-label="Facebook">f</Link>
            <Link href="/p/pinterest" aria-label="Pinterest">p</Link>
          </div>
        </div>
      </div>
      <p className="copyright">
        © {new Date().getFullYear()} Flora Botanics. Todos os direitos reservados.
      </p>
    </footer>
  );
}
