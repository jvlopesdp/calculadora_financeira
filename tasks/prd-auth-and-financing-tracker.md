# PRD: Correção de Auth + Cache Global + Acompanhamento de Financiamento

## 1. Introdução / Visão Geral

Atualmente o login e o cadastro do app **calculadorafinanceira.app** estão quebrados, o que impede usuários autenticados de salvarem cenários no D1. Além disso, dados das páginas existentes são perdidos a cada refresh e não há um fluxo dedicado para **acompanhar** um financiamento mês a mês após contratado (apenas simulá-lo).

Esta feature cobre três frentes complementares:

1. **Auth confiável** sobre Better Auth + Cloudflare D1, com email/senha **e** Google OAuth, sem dependência de Clerk/Auth0/Supabase.
2. **Camada de estado** com TanStack Query (persistido) + autosave do rascunho da simulação corrente, eliminando perda de dados em refresh e protegendo rotas privadas.
3. **Nova aba "Acompanhamento"** — independente da aba "Simulador" — onde o usuário cria um financiamento (valores, condições, modalidade), salva no D1 e registra **lançamentos mensais reais**, vendo o impacto em três curvas: **Realizado × Normal (sem antecipação) × Meta (valor mensal fixo total)**.

---

## 2. Goals

- Login e cadastro 100% funcionais via email/senha (com verificação por e-mail e reset de senha) **e** via Google OAuth.
- Sessões persistentes via cookie e protegidas pelo Worker; `/api/auth/*` roteado pelo handler do Better Auth.
- TanStack Query como única fonte de server-state no cliente, com **persistência em localStorage** dos caches relevantes.
- Rotas privadas (Histórico, Acompanhamento) bloqueadas no client e no server; rota Simulador permanece pública.
- Rascunho da simulação corrente (aba Simulador) sobrevive a refresh: autosave em D1 quando logado e em localStorage quando deslogado.
- Nova aba **Acompanhamento de Financiamento**: criar plano, lançar pagamentos mês a mês, escolher por lançamento entre "reduzir prazo" ou "reduzir parcela", visualizar as três curvas, comparar e exportar.
- Toda lógica financeira do acompanhamento vive em `core/finance` (regra de `CLAUDE.md`).
- Manter a stack leve: nenhuma nova dependência além de TanStack Query (+ persister) e o que já é necessário para Better Auth/Google.

---

## 3. User Stories

> Cada US deve ser executável em uma sessão focada. Critérios são verificáveis. Sempre exigir typecheck/lint/build verdes.

### Bloco A — Auth (Better Auth + D1 + Google)

#### US-A01: Corrigir secret `BETTER_AUTH_URL` corrompido e validar fluxo ponta-a-ponta
**Descrição:** Como desenvolvedor, quero corrigir a causa raiz já diagnosticada — o secret `BETTER_AUTH_URL` em produção foi gravado com o texto literal do **comando** `bunx --bun wrangler secret put BETTER_AUTH_URL` em vez de uma URL válida — para que `/api/auth/*` pare de retornar 500 (`BetterAuthError: Invalid base URL`).

**Causa raiz observada (logs do Worker, ray `a0296e3c9f482535`):**
> `BetterAuthError: Invalid base URL: bunx --bun wrangler secret put BETTER_AUTH_URL. Please provide a valid base URL.`
>
> Impacto: `new URL(baseURL)` lança no boot do handler, derrubando `/api/auth/get-session`, `/sign-in`, `/sign-up`, callbacks OAuth, links de e-mail e validação de origin/CSRF.

**Escopo:** apenas o reset do secret + validação ponta-a-ponta + docs. **Não** inclui refatorar o handler para derivar `baseURL` do request — isso fica documentado em `docs/auth-diagnosis.md` como recomendação futura, mas o PR de US-A01 não toca em `src/server/auth*.ts`.

