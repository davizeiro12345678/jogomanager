import { exportClubPortrait } from "@/lib/club-portrait-export";
import { CreationSteps } from "@/components/game/CreationSteps";
import { ClubStyleSteps } from "@/components/game/club-creator/ClubStyleSteps";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/game/screen-kit";

import { useNavigate } from "@tanstack/react-router";

import { useEffect, useMemo, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { KitPreview } from "@/components/game/ClubKitPreview";

import { ManagerPortrait } from "@/components/game/ManagerPortrait";
import { HAIR_COLORS } from "@/game/manager-look-options";

import { initCareer } from "@/game/career";

import { LEAGUES } from "@/game/data/leagues";

import {
  createManagerProfile,
  DEFAULT_MANAGER_ATTRIBUTES,
  DEFAULT_MANAGER_LOOK,
} from "@/game/manager-profile";

import type { ManagerAttributes, ManagerLook, ManagerPersonality } from "@/game/types";

import { useCareer } from "@/hooks/useCareer";

import { startWorldForNewCareer } from "@/lib/world";

import {
  clearMyClub,
  clubToBeReplaced,
  DEFAULT_MY_CLUB,
  exportClubPack,
  importClubPack,
  listClubDrafts,
  readMyClub,
  saveClubDraft,
  slugifyClubId,
  writeMyClub,
  type ClubDraft,
  type MyClub,
} from "@/lib/myClub";
import { startCareerAnalyticsId } from "@/lib/career-analytics-id";
import { containsProfanity } from "@/lib/moderation";

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

export function NewClubPage() {
  const navigate = useNavigate();
  const { update } = useCareer();
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [manager, setManager] = useState("");
  const [nameError, setNameError] = useState("");
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

  function exportPortrait() {
    exportClubPortrait(normalized());
  }

  function finish() {
    const finalClub = normalized();
    if ([manager, finalClub.name, finalClub.short].some((text) => containsProfanity(text ?? ""))) {
      setNameError(
        "Escolha outros nomes: o nome do clube ou do treinador não é permitido no jogo.",
      );
      return;
    }
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
    startCareerAnalyticsId();
    navigate({ to: "/club" });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
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
          <Button
            variant="outline"
            type="button"
            className={smallBtn}
            onClick={() =>
              loadDraft({ key: "atual", version: 1, savedAt: Date.now(), club: existing })
            }
          >
            Editar como cópia
          </Button>
          <Button
            variant="outline"
            type="button"
            className={smallBtn}
            onClick={() => {
              clearMyClub();
              setExisting(null);
              setNote("Clube removido — a liga voltou ao time original.");
            }}
          >
            Apagar clube
          </Button>
        </div>
      )}

      <CreationSteps labels={STEPS} current={step} furthest={furthest} onSelect={setStep} />
      <div className="club-creator-layout">
        <section className="club-creator-fields" aria-label={STEPS[step]}>
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

          <ClubStyleSteps
            step={step}
            club={club}
            manager={manager}
            managerPersonality={managerPersonality}
            managerReputation={managerReputation}
            set={set}
            setKit={setKit}
            setCrest={setCrest}
            setStadium={setStadium}
            setFans={setFans}
            onEdit={setStep}
          />
          <div className="club-creator-actions">
            <Button
              variant="outline"
              type="button"
              className="rounded-lg border border-border/60 px-4 py-2 text-sm disabled:opacity-40"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                variant="outline"
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                disabled={step === 0 && !club.name.trim()}
                onClick={() => {
                  setFurthest((current) => Math.max(current, step + 1));
                  setStep((current) => current + 1);
                }}
              >
                Continuar
              </Button>
            ) : (
              <Button
                variant="outline"
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                onClick={finish}
              >
                Fundar clube e começar
              </Button>
            )}
            {nameError ? (
              <p role="alert" className="text-sm text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
        </section>

        <aside className="club-creator-preview space-y-4" aria-label="Prévia do clube">
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
              <Button variant="outline" type="button" className={smallBtn} onClick={saveDraft}>
                Salvar rascunho
              </Button>
              <Button variant="outline" type="button" className={smallBtn} onClick={exportPortrait}>
                Baixar retrato
              </Button>
              <Button variant="outline" type="button" className={smallBtn} onClick={exportPack}>
                Exportar pacote
              </Button>
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
            {note && (
              <p className="text-xs text-primary" role="status">
                {note}
              </p>
            )}
            {drafts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rascunhos</p>
                {drafts.map((d) => (
                  <Button
                    variant="outline"
                    key={d.key}
                    type="button"
                    onClick={() => loadDraft(d)}
                    className="flex min-h-11 w-full items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-left text-xs hover:border-primary"
                  >
                    <span className="truncate">{d.club.name || "Sem nome"}</span>
                    <span className="text-muted-foreground">v{d.version}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
