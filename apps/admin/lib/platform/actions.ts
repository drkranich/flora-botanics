"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getStaffSession, supabaseServer } from "@/lib/supabase/server";

/** Ações exclusivas do platform_admin (superadmin da plataforma). */

async function requirePlatformAdmin() {
  const session = await getStaffSession();
  if (!session || session.role !== "platform_admin") {
    throw new Error("Apenas o admin da plataforma");
  }
  return session;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Define qual tenant o superadmin está operando (cookie de contexto). */
export async function setActiveTenant(tenantId: string) {
  await requirePlatformAdmin();
  const jar = await cookies();
  jar.set("fl_tenant", tenantId, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/");
}

/** Cria um tenant novo, completo: tema, domínio interno, home publicada e menu. */
export async function createTenant(form: { name: string; slug?: string }) {
  await requirePlatformAdmin();
  const supabase = await supabaseServer();

  const slug = form.slug?.trim() || slugify(form.name);
  if (!slug) throw new Error("Nome inválido");

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({ name: form.name.trim(), slug, plan: "internal" })
    .select("id")
    .single();
  if (error) {
    throw new Error(error.message.includes("duplicate") ? "Já existe uma marca com esse slug" : error.message);
  }

  await supabase.from("tenant_themes").insert({
    tenant_id: tenant.id,
    tokens: {
      colors: {
        "forest-900": "#0f2012", "forest-800": "#172b17", "forest-700": "#21351d",
        cream: "#f2ecdf", "cream-dark": "#e6ddcb",
        gold: "#b9924d", "gold-dark": "#96763f",
        ink: "#28251d", muted: "#5e584b", white: "#fff8ea",
      },
      fonts: { display: "Cormorant Garamond", body: "Montserrat" },
    },
  });

  await supabase.from("tenant_domains").insert({
    tenant_id: tenant.id,
    domain: `${slug}.floraecosystem.app`,
    is_primary: true,
  });

  const { data: page } = await supabase
    .from("pages")
    .insert({ tenant_id: tenant.id, slug: "home", title: `${form.name} — Início`, type: "home", status: "draft" })
    .select("id")
    .single();

  if (page) {
    const { data: version } = await supabase
      .from("page_versions")
      .insert({
        tenant_id: tenant.id,
        page_id: page.id,
        version: 1,
        sections: [
          {
            id: "s1",
            block: "hero",
            props: {
              title: `Bem-vinda à ${form.name}.`,
              subtitle: "Edite esta página no CMS para começar.",
              image: "",
              cta: { label: "Saiba mais", href: "#" },
            },
          },
        ],
      })
      .select("id")
      .single();
    if (version) {
      await supabase.from("pages").update({ published_version_id: version.id, status: "published" }).eq("id", page.id);
    }
  }

  await supabase.from("menus").insert({
    tenant_id: tenant.id,
    location: "header",
    items: [{ label: "Início", href: "/" }],
  });

  await supabase.from("channel_accounts").insert({
    tenant_id: tenant.id,
    channel: "site",
    status: "connected",
    display_name: "Site próprio",
  });

  revalidatePath("/plataforma");
  return tenant.id as string;
}

/** Edita nome, slug e status (ativa/suspensa) de uma marca. */
export async function updateTenant(
  tenantId: string,
  form: { name: string; slug: string; status: "active" | "suspended" }
) {
  await requirePlatformAdmin();
  const supabase = await supabaseServer();

  const name = form.name.trim();
  const slug = slugify(form.slug || form.name);
  if (!name || !slug) throw new Error("Nome e slug são obrigatórios");

  const { error } = await supabase
    .from("tenants")
    .update({ name, slug, status: form.status })
    .eq("id", tenantId);
  if (error) {
    throw new Error(error.message.includes("duplicate") ? "Já existe uma marca com esse slug" : error.message);
  }

  // mantém o domínio interno (*.floraecosystem.app) alinhado ao slug
  await supabase
    .from("tenant_domains")
    .update({ domain: `${slug}.floraecosystem.app` })
    .eq("tenant_id", tenantId)
    .like("domain", "%.floraecosystem.app");

  revalidatePath("/plataforma");
}

/**
 * Exclui uma marca e TODOS os seus dados (irreversível).
 * A marca principal (flora-botanics) é protegida.
 */
export async function deleteTenant(tenantId: string) {
  await requirePlatformAdmin();
  const supabase = await supabaseServer();

  const { data: t } = await supabase.from("tenants").select("slug").eq("id", tenantId).single();
  if (!t) throw new Error("Marca não encontrada");
  if (t.slug === "flora-botanics") throw new Error("A marca principal não pode ser excluída");

  // desfaz o vínculo circular pages ↔ page_versions antes de apagar
  await supabase.from("pages").update({ published_version_id: null }).eq("tenant_id", tenantId);

  // filhos antes dos pais (ordem de dependência)
  const tables = [
    "messages", "conversations", "stock_movements", "shipments", "payments",
    "order_items", "orders", "subscriptions", "coupons", "leads", "customers",
    "jobs", "channel_accounts", "inventory", "product_variants", "products",
    "collections", "media", "page_versions", "pages", "menus", "site_settings",
    "tenant_themes", "tenant_domains", "audit_logs",
  ];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("tenant_id", tenantId);
    if (error && !error.message.includes("does not exist")) {
      throw new Error(`Falha ao limpar ${table}: ${error.message}`);
    }
  }

  // desvincula perfis de equipe que apontavam para a marca
  await supabase.from("profiles").update({ tenant_id: null }).eq("tenant_id", tenantId);

  const { error } = await supabase.from("tenants").delete().eq("id", tenantId);
  if (error) throw new Error(error.message);

  // se o superadmin estava operando a marca excluída, limpa o contexto
  const jar = await cookies();
  if (jar.get("fl_tenant")?.value === tenantId) jar.delete("fl_tenant");

  revalidatePath("/plataforma");
  revalidatePath("/");
}
