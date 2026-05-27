import { z } from "zod";

export const targetPaymentSchema = z.object({
  target: z
    .number({
      required_error: "Informe a parcela mensal desejada",
      invalid_type_error: "A parcela desejada deve ser um número",
    })
    .finite("A parcela desejada deve ser um número válido")
    .gt(0, "A parcela desejada deve ser maior que zero"),
});

export type TargetPaymentFormValues = z.infer<typeof targetPaymentSchema>;
