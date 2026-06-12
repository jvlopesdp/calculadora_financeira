import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandLogo } from "@/components/brand/brand-logo";

describe("BrandLogo", () => {
  it("renders both light-mode and dark-mode wordmark images", () => {
    render(<BrandLogo />);
    const images = screen.getAllByAltText("Calculadora Financeira.app");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "/brand/logo-nome-light.svg");
    expect(images[1]).toHaveAttribute("src", "/brand/logo-nome.svg");
  });

  it("light-mode image is visible in light, hidden in dark", () => {
    render(<BrandLogo />);
    const [lightImg, darkImg] = screen.getAllByAltText(
      "Calculadora Financeira.app",
    );
    expect(lightImg).toHaveClass("dark:hidden");
    expect(darkImg).toHaveClass("dark:block");
  });

  it("applies the optional className to the wrapper span", () => {
    render(<BrandLogo className="h-8 w-auto" />);
    const wrapper = screen
      .getAllByAltText("Calculadora Financeira.app")[0]
      .closest("span");
    expect(wrapper).toHaveClass("h-8", "w-auto");
  });
});
