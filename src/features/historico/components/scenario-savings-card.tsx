import { PiggyBankIcon, TimerResetIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CurrentState } from "@/core/finance/replay-payments";
import { summarizeScenarioSavings } from "@/features/historico/lib/build-detail-chart-data";
import { formatBRL } from "@/lib/formatters/currency";
import { formatMonths } from "@/lib/formatters/number";

export function ScenarioSavingsCard({ state }: { state: CurrentState }) {
  const summary = summarizeScenarioSavings(state);
  const savedDisplay = formatBRL(Math.max(0, summary.interestSaved));
  const monthsReducedDisplay = formatMonths(summary.monthsReduced);

  return (
    <Card data-testid="scenario-savings-card">
      <CardHeader>
        <CardTitle>Economia até aqui</CardTitle>
        <CardDescription>
          Comparação entre o cronograma original e o impacto dos seus
          pagamentos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            className="border-border rounded-lg border p-4"
            data-testid="scenario-savings-interest"
          >
            <dt className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <PiggyBankIcon className="size-4" aria-hidden="true" />
              Você já economizou em juros
            </dt>
            <dd
              className="mt-1 font-tabular text-2xl font-semibold"
              data-testid="scenario-savings-interest-value"
            >
              {savedDisplay}
            </dd>
            <p className="text-muted-foreground mt-1 text-xs">
              Versus o cronograma original sem extras.
            </p>
          </div>
          <div
            className="border-border rounded-lg border p-4"
            data-testid="scenario-savings-months"
          >
            <dt className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <TimerResetIcon className="size-4" aria-hidden="true" />
              Prazo reduzido
            </dt>
            <dd
              className="mt-1 font-tabular text-2xl font-semibold"
              data-testid="scenario-savings-months-value"
            >
              {monthsReducedDisplay}
            </dd>
            <p className="text-muted-foreground mt-1 text-xs">
              {summary.baselineTermMonths} meses originalmente →{" "}
              {summary.realTermMonths} meses projetados.
            </p>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
