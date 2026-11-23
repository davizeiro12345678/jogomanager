import { useEffect, useRef, useState } from "react";

type TurnstileClient = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      "timeout-callback": () => void;
    },
  ) => string | number;
  remove: (id: string | number) => void;
};

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// This is the public site key for the existing JogoManager Auth widget,
// not its secret. A different hostname must configure its own public key.
const SITE_KEY = import.meta.env.VITE_AUTH_TURNSTILE_SITE_KEY || "0x4AAAAAAFtXRJproFio6FVc";

export function AuthTurnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let widgetId: string | number | null = null;
    const browser = window as Window & { turnstile?: TurnstileClient };
    const fail = () => {
      if (disposed) return;
      onToken(null);
      setLoadFailed(true);
    };
    const mount = () => {
      if (disposed || widgetId !== null || !elementRef.current || !browser.turnstile) return;
      try {
        widgetId = browser.turnstile.render(elementRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => {
            if (!disposed) {
              setLoadFailed(false);
              onToken(token);
            }
          },
          "expired-callback": () => onToken(null),
          "error-callback": fail,
          "timeout-callback": () => onToken(null),
        });
      } catch {
        fail();
      }
    };

    let script = document.querySelector<HTMLScriptElement>("script[data-manager-auth-turnstile]");
    if (!script) {
      script = document.createElement("script");
      script.dataset.managerAuthTurnstile = "true";
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", mount);
    script.addEventListener("error", fail);
    mount();

    return () => {
      disposed = true;
      script.removeEventListener("load", mount);
      script.removeEventListener("error", fail);
      if (widgetId !== null) browser.turnstile?.remove(widgetId);
    };
  }, [onToken]);

  return (
    <div className="mt-4 space-y-2" role="group" aria-label="Verificação de segurança">
      <div ref={elementRef} className="min-h-16" />
      {loadFailed && (
        <p role="alert" className="text-sm text-destructive">
          A verificação de segurança não carregou. Atualize a página e tente novamente.
        </p>
      )}
    </div>
  );
}
