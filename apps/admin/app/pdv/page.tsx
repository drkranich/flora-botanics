import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/supabase/server";
import { getPDVProducts } from "./pdv-actions";
import { PDVClient } from "./PDVClient";

export const metadata = { title: "Flora · PDV" };

export default async function PDVPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  // Editor não tem acesso ao PDV
  if (session.role === "tenant_editor") redirect("/");

  const products = await getPDVProducts();

  return (
    <PDVClient
      products={products}
      staffName={session.email ?? "Atendente"}
    />
  );
}
