import { useCallback, useEffect, useRef, useState } from "react";
import { Narrator } from "@/game/narrator";
import { useT } from "@/i18n";
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";
import { useSignedIn } from "./useCareer";

/** One narrator per match; preference updates never replay old sim events. */
export function useMatchNarration(session: unknown, paused: boolean) {
  const { lang } = useT();
  const { preferences: p, update } = useAccessibility();
  const signedIn = useSignedIn();
  const [caption, setCaption] = useState<string | null>(null);
  const narratorRef = useRef<Narrator | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const narrating = p.narration !== "off";
  useEffect(() => {
    const narrator = new Narrator({ lang, enabled: false, onCaption: setCaption });
    narratorRef.current = narrator;
    const visibility = () => narrator.setPaused(document.hidden || pausedRef.current);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      narrator.dispose();
      narratorRef.current = null;
    };
  }, [session]);
  useEffect(() => {
    const n = narratorRef.current;
    if (!n) return;
    n.setLang(lang);
    n.setCaptionOnly(p.narration === "captions");
    n.setVoice(p.voiceURI);
    n.setRate(p.rate);
    n.setVolume(p.volume);
    // Studio voice is served by the existing authenticated endpoint.
    n.setRealistic(p.realistic && signedIn === true);
    n.setEnabled(narrating);
    n.setPaused(paused || document.hidden);
  }, [session, lang, p, narrating, signedIn, paused]);
  const setNarrating = useCallback(
    (value: boolean | ((old: boolean) => boolean)) => {
      const enabled = typeof value === "function" ? value(narrating) : value;
      update({ narration: enabled ? "voice" : "off" });
    },
    [narrating, update],
  );
  return {
    narratorRef,
    narrating,
    setNarrating,
    caption: narrating && (p.captions || p.narration === "captions") ? caption : null,
  };
}
