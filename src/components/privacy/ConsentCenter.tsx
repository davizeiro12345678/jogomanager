import { clearLocalData, exportLocalData } from "@/lib/local-data-controls";
import { useEffect, useState } from "react";

import { Download, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { FirebasePushControl } from "./FirebasePushControl";

import { Switch } from "@/components/ui/switch";

import { TRUST_BADGES } from "@/components/privacy/trust-badges";
import { readConsent, saveConsent, type ConsentState } from "@/lib/consent";

export function TrustBadges() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Selos de segurança">
      {TRUST_BADGES.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground"
        >
          <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}

export function ConsentCenter() {
  const [state, setState] = useState<ConsentState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cookieManagerReady, setCookieManagerReady] = useState(false);
  useEffect(() => setState(readConsent()), []);
  useEffect(() => {
    const checkReady = () => setCookieManagerReady(getCookieManager()?.APIReady === true);
    checkReady();
    document.addEventListener("zarazConsentAPIReady", checkReady);
    return () => document.removeEventListener("zarazConsentAPIReady", checkReady);
  }, []);
  if (!state) return null;

  const update = (patch: Partial<ConsentState>) => {
    const next = saveConsent({
      analytics: patch.analytics ?? state.analytics,
      telemetry: patch.telemetry ?? state.telemetry,
    });
    setState(next);
    setMessage("Preferências salvas.");
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(exportLocalData(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meus-dados-jogomanager.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    if (!window.confirm("Apagar a carreira e as preferências salvas neste navegador?")) return;
    clearLocalData();
    setState(readConsent());
    setMessage("Dados deste navegador apagados.");
  };

  const rows = [
    {
      id: "essential",
      title: "Dados essenciais",
      desc: "Salvar a carreira, login e compras. Necessário para o jogo funcionar.",
      checked: true,
      disabled: true,
      onChange: () => undefined,
    },
    {
      id: "telemetry",
      title: "Telemetria de desempenho",
      desc: "FPS médio, tempo por quadro, navegador, qualidade gráfica, tempo de carregamento e códigos de erro. Sem nome, e-mail, texto digitado, chat ou save.",
      checked: state.telemetry,
      disabled: false,
      onChange: (v: boolean) => update({ telemetry: v }),
    },
    {
      id: "analytics",
      title: "Analytics anônimo",
      desc: "Quais telas são usadas, para melhorar o jogo. Sem perfis de publicidade.",
      checked: state.analytics,
      disabled: false,
      onChange: (v: boolean) => update({ analytics: v }),
    },
  ];

  return (
    <section
      className="surface-card rounded-xl border border-border/60 p-5"
      aria-labelledby="consent-title"
    >
      <h2 id="consent-title" className="font-display text-lg uppercase tracking-wide">
        Central de consentimento
      </h2>
      <div className="mt-4 divide-y divide-border/60">
        {rows.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-4 py-3">
            <label htmlFor={`consent-${r.id}`} className="text-sm">
              <span className="font-medium text-foreground">{r.title}</span>
              <span className="mt-1 block text-muted-foreground">{r.desc}</span>
            </label>
            <Switch
              id={`consent-${r.id}`}
              checked={r.checked}
              disabled={r.disabled}
              onCheckedChange={r.onChange}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {cookieManagerReady && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const manager = getCookieManager();
              if (manager?.APIReady) manager.modal = true;
            }}
          >
            <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden /> Preferências de cookies
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden /> Exportar meus dados (JSON)
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Apagar dados deste navegador
        </Button>
      </div>
      <FirebasePushControl />
      <p className="mt-3 text-xs text-muted-foreground" role="status" aria-live="polite">
        {message ??
          (state.decidedAt
            ? `Última escolha: ${new Date(state.decidedAt).toLocaleString("pt-BR")}. Você pode mudar quando quiser.`
            : "Nada opcional está ligado até você escolher.")}
      </p>
    </section>
  );
}

/** Only opens the provider's existing dialog; the visitor chooses their consent. */
function getCookieManager() {
  return (
    window as Window & {
      zaraz?: { consent?: { APIReady?: boolean; modal: boolean } };
    }
  ).zaraz?.consent;
}

export { ConsentBanner } from "./ConsentBanner";
