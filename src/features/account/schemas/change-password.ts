import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: "Informe sua senha atual." })
      .min(1, "Informe sua senha atual."),
    newPassword: z
      .string({ required_error: "Informe a nova senha." })
      .min(8, "A nova senha deve ter pelo menos 8 caracteres."),
    newPasswordConfirmation: z
      .string({ required_error: "Confirme a nova senha." })
      .min(1, "Confirme a nova senha."),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.newPasswordConfirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As senhas não conferem.",
        path: ["newPasswordConfirmation"],
      });
    }
    if (
      data.currentPassword.length > 0 &&
      data.newPassword.length > 0 &&
      data.currentPassword === data.newPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A nova senha deve ser diferente da atual.",
        path: ["newPassword"],
      });
    }
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
