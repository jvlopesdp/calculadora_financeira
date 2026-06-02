import { Outlet, useLocation } from "react-router-dom";

import { AuthRequiredModal } from "@/app/auth-required-modal";
import { useSession } from "@/lib/queries/session";

/**
 * Gate de rota: exibe o conteúdo com um modal de autenticação sobreposto
 * quando o usuário não está autenticado. O fundo permanece visível e fosco
 * (efeito do overlay do Dialog). Enquanto a sessão carrega, exibe um spinner.
 */
export function ProtectedRoute() {
  const { user, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
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
    const next = `${location.pathname}${location.search}`;
    return (
      <>
        <Outlet />
        <AuthRequiredModal next={next} />
      </>
    );
  }

  return <Outlet />;
}
