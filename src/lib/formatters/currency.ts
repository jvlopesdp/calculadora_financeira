import Decimal from "decimal.js";

const NBSP_PATTERN = new RegExp("[\\u00A0\\u202F]", "g");

const formatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: Decimal | number): string {
  const num = value instanceof Decimal ? value.toNumber() : value;
  return formatter.format(num).replace(NBSP_PATTERN, " ");
}

export function parseBRL(input: string): number | null {
  const trimmed = input.replace(NBSP_PATTERN, " ").trim();
  if (trimmed === "") return null;
  const cleaned = trimmed
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}
