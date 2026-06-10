# PRD: Correção da verificação de e-mail, landing page pública e identidade visual

## 1. Introdução / Visão geral

Esta entrega resolve três frentes interligadas da Calculadora Financeira.app:

1. **Bug crítico de verificação de e-mail** — o link enviado por e-mail aponta para `/api/auth/verify-email?token=…&callbackURL=/login` (endpoint do Better Auth no Worker), mas o usuário cai em 404 e não consegue concluir o cadastro. O fluxo precisa terminar com o usuário em `/login` com confirmação visível de que o e-mail foi verificado.
2. **Landing page pública em `/`** — hoje a raiz redireciona direto para `/financiamento`, sem nenhuma camada de comunicação. Será criada uma landing mínima (hero + CTA + footer) que apresenta a proposta da ferramenta para visitantes não autenticados. Usuários já autenticados continuam indo direto para `/financiamento`.
3. **Identidade visual** — os ativos `logo-nome.svg`, `logo-calculadora-financeira.svg` e `icon-theme.svg` substituem placeholders (Vite logo) e padronizam a marca no header/sidebar, mobile, landing e favicon.

## 2. Goals

- Fluxo de cadastro → verificação de e-mail → login funciona ponta a ponta em produção (`calculadorafinanceira.app`), sem cair em 404.
- Visitante anônimo que acessa `/` vê uma landing page acolhedora com a proposta da ferramenta e um CTA claro para começar a simular.
- Usuário autenticado que acessa `/` continua indo direto para `/financiamento` (sem regressão no fluxo do app).
- Toda a identidade visual da aplicação (header desktop, sidebar, mobile, landing, página de auth, favicon, abas do navegador) usa os novos SVGs — nenhum vestígio do logo Vite.
- Type check, lint, build (SPA + Worker) e testes (Vitest) seguem passando.

## 3. User Stories

### US-001: Mover os SVGs para `public/brand/` e versionar

**Descrição:** Como desenvolvedor, quero os ativos da marca em uma pasta dedicada e estável, para que possam ser referenciados por caminhos absolutos do SPA (`/brand/...`) e servidos como assets estáticos pelo Worker.

**Acceptance Criteria:**
- [ ] Pasta nova `public/brand/` criada
- [ ] Arquivos movidos da raiz para `public/brand/`:
  - `logo-nome.svg` → `public/brand/logo-nome.svg`
  - `logo-calculadora-financeira.svg` → `public/brand/logo-mark.svg`
  - `icon-theme.svg` → `public/brand/icon.svg`
- [ ] Os SVGs antigos na raiz do repositório são removidos
- [ ] `public/vite.svg` é removido
- [ ] Build (`bun run build`) gera os assets em `dist/client/brand/` e o `wrangler deploy --dry-run` segue verde
- [ ] Typecheck e lint passam

---

### US-002: Substituir favicon e metadados em `index.html`

**Descrição:** Como visitante, quero ver o ícone correto na aba do navegador e o título da página alinhado à marca, para reconhecer a Calculadora Financeira.app imediatamente.

**Acceptance Criteria:**
- [ ] `index.html`:
  - `<link rel="icon">` aponta para `/brand/icon.svg` (`type="image/svg+xml"`)
  - `<link rel="apple-touch-icon" href="/brand/icon.svg">` adicionado
  - `<title>` atualizado para `Calculadora Financeira.app`
  - `<meta name="description">` adicionado com texto curto da proposta (1 frase, ≤ 160 chars)
  - `<meta name="theme-color" content="#B94F45">` (vermelho-tijolo do logo) adicionado
- [ ] Nenhuma referência a `/vite.svg` em todo o repositório (verificado com `grep -r "vite.svg" src/ index.html`)
- [ ] Build passa; ao abrir o app localmente, a aba mostra o ícone novo
- [ ] Verify in browser using dev-browser skill

---

### US-003: Criar componentes `BrandLogo` e `BrandMark`

**Descrição:** Como desenvolvedor, quero componentes React reutilizáveis para exibir a marca, para não duplicar `<img>` espalhados pelo código e centralizar tamanhos / acessibilidade.

