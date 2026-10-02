import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ACCESSIBILITY_STORAGE_KEY,
  DEFAULT_ACCESSIBILITY,
  parseAccessibility,
  type AccessibilityPreferences,
} from "@/lib/accessibility-preferences";

interface AccessibilityValue {
  preferences: AccessibilityPreferences;
  reducedMotion: boolean;
  update: (patch: Partial<AccessibilityPreferences>) => void;
  reset: () => void;
}
const Context = createContext<AccessibilityValue>({
  preferences: { ...DEFAULT_ACCESSIBILITY },
  reducedMotion: false,
  update: () => undefined,
  reset: () => undefined,
});
export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({
    ...DEFAULT_ACCESSIBILITY,
  });
  const [ready, setReady] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    try {
      setPreferences(
        parseAccessibility(JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) ?? "null")),
      );
    } catch {
      /* Keep usable defaults. */
    }
    setReady(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setSystemReduced(media.matches);
    read();
    media.addEventListener("change", read);
    const sync = (e: StorageEvent) => {
      if (e.key !== ACCESSIBILITY_STORAGE_KEY) return;
      try {
        setPreferences(parseAccessibility(JSON.parse(e.newValue ?? "null")));
      } catch {
        /* Ignore invalid storage. */
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", read);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const reducedMotion =
    preferences.motion === "reduced" || (preferences.motion === "system" && systemReduced);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset["textSize"] = preferences.textSize;
    root.dataset["contrast"] = preferences.contrast;
    root.dataset["motion"] = reducedMotion ? "reduced" : "full";
    root.dataset["readingSpace"] = String(preferences.readingSpace);
    if (ready)
      try {
        localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(preferences));
      } catch {
        /* Session preferences still work. */
      }
  }, [preferences, ready, reducedMotion]);
  const update = useCallback(
    (patch: Partial<AccessibilityPreferences>) =>
      setPreferences((prev) => parseAccessibility({ ...prev, ...patch })),
    [],
  );
  const reset = useCallback(() => setPreferences({ ...DEFAULT_ACCESSIBILITY }), []);
  const value = useMemo(
    () => ({ preferences, reducedMotion, update, reset }),
    [preferences, reducedMotion, update, reset],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccessibility() {
  return useContext(Context);
}
