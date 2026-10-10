import { ScreenHeader, SectionCard } from "@/components/game/screen-kit";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { ManagerPortrait, HAIR_COLORS } from "@/components/game/ManagerPortrait";
import {
  Chips,
  CREST_EMBLEMS,
  CREST_PATTERNS,
  CREST_SHAPES,
  EMBLEM_LABEL,
  KIT_PATTERNS,
} from "@/components/game/CrestBuilder";
import { initCareer } from "@/game/career";
import { LEAGUES } from "@/game/data/leagues";
import {
  createManagerProfile,
  DEFAULT_MANAGER_ATTRIBUTES,
  DEFAULT_MANAGER_LOOK,
} from "@/game/manager-profile";
import type { ManagerAttributes, ManagerLook, ManagerPersonality } from "@/game/types";
import type { RoofKind, ChantKind } from "@/game/customStyle";
import { useCareer } from "@/hooks/useCareer";
import { startWorldForNewCareer } from "@/lib/world";
import {
  DEFAULT_MY_CLUB,
  clubToBeReplaced,
  exportClubPack,
  importClubPack,
  listClubDrafts,
  readMyClub,
  clearMyClub,
  saveClubDraft,
  slugifyClubId,
  writeMyClub,
  type ClubDraft,
  type MyClub,
} from "@/lib/myClub";

export const Route = createFileRoute("/clube/novo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar seu clube · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Crie um clube próprio com nome, escudo, uniformes, estádio e torcida para iniciar uma carreira personalizada.",
      },
      {
        property: "og:title",
        content: "Criar seu clube · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Crie um clube próprio com nome, escudo, uniformes, estádio e torcida para iniciar uma carreira personalizada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NewClubPage,
});

const ROOFS: { id: RoofKind; label: string }[] = [
  { id: "aberto", label: "Sem cobertura" },
  { id: "parcial", label: "Cobertura parcial" },
  { id: "total", label: "Arena fechada" },
];
const CHANTS: { id: ChantKind; label: string }[] = [
  { id: "carnaval", label: "Carnaval — bateria o jogo inteiro" },
  { id: "operario", label: "Operária — barulho nos momentos-chave" },
  { id: "epico", label: "Épica — hino arrepiante antes do apito" },
  { id: "silencioso", label: "Reservada — só explode no gol" },
];
const STEPS = ["Treinador e identidade", "Escudo", "Uniforme", "Estádio", "Torcida e revisão"];

const MANAGER_PERSONALITY_LABELS: Record<ManagerPersonality, string> = {
  calmo: "Calmo",
  motivador: "Motivador",
  durao: "Durão",
  tatico: "Tático",
  jovem: "Jovem promessa",
};

