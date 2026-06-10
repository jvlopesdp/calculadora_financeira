interface VerifyEmailTemplateInput {
  url: string;
  name?: string;
  publicAppUrl: string;
}

interface ResetPasswordTemplateInput {
  url: string;
  name?: string;
  publicAppUrl: string;
}

interface RenderBrandedEmailInput {
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  closing: string;
  publicAppUrl: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Brand palette (see CLAUDE.md / PRD): vermelho-tijolo, creme, footer cinza.
const BRAND_RED = "#B94F45";
const BRAND_CREAM = "#F7EFE2";
const FOOTER_GRAY = "#7A7A7A";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function greeting(name?: string): string {
  const trimmed = name?.trim();
  return trimmed ? `Olá, ${trimmed}` : "Olá";
}

/**
 * Shared renderer for branded transactional emails. Produces HTML with CSS
 * exclusively inline (no <style> block) so it survives email clients, plus a
 * plain-text variant. All caller-supplied strings are HTML-escaped here — do
 * NOT pre-escape inputs or they will be double-encoded.
 *
 * The wordmark in `email-logo.png` is white (designed for dark backgrounds), so
 * it sits on a brand-red header band to stay legible inside the white card.
 */
export function renderBrandedEmail(input: RenderBrandedEmailInput): {
  html: string;
  text: string;
} {
  const { heading, intro, ctaLabel, ctaUrl, closing, publicAppUrl } = input;
  const safeHeading = escapeHtml(heading);
  const safeIntro = escapeHtml(intro);
  const safeCtaLabel = escapeHtml(ctaLabel);
  const safeCtaUrl = escapeHtml(ctaUrl);
  const safeClosing = escapeHtml(closing);
  const safeAppUrl = escapeHtml(publicAppUrl.replace(/\/+$/, ""));
  const year = new Date().getFullYear();

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:${BRAND_CREAM};">
    <div style="max-width:600px;margin:0 auto;padding:24px;font-family:${FONT};color:#111111;">
      <div style="background:#FFFFFF;border-radius:12px;padding:32px;border-top:4px solid ${BRAND_RED};">
        <div style="background:${BRAND_RED};border-radius:8px;padding:16px;text-align:center;margin-bottom:24px;">
          <img src="${safeAppUrl}/brand/email-logo.png" width="240" height="60" alt="Calculadora Financeira.app" style="display:inline-block;width:240px;height:60px;max-width:100%;border:0;" />
        </div>
        <h1 style="margin:0 0 16px;color:${BRAND_RED};font-size:24px;font-weight:700;font-family:${FONT};">${safeHeading}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.5;font-family:${FONT};">${safeIntro}</p>
        <p style="margin:0 0 24px;text-align:center;">
          <a href="${safeCtaUrl}" style="background:${BRAND_RED};color:#FFFFFF;padding:14px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;font-weight:700;font-family:${FONT};">${safeCtaLabel}</a>
        </p>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#555555;font-family:${FONT};">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.5;word-break:break-all;font-family:${FONT};"><a href="${safeCtaUrl}" style="color:${BRAND_RED};">${safeCtaUrl}</a></p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#555555;font-family:${FONT};">${safeClosing}</p>
      </div>
      <p style="margin:16px 0 0;text-align:center;color:${FOOTER_GRAY};font-size:13px;font-family:${FONT};">© ${year} Calculadora Financeira.app · <a href="${safeAppUrl}" style="color:${FOOTER_GRAY};">calculadorafinanceira.app</a></p>
    </div>
  </body>
</html>`;

  const text = `${heading}

${intro}

${ctaUrl}

${closing}

— Calculadora Financeira.app`;

  return { html, text };
}

export function verifyEmailTemplate({
  url,
  name,
  publicAppUrl,
}: VerifyEmailTemplateInput): EmailTemplate {
  const subject = "Confirme seu email — Calculadora Financeira";
  const { html, text } = renderBrandedEmail({
    heading: "Confirme seu email",
    intro: `${greeting(name)}, para começar a usar a Calculadora Financeira.app, confirme seu email clicando no botão abaixo.`,
    ctaLabel: "Confirmar email",
    ctaUrl: url,
    closing: "Se você não criou esta conta, pode ignorar esta mensagem.",
    publicAppUrl,
  });
  return { subject, html, text };
}

export function resetPasswordTemplate({
  url,
  name,
  publicAppUrl,
}: ResetPasswordTemplateInput): EmailTemplate {
  const subject = "Redefinir senha — Calculadora Financeira";
  const { html, text } = renderBrandedEmail({
    heading: "Redefinir senha",
    intro: `${greeting(name)}, recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha.`,
    ctaLabel: "Redefinir senha",
    ctaUrl: url,
    closing:
      "Este link expira em 1 hora. Se você não pediu para redefinir sua senha, ignore esta mensagem.",
    publicAppUrl,
  });
  return { subject, html, text };
}

export type {
  EmailTemplate,
  RenderBrandedEmailInput,
  VerifyEmailTemplateInput,
  ResetPasswordTemplateInput,
};
