import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearLegacySimulation,
  isMigrationDone,
  legacyToCreateInput,
  markMigrationDone,
  readLegacySimulation,
  type LegacySimulation,
} from "@/lib/local-simulation-migration";
import { ApiError } from "@/lib/api-client";
import { useCreateScenario } from "@/lib/queries/scenarios";
import { useCurrentUser } from "@/lib/use-current-user";

type Status = "idle" | "importing" | "error";

/**
 * Detects a leftover MVP `lastSimulation` localStorage entry and offers the
 * authenticated user a one-shot import into their D1 scenario list. Mounted in
 * the `AppShell` so it runs across all authenticated routes.
 *
 * - Renders nothing for anonymous or loading sessions.
 * - The `migrationDone` localStorage flag is set after the user decides
 *   (importar OR descartar), so the prompt never reappears.
 * - On import: POST /api/scenarios then `navigate(/historico/<novoId>)`.
 */
export function MigrateLocalSimulationDialog() {
  const { user, isLoading } = useCurrentUser();
  const createMutation = useCreateScenario();
  const navigate = useNavigate();
  const [legacy, setLegacy] = useState<LegacySimulation | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !user) return;
    if (isMigrationDone()) return;
    const candidate = readLegacySimulation();
    if (!candidate) {
      // Nothing useful to import — record the decision so we don't re-check
      // every navigation.
      markMigrationDone();
      return;
    }
    setLegacy(candidate);
    setOpen(true);
  }, [isLoading, user]);

  const handleDiscard = useCallback(() => {
    clearLegacySimulation();
    markMigrationDone();
    setOpen(false);
    setLegacy(null);
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const handleImport = useCallback(async () => {
    if (!legacy) return;
    setStatus("importing");
    setErrorMessage(null);
    try {
      const scenario = await createMutation.mutateAsync(
        legacyToCreateInput(legacy),
      );
      clearLegacySimulation();
      markMigrationDone();
      setOpen(false);
      setLegacy(null);
      setStatus("idle");
      navigate(`/historico/${scenario.id}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? "Não foi possível importar a simulação. Verifique os dados e tente novamente."
          : err instanceof Error && err.message.length > 0
            ? err.message
            : "Erro de rede. Verifique sua conexão e tente novamente.";
      setErrorMessage(message);
      setStatus("error");
    }
  }, [legacy, navigate, createMutation]);

  if (!legacy) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Block close-via-escape/overlay while a request is in flight; otherwise
        // treat the dismissal as "discard" so the flag is recorded.
        if (status === "importing") return;
        if (!next) {
          handleDiscard();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar simulação salva?</DialogTitle>
          <DialogDescription>
            Encontramos uma simulação salva no seu navegador. Deseja importar
            para sua conta?
          </DialogDescription>
        </DialogHeader>

        <div className="text-muted-foreground space-y-1 text-sm">
          <p>
            <strong className="text-foreground">{legacy.name}</strong>
          </p>
          <p>
            Valor do imóvel: R${" "}
            {legacy.propertyValue.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p>
            Entrada: R${" "}
            {legacy.downPayment.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p>
            Prazo: {legacy.termMonths} meses · Taxa anual:{" "}
            {legacy.annualRate.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
            %
          </p>
        </div>

        {errorMessage ? (
          <p role="alert" className="text-destructive text-sm font-medium">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={status === "importing"}
          >
            Descartar
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={status === "importing"}
          >
            {status === "importing" ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
