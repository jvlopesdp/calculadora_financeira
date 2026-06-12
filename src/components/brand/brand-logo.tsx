import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** Classes applied to the wrapper (typically visibility/sizing). */
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span className={cn("inline-block", className)}>
      <img
        src="/brand/logo-nome-light.svg"
        alt="Calculadora Financeira.app"
        loading="eager"
        className="h-full w-auto dark:hidden"
      />
      <img
        src="/brand/logo-nome.svg"
        alt="Calculadora Financeira.app"
        loading="eager"
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
