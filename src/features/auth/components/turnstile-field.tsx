import { useEffect, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

interface TurnstileFieldProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

const DEV_TOKEN = "dev-token-no-site-key";

/**
 * Renders the Cloudflare Turnstile widget. When VITE_TURNSTILE_SITE_KEY is
 * unset (dev), immediately fires `onToken` with a placeholder so the submit
 * button isn't blocked. The Worker bypasses verification in the same condition
 * (see src/server/turnstile.ts).
 */
export function TurnstileField({
  onToken,
  onExpire,
  onError,
}: TurnstileFieldProps) {
  const ref = useRef<TurnstileInstance | undefined>(undefined);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    if (!siteKey) {
      onToken(DEV_TOKEN);
    }
  }, [siteKey, onToken]);

  if (!siteKey) {
    return (
      <p className="text-muted-foreground text-xs" role="note">
        Verificação anti-bot desativada em desenvolvimento (defina
        VITE_TURNSTILE_SITE_KEY para ativar).
      </p>
    );
  }

  return (
    <div data-testid="turnstile-widget">
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        options={{ theme: "auto", language: "pt-BR" }}
        onSuccess={onToken}
        onExpire={() => {
          onExpire?.();
        }}
        onError={() => {
          onError?.();
        }}
      />
    </div>
  );
}
