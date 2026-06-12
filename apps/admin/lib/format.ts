/** Utilitários de formatação — usáveis em Server e Client Components. */

export function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}
