import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Informe seu email." })
    .min(1, "Informe seu email.")
    .email("Email inválido."),
  password: z
    .string({ required_error: "Informe sua senha." })
    .min(1, "Informe sua senha."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
