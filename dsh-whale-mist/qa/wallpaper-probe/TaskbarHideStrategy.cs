using System.Diagnostics;
using System.Text.Json;

/// <summary>
/// One observed frame, reduced to what the trigger needs. <see cref="Encoded"/> is true only after an
/// actual JPEG was encoded and its bytes were packed: a started session or a "capture started" log
/// line never counts as a frame.
/// </summary>
public sealed record FrameObservation(
    long Sequence,
    double ElapsedSeconds,
    bool Encoded,
    string? Hash,
    double SourceTimestampMs,
    bool Published = true,
    bool StopRequested = false,
    long? CapturedAtUnixMs = null);

/// <summary>What the strategy decided for one frame.</summary>
public sealed record StrategyDecision(string Kind, string? Detail = null);

/// <summary>
/// One Shell call's execution facts. <see cref="TimedOut"/> separates "we stopped waiting" from
/// "the action stopped", and <see cref="CleanupSafe"/> is the only thing that lets the caller close
/// the source window: it is true when the call ran in a worker that is proven gone (or when no worker
/// was involved at all).
/// </summary>
public sealed record Execution(
    TaskbarList.Result Result,
    TaskbarList.Result? HrInit,
    TaskbarList.Result? DeleteTab,
    bool TimedOut,
    bool Terminated,
    bool CleanupSafe,
    bool? Started = null,
    bool? Exited = null,
    bool Cancelled = false,
    bool TerminationRequested = false)
{
    /// <summary>An execution that never started a worker: the result is final when it returns.</summary>
    public static Execution FromResult(TaskbarList.Result result) =>
        new(result, result.Call == "HrInit" ? result : null, result.Call == "DeleteTab" ? result : null,
            TimedOut: false, Terminated: false, CleanupSafe: true, Started: null, Exited: null);

    /// <summary>
    /// A worker execution. A timeout is only cleanup-safe when the worker was terminated AND its exit
    /// was confirmed; otherwise the report says the Shell call may still be in flight.
    /// </summary>
    public static Execution FromWorker(WorkerOutcome worker) =>
        new(worker.Trace.Result, worker.Trace.HrInit, worker.Trace.DeleteTab,
            worker.TimedOut, worker.Terminated, worker.CleanupSafe,
            worker.Started, worker.Exited, worker.Cancelled, worker.TerminationRequested);
}

/// <summary>
/// The record written to taskbar-action.json. Visual fields stay null unless a human reported them;
/// no HRESULT or window style is ever promoted to "the button is gone".
/// </summary>
public sealed record TaskbarActionRecord(
    int SchemaVersion,
    bool Enabled,
    string Stage,
    string? Location,
    object? RequestedIdentity,
    object? BeforeIdentity,
    object? AfterIdentity,
    bool? TaskbarHidden,
    bool? AltTabHidden,
    object? FirstFrame,
    object? Trigger,
    object? Action,
    object? Blocked,
    object? Failure,
    object? Cleanup,
    string[] Notes);

/// <summary>Options configuring the taskbar hide strategy.</summary>
public sealed record TaskbarHideOptions(
    bool Enabled,
    long? Hwnd,
    int? Pid,
    DateTimeOffset? Start,
    int MinSeconds = 10,
    int DurationSeconds = 0);

/// <summary>
/// The C1 experiment, as a state machine with injected window/COM/clock/output boundaries so every
/// bound in the review can be exercised offline.
///
/// Rules the machine enforces:
///  - nothing happens without the QA flag (<see cref="Armed"/>);
///  - the action needs BOTH a real encoded frame AND the minimum normal runtime, and it happens at
///    most once per run;
///  - the target must still be the verified window (HWND + exact location + unique title + PID +
///    StartTime + wallpaper64) immediately before the call;
///  - a minimized, invisible or cloaked target is refused and never restored;
///  - a failed action is recorded once and never retried, and the capture keeps its own bounded end;
///  - cleanup only ever closes this round's own location, and only while the identity still matches.
/// </summary>
public sealed class TaskbarHideStrategy
{
    private readonly object _sync = new();
    private readonly TaskbarHideOptions _options;
    private readonly IWindowProbe _probe;
    private readonly Func<double> _now;
    private readonly Action<TaskbarActionRecord> _write;
    private readonly List<string> _notes = [];
    private readonly string? _location;

