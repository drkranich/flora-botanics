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
