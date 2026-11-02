using System.Diagnostics;
using System.Globalization;
using System.Text.Json;

/// <summary>Bounded diagnostic observations only. Never a source/worker cleanup authorization.</summary>
public sealed class TaskbarTiming
{
    public sealed record Point(string Stage, double? ElapsedMs, string? Utc);
    public sealed record Snapshot(string Purpose, string Role, string ClockId, string OriginTimestamp,
        long Frequency, string? OriginUtc, long TargetHwnd, int TargetPid, string TargetStartUtc,
        string Location, Point[] Events, bool Truncated, bool ClockInvalid);

    private readonly object _sync = new();
    private readonly List<Point> _events = [];
    private readonly Func<long> _clock;
    private readonly Func<DateTimeOffset> _utc;
    private readonly Action<string> _write;
    private readonly long _origin, _frequency;
    private readonly string _role, _location, _targetStartUtc;
    private readonly long _targetHwnd;
    private readonly int _targetPid;
    private readonly string? _originUtc;
    private long _previous;
    private bool _clockInvalid, _truncated, _writeAllowed, _saved;
    public const int Capacity = 64;

    // Injectable clock and sink are the lowest IO boundary in offline checks.
    public TaskbarTiming(string role, long hwnd, int pid, string startUtc, string location,
        Action<string> write, bool writeAllowed = false, Func<long>? clock = null,
        long? frequency = null, Func<DateTimeOffset>? utc = null)
    {
        _role = role; _targetHwnd = hwnd; _targetPid = pid;
        _targetStartUtc = startUtc; _location = location;
        _write = write; _writeAllowed = writeAllowed;
        _clock = clock ?? Stopwatch.GetTimestamp; _frequency = frequency ?? Stopwatch.Frequency;
        _utc = utc ?? (() => DateTimeOffset.UtcNow);
        try { _origin = _previous = _clock(); } catch { _clockInvalid = true; }
        if (_frequency <= 0) _clockInvalid = true;
        _originUtc = Utc();
    }

    private string? Utc() { try { return _utc().ToString("O"); } catch { return null; } }

    public void Mark(string stage)
    {
        // Exceptions from diagnostics must never bypass identity, stop, COM, or worker supervision.
        try
        {
            lock (_sync)
            {
                if (_saved) return;
                if (_events.Count >= Capacity) { _truncated = true; return; }
                double? elapsed = null;
                try
                {
                    long stamp = _clock();
                    if (stamp < _previous || stamp < _origin) _clockInvalid = true;
                    _previous = stamp;
                    if (!_clockInvalid) elapsed = checked(stamp - _origin) * (1000.0 / _frequency);
                }
                catch { _clockInvalid = true; }
                _events.Add(new Point(stage, elapsed, Utc()));
            }
        }
        catch { /* diagnostic only */ }
    }

    // Called only after the pre-existing worker supervision gate has succeeded.
    public void AllowWrite() { lock (_sync) _writeAllowed = true; }

    public Snapshot Inspect()
    {
        lock (_sync) return new("taskbar-stage-timing-not-termination-proof", _role,
            $"{_role}-pid-{Environment.ProcessId}", _origin.ToString(CultureInfo.InvariantCulture),
            _frequency, _originUtc, _targetHwnd, _targetPid, _targetStartUtc, _location,
            [.. _events], _truncated, _clockInvalid);
    }

    public bool Save()
    {
        try
        {
            Snapshot snapshot;
            lock (_sync)
            {
                if (!_writeAllowed || _saved) return false;
                _saved = true;
                snapshot = Inspect();
            }
            _write(JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
            return true;
        }
        catch { return false; } // Missing/partial files remain unknown and are never cleanup proof.
    }

    private static Action<string> NewFile(string path) => json =>
    {
        // No directory creation, replacement, retries, or stdout writes.
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read);
        using var writer = new StreamWriter(stream);
        writer.Write(json);
    };

    public static TaskbarTiming? ForParent(string directory, long hwnd, int pid, DateTimeOffset startUtc, string location)
    {
        try { return new("capture-parent", hwnd, pid, startUtc.ToString("O"), location,
            NewFile(Path.Combine(Path.GetFullPath(directory), "taskbar-parent-timing.json")), writeAllowed: true); }
        catch { return null; }
    }

    public static TaskbarTiming? ForWorker(string[] args)
    {
        try
        {
            if (args.Length != 6 || args[0] != "--taskbar-worker" || !Path.IsPathFullyQualified(args[5])
                || Path.GetFileName(args[5]) != "stop.txt") return null;
            if (!long.TryParse(args[1], out var hwnd) || hwnd <= 0 || !int.TryParse(args[2], out var pid) || pid <= 0
                || !DateTimeOffset.TryParse(args[3], CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _)) return null;
            return new("shell-worker", hwnd, pid, args[3], args[4],
                NewFile(Path.Combine(Path.GetDirectoryName(args[5])!, "taskbar-worker-timing.json")));
        }
        catch { return null; }
    }
}
