# PRD: Identidade Visual, "Meus Financiamentos" e Gestão de Conta

## Introdução / Visão Geral

Este PRD cobre quatro frentes de melhoria do app de simulação financeira (`calculadorafinanceira.app`):

1. **Identidade visual da Landing Page** — corrigir contraste das cores (especialmente no dark mode) e o fundo branco da logo no light mode, reaproveitando os tokens de cor do CSS do projeto (`src/index.css`).
2. **Padronização de selects/dropdowns** — todos os menus suspensos (ex.: "Reduzir parcela" / "Reduzir prazo") hoje aparecem com fundo azul e fontes diferentes (estilo nativo do browser); devem usar o CSS/identidade do projeto.
3. **Unificação de Histórico + Acompanhamento** numa única aba chamada **"Meus Financiamentos"** (exclusiva para usuários logados), combinando os KPIs/gráficos do Histórico com a tabela editável de pagamentos do Acompanhamento, na qual lançar um valor pago **recalcula todas as parcelas seguintes** e **atualiza os KPIs** em tempo real.
4. **Gestão de conta** — sair da conta, ver conta, editar informações pessoais, trocar senha e excluir a conta (hard delete com reautenticação).

O problema central: a identidade visual está inconsistente e com contraste ruim, há duas telas (Histórico e Acompanhamento) que conceitualmente são a mesma coisa e confundem o usuário, e não há autogestão de conta.

## Objetivos

- Garantir contraste acessível (WCAG AA) na Landing em light e dark mode, usando exclusivamente os tokens do tema.
- Eliminar cores hardcoded da Landing (`#F7EFE2`, `#B94F45`) substituindo por variáveis CSS do tema.
- Dar à logo com texto um fundo de contraste (faixa horizontal mais escura) no light mode.
- Padronizar 100% dos selects/dropdowns para a identidade do projeto.
- Unificar Histórico e Acompanhamento numa única aba "Meus Financiamentos", com um único modelo de dados.
- Permitir lançar valores pagos numa tabela que recalcula automaticamente as parcelas subsequentes (amortização extra, modo configurável: reduzir prazo / reduzir parcela) e atualiza os KPIs.
- Disponibilizar gestão de conta completa: logout, visualizar conta, editar dados, trocar senha e excluir conta.

## User Stories

> Ordem sugerida de implementação. Stories de UI devem ser verificadas no browser com a skill `dev-browser`.

### Tema A — Identidade Visual da Landing Page

#### US-001: Substituir cores hardcoded da Landing pelos tokens do tema
**Description:** Como usuário, quero que a Landing use as cores oficiais da identidade visual para que a experiência seja consistente entre light e dark mode.

**Acceptance Criteria:**
- [ ] Remover `bg-[#F7EFE2]` e `bg-[#B94F45]` de `src/features/landing/pages/landing-page.tsx`.
- [ ] Substituir por classes/tokens do tema (`bg-background`, `bg-primary`, `text-primary-foreground`, `text-foreground`, `text-muted-foreground`, etc.) definidos em `src/index.css`.
- [ ] O CTA principal usa `bg-primary` / `text-primary-foreground`.
- [ ] Nenhuma cor hexadecimal hardcoded permanece no componente da Landing.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser (light e dark) usando a skill dev-browser.

#### US-002: Corrigir contraste do texto inicial (hero) em dark mode
**Description:** Como usuário em dark mode, quero ler o texto inicial com contraste adequado para que a leitura não seja prejudicada.

**Acceptance Criteria:**
- [ ] O texto do hero usa `text-foreground` (títulos) e `text-muted-foreground` (subtítulos), garantindo contraste em ambos os modos.
- [ ] Contraste de texto principal atinge no mínimo WCAG AA (4.5:1) em light e dark mode.
- [ ] Verificar visualmente em dark mode que não há texto "apagado" sobre o fundo.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser (light e dark) usando a skill dev-browser.

#### US-003: Faixa horizontal de contraste atrás da logo no light mode
**Description:** Como usuário, quero ver a logo com texto sobre uma faixa de contraste para que ela não fique "boiando" num fundo branco.

