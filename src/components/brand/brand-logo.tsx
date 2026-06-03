interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src="/brand/logo-nome.svg"
      alt="Calculadora Financeira.app"
      loading="eager"
      className={className}
    />
  );
}
