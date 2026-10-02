/**
 * Coletiva de imprensa jogável: antes do jogo, 5 perguntas da imprensa e 3
 * tons de resposta. Cada resposta mexe com moral, diretoria, torcida e
 * pressão — e a manchete do dia seguinte nasce do seu tom.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { GameShell } from "@/components/game/GameShell";
import { ManagerPortrait } from "@/components/game/ManagerPortrait";
import { NoCareer } from "@/components/game/screen-kit";
import { castFor } from "@/game/cast";
import { applyChoiceEffect } from "@/game/choice-effects";
import { recordLegacyInterview, worldFor } from "@/game/career-world";
import { CLUBS } from "@/game/data/leagues";
import { computeTable, nextFixture } from "@/game/season";
import { detectUnhappy } from "@/game/unhappy";
import { useCareer } from "@/hooks/useCareer";
import type { ChoiceEffect } from "@/content/cutscenes";
import type { CareerState } from "@/game/types";

export const Route = createFileRoute("/coletiva")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Coletiva de imprensa · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Enfrente a imprensa antes do jogo: 5 perguntas, 3 tons de resposta e a manchete do dia seguinte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PressPage,
});

interface PressAnswer {
  tone: string;
  emoji: string;
  text: string;
  effect: ChoiceEffect;
}

interface PressQ {
  id: string;
  journo: string;
  outlet: string;
  q: string;
  answers: PressAnswer[];
}

const TONES = [
  { tone: "Confiante", emoji: "💪" },
  { tone: "Cauteloso", emoji: "🤔" },
  { tone: "Provocador", emoji: "🔥" },
] as const;

function buildDeck(career: CareerState, journos: [string, string, string]): PressQ[] {
  const deck: PressQ[] = [];
  const j = (n: number): [string, string] => [
    journos[n % journos.length]!,
    ["Gazeta Esportiva", "TV do Clube", "Rádio Lance"][n % 3]!,
  ];
  const players = Object.values(career.players);
  const star = players.reduce((b, p) => (p.ovr > b.ovr ? p : b), players[0]!);
  const injured = players.filter((p) => p.injuryWeeks > 0);
  const unhappy = detectUnhappy(career);
  const fixture = nextFixture(career);
  const rivalId = fixture ? (fixture.home === career.clubId ? fixture.away : fixture.home) : null;
  const rival = rivalId ? (CLUBS[rivalId]?.name ?? "o rival") : "o rival";
  const table = computeTable(career);
  const pos = table.findIndex((r) => r.clubId === career.clubId) + 1;
  const streak = career.streak ?? 0;

  const A = (
    texts: [string, string, string],
    effects: [ChoiceEffect, ChoiceEffect, ChoiceEffect],
  ): PressAnswer[] => TONES.map((t, i) => ({ ...t, text: texts[i]!, effect: effects[i]! }));

  // 1) momento do time — sempre abre
  deck.push({
    id: "momento",
    journo: j(0)[0],
    outlet: j(0)[1],
    q:
      streak >= 2
        ? `Time embalado com ${streak} vitórias. O que mudou no trabalho?`
        : streak <= -2
          ? `São ${-streak} derrotas seguidas. O cargo está ameaçado?`
          : "Como você avalia o momento do time?",
    answers: A(
      [
        "Mudou tudo: confiança, treino, entrega. Quem duvidou vai ter que engolir.",
        "Trabalho diário, sem euforia e sem desespero. O campeonato é longo.",
        "Ameaça é para quem não trabalha. Aqui se trabalha — e quem não gostar, que apite contra.",
      ],
      [
        { morale: 4, fanApproval: 4, pressure: 2 },
        { approval: 3, pressure: -2 },
        { morale: 2, fanApproval: 5, pressure: 5, approval: -2 },
      ],
    ),
  });

  // 2) o craque
  if (star) {
    deck.push({
      id: "craque",
      journo: j(1)[0],
      outlet: j(1)[1],
      q: `${star.name} decide jogos sozinho. O time depende demais dele?`,
      answers: A(
        [
          `${star.name} é craque e craque decide. O time joga para ele brilhar, sem vergonha disso.`,
          "Temos um elenco. O brilho individual aparece porque o coletivo funciona.",
          `Depende? O rival que se preocupe com isso. ${star.name} está voando e vai voar mais.`,
        ],
        [
          { morale: 5, pressure: 2 },
          { morale: 2, approval: 2 },
          { morale: 3, fanApproval: 4, pressure: 4 },
        ],
      ),
    });
  }

  // 3) lesões
  if (injured.length > 0) {
    deck.push({
      id: "lesao",
      journo: j(2)[0],
      outlet: j(2)[1],
      q: `O DM está cheio (${injured.length} fora). Faltou planejamento físico?`,
      answers: A(
        [
          "Quem está fora volta mais forte. Quem está dentro vai mostrar por que veste essa camisa.",
          "Lesão faz parte. O departamento médico é sério e o elenco é profundo.",
          "Planejamento? Me mostra um time sem lesão em temporada cheia. Próxima pergunta.",
        ],
        [
          { morale: 3, fanApproval: 2 },
          { approval: 3, pressure: -3 },
          { approval: -4, fanApproval: -2, pressure: 3 },
        ],
      ),
    });
  }

  // 4) o rival
  deck.push({
    id: "rival",
    journo: j(0)[0],
    outlet: j(0)[1],
    q: `Próximo jogo contra ${rival}. Promete vitória?`,
    answers: A(
      [
        `Prometo entrega total. E entrega total, aqui, costuma valer três pontos.`,
        `${rival} merece respeito. Vamos jogar com inteligência e buscar a vitória.`,
        `Vitória? Vou além: vai ser passeio. Guarda essa manchete.`,
      ],
      [
        { morale: 3, fanApproval: 4, pressure: 3 },
        { approval: 2, pressure: -1 },
        { fanApproval: 7, pressure: 8, morale: 2 },
      ],
    ),
  });

  // 5) objetivo / tabela
  deck.push({
    id: "objetivo",
    journo: j(1)[0],
    outlet: j(1)[1],
    q:
      pos > 0 && pos <= (career.objective ?? 4)
        ? `Time em ${pos}º, dentro da meta. Dá para sonhar mais alto?`
        : `Time em ${pos > 0 ? `${pos}º` : "posição ruim"}, fora da meta. E agora?`,
    answers: A(
      [
        "Sonhar? A gente trabalha. O resto a tabela mostra no fim.",
        "Um jogo de cada vez. A meta continua a mesma e vamos atrás dela.",
        "Quem olha tabela agora não entende nada de campeonato. Me cobra em maio.",
      ],
      [
        { fanApproval: 4, pressure: 2 },
        { approval: 4, pressure: -2 },
        { approval: -3, fanApproval: 2, pressure: 4 },
      ],
    ),
  });

  // 6) vestiário (entra se houver insatisfeito)
  if (unhappy.length > 0) {
    const p = career.players[unhappy[0]!.pid];
    deck.push({
      id: "vestiario",
      journo: j(2)[0],
      outlet: j(2)[1],
      q: `Dizem que ${p?.name ?? "um jogador"} está insatisfeito. O grupo rachou?`,
      answers: A(
        [
          "Grupo rachado não treina como o meu treina. Assunto encerrado dentro de casa.",
          "Todo elenco tem conversa. O importante é que se resolve conversando.",
          `Quem planta fofoca não veste essa camisa. ${p?.name ?? "Ele"} está fechado comigo. Ponto.`,
        ],
        [
          { morale: 4, approval: 2 },
          { morale: 2, approval: 3, pressure: -2 },
          { morale: -2, fanApproval: 3, pressure: 3 },
        ],
      ),
    });
  }

  return deck.slice(0, 5);
}

type Career = NonNullable<ReturnType<typeof useCareer>["career"]>;

function PressPage() {
  const { career, update } = useCareer();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [totals, setTotals] = useState({ morale: 0, approval: 0, fanApproval: 0, pressure: 0 });
  const [tones, setTones] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const cast = useMemo(
    () => (career ? castFor(career.clubId, career.season, career.managerName) : null),
    [career],
  );
  const deck = useMemo(() => {
    if (!career || !cast) return [];
    const extra = [`${cast.scout.name}`, `${cast.commentator.name}`];
    return buildDeck(career, [cast.press.name, extra[0]!, extra[1]!]);
  }, [career, cast]);

  if (!career) return <NoCareer />;
  const alreadyInterviewed =
    career.pressRound === career.round ||
    worldFor(career).interviewedAt === `${career.clubId}:${career.season}:${career.round}`;
  if (alreadyInterviewed && !done) {
    return (
      <GameShell career={career}>
        <section className="rounded-2xl border border-border/60 surface-card p-8 text-center">
          <p className="text-4xl">🎙️</p>
          <h1 className="mt-3 font-display text-2xl uppercase">Coletiva encerrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você já enfrentou a imprensa nesta rodada. Volte depois do jogo.
          </p>
        </section>
      </GameShell>
    );
  }

  const q = deck[step];

  function answer(index: number) {
    if (!q || picked !== null) return;
    const a = q.answers[index]!;
    setPicked(index);
    setTones((t) => [...t, a.tone]);
    setTotals((t) => ({
      morale: t.morale + (a.effect.morale ?? 0),
      approval: t.approval + (a.effect.approval ?? 0),
      fanApproval: t.fanApproval + (a.effect.fanApproval ?? 0),
      pressure: t.pressure + (a.effect.pressure ?? 0),
    }));
  }

  function next() {
    if (step + 1 >= deck.length) {
      finish();
    } else {
      setStep((s) => s + 1);
      setPicked(null);
    }
  }

  function finish() {
    if (!career) return;
    if (alreadyInterviewed) return;
    const dominant = tones
      .concat()
      .sort((a, b) => tones.filter((t) => t === b).length - tones.filter((t) => t === a).length)[0];
    const headline =
      dominant === "Provocador"
        ? "Treinador provoca e incendeia a véspera"
        : dominant === "Confiante"
          ? "Treinador banca o time antes do jogo"
          : "Treinador prega cautela antes do jogo";
    update(
      recordLegacyInterview(
        applyChoiceEffect(career, { ...totals, headline }),
        dominant === "Provocador" ? "provoke" : dominant === "Confiante" ? "protect" : "diplomatic",
        headline,
      ),
    );
    setDone(true);
  }

  if (done || !q) {
    return (
      <GameShell career={career}>
        <section className="mx-auto max-w-2xl rounded-2xl border border-border/60 surface-card p-8 text-center">
          <p className="text-4xl">📰</p>
          <h1 className="mt-3 font-display text-2xl uppercase">Manchete do dia seguinte</h1>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Delta label="Moral" value={totals.morale} />
            <Delta label="Diretoria" value={totals.approval} />
            <Delta label="Torcida" value={totals.fanApproval} />
            <Delta label="Pressão" value={totals.pressure} invert />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Tom dominante: {tones.length ? dominantTone(tones) : "—"}. Os efeitos já estão valendo.
          </p>
        </section>
      </GameShell>
    );
  }

  return (
    <GameShell career={career}>
      <section className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <ManagerPortrait
            look={
              cast?.manager.look ?? { skin: 2, hair: 1, hairColor: "#222", beard: 0, outfit: 0 }
            }
            size={56}
          />
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide">Coletiva pré-jogo</h1>
            <p className="text-xs text-muted-foreground">
              Pergunta {step + 1} de {deck.length} · Rodada {career.round}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          {deck.map((_, n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full ${n < step || (n === step && picked !== null) ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-border/60 surface-card p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {q.journo} · {q.outlet}
          </p>
          <p className="mt-2 text-lg font-medium">“{q.q}”</p>

          <div className="mt-4 space-y-2">
            {q.answers.map((a, idx) => (
              <button
                key={a.tone}
                disabled={picked !== null}
                onClick={() => answer(idx)}
                className={`block w-full rounded-xl border p-3 text-left transition ${
                  picked === null
                    ? "border-border/50 hover:border-primary/60 hover:bg-primary/5"
                    : picked === idx
                      ? "border-primary bg-primary/10"
                      : "border-border/30 opacity-40"
                }`}
              >
                <span className="font-display text-sm uppercase tracking-wide">
                  {a.emoji} {a.tone}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">“{a.text}”</span>
              </button>
            ))}
          </div>

          {picked !== null ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <EffectChips effect={q.answers[picked]!.effect} />
              <button
                onClick={next}
                className="rounded-lg bg-primary px-5 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground"
              >
                {step + 1 >= deck.length ? "Encerrar" : "Próxima"}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </GameShell>
  );
}

function dominantTone(tones: string[]): string {
  const count = new Map<string, number>();
  for (const t of tones) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

function Delta({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const good = invert ? value < 0 : value > 0;
  const bad = invert ? value > 0 : value < 0;
  return (
    <div
      className={`rounded-xl border p-3 ${good ? "border-primary/40 bg-primary/10" : bad ? "border-destructive/40 bg-destructive/10" : "border-border/40"}`}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-xl">{value > 0 ? `+${value}` : value}</p>
    </div>
  );
}

function EffectChips({ effect }: { effect: ChoiceEffect }) {
  const chips: [string, number | undefined, boolean][] = [
    ["Moral", effect.morale, false],
    ["Diretoria", effect.approval, false],
    ["Torcida", effect.fanApproval, false],
    ["Pressão", effect.pressure, true],
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips
        .filter(([, v]) => v)
        .map(([label, v, invert]) => {
          const good = invert ? (v ?? 0) < 0 : (v ?? 0) > 0;
          return (
            <span
              key={label}
              className={`rounded-full px-2 py-0.5 text-[11px] ${good ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}
            >
              {label} {(v ?? 0) > 0 ? `+${v}` : v}
            </span>
          );
        })}
    </div>
  );
}
