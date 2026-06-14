"use client";

import { useState } from "react";

/**
 * Fase 0: registro local (placeholder).
 * Fase 1: POST para a Edge Function subscribe-lead (com Turnstile),
 * que grava na tabela `leads`.
 */
export function NewsletterForm() {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>
        Cadastro recebido com sucesso! ✓
      </p>
    );
  }

  return (
    <form
      className="newsletter-form"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
    >
      <input type="email" placeholder="Seu melhor e-mail" required />
      <button type="submit">Quero receber</button>
    </form>
  );
}
