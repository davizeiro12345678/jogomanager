namespace JogoManager.Engine.Core.Perception;

/// <summary>Port of evaluatePassLanesIntoFallback in the selected main source.
/// Input records are x,z,vx,vz. Complete output records are distance,cover,risk.
/// This is a real existing AI kernel, not a replacement football simulator.</summary>
public static class PassLanePerception
{
    public const int MaxPlayers = 64;
    private const double MaxSpatialValue = 1_000_000;
    private static double Finite(double value) => double.IsFinite(value)
        ? Math.Max(-MaxSpatialValue, Math.Min(MaxSpatialValue, value)) : 0;
    private static double Quantize(double value)
    {
        double scaled = value * 1e9;
        double floor = Math.Floor(scaled);
        return (scaled - floor < .5 ? floor : floor + 1) / 1e9;
    }

    public static double[] Evaluate(double x, double z, ReadOnlySpan<double> receivers, ReadOnlySpan<double> defenders)
    {
        var output = new double[Math.Min(MaxPlayers, receivers.Length / 4) * 3];
        EvaluateInto(x, z, receivers, defenders, output);
        return output;
    }

    public static int EvaluateInto(double x, double z, ReadOnlySpan<double> receivers,
        ReadOnlySpan<double> defenders, Span<double> output)
    {
        x = Finite(x); z = Finite(z);
        int count = Math.Min(MaxPlayers, Math.Min(receivers.Length / 4, output.Length / 3));
        int defenderCount = Math.Min(MaxPlayers, defenders.Length / 4);
        for (int i = 0; i < count; i++)
        {
            double rx = Finite(receivers[i * 4]), rz = Finite(receivers[i * 4 + 1]);
            double dx = rx - x, dz = rz - z;
            double lengthSquared = dx * dx + dz * dz;
            double distance = Math.Sqrt(lengthSquared);
            double flight = distance / Math.Min(31, 10 + distance * .8);
            double coverSquared = 10000, risk = 0;
            for (int j = 0; j < defenderCount; j++)
            {
                double ox = Finite(defenders[j * 4]), oz = Finite(defenders[j * 4 + 1]);
                double cx = rx - ox, cz = rz - oz;
                coverSquared = Math.Min(coverSquared, cx * cx + cz * cz);
                double t = Math.Max(0, Math.Min(1, ((ox - x) * dx + (oz - z) * dz) /
                    (lengthSquared == 0 ? 1 : lengthSquared)));
                double lx = x + dx * t, lz = z + dz * t;
                double ax = ox - lx, az = oz - lz;
                double px = ax + Math.Max(-1.5, Math.Min(1.5, Finite(defenders[j * 4 + 2]) * flight * t));
                double pz = az + Math.Max(-1.5, Math.Min(1.5, Finite(defenders[j * 4 + 3]) * flight * t));
                double laneSquared = Math.Min(ax * ax + az * az, px * px + pz * pz);
                if (laneSquared < 2.2 * 2.2) risk += (2.2 - Math.Sqrt(laneSquared)) * 2.8;
            }
            int offset = i * 3;
            output[offset] = Quantize(distance);
            output[offset + 1] = Quantize(Math.Sqrt(coverSquared));
            output[offset + 2] = Quantize(risk);
        }
        return count * 3;
    }
}
