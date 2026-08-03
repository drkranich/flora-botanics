import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentStaff } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InboxSettingsClient } from "./InboxSettingsClient";

// ── Tipos exportados ──────────────────────────────────────────────────────────

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

export interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  members: TeamMember[];
}

export interface TeamMember {
  profile_id: string;
  full_name: string | null;
  email: string | null;
  role: "agent" | "lead";
}

export interface BusinessHour {
  day_of_week: number;
  open: boolean;
  start_time: string;
  end_time: string;
  timezone: string;
}

export interface EmailSignature {
  id: string;
  name: string;
  body: string;
  is_default: boolean;
  profile_id: string | null;
}

export interface StaffProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface EmailChannel {
  id: string;
  name: string;
  identifier: string;        // e-mail de recebimento
  status: string;            // 'connected' | 'disconnected' | 'error'
  auto_reply_enabled: boolean;
  auto_reply_message: string | null;
  active: boolean;
}

// ── Server Component ──────────────────────────────────────────────────────────

export default async function InboxSettingsPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const supabase = await createClient();
  // Canais precisam de service_role (RLS restrita a tenant_admin)
  const admin    = await createAdminClient();

  const [
    { data: slaPolicies },
    { data: teamsRaw },
    { data: membersRaw },
    { data: businessHours },
    { data: signatures },
    { data: profiles },
    channelsResult,
  ] = await Promise.all([
    supabase
      .from("helpdesk_sla_policies")
      .select("id, name, description, active, first_response_minutes, next_response_minutes, resolution_minutes, business_hours_only, business_hours_start, business_hours_end, business_days, escalate_at_percent, applies_to_channels")
      .eq("tenant_id", staff.tenantId)
      .order("created_at", { ascending: true }),

    supabase
      .from("helpdesk_teams")
      .select("id, name, description, color, active")
      .eq("tenant_id", staff.tenantId)
      .eq("active", true)
      .order("created_at", { ascending: true }),

    supabase
      .from("helpdesk_team_members")
      .select("team_id, profile_id, role, profiles(full_name, email)")
      .eq("tenant_id", staff.tenantId),

    supabase
      .from("helpdesk_business_hours")
      .select("day_of_week, open, start_time, end_time, timezone")
      .eq("tenant_id", staff.tenantId)
      .order("day_of_week", { ascending: true }),

    supabase
      .from("helpdesk_email_signatures")
      .select("id, name, body, is_default, profile_id")
      .eq("tenant_id", staff.tenantId)
      .eq("active", true)
      .order("created_at", { ascending: true }),

    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("tenant_id", staff.tenantId),

    admin
      ? admin
          .from("helpdesk_channel_connections")
          .select("id, name, identifier, status, auto_reply_enabled, auto_reply_message, active")
          .eq("tenant_id", staff.tenantId)
          .eq("channel", "email")
          .eq("active", true)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  // Agrupa membros por equipe
  const membersByTeam: Record<string, TeamMember[]> = {};
  for (const m of (membersRaw ?? []) as unknown as Array<{
    team_id: string; profile_id: string; role: string;
    profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
  }>) {
    if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = [];
    const prof = Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles;
    membersByTeam[m.team_id].push({
      profile_id: m.profile_id,
      full_name: prof?.full_name ?? null,
      email: prof?.email ?? null,
      role: m.role as "agent" | "lead",
    });
  }

  const teams: Team[] = (teamsRaw ?? []).map((t: { id: string; name: string; description: string | null; color: string; active: boolean }) => ({
    ...t,
    members: membersByTeam[t.id] ?? [],
  }));

  // Horário padrão se não configurado ainda
  const DAY_DEFAULTS: BusinessHour[] = [0, 1, 2, 3, 4, 5, 6].map(d => ({
    day_of_week: d,
    open: d >= 1 && d <= 5,
    start_time: "08:00",
    end_time: "18:00",
    timezone: "America/Sao_Paulo",
  }));
  const savedHours = businessHours ?? [];
  const mergedHours: BusinessHour[] = DAY_DEFAULTS.map(def => {
    const saved = savedHours.find((h: { day_of_week: number }) => h.day_of_week === def.day_of_week);
    return saved ? (saved as BusinessHour) : def;
  });

  const emailChannels = ((channelsResult as { data: unknown[] | null }).data ?? []) as EmailChannel[];

  // URL do webhook para exibir na UI
  const baseUrl = process.env.NEXT_PUBLIC_ADMIN_URL
    ?? process.env.NEXTAUTH_URL
    ?? "https://admin.florabotanics.com.br";
  const webhookUrl = `${baseUrl}/api/webhooks/resend`;

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

      <div style={{ padding: "28px 32px 48px", maxWidth: 960, margin: "0 auto" }}>
        <InboxSettingsClient
          slaPolicies={(slaPolicies ?? []) as SlaPolicy[]}
          tenantId={staff.tenantId}
          teams={teams}
          businessHours={mergedHours}
          signatures={(signatures ?? []) as EmailSignature[]}
          allProfiles={(profiles ?? []) as StaffProfile[]}
          emailChannels={emailChannels}
          webhookUrl={webhookUrl}
        />
      </div>
    </div>
  );
}
