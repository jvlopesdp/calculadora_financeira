import { z } from "zod";

export const prepaymentSchema = z.object({
  extraMonthly: z
    .number({
      required_error: "Informe o valor do pagamento extra",
      invalid_type_error: "O pagamento extra deve ser um número",
    })
    .finite("O pagamento extra deve ser um número válido")
    .min(0, "O pagamento extra não pode ser negativo"),
});

export type PrepaymentFormValues = z.infer<typeof prepaymentSchema>;
