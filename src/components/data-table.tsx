import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInteger } from "@/lib/formatters/number";

export interface DataTableColumn<TRow> {
  id: string;
  header: string;
  numeric?: boolean;
  sortable?: boolean;
  sortValue?: (row: TRow) => number;
  cell: (row: TRow) => ReactNode;
}

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  data: TRow[];
  pageSize?: 12 | 24;
  emptyMessage?: string;
  /** Optional accessible name for the rendered <table>. */
  ariaLabel?: string;
  /** Optional id of an element labelling the rendered <table>. */
  ariaLabelledBy?: string;
}

interface SortState {
  columnId: string;
  direction: "asc" | "desc";
}

/**
 * Generic, typed, paginated and sortable client-side table. Numeric columns
 * are right-aligned and rendered with the `font-tabular` utility for monetary
 * legibility. No drag-and-drop. No external table library — kept dependency-
 * free and small enough to be used as the shell for domain tables under
 * `src/features/.../components/`.
 */
export function DataTable<TRow>({
  columns,
  data,
  pageSize = 12,
  emptyMessage = "Sem registros para exibir.",
  ariaLabel,
  ariaLabelledBy,
}: DataTableProps<TRow>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(0);
  const tableId = useId();

  const sortedData = useMemo<TRow[]>(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col || !col.sortValue) return data;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...data].sort((a, b) => (col.sortValue!(a) - col.sortValue!(b)) * dir);
  }, [data, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(Math.max(0, pageCount - 1));
    }
  }, [page, pageCount]);

  const pageRows = sortedData.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );

  function toggleSort(columnId: string) {
    setSort((current) => {
      if (!current || current.columnId !== columnId) {
        return { columnId, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { columnId, direction: "desc" };
      }
      return null;
    });
  }

  if (data.length === 0) {
    return (
      <p
        className="text-muted-foreground text-sm"
        data-testid="data-table-empty-state"
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="data-table">
      <div
        className="border-border w-full overflow-x-auto rounded-md border"
        data-testid="data-table-scroll"
      >
        <table
          id={tableId}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="w-full min-w-[640px] border-collapse text-sm"
        >
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {columns.map((col) => {
                const sortable = col.sortable && Boolean(col.sortValue);
                const isSorted = sort?.columnId === col.id;
                const ariaSort = !sortable
                  ? undefined
                  : !isSorted
                    ? "none"
                    : sort?.direction === "asc"
                      ? "ascending"
                      : "descending";
                return (
                  <th
                    key={col.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      "border-border border-b px-3 py-2 text-xs font-semibold tracking-wide uppercase",
                      col.numeric ? "text-right" : "text-left",
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className="hover:text-foreground inline-flex items-center gap-1 focus-visible:outline-none"
                        onClick={() => toggleSort(col.id)}
                      >
                        {col.header}
                        <span aria-hidden="true">
                          {isSorted
                            ? sort?.direction === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-border border-b last:border-b-0"
                data-row-index={safePage * pageSize + rowIdx}
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    data-column={col.id}
                    className={cn(
                      "px-3 py-2",
                      col.numeric ? "font-tabular text-right" : "text-left",
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="flex flex-col items-center justify-between gap-2 sm:flex-row"
        data-testid="data-table-pagination"
      >
        <p className="text-muted-foreground text-xs">
          Página {safePage + 1} de {pageCount} ·{" "}
          {formatInteger(sortedData.length)} registro
          {sortedData.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