**Acceptance Criteria:**
- [ ] Criar `src/components/brand/brand-logo.tsx` que renderiza `<img src="/brand/logo-nome.svg">` (versão horizontal com nome) com `alt="Calculadora Financeira.app"` e prop `className` para tamanho
- [ ] Criar `src/components/brand/brand-mark.tsx` que renderiza `<img src="/brand/logo-mark.svg">` (mark compacto) com `alt="Calculadora Financeira.app"` e prop `className` para tamanho
- [ ] Ambos componentes têm `loading="eager"` (são acima da dobra)
- [ ] Tipos estritos, sem `any`
- [ ] Typecheck, lint e testes passam

---

### US-004: Aplicar logos no header/sidebar do `AppShell` e na `AuthLayout`

**Descrição:** Como usuário, quero ver o logo da marca no topo/lateral do app e na tela de login, para ter clareza de onde estou.

**Acceptance Criteria:**
- [ ] No `AppShell` (sidebar ou header — onde quer que esteja hoje o nome/título), o placeholder atual é substituído por `<BrandLogo />` em desktop e `<BrandMark />` em mobile (breakpoint Tailwind, ex.: `hidden md:block` / `md:hidden`)
- [ ] No `AuthLayout`, `<BrandLogo />` aparece centralizado acima do `<Outlet />`
- [ ] Cliques no logo do `AppShell` levam para `/financiamento`
- [ ] Cliques no logo do `AuthLayout` levam para `/` (landing)
- [ ] Nenhuma string literal "Simulador Financeiro" ou logo antigo restante no header/sidebar/auth
- [ ] Typecheck, lint, build passam
- [ ] Testes do `AppShell` e `AuthLayout` (se existirem) continuam verdes — atualizar snapshots/queries se quebrarem
- [ ] Verify in browser using dev-browser skill (desktop + mobile via DevTools)

---

### US-005: Corrigir as URLs dos e-mails de verificação e de reset de senha

**Descrição:** Como usuário recém-cadastrado (ou que esqueceu a senha), quero que os links dos e-mails me levem até páginas funcionais que processam meu pedido e me direcionam para a tela certa em seguida.

**Contexto técnico:**
- A SPA já tem `src/features/auth/pages/verify-email-page.tsx` mapeada em `/verify-email`, que extrai `token` da query, chama `authClient.verifyEmail({ query: { token } })` e redireciona para `/login` em caso de sucesso.
- A SPA já tem `src/features/auth/pages/reset-password-page.tsx` mapeada em `/reset-password`, que aceita `token` na query.
- O Better Auth, por padrão, gera `url = ${baseURL}/api/auth/verify-email?token=…&callbackURL=…` no callback `sendVerificationEmail` (`src/server/auth.ts:62-64`) — e provavelmente faz o equivalente em `sendResetPassword`. Esse endpoint do Worker é o que está retornando algo que cai no fallback do SPA (404).
- A correção é apontar os dois links de e-mail para as rotas SPA correspondentes (`/verify-email?token=…` e `/reset-password?token=…`), deixando o processamento acontecer client-side (já implementado).

**Acceptance Criteria:**
- [ ] Em `src/server/auth.ts`:
  - Dentro de `emailVerification.sendVerificationEmail`, a `url` repassada ao `verifyEmailTemplate` é reescrita para `${PUBLIC_APP_URL}/verify-email?token=${token}` (preservando `callbackURL` se presente na URL original)
  - Dentro de `sendResetPassword` (ou callback equivalente do Better Auth), a `url` repassada ao `resetPasswordTemplate` é reescrita para `${PUBLIC_APP_URL}/reset-password?token=${token}`
