import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandMark } from "@/components/brand/brand-mark";

describe("BrandMark", () => {
  it("renders the mark image with the correct src and alt text", () => {
    render(<BrandMark />);
    const img = screen.getByAltText("Calculadora Financeira.app");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/brand/logo-mark.svg");
  });

  it("applies the optional className", () => {
    render(<BrandMark className="h-6 w-6" />);
    expect(screen.getByAltText("Calculadora Financeira.app")).toHaveClass(
      "h-6",
      "w-6",
    );
  });
});
