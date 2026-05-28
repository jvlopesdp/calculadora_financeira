/**
 * Helpers de data de vencimento do tracker. Somam meses a uma data
 * "YYYY-MM-DD" sem passar por `new Date(iso)` (que interpreta como UTC e pode
 * exibir o dia anterior no fuso local). O dia é "clampado" ao último dia do mês
 * alvo (ex.: 31/01 + 1 mês → 28/02), mesma regra de `formatIsoDate`.
 */

function shiftMonths(
  startIso: string,
  monthsToAdd: number,
): { year: number; month: number; day: number } | null {
  const parts = startIso.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  const zeroBased = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = (((zeroBased % 12) + 12) % 12) + 1;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(day, lastDay);
  return { year: targetYear, month: targetMonth, day: targetDay };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Soma `monthsToAdd` a uma data "YYYY-MM-DD" e formata como "DD/MM/YYYY". */
export function dueDateBR(startIso: string, monthsToAdd: number): string {
  const s = shiftMonths(startIso, monthsToAdd);
  if (!s) return startIso;
  return `${pad(s.day)}/${pad(s.month)}/${s.year}`;
}

/** Soma `monthsToAdd` a uma data "YYYY-MM-DD" e mantém a forma ISO. */
export function dueDateIso(startIso: string, monthsToAdd: number): string {
  const s = shiftMonths(startIso, monthsToAdd);
  if (!s) return startIso;
  return `${s.year}-${pad(s.month)}-${pad(s.day)}`;
}
