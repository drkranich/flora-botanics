"use client";

import { useState } from "react";
import { requestSignature } from "../actions";

interface Props {
  quoteId: string;
}

type State = "idle" | "loading" | "done" | "error";

export function SignatureButton({ quoteId }: Props) {
  const [state, setState] = useState<State>("idle");
  const [link, setLink] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  async function handleRequest() {
    setState("loading");
    try {
      const { token } = await requestSignature(quoteId);
      const url = `${window.location.origin}/assinar/${token}`;
      setLink(url);
      setState("done");
      setModalOpen(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao gerar link.");
      setState("error");
      setModalOpen(true);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setModalOpen(false);
    if (state === "error") setState("idle");
  }

  return (
    <>
      <button
        className="btn btn-ghost"
        style={{ padding: "7px 14px", fontSize: 11 }}
        onClick={handleRequest}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Gerando link…" : "✍ Solicitar assinatura"}
      </button>

      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            style={{
              background: "#1e2a1f",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: "32px 28px",
              maxWidth: 520,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {state === "error" ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#f1ede5", margin: 0 }}>
                  Erro ao gerar link
                </h2>
                <p style={{ fontSize: 13, color: "#c0392b", margin: 0 }}>{errorMsg}</p>
                <button className="btn btn-ghost" onClick={handleClose}>Fechar</button>
              </>
            ) : (
              <>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#f1ede5", margin: "0 0 6px" }}>
                    Link de assinatura gerado ✍
                  </h2>
                  <p style={{ fontSize: 12, color: "#8a9580", margin: 0, lineHeight: 1.6 }}>
                    Compartilhe este link com o cliente. Ele poderá assinar o documento
                    diretamente pelo navegador, sem precisar de login.
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: "#c8d5b9",
                      wordBreak: "break-all",
                      fontFamily: "monospace",
                    }}
                  >
                    {link}
                  </span>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "6px 14px", fontSize: 11, flexShrink: 0 }}
                    onClick={handleCopy}
                  >
                    {copied ? "✓ Copiado!" : "Copiar"}
                  </button>
                </div>

                <div
                  style={{
                    background: "rgba(42,74,44,0.15)",
                    border: "1px solid rgba(42,74,44,0.3)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 11,
                    color: "#8a9580",
                    lineHeight: 1.6,
                  }}
                >
                  🔒 O link expira em 30 dias. Se o cliente já assinou ou o link estiver expirado,
                  clique novamente em "Solicitar assinatura" para reabrir.
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleClose}>
                    Fechar
                  </button>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-gold"
                    style={{ fontSize: 12, padding: "8px 18px" }}
                  >
                    Abrir link →
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