- [ ] `token` vem preferencialmente do argumento do callback do Better Auth; se não estiver disponível como parâmetro nomeado, é extraído da `url` original via `URL` API
- [ ] `PUBLIC_APP_URL` é nova var de ambiente, definida em `wrangler.jsonc` e tipada em `src/server/env.d.ts`: `https://calculadorafinanceira.app` em prod, `http://localhost:5173` em dev local
- [ ] Testes novos em `src/server/auth.test.ts` (criar se não existir) validam:
  - URL do verify-email começa com `${PUBLIC_APP_URL}/verify-email?token=`
  - URL do reset-password começa com `${PUBLIC_APP_URL}/reset-password?token=`
- [ ] Smoke manual ponta a ponta:
  - signup → recebe e-mail → clica no link → cai em `/verify-email?token=…` → vê "Email verificado! Redirecionando para o login…" → cai em `/login` em ≤ 2s
  - forgot-password → recebe e-mail → clica no link → cai em `/reset-password?token=…` → consegue trocar a senha
- [ ] Typecheck, lint, build (SPA + Worker) passam
- [ ] `wrangler deploy --dry-run` passa
- [ ] Verify in browser using dev-browser skill

---

### US-006: Mostrar toast/mensagem "E-mail verificado" em `/login` após verificação

**Descrição:** Como usuário, quando chego em `/login` vindo da verificação de e-mail, quero uma confirmação visível para saber que posso entrar normalmente.

**Acceptance Criteria:**
- [ ] `VerifyEmailPage` ao redirecionar para `/login` passa um query param `?verified=1` (ou `state` do `navigate`)
- [ ] `LoginPage` detecta o sinal e exibe um banner/aviso de sucesso ("Seu e-mail foi verificado. Entre com seu acesso.") acima do formulário, com `role="status"` e contraste adequado
- [ ] O banner some ao submeter o formulário ou após 8s
- [ ] Sem regressão nos testes existentes de `login-page.test.tsx`
- [ ] Novo teste em `login-page.test.tsx` cobre o caso "renderiza banner quando query string contém `verified=1`"
- [ ] Typecheck, lint, testes passam
- [ ] Verify in browser using dev-browser skill

---

### US-007: Aplicar identidade visual nos templates de e-mail

**Descrição:** Como usuário recebendo um e-mail transacional da Calculadora Financeira.app, quero que ele tenha a cara da marca — logo, cores, tipografia — para reconhecer a origem e ter a mesma sensação de cuidado que tenho no produto.

**Contexto técnico:**
- Os templates atuais (`src/server/email-templates.ts`) usam HTML mínimo, fundo branco e um botão com cor neutra (`#0f172a`). Sem logo, sem cores da marca, sem rodapé branded.
- Clientes de e-mail (especialmente Outlook) têm suporte irregular a SVG; o padrão sólido é PNG hospedado em URL pública.
- Será preciso versionar um PNG do logo em `public/brand/email-logo.png` (exportado do `logo-nome.svg`, ≈ 480×120 px @2x para ficar nítido em telas retina; renderizado em 240×60 no HTML). Caso o usuário não consiga gerar agora, o template degrada graciosamente para o texto "Calculadora Financeira.app" estilizado.

