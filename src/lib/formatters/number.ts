const integerFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatMonths(months: number): string {
  if (months < 12) {
    return months === 1 ? "1 mês" : `${months} meses`;
  }
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const yearsLabel = years === 1 ? "ano" : "anos";
  const monthsLabel = remainingMonths === 1 ? "mês" : "meses";
  return `${years} ${yearsLabel} e ${remainingMonths} ${monthsLabel}`;
}
