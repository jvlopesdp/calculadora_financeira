import { z } from "zod";

export const registerSchema = z
  .object({
    email: z
      .string({ required_error: "Informe seu email." })
      .min(1, "Informe seu email.")
      .email("Email inválido."),
    password: z
      .string({ required_error: "Informe uma senha." })
      .min(8, "A senha deve ter pelo menos 8 caracteres."),
    passwordConfirmation: z
      .string({ required_error: "Confirme a senha." })
      .min(1, "Confirme a senha."),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As senhas não conferem.",
        path: ["passwordConfirmation"],
      });
    }
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
