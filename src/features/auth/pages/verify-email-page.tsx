import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificar email</CardTitle>
        <CardDescription>
          Clique no link enviado para confirmar seu cadastro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Página em construção. Esta página será concluída em uma próxima
          iteração.
        </p>
      </CardContent>
    </Card>
  );
}
