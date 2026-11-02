using System.Text.Json;
using System.Text.Json.Serialization;

namespace JogoManager.Engine.Core.Contracts;

/// <summary>JSON.stringify writes either signed zero as 0. Preserve the sign
/// during arithmetic/read, but use the same wire convention on serialization.
/// This is a transport rule, not a tolerance or rounding of nonzero values.</summary>
public sealed class JavaScriptJsonNumberConverter : JsonConverter<double>
{
    public override double Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) => reader.GetDouble();
    public override void Write(Utf8JsonWriter writer, double value, JsonSerializerOptions options)
    {
        if (value == 0) writer.WriteNumberValue(0);
        else writer.WriteNumberValue(value);
    }
}
