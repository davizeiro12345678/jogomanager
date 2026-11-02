using System.Text;
using System.Text.Json;
using JogoManager.Engine.Core.AI;
using JogoManager.Engine.Core.Contracts;
using JogoManager.Engine.Core.Determinism;
using JogoManager.Engine.Core.Perception;

Console.InputEncoding = new UTF8Encoding(false, true);
Console.OutputEncoding = new UTF8Encoding(false);

static (string Name, string Request)[] RejectionFixtures()
{
    const string rng = """{"protocolVersion":1,"kind":"rng.sequence.v1","input":{"seed":"hello","count":1}}""";
    const string manager = """{"protocolVersion":1,"kind":"ai.manager.v1","input":{"seed":"hello","lineup":[],"bench":[],"goalDiff":0,"minute":70,"subsUsed":0,"sentOffs":0,"checkpoint":{"schemaVersion":1,"engineVersion":"dotnet-kernels-v1","sourceMatchExecutionRevision":2,"rngAlgorithm":"ts-xorshift32-arithmetic-v1","rngState":123,"decisionSequence":1}}}""";
    return [
        ("quoted protocol number", rng.Replace("\"protocolVersion\":1", "\"protocolVersion\":\"1\"")),
        ("quoted input count", rng.Replace("\"count\":1", "\"count\":\"1\"")),
        ("duplicate protocol invalid then valid", rng.Replace("\"protocolVersion\":1", "\"protocolVersion\":999,\"protocolVersion\":1")),
        ("duplicate protocol valid then invalid", rng.Replace("\"protocolVersion\":1", "\"protocolVersion\":1,\"protocolVersion\":999")),
        ("duplicate input count invalid then valid", rng.Replace("\"count\":1", "\"count\":-1,\"count\":1")),
        ("duplicate input count valid then invalid", rng.Replace("\"count\":1", "\"count\":1,\"count\":-1")),
        ("escaped duplicate input name", rng.Replace("\"count\":1", "\"count\":-1,\"\\u0063ount\":1")),
        ("duplicate input envelope", rng.Replace("\"input\":", "\"input\":{\"seed\":true,\"count\":-1},\"input\":")),
        ("duplicate kind", rng.Replace("\"kind\":", "\"kind\":\"match.advance.v1\",\"kind\":")),
        ("root case alias alone", rng.Replace("protocolVersion", "ProtocolVersion")),
        ("root case alias after canonical", rng.Replace("\"protocolVersion\":1", "\"protocolVersion\":1,\"ProtocolVersion\":999")),
        ("root case alias before canonical", rng.Replace("\"protocolVersion\":1", "\"ProtocolVersion\":999,\"protocolVersion\":1")),
        ("input envelope case alias", rng.Replace("\"input\":", "\"Input\":")),
        ("input case alias alone", rng.Replace("\"count\":", "\"Count\":")),
        ("input case alias after canonical", rng.Replace("\"count\":1", "\"count\":1,\"Count\":-1")),
        ("input case alias before canonical", rng.Replace("\"count\":1", "\"Count\":-1,\"count\":1")),
        ("quoted checkpoint schema", manager.Replace("\"schemaVersion\":1", "\"schemaVersion\":\"1\"")),
        ("quoted checkpoint RNG state", manager.Replace("\"rngState\":123", "\"rngState\":\"123\"")),
        ("quoted checkpoint sequence", manager.Replace("\"decisionSequence\":1", "\"decisionSequence\":\"1\"")),
        ("duplicate checkpoint schema invalid then valid", manager.Replace("\"schemaVersion\":1", "\"schemaVersion\":999,\"schemaVersion\":1")),
        ("duplicate checkpoint schema valid then invalid", manager.Replace("\"schemaVersion\":1", "\"schemaVersion\":1,\"schemaVersion\":999")),
        ("duplicate checkpoint sequence invalid then valid", manager.Replace("\"decisionSequence\":1", "\"decisionSequence\":-1,\"decisionSequence\":1")),
        ("escaped duplicate checkpoint sequence", manager.Replace("\"decisionSequence\":1", "\"decisionSequence\":-1,\"\\u0064ecisionSequence\":1")),
        ("checkpoint case alias alone", manager.Replace("\"schemaVersion\":", "\"SchemaVersion\":")),
        ("checkpoint case alias after canonical", manager.Replace("\"schemaVersion\":1", "\"schemaVersion\":1,\"SchemaVersion\":999")),
        ("checkpoint case alias before canonical", manager.Replace("\"schemaVersion\":1", "\"SchemaVersion\":999,\"schemaVersion\":1")),
        ("duplicate checkpoint object", manager.Replace("\"checkpoint\":", "\"checkpoint\":null,\"checkpoint\":")),
        ("checkpoint envelope case alias", manager.Replace("\"checkpoint\":", "\"Checkpoint\":")),
        ("negative protocol", rng.Replace("\"protocolVersion\":1", "\"protocolVersion\":-1")),
        ("negative input count", rng.Replace("\"count\":1", "\"count\":-1")),
        ("negative checkpoint RNG state", manager.Replace("\"rngState\":123", "\"rngState\":-1")),
        ("negative checkpoint sequence", manager.Replace("\"decisionSequence\":1", "\"decisionSequence\":-1")),
        ("quoted manager floating number", manager.Replace("\"minute\":70", "\"minute\":\"70\"")),
    ];
}

