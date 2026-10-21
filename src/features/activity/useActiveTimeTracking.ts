import { useEffect, useRef } from "react";

import type { CareerState } from "@/game/types";

import { supabase } from "@/integrations/supabase/client";

export function useActiveTimeTracking(career: CareerState | null, signedIn: boolean | null) {
  const lastInteraction = useRef(0);

  useEffect(() => {
    if (!career || !signedIn) return;
    lastInteraction.current = Date.now();
    const markActive = () => {
      lastInteraction.current = Date.now();
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));

    const heartbeat = async () => {
      if (document.hidden || Date.now() - lastInteraction.current > 90_000) return;
      await supabase.rpc("record_active_time", {
        p_public_name: career.managerName || "Treinador",
        p_club_id: career.clubId,
      });
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 60_000);
    return () => {
      window.clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, markActive));
    };
  }, [career, signedIn]);
}
