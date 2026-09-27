// ============================================================================
//  screen-kit.ts
//  Kit de telas do jogo: os mesmos blocos em todas as telas.
//
//  Antes cada uma das 18 telas de carreira desenhava o seu próprio "sem
//  carreira" — alguns com botão, outros sem, uns com cartão, outros com texto
//  solto. O resultado era um jogo que parecia 18 jogos diferentes nos estados
//  de borda (vazio, erro, carregando), que são justamente os que o jogador vê
//  quando algo dá errado.
//
//  Regras do kit:
//   - todo estado vazio tem UMA ação clara (nunca beco sem saída);
//   - todo erro tem "tentar de novo" (nunca tela morta);
//   - todo carregamento anuncia para leitor de tela (`aria-busy`);
//   - todo botão tem 44px de altura mínima (toque no celular).
// ============================================================================

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { GameShell } from "@/components/game/GameShell";

/** Altura mínima de toque (44px) usada em todos os botões do kit. */
const TOUCH = "min-h-11";

/**
 * Estado padrão de "sem carreira": navegação do jogo + cartão com explicação
 * e caminho para começar. Substitui os 18 blocos artesanais espalhados.
 */
export function NoCareer({ hint }: { hint?: string }) {
  return (
    <GameShell career={null}>
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p
          aria-hidden="true"
          className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 font-display text-3xl"
        >
          ⚽
        </p>
        <h1 className="mt-4 font-display text-2xl uppercase tracking-wide">
          Nenhuma carreira ativa
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hint ??
            "Escolha um clube para montar o elenco, definir a escalação e começar a temporada."}
        </p>
        <Link
          to="/new"
          className={`mt-6 inline-flex ${TOUCH} items-center rounded-xl bg-primary px-6 font-display text-sm uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.02] motion-reduce:transform-none`}
        >
          Começar carreira
        </Link>
        <Link
          to="/partida-rapida"
          className={`mt-2 inline-flex ${TOUCH} items-center rounded-xl px-6 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline`}
        >
          ou jogue uma partida rápida sem salvar
        </Link>
      </main>
    </GameShell>
  );
}

/** Cabeçalho padrão de tela: nome, contexto e ações. */
export function ScreenHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 font-display text-2xl uppercase tracking-wide">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Cartão de seção: agrupa conteúdo com título opcional. */
export function SectionCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-card rounded-2xl border border-border/60 p-4 sm:p-5 ${className}`}>
      {title ? (
        <h2 className="mb-3 font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/** Faixa de estatísticas: até 4 cartões lado a lado, empilhando no celular. */
export function StatStrip({ stats }: { stats: { label: string; value: string; hint?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="surface-card rounded-xl border border-border/60 px-3 py-2.5"
        >
          <dt className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {stat.label}
          </dt>
          <dd className="mt-0.5 font-display text-xl tabular-nums">{stat.value}</dd>
          {stat.hint ? <dd className="text-[11px] text-muted-foreground">{stat.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** Estado vazio genérico: ícone, título, dica e uma ação. */
export function EmptyState({
  icon = "📭",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <p aria-hidden="true" className="text-4xl">
        {icon}
      </p>
      <p className="mt-3 font-display text-lg uppercase tracking-wide">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Erro recuperável: explica, oferece tentar de novo e (quando há detalhe
 * técnico) mostra escondido num <details> em vez de assustar o jogador.
 */
export function ErrorPanel({
  title = "Algo saiu errado",
  hint,
  detail,
  onRetry,
  retryLabel = "Tentar de novo",
}: {
  title?: string;
  hint?: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <p aria-hidden="true" className="text-4xl">
        ⚠️
      </p>
      <p className="mt-3 font-display text-lg uppercase tracking-wide">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={`mt-4 inline-flex ${TOUCH} items-center rounded-xl bg-primary px-6 font-display text-sm uppercase tracking-wider text-primary-foreground`}
        >
          {retryLabel}
        </button>
      ) : null}
      {detail ? (
        <details className="mt-3 max-w-full text-left text-xs text-muted-foreground">
          <summary
            className={`cursor-pointer ${TOUCH} inline-flex items-center underline-offset-4 hover:underline`}
          >
            Detalhe técnico
          </summary>
          <pre className="mt-2 max-w-full overflow-x-auto rounded-lg bg-muted/40 p-3">{detail}</pre>
        </details>
      ) : null}
    </div>
  );
}

/** Esqueleto de carregamento: linhas pulsantes que anunciam espera. */
export function SkeletonRows({
  rows = 4,
  label = "Carregando",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-2">
      <p className="sr-only">{label}…</p>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-12 animate-pulse rounded-xl bg-muted/50 motion-reduce:animate-none"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * Botão primário do jogo (44px, caixa alta, foco visível). Centraliza o estilo
 * para as telas não reinventarem o botão principal cada uma de um jeito.
 */
export function PrimaryButton({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex ${TOUCH} items-center justify-center rounded-xl bg-primary px-6 font-display text-sm uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transform-none`}
    >
      {children}
    </button>
  );
}

/** Link com aparência de botão primário. */
export function PrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={`inline-flex ${TOUCH} items-center justify-center rounded-xl bg-primary px-6 font-display text-sm uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.02] motion-reduce:transform-none`}
    >
      {children}
    </Link>
  );
}
