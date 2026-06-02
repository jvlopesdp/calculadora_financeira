import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";

import { CurrencyInput } from "@/components/finance/currency-input";
import { PercentageInput } from "@/components/finance/percentage-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createTrackerPlanSchema,
  type CreateTrackerPlanFormValues,
} from "@/features/acompanhamento/schemas/create-tracker-plan";
import { ApiError } from "@/lib/api-client";
import { useCreateTrackerPlan } from "@/lib/queries/tracker-plans";

const defaultValues: CreateTrackerPlanFormValues = {
  name: "",
  propertyValue: 0,
  downPayment: 0,
  termMonths: 360,
  annualRate: 0,
  modality: "PRICE",
  startDate: new Date().toISOString().slice(0, 10),
  targetMonthlyTotal: 0,
};

export function AcompanhamentoNovoPage() {
  const navigate = useNavigate();
  const createMutation = useCreateTrackerPlan();
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = createMutation.isPending;

  const form = useForm<CreateTrackerPlanFormValues>({
    resolver: zodResolver(createTrackerPlanSchema),
    mode: "onBlur",
    defaultValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const plan = await createMutation.mutateAsync(values);
      navigate(`/acompanhamento/${plan.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const body = err.body as { message?: string } | null;
        if (body?.message === "down_payment_must_be_less_than_property_value") {
          form.setError("downPayment", {
            message: "Entrada deve ser menor que o valor do imóvel.",
          });
          return;
        }
        setFormError(
          "Não foi possível criar o plano. Verifique os campos e tente novamente.",
        );
      } else if (err instanceof ApiError && err.status === 401) {
        setFormError("Sessão expirada. Recarregue a página e entre novamente.");
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
    <Card>
      <CardHeader>
        <CardTitle>Novo plano de acompanhamento</CardTitle>
        <CardDescription>
          Cadastre um financiamento para acompanhar a evolução mês a mês.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={onSubmit}
            noValidate
            aria-label="Novo plano de acompanhamento"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do plano</FormLabel>
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
                name="modality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sistema de amortização</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        <option value="PRICE">PRICE (parcelas fixas)</option>
                        <option value="SAC">SAC (amortização constante)</option>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de início</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetMonthlyTotal"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Valor-meta mensal</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? 0)}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormDescription>
                      Valor total que você pretende pagar por mês (parcela +
                      amortização extra).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {formError ? (
              <p role="alert" className="text-destructive text-sm font-medium">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/acompanhamento")}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Criando…" : "Criar plano"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