    private object? _firstFrame;
    private object? _before;
    private object? _after;
    private object? _trigger;
    private object? _actionResult;
    private object? _blocked;
    private object? _failure;
    private object? _cleanup;
    private object? _firstFrameAfterAction;
    private object? _lastPreCompletionFrameAfter;
    private Execution? _lastExecution;
    private Task<StrategyDecision>? _pendingAction;
    private StrategyDecision? _completedDecision;
    private double _lastObservedSeconds;
    private long _lastObservedSequence;
    private double _lastObservedSourceTimestampMs;
    private long _triggerSequence;
    private double _triggeredAtSeconds;
    private double _triggeredNowSeconds;
    private double _clockOffsetAtTriggerSeconds;
    private double _triggeredQpcMs;
    private double _triggeredSourceTimestampMs;
    private double? _completedAtSeconds;
    private long? _completedAfterFrameSequence;
    private double? _completedAfterSourceTimestampMs;
    private long? _completedAtUnixMs;
    private int _framesWhilePending;
    private int _preCompletionFramesPublishedAfter;
    private bool _attempted;
    private bool _executorEntered;
    private bool? _workerStarted;
    private bool _actionCompleted;
    private bool _settled;
    private bool _stopRequested;
    private bool _observedEncodedFrame;
    private bool _cleanupSafe = true;
    private string _stage = "armed";

    public TaskbarHideStrategy(
        TaskbarHideOptions options,
        IWindowProbe probe,
        Func<double> now,
        Action<TaskbarActionRecord> write,
        string? location = null)
    {
        _options = options;
        _probe = probe;
        _now = now;
        _write = write;
        _location = location;
    }

    public bool Armed => _options.Enabled;
    public bool Attempted { get { lock (_sync) return _attempted; } }
    public bool IsActionPending { get { lock (_sync) return _attempted && !_actionCompleted; } }
    /// <summary>Worker facts only; source identity must still be checked by CanCloseOwned at cleanup.</summary>
    public bool WorkerCleanupSafe
    {
        get { lock (_sync) return _cleanupSafe && (_pendingAction is null || _actionCompleted); }
    }
    public bool IsStopRequested => Volatile.Read(ref _stopRequested) || (ExternalStopRequested?.Invoke() ?? false);
    public Func<bool>? ExternalStopRequested { get; init; }
    public Func<double> SourceClockMs { get; init; } = () => Stopwatch.GetTimestamp() * 1000.0 / Stopwatch.Frequency;
    public string Stage { get { lock (_sync) return _stage; } }
    public long Hwnd => _options.Hwnd ?? 0;
    public string[] Notes { get { lock (_sync) return [.. _notes]; } }
    public int FramesWhilePending { get { lock (_sync) return _framesWhilePending; } }

    public void RequestStop() => Volatile.Write(ref _stopRequested, true);

    /// <summary>Record that the worker child process has genuinely started while the action is in flight.</summary>
    public void NotifyWorkerStarted()
    {
        lock (_sync)
        {
            _executorEntered = true;
            _workerStarted = true;
            if (_attempted && !_actionCompleted)
            {
                _actionResult = BuildPendingActionPayload();
                WriteLocked(_stage);
            }
        }
    }

    /// <summary>Optional work the caller performs right before the Shell call (never a retry).</summary>
    public Action<long>? BeforeCall { get; init; }

    /// <summary>
    /// How the Shell call is executed. The real run uses the worker PROCESS, so a call that does not
    /// return can be terminated and proven gone; the offline checks inject a fake that records the same
    /// contract. <see cref="Execution.Terminated"/> and <see cref="Execution.CleanupSafe"/> are what the
    /// caller needs before it closes the source window.
    /// </summary>
    public Func<long, Execution> Execute { get; set; } =
        _ => throw new InvalidOperationException("An owned worker executor must be configured");

    /// <summary>The same contract in method form, for a caller that has to swap the executor later.</summary>
    public void SetExecutor(Func<long, Execution> execute) => Execute = execute;

