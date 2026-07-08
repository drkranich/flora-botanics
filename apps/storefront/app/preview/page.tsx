import { currentTenant, db } from "@/lib/tenant";
import { getMenu, getSiteSetting } from "@flora/db";
import { LivePreview } from "./LivePreview";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  const tenant = await currentTenant();
  const client = db();

  const [menu, logoSetting] = await Promise.all([
    getMenu(client, tenant.tenantId, "header"),
    getSiteSetting<{ image: string; width?: number; height?: number; color?: string }>(
      client,
      tenant.tenantId,
      "logo"
    ),
  ]);

  return (
    <LivePreview
      menu={menu}
      logo={{
        logoUrl: logoSetting?.image ?? "",
        logoWidth: logoSetting?.width ?? 160,
        logoHeight: logoSetting?.height ?? 48,
        logoColor: logoSetting?.color ?? "",
      }}
    />
  );
}
