import { redirect } from "next/navigation";

const ADMIN_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://flora-admin.gmoraes.workers.dev";

export default async function AdminBridgePage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ path = [] }, query] = await Promise.all([params, searchParams]);
  const targetPath = path.length > 0 ? `/${path.join("/")}` : "/login";
  const url = new URL(targetPath, ADMIN_BASE_URL);

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
    } else if (value) {
      url.searchParams.set(key, value);
    }
  }

  redirect(url.toString());
}
