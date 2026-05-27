import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/formatters/currency";
import type { PaymentApi } from "@/lib/api-client";

const TYPE_LABELS: Record<string, string> = {
  parcela: "Parcela",
  amortizacao_extra: "Amortização extra",
  misto: "Misto",
};

const STRATEGY_LABELS: Record<string, string> = {
  prazo: "Reduzir prazo",
  parcela: "Reduzir parcela",
};

export interface PaymentsTableProps {
  payments: PaymentApi[];
  ariaLabelledBy?: string;
  onEdit: (payment: PaymentApi) => void;
  onDelete: (payment: PaymentApi) => void;
}

export function PaymentsTable({
  payments,
  ariaLabelledBy,
  onEdit,
  onDelete,
}: PaymentsTableProps) {
  const columns: DataTableColumn<PaymentApi>[] = [
    {
      id: "reference_month",
      header: "Referência",
      sortable: true,
      sortValue: (row) => referenceMonthSortValue(row.reference_month),
      cell: (row) => row.reference_month,
    },
    {
      id: "payment_date",
      header: "Data",
      sortable: true,
      sortValue: (row) => Date.parse(row.payment_date) || 0,
      cell: (row) => row.payment_date,
    },
    {
      id: "amount_paid",
      header: "Valor",
      numeric: true,
      sortable: true,
      sortValue: (row) => row.amount_paid_cents,
      cell: (row) => formatBRL(row.amount_paid_cents / 100),
    },
    {
      id: "payment_type",
      header: "Tipo",
      cell: (row) => TYPE_LABELS[row.payment_type] ?? row.payment_type,
    },
    {
      id: "amortization_strategy",
      header: "Estratégia",
      cell: (row) =>
        STRATEGY_LABELS[row.amortization_strategy] ?? row.amortization_strategy,
    },
    {
      id: "actions",
      header: "Ações",
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(row)}
            data-testid={`payment-edit-${row.id}`}
          >
            Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDelete(row)}
            data-testid={`payment-delete-${row.id}`}
          >
            Excluir
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={payments}
      pageSize={12}
      ariaLabelledBy={ariaLabelledBy}
      emptyMessage="Nenhum pagamento registrado ainda."
    />
  );
}

function referenceMonthSortValue(ref: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(ref);
  if (!match) return 0;
  const [, y, m] = match;
  return Number(y) * 12 + Number(m);
}
