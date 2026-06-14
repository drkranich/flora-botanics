import Link from "next/link";

/**
 * Indica qual "site" (tenant/marca) os dados desta página pertencem.
 * Para platform_admin, oferece um link rápido para trocar de marca
 * no painel Plataforma (cookie fl_tenant).
 */
export function SiteChip({
  name,
  isPlatformAdmin,
}: {
  name?: string | null;
  isPlatformAdmin?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span className="chip chip-draft">Site: {name ?? "—"}</span>
      {isPlatformAdmin ? (
        <Link href="/plataforma" className="muted" style={{ fontSize: 11, textDecoration: "underline" }}>
          trocar marca
        </Link>
      ) : null}
    </div>
  );
}
