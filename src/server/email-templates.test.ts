import { describe, expect, it } from "vitest";

import {
  changeEmailTemplate,
  renderBrandedEmail,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "./email-templates";

const APP_URL = "https://app.example.com";

describe("verifyEmailTemplate", () => {
  it("renders the branded HTML with logo, brand color and action url", () => {
    const url = `${APP_URL}/verify-email?token=abc123`;
    const { subject, html, text } = verifyEmailTemplate({
      url,
      name: "Ana",
      publicAppUrl: APP_URL,
    });

    expect(subject).toBe("Confirme seu email — Calculadora Financeira");
    expect(html).toContain("/brand/email-logo.png");
    expect(html).toContain("#B94F45");
    expect(html).toContain(url);
    // greeting + warning preserved
    expect(html).toContain("Olá, Ana");
    expect(html).toContain("Se você não criou esta conta");
    // text variant carries the raw url and branded signature
    expect(text).toContain(url);
    expect(text).toContain("— Calculadora Financeira.app");
  });
});

describe("resetPasswordTemplate", () => {
  it("renders the branded HTML with logo, brand color and action url", () => {
    const url = `${APP_URL}/reset-password?token=xyz789`;
    const { subject, html, text } = resetPasswordTemplate({
      url,
      name: "Bruno",
      publicAppUrl: APP_URL,
    });

    expect(subject).toBe("Redefinir senha — Calculadora Financeira");
    expect(html).toContain("/brand/email-logo.png");
    expect(html).toContain("#B94F45");
    expect(html).toContain(url);
    expect(html).toContain("Olá, Bruno");
    expect(html).toContain("Este link expira em 1 hora");
    expect(text).toContain(url);
    expect(text).toContain("— Calculadora Financeira.app");
  });
});

describe("changeEmailTemplate", () => {
  it("renders the branded HTML with logo, brand color, new email and action url", () => {
    const url = `${APP_URL}/verify-email?token=change-tok`;
    const { subject, html, text } = changeEmailTemplate({
      url,
      name: "Carla",
      newEmail: "new@example.com",
      publicAppUrl: APP_URL,
    });

    expect(subject).toBe(
      "Confirme a alteração de email — Calculadora Financeira",
    );
    expect(html).toContain("/brand/email-logo.png");
    expect(html).toContain("#B94F45");
    expect(html).toContain(url);
    expect(html).toContain("Olá, Carla");
    expect(html).toContain("new@example.com");
    expect(text).toContain(url);
    expect(text).toContain("— Calculadora Financeira.app");
  });

  it("escapes hostile newEmail content in the HTML output", () => {
    const url = `${APP_URL}/verify-email?token=t`;
    const { html } = changeEmailTemplate({
      url,
      name: "Carla",
      newEmail: '"><script>alert(1)</script>',
      publicAppUrl: APP_URL,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("escapeHtml is applied to url and name", () => {
  it("escapes a hostile url and name in the HTML output", () => {
    const url = `${APP_URL}/verify-email?token="><script>alert(1)</script>`;
    const { html } = verifyEmailTemplate({
      url,
      name: 'Ev"il',
      publicAppUrl: APP_URL,
    });

    // no raw script tag or unescaped quote from the injected payload
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('token="><');
    expect(html).not.toContain('Ev"il');
    // escaped forms are present instead
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Ev&quot;il");
  });

  it("escapes hostile input in the reset template too", () => {
    const url = `${APP_URL}/reset-password?token="><script>alert(1)</script>`;
    const { html } = resetPasswordTemplate({
      url,
      name: 'Ze"ro',
      publicAppUrl: APP_URL,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Ze&quot;ro");
  });
});

describe("renderBrandedEmail", () => {
  it("trims a trailing slash from publicAppUrl for asset and footer links", () => {
    const { html } = renderBrandedEmail({
      heading: "Olá",
      intro: "Texto",
      ctaLabel: "Clique",
      ctaUrl: `${APP_URL}/go`,
      closing: "Fim",
      publicAppUrl: `${APP_URL}/`,
    });

    expect(html).toContain(`${APP_URL}/brand/email-logo.png`);
    expect(html).not.toContain(`${APP_URL}//brand/email-logo.png`);
  });

  it("uses only inline styles (no <style> block)", () => {
    const { html } = renderBrandedEmail({
      heading: "Olá",
      intro: "Texto",
      ctaLabel: "Clique",
      ctaUrl: `${APP_URL}/go`,
      closing: "Fim",
      publicAppUrl: APP_URL,
    });

    expect(html).not.toContain("<style");
  });
});
