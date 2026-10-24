import { makeRng } from "./rng";
import { refFor } from "./sim-rules";
import { windFor } from "./ball-climate";
import { buildSimTeam, placeKickoffStarter } from "./sim-team";
import { emptyStats, type TeamSetup } from "./sim-types";
import type { LiveSnapshot } from "./live-match";
import type { WeatherKind } from "./sim-rules";

/** First render data only. Match rules and time advancement stay in the Worker. */
export function initialMatchSnapshot(
  home: TeamSetup,
  away: TeamSetup,
  seed: string,
  weather?: WeatherKind,
): LiveSnapshot {
  const players = [...buildSimTeam(home, "home", seed), ...buildSimTeam(away, "away", seed)];
  const starter = placeKickoffStarter(players, "home");
  // MatchSim consumes three draws for stoppage time before selecting its referee.
  const rng = makeRng(seed);
  rng();
  rng();
  rng();
  const referee = refFor(rng);
  return {
    seq: 0,
    sentAt: performance.now(),
    time: 0,
    clock: "0'",
    phase: "first",
    shootout: [],
    weather: weather ?? "clear",
    wind: windFor(seed),
    refName: referee.name,
    players,
    ball: { x: 0, z: 0, vx: 0, vz: 0, height: 0.12, holder: starter.id },
    possession: "home",
    stats: { home: emptyStats(), away: emptyStats() },
    events: [
      {
        minute: 0,
        type: "kickoff",
        side: "neutral",
        text: `Bola rolando no duelo entre ${home.name} e ${away.name}. Apita ${referee.name}.`,
      },
    ],
    eventSeq: 0,
    finished: false,
    subsUsed: { home: 0, away: 0 },
  };
}
