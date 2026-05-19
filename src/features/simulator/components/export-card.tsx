import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { exportSimulation } from "@/lib/export/excel-export";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";

const EMPTY_STATE = "Preencha os dados para habilitar a exportação";

export function ExportCard() {
  const { financing, extraMonthly, extraStrategy, rentVsBuy } = useSimulation();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = financing === null || exporting;

  async function handleExport() {
    if (!financing) return;
    setExporting(true);
    setError(null);
    try {
      await exportSimulation({
        financing,
        extraMonthly,
        extraStrategy,
        rentVsBuy,
      });
    } catch {
      setError("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card className="md:col-span-12">
      <CardHeader>
        <CardTitle>Exportar</CardTitle>
        <CardDescription>
          Baixe a simulação completa em Excel.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {financing === null ? (
          <p
            className="text-muted-foreground text-sm"
            data-testid="export-empty-state"
          >
            {EMPTY_STATE}
          </p>
        ) : null}
        <div>
          <Button
            type="button"
            onClick={handleExport}
            disabled={disabled}
            data-testid="export-button"
          >
            <Download aria-hidden="true" />
            {exporting ? "Exportando..." : "Exportar Excel"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
