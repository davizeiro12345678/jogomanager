import { Repeat } from "lucide-react";
import { useState } from "react";

import { MENTALITIES, PRESSING } from "@/game/formations";
import type { Player } from "@/game/types";

const MAX_SUBS = 5;

export type OnPitchPlayer = { pid: string; number: number; name: string };

/** Mentality, pressing and live substitutions for the manager's side. */
export function MatchManagementControls({
  myTactics,
  setMentality,
  setPressing,
  subsUsed,
  onPitch,
  benchAvailable,
  onSubstitute,
}: {
  myTactics: { mentality: number; pressing: number };
  setMentality: (value: number) => void;
  setPressing: (value: number) => void;
  subsUsed: number;
  onPitch: OnPitchPlayer[];
  benchAvailable: Player[];
  /** Resolves true once the match accepted the change. */
  onSubstitute: (outPid: string, incoming: Player) => Promise<boolean>;
}) {
  const [outPid, setOutPid] = useState("");
  const [inId, setInId] = useState("");

  async function confirmSub() {
    const incoming = benchAvailable.find((p) => p.id === inId);
    if (!outPid || !incoming || subsUsed >= MAX_SUBS) return;
    if (await onSubstitute(outPid, incoming)) {
      setOutPid("");
      setInId("");
    }
  }

  return (
    <>
    <div className="grid grid-cols-2 gap-2">
      <label className="block">
        <span className="font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
          Mentalidade
        </span>
        <select
          aria-label="Mentalidade da equipe"
          value={myTactics.mentality}
          onChange={(e) => setMentality(Number(e.target.value))}
          className="mt-1 min-h-10 w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
        >
          {MENTALITIES.map((m, i) => (
            <option key={m} value={i} className="text-black">
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
          Pressão
        </span>
        <select
          aria-label="Intensidade de pressão"
          value={myTactics.pressing}
          onChange={(e) => setPressing(Number(e.target.value))}
          className="mt-1 min-h-10 w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
        >
          {PRESSING.map((m, i) => (
            <option key={m} value={i} className="text-black">
              {m}
            </option>
          ))}
        </select>
      </label>
    </div>

    <div>
      <p className="flex items-center justify-between font-display text-[10px] uppercase tracking-[0.25em] text-white/50">
        <span className="flex items-center gap-1">
          <Repeat size={11} /> Substituições
        </span>
        <span>{subsUsed}/{MAX_SUBS}</span>
      </p>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <select
          aria-label="Jogador que sai"
          value={outPid}
          onChange={(e) => setOutPid(e.target.value)}
          className="min-h-10 w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
        >
          <option value="" className="text-black">
            Sai…
          </option>
          {onPitch.map((p) => (
            <option key={p.pid} value={p.pid} className="text-black">
              {p.number} {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Jogador que entra"
          value={inId}
          onChange={(e) => setInId(e.target.value)}
          className="min-h-10 w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
        >
          <option value="" className="text-black">
            Entra…
          </option>
          {benchAvailable.map((p) => (
            <option key={p.id} value={p.id} className="text-black">
              {p.number} {p.name} ({p.pos})
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => void confirmSub()}
        disabled={!outPid || !inId || subsUsed >= MAX_SUBS}
        className="mt-1 w-full rounded-lg bg-white/15 px-2 py-1.5 text-xs text-white disabled:opacity-40"
      >
        Confirmar substituição
      </button>
    </div>
    </>
  );
}
