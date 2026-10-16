using System.Diagnostics;
using System.Globalization;
using System.Text.Json;

/// <summary>The real QA lifecycle, with window/report seams for offline regression checks.</summary>
public sealed class TaskbarQaRuntime
{
    public sealed record CloseOutcome(string Outcome, bool Closed, long WaitedMs, string? Error);
    private readonly object _lifecycleSync = new();
    private readonly object _writeSync = new();
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private readonly TaskbarHideStrategy _strategy;
    private readonly string _reportPath;
    private readonly Func<CloseOutcome> _close;
    private readonly Action<TaskbarActionRecord> _write;
    private readonly Action<string> _diagnostic;
    private Func<bool> _stopRequested = () => false;
    private bool _ownsSource, _finished, _reportFailed, _stopping;

    private TaskbarQaRuntime(TaskbarQaOptions.Result options, IWindowProbe probe, string location,
        string reportPath, Func<CloseOutcome> close, Action<TaskbarActionRecord> write,
        Action<string> diagnostic, Func<double>? runtimeClockSeconds = null)
    {
        _reportPath = reportPath;
        _close = close;
        _write = write;
        _diagnostic = diagnostic;
        _strategy = new(options, probe, runtimeClockSeconds ?? (() => _clock.Elapsed.TotalSeconds), TryWrite, location)
        {
            ExternalStopRequested = () => Volatile.Read(ref _stopping) || _stopRequested(),
        };
        _strategy.CaptureInitialState();
    }

    public TaskbarHideStrategy Strategy => _strategy;
    public bool ReportFailed { get { lock (_writeSync) return _reportFailed; } }
    public bool IsActionPending => _strategy.IsActionPending;
    public bool IsStopRequested => StopRequested();
    public int SettleTimeoutMs { get; set; } = 10_000;

