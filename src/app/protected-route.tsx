import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useCurrentUser } from "@/lib/use-current-user";

/**
 * Gate de rota: redireciona para /login se o usuário não estiver autenticado.
 * Enquanto a sessão carrega, exibe um spinner mínimo para evitar flicker.
 *
 * Usado como wrapper de rotas pai no react-router (`<Route element={<ProtectedRoute/>}>`).
 */
export function ProtectedRoute() {
  const { user, isLoading } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[40vh] items-center justify-center"
      >
        <span className="text-muted-foreground text-sm">Carregando…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
