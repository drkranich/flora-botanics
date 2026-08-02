"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  token: string;
  sigId: string;
}

type Stage = "form" | "signing" | "submitting" | "done" | "error";

const KRAFT = "#f2e8d9";
const GREEN = "#2a4a2c";
const BROWN = "#5a3e2b";
const TEXT  = "#1a1a1a";

export function SignerClient({ token, sigId }: Props) {
  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isEmpty, setIsEmpty] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // ── Canvas setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "signing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [stage]);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setIsEmpty(false);
  }, []);

  const stopDraw = useCallback(() => {
    drawing.current = false;
    lastPos.current = null;
  }, []);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }

  // ── Validação e envio ──────────────────────────────────────────────────────
  function handleNext() {
    if (!name.trim()) { setErrorMsg("Informe seu nome completo."); return; }
    if (!email.trim() || !email.includes("@")) { setErrorMsg("Informe um e-mail válido."); return; }
    if (!agreed) { setErrorMsg("Você precisa concordar com os termos para assinar."); return; }
    setErrorMsg("");
    setStage("signing");
  }

  async function handleSubmit() {
    if (isEmpty) { setErrorMsg("Desenhe sua assinatura antes de confirmar."); return; }
    setErrorMsg("");
    setStage("submitting");

    const canvas = canvasRef.current!;
    const signatureImage = canvas.toDataURL("image/png");

    try {
      const res = await fetch(`/api/assinar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sigId, name, email, signatureImage }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Erro ao registrar assinatura.");
      }
      setStage("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro inesperado.");
      setStage("signing");
    }
  }

  // ── Renders ────────────────────────────────────────────────────────────────

  if (stage === "done") {
    return (
      <div style={S.panel}>
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: GREEN, marginBottom: 12 }}>
            Documento assinado!
          </h2>
          <p style={{ fontSize: 14, color: TEXT, lineHeight: 1.7, margin: 0 }}>
            Sua assinatura foi registrada com sucesso.<br />
            O responsável pela Flora Botanics será notificado.
          </p>
          <p style={{ fontSize: 11, color: BROWN, marginTop: 16, opacity: 0.7 }}>
            Guarde esta página ou o e-mail de confirmação como comprovante.
          </p>
        </div>
      </div>
    );
  }

  if (stage === "form") {
    return (
      <div style={S.panel}>
        <h2 style={S.panelTitle}>Assinar documento</h2>
        <p style={S.hint}>
          Preencha seus dados e, na próxima etapa, desenhe sua assinatura no campo indicado.
        </p>

        <label style={S.label}>
          Nome completo <span style={S.req}>*</span>
          <input
            style={S.input}
            type="text"
            placeholder="Seu nome como aparece no documento"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>

        <label style={S.label}>
          E-mail <span style={S.req}>*</span>
          <input
            style={S.input}
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label style={{ ...S.label, flexDirection: "row", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ marginTop: 2, accentColor: GREEN, width: 16, height: 16, flexShrink: 0 }}
          />
          <span style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>
            Li e concordo com os termos e condições do documento. Entendo que minha assinatura
            digital tem validade jurídica conforme a MP 2.200-2/2001 e Lei 14.063/2020.
          </span>
        </label>

        {errorMsg && <p style={S.error}>{errorMsg}</p>}

        <button
          style={S.btnPrimary}
          onClick={handleNext}
        >
          Continuar para assinar →
        </button>

        <div style={S.securityNote}>
          🔒 Seus dados são protegidos. O IP e horário da assinatura são registrados como evidência de autoria.
        </div>
      </div>
    );
  }

  // stage === "signing" | "submitting"
  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Desenhe sua assinatura</h2>
      <p style={S.hint}>
        Use o mouse ou o dedo (em tela touch) para assinar no campo abaixo.
      </p>

      <div style={S.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={560}
          height={200}
          style={S.canvas}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        <div style={S.canvasLine} />
        <span style={S.canvasHint}>Assine acima desta linha</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          style={S.btnGhost}
          onClick={clearCanvas}
          disabled={stage === "submitting"}
        >
          🗑 Limpar
        </button>
        <button
          style={{ ...S.btnGhost, marginLeft: "auto" }}
          onClick={() => { setStage("form"); clearCanvas(); }}
          disabled={stage === "submitting"}
        >
          ← Voltar
        </button>
      </div>

      {errorMsg && <p style={S.error}>{errorMsg}</p>}

      <button
        style={{ ...S.btnPrimary, marginTop: 20, opacity: stage === "submitting" ? 0.7 : 1 }}
        onClick={handleSubmit}
        disabled={stage === "submitting" || isEmpty}
      >
        {stage === "submitting" ? "Registrando assinatura…" : "✅ Confirmar assinatura"}
      </button>

      <p style={{ fontSize: 11, color: BROWN, marginTop: 14, textAlign: "center", opacity: 0.7 }}>
        Assinando como: <strong>{name}</strong> · {email}
      </p>

      <div style={S.securityNote}>
        🔒 Ao confirmar, sua assinatura e dados serão registrados com carimbo de tempo e IP.
      </div>
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  panel: {
    background: "rgba(255,255,255,0.55)",
    border: `1px solid rgba(${90},${62},${43},0.22)`,
    borderRadius: 14,
    padding: "32px 28px",
    backdropFilter: "blur(8px)",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  panelTitle: { fontSize: 18, fontWeight: 800, color: GREEN, margin: 0 },
  hint: { fontSize: 13, color: BROWN, lineHeight: 1.6, margin: 0 },
  label: { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 12, fontWeight: 700, color: BROWN, letterSpacing: 0.3 },
  req: { color: "#c0392b" },
  input: {
    fontFamily: "Georgia, serif",
    fontSize: 14,
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid rgba(${90},${62},${43},0.3)`,
    background: "rgba(255,255,255,0.7)",
    color: TEXT,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  canvasWrap: {
    position: "relative" as const,
    background: "#fff",
    borderRadius: 10,
    border: `2px solid rgba(${90},${62},${43},0.35)`,
    overflow: "hidden",
    userSelect: "none" as const,
    touchAction: "none",
  },
  canvas: { display: "block", width: "100%", height: "auto", cursor: "crosshair" },
  canvasLine: {
    position: "absolute" as const,
    bottom: 40,
    left: "5%",
    right: "5%",
    height: 1,
    background: `rgba(${90},${62},${43},0.25)`,
    pointerEvents: "none" as const,
  },
  canvasHint: {
    position: "absolute" as const,
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: "center" as const,
    fontSize: 10,
    color: BROWN,
    opacity: 0.6,
    pointerEvents: "none" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  btnPrimary: {
    background: GREEN,
    color: KRAFT,
    border: "none",
    borderRadius: 10,
    padding: "14px 24px",
    fontSize: 14,
    fontWeight: 800,
    fontFamily: "Georgia, serif",
    cursor: "pointer",
    letterSpacing: 0.5,
    width: "100%",
  },
  btnGhost: {
    background: "rgba(255,255,255,0.5)",
    color: BROWN,
    border: `1px solid rgba(${90},${62},${43},0.3)`,
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "Georgia, serif",
    cursor: "pointer",
  },
  error: {
    background: "rgba(192,57,43,0.08)",
    border: "1px solid rgba(192,57,43,0.25)",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 12,
    color: "#c0392b",
    margin: 0,
  },
  securityNote: {
    fontSize: 11,
    color: BROWN,
    background: `rgba(${42},${74},${44},0.06)`,
    border: `1px solid rgba(${42},${74},${44},0.15)`,
    borderRadius: 8,
    padding: "8px 12px",
    lineHeight: 1.6,
  },
};
