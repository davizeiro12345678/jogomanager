using JogoManager.Engine.Core.Determinism;

namespace JogoManager.Engine.Core.AI;

public sealed record LineupPlayer(string Id, string Pid, string Pos, double Stamina,
    int InjuryWeeks, bool SentOff, int Yellows, double Ovr);
public sealed record BenchPlayer(string Id, string Pos, double Ovr, double Condition,
    int InjuryWeeks, bool Suspended);
public sealed record SubstitutionChoice(string OutPid, string InId, string Reason);
public sealed record MentalityChange(int Mentality, int Pressing);

/// <summary>Port of aiSubPick/aiMentalityTweak in src/game/sim-rules.ts.
/// LINQ OrderBy is stable: roster order continues to break equal-score ties.
/// The caller owns the RNG; this module does not create or share one.</summary>
public static class ManagerDecisions
{
    private static string PositionGroup(string position)
    {
        string p = position.ToUpperInvariant();
        if (p == "GK") return "GK";
        if (p.StartsWith('D') || p is "CB" or "LB" or "RB" or "WB") return "DF";
        if (p.StartsWith('F') || p is "ST" or "CF" or "WG" or "LW" or "RW") return "FW";
        return "MF";
    }

    public static SubstitutionChoice? PickSubstitution(IReadOnlyList<LineupPlayer> lineup,
        IReadOnlyList<BenchPlayer> bench, int goalDiff, double minute, int subsUsed, SeededRng rng)
    {
        if (subsUsed >= 5 || minute < 50) return null;
        var available = bench.Where(b => b.InjuryWeeks == 0 && !b.Suspended && b.Condition > 40).ToArray();
        if (available.Length == 0) return null;
        var field = lineup.Where(p => !p.SentOff).ToArray();
        var hurt = field.FirstOrDefault(p => p.InjuryWeeks > 0);
        if (hurt is not null)
        {
            var replacement = available.Where(b => PositionGroup(b.Pos) == PositionGroup(hurt.Pos))
                .OrderByDescending(b => b.Ovr).FirstOrDefault();
            if (replacement is not null) return new(hurt.Pid, replacement.Id, "lesão");
        }
        if (minute >= 60)
        {
            var exhausted = field.Where(p => p.Pos != "GK" && p.Stamina < 42)
                .OrderBy(p => p.Stamina).FirstOrDefault();
            if (exhausted is not null && rng.Next() < .75)
            {
                var replacement = available.Where(b => PositionGroup(b.Pos) == PositionGroup(exhausted.Pos))
                    .OrderByDescending(b => b.Ovr).FirstOrDefault();
                if (replacement is not null) return new(exhausted.Pid, replacement.Id, "fadiga");
            }
        }
        if (minute >= 63 && rng.Next() < .6)
        {
            if (goalDiff < 0)
            {
                var outgoing = field.Where(p => PositionGroup(p.Pos) == "DF" ||
                    (PositionGroup(p.Pos) == "MF" && p.Yellows > 0)).OrderBy(p => p.Ovr).FirstOrDefault();
                var incoming = available.Where(b => PositionGroup(b.Pos) == "FW").OrderByDescending(b => b.Ovr).FirstOrDefault();
                if (outgoing is not null && incoming is not null) return new(outgoing.Pid, incoming.Id, "tática");
            }
            else if (goalDiff > 0 && minute >= 74)
            {
                var outgoing = field.Where(p => PositionGroup(p.Pos) == "FW").OrderBy(p => p.Ovr).FirstOrDefault();
                var incoming = available.Where(b => PositionGroup(b.Pos) is "DF" or "MF").OrderByDescending(b => b.Ovr).FirstOrDefault();
                if (outgoing is not null && incoming is not null) return new(outgoing.Pid, incoming.Id, "tática");
            }
        }
        return null;
    }

    public static MentalityChange? MentalityTweak(int goalDiff, double minute, int sentOffs)
    {
        if (minute < 55) return null;
        if (sentOffs > 0) return new(-1, -1);
        if (goalDiff < 0 && minute >= 60) return new(1, 1);
        if (goalDiff > 0 && minute >= 70) return new(-1, 0);
        if (goalDiff == 0 && minute >= 80) return new(1, 0);
        return null;
    }
}
