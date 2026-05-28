import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { SectionCards } from "@/components/section-cards";
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
import { DeleteTrackerPlanDialog } from "@/features/acompanhamento/components/delete-tracker-plan-dialog";
import { buildCurves } from "@/features/acompanhamento/lib/build-curves";
import { buildTrackerKpis } from "@/features/acompanhamento/lib/build-tracker-kpis";
import { ApiError } from "@/lib/api-client";
import { formatBRL } from "@/lib/formatters/currency";
import { useTrackerPlan } from "@/lib/queries/tracker-plans";

/** Formata "YYYY-MM-DD" como "DD/MM/YYYY" sem cair no fuso horário do Date. */
function formatIsoDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

export function AcompanhamentoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const planQuery = useTrackerPlan(id);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const detail = planQuery.data ?? null;

  const curves = useMemo(
    () => (detail ? buildCurves(detail.plan, detail.entries) : null),
    [detail],
  );
  const kpis = useMemo(
    () => (curves ? buildTrackerKpis(curves) : []),
    [curves],
  );

  const isNotFound =
    planQuery.error instanceof ApiError && planQuery.error.status === 404;
  const isLoading = !!id && planQuery.isPending;
  const isError = planQuery.isError && !isNotFound;
  const errorMessage =
    planQuery.error instanceof Error && planQuery.error.message.length > 0
      ? planQuery.error.message
      : null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" data-testid="acompanhamento-detail-loading">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <Alert data-testid="acompanhamento-detail-not-found">
        <AlertTitle>Plano não encontrado</AlertTitle>
        <AlertDescription>
          Este plano não existe ou não pertence à sua conta.{" "}
          <Link to="/acompanhamento" className="underline">
            Voltar ao acompanhamento
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" data-testid="acompanhamento-detail-error">
        <AlertTitle>Erro ao carregar</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>{errorMessage ?? "Não foi possível carregar o plano."}</span>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void planQuery.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (!detail) return null;

  const { plan } = detail;
  const principal =
    (plan.property_value_cents - plan.down_payment_cents) / 100;

  return (
    <>
      <div
        className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start"
        data-testid="acompanhamento-detail-toolbar"
      >
        <div>
          <Link
            to="/acompanhamento"
            className="text-muted-foreground hover:text-foreground text-sm underline"
          >
            ← Voltar ao acompanhamento
          </Link>
          <h2 className="text-xl font-semibold tracking-tight">{plan.name}</h2>
          <p className="text-muted-foreground text-sm">
            {plan.modality} · {formatBRL(principal)} financiados ·{" "}
            {plan.term_months} meses · início em{" "}
            {formatIsoDate(plan.start_date)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled>
            Editar plano
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Excluir plano
          </Button>
        </div>
      </div>

      <SectionCards items={kpis} />

      <Card>
        <CardHeader>
          <CardTitle>Planilha mês a mês</CardTitle>
          <CardDescription>
            A planilha de lançamentos e os gráficos comparativos chegam nas
            próximas etapas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {curves?.hasEntries
              ? "Os KPIs acima refletem os lançamentos já registrados."
              : "Você ainda não registrou nenhum lançamento neste plano."}
          </p>
        </CardContent>
      </Card>

      <DeleteTrackerPlanDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        plan={plan}
        onDeleted={() => navigate("/acompanhamento")}
      />
    </>
  );
}
