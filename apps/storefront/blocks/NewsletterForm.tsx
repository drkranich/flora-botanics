"use client";

import { useState } from "react";

/**
 * Formulário de newsletter — envia para a Edge Function subscribe-lead,
 * que grava na tabela `leads` (visível em Vendas → Clientes no admin).
 * Campo "website" é honeypot anti-bot (oculto; humano não preenche).
 */
export function NewsletterForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setStatus("sending");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/subscribe-lead`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: data.get("email"),
            website: data.get("website"), // honeypot
            tenant_slug: process.env.NEXT_PUBLIC_TENANT_SLUG ?? "flora-botanics",
          }),
        }
      );
      const body = await res.json();
      setStatus(res.ok && body.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>
        Cadastro recebido com sucesso! ✓
      </p>
    );
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubmit} style={{ position: "relative" }}>
      {/* honeypot: invisível para humanos */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        aria-hidden="true"
      />
      <input type="email" name="email" placeholder="Seu melhor e-mail" required />
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Enviando…" : "Quero receber"}
      </button>
      {status === "error" ? (
        <span style={{ position: "absolute", bottom: -24, left: 0, fontSize: 11, color: "#ffd7d7" }}>
          Não foi possível enviar — tente novamente.
        </span>
      ) : null}
    </form>
  );
}