**Acceptance Criteria:**
- [ ] Versionar `public/brand/email-logo.png` exportado de `logo-nome.svg` (≈ 480×120 px com fundo transparente). Se a exportação não estiver disponível na entrega, abrir issue separada e usar fallback textual com `display:none` na `<img>`
- [ ] Refatorar `src/server/email-templates.ts` extraindo um helper `renderBrandedEmail({ heading, intro, ctaLabel, ctaUrl, body, footerNote })` que retorna `{ html, text }` para evitar duplicação entre `verifyEmailTemplate` e `resetPasswordTemplate`
- [ ] O HTML gerado pelo helper deve conter, com **CSS apenas inline** (sem `<style>` blocks):
  - Body com `background:#F7EFE2` (creme) e `color:#1F1F1F`
  - Card centralizado de `max-width:600px`, fundo `#FFFFFF`, `border-radius:12px`, `padding:32px`, `margin:32px auto`
  - Header com `<img src="${PUBLIC_APP_URL}/brand/email-logo.png" width="240" height="60" alt="Calculadora Financeira.app">` centralizado
  - Faixa de acento `border-top:4px solid #B94F45` no topo do card
  - Título `<h1>` em `color:#B94F45`, `font-size:24px`, `font-weight:700`
  - Botão CTA com `background:#B94F45`, `color:#FFFFFF`, `padding:14px 24px`, `border-radius:8px`, `text-decoration:none`, `display:inline-block`
  - Link textual de fallback abaixo do botão (mesma URL)
  - Footer com `color:#7A7A7A`, `font-size:13px`: `© ${ano} Calculadora Financeira.app · <a href="${PUBLIC_APP_URL}">calculadorafinanceira.app</a>`
  - `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- [ ] `verifyEmailTemplate` e `resetPasswordTemplate` passam a usar o helper, mantendo:
  - Subjects atuais
  - Saudação personalizada com `name` (escape preservado via `escapeHtml`)
  - Variante `text` (plain text fallback) mantida e atualizada com a mesma linha de assinatura branded
  - Mesmo aviso "Se você não criou esta conta..." no verify e "Este link expira em 1 hora..." no reset
- [ ] Helper recebe `publicAppUrl` por parâmetro (não hardcoded) — vem do env já tipado na US-005
- [ ] Novo arquivo `src/server/email-templates.test.ts` cobre:
  - HTML do verify contém `/brand/email-logo.png`, `#B94F45` e a URL passada no `url`
  - HTML do reset contém `/brand/email-logo.png`, `#B94F45` e a URL passada no `url`
  - `escapeHtml` continua sendo aplicado em `url` e `name` (proteção contra XSS no HTML)
  - Variantes `text` contêm a URL crua e a assinatura "— Calculadora Financeira.app"
- [ ] Snapshot opcional de cada template para detectar regressões visuais futuras
- [ ] Renderização sanity-check num cliente real durante a smoke (US-009): Gmail web + um cliente mobile (Gmail app ou Apple Mail)
- [ ] Typecheck, lint, Vitest, build, `wrangler deploy --dry-run` passam

---

### US-008: Liberar `/` para visitantes anônimos e criar a `LandingPage`

**Descrição:** Como visitante, quero entender em segundos o que a Calculadora Financeira.app faz e por que ela existe, com um CTA claro para começar a usar.

**Acceptance Criteria:**
- [ ] Criar `src/features/landing/pages/landing-page.tsx` exportando `LandingPage`
- [ ] Layout da landing (mobile-first, Tailwind, shadcn primitives):
  1. **Header simples (público)**: `<BrandLogo />` à esquerda, botões `Entrar` (link `/login`) e `Criar conta` (link `/register`) à direita
  2. **Hero**: título grande "Decisões financeiras com clareza", subtítulo de 1–2 linhas adaptado do texto da motivação, e CTA primário "Começar a simular" (link `/financiamento`) + CTA secundário "Já tenho conta" (link `/login`)
  3. **Bloco de motivação** (1 seção): parágrafo curto resumindo o porquê da ferramenta (versão condensada do texto fornecido — máx. 3 frases)
  4. **Footer simples**: copyright + ano dinâmico (`new Date().getFullYear()`) + link discreto para `/login` + link placeholder para `/privacidade` (rota a ser criada como página estática "em breve" — sem conteúdo legal real nesta entrega; meta `noindex` para não vazar no Google)
- [ ] Paleta usa as cores da marca (`#B94F45` vermelho-tijolo como acento primário, `#E7A93F` amarelo-mostarda como destaque, `#CBBBA3` bege como fundo suave, `#F7EFE2` creme como background)
- [ ] Em `src/app/routes.tsx`, a rota `/` deixa de ser `<Navigate to="/financiamento" />` e passa a renderizar um componente wrapper que: se o usuário **está autenticado** → `<Navigate to="/financiamento" replace />`; se **não autenticado** → `<LandingPage />`
- [ ] O check de autenticação reusa o hook já existente da feature `auth` (ex.: `useSession()` do `authClient`); enquanto a sessão carrega, mostra estado neutro (spinner ou nada — não causa flicker para a landing nem para o app)
- [ ] Testes em `landing-page.test.tsx`:
  - Renderiza hero, CTA primário, motivação e footer
  - Botão "Começar a simular" tem `href="/financiamento"`
