import { Outlet } from "react-router-dom";

/**
 * Layout limpo para as rotas públicas de autenticação. Sem sidebar, sem header
 * com navegação — apenas a área central com a marca.
 */
export function AuthLayout() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-screen-xl items-center px-4 py-4 md:px-6">
          <span className="font-serif text-lg font-bold md:text-xl">
            Calculadora Financeira
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}
