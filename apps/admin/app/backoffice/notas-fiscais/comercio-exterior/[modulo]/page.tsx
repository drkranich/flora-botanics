import { notFound } from "next/navigation";
import { FiscalCenterPage } from "../../FiscalCenterPage";
import { isInternationalTradeModuleId, type InternationalTradeModuleId } from "../../InternationalTradeCenter";

export default async function ComercioExteriorModuloPage({
  params,
}: {
  params: Promise<{ modulo: string }>;
}) {
  const { modulo } = await params;
  if (!isInternationalTradeModuleId(modulo)) notFound();

  return FiscalCenterPage({
    activeSection: "comercio-exterior",
    activeInternationalModule: modulo as InternationalTradeModuleId,
  });
}
