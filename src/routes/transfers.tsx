import { gamePageHead } from "@/lib/game-page-metadata";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { GameShell } from "@/components/game/GameShell";
import {
  EmptyState,
  NoCareer,
  PrimaryButton,
  SkeletonRows,
  SectionCard,
  ScreenHeader,
} from "@/components/game/screen-kit";
import {
  AGENT_DESC,
  AGENT_LABEL,
  agentConversation,
  agentOpener,
  agentReact,
  moodFor,
  MOOD_EMOJI,
} from "@/game/agent";
import { acceptOffer, rejectOffer } from "@/game/career";
import { CLUBS } from "@/game/data/leagues";
import { ownsRealPlayer } from "@/game/player-identity";
import { formatMoney, formatWage, wageBill } from "@/game/economy";
import { playerForDisplay } from "@/game/player-development";
import { safeMoney } from "@/game/financial-inputs";
import {
  askingPrice,
  bidFor,
  clubName,
  negotiate,
  sellToClub,
  signRealPlayer,
  quoteRealSigning,
  toTarget,
  wageAsk,
  windowOpen,
  type RealTarget,
} from "@/game/realMarket";
import { releasePlayer } from "@/game/transfers";
import { useCareer } from "@/hooks/useCareer";
import { searchRealPlayers } from "@/lib/football.functions";

export const Route = createFileRoute("/transfers")({
  ssr: false,
  head: () => gamePageHead("/transfers"),
  component: TransfersPage,
});

const POS = ["ALL", "GK", "DF", "MF", "FW"];

