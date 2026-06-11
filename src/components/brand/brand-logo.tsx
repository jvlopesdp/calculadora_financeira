import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** Classes applied to the wordmark `<img>` (typically sizing). */
  className?: string;
  /** Classes applied to the contrast strip wrapping the wordmark. */
  containerClassName?: string;
}

/**
 * Wordmark da marca (`logo-nome.svg`, texto branco) exibido sobre uma faixa
 * horizontal de contraste. O texto branco ficaria ilegível sobre o fundo
 * creme/branco do light mode, então a faixa usa o token `bg-primary` (vermelho
 * da marca) — que se adapta entre light/dark sem perda de contraste.
 */
export function BrandLogo({ className, containerClassName }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "bg-primary inline-flex items-center justify-center rounded-md px-3 py-2",
        containerClassName,
      )}
    >
      <img
        src="/brand/logo-nome.svg"
        alt="Calculadora Financeira.app"
        loading="eager"
        className={className}
      />
    </span>
  );
}
