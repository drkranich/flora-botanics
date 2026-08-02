import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/supabase/server";
import { getPdfConfig } from "@/lib/pdf/actions";
import { PdfStylesEditor } from "./PdfStylesEditor";

export default async function PdfStylesPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.role === "tenant_editor") redirect("/");

  const pdfConfig = await getPdfConfig();

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 28px 80px" }}>
      <header className="rise" style={{ marginBottom: 32 }}>
        <Link href="/config" className="eyebrow" style={{ opacity: 0.8 }}>
          ← Configurações
        </Link>
        <h1 className="display" style={{ fontSize: 38, marginTop: 10 }}>
          Estilos dos PDFs
        </h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Personalize cores, fontes, marca d'água e dados de rodapé de todos os
          documentos PDF gerados pelo sistema.
        </p>
      </header>

      <PdfStylesEditor initial={pdfConfig} />
    </main>
  );
}