- [ ] Testes em `App.test.tsx` ou novo arquivo cobrem:
  - Visitante anônimo em `/` vê a `LandingPage`
  - Usuário autenticado em `/` é redirecionado para `/financiamento`
- [ ] Typecheck, lint, build, testes passam
- [ ] Verify in browser using dev-browser skill (rota `/` anônimo e autenticado)

---

### US-009: Smoke ponta a ponta em ambiente local

**Descrição:** Como desenvolvedor, quero validar o fluxo completo num único caminho antes de subir, para evitar regressões cruzadas entre as frentes.

**Acceptance Criteria:**
- [ ] Sessão limpa (cookies apagados / aba anônima) em `bun run dev`:
  - Acessar `/` → vê a landing com logo novo, CTAs e link de privacidade no footer
  - Clicar em "Criar conta" → vai para `/register`, logo correto no `AuthLayout`
  - Cadastrar → recebe e-mail (Resend dev/stage) com **identidade visual aplicada** (logo no topo, botão `#B94F45`, fundo creme, footer branded)
  - Clicar no link do e-mail → cai em `/verify-email?token=…` → mostra "Email verificado!" → redireciona para `/login`
  - Em `/login`, vê banner "Seu e-mail foi verificado"
  - Login → cai em `/financiamento`; acessar `/` agora redireciona para `/financiamento`
- [ ] Forgot-password flow: solicitar reset → recebe e-mail branded → clicar no link cai em `/reset-password?token=…` → consegue trocar a senha
- [ ] Inspecionar o HTML do e-mail recebido em Gmail web e em pelo menos um cliente mobile (Gmail app ou Apple Mail) confirmando que logo renderiza e botão CTA mantém cor da marca
- [ ] Favicon novo aparece na aba do navegador
- [ ] Mobile view (Chrome DevTools ≤ 767 px) usa `BrandMark` no header e o hero da landing está legível
- [ ] Lint + typecheck + Vitest + `wrangler deploy --dry-run` verdes

## 4. Functional Requirements

- **FR-1:** Os e-mails transacionais devem apontar para rotas SPA (`/verify-email?token=…` e `/reset-password?token=…`), **não** para os endpoints crus do Better Auth.
- **FR-2:** A `VerifyEmailPage` deve redirecionar para `/login?verified=1` após sucesso (aproveitando o `navigate` já existente).
- **FR-3:** A `LoginPage` deve exibir banner de confirmação quando `?verified=1` estiver presente.
- **FR-4:** A rota `/` deve renderizar `LandingPage` para usuários anônimos e redirecionar para `/financiamento` para usuários autenticados.
- **FR-5:** A `LandingPage` deve conter header público, hero com CTA primário/secundário, bloco de motivação e footer simples (incluindo link placeholder para `/privacidade`).
- **FR-6:** Os SVGs da marca devem residir em `public/brand/` e serem referenciados via caminhos absolutos (`/brand/...`); o PNG do logo para e-mails deve viver em `public/brand/email-logo.png`.
- **FR-7:** `index.html` deve usar `/brand/icon.svg` como favicon, ter `<title>` e `<meta description>` da marca, e `<meta theme-color>` definido.
- **FR-8:** Os componentes `BrandLogo` e `BrandMark` em `src/components/brand/` devem ser os únicos pontos de exibição da marca no SPA; nenhum `<img src="/brand/logo*.svg">` solto em outras partes do código.
- **FR-9:** Os templates de `verifyEmailTemplate` e `resetPasswordTemplate` devem usar um helper compartilhado `renderBrandedEmail`, com CSS inline, paleta da marca (`#B94F45`, `#F7EFE2`, `#FFFFFF`) e logo PNG hospedado em `${PUBLIC_APP_URL}/brand/email-logo.png`.
- **FR-10:** A rota placeholder `/privacidade` deve existir e renderizar uma página "em breve" com `<meta name="robots" content="noindex">`.
- **FR-11:** Build (SPA + Worker), typecheck, lint, Vitest e `wrangler deploy --dry-run` devem permanecer verdes.

