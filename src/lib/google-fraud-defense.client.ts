const SCRIPT_ID = "google-fraud-defense-enterprise";

type RecaptchaEnterprise = {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: { enterprise?: RecaptchaEnterprise };
  }
}

let scriptPromise: Promise<RecaptchaEnterprise> | null = null;

function getSiteKey(): string | null {
  if (import.meta.env["VITE_GOOGLE_FRAUD_DEFENSE_ENABLED"] !== "true") return null;
  const key = import.meta.env["VITE_GOOGLE_RECAPTCHA_SITE_KEY"]?.trim();
  return key || null;
}

export function isGoogleFraudDefenseEnabled(): boolean {
  return getSiteKey() !== null;
}

function waitForEnterprise(): Promise<RecaptchaEnterprise> {
  const current = window.grecaptcha?.enterprise;
  if (current) return Promise.resolve(current);
  if (scriptPromise) return scriptPromise;

  const siteKey = getSiteKey();
  if (!siteKey) return Promise.reject(new Error("reCAPTCHA site key is not configured"));

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const timeout = window.setTimeout(() => {
      scriptPromise = null;
      reject(new Error("Google Fraud Defense timed out"));
    }, 8_000);

    const finish = () => {
      window.clearTimeout(timeout);
      const enterprise = window.grecaptcha?.enterprise;
      if (!enterprise) {
        scriptPromise = null;
        reject(new Error("Google Fraud Defense did not initialize"));
        return;
      }
      resolve(enterprise);
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        scriptPromise = null;
        reject(new Error("Google Fraud Defense could not be loaded"));
      },
      { once: true },
    );

    if (!existing) {
      script.id = SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`;
      document.head.append(script);
    }
  });

  return scriptPromise;
}

/** Missing or unavailable tokens go to the server, which owns observe/enforce policy. */
export async function createGoogleFraudDefenseToken(action: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const siteKey = getSiteKey();
  if (!siteKey) return null;

  try {
    const enterprise = await waitForEnterprise();
    let timeoutId: number | undefined;
    try {
      const token = await Promise.race([
        new Promise<string>((resolve, reject) => {
          enterprise.ready(() => {
            void enterprise.execute(siteKey, { action }).then(resolve, reject);
          });
        }),
        new Promise<never>((_resolve, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error("Google Fraud Defense execution timed out")),
            8_000,
          );
        }),
      ]);
      return token;
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  } catch {
    // An observer must not turn a blocked script/provider outage into a
    // client-side checkout denial. Enforce still rejects this missing token.
    return null;
  }
}
