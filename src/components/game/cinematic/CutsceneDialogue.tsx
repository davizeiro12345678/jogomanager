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
}: CutsceneDialogueProps) {
  return (
    <section className="cutscene-dialogue" aria-label="Diálogo da cena">
      {speaker ? <p className="cutscene-speaker">{speaker}</p> : null}
      <button
        type="button"
        onClick={onAdvance}
        aria-label={visibleText.length < fullText.length ? "Mostrar fala completa" : "Continuar diálogo"}
        className="block w-full text-left text-base leading-relaxed text-white sm:text-lg"
      >
        {visibleText}
        {visibleText.length < fullText.length && (
          <span aria-hidden className="opacity-40">
            ▍
          </span>
        )}
      </button>
      <p className="sr-only" aria-live="polite">
        {speaker ? `${speaker}: ` : ""}
        {fullText}
      </p>
      {choices && (
        <div className="cutscene-choices" role="group" aria-label="Escolha sua resposta">
          {choices.map((choice, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onChoose(index)}
              disabled={choiceLocked}
              aria-pressed={selectedChoice === index}
              className="cutscene-choice"
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
