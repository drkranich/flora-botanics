import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { ReceivedDocsManager } from "./ReceivedDocsManager";

export const dynamic = "force-dynamic";

export type ReceivedDoc = {
  id: string;
  name: string;
  doc_type: string;
  department: string;
  competence: string | null;
  due_date: string | null;
  paid_at: string | null;
  amount_cents: number | null;
  fine_cents: number | null;
  status: "pending" | "open" | "scheduled" | "paid" | "overdue";
  issuer: string | null;
  barcode: string | null;
  storage_path: string | null;
  size_bytes: number;
  viewed_at: string | null;
  created_at: string;
};

export default async function DocumentosRecebidosPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const { data: docs } = await supabase
    .from("fiscal_received_docs")
    .select(
      "id, name, doc_type, department, competence, due_date, paid_at, amount_cents, fine_cents, status, issuer, barcode, storage_path, size_bytes, viewed_at, created_at"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return <ReceivedDocsManager docs={(docs ?? []) as ReceivedDoc[]} />;
}