**Acceptance Criteria:**
- [ ] No light mode, a logo com texto (`BrandLogo` / `logo-nome.svg`) é exibida sobre uma faixa horizontal com cor mais escura do tema (ex.: `bg-primary` ou `bg-secondary`/`bg-foreground` conforme legibilidade da logo).
- [ ] A faixa ocupa a largura adequada (full-width ou container) e mantém a logo legível.
- [ ] No dark mode, a faixa se adapta (ou é desnecessária) sem perda de contraste.
- [ ] A cor da faixa vem de token do tema, não hardcoded.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser (light e dark) usando a skill dev-browser.

### Tema B — Padronização de Selects/Dropdowns

#### US-004: Estilizar o componente Select com a identidade do projeto
**Description:** Como usuário, quero que todos os menus suspensos tenham a mesma aparência da identidade visual para uma experiência consistente.

**Acceptance Criteria:**
- [ ] Revisar `src/components/ui/select.tsx` (atualmente `<select>` nativo): aplicar tokens do tema ao controle e às opções (`bg-background`, `text-foreground`, `border-input`, `font-sans`, foco com `ring-ring`).
- [ ] Eliminar o "fundo azul" e a fonte divergente das opções do `<select>` (estilizar `option`/control o quanto o nativo permitir; se o nativo não permitir o nível de controle necessário, migrar para `Select` do Radix/shadcn — ver Considerações Técnicas).
- [ ] A fonte das opções é a do projeto (`--font-sans`, Poppins).
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser (light e dark) usando a skill dev-browser.

#### US-005: Aplicar o Select padronizado em todos os pontos do app
**Description:** Como usuário, quero que o seletor "Reduzir parcela / Reduzir prazo" e qualquer outra lista suspensa sigam o mesmo padrão.

**Acceptance Criteria:**
- [ ] O seletor de modo em `src/features/acompanhamento/components/tracker-spreadsheet.tsx` (e seu equivalente na nova aba) usa o componente Select padronizado.
- [ ] Buscar e atualizar todos os usos de `<select>`/Select no app para o padrão único.
- [ ] Nenhum dropdown exibe estilo nativo do browser (fundo azul / fonte diferente).
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser (light e dark) usando a skill dev-browser.

### Tema C — Unificação Histórico + Acompanhamento → "Meus Financiamentos"

#### US-006: Definir e migrar para um modelo de dados único
**Description:** Como desenvolvedor, preciso unificar os dois backends (`financing_scenarios`/`scenario_payments` e `tracker_plans`/`tracker_entries`) num único modelo para que exista uma só fonte de verdade.

**Acceptance Criteria:**
- [ ] Definir o modelo canônico unificado (base recomendada: tabelas do tracker, que já suportam tabela editável + recálculo — ver Considerações Técnicas).
- [ ] Criar migração D1 em `migrations/` que: cria/ajusta o esquema unificado e migra os dados existentes de `financing_scenarios`/`scenario_payments` para o modelo canônico (mapeando `paymentType`/`amortizationStrategy` → `apply_mode`, valores em centavos/basis points conforme convenção atual).
- [ ] Migração rodada localmente (`bun run db:migrate:local`) sem perda de dados.
- [ ] Tabelas/colunas obsoletas marcadas para depreciação (não removidas no mesmo passo, para rollback seguro).
- [ ] Typecheck passa.

#### US-007: Consolidar as rotas de API no modelo único
**Description:** Como desenvolvedor, preciso que a API exponha um único conjunto de rotas para os financiamentos do usuário.

**Acceptance Criteria:**
- [ ] As rotas do recurso unificado (CRUD de financiamentos + lançamentos) existem e operam sobre o modelo canônico.
- [ ] Rotas antigas redundantes redirecionam ou são depreciadas sem quebrar clientes existentes durante a transição.
- [ ] `src/lib/api-client.ts` aponta para as rotas unificadas.
- [ ] Testes de servidor (Hono via `app.request` com D1 fake) cobrem create/list/upsert/delete do recurso unificado.
- [ ] Typecheck e testes passam.

