import { signOut } from "@/app/login/actions";

export default function SemAcessoPage() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 style={{ fontWeight: 900, letterSpacing: -1 }}>Sem acesso</h1>
        <p style={{ lineHeight: 1.6 }}>
          Sua conta está autenticada, mas não tem permissão de equipe (staff) para
          este tenant. Fale com um administrador para liberar o acesso.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            style={{
              marginTop: 12,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #28251d",
              background: "transparent",
              color: "#28251d",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
