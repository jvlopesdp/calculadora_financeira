import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CurrencyInput } from "@/components/finance/currency-input";
import { PercentageInput } from "@/components/finance/percentage-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  createScenarioSchema,
  type CreateScenarioFormValues,
} from "@/features/historico/schemas/create-scenario";
import { ApiError, type ScenarioApi } from "@/lib/api-client";
import { useCreateScenario } from "@/lib/queries/scenarios";

const defaultValues: CreateScenarioFormValues = {
  name: "",
  propertyValue: 0,
  downPayment: 0,
  termMonths: 360,
  annualRate: 0,
  startDate: new Date().toISOString().slice(0, 10),
};

export interface NewScenarioDialogProps {
  onCreated: (scenario: ScenarioApi) => void;
}

export function NewScenarioDialog({ onCreated }: NewScenarioDialogProps) {
  const createMutation = useCreateScenario();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = createMutation.isPending;

  const form = useForm<CreateScenarioFormValues>({
    resolver: zodResolver(createScenarioSchema),
    mode: "onBlur",
    defaultValues,
  });

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setFormError(null);
    }
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const scenario = await createMutation.mutateAsync(values);
      onCreated(scenario);
      setOpen(false);
      form.reset(defaultValues);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setFormError(
          "Não foi possível criar o cenário. Verifique os campos e tente novamente.",
        );
      } else if (err instanceof ApiError && err.status === 401) {
        setFormError(
          "Sessão expirada. Recarregue a página e entre novamente.",
        );
      } else {
        const message = err instanceof Error ? err.message : "";
        setFormError(
          message.length > 0
            ? message
            : "Erro de rede. Verifique sua conexão e tente novamente.",
        );
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">Novo financiamento</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo financiamento</DialogTitle>
          <DialogDescription>
            Cadastre um cenário para começar a registrar pagamentos reais.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={onSubmit}
            noValidate
            aria-label="Novo financiamento"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do cenário</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Apartamento Vila Madalena"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="propertyValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor do imóvel</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? 0)}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="downPayment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entrada</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? 0)}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="termMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo (meses)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={Number.isFinite(field.value) ? field.value : ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            field.onChange(Number.NaN);
                            return;
                          }
                          const n = Number(raw);
                          field.onChange(Number.isFinite(n) ? n : Number.NaN);
                        }}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="annualRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa anual</FormLabel>
                    <FormControl>
                      <PercentageInput
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? 0)}
                        onBlur={field.onBlur}
                        decimals={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Data de início</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {formError ? (
              <p
                role="alert"
                className="text-destructive text-sm font-medium"
              >
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Criando…" : "Criar financiamento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