function TransfersPage() {
  const { career, update } = useCareer();
  const search = useServerFn(searchRealPlayers);

  const [q, setQ] = useState("");
  const [pos, setPos] = useState("ALL");
  const [maxAge, setMaxAge] = useState(40);
  const [minOvr, setMinOvr] = useState(60);
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<RealTarget | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["market", q, pos, maxAge, minOvr, page],
    queryFn: () => search({ data: { q, pos, maxAge, minOvr, page } }),
    staleTime: 60_000,
  });

  const signed = useMemo(() => new Set(career?.transferredIn ?? []), [career]);

  if (!career) return <NoCareer />;

  const players = Object.values(career.players)
    .filter((p) => p.clubId === career.clubId)
    .map((p) => playerForDisplay(p, career));
  const bill = wageBill(players);
  const open = windowOpen(career);
  const rows = (data?.rows ?? [])
    .map(toTarget)
    .filter((t) => !signed.has(t.id) && t.clubId !== career.clubId && !ownsRealPlayer(career, t));

  return (
    <GameShell career={career}>
      {career.offers.length > 0 ? (
        <section className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-5">
          <h2 className="font-display text-xl uppercase tracking-wide">Clubes interessados</h2>
          <ul className="mt-3 space-y-2">
            {career.offers.map((o) => {
              const p = career.players[o.playerId];
              const c = CLUBS[o.clubId];
              if (!p || !c) return null;
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3"
                >
                  <Crest club={c} size={34} />
                  <div>
                    <p className="text-sm font-medium">
                      {c.name} quer {p.name} ({p.pos} · {p.ovr})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Proposta {formatMoney(o.amount)} · salário oferecido {formatWage(o.wage)} ·
                      expira na rodada {o.expiresRound}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => update(acceptOffer(career, o.id))}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs uppercase tracking-wider text-primary-foreground"
                    >
                      Vender
                    </button>
                    <button
                      onClick={() => update(rejectOffer(career, o.id))}
                      className="rounded-md bg-secondary px-3 py-1.5 text-xs uppercase tracking-wider"
                    >
                      Recusar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <SectionCard className="rounded-2xl border border-border/60 surface-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <ScreenHeader title="Mercado da bola" />
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                open ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
              }`}
            >
              {open ? "Janela aberta" : "Janela fechada"}
            </span>
            <span className="ml-auto rounded-lg bg-secondary px-3 py-1 font-display text-sm">
              Caixa: <span className="text-primary">{formatMoney(career.finances.budget)}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Jogadores reais de todos os clubes importados. Folha atual: {formatWage(bill)}/semana.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="market-q" className="sr-only">
              Buscar jogador
            </label>
            <input
              id="market-q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por nome…"
              className="min-w-[10rem] flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-1" role="tablist" aria-label="Filtrar por posição">
              {POS.map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={pos === f}
                  onClick={() => {
                    setPos(f);
                    setPage(0);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs uppercase tracking-wider transition ${
                    pos === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:brightness-125"
                  }`}
                >
                  {f === "ALL" ? "Todos" : f}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Idade máxima: <span className="font-display text-foreground">{maxAge}</span>
              <input
                type="range"
                min={17}
                max={40}
                value={maxAge}
                onChange={(e) => {
                  setMaxAge(Number(e.target.value));
                  setPage(0);
                }}
                className="mt-1 w-full accent-[var(--club-primary,theme(colors.primary.DEFAULT))]"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Nível mínimo: <span className="font-display text-foreground">{minOvr}</span>
              <input
                type="range"
                min={50}
                max={92}
                value={minOvr}
                onChange={(e) => {
                  setMinOvr(Number(e.target.value));
                  setPage(0);
                }}
                className="mt-1 w-full"
              />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            {isFetching && rows.length === 0 ? (
              <SkeletonRows rows={6} label="Buscando jogadores" />
            ) : rows.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="Nenhum jogador encontrado"
                hint="Tente abrir a idade máxima, baixar o nível mínimo ou mudar a posição."
                action={
                  <PrimaryButton
                    onClick={() => {
                      setQ("");
                      setPos("ALL");
                      setMaxAge(40);
                      setMinOvr(60);
                      setPage(0);
                    }}
                  >
                    Limpar filtros
                  </PrimaryButton>
                }
              />
            ) : (
              rows.map((t) => {
                const club = CLUBS[t.clubId];
                const price = askingPrice(t, career);
                return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/40 bg-background/40 p-3 transition hover:border-primary/60 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="w-[34px] shrink-0">
                        {club ? <Crest club={club} size={34} detail="simple" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {t.pos} · {t.age} anos · {clubName(t.clubId)}
                        </p>
                      </div>
                      <span className="shrink-0 font-display text-xl">{t.ovr}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="whitespace-nowrap text-sm sm:w-20 sm:text-right">
                        {formatMoney(price)}
                      </span>
                      <button
                        disabled={!open}
                        onClick={() => setTarget(t)}
                        className="whitespace-nowrap rounded-md bg-primary px-4 py-1.5 font-display text-xs uppercase tracking-wider text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
                      >
                        Negociar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md bg-secondary px-3 py-1.5 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-xs text-muted-foreground">Página {page + 1}</span>
            <button
              disabled={!data?.hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md bg-secondary px-3 py-1.5 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </SectionCard>

        <SellPanel career={career} update={update} />
      </div>

      {target ? (
        <NegotiationDialog
          target={target}
          onClose={() => setTarget(null)}
          career={career}
          update={update}
        />
      ) : null}
    </GameShell>
  );
}

type Career = NonNullable<ReturnType<typeof useCareer>["career"]>;

function SellPanel({ career, update }: { career: Career; update: (s: Career) => void }) {
  const players = Object.values(career.players)
    .filter((p) => p.clubId === career.clubId)
    .map((p) => playerForDisplay(p, career))
    .sort((a, b) => a.ovr - b.ovr);
  const buyers = Object.values(CLUBS)
    .filter((c) => c.id !== career.clubId)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 40);

  return (
    <SectionCard className="rounded-2xl border border-border/60 surface-card p-5">
      <h2 className="font-display text-xl uppercase tracking-wide">Vender ou dispensar</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        A venda entra direto no caixa. Rescisão custa 20% do valor. Elenco mínimo: 16 atletas.
      </p>
      <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto text-sm">
        {players.map((p) => {
          const buyer = buyers[Math.abs(p.name.length * 7 + p.number) % buyers.length]!;
          const fee = bidFor(career, p, buyer.id);
          return (
            <li key={p.id} className="rounded-lg border border-border/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span>
                  <span className="text-muted-foreground">{p.pos}</span> {p.name}
                  <span className="ml-2 font-display">{p.ovr}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {formatWage(p.wage)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {buyer.name} ofereceria {formatMoney(fee)}
                </span>
                <button
                  onClick={() => update(sellToClub(career, p.id, buyer.id, fee))}
                  className="ml-auto rounded-md bg-primary/90 px-2.5 py-1 text-[10px] uppercase tracking-wider text-primary-foreground"
                >
                  Vender
                </button>
                <button
                  onClick={() => update(releasePlayer(career, p.id))}
                  className="rounded-md bg-destructive/20 px-2.5 py-1 text-[10px] uppercase tracking-wider text-destructive transition hover:bg-destructive/30"
                >
                  Dispensar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function NegotiationDialog({
  target,
  career,
  update,
  onClose,
}: {
  target: RealTarget;
  career: Career;
  update: (s: Career) => void;
  onClose: () => void;
}) {
  const ask = askingPrice(target, career);
  const [fee, setFee] = useState(ask);
  const [wage, setWage] = useState(wageAsk(target));
  const [loan, setLoan] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [conv, setConv] = useState(() => agentConversation(target.id));
  const [opener] = useState(() => agentOpener(conv.agent, target.name, clubName(target.clubId)));
  const mood = moodFor(conv.heat);
  const agentFee = safeMoney(fee * (conv.agent.feePct / 100));

  const quote = quoteRealSigning(career, target, { fee, wage, loan, agentFee });
  const cost = quote.upfrontCost;
  const affordable = quote.affordable;
  const wageOk = wage >= wageAsk(target);

  function propose() {
    // o empresário reage primeiro: pode animar, endurecer ou sair da mesa
    const reply = agentReact(
      conv,
      target.name,
      ask > 0 ? fee / ask : 1,
      ask,
      `${target.id}-${career.season}-${career.round}-${attempt}`,
    );
    setConv({ ...conv });
    setAttempt((a) => a + 1);
    if (reply.walkedAway) {
      setLog((l) => [`${conv.agent.name}: ${reply.line}`, ...l]);
      return;
    }
    const res = negotiate(career, target, fee, attempt);
    setLog((l) => [`${conv.agent.name}: ${reply.line}`, res.message, ...l]);
    if (res.status === "accepted") setAgreed(true);
    if (res.status === "counter" && res.counter) setFee(res.counter);
    else if (reply.counter) setFee(reply.counter);
  }

  function close() {
    update(
      signRealPlayer(career, target, { fee, wage, loan, agentFee, agentName: conv.agent.name }),
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg animate-scale-in rounded-2xl border border-border/60 bg-card p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          {CLUBS[target.clubId] ? <Crest club={CLUBS[target.clubId]!} size={40} /> : null}
          <div>
            <h3 className="font-display text-xl uppercase tracking-wide">{target.name}</h3>
            <p className="text-xs text-muted-foreground">
              {target.pos} · {target.age} anos · OVR {target.ovr} · {clubName(target.clubId)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-border/40 bg-background/40 p-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-display text-sm"
            >
              {conv.agent.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {conv.agent.name}{" "}
                <span className="text-muted-foreground">· {AGENT_LABEL[conv.agent.persona]}</span>
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {AGENT_DESC[conv.agent.persona]}
              </p>
            </div>
            <span title={`Humor: ${mood}`} className="text-2xl" aria-label={`Humor: ${mood}`}>
              {MOOD_EMOJI[mood]}
            </span>
          </div>
          <p className="mt-2 text-xs italic text-foreground/90">“{opener}”</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              Comissão: <span className="font-display text-foreground">{conv.agent.feePct}%</span>{" "}
              (€
              {agentFee}M)
            </span>
            <span className="ml-auto">Paciência:</span>
            <span aria-hidden="true" className="tracking-tighter">
              {"●".repeat(Math.max(0, conv.patienceLeft))}
              <span className="opacity-25">
                {"●".repeat(Math.max(0, conv.agent.patience - conv.patienceLeft))}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-xs text-muted-foreground">
            Proposta: <span className="font-display text-foreground">{formatMoney(fee)}</span>{" "}
            (pedido {formatMoney(ask)})
            <input
              type="range"
              min={Math.max(0.3, Math.round(ask * 0.4 * 10) / 10)}
              max={Math.round(ask * 2 * 10) / 10}
              step={0.1}
              value={fee}
              onChange={(e) => {
                setFee(Number(e.target.value));
                setAgreed(false);
              }}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Salário oferecido:{" "}
            <span className="font-display text-foreground">{formatWage(wage)}</span> (pedido{" "}
            {formatWage(wageAsk(target))})
            <input
              type="range"
              min={Math.round(wageAsk(target) * 0.5)}
              max={Math.round(wageAsk(target) * 2)}
              value={wage}
              onChange={(e) => setWage(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={loan} onChange={(e) => setLoan(e.target.checked)} />
            Empréstimo por uma temporada (paga 25% do valor e metade do salário)
          </label>
        </div>

        <div className="mt-3 rounded-lg border border-border/50 bg-background/40 p-3 text-xs text-muted-foreground">
          <p>
            Taxa, comissão e luvas:{" "}
            <strong className="text-foreground">{formatMoney(cost, 3)}</strong>.
          </p>
          <p className="mt-1">
            Reserva prevista para quatro semanas: {formatMoney(quote.reserveRequired, 3)}.
          </p>
          {quote.reason ? <p className="mt-1 text-amber-400">{quote.reason}</p> : null}
        </div>

        {log.length > 0 ? (
          <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-lg bg-background/50 p-3 text-xs">
            {log.map((l, i) => (
              <li key={i} className={i === 0 ? "text-foreground" : "text-muted-foreground"}>
                {l}
              </li>
            ))}
          </ul>
        ) : null}

        {conv.walkedAway ? (
          <p className="mt-3 rounded-lg bg-destructive/15 p-3 text-center text-xs text-destructive">
            O empresário saiu da mesa. Tente outro alvo — ou volte com números sérios.
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            onClick={propose}
            disabled={conv.walkedAway}
            className="flex-1 rounded-lg bg-secondary px-4 py-2 font-display text-sm uppercase tracking-wider transition hover:brightness-125 disabled:opacity-40"
          >
            Enviar proposta
          </button>
          <button
            disabled={!agreed || !affordable || !wageOk}
            onClick={close}
            className="flex-1 rounded-lg bg-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
          >
            {agreed
              ? affordable
                ? wageOk
                  ? "Fechar contrato"
                  : "Salário baixo"
                : "Sem caixa"
              : "Aguardando acordo"}
          </button>
        </div>
      </div>
    </div>
  );
}
