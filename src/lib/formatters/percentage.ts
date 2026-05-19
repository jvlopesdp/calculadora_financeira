import Decimal from "decimal.js";

const NBSP_PATTERN = new RegExp("[\\u00A0\\u202F]", "g");

export function formatPercentage(
  value: Decimal | number,
  decimals = 2,
): string {
  const num = value instanceof Decimal ? value.toNumber() : value;
  const formatter = new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return formatter.format(num / 100).replace(NBSP_PATTERN, " ");
}

export function parsePercentage(input: string): Decimal {
  const cleaned = input
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return new Decimal(cleaned);
}