    /// <summary>Record the "before" facts once, so the report can be compared field by field.</summary>
    public void CaptureInitialState()
    {
        if (!Armed) return;
        try
        {
            var initial = Describe(_probe.Inspect(Hwnd), includeStartTime: true);
            lock (_sync)
            {
                _before = initial;
                _stage = "observing";
            }
        }
        catch (Exception error)
        {
            lock (_sync)
            {
                _stage = "blocked";
                _blocked = new { reason = error.Message, when = "before" };
                _notes.Add($"the target could not be observed before the action: {error.Message}");
            }
        }
    }

    /// <summary>
    /// Non-blocking frame entry used by the capture loop: starts the worker action at most once in the
    /// background without waiting for window enumeration, process startup or Shell COM completion.
    /// </summary>
    public StrategyDecision OnFrameAsync(FrameObservation frame)
    {
        lock (_sync)
        {
            if (!Armed) return new StrategyDecision("disabled");
            if (!frame.Encoded || string.IsNullOrEmpty(frame.Hash))
                return new StrategyDecision("skipped", "no encoded frame yet");

            _lastObservedSequence = Math.Max(_lastObservedSequence, frame.Sequence);
            if (frame.ElapsedSeconds >= _lastObservedSeconds)
                _lastObservedSeconds = frame.ElapsedSeconds;
            if (frame.SourceTimestampMs > _lastObservedSourceTimestampMs)
                _lastObservedSourceTimestampMs = frame.SourceTimestampMs;

            if (!_observedEncodedFrame)
            {
                _observedEncodedFrame = true;
                // Saved on its own: "a real encoded frame existed" is a separate fact from the action.
                _firstFrame = new
                {
                    sequence = frame.Sequence,
                    elapsedSeconds = Math.Round(frame.ElapsedSeconds, 3),
                    hash = frame.Hash,
                    sourceTimestampMs = frame.SourceTimestampMs,
                    capturedAt = frame.CapturedAtUnixMs,
                    published = frame.Published,
                    stopRequested = frame.StopRequested,
                };
            }

            if (_attempted)
            {
                if (frame.StopRequested) Volatile.Write(ref _stopRequested, true);
                if (!_actionCompleted)
                {
                    if (frame.Published && !frame.StopRequested)
                    {
                        _framesWhilePending++;
                        _actionResult = BuildPendingActionPayload();
                    }
                    return new StrategyDecision("action-pending", "worker action in progress");
                }
                if (_lastExecution is not null && frame.Published && !frame.StopRequested)
                {
                    var minSequence = _completedAfterFrameSequence ?? _triggerSequence;
                    var minSourceTimestampMs = _completedAfterSourceTimestampMs ?? _triggeredSourceTimestampMs;
                    var capturedAfterCompletion = frame.Sequence > minSequence
                        && frame.SourceTimestampMs > minSourceTimestampMs;
                    if (capturedAfterCompletion)
                    {
                        if (_firstFrameAfterAction is null)
                        {
                            _firstFrameAfterAction = new
                            {
                                sequence = frame.Sequence,
                                elapsedSeconds = Math.Round(frame.ElapsedSeconds, 3),
                                hash = frame.Hash,
                                sourceTimestampMs = frame.SourceTimestampMs,
                                capturedAt = frame.CapturedAtUnixMs,
                                published = frame.Published,
                            };
                            _actionResult = BuildCompletedActionPayload(_lastExecution);
                            WriteLocked(_stage);
                        }
                    }
                    else if (frame.Sequence > _triggerSequence)
                    {
                        // A frame acquired before worker completion that finished encoding/publishing after
                        // completion is still a pre-completion capture; never promote it to postActionFrame.
                        _preCompletionFramesPublishedAfter++;
                        _lastPreCompletionFrameAfter = new
                        {
                            sequence = frame.Sequence,
                            elapsedSeconds = Math.Round(frame.ElapsedSeconds, 3),
                            hash = frame.Hash,
                            sourceTimestampMs = frame.SourceTimestampMs,
                            capturedAt = frame.CapturedAtUnixMs,
                            published = frame.Published,
                        };
                        _actionResult = BuildCompletedActionPayload(_lastExecution);
                        WriteLocked(_stage);
                        return new StrategyDecision("pre-action-frame", "frame was captured before action completion");
                    }
                }
                return new StrategyDecision("already-done");
            }

            // The trigger requires a PUBLISHED frame and no pending stop: deleting the button while the
            // caller is already stopping would race the cleanup.
            if (!frame.Published) return new StrategyDecision("waiting", "the frame was not published");
            if (frame.StopRequested || IsStopRequested)
            {
                Volatile.Write(ref _stopRequested, true);
                _stage = "stopped-before-action";
                _notes.Add("a stop was requested before the action; no button was removed");
                WriteLocked(_stage);
                return new StrategyDecision("stopped");
            }
            if (frame.ElapsedSeconds < _options.MinSeconds)
                return new StrategyDecision("waiting", $"elapsed {frame.ElapsedSeconds:0.###}s < {_options.MinSeconds}s");

            // Mark uncertain BEFORE launching the background task: until the worker finishes and its exit
            // is confirmed, cleanup must not close the source window.
            _attempted = true;
            _executorEntered = false;
            _workerStarted = null;
            _actionCompleted = false;
            _cleanupSafe = false;
            _triggerSequence = frame.Sequence;
            _triggeredAtSeconds = Math.Round(frame.ElapsedSeconds, 3);
            _triggeredNowSeconds = _now();
            _clockOffsetAtTriggerSeconds = Math.Round(_triggeredNowSeconds - _triggeredAtSeconds, 3);
            _triggeredQpcMs = SourceClockMs();
            _triggeredSourceTimestampMs = frame.SourceTimestampMs;
            _trigger = new
            {
                sequence = frame.Sequence,
                elapsedSeconds = _triggeredAtSeconds,
                triggeredAtSeconds = _triggeredAtSeconds,
                runtimeClockOffsetSeconds = _clockOffsetAtTriggerSeconds,
                hash = frame.Hash,
                sourceTimestampMs = frame.SourceTimestampMs,
                capturedAt = frame.CapturedAtUnixMs,
                minSeconds = _options.MinSeconds,
            };
            _stage = "action-pending";
            _actionResult = BuildPendingActionPayload();
            WriteLocked(_stage);
            _pendingAction = Task.Run(RunActionCore);
            return new StrategyDecision("action-pending");
        }
    }

