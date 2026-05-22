import { SectionCards } from "@/components/section-cards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildHistoricoKpis } from "@/features/historico/lib/build-historico-kpis";

export function HistoricoPage() {
  const kpis = buildHistoricoKpis();

  return (
    <>
      <SectionCards items={kpis} />
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
    </>
  );
}
