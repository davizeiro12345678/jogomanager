using JogoManager.Engine.Core.Contracts;
using JogoManager.Engine.Core.Determinism;

namespace JogoManager.Engine.Core.AI;

/// <summary>Per-aggregate continuation of the ported decision kernels only.
/// Its checkpoint is NOT a MatchSim checkpoint, save or authority attestation.</summary>
public sealed class ManagerSession(SeededRng rng)
{
    private int decisionSequence;
    public uint RngState => rng.State;
    public int DecisionSequence => decisionSequence;

    public KernelCheckpoint Checkpoint() => new(1, KernelContract.EngineVersion,
        KernelContract.SourceMatchExecutionRevision, KernelContract.RngAlgorithm, rng.State, decisionSequence);

    public void Restore(KernelCheckpoint checkpoint)
    {
        ArgumentNullException.ThrowIfNull(checkpoint);
        checkpoint.Validate(); // Validate everything before mutating the live session.
        rng.Restore(checkpoint.RngState);
        decisionSequence = checkpoint.DecisionSequence;
    }

    public SubstitutionChoice? Decide(IReadOnlyList<LineupPlayer> lineup, IReadOnlyList<BenchPlayer> bench,
        int goalDiff, double minute, int subsUsed)
    {
        if (decisionSequence >= 1_000_000_000) throw new InvalidOperationException("kernel_sequence_limit");
        var choice = ManagerDecisions.PickSubstitution(lineup, bench, goalDiff, minute, subsUsed, rng);
        decisionSequence++;
        return choice;
    }
}
