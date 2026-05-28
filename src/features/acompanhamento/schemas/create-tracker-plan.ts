import { z } from "zod";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const createTrackerPlanSchema = z
  .object({
    name: z
      .string({ required_error: "Informe um nome para o plano." })
      .trim()
      .min(1, "Informe um nome para o plano.")
      .max(100, "Nome deve ter no máximo 100 caracteres."),
    propertyValue: z
      .number({
        required_error: "Informe o valor do imóvel.",
        invalid_type_error: "Valor do imóvel deve ser numérico.",
      })
      .finite("Valor do imóvel deve ser um número válido.")
      .gt(0, "Valor do imóvel deve ser maior que zero."),
    downPayment: z
      .number({
        required_error: "Informe o valor da entrada.",
        invalid_type_error: "Entrada deve ser numérica.",
      })
      .finite("Entrada deve ser um número válido.")
      .min(0, "Entrada não pode ser negativa."),
    termMonths: z
      .number({
        required_error: "Informe o prazo em meses.",
        invalid_type_error: "Prazo deve ser numérico.",
      })
      .int("Prazo deve ser um número inteiro.")
      .positive("Prazo deve ser maior que zero."),
    annualRate: z
      .number({
        required_error: "Informe a taxa anual.",
        invalid_type_error: "Taxa anual deve ser numérica.",
      })
      .finite("Taxa anual deve ser um número válido.")
      .positive("Taxa anual deve ser maior que zero."),
    modality: z.enum(["PRICE", "SAC"], {
      required_error: "Selecione o sistema de amortização.",
      invalid_type_error: "Sistema de amortização inválido.",
    }),
    startDate: z
      .string({ required_error: "Informe a data de início." })
      .regex(ISO_DATE_RE, "Data de início deve estar no formato AAAA-MM-DD."),
    targetMonthlyTotal: z
      .number({
        required_error: "Informe o valor-meta mensal.",
        invalid_type_error: "Valor-meta deve ser numérico.",
      })
      .finite("Valor-meta deve ser um número válido.")
      .positive("Valor-meta deve ser maior que zero."),
  })
  .refine((v) => v.downPayment < v.propertyValue, {
    message: "Entrada deve ser menor que o valor do imóvel.",
    path: ["downPayment"],
  });

export type CreateTrackerPlanFormValues = z.infer<
  typeof createTrackerPlanSchema
>;
