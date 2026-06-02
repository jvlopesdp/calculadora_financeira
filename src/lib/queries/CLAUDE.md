# `src/lib/queries/`

TanStack Query hooks — the single layer the SPA uses to read/write D1-backed server-state. Components must consume these hooks, never call `src/lib/api-client.ts` directly.

## Conventions

- **One module per resource** (`scenarios.ts`, `payments.ts`, …). Each exports its `*_QUERY_KEY` constant and/or a `xQueryKey(id)` helper plus the hooks.
- **queryKey shape:** list = `['scenarios']`; detail = `['scenario', id]`; nested list = `['scenarios', scenarioId, 'payments']` (use the exported helper, don't hand-write the array at call sites).
- **queryFn = the plain `api-client` function.** The fetch wrappers stay in `api-client.ts` and are reused here (and inside `useQueries` for dynamic lists). Don't inline `fetch`.
- **Mutations invalidate their list key in `onSuccess`** (`qc.invalidateQueries({ queryKey: … })`) and may `setQueryData` the detail key to seed the cache.
- **Optimistic mutations** (e.g. `useUpsertTrackerEntry`/`useDeleteTrackerEntry`) take the parent id as a HOOK arg (not a mutation var) so the cache key is fixed. Shape: `onMutate` → `await qc.cancelQueries({queryKey})` + snapshot `previous = qc.getQueryData(key)` + `qc.setQueryData(key, optimistic)`, `return { previous }`; `onError(_e,_v,ctx)` → `qc.setQueryData(key, ctx.previous)` rollback; `onSuccess(serverRow)` → reconcile the optimistic row with the canonical server row (real id/created_at). Type the context as the 4th `UseMutationResult` generic. There is **no toast lib** — surface mutation errors as an inline `role="alert"` banner at the call site, not a global toast.
- **`enabled` gating:** queries that depend on a route param take the id as an arg and set `enabled: Boolean(id)`; hooks that should lazy-load (e.g. a dropdown) accept an `{ enabled }` option.
- No `any`; export typed `UseQueryResult<T, Error>` / `UseMutationResult<…>`.

## Testing

- Wrap `renderHook`/`render` in `<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>`. `retry: false` makes rejected queries surface `isError` immediately.
- Mock `@/lib/api-client` with `vi.importActual` + spread, overriding only the functions under test (keeps `ApiError` and types intact).
- This gotcha cascades: ANY component test that renders something using these hooks (including `<AppRoutes/>` / `<AppShell/>`, since the shell mounts `MigrateLocalSimulationDialog`) needs the provider or it throws "No QueryClient set".
