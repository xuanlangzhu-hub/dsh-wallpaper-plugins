using System.Text.Json;

/// <summary>
/// The capture command line, parsed once and shared by the executable and the checks.
///
/// This exists because the position of the duration token depends on which optional flags are
/// present: removing `--forever` in place used to shift the capture mode into the fps slot, so
/// the exact argv the Host produces for daily playback was rejected with the usage error.
/// Parsing resolves the options first and then validates the remaining positional tokens by
/// role, and the packaged-argument check calls this same type.
/// </summary>
internal static class CaptureArguments
{
    public const string Usage =
        "Usage: WallpaperProbe <HWND> <output-directory> <seconds 1..1800|--forever> <fps 1..30> [disk|memory|readback|staging|frames|pipe]";

    private static readonly string[] CaptureModes = ["disk", "memory", "readback", "staging", "frames", "pipe"];
    /** Option flags the caller may put anywhere; they are not positional roles. */
    private static readonly string[] OptionFlags = ["--echo-on-stderr"];

    internal sealed record Parsed(
        long Handle,
        string OutputDirectory,
        bool Forever,
        int Duration,
        int Fps,
        string CaptureMode,
        string? OwnedLocation,
        bool EchoMode,
        string[] Args);

    public static Parsed Parse(string[] rawArgs)
    {
        // Unknown flags stay in the list on purpose: they must be reported instead of being
        // silently ignored, so a typo cannot look like a working run.
        var echoMode = rawArgs.Contains("--echo-on-stderr");
        var tokens = new List<string>(rawArgs.Where(token => !OptionFlags.Contains(token)));
        string? ownedLocation = null;
        var ownedIndex = tokens.IndexOf("--owned-location");
        if (ownedIndex >= 0)
        {
            if (ownedIndex + 1 >= tokens.Count) throw new ArgumentException("--owned-location requires a window name.");
            ownedLocation = SourceWindowHelper.RequireProbeLocation(tokens[ownedIndex + 1]);
            tokens.RemoveRange(ownedIndex, 2);
        }

        // Daily playback keeps the flag in the duration slot: the Host sends
        // `[HWND, output, --forever, fps, pipe]`. A duration next to the flag is ambiguous.
        var foreverIndex = tokens.IndexOf("--forever");
        var forever = foreverIndex >= 0;
        if (forever && (foreverIndex != 2 || tokens.Count < 4))
            throw new ArgumentException("--forever occupies the duration slot; do not pass a duration as well.");

        // The positional roles are read from the token list in its canonical shape, where the
        // duration slot is always present: a preview carries seconds there, daily carries the
        // flag. Reading roles from a shortened list is what pushed `pipe` into the fps slot.
        if (tokens.Count is < 4 or > 5) throw new ArgumentException(Usage);
        if (!long.TryParse(tokens[0], out var handle)) throw new ArgumentException(Usage);

        var duration = int.MaxValue;
        if (!forever && (!int.TryParse(tokens[2], out duration) || duration < 1 || duration > 1800))
            throw new ArgumentException(Usage + " (duration)");
        if (!int.TryParse(tokens[3], out var fps) || fps < 1 || fps > 30)
            throw new ArgumentException(Usage + " (fps)");
        var captureMode = tokens.Count == 5 ? tokens[4] : "disk";
        if (!CaptureModes.Contains(captureMode)) throw new ArgumentException($"Unknown capture mode '{captureMode}'.");

        // An unlimited run must stay bound to its parent and to this round's window: without the
        // command pipe there is no stop channel, and without the owned round name a parent loss
        // could not close the captured window. The bounded QA forms keep working with either the
        // in-process stop paths or a plain capture.
        if (forever && captureMode != "pipe") throw new ArgumentException("Daily (--forever) playback requires the pipe capture mode.");
        if (forever && ownedLocation is null) throw new ArgumentException("Daily (--forever) playback requires --owned-location <this round's window name>.");

        var positional = new List<string>(tokens);
        if (forever) positional.RemoveAt(2);
        return new Parsed(handle, tokens[1], forever, duration, fps, captureMode, ownedLocation, echoMode, positional.ToArray());
    }

    /// <summary>Runs the parser over an argument array and prints the result; used by checks.</summary>
    public static async Task ParseCheck(string path)
    {
        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        try
        {
            var argv = JsonSerializer.Deserialize<string[]>(await File.ReadAllTextAsync(path)) ?? [];
            var parsed = Parse(argv);
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                ok = true,
                handle = parsed.Handle,
                outputDirectory = parsed.OutputDirectory,
                forever = parsed.Forever,
                durationSeconds = parsed.Forever ? (int?)null : parsed.Duration,
                fps = parsed.Fps,
                captureMode = parsed.CaptureMode,
                ownedLocation = parsed.OwnedLocation,
                echoMode = parsed.EchoMode,
            }, options));
        }
        catch (Exception error)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { ok = false, error = error.GetType().Name, message = error.Message }, options));
            Environment.ExitCode = 1;
        }
    }
}