const MANAGER_ATTRIBUTE_LABELS: { key: keyof ManagerAttributes; label: string }[] = [
  { key: "attack", label: "Ataque" },
  { key: "defense", label: "Defesa" },
  { key: "market", label: "Mercado" },
  { key: "squad", label: "Elenco" },
  { key: "media", label: "Imprensa" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary";

const smallBtn =
  "flex min-h-11 items-center justify-center rounded-lg border border-border/60 px-3 py-2 text-xs hover:border-primary";

function KitPreview({ club }: { club: MyClub }) {
  const { kit } = club;
  return (
    <svg viewBox="0 0 100 110" width={120} height={132} role="img" aria-label="Prévia do uniforme">
      <defs>
        <clipPath id="shirt">
          <path d="M50 8 l18 6 l14 8 l-8 16 l-8 -4 v64 h-32 v-64 l-8 4 l-8 -16 l14 -8 z" />
        </clipPath>
      </defs>
      <path
        d="M50 8 l18 6 l14 8 l-8 16 l-8 -4 v64 h-32 v-64 l-8 4 l-8 -16 l14 -8 z"
        fill={kit.base}
      />
      <g clipPath="url(#shirt)">
        {kit.pattern === "stripes" &&
          [0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={22 + i * 12} y="0" width="6" height="110" fill={kit.detail} />
          ))}
        {kit.pattern === "hoops" &&
          [0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="0" y={20 + i * 16} width="100" height="8" fill={kit.detail} />
          ))}
        {kit.pattern === "sash" && <path d="M10 10 L95 80 L85 95 L0 26 z" fill={kit.detail} />}
        {kit.pattern === "halves" && (
          <rect x="50" y="0" width="50" height="110" fill={kit.detail} />
        )}
        {kit.pattern === "band" && <rect x="0" y="46" width="100" height="16" fill={kit.detail} />}
        {kit.pattern === "sleeves" && (
          <>
            <rect x="0" y="0" width="24" height="46" fill={kit.detail} />
            <rect x="76" y="0" width="24" height="46" fill={kit.detail} />
          </>
        )}
        {kit.pattern === "pin" &&
          Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x={i * 9} y="0" width="2" height="110" fill={kit.detail} opacity="0.7" />
          ))}
        {kit.pattern === "checks" &&
          Array.from({ length: 40 }).map((_, i) => (
            <rect
              key={i}
              x={(i % 8) * 13}
              y={Math.floor(i / 8) * 22}
              width="13"
              height="22"
              fill={i % 2 ? kit.detail : "transparent"}
              opacity="0.8"
            />
          ))}
        {kit.pattern === "gradient" && (
          <rect x="0" y="55" width="100" height="55" fill={kit.detail} opacity="0.55" />
        )}
      </g>
      <path
        d="M50 8 l18 6 l14 8 l-8 16 l-8 -4 v64 h-32 v-64 l-8 4 l-8 -16 l14 -8 z"
        fill="none"
        stroke="rgba(0,0,0,0.35)"
      />
      <rect x="36" y="98" width="12" height="10" fill={kit.shorts} />
      <rect x="52" y="98" width="12" height="10" fill={kit.socks} />
    </svg>
  );
}

