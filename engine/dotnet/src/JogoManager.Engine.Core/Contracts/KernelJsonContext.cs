using System.Text.Json.Serialization;
using JogoManager.Engine.Core.AI;

namespace JogoManager.Engine.Core.Contracts;

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    GenerationMode = JsonSourceGenerationMode.Metadata)]
[JsonSerializable(typeof(KernelRequest))]
[JsonSerializable(typeof(KernelReply))]
[JsonSerializable(typeof(RngInput))]
[JsonSerializable(typeof(RngResult))]
[JsonSerializable(typeof(PassLaneInput))]
[JsonSerializable(typeof(PassLaneResult))]
[JsonSerializable(typeof(ManagerInput))]
[JsonSerializable(typeof(ManagerResult))]
[JsonSerializable(typeof(KernelCheckpoint))]
[JsonSerializable(typeof(LineupPlayer[]))]
[JsonSerializable(typeof(BenchPlayer[]))]
public partial class KernelJsonContext : JsonSerializerContext;
