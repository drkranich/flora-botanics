/** Utilitários de formatação — usáveis em Server e Client Components. */

export const BRASILIA_TIME_ZONE = "America/Sao_Paulo";

function parseDateInput(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function money(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

export function formatDateBR(value: string | Date | null | undefined) {
  const date = parseDateInput(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: BRASILIA_TIME_ZONE,
  }).format(date);
}

export function formatDateTimeBR(value: string | Date | null | undefined) {
  const date = parseDateInput(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: BRASILIA_TIME_ZONE,
  }).format(date);
}

export function formatDateTimeMediumBR(value: string | Date | null | undefined) {
  const date = parseDateInput(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: BRASILIA_TIME_ZONE,
  }).format(date);
}
