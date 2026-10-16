using System.Diagnostics;
using System.Globalization;
using System.Text.Json;

/// <summary>
/// Production runtime for C1 taskbar hide integration.
/// Wires TaskbarHideStrategy into WallpaperProbe without any QA-only timeouts (no 60s cap)
/// or global keyboard hooks (no Esc key polling).
/// </summary>
public sealed class TaskbarHideRuntime
{
    private readonly object _lifecycleSync = new();
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private readonly TaskbarHideStrategy _strategy;
    private readonly string _outputDirectory;
    private readonly string _reportPath;
    private readonly string _location;
    private Func<bool> _stopRequested = () => false;
    private bool _stopping;
    private bool _finished;
    private string? _warningMessage;

    public TaskbarHideStrategy Strategy => _strategy;
    public bool IsActionPending => _strategy.IsActionPending;
    public int SettleTimeoutMs { get; set; } = 10_000;

    private TaskbarHideRuntime(
        TaskbarHideOptions options,
        IWindowProbe probe,
        string location,
        string outputDirectory,
        Func<double>? runtimeClockSeconds = null)
    {
        _location = location;
        _outputDirectory = outputDirectory;
        _reportPath = Path.Combine(outputDirectory, "taskbar-action.json");
        _strategy = new TaskbarHideStrategy(
            options,
            probe,
            runtimeClockSeconds ?? (() => _clock.Elapsed.TotalSeconds),
            WriteReportFile,
            location)
        {
            ExternalStopRequested = () => Volatile.Read(ref _stopping) || _stopRequested(),
        };
    }

    public static TaskbarHideRuntime Create(
        long hwnd,
        int pid,
        DateTimeOffset startUtc,
        string location,
        string outputDirectory,
        Func<ITaskbarWorkerProcess>? workerFactory = null)
    {
        var options = new TaskbarHideOptions(
            Enabled: true,
            Hwnd: hwnd,
            Pid: pid,
            Start: startUtc,
            MinSeconds: 10);

        var probe = new RealWindowProbe(location, pid, startUtc);
        var runtime = new TaskbarHideRuntime(options, probe, location, outputDirectory);

        var stopFile = Path.Combine(Path.GetFullPath(outputDirectory), "stop.txt");
        runtime._strategy.Execute = targetHwnd =>
        {
            var request = new TaskbarList.WorkerRequest(
                Environment.ProcessPath ?? throw new InvalidOperationException("process executable missing"),
                targetHwnd,
                pid,
                startUtc.ToString("O"),
                location,
                30_000,
                stopFile);

            var outcome = TaskbarWorker.Run(
                request,
                runtime.StopRequested,
                factory: workerFactory,
                onStarted: runtime._strategy.NotifyWorkerStarted);

            if (!outcome.CleanupSafe)
            {
                runtime._warningMessage = $"Worker exit could not be confirmed: {outcome.Error ?? "unknown"}";
            }
            else if (!outcome.Trace.Result.Succeeded)
            {
                runtime._warningMessage = $"Taskbar hide failed ({outcome.Trace.Result.Call}): {outcome.Trace.Result.Error ?? $"HRESULT 0x{outcome.Trace.Result.Hresult:X8}"}";
            }

            return Execution.FromWorker(outcome);
        };

        return runtime;
    }

    public void BindStop(Func<bool> stopRequested) => _stopRequested = stopRequested;
    private bool StopRequested() => Volatile.Read(ref _stopping) || _stopRequested();

    public void CaptureInitialState() => _strategy.CaptureInitialState();

    public StrategyDecision AfterFrame(
        long sequence,
        double seconds,
        string? hash,
        long capturedAt,
        double sourceTimestampMs,
        bool published,
        bool stopRequested)
    {
        if (hash is null) return new StrategyDecision("skipped", "no encoded frame yet");
        return _strategy.OnFrameAsync(new FrameObservation(
            sequence,
            seconds,
            Encoded: true,
            hash,
            sourceTimestampMs,
            Published: published,
            StopRequested: stopRequested || StopRequested(),
            CapturedAtUnixMs: capturedAt));
    }

    public StrategyDecision SettlePending(int? timeoutMs = null, bool requestStop = false)
    {
        if (requestStop) Volatile.Write(ref _stopping, true);
        return _strategy.SettlePending(timeoutMs ?? SettleTimeoutMs, requestStop);
    }

    public (bool Allowed, string? Why) CanCloseOwned() => _strategy.CanCloseOwned();

    public void Finish()
    {
        lock (_lifecycleSync)
        {
            if (_finished) return;
            _finished = true;
            Volatile.Write(ref _stopping, true);
        }
        _strategy.SettlePending(SettleTimeoutMs, requestStop: true);
        _strategy.Write(_strategy.Stage);
    }

    private void WriteReportFile(TaskbarActionRecord record)
    {
        try
        {
            var json = TaskbarHideStrategy.Serialize(record);
            File.WriteAllText(_reportPath, json);
        }
        catch { /* best effort evidence */ }
    }

    public object GetStatus()
    {
        // This runs on the capture loop every second. Window/process enumeration belongs to action
        // verification and final cleanup, never to the periodic progress heartbeat.
        var workerCleanupSafe = _strategy.WorkerCleanupSafe;
        return new
        {
            stage = _strategy.Stage,
            attempted = _strategy.Attempted,
            isPending = _strategy.IsActionPending,
            // A periodic status is not permission to close a source. GetSummary rechecks its identity.
            cleanupSafe = workerCleanupSafe ? (bool?)null : false,
            workerCleanupSafe,
            warning = _warningMessage,
            framesWhilePending = _strategy.FramesWhilePending,
        };
    }

    public object GetSummary()
    {
        var (allowed, _) = _strategy.CanCloseOwned();
        return new
        {
            stage = _strategy.Stage,
            attempted = _strategy.Attempted,
            cleanupSafe = allowed,
            warning = _warningMessage,
        };
    }

    public bool HasWarning(out string? warning)
    {
        warning = _warningMessage;
        return _warningMessage is not null;
    }

    public static int RunWorkerEntry(string[] args)
    {
        return TaskbarList.RunWorkerEntry(args, () =>
        {
            try
            {
                if (args.Length < 5) return (false, "insufficient arguments");
                var probe = new RealWindowProbe(args[4], int.Parse(args[2], CultureInfo.InvariantCulture),
                    DateTimeOffset.Parse(args[3], CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal));
                var snapshot = probe.Inspect(long.Parse(args[1], CultureInfo.InvariantCulture));
                if (!snapshot.Exists) return (false, "target-closed");
                if (!snapshot.Visible || snapshot.Iconic || snapshot.Cloaked)
                    return (false, "target-not-visible-or-minimized-or-cloaked");
                return (true, "identity-ok");
            }
            catch (Exception error) { return (false, error.Message); }
        }, () => File.Exists(args[5]), Console.WriteLine);
    }
}
