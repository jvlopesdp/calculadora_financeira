import { useEffect } from "react";
import { Link } from "react-router-dom";

import { BrandLogo } from "@/components/brand/brand-logo";

/**
 * Placeholder público da política de privacidade. Mantém a página fora do
 * índice dos buscadores (meta robots noindex) enquanto o conteúdo legal real
 * não existe. Acessível pelo footer da LandingPage.
 */
export function PrivacidadePage() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#F7EFE2] text-foreground">
      <header className="mx-auto flex w-full max-w-3xl items-center px-4 py-6 md:px-6">
        <Link to="/">
          <BrandLogo className="h-8 w-auto md:h-10" />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-12 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Política de privacidade
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Esta página será atualizada em breve com nossa política de privacidade
          completa. Em caso de dúvidas, entre em contato.
        </p>
        <Link
          to="/"
          className="text-[#B94F45] hover:underline focus-visible:underline"
        >
          Voltar para o início
        </Link>
      </main>
    </div>
  );
}
