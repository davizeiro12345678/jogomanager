using System.Text.Json;
using JogoManager.Engine.Core.AI;
using JogoManager.Engine.Core.Determinism;
using JogoManager.Engine.Core.Perception;

namespace JogoManager.Engine.Core.Contracts;

public sealed record RngInput(JsonElement Seed, int Count, uint? RestoreState = null);
public sealed record PassLaneInput(double X, double Z, double[] Receivers, double[] Defenders);
public sealed record ManagerInput(JsonElement Seed, LineupPlayer[] Lineup, BenchPlayer[] Bench,
    int GoalDiff, double Minute, int SubsUsed, int SentOffs, KernelCheckpoint? Checkpoint = null);
public sealed record RngResult(uint InitialState, double[] Values, uint[] States, uint FinalState);
public sealed record PassLaneResult(double[] Values);
public sealed record ManagerResult(SubstitutionChoice? Substitution, MentalityChange? Mentality,
    uint RngState, KernelCheckpoint Checkpoint);

/// <summary>Native reference kernels only. No game loop, save, browser loader,
/// service or result authority is introduced by this contract milestone.</summary>
public static class KernelApi
{
    public static string Dispatch(string requestJson)
    {
        if (requestJson.Length > 262_144) throw new ArgumentException("kernel_request_too_large");
        var request = JsonSerializer.Deserialize(requestJson, KernelContract.JsonContext.KernelRequest)
            ?? throw new ArgumentException("kernel_request_missing");
        if (request.ProtocolVersion != KernelContract.ProtocolVersion)
            throw new ArgumentException("kernel_protocol_incompatible");
        return JsonSerializer.Serialize(new KernelReply(KernelContract.ProtocolVersion,
            KernelContract.EngineVersion, KernelContract.SourceMatchExecutionRevision,
            KernelContract.FullMatchParityVerified, Execute(request.Kind, request.Input)),
            KernelContract.JsonContext.KernelReply);
    }

    public static JsonElement Execute(string kind, JsonElement input) => kind switch
    {
        "rng.sequence.v1" => RngSequence(input),
        "perception.pass-lanes.v1" => PassLanes(input),
        "ai.manager.v1" => Manager(input),
        _ => throw new NotSupportedException("full_match_or_unknown_kernel_unavailable"),
    };

    internal static SeededRng Seed(JsonElement seed) => seed.ValueKind switch
    {
        JsonValueKind.String when seed.GetString()!.Length <= 1024 => new SeededRng(seed.GetString()!),
        JsonValueKind.Number when seed.TryGetDouble(out double value) && double.IsFinite(value) => new SeededRng(SeededRng.JsUint32(value)),
        _ => throw new ArgumentException("kernel_seed_invalid"),
    };

    private static JsonElement RngSequence(JsonElement raw)
    {
        var input = raw.Deserialize(KernelContract.JsonContext.RngInput) ?? throw new ArgumentException("kernel_input_missing");
        if (input.Count is < 0 or > 4096) throw new ArgumentException("kernel_rng_count_invalid");
        var rng = Seed(input.Seed);
        uint initialState = rng.State;
        if (input.RestoreState is uint state) rng.Restore(state);
        var values = new double[input.Count]; var states = new uint[input.Count];
        for (int i = 0; i < values.Length; i++) { values[i] = rng.Next(); states[i] = rng.State; }
        return JsonSerializer.SerializeToElement(new RngResult(initialState, values, states, rng.State), KernelContract.JsonContext.RngResult);
    }

    private static JsonElement PassLanes(JsonElement raw)
    {
        var input = raw.Deserialize(KernelContract.JsonContext.PassLaneInput) ?? throw new ArgumentException("kernel_input_missing");
        if (input.Receivers is null || input.Defenders is null || input.Receivers.Length > 256 || input.Defenders.Length > 256)
            throw new ArgumentException("kernel_players_too_large");
        return JsonSerializer.SerializeToElement(new PassLaneResult(PassLanePerception.Evaluate(input.X, input.Z,
            input.Receivers, input.Defenders)), KernelContract.JsonContext.PassLaneResult);
    }

    private static JsonElement Manager(JsonElement raw)
    {
        var input = raw.Deserialize(KernelContract.JsonContext.ManagerInput) ?? throw new ArgumentException("kernel_input_missing");
        if (input.Lineup is null || input.Bench is null || input.Lineup.Length > 22 || input.Bench.Length > 22 ||
            !double.IsFinite(input.Minute) || input.Minute is < 0 or > 180 || input.GoalDiff is < -99 or > 99 ||
            input.SubsUsed is < 0 or > 5 || input.SentOffs is < 0 or > 11) throw new ArgumentException("kernel_manager_input_invalid");
        foreach (var p in input.Lineup)
            if (p is null || !ValidId(p.Id) || !ValidId(p.Pid) || !ValidPosition(p.Pos) ||
                !double.IsFinite(p.Stamina) || p.Stamina is < 0 or > 100 || !double.IsFinite(p.Ovr) || p.Ovr is < 0 or > 100 ||
                p.InjuryWeeks is < 0 or > 500 || p.Yellows is < 0 or > 5) throw new ArgumentException("kernel_lineup_invalid");
        foreach (var p in input.Bench)
            if (p is null || !ValidId(p.Id) || !ValidPosition(p.Pos) || !double.IsFinite(p.Ovr) || p.Ovr is < 0 or > 100 ||
                !double.IsFinite(p.Condition) || p.Condition is < 0 or > 100 || p.InjuryWeeks is < 0 or > 500)
                throw new ArgumentException("kernel_bench_invalid");
        var session = new ManagerSession(Seed(input.Seed));
        if (input.Checkpoint is not null) session.Restore(input.Checkpoint);
        var substitution = session.Decide(input.Lineup, input.Bench, input.GoalDiff, input.Minute, input.SubsUsed);
        return JsonSerializer.SerializeToElement(new ManagerResult(substitution,
            ManagerDecisions.MentalityTweak(input.GoalDiff, input.Minute, input.SentOffs),
            session.RngState, session.Checkpoint()), KernelContract.JsonContext.ManagerResult);
    }

    private static bool ValidId(string? id) => !string.IsNullOrWhiteSpace(id) && id.Length <= 160;
    private static bool ValidPosition(string? position) => position is not null && position.Length is > 0 and <= 8;
}
