import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground text-sm uppercase tracking-wide">
        Erro 404
      </p>
      <h1 className="font-serif text-3xl font-bold md:text-4xl">
        Página não encontrada
      </h1>
      <p className="text-muted-foreground max-w-md text-base">
        O endereço que você acessou não existe ou foi movido.
      </p>
      <Link
        to="/financiamento"
        className="text-primary hover:underline focus-visible:underline"
      >
        Voltar para o simulador
      </Link>
    </div>
  );
}
