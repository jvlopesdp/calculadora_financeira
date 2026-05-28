import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useScenarios } from "@/lib/queries/scenarios";
import type { ScenarioApi } from "@/lib/api-client";

function displayName(scenario: ScenarioApi): string {
  return scenario.name && scenario.name.length > 0
    ? scenario.name
    : "Cenário sem nome";
}

export function ScenarioCombobox() {
  const navigate = useNavigate();
  const { scenarioId } = useParams<{ scenarioId: string }>();

  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const scenariosQuery = useScenarios({ enabled: hasOpened });

  const scenarios = scenariosQuery.data ?? [];
  const currentScenario = scenarios.find((s) => s.id === scenarioId);
  const triggerLabel = currentScenario
    ? displayName(currentScenario)
    : "Selecionar cenário";

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !hasOpened) setHasOpened(true);
  }

  function handleSelect(id: string) {
    setOpen(false);
    if (id !== scenarioId) {
      navigate(`/historico/${id}`);
    }
  }

  const isLoading = hasOpened && scenariosQuery.isPending;
  const isError = scenariosQuery.isError;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-haspopup="listbox"
          aria-expanded={open}
          data-testid="scenario-combobox-trigger"
          className="w-[200px] justify-between gap-2"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[60vh] w-[260px] overflow-y-auto"
      >
        {isLoading ? (
          <DropdownMenuItem disabled data-testid="scenario-combobox-loading">
            Carregando…
          </DropdownMenuItem>
        ) : isError ? (
          <DropdownMenuItem disabled data-testid="scenario-combobox-error">
            Erro ao carregar cenários
          </DropdownMenuItem>
        ) : scenarios.length === 0 ? (
          <DropdownMenuItem disabled data-testid="scenario-combobox-empty">
            Nenhum cenário disponível
          </DropdownMenuItem>
        ) : (
          scenarios.map((scenario) => {
            const isCurrent = scenario.id === scenarioId;
            return (
              <DropdownMenuItem
                key={scenario.id}
                data-testid={`scenario-combobox-item-${scenario.id}`}
                onSelect={() => handleSelect(scenario.id)}
              >
                <Check
                  className={cn(isCurrent ? "opacity-100" : "opacity-0")}
                  aria-hidden="true"
                />
                <span className="truncate">{displayName(scenario)}</span>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
