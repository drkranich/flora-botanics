"use client";

import { useState, useTransition } from "react";
import { savePdfConfig } from "@/lib/pdf/actions";
import type { PdfConfig } from "@/lib/pdf/template";
import { buildFloraKraftPDF, openAndPrint } from "@/lib/pdf/template";

// ── Presets de tema ──────────────────────────────────────────────────────────

const PRESETS: { label: string; values: Partial<PdfConfig> }[] = [
  {
    label: "🌿 Kraft (padrão)",
    values: {
      bgColor: "#f2e8d9",
      accentColor: "#2a4a2c",
      headerBorderColor: "#5a3e2b",
      fontFamily: "Georgia, 'Times New Roman', serif",
      watermarkOpacity: 6,
      watermarkSize: 260,
    },
  },
  {
    label: "⬛ Escuro elegante",
    values: {
      bgColor: "#1a1a1a",
      accentColor: "#c8a96e",
      headerBorderColor: "#444444",
      fontFamily: "Georgia, 'Times New Roman', serif",
      watermarkOpacity: 4,
      watermarkSize: 260,
    },
  },
  {
    label: "⬜ Branco clássico",
    values: {
      bgColor: "#ffffff",
      accentColor: "#1a3a1a",
      headerBorderColor: "#cccccc",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      watermarkOpacity: 5,
      watermarkSize: 220,
    },
  },
  {
    label: "🌸 Rosa botânico",
    values: {
      bgColor: "#fdf6f0",
      accentColor: "#8b3a52",
      headerBorderColor: "#d4a0b0",
      fontFamily: "Georgia, 'Times New Roman', serif",
      watermarkOpacity: 5,
      watermarkSize: 240,
    },
  },
];

const FONTS = [
  { label: "Georgia (serifada — padrão kraft)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Helvetica / Arial (sem serifa)", value: "'Helvetica Neue', Arial, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Verdana, sans-serif" },
  { label: "Courier (mono)", value: "'Courier New', Courier, monospace" },
];

// ── Componentes auxiliares ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rise" style={{ padding: 24, marginBottom: 16 }}>
      <p className="eyebrow" style={{ marginBottom: 16, fontSize: 10 }}>{title}</p>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="field-label">{label}</span>
      {hint && <span style={{ fontSize: 10, color: "var(--cream-dim)", marginBottom: 2 }}>{hint}</span>}
      {children}
    </label>
  );
}

function ColorField({ label, name, value, onChange, hint }: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="color"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 44, height: 36, border: "none", borderRadius: 6,
            cursor: "pointer", background: "none", padding: 2,
            flexShrink: 0,
          }}
        />
        <input
          className="input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          style={{ fontFamily: "monospace", fontSize: 12 }}
        />
      </div>
    </Field>
  );
}

// ── Editor principal ─────────────────────────────────────────────────────────

interface Props {
  initial: PdfConfig;
}

