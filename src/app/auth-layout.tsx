import { Link, Outlet } from "react-router-dom";

import { BrandLogo } from "@/components/brand/brand-logo";

/**
 * Layout limpo para as rotas públicas de autenticação. Sem sidebar, sem header
 * com navegação — apenas a área central com a marca.
 */
export function AuthLayout() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 md:px-6">
        <Link to="/" className="mb-8 flex justify-center">
          <BrandLogo className="h-10 w-auto" />
        </Link>
        <Outlet />
      </main>
    </div>
  );
}