## 5. Non-Goals (fora de escopo)

- Múltiplas seções de marketing na landing (features detalhadas, screenshots, FAQ, depoimentos) — fica para iteração futura.
- Conteúdo legal real da política de privacidade — `/privacidade` é apenas placeholder nesta entrega.
- Internacionalização (i18n) da landing e dos e-mails — entrega 100% pt-BR.
- Open Graph / Twitter Cards / SEO avançado — só o `<title>` e `<meta description>` básicos nesta entrega.
- Logo animado, dark mode dedicado da marca, ou variações coloridas — usar os SVGs como entregues.
- Templates de e-mail com dark mode (`@media (prefers-color-scheme: dark)` em e-mail é frágil; ficará para depois).
- E-mails de welcome, onboarding ou marketing — apenas verify-email e reset-password recebem o branding nesta entrega.
- Testes e2e (Playwright/Cypress) — a verificação ponta a ponta da US-009 é manual.
- Refatorar o fluxo de Better Auth para deep linking server-side; a correção é apontar os e-mails para as rotas SPA já existentes.
- Mudar qualquer regra de cálculo financeiro (`core/finance/`) ou esquema do D1.

## 6. Design Considerations

- **Cores da marca** (extraídas dos SVGs):
  - Vermelho-tijolo `#B94F45` — primário / acentos / CTAs
  - Amarelo-mostarda `#E7A93F` — destaques secundários
  - Bege `#CBBBA3` — fundos suaves / cards
  - Creme `#F7EFE2` — background da landing
- **Tipografia**: usa a fonte padrão já configurada no Tailwind; títulos do hero em peso bold, tamanho responsivo (`text-4xl md:text-6xl`).
- **Logos**:
  - `BrandLogo` (`/brand/logo-nome.svg`) — sempre que houver espaço horizontal generoso (sidebar desktop, header da landing, AuthLayout, footer).
  - `BrandMark` (`/brand/logo-mark.svg`) — header mobile, ícones em estados compactos.
- **Breakpoint do logo no header do `AppShell`**: usar `< md` (Tailwind `md = 768px`) como ponto de corte: `hidden md:block` para `BrandLogo` e `md:hidden` para `BrandMark`. **Justificativa:** abaixo de 768px (tablets pequenos e celulares), o logo horizontal com nome compete por espaço com o trigger do menu mobile e o nav-user; o mark compacto preserva a marca sem competir. Acima de 768px há espaço de sobra. Esse mesmo breakpoint já é convenção em todo o app Tailwind, então não introduz uma nova régua mental.
- **Favicon** (`/brand/icon.svg`) — versão circular com a marca dentro; serve também como Apple touch icon.
- **Templates de e-mail** (regras específicas para `renderBrandedEmail`):
  - CSS exclusivamente inline; **nenhum** `<style>` ou classe externa (Gmail/Outlook descartam).
  - Layout em `<table>` ou `<div>` com `max-width:600px`, `margin:auto`, mobile-first.
  - Logo PNG hospedado em `${PUBLIC_APP_URL}/brand/email-logo.png` com `width`/`height` explícitos no atributo HTML (não só em CSS — Outlook precisa).
  - Paleta restrita: `#B94F45` (CTA + faixa de acento), `#F7EFE2` (body bg), `#FFFFFF` (card bg), `#1F1F1F` (texto), `#7A7A7A` (footer).
  - Fonte: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (sem webfonts em e-mail).
  - Variante `text` sempre acompanha o HTML — alguns provedores entregam só plain text.
- **shadcn**: reutilizar `Button` para os CTAs da landing. Não criar componentes novos de UI fora de `src/components/brand/`.
- **Acessibilidade**: alt-text consistente nas imagens; banner de "verified" com `role="status"` (já é o padrão usado em `verify-email-page.tsx`); contraste mínimo AA nos textos sobre o creme; nos e-mails, garantir contraste do CTA (`#FFFFFF` sobre `#B94F45` passa AA).

