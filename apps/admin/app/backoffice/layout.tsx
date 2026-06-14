import { redirect } from "next/navigation";
import { currentStaff, ROLE_LABELS } from "@/lib/auth";

/**
 * Layout do Backoffice (CRM/ERP/NF-e/Marketplaces/Mensagens/Logs/Config fiscal).
 *
 * A navegação principal já é fornecida pelo <Shell> (app/layout.tsx) — este
 * layout adiciona apenas uma faixa de contexto identificando a seção e o
 * usuário autenticado.
 */
export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  return (
    <div>
      <div
        className="glass"
        style={{
          margin: "20px 28px 0",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span className="eyebrow">Backoffice</span>
        <span className="muted" style={{ fontSize: 13 }}>
          {staff.fullName ?? staff.email} · {ROLE_LABELS[staff.role]}
        </span>
      </div>
      {children}
    </div>
  );
}
