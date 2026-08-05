"use client";

/**
 * NfeEmissaoClient — formulário de emissão avulsa de NF-e
 *
 * Permite emitir uma NF-e sem precisar de pedido vinculado.
 * Estrutura: Destinatário → Itens → Pagamento → Emitir.
 */

import { useRef, useState, useTransition } from "react";
import { emitirNFeAvulsaAction } from "./emitir-action";

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type Item = {
  cProd: string;
  xProd: string;
  NCM: string;
  CFOP: string;
  uCom: string;
  qCom: string;
  vUnCom: string;
  cEAN: string;
};

type Pagamento = { tPag: string; vPag: string };

const EMPTY_ITEM: Item = {
  cProd: "", xProd: "", NCM: "33049900", CFOP: "5102",
  uCom: "UN", qCom: "1", vUnCom: "", cEAN: "",
};

const PAYMENT_TYPES: [string, string][] = [
  ["01", "Dinheiro"], ["02", "Cheque"], ["03", "Cartão de Crédito"],
  ["04", "Cartão de Débito"], ["15", "Boleto"], ["17", "PIX"], ["99", "Outros"],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function field(label: string, children: React.ReactNode, required = false) {
  return (
    <label style={styles.fieldLabel}>
      <span style={styles.fieldText}>
        {label}
        {required && <span style={{ color: "var(--gold-light)" }}> *</span>}
      </span>
      {children}
    </label>
  );
}

function inp(
  props: React.InputHTMLAttributes<HTMLInputElement> & { onChange: (v: string) => void; value: string }
) {
  const { onChange, ...rest } = props;
  return (
    <input
      {...rest}
      className="glass"
      style={styles.input}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function sel(
  value: string,
  onChange: (v: string) => void,
  opts: [string, string][],
  name?: string
) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="glass"
      style={styles.input}
    >
      {opts.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function NfeEmissaoClient({
  ambiente,
  serie,
  proximoNumero,
  cMunFG,
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
  const [destTipo, setDestTipo] = useState<"cpf" | "cnpj">("cpf");
  const [destDoc, setDestDoc] = useState("");
  const [destNome, setDestNome] = useState("");
  const [destEmail, setDestEmail] = useState("");
  const [destIE, setDestIE] = useState("");
  const [destIndIE, setDestIndIE] = useState("9");

  // Endereço destinatário
  const [destCEP, setDestCEP] = useState("");
  const [destLogradouro, setDestLogradouro] = useState("");
  const [destNumero, setDestNumero] = useState("");
  const [destCompl, setDestCompl] = useState("");
  const [destBairro, setDestBairro] = useState("");
  const [destCodMun, setDestCodMun] = useState("");
  const [destMun, setDestMun] = useState("");
  const [destUF, setDestUF] = useState("MG");

  // Itens
  const [itens, setItens] = useState<Item[]>([{ ...EMPTY_ITEM }]);

  // Pagamentos
  const [pags, setPags] = useState<Pagamento[]>([{ tPag: "17", vPag: "" }]);

  // Dados adicionais
  const [infCpl, setInfoCpl] = useState("");
  const [natOp, setNatOp] = useState("Venda de mercadoria");
  const [idDest, setIdDest] = useState("1");

  // Totais
  const totalItens = itens.reduce((s, i) => {
    const q = parseFloat(i.qCom) || 0;
    const v = parseFloat(i.vUnCom) || 0;
    return s + q * v;
  }, 0);

  function updateItem(idx: number, field: keyof Item, val: string) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  function addItem() { setItens((prev) => [...prev, { ...EMPTY_ITEM }]); }
  function removeItem(idx: number) { setItens((prev) => prev.filter((_, i) => i !== idx)); }

  function updatePag(idx: number, field: keyof Pagamento, val: string) {
    setPags((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  }
  function addPag() { setPags((prev) => [...prev, { tPag: "17", vPag: "" }]); }
  function removePag(idx: number) { setPags((prev) => prev.filter((_, i) => i !== idx)); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;

    const fd = new FormData(formRef.current);

    // Injeta itens e pagamentos como JSON (FormData não suporta arrays complexos)
    fd.set("itens_json", JSON.stringify(itens));
    fd.set("pags_json", JSON.stringify(pags));
    fd.set("dest_tipo", destTipo);
    fd.set("dest_doc", destDoc);
    fd.set("dest_nome", destNome);
    fd.set("dest_email", destEmail);
    fd.set("dest_ie", destIE);
    fd.set("dest_ind_ie", destIndIE);
    fd.set("dest_cep", destCEP);
    fd.set("dest_logradouro", destLogradouro);
    fd.set("dest_numero", destNumero);
    fd.set("dest_compl", destCompl);
    fd.set("dest_bairro", destBairro);
    fd.set("dest_cod_mun", destCodMun);
    fd.set("dest_mun", destMun);
    fd.set("dest_uf", destUF);
    fd.set("nat_op", natOp);
    fd.set("id_dest", idDest);
    fd.set("inf_cpl", infCpl);
    fd.set("ambiente", ambiente);
    fd.set("serie", String(serie));
    fd.set("c_mun_fg", cMunFG);

    setResult(null);
    startTransition(async () => {
      const res = await emitirNFeAvulsaAction(fd);
      setResult(res);
      if (res.ok) {
        // Limpa o formulário de itens/pagamentos ao autorizar
        setItens([{ ...EMPTY_ITEM }]);
        setPags([{ tPag: "17", vPag: "" }]);
        setDestDoc(""); setDestNome(""); setDestEmail("");
      }
    });
  }

  const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
    "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

  return (
    <form ref={formRef} onSubmit={handleSubmit} style={styles.form}>

      {/* ── Resultado ── */}
      {result && (
        <div style={{
          ...styles.resultBanner,
          background: result.ok ? "rgba(80,200,100,0.12)" : "rgba(220,60,60,0.13)",
          borderColor: result.ok ? "rgba(80,200,100,0.4)" : "rgba(220,60,60,0.4)",
        }}>
          <strong style={{ color: result.ok ? "#7eefaa" : "#ff8080" }}>
            {result.ok ? "✓ NF-e Autorizada!" : "✗ Falha na emissão"}
          </strong>
          <p style={{ marginTop: 4, fontSize: 13 }}>{result.msg}</p>
          {result.chNFe && (
            <p style={{ fontFamily: "monospace", fontSize: 11, marginTop: 6, opacity: 0.8, wordBreak: "break-all" }}>
              Chave: {result.chNFe}
            </p>
          )}
        </div>
      )}

      {/* ── Info da emissão ── */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Configuração da emissão</h3>
        <div style={styles.grid2}>
          <div style={styles.fieldLabel}>
            <span style={styles.fieldText}>Ambiente</span>
            <div className="glass" style={{ ...styles.input, opacity: 0.7 }}>
              {ambiente === "1" ? "🟢 Produção" : "🟡 Homologação (teste)"}
            </div>
          </div>
          <div style={styles.fieldLabel}>
            <span style={styles.fieldText}>Número / Série</span>
            <div className="glass" style={{ ...styles.input, opacity: 0.7 }}>
              {proximoNumero} / {serie}
            </div>
          </div>
        </div>
        {field("Natureza da operação", inp({ value: natOp, onChange: setNatOp, required: true }), true)}
        <div style={styles.grid2}>
          {field("Destino", sel(idDest, setIdDest, [["1","Interna (mesmo estado)"],["2","Interestadual"],["3","Exterior"]]))}
          {field("Inf. complementares", inp({ value: infCpl, onChange: setInfoCpl, placeholder: "Opcional — aparece no DANFE" }))}
        </div>
      </section>

      {/* ── Destinatário ── */}
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Destinatário</h3>
        <div style={styles.grid2}>
          {field("Tipo de documento",
            sel(destTipo, (v) => setDestTipo(v as "cpf" | "cnpj"), [["cpf","CPF (pessoa física)"],["cnpj","CNPJ (pessoa jurídica)"]])
          )}
          {field("CPF / CNPJ", inp({ value: destDoc, onChange: setDestDoc, placeholder: destTipo === "cpf" ? "000.000.000-00" : "00.000.000/0001-00", required: true }), true)}
        </div>
        <div style={styles.grid2}>
          {field("Nome / Razão Social", inp({ value: destNome, onChange: setDestNome, required: true }), true)}
          {field("E-mail", inp({ value: destEmail, onChange: setDestEmail, type: "email", placeholder: "opcional" }))}
        </div>
        <div style={styles.grid3}>
          {field("Indicador IE", sel(destIndIE, setDestIndIE, [
            ["1","Contribuinte ICMS"],["2","Contribuinte isento"],["9","Não contribuinte"]
          ]))}
          {field("Inscrição Estadual", inp({ value: destIE, onChange: setDestIE, placeholder: "Deixar vazio se indIE = 9" }))}
          {field("UF", sel(destUF, setDestUF, UFS.map(u => [u, u])))}
        </div>
        <div style={styles.grid3}>
          {field("CEP", inp({ value: destCEP, onChange: setDestCEP, placeholder: "00000-000", required: true }), true)}
          {field("Código IBGE Município", inp({ value: destCodMun, onChange: setDestCodMun, placeholder: "3106200", required: true }), true)}
          {field("Município", inp({ value: destMun, onChange: setDestMun, required: true }), true)}
        </div>
        <div style={styles.grid3}>
          {field("Logradouro", inp({ value: destLogradouro, onChange: setDestLogradouro, required: true }), true)}
          {field("Número", inp({ value: destNumero, onChange: setDestNumero, placeholder: "S/N", required: true }), true)}
          {field("Complemento", inp({ value: destCompl, onChange: setDestCompl, placeholder: "Apto, sala…" }))}
        </div>
        {field("Bairro", inp({ value: destBairro, onChange: setDestBairro, required: true }), true)}
      </section>

      {/* ── Itens ── */}
      <section style={styles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Itens da NF-e</h3>
          <button type="button" onClick={addItem} style={styles.btnSecondary}>+ Adicionar item</button>
        </div>

        {itens.map((item, idx) => (
          <div key={idx} style={styles.itemCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ color: "var(--cream)", fontSize: 13 }}>Item {idx + 1}</strong>
              {itens.length > 1 && (
                <button type="button" onClick={() => removeItem(idx)} style={styles.btnDanger}>Remover</button>
              )}
            </div>
            <div style={styles.grid2}>
              {field("Código interno (cProd)", inp({ value: item.cProd, onChange: (v) => updateItem(idx, "cProd", v), required: true, placeholder: "SKU ou código" }))}
              {field("GTIN / EAN (opcional)", inp({ value: item.cEAN, onChange: (v) => updateItem(idx, "cEAN", v), placeholder: "SEM GTIN se não tiver" }))}
            </div>
            {field("Descrição do produto (xProd)", inp({ value: item.xProd, onChange: (v) => updateItem(idx, "xProd", v), required: true }), true)}
            <div style={styles.grid4}>
              {field("NCM", inp({ value: item.NCM, onChange: (v) => updateItem(idx, "NCM", v), placeholder: "33049900", maxLength: 8 }), true)}
              {field("CFOP", inp({ value: item.CFOP, onChange: (v) => updateItem(idx, "CFOP", v), placeholder: "5102", maxLength: 5 }))}
              {field("UN (uCom)", inp({ value: item.uCom, onChange: (v) => updateItem(idx, "uCom", v), placeholder: "UN" }))}
              <div />
            </div>
            <div style={styles.grid3}>
              {field("Qtd (qCom)", inp({ value: item.qCom, onChange: (v) => updateItem(idx, "qCom", v), type: "number", min: "0.0001", step: "any", required: true }), true)}
              {field("Valor unitário", inp({ value: item.vUnCom, onChange: (v) => updateItem(idx, "vUnCom", v), type: "number", min: "0.01", step: "0.01", required: true, placeholder: "0.00" }), true)}
              <div style={styles.fieldLabel}>
                <span style={styles.fieldText}>Total do item</span>
                <div className="glass" style={{ ...styles.input, opacity: 0.7 }}>
                  {((parseFloat(item.qCom) || 0) * (parseFloat(item.vUnCom) || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div style={{ textAlign: "right", marginTop: 8 }}>
          <strong style={{ color: "var(--gold-light)", fontSize: 15 }}>
            Total produtos: {totalItens.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </strong>
        </div>
      </section>

      {/* ── Pagamentos ── */}
      <section style={styles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Pagamentos</h3>
          <button type="button" onClick={addPag} style={styles.btnSecondary}>+ Forma de pagamento</button>
        </div>

        {pags.map((pag, idx) => (
          <div key={idx} style={{ ...styles.itemCard, display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 2 }}>
              {field("Forma de pagamento", sel(pag.tPag, (v) => updatePag(idx, "tPag", v), PAYMENT_TYPES))}
            </div>
            <div style={{ flex: 1 }}>
              {field("Valor (R$)", inp({ value: pag.vPag, onChange: (v) => updatePag(idx, "vPag", v), type: "number", min: "0.01", step: "0.01", required: true, placeholder: "0.00" }))}
            </div>
            {pags.length > 1 && (
              <button type="button" onClick={() => removePag(idx)} style={{ ...styles.btnDanger, marginBottom: 2 }}>✕</button>
            )}
          </div>
        ))}
      </section>

      {/* ── Botão Emitir ── */}
      <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
        {ambiente !== "1" && (
          <p style={{ fontSize: 12, color: "rgba(255,220,120,0.8)", marginBottom: 12 }}>
            ⚠️ Modo homologação — NF-e sem valor fiscal, apenas para testes.
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          style={{ ...styles.btnPrimary, opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? "⏳ Transmitindo ao SEFAZ…" : "📤 Emitir NF-e"}
        </button>
      </div>
    </form>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = {
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  },
  section: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "20px 22px",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--gold-light)",
    marginBottom: 14,
    marginTop: 0,
  },
  fieldLabel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 5,
  },
  fieldText: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "var(--cream-dim, rgba(245,236,220,0.65))",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    fontSize: 13,
    color: "var(--cream)",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    boxSizing: "border-box" as const,
    minHeight: 36,
    outline: "none",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 12,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    marginBottom: 12,
  },
  grid4: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 12,
    marginBottom: 12,
  },
  itemCard: {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: "14px 16px",
    marginBottom: 10,
  },
  resultBanner: {
    borderRadius: 10,
    border: "1px solid",
    padding: "14px 18px",
  },
  btnPrimary: {
    background: "var(--gold-light, #c9a96e)",
    color: "#1a1208",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "0.04em",
    padding: "12px 40px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.07)",
    color: "var(--cream)",
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: "pointer",
  },
  btnDanger: {
    background: "rgba(220,60,60,0.15)",
    color: "#ff8080",
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid rgba(220,60,60,0.3)",
    cursor: "pointer",
  },
} as const;