**Acceptance Criteria:**
- [x] Reset imediato do secret em produção: `bunx --bun wrangler secret put BETTER_AUTH_URL` informando como valor exatamente `https://calculadorafinanceira.app`. _Executado pelo usuário em 2026-05-27._
- [x] `curl -i https://calculadorafinanceira.app/api/auth/get-session` retorna 200 + `null` (em vez de 500). _Verificado em 2026-05-27._
- [x] `docs/auth-diagnosis.md` registra sintoma, causa raiz e correção pontual; recomenda baseURL derivado como follow-up.
- [x] `docs/auth-smoke.md` define o roteiro reproduzível de smoke (curl + `wrangler d1 execute` + UI).
- [ ] Executar `docs/auth-smoke.md` ponta-a-ponta e marcar seus critérios — cobre sign-up, verify e-mail, sign-in, cookie de sessão, rota protegida (`/api/scenarios`), sign-out.

#### US-A02: Atualizar Better Auth para usar `database: env.DB` (binding D1 nativo)
**Descrição:** Como desenvolvedor, quero passar o binding do D1 direto para o Better Auth (≥ 1.5), removendo qualquer adapter customizado, para reduzir superfície de bug e alinhar com a doc oficial.

**Acceptance Criteria:**
- [ ] `betterAuth({ database: env.DB, ... })` (ou equivalente oficial) configurado no handler do Worker.
- [ ] Nenhum adapter Drizzle/Prisma customizado restante para auth.
- [ ] Migrations da auth conferidas em `migrations/` e aplicadas via `bun run db:migrate:local` e `:remote`.
- [ ] Testes do Worker (`app.request(...)`) cobrindo sign-up, sign-in e sign-out passam.

#### US-A03: Configurar Google como provider OAuth
**Descrição:** Como usuário, quero entrar com Google para evitar criar senha nova.

