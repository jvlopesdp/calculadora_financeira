import { IconChartLine } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/formatters/currency";
import { useTrackerPlans } from "@/lib/queries/tracker-plans";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function AcompanhamentoPage() {
  const navigate = useNavigate();
  const plansQuery = useTrackerPlans();
  const plans = plansQuery.data ?? [];

  const goToNew = () => navigate("/acompanhamento/novo");

  const isLoading = plansQuery.isPending;
  const isError = plansQuery.isError;
  const errorMessage =
    plansQuery.error instanceof Error && plansQuery.error.message
      ? plansQuery.error.message
      : null;

  return (
    <>
      <div
        className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"
        data-testid="acompanhamento-toolbar"
      >
        <p className="text-muted-foreground text-sm">
          Acompanhe a evolução dos seus planos de financiamento mês a mês.
        </p>
        <Button onClick={goToNew}>Novo plano</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seus planos de acompanhamento</CardTitle>
          <CardDescription>
            Selecione um plano para ver a planilha e os gráficos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div
              data-testid="acompanhamento-loading"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : isError ? (
            <Alert variant="destructive" data-testid="acompanhamento-error">
              <AlertTitle>Erro ao carregar</AlertTitle>
              <AlertDescription>
                {errorMessage ?? "Não foi possível carregar seus planos."}
              </AlertDescription>
            </Alert>
          ) : plans.length === 0 ? (
            <div
              data-testid="acompanhamento-empty-state"
              className="flex flex-col items-center gap-4 py-10 text-center"
            >
              <IconChartLine
                className="text-muted-foreground size-12"
                aria-hidden
              />
              <p className="text-muted-foreground text-sm">
                Você ainda não tem nenhum plano de acompanhamento.
              </p>
              <Button onClick={goToNew}>Criar novo plano</Button>
            </div>
          ) : (
            <ul
              data-testid="tracker-plans-list"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {plans.map((plan) => {
                const principal =
                  (plan.property_value_cents - plan.down_payment_cents) / 100;
                return (
                  <li key={plan.id}>
                    <Card
                      role="button"
                      tabIndex={0}
                      data-testid={`tracker-plan-card-${plan.id}`}
                      className="hover:bg-accent/40 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      onClick={() => navigate(`/acompanhamento/${plan.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/acompanhamento/${plan.id}`);
                        }
                      }}
                    >
                      <CardHeader>
                        <CardTitle>{plan.name}</CardTitle>
                        <CardDescription>
                          {plan.modality} · {plan.term_months} meses
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Valor financiado
                          </p>
                          <p className="font-tabular font-medium">
                            {formatBRL(principal)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Criado em
                          </p>
                          <p className="font-tabular font-medium">
                            {dateFormatter.format(new Date(plan.created_at))}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
