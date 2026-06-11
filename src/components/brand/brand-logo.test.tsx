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

  it("renders the wordmark over a themed contrast strip (never on white)", () => {
    render(<BrandLogo />);
    const strip = screen.getByAltText("Calculadora Financeira.app")
      .parentElement;
    expect(strip).not.toBeNull();
    // Uses the theme token (bg-primary) so light/dark stay legible — no hardcoded color.
    expect(strip).toHaveClass("bg-primary");
  });

  it("merges an optional containerClassName onto the strip", () => {
    render(<BrandLogo containerClassName="px-6" />);
    const strip = screen.getByAltText("Calculadora Financeira.app")
      .parentElement;
    expect(strip).toHaveClass("bg-primary", "px-6");
  });
});
