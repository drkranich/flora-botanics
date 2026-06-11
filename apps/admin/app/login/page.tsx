"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.logo}>
          FL<span style={styles.dot}>•</span>RA
        </h1>
        <p style={styles.sub}>PAINEL ADMINISTRATIVO</p>

        <label style={styles.label}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={styles.input}
          />
        </label>

        {error ? <p style={styles.error}>{error}</p> : null}

        <button type="submit" disabled={loading} style={styles.btn}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(120deg, #0f2012, #21351d)",
  },
  card: {
    width: "min(380px, 90vw)",
    background: "#fff8ea",
    padding: "40px 34px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  logo: { fontWeight: 900, letterSpacing: -2, fontSize: 36, textAlign: "center", margin: 0 },
  dot: { color: "#b9924d" },
  sub: {
    textAlign: "center",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: 700,
    color: "#5e584b",
    marginTop: -8,
  },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: 1, display: "flex", flexDirection: "column", gap: 6 },
  input: {
    height: 44,
    border: "1px solid #d7cdb8",
    background: "#ffffff",
    padding: "0 12px",
    fontSize: 14,
    outline: "none",
  },
  error: { color: "#9b2c2c", fontSize: 12, margin: 0 },
  btn: {
    height: 48,
    border: 0,
    background: "#b9924d",
    color: "#fff8ea",
    fontWeight: 700,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontSize: 12,
    cursor: "pointer",
  },
};
