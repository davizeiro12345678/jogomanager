import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/context";
import { authRecoveryMessages } from "@/i18n/auth-recovery-messages";

type Turnstile = {
  ready: (callback: () => void) => void;
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};

const getTurnstile = () => (window as Window & { turnstile?: Turnstile }).turnstile;
let scriptLoading: Promise<Turnstile> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  const existing = getTurnstile();
  if (existing) return Promise.resolve(existing);
  if (!scriptLoading) {
    scriptLoading = new Promise<Turnstile>((resolve, reject) => {
      const script = document.createElement("script");
      const fail = () => {
        window.clearTimeout(timer);
        script.remove();
        scriptLoading = undefined;
        reject(new Error("CAPTCHA unavailable"));
      };
      const timer = window.setTimeout(fail, 15_000);
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => {
        const api = getTurnstile();
        if (!api) return fail();
        window.clearTimeout(timer);
        resolve(api);
      };
      script.onerror = fail;
      document.head.append(script);
    });
  }
  return scriptLoading;
}

export function AuthCaptcha({
  siteKey,
  onToken,
  onRetry,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  onRetry: () => void;
}) {
  const copy = authRecoveryMessages(useT().lang);
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let api: Turnstile | undefined;
    let id: string | undefined;
    const clear = () => {
      if (active) onToken(null);
    };
    const fail = () => {
      if (active) {
        clear();
        setFailed(true);
      }
    };
    void loadTurnstile()
      .then((loaded) => {
        api = loaded;
        loaded.ready(() => {
          if (!active || !container.current) return;
          try {
            id = loaded.render(container.current, {
              sitekey: siteKey,
              callback: (token) => {
                if (active) {
                  setFailed(false);
                  onToken(token);
                }
              },
              "expired-callback": clear,
              "timeout-callback": fail,
              "error-callback": fail,
            });
          } catch {
            fail();
          }
        });
      })
      .catch(fail);
    return () => {
      active = false;
      if (id !== undefined) api?.remove(id);
    };
  }, [siteKey, onToken]);

  return (
    <section aria-label={copy.captchaTitle} className="mt-4 space-y-2">
      <p className="text-sm">{copy.captchaTitle}</p>
      <div ref={container} className="min-h-16 max-w-full" />
      {failed && (
        <div role="alert" className="text-sm">
          {copy.captchaUnavailable}
          <button type="button" className="ml-2 min-h-11 underline" onClick={onRetry}>
            {copy.captchaRetry}
          </button>
        </div>
      )}
    </section>
  );
}