#### US-008: Criar a rota e a navegação "Meus Financiamentos"
**Description:** Como usuário logado, quero acessar uma única aba "Meus Financiamentos" no lugar de Histórico e Acompanhamento.

**Acceptance Criteria:**
- [ ] Nova rota `/meus-financiamentos` (lista) e `/meus-financiamentos/:id` (detalhe), protegidas por `ProtectedRoute`.
- [ ] `/historico`, `/historico/:scenarioId`, `/acompanhamento`, `/acompanhamento/novo` e `/acompanhamento/:id` redirecionam para as novas rotas equivalentes.
- [ ] Sidebar (`src/components/app-sidebar.tsx`) mostra um único item "Meus Financiamentos" (remover os dois itens antigos).
- [ ] A aba é exibida apenas para usuários logados.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando a skill dev-browser.

#### US-009: Exibir os KPIs do financiamento na nova aba
**Description:** Como usuário, quero ver os KPIs macro (% já pago, saldo devedor, parcelas restantes, economia vs cronograma original, prazo reduzido) para acompanhar meu progresso.

**Acceptance Criteria:**
- [ ] Cards de KPI exibem: **% já pago**, **saldo devedor**, **parcelas restantes**, **economia vs cronograma original**, **prazo reduzido (meses)**, **juros pagos até agora**.
- [ ] KPIs computados no `core/finance` (reaproveitando `build-scenario-detail-kpis`, `build-tracker-kpis`, `replay-payments`/`tracker`), nunca dentro de componentes.
- [ ] Quando não há lançamentos, os KPIs mostram estado vazio com instrução (ex.: "Registre lançamentos para acompanhar o progresso").
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando a skill dev-browser.

#### US-010: Exibir o gráfico Previsto x Real na nova aba
**Description:** Como usuário, quero ver o gráfico de saldo/juros Previsto (sem extras) x Real (com pagamentos) para visualizar o impacto das antecipações.

**Acceptance Criteria:**
- [ ] Gráfico (Recharts) compara curva Prevista (cronograma original) x Real (com pagamentos lançados), reaproveitando `build-detail-chart-data` / `build-curves`.
- [ ] As séries usam os tokens de cor de chart do tema (`--chart-1`..`--chart-5`).
- [ ] O gráfico atualiza ao inserir/editar lançamentos.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando a skill dev-browser.

#### US-011: Tabela de pagamentos editável com lançamento de valores pagos
**Description:** Como usuário, quero lançar os valores pagos diretamente numa tabela grande (formato do Acompanhamento) para registrar meus pagamentos mês a mês.

**Acceptance Criteria:**
- [ ] A tabela exibe colunas: Mês, Vencimento, Parcela prevista, Valor pago (input), Modo (Reduzir prazo / Reduzir parcela), saldo/efeito.
- [ ] O input de valor pago aceita valores e usa `CurrencyInput`.
- [ ] O seletor de Modo por linha usa o Select padronizado (US-004).
- [ ] O lançamento é persistido no modelo unificado (US-006/US-007).
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando a skill dev-browser.

#### US-012: Recalcular parcelas subsequentes ao lançar um valor pago
**Description:** Como usuário, quero que ao lançar um valor pago diferente da parcela prevista, todas as parcelas seguintes sejam recalculadas, para que a projeção reflita a realidade.

**Acceptance Criteria:**
- [ ] A diferença `valor pago − parcela prevista` (quando positiva) é tratada como **amortização extra**.
- [ ] O recálculo respeita o **modo** escolhido na linha: **Reduzir prazo** (mantém parcela, reduz nº de parcelas) ou **Reduzir parcela** (mantém prazo, reduz valor das parcelas seguintes).
- [ ] **Todas as parcelas subsequentes** são recalculadas (hoje a parcela prevista se mantém indevidamente — isso deve ser corrigido).
- [ ] A lógica de recálculo vive em `core/finance` (pura, Decimal.js), com testes unitários para: redução de prazo, redução de parcela, pagamento exatamente igual à parcela (sem efeito extra) e pagamento parcial.
- [ ] Typecheck, lint e testes passam.
- [ ] Verificar no browser usando a skill dev-browser.

