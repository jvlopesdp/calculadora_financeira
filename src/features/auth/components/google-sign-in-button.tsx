import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function resolveCallbackURL(next: string | null | undefined): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/historico";
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1809l-2.9087-2.2581c-.806.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9574C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9574 4.0418L3.964 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9574 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
      />
    </svg>
  );
}

interface GoogleSignInButtonProps {
  next?: string | null;
}

/**
 * "Continuar com Google" button + an "ou" divider above the email/password
 * form. Hidden by default (dev-friendly) until VITE_GOOGLE_ENABLED is
 * explicitly set to "true" — the backend only activates the provider when
 * both Google secrets are present (see docs/google-oauth.md).
 */
export function GoogleSignInButton({ next }: GoogleSignInButtonProps) {
  const handleClick = useCallback(() => {
    void authClient.signIn.social({
      provider: "google",
      callbackURL: resolveCallbackURL(next),
    });
  }, [next]);

  if (import.meta.env.VITE_GOOGLE_ENABLED !== "true") {
    return null;
  }

  return (
    <div className="mb-6 space-y-4">
      <Button
        type="button"
        variant="outline"
        className="w-full bg-background"
        onClick={handleClick}
      >
        <GoogleLogo />
        Continuar com Google
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card text-muted-foreground px-2">ou</span>
        </div>
      </div>
    </div>
  );
}