    public static TaskbarQaRuntime Create(TaskbarQaOptions.Result options, string[] args, CaptureArguments.Parsed parsed)
    {
        var location = parsed.OwnedLocation ?? throw new ArgumentException("QA requires owned-location");
        TaskbarQaOptions.RequireIdentity(options, location);
        Directory.CreateDirectory(parsed.OutputDirectory);
        var path = Path.Combine(parsed.OutputDirectory, "taskbar-action.json");
        // Reserve this exact evidence file once; never accept or overwrite a previous run's report.
        using (new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read)) { }
        var runtime = new TaskbarQaRuntime(options,
            new RealWindowProbe(location, options.Pid!.Value, options.Start!.Value), location, path,
            () =>
            {
                var result = SourceWindowHelper.EnsureProbeWindowClosed(location, 15000, (uint)options.Pid.Value);
                return new(result.Outcome, result.Closed, result.WaitedMs, result.Error);
            }, record => WriteFile(path, record), message => ProbeJournal.Error("TaskbarQa", "evidence", message));
        runtime._strategy.Execute = hwnd => Execution.FromWorker(TaskbarList.RunWorker(
            new(Environment.ProcessPath ?? throw new InvalidOperationException("worker executable missing"),
                hwnd, checked((int)options.Pid.Value), options.Start.Value.ToString("O"), location, 30_000,
                Path.Combine(Path.GetFullPath(parsed.OutputDirectory), "stop.txt")),
            runtime.StopRequested,
            runtime._strategy.NotifyWorkerStarted));
        runtime.TakeOwnership();
        return runtime;
    }

    // Uses the identical runtime and strategy; only the native close, window probe and file sink vary.
    internal static TaskbarQaRuntime CreateOffline(TaskbarQaOptions.Result options, IWindowProbe probe,
        string location, string reportPath, Func<CloseOutcome> close, Action<TaskbarActionRecord> write,
        bool takeOwnership = true, Func<double>? runtimeClockSeconds = null)
    {
        var runtime = new TaskbarQaRuntime(options, probe, location, reportPath, close, write, _ => { }, runtimeClockSeconds);
        if (takeOwnership) runtime.TakeOwnership();
        return runtime;
    }

    public static void WriteFile(string path, TaskbarActionRecord record)
    {
        using var stream = new FileStream(path, FileMode.Truncate, FileAccess.Write, FileShare.Read);
        using var writer = new StreamWriter(stream);
        writer.Write(TaskbarHideStrategy.Serialize(record));
    }

    private void TryWrite(TaskbarActionRecord record)
    {
        lock (_writeSync)
        {
            try { _write(record); }
            catch (Exception error)
            {
                _reportFailed = true;
                Environment.ExitCode = 1;
                // Failure reporting must not prevent necessary window cleanup.
                try { _diagnostic($"report-write-failed: {_reportPath}: {error.GetType().Name}: {error.Message}"); }
                catch { }
            }
        }
    }

    public void BindStop(Func<bool> stopRequested) => _stopRequested = stopRequested;
    public void RequestStop()
    {
        Volatile.Write(ref _stopping, true);
        _strategy.RequestStop();
    }
    private bool StopRequested() => _strategy.IsStopRequested;
    public void TakeOwnership() => _ownsSource = true;

    public StrategyDecision AfterFrame(long sequence, double seconds, string? hash, long capturedAt,
        double sourceTimestampMs, bool published, bool stopRequested)
    {
        if (hash is null) return new StrategyDecision("skipped", "no encoded frame yet");
        return _strategy.OnFrameAsync(new(sequence, seconds, true, hash, sourceTimestampMs, published, stopRequested || StopRequested(), capturedAt));
    }

    public StrategyDecision SettlePendingAction(int? timeoutMs = null, bool requestStop = false) =>
        _strategy.SettlePending(timeoutMs ?? SettleTimeoutMs, requestStop);

    /// <summary>Called once by the OUTERMOST generated finally, including initialization failures.</summary>
    public void Finish()
    {
        lock (_lifecycleSync)
        {
            if (_finished) return;
            _finished = true;
            Volatile.Write(ref _stopping, true);
        }
        // Any in-flight worker must receive stop propagation and settle within the bounded deadline
        // before cleanup is allowed to inspect or close the source window.
        _strategy.SettlePending(SettleTimeoutMs, requestStop: true);
        if (!_ownsSource)
        {
            _strategy.RecordCleanup(new { outcome = "not-owned", closed = (bool?)null });
            WriteReport();
            return;
        }
        var (allowed, why) = _strategy.CanCloseOwned();
        if (!allowed)
        {
            Environment.ExitCode = 1;
            _strategy.RecordCleanup(new { outcome = "not-confirmed", closed = false, error = why });
        }
        else if (why == "target-already-gone")
        {
            // No close-by-name call after a missing observation: a new same-name window may appear.
            _strategy.RecordCleanup(new { outcome = "already-gone", closed = true });
        }
        else
        {
            try
            {
                var result = _close();
                if (!result.Closed) Environment.ExitCode = 1;
                _strategy.RecordCleanup(new { outcome = result.Outcome, closed = result.Closed,
                    waitedMs = result.WaitedMs, error = result.Error });
            }
            catch (Exception error)
            {
                Environment.ExitCode = 1;
                _strategy.RecordCleanup(new { outcome = "error", closed = false, error = error.Message });
            }
        }
        WriteReport();
    }

    public void WriteReport()
    {
        _strategy.Write(_strategy.Stage);
        if (ReportFailed) Environment.ExitCode = 1;
    }

    public static int RunWorkerEntry(string[] args)
    {
        // Bad worker argv must not access desktop or index past the argument array.
        return TaskbarList.RunWorkerEntry(args, () =>
        {
            try
            {
                var probe = new RealWindowProbe(args[4], int.Parse(args[2], CultureInfo.InvariantCulture),
                    DateTimeOffset.Parse(args[3], CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal));
                var snapshot = probe.Inspect(long.Parse(args[1], CultureInfo.InvariantCulture));
                if (!snapshot.Exists) return (false, "target-closed");
                if (!snapshot.Visible || snapshot.Iconic || snapshot.Cloaked)
                    return (false, "target-not-visible-or-minimized-or-cloaked");
                return (true, "identity-ok");
            }
            catch (Exception error) { return (false, error.Message); }
        }, () => File.Exists(args[5]) || (Native.GetAsyncKeyState(0x1B) & 0x8000) != 0, Console.WriteLine);
    }
}
