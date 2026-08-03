import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/auth";
import { getAgents, getTeamsWithMembers } from "./actions";
import { EquipeClient } from "./EquipeClient";

export default async function InboxEquipePage() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const canManage = ["platform_admin", "tenant_owner", "tenant_admin"].includes(staff.role);

  const [agents, teams] = await Promise.all([
    getAgents(),
    getTeamsWithMembers(),
  ]);

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
          Equipe de Atendimento
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link href="/inbox/settings" style={{
            fontSize: 11, color: "var(--cream-dim)", textDecoration: "none",
            background: "rgba(242,236,223,0.05)", border: "1px solid rgba(242,236,223,0.09)",
            borderRadius: 7, padding: "5px 12px", transition: "background 0.15s",
          }}>
            ◈ Configurações avançadas
          </Link>
        </div>
      </div>

      <EquipeClient
        agents={agents}
        teams={teams}
        myId={staff.id}
        canManage={canManage}
      />
    </div>
  );
}
