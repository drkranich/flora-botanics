import { notFound } from "next/navigation";
import { isMarketingModuleId, MarketingCenterPage } from "../MarketingCenterPage";

export default async function MarketingModulePage({
  params,
}: {
  params: Promise<{ modulo: string }>;
}) {
  const { modulo } = await params;
  if (!isMarketingModuleId(modulo) || modulo === "visao-geral") notFound();
  return <MarketingCenterPage activeModule={modulo} />;
}
