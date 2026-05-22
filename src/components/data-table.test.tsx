import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable, type DataTableColumn } from "@/components/data-table";

interface Item {
  id: number;
  name: string;
  value: number;
}

function buildItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    value: count - i, // first row has highest value
  }));
}

const columns: DataTableColumn<Item>[] = [
  {
    id: "id",
    header: "ID",
    numeric: true,
    sortable: true,
    sortValue: (r) => r.id,
    cell: (r) => String(r.id),
  },
  {
    id: "name",
    header: "Nome",
    cell: (r) => r.name,
  },
  {
    id: "value",
    header: "Valor",
    numeric: true,
    sortable: true,
    sortValue: (r) => r.value,
    cell: (r) => r.value.toFixed(2),
  },
];

function getDataRows(): HTMLTableRowElement[] {
  const tbody = document.querySelector("tbody");
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll<HTMLTableRowElement>("tr[data-row-index]"));
}

describe("DataTable", () => {
  it("renders the empty state when no data is provided", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByTestId("data-table-empty-state").textContent).toMatch(
      /sem registros para exibir/i,
    );
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders all column headers from the columns prop", () => {
    render(<DataTable columns={columns} data={buildItems(3)} />);
    const headers = Array.from(document.querySelectorAll("thead th")).map((th) =>
      th.textContent?.replace(/[▲▼↕]/g, "").trim(),
    );
    expect(headers).toEqual(["ID", "Nome", "Valor"]);
  });

  it("right-aligns numeric columns and applies font-tabular to numeric cells", () => {
    render(<DataTable columns={columns} data={buildItems(1)} />);
    const firstRow = getDataRows()[0];
    const valueCell = firstRow.querySelector('td[data-column="value"]');
    const nameCell = firstRow.querySelector('td[data-column="name"]');
    expect(valueCell?.className).toMatch(/text-right/);
    expect(valueCell?.className).toMatch(/font-tabular/);
    expect(nameCell?.className).toMatch(/text-left/);
    expect(nameCell?.className).not.toMatch(/font-tabular/);
  });

  it("paginates to 12 rows per page by default and advances/retreats via controls", async () => {
    render(<DataTable columns={columns} data={buildItems(30)} />);

    expect(getDataRows()).toHaveLength(12);
    expect(
      screen.getByTestId("data-table-pagination").textContent,
    ).toMatch(/Página 1 de 3/i);

    fireEvent.click(screen.getByRole("button", { name: /próxima/i }));
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].querySelector('td[data-column="id"]')?.textContent).toBe("13");
    });

    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].querySelector('td[data-column="id"]')?.textContent).toBe("1");
    });
  });

  it("honours a pageSize of 24 when explicitly requested", () => {
    render(<DataTable columns={columns} data={buildItems(30)} pageSize={24} />);
    expect(getDataRows()).toHaveLength(24);
    expect(
      screen.getByTestId("data-table-pagination").textContent,
    ).toMatch(/Página 1 de 2/i);
  });

  it("disables the previous button on the first page and next on the last page", async () => {
    render(<DataTable columns={columns} data={buildItems(20)} />);

    const prev = screen.getByRole("button", { name: /anterior/i });
    const next = screen.getByRole("button", { name: /próxima/i });
    expect(prev).toBeDisabled();
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
    await waitFor(() => {
      expect(next).toBeDisabled();
      expect(prev).not.toBeDisabled();
    });
  });

  it("sorts a numeric column ascending then descending then clears", async () => {
    render(<DataTable columns={columns} data={buildItems(5)} />);

    const valueHeader = screen
      .getAllByRole("button")
      .find((btn) => btn.textContent?.startsWith("Valor"));
    expect(valueHeader).toBeDefined();

    // First click: asc → lowest value (id 5, value 1) goes to top
    fireEvent.click(valueHeader!);
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].querySelector('td[data-column="id"]')?.textContent).toBe("5");
    });

    // Second click: desc → highest value (id 1, value 5) goes to top
    fireEvent.click(valueHeader!);
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].querySelector('td[data-column="id"]')?.textContent).toBe("1");
    });

    // Third click: unsorted → falls back to insertion order (id 1 is also first by default)
    fireEvent.click(valueHeader!);
    await waitFor(() => {
      const rows = getDataRows();
      expect(rows[0].querySelector('td[data-column="id"]')?.textContent).toBe("1");
    });
    const valueTh = Array.from(document.querySelectorAll("thead th")).find((th) =>
      th.textContent?.startsWith("Valor"),
    );
    expect(valueTh?.getAttribute("aria-sort")).toBe("none");
  });

  it("does not render a sort button for non-sortable columns", () => {
    render(<DataTable columns={columns} data={buildItems(1)} />);
    const headerButtons = screen.getAllByRole("button");
    expect(headerButtons.some((b) => b.textContent?.startsWith("Nome"))).toBe(false);
    expect(headerButtons.some((b) => b.textContent?.startsWith("ID"))).toBe(true);
    expect(headerButtons.some((b) => b.textContent?.startsWith("Valor"))).toBe(true);
  });

  it("forwards aria-labelledby to the rendered table", () => {
    render(
      <>
        <h2 id="title">Tabela</h2>
        <DataTable columns={columns} data={buildItems(2)} ariaLabelledBy="title" />
      </>,
    );
    const table = screen.getByRole("table");
    expect(table.getAttribute("aria-labelledby")).toBe("title");
  });
});
