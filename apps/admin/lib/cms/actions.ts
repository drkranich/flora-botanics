"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

export type SectionData = {
  id: string;
  block: string;
  props: Record<string, unknown>;
};

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Não autorizado");
  return session;
}

/** Tenant efetivo: o do staff, ou (platform_admin) o primeiro ativo. */
export async function effectiveTenantId(): Promise<string> {
  const session = await requireStaff();
  if (session.tenantId) return session.tenantId;
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("Nenhum tenant ativo");
  return data.id;
}

/** Cria uma página nova (rascunho) e devolve o id para abrir o editor. */
export async function createPage(form: { title: string; type: string }) {
  const session = await requireStaff();
  const tenantId = await effectiveTenantId();
  const supabase = await supabaseServer();

  const slug = form.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("Título inválido");

  const { data: page, error } = await supabase
    .from("pages")
    .insert({
      tenant_id: tenantId,
      slug,
      title: form.title.trim(),
      type: form.type || "landing",
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message.includes("duplicate") ? "Já existe página com esse nome" : error.message);

  await supabase.from("page_versions").insert({
    tenant_id: tenantId,
    page_id: page.id,
    version: 1,
    sections: [
      { id: "s1", block: "rich_text", props: { content: `<p>Conteúdo de ${form.title}…</p>` } },
    ],
    created_by: session.userId,
  });

  revalidatePath("/cms");
  return page.id as string;
}

/** Salva um novo rascunho (nova versão) com as seções editadas. */
export async function saveDraft(pageId: string, sections: SectionData[]) {
  const session = await requireStaff();
  const supabase = await supabaseServer();

  const { data: page, error: pageErr } = await supabase
    .from("pages")
    .select("id, tenant_id")
    .eq("id", pageId)
    .maybeSingle();
  if (pageErr || !page) throw new Error("Página não encontrada");

  const { data: last } = await supabase
    .from("page_versions")
    .select("version")
    .eq("page_id", pageId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (last?.version ?? 0) + 1;

  const { data: created, error } = await supabase
    .from("page_versions")
    .insert({
      tenant_id: page.tenant_id,
      page_id: pageId,
      version: nextVersion,
      sections,
      created_by: session.userId,
    })
    .select("id, version")
    .single();
  if (error) throw new Error(`Erro ao salvar: ${error.message}`);

  revalidatePath(`/cms/${pageId}`);
  return created;
}

/** Publica uma versão (aponta published_version_id). */
export async function publishVersion(pageId: string, versionId: string) {
  await requireStaff();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("pages")
    .update({ published_version_id: versionId, status: "published" })
    .eq("id", pageId);
  if (error) throw new Error(`Erro ao publicar: ${error.message}`);

  revalidatePath(`/cms/${pageId}`);
  revalidatePath("/cms");
  return { ok: true };
}

/** Salva e publica em um passo (fluxo principal do editor). */
export async function saveAndPublish(pageId: string, sections: SectionData[]) {
  const created = await saveDraft(pageId, sections);
  await publishVersion(pageId, created.id);
  return created;
}
