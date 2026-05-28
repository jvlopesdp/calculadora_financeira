import { useMemo } from "react";

import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { TrackerCurves } from "@/features/acompanhamento/lib/build-curves";
import { buildTrackerChartViews } from "@/features/acompanhamento/lib/build-tracker-chart-views";

export interface TrackerCurvesChartProps {
  curves: TrackerCurves;
}

/**
 * Gráfico comparativo das três curvas do plano (Realizado × Normal × Meta) com
 * alternância de eixo (saldo devedor / juros acumulados) e marcadores de
 * quitação antecipada. Reusa o `curves` já memoizado pela página — não
 * recomputa os engines. Quando o plano-meta é inviável, a série Meta é
 * substituída por um aviso dentro do card.
 */
export function TrackerCurvesChart({ curves }: TrackerCurvesChartProps) {
  const { views, metaInvalid } = useMemo(
    () => buildTrackerChartViews(curves),
    [curves],
  );

  return (
    <ChartAreaInteractive
      title="Comparativo de curvas"
      description="Compare o realizado com o cronograma normal e o plano-meta."
      views={views}
      defaultView="balance"
      notice={
        metaInvalid ? (
          <Alert data-testid="tracker-curves-meta-warning">
            <AlertTitle>Plano-meta indisponível</AlertTitle>
            <AlertDescription>
              Valor-meta menor que a parcela inicial. Ajuste o plano para
              visualizar a curva.
            </AlertDescription>
          </Alert>
        ) : undefined
      }
    />
  );
}
