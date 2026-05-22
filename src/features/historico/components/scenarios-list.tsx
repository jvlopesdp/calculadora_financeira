import { useNavigate } from "react-router-dom";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { computeScenarioState } from "@/features/historico/lib/scenario-state";
import { formatBRL } from "@/lib/formatters/currency";
import type { PaymentApi, ScenarioApi } from "@/lib/api-client";

export interface ScenarioWithPayments {
  scenario: ScenarioApi;
  payments: PaymentApi[];
}

export interface ScenariosListProps {
  items: ScenarioWithPayments[];
}

export function ScenariosList({ items }: ScenariosListProps) {
  const navigate = useNavigate();

  return (
    <ul
      data-testid="scenarios-list"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {items.map(({ scenario, payments }) => {
        const state = computeScenarioState(scenario, payments);
        const principalCents =
          scenario.property_value_cents - scenario.down_payment_cents;
        const principal = principalCents / 100;
        const currentBalance = state.currentBalance.toNumber();
        const paidPrincipal = state.paidPrincipal.toNumber();
        const progress =
          principal <= 0
            ? 100
            : Math.min(100, Math.max(0, (paidPrincipal / principal) * 100));

        const displayName =
          scenario.name && scenario.name.length > 0
            ? scenario.name
            : "Cenário sem nome";

        return (
          <li key={scenario.id}>
            <Card
              role="button"
              tabIndex={0}
              data-testid={`scenario-card-${scenario.id}`}
              className="hover:bg-accent/40 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => navigate(`/historico/${scenario.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/historico/${scenario.id}`);
                }
              }}
            >
              <CardHeader>
                <CardTitle>{displayName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Saldo devedor
                    </p>
                    <p className="font-tabular font-medium">
                      {formatBRL(currentBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Parcelas restantes
                    </p>
                    <p className="font-tabular font-medium">
                      {state.remainingMonths}
                    </p>
                  </div>
                </div>
                <div>
                  <Progress value={progress} />
                  <p className="text-muted-foreground mt-1 text-xs">
                    {progress.toFixed(1).replace(".", ",")}% amortizado
                  </p>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
