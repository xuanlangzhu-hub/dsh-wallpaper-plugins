using System.Globalization;

/// <summary>
/// QA-only command-line surface for the taskbar button experiment.
///
/// The accepted capture source keeps its own parser (<see cref="CaptureArguments"/>); this type only
/// removes its OWN flags, validates them strictly, and hands the remaining argv to the capture parser
/// untouched. Unknown, repeated, contradictory or incomplete QA options are refused here, so a typo
/// can never silently change a positional capture argument.
///
/// When no QA flag is present <see cref="Extract"/> returns an unarmed result and the capture behaves
/// exactly as the accepted build does.
/// </summary>
public static class TaskbarQaOptions
{
    public const string Enable = "--taskbar-qa";
    public const string Hwnd = "--taskbar-hwnd";
    public const string Pid = "--taskbar-pid";
    public const string Start = "--taskbar-start";
    public const string ActionOut = "--taskbar-action-out";
    public const string DurationSeconds = "--taskbar-duration";
    public const string MinSeconds = "--taskbar-min-seconds";

    /// <summary>
    /// QA flags that exist only to be refused: this round never adds a button back and never touches an
    /// activation slot. They are refused with or without the enable flag.
    /// </summary>
    private static readonly string[] Forbidden = ["--taskbar-add-tab", "--taskbar-activate", "--taskbar-set-active-alt"];

    private static readonly string[] Known =
        [Enable, Hwnd, Pid, Start, ActionOut, DurationSeconds, MinSeconds];

    public const int DefaultDurationSeconds = 25;
    public const int MaxDurationSeconds = 60;
    public const int DefaultMinSeconds = 5;
    public const int MinMinSeconds = 1;
    public const int MaxMinSeconds = 30;

    public sealed record Result(
        bool Enabled,
        string[] Remaining,
        long? Hwnd,
        int? Pid,
        DateTimeOffset? Start,
        string? ActionOut,
        int DurationSeconds,
        int MinSeconds)
    {
        public static implicit operator TaskbarHideOptions(Result r) =>
            new(r.Enabled, r.Hwnd, r.Pid, r.Start, r.MinSeconds, r.DurationSeconds);
    }

    private static ArgumentException Refuse(string message) => new($"taskbar QA: {message}");

    /// <summary>
    /// Remove and validate the QA flags. Every flag may appear at most once; a value-taking flag must
    /// be followed by a value that is not another flag.
    /// </summary>
    public static Result Extract(string[] rawArgs)
    {
        var seen = new Dictionary<string, string>(StringComparer.Ordinal);
        var remaining = new List<string>();
        for (var index = 0; index < rawArgs.Length; index++)
        {
            var token = rawArgs[index];
            if (Forbidden.Contains(token, StringComparer.Ordinal))
                throw Refuse($"{token} is not part of this round's experiment");
            // --forever is a legitimate accepted capture argument; only the QA experiment refuses it,
            // because a QA run must be bounded. Without the enable flag it is passed through untouched.
            if (token == "--forever" && rawArgs.Contains(Enable, StringComparer.Ordinal))
                throw Refuse("a bounded QA run cannot use --forever");
            if (!Known.Contains(token, StringComparer.Ordinal))
            {
                // A value that looks like one of our flags but is not known is still ours to refuse.
                if (token.StartsWith("--taskbar-", StringComparison.Ordinal))
                    throw Refuse($"unknown option {token}");
                remaining.Add(token);
                continue;
            }
            if (token == Enable)
            {
                if (seen.ContainsKey(token)) throw Refuse($"{token} was given more than once");
                seen[token] = string.Empty;
                continue;
            }
            if (index + 1 >= rawArgs.Length) throw Refuse($"{token} requires a value");
            var value = rawArgs[index + 1];
            if (value.StartsWith("--", StringComparison.Ordinal)) throw Refuse($"{token} requires a value, got {value}");
            if (seen.ContainsKey(token)) throw Refuse($"{token} was given more than once");
            seen[token] = value;
            index++;
        }

        if (!seen.ContainsKey(Enable))
        {
            // No QA flag at all: any other taskbar flag would be an experiment that is not enabled.
            if (seen.Count > 0)
                throw Refuse($"taskbar options require {Enable}");
            return new Result(false, [.. remaining], null, null, null, null, DefaultDurationSeconds, DefaultMinSeconds);
        }

        var hwnd = ParsePositiveLong(seen, Hwnd);
        var pid = ParsePositiveInt(seen, Pid);
        var start = ParseStart(seen);
        var actionOut = seen.TryGetValue(ActionOut, out var rawOut) ? rawOut.Trim() : null;
        if (actionOut is not null && (actionOut.Length == 0 || actionOut.Length > 400))
            throw Refuse($"{ActionOut} must be a bounded file path");

        var duration = DefaultDurationSeconds;
        if (seen.TryGetValue(DurationSeconds, out var rawDuration))
        {
            if (!int.TryParse(rawDuration, NumberStyles.Integer, CultureInfo.InvariantCulture, out duration) ||
                duration < 1 || duration > MaxDurationSeconds)
                throw Refuse($"{DurationSeconds} must be an integer between 1 and {MaxDurationSeconds}");
        }
        var minSeconds = DefaultMinSeconds;
        if (seen.TryGetValue(MinSeconds, out var rawMin))
        {
            if (!int.TryParse(rawMin, NumberStyles.Integer, CultureInfo.InvariantCulture, out minSeconds) ||
                minSeconds < MinMinSeconds || minSeconds > MaxMinSeconds)
                throw Refuse($"{MinSeconds} must be an integer between {MinMinSeconds} and {MaxMinSeconds}");
        }
        if (minSeconds >= duration)
            throw Refuse($"{MinSeconds} ({minSeconds}) must be smaller than the total duration ({duration}) so frames follow the action");

        // A QA run triggers on an encoded JPEG, so a mode that produces none is refused here as well
        // as in the cross-check: the parser is not allowed to accept an experiment it cannot run.
        var mode = remaining.Count > 0 ? remaining[^1] : null;
        if (mode is "frames" or "readback" or "staging")
            throw Refuse($"capture mode '{mode}' does not produce the JPEG frames the experiment triggers on");

        return new Result(true, [.. remaining], hwnd, pid, start, actionOut, duration, minSeconds);
    }

