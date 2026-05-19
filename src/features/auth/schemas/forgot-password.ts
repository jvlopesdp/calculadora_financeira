import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "Informe seu email." })
    .min(1, "Informe seu email.")
    .email("Email inválido."),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
