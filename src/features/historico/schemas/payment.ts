import { z } from "zod";

const REFERENCE_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const PAYMENT_TYPES = [
  "parcela",
  "amortizacao_extra",
  "misto",
] as const;
export const AMORTIZATION_STRATEGIES = ["prazo", "parcela"] as const;

export const paymentSchema = z.object({
  referenceMonth: z
    .string({ required_error: "Informe o mês de referência." })
    .regex(REFERENCE_MONTH_RE, "Mês de referência deve estar no formato AAAA-MM."),
  paymentDate: z
    .string({ required_error: "Informe a data do pagamento." })
    .regex(ISO_DATE_RE, "Data do pagamento deve estar no formato AAAA-MM-DD."),
  amountPaid: z
    .number({
      required_error: "Informe o valor pago.",
      invalid_type_error: "Valor pago deve ser numérico.",
    })
    .finite("Valor pago deve ser um número válido.")
    .positive("Valor pago deve ser maior que zero."),
  paymentType: z.enum(PAYMENT_TYPES, {
    required_error: "Selecione um tipo de pagamento.",
    invalid_type_error: "Tipo de pagamento inválido.",
  }),
  amortizationStrategy: z.enum(AMORTIZATION_STRATEGIES, {
    required_error: "Selecione uma estratégia de amortização.",
    invalid_type_error: "Estratégia de amortização inválida.",
  }),
  notes: z
    .string()
    .max(1000, "Notas devem ter no máximo 1000 caracteres.")
    .optional(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;
