import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InboxSettingsClient } from "./InboxSettingsClient";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface SlaPolicy {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  first_response_minutes: Record<string, number>;
  next_response_minutes: Record<string, number>;
  resolution_minutes: Record<string, number>;
  business_hours_only: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  escalate_at_percent: number;
  applies_to_channels: string[] | null;
}

// ── Server Component ──────────────────────────────────────────────────────────

export default async function InboxSettingsPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const supabase = await createClient();

  const { data: slaPolicies } = await supabase
    .from("helpdesk_sla_policies")
    .select("id, name, description, active, first_response_minutes, next_response_minutes, resolution_minutes, business_hours_only, business_hours_start, business_hours_end, business_days, escalate_at_percent, applies_to_channels")
    .eq("tenant_id", staff.tenantId)
    .order("created_at", { ascending: true });

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #080f09 0%, #0c1a0e 50%, #091208 100%)",
      color: "var(--cream)",
      fontFamily: "Manrope, sans-serif",
    }}>
      {/* Topbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,22,11,0.85)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderBottom: "1px solid rgba(242,236,223,0.07)",
        padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Link href="/inbox" style={{
          fontSize: 11.5, color: "var(--cream-dim)", textDecoration: "none", fontWeight: 500,
        }}>
          ← Voltar ao inbox
        </Link>
        <span style={{ color: "rgba(242,236,223,0.2)" }}>|</span>
        <span style={{
          fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600,
          color: "var(--cream)", letterSpacing: -0.4,
        }}>
          Configurações de Atendimento
        </span>
      </div>

      <div style={{ padding: "28px 32px 48px", maxWidth: 900, margin: "0 auto" }}>
        <InboxSettingsClient
          slaPolicies={(slaPolicies ?? []) as SlaPolicy[]}
          tenantId={staff.tenantId}
        />
      </div>
    </div>
  );
}
