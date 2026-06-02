# Auth diagnosis — 2026-05-27

## Sintoma

Em produção (`https://calculadorafinanceira.app`), `GET /api/auth/get-session` retornava `HTTP 500`. Login e cadastro estavam inutilizáveis. Logs do Worker (ray `a0296e3c9f482535`):

```
BetterAuthError: Invalid base URL: bunx --bun wrangler secret put BETTER_AUTH_URL. Please provide a valid base URL.
```

## Causa raiz

O secret `BETTER_AUTH_URL` do Worker foi gravado com o **texto literal do comando**:

```
bunx --bun wrangler secret put BETTER_AUTH_URL
```

— alguém pressionou Enter no prompt "Enter a secret value:" colando a linha de comando inteira em vez do valor pretendido (`https://calculadorafinanceira.app`).

Better Auth chama `new URL(baseURL)` no boot do handler. Como a string não é URL válida, a chamada lança e qualquer request em `/api/auth/*` cai em 500 — inclusive `get-session`, `sign-in`, `sign-up`, callbacks OAuth, links de verificação por e-mail e validação de origin/CSRF.

Por que afeta tudo:

- **Inicialização**: `new URL(baseURL)` quebra antes de qualquer handler executar.
- **Cookies de sessão**: `Domain` e `Secure` saem do `baseURL`.
- **OAuth**: o `redirect_uri` enviado a providers (Google, etc.) é montado como `{baseURL}/api/auth/callback/<provider>`. Sem URL válida, divergência com o registrado no console do provider.
- **E-mails (verify, reset)**: links são `{baseURL}/...`.
- **Origin/CSRF**: Better Auth compara `Origin` do request contra `baseURL`.

## Correção pontual (já aplicada)

Resetar o secret no Worker:

```bash
bunx --bun wrangler secret put BETTER_AUTH_URL
# Em "Enter a secret value:" digitar APENAS:
https://calculadorafinanceira.app
```

Validação:

```bash
curl -i https://calculadorafinanceira.app/api/auth/get-session
# Esperado: HTTP 200, body `null` (Better Auth ≥ 1.5 — "sem sessão").
```

Confirmado em 2026-05-27 — `HTTP 200`, body `null`.

## Correção durável (recomendação — não aplicada neste PR)

Para eliminar a classe inteira de bug (secret mal preenchido derruba auth), recomenda-se mudar `createAuth(env)` para `createAuth(env, requestUrl?)` e derivar o `baseURL` do **origin do request**, mantendo `env.BETTER_AUTH_URL` apenas como fallback opcional. Ficou de fora deste PR por escolha de escopo — o reset do secret já restaurou produção. Reabrir como item separado se o bug voltar a aparecer.

Esboço:

- `src/server/auth.ts`: `baseURL = requestUrl ? new URL(requestUrl).origin : env.BETTER_AUTH_URL`.
- `src/server/index.ts`: handler de `/api/auth/*` passa `c.req.url`.
- `src/server/middleware/require-user.ts`: idem ao validar sessão.
- `src/server/env.d.ts`: `BETTER_AUTH_URL` vira `?:` (opcional).

## Validação pós-fix

Roteiro completo em [`auth-smoke.md`](./auth-smoke.md). Resumo do estado atual:

- [x] Reset do secret em produção.
- [x] `curl /api/auth/get-session` → 200.
- [ ] Smoke ponta-a-ponta (sign-up, verify e-mail, sign-in, rota protegida, sign-out) — executar e marcar via `auth-smoke.md`.

## Limpeza periódica

A tabela `verification` do Better Auth acumula tokens (verificação de e-mail, reset de senha) que não são apagados automaticamente após expirarem. Para evitar crescimento ilimitado, um cron semanal do Worker faz a poda:

- **Trigger:** `triggers.crons: ["0 4 * * 0"]` em `wrangler.jsonc` (domingo, 04:00 UTC).
- **Handler:** `scheduled` em `src/server/index.ts` roda `delete from "verification"` para tokens cujo `expiresAt` é anterior a `Date.now() - 30 dias`.
- **Janela de retenção:** mantém tokens por 30 dias **após** a expiração, para que um token recém-expirado ainda seja inspecionável ao depurar problemas de auth.
- **Observabilidade:** cada execução emite `console.log({ event: "verification_cleanup", removed: <n> })` nos logs do Worker.

## Como prevenir reincidência

- O comando `wrangler secret put X` é **interativo**: o prompt "Enter a secret value:" precisa receber **apenas o valor**, nunca o comando colado de novo.
- Para automação sem prompt, usar `echo "<valor>" | wrangler secret put X` ou `wrangler secret put X --stdin` (depende da versão), nunca pipeline encadeado que vaze o comando como valor.
- Em PRs que tocam `auth.ts` / `auth-options.ts`, manter o teste de boot do handler verde (atual `auth-rate-limit-response.test.ts` exercita isso indiretamente).