## 7. Technical Considerations

- **Better Auth `sendVerificationEmail` / `sendResetPassword`**: os callbacks recebem `{ user, url, token }` (verificar assinatura no Better Auth). Preferir usar o `token` diretamente para montar a URL canônica em vez de fazer parse da `url` original.
- **`PUBLIC_APP_URL`**: variável de ambiente nova em `wrangler.jsonc` (vars). Em local dev, default para `http://localhost:5173`. Em produção, `https://calculadorafinanceira.app`. Tipar em `src/server/env.d.ts`.
- **Detecção de sessão na rota `/`**: usar `authClient.useSession()` (Better Auth React hook) — se ainda não estiver exposto, criar wrapper em `src/lib/auth-client.ts`. Evitar duplicar lógica que já existe em `ProtectedRoute`.
- **Migrations / D1**: nenhuma alteração de schema nesta entrega.
- **Assets em produção**: o Worker já serve `public/` como assets estáticos via cloudflare/vite-plugin — basta versionar os SVGs em `public/brand/`. O PNG do logo de e-mail é servido pela mesma rota; clientes de e-mail externos precisam acessar a URL pública, então a URL completa (`${PUBLIC_APP_URL}/brand/email-logo.png`) é obrigatória — caminho relativo não funciona em e-mail.
- **Renomeação de arquivo**: `logo-calculadora-financeira.svg` → `logo-mark.svg` ao mover para `public/brand/` (confirmado pelo usuário).
- **PNG para e-mail**: o SVG `logo-nome.svg` precisa ser exportado para PNG em ≈ 480×120 px com fundo transparente. Pode ser feito com qualquer ferramenta de design (Figma, Inkscape, `rsvg-convert`). Se o desenvolvedor não puder gerar na hora, abrir issue separada e usar fallback textual; rastreado nas open questions.
- **Helper `renderBrandedEmail`**: centraliza o boilerplate HTML para evitar drift entre `verify` e `reset`. Assinatura sugerida: `(input: { heading: string; intro: string; ctaLabel: string; ctaUrl: string; closing: string; publicAppUrl: string }) => { html: string; text: string }`.

## 8. Success Metrics

- Zero ocorrências de cadastros que receberam o e-mail mas não conseguiram fazer login por causa de 404 (medido por logs do Worker no Cloudflare durante a primeira semana após deploy).
- Tempo de carregamento da landing `/` em < 2s no Lighthouse (mobile 4G simulado).
- Nenhuma referência ao Vite (logo ou título) no produto.
- A entrega cabe em uma única PR mergeada para `main` e o deploy automático segue verde no CI.

## 9. Open Questions

### Resolvidas

- ~~Renomear `logo-calculadora-financeira.svg` → `logo-mark.svg`?~~ **Sim** — refletido na US-001 e na Technical Considerations.
- ~~Link de política de privacidade no footer da landing?~~ **Sim, como placeholder** — refletido na US-008 (FR-5 / FR-10): rota `/privacidade` com página "em breve" e `noindex`.
- ~~Breakpoint do `BrandLogo` em mobile?~~ **Resolvido em Design Considerations** — `< md` (768px) usa `BrandMark`; `≥ md` usa `BrandLogo`.
- ~~E-mail de reset de senha tem o mesmo bug?~~ **Tratado preventivamente** — US-005 estendida para corrigir as duas URLs (verify + reset) no mesmo passo.

### Pendentes

- O desenvolvedor consegue exportar `email-logo.png` a partir do `logo-nome.svg` durante a implementação, ou é preciso pedir o asset ao designer? Se ficar bloqueado, a US-007 prevê fallback textual.
- Existe ambiente de staging com Resend para testar o envio real dos e-mails antes do deploy em produção? Se não, a smoke da US-009 valida só em dev local + inspeção do HTML enviado para uma conta de teste.
- A página `/privacidade` deve ter prazo definido para receber conteúdo real (com Termos de Uso à parte), ou fica como TODO sem data?