if (args.Contains("--rejection-fixtures"))
{
    Console.WriteLine(JsonSerializer.Serialize(RejectionFixtures().Select(c => new { name = c.Name, request = c.Request })));
    return;
}

if (args.Contains("--self-test"))
{
    var checks = new List<string>();
    void Check(string name, bool condition)
    {
        if (!condition) throw new InvalidOperationException(name);
        checks.Add(name);
    }
    void Reject(string name, string request)
    {
        bool rejected = false;
        try { KernelApi.Dispatch(request); }
        catch (Exception e) when (e is ArgumentException or JsonException or NotSupportedException or InvalidOperationException)
        { rejected = true; }
        Check(name, rejected);
    }

    var rng = new SeededRng("hello");
    Check("UTF16 FNV-1a known vector", SeededRng.HashSeed("hello") == 1335831723u);
    rng.Restore(0);
    Check("restore zero is not constructor default", rng.Next() == 0 && rng.State == 0);
    var a = new SeededRng("resume"); var b = new SeededRng("resume");
    for (int i = 0; i < 35; i++) a.Next();
    b.Restore(a.State);
    Check("RNG continuation", Enumerable.Range(0, 40).All(_ => a.Next() == b.Next()));
    double[] output = Enumerable.Repeat(12345d, 8).ToArray();
    int written = PassLanePerception.EvaluateInto(0, 0, [20, 0, 0, 0, 30, 0, 0, 0], [10, 2, 0, -4], output.AsSpan(0, 5));
    Check("only complete perception records are written", written == 3 && output.Skip(3).All(x => x == 12345));
    Check("moving defender closes lane", output[2] > 0);
    Check("corrupt perception coordinates remain finite", PassLanePerception.Evaluate(double.MaxValue, double.NaN,
        [double.MaxValue, -double.MaxValue, 0, 0], [double.NaN, double.PositiveInfinity, 0, 0]).All(double.IsFinite));
    LineupPlayer[] lineup = [new("l1", "p1", "MF", 100, 1, false, 0, 70)];
    BenchPlayer[] bench = [new("first", "MF", 80, 90, 0, false), new("second", "MF", 80, 90, 0, false)];
    var session = new ManagerSession(new SeededRng("manager"));
    uint before = session.RngState;
    Check("injury priority and stable roster ties", session.Decide(lineup, bench, -1, 70, 0)?.InId == "first");
    Check("injury branch consumes no random draw", before == session.RngState);
    var checkpoint = session.Checkpoint();
    var clone = new ManagerSession(new SeededRng("different"));
    clone.Restore(checkpoint);
    Check("checkpoint restores complete kernel continuation", clone.Checkpoint() == checkpoint);
    bool rejected = false;
    try { clone.Restore(checkpoint with { SourceMatchExecutionRevision = 999 }); }
    catch (ArgumentException) { rejected = true; }
    Check("incompatible restore is atomic", rejected && clone.Checkpoint() == checkpoint);
    Check("substitution budget remains bounded", session.Decide(lineup, bench, -1, 70, 5) is null);
    rejected = false;
    try { KernelApi.Execute("match.advance.v1", JsonSerializer.SerializeToElement(new { })); }
    catch (NotSupportedException) { rejected = true; }
    Check("full match and season authority remain unavailable", rejected && !KernelContract.FullMatchParityVerified);

    const string valid = """{"protocolVersion":1,"kind":"rng.sequence.v1","input":{"seed":"hello","count":1}}""";
    using var reply = JsonDocument.Parse(KernelApi.Dispatch(valid));
    Check("real dispatch declares the kernel-only authority boundary", reply.RootElement.GetProperty("engineVersion").GetString() == "dotnet-kernels-v1" &&
        !reply.RootElement.GetProperty("fullMatchParityVerified").GetBoolean());
    Reject("unknown protocol is refused", valid.Replace("\"protocolVersion\":1", "\"protocolVersion\":2"));
    Reject("unknown root fields are refused", valid.Replace("\"kind\":", "\"officialScore\":9,\"kind\":"));
    Reject("unknown input fields are refused", valid.Replace("\"count\":1", "\"count\":1,\"officialWin\":true"));
    Reject("missing required constructor fields are refused", valid.Replace(",\"count\":1", ""));
    Reject("oversized request is refused", new string(' ', 262_145));
    Reject("oversized RNG sequence is refused", valid.Replace("\"count\":1", "\"count\":4097"));
    Reject("negative RNG count is refused", valid.Replace("\"count\":1", "\"count\":-1"));
    Reject("invalid seed type is refused", valid.Replace("\"seed\":\"hello\"", "\"seed\":true"));
    Reject("season execution is unavailable", valid.Replace("rng.sequence.v1", "career.autoSeason.v1"));
    Reject("experimental AI is unavailable", valid.Replace("rng.sequence.v1", "match.human-ai.v2"));
    Reject("null protocol envelope is refused", "null");
    foreach (var incompatible in new[] { checkpoint with { SchemaVersion = 2 }, checkpoint with { EngineVersion = "future" },
        checkpoint with { RngAlgorithm = "System.Random" }, checkpoint with { DecisionSequence = -1 } })
    {
        rejected = false;
        try { clone.Restore(incompatible); }
        catch (ArgumentException) { rejected = true; }
        Check("checkpoint metadata fails atomically " + checks.Count, rejected && clone.Checkpoint() == checkpoint);
    }
    double negativeZero = BitConverter.Int64BitsToDouble(long.MinValue);
    Check("JSON signed zero follows JavaScript wire convention", JsonSerializer.Serialize(negativeZero, KernelContract.Json) == "0");
    foreach (var fixture in RejectionFixtures()) Reject(fixture.Name, fixture.Request);
    // The outer request holds Input as JsonElement. Confirm duplicate checking
    // occurs there too, before the typed kernel deserializer sees that element.
    foreach (var name in new[] { "duplicate input count invalid then valid", "escaped duplicate input name",
        "duplicate checkpoint schema invalid then valid", "escaped duplicate checkpoint sequence" })
    {
        rejected = false;
        try { JsonSerializer.Deserialize(RejectionFixtures().First(c => c.Name == name).Request, KernelContract.JsonContext.KernelRequest); }
        catch (JsonException) { rejected = true; }
        Check("nested JsonElement rejects " + name, rejected);
    }
    Console.WriteLine(JsonSerializer.Serialize(new { passed = checks.Count, checks,
        runtimeVersion = Environment.Version.ToString(), framework = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription }));
    return;
}

string? line;
while ((line = Console.ReadLine()) is not null)
{
    try { Console.WriteLine(KernelApi.Dispatch(line)); }
    catch (Exception e) when (e is ArgumentException or JsonException or NotSupportedException or InvalidOperationException)
    { Console.WriteLine(JsonSerializer.Serialize(new { error = e.Message })); }
}
