import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface ChartAreaInteractiveProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

/**
 * Placeholder shell from shadcn `dashboard-01`. Domain stories (e.g.
 * outstanding-balance, net-worth) plug recharts content via children.
 */
export function ChartAreaInteractive({
  title = "Visão geral",
  description = "Resumo do cenário selecionado.",
  children,
}: ChartAreaInteractiveProps) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {children ?? (
          <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
            Sem dados para exibir.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
