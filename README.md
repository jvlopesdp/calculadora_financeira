# calculadora_financeira

Aplicação para apoiar decisões de financiamento imobiliário e investimentos.
Frontend Vite + React, backend em Cloudflare Workers (Hono) com persistência em
Cloudflare D1 e autenticação via Better Auth.

Produção: **https://calculadorafinanceira.app**

---

## Stack

- **Runtime / scripts:** Bun
- **Frontend:** Vite + React 19 + TypeScript + Tailwind + shadcn/ui + Recharts
- **Backend:** Cloudflare Workers + Hono (em `src/server/`)
- **Banco:** Cloudflare D1 (migrations em `migrations/`)
- **Auth:** Better Auth (e-mail/senha, verificação de e-mail, reset de senha)
- **E-mail:** Resend
- **Anti-bot:** Cloudflare Turnstile

---

## Setup local

Requisitos: [Bun](https://bun.sh) instalado.

```bash
# 1. Instalar dependências
bun install

# 2. Copiar variáveis de ambiente e preencher os valores
cp .env.example .env.local

# 3. Criar o banco D1 (uma vez por conta Cloudflare)
bunx --bun wrangler d1 create calculadora-financeira-db
# Copie o database_id retornado para o campo correspondente em wrangler.jsonc.

# 4. Aplicar migrations no banco local
bun run db:migrate:local

# 5. Subir o ambiente de dev (SPA + Worker)
bun run dev
```

> **Observação sobre o Wrangler:** se o seu Node local for < 22, invoque o
> wrangler via `bunx --bun wrangler ...` em vez do binário direto, para
> aproveitar o runtime do Bun.

### Variáveis principais (`.env.local`)

| Variável | Uso |
| --- | --- |
| `VITE_APP_URL` | URL pública da app (`http://localhost:5173` em dev) |
| `BETTER_AUTH_URL` | URL base usada pelo Better Auth |
| `BETTER_AUTH_SECRET` | Segredo para assinar sessões (`openssl rand -base64 32`) |
| `VITE_TURNSTILE_SITE_KEY` | Site key (pública) do Turnstile |
| `TURNSTILE_SECRET_KEY` | Secret do Turnstile (só Worker) |
| `RESEND_API_KEY` | Chave da API do Resend |
| `EMAIL_FROM` | Remetente verificado no Resend |

Em produção os segredos vão para o Worker via `wrangler secret put <NOME>`.

---

## Scripts úteis

```bash
bun run dev              # SPA + Worker em desenvolvimento
bun run typecheck        # tsc -b (SPA + Worker)
bun run lint             # ESLint
bun run test             # Vitest (rodar SEMPRE em foreground)
bun run build            # Build SPA + Worker
bun run db:migrate:local # Aplica migrations no D1 local
bun run db:migrate:remote# Aplica migrations no D1 de produção
bun run deploy           # wrangler deploy (Cloudflare)
```

---

## Estrutura

```
src/
  app/                # router, AppShell, ProtectedRoute, 404
  core/finance/       # motor financeiro (puro, Decimal.js)
  features/
    simulator/        # UI principal do simulador
    historico/        # cenários salvos + pagamentos (autenticado)
    auth/             # login, cadastro, recuperação, verificação
  components/         # shadcn/ui + componentes de domínio
  lib/                # api-client, auth-client, formatters, helpers
  server/             # Worker Hono: /api/auth/*, /api/scenarios/*, etc.
migrations/           # SQL D1 (better-auth, domain, rate-limit)
```

---

## Definição de pronto

- Build passa (SPA + Worker)
- `typecheck`, `lint` e `test` passam
- Migrations D1 aplicadas
- Lógica financeira fica em `core/finance`
- Sem dependências novas sem justificativa
