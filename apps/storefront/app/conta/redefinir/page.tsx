import { currentTenant, db } from "@/lib/tenant";
import { getMenu } from "@flora/db";
import { SiteHeader, SiteFooter } from "@/blocks/chrome";
import { ResetPanel } from "./ResetPanel";

export const revalidate = 60;

export default async function ResetPasswordPage() {
  const tenant = await currentTenant();
  const menu = await getMenu(db(), tenant.tenantId, "header");

  return (
    <>
      <div className="page-hero">
        <SiteHeader menu={menu} />
        <div className="container">
          <span className="breadcrumb">Início / Minha conta / Nova senha</span>
          <h1>Nova senha</h1>
          <p>Defina uma nova senha para a sua conta.</p>
        </div>
      </div>

      <section className="container" style={{ padding: "60px 0 80px", display: "flex", justifyContent: "center" }}>
        <ResetPanel />
      </section>

      <SiteFooter />
    </>
  );
}
