import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme: "auto";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "jgm-auth-turnstile-script";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;

  loading = new Promise<TurnstileApi>((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const existing = Boolean(script);
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
    }
    const target = script;

    const onLoad = () => {
      cleanup();
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile SDK unavailable"));
    };
    const onError = () => {
      cleanup();
      target.remove();
      loading = null;
      reject(new Error("Turnstile SDK failed to load"));
    };
    const cleanup = () => {
      target.removeEventListener("load", onLoad);
      target.removeEventListener("error", onError);
    };
    target.addEventListener("load", onLoad, { once: true });
    target.addEventListener("error", onError, { once: true });
    if (!existing) document.head.appendChild(target);
  }).catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

export function AuthTurnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey || !mount.current) return;
    let alive = true;
    let id: string | null = null;
    void loadTurnstile()
      .then((turnstile) => {
        if (!alive || !mount.current) return;
        id = turnstile.render(mount.current, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => {
            onTokenRef.current(null);
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (alive) {
          setFailed(true);
          onTokenRef.current(null);
        }
      });
    return () => {
      alive = false;
      if (id && window.turnstile) window.turnstile.remove(id);
      onTokenRef.current(null);
    };
  }, [siteKey]);

  return (
    <div className="space-y-2">
      <div ref={mount} aria-label="Verificação anti-bot Cloudflare Turnstile" />
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          A verificação de segurança não carregou. Confira sua conexão e recarregue a página.
        </p>
      )}
    </div>
  );
}
