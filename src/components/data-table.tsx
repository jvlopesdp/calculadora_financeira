import { Card, CardContent } from "@/components/ui/card";

export interface DataTableColumn<TRow> {
  key: keyof TRow & string;
  header: string;
  render?: (row: TRow) => React.ReactNode;
  align?: "left" | "right" | "center";
}

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  emptyMessage?: string;
}

/**
 * Placeholder shell from shadcn `dashboard-01`. The real block ships with
 * @tanstack/react-table + drag-drop reordering; our amortization tables use
 * the dedicated component in `features/simulator/components/amortization-*`.
 * This stub keeps the import surface stable so future stories can swap in the
 * full table without touching consumers.
 */
export function DataTable<TRow extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = "Sem registros para exibir.",
}: DataTableProps<TRow>) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left text-xs font-medium uppercase">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-border border-t [&:hover]:bg-muted/30"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                  >
                    {col.render
                      ? col.render(row)
                      : (row[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
