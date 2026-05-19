import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function HistoricoPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
        <CardDescription>
          Acompanhe seus financiamentos ativos e registre pagamentos reais.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Lista de financiamentos em construção. Esta página será concluída em
          uma próxima iteração.
        </p>
      </CardContent>
    </Card>
  );
}
