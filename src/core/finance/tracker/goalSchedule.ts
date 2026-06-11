import Decimal from "decimal.js";

import { roundMoney } from "../financial-types";
import { calculatePriceInstallment } from "../price-calculator";
import type { ScheduleMonth, TrackerPlanInput } from "./normalSchedule";

export interface GoalResult {
  months: ScheduleMonth[];
  /** Month the balance reached zero (always the last row); null if never. */
  paidOffAtMonth: number | null;
  /** First month where the target was below the scheduled installment; null if always valid. */
  invalidAtMonth: number | null;
}

const ZERO = new Decimal(0);
const PAYOFF_TOLERANCE = new Decimal("0.01");

/**
 * Cronograma "Meta": o usuário paga sempre o mesmo valor TOTAL por mês
 * (`targetMonthlyTotal` = parcela + extra). O excedente sobre a parcela vigente
 * vira amortização extra, sempre reduzindo o prazo. Não depende de lançamentos —
 * pode ser chamado já na criação do plano.
 *
 * Se em algum mês `targetMonthlyTotal < parcela vigente`, o plano é inviável:
 * retorna `invalidAtMonth = N` e para (não inventa pagamento parcial). A parcela
 * vigente é a do cronograma sem antecipação: PRICE é fixa (constante porque só
 * reduzimos prazo); SAC é amortização base + juros do mês (cai conforme o saldo).
 * Como ambas são não-crescentes, a inviabilidade, quando existe, ocorre no mês 1.
 *
 * Espera valores já convertidos: `principal`/`targetMonthlyTotal` em BRL e
 * `monthlyRate` como fração — a conversão cents→BRL e bp→fração é do caller.
 */
export function goalSchedule(
  plan: TrackerPlanInput,
  targetMonthlyTotal: Decimal,
): GoalResult {
  const { principal, monthlyRate, termMonths, modality } = plan;
  if (termMonths <= 0) {
    return { months: [], paidOffAtMonth: null, invalidAtMonth: null };
  }

  const isSac = modality === "SAC";
  const months: ScheduleMonth[] = [];
  let balance = roundMoney(principal);
  let paidOffAtMonth: number | null = null;

  const priceInstallment = isSac
    ? ZERO
    : roundMoney(calculatePriceInstallment({ principal: balance, monthlyRate, termMonths }));
  const sacBaseAmortization = isSac ? roundMoney(balance.div(termMonths)) : ZERO;

  const target = roundMoney(targetMonthlyTotal);

  for (let month = 1; month <= termMonths && balance.greaterThan(ZERO); month++) {
    const interest = roundMoney(balance.times(monthlyRate));
    const scheduledInstallment = isSac
      ? roundMoney(sacBaseAmortization.plus(interest))
      : priceInstallment;

    if (target.lessThan(scheduledInstallment)) {
      return { months, paidOffAtMonth: null, invalidAtMonth: month };
    }

    const owed = balance.plus(interest);
    const isFinalMonth =
      month === termMonths ||
      target.greaterThanOrEqualTo(owed) ||
      owed.minus(target).lessThanOrEqualTo(PAYOFF_TOLERANCE);

    if (isFinalMonth) {
      months.push({
        monthIndex: month,
        installment: owed,
        scheduledInstallment,
        interest,
        amortization: balance,
        balance: ZERO,
      });
      paidOffAtMonth = month;
      break;
    }

    const amortization = target.minus(interest);
    balance = roundMoney(balance.minus(amortization));
    months.push({
      monthIndex: month,
      installment: target,
      scheduledInstallment,
      interest,
      amortization,
      balance,
    });
  }

  return { months, paidOffAtMonth, invalidAtMonth: null };
}
