import { useQueries, useQueryClient } from "@tanstack/react-query";

import { SectionCards } from "@/components/section-cards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NewScenarioDialog } from "@/features/historico/components/new-scenario-dialog";
import {
  ScenariosList,
  type ScenarioWithPayments,
} from "@/features/historico/components/scenarios-list";
import { buildHistoricoKpis } from "@/features/historico/lib/build-historico-kpis";
import { listPayments, type PaymentApi } from "@/lib/api-client";
import { paymentsQueryKey } from "@/lib/queries/payments";
import {
  SCENARIOS_QUERY_KEY,
  useScenarios,
} from "@/lib/queries/scenarios";

export function HistoricoPage() {
  const qc = useQueryClient();
  const scenariosQuery = useScenarios();
  const scenarios = scenariosQuery.data ?? [];

  const paymentsResults = useQueries({
    queries: scenarios.map((scenario) => ({
      queryKey: paymentsQueryKey(scenario.id),
      queryFn: () => listPayments(scenario.id).catch((): PaymentApi[] => []),
    })),
  });

  const allPaymentsLoaded =
    scenarios.length === 0 ||
    paymentsResults.every((q) => !q.isPending);

  const items: ScenarioWithPayments[] = scenarios.map((scenario, idx) => ({
    scenario,
    payments: paymentsResults[idx]?.data ?? [],
  }));

  const handleCreated = () => {
    void qc.invalidateQueries({ queryKey: SCENARIOS_QUERY_KEY });
  };

  const kpis = buildHistoricoKpis();
  const isLoading = scenariosQuery.isPending || !allPaymentsLoaded;
  const isError = scenariosQuery.isError;
  const errorMessage =
    scenariosQuery.error instanceof Error && scenariosQuery.error.message
      ? scenariosQuery.error.message
      : null;

  return (
    <>
      <div
        className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"
        data-testid="historico-toolbar"
      >
        <p className="text-muted-foreground text-sm">
          Acompanhe seus financiamentos e registre pagamentos reais.
        </p>
        <NewScenarioDialog onCreated={handleCreated} />
      </div>

      <SectionCards items={kpis} />

      <Card>
        <CardHeader>
          <CardTitle>Seus financiamentos</CardTitle>
          <CardDescription>
            Selecione um financiamento para ver detalhes e pagamentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div
              data-testid="historico-loading"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : isError ? (
            <Alert variant="destructive" data-testid="historico-error">
              <AlertTitle>Erro ao carregar</AlertTitle>
              <AlertDescription>
                {errorMessage ??
                  "Não foi possível carregar seus financiamentos."}
              </AlertDescription>
            </Alert>
          ) : items.length === 0 ? (
            <p
              data-testid="historico-empty-state"
              className="text-muted-foreground text-sm"
            >
              Você ainda não tem financiamentos. Crie um para começar a
              registrar.
            </p>
          ) : (
            <ScenariosList items={items} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