**Acceptance Criteria:**
- [ ] Credenciais Google Cloud Console documentadas em `docs/google-oauth.md` (variáveis `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
- [ ] Redirect URIs registrados: `http://localhost:5173/api/auth/callback/google` e `https://calculadorafinanceira.app/api/auth/callback/google`.
- [ ] `baseURL` do Better Auth derivado do request (sem hardcode) para evitar `redirect_uri_mismatch`.
- [ ] Botão "Continuar com Google" nas telas de login e cadastro.
- [ ] Callback cria/associa registro em `account` (provider=google) e gera sessão.
- [ ] Verify in browser using dev-browser skill.

#### US-A04: Manter e auditar fluxo email/senha (verify e-mail + reset)
**Descrição:** Como usuário, quero confiar que verificação por e-mail e reset de senha continuam funcionando após a migração para o binding nativo.

**Acceptance Criteria:**
- [ ] Resend dispara e-mail de verificação ao cadastrar.
- [ ] Link de verificação ativa a conta no D1.
- [ ] "Esqueci a senha" envia link válido e permite trocar a senha.
- [ ] Turnstile continua exigido em sign-up, sign-in e forgot-password.
- [ ] Verify in browser using dev-browser skill.

#### US-A05: Middleware `requireUser` consolidado no Worker
**Descrição:** Como desenvolvedor, quero um único middleware que valida cookie de sessão para todas as rotas privadas (`/api/scenarios/*`, `/api/payments/*`, `/api/tracker/*`).

**Acceptance Criteria:**
- [ ] Middleware lê sessão via Better Auth a partir do request.
- [ ] Devolve `401` em rota privada sem sessão.
- [ ] Injeta `c.set('user', user)` para handlers.
- [ ] Teste unitário com Hono `app.request(...)` valida 401 e 200.

---

### Bloco B — TanStack Query + Rotas Protegidas + Cache

#### US-B01: Introduzir `QueryClient` + persister em localStorage
**Descrição:** Como usuário, quero que as listas e detalhes carregados sobrevivam ao refresh, em vez de re-fetch do zero.

**Acceptance Criteria:**
- [ ] `@tanstack/react-query` e `@tanstack/query-sync-storage-persister` adicionados (com justificativa registrada no PR).
- [ ] `QueryClient` configurado com `staleTime`/`gcTime` sensatos (ex.: 5 min stale, 24 h gc).
- [ ] `persistQueryClient` ativado com chave versionada (ex.: `cf-app-query-v1`).
- [ ] Refresh em qualquer rota mostra dados do cache imediatamente e revalida em background.

#### US-B02: Migrar `src/lib/api-client.ts` para hooks `useQuery`/`useMutation`
**Descrição:** Como desenvolvedor, quero centralizar fetches no TanStack Query para invalidação consistente.

**Acceptance Criteria:**
- [ ] Hooks `useScenarios`, `useScenario(id)`, `usePayments(scenarioId)` substituem chamadas diretas.
- [ ] Mutations (`createScenario`, `updateScenario`, `deleteScenario`, etc.) invalidam as queries certas.
- [ ] Nenhum `useEffect(fetch)` restante para server-state.
- [ ] Typecheck passa, sem `any`.

#### US-B03: Sessão autenticada exposta via TanStack Query
**Descrição:** Como cliente, quero saber se há sessão ativa de forma reativa para esconder/mostrar UI e proteger rotas.

**Acceptance Criteria:**
- [ ] Hook `useSession()` consultando `/api/auth/get-session` com cache.
- [ ] Logout invalida o cache de sessão.
- [ ] Nenhum componente lê sessão por outro caminho.

#### US-B04: `ProtectedRoute` real (client + server)
**Descrição:** Como produto, quero que `/historico` e `/acompanhamento/*` exijam login; `/` (Simulador) continua público.

**Acceptance Criteria:**
- [ ] `ProtectedRoute` redireciona para `/login?next=...` quando `useSession()` retorna sem usuário.
- [ ] Worker devolve 401 para `GET /api/scenarios/*`, `GET /api/payments/*` e `*/api/tracker/*` sem cookie.
- [ ] `/` permanece acessível sem login.
- [ ] Verify in browser using dev-browser skill.

#### US-B05: Autosave do rascunho do Simulador (único draft por usuário, sobrescrito)
**Descrição:** Como usuário do simulador (mesmo deslogado), não quero perder o que digitei ao dar refresh.

**Acceptance Criteria:**
- [ ] Inputs do simulador são salvos em **localStorage** (chave `sim-draft-v1`) com debounce de ~500 ms.
- [ ] Quando logado, além do localStorage, autosave em D1 via `PUT /api/scenarios/draft` (upsert de **um único draft por `user_id`**, sobrescrito a cada save — não há fila de drafts).
- [ ] Migration cria `scenario_drafts(user_id PRIMARY KEY, payload JSON, updated_at)`.
- [ ] Ao recarregar a página, o rascunho mais recente (D1 quando logado, senão localStorage) é restaurado.
- [ ] Verify in browser using dev-browser skill.

---

### Bloco C — Aba "Acompanhamento de Financiamento" (independente do Simulador)

> A aba é **separada** do Simulador. Não compartilha estado nem rascunho. Cria-se um plano novo, salvo no D1, com lançamentos manuais.

#### US-C01: Modelagem D1 para acompanhamento
**Descrição:** Como desenvolvedor, preciso de tabelas para persistir o plano e os lançamentos.

**Acceptance Criteria:**
- [ ] Migration cria `tracker_plans` (id, user_id, name, principal, down_payment, term_months, annual_rate, modality, start_date, target_monthly_total, created_at, updated_at).
- [ ] Migration cria `tracker_entries` (id, plan_id, month_index, paid_amount, paid_at, apply_mode `'reduce_term' | 'reduce_installment'`, note, created_at).
- [ ] Índices: `tracker_plans(user_id)`, `tracker_entries(plan_id, month_index)`.
- [ ] `bun run db:migrate:local` aplica sem erro.

#### US-C02: CRUD de planos no Worker (`/api/tracker/plans`)
**Descrição:** Como cliente, preciso de endpoints para criar/listar/ler/editar/deletar planos.

**Acceptance Criteria:**
- [ ] `GET /api/tracker/plans` lista do usuário logado.
- [ ] `POST /api/tracker/plans` cria plano (valida inputs financeiros conforme CLAUDE.md).
- [ ] `GET /api/tracker/plans/:id` retorna plano + entries.
- [ ] `PUT /api/tracker/plans/:id` edita campos básicos (não apaga entries).
- [ ] `DELETE /api/tracker/plans/:id` remove plano + entries.
- [ ] Todas as rotas protegidas por `requireUser` (US-A05).
- [ ] Testes Hono `app.request(...)` cobrindo 200/401/422.

#### US-C03: CRUD de lançamentos (`/api/tracker/plans/:id/entries`)
**Descrição:** Como cliente, quero registrar/editar/remover pagamentos mês a mês.

**Acceptance Criteria:**
- [ ] `POST .../entries` cria/atualiza lançamento de um `month_index` (upsert por mês).
- [ ] `PATCH .../entries/:entryId` permite trocar `apply_mode`, `paid_amount`, `note`.
- [ ] `DELETE .../entries/:entryId` remove o lançamento.
- [ ] Validação: `paid_amount >= installment_prevista_do_mês` (lançamento parcial é rejeitado com 422), `month_index` ∈ [1, term_months], `apply_mode` ∈ {`reduce_term`, `reduce_installment`}.
- [ ] Testes Hono cobrindo upsert, validação (incluindo rejeição de pagamento abaixo da parcela) e 401.

#### US-C04: Engine — cronograma base ("Normal")
**Descrição:** Como motor de cálculo, preciso gerar o cronograma "sem antecipação" para um plano.

**Acceptance Criteria:**
- [ ] Função pura em `core/finance/tracker/normalSchedule.ts` retorna array de meses com `principal`, `interest`, `amortization`, `installment`, `balance` usando Decimal.js.
- [ ] Cobre as duas modalidades já existentes (PRICE e SAC, conforme já implementado no simulador).
- [ ] Testes Vitest cobrindo casos conhecidos (smoke + edge: term=1, rate=0 inválido bloqueado pela validação chamadora).

#### US-C05: Engine — curva "Realizado" com lançamentos manuais
**Descrição:** Como motor, preciso aplicar os pagamentos lançados mês a mês, respeitando `apply_mode` por lançamento (US-A definiu 5C → por lançamento).

**Acceptance Criteria:**
- [ ] Função pura `core/finance/tracker/realizedSchedule.ts` recebe plano + entries ordenadas e devolve cronograma efetivo.
- [ ] Pré-condição garantida pela API (US-C03): `paid_amount >= installment` do mês — engine pode assumir isso e não trata pagamento parcial.
- [ ] Para cada mês com entrada:
  - se `paid_amount > installment`, excedente vira amortização extra;
  - se `apply_mode = 'reduce_term'`, encurta prazo mantendo parcela;
  - se `apply_mode = 'reduce_installment'`, mantém prazo e reduz parcela seguinte.
- [ ] Meses sem entrada usam a parcela vigente (parcela base ajustada por reduções anteriores).
- [ ] Quitação antecipada (saldo zera antes do prazo) é detectada: cronograma é truncado e marcador `paid_off_at_month` é retornado.
- [ ] Testes: lançamento maior que parcela, lançamento exatamente igual, sequência que produz quitação antecipada, alternância de `apply_mode` ao longo dos meses.
- [ ] Testes determinísticos com Decimal.js (sem floats).

#### US-C06: Engine — curva "Meta" (valor mensal fixo TOTAL)
**Descrição:** Como motor, preciso simular o cenário em que o usuário paga um valor fixo total por mês (parcela + extra somam esse valor). A curva Meta deve ser calculável já no momento da criação do plano (sem depender de lançamentos reais).

**Acceptance Criteria:**
- [ ] Função pura `core/finance/tracker/goalSchedule.ts` recebe plano + `target_monthly_total` e devolve cronograma completo da curva Meta.
- [ ] Não requer entries — pode ser calculada com plano puro logo após a criação (US-C07).
- [ ] Quando `target_monthly_total > installment` do mês, excedente vira amortização extra reduzindo prazo (default da curva Meta).
- [ ] Quando `target_monthly_total < installment`, **a curva é inválida** para aquele mês → retorna erro de validação consumido pela UI (US-C09).
- [ ] Quitação antecipada (saldo zera antes do prazo) trunca a curva e expõe `paid_off_at_month`.
- [ ] Testes cobrindo: meta = parcela (mesmo do normal), meta > parcela (encurta), meta < parcela (erro), meta que zera saldo antes do prazo.

#### US-C07: UI — criação de plano de acompanhamento
**Descrição:** Como usuário logado, quero criar um plano novo a partir de um formulário equivalente ao do simulador, mas que salva no D1 (não é simulação efêmera).

**Acceptance Criteria:**
- [ ] Rota `/acompanhamento` lista planos do usuário com botão "Novo plano".
- [ ] Formulário cobre: nome do plano, principal, entrada, prazo (meses), taxa anual, modalidade (PRICE/SAC), data de início, valor-meta mensal total.
- [ ] Validações conforme `CLAUDE.md` (valor > 0, entrada < total, prazo > 0, taxa > 0).
- [ ] Ao salvar, navega para `/acompanhamento/:id`.
- [ ] Verify in browser using dev-browser skill.

#### US-C08: UI — planilha de lançamentos mês a mês
**Descrição:** Como usuário, quero ver uma tabela mês a mês onde lanço o valor pago, escolho "reduzir prazo" ou "reduzir parcela" e vejo o impacto imediato.

**Acceptance Criteria:**
- [ ] Tabela mostra colunas: `Mês`, `Vencimento`, `Parcela prevista`, `Pago (input)`, `Modo` (select: reduzir prazo / reduzir parcela), `Saldo após`, `Nota`.
- [ ] Input `Pago` tem `min = parcela prevista` do mês; tentativa de valor abaixo é bloqueada com mensagem clara antes do submit (alinhado a US-C03).
- [ ] Edição de uma célula dispara mutation otimista (TanStack Query) e revalida; erro 422 da API faz rollback do otimista.
- [ ] Linhas após o último mês lançado ficam "futuras" (somente leitura no `Pago`) mas refletem o cronograma realizado projetado.
- [ ] Quitação antecipada (saldo zera) marca meses subsequentes como "Quitado" e desabilita o input `Pago`.
- [ ] Verify in browser using dev-browser skill.

#### US-C09: UI — comparativo das três curvas
**Descrição:** Como usuário, quero ver Realizado × Normal × Meta em um gráfico e em métricas resumidas.

**Acceptance Criteria:**
- [ ] Gráfico Recharts com três séries de saldo devedor ao longo do tempo. **Meta é renderizada desde a criação do plano**, mesmo sem lançamentos reais.
- [ ] Cards de resumo: economia de juros (Realizado vs Normal), meses reduzidos (Realizado vs Normal), e o mesmo para Meta vs Normal.
- [ ] Toggle para alternar entre eixo "Saldo devedor" e "Juros acumulados".
- [ ] Quitação antecipada em qualquer curva é destacada com um **marcador visual** (ponto + rótulo "Quitado em mês N") na série correspondente.
- [ ] Se curva Meta inválida (US-C06), mostrar aviso explicativo no lugar da série.
- [ ] Verify in browser using dev-browser skill.

#### US-C10: Simulação pontual "e se?"
**Descrição:** Como usuário, quero simular um pagamento extra hipotético em um mês futuro (ex.: R$5.000 em abril/2026) sem comprometer dados.

**Acceptance Criteria:**
- [ ] Botão "Simular antecipação" abre modal com mês, valor e modo (reduzir prazo / parcela).
- [ ] Resultado mostra: nova data de quitação, juros economizados, parcelas economizadas — em overlay sobre o gráfico, sem persistir.
- [ ] Botão "Aplicar este lançamento" converte a simulação em entry real (US-C03).
- [ ] Verify in browser using dev-browser skill.

#### US-C11: Export do acompanhamento para Excel
**Descrição:** Como usuário, quero exportar plano + lançamentos + cronograma realizado/normal/meta para Excel.

**Acceptance Criteria:**
- [ ] Reuso do `core/finance` (sem nova lógica financeira no export).
- [ ] Abas: `Plano`, `Lançamentos`, `Cronograma Realizado`, `Cronograma Normal`, `Cronograma Meta`, `Comparativo`.
- [ ] Meses após quitação antecipada são exportados com status `Quitado` (saldo 0, parcela 0) até o fim do prazo original — facilita conferência lado a lado com a curva Normal.
- [ ] Dados exportados batem 1:1 com os exibidos na UI.

---

## 4. Functional Requirements

### Auth
- **FR-1:** O Worker deve expor `/api/auth/*` via handler oficial do Better Auth, com `database: env.DB`.
- **FR-2:** Métodos suportados: email/senha (com verificação e reset via Resend) **e** Google OAuth.
- **FR-3:** Turnstile deve ser exigido em sign-up, sign-in e forgot-password.
- **FR-4:** O middleware `requireUser` deve proteger toda rota `/api/scenarios/*`, `/api/payments/*` e `/api/tracker/*`.
- **FR-5:** `baseURL` do Better Auth deve ser derivado do request (origin) para suportar localhost e produção sem hardcode.

### Cliente / Cache
- **FR-6:** O cliente deve usar TanStack Query como única fonte de server-state, com persister em localStorage versionado.
- **FR-7:** Hook `useSession()` deve ser a única fonte de verdade da sessão no client.
- **FR-8:** `ProtectedRoute` deve redirecionar para `/login?next=...` quando deslogado, em `/historico` e `/acompanhamento/*`.
- **FR-9:** O Simulador (`/`) deve permanecer público.
- **FR-10:** O rascunho do Simulador deve ser autosalvo (localStorage; **e** D1 quando logado) e restaurado no refresh.

### Acompanhamento (nova aba)
- **FR-11:** Um plano de acompanhamento é independente de qualquer cenário salvo no histórico/simulador.
- **FR-12:** Cada plano armazena: nome, principal, entrada, prazo, taxa anual, modalidade, data de início, valor-meta mensal total.
- **FR-13:** Cada lançamento mensal armazena valor pago, data do pagamento, modo de aplicação (`reduce_term` ou `reduce_installment`) e nota opcional. **Valor pago deve ser ≥ parcela prevista** do mês — pagamento parcial não é suportado e é rejeitado pela API com 422.
- **FR-14:** A curva "Normal" é o cronograma sem antecipação (PRICE ou SAC).
- **FR-15:** A curva "Realizado" aplica cada lançamento respeitando seu `apply_mode`.
- **FR-16:** A curva "Meta" assume pagamento mensal fixo TOTAL (parcela + extra = meta). Excedente reduz prazo; se meta < parcela do mês, a curva é inválida e a UI deve indicar. **A curva Meta deve ser exibida desde a criação do plano, mesmo sem lançamentos reais.**
- **FR-17:** A UI deve oferecer simulação pontual "e se?" sem persistir, com opção de converter em lançamento real.
- **FR-18:** Toda lógica financeira do acompanhamento vive em `src/core/finance/tracker/` e usa Decimal.js.
- **FR-21:** Quitação antecipada (saldo zera antes do prazo) em qualquer curva deve ser destacada com marcador no gráfico e exportada com status `Quitado` nos meses seguintes.

### Banco
- **FR-19:** Migrations D1 criam `tracker_plans` e `tracker_entries`, com FKs para `user` (Better Auth) e índices descritos em US-C01.

### Operacional
- **FR-20:** CI deve continuar aplicando o pipeline definido em CLAUDE.md (typecheck, lint, test, build, `wrangler deploy --dry-run`).

---

## 5. Non-Goals (Out of Scope)

- **NG-1:** Outros providers OAuth além de Google (GitHub, Apple, etc.) ficam fora.
- **NG-2:** MFA / 2FA não estão neste escopo.
- **NG-3:** Migração automática de cenários antigos do `localStorage`/histórico atual para o novo módulo de acompanhamento (decisão do usuário: 6C — aba independente).
- **NG-4:** Pagamento parcial (`paid_amount < installment`) e cálculo de juros de mora/atraso. A API rejeita o lançamento; UI bloqueia antes do submit. Quem paga menos que a parcela deve resolver fora do app.
- **NG-5:** Notificações por e-mail/push de vencimento de parcela.
- **NG-6:** Edição em massa de lançamentos (CSV, paste, etc.).
- **NG-7:** Compartilhamento de plano entre usuários.
- **NG-8:** Substituir o Simulador existente ou modificar significativamente sua UI atual.
- **NG-9:** Integrar acompanhamento com a aba de histórico atual (continuam separados; 6C).
- **NG-10:** Suporte offline-first (PWA, service worker) — fora de escopo.

---

## 6. Design Considerations

- Reutilizar componentes shadcn já presentes (`components/ui/*`) e os domain components em `components/finance/*`.
- A aba "Acompanhamento" entra como item novo no `AppShell` da área autenticada, ao lado de "Histórico".
- Padrão visual das curvas:
  - **Realizado**: linha sólida, cor primária.
  - **Normal**: linha tracejada, cor neutra.
  - **Meta**: linha sólida fina, cor de acento.
- Inputs financeiros sempre formatados com `Intl.NumberFormat('pt-BR')` (helpers em `lib/formatters`).
- Botões "Continuar com Google" devem seguir as guidelines visuais do Google (logo oficial).

---

## 7. Technical Considerations

- **Better Auth ≥ 1.5** com `database: env.DB`. Confirmar versão no `package.json`; subir se necessário.
- D1 não suporta transações interativas — Better Auth usa `batch()` internamente; manter migrations alinhadas ao schema oficial do Better Auth para evitar drift.
- TanStack Query persister deve **excluir** chaves de mutation transitórias e a query de sessão (revalidar sempre).
- Validar que cookies de sessão funcionem em `localhost:5173` (Vite) chamando o Worker via proxy/`/api/*` — alinhar `sameSite` e `secure` por ambiente.
- `core/finance/tracker/` reutiliza primitivas de PRICE/SAC do engine existente; não duplicar fórmulas.
- Mutations otimistas no acompanhamento devem ter rollback no `onError` para preservar consistência visual.
- Manter a regra de `CLAUDE.md`: sem `any`, sem float em dinheiro, sem lógica financeira em componente.

---

## 8. Success Metrics

- 0 erros em sign-up/sign-in/sign-out em testes manuais e automatizados.
- Tempo até o primeiro paint após refresh em `/historico` cai (cache hit do TanStack Query) — meta qualitativa: dados visíveis em < 100 ms quando cache válido.
- Usuário consegue criar plano de acompanhamento, lançar 6 meses e visualizar as três curvas em < 2 min sem ajuda.
- Cobertura de testes do `core/finance/tracker/` ≥ 90 % das linhas.
- Build, typecheck, lint e suíte Vitest 100 % verdes no CI.

---

## 9. Open Questions

- **OQ-4:** Política de retenção dos `verification` tokens expirados — limpeza por job, ou deixar acumular? (Sugestão: cron Worker semanal — fora deste escopo, abrir issue.)
Resposta:
Não devemos deixar acumular indefinidamente. Para o MVP, isso não precisa bloquear a entrega de Auth + Cache + Acompanhamento, mas deve virar uma issue técnica de manutenção.

A decisão recomendada é implementar um Scheduled Worker / Cron Trigger semanal para remover tokens expirados da tabela verification, mantendo uma pequena janela de retenção para debug, por exemplo 7 ou 30 dias após a expiração.


### Resolvidas

- ~~OQ-1~~ → Pagamento parcial não é permitido. `paid_amount >= installment` é regra dura (US-C03, US-C08, FR-13, NG-4).
- ~~OQ-2~~ → Curva Meta é renderizada desde a criação do plano (US-C06, US-C09, FR-16).
- ~~OQ-3~~ → Quitação antecipada gera marcador no gráfico e meses subsequentes saem como `Quitado` no export (US-C05, US-C06, US-C08, US-C09, US-C11, FR-21).
- ~~OQ-5~~ → Draft do simulador é único por usuário, sobrescrito (US-B05, FR-10).
