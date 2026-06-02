# Google OAuth — login social

Login com Google é **aditivo** e fica **desligado por padrão**: o `createAuth` só
registra o provider quando os secrets `GOOGLE_CLIENT_ID` **e** `GOOGLE_CLIENT_SECRET`
estão definidos no Worker (gating em `src/server/auth.ts`). Sem ambos, o fluxo
email/senha continua idêntico.

## 1. Criar credenciais no Google Cloud Console

1. Acesse <https://console.cloud.google.com/> e selecione (ou crie) um projeto.
2. Em **APIs & Services → OAuth consent screen**, configure a tela de consentimento:
   - Tipo: **External**.
   - Preencha nome do app, e-mail de suporte e domínio autorizado
     (`calculadorafinanceira.app`).
   - Scopes mínimos: `email`, `profile`, `openid`.
3. Em **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs** — adicione exatamente estes dois:
     - `http://localhost:5173/api/auth/callback/google` (dev local)
     - `https://calculadorafinanceira.app/api/auth/callback/google` (produção)
4. Salve e copie o **Client ID** e o **Client secret**.

> O caminho `/api/auth/callback/google` é montado pelo Better Auth como
> `{BETTER_AUTH_URL}/api/auth/callback/google`. Garanta que `BETTER_AUTH_URL` esteja
> correto (ver `docs/auth-diagnosis.md`) ou o `redirect_uri` divergirá do registrado.

## 2. Configurar os secrets no Worker

Os valores são **secrets**, não `vars` em `wrangler.jsonc`:

```bash
bunx --bun wrangler secret put GOOGLE_CLIENT_ID
# Em "Enter a secret value:" cole APENAS o Client ID

bunx --bun wrangler secret put GOOGLE_CLIENT_SECRET
# Em "Enter a secret value:" cole APENAS o Client secret
```

Para remover (desligar o login social):

```bash
bunx --bun wrangler secret delete GOOGLE_CLIENT_ID
bunx --bun wrangler secret delete GOOGLE_CLIENT_SECRET
```

## 3. Desenvolvimento local

Defina os secrets em `.env.local` (lido pelo wrangler/vite em dev):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

O botão "Continuar com Google" no front (US-006) só aparece quando
`VITE_GOOGLE_ENABLED=true` — mantenha-o desligado até os secrets estarem prontos.

## 4. Verificação

Com ambos os secrets presentes, `createAuth(env)` passa a expor
`options.socialProviders.google` e o endpoint
`POST /api/auth/sign-in/social` (provider `google`) fica disponível. Sem os
secrets, `options.socialProviders` é `undefined` e nada muda no fluxo atual.
