import { redirect } from "next/navigation";
import { currentStaff, ROLE_LABELS } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Sidebar } from "@/components/Sidebar";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();
  if (!staff) {
    // segurança extra — o middleware já cobre isso na borda
    redirect("/login");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 24px",
            borderBottom: "1px solid #e6ddc9",
          }}
        >
          <div style={{ fontSize: 13, color: "#6b6354" }}>
            {staff.fullName ?? staff.email} ·{" "}
            <span style={{ fontWeight: 700, color: "#28251d" }}>
              {ROLE_LABELS[staff.role]}
            </span>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #d9cfb8",
                background: "transparent",
                color: "#28251d",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Sair
            </button>
          </form>
        </header>
        <main style={{ flex: 1, padding: 24 }}>{children}</main>
      </div>
    </div>
  );
}
