"use client";

/**
 * NfeEmissaoClient — formulário de emissão avulsa de NF-e
 * Design: glassmorphism puro, sem azul de browser em nenhum elemento.
 * Selects customizados para eliminar o menu nativo do SO.
 */

import { useRef, useState, useTransition, useEffect } from "react";
import { emitirNFeAvulsaAction } from "./emitir-action";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Item = {
  cProd: string; xProd: string; NCM: string; CFOP: string;
  uCom: string;  qCom: string;  vUnCom: string; cEAN: string;
};

type Pagamento = { tPag: string; vPag: string };

const EMPTY_ITEM: Item = {
  cProd: "", xProd: "", NCM: "33049900", CFOP: "5102",
  uCom: "UN",  qCom: "1",  vUnCom: "",  cEAN: "",
};

const PAYMENT_TYPES: [string, string][] = [
  ["01","Dinheiro"],["02","Cheque"],["03","Cartão de Crédito"],
  ["04","Cartão de Débito"],["15","Boleto"],["17","PIX"],["99","Outros"],
];

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

// ─── CSS global inline (inject once) ─────────────────────────────────────────
// Remove outline azul de todos os inputs/botões dentro do form NFe

const GLOBAL_CSS = `
.nfe-form input, .nfe-form textarea {
  background: rgba(255,255,255,0.06) !important;
  border: 1px solid rgba(245,236,220,0.12) !important;
  border-radius: 8px !important;
  color: rgb(245,236,220) !important;
  font-size: 13px !important;
  padding: 8px 12px !important;
  width: 100% !important;
  box-sizing: border-box !important;
  min-height: 36px !important;
  outline: none !important;
  transition: border-color 0.15s, background 0.15s !important;
  -webkit-appearance: none !important;
  appearance: none !important;
  caret-color: rgb(201,169,110) !important;
}
.nfe-form input::placeholder, .nfe-form textarea::placeholder {
  color: rgba(245,236,220,0.3) !important;
}
.nfe-form input:focus, .nfe-form textarea:focus {
  border-color: rgba(201,169,110,0.5) !important;
  background: rgba(255,255,255,0.09) !important;
  box-shadow: 0 0 0 3px rgba(201,169,110,0.08) !important;
}
.nfe-form input[disabled], .nfe-form input[readonly] {
  opacity: 0.55 !important;
  cursor: default !important;
}
.nfe-form input[type="number"]::-webkit-inner-spin-button,
.nfe-form input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none !important;
  margin: 0 !important;
}
.nfe-form input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px rgba(20,30,20,1) inset !important;
  -webkit-text-fill-color: rgb(245,236,220) !important;
}
`;

// ─── SelectGlass — dropdown customizado sem azul de browser ──────────────────

function SelectGlass({
  value, onChange, opts, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = opts.find(([v]) => v === value)?.[1] ?? value;

  // fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // fecha com Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", minHeight: 36, padding: "7px 36px 7px 12px",
          background: open ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.06)",
          border: open
            ? "1px solid rgba(201,169,110,0.5)"
            : "1px solid rgba(245,236,220,0.12)",
          boxShadow: open ? "0 0 0 3px rgba(201,169,110,0.08)" : "none",
          borderRadius: 8, color: "rgb(245,236,220)", fontSize: 13,
          textAlign: "left", cursor: "pointer", position: "relative",
          transition: "border-color 0.15s, background 0.15s",
          outline: "none",
        }}
      >
        {label}
        {/* Chevron */}
        <span style={{
          position: "absolute", right: 12, top: "50%",
          transform: `translateY(-50%) rotate(${open ? "180deg" : "0deg"})`,
          transition: "transform 0.2s",
          color: "rgba(245,236,220,0.45)", fontSize: 11, pointerEvents: "none",
        }}>
          ▼
        </span>
      </button>

      {/* Dropdown list */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "rgba(18,24,18,0.97)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(245,236,220,0.14)",
          borderRadius: 10, zIndex: 9999,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          maxHeight: 240, overflowY: "auto",
          padding: "4px",
        }}>
          {opts.map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => { onChange(v); setOpen(false); }}
              style={{
                width: "100%", padding: "9px 12px", textAlign: "left",
                background: v === value
                  ? "rgba(201,169,110,0.18)"
                  : "transparent",
                color: v === value
                  ? "rgb(201,169,110)"
                  : "rgb(245,236,220)",
                border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer",
                fontWeight: v === value ? 600 : 400,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (v !== value) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
              }}
              onMouseLeave={(e) => {
                if (v !== value) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {v === value && <span style={{ marginRight: 7, fontSize: 10 }}>✓</span>}
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers de layout ────────────────────────────────────────────────────────

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <span style={{
      display: "block", fontSize: 10, fontWeight: 700,
      letterSpacing: "0.07em", textTransform: "uppercase",
      color: "rgba(245,236,220,0.5)", marginBottom: 5,
    }}>
      {text}{required && <span style={{ color: "var(--gold-light)", marginLeft: 2 }}>*</span>}
    </span>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Label text={label} required={required} />
      {children}
    </div>
  );
}

