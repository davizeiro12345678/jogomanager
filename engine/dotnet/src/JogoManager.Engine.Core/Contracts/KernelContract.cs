using System.Text.Json;
using System.Text.Json.Serialization;

namespace JogoManager.Engine.Core.Contracts;

public static class KernelContract
{
    public const int ProtocolVersion = 1;
    public const int SourceMatchExecutionRevision = 2;
    public const string EngineVersion = "dotnet-kernels-v1";
    public const string RngAlgorithm = "ts-xorshift32-arithmetic-v1";
    public const bool FullMatchParityVerified = false;
    public static JsonSerializerOptions Json { get; } = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
        AllowDuplicateProperties = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        RespectRequiredConstructorParameters = true,
        MaxDepth = 24,
        Converters = { new JavaScriptJsonNumberConverter() },
    };
    public static KernelJsonContext JsonContext { get; } = new(Json);
}

public sealed record KernelRequest(int ProtocolVersion, string Kind, JsonElement Input);
public sealed record KernelReply(int ProtocolVersion, string EngineVersion,
    int SourceMatchExecutionRevision, bool FullMatchParityVerified, JsonElement Result);
public sealed record KernelCheckpoint(int SchemaVersion, string EngineVersion,
    int SourceMatchExecutionRevision, string RngAlgorithm, uint RngState, int DecisionSequence)
{
    public void Validate()
    {
        if (SchemaVersion != 1 || EngineVersion != KernelContract.EngineVersion ||
            SourceMatchExecutionRevision != KernelContract.SourceMatchExecutionRevision ||
            RngAlgorithm != KernelContract.RngAlgorithm || DecisionSequence is < 0 or > 1_000_000_000)
            throw new ArgumentException("kernel_checkpoint_incompatible");
    }
}