    /// <summary>
    /// Feed one frame and wait for completion when triggered; used by synchronous state-machine checks.
    /// </summary>
    public StrategyDecision OnFrame(FrameObservation frame)
    {
        var decision = OnFrameAsync(frame);
        if (decision.Kind == "action-pending")
            return SettlePending(timeoutMs: 30_000, requestStop: false);
        return decision;
    }

    private StrategyDecision RunActionCore()
    {
        WindowSnapshot snapshot;
        try
        {
            snapshot = _probe.Inspect(Hwnd);
        }
        catch (Exception error)
        {
            lock (_sync)
            {
                if (_settled) return _completedDecision ?? new StrategyDecision("action-unconfirmed", error.Message);
                _cleanupSafe = true;
                _actionCompleted = true;
                CompleteTimingLocked();
                _actionResult = null;
                _stage = "blocked";
                _blocked = new { reason = error.Message, when = "verify-before-action" };
                var blocked = new StrategyDecision("blocked", error.Message);
                _completedDecision = blocked;
                WriteLocked("blocked");
                return blocked;
            }
        }

        if (!snapshot.Exists)
        {
            lock (_sync)
            {
                if (_settled) return _completedDecision ?? new StrategyDecision("action-unconfirmed", "target-closed");
                _cleanupSafe = true;
                _actionCompleted = true;
                CompleteTimingLocked();
                _actionResult = null;
                _stage = "blocked";
                _blocked = new { reason = "target-closed", when = "verify-before-action" };
                var blocked = new StrategyDecision("blocked", "target-closed");
                _completedDecision = blocked;
                WriteLocked("blocked");
                return blocked;
            }
        }

        if (!snapshot.Visible || snapshot.Iconic || snapshot.Cloaked)
        {
            // Refused, and deliberately NOT restored: showing or restoring the source would change the
            // very conditions the experiment is measuring.
            var reason = !snapshot.Visible ? "target-not-visible" : snapshot.Iconic ? "target-minimized" : "target-cloaked";
            lock (_sync)
            {
                if (_settled) return _completedDecision ?? new StrategyDecision("action-unconfirmed", reason);
                _cleanupSafe = true;
                _actionCompleted = true;
                CompleteTimingLocked();
                _actionResult = null;
                _stage = "blocked";
                _blocked = new { reason, when = "verify-before-action", visible = snapshot.Visible, iconic = snapshot.Iconic, cloaked = snapshot.Cloaked };
                _notes.Add($"{reason}: the action is refused and the window is not restored");
                var blocked = new StrategyDecision("blocked", reason);
                _completedDecision = blocked;
                WriteLocked("blocked");
                return blocked;
            }
        }

        lock (_sync)
        {
            if (_settled) return _completedDecision ?? new StrategyDecision("action-unconfirmed", "settled before execution");
            _before = Describe(snapshot, includeStartTime: true);
            if (IsStopRequested)
            {
                _cleanupSafe = true;
                _actionCompleted = true;
                _workerStarted = false;
                CompleteTimingLocked();
                var cancelledBeforeStart = Execution.FromWorker(new WorkerOutcome(
                    TaskbarList.CallTrace.NotCalled("Worker", "stop-requested-before-worker-start", unchecked((int)0x800704C7)),
                    Started: false, Exited: false, TimedOut: false, Cancelled: true,
                    TerminationRequested: false, Terminated: false, Error: "stop-requested-before-worker-start"));
                _lastExecution = cancelledBeforeStart;
                _actionResult = BuildCompletedActionPayload(cancelledBeforeStart);
                _stage = "action-failed";
                _failure = new { stage = "worker", message = "stop-requested-before-worker-start", hresult = $"0x{unchecked((int)0x800704C7):X8}" };
                _notes.Add("Worker failed (stop-requested-before-worker-start); call results are unknown");
                var stoppedDecision = new StrategyDecision("action-failed", "stop-requested-before-worker-start");
                _completedDecision = stoppedDecision;
                WriteLocked(_stage);
                return stoppedDecision;
            }
            _executorEntered = true;
            _actionResult = BuildPendingActionPayload();
        }

        Execution execution;
        try
        {
            BeforeCall?.Invoke(Hwnd);
            execution = Execute(Hwnd);
        }
        catch (Exception error)
        {
            lock (_sync)
            {
                if (_settled) return _completedDecision ?? new StrategyDecision("action-unconfirmed", error.Message);
                _cleanupSafe = false;
                _actionCompleted = true;
                CompleteTimingLocked();
                var failedExec = new Execution(
                    new TaskbarList.Result(error.HResult != 0 ? error.HResult : unchecked((int)0x80004005), false, "Worker", error.Message),
                    HrInit: null,
                    DeleteTab: null,
                    TimedOut: false,
                    Terminated: false,
                    CleanupSafe: false,
                    Started: _workerStarted,
                    Exited: _workerStarted == true ? false : null,
                    Cancelled: IsStopRequested,
                    TerminationRequested: false);
                _lastExecution = failedExec;
                _actionResult = BuildCompletedActionPayload(failedExec);
                _notes.Add("the Shell action could not be confirmed gone; cleanup must not start next to it");
                _stage = "action-unconfirmed";
                _failure = new { stage = "worker", message = error.Message, hresult = $"0x{failedExec.Result.Hresult:X8}" };
                var unconfirmed = new StrategyDecision("action-unconfirmed", error.Message);
                _completedDecision = unconfirmed;
                WriteLocked(_stage);
                return unconfirmed;
            }
        }

        lock (_sync)
        {
            if (_settled) return _completedDecision ?? new StrategyDecision("action-unconfirmed", "settled before completion");
        }

        object? afterSnapshot = null;
        string? afterError = null;
        if (execution.CleanupSafe)
        {
            try { afterSnapshot = Describe(_probe.Inspect(Hwnd), includeStartTime: true); }
            catch (Exception error) { afterError = error.Message; }
        }

        lock (_sync)
        {
            if (_settled) return _completedDecision ?? new StrategyDecision("action-unconfirmed", "settled before completion");
            _cleanupSafe = execution.CleanupSafe;
            _actionCompleted = true;
            if (execution.Started is not null) _workerStarted = execution.Started;
            CompleteTimingLocked();
            _lastExecution = execution;
            _actionResult = BuildCompletedActionPayload(execution);
            var action = execution.Result;
            var failureStage = FailureStageOf(action.Call);
            if (!execution.CleanupSafe)
            {
                _notes.Add("the Shell action could not be confirmed gone; cleanup must not start next to it");
                _stage = "action-unconfirmed";
                _failure = new { stage = failureStage, message = action.Error, hresult = $"0x{action.Hresult:X8}" };
                var unconfirmed = new StrategyDecision("action-unconfirmed", action.Error);
                _completedDecision = unconfirmed;
                WriteLocked(_stage);
                return unconfirmed;
            }
            if (!action.Succeeded)
            {
                // One attempt only: the capture continues to its own bounded end and the real situation is
                // written out. Nothing is retried and no fallback route is entered.
                _stage = "action-failed";
                _failure = new { stage = failureStage, message = action.Error, hresult = $"0x{action.Hresult:X8}" };
                if (action.Call == "DeleteTab")
                    _notes.Add("DeleteTab failed once; it is not retried and no AddTab/owner fallback is attempted");
                else if (execution.DeleteTab is not null)
                    _notes.Add($"{action.Call} failed after DeleteTab was attempted; its result is recorded separately; no retry or AddTab/owner fallback is attempted");
                else if (action.Call == "HrInit")
                    _notes.Add("HrInit failed; DeleteTab was not attempted");
                else if (action.Call == "Verify")
                    _notes.Add($"Verification failed ({action.Error}); DeleteTab was not attempted");
                else if (action.Call == "Worker")
                    _notes.Add($"Worker failed ({action.Error}); call results are unknown");
                else
                    _notes.Add($"{action.Call} failed; DeleteTab was not attempted");
            }
            else
            {
                _stage = "action-done";
            }
            if (afterSnapshot is not null) _after = afterSnapshot;
            if (afterError is not null) _notes.Add($"the target could not be observed after the action: {afterError}");
            var completed = new StrategyDecision(action.Succeeded ? "acted" : "action-failed", action.Error);
            _completedDecision = completed;
            WriteLocked(_stage);
            return completed;
        }
    }

