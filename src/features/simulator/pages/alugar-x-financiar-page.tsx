import { useId, useMemo } from "react";

import {
  ChartAreaInteractive,
  type ChartView,
} from "@/components/chart-area-interactive";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { prepareNetWorthData } from "@/features/simulator/components/charts/net-worth-chart-data";
import { RentVsBuyCard } from "@/features/simulator/components/rent-vs-buy-card";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import {
  buildRentVsBuyAnnualRows,
  type RentVsBuyAnnualRow,
} from "@/features/simulator/lib/build-rent-vs-buy-annual-rows";
import { buildRentVsBuyKpis } from "@/features/simulator/lib/build-rent-vs-buy-kpis";
import { formatBRL } from "@/lib/formatters/currency";
import { formatMonths } from "@/lib/formatters/number";

const ANNUAL_EMPTY_STATE =
  "Preencha os dados de aluguel vs. compra para visualizar o resumo anual.";

export function AlugarXFinanciarPage() {
  const { rentVsBuy } = useSimulation();
  const annualTitleId = useId();

  const kpis = useMemo(
    () => buildRentVsBuyKpis({ rentVsBuy }),
    [rentVsBuy],
  );

  const chartViews = useMemo<ChartView[]>(() => {
    const netWorth = prepareNetWorthData(rentVsBuy);
    return [
      {
        id: "net-worth",
        label: "Patrimônio",
        description:
          "Patrimônio acumulado em cada cenário ao longo do horizonte.",
        kind: "line",
        data:
          netWorth?.map((point) => ({
            month: point.month,
            comprar: point.comprar,
            alugar: point.alugar,
          })) ?? [],
        series: [
          {
            key: "comprar",
            name: "Patrimônio comprar",
            color: "var(--chart-1)",
          },
          {
            key: "alugar",
            name: "Patrimônio alugar+investir",
            color: "var(--chart-2)",
          },
        ],
        emptyState:
          "Preencha os dados de aluguel vs. compra para visualizar a evolução do patrimônio.",
      },
    ];
  }, [rentVsBuy]);

  const annualRows = useMemo<RentVsBuyAnnualRow[]>(
    () => buildRentVsBuyAnnualRows(rentVsBuy),
    [rentVsBuy],
  );

  const annualColumns = useMemo<DataTableColumn<RentVsBuyAnnualRow>[]>(
    () => [
      {
        id: "year",
        header: "Ano",
        sortable: true,
        sortValue: (r) => r.year,
        cell: (r) => (
          <span className="font-tabular">
            <span className="font-medium">Ano {r.year}</span>
            <span className="text-muted-foreground ml-2 text-xs">
              {formatMonths(r.month)}
            </span>
          </span>
        ),
      },
      {
        id: "comprar",
        header: "Patrimônio (comprar)",
        numeric: true,
        sortable: true,
        sortValue: (r) => r.comprar.toNumber(),
        cell: (r) => formatBRL(r.comprar),
      },
      {
        id: "alugar",
        header: "Patrimônio (alugar)",
        numeric: true,
        sortable: true,
        sortValue: (r) => r.alugar.toNumber(),
        cell: (r) => formatBRL(r.alugar),
      },
      {
        id: "diferenca",
        header: "Diferença",
        numeric: true,
        sortable: true,
        sortValue: (r) => r.diferenca.toNumber(),
        cell: (r) => (
          <span
            className={cn(
              r.diferenca.greaterThan(0)
                ? "text-emerald-600 dark:text-emerald-400"
                : r.diferenca.lessThan(0)
                  ? "text-sky-600 dark:text-sky-400"
                  : "",
            )}
          >
            {formatBRL(r.diferenca)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <p className="text-muted-foreground text-sm" data-testid="alugar-x-financiar-toolbar">
        Compare alugar e investir com comprar via financiamento.
      </p>

      <SectionCards items={kpis} />

      <div className="flex flex-col gap-6 md:grid md:grid-cols-12 md:gap-6">
        <aside
          className="flex flex-col gap-6 md:col-span-5"
          aria-label="Painel de inputs do aluguel vs. financiamento"
        >
          <RentVsBuyCard />
        </aside>

        <div className="flex flex-col gap-6 md:col-span-7">
          <ChartAreaInteractive
            title="Patrimônio: comprar vs. alugar + investir"
            views={chartViews}
          />

          <Card data-testid="rent-vs-buy-annual-table">
            <CardHeader>
              <CardTitle id={annualTitleId}>Resumo anual</CardTitle>
              <CardDescription>
                Patrimônio por ano em cada cenário.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={annualColumns}
                data={annualRows}
                pageSize={12}
                ariaLabelledBy={annualTitleId}
                emptyMessage={ANNUAL_EMPTY_STATE}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
