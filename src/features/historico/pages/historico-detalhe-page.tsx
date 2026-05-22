import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

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
import { DeletePaymentDialog } from "@/features/historico/components/delete-payment-dialog";
import { PaymentFormDialog } from "@/features/historico/components/payment-form-dialog";
import { PaymentsTable } from "@/features/historico/components/payments-table";
import {
  SimulateNextPaymentCard,
  type SimulateApplyValues,
} from "@/features/historico/components/simulate-next-payment-card";
import { buildScenarioDetailKpis } from "@/features/historico/lib/build-scenario-detail-kpis";
import { computeScenarioState } from "@/features/historico/lib/scenario-state";
import type { PaymentFormValues } from "@/features/historico/schemas/payment";
import {
  ApiError,
  getScenario,
  listPayments,
  type PaymentApi,
  type ScenarioApi,
} from "@/lib/api-client";

type Status = "loading" | "ready" | "error" | "not-found";

export function HistoricoDetalhePage() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [scenario, setScenario] = useState<ScenarioApi | null>(null);
  const [payments, setPayments] = useState<PaymentApi[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] =
    useState<Partial<PaymentFormValues> | null>(null);
  const [editing, setEditing] = useState<PaymentApi | null>(null);
  const [deleting, setDeleting] = useState<PaymentApi | null>(null);

  const fetchAll = useCallback(async () => {
    if (!scenarioId) return;
    setStatus("loading");
    setErrorMessage(null);
    try {
      const [sc, ps] = await Promise.all([
        getScenario(scenarioId),
        listPayments(scenarioId),
      ]);
      setScenario(sc);
      setPayments(ps);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStatus("not-found");
        return;
      }
      const message = err instanceof Error ? err.message : "";
      setErrorMessage(
        message.length > 0
          ? message
          : "Não foi possível carregar o cenário. Tente novamente.",
      );
      setStatus("error");
    }
  }, [scenarioId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const state = useMemo(
    () => (scenario ? computeScenarioState(scenario, payments) : null),
    [scenario, payments],
  );

  const kpis = useMemo(
    () => (state ? buildScenarioDetailKpis(state) : []),
    [state],
  );

  const handlePaymentSaved = useCallback((saved: PaymentApi) => {
    setPayments((current) => {
      const idx = current.findIndex((p) => p.id === saved.id);
      if (idx === -1) {
        return [...current, saved].sort((a, b) =>
          a.reference_month.localeCompare(b.reference_month),
        );
      }
      const next = [...current];
      next[idx] = saved;
      return next;
    });
  }, []);

  const handlePaymentDeleted = useCallback((deleted: PaymentApi) => {
    setPayments((current) => current.filter((p) => p.id !== deleted.id));
  }, []);

  const handleSimulateApply = useCallback((values: SimulateApplyValues) => {
    setCreateDraft({
      amountPaid: values.amountPaid,
      amortizationStrategy: values.amortizationStrategy,
      referenceMonth: values.referenceMonth,
      paymentType: "amortizacao_extra",
    });
    setCreateOpen(true);
  }, []);

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-4" data-testid="detalhe-loading">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <Alert data-testid="detalhe-not-found">
        <AlertTitle>Cenário não encontrado</AlertTitle>
        <AlertDescription>
          Este financiamento não existe ou não pertence à sua conta.{" "}
          <Link to="/historico" className="underline">
            Voltar ao histórico
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "error") {
    return (
      <Alert variant="destructive" data-testid="detalhe-error">
        <AlertTitle>Erro ao carregar</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>
            {errorMessage ?? "Não foi possível carregar o cenário."}
          </span>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchAll()}
            >
              Tentar novamente
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (!scenario) return null;

  const displayName =
    scenario.name && scenario.name.length > 0
      ? scenario.name
      : "Cenário sem nome";

  return (
    <>
      <div
        className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"
        data-testid="detalhe-toolbar"
      >
        <div>
          <Link
            to="/historico"
            className="text-muted-foreground hover:text-foreground text-sm underline"
          >
            ← Voltar ao histórico
          </Link>
          <h2 className="text-xl font-semibold tracking-tight">{displayName}</h2>
        </div>
        <Button
          type="button"
          onClick={() => {
            setCreateDraft(null);
            setCreateOpen(true);
          }}
        >
          Registrar pagamento
        </Button>
      </div>

      <SectionCards items={kpis} />

      <SimulateNextPaymentCard
        scenario={scenario}
        payments={payments}
        onApply={handleSimulateApply}
      />

      <Card>
        <CardHeader>
          <CardTitle id="historico-detalhe-payments-title">
            Histórico de pagamentos
          </CardTitle>
          <CardDescription>
            Pagamentos registrados em ordem cronológica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsTable
            payments={payments}
            ariaLabelledBy="historico-detalhe-payments-title"
            onEdit={(p) => setEditing(p)}
            onDelete={(p) => setDeleting(p)}
          />
        </CardContent>
      </Card>

      <PaymentFormDialog
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) setCreateDraft(null);
        }}
        scenarioId={scenario.id}
        initialDraft={createDraft}
        onSaved={handlePaymentSaved}
      />

      <PaymentFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        scenarioId={scenario.id}
        payment={editing}
        onSaved={handlePaymentSaved}
      />

      <DeletePaymentDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        scenarioId={scenario.id}
        payment={deleting}
        onDeleted={handlePaymentDeleted}
      />
    </>
  );
}
