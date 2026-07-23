"use client";

import { useState, useTransition } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const nextEmail = String(formData.get("email") ?? "").trim();
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setError(data?.error ?? "Não foi possível cadastrar este e-mail.");
        return;
      }

      setDone(true);
    });
  }

  if (done) {
    return (
      <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>
        Cadastro recebido com sucesso!
      </p>
    );
  }

  return (
    <form className="newsletter-form" action={submit}>
      <input
        type="email"
        name="email"
        placeholder="Seu melhor e-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Quero receber"}
      </button>
      {error ? <p className="newsletter-error">{error}</p> : null}
    </form>
  );
}
