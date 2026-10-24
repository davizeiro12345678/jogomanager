import styles from "./cinematic.module.css";
import type { CutsceneChoice } from "@/content/cutscene-types";

interface CutsceneDialogueProps {
  speaker?: string | undefined;
  fullText: string;
  visibleText: string;
  choices?: readonly CutsceneChoice[] | undefined;
  selectedChoice: number | null;
  choiceLocked: boolean;
  onAdvance: () => void;
  onChoose: (index: number) => void;
  language?: string | undefined;
  labels?: { dialogue: string; fullLine: string; continue: string; choice: string };
}

export function CutsceneDialogue({
  speaker,
  fullText,
  visibleText,
  choices,
  selectedChoice,
  choiceLocked,
  onAdvance,
  onChoose,
  language,
  labels = {
    dialogue: "Diálogo da cena",
    fullLine: "Mostrar fala completa",
    continue: "Continuar diálogo",
    choice: "Escolha sua resposta",
  },
}: CutsceneDialogueProps) {
  return (
    <section className={styles["cutscene-dialogue"]} aria-label={labels.dialogue}>
      {speaker ? <p className={styles["cutscene-speaker"]}>{speaker}</p> : null}
      <button
        type="button"
        onClick={onAdvance}
        aria-label={visibleText.length < fullText.length ? labels.fullLine : labels.continue}
        className={`${styles["cutscene-caption"]} block w-full text-start leading-relaxed text-white`}
        dir="auto"
        lang={language}
      >
        {visibleText}
        {visibleText.length < fullText.length && (
          <span aria-hidden className="opacity-40">
            ▍
          </span>
        )}
      </button>
      <p className="sr-only" aria-live="polite" lang={language}>
        {speaker ? `${speaker}: ` : ""}
        {fullText}
      </p>
      {choices && (
        <div className={styles["cutscene-choices"]} role="group" aria-label={labels.choice}>
          {choices.map((choice, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onChoose(index)}
              disabled={choiceLocked}
              aria-pressed={selectedChoice === index}
              className={styles["cutscene-choice"]}
            >
              <span className="block font-semibold">{choice.label}</span>
              {choice.hint ? (
                <span className="mt-1 block text-xs text-white/60">{choice.hint}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
