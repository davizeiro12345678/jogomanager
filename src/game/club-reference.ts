import { CLUBS } from "./data/leagues";
import type { Club } from "./types";

/** Club lookup shared by selection and squad construction, without roster data. */
export function safeClub(clubId: string): Club {
  return (
    CLUBS[clubId] ?? {
      id: clubId,
      name: "Clube convidado",
      short: "CVD",
      league: "bra",
      primary: "#c9d2dc",
      secondary: "#1d2733",
      strength: 68,
    }
  );
}
