import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface SectionCardItem {
  title: string;
  description: string;
  value: string;
  hint?: string;
}

/**
 * Placeholder shell from shadcn `dashboard-01`. Future stories will wire real
 * KPIs (e.g. total juros pago, prazo restante, juros economizado) into this
 * grid. Until then it renders whatever items the caller passes.
 */
export function SectionCards({ items = [] }: { items?: SectionCardItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {items.map((item) => (
        <Card key={item.title} data-slot="card">
          <CardHeader>
            <CardDescription>{item.description}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {item.value}
            </CardTitle>
            {item.hint ? (
              <p className="text-muted-foreground text-xs">{item.hint}</p>
            ) : null}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
