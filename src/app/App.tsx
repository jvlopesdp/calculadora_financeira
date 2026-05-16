import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { ExtraPaymentCard } from "@/features/simulator/components/extra-payment-card";
import { FinancingForm } from "@/features/simulator/components/financing-form";

type PlaceholderCardProps = {
  title: string;
  description?: string;
  emptyState: string;
  className?: string;
};

function PlaceholderCard({
  title,
  description,
  emptyState,
  className,
}: PlaceholderCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{emptyState}</p>
      </CardContent>
    </Card>
  );
}

function App() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="bg-background/95 border-border supports-[backdrop-filter]:bg-background/75 sticky top-0 z-40 border-b shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-4 md:px-6">
          <h1 className="font-serif text-xl font-bold md:text-2xl">
            Simulador de Financiamento
          </h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-8 md:px-6 md:py-10">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-12 md:gap-6">
          <PlaceholderCard
            className="md:col-span-12"
            title="Premissas gerais"
            description="Defina os parâmetros compartilhados entre os cenários."
            emptyState="Preencha os dados para simular"
          />

          <Card className="md:col-span-7">
            <CardHeader>
              <CardTitle>Financiamento</CardTitle>
              <CardDescription>
                Informe os detalhes do financiamento imobiliário.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FinancingForm />
            </CardContent>
          </Card>

          <ExtraPaymentCard />

          <PlaceholderCard
            className="md:col-span-12"
            title="Aluguel vs. compra"
            description="Compare comprar via financiamento com alugar e investir."
            emptyState="Preencha os dados para simular"
          />

          <PlaceholderCard
            className="md:col-span-12"
            title="Resumo dos resultados"
            description="Visão geral dos principais números da simulação."
            emptyState="Preencha os dados para simular"
          />

          <PlaceholderCard
            className="md:col-span-12"
            title="Tabela de amortização"
            description="Detalhamento mês a mês das parcelas."
            emptyState="Preencha os dados para simular"
          />

          <PlaceholderCard
            className="md:col-span-12"
            title="Gráficos"
            description="Evolução do saldo, patrimônio e composição das parcelas."
            emptyState="Preencha os dados para simular"
          />

          <PlaceholderCard
            className="md:col-span-12"
            title="Exportar"
            description="Baixe a simulação completa em Excel."
            emptyState="Preencha os dados para habilitar a exportação"
          />
        </div>
      </main>
    </div>
  );
}

export default App;
