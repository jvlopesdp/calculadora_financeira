import Decimal from "decimal.js";

import { roundMoney } from "../financial-types";
import { calculatePriceInstallment } from "../price-calculator";
import type { ScheduleMonth, TrackerPlanInput } from "./normalSchedule";

export type ApplyMode = "reduce_term" | "reduce_installment";

export interface RealizedEntry {
  /** Amount actually paid in BRL (caller converts cents→BRL). */
  paidAmount: Decimal;
  applyMode: ApplyMode;
}

export interface RealizedResult {
  months: ScheduleMonth[];
  /** Month the balance reached zero (always the last row); null if never. */
  paidOffAtMonth: number | null;
}

const ZERO = new Decimal(0);
const PAYOFF_TOLERANCE = new Decimal("0.01");

/**
 * Cronograma "Realizado": aplica os lançamentos manuais mês a mês sobre o plano.
 *
 * Pré-condição (imposta pela API, assumida aqui): cada entry tem
 * `paidAmount >= parcela vigente do mês`. O excedente sobre a parcela vira
 * amortização extra. `apply_mode='reduce_term'` mantém a parcela e encurta o
 * prazo; `apply_mode='reduce_installment'` mantém o prazo e recalcula (reduz) as
 * parcelas seguintes. Meses sem entry pagam a parcela vigente (já ajustada por
 * reduções anteriores). Quando o saldo zera (tolerância 1 centavo) trunca em N.
 *
 * Não reaproveita `applyPrepayment*` porque aquelas helpers assumem um extra
 * constante e um único modo — aqui o valor e o modo variam por lançamento.
 * Reusa as primitivas de baixo nível (`calculatePriceInstallment`, `roundMoney`).
 */
export function realizedSchedule(
  plan: TrackerPlanInput,
  entriesByMonth: Map<number, RealizedEntry>,
): RealizedResult {
  const { principal, monthlyRate, termMonths, modality } = plan;
  if (termMonths <= 0) {
    return { months: [], paidOffAtMonth: null };
  }

  const isSac = modality === "SAC";
  const months: ScheduleMonth[] = [];
  let balance = roundMoney(principal);
  let remainingTerm = termMonths;
  let paidOffAtMonth: number | null = null;

  // Parcela vigente (sticky até um lançamento reduce_installment recalcular).
  let currentInstallment = isSac
    ? ZERO
    : roundMoney(calculatePriceInstallment({ principal: balance, monthlyRate, termMonths }));
  let currentAmortization = isSac ? roundMoney(balance.div(termMonths)) : ZERO;

  for (let month = 1; month <= termMonths && balance.greaterThan(ZERO); month++) {
    const interest = roundMoney(balance.times(monthlyRate));
    const scheduledInstallment = isSac
      ? roundMoney(currentAmortization.plus(interest))
      : currentInstallment;

    const entry = entriesByMonth.get(month);
    const payment = entry ? roundMoney(entry.paidAmount) : scheduledInstallment;
    const owed = balance.plus(interest);

    const isFinalMonth =
      remainingTerm <= 1 ||
      month === termMonths ||
      payment.greaterThanOrEqualTo(owed) ||
      owed.minus(payment).lessThanOrEqualTo(PAYOFF_TOLERANCE);

    if (isFinalMonth) {
      months.push({
        monthIndex: month,
        installment: owed,
        interest,
        amortization: balance,
        balance: ZERO,
      });
      paidOffAtMonth = month;
      break;
    }

    const amortization = payment.minus(interest);
    balance = roundMoney(balance.minus(amortization));
    months.push({
      monthIndex: month,
      installment: payment,
      interest,
      amortization,
      balance,
    });

    remainingTerm -= 1;
    if (entry?.applyMode === "reduce_installment" && remainingTerm > 0) {
      if (isSac) {
        currentAmortization = roundMoney(balance.div(remainingTerm));
      } else {
        currentInstallment = roundMoney(
          calculatePriceInstallment({
            principal: balance,
            monthlyRate,
            termMonths: remainingTerm,
          }),
        );
      }
    }
  }

  return { months, paidOffAtMonth };
}
