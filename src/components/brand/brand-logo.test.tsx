import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandLogo } from "@/components/brand/brand-logo";

describe("BrandLogo", () => {
  it("renders the wordmark image with the correct src and alt text", () => {
    render(<BrandLogo />);
    const img = screen.getByAltText("Calculadora Financeira.app");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/brand/logo-nome.svg");
  });

  it("applies the optional className", () => {
    render(<BrandLogo className="h-8 w-auto" />);
    expect(screen.getByAltText("Calculadora Financeira.app")).toHaveClass(
      "h-8",
      "w-auto",
    );
  });
});
