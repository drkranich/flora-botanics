import { FiscalCenterPage } from "../FiscalCenterPage";

export default async function CofreFiscalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return FiscalCenterPage({ activeSection: "cofre", searchParams: await searchParams });
}
