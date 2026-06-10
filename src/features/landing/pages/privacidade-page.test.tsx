import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PrivacidadePage } from "@/features/landing/pages/privacidade-page";

function renderPrivacidade() {
  return render(
    <MemoryRouter initialEntries={["/privacidade"]}>
      <PrivacidadePage />
    </MemoryRouter>,
  );
}

describe("PrivacidadePage", () => {
  it("renders the title and placeholder paragraph", () => {
    renderPrivacidade();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /política de privacidade/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/será atualizada em breve/i),
    ).toBeInTheDocument();
  });

  it("renders a 'Voltar para o início' link pointing to /", () => {
    renderPrivacidade();
    const back = screen.getByRole("link", { name: /voltar para o início/i });
    expect(back).toHaveAttribute("href", "/");
  });

  it("inserts a robots noindex meta tag on mount and removes it on unmount", () => {
    const { unmount } = renderPrivacidade();
    const meta = document.head.querySelector('meta[name="robots"]');
    expect(meta).not.toBeNull();
    expect(meta).toHaveAttribute("content", "noindex");

    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
