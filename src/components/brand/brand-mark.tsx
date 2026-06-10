interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      src="/brand/logo-mark.svg"
      alt="Calculadora Financeira.app"
      loading="eager"
      className={className}
    />
  );
}
