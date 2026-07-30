import { getUfCode } from "./nfe-endpoints";

/**
 * Gera a chave de acesso NF-e (44 dígitos) conforme especificação SEFAZ.
 *
 * Formato: cUF(2) | AAAAMM(6) | CNPJ(14) | mod(2) | serie(3) | nNF(9) | tpEmis(1) | cNF(8) | cDV(1)
 */

function mod11(digits: string): number {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
    sum += parseInt(digits[i], 10) * weights[w % 8];
  }
  const rem = sum % 11;
  return rem === 0 || rem === 1 ? 1 : 11 - rem;
}

/** Gera um cNF (código numérico) aleatório de 8 dígitos */
function randomCNF(): string {
  const n = Math.floor(10000000 + Math.random() * 89999999);
  return String(n);
}

export interface NFeAccessKey {
  chNFe: string; // chave completa 44 dígitos
  cNF: string;   // código numérico 8 dígitos
  cDV: number;   // dígito verificador
}

export function generateAccessKey(params: {
  uf: string;
  aaaamm: string; // "AAAAMM" ex: "202407"
  cnpj: string;
  serie: number;
  nNF: number;
  tpEmis?: string; // "1" = emissão normal
  cNF?: string;    // se omitido, gera aleatório
}): NFeAccessKey {
  const cUF    = getUfCode(params.uf);
  const cnpj   = params.cnpj.replace(/\D/g, "").padStart(14, "0");
  const mod    = "55";
  const serie  = String(params.serie).padStart(3, "0");
  const nNF    = String(params.nNF).padStart(9, "0");
  const tpEmis = params.tpEmis ?? "1";
  const cNF    = params.cNF ?? randomCNF();

  const base = `${cUF}${params.aaaamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
  const cDV  = mod11(base);

  return { chNFe: `${base}${cDV}`, cNF, cDV };
}
