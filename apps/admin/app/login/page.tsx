import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <form
        action={signIn}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "grid",
          gap: 16,
          background: "#fff",
          border: "1px solid #e6ddc9",
          borderRadius: 12,
          padding: 32,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontWeight: 900, letterSpacing: -1, margin: 0 }}>FLORA · ADMIN</h1>
          <p style={{ margin: "4px 0 0", color: "#6b6354", fontSize: 14 }}>
            Acesso restrito à equipe
          </p>
        </div>

        {error ? (
          <p
            style={{
              margin: 0,
              padding: "8px 12px",
              borderRadius: 8,
              background: "#fbeaea",
              color: "#9a3232",
              fontSize: 13,
            }}
          >
            {error}
          </p>
        ) : null}

        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          E-mail
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Senha
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            style={inputStyle}
          />
        </label>

        <button type="submit" style={buttonStyle}>
          Entrar
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d9cfb8",
  fontSize: 14,
  fontFamily: "inherit",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  background: "#28251d",
  color: "#f2ecdf",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
