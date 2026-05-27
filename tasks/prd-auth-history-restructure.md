# PRD: Autenticação, Persistência em D1 e Reestruturação de Abas

## 1. Introdução / Visão Geral

A plataforma atual é um simulador 100% browser-based (localStorage) com uma única visão que mistura simulação de financiamento, faturas e comparação "alugar x financiar". Esta evolução tem três frentes:

1. **Reestruturação de navegação:** trocar o layout atual single-page por um **dashboard com sidebar** (base no bloco `dashboard-01` do shadcn) com três áreas: (a) simulação de financiamento, (b) histórico mês a mês com persistência, (c) comparação alugar x financiar.
2. **Novas funcionalidades de cálculo:** trocar o input "valor extra" por "valor fixo da parcela mensal desejada"; reimplementar a aba alugar x financiar com lógica equivalente à da [Calculadora do Investidor Sardinha](https://investidorsardinha.r7.com/calculadoras/calculadora-alugar-x-financiar/).
3. **Backend e autenticação:** introduzir auth self-hosted multi-usuário (sem depender de Clerk/Auth0/Supabase/Firebase) rodando em Cloudflare Workers + Hono, com Better Auth como biblioteca de autenticação, Cloudflare D1 como banco, Cloudflare Turnstile como proteção anti-bot e **Resend** como provedor de e-mails transacionais (verificação de email e reset de senha).

Isto altera a premissa "No login, no backend, no remote database" do `CLAUDE.md`, que deverá ser atualizado.

### Stack alvo (decidida)

- **Frontend:** React + Vite + TypeScript + shadcn/ui + DiceUI; **layout base no bloco `dashboard-01` do shadcn** (`npx shadcn@latest add dashboard-01` — sidebar + header + cards + charts + data table)
- **Backend:** Cloudflare Workers + **Hono**
- **Auth (biblioteca, não serviço):** **Better Auth** (≥ 1.5, com suporte nativo ao D1)
- **Banco:** Cloudflare D1 (com migrations versionadas via Wrangler)
- **Sessões:** cookie HttpOnly + tabela `sessions` no D1 (gerenciada pelo Better Auth)
- **Anti-bot:** Cloudflare Turnstile no cadastro e login
- **E-mails transacionais:** **Resend API** (verificação de email e reset de senha)
- **IaC:** `wrangler.jsonc`/`wrangler.toml` + arquivos SQL de migration; Terraform opcional
- **Runtime/Pkg manager:** Bun
- **Domínio de produção:** `calculadorafinanceira.app` (gerenciado no Cloudflare — DNS + certificado automático via Cloudflare)
- **Variáveis de ambiente:** documentadas em `.env.example` (commitado); valores reais em `.env.local` (gitignored) ou Worker secrets (`wrangler secret put`)

## 2. Objetivos

- Permitir cadastro e login de múltiplos usuários sem depender de provedor terceiro (Auth0, Clerk, Supabase, Firebase) — usando Better Auth como biblioteca self-hosted no Worker.
- Persistir cenários de financiamento e histórico de pagamentos reais em Cloudflare D1, associados ao usuário autenticado.
- Remodelar o frontend como dashboard com sidebar (base `dashboard-01` do shadcn), separando as três visões em rotas dedicadas sem perda de funcionalidades existentes.
- Substituir o input "valor extra mensal" por "valor fixo da parcela mensal desejada" na aba de financiamento.
- Implementar uma calculadora alugar x financiar mais completa, comparável à do Investidor Sardinha.
- Implementar uma nova aba "Histórico" que permita registrar pagamentos reais mês a mês e simular cenários hipotéticos sobre o saldo atual.
- Manter `core/finance` puro: todos os novos cálculos vivem no engine, não em componentes.

## 3. User Stories

> Cada US deve caber em uma sessão focada. Critérios de aceite são verificáveis. Stories com UI exigem verificação via dev-browser.

### Épico A — Backend Cloudflare (Workers + Hono + D1) e Autenticação (Better Auth)

#### US-A01: Setup do Cloudflare Workers + Hono + D1
**Description:** Como desenvolvedor, preciso de uma infraestrutura mínima de Worker + Hono + D1 para hospedar a API e o banco.

**Acceptance Criteria:**
- [ ] `wrangler.jsonc` (ou `wrangler.toml`) configurado com binding D1 (`DB`) e binding de assets do Vite
- [ ] Worker roda **Hono** como framework de roteamento, servindo a SPA buildada e expondo rotas `/api/*`
- [ ] Tipagem `Bindings` (env do Worker) compartilhada via `Hono<{ Bindings: Env }>`
- [ ] Comando `bun run dev` roda Vite + Worker localmente (via `@cloudflare/vite-plugin` ou `wrangler dev` integrado)
- [ ] D1 local (SQLite) funcionando com `wrangler d1 execute --local`
- [ ] CI passa com `wrangler deploy --dry-run`
- [ ] Endpoint `GET /api/health` retorna `{ ok: true }` como smoke test
- [ ] Typecheck e lint passam

#### US-A02: Migrações D1 — schema base do Better Auth + domínio
**Description:** Como desenvolvedor, preciso de migrações versionadas para o D1 cobrindo o schema do Better Auth e as tabelas de domínio.

**Acceptance Criteria:**
- [ ] Diretório `migrations/` com `0001_better_auth.sql` (tabelas exigidas pelo Better Auth: `user`, `session`, `account`, `verification`)
- [ ] Schema gerado/validado via `better-auth CLI` (`generate` / `migrate`), commitado como SQL puro
- [ ] Scripts npm/bun: `db:migrate:local`, `db:migrate:remote`, `db:generate` (chama Better Auth CLI)
- [ ] Documentação em `docs/schema.md` listando as tabelas e responsabilidades
- [ ] Typecheck passa

#### US-A03: Integração do Better Auth no Worker (Hono)
**Description:** Como desenvolvedor, quero o Better Auth montado em `/api/auth/*` no Worker, usando D1 como storage e cookies como mecanismo de sessão.

**Acceptance Criteria:**
- [ ] `auth.ts` instancia `betterAuth({ database: { provider: 'd1', binding: env.DB }, ... })`
- [ ] Configurado com:
  - email/senha habilitado
  - `requireEmailVerification: true`
  - cookies `HttpOnly`, `Secure`, `SameSite=Lax`
  - `trustedOrigins` apontando para o domínio de produção e localhost
  - duração de sessão 30 dias com refresh
- [ ] Hono monta handler do Better Auth: `app.on(['POST','GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))`
- [ ] Middleware Hono `requireUser` que valida sessão (via `auth.api.getSession`) e bloqueia com 401 quando ausente
- [ ] Aplicado em todas as rotas `/api/*` exceto `/api/auth/*` e `/api/health`
- [ ] Testes (vitest-pool-workers ou miniflare) cobrindo: sessão válida passa, sessão ausente bloqueia, sessão expirada bloqueia
- [ ] Typecheck e lint passam

#### US-A04: Cliente Better Auth no frontend
**Description:** Como desenvolvedor, quero um cliente tipado do Better Auth no React para chamar register/login/logout/email-verify.

**Acceptance Criteria:**
- [ ] `lib/auth-client.ts` instancia `createAuthClient({ baseURL: '/' })`
- [ ] Hook `useSession()` provido pelo cliente do Better Auth exposto via `useCurrentUser()` (wrapper local)
- [ ] Hook expõe `{ user, isLoading, error }` e revalida em foco da janela
- [ ] Tipos do `user` derivados do schema do Better Auth (sem `any`)
- [ ] Testes do wrapper com mock do cliente
- [ ] Typecheck e lint passam

#### US-A05: UI de cadastro com Cloudflare Turnstile
**Description:** Como visitante, quero criar uma conta com email + senha protegida contra bots.

**Acceptance Criteria:**
- [ ] Rota `/register` com formulário (shadcn `Form` + `react-hook-form` + `zod`)
- [ ] Campos: email, senha, confirmação de senha; validação client (zod) e bloqueio se inválido
- [ ] Widget **Cloudflare Turnstile** renderizado abaixo do formulário; submit desabilitado até resolver
- [ ] Token do Turnstile enviado no payload de signup
- [ ] Worker valida o token via `siteverify` antes de chamar `auth.api.signUpEmail`; 400 em falha
- [ ] Em sucesso: tela "Verifique seu email" com instrução para clicar no link enviado
- [ ] Erros de servidor (email em uso, Turnstile inválido) exibidos inline
- [ ] Variáveis de ambiente `TURNSTILE_SITE_KEY` (público) e `TURNSTILE_SECRET_KEY` (Worker secret) documentadas
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-A06: UI de login com Turnstile e proteção contra brute-force
**Description:** Como usuário cadastrado, quero fazer login com email/senha de forma segura.

**Acceptance Criteria:**
- [ ] Rota `/login` com formulário (shadcn + zod)
- [ ] Widget Turnstile exibido após N tentativas falhas na mesma sessão de navegador (ou sempre, decidir na implementação)
- [ ] Submit chama `authClient.signIn.email({ email, password })`
- [ ] Em sucesso: redireciona para `/financiamento`
- [ ] Mensagens de erro distintas para "credenciais inválidas" vs "email não verificado" vs "rate limit"
- [ ] Link "esqueci minha senha" leva para US-A09
- [ ] Layout protegido redireciona para `/login` quando `useCurrentUser()` retorna `null`
- [ ] Header com botão "sair" invoca `authClient.signOut()`
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-A07: E-mails transacionais via Resend
**Description:** Como sistema, preciso enviar e-mails de verificação de cadastro e reset de senha usando a API do Resend.

**Acceptance Criteria:**
- [ ] Pacote `resend` adicionado às dependências
- [ ] `RESEND_API_KEY` configurado como Worker secret (`wrangler secret put RESEND_API_KEY`); `EMAIL_FROM` como var de ambiente (ex.: `no-reply@<dominio>`)
- [ ] Função `sendEmail({ to, subject, html, text })` em `src/server/email.ts` chama `resend.emails.send({ from: env.EMAIL_FROM, ... })`
- [ ] Better Auth configurado com `emailVerification.sendVerificationEmail` e `sendResetPassword` apontando para essa função
- [ ] Templates HTML simples e responsivos para verificação e reset (string templating; sem dependência adicional de lib de templates)
- [ ] Domínio remetente verificado no Resend (DKIM/SPF/return-path) — passos documentados em `docs/deploy.md`
- [ ] Em dev local, fallback que loga email no console quando `RESEND_API_KEY` não está definido (sem enviar)
- [ ] Tratamento de erro do Resend: log estruturado + retorno 500 sem expor mensagem bruta ao cliente
- [ ] Testes mockando o SDK do Resend (`vi.mock('resend')`)
- [ ] Typecheck e lint passam

#### US-A08: Verificação de email
**Description:** Como usuário recém-cadastrado, quero confirmar meu email para ativar a conta.

**Acceptance Criteria:**
- [ ] Link no email leva para `/verify-email?token=...`
- [ ] Página chama `authClient.verifyEmail({ query: { token } })`
- [ ] Sucesso: redireciona para `/login` com flash "Email verificado, faça login"
- [ ] Erro (token inválido/expirado): botão "Reenviar email de verificação"
- [ ] Tentativa de login com email não verificado retorna erro específico
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-A09: Reset de senha
**Description:** Como usuário que esqueceu a senha, quero redefini-la via link enviado por email.

**Acceptance Criteria:**
- [ ] Rota `/forgot-password` aceita email, chama `authClient.forgetPassword({ email, redirectTo: '/reset-password' })`
- [ ] Mensagem genérica em sucesso ("se o email existir, enviaremos um link") para não vazar existência de conta
- [ ] Rota `/reset-password?token=...` exibe form de nova senha
- [ ] Submit chama `authClient.resetPassword({ token, newPassword })`
- [ ] Após reset, redireciona para `/login`
- [ ] Tokens de reset expiram em 1h (config Better Auth)
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-A10: Rate limiting de endpoints sensíveis
**Description:** Como operador, quero limitar abuso em endpoints de autenticação e email.

**Acceptance Criteria:**
- [ ] Better Auth `rateLimit` habilitado com storage no D1 (ou Cloudflare KV)
- [ ] Limites: 10 tentativas de login / 15 min por IP; 5 cadastros / hora por IP; 3 forgot-password / hora por email
- [ ] Retorna 429 com `Retry-After`
- [ ] Testes do limiter com mock de tempo
- [ ] Typecheck e lint passam

---

### Épico B — Remodelagem do frontend como dashboard (sidebar + charts + data table)

> Base visual: bloco `dashboard-01` do shadcn (https://ui.shadcn.com/blocks#dashboard-01). Esse bloco já provê `app-sidebar`, `site-header`, `section-cards`, `chart-area-interactive` e `data-table`. Vamos adotá-lo como shell, remapeando seus slots para o domínio financeiro do projeto.

#### US-B01: Scaffold do dashboard com `dashboard-01`
**Description:** Como desenvolvedor, quero instalar o bloco `dashboard-01` do shadcn e configurá-lo como shell raiz da aplicação autenticada.

**Acceptance Criteria:**
- [ ] `npx shadcn@latest add dashboard-01` executado; componentes gerados em `components/` (app-sidebar, site-header, nav-main, nav-user, nav-documents, section-cards, chart-area-interactive, data-table)
- [ ] Dependências adicionadas pelo bloco (ex.: `@tabler/icons-react`, `@dnd-kit/*`, `vaul`, `sonner`) catalogadas em `package.json`; nenhuma duplicidade com pacotes existentes
- [ ] Tema do `dashboard-01` integrado às variáveis CSS atuais (sem quebrar paleta existente do projeto)
- [ ] Layout aplicado em uma rota nova `/app` (ou raiz autenticada) como smoke test antes do remapeamento
- [ ] Build, typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-B02: Sidebar com navegação do domínio
**Description:** Como usuário, quero uma sidebar à esquerda com as três áreas (Financiamento, Histórico, Alugar x Financiar) substituindo o menu padrão do bloco.

**Acceptance Criteria:**
- [ ] `app-sidebar.tsx` editado: itens de `navMain` substituídos por:
  - Financiamento (`/financiamento`, ícone `IconCalculator` ou similar)
  - Histórico (`/historico`, ícone `IconHistory`; **oculto se não autenticado**)
  - Alugar x Financiar (`/alugar-x-financiar`, ícone `IconScale`)
- [ ] Seções `documents` e `navSecondary` removidas ou ocultas (não fazem sentido no domínio)
- [ ] Item ativo destacado conforme rota atual (via `useLocation` ou router de escolha)
- [ ] Logo/branding do header da sidebar trocado pelo nome do projeto
- [ ] Sidebar colapsável funcionando em desktop e mobile (drawer via `vaul`)
- [ ] Roteamento client (`react-router-dom` ou TanStack Router) configurado com as três rotas + rotas de auth (`/login`, `/register`, etc.)
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-B03: Site header com menu do usuário e seletor de cenário
**Description:** Como usuário autenticado, quero ver meu email/avatar no header e ter acesso rápido a logout; em `/historico` também quero um seletor do cenário ativo.

**Acceptance Criteria:**
- [ ] `nav-user.tsx` exibe `user.email` e dropdown com "Sair" (chama `authClient.signOut()`)
- [ ] Em rotas não-autenticadas (`/login`, `/register`), sidebar/header não renderizam (layout fica "limpo")
- [ ] `site-header.tsx` mostra título da página corrente
- [ ] Em `/historico` e `/historico/:scenarioId`, header expõe combobox de cenário (lista `GET /api/scenarios`) para troca rápida
- [ ] Theme toggle (claro/escuro) mantido do bloco original
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-B04: Mapear `section-cards` para KPIs financeiros
**Description:** Como usuário, no topo de cada página quero ver KPIs relevantes em cards padronizados.

**Acceptance Criteria:**
- [ ] `section-cards.tsx` adaptado para receber `items: KpiCard[]` como prop tipada
- [ ] Em `/financiamento`: cards mostram Parcela base, Parcela desejada, Total de juros, Prazo efetivo
- [ ] Em `/historico/:scenarioId`: cards mostram Saldo devedor, Parcelas restantes, Já pago em juros, Economia acumulada
- [ ] Em `/alugar-x-financiar`: cards mostram Patrimônio comprar (final), Patrimônio alugar+investir (final), Diferença R$, Vencedor
- [ ] Trend indicator (seta verde/vermelha) usado quando há comparação ou variação significativa
- [ ] Testes de render com diferentes dados
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-B05: Substituir gráficos atuais por `chart-area-interactive`
**Description:** Como usuário, quero gráficos interativos (zoom de período, tooltips ricos) seguindo o padrão do bloco.

**Acceptance Criteria:**
- [ ] `chart-area-interactive.tsx` parametrizado para aceitar séries arbitrárias do domínio
- [ ] Substitui os charts atuais em `features/simulator/components/charts/`
- [ ] Em `/financiamento`: séries de saldo devedor, juros acumulados, composição da parcela (multi-tab no card)
- [ ] Em `/historico/:scenarioId`: séries previsto vs real
- [ ] Em `/alugar-x-financiar`: séries patrimônio comprar vs patrimônio alugar
- [ ] Filtros de range temporal (1a / 5a / total) funcionando
- [ ] Tooltips formatados via `lib/formatters` (currency)
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-B06: Substituir tabela de amortização por `data-table` do bloco
**Description:** Como usuário, quero a tabela de amortização com paginação, ordenação e (opcional) drag-and-drop padrão do bloco.

**Acceptance Criteria:**
- [ ] `data-table.tsx` do bloco adotado em `/financiamento` para a amortização mensal
- [ ] Colunas: nº parcela, mês, parcela, juros, amortização, saldo devedor, extra (quando houver)
- [ ] Paginação client-side (12 ou 24 linhas/página)
- [ ] Ordenação por qualquer coluna
- [ ] Reaproveitado em `/historico/:scenarioId` para listar pagamentos reais (com ações editar/excluir nas colunas)
- [ ] Drag-and-drop do bloco original **desabilitado** (não faz sentido no domínio) — features de DnD removidas para reduzir bundle
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-B07: Migração da página de financiamento para o novo shell
**Description:** Como usuário, quero a aba de financiamento renderizada dentro do novo dashboard sem perda de funcionalidade.

**Acceptance Criteria:**
- [ ] Página `/financiamento` consome `section-cards` + `chart-area-interactive` + `data-table`
- [ ] Formulário de inputs (valor imóvel, entrada, prazo, taxa, parcela desejada) renderizado em painel lateral ou card de topo (decidir no design)
- [ ] Card de exportação Excel mantido como ação no header da página
- [ ] Testes existentes ajustados para o novo layout
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-B08: Mover `rent-vs-buy` para rota dedicada com novo layout
**Description:** Como usuário, quero a comparação alugar x financiar em sua própria página, dentro do dashboard.

**Acceptance Criteria:**
- [ ] `rent-vs-buy-card.tsx` removido de `/financiamento`
- [ ] Página `/alugar-x-financiar` renderiza `section-cards` + `chart-area-interactive` + (opcional) `data-table` resumo anual
- [ ] Estado de inputs independente da aba de financiamento
- [ ] Formulário em card lateral ou superior
- [ ] Testes existentes continuam passando
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

---

### Épico C — Input "valor fixo da parcela mensal desejada"

#### US-C01: Engine — resolver `extraPayment` a partir de `targetMonthlyPayment`
**Description:** Como desenvolvedor, preciso de uma função pura no engine que, dado um `targetMonthlyPayment` ≥ parcela base PRICE, calcule o `extraPayment` mensal e a nova trajetória de amortização.

**Acceptance Criteria:**
- [ ] Função `resolveExtraFromTargetPayment(input): { extraPayment, schedule, termMonths, totalInterest }` em `core/finance/`
- [ ] Validação: `targetMonthlyPayment >= basePriceInstallment`; caso contrário retorna erro
- [ ] Caso `targetMonthlyPayment == basePriceInstallment` → extra = 0
- [ ] Suporta modo "redução de prazo" (default) e "redução de parcela" (mantido)
- [ ] Tests cobrindo: igualdade, valor maior, valor menor (deve falhar), prazo reduzido, comparação com `prepayment.ts`
- [ ] Usa Decimal.js, sem `number` em valores monetários
- [ ] Typecheck e lint passam

#### US-C02: UI — substituir input "extra mensal" por "parcela mensal desejada"
**Description:** Como usuário, na aba de financiamento quero informar o valor que pretendo pagar por mês (parcela base + adicional), não o "extra".

**Acceptance Criteria:**
- [ ] `extra-payment-card.tsx` renomeado para `target-payment-card.tsx` (ou substituído)
- [ ] Campo "Parcela mensal desejada" exibido em destaque
- [ ] Helper exibe parcela base PRICE para referência ("Parcela mínima: R$ X")
- [ ] Validação inline: bloqueia valores abaixo da parcela base
- [ ] UI mostra o "extra calculado" como informação derivada
- [ ] Testes do componente: render, validação, cálculo derivado
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-C03: Atualizar gráficos e exportação Excel para o novo input
**Description:** Como usuário, quero que gráficos e Excel reflitam o novo modelo de input.

**Acceptance Criteria:**
- [ ] Gráficos de saldo, composição da parcela e juros acumulados consomem o novo `schedule`
- [ ] Sheet "Financing + Extra Payment" renomeada para "Financing + Target Payment" (ou similar) com colunas de parcela desejada e extra derivado
- [ ] Testes de export verificam estrutura
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

---

### Épico D — Calculadora Alugar x Financiar estilo Investidor Sardinha

> Referência: https://investidorsardinha.r7.com/calculadoras/calculadora-alugar-x-financiar/. Modelo: comparar patrimônio líquido ao final do prazo entre dois cenários: (1) financiar o imóvel pagando parcelas; (2) alugar e investir a diferença (entrada + diferença parcela vs aluguel).

#### US-D01: Engine — modelo completo alugar x financiar
**Description:** Como desenvolvedor, preciso de um engine puro que produza a comparação mês a mês entre comprar (financiado) e alugar+investir.

**Acceptance Criteria:**
- [ ] Função `simulateRentVsBuy(input): RentVsBuyResult` em `core/finance/rent-vs-buy.ts` substitui versão atual
- [ ] Inputs: valor do imóvel, entrada, prazo, taxa juros, valor aluguel inicial, reajuste anual aluguel (IGP-M/IPCA), valorização anual imóvel, rendimento anual investimento, custos compra (ITBI, escritura %), custos venda imóvel (corretagem %), inflação anual (opcional)
- [ ] Saída mês a mês: patrimônio cenário comprar (valor imóvel atualizado - saldo devedor), patrimônio cenário alugar (saldo investido), aluguel pago, parcela paga
- [ ] Suporta o caso "diferença entre parcela e aluguel é investida no cenário aluguel"
- [ ] Tests: 10+ casos cobrindo (a) cenários onde comprar ganha, (b) alugar ganha, (c) empate, (d) extremos (rendimento 0, valorização 0), (e) comparação com valores conhecidos do site Sardinha (snapshot)
- [ ] Usa Decimal.js
- [ ] Typecheck e lint passam

#### US-D02: UI — formulário expandido alugar x financiar
**Description:** Como usuário, quero informar todos os parâmetros (rendimento, valorização, reajuste) com defaults razoáveis.

**Acceptance Criteria:**
- [ ] Form em `/alugar-x-financiar` com todos os inputs da US-D01
- [ ] Defaults: rendimento 12%/a, valorização 6%/a, reajuste aluguel 4%/a, ITBI 3%, corretagem 6%
- [ ] Cada input tem tooltip explicando o que é
- [ ] Validação via zod schema
- [ ] Botão "restaurar defaults"
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-D03: UI — visualização do resultado alugar x financiar
**Description:** Como usuário, quero ver claramente qual cenário gera maior patrimônio e por quanto.

**Acceptance Criteria:**
- [ ] Card de resumo com vencedor, diferença em R$ e % ao final do prazo
- [ ] Gráfico de linha comparando patrimônio mês a mês dos dois cenários
- [ ] Tabela detalhada por ano (resumida) com patrimônio comprar, patrimônio alugar, diferença
- [ ] Inclusão dessa visualização na exportação Excel (nova sheet ou substituir a atual)
- [ ] Testes de render + cálculo derivado
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

---

### Épico E — Aba Histórico (pagamentos reais + simulações)

> Modelo conceitual: usuário cria um **"financiamento ativo"** (snapshot dos parâmetros: valor, entrada, prazo, taxa, data início). A partir dele, registra **pagamentos reais** mês a mês. Cada pagamento é uma linha com `{ mês_referência, valor_pago, data_pagamento, tipo: 'parcela' | 'amortização_extra' | 'misto', estratégia_amortização: 'prazo' | 'parcela' }`. O sistema recalcula o saldo devedor e o cronograma restante após cada pagamento. **Simulações** são feitas a partir do estado atual (após últimos pagamentos reais) e podem ser comparadas, mas só os pagamentos reais ficam persistidos no histórico.

#### US-E01: Schema D1 — `financing_scenarios` e `payment_history`
**Description:** Como desenvolvedor, preciso das tabelas que sustentam o histórico.

**Acceptance Criteria:**
- [ ] `financing_scenarios`: `id, user_id, name, property_value, down_payment, term_months, annual_rate, start_date, created_at, archived_at` (cents/integer para valores)
- [ ] `payment_history`: `id, scenario_id, reference_month (YYYY-MM), payment_date, amount_paid_cents, payment_type, amortization_strategy, notes, created_at`
- [ ] Índices em `(user_id)`, `(scenario_id, reference_month)`
- [ ] Constraint: `payment_history.scenario_id` FK para `financing_scenarios` com `ON DELETE CASCADE`
- [ ] Migração `0002_financing_history.sql`
- [ ] Typecheck e lint passam

#### US-E02: API CRUD de cenários de financiamento
**Description:** Como usuário autenticado, quero salvar, listar, editar e arquivar meus financiamentos.

**Acceptance Criteria:**
- [ ] `POST /api/scenarios` cria cenário do usuário corrente
- [ ] `GET /api/scenarios` lista cenários do usuário (apenas não arquivados, com flag `?archived=true` para incluir)
- [ ] `GET /api/scenarios/:id` retorna cenário (404 se não pertence ao usuário)
- [ ] `PATCH /api/scenarios/:id` atualiza campos editáveis (name, archived_at)
- [ ] `DELETE /api/scenarios/:id` arquiva (soft delete via `archived_at`)
- [ ] Validação via zod
- [ ] Testes de handler com mock D1, incluindo enforcement de ownership
- [ ] Typecheck e lint passam

#### US-E03: API CRUD de pagamentos
**Description:** Como usuário autenticado, quero registrar, listar, editar e remover pagamentos de um cenário.

**Acceptance Criteria:**
- [ ] `POST /api/scenarios/:id/payments` cria pagamento
- [ ] `GET /api/scenarios/:id/payments` lista pagamentos ordenados por `reference_month`
- [ ] `PATCH /api/scenarios/:id/payments/:pid` edita um pagamento
- [ ] `DELETE /api/scenarios/:id/payments/:pid` remove
- [ ] Ownership reforçado: pagamento só acessível pelo dono do cenário
- [ ] Validação: `reference_month` formato `YYYY-MM`; `amount_paid_cents > 0`
- [ ] Testes de handler
- [ ] Typecheck e lint passam

#### US-E04: Engine — recálculo de saldo a partir de pagamentos reais
**Description:** Como desenvolvedor, preciso de uma função pura que receba (parâmetros do financiamento + lista de pagamentos reais) e retorne o estado atual: saldo devedor, parcelas restantes, juros já pagos, amortização acumulada, próximo cronograma.

**Acceptance Criteria:**
- [ ] Função `replayPayments(scenario, payments): CurrentState` em `core/finance/`
- [ ] Suporta pagamento exato (= parcela), pagamento parcial, pagamento maior (com aplicação da estratégia: prazo ou parcela)
- [ ] Lida com meses sem pagamento (parcela em atraso → juros sobre saldo, configurável)
- [ ] Saída inclui: `currentBalance`, `remainingMonths`, `paidInterest`, `paidPrincipal`, `nextScheduledPayment`
- [ ] Tests: 12+ casos incluindo (a) só parcelas padrão, (b) amortização extra com redução de prazo, (c) amortização extra com redução de parcela, (d) sequência mista
- [ ] Typecheck e lint passam

#### US-E05: UI — listar e criar cenários de financiamento
**Description:** Como usuário, quero ver meus financiamentos ativos e criar novos.

**Acceptance Criteria:**
- [ ] Página `/historico` mostra lista de cenários do usuário
- [ ] Botão "Novo financiamento" abre modal com inputs (mesmos campos da aba de simulação macro)
- [ ] Cada item da lista mostra: nome, saldo devedor atual, parcelas restantes, mini-progress
- [ ] Clicar abre detalhes (US-E06)
- [ ] Empty state: "Você ainda não tem financiamentos. Crie um para começar a registrar."
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-E06: UI — detalhes do cenário com histórico e formulário de novo pagamento
**Description:** Como usuário, quero ver o histórico de pagamentos do cenário e adicionar um pagamento.

**Acceptance Criteria:**
- [ ] Rota `/historico/:scenarioId`
- [ ] Header com resumo: saldo devedor, parcelas restantes, próxima parcela esperada
- [ ] Lista cronológica dos pagamentos (editar/excluir inline)
- [ ] Form "Registrar pagamento" com: mês de referência, valor pago, data, estratégia (prazo/parcela), notas
- [ ] Após salvar, header atualiza derivando do `replayPayments`
- [ ] Estado loading/empty/error
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-E07: UI — simulação "e se" a partir do estado atual
**Description:** Como usuário, no detalhe do cenário quero simular um pagamento futuro hipotético e ver impacto antes de registrar.

**Acceptance Criteria:**
- [ ] Painel "Simular próximo pagamento" ao lado do form de registro
- [ ] Inputs: valor hipotético, estratégia
- [ ] Mostra em tempo real: novo saldo, novas parcelas restantes, economia em juros vs cenário "só parcela padrão"
- [ ] Botão "Aplicar como pagamento real" preenche o form de registro com esses valores
- [ ] Simulações **não** são persistidas (apenas o pagamento aplicado é)
- [ ] Testes de render + interação
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-E08: Gráficos no detalhe do cenário
**Description:** Como usuário, quero visualizar o progresso do financiamento e a economia gerada pelos pagamentos extras já registrados.

**Acceptance Criteria:**
- [ ] Gráfico de saldo devedor: linha "previsto sem extras" vs linha "real com pagamentos registrados"
- [ ] Gráfico de juros acumulados (mesma comparação)
- [ ] Card de resumo: "Você já economizou R$ X em juros / Reduziu Y meses do prazo"
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

---

### Épico F — Migração e cleanup

#### US-F01: Migrar cenários do localStorage para D1 (opt-in)
**Description:** Como usuário pré-existente, ao fazer primeiro login quero opção de importar cenários salvos no localStorage.

**Acceptance Criteria:**
- [ ] Detecta chave `lastSimulation` (ou similar) no localStorage após login
- [ ] Modal "Encontramos uma simulação salva. Deseja importar?"
- [ ] Importação cria um `financing_scenario` via API
- [ ] Marca como importado para não perguntar de novo
- [ ] Typecheck e lint passam
- [ ] Verify in browser using dev-browser skill

#### US-F02: Atualizar CLAUDE.md e documentação
**Description:** Como desenvolvedor, preciso que o `CLAUDE.md` reflita a nova arquitetura.

**Acceptance Criteria:**
- [ ] Seção "Project" reescrita: não é mais "browser-only"; agora Workers + D1 + auth multi-usuário
- [ ] Seção "Stack" inclui Cloudflare Workers, D1, biblioteca de hash escolhida
- [ ] Seção "State" atualizada: D1 é fonte da verdade para cenários e pagamentos; localStorage só preferências de UI
- [ ] Seção "Definition of Done" inclui passar migrations
- [ ] README atualizado com instruções de setup local (wrangler, d1 migrate)
- [ ] Typecheck e lint passam

#### US-F03: `wrangler.jsonc` e secrets de produção
**Description:** Como operador, preciso do `wrangler.jsonc` configurado para produção, com binding D1, custom domain e secrets aplicados.

**Acceptance Criteria:**
- [ ] `wrangler.jsonc` versionado na raiz com:
  - `name = "calculadora-financeira"`
  - `main = "src/server/index.ts"` (entrypoint do Worker)
  - `compatibility_date` recente
  - `assets = { directory = "dist", binding = "ASSETS" }` (assets do Vite)
  - `d1_databases = [{ binding = "DB", database_name = "calculadora-financeira-db", database_id = "..." }]`
  - `routes = [{ pattern = "calculadorafinanceira.app/*", custom_domain = true }]` (e opcionalmente `www.`)
  - `vars = { EMAIL_FROM = "no-reply@calculadorafinanceira.app" }`
- [ ] Banco D1 criado uma única vez via `wrangler d1 create calculadora-financeira-db` e ID colocado no `wrangler.jsonc`
- [ ] Secrets aplicados manualmente uma vez no environment de produção:
  - `wrangler secret put BETTER_AUTH_SECRET`
  - `wrangler secret put TURNSTILE_SECRET_KEY`
  - `wrangler secret put RESEND_API_KEY`
- [ ] Passos documentados em `docs/deploy.md`
- [ ] Typecheck e lint passam

#### US-F04: DNS e custom domain — calculadorafinanceira.app
**Description:** Como operador, quero o domínio apontando para o Worker com HTTPS automático.

**Acceptance Criteria:**
- [ ] Zona `calculadorafinanceira.app` ativa no Cloudflare (DNS apontando para os nameservers Cloudflare)
- [ ] Custom domain do Worker configurado para `calculadorafinanceira.app` (e `www.calculadorafinanceira.app` redirecionando para apex)
- [ ] Certificado TLS emitido automaticamente
- [ ] DKIM/SPF/return-path para o Resend configurados nos registros DNS (CNAMEs do Resend) — `no-reply@calculadorafinanceira.app` envia sem cair em spam
- [ ] Smoke test: `curl https://calculadorafinanceira.app/api/health` retorna `{ ok: true }`
- [ ] Passos documentados em `docs/deploy.md`

#### US-F05: GitHub Actions — pipeline de PR
**Description:** Como time, quero que toda PR rode lint + typecheck + test + build antes de poder ser mergeada.

**Acceptance Criteria:**
- [ ] Workflow `.github/workflows/ci.yml` rodando em `pull_request` e `push` para branches que não sejam `main`
- [ ] Jobs sequenciais ou em paralelo: `bun install` → `bun run lint` → `bun run typecheck` → `bun run test` → `bun run build`
- [ ] Cache de dependências do Bun via `actions/cache`
- [ ] Smoke test do Worker: `wrangler deploy --dry-run`
- [ ] Status check obrigatório configurado em branch protection da `main`
- [ ] Tempo total do pipeline < 5 min

#### US-F06: GitHub Actions — deploy em push para `main`
**Description:** Como operador, quero deploy automático para produção quando `main` recebe merge.

**Acceptance Criteria:**
- [ ] Workflow `.github/workflows/deploy.yml` em `push` para `main`
- [ ] Reutiliza jobs de lint/typecheck/test/build (via reusable workflow ou matrix)
- [ ] Após sucesso: `wrangler d1 migrations apply calculadora-financeira-db --remote` (aplica migrações)
- [ ] Em seguida: `wrangler deploy` (publica o Worker)
- [ ] Concurrency group por ambiente impede deploys paralelos
- [ ] Secrets obrigatórios no GitHub: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- [ ] Token do Cloudflare com escopo mínimo: Workers Scripts:Edit + D1:Edit + Account Settings:Read (documentar em `docs/deploy.md`)
- [ ] Notificação em caso de falha (job summary + falha visível no GitHub)
- [ ] Tag de release opcional após deploy (`v$(date +%Y.%m.%d-%H%M)`)

#### US-F07: Preview deploys por PR (opcional, mas recomendado)
**Description:** Como reviewer, quero abrir um link de preview da PR para validar mudanças antes do merge.

**Acceptance Criteria:**
- [ ] Workflow `.github/workflows/preview.yml` em `pull_request` (apenas para PRs do mesmo repo, não forks, para proteger secrets)
- [ ] Deploy em ambiente nomeado por PR: `wrangler deploy --env preview-pr-<numero>` com domínio `pr-<numero>.calculadorafinanceira.app` (configurar wildcard) **ou** route do tipo `<numero>.previews.workers.dev`
- [ ] D1 separado para preview (`calculadora-financeira-db-preview`) ou compartilhado com produção atrás de feature flag — decidir; recomendado: banco preview separado, recriado em cada deploy
- [ ] Bot comenta na PR com a URL de preview
- [ ] Cleanup automático ao fechar/mergear a PR (workflow `pull_request` `closed`)

#### US-F08: Backup e observabilidade básicos
**Description:** Como operador, quero ver erros em produção e ter backup do D1.

**Acceptance Criteria:**
- [ ] `wrangler.jsonc` com `observability = { enabled = true }` (logs no dashboard)
- [ ] Endpoint `/api/health` retorna `{ ok: true, version: <git-sha> }` (commit SHA injetado no build)
- [ ] Documentado em `docs/deploy.md` como tirar export do D1: `wrangler d1 export calculadora-financeira-db --remote --output=backup-YYYY-MM-DD.sql`
- [ ] Workflow agendado `.github/workflows/db-backup.yml` rodando diariamente que faz export e sobe como artifact (retenção 30 dias) — opcional, decidir
- [ ] Typecheck e lint passam

## 4. Requisitos Funcionais

- FR-1: O sistema deve permitir cadastro de usuários via email + senha self-hosted (Better Auth + D1) sem provedor externo.
- FR-2: O hash de senha deve ser delegado ao Better Auth (default: scrypt) — não implementar hash custom.
- FR-3: Sessões devem ser baseadas em cookie HttpOnly + Secure + SameSite=Lax, persistidas em tabela `session` do D1 e gerenciadas pelo Better Auth.
- FR-4: Todas as rotas `/api/*` (exceto `/api/auth/*` e `/api/health`) devem passar pelo middleware `requireUser` do Hono.
- FR-4a: O cadastro e o login devem ser protegidos por Cloudflare Turnstile com verificação server-side via `siteverify`.
- FR-4b: O cadastro deve exigir verificação de email; login com email não verificado deve ser bloqueado com mensagem específica.
- FR-4c: O reset de senha deve usar tokens curtos (TTL 1h) enviados por email via Resend.
- FR-5: O frontend deve usar o bloco `dashboard-01` do shadcn como shell, com sidebar persistente contendo três rotas: `/financiamento`, `/historico` (oculta se não autenticado), `/alugar-x-financiar`.
- FR-6: A aba `/financiamento` deve aceitar como input o **valor da parcela mensal desejada**, e derivar o pagamento extra automaticamente, validando que o valor desejado é ≥ parcela PRICE base.
- FR-7: A aba `/alugar-x-financiar` deve implementar o modelo descrito no Épico D, comparando patrimônio mês a mês.
- FR-8: A aba `/historico` deve permitir CRUD de cenários de financiamento persistidos no D1.
- FR-9: A aba `/historico` deve permitir CRUD de pagamentos reais por cenário, persistidos no D1.
- FR-10: O detalhe do cenário deve exibir o estado atual derivado dos pagamentos via `replayPayments`.
- FR-11: O detalhe do cenário deve permitir simular pagamentos hipotéticos sem persistir.
- FR-12: Todos os cálculos financeiros devem viver em `core/finance/`, usando Decimal.js.
- FR-13: A exportação Excel deve refletir os dados exibidos na UI atualizada (parcela desejada + alugar x financiar novo).
- FR-14: O deploy deve usar Cloudflare Workers + Hono (com binding de assets do Vite) e D1.
- FR-15: Migrações de banco devem ser versionadas em `migrations/`, geradas pela CLI do Better Auth quando aplicável.
- FR-16: Rate limiting deve proteger endpoints de auth (login, register, forgot-password) via mecanismo do Better Auth com storage em D1 ou KV.
- FR-17: E-mails transacionais (verificação de email e reset de senha) devem ser enviados via API do Resend, com `RESEND_API_KEY` armazenada como Worker secret e domínio remetente verificado no Resend (DKIM/SPF).
- FR-18: O domínio público de produção deve ser `calculadorafinanceira.app`, com TLS automático via Cloudflare e `www` redirecionando para apex.
- FR-19: PRs no GitHub devem passar por workflow obrigatório de lint + typecheck + test + build + `wrangler deploy --dry-run` antes do merge.
- FR-20: Push para `main` deve disparar deploy automatizado para produção, executando migrações D1 (`wrangler d1 migrations apply --remote`) antes de `wrangler deploy`.
- FR-21: Segredos sensíveis (`BETTER_AUTH_SECRET`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN`) nunca devem ser commitados; produção usa `wrangler secret put`, CI usa GitHub Actions secrets, dev local usa `.env.local`.
- FR-22: Um arquivo `.env.example` versionado deve listar todas as variáveis de ambiente esperadas com placeholders e comentários explicativos.

## 5. Não-objetivos (Fora de Escopo)

- OAuth/social login (Google, GitHub) — pode ser habilitado depois como plugin do Better Auth.
- Login passwordless / magic link — pode ser habilitado depois como plugin do Better Auth.
- 2FA / passkeys — fora de escopo desta entrega; o Better Auth permite habilitar como plugin futuramente.
- Multi-tenancy organizacional / compartilhamento de cenários entre usuários.
- App mobile nativo.
- Importação automática de extrato bancário.
- Notificações por email/push.
- Histórico de "simulações 'e se'" persistido em banco (apenas pagamentos reais ficam no D1).
- Internacionalização (PT-BR único por enquanto).

## 6. Considerações de Design

- **Shell visual:** bloco `dashboard-01` do shadcn (`https://ui.shadcn.com/blocks#dashboard-01`) — `app-sidebar` + `site-header` + `section-cards` + `chart-area-interactive` + `data-table`. Instalar via `npx shadcn@latest add dashboard-01`.
- **Sidebar** (não tabs): persistente em desktop, drawer em mobile (já provido pelo bloco via `vaul`). Itens: Financiamento, Histórico (gated por auth), Alugar x Financiar.
- **Componentes a remapear**, não reescrever:
  - `nav-main` → rotas de domínio
  - `nav-user` → email + logout do Better Auth
  - `section-cards` → KPIs por página (ver US-B04)
  - `chart-area-interactive` → gráficos do domínio (ver US-B05)
  - `data-table` → amortização + histórico de pagamentos (ver US-B06)
- **Remover do bloco** o que não se aplica: documentos, drag-and-drop da tabela, navSecondary genérico — reduzindo bundle e ruído visual.
- **Páginas de auth** (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) renderizam **fora** do shell do dashboard (layout limpo, centrado).
- A página `/historico` segue padrão master-detail: lista de cenários (na própria sidebar como subseção ou na página) → detalhe `/historico/:scenarioId` com KPIs + chart + tabela + form de novo pagamento.
- Reaproveitar `lib/formatters/` (currency, percentage) em todos os componentes adaptados.
- Componentes financeiros específicos vão em `components/finance/`; componentes do dashboard (gerados pelo shadcn) ficam em `components/` ou `components/ui/` conforme convenção do CLI.
- Manter DiceUI para casos não cobertos pelo bloco (ex.: combobox avançado de seleção de cenário, se necessário).

## 7. Considerações Técnicas

- **Vite + Workers:** usar `@cloudflare/vite-plugin` para integrar SPA + Worker em dev e build (servidor único; `wrangler dev` no fluxo de deploy).
- **Hono:** framework de roteamento no Worker. Tipar bindings via `Hono<{ Bindings: Env }>`. Montar handlers de auth como `app.on(['POST','GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))`.
- **Better Auth:** biblioteca self-hosted (≥ 1.5) com `database: { provider: 'd1', binding: env.DB }`. Não rolar criptografia/sessão custom — delegar a Better Auth (hash, tokens, expiração, refresh, multi-session). Schema gerado pela CLI do Better Auth e commitado como SQL em `migrations/`.
- **Turnstile:** site key pública injetada via env Vite (`VITE_TURNSTILE_SITE_KEY`); secret apenas no Worker (`wrangler secret put TURNSTILE_SECRET_KEY`). Validação server-side em `https://challenges.cloudflare.com/turnstile/v0/siteverify` antes de chamar `auth.api.signUpEmail` ou em wrap do login.
- **Resend (e-mails):** SDK oficial (`resend`) chamado no Worker; `RESEND_API_KEY` via `wrangler secret put`; domínio remetente verificado no painel do Resend com DKIM/SPF (não usar domínio de teste em produção). Em dev local, fallback de log no console quando a chave não estiver definida.
- **Decimal.js no Worker:** já está no projeto; verificar tamanho do bundle do Worker (limite 1MB free, 10MB pago). Cálculos pesados rodam no client; Worker apenas persiste/lê.
- **D1 e tipos:** acesso direto via `env.DB.prepare(...)` com tipos manuais é suficiente para o domínio (cenários/pagamentos). Better Auth cuida do seu próprio acesso. Introduzir Drizzle só se houver justificativa.
- **Roteamento client:** introduzir `react-router-dom` (ou TanStack Router). Sem SSR.
- **Testes de Worker:** usar `vitest-pool-workers` (preferido) ou `miniflare` para integração; tipos via `@cloudflare/workers-types`.
- **Valores monetários no banco:** armazenar em **centavos como INTEGER**, nunca como REAL — evita drift do SQLite com floats.
- **IaC:** `wrangler.jsonc` versionado; segredos via `wrangler secret put` (não commitar). Migrations aplicadas em CI antes do deploy via `wrangler d1 migrations apply calculadora-financeira-db --remote`.
- **Domínio:** `calculadorafinanceira.app` (já adquirido). DNS gerenciado pelo Cloudflare; custom domain do Worker emite certificado automaticamente. CNAMEs do Resend devem ser adicionados na mesma zona para liberar `no-reply@calculadorafinanceira.app`.
- **CI/CD:**
  - **PRs:** workflow `ci.yml` roda `bun install` → lint → typecheck → test → build → `wrangler deploy --dry-run`. Status check obrigatório em branch protection.
  - **Push `main`:** workflow `deploy.yml` repete o pipeline, aplica migrations D1 (`--remote`) e roda `wrangler deploy`. Concurrency group por ambiente.
  - **Secrets GitHub:** `CLOUDFLARE_API_TOKEN` (escopo: Workers Scripts:Edit, D1:Edit, Account Settings:Read) e `CLOUDFLARE_ACCOUNT_ID`.
  - **Preview deploys** (opcional, US-F07): workers separados por PR com D1 dedicado; bot comenta a URL na PR; cleanup ao fechar PR.
  - **Observabilidade:** `observability.enabled = true` no `wrangler.jsonc`; `/api/health` retorna SHA do commit.
- **Env vars:** `.env.example` na raiz (versionado) com placeholders. `.env.local` (gitignored — já está em `.gitignore`) para dev. Produção e CI lêem de secrets, nunca de `.env.*`.

## 8. Métricas de Sucesso

- Usuário consegue cadastrar conta, fazer login e ver seus cenários em < 30s no fluxo feliz.
- 100% dos cálculos financeiros novos cobertos por testes unitários.
- Build do Worker < 1MB gzipped (mantém compatibilidade com plano free) — atenção ao peso do Better Auth + Hono.
- Tempo de resposta p95 dos endpoints `/api/*` < 200ms na região mais próxima.
- Nenhuma regressão funcional na aba `/financiamento` após reestruturação (testes existentes passam).
- A nova calculadora alugar x financiar deve implementar fórmula própria documentada e validar com 3 cenários de referência. Use a calculadora externa como benchmark visual/conceitual, não como fonte de verdade.

## 9. Questões em Aberto

- Devemos persistir simulações "e se" no D1 ou manter apenas em estado local? *(A escolha do usuário no questionário sugere apenas pagamentos reais persistem, mas o enunciado original mencionou "registro das simulações" — confirmar.)*
- Estratégia padrão de amortização extra ao registrar pagamento: redução de prazo (default) ou parcela?
- Remetente de e-mail confirmado como `no-reply@calculadorafinanceira.app`? *(Default sugerido — confirmar antes de US-A07.)*
- Turnstile no login: sempre exibir, ou só após N tentativas falhas? (Trade-off entre UX e segurança.)
- Limite máximo de cenários por usuário? (Sugestão: 50 ativos, 200 com arquivados.)
- Aluguel e investimento na aba alugar x financiar: considerar imposto de renda sobre rendimento (15% padrão)? *(Sardinha aplica.)*
- Defaults razoáveis para a calculadora Sardinha-like devem refletir contexto brasileiro 2026 — confirmar valores antes da implementação.
