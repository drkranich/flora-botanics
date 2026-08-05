import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { FISCAL_SECTIONS } from "../FiscalCenterPage";
import { EcacClient } from "./EcacClient";

export default async function EcacPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const supabase   = await createClient();
  const tenantId   = staff.tenantId;

  // Configuração e-CAC salva
  const { data: ecacSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "integration_ecac")
    .maybeSingle();

  const ecacConfig = (ecacSetting?.value ?? null) as {
    consumer_key:     string;
    consumer_secret:  string;
    cnpj_contratante: string;
    ativo:            boolean;
  } | null;

  // CNPJ do emitente (vem da config SEFAZ)
  const { data: sefazSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "integration_sefaz")
    .maybeSingle();

  const cnpjEmitente = ((sefazSetting?.value as Record<string,string>)?.cnpj ?? "").replace(/\D/g, "");

  // Cache de consultas anteriores
  const { data: cacheRows } = await supabase
    .from("ecac_cache")
    .select("tipo, dados, consultado_at")
    .eq("tenant_id", tenantId)
    .order("consultado_at", { ascending: false });

  const cache = (cacheRows ?? []) as { tipo: string; dados: Record<string,unknown>; consultado_at: string }[];

  // ─── Layout ───────────────────────────────────────────────────────────────

  const navStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: 4,
    position: "sticky", top: 80, maxHeight: "calc(100vh - 100px)", overflowY: "auto",
  };

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "200px 1fr",
      gap: 0, padding: "32px 28px 80px 0",
    }}>

      {/* ── Sidebar nav ── */}
      <nav style={navStyle}>
        {/* Voltar */}
        <Link
          href="/backoffice/notas-fiscais"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 12px", borderRadius: 8, fontSize: 12,
            color: "rgba(245,236,220,0.45)", textDecoration: "none",
            marginBottom: 8, border: "1px solid transparent",
          }}
        >
          ← Fiscal e Tributário
        </Link>
        <p className="eyebrow" style={{ fontSize: 10, opacity: 0.4, marginBottom: 4, paddingLeft: 12 }}>FISCAL</p>
        {FISCAL_SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={`/backoffice/notas-fiscais${s.href.replace("/backoffice/notas-fiscais", "")}`}
            style={{
              padding: "7px 12px", borderRadius: 8, fontSize: 13,
              background: s.id === "ecac" ? "rgba(201,169,110,0.15)" : "transparent",
              color: s.id === "ecac" ? "var(--gold-light)" : "var(--cream)",
              border: s.id === "ecac" ? "1px solid rgba(201,169,110,0.25)" : "1px solid transparent",
              textDecoration: "none",
            }}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {/* ── Conteúdo ── */}
      <main>
        <header style={{ marginBottom: 28 }}>
          <p className="eyebrow" style={{ opacity: 0.55, letterSpacing: "2px", marginBottom: 6 }}>
            RECEITA FEDERAL
          </p>
          <h1 className="display" style={{ fontSize: 34, color: "var(--cream)", margin: 0 }}>
            e-CAC / SERPRO
          </h1>
          <p style={{ fontSize: 13, color: "rgba(245,236,220,0.55)", marginTop: 6 }}>
            Integração automática com o e-CAC via API oficial SERPRO Integra Contador.
            {cnpjEmitente && (
              <> · CNPJ emitente: <strong style={{ color: "var(--gold-light)" }}>
                {cnpjEmitente.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
              </strong></>
            )}
          </p>
        </header>

        <EcacClient
          config={ecacConfig}
          cnpjEmitente={cnpjEmitente}
          cache={cache}
        />
      </main>
    </div>
  );
}
