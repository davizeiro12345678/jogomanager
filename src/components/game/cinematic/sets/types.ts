import type { Speaker } from "@/content/cutscenes";

export interface CinematicSetProps {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
  festive?: boolean;
  training?: boolean;
}
