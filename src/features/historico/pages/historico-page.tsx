import { useCallback, useEffect, useState } from "react";

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
import { listPayments, listScenarios } from "@/lib/api-client";

type Status = "loading" | "ready" | "error";

export function HistoricoPage() {
  const [items, setItems] = useState<ScenarioWithPayments[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const scenarios = await listScenarios();
      const withPayments = await Promise.all(
        scenarios.map(async (scenario) => {
          try {
            const payments = await listPayments(scenario.id);
            return { scenario, payments };
          } catch {
            return { scenario, payments: [] };
          }
        }),
      );
      setItems(withPayments);
      setStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setErrorMessage(
        message.length > 0
          ? message
          : "Não foi possível carregar seus financiamentos. Tente novamente.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleCreated = useCallback(() => {
    void fetchAll();
  }, [fetchAll]);

  const kpis = buildHistoricoKpis();

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
          {status === "loading" ? (
            <div
              data-testid="historico-loading"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : status === "error" ? (
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
