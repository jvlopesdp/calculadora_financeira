import { z } from "zod";

export const amortizationSystemSchema = z.enum(["PRICE", "SAC"], {
  required_error: "Selecione o sistema de amortização",
  invalid_type_error: "Sistema de amortização inválido",
});

export const financingSchema = z
  .object({
    propertyValue: z
      .number({
        required_error: "Informe o valor do imóvel",
        invalid_type_error: "O valor do imóvel deve ser um número",
      })
      .finite("O valor do imóvel deve ser um número válido")
      .gt(0, "O valor do imóvel deve ser maior que zero"),
    downPayment: z
      .number({
        required_error: "Informe o valor da entrada",
        invalid_type_error: "A entrada deve ser um número",
      })
      .finite("A entrada deve ser um número válido")
      .min(0, "A entrada não pode ser negativa"),
    termMonths: z
      .number({
        required_error: "Informe o prazo em meses",
        invalid_type_error: "O prazo deve ser um número",
      })
      .int("O prazo deve ser um número inteiro de meses")
      .gt(0, "O prazo deve ser maior que zero"),
    monthlyRate: z
      .number({
        required_error: "Informe a taxa mensal",
        invalid_type_error: "A taxa mensal deve ser um número",
      })
      .finite("A taxa mensal deve ser um número válido")
      .gt(0, "A taxa mensal deve ser maior que zero"),
    system: amortizationSystemSchema,
  })
  .refine((data) => data.downPayment < data.propertyValue, {
    message: "A entrada deve ser menor que o valor do imóvel",
    path: ["downPayment"],
  });

export type FinancingFormValues = z.infer<typeof financingSchema>;
export type AmortizationSystemValue = z.infer<typeof amortizationSystemSchema>;
