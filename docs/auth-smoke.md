# Auth smoke test — calculadorafinanceira.app

Roteiro para validar manualmente que login/cadastro voltaram a funcionar após o reset do secret `BETTER_AUTH_URL` (ver [`auth-diagnosis.md`](./auth-diagnosis.md)).

Use sempre que houver suspeita de regressão em `/api/auth/*` ou após mudanças em `src/server/auth*.ts`.

---

## Pré-requisitos

- `wrangler` autenticado na conta `calculadora-financeira`.
- Um e-mail de teste seu (vamos chamar de `<SEU-EMAIL>`).
- Acesso ao caixa de entrada desse e-mail (para clicar no link de verificação do Resend).

---

## 1. Sanity check do handler (sem cookie)

```bash
curl -i https://calculadorafinanceira.app/api/auth/get-session
```

**Esperado:** `HTTP/2 200`, body `null` (Better Auth ≥ 1.5 — "sem sessão").
**Falha:** `HTTP 500` com `BetterAuthError: Invalid base URL` → secret `BETTER_AUTH_URL` está corrompido novamente; ver `auth-diagnosis.md`.

---

## 2. Estado inicial do D1 remoto

```bash
bunx --bun wrangler d1 execute calculadora-financeira-db --remote \
  --command "SELECT COUNT(*) AS n FROM user;"
```

Anote o número — vamos checar que sobe 1 após o sign-up.

---

## 3. Sign-up via UI (produção)

1. Abrir `https://calculadorafinanceira.app/cadastro`.
2. Preencher nome, `<SEU-EMAIL>`, senha forte.
3. Resolver o Turnstile.
4. Submeter.

**Esperado:** tela de "verifique seu e-mail" (ou equivalente). Nenhum erro 500 no DevTools → Network em `POST /api/auth/sign-up/email`.

### Conferir no D1 remoto

```bash
bunx --bun wrangler d1 execute calculadora-financeira-db --remote \
  --command "SELECT id, email, emailVerified, createdAt FROM user WHERE email = '<SEU-EMAIL>';"

bunx --bun wrangler d1 execute calculadora-financeira-db --remote \
  --command "SELECT providerId, accountId, userId FROM account WHERE userId = (SELECT id FROM user WHERE email = '<SEU-EMAIL>');"

bunx --bun wrangler d1 execute calculadora-financeira-db --remote \
  --command "SELECT identifier, expiresAt FROM verification WHERE identifier = '<SEU-EMAIL>' ORDER BY createdAt DESC LIMIT 1;"
```

**Esperado:**
- 1 linha em `user` com `emailVerified = 0`.
- 1 linha em `account` com `providerId = 'credential'`.
- 1 linha em `verification` com `expiresAt` ~24h no futuro.

---

## 4. Verificação de e-mail (Resend)

1. Abrir a caixa de entrada (cheque spam também).
2. Clicar no link "Verificar e-mail".

**Esperado:** redirect para o app, com mensagem de sucesso.

### Conferir no D1

```bash
bunx --bun wrangler d1 execute calculadora-financeira-db --remote \
  --command "SELECT email, emailVerified FROM user WHERE email = '<SEU-EMAIL>';"
```

**Esperado:** `emailVerified = 1`.

---

## 5. Sign-in

1. Abrir `https://calculadorafinanceira.app/login`.
2. Logar com `<SEU-EMAIL>` + senha + Turnstile.

**Esperado:**
- Redirect para `/historico` (ou rota pós-login).
- Em DevTools → Application → Cookies, existe `better-auth.session_token` em `.calculadorafinanceira.app`, `Secure`, `HttpOnly`, `SameSite=Lax`.

### Conferir a sessão no servidor com esse cookie

```bash
COOKIE='better-auth.session_token=<COLE_VALOR_DO_DEVTOOLS>'

curl -i https://calculadorafinanceira.app/api/auth/get-session \
  -H "cookie: $COOKIE"
```

**Esperado:** `HTTP/2 200`, body com `{ "user": { ... }, "session": { ... } }` (não `null`).

### Conferir rota protegida

```bash
curl -i https://calculadorafinanceira.app/api/tracker/plans \
  -H "cookie: $COOKIE"
```

**Esperado:** `HTTP/2 200` com `{ "plans": [] }` se não houver financiamentos. Sem cookie deve dar `401`.

---

## 6. Sign-out

Na UI: botão "Sair".

```bash
curl -i https://calculadorafinanceira.app/api/auth/get-session \
  -H "cookie: $COOKIE"
```

**Esperado:** `200` com `null` (sessão revogada) — o cookie pode até continuar no navegador, mas o servidor não o reconhece mais.

---

## 7. Reset de senha (opcional, smoke periódico)

1. `https://calculadorafinanceira.app/esqueci-senha`.
2. Submeter `<SEU-EMAIL>` + Turnstile.
3. Clicar no link do e-mail.
4. Definir nova senha.
5. Logar com a nova senha (passo 5 acima).

---

## Critérios de aceitação consolidados (para fechar US-A01)

- [ ] Passo 1 retorna 200 + `null`.
- [ ] Passo 3 cria registros em `user`/`account`/`verification` no D1 remoto.
- [ ] Passo 4 marca `emailVerified = 1`.
- [ ] Passo 5 devolve cookie `better-auth.session_token` e `/api/auth/get-session` autenticado retorna o user.
- [ ] Passo 5 (variante) — `/api/tracker/plans` retorna 200 com cookie e 401 sem cookie.
- [ ] Passo 6 invalida a sessão no servidor.

Se algum passo falhar, abrir issue com o `cf-ray` da resposta + saída do `wrangler d1 execute` correspondente.
