import { useMemo, useState } from "react";

import { CurrencyInput } from "@/components/finance/currency-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildSimulation,
  type SimulationStrategy,
} from "@/features/historico/lib/build-simulation";
import { formatBRL } from "@/lib/formatters/currency";
import { cn } from "@/lib/utils";
import type { PaymentApi, ScenarioApi } from "@/lib/api-client";

export interface SimulateApplyValues {
  amountPaid: number;
  amortizationStrategy: SimulationStrategy;
  referenceMonth: string;
}

export interface SimulateNextPaymentCardProps {
  scenario: ScenarioApi;
  payments: PaymentApi[];
  onApply: (values: SimulateApplyValues) => void;
}

const STRATEGY_LABELS: Record<SimulationStrategy, string> = {
  prazo: "Reduzir prazo",
  parcela: "Reduzir parcela",
};

function deltaClass(trend: "up" | "down" | "neutral"): string {
  if (trend === "up") return "text-emerald-600 dark:text-emerald-500";
  if (trend === "down") return "text-destructive";
  return "text-muted-foreground";
}

function formatMonths(months: number): string {
  const abs = Math.abs(months);
  const sign = months > 0 ? "+" : months < 0 ? "−" : "";
  const word = abs === 1 ? "mês" : "meses";
  return `${sign}${abs} ${word}`;
}

export function SimulateNextPaymentCard({
  scenario,
  payments,
  onApply,
}: SimulateNextPaymentCardProps) {
  const [amount, setAmount] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<SimulationStrategy>("prazo");

  const result = useMemo(
    () =>
      buildSimulation({
        scenario,
        payments,
        amountBRL: amount ?? 0,
        strategy,
      }),
    [scenario, payments, amount, strategy],
  );

  const hasAmount = amount !== null && amount > 0;

  return (
    <Card data-testid="simulate-next-payment-card">
      <CardHeader>
        <CardTitle id="simulate-next-payment-title">
          Simular próximo pagamento
        </CardTitle>
        <CardDescription>
          Veja o efeito de um pagamento hipotético antes de registrá-lo. A
          simulação não é salva.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          aria-labelledby="simulate-next-payment-title"
        >
          <div className="space-y-1.5">
            <Label htmlFor="simulate-amount">Valor hipotético</Label>
            <CurrencyInput
              id="simulate-amount"
              value={amount}
              onChange={(v) => setAmount(v)}
            />
            {result ? (
              <p
                className="text-muted-foreground text-xs"
                data-testid="simulate-base-installment"
              >
                Parcela padrão deste mês:{" "}
                {formatBRL(result.baseInstallment)} (
                {result.referenceMonth})
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Informe um valor para simular.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="simulate-strategy">Estratégia</Label>
            <Select
              value={strategy}
              onValueChange={(value) =>
                setStrategy(value as SimulationStrategy)
              }
            >
              <SelectTrigger id="simulate-strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STRATEGY_LABELS) as SimulationStrategy[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {STRATEGY_LABELS[s]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {result ? (
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            data-testid="simulate-results"
          >
            <ResultTile
              label="Novo saldo"
              value={formatBRL(result.hypothetical.currentBalance)}
              delta={
                result.deltaBalance.isZero()
                  ? "Igual à parcela padrão"
                  : `${result.deltaBalance.lessThan(0) ? "−" : "+"}${formatBRL(result.deltaBalance.abs())} vs parcela padrão`
              }
              trend={
                result.deltaBalance.lessThan(0)
                  ? "up"
                  : result.deltaBalance.greaterThan(0)
                    ? "down"
                    : "neutral"
              }
              testId="simulate-result-balance"
            />
            <ResultTile
              label="Parcelas restantes"
              value={result.hypothetical.remainingMonths.toString()}
              delta={
                result.deltaRemainingMonths === 0
                  ? "Igual à parcela padrão"
                  : `${formatMonths(result.deltaRemainingMonths)} vs parcela padrão`
              }
              trend={
                result.deltaRemainingMonths < 0
                  ? "up"
                  : result.deltaRemainingMonths > 0
                    ? "down"
                    : "neutral"
              }
              testId="simulate-result-months"
            />
            <ResultTile
              label="Economia em juros"
              value={formatBRL(result.interestSavings.abs())}
              delta={
                result.interestSavings.isZero()
                  ? "Sem diferença"
                  : result.interestSavings.greaterThan(0)
                    ? "Versus pagar só a parcela"
                    : "Versus pagar só a parcela (piora)"
              }
              trend={
                result.interestSavings.greaterThan(0)
                  ? "up"
                  : result.interestSavings.lessThan(0)
                    ? "down"
                    : "neutral"
              }
              testId="simulate-result-interest"
            />
            <ResultTile
              label="Parcela após simulação"
              value={formatBRL(result.hypothetical.nextScheduledPayment)}
              delta={
                strategy === "parcela"
                  ? "Estratégia: reduzir parcela"
                  : "Estratégia: reduzir prazo"
              }
              trend="neutral"
              testId="simulate-result-next-installment"
            />
          </div>
        ) : null}

        <div>
          <Button
            type="button"
            disabled={!hasAmount}
            data-testid="simulate-apply-button"
            onClick={() => {
              if (!result || !hasAmount) return;
              onApply({
                amountPaid: amount ?? 0,
                amortizationStrategy: strategy,
                referenceMonth: result.referenceMonth,
              });
            }}
          >
            Aplicar como pagamento real
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ResultTileProps {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  testId: string;
}

function ResultTile({ label, value, delta, trend, testId }: ResultTileProps) {
  return (
    <div
      className="rounded-md border p-3"
      data-testid={testId}
    >
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-tabular text-lg font-semibold tabular-nums">
        {value}
      </p>
      <p className={cn("mt-1 text-xs", deltaClass(trend))}>{delta}</p>
    </div>
  );
}