// Caixa de exibição somente-leitura (glassmorphism)
function ReadonlyBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: 36, padding: "8px 12px", fontSize: 13,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(245,236,220,0.08)",
      borderRadius: 8, color: "rgba(245,236,220,0.55)",
      boxSizing: "border-box",
    }}>
      {children}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function NfeEmissaoClient({
  ambiente, serie, proximoNumero, cMunFG,
}: {
  ambiente: "1" | "2";
  serie: number;
  proximoNumero: number;
  cMunFG: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string; chNFe?: string } | null>(null);

  // Destinatário
  const [destTipo,       setDestTipo]       = useState<"cpf"|"cnpj">("cpf");
  const [destDoc,        setDestDoc]        = useState("");
  const [destNome,       setDestNome]       = useState("");
  const [destEmail,      setDestEmail]      = useState("");
  const [destIE,         setDestIE]         = useState("");
  const [destIndIE,      setDestIndIE]      = useState("9");
  const [destCEP,        setDestCEP]        = useState("");
  const [destLogradouro, setDestLogradouro] = useState("");
  const [destNumero,     setDestNumero]     = useState("");
  const [destCompl,      setDestCompl]      = useState("");
  const [destBairro,     setDestBairro]     = useState("");
  const [destCodMun,     setDestCodMun]     = useState("");
  const [destMun,        setDestMun]        = useState("");
  const [destUF,         setDestUF]         = useState("MG");

  // Emissão
  const [natOp,  setNatOp]  = useState("Venda de mercadoria");
  const [idDest, setIdDest] = useState("1");
  const [infCpl, setInfoCpl] = useState("");

  // Itens
  const [itens, setItens] = useState<Item[]>([{ ...EMPTY_ITEM }]);

  // Pagamentos
  const [pags, setPags] = useState<Pagamento[]>([{ tPag: "17", vPag: "" }]);

  // Totais
  const totalItens = itens.reduce((s, i) =>
    s + (parseFloat(i.qCom) || 0) * (parseFloat(i.vUnCom) || 0), 0);

  function updateItem(idx: number, f: keyof Item, val: string) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, [f]: val } : it));
  }
  function updatePag(idx: number, f: keyof Pagamento, val: string) {
    setPags((prev) => prev.map((p, i) => i === idx ? { ...p, [f]: val } : p));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("itens_json",       JSON.stringify(itens));
    fd.set("pags_json",        JSON.stringify(pags));
    fd.set("dest_tipo",        destTipo);
    fd.set("dest_doc",         destDoc);
    fd.set("dest_nome",        destNome);
    fd.set("dest_email",       destEmail);
    fd.set("dest_ie",          destIE);
    fd.set("dest_ind_ie",      destIndIE);
    fd.set("dest_cep",         destCEP);
    fd.set("dest_logradouro",  destLogradouro);
    fd.set("dest_numero",      destNumero);
    fd.set("dest_compl",       destCompl);
    fd.set("dest_bairro",      destBairro);
    fd.set("dest_cod_mun",     destCodMun);
    fd.set("dest_mun",         destMun);
    fd.set("dest_uf",          destUF);
    fd.set("nat_op",           natOp);
    fd.set("id_dest",          idDest);
    fd.set("inf_cpl",          infCpl);
    fd.set("ambiente",         ambiente);
    fd.set("serie",            String(serie));
    fd.set("c_mun_fg",         cMunFG);
    setResult(null);
    startTransition(async () => {
      const res = await emitirNFeAvulsaAction(fd);
      setResult(res);
      if (res.ok) {
        setItens([{ ...EMPTY_ITEM }]);
        setPags([{ tPag: "17", vPag: "" }]);
        setDestDoc(""); setDestNome(""); setDestEmail("");
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* CSS global para inputs — injeta uma vez no DOM */}
      <style>{GLOBAL_CSS}</style>

      <form ref={formRef} onSubmit={handleSubmit} className="nfe-form" style={{ display:"flex", flexDirection:"column", gap:20 }}>

        {/* ── Banner resultado ── */}
        {result && (
          <div style={{
            borderRadius: 10, border: "1px solid",
            padding: "14px 18px",
            background: result.ok ? "rgba(80,200,100,0.10)" : "rgba(220,60,60,0.10)",
            borderColor: result.ok ? "rgba(80,200,100,0.35)" : "rgba(220,60,60,0.35)",
          }}>
            <strong style={{ color: result.ok ? "#7eefaa" : "#ff8080", fontSize: 14 }}>
              {result.ok ? "✓ NF-e Autorizada!" : "✗ Falha na emissão"}
            </strong>
            <p style={{ marginTop: 4, fontSize: 13, color:"rgba(245,236,220,0.8)" }}>{result.msg}</p>
            {result.chNFe && (
              <p style={{ fontFamily:"monospace", fontSize:11, marginTop:6, opacity:0.7, wordBreak:"break-all" }}>
                Chave: {result.chNFe}
              </p>
            )}
          </div>
        )}

        {/* ── Configuração ── */}
        <Section title="Configuração da emissão">
          <div style={G2}>
            <Field label="Ambiente">
              <ReadonlyBox>{ambiente === "1" ? "🟢 Produção" : "🟡 Homologação (teste)"}</ReadonlyBox>
            </Field>
            <Field label="Número / Série">
              <ReadonlyBox>{proximoNumero} / {serie}</ReadonlyBox>
            </Field>
          </div>
          <div style={G2}>
            <Field label="Natureza da operação" required>
              <input value={natOp} onChange={e=>setNatOp(e.target.value)} required />
            </Field>
            <Field label="Destino da operação">
              <SelectGlass
                value={idDest}
                onChange={setIdDest}
                opts={[["1","Interna (mesmo estado)"],["2","Interestadual"],["3","Exterior"]]}
              />
            </Field>
          </div>
          <Field label="Informações complementares (DANFE)">
            <input value={infCpl} onChange={e=>setInfoCpl(e.target.value)} placeholder="Opcional" />
          </Field>
        </Section>

        {/* ── Destinatário ── */}
        <Section title="Destinatário">
          <div style={G2}>
            <Field label="Tipo de documento">
              <SelectGlass
                value={destTipo}
                onChange={v => setDestTipo(v as "cpf"|"cnpj")}
                opts={[["cpf","CPF — pessoa física"],["cnpj","CNPJ — pessoa jurídica"]]}
              />
            </Field>
            <Field label="CPF / CNPJ" required>
              <input
                value={destDoc} onChange={e=>setDestDoc(e.target.value)}
                placeholder={destTipo==="cpf" ? "000.000.000-00" : "00.000.000/0001-00"}
                required
              />
            </Field>
          </div>
          <div style={G2}>
            <Field label="Nome / Razão Social" required>
              <input value={destNome} onChange={e=>setDestNome(e.target.value)} required />
            </Field>
            <Field label="E-mail">
              <input value={destEmail} onChange={e=>setDestEmail(e.target.value)} type="email" placeholder="opcional" />
            </Field>
          </div>
          <div style={G3}>
            <Field label="Indicador IE">
              <SelectGlass
                value={destIndIE}
                onChange={setDestIndIE}
                opts={[["9","Não contribuinte"],["1","Contribuinte ICMS"],["2","Contribuinte isento"]]}
              />
            </Field>
            <Field label="Inscrição Estadual">
              <input value={destIE} onChange={e=>setDestIE(e.target.value)} placeholder="Vazio se não contribuinte" />
            </Field>
            <Field label="UF">
              <SelectGlass
                value={destUF}
                onChange={setDestUF}
                opts={UFS.map(u=>[u,u])}
              />
            </Field>
          </div>
          <div style={G3}>
            <Field label="CEP" required>
              <input value={destCEP} onChange={e=>setDestCEP(e.target.value)} placeholder="00000-000" required />
            </Field>
            <Field label="Código IBGE Município" required>
              <input value={destCodMun} onChange={e=>setDestCodMun(e.target.value)} placeholder="3106200" required />
            </Field>
            <Field label="Município" required>
              <input value={destMun} onChange={e=>setDestMun(e.target.value)} required />
            </Field>
          </div>
          <div style={G3}>
            <Field label="Logradouro" required>
              <input value={destLogradouro} onChange={e=>setDestLogradouro(e.target.value)} required />
            </Field>
            <Field label="Número" required>
              <input value={destNumero} onChange={e=>setDestNumero(e.target.value)} placeholder="S/N" required />
            </Field>
            <Field label="Complemento">
              <input value={destCompl} onChange={e=>setDestCompl(e.target.value)} placeholder="Apto, sala…" />
            </Field>
          </div>
          <Field label="Bairro" required>
            <input value={destBairro} onChange={e=>setDestBairro(e.target.value)} required />
          </Field>
        </Section>

        {/* ── Itens ── */}
        <Section
          title="Itens da NF-e"
          action={<BtnSec onClick={()=>setItens(p=>[...p,{...EMPTY_ITEM}])}>+ Item</BtnSec>}
        >
          {itens.map((item, idx) => (
            <ItemCard key={idx}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:"rgba(245,236,220,0.55)", letterSpacing:"0.08em" }}>
                  ITEM {idx+1}
                </span>
                {itens.length > 1 && (
                  <BtnDanger onClick={()=>setItens(p=>p.filter((_,i)=>i!==idx))}>Remover</BtnDanger>
                )}
              </div>
              <div style={G2}>
                <Field label="Código (cProd)" required>
                  <input value={item.cProd} onChange={e=>updateItem(idx,"cProd",e.target.value)} placeholder="SKU ou código" required />
                </Field>
                <Field label="GTIN / EAN (opcional)">
                  <input value={item.cEAN} onChange={e=>updateItem(idx,"cEAN",e.target.value)} placeholder="SEM GTIN se não tiver" />
                </Field>
              </div>
              <Field label="Descrição do produto (xProd)" required>
                <input value={item.xProd} onChange={e=>updateItem(idx,"xProd",e.target.value)} required />
              </Field>
              <div style={{ ...G3, marginTop:10 }}>
                <Field label="NCM (8 dígitos)" required>
                  <input value={item.NCM} onChange={e=>updateItem(idx,"NCM",e.target.value)} placeholder="33049900" maxLength={8} required />
                </Field>
                <Field label="CFOP">
                  <input value={item.CFOP} onChange={e=>updateItem(idx,"CFOP",e.target.value)} placeholder="5102" maxLength={5} />
                </Field>
                <Field label="Unidade (uCom)">
                  <input value={item.uCom} onChange={e=>updateItem(idx,"uCom",e.target.value)} placeholder="UN" />
                </Field>
              </div>
              <div style={G3}>
                <Field label="Quantidade" required>
                  <input value={item.qCom} onChange={e=>updateItem(idx,"qCom",e.target.value)} type="number" min="0.0001" step="any" required />
                </Field>
                <Field label="Valor unitário (R$)" required>
                  <input value={item.vUnCom} onChange={e=>updateItem(idx,"vUnCom",e.target.value)} type="number" min="0.01" step="0.01" placeholder="0.00" required />
                </Field>
                <Field label="Total do item">
                  <ReadonlyBox>
                    {((parseFloat(item.qCom)||0)*(parseFloat(item.vUnCom)||0))
                      .toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
                  </ReadonlyBox>
                </Field>
              </div>
            </ItemCard>
          ))}

          <div style={{ textAlign:"right", paddingTop:4 }}>
            <strong style={{ color:"var(--gold-light)", fontSize:14 }}>
              Total: {totalItens.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
            </strong>
          </div>
        </Section>

        {/* ── Pagamentos ── */}
        <Section
          title="Pagamentos"
          action={<BtnSec onClick={()=>setPags(p=>[...p,{tPag:"17",vPag:""}])}>+ Forma</BtnSec>}
        >
          {pags.map((pag, idx) => (
            <ItemCard key={idx} style={{ display:"flex", gap:12, alignItems:"flex-end" }}>
              <div style={{ flex:2 }}>
                <Field label="Forma de pagamento">
                  <SelectGlass
                    value={pag.tPag}
                    onChange={v=>updatePag(idx,"tPag",v)}
                    opts={PAYMENT_TYPES}
                  />
                </Field>
              </div>
              <div style={{ flex:1 }}>
                <Field label="Valor (R$)" required>
                  <input
                    value={pag.vPag} onChange={e=>updatePag(idx,"vPag",e.target.value)}
                    type="number" min="0.01" step="0.01" placeholder="0.00" required
                  />
                </Field>
              </div>
              {pags.length > 1 && (
                <BtnDanger onClick={()=>setPags(p=>p.filter((_,i)=>i!==idx))}>✕</BtnDanger>
              )}
            </ItemCard>
          ))}
        </Section>

        {/* ── Submit ── */}
        <div style={{ textAlign:"center", padding:"16px 0 4px" }}>
          {ambiente !== "1" && (
            <p style={{ fontSize:12, color:"rgba(255,210,100,0.75)", marginBottom:12 }}>
              ⚠️ Modo homologação — NF-e sem valor fiscal, apenas para testes.
            </p>
          )}
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: isPending ? "rgba(201,169,110,0.5)" : "var(--gold-light, #c9a96e)",
              color: "#1a1208", fontWeight:700, fontSize:14,
              letterSpacing:"0.04em", padding:"12px 44px",
              borderRadius:10, border:"none", cursor: isPending ? "wait" : "pointer",
              transition:"opacity 0.15s, background 0.2s",
              outline:"none",
            }}
          >
            {isPending ? "⏳ Transmitindo…" : "📤 Emitir NF-e"}
          </button>
        </div>

      </form>
    </>
  );
}

