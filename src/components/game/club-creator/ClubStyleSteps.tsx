import type { ReactNode } from "react";
import { Chips } from "@/components/game/CrestBuilder";
import {
  CREST_EMBLEMS,
  CREST_PATTERNS,
  CREST_SHAPES,
  EMBLEM_LABEL,
  KIT_PATTERNS,
  SHAPE_LABEL,
  CREST_PATTERN_LABEL,
  KIT_PATTERN_LABEL,
} from "@/game/crest-options";
import type { ChantKind, RoofKind } from "@/game/customStyle";
import type { MyClub } from "@/lib/myClub";
import { ClubCreationReview } from "./ClubCreationReview";
import type { ManagerPersonality } from "@/game/types";
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

const MANAGER_PERSONALITY_LABELS: Record<ManagerPersonality, string> = {
  calmo: "Calmo",
  motivador: "Motivador",
  durao: "Durão",
  tatico: "Tático",
  jovem: "Jovem promessa",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
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

export function ClubStyleSteps({
  step,
  club,
  manager,
  managerPersonality,
  managerReputation,
  onEdit,
  set,
  setKit,
  setCrest,
  setStadium,
  setFans,
}: {
  step: number;
  club: MyClub;
  manager: string;
  managerPersonality: keyof typeof MANAGER_PERSONALITY_LABELS;
  managerReputation: number;
  onEdit: (step: number) => void;
  set: <K extends keyof MyClub>(key: K, value: MyClub[K]) => void;
  setKit: (patch: Partial<MyClub["kit"]>) => void;
  setCrest: (patch: Partial<MyClub["crest"]>) => void;
  setStadium: (patch: Partial<MyClub["stadium"]>) => void;
  setFans: (patch: Partial<MyClub["fans"]>) => void;
}) {
  return (
    <>
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
            options={CREST_SHAPES.map((s) => ({ id: s, label: SHAPE_LABEL[s] }))}
          />
          <Chips
            label="Estampa"
            value={club.crest.pattern}
            onChange={(v) => setCrest({ pattern: v })}
            options={CREST_PATTERNS.map((s) => ({ id: s, label: CREST_PATTERN_LABEL[s] }))}
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
            options={KIT_PATTERNS.map((k) => ({ id: k, label: KIT_PATTERN_LABEL[k] }))}
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
          <ClubCreationReview
            club={club}
            managerName={manager}
            personality={MANAGER_PERSONALITY_LABELS[managerPersonality]}
            reputation={managerReputation}
            onEdit={onEdit}
          />
        </>
      )}
    </>
  );
}
