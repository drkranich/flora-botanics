import { currentTenant, db } from "@/lib/tenant";
import { getMenu } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { AuthPanel } from "./AuthPanel";

export const revalidate = 60;

export default async function AccountPage() {
  const tenant = await currentTenant();
  const menu = await getMenu(db(), tenant.tenantId, "header");

  return (
    <>
      <div className="page-hero">
        <SiteHeader menu={menu} />
        <div className="container">
          <span className="breadcrumb">Início / Minha conta</span>
          <h1>Minha conta</h1>
          <p>
            Entre ou crie sua conta para acompanhar pedidos, endereços e
            benefícios exclusivos.
          </p>
        </div>
      </div>

      <section className="container" style={{ padding: "60px 0 80px", display: "flex", justifyContent: "center" }}>
        <AuthPanel />
      </section>

      <SiteFooter />
    </>
  );
}
