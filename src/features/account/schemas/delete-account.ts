import { z } from "zod";

export const deleteAccountSchema = z.object({
  password: z
    .string({ required_error: "Informe sua senha para confirmar." })
    .min(1, "Informe sua senha para confirmar."),
});

export type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>;