    /// <summary>
    /// Propagate stop (when requested) and wait up to <paramref name="timeoutMs"/> for any pending
    /// background action to finish. If the task does not settle in time, cleanup remains blocked.
    /// </summary>
    public StrategyDecision SettlePending(int timeoutMs = 10_000, bool requestStop = true)
    {
        Task<StrategyDecision>? pending;
        lock (_sync)
        {
            if (requestStop) Volatile.Write(ref _stopRequested, true);
            pending = _pendingAction;
            if (pending is null)
            {
                if (!_attempted && (_stage == "observing" || _stage == "armed"))
                {
                    _stage = "stopped-before-action";
                    _notes.Add("a stop was requested before the action; no button was removed");
                }
                return _completedDecision ?? new StrategyDecision(_stage);
            }
        }
        bool finishedInTime;
        try
        {
            finishedInTime = pending.Wait(Math.Max(1, timeoutMs));
        }
        catch (AggregateException)
        {
            finishedInTime = true;
        }
        lock (_sync)
        {
            if (finishedInTime && _actionCompleted && _completedDecision is not null)
            {
                _settled = true;
                return _completedDecision;
            }
            if (!_settled)
            {
                _settled = true;
                _cleanupSafe = false;
                _actionCompleted = true;
                CompleteTimingLocked();
                var unconfirmedWorker = new Execution(
                    new TaskbarList.Result(unchecked((int)0x800705B4), false, "Worker", "pending worker action did not settle before cleanup"),
                    HrInit: null,
                    DeleteTab: null,
                    TimedOut: true,
                    Terminated: false,
                    CleanupSafe: false,
                    Started: _workerStarted,
                    Exited: _workerStarted == true ? false : null,
                    Cancelled: IsStopRequested,
                    TerminationRequested: _workerStarted == true);
                _lastExecution = unconfirmedWorker;
                _actionResult = BuildCompletedActionPayload(unconfirmedWorker);
                _notes.Add("the Shell action could not be confirmed gone; cleanup must not start next to it");
                _stage = "action-unconfirmed";
                _failure = new { stage = "worker", message = "pending worker action did not settle before cleanup", hresult = $"0x{unchecked((int)0x800705B4):X8}" };
                _completedDecision = new StrategyDecision("action-unconfirmed", "pending worker action did not settle before cleanup");
                WriteLocked(_stage);
            }
            return _completedDecision!;
        }
    }

