import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentStaff } from "@/lib/auth";

interface CustomerRow {
  id: string;
  full_name: string | null;
  email: string;
  whatsapp: string | null;
  birthday: string | null;
  tags: string[];
  accepts_marketing: boolean;
}

function formatBirthday(value: string | null): string {
  if (!value) return "—";
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

export default async function ClientesPage() {
  const staff = await currentStaff();
  if (!staff) return null;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("customers")
    .select("id, full_name, email, whatsapp, birthday, tags, accepts_marketing", { count: "exact" })
    .eq("tenant_id", staff.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  const customers = (data ?? []) as CustomerRow[];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>Clientes</h1>
        <p style={{ margin: 0, color: "#6b6354", fontSize: 14 }}>
          {count ?? customers.length} cliente(s) cadastrado(s).
        </p>
      </div>

      {customers.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: "#6b6354", fontSize: 14 }}>
            Nenhum cliente ainda. A lista aparece aqui conforme os pedidos forem feitos no site
            ou clientes forem cadastrados manualmente.
          </p>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f2ecdf", textAlign: "left" }}>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>E-mail</th>
                <th style={thStyle}>WhatsApp</th>
                <th style={thStyle}>Aniversário</th>
                <th style={thStyle}>Tags</th>
                <th style={thStyle}>Marketing</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid #f2ecdf" }}>
                  <td style={tdStyle}>
                    <Link href={`/clientes/${c.id}`} style={{ color: "#28251d", fontWeight: 600 }}>
                      {c.full_name ?? "—"}
                    </Link>
                  </td>
                  <td style={tdStyle}>{c.email}</td>
                  <td style={tdStyle}>{c.whatsapp ?? "—"}</td>
                  <td style={tdStyle}>{formatBirthday(c.birthday)}</td>
                  <td style={tdStyle}>{c.tags?.length ? c.tags.join(", ") : "—"}</td>
                  <td style={tdStyle}>{c.accepts_marketing ? "Sim" : "Não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e6ddc9",
  borderRadius: 12,
  padding: 20,
};

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 12,
  fontWeight: 700,
  color: "#6b6354",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 16px",
};
