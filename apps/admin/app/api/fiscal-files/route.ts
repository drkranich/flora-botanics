import { NextRequest, NextResponse } from "next/server";
import { currentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "fiscal-documents";
const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "xml",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "csv",
  "xls",
  "xlsx",
  "doc",
  "docx",
  "txt",
]);

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "type" in value &&
    "size" in value &&
    "arrayBuffer" in value &&
    typeof (value as File).arrayBuffer === "function"
  );
}

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase().trim() ?? "";
}

function cleanSegment(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function sanitizeKind(value: FormDataEntryValue | null) {
  const kind = cleanSegment(String(value ?? "documentos"));
  return kind || "documentos";
}

export async function POST(req: NextRequest) {
  try {
    const staff = await currentStaff();
    if (!staff) return jsonError("Não autorizado", 401);

    const formData = await req.formData();
    const file = formData.get("file");
    const kind = sanitizeKind(formData.get("kind"));

    if (!isUploadFile(file)) return jsonError("Arquivo obrigatório.", 400);
    if (file.size > MAX_BYTES) return jsonError("Arquivo acima do limite de 20 MB.", 413);

    const ext = extension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return jsonError("Formato não permitido. Envie PDF, XML, imagem, planilha, documento ou TXT.", 400);
    }

    const admin = await createAdminClient();
    if (!admin) {
      return jsonError(
        "Upload indisponível: configure SUPABASE_SERVICE_ROLE_KEY nos secrets do Worker flora-admin.",
        500
      );
    }

    const safeName = cleanSegment(file.name) || `arquivo.${ext}`;
    const path = `${staff.tenantId}/${kind}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const bytes = await file.arrayBuffer();

    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      cacheControl: "31536000",
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (error) return jsonError(error.message, 400);

    return NextResponse.json({
      file: {
        path,
        name: file.name,
        size: file.size,
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha no upload.");
  }
}

export async function GET(req: NextRequest) {
  try {
    const staff = await currentStaff();
    if (!staff) return jsonError("Não autorizado", 401);

    const path = req.nextUrl.searchParams.get("path")?.trim();
    if (!path) return jsonError("Arquivo não informado.", 400);
    if (!path.startsWith(`${staff.tenantId}/`) && staff.role !== "platform_admin") {
      return jsonError("Arquivo fora do tenant atual.", 403);
    }

    const admin = await createAdminClient();
    if (!admin) {
      return jsonError(
        "Download indisponível: configure SUPABASE_SERVICE_ROLE_KEY nos secrets do Worker flora-admin.",
        500
      );
    }

    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return jsonError(error?.message ?? "Arquivo não encontrado.", 404);

    return NextResponse.redirect(data.signedUrl);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Falha ao abrir arquivo.");
  }
}
