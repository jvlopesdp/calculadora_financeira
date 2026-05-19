interface VerifyEmailTemplateInput {
  url: string;
  name?: string;
}

interface ResetPasswordTemplateInput {
  url: string;
  name?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

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

export function verifyEmailTemplate({
  url,
  name,
}: VerifyEmailTemplateInput): EmailTemplate {
  const safeUrl = escapeHtml(url);
  const safeGreeting = escapeHtml(greeting(name));
  const subject = "Confirme seu email — Calculadora Financeira";
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
    <p>${safeGreeting},</p>
    <p>Para começar a usar a Calculadora Financeira, confirme seu email clicando no link abaixo:</p>
    <p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Confirmar email</a></p>
    <p>Se o botão não funcionar, copie e cole este endereço no navegador:</p>
    <p><a href="${safeUrl}">${safeUrl}</a></p>
    <p>Se você não criou esta conta, pode ignorar esta mensagem.</p>
    <p>— Equipe Calculadora Financeira</p>
  </body>
</html>`;
  const text = `${greeting(name)},

Para começar a usar a Calculadora Financeira, confirme seu email acessando o link abaixo:

${url}

Se você não criou esta conta, pode ignorar esta mensagem.

— Equipe Calculadora Financeira`;
  return { subject, html, text };
}

export function resetPasswordTemplate({
  url,
  name,
}: ResetPasswordTemplateInput): EmailTemplate {
  const safeUrl = escapeHtml(url);
  const safeGreeting = escapeHtml(greeting(name));
  const subject = "Redefinir senha — Calculadora Financeira";
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
    <p>${safeGreeting},</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta. Clique no link abaixo para escolher uma nova senha:</p>
    <p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Redefinir senha</a></p>
    <p>Se o botão não funcionar, copie e cole este endereço no navegador:</p>
    <p><a href="${safeUrl}">${safeUrl}</a></p>
    <p>Este link expira em 1 hora. Se você não pediu para redefinir sua senha, ignore esta mensagem.</p>
    <p>— Equipe Calculadora Financeira</p>
  </body>
</html>`;
  const text = `${greeting(name)},

Recebemos um pedido para redefinir a senha da sua conta. Acesse o link abaixo para escolher uma nova senha:

${url}

Este link expira em 1 hora. Se você não pediu para redefinir sua senha, ignore esta mensagem.

— Equipe Calculadora Financeira`;
  return { subject, html, text };
}

export type { EmailTemplate, VerifyEmailTemplateInput, ResetPasswordTemplateInput };
