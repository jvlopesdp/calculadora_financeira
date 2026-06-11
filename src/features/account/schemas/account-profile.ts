import { z } from "zod";

export const accountProfileSchema = z.object({
  name: z
    .string({ required_error: "Informe seu nome." })
    .trim()
    .min(1, "Informe seu nome.")
    .max(100, "Nome muito longo (máx. 100 caracteres)."),
  email: z
    .string({ required_error: "Informe seu email." })
    .trim()
    .min(1, "Informe seu email.")
    .email("Email inválido."),
});

export type AccountProfileFormValues = z.infer<typeof accountProfileSchema>;
