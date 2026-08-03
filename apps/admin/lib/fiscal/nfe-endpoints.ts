/**
 * Endpoints SEFAZ por UF para NF-e 4.00 (NFeAutorizacao4)
 * Atualizado conforme NT 2022.001.a
 */

// Códigos IBGE de estado (cUF na chave de acesso)
export const UF_CODE: Record<string, string> = {
  AC: "12", AL: "27", AM: "13", AP: "16", BA: "29",
  CE: "23", DF: "53", ES: "32", GO: "52", MA: "21",
  MG: "31", MS: "50", MT: "51", PA: "15", PB: "25",
  PE: "26", PI: "22", PR: "41", RJ: "33", RN: "24",
  RO: "11", RR: "14", RS: "43", SC: "42", SE: "28",
  SP: "35", TO: "17",
};

// Ambiente de homologação unificado — SEFAZ Nacional (nfe.fazenda.gov.br)
// Todos os estados usam este endpoint para testes. É o único com DNS
// globalmente resolvível a partir do Supabase Edge Functions (Deno/Fly.io).
// Os endpoints estaduais de homologação (svrs, hnfe, etc.) têm DNS restrito
// e não são acessíveis de fora do Brasil / provedores internacionais.
const HOM_URL = "https://hom.nfe.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx";

const ENDPOINTS: Record<string, { prod: string; hom: string }> = {
  AM: {
    prod: "https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4",
    hom:  HOM_URL,
  },
  BA: {
    prod: "https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx",
    hom:  HOM_URL,
  },
  CE: {
    prod: "https://nfe.sefaz.ce.gov.br/nfe4/services/NFeAutorizacao4",
    hom:  HOM_URL,
  },
  GO: {
    prod: "https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4",
    hom:  HOM_URL,
  },
  MG: {
    prod: "https://nfe.fazenda.mg.gov.br/nfe/services/NFeAutorizacao4",
    hom:  HOM_URL,
  },
  MS: {
    prod: "https://nfe.fazenda.ms.gov.br/ws/NFeAutorizacao4.asmx",
    hom:  HOM_URL,
  },
  MT: {
    prod: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4",
    hom:  HOM_URL,
  },
  PE: {
    prod: "https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4",
    hom:  HOM_URL,
  },
  PR: {
    prod: "https://nfe.fazenda.pr.gov.br/nfe/services/NFeAutorizacao4",
    hom:  HOM_URL,
  },
  RS: {
    prod: "https://nfe.sefaz.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
    hom:  HOM_URL,
  },
  SP: {
    prod: "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
    hom:  HOM_URL,
  },
  // Fallback para demais estados
  _SVRS: {
    prod: "https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
    hom:  HOM_URL,
  },
};

/** Retorna a URL do webservice SEFAZ para a UF e ambiente informados */
export function getSefazEndpoint(uf: string, ambiente: "1" | "2"): string {
  const key = uf.toUpperCase();
  const entry = ENDPOINTS[key] ?? ENDPOINTS._SVRS;
  return ambiente === "2" ? entry.hom : entry.prod;
}

/** Retorna o código IBGE (cUF) para uma UF */
export function getUfCode(uf: string): string {
  return UF_CODE[uf.toUpperCase()] ?? "35";
}
