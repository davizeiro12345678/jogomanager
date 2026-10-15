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
}: CutsceneSettingsProps) {
  return (
    <div
      id="cutscene-settings"
      className="cutscene-settings"
      role="group"
      aria-label="Preferências da cena"
    >
      <button
        type="button"
        aria-pressed={captions}
        disabled={pendingChoice}
        onClick={onToggleCaptions}
        className="cutscene-control px-3 text-xs"
      >
        {captions ? <Eye size={17} /> : <EyeOff size={17} />}
        {captions ? "Ocultar legendas" : "Mostrar legendas"}
      </button>
      {narrate && (
        <button
          type="button"
          aria-pressed={voiceEnabled}
          onClick={onToggleVoice}
          className="cutscene-control px-3 text-xs"
        >
          {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          {voiceEnabled ? "Desligar voz" : "Ligar voz"}
        </button>
      )}
      <button
        type="button"
        aria-pressed={ambientEnabled}
        onClick={onToggleAmbience}
        className="cutscene-control px-3 text-xs"
      >
        {ambientEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
        Som ambiente
      </button>
      <button
        type="button"
        aria-pressed={automatic}
        onClick={onToggleAutomatic}
        className="cutscene-control px-3 text-xs"
      >
        Automático
      </button>
      <button type="button" onClick={onToggleMode} className="cutscene-control px-3 text-xs">
        {mode === "3d" ? "Cena ilustrada" : "Ver palco 3D"}
      </button>
    </div>
  );
}
