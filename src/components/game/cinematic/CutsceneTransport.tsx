import type { ReactNode, RefObject } from "react";
import { BookOpen, ChevronRight, Pause, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useT } from "@/i18n/provider";
import styles from "./cinematic.module.css";

/** Transport owns presentation only; timeline, voice and career choices stay in the host. */
export function CutsceneTransport({
  paused,
  settingsOpen,
  transcriptOpen,
  index,
  count,
  advanceDisabled,
  sequenceActions,
  transcriptTrigger,
  onPause,
  onReplay,
  onSettings,
  onTranscript,
  onAdvance,
}: {
  paused: boolean;
  settingsOpen: boolean;
  transcriptOpen: boolean;
  index: number;
  count: number;
  advanceDisabled: boolean;
  sequenceActions?: ReactNode;
  transcriptTrigger: RefObject<HTMLButtonElement | null>;
  onPause: () => void;
  onReplay: () => void;
  onSettings: () => void;
  onTranscript: () => void;
  onAdvance: () => void;
}) {
  const { t } = useT();
  return (
    <>
      <div className={styles["cutscene-progress"]} aria-hidden="true">
        {Array.from({ length: count }, (_, step) => (
          <span key={step} data-complete={step < index} data-active={step === index} />
        ))}
      </div>
      <div className={styles["cutscene-controls"]} role="group" aria-label={t("scene.controls")}>
        <button
          type="button"
          aria-label={t(paused ? "scene.play" : "scene.pause")}
          title={t(paused ? "scene.play" : "scene.pause")}
          aria-pressed={paused}
          onClick={onPause}
          className={styles["cutscene-control"]}
        >
          {paused ? <Play size={17} /> : <Pause size={17} />}
        </button>
        <button
          type="button"
          aria-label={t("scene.replay")}
          title={t("scene.replay")}
          onClick={onReplay}
          className={styles["cutscene-control"]}
        >
          <RotateCcw size={17} />
        </button>
        <button
          type="button"
          aria-label={t("scene.preferences")}
          title={t("scene.preferences")}
          aria-expanded={settingsOpen}
          aria-controls="cutscene-settings"
          onClick={onSettings}
          className={`${styles["cutscene-control"]} px-3 text-xs`}
        >
          <SlidersHorizontal size={17} />
          <span className="hidden sm:inline">{t("scene.settings")}</span>
        </button>
        {sequenceActions}
        <button
          type="button"
          ref={transcriptTrigger}
          onClick={onTranscript}
          aria-label={t("scene.transcript")}
          title={t("scene.transcript")}
          aria-expanded={transcriptOpen}
          className={styles["cutscene-control"]}
        >
          <BookOpen size={17} aria-hidden="true" />
        </button>
        <span
          className="ml-auto text-xs tabular-nums text-white/60"
          aria-label={t("scene.progress")}
        >
          {index + 1} / {count}
        </span>
        <button
          type="button"
          onClick={onAdvance}
          disabled={advanceDisabled}
          className={`${styles["cutscene-control"]} bg-primary px-3 text-primary-foreground`}
          aria-label={t("scene.advance")}
        >
          <ChevronRight size={18} />
          <span className="hidden text-xs sm:inline">{t("scene.continue")}</span>
        </button>
      </div>
    </>
  );
}
