import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Settings2, Volume2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n";
import { voicesForLanguage } from "@/game/speech-voices";
import { Narrator } from "@/game/narrator";
import { useSignedIn } from "@/hooks/useCareer";
import { useAccessibility } from "./AccessibilityProvider";
import { PreferenceToggle, ReadingPreferences } from "./AccessibilitySettings";
import { LanguagePicker } from "./LanguagePicker";

export function NarrationSettings({
  onOpenChange,
  className = "preference-launcher",
}: {
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const { t, lang, dir } = useT();
  const { preferences: p, update } = useAccessibility();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const sample = useRef<Narrator | null>(null);
  const signedIn = useSignedIn(),
    id = useId();
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis,
      read = () => setVoices(synth.getVoices());
    read();
    synth.addEventListener("voiceschanged", read);
    return () => {
      synth.removeEventListener("voiceschanged", read);
      sample.current?.dispose();
    };
  }, []);
  const available = useMemo(() => voicesForLanguage(voices, lang), [voices, lang]);
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) sample.current?.dispose();
        onOpenChange?.(open);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={className}
          aria-label={t("match.settings")}
          title={t("match.settings")}
        >
          <Settings2 size={19} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="preferences-dialog" closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>{t("narration.title")}</DialogTitle>
          <DialogDescription>{t("narration.hint")}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="voice" dir={dir}>
          <TabsList className="preferences-tabs" aria-label={t("match.settings")}>
            <TabsTrigger value="voice">{t("narration.title")}</TabsTrigger>
            <TabsTrigger value="reading">{t("access.title")}</TabsTrigger>
            <TabsTrigger value="language">{t("shell.language")}</TabsTrigger>
          </TabsList>
          <TabsContent value="voice" className="narration-fields">
            <fieldset className="preference-choices">
              <legend className="preference-heading">{t("narration.title")}</legend>
              {(["off", "voice", "captions"] as const).map((mode) => (
                <label key={mode} className={p.narration === mode ? "selected" : ""}>
                  <input
                    type="radio"
                    name={`${id}-mode`}
                    checked={p.narration === mode}
                    onChange={() => update({ narration: mode })}
                  />
                  {t(
                    mode === "off"
                      ? "narration.off"
                      : mode === "voice"
                        ? "narration.on"
                        : "narration.captionOnly",
                  )}
                </label>
              ))}
            </fieldset>
            <PreferenceToggle
              label={t("narration.captions")}
              checked={p.captions || p.narration === "captions"}
              onChange={(captions) =>
                update({
                  captions,
                  ...(p.narration === "captions" && !captions ? { narration: "off" } : {}),
                })
              }
            />
            <label>
              {t("narration.volume")} · {Math.round(p.volume * 100)}%
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(p.volume * 100)}
                aria-label={t("narration.volume")}
                aria-valuetext={`${Math.round(p.volume * 100)}%`}
                onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
              />
            </label>
            <label>
              {t("narration.rate")} · {p.rate.toFixed(2)}×
              <input
                type="range"
                min={70}
                max={150}
                step={5}
                value={Math.round(p.rate * 100)}
                aria-label={t("narration.rate")}
                aria-valuetext={`${p.rate.toFixed(2)}×`}
                onChange={(e) => update({ rate: Number(e.target.value) / 100 })}
              />
            </label>
            <label>
              {t("narration.voice")}
              <select
                value={available.some((v) => v.voiceURI === p.voiceURI) ? p.voiceURI : ""}
                aria-label={t("narration.voice")}
                onChange={(e) => update({ voiceURI: e.target.value, realistic: false })}
              >
                <option value="">{t("narration.auto")}</option>
                {available.map((v) => (
                  <option value={v.voiceURI} key={`${v.voiceURI}-${v.lang}`}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </select>
            </label>
            <p role="status" className="preference-help">
              {t(available.length ? "narration.available" : "narration.unavailable")}
            </p>
            {signedIn && (
              <PreferenceToggle
                label={t("narration.remote")}
                checked={p.realistic}
                onChange={(realistic) => update({ realistic })}
              />
            )}
            <button
              type="button"
              className="preference-button"
              disabled={!available.length && !signedIn}
              onClick={() => {
                sample.current?.dispose();
                const n = new Narrator({
                  lang,
                  enabled: true,
                  rate: p.rate,
                  volume: p.volume,
                  voiceURI: p.voiceURI,
                  realistic: p.realistic && signedIn === true,
                });
                sample.current = n;
                n.speak("kickoff", "");
              }}
            >
              <Volume2 size={18} aria-hidden="true" /> {t("narration.sample")}
            </button>
          </TabsContent>
          <TabsContent value="reading">
            <ReadingPreferences />
          </TabsContent>
          <TabsContent value="language">
            <LanguagePicker />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
