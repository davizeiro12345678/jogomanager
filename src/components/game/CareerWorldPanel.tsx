import { useMemo, useState } from "react";
import { Mic, Users, BookOpen, TrendingUp, Heart, MessageSquare } from "lucide-react";
import type { Cutscene as SceneData } from "@/content/cutscenes";
import { Cutscene } from "./Cutscene";
import { SectionCard, StatStrip } from "./screen-kit";
import { applyChoiceEffect } from "@/game/choice-effects";
import {
  identityLabels,
  relationshipLabel,
  supporterAttendance,
  supporterClimate,
  worldFor,
} from "@/game/career-world";
import {
  buildCareerInterview,
  INTERVIEW_LABELS,
  interviewContexts,
} from "@/game/career-interviews";
import { castFor } from "@/game/cast";
import { CLUBS } from "@/game/data/leagues";
import type { CareerState, ManagerLook } from "@/game/types";
import type { InterviewType } from "@/game/career-world-types";

const fallback: ManagerLook = { skin: 2, hair: 1, hairColor: "#2b1d14", beard: 0, outfit: 0 };
export function CareerWorldPanel({
  career,
  update,
}: {
  career: CareerState;
  update: (state: CareerState) => void;
}) {
  const [active, setActive] = useState<SceneData | null>(null);
  const [tab, setTab] = useState<"press" | "relationships" | "memories">("press");
  const world = useMemo(() => worldFor(career), [career]);
  const labels = identityLabels(career),
    climate = supporterClimate(career);
  const contexts = interviewContexts(career);
  const blocked =
    career.pressRound === career.round ||
    world.interviewedAt === `${career.clubId}:${career.season}:${career.round}`;
  const roster = Object.values(career.players)
    .filter((p) => p.clubId === career.clubId)
    .sort((a, b) => b.ovr - a.ovr);
  const interview = (type: InterviewType) => {
    const scene = buildCareerInterview(career, type);
    if (scene && !blocked) setActive(scene);
  };
  const cast = useMemo(
    () => castFor(career.clubId, career.season, career.managerName),
    [career.clubId, career.season, career.managerName],
  );
  return (
    <section className="mt-5 space-y-4" aria-label="Identidade e vida do clube">
      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">
              O seu trabalho deixa uma história
            </p>
            <h2 className="mt-2 font-display text-2xl">{career.managerName}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A personalidade evolui com as escolhas e com o que acontece em campo.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/50 px-4 py-3">
            <span className="text-xs text-muted-foreground">Reputação</span>
            <p className="hud-num text-3xl">
              {Math.round(world.identity.reputation)}
              <span className="text-sm text-muted-foreground"> / 100</span>
            </p>
          </div>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Estilo de imprensa", value: labels.imprensa },
            { label: "Gestão de grupo", value: labels.grupo },
            { label: "Filosofia", value: labels.filosofia },
            { label: "Relação com a torcida", value: relationshipLabel(career.fanApproval) },
            { label: "Relação com a diretoria", value: relationshipLabel(career.approval) },
            { label: "Trabalho com jovens", value: labels.base },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-sm font-semibold capitalize">{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {labels.trato}. Perfis, relações e lembranças ficam neste save.
        </p>
      </SectionCard>
      <StatStrip
        stats={[
          {
            label: "Arquibancada",
            value: climate,
            hint:
              climate === "protesto"
                ? "Cobrança na porta do clube"
                : climate === "cobrança"
                  ? "A torcida espera resposta"
                  : "Apoio ao trabalho",
          },
          {
            label: "Confiança",
            value: `${Math.round(world.fans.trust)}%`,
            hint: "Memórias e continuidade",
          },
          { label: "Tensão", value: `${Math.round(world.fans.heat)}%`, hint: "Pressão e ambiente" },
          {
            label: "Público",
            value: `${Math.round(supporterAttendance(career) * 100)}%`,
            hint: "Multiplicador da procura por ingressos",
          },
        ]}
      />
      <p className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        {world.fans.lastReaction} O público previsto também considera o preço do ingresso e a
        capacidade do estádio.
      </p>
      <div role="tablist" aria-label="Vida do clube" className="flex flex-wrap gap-2">
        {(
          [
            { id: "press", label: "Sala de imprensa", Icon: Mic },
            { id: "relationships", label: "Relações com jogadores", Icon: Users },
            { id: "memories", label: "Memórias da carreira", Icon: BookOpen },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`world-tab-${id}`}
            role="tab"
            type="button"
            aria-selected={tab === id}
            aria-controls="world-panel"
            onClick={() => setTab(id)}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${tab === id ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div id="world-panel" role="tabpanel" aria-labelledby={`world-tab-${tab}`}>
        {tab === "press" ? (
          <SectionCard title="A entrevista nasce do momento da carreira">
            <p className="mb-4 text-sm text-muted-foreground">
              {blocked
                ? "Você já respondeu nesta rodada. A repercussão seguirá para o próximo compromisso."
                : "Escolha um assunto disponível. A resposta altera relações, confiança, pressão e o perfil do treinador."}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contexts.map((context) => (
                <button
                  key={context.type}
                  type="button"
                  disabled={!context.available || blocked}
                  onClick={() => interview(context.type)}
                  className="min-h-24 rounded-xl border border-border/70 bg-background/35 p-4 text-left transition-colors hover:border-primary/60 disabled:opacity-40"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare size={15} />
                    {INTERVIEW_LABELS[context.type]}
                  </span>
                  <span className="mt-2 block text-xs text-muted-foreground">{context.reason}</span>
                  <span className="mt-2 block text-[11px] text-primary">
                    {context.available
                      ? blocked
                        ? "Já respondeu nesta rodada"
                        : "Dar entrevista"
                      : "Aguardando contexto"}
                  </span>
                </button>
              ))}
            </div>
          </SectionCard>
        ) : tab === "relationships" ? (
          <SectionCard title="O vestiário lembra">
            <p className="mb-4 text-sm text-muted-foreground">
              Minutos, promessas cumpridas, críticas, apoio público e conversas influenciam a
              confiança. Converse com os insatisfeitos na tela do elenco.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {roster.map((player) => {
                const bond = world.relationships[player.id]!;
                return (
                  <article
                    key={player.id}
                    className="rounded-xl border border-border/70 bg-background/35 p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">{player.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {player.pos} · {player.age} anos · {player.personality ?? "profissional"}
                        </p>
                      </div>
                      <span className="text-xs capitalize text-primary">
                        {relationshipLabel(bond.trust)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <span className="flex items-center gap-1.5">
                        <Heart size={13} /> Confiança {Math.round(bond.trust)}%
                      </span>
                      <span className="flex items-center gap-1.5">
                        <TrendingUp size={13} /> Respeito {Math.round(bond.respect)}%
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {world.memories.find((memory) => memory.playerId === player.id)?.title ??
                        "A relação está sendo construída nos treinos e nas partidas."}
                    </p>
                  </article>
                );
              })}
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Memórias que seguem com o treinador">
            {world.memories.length ? (
              <ol className="space-y-3">
                {world.memories.map((memory) => (
                  <li
                    key={memory.id}
                    className={`rounded-xl border border-border/70 border-l-2 p-4 ${memory.sentiment < 0 ? "border-l-destructive/70" : "border-l-primary/70"}`}
                  >
                    <p className="text-[11px] text-muted-foreground">
                      Temporada {memory.season} · Rodada {memory.round} ·{" "}
                      {CLUBS[memory.clubId]?.short ?? memory.clubId}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold">{memory.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {memory.detail}
                    </p>
                    {memory.weight >= 80 ? (
                      <p className="mt-2 text-[11px] text-primary">Momento marcante</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                A primeira partida, entrevista ou conversa começará esta história. Títulos e
                rupturas terão peso maior nas lembranças.
              </p>
            )}
          </SectionCard>
        )}
      </div>
      {active ? (
        <Cutscene
          scene={active.id}
          sceneData={active}
          look={career.manager?.look ?? fallback}
          club={CLUBS[career.clubId]}
          managerName={career.managerName}
          cast={cast}
          cinematic
          manner={world.identity}
          onEffect={(effect) => update(applyChoiceEffect(career, effect))}
          onDone={() => setActive(null)}
        />
      ) : null}
    </section>
  );
}
