/// <summary>
/// Offline checks for the C1 experiment. Every one of them runs the REAL strategy and the REAL COM
/// wrapper against injected window, process, clock and Shell boundaries: no window is created, no
/// desktop or COM is initialised and no Shell method is called.
///
/// A fake Shell returning S_OK only proves the state machine reacted; the visual fields stay unknown
/// and one check asserts exactly that.
/// </summary>
public static class TaskbarHideSelfTest
{
    private sealed class FakeProbe : IWindowProbe
    {
        public List<WindowCandidate> Candidates { get; } = [];
        public WindowSnapshot? Snapshot { get; set; }
        public string? Failure { get; set; }
        public int Inspections { get; private set; }

        public IReadOnlyList<WindowCandidate> FindByExactTitle(string location) => Candidates;
        public WindowSnapshot Inspect(long hwnd)
        {
            Inspections++;
            if (Failure is not null) throw new InvalidOperationException(Failure);
            return Snapshot ?? Dead(hwnd);
        }
        public static WindowSnapshot Dead(long hwnd) => new(hwnd, 0, "", "", false, false, false, false, 0, 0, 0, 0, 0, 0, 0, 0, null, -1);
        public static WindowSnapshot Alive(long hwnd, uint pid, DateTimeOffset start, bool visible = true, bool iconic = false, bool cloaked = false) =>
            new(hwnd, pid, "wallpaper64", "WhaleWallpaperProbe-taskbar-qa", true, visible, iconic, cloaked,
                100, 100, 1302, 776, 0x16CF0000, 0x00000100, 0, 0, start, 0);
    }

    private sealed class RecordingAction : TaskbarList.IAction
    {
        public int InitHresult { get; set; }
        public int DeleteHresult { get; set; }
        public List<long> Hwnds { get; } = [];
        public int Calls { get; private set; }
        public TaskbarList.Result DeleteTabOnce(long hwnd)
        {
            Calls++;
            if (InitHresult < 0) return new TaskbarList.Result(InitHresult, false, "HrInit", "HrInit failed; DeleteTab was not attempted");
            Hwnds.Add(hwnd);
            return new TaskbarList.Result(DeleteHresult, DeleteHresult >= 0, "DeleteTab", DeleteHresult >= 0 ? null : "DeleteTab returned a failure HRESULT");
        }
    }

    private static readonly DateTimeOffset Start = new(2026, 10, 12, 10, 0, 0, TimeSpan.Zero);

    private static TaskbarQaOptions.Result Options(int duration = 25, int minSeconds = 5)
        => TaskbarQaOptions.Extract(["--taskbar-qa", "--taskbar-hwnd", "4242", "--taskbar-pid", "777",
            "--taskbar-start", Start.ToString("O"), "--taskbar-duration", duration.ToString(),
            "--taskbar-min-seconds", minSeconds.ToString(), "4242", "C:\\tmp\\out", duration.ToString(), "30", "memory",
            "--owned-location", "WhaleWallpaperProbe-taskbar-qa"]);

    private static (TaskbarHideStrategy Strategy, FakeProbe Probe, RecordingAction Action, List<TaskbarActionRecord> Records) Build(
        TaskbarQaOptions.Result? options = null, bool visible = true, bool iconic = false, bool cloaked = false, int deleteHresult = 0)
    {
        var parsed = options ?? Options();
        var probe = new FakeProbe { Snapshot = FakeProbe.Alive(4242, 777, Start, visible, iconic, cloaked) };
        probe.Candidates.Add(new WindowCandidate(4242, 777, "WhaleWallpaperProbe-taskbar-qa"));
        var action = new RecordingAction { InitHresult = 0, DeleteHresult = deleteHresult };
        var records = new List<TaskbarActionRecord>();
        var strategy = new TaskbarHideStrategy(parsed, probe, () => 0, records.Add, "WhaleWallpaperProbe-taskbar-qa")
        {
            // The offline checks inject the executor directly, which is the same contract the real
            // worker-based executor satisfies.
            Execute = hwnd =>
            {
                var result = action.DeleteTabOnce(hwnd);
                return Execution.FromResult(result);
            },
        };
        strategy.CaptureInitialState();
        return (strategy, probe, action, records);
    }

