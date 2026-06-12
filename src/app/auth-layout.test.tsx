import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthLayout } from "@/app/auth-layout";

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<div>login form</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthLayout", () => {
  it("renders the BrandLogo linking to the landing route", () => {
    renderLayout();
    const logos = screen.getAllByAltText("Calculadora Financeira.app");
    expect(logos.length).toBeGreaterThan(0);
    expect(logos[0].closest("a")).toHaveAttribute("href", "/");
  });

  it("renders the routed outlet content", () => {
    renderLayout();
    expect(screen.getByText("login form")).toBeInTheDocument();
  });
});
