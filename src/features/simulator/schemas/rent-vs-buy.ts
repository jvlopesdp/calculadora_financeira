import { z } from "zod";

export const rentVsBuySchema = z.object({
  monthlyRent: z
    .number({
      required_error: "Informe o valor do aluguel mensal",
      invalid_type_error: "O aluguel mensal deve ser um número",
    })
    .finite("O aluguel mensal deve ser um número válido")
    .min(0, "O aluguel mensal não pode ser negativo"),
  annualRentAdjustment: z
    .number({
      required_error: "Informe o reajuste anual do aluguel",
      invalid_type_error: "O reajuste anual do aluguel deve ser um número",
    })
    .finite("O reajuste anual do aluguel deve ser um número válido")
    .min(0, "O reajuste anual do aluguel não pode ser negativo"),
  annualInvestmentReturn: z
    .number({
      required_error: "Informe o rendimento anual do investimento",
      invalid_type_error: "O rendimento anual deve ser um número",
    })
    .finite("O rendimento anual deve ser um número válido")
    .min(0, "O rendimento anual do investimento não pode ser negativo"),
  annualAppreciation: z
    .number({
      required_error: "Informe a valorização anual do imóvel",
      invalid_type_error: "A valorização anual deve ser um número",
    })
    .finite("A valorização anual deve ser um número válido")
    .min(0, "A valorização anual do imóvel não pode ser negativa"),
  monthlyOwnershipCosts: z
    .number({
      required_error: "Informe os custos mensais de propriedade",
      invalid_type_error: "Os custos mensais devem ser um número",
    })
    .finite("Os custos mensais devem ser um número válido")
    .min(0, "Os custos mensais de propriedade não podem ser negativos"),
  horizonMonths: z
    .number({
      required_error: "Informe o horizonte da simulação",
      invalid_type_error: "O horizonte deve ser um número",
    })
    .int("O horizonte deve ser um número inteiro de meses")
    .gt(0, "O horizonte deve ser maior que zero"),
});

export type RentVsBuyFormValues = z.infer<typeof rentVsBuySchema>;