#### US-013: KPIs e gráfico atualizam em tempo real conforme os lançamentos
**Description:** Como usuário, quero que ao inserir valores na tabela os KPIs e o gráfico se ajustem imediatamente, para ter feedback instantâneo.

**Acceptance Criteria:**
- [ ] Ao salvar/editar um lançamento, os KPIs (US-009) e o gráfico (US-010) recalculam e refletem o novo estado.
- [ ] Estado derivado via `useMemo`/invalidação de query — sem duplicar valores calculados (regra "derived state").
- [ ] Sem recarregar a página, o usuário vê os valores ajustados.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando a skill dev-browser.

#### US-014: Simular antecipação (what-if) na nova aba
**Description:** Como usuário, quero simular uma antecipação antes de registrá-la, para avaliar o impacto sem comprometer os dados reais.

**Acceptance Criteria:**
- [ ] Mantém a funcionalidade de simulação ("what-if") do Acompanhamento (`tracker-what-if-dialog` / `simulate-next-payment-card`) na nova aba.
- [ ] A simulação mostra o efeito (economia, prazo reduzido) sem persistir até o usuário confirmar.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando a skill dev-browser.

### Tema D — Gestão de Conta

#### US-015: Endpoints de servidor para gestão de conta
**Description:** Como desenvolvedor, preciso de endpoints para ler/atualizar dados de conta, trocar senha e excluir conta.

**Acceptance Criteria:**
- [ ] `GET /api/account` retorna dados do usuário autenticado (nome, e-mail, data de criação).
- [ ] `PATCH /api/account` atualiza informações pessoais (nome; e-mail conforme política — ver Open Questions).
- [ ] Troca de senha via Better Auth (change-password) exigindo senha atual.
- [ ] `DELETE /api/account` faz **hard delete** do usuário e de todos os dados associados (financiamentos, lançamentos, sessões), exigindo reautenticação.
- [ ] Todas as rotas exigem sessão (`require-user`) e validam input.
- [ ] Testes de servidor cobrem sucesso e falhas (não autenticado, senha incorreta, reautenticação inválida).
- [ ] Typecheck e testes passam.

#### US-016: Habilitar logout e menu "Conta" no NavUser
**Description:** Como usuário logado, quero sair da conta e acessar minha conta pelo menu para gerenciar meu acesso.

**Acceptance Criteria:**
- [ ] O item "Sair" no `src/components/nav-user.tsx` funciona (já existe — validar fluxo: invalida sessão, redireciona para `/login`).
- [ ] O item "Conta" (hoje desabilitado/placeholder) é habilitado e navega para a página de conta.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando a skill dev-browser.

#### US-017: Página "Minha Conta" — visualizar e editar informações pessoais
**Description:** Como usuário, quero ver e editar minhas informações pessoais (nome, e-mail) numa página de conta.

**Acceptance Criteria:**
- [ ] Rota protegida `/conta` exibe dados do usuário (nome, e-mail, data de criação).
- [ ] Formulário permite editar nome (e e-mail conforme política), com validação e feedback de sucesso/erro.
- [ ] Salva via `PATCH /api/account` e atualiza a UI/sessão.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando a skill dev-browser.

#### US-018: Trocar senha na página de conta
**Description:** Como usuário, quero trocar minha senha estando logado para manter minha conta segura.

**Acceptance Criteria:**
- [ ] Seção/formulário "Trocar senha" com: senha atual, nova senha, confirmar nova senha.
- [ ] Validação de força/correspondência; erro claro se a senha atual estiver incorreta.
- [ ] Usa o fluxo de change-password do Better Auth.
- [ ] Feedback de sucesso e (conforme política) revogação de outras sessões.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando a skill dev-browser.

