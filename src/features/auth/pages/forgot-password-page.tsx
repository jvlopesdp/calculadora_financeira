import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Esqueci minha senha</CardTitle>
        <CardDescription>
          Receba um link por email para redefinir sua senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Formulário em construção. Esta página será concluída em uma próxima
          iteração.
        </p>
      </CardContent>
    </Card>
  );
}
