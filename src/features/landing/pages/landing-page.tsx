import { Link } from "react-router-dom";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";

/**
 * Página pública de entrada para visitantes anônimos. Apresenta a proposta da
 * Calculadora Financeira.app com um hero, um bloco de motivação e CTAs claros.
 * Usuários autenticados nunca veem esta página — o RootRoute redireciona para
 * /financiamento antes de renderizá-la.
 */
export function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 md:px-6">
        <BrandLogo className="h-8 w-auto md:h-10" />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/register">Criar conta</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center md:px-6">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Decisões financeiras com clareza
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
            Simule financiamentos, compare aluguel × compra e planeje pagamentos
            extras para enxergar o custo real de cada escolha.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link to="/financiamento">Começar a simular</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>

        <p className="max-w-2xl text-base text-muted-foreground">
          A Calculadora Financeira.app nasceu de uma dor real: planejar um
          financiamento sem depender de planilhas confusas ou conselhos vagos.
          Educação financeira não precisa ser complexa nem distante.
        </p>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row md:px-6">
        <span>© {year} Calculadora Financeira.app</span>
        <nav className="flex items-center gap-4">
          <Link to="/login" className="hover:underline focus-visible:underline">
            Entrar
          </Link>
          <Link
            to="/privacidade"
            className="hover:underline focus-visible:underline"
          >
            Privacidade
          </Link>
        </nav>
      </footer>
    </div>
  );
}
