import { render, screen } from "@testing-library/react";
import { TrendingUpIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import { SectionCards, type KpiCardData } from "@/components/section-cards";

describe("SectionCards", () => {
  it("renders nothing when items is empty", () => {
    const { container } = render(<SectionCards items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when items is undefined", () => {
    const { container } = render(<SectionCards />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a card per item with title and value", () => {
    const items: KpiCardData[] = [
      { title: "Parcela base", value: "R$ 1.234,56" },
      { title: "Total de juros", value: "R$ 9.876,54" },
    ];
    render(<SectionCards items={items} />);
    expect(screen.getByText("Parcela base")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.234,56")).toBeInTheDocument();
    expect(screen.getByText("Total de juros")).toBeInTheDocument();
    expect(screen.getByText("R$ 9.876,54")).toBeInTheDocument();
  });

  it("renders an optional hint below the value", () => {
    render(
      <SectionCards
        items={[{ title: "Prazo", value: "240 meses", hint: "Reduzido em 60" }]}
      />,
    );
    expect(screen.getByText("Reduzido em 60")).toBeInTheDocument();
  });

  it("renders an icon when provided", () => {
    const items: KpiCardData[] = [
      { title: "Vencedor", value: "Comprar", icon: TrendingUpIcon },
    ];
    const { container } = render(<SectionCards items={items} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders an up-trend delta in emerald color", () => {
    render(
      <SectionCards
        items={[
          {
            title: "Diferença",
            value: "R$ 50.000,00",
            delta: "+15%",
            trend: "up",
          },
        ]}
      />,
    );
    const delta = screen.getByTestId("kpi-delta");
    expect(delta).toHaveAttribute("data-trend", "up");
    expect(delta.className).toMatch(/text-emerald-600/);
    expect(delta).toHaveTextContent("+15%");
  });

  it("renders a down-trend delta in destructive color", () => {
    render(
      <SectionCards
        items={[
          {
            title: "Diferença",
            value: "-R$ 10.000,00",
            delta: "-5%",
            trend: "down",
          },
        ]}
      />,
    );
    const delta = screen.getByTestId("kpi-delta");
    expect(delta).toHaveAttribute("data-trend", "down");
    expect(delta.className).toMatch(/text-destructive/);
  });

  it("treats trend=neutral (or omitted) as muted color", () => {
    render(
      <SectionCards
        items={[
          {
            title: "Saldo",
            value: "R$ 0,00",
            delta: "estável",
          },
        ]}
      />,
    );
    const delta = screen.getByTestId("kpi-delta");
    expect(delta).toHaveAttribute("data-trend", "neutral");
    expect(delta.className).toMatch(/text-muted-foreground/);
  });

  it("omits the delta element when delta is missing", () => {
    render(
      <SectionCards
        items={[{ title: "Parcela base", value: "R$ 1.234,56" }]}
      />,
    );
    expect(screen.queryByTestId("kpi-delta")).toBeNull();
  });

  it("uses a 1 / 2 / 4 column responsive grid", () => {
    const { container } = render(
      <SectionCards items={[{ title: "A", value: "1" }]} />,
    );
    const grid = container.querySelector('[data-slot="section-cards"]');
    expect(grid).not.toBeNull();
    expect(grid?.className).toMatch(/grid-cols-1/);
    expect(grid?.className).toMatch(/@xl\/main:grid-cols-2/);
    expect(grid?.className).toMatch(/@5xl\/main:grid-cols-4/);
  });

  it("exposes a deterministic test-id per card derived from the title", () => {
    render(
      <SectionCards
        items={[
          { title: "Parcela base", value: "R$ 1,00" },
          { title: "Total de juros", value: "R$ 2,00" },
        ]}
      />,
    );
    expect(screen.getByTestId("kpi-card-parcela-base")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-card-total-de-juros")).toBeInTheDocument();
    expect(
      screen.getByTestId("kpi-card-parcela-base-value"),
    ).toHaveTextContent("R$ 1,00");
  });
});
