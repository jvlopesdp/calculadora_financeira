import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportSimulation } from "@/lib/export/excel-export";
import { useSimulation } from "@/features/simulator/hooks/simulation-context";

const DISABLED_HINT = "Preencha os dados para habilitar a exportação";

export function ExportButton() {
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
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={handleExport}
        disabled={disabled}
        data-testid="export-button"
        title={financing === null ? DISABLED_HINT : undefined}
        aria-describedby={financing === null ? "export-button-hint" : undefined}
      >
        <Download aria-hidden="true" />
        {exporting ? "Exportando..." : "Exportar Excel"}
      </Button>
      {financing === null ? (
        <p
          id="export-button-hint"
          className="text-muted-foreground text-xs"
          data-testid="export-empty-state"
        >
          {DISABLED_HINT}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
