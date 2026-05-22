import { useMemo } from "react";

import {
  ChartAreaInteractive,
  type ChartView,
} from "@/components/chart-area-interactive";
import { SectionCards } from "@/components/section-cards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AmortizationTable } from "@/features/simulator/components/amortization-table";
import { prepareInstallmentCompositionData } from "@/features/simulator/components/charts/installment-composition-chart-data";
import { prepareInterestSavingsData } from "@/features/simulator/components/charts/interest-savings-chart-data";
import { prepareOutstandingBalanceData } from "@/features/simulator/components/charts/outstanding-balance-chart-data";
import { ExportButton } from "@/features/simulator/components/export-button";
import { FinancingForm } from "@/features/simulator/components/financing-form";
import { RentVsBuyCard } from "@/features/simulator/components/rent-vs-buy-card";
import { ResultsSummaryCard } from "@/features/simulator/components/results-summary-card";
import { TargetPaymentCard } from "@/features/simulator/components/target-payment-card";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import { buildFinanciamentoKpis } from "@/features/simulator/lib/build-financiamento-kpis";

export function FinanciamentoPage() {
  const { financing, extraMonthly, extraStrategy } = useSimulation();
  const kpis = useMemo(
    () => buildFinanciamentoKpis({ financing, extraMonthly, extraStrategy }),
    [financing, extraMonthly, extraStrategy],
  );

  const chartViews = useMemo<ChartView[]>(() => {
    const balance = prepareOutstandingBalanceData(
      financing,
      extraMonthly,
      extraStrategy,
    );
    const savings = prepareInterestSavingsData(
      financing,
      extraMonthly,
      extraStrategy,
    );
    const composition = prepareInstallmentCompositionData(
      financing,
      extraMonthly,
      extraStrategy,
    );
    return [
      {
        id: "balance",
        label: "Saldo devedor",
        description:
          "Comparação entre o saldo base e o saldo com pagamento extra.",
        kind: "line",
        data: balance ?? [],
        series: [
          { key: "saldoBase", name: "Saldo base", color: "var(--chart-1)" },
          {
            key: "saldoExtra",
            name: "Saldo com extra",
            color: "var(--chart-3)",
          },
        ],
        emptyState:
          "Preencha os dados de financiamento para visualizar o saldo devedor.",
      },
      {
        id: "savings",
        label: "Juros acumulados",
        description:
          "Economia acumulada de juros ao longo do tempo com o pagamento extra.",
        kind: "line",
        data: savings ?? [],
        series: [
          {
            key: "economiaAcumulada",
            name: "Economia acumulada",
            color: "var(--chart-5)",
          },
        ],
        emptyState: "Informe um valor extra para visualizar a economia.",
      },
      {
        id: "composition",
        label: "Composição da parcela",
        description: "Como cada parcela se divide entre juros e amortização.",
        kind: "area",
        data: composition ?? [],
        series: [
          {
            key: "juros",
            name: "Juros",
            color: "var(--chart-2)",
            stackId: "installment",
          },
          {
            key: "amortizacao",
            name: "Amortização",
            color: "var(--chart-4)",
            stackId: "installment",
          },
        ],
        emptyState:
          "Preencha os dados de financiamento para visualizar a composição das parcelas.",
      },
    ];
  }, [financing, extraMonthly, extraStrategy]);

  return (
    <>
      <div
        className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"
        data-testid="financiamento-toolbar"
      >
        <p className="text-muted-foreground text-sm">
          Compare cenários de financiamento e exporte os resultados.
        </p>
        <ExportButton />
      </div>

      <SectionCards items={kpis} />

      <div className="flex flex-col gap-6 md:grid md:grid-cols-12 md:gap-6">
        <aside
          className="flex flex-col gap-6 md:col-span-5"
          aria-label="Painel de inputs do financiamento"
        >
          <Card>
            <CardHeader>
              <CardTitle>Financiamento</CardTitle>
              <CardDescription>
                Informe os detalhes do financiamento imobiliário.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FinancingForm />
            </CardContent>
          </Card>

          <TargetPaymentCard />
        </aside>

        <div className="flex flex-col gap-6 md:col-span-7">
          <ChartAreaInteractive
            title="Gráficos"
            views={chartViews}
            defaultView="balance"
          />

          <AmortizationTable />

          <ResultsSummaryCard />

          <RentVsBuyCard />
        </div>
      </div>
    </>
  );
}
