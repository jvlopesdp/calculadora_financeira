import { useMemo } from "react";

import { SectionCards } from "@/components/section-cards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";
import { buildRentVsBuyKpis } from "@/features/simulator/lib/build-rent-vs-buy-kpis";

export function AlugarXFinanciarPage() {
  const { financing, rentVsBuy } = useSimulation();
  const kpis = useMemo(
    () => buildRentVsBuyKpis({ financing, rentVsBuy }),
    [financing, rentVsBuy],
  );

  return (
    <>
      <SectionCards items={kpis} />
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
