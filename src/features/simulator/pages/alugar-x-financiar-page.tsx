import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AlugarXFinanciarPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alugar x Financiar</CardTitle>
        <CardDescription>
          Compare alugar e investir com financiar e ganhar valorização do imóvel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Comparação detalhada em construção. Esta página será concluída em uma
          próxima iteração.
        </p>
      </CardContent>
    </Card>
  );
}
