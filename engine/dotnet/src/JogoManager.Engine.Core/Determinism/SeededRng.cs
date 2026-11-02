namespace JogoManager.Engine.Core.Determinism;

/// <summary>Exact port of src/game/rng.ts, including JS arithmetic right shift
/// and FNV-1a over UTF-16 code units. It is deliberately not System.Random.</summary>
public sealed class SeededRng
{
    private uint state;
    public uint State => state;

    public SeededRng(uint seed) => state = seed == 0 ? 0x9e3779b9u : seed;
    public SeededRng(string seed) : this(HashSeed(seed)) { }

    public static uint HashSeed(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        uint hash = 2166136261;
        foreach (char unit in text) hash = unchecked((hash ^ unit) * 16777619u);
        return hash;
    }

    public static uint JsUint32(double number)
    {
        if (!double.IsFinite(number) || number == 0) return 0;
        double modulo = Math.Truncate(number) % 4294967296d;
        return (uint)(modulo < 0 ? modulo + 4294967296d : modulo);
    }

    public double Next()
    {
        // JS converts both bitwise operands to int32. In particular `>> 17`
        // sign-extends even though the stored state is an unsigned Number.
        int bits = unchecked((int)state);
        bits ^= bits << 13;
        bits ^= bits >> 17;
        bits ^= bits << 5;
        state = unchecked((uint)bits);
        return state / 4294967296d;
    }

    // Restoring zero is legal in TS (unlike constructing with a zero seed).
    public void Restore(uint savedState) => state = savedState;
}