    /// <summary>
    /// Whether cleanup may close this round's window: the identity must still match, or the window must
    /// already be gone (which counts as ended). A changed or unverifiable target is never closed.
    /// </summary>
    public (bool Allowed, string Reason) CanCloseOwned()
    {
        lock (_sync)
        {
            if (_pendingAction is not null && !_actionCompleted)
                return (false, "worker-action-still-pending");
            if (!_cleanupSafe) return (false, "worker-exit-not-confirmed");
        }
        try
        {
            var snapshot = _probe.Inspect(Hwnd);
            if (!snapshot.Exists) return (true, "target-already-gone");
            return (true, "identity-matched");
        }
        catch (Exception error)
        {
            lock (_sync)
            {
                _notes.Add($"cleanup not confirmed: {error.Message}");
            }
            return (false, error.Message);
        }
    }

    /// <summary>Record the cleanup outcome; the caller supplies what the bounded close reported.</summary>
    public void RecordCleanup(object? cleanup, string? note = null)
    {
        lock (_sync)
        {
            _cleanup = cleanup;
            if (note is not null) _notes.Add(note);
            WriteLocked(cleanup is null ? _stage : "closed");
        }
    }

    /// <summary>Write the record. Safe to call repeatedly; the file is rewritten with the latest state.</summary>
    public void Write(string stage, bool cleanupFailed = false)
    {
        lock (_sync)
        {
            WriteLocked(stage, cleanupFailed);
        }
    }

