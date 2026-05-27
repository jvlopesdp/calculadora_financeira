import { z } from "zod";

export const resetPasswordSchema = z
  .object({
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

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