#### US-019: Excluir conta (hard delete com reautenticação)
**Description:** Como usuário, quero excluir minha conta e todos os meus dados de forma definitiva, caso eu deseje encerrar o uso.

**Acceptance Criteria:**
- [ ] Seção "Excluir conta" com aviso claro de irreversibilidade.
- [ ] Dialog de confirmação exige reautenticação (digitar e-mail/senha) antes de excluir.
- [ ] Ao confirmar, chama `DELETE /api/account`, faz hard delete de usuário + todos os dados (financiamentos, lançamentos, sessões).
- [ ] Após exclusão, a sessão é encerrada e o usuário é redirecionado para a Landing/`/login`.
- [ ] Typecheck, lint e testes passam.
- [ ] Verificar no browser usando a skill dev-browser.

## Functional Requirements

**Identidade Visual (Landing)**
- FR-1: A Landing não pode conter cores hexadecimais hardcoded; deve usar tokens de `src/index.css`.
- FR-2: O texto do hero deve atingir contraste WCAG AA em light e dark mode.
- FR-3: A logo com texto deve aparecer sobre uma faixa horizontal de cor mais escura (token do tema) no light mode.

**Selects/Dropdowns**
- FR-4: O componente Select deve usar os tokens do tema (cores, borda, foco) e a fonte do projeto.
- FR-5: Todos os dropdowns do app (incluindo "Reduzir parcela / Reduzir prazo") devem usar o componente padronizado; nenhum pode exibir o estilo nativo do browser.

**Meus Financiamentos**
- FR-6: Deve existir um único modelo de dados (uma fonte de verdade) para os financiamentos do usuário, com migração dos dados existentes.
- FR-7: Deve existir uma única aba `/meus-financiamentos`, protegida por login, substituindo Histórico e Acompanhamento (com redirects das rotas antigas).
- FR-8: A aba deve exibir KPIs: % já pago, saldo devedor, parcelas restantes, economia vs cronograma original, prazo reduzido e juros pagos.
- FR-9: A aba deve exibir o gráfico Previsto x Real.
- FR-10: A aba deve incluir uma tabela editável onde o usuário lança valores pagos por mês, com seletor de modo por linha.
- FR-11: Ao lançar um valor pago, o sistema deve tratar o excedente sobre a parcela prevista como amortização extra e recalcular **todas** as parcelas subsequentes conforme o modo (reduzir prazo / reduzir parcela).
- FR-12: KPIs e gráfico devem atualizar imediatamente após cada lançamento.
- FR-13: Toda lógica de recálculo deve viver em `core/finance` (pura, Decimal.js) com testes unitários.
- FR-14: A simulação de antecipação (what-if) deve estar disponível sem persistir dados até confirmação.

**Gestão de Conta**
- FR-15: O sistema deve permitir logout (encerrar sessão e redirecionar para `/login`).
- FR-16: Deve existir rota `/conta` protegida para visualizar e editar informações pessoais.
- FR-17: O sistema deve permitir trocar a senha exigindo a senha atual.
- FR-18: O sistema deve permitir excluir a conta com reautenticação, fazendo hard delete de usuário + todos os dados.
- FR-19: Todas as rotas de conta devem exigir sessão autenticada e validar input.

## Não-Objetivos (Fora de Escopo)

- Não inclui redesenho completo da Landing além de contraste/identidade e faixa da logo.
- Não inclui migração de identidade visual para fora do esquema de tokens já existente em `src/index.css` (não criar nova paleta).
- Não inclui novos tipos de simulação financeira além dos já existentes (PRICE/SAC, amortização extra, aluguel x financiar).
- Não inclui login social/OAuth, 2FA ou recuperação de conta excluída.
- Não inclui notificações ou lembretes baseados nos KPIs.
- Não inclui exportação de novos formatos além dos já existentes (Excel/CSV).
- A remoção física das tabelas antigas (`financing_scenarios`/`scenario_payments`) pode ser feita num passo posterior; este PRD apenas as deprecia após a migração.

## Considerações de Design