    private static double NowQpcMs() => System.Diagnostics.Stopwatch.GetTimestamp() * 1000.0 / System.Diagnostics.Stopwatch.Frequency;

    private static FrameObservation Frame(long sequence, double seconds, bool encoded = true, string? hash = "ABC",
        bool published = true, bool stopRequested = false, double? sourceTimestampMs = null, long? capturedAt = null)
        => new(sequence, seconds, encoded, encoded ? hash : null, sourceTimestampMs ?? NowQpcMs(), published, stopRequested, capturedAt);

    /// <summary>A complete accepted argv plus the QA flags for it, so the cross-check has real input.</summary>
    private static TaskbarQaOptions.Result QaArgs(string hwnd = "4242", int seconds = 25, string mode = "memory", string[]? extra = null)
    {
        var argv = new List<string> { "--taskbar-qa", "--taskbar-hwnd", hwnd, "--taskbar-pid", "777",
            "--taskbar-start", Start.ToString("O"), "--taskbar-duration", seconds.ToString(),
            "--taskbar-min-seconds", "5", hwnd, "C:\\tmp\\out", seconds.ToString(), "30", mode,
            "--owned-location", "WhaleWallpaperProbe-taskbar-qa" };
        if (extra is not null) argv.AddRange(extra);
        return TaskbarQaOptions.Extract([.. argv]);
    }

    /// <summary>True when the action is refused with an ArgumentException.</summary>
    private static bool Throws(Action action)
    {
        try { action(); return false; }
        catch (ArgumentException) { return true; }
    }

