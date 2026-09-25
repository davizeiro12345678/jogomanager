import { useEffect, useState } from "react";
import { Download, Lock, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  clearLocalData,
  exportLocalData,
  readConsent,
  saveConsent,
  type ConsentState,
} from "@/lib/consent";

export const TRUST_BADGES = [
  { icon: Lock, label: "Conexão protegida por HTTPS/TLS" },
  { icon: ShieldCheck, label: "Analytics opcional" },
  { icon: ShieldCheck, label: "Telemetria opcional" },
  { icon: ShieldCheck, label: "Exportação JSON" },
  { icon: ShieldCheck, label: "Exclusão de dados" },
  { icon: ShieldCheck, label: "Consentimento revogável" },
  { icon: Lock, label: "Checkout seguro · Powered by Stripe" },
];

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
  useEffect(() => setState(readConsent()), []);
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
    <section className="surface-card rounded-xl border border-border/60 p-5" aria-labelledby="consent-title">
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
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden /> Exportar meus dados (JSON)
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Apagar dados deste navegador
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground" role="status" aria-live="polite">
        {message ??
          (state.decidedAt
            ? `Última escolha: ${new Date(state.decidedAt).toLocaleString("pt-BR")}. Você pode mudar quando quiser.`
            : "Nada opcional está ligado até você escolher.")}
      </p>
    </section>
  );
}

/** Aviso discreto na primeira visita; some depois da escolha. */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(readConsent().decidedAt === null);
    const close = () => setOpen(false);
    window.addEventListener("consent-changed", close);
    return () => window.removeEventListener("consent-changed", close);
  }, []);
  // Enquanto o aviso está aberto ele reserva espaço no fim da página: sem isso
  // ele cobria os botões do rodapé (ex.: "Jogar" na partida rápida) no celular.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!open) return;
    const previous = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "11rem";
    return () => {
      document.body.style.paddingBottom = previous;
    };
  }, [open]);
  if (!open) return null;
  const choose = (all: boolean) => {
    saveConsent({ analytics: all, telemetry: all });
    setOpen(false);
  };
  return (
    <div
      role="dialog"
      aria-label="Privacidade"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg"
    >
      <div className="pointer-events-auto rounded-xl border border-border bg-card p-4 shadow-lg">
        <p className="text-sm text-muted-foreground">
          Usamos só o essencial para salvar seu jogo. Quer ajudar a melhorar o desempenho com dados
          anônimos? <a href="/privacidade" className="text-primary underline">Saiba mais</a>
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => choose(true)}>Aceitar</Button>
          <Button size="sm" variant="outline" onClick={() => choose(false)}>Só o essencial</Button>
        </div>
      </div>
    </div>
  );
}
