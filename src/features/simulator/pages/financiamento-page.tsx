import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AmortizationTable } from "@/features/simulator/components/amortization-table";
import { InstallmentCompositionChart } from "@/features/simulator/components/charts/installment-composition-chart";
import { InterestSavingsChart } from "@/features/simulator/components/charts/interest-savings-chart";
import { NetWorthChart } from "@/features/simulator/components/charts/net-worth-chart";
import { OutstandingBalanceChart } from "@/features/simulator/components/charts/outstanding-balance-chart";
import { ExportCard } from "@/features/simulator/components/export-card";
import { ExtraPaymentCard } from "@/features/simulator/components/extra-payment-card";
import { FinancingForm } from "@/features/simulator/components/financing-form";
import { RentVsBuyCard } from "@/features/simulator/components/rent-vs-buy-card";
import { ResultsSummaryCard } from "@/features/simulator/components/results-summary-card";

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

export function FinanciamentoPage() {
  return (
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

      <RentVsBuyCard />

      <ResultsSummaryCard />

      <AmortizationTable />

      <Card className="md:col-span-12">
        <CardHeader>
          <CardTitle>Gráficos</CardTitle>
          <CardDescription>
            Evolução do saldo, patrimônio e composição das parcelas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          <NetWorthChart />
          <OutstandingBalanceChart />
          <InstallmentCompositionChart />
          <InterestSavingsChart />
        </CardContent>
      </Card>

      <ExportCard />
    </div>
  );
}