function NewClubPage() {
  const navigate = useNavigate();
  const { update } = useCareer();
  const [step, setStep] = useState(0);
  const [manager, setManager] = useState("");
  const [managerAge, setManagerAge] = useState(38);
  const [managerLook, setManagerLook] = useState<ManagerLook>({ ...DEFAULT_MANAGER_LOOK });
  const [managerPersonality, setManagerPersonality] = useState<ManagerPersonality>("motivador");
  const [managerReputation, setManagerReputation] = useState(3);
  const [managerAttrs, setManagerAttrs] = useState<ManagerAttributes>({
    ...DEFAULT_MANAGER_ATTRIBUTES,
  });
  const [club, setClub] = useState<MyClub>(() => ({ ...DEFAULT_MY_CLUB, id: "my-clube" }));

  const set = <K extends keyof MyClub>(k: K, v: MyClub[K]) => setClub((c) => ({ ...c, [k]: v }));
  const setKit = (patch: Partial<MyClub["kit"]>) =>
    setClub((c) => ({ ...c, kit: { ...c.kit, ...patch } }));
  const setCrest = (patch: Partial<MyClub["crest"]>) =>
    setClub((c) => ({ ...c, crest: { ...c.crest, ...patch } }));
  const setStadium = (patch: Partial<MyClub["stadium"]>) =>
    setClub((c) => ({ ...c, stadium: { ...c.stadium, ...patch } }));
  const setFans = (patch: Partial<MyClub["fans"]>) =>
    setClub((c) => ({ ...c, fans: { ...c.fans, ...patch } }));

  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ClubDraft[]>([]);
  const [note, setNote] = useState("");
  const [existing, setExisting] = useState<MyClub | null>(null);

  useEffect(() => {
    setDrafts(listClubDrafts());
    setExisting(readMyClub());
  }, []);

  const preview = useMemo(
    () => ({
      id: club.id,
      name: club.name || "Seu Clube",
      short: club.short || "SC",
      league: club.leagueId,
      primary: club.primary,
      secondary: club.secondary,
      strength: club.strength,
    }),
    [club],
  );

  /** clube que perde a vaga na liga escolhida */
  const victim = useMemo(() => clubToBeReplaced(club.leagueId), [club.leagueId]);

  function normalized(): MyClub {
    const id = slugifyClubId(club.name || "clube");
    return {
      ...club,
      id,
      name: club.name.trim() || "Seu Clube",
      short: (club.short.trim() || club.name.trim().slice(0, 3) || "SCL").toUpperCase().slice(0, 4),
      crest: { ...club.crest, founded: club.founded },
      kit: { ...club.kit, base: club.primary, detail: club.secondary },
    };
  }

  function saveDraft() {
    const d = saveClubDraft(normalized(), draftKey ?? undefined);
    setDraftKey(d.key);
    setDrafts(listClubDrafts());
    setNote(`Rascunho salvo (versão ${d.version}).`);
  }

  function loadDraft(d: ClubDraft) {
    setClub({ ...d.club });
    setDraftKey(d.key);
    setStep(0);
    setNote(`Rascunho "${d.club.name || "sem nome"}" carregado — editar cria uma nova versão.`);
  }

  function exportPack() {
    const text = exportClubPack(normalized());
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugifyClubId(club.name || "clube")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importPack(file: File) {
    const parsed = importClubPack(await file.text());
    if (!parsed) {
      setNote("Arquivo inválido — use um pacote exportado por este jogo.");
      return;
    }
    setClub(parsed);
    setNote(`Pacote "${parsed.name}" carregado.`);
  }

  /** retrato do clube em imagem (PNG 512×512) para usar fora do jogo */
  function exportPortrait() {
    const c = normalized();
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const g = canvas.getContext("2d");
    if (!g) return;

    const bg = g.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, c.primary);
    bg.addColorStop(1, "#0a0f0c");
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 512);

    // escudo
    g.beginPath();
    g.moveTo(256, 96);
    g.lineTo(392, 148);
    g.quadraticCurveTo(392, 320, 256, 404);
    g.quadraticCurveTo(120, 320, 120, 148);
    g.closePath();
    g.fillStyle = c.secondary;
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.stroke();

    g.save();
    g.clip();
    g.fillStyle = c.primary;
    for (let i = 0; i < 6; i++) g.fillRect(120 + i * 48, 96, 24, 320);
    g.restore();

    g.fillStyle = "#0a0f0c";
    g.textAlign = "center";
    g.font = "bold 84px system-ui, sans-serif";
    g.fillText(c.short, 256, 290);

    g.fillStyle = "#eafff2";
    g.font = "bold 38px system-ui, sans-serif";
    g.fillText(c.name.toUpperCase().slice(0, 22), 256, 456);
    g.font = "22px system-ui, sans-serif";
    g.fillStyle = "rgba(234,255,242,0.75)";
    g.fillText(`${c.city || "—"} · ${c.founded}`, 256, 490);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${slugifyClubId(c.name)}-retrato.png`;
    a.click();
  }

  function finish() {
    const finalClub = normalized();
    const profile = createManagerProfile({
      name: manager,
      country: finalClub.leagueId,
      age: managerAge,
      favClub: finalClub.id,
      look: managerLook,
      personality: managerPersonality,
      reputation: managerReputation,
      attrs: managerAttrs,
    });
    // Clube criado vive na campanha nova, sem mexer nos outros saves.
    startWorldForNewCareer(finalClub.id);
    writeMyClub(finalClub);
    update(initCareer(finalClub.leagueId, finalClub.id, profile.name, profile));
    navigate({ to: "/club" });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ScreenHeader title="Crie o seu clube" />
      <p className="mt-1 text-sm text-muted-foreground">
        Funde um time do zero e coloque ele para brigar em uma liga real.
      </p>

      {existing && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 surface-card p-3 text-sm">
          <Crest
            club={{
              id: existing.id,
              name: existing.name,
              short: existing.short,
              league: existing.leagueId,
              primary: existing.primary,
              secondary: existing.secondary,
              strength: existing.strength,
            }}
            size={36}
            detail="simple"
          />
          <span className="flex-1">
            Você já tem o <strong>{existing.name}</strong> em jogo
            {existing.replaced ? ` (no lugar do ${existing.replaced.name})` : ""}.
          </span>
          <button
            type="button"
            className={smallBtn}
            onClick={() =>
              loadDraft({ key: "atual", version: 1, savedAt: Date.now(), club: existing })
            }
          >
            Editar como cópia
          </button>
          <button
            type="button"
            className={smallBtn}
            onClick={() => {
              clearMyClub();
              setExisting(null);
              setNote("Clube removido — a liga voltou ao time original.");
            }}
          >
            Apagar clube
          </button>
        </div>
      )}

      <ol className="mt-5 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-full border px-3 py-1 text-xs ${
              i === step
                ? "border-primary bg-primary/15 text-primary"
                : i < step
                  ? "border-border/60 text-muted-foreground"
                  : "border-border/40 text-muted-foreground/60"
            }`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_260px]">
        <SectionCard className="space-y-4 rounded-2xl border border-border/60 surface-card p-4">
          {step === 0 && (
            <>
              <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Seu treinador
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Este mesmo perfil aparece na carreira, no retrato e nas cenas — não é um nome
                    descartável do clube.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Seu nome (treinador)">
                    <input
                      className={inputClass}
                      value={manager}
                      maxLength={48}
                      onChange={(e) => setManager(e.target.value)}
                      placeholder="Ex.: Marina Torres"
                    />
                  </Field>
                  <Field label={`Idade: ${managerAge} anos`}>
                    <input
                      type="range"
                      min={20}
                      max={75}
                      value={managerAge}
                      onChange={(e) => setManagerAge(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </Field>
                  <Field label="Personalidade">
                    <select
                      className={inputClass}
                      value={managerPersonality}
                      onChange={(e) => setManagerPersonality(e.target.value as ManagerPersonality)}
                    >
                      {(Object.keys(MANAGER_PERSONALITY_LABELS) as ManagerPersonality[]).map(
                        (personality) => (
                          <option key={personality} value={personality}>
                            {MANAGER_PERSONALITY_LABELS[personality]}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label={`Reputação: ${managerReputation} de 5`}>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={managerReputation}
                      onChange={(e) => setManagerReputation(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tom de pele">
                    <select
                      className={inputClass}
                      value={managerLook.skin}
                      onChange={(e) =>
                        setManagerLook((look) => ({ ...look, skin: Number(e.target.value) }))
                      }
                    >
                      {[0, 1, 2, 3, 4, 5].map((skin) => (
                        <option key={skin} value={skin}>
                          Tom {skin + 1}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cabelo">
                    <select
                      className={inputClass}
                      value={managerLook.hair}
                      onChange={(e) =>
                        setManagerLook((look) => ({ ...look, hair: Number(e.target.value) }))
                      }
                    >
                      {[
                        "Careca",
                        "Curto",
                        "Volumoso",
                        "Longo",
                        "Ondulado",
                        "Coque",
                        "Repartido",
                      ].map((label, hair) => (
                        <option key={label} value={hair}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cor do cabelo">
                    <select
                      className={inputClass}
                      value={managerLook.hairColor}
                      onChange={(e) =>
                        setManagerLook((look) => ({ ...look, hairColor: e.target.value }))
                      }
                    >
                      {HAIR_COLORS.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Barba">
                    <select
                      className={inputClass}
                      value={managerLook.beard}
                      onChange={(e) =>
                        setManagerLook((look) => ({ ...look, beard: Number(e.target.value) }))
                      }
                    >
                      {["Sem barba", "Bigode", "Curta", "Completa", "Por fazer"].map(
                        (label, beard) => (
                          <option key={label} value={beard}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="Vestuário">
                    <select
                      className={inputClass}
                      value={managerLook.outfit}
                      onChange={(e) =>
                        setManagerLook((look) => ({ ...look, outfit: Number(e.target.value) }))
                      }
                    >
                      {["Terno", "Agasalho", "Casual"].map((label, outfit) => (
                        <option key={label} value={outfit}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid gap-2 sm:grid-cols-5">
                  {MANAGER_ATTRIBUTE_LABELS.map(({ key, label }) => (
                    <Field key={key} label={`${label}: ${managerAttrs[key]}`}>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={managerAttrs[key]}
                        onChange={(e) =>
                          setManagerAttrs((attrs) => ({ ...attrs, [key]: Number(e.target.value) }))
                        }
                        className="w-full accent-primary"
                      />
                    </Field>
                  ))}
                </div>
              </section>
              <Field label="Nome do clube">
                <input
                  className={inputClass}
                  value={club.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ex.: Atlético Litoral"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Sigla">
                  <input
                    className={inputClass}
                    value={club.short}
                    maxLength={4}
                    onChange={(e) => set("short", e.target.value.toUpperCase())}
                    placeholder="ATL"
                  />
                </Field>
                <Field label="Ano de fundação">
                  <input
                    type="number"
                    className={inputClass}
                    value={club.founded}
                    onChange={(e) => set("founded", Number(e.target.value))}
                  />
                </Field>
                <Field label="Cidade">
                  <input
                    className={inputClass}
                    value={club.city}
                    onChange={(e) => set("city", e.target.value)}
                    placeholder="Santos"
                  />
                </Field>
                <Field label="País">
                  <input
                    className={inputClass}
                    value={club.country}
                    onChange={(e) => set("country", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Liga onde vai jogar">
                <select
                  className={inputClass}
                  value={club.leagueId}
                  onChange={(e) => set("leagueId", e.target.value)}
                >
                  {LEAGUES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.flag} {l.name} · {l.country}
                    </option>
                  ))}
                </select>
              </Field>
              {victim && (
                <p className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                  Para abrir vaga, <strong className="text-foreground">{victim.name}</strong> sai
                  desta liga enquanto o seu clube existir. Apagar o seu clube devolve ele ao lugar
                  de origem.
                </p>
              )}
              <Field label={`Força inicial do elenco: ${club.strength}`}>
                <input
                  type="range"
                  min={58}
                  max={84}
                  value={club.strength}
                  onChange={(e) => set("strength", Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Cor principal">
                  <input
                    type="color"
                    className={inputClass}
                    value={club.primary}
                    onChange={(e) => set("primary", e.target.value)}
                  />
                </Field>
                <Field label="Cor secundária">
                  <input
                    type="color"
                    className={inputClass}
                    value={club.secondary}
                    onChange={(e) => set("secondary", e.target.value)}
                  />
                </Field>
              </div>
              <Chips
                label="Formato"
                value={club.crest.shape}
                onChange={(v) => setCrest({ shape: v })}
                options={CREST_SHAPES.map((s) => ({ id: s, label: s }))}
              />
              <Chips
                label="Estampa"
                value={club.crest.pattern}
                onChange={(v) => setCrest({ pattern: v })}
                options={CREST_PATTERNS.map((s) => ({ id: s, label: s }))}
              />
              <Chips
                label="Símbolo"
                value={club.crest.emblem}
                onChange={(v) => setCrest({ emblem: v })}
                options={CREST_EMBLEMS.map((s) => ({ id: s, label: EMBLEM_LABEL[s] }))}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Chips
                label="Padrão da camisa"
                value={club.kit.pattern}
                onChange={(v) => setKit({ pattern: v })}
                options={KIT_PATTERNS.map((k) => ({ id: k, label: k }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Calção">
                  <input
                    type="color"
                    className={inputClass}
                    value={club.kit.shorts}
                    onChange={(e) => setKit({ shorts: e.target.value })}
                  />
                </Field>
                <Field label="Meião">
                  <input
                    type="color"
                    className={inputClass}
                    value={club.kit.socks}
                    onChange={(e) => setKit({ socks: e.target.value })}
                  />
                </Field>
                <Field label="Camisa reserva">
                  <input
                    type="color"
                    className={inputClass}
                    value={club.kit.awayBase}
                    onChange={(e) => setKit({ awayBase: e.target.value })}
                  />
                </Field>
                <Field label="Detalhe reserva">
                  <input
                    type="color"
                    className={inputClass}
                    value={club.kit.awayDetail}
                    onChange={(e) => setKit({ awayDetail: e.target.value })}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Nome do estádio">
                <input
                  className={inputClass}
                  value={club.stadium.name}
                  onChange={(e) => setStadium({ name: e.target.value })}
                />
              </Field>
              <Field label={`Capacidade: ${club.stadium.capacity.toLocaleString("pt-BR")} lugares`}>
                <input
                  type="range"
                  min={8000}
                  max={90000}
                  step={1000}
                  value={club.stadium.capacity}
                  onChange={(e) => setStadium({ capacity: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </Field>
              <Chips
                label="Cobertura"
                value={club.stadium.roof}
                onChange={(v) => setStadium({ roof: v })}
                options={ROOFS}
              />
              <Field label="Cor das cadeiras">
                <input
                  type="color"
                  className={inputClass}
                  value={club.stadium.seatColor}
                  onChange={(e) => setStadium({ seatColor: e.target.value })}
                />
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <Chips
                label="Tamanho da torcida"
                value={String(club.fans.size)}
                onChange={(v) => setFans({ size: Number(v) })}
                options={[
                  { id: "0", label: "Fiel e pequena" },
                  { id: "1", label: "Média" },
                  { id: "2", label: "Gigante" },
                ]}
              />
              <Chips
                label="Clima na arquibancada"
                value={club.fans.chant}
                onChange={(v) => setFans({ chant: v })}
                options={CHANTS}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Cor das bandeiras">
                  <input
                    type="color"
                    className={inputClass}
                    value={club.fans.flagA}
                    onChange={(e) => setFans({ flagA: e.target.value })}
                  />
                </Field>
                <Field label="Cor do mosaico">
                  <input
                    type="color"
                    className={inputClass}
                    value={club.fans.flagB}
                    onChange={(e) => setFans({ flagB: e.target.value })}
                  />
                </Field>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-3 text-sm">
                <p className="font-semibold">Revisão antes de fundar</p>
                <p className="mt-1 text-muted-foreground">
                  {manager.trim() || "Técnico"},{" "}
                  {MANAGER_PERSONALITY_LABELS[managerPersonality].toLowerCase()} de reputação{" "}
                  {managerReputation}, vai assumir {club.name || "seu clube"} na{" "}
                  {LEAGUES.find((league) => league.id === club.leagueId)?.name ?? "liga escolhida"}.
                </p>
              </div>
            </>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              className="rounded-lg border border-border/60 px-4 py-2 text-sm disabled:opacity-40"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              Voltar
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                disabled={step === 0 && !club.name.trim()}
                onClick={() => setStep((s) => s + 1)}
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                onClick={finish}
              >
                Fundar clube e começar
              </button>
            )}
          </div>
        </SectionCard>

        <aside className="space-y-4 rounded-2xl border border-border/60 surface-card p-4 text-center">
          <Crest club={preview} size={96} detail="full" />
          <div>
            <p className="font-display text-lg uppercase tracking-wide">
              {club.name || "Seu Clube"}
            </p>
            <p className="text-xs text-muted-foreground">
              {club.city || "Cidade"} · {club.country} · fundado em {club.founded}
            </p>
          </div>
          <div className="flex justify-center">
            <KitPreview club={club} />
          </div>
          <div className="border-t border-border/60 pt-3">
            <ManagerPortrait look={managerLook} size={82} accent={club.primary} />
            <p className="mt-2 text-xs font-semibold">{manager.trim() || "Seu treinador"}</p>
            <p className="text-xs text-muted-foreground">
              {MANAGER_PERSONALITY_LABELS[managerPersonality]} · {managerReputation}★
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {club.stadium.name} · {club.stadium.capacity.toLocaleString("pt-BR")} lugares
          </p>

          <div className="space-y-2 border-t border-border/60 pt-3 text-left">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={smallBtn} onClick={saveDraft}>
                Salvar rascunho
              </button>
              <button type="button" className={smallBtn} onClick={exportPortrait}>
                Baixar retrato
              </button>
              <button type="button" className={smallBtn} onClick={exportPack}>
                Exportar pacote
              </button>
              <label className={`${smallBtn} cursor-pointer text-center`}>
                Importar
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importPack(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {note && <p className="text-xs text-primary">{note}</p>}
            {drafts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rascunhos</p>
                {drafts.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => loadDraft(d)}
                    className="flex min-h-11 w-full items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-left text-xs hover:border-primary"
                  >
                    <span className="truncate">{d.club.name || "Sem nome"}</span>
                    <span className="text-muted-foreground">v{d.version}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
