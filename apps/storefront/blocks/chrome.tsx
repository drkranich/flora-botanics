import Link from "next/link";

export function Logo() {
  return (
    <a href="/" className="logo">
      <span className="logo-main">
        FL<span className="logo-symbol"></span>RA
      </span>
      <span className="logo-sub">BOTANICS</span>
    </a>
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
        <a href="#newsletter" className="btn">
          Avise-me
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer-layout">
        <Logo />
        <div>
          <h4>Produtos</h4>
          <ul>
            <li>Sérums</li>
            <li>Hidratantes</li>
            <li>Limpadores</li>
            <li>Óleos Botânicos</li>
          </ul>
        </div>
        <div>
          <h4>Institucional</h4>
          <ul>
            <li>Sobre Nós</li>
            <li>Ingredientes</li>
            <li>Sustentabilidade</li>
            <li>Blog</li>
          </ul>
        </div>
        <div>
          <h4>Ajuda</h4>
          <ul>
            <li>Perguntas Frequentes</li>
            <li>Trocas e Devoluções</li>
            <li>Política de Privacidade</li>
            <li>Fale Conosco</li>
          </ul>
        </div>
        <div>
          <h4>Siga-nos</h4>
          <div className="socials">
            <a href="#">◎</a>
            <a href="#">f</a>
            <a href="#">p</a>
          </div>
        </div>
      </div>
      <p className="copyright">
        © {new Date().getFullYear()} Flora Botanics. Todos os direitos reservados.
      </p>
    </footer>
  );
}