export function PdfStylesEditor({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Identidade
  const [companyName, setCompanyName] = useState(initial.companyName ?? "");
  const [cnpj, setCnpj] = useState(initial.cnpj ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [defaultNotes, setDefaultNotes] = useState(initial.defaultNotes ?? "");

  // Estilos
  const [bgColor, setBgColor] = useState(initial.bgColor ?? "#f2e8d9");
  const [accentColor, setAccentColor] = useState(initial.accentColor ?? "#2a4a2c");
  const [headerBorderColor, setHeaderBorderColor] = useState(initial.headerBorderColor ?? "#5a3e2b");
  const [fontFamily, setFontFamily] = useState(initial.fontFamily ?? "Georgia, 'Times New Roman', serif");
  const [watermarkOpacity, setWatermarkOpacity] = useState(initial.watermarkOpacity ?? 6);
  const [watermarkSize, setWatermarkSize] = useState(initial.watermarkSize ?? 260);

  function flash(ok: boolean, text: string) {
    if (ok) { setMsg(text); setErr(null); }
    else { setErr(text); setMsg(null); }
    setTimeout(() => { setMsg(null); setErr(null); }, 4000);
  }

  function applyPreset(preset: Partial<PdfConfig>) {
    if (preset.bgColor)           setBgColor(preset.bgColor);
    if (preset.accentColor)       setAccentColor(preset.accentColor);
    if (preset.headerBorderColor) setHeaderBorderColor(preset.headerBorderColor);
    if (preset.fontFamily)        setFontFamily(preset.fontFamily);
    if (preset.watermarkOpacity !== undefined) setWatermarkOpacity(preset.watermarkOpacity);
    if (preset.watermarkSize !== undefined)    setWatermarkSize(preset.watermarkSize);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await savePdfConfig(fd);
      if (result.ok) flash(true, "Configuração salva com sucesso.");
      else flash(false, result.error);
    });
  }

  function handlePreview() {
    const config: PdfConfig = {
      companyName: companyName || "Flora Botanics",
      cnpj, phone, email, website, address, defaultNotes,
      bgColor, accentColor, headerBorderColor, fontFamily,
      watermarkOpacity, watermarkSize,
    };
    const html = buildFloraKraftPDF({
      title: "Pré-visualização do Estilo",
      subtitle: "Veja como seus PDFs ficarão com as configurações atuais.",
      body: `
        <div class="section">
          <div class="section-title">Exemplo de tabela de dados</div>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Quantidade</th>
                <th>Preço unit.</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Kit Botânico Premium</td>
                <td>3</td>
                <td>R$ 96,63</td>
                <td>R$ 289,90</td>
                <td><span class="badge">Pago</span></td>
              </tr>
              <tr>
                <td>Óleo Capilar Orgânico</td>
                <td>2</td>
                <td>R$ 77,00</td>
                <td>R$ 154,00</td>
                <td><span class="badge">Em trânsito</span></td>
              </tr>
              <tr>
                <td>Creme Hidratante Linha Verde</td>
                <td>5</td>
                <td>R$ 62,50</td>
                <td>R$ 312,50</td>
                <td><span class="badge">Entregue</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      `,
      config,
    });
    openAndPrint(html);
  }

  const currentConfig: PdfConfig = {
    companyName, cnpj, phone, email, website, address, defaultNotes,
    bgColor, accentColor, headerBorderColor, fontFamily,
    watermarkOpacity, watermarkSize,
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Campos ocultos para os valores controlados */}
      <input type="hidden" name="companyName" value={companyName} />
      <input type="hidden" name="cnpj" value={cnpj} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="website" value={website} />
      <input type="hidden" name="address" value={address} />
      <input type="hidden" name="defaultNotes" value={defaultNotes} />
      <input type="hidden" name="bgColor" value={bgColor} />
      <input type="hidden" name="accentColor" value={accentColor} />
      <input type="hidden" name="headerBorderColor" value={headerBorderColor} />
      <input type="hidden" name="fontFamily" value={fontFamily} />
      <input type="hidden" name="watermarkOpacity" value={watermarkOpacity} />
      <input type="hidden" name="watermarkSize" value={watermarkSize} />

      {msg && (
        <p style={{ color: "#8fd486", fontSize: 12, padding: "8px 12px", background: "rgba(143,212,134,0.08)", borderRadius: 8, border: "1px solid rgba(143,212,134,0.3)", marginBottom: 16 }}>
          ✓ {msg}
        </p>
      )}
      {err && (
        <p style={{ color: "#e8a0a0", fontSize: 12, padding: "8px 12px", background: "rgba(232,160,160,0.08)", borderRadius: 8, border: "1px solid rgba(232,160,160,0.3)", marginBottom: 16 }}>
          ⚠️ {err}
        </p>
      )}

      {/* ── Presets ── */}
      <Section title="TEMAS PRONTOS">
        <p className="muted" style={{ fontSize: 11, marginBottom: 12 }}>
          Clique num tema para preencher automaticamente as cores e fontes.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "8px 14px" }}
              onClick={() => applyPreset(p.values)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Cores ── */}
      <Section title="CORES">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <ColorField
            label="Fundo da página"
            name="bgColor"
            value={bgColor}
            onChange={setBgColor}
            hint="Cor do papel (ex.: #f2e8d9 = kraft)"
          />
          <ColorField
            label="Cor de destaque"
            name="accentColor"
            value={accentColor}
            onChange={setAccentColor}
            hint="Cabeçalho de tabelas, títulos e badges"
          />
          <ColorField
            label="Borda do cabeçalho"
            name="headerBorderColor"
            value={headerBorderColor}
            onChange={setHeaderBorderColor}
            hint="Linha divisória no topo do documento"
          />
        </div>

        {/* Preview ao vivo das cores */}
        <div style={{ marginTop: 20, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{
            background: bgColor,
            padding: "16px 20px",
            borderBottom: `2px solid ${headerBorderColor}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ color: accentColor, fontWeight: 700, fontSize: 15, letterSpacing: 1, textTransform: "uppercase", fontFamily }}>
              {companyName || "Flora Botanics"}
            </span>
            <span style={{ fontSize: 10, color: "#888" }}>Pré-visualização ao vivo</span>
          </div>
          <div style={{ background: bgColor, padding: "12px 20px 16px" }}>
            <div style={{ fontSize: 12, color: accentColor, fontWeight: 700, marginBottom: 8, fontFamily }}>
              Exemplo de título de seção
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily }}>
              <thead>
                <tr>
                  <th style={{ background: accentColor, color: bgColor, padding: "6px 10px", textAlign: "left" }}>Produto</th>
                  <th style={{ background: accentColor, color: bgColor, padding: "6px 10px", textAlign: "left" }}>Valor</th>
                  <th style={{ background: accentColor, color: bgColor, padding: "6px 10px", textAlign: "left" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "5px 10px", color: "#1a1a1a" }}>Kit Botânico Premium</td>
                  <td style={{ padding: "5px 10px", color: "#1a1a1a" }}>R$ 289,90</td>
                  <td style={{ padding: "5px 10px" }}>
                    <span style={{ background: accentColor + "20", color: accentColor, border: `1px solid ${accentColor}50`, borderRadius: 3, padding: "1px 7px", fontSize: 10 }}>
                      Pago
                    </span>
                  </td>
                </tr>
                <tr style={{ background: headerBorderColor + "15" }}>
                  <td style={{ padding: "5px 10px", color: "#1a1a1a" }}>Óleo Capilar</td>
                  <td style={{ padding: "5px 10px", color: "#1a1a1a" }}>R$ 154,00</td>
                  <td style={{ padding: "5px 10px" }}>
                    <span style={{ background: accentColor + "20", color: accentColor, border: `1px solid ${accentColor}50`, borderRadius: 3, padding: "1px 7px", fontSize: 10 }}>
                      Entregue
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ── Tipografia e marca d'água ── */}
      <Section title="TIPOGRAFIA E MARCA D'ÁGUA">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Field label="Família de fonte">
            <select
              className="input"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              style={{ fontSize: 12 }}
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
              {!FONTS.find((f) => f.value === fontFamily) && (
                <option value={fontFamily}>{fontFamily}</option>
              )}
            </select>
          </Field>

          <Field label={`Opacidade da marca d'água: ${watermarkOpacity}%`} hint="0 = invisível · 100 = sólido (recomendado: 4–8)">
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={watermarkOpacity}
              onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--gold-light)" }}
            />
          </Field>

          <Field label={`Tamanho da marca d'água: ${watermarkSize}px`} hint="Tamanho do tile repetido (recomendado: 200–320)">
            <input
              type="range"
              min={80}
              max={500}
              step={20}
              value={watermarkSize}
              onChange={(e) => setWatermarkSize(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--gold-light)" }}
            />
          </Field>
        </div>

        <div style={{
          marginTop: 16,
          padding: "10px 14px",
          background: "rgba(185,146,77,0.06)",
          border: "1px solid rgba(185,146,77,0.2)",
          borderRadius: 8,
          fontSize: 11,
          color: "var(--cream-dim)",
        }}>
          A marca d'água é a logo Flora Botanics repetida como tile quase transparente no fundo do documento.
          Clique em "Pré-visualizar" para ver o resultado real no navegador.
        </div>
      </Section>

      {/* ── Identidade da empresa ── */}
      <Section title="DADOS DA EMPRESA (RODAPÉ)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <Field label="Nome da empresa">
            <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Flora Botanics" />
          </Field>
          <Field label="CNPJ">
            <input className="input" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="12.345.678/0001-99" />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 9 9999-9999" />
          </Field>
          <Field label="E-mail de contato">
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@florabotanics.com.br" />
          </Field>
          <Field label="Website">
            <input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="florabotanics.com.br" />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Endereço completo">
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua das Flores, 123 — Bairro Jardim — São Paulo, SP" />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Observações padrão" hint="Aparece em todos os PDFs gerados (ex.: aviso de confidencialidade, validade da proposta)">
            <textarea
              className="input"
              value={defaultNotes}
              onChange={(e) => setDefaultNotes(e.target.value)}
              rows={3}
              placeholder="Documento gerado para fins de controle interno. Não possui valor fiscal."
            />
          </Field>
        </div>
      </Section>

      {/* ── Ações ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-gold"
          style={{ padding: "12px 24px", fontSize: 10 }}
        >
          {pending ? "Salvando…" : "💾 Salvar configuração"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: "12px 20px", fontSize: 10 }}
          onClick={handlePreview}
        >
          📄 Pré-visualizar PDF
        </button>
        <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>
          A pré-visualização abre o PDF no navegador com as configurações atuais (sem precisar salvar).
        </span>
      </div>
    </form>
  );
}