// ─── Micro-componentes ────────────────────────────────────────────────────────

function Section({ title, children, action }: {
  title: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "18px 20px",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h3 style={{
          margin:0, fontSize:11, fontWeight:700,
          letterSpacing:"0.1em", textTransform:"uppercase",
          color:"var(--gold-light)",
        }}>
          {title}
        </h3>
        {action}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {children}
      </div>
    </section>
  );
}

function ItemCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 10,
      ...style,
    }}>
      {children}
    </div>
  );
}

function BtnSec({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        background:"rgba(255,255,255,0.06)", color:"rgba(245,236,220,0.8)",
        fontSize:11, fontWeight:700, letterSpacing:"0.06em",
        padding:"6px 14px", borderRadius:7,
        border:"1px solid rgba(255,255,255,0.1)",
        cursor:"pointer", outline:"none",
      }}
    >
      {children}
    </button>
  );
}

function BtnDanger({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        background:"rgba(220,60,60,0.12)", color:"rgba(255,130,130,0.9)",
        fontSize:11, fontWeight:700, padding:"5px 10px",
        borderRadius:6, border:"1px solid rgba(220,60,60,0.25)",
        cursor:"pointer", outline:"none", flexShrink:0,
      }}
    >
      {children}
    </button>
  );
}

// ─── Grid helpers ─────────────────────────────────────────────────────────────

const G2: React.CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1fr",     gap:10 };
const G3: React.CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 };
