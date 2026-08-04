import { redirect } from "next/navigation";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";
import { effectiveTenantId } from "@/lib/cms/actions";
import { FiscalFileManager } from "./FiscalFileManager";

export const dynamic = "force-dynamic";

export type FiscalFolder = {
  id: string;
  name: string;
  category: string;
  parent_id: string | null;
  created_at: string;
};

export type FiscalFile = {
  id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  category: string;
  storage_path: string;
  size_bytes: number;
  competence: string | null;
  created_at: string;
};

export default async function DocumentosFiscaisPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const [{ data: folders }, { data: files }] = await Promise.all([
    supabase
      .from("fiscal_folders")
      .select("id, name, category, parent_id, created_at")
      .eq("tenant_id", tenantId)
      .order("name"),
    supabase
      .from("fiscal_files")
      .select("id, folder_id, name, description, category, storage_path, size_bytes, competence, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <FiscalFileManager
      folders={(folders ?? []) as FiscalFolder[]}
      files={(files ?? []) as FiscalFile[]}
    />
  );
}