    private static long? ParsePositiveLong(Dictionary<string, string> seen, string flag)
    {
        if (!seen.TryGetValue(flag, out var raw)) return null;
        if (!long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) || value <= 0)
            throw Refuse($"{flag} must be a positive integer (decimal HWND), got '{raw}'");
        return value;
    }

    private static int? ParsePositiveInt(Dictionary<string, string> seen, string flag)
    {
        if (!seen.TryGetValue(flag, out var raw)) return null;
        if (!int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) || value <= 0)
            throw Refuse($"{flag} must be a positive integer (decimal PID), got '{raw}'");
        return value;
    }

    private static DateTimeOffset? ParseStart(Dictionary<string, string> seen)
    {
        if (!seen.TryGetValue(Start, out var raw)) return null;
        if (!DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture,
                DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var value))
            throw Refuse($"{Start} must be an ISO-8601 timestamp, got '{raw}'");
        return value.ToUniversalTime();
    }


    /// <summary>
    /// Cross-validate the QA surface against the request the capture will actually run.
    ///
    /// <paramref name="parsed"/> MUST be the accepted <see cref="CaptureArguments.Parse"/> result for
    /// <see cref="Result.Remaining"/>: the experiment and the capture have to agree about the window,
    /// the mode and the duration, and a disagreement is refused instead of reported. This runs before
    /// any window, desktop or COM boundary is created.
    /// </summary>
    public static void RequireMatchesCapture(Result options, CaptureArguments.Parsed parsed)
    {
        if (!options.Enabled) return;

        // The action and the capture must target the SAME window. A mismatch would let the experiment
        // delete the button of a window that is not the one being captured.
        if (options.Hwnd != parsed.Handle)
            throw Refuse($"--taskbar-hwnd ({options.Hwnd}) must equal the capture HWND ({parsed.Handle})");

        // The mode must produce JPEG frames: the trigger is "a real encoded frame was published".
        if (parsed.CaptureMode is not ("memory" or "pipe"))
            throw Refuse($"capture mode '{parsed.CaptureMode}' does not produce the JPEG frames the experiment triggers on");
        if (parsed.Forever)
            throw Refuse("a bounded QA run cannot use --forever");

        // One duration is authoritative: the capture's own. The QA field only has to agree with it.
        var actualSeconds = parsed.Duration;
        if (actualSeconds > MaxDurationSeconds)
            throw Refuse($"the capture duration ({actualSeconds}s) exceeds the QA maximum of {MaxDurationSeconds}s");
        if (options.DurationSeconds != actualSeconds)
            throw Refuse($"--taskbar-duration ({options.DurationSeconds}s) must equal the capture duration ({actualSeconds}s); the capture value is authoritative");
        if (options.MinSeconds < DefaultMinSeconds)
            throw Refuse($"--taskbar-min-seconds must be at least {DefaultMinSeconds}s so a normal baseline exists before the action");
        if (options.MinSeconds >= actualSeconds)
            throw Refuse($"--taskbar-min-seconds ({options.MinSeconds}s) must be smaller than the capture duration ({actualSeconds}s)");

        // The report belongs in this round's own fresh output directory.
        if (!string.IsNullOrEmpty(options.ActionOut) &&
            !string.Equals(options.ActionOut, parsed.OutputDirectory, StringComparison.OrdinalIgnoreCase))
            throw Refuse("--taskbar-action-out must be the capture output directory; the report is written inside it");
    }

    /// <summary>
    /// A QA run needs the full identity: HWND, PID, process StartTime and this round's own window name.
    /// A title prefix alone is never enough, so a missing piece refuses the run instead of weakening it.
    /// </summary>
    public static void RequireIdentity(Result options, string? ownedLocation)
    {
        if (options.Hwnd is null) throw Refuse($"{Hwnd} is required");
        if (options.Pid is null) throw Refuse($"{Pid} is required");
        if (options.Start is null) throw Refuse($"{Start} is required");
        if (string.IsNullOrWhiteSpace(ownedLocation)) throw Refuse("--owned-location (this round's window name) is required");
    }

    /// <summary>Self-check for the option surface; runs before any desktop or COM initialisation.</summary>
    public static void SelfTest(Action<string, bool, string?> report)
    {
        void Check(string name, bool ok, string? detail = null) => report(name, ok, ok ? null : detail);

        var good = Extract(["--taskbar-qa", "--taskbar-hwnd", "1234", "--taskbar-pid", "4321",
            "--taskbar-start", "2026-10-12T10:00:00Z", "1234", "C:\\tmp\\out", "20", "30", "memory",
            "--owned-location", "WhaleWallpaperProbe-taskbar-qa"]);
        Check("options accept a complete bounded QA run", good.Enabled && good.Hwnd == 1234 && good.Pid == 4321 &&
            good.DurationSeconds == 25 && good.MinSeconds == 5 && good.Remaining.Contains("memory"), string.Join(' ', good.Remaining));

        var plain = Extract(["1234", "C:\\tmp\\out", "20", "30", "memory"]);
        Check("options with no flag leave the capture untouched", !plain.Enabled && plain.Remaining.Length == 5);

        Check("options refuse a QA flag without the enable flag", Throws(() => Extract(["--taskbar-hwnd", "1"])), null);
        Check("options refuse an unknown taskbar option", Throws(() => Extract(["--taskbar-qa", "--taskbar-magic"])), null);
        Check("options refuse a repeated option",
            Throws(() => Extract(["--taskbar-qa", "--taskbar-hwnd", "1", "--taskbar-hwnd", "2"])), null);
        Check("options refuse a missing value", Throws(() => Extract(["--taskbar-qa", "--taskbar-hwnd"])), null);
        Check("options refuse a value that is another flag",
            Throws(() => Extract(["--taskbar-qa", "--taskbar-hwnd", "--taskbar-pid"])), null);
        Check("options refuse --forever", Throws(() => Extract(["--taskbar-qa", "1", "o", "--forever", "30", "pipe"])), null);
        Check("options refuse a mode that encodes no JPEG",
            Throws(() => Extract(["--taskbar-qa", "1", "o", "20", "30", "frames"])), null);
        Check("options refuse an out-of-range duration",
            Throws(() => Extract(["--taskbar-qa", "--taskbar-duration", "61", "1", "o", "20", "30", "memory"])), null);
        Check("options refuse a min-seconds that leaves no room for frames",
            Throws(() => Extract(["--taskbar-qa", "--taskbar-min-seconds", "30", "--taskbar-duration", "30", "1", "o", "20", "30", "memory"])), null);
        Check("options refuse a non-ISO start time",
            Throws(() => Extract(["--taskbar-qa", "--taskbar-start", "yesterday", "1", "o", "20", "30", "memory"])), null);
        Check("options refuse add-tab",
            Throws(() => Extract(["--taskbar-qa", "--taskbar-add-tab", "1", "o", "20", "30", "memory"])), null);
        Check("options require the full identity", Throws(() =>
        {
            var partial = Extract(["--taskbar-qa", "--taskbar-hwnd", "1", "--taskbar-pid", "2", "--taskbar-start", "2026-10-12T10:00:00Z", "1", "o", "20", "30", "memory"]);
            RequireIdentity(partial, null);
        }), null);
    }

    private static bool Throws(Action action)
    {
        try { action(); return false; }
        catch (ArgumentException) { return true; }
    }

    /// <summary>
    /// The exact-title lookup this QA tool uses. It lives in the companion accessor class, so the
    /// accepted helper is never edited; the matching rule itself is the accepted one (exact title,
    /// never a prefix).
    /// </summary>
    public static List<WindowState> FindExactTitle(string location) => SourceWindowHelperQa.FindExactTitle(location);
}
