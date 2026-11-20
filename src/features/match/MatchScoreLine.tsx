import { Crest } from "@/components/game/Crest";
import type { Club } from "@/game/types";

type MatchScoreLineProps = {
  home: Club;
  away: Club;
  homeGoals: number;
  awayGoals: number;
  clock: string;
};

export function MatchScoreLine({ home, away, homeGoals, awayGoals, clock }: MatchScoreLineProps) {
  return (
    <div className="match-score-line">
      <div className="match-score-team">
        <Crest club={home} size={24} detail="simple" />
        <abbr title={home.name}>{home.short}</abbr>
      </div>
      <span className="match-score-digits">
        {homeGoals} <span>–</span> {awayGoals}
      </span>
      <div className="match-score-team match-score-team-away">
        <abbr title={away.name}>{away.short}</abbr>
        <Crest club={away} size={24} detail="simple" />
      </div>
      <span className="match-score-clock">{clock}</span>
    </div>
  );
}
