import { createContext, useContext } from "react";

import {
  DEFAULT_ACCESSIBILITY,
  type AccessibilityPreferences,
} from "@/lib/accessibility-preferences";

export interface AccessibilityValue {
  preferences: AccessibilityPreferences;
  reducedMotion: boolean;
  update: (patch: Partial<AccessibilityPreferences>) => void;
  reset: () => void;
}

export const Context = createContext<AccessibilityValue>({
  preferences: { ...DEFAULT_ACCESSIBILITY },
  reducedMotion: false,
  update: () => undefined,
  reset: () => undefined,
});

export function useAccessibility() {
  return useContext(Context);
}
