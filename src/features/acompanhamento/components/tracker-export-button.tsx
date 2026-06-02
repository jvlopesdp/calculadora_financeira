import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportTracker } from "@/features/acompanhamento/lib/export-tracker";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";

interface TrackerExportButtonProps {
  plan: TrackerPlanApi;
  entries: TrackerEntryApi[];
}

export function TrackerExportButton({
  plan,
  entries,
}: TrackerExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await exportTracker(plan, entries);
    } catch {
      setError("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <Button
        type="button"
        variant="outline"
        onClick={handleExport}
        disabled={exporting}
        data-testid="tracker-export-button"
      >
        <Download aria-hidden="true" />
        {exporting ? "Exportando..." : "Exportar Excel"}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
