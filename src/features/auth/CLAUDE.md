# auth feature

Public auth pages live under `pages/`, shared widgets under `components/`, and
zod schemas under `schemas/`.

## Patterns

- **Forms** use the shadcn `<Form>` wrapper from `@/components/ui/form` (which
  is `FormProvider` from react-hook-form) plus `FormField` → `FormItem` →
  `FormLabel` + `FormControl` + `FormMessage`. Validation messages come from
  the zod schema and surface automatically via `FormMessage` — don't render
  errors manually next to inputs.
- **Turnstile token** is collected via `<TurnstileField onToken={...} />`.
  When `VITE_TURNSTILE_SITE_KEY` is empty the field calls back with the
  placeholder `"dev-token-no-site-key"` so the submit button isn't blocked;
  the Worker's `verifyTurnstile` (src/server/turnstile.ts) returns `true`
  under the same condition.
- **Sending the turnstile token to Better Auth**: the strict-typed sign-up
  surface (`authClient.signUp.email(...)`) does NOT accept arbitrary body
  fields at type-level. Pass extras through `fetchOptions: { body: { ... } }`
  — the client proxy merges these into the POST body and our before-hook in
  `src/server/auth.ts` reads `ctx.body.turnstileToken` from there.
- **Error translation**: Better Auth surfaces server errors as
  `{ data: null, error: { code, message, status } }`. Map known `code` values
  (`USER_ALREADY_EXISTS`, `PASSWORD_TOO_SHORT`, our custom
  `TURNSTILE_INVALID`, etc.) to pt-BR strings; fall back to `error.message`
  or a generic message. Don't render the raw English message to users.
- **Testing form pages**: mock `@/lib/auth-client` with a module-scope
  `vi.fn()` returning the relevant endpoint; mock
  `@/features/auth/components/turnstile-field` with a stub button that
  invokes `onToken` so tests stay deterministic and don't need the real
  Turnstile script. Wrap in `<MemoryRouter>` + `<Routes>` so navigation
  assertions can verify the destination page.
- **Password reset method names**: the Better Auth v1.6.x client uses
  `authClient.requestPasswordReset({email, redirectTo})` and
  `authClient.resetPassword({newPassword, token})`. There is no
  top-level `authClient.forgetPassword` — that alias only exists on the
  email-OTP plugin. Match these names exactly; the dynamic-path proxy
  in `better-auth/client/proxy.mjs` translates them to
  `/request-password-reset` and `/reset-password` automatically.
- **Flash messages between auth pages** use a `?flash=<encoded>` query
  param read via `useSearchParams`. `/reset-password`'s success path
  navigates to `/login?flash=<msg>`; `LoginPage` renders the decoded
  message above the form with `aria-live="polite"`. No global toast
  system — a single querystring read keeps the auth flow self-contained.