- Reaproveitar os tokens de `src/index.css` (oklch): `--background`, `--foreground`, `--primary`, `--secondary`, `--accent`, `--muted-foreground`, `--chart-1..5`, `--font-sans` (Poppins).
- Reaproveitar componentes existentes: `CurrencyInput`, cards de KPI (`scenario-savings-card`, `build-tracker-kpis`), gráficos (`tracker-curves-chart`, `build-detail-chart-data`), dialogs (`payment-form-dialog`, `tracker-what-if-dialog`).
- A tabela editável deve seguir o layout do `tracker-spreadsheet.tsx` (formato preferido pelo usuário para lançar pagamentos).
- Os cards de KPI do topo seguem o layout inicial do Histórico (apreciado pelo usuário).
- Página de conta: usar primitivas shadcn já presentes; manter consistência com as páginas de auth.

## Considerações Técnicas

- **Modelo canônico recomendado:** usar as tabelas do tracker (`tracker_plans` + `tracker_entries`) como base, pois já suportam tabela editável e recálculo (`core/finance/tracker/`). Migrar `financing_scenarios`/`scenario_payments` para esse modelo, mapeando `paymentType` (parcela/amortizacao_extra/misto) e `amortizationStrategy` (prazo/parcela) → `apply_mode` (reduce_term/reduce_installment). Atenção às convenções de centavos e basis points.
- **Bug atual a corrigir:** hoje a "parcela prevista" não muda após lançamentos. O motor de recálculo deve, a cada amortização extra, recomputar o cronograma restante. Reaproveitar/estender `replay-payments.ts` e `core/finance/tracker/` (normalSchedule, realizedSchedule, goalSchedule).
- **Select nativo:** `src/components/ui/select.tsx` usa `<select>` nativo, que tem limitações de estilo (especialmente cor de fundo das `option` em alguns browsers). Avaliar migração para `Select` do Radix/shadcn caso o controle de estilo necessário não seja alcançável no nativo. Decisão registrada nas Open Questions.
- **Servidor:** rotas de conta em `src/server/routes/` com `require-user`; troca de senha e exclusão via APIs do Better Auth quando disponíveis. Testes via `app.request(path, init, env)` com D1 fake (sem miniflare).
- **Migração D1:** seguir o fluxo de `bun run db:migrate:local` (dev) e `bun run db:migrate:remote` (deploy/CI).
- **Definição de Pronto** (CLAUDE.md): build SPA + Worker, typecheck, lint, testes e migrações aplicadas; lógica financeira somente em `core/finance`.

## Métricas de Sucesso

- 0 cores hardcoded na Landing; contraste de texto ≥ AA verificado em light e dark.
- 0 dropdowns exibindo estilo nativo do browser.
- Histórico e Acompanhamento reduzidos a uma única aba; rotas antigas redirecionando.
- Ao lançar um pagamento, 100% das parcelas subsequentes recalculam corretamente (validado por testes unitários e no browser).
- KPIs e gráfico atualizam sem reload após cada lançamento.
- Usuário consegue: sair, ver/editar conta, trocar senha e excluir conta — cada um em fluxo funcional e testado.

## Open Questions

1. **Edição de e-mail:** alterar e-mail deve disparar nova verificação de e-mail (e-mail só muda após confirmação) ou pode ser alterado diretamente? (Recomendado: exigir reverificação.) Exigir verificação
2. **Select nativo vs Radix:** confirmar se podemos migrar `ui/select.tsx` para o `Select` do Radix/shadcn (mais controle de estilo) ou se há razão para manter o nativo (acessibilidade mobile, peso de bundle). O que você achar melhor
3. **Sessões ao trocar senha:** ao trocar a senha, devemos revogar as demais sessões ativas do usuário? Sim
4. **Remoção das tabelas antigas:** quando agendar a remoção física de `financing_scenarios`/`scenario_payments` após a migração (mesma release ou release seguinte)? O que achar mais rápido
5. **Nome da aba/rota:** confirmar slug `/meus-financiamentos` e rótulo "Meus Financiamentos" (vs. "Meu Financiamento" no singular). Faça no plural

