"use client";

import { useActionState } from "react";
import { upsertFiscalConfig } from "./actions";

interface FiscalConfigFormProps {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  regimeTributario: string;
  ambiente: string;
  serieNfe: number;
  proximoNumeroNfe: number;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
}

type FormState = { error?: string; success?: boolean };

export function FiscalConfigForm(props: FiscalConfigFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(upsertFiscalConfig, {});

  return (
    <form action={formAction} style={{ display: "grid", gap: 14 }}>
      <div style={rowStyle}>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="cnpj">CNPJ</label>
          <input id="cnpj" name="cnpj" type="text" required defaultValue={props.cnpj} style={inputStyle} />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="razao_social">Razão social</label>
          <input id="razao_social" name="razao_social" type="text" required defaultValue={props.razaoSocial} style={inputStyle} />
        </div>
      </div>

      <div style={rowStyle}>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="nome_fantasia">Nome fantasia</label>
          <input id="nome_fantasia" name="nome_fantasia" type="text" defaultValue={props.nomeFantasia} style={inputStyle} />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="regime_tributario">Regime tributário</label>
          <select id="regime_tributario" name="regime_tributario" defaultValue={props.regimeTributario} style={inputStyle}>
            <option value="simples">Simples Nacional</option>
            <option value="presumido">Lucro Presumido</option>
            <option value="real">Lucro Real</option>
          </select>
        </div>
      </div>

      <div style={rowStyle}>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="inscricao_estadual">Inscrição estadual</label>
          <input id="inscricao_estadual" name="inscricao_estadual" type="text" defaultValue={props.inscricaoEstadual} style={inputStyle} />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle} htmlFor="inscricao_municipal">Inscrição municipal</label>
          <input id="inscricao_municipal" name="inscricao_municipal" type="text" defaultValue={props.inscricaoMunicipal} style={inputStyle} />
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f2ecdf", paddingTop: 12, marginTop: 4 }}>
        <div style={sectionLabel}>Endereço do emitente</div>
        <div style={rowStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="endereco_cep">CEP</label>
            <input id="endereco_cep" name="endereco_cep" type="text" defaultValue={props.endereco.cep} style={inputStyle} />
          </div>
          <div style={{ ...fieldGroup, flex: 2 }}>
            <label style={labelStyle} htmlFor="endereco_logradouro">Logradouro</label>
            <input id="endereco_logradouro" name="endereco_logradouro" type="text" defaultValue={props.endereco.logradouro} style={inputStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="endereco_numero">Número</label>
            <input id="endereco_numero" name="endereco_numero" type="text" defaultValue={props.endereco.numero} style={inputStyle} />
          </div>
        </div>
        <div style={rowStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="endereco_complemento">Complemento</label>
            <input id="endereco_complemento" name="endereco_complemento" type="text" defaultValue={props.endereco.complemento} style={inputStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="endereco_bairro">Bairro</label>
            <input id="endereco_bairro" name="endereco_bairro" type="text" defaultValue={props.endereco.bairro} style={inputStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="endereco_cidade">Cidade</label>
            <input id="endereco_cidade" name="endereco_cidade" type="text" defaultValue={props.endereco.cidade} style={inputStyle} />
          </div>
          <div style={{ ...fieldGroup, maxWidth: 80 }}>
            <label style={labelStyle} htmlFor="endereco_uf">UF</label>
            <input id="endereco_uf" name="endereco_uf" type="text" maxLength={2} defaultValue={props.endereco.uf} style={inputStyle} />
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f2ecdf", paddingTop: 12, marginTop: 4 }}>
        <div style={sectionLabel}>Emissão de NF-e (sistema próprio)</div>
        <div style={rowStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="ambiente">Ambiente</label>
            <select id="ambiente" name="ambiente" defaultValue={props.ambiente} style={inputStyle}>
              <option value="homologacao">Homologação (testes)</option>
              <option value="producao">Produção</option>
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="serie_nfe">Série</label>
            <input id="serie_nfe" name="serie_nfe" type="number" min={1} defaultValue={props.serieNfe} style={inputStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle} htmlFor="proximo_numero_nfe">Próximo número</label>
            <input id="proximo_numero_nfe" name="proximo_numero_nfe" type="number" min={1} defaultValue={props.proximoNumeroNfe} style={inputStyle} />
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#6b6354", margin: "8px 0 0" }}>
          O certificado digital (A1/A3) e a integração com o webservice da SEFAZ ainda precisam ser
          configurados em uma etapa futura para emissão real. Estes campos preparam a numeração e o
          ambiente para quando isso estiver pronto.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" disabled={pending} style={buttonStyle}>
          {pending ? "Salvando..." : "Salvar dados fiscais"}
        </button>
        {state.success && <span style={{ color: "#2f6b4a", fontSize: 13, fontWeight: 600 }}>Salvo com sucesso.</span>}
        {state.error && <span style={{ color: "#9a3232", fontSize: 13, fontWeight: 600 }}>{state.error}</span>}
      </div>
    </form>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const fieldGroup: React.CSSProperties = {
  display: "grid",
  gap: 4,
  flex: 1,
  minWidth: 140,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6b6354",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #e6ddc9",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  color: "#28251d",
  background: "#fcfaf5",
  width: "100%",
};

const buttonStyle: React.CSSProperties = {
  background: "#28251d",
  color: "#fdfbf6",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
