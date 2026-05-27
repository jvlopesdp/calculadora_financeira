import { z } from "zod";

/**
 * Default values for rent-vs-buy inputs. pt-BR market assumptions:
 *  - rendimento anual 12%/a (CDI/Selic-like)
 *  - valorização anual do imóvel 6%/a
 *  - reajuste anual do aluguel 4%/a
 *  - custos de ITBI + escritura 3% sobre o valor do imóvel
 *  - corretagem na venda 6% sobre o valor do imóvel
 */
export const RENT_VS_BUY_DEFAULTS = {
  propertyValue: 500_000,
  downPayment: 100_000,
  termMonths: 360,
  annualRate: 10,
  annualRentAdjustment: 4,
  annualInvestmentReturn: 12,
  annualAppreciation: 6,
  purchaseCostPct: 3,
  saleCostPct: 6,
  monthlyOwnershipCosts: 0,
  horizonMonths: 360,
} as const;

export const rentVsBuySchema = z
  .object({
    propertyValue: z
      .number({
        required_error: "Informe o valor do imóvel",
        invalid_type_error: "O valor do imóvel deve ser um número",
      })
      .finite("O valor do imóvel deve ser um número válido")
      .gt(0, "O valor do imóvel deve ser maior que zero")
      .default(RENT_VS_BUY_DEFAULTS.propertyValue),
    downPayment: z
      .number({
        required_error: "Informe o valor da entrada",
        invalid_type_error: "A entrada deve ser um número",
      })
      .finite("A entrada deve ser um número válido")
      .min(0, "A entrada não pode ser negativa")
      .default(RENT_VS_BUY_DEFAULTS.downPayment),
    termMonths: z
      .number({
        required_error: "Informe o prazo do financiamento",
        invalid_type_error: "O prazo deve ser um número",
      })
      .int("O prazo deve ser um número inteiro de meses")
      .gt(0, "O prazo deve ser maior que zero")
      .default(RENT_VS_BUY_DEFAULTS.termMonths),
    annualRate: z
      .number({
        required_error: "Informe a taxa de juros anual",
        invalid_type_error: "A taxa anual deve ser um número",
      })
      .finite("A taxa anual deve ser um número válido")
      .gt(0, "A taxa anual deve ser maior que zero")
      .default(RENT_VS_BUY_DEFAULTS.annualRate),
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
      .min(0, "O reajuste anual do aluguel não pode ser negativo")
      .default(RENT_VS_BUY_DEFAULTS.annualRentAdjustment),
    annualInvestmentReturn: z
      .number({
        required_error: "Informe o rendimento anual do investimento",
        invalid_type_error: "O rendimento anual deve ser um número",
      })
      .finite("O rendimento anual deve ser um número válido")
      .min(0, "O rendimento anual do investimento não pode ser negativo")
      .default(RENT_VS_BUY_DEFAULTS.annualInvestmentReturn),
    annualAppreciation: z
      .number({
        required_error: "Informe a valorização anual do imóvel",
        invalid_type_error: "A valorização anual deve ser um número",
      })
      .finite("A valorização anual deve ser um número válido")
      .min(0, "A valorização anual do imóvel não pode ser negativa")
      .default(RENT_VS_BUY_DEFAULTS.annualAppreciation),
    purchaseCostPct: z
      .number({
        required_error: "Informe o custo de aquisição (ITBI + escritura)",
        invalid_type_error: "O custo de aquisição deve ser um número",
      })
      .finite("O custo de aquisição deve ser um número válido")
      .min(0, "O custo de aquisição não pode ser negativo")
      .lt(100, "O custo de aquisição deve ser menor que 100%")
      .default(RENT_VS_BUY_DEFAULTS.purchaseCostPct),
    saleCostPct: z
      .number({
        required_error: "Informe o custo de venda (corretagem)",
        invalid_type_error: "O custo de venda deve ser um número",
      })
      .finite("O custo de venda deve ser um número válido")
      .min(0, "O custo de venda não pode ser negativo")
      .lt(100, "O custo de venda deve ser menor que 100%")
      .default(RENT_VS_BUY_DEFAULTS.saleCostPct),
    monthlyOwnershipCosts: z
      .number({
        required_error: "Informe os custos mensais de propriedade",
        invalid_type_error: "Os custos mensais devem ser um número",
      })
      .finite("Os custos mensais devem ser um número válido")
      .min(0, "Os custos mensais de propriedade não podem ser negativos")
      .default(RENT_VS_BUY_DEFAULTS.monthlyOwnershipCosts),
    horizonMonths: z
      .number({
        required_error: "Informe o horizonte da simulação",
        invalid_type_error: "O horizonte deve ser um número",
      })
      .int("O horizonte deve ser um número inteiro de meses")
      .gt(0, "O horizonte deve ser maior que zero")
      .default(RENT_VS_BUY_DEFAULTS.horizonMonths),
  })
  .refine((data) => data.downPayment < data.propertyValue, {
    message: "A entrada deve ser menor que o valor do imóvel",
    path: ["downPayment"],
  });

export type RentVsBuyFormValues = z.infer<typeof rentVsBuySchema>;
