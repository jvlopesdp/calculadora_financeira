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
import { prepareNetWorthData } from "@/features/simulator/components/charts/net-worth-chart-data";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import { buildRentVsBuyKpis } from "@/features/simulator/lib/build-rent-vs-buy-kpis";

export function AlugarXFinanciarPage() {
  const { financing, rentVsBuy } = useSimulation();
  const kpis = useMemo(
    () => buildRentVsBuyKpis({ financing, rentVsBuy }),
    [financing, rentVsBuy],
  );

  const chartViews = useMemo<ChartView[]>(() => {
    const netWorth = prepareNetWorthData(financing, rentVsBuy);
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
          "Preencha os dados de financiamento e aluguel vs. compra para visualizar a evolução do patrimônio.",
      },
    ];
  }, [financing, rentVsBuy]);

  return (
    <>
      <SectionCards items={kpis} />
      <ChartAreaInteractive
        title="Patrimônio: comprar vs. alugar + investir"
        views={chartViews}
      />
      <Card>
        <CardHeader>
          <CardTitle>Alugar x Financiar</CardTitle>
          <CardDescription>
            Compare alugar e investir com financiar e ganhar valorização do imóvel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Comparação detalhada em construção. Esta página será concluída em uma
            próxima iteração.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