    private void WriteLocked(string stage, bool cleanupFailed = false)
    {
        if (!Armed) return;
        _stage = stage == "closed" ? _stage : stage;
        _write(new TaskbarActionRecord(
            SchemaVersion: 1,
            Enabled: true,
            Stage: _stage,
            Location: _location,
            RequestedIdentity: new { hwnd = Hwnd, pid = _options.Pid, startUtc = _options.Start?.ToString("O"), minSeconds = _options.MinSeconds, durationSeconds = _options.DurationSeconds },
            BeforeIdentity: _before,
            AfterIdentity: _after,
            // No visual observation exists in an automated run: these stay unknown whatever the HRESULT said.
            TaskbarHidden: null,
            AltTabHidden: null,
            FirstFrame: _firstFrame,
            Trigger: _trigger,
            Action: _actionResult,
            Blocked: _blocked,
            Failure: _failure,
            Cleanup: _cleanup,
            Notes: cleanupFailed ? [.. _notes, "window cleanup was not confirmed by this process"] : [.. _notes]));
    }

    private void CompleteTimingLocked()
    {
        var completionQpcMs = SourceClockMs();
        _completedAtSeconds = CurrentCaptureSeconds(_triggeredAtSeconds, completionQpcMs);
        _completedAfterFrameSequence = _lastObservedSequence;
        _completedAfterSourceTimestampMs = Math.Max(_lastObservedSourceTimestampMs, completionQpcMs);
        _completedAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    private double CurrentCaptureSeconds(double minimumSeconds, double currentQpcMs)
    {
        var deltaClockSeconds = Math.Max(0.0, _now() - _triggeredNowSeconds);
        var deltaQpcSeconds = Math.Max(0.0, (currentQpcMs - _triggeredQpcMs) / 1000.0);
        var deltaSeconds = deltaClockSeconds > 0.0 ? deltaClockSeconds : deltaQpcSeconds;
        var candidate = Math.Max(_lastObservedSeconds, _triggeredAtSeconds + deltaSeconds);
        return Math.Round(Math.Max(minimumSeconds, candidate), 3);
    }

    private object BuildPendingActionPayload() => new
    {
        call = "Pending",
        hresult = (string?)null,
        succeeded = false,
        pending = true,
        actionScheduled = true,
        executorEntered = _executorEntered,
        error = (string?)null,
        hrInit = (object?)null,
        deleteTab = (object?)null,
        timedOut = false,
        terminated = false,
        cleanupSafe = false,
        started = _workerStarted,
        exited = _workerStarted == true ? (bool?)false : null,
        cancelled = IsStopRequested,
        terminationRequested = false,
        triggeredAtSeconds = _triggeredAtSeconds,
        runtimeClockOffsetSeconds = _clockOffsetAtTriggerSeconds,
        completedAtSeconds = (double?)null,
        completedAfterFrameSequence = (long?)null,
        completedAfterSourceTimestampMs = (double?)null,
        completedAtUnixMs = (long?)null,
        framesWhilePending = _framesWhilePending,
        preCompletionFramesPublishedAfter = 0,
        lastPreCompletionFrameAfter = (object?)null,
        postActionFrame = (object?)null,
    };

    private object BuildCompletedActionPayload(Execution execution)
    {
        var action = execution.Result;
        var started = execution.Started ?? _workerStarted;
        var exited = execution.Exited ?? (started == true ? (bool?)false : null);
        return new
        {
            call = action.Call,
            hresult = $"0x{action.Hresult:X8}",
            succeeded = action.Succeeded,
            pending = false,
            actionScheduled = true,
            executorEntered = _executorEntered,
            error = action.Error,
            hrInit = execution.HrInit is null ? null : new { hresult = $"0x{execution.HrInit.Hresult:X8}", succeeded = execution.HrInit.Succeeded, error = execution.HrInit.Error },
            deleteTab = execution.DeleteTab is null ? null : new { hresult = $"0x{execution.DeleteTab.Hresult:X8}", succeeded = execution.DeleteTab.Succeeded, error = execution.DeleteTab.Error },
            timedOut = execution.TimedOut,
            terminated = execution.Terminated,
            cleanupSafe = execution.CleanupSafe,
            started,
            exited,
            cancelled = execution.Cancelled,
            terminationRequested = execution.TerminationRequested,
            triggeredAtSeconds = _triggeredAtSeconds,
            runtimeClockOffsetSeconds = _clockOffsetAtTriggerSeconds,
            completedAtSeconds = _completedAtSeconds,
            completedAfterFrameSequence = _completedAfterFrameSequence,
            completedAfterSourceTimestampMs = _completedAfterSourceTimestampMs,
            completedAtUnixMs = _completedAtUnixMs,
            framesWhilePending = _framesWhilePending,
            preCompletionFramesPublishedAfter = _preCompletionFramesPublishedAfter,
            lastPreCompletionFrameAfter = _lastPreCompletionFrameAfter,
            postActionFrame = _firstFrameAfterAction,
        };
    }

    private static object Describe(WindowSnapshot snapshot, bool includeStartTime) => new
    {
        hwnd = snapshot.Hwnd,
        pid = snapshot.Pid,
        process = snapshot.ProcessName,
        title = snapshot.Title,
        exists = snapshot.Exists,
        visible = snapshot.Visible,
        iconic = snapshot.Iconic,
        cloaked = snapshot.Cloaked,
        left = snapshot.Left,
        top = snapshot.Top,
        width = snapshot.Width,
        height = snapshot.Height,
        style = $"0x{snapshot.Style:X8}",
        exStyle = $"0x{snapshot.ExStyle:X8}",
        owner = snapshot.Owner,
        parent = snapshot.Parent,
        zOrderIndex = snapshot.ZOrderIndex,
        startUtc = includeStartTime ? snapshot.StartTimeUtc?.ToString("O") : null,
    };

    private static string FailureStageOf(string call) => call switch
    {
        "DeleteTab" => "delete-tab",
        "HrInit" => "hr-init",
        "Verify" => "verify",
        "Worker" => "worker",
        "Create" => "create",
        "Release" => "release",
        _ => call.ToLowerInvariant(),
    };

    /// <summary>Serialize one record with the same camelCase convention the capture uses.</summary>
    public static string Serialize(TaskbarActionRecord record) =>
        JsonSerializer.Serialize(record, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
}
