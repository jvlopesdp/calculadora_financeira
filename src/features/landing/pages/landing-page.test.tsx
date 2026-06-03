import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/features/landing/pages/landing-page";

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  it("renders the hero heading", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /decisões financeiras com clareza/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders the primary CTA pointing to /financiamento", () => {
    renderLanding();
    const cta = screen.getByRole("link", { name: /começar a simular/i });
    expect(cta).toHaveAttribute("href", "/financiamento");
  });

  it("renders the secondary CTA pointing to /login", () => {
    renderLanding();
    const cta = screen.getByRole("link", { name: /já tenho conta/i });
    expect(cta).toHaveAttribute("href", "/login");
  });

  it("renders the motivation block", () => {
    renderLanding();
    expect(
      screen.getByText(/nasceu de uma dor real/i),
    ).toBeInTheDocument();
  });

  it("renders a footer with the current year and an Entrar link", () => {
    renderLanding();
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()}`)),
    ).toBeInTheDocument();
    const footerLinks = screen.getAllByRole("link", { name: /^entrar$/i });
    expect(footerLinks.length).toBeGreaterThanOrEqual(1);
    expect(footerLinks[footerLinks.length - 1]).toHaveAttribute("href", "/login");
  });
});