    public static void Run(Action<string, bool, string?> report)
    {
        // --- F1: the experiment must agree with the request the capture will run ---
        var parsedOk = CaptureArguments.Parse(QaArgs().Remaining);
        Check("F1 a consistent QA request cross-validates", !Throws(() => TaskbarQaOptions.RequireMatchesCapture(QaArgs(), parsedOk)), null);

        var differentHwnd = TaskbarQaOptions.Extract(["--taskbar-qa", "--taskbar-hwnd", "4242", "--taskbar-pid", "777",
            "--taskbar-start", Start.ToString("O"), "--taskbar-duration", "25", "9999", "C:\\tmp\\out", "25", "30", "memory",
            "--owned-location", "WhaleWallpaperProbe-taskbar-qa"]);
        Check("F1 a QA HWND that differs from the capture HWND is refused",
            Throws(() => TaskbarQaOptions.RequireMatchesCapture(differentHwnd, CaptureArguments.Parse(differentHwnd.Remaining))), null);

        var differentDuration = TaskbarQaOptions.Extract(["--taskbar-qa", "--taskbar-hwnd", "4242", "--taskbar-pid", "777",
            "--taskbar-start", Start.ToString("O"), "--taskbar-duration", "25", "4242", "C:\\tmp\\out", "1800", "30", "memory",
            "--owned-location", "WhaleWallpaperProbe-taskbar-qa"]);
        Check("F1 a report duration that differs from the capture duration is refused",
            Throws(() => TaskbarQaOptions.RequireMatchesCapture(differentDuration, CaptureArguments.Parse(differentDuration.Remaining))), null);

        var tooLong = TaskbarQaOptions.Extract(["--taskbar-qa", "--taskbar-hwnd", "4242", "--taskbar-pid", "777",
            "--taskbar-start", Start.ToString("O"), "--taskbar-duration", "60", "4242", "C:\\tmp\\out", "1800", "30", "memory",
            "--owned-location", "WhaleWallpaperProbe-taskbar-qa"]);
        Check("F1 a capture longer than the QA maximum is refused",
            Throws(() => TaskbarQaOptions.RequireMatchesCapture(tooLong, CaptureArguments.Parse(tooLong.Remaining))), null);

        var framesMode = TaskbarQaOptions.Extract(["--taskbar-qa", "--taskbar-hwnd", "4242", "--taskbar-pid", "777",
            "--taskbar-start", Start.ToString("O"), "--taskbar-duration", "25", "4242", "C:\\tmp\\out", "25", "30", "frames",
            "--owned-location", "WhaleWallpaperProbe-taskbar-qa"]);
        Check("F1 a mode that encodes no JPEG is refused",
            Throws(() => TaskbarQaOptions.RequireMatchesCapture(framesMode, CaptureArguments.Parse(framesMode.Remaining))), null);

        var lowMin = TaskbarQaOptions.Extract(["--taskbar-qa", "--taskbar-hwnd", "4242", "--taskbar-pid", "777",
            "--taskbar-start", Start.ToString("O"), "--taskbar-duration", "25", "--taskbar-min-seconds", "1",
            "4242", "C:\\tmp\\out", "25", "30", "memory", "--owned-location", "WhaleWallpaperProbe-taskbar-qa"]);
        Check("F1 a minimum below five seconds is refused",
            Throws(() => TaskbarQaOptions.RequireMatchesCapture(lowMin, CaptureArguments.Parse(lowMin.Remaining))), null);

        Check("F1 without the QA flag the accepted forever argv passes through untouched",
            !TaskbarQaOptions.Extract(["4242", "C:\\tmp\\out", "--forever", "30", "pipe", "--owned-location", "WhaleWallpaperProbe-x"]).Enabled
            && CaptureArguments.Parse(["4242", "C:\\tmp\\out", "--forever", "30", "pipe", "--owned-location", "WhaleWallpaperProbe-x"]).Forever, null);

        // --- F3: the timeout contract is about the WORKER, not about abandoning a thread ---
        var timedOut = Execution.FromWorker(new WorkerOutcome(TaskbarList.CallTrace.NotCalled("Worker", "timed out", unchecked((int)0x800705B4)),
            Started: true, Exited: true, TimedOut: true, Cancelled: false, TerminationRequested: true, Terminated: true, Error: null));
        Check("F3 a terminated worker leaves cleanup safe and records the timeout",
            timedOut.TimedOut && timedOut.Terminated && timedOut.CleanupSafe, $"{timedOut.TimedOut}/{timedOut.Terminated}/{timedOut.CleanupSafe}");

        var unconfirmed = Execution.FromWorker(new WorkerOutcome(TaskbarList.CallTrace.NotCalled("Worker", "exit not confirmed", unchecked((int)0x800705B4)),
            Started: true, Exited: false, TimedOut: true, Cancelled: false, TerminationRequested: true, Terminated: false, Error: "exit not confirmed"));
        Check("F3 an unconfirmed worker is NOT cleanup safe", unconfirmed.TimedOut && !unconfirmed.CleanupSafe, $"{unconfirmed.TimedOut}/{unconfirmed.CleanupSafe}");

        var unconfirmedRun = Build();
        unconfirmedRun.Strategy.Execute = _ => unconfirmed;
        var stoppedByTimeout = unconfirmedRun.Strategy.OnFrame(Frame(1, 6.0));
        Check("F3 an unconfirmed Shell call refuses cleanup and reports why",
            stoppedByTimeout.Kind == "action-unconfirmed" && unconfirmedRun.Records.Count > 0
            && unconfirmedRun.Records[^1].Action is not null && !unconfirmedRun.Strategy.CanCloseOwned().Allowed, stoppedByTimeout.Kind);

        // --- F4: the trigger needs a PUBLISHED frame, and a pending stop stops it ---
        var unpublished = Build();
        var notPublished = unpublished.Strategy.OnFrame(Frame(1, 6.0, published: false));
        Check("F4 a frame that was not published is not a trigger",
            notPublished.Kind == "waiting" && unpublished.Action.Calls == 0, notPublished.Kind);

        var stopping = Build();
        var pendingStop = stopping.Strategy.OnFrame(Frame(1, 6.0, stopRequested: true));
        Check("F4 a pending stop prevents the action",
            pendingStop.Kind == "stopped" && stopping.Action.Calls == 0, pendingStop.Kind);

        var recorded = Build();
        recorded.Strategy.OnFrame(Frame(1, 3.0));
        recorded.Strategy.OnFrame(Frame(7, 6.0));
        var record = recorded.Records[^1];
        var trigger = record.Trigger?.ToString() ?? string.Empty;
        Check("F4 the trigger records this frame's sequence, not the previous one",
            trigger.Contains("sequence = 7", StringComparison.Ordinal), trigger);
        Check("F4 the first encoded frame is recorded separately",
            record.FirstFrame is not null && record.FirstFrame.ToString()!.Contains("sequence = 1", StringComparison.Ordinal),
            record.FirstFrame?.ToString() ?? "null");
        Check("F4 the record carries the exact location",
            record.Location == "WhaleWallpaperProbe-taskbar-qa", record.Location ?? "null");

        var hrInitFailed = Build();
        hrInitFailed.Action.InitHresult = unchecked((int)0x80004005);
        hrInitFailed.Strategy.OnFrame(Frame(1, 6.0));
        var hrRecord = hrInitFailed.Records[^1];
        var actionText = hrRecord.Action?.ToString() ?? string.Empty;
        Check("F4 HrInit and DeleteTab results are kept apart",
            actionText.Contains("hrInit", StringComparison.Ordinal) && actionText.Contains("deleteTab", StringComparison.Ordinal)
            && actionText.Contains("hresult", StringComparison.Ordinal), actionText);

        void Check(string name, bool ok, string? detail = null) => report(name, ok, ok ? null : detail);

        // 1. No flag: the machine is inert.
        var flat = Build(TaskbarQaOptions.Extract(["4242", "C:\\tmp\\out", "20", "30", "memory"]));
        var inert = flat.Strategy.OnFrame(Frame(1, 30));
        Check("disabled: no QA flag means no action and no record",
            !flat.Strategy.Armed && inert.Kind == "disabled" && flat.Action.Calls == 0 && flat.Records.Count == 0, inert.Kind);

        // 2. Valid frame AND minimum runtime, then never again.
        var gated = Build();
        var early = gated.Strategy.OnFrame(Frame(1, 3.5));
        Check("trigger waits for the minimum runtime even with a valid frame",
            early.Kind == "waiting" && gated.Action.Calls == 0, early.Kind);
        var fired = gated.Strategy.OnFrame(Frame(2, 5.25));
        Check("trigger fires once a valid frame and the minimum runtime are both met",
            fired.Kind == "acted" && gated.Action.Calls == 1 && gated.Action.Hwnds.SequenceEqual([4242L]), $"{fired.Kind}/{gated.Action.Calls}");
        var later = gated.Strategy.OnFrame(Frame(3, 9.0));
        Check("later frames never repeat the action", later.Kind == "already-done" && gated.Action.Calls == 1, later.Kind);

        // A started session or a "capture started" log line is not a frame.
        var unencoded = Build();
        var notYet = unencoded.Strategy.OnFrame(Frame(1, 30, encoded: false));
        Check("an unencoded frame is not a trigger", notYet.Kind == "skipped" && unencoded.Action.Calls == 0, notYet.Kind);

        // 3. HrInit failure means no DeleteTab; a failed DeleteTab is recorded and not retried.
        var initFail = Build();
        initFail.Action.InitHresult = unchecked((int)0x80004005);
        var blocked = initFail.Strategy.OnFrame(Frame(1, 6.0));
        var initFailureJson = initFail.Records.Count > 0 && initFail.Records[^1].Failure is not null
            ? System.Text.Json.JsonSerializer.Serialize(initFail.Records[^1].Failure) : "";
        Check("a failed HrInit is recorded and never deletes",
            blocked.Kind == "action-failed" && initFail.Action.Calls == 1 && initFail.Records.Count > 0 &&
            initFail.Records[^1].Action is not null && initFail.Records[^1].Failure is not null &&
            initFailureJson.Contains("\"stage\":\"hr-init\"") &&
            !initFail.Records[^1].Notes.Any(n => n.Contains("DeleteTab failed")), blocked.Kind);

        var deleteFail = Build(deleteHresult: unchecked((int)0x80070005));
        var failed = deleteFail.Strategy.OnFrame(Frame(1, 6.0));
        var again = deleteFail.Strategy.OnFrame(Frame(2, 7.0));
        var deleteFailureJson = deleteFail.Records.Count > 0 && deleteFail.Records[^1].Failure is not null
            ? System.Text.Json.JsonSerializer.Serialize(deleteFail.Records[^1].Failure) : "";
        Check("a failed DeleteTab is recorded once and not retried",
            failed.Kind == "action-failed" && again.Kind == "already-done" && deleteFail.Action.Calls == 1 &&
            deleteFailureJson.Contains("\"stage\":\"delete-tab\"") &&
            deleteFail.Records[^1].Notes.Any(n => n.Contains("DeleteTab failed")), $"{failed.Kind}/{again.Kind}/{deleteFail.Action.Calls}");

        // 4. Identity and visibility guards: no Shell action in any of these.
        var notVisible = Build(visible: false);
        var hidden = notVisible.Strategy.OnFrame(Frame(1, 6.0));
        Check("an invisible target is refused and not restored",
            hidden.Kind == "blocked" && notVisible.Action.Calls == 0 && notVisible.Records[^1].Blocked is not null, hidden.Kind);

        var minimized = Build(iconic: true);
        var iconic = minimized.Strategy.OnFrame(Frame(1, 6.0));
        Check("a minimized target is refused", iconic.Kind == "blocked" && minimized.Action.Calls == 0, iconic.Kind);

        var cloaked = Build(cloaked: true);
        var cloak = cloaked.Strategy.OnFrame(Frame(1, 6.0));
        Check("a cloaked target is refused", cloak.Kind == "blocked" && cloaked.Action.Calls == 0, cloak.Kind);

        var closed = Build();
        closed.Probe.Snapshot = FakeProbe.Dead(4242);
        var gone = closed.Strategy.OnFrame(Frame(1, 6.0));
        Check("a closed target is refused", gone.Kind == "blocked" && closed.Action.Calls == 0, gone.Kind);

        var wrongStart = Build();
        wrongStart.Probe.Failure = "target-start-time-changed: recycled PID";
        var recycled = wrongStart.Strategy.OnFrame(Frame(1, 6.0));
        Check("a recycled PID with a different StartTime is refused",
            recycled.Kind == "blocked" && wrongStart.Action.Calls == 0 && wrongStart.Records[^1].Blocked is not null, recycled.Kind);

        var wrongLocation = Build();
        wrongLocation.Probe.Failure = "No open wallpaper window matches the round name";
        var mismatch = wrongLocation.Strategy.OnFrame(Frame(1, 6.0));
        Check("a wrong location is refused", mismatch.Kind == "blocked" && wrongLocation.Action.Calls == 0, mismatch.Kind);

        var ambiguous = Build();
        ambiguous.Probe.Failure = "target-ambiguous: 2 windows named the round name";
        var twoWindows = ambiguous.Strategy.OnFrame(Frame(1, 6.0));
        Check("two windows with the same name are refused", twoWindows.Kind == "blocked" && ambiguous.Action.Calls == 0, twoWindows.Kind);

        // 5. A stop before the action means nothing happens.
        var stopped = Build();
        var never = stopped.Strategy.OnFrame(Frame(1, 4.0));
        Check("a run that ends before the minimum never acts",
            never.Kind == "waiting" && stopped.Action.Calls == 0, never.Kind);

        // 6. The visual result stays unknown even when the fake Shell says S_OK.
        var optimistic = Build();
        optimistic.Strategy.OnFrame(Frame(1, 6.0));
        var visualRecord = optimistic.Records[^1];
        Check("a successful HRESULT never claims the button is gone",
            visualRecord.Action is not null && visualRecord.TaskbarHidden is null && visualRecord.AltTabHidden is null,
            $"taskbarHidden={visualRecord.TaskbarHidden} altTabHidden={visualRecord.AltTabHidden}");

        // 7. Cleanup ownership.
        var closable = Build();
        var (allowed, reason) = closable.Strategy.CanCloseOwned();
        Check("cleanup closes the target while the identity still matches", allowed && reason == "identity-matched", reason);

        var alreadyGone = Build();
        alreadyGone.Probe.Snapshot = FakeProbe.Dead(4242);
        Check("cleanup treats an already-closed target as ended", alreadyGone.Strategy.CanCloseOwned().Allowed, null);

        var changed = Build();
        changed.Probe.Failure = "target-start-time-changed";
        var (changedAllowed, changedReason) = changed.Strategy.CanCloseOwned();
        Check("cleanup refuses a target whose identity changed",
            !changedAllowed && changedReason.Contains("start-time"), changedReason);

        // 8. The record carries both identities and the trigger, and cleanup is reported separately.
        var reported = Build();
        reported.Strategy.OnFrame(Frame(6, 6.0));
        reported.Strategy.RecordCleanup(new { outcome = "closed", closed = true });
        var final = reported.Records[^1];
        Check("the record keeps before/after identities, the trigger and a separate cleanup result",
            final.BeforeIdentity is not null && final.AfterIdentity is not null && final.Trigger is not null &&
            final.Cleanup is not null && final.Stage == "action-done",
            $"{final.Stage}/{final.BeforeIdentity is not null}/{final.AfterIdentity is not null}/{final.Cleanup is not null}");

        // 9. The serialized shape is the documented one.
        var json = TaskbarHideStrategy.Serialize(final);
        Check("the record serializes with the documented camelCase keys",
            json.Contains("\"taskbarHidden\":null", StringComparison.Ordinal) &&
            json.Contains("\"altTabHidden\":null", StringComparison.Ordinal) &&
            json.Contains("\"beforeIdentity\"", StringComparison.Ordinal) &&
            json.Contains("\"schemaVersion\":1", StringComparison.Ordinal), json[..Math.Min(120, json.Length)]);

        // 10. Non-blocking OnFrameAsync: frames continue while worker is in flight, and only a frame after completion is postActionFrame.
        using var workerStarted = new ManualResetEventSlim(false);
        using var releaseWorker = new ManualResetEventSlim(false);
        int asyncWorkerStarts = 0;
        var currentClock = 6.4; // +1.2s runtime clock startup offset relative to capture clock 5.2s
        var asyncProbe = new FakeProbe { Snapshot = FakeProbe.Alive(4242, 777, Start) };
        asyncProbe.Candidates.Add(new WindowCandidate(4242, 777, "WhaleWallpaperProbe-taskbar-qa"));
        var asyncRecords = new List<TaskbarActionRecord>();
        TaskbarHideStrategy? asyncStrategy = null;
        asyncStrategy = new TaskbarHideStrategy(Options(), asyncProbe, () => currentClock, asyncRecords.Add, "WhaleWallpaperProbe-taskbar-qa")
        {
            Execute = hwnd =>
            {
                Interlocked.Increment(ref asyncWorkerStarts);
                asyncStrategy!.NotifyWorkerStarted();
                workerStarted.Set();
                releaseWorker.Wait(5000);
                return Execution.FromWorker(new WorkerOutcome(
                    new TaskbarList.CallTrace(new(0, true, "DeleteTab", null), new(0, true, "HrInit", null), new(0, true, "DeleteTab", null)),
                    Started: true, Exited: true, TimedOut: false, Cancelled: false, TerminationRequested: false, Terminated: false, Error: null));
            },
        };
        asyncStrategy.CaptureInitialState();
        var d1 = asyncStrategy.OnFrameAsync(Frame(10, 5.2, hash: "H10", capturedAt: 5200));
        Check("non-blocking trigger starts asynchronously as action-pending",
            d1.Kind == "action-pending" && workerStarted.Wait(2000) && asyncStrategy.IsActionPending && !asyncStrategy.CanCloseOwned().Allowed,
            d1.Kind);
        var pendingJson = TaskbarHideStrategy.Serialize(asyncRecords[^1]);
        Check("pending report never claims completion or postActionFrame prematurely",
            asyncRecords[^1].Stage == "action-pending" &&
            pendingJson.Contains("\"pending\":true", StringComparison.Ordinal) &&
            pendingJson.Contains("\"actionScheduled\":true", StringComparison.Ordinal) &&
            pendingJson.Contains("\"executorEntered\":true", StringComparison.Ordinal) &&
            pendingJson.Contains("\"started\":true", StringComparison.Ordinal) &&
            pendingJson.Contains("\"succeeded\":false", StringComparison.Ordinal) &&
            pendingJson.Contains("\"completedAtSeconds\":null", StringComparison.Ordinal) &&
            pendingJson.Contains("\"postActionFrame\":null", StringComparison.Ordinal),
            pendingJson);

        var d2 = asyncStrategy.OnFrameAsync(Frame(11, 5.233, hash: "H11", capturedAt: 5233));
        var d3 = asyncStrategy.OnFrameAsync(Frame(12, 5.266, hash: "H12", capturedAt: 5266));
        var d4 = asyncStrategy.OnFrameAsync(Frame(13, 5.300, hash: "H13", capturedAt: 5300));
        Check("subsequent frames continue without blocking while worker is pending",
            d2.Kind == "action-pending" && d3.Kind == "action-pending" && d4.Kind == "action-pending" &&
            asyncStrategy.FramesWhilePending == 3 && asyncWorkerStarts == 1,
            $"framesWhilePending={asyncStrategy.FramesWhilePending} starts={asyncWorkerStarts}");

        // Acquire frame 14 BEFORE worker completion, then let worker finish and publish frame 14 AFTER completion.
        var inFlightSourceMs = NowQpcMs();
        var inFlightCapturedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        Thread.Sleep(15);
        currentClock = 6.65; // +0.25s elapsed on runtime clock -> 5.2 + 0.25 = 5.45s on capture clock
        releaseWorker.Set();
        var settled = asyncStrategy.SettlePending(5000, requestStop: false);
        var doneBeforeNextFrameJson = TaskbarHideStrategy.Serialize(asyncRecords[^1]);
        Check("completion separates triggeredAtSeconds and completedAtSeconds on capture clock origin without offset inflation",
            settled.Kind == "acted" && asyncRecords[^1].Stage == "action-done" &&
            doneBeforeNextFrameJson.Contains("\"triggeredAtSeconds\":5.2", StringComparison.Ordinal) &&
            doneBeforeNextFrameJson.Contains("\"runtimeClockOffsetSeconds\":1.2", StringComparison.Ordinal) &&
            doneBeforeNextFrameJson.Contains("\"completedAtSeconds\":5.45", StringComparison.Ordinal) &&
            doneBeforeNextFrameJson.Contains("\"completedAfterFrameSequence\":13", StringComparison.Ordinal) &&
            doneBeforeNextFrameJson.Contains("\"framesWhilePending\":3", StringComparison.Ordinal) &&
            doneBeforeNextFrameJson.Contains("\"postActionFrame\":null", StringComparison.Ordinal),
            doneBeforeNextFrameJson);

        var dInFlight = asyncStrategy.OnFrameAsync(Frame(14, 5.460, hash: "H14-PRE", sourceTimestampMs: inFlightSourceMs, capturedAt: inFlightCapturedAt));
        var afterInFlightJson = TaskbarHideStrategy.Serialize(asyncRecords[^1]);
        Check("F1 frame captured before completion but published after completion is not promoted to postActionFrame",
            dInFlight.Kind == "pre-action-frame" &&
            afterInFlightJson.Contains("\"postActionFrame\":null", StringComparison.Ordinal) &&
            afterInFlightJson.Contains("\"preCompletionFramesPublishedAfter\":1", StringComparison.Ordinal) &&
            afterInFlightJson.Contains("\"hash\":\"H14-PRE\"", StringComparison.Ordinal),
            afterInFlightJson);

        var d5 = asyncStrategy.OnFrameAsync(Frame(15, 5.500, hash: "H15-POST", capturedAt: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));
        var afterNextFrameJson = TaskbarHideStrategy.Serialize(asyncRecords[^1]);
        Check("first frame captured AND published after completion is recorded as postActionFrame",
            d5.Kind == "already-done" && asyncWorkerStarts == 1 &&
            afterNextFrameJson.Contains("\"postActionFrame\":{\"sequence\":15,", StringComparison.Ordinal) &&
            afterNextFrameJson.Contains("\"hash\":\"H15-POST\"", StringComparison.Ordinal),
            afterNextFrameJson);

        // 11. F3: blocked pre-action Inspect reports started=null (not started=true), and stop during Inspect cancels without entering Execute.
        foreach (var cancelDuringInspect in new[] { false, true })
        {
            using var inspectEntered = new ManualResetEventSlim(false);
            using var releaseInspect = new ManualResetEventSlim(false);
            int execCalls = 0;
            var inspectRecords = new List<TaskbarActionRecord>();
            var blockingProbe = new BlockingInspectProbe(inspectEntered, releaseInspect, FakeProbe.Alive(4242, 777, Start));
            var inspectStrategy = new TaskbarHideStrategy(Options(), blockingProbe, () => 6.2, inspectRecords.Add, "WhaleWallpaperProbe-taskbar-qa")
            {
                Execute = _ =>
                {
                    Interlocked.Increment(ref execCalls);
                    return Execution.FromWorker(new WorkerOutcome(
                        new TaskbarList.CallTrace(new(0, true, "DeleteTab", null), new(0, true, "HrInit", null), new(0, true, "DeleteTab", null)),
                        Started: true, Exited: true, TimedOut: false, Cancelled: false, TerminationRequested: false, Terminated: false, Error: null));
                },
            };
            var triggerPending = inspectStrategy.OnFrameAsync(Frame(30, 5.0, hash: "H30"));
            bool inspectBlocked = inspectEntered.Wait(2000);
            var blockedPendingJson = TaskbarHideStrategy.Serialize(inspectRecords[^1]);
            bool pendingTruthful = triggerPending.Kind == "action-pending" && inspectBlocked && execCalls == 0 &&
                blockedPendingJson.Contains("\"actionScheduled\":true", StringComparison.Ordinal) &&
                blockedPendingJson.Contains("\"executorEntered\":false", StringComparison.Ordinal) &&
                blockedPendingJson.Contains("\"started\":null", StringComparison.Ordinal) &&
                blockedPendingJson.Contains("\"exited\":null", StringComparison.Ordinal);
            if (cancelDuringInspect) inspectStrategy.RequestStop();
            releaseInspect.Set();
            var settledInspect = inspectStrategy.SettlePending(5000, requestStop: false);
            var afterInspectJson = TaskbarHideStrategy.Serialize(inspectRecords[^1]);
            if (!cancelDuringInspect)
            {
                Check("F3 pre-action Inspect pending state keeps started=null until executor runs",
                    pendingTruthful && execCalls == 1 && settledInspect.Kind == "acted" &&
                    afterInspectJson.Contains("\"started\":true", StringComparison.Ordinal) &&
                    afterInspectJson.Contains("\"exited\":true", StringComparison.Ordinal),
                    blockedPendingJson);
            }
            else
            {
                Check("F3 stop requested during pre-action Inspect cancels before Execute and records started=false",
                    pendingTruthful && execCalls == 0 && settledInspect.Kind == "action-failed" &&
                    inspectStrategy.CanCloseOwned().Allowed &&
                    afterInspectJson.Contains("\"executorEntered\":false", StringComparison.Ordinal) &&
                    afterInspectJson.Contains("\"started\":false", StringComparison.Ordinal) &&
                    afterInspectJson.Contains("\"exited\":false", StringComparison.Ordinal) &&
                    afterInspectJson.Contains("\"cancelled\":true", StringComparison.Ordinal) &&
                    afterInspectJson.Contains("\"cleanupSafe\":true", StringComparison.Ordinal),
                    afterInspectJson);
            }
        }
    }

    private sealed class BlockingInspectProbe(ManualResetEventSlim entered, ManualResetEventSlim release, WindowSnapshot snapshot) : IWindowProbe
    {
        public IReadOnlyList<WindowCandidate> FindByExactTitle(string location) => [];
        public WindowSnapshot Inspect(long hwnd)
        {
            entered.Set();
            release.Wait(5000);
            return snapshot;
        }
    }
}
