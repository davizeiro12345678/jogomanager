import styles from "./cinematic.module.css";
import { Volume2, VolumeX, Eye, EyeOff } from "lucide-react";

interface CutsceneSettingsProps {
  captions: boolean;
  pendingChoice: boolean;
  onToggleCaptions: () => void;
  narrate: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  ambientEnabled: boolean;
  onToggleAmbience: () => void;
  automatic: boolean;
  onToggleAutomatic: () => void;
  mode: "3d" | "2d";
  onToggleMode: () => void;
  captionScale?: number;
  onCaptionScale?: (scale: number) => void;
  labels?: {
    preferences: string;
    captionSize: string;
    captionHide: string;
    captionShow: string;
    voiceOff: string;
    voiceOn: string;
    ambience: string;
    automatic: string;
    illustrated: string;
    stage: string;
  };
}

export function CutsceneSettings({
  captions,
  pendingChoice,
  onToggleCaptions,
  narrate,
  voiceEnabled,
  onToggleVoice,
  ambientEnabled,
  onToggleAmbience,
  automatic,
  onToggleAutomatic,
  mode,
  onToggleMode,
  captionScale = 1,
  onCaptionScale,
  labels = {
    preferences: "Preferências da cena",
    captionSize: "Tamanho das legendas",
    captionHide: "Ocultar legendas",
    captionShow: "Mostrar legendas",
    voiceOff: "Desligar voz",
    voiceOn: "Ligar voz",
    ambience: "Som ambiente",
    automatic: "Automático",
    illustrated: "Cena ilustrada",
    stage: "Ver palco 3D",
  },
}: CutsceneSettingsProps) {
  return (
    <div
      id="cutscene-settings"
      className={styles["cutscene-settings"]}
      role="group"
      aria-label={labels.preferences}
    >
      {onCaptionScale && (
        <label className={styles["cutscene-caption-size"]}>
          <span>{labels.captionSize}</span>
          <input
            type="range"
            min="1"
            max="1.5"
            step="0.1"
            value={captionScale}
            onChange={(event) => onCaptionScale(Number(event.target.value))}
          />
        </label>
      )}
      <button
        type="button"
        aria-pressed={captions}
        disabled={pendingChoice}
        onClick={onToggleCaptions}
        className={`${styles["cutscene-control"]} px-3 text-xs`}
      >
        {captions ? <Eye size={17} /> : <EyeOff size={17} />}
        {captions ? labels.captionHide : labels.captionShow}
      </button>
      {narrate && (
        <button
          type="button"
          aria-pressed={voiceEnabled}
          onClick={onToggleVoice}
          className={`${styles["cutscene-control"]} px-3 text-xs`}
        >
          {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          {voiceEnabled ? labels.voiceOff : labels.voiceOn}
        </button>
      )}
      <button
        type="button"
        aria-pressed={ambientEnabled}
        onClick={onToggleAmbience}
        className={`${styles["cutscene-control"]} px-3 text-xs`}
      >
        {ambientEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
        {labels.ambience}
      </button>
      <button
        type="button"
        aria-pressed={automatic}
        onClick={onToggleAutomatic}
        className={`${styles["cutscene-control"]} px-3 text-xs`}
      >
        {labels.automatic}
      </button>
      <button
        type="button"
        onClick={onToggleMode}
        className={`${styles["cutscene-control"]} px-3 text-xs`}
      >
        {mode === "3d" ? labels.illustrated : labels.stage}
      </button>
    </div>
  );
}
