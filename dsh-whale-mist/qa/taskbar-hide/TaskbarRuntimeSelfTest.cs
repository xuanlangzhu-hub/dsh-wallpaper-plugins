using System.Text.Json;

/// <summary>Regression checks exercise the actual runtime, process monitor and COM call flow.</summary>
public static class TaskbarRuntimeSelfTest
{
    private const string Location = "WhaleWallpaperProbe-runtime-test";
    private static readonly DateTimeOffset Start = DateTimeOffset.Parse("2026-10-12T00:00:00Z");
    private sealed class Probe : IWindowProbe
    {
        public bool Exists = true;
        public bool Changed { get; set; }
        public int InspectCalls;
        public IReadOnlyList<WindowCandidate> FindByExactTitle(string location) => [];
        public WindowSnapshot Inspect(long hwnd)
        {
            Interlocked.Increment(ref InspectCalls);
            if (Changed) throw new InvalidOperationException("identity changed");
            return new(hwnd, 7, "wallpaper64", Location, Exists, true, false, false,
                0, 0, 100, 100, 0, 0, 0, 0, Start, 0);
        }
    }
    private sealed class Calls : TaskbarList.ICalls
    {
        public int Init, Delete;
        public bool Released;
        public bool ThrowDelete;
        public bool ThrowRelease;
        public List<string> Sequence = [];
        public int HrInit() { Sequence.Add("HrInit"); return Init; }
        public int DeleteTab(long hwnd)
        { Sequence.Add("DeleteTab"); if (ThrowDelete) throw new IOException("fake delete failure"); return Delete; }
        public void Dispose()
        {
            Sequence.Add("Release"); Released = true;
            if (ThrowRelease) throw new IOException("fake release failure");
        }
    }
    private sealed class Worker : ITaskbarWorkerProcess
    {
        public long Elapsed;
        public bool Started, Killed, Disposed;
        public bool ConfirmKill = true, ExitNaturally, ThrowWait, ThrowRead, ThrowStart, RefuseStart, ThrowBind;
        public bool Start(TaskbarList.WorkerRequest request)
        {
            if (RefuseStart) return false;
            Started = true;
            if (ThrowStart) throw new IOException("post-start failure");
            if (ThrowBind) throw new InvalidOperationException("Failed to bind worker process to job container");
            return true;
        }
        public bool WaitForExit(int ms)
        {
            Elapsed += ms;
            if (ThrowWait && !Killed) throw new IOException("wait failure");
            return ExitNaturally || (Killed && ConfirmKill);
        }
        public void Kill() => Killed = true;
        public TaskbarList.CallTrace ReadTrace()
        {
            if (ThrowRead) throw new IOException("bad worker protocol");
            return new(new(0, true, "DeleteTab", null), new(0, true, "HrInit", null), new(0, true, "DeleteTab", null));
        }
        public void Dispose() => Disposed = true;
    }
    private static TaskbarQaOptions.Result Options(string path) => TaskbarQaOptions.Extract([
        "--taskbar-qa", "--taskbar-hwnd", "42", "--taskbar-pid", "7", "--taskbar-start", Start.ToString("O"),
        "42", path, "25", "30", "memory", "--owned-location", Location]);

    public static void Run(Action<string, bool, string?> report)
    {
        void Check(string name, bool ok) => report(name, ok, ok ? null : "regression failed");
        var oldExit = Environment.ExitCode;
        var evidence = Environment.GetEnvironmentVariable("WM_TASKBAR_SELFTEST_OUT");
        var root = Path.Combine(evidence is null ? Path.GetTempPath() : Path.GetDirectoryName(Path.GetFullPath(evidence))!,
            "runtime-cases-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            // The same outer finally skeleton is separately checked against generated Program.
            foreach (var phase in new[] { "EnsureDefaultDesktop", "StreamSetup", "CreateDevice", "CreateItem", "CreateFramePool", "CreateSession", "StartCapture", "Publish", "Normal", "ParentStop" })
            {
                Environment.ExitCode = 0;
                var probe = new Probe(); var records = new List<TaskbarActionRecord>(); int closeCalls = 0;
                var runtime = TaskbarQaRuntime.CreateOffline(Options(root), probe, Location, root,
                    () => { closeCalls++; probe.Exists = false; return new("closed", true, 0, null); }, records.Add);
                try { if (phase != "Normal") throw new IOException(phase); }
                catch (IOException) { }
                finally { runtime.Finish(); }
                runtime.Finish();
                Check("R1 " + phase + " closes exactly once with truthful cleanup", closeCalls == 1
                    && !probe.Exists && TaskbarHideStrategy.Serialize(records[^1]).Contains("\"closed\":true"));
            }
            var dead = new Probe { Exists = false }; int deadCloses = 0;
            var deadRecords = new List<TaskbarActionRecord>();
            var deadRuntime = TaskbarQaRuntime.CreateOffline(Options(root), dead, Location, root,
                () => { deadCloses++; return new("closed", true, 0, null); }, deadRecords.Add);
            deadRuntime.Finish();
            Check("R1 missing target never invokes name-based close", deadCloses == 0
                && TaskbarHideStrategy.Serialize(deadRecords[^1]).Contains("already-gone"));
            Environment.ExitCode = 0;
            var changedProbe = new Probe(); int changedCloses = 0;
            var changedRuntime = TaskbarQaRuntime.CreateOffline(Options(root), changedProbe, Location, root,
                () => { changedCloses++; return new("closed", true, 0, null); }, _ => { });
            changedProbe.Changed = true; changedRuntime.Finish();
            Check("R1 changed identity blocks actual runtime close", changedCloses == 0 && Environment.ExitCode != 0);
            var notOwnedRecords = new List<TaskbarActionRecord>();
            var notOwned = TaskbarQaRuntime.CreateOffline(Options(root), new Probe(), Location, root,
                () => throw new Exception("must not close"), notOwnedRecords.Add, takeOwnership: false);
            notOwned.Finish();
            Check("R1 unowned run reports closed unknown", TaskbarHideStrategy.Serialize(notOwnedRecords[^1]).Contains("\"closed\":null"));

            Environment.ExitCode = 0;
            int unsafeCloses = 0;
            var unsafeRuntime = TaskbarQaRuntime.CreateOffline(Options(root), new Probe(), Location, root,
                () => { unsafeCloses++; return new("closed", true, 0, null); }, _ => { });
            unsafeRuntime.TakeOwnership();
            unsafeRuntime.Strategy.Execute = _ => Execution.FromWorker(new(TaskbarList.CallTrace.NotCalled("Worker", "unknown"),
                true, false, true, false, true, false, "unknown"));
            unsafeRuntime.AfterFrame(1, 6, "fake", 0, 33, true, false);
            unsafeRuntime.SettlePendingAction(5000, requestStop: false);
            unsafeRuntime.Finish();
            Check("R2 unconfirmed worker blocks real runtime close and exits nonzero", unsafeCloses == 0 && Environment.ExitCode != 0);

            Environment.ExitCode = 0;
            int thrownCloses = 0;
            var thrown = TaskbarQaRuntime.CreateOffline(Options(root), new Probe(), Location, root,
                () => { thrownCloses++; return new("closed", true, 0, null); }, _ => { });
            thrown.TakeOwnership(); thrown.Strategy.Execute = _ => throw new IOException("executor threw after start");
            try { thrown.AfterFrame(1, 6, "fake", 0, 33, true, false); thrown.SettlePendingAction(5000, requestStop: false); } catch (IOException) { }
            thrown.Finish();
            Check("R2 executor exception cannot bypass worker gate", thrownCloses == 0 && Environment.ExitCode != 0);

            var request = new TaskbarList.WorkerRequest("fake", 42, 7, Start.ToString("O"), Location, 100, "fake-stop.txt");
            foreach (var scenario in new[] { "timeout", "cancel", "wait-exception", "start-exception", "unconfirmed", "protocol-failure", "success", "stop-before-start", "start-refused", "assign-failure" })
            {
                var worker = new Worker { ThrowWait = scenario == "wait-exception", ThrowStart = scenario == "start-exception",
                    RefuseStart = scenario == "start-refused", ThrowBind = scenario == "assign-failure",
                    ConfirmKill = scenario != "unconfirmed", ExitNaturally = scenario is "success" or "protocol-failure", ThrowRead = scenario == "protocol-failure" };
                var outcome = TaskbarWorker.Run(request, () => scenario == "stop-before-start" || (scenario == "cancel" && worker.Elapsed >= 50),
                    () => worker, () => worker.Elapsed);
                Check("R2 worker monitor " + scenario, scenario switch
                {
                    "timeout" => outcome.TimedOut && outcome.Exited && outcome.Terminated && worker.Killed && worker.Disposed,
                    "cancel" => outcome.Cancelled && outcome.Exited && outcome.Terminated && worker.Killed,
                    "wait-exception" or "start-exception" => outcome.Exited && worker.Killed && outcome.Error is not null,
                    "unconfirmed" => !outcome.CleanupSafe && !outcome.Exited && worker.Killed,
                    "protocol-failure" => outcome.Exited && !outcome.Trace.Result.Succeeded && !worker.Killed,
                    "success" => outcome.Exited && outcome.Trace.HrInit?.Succeeded == true && outcome.Trace.DeleteTab?.Succeeded == true,
                    "start-refused" => !outcome.Started && !outcome.Exited && outcome.CleanupSafe && !worker.Killed && outcome.Error is not null,
                    "assign-failure" => outcome.Started && outcome.Exited && outcome.TerminationRequested && outcome.Terminated && worker.Killed && outcome.Error is not null,
                    _ => outcome.Cancelled && !outcome.Started && !worker.Started && outcome.CleanupSafe,
                });
            }

            // Supervision & worker entry gate checks: missing or exited parent refuses verify and COM
            {
                bool verifyReached = false;
                string? workerReport = null;
                int exitCode = TaskbarList.RunWorkerEntry(
                    ["--taskbar-worker", "42", "7", Start.ToString("O"), Location, "fake-stop.txt"],
                    () => { verifyReached = true; return (true, "ok"); },
                    () => true,
                    report => workerReport = report);
                Check("F1 worker entry refuses verify when stop requested or parent lost",
                    exitCode == 1 && !verifyReached && workerReport is not null && workerReport.Contains("parent-process-"));
            }

            // Barrier check: worker refuses when parent supervision is not authorized
            {
                bool verifyReached = false;
                string? workerReport = null;
                int exitCode = TaskbarList.RunWorkerEntry(
                    ["--taskbar-worker", "42", "7", Start.ToString("O"), Location, Path.Combine(root, "unauthorized-stop.txt")],
                    () => { verifyReached = true; return (true, "ok"); },
                    () => false,
                    report => workerReport = report);
                Check("F1 worker entry refuses verify and action when parent supervision not authorized",
                    exitCode == 1 && !verifyReached && workerReport is not null && workerReport.Contains("parent-supervision-not-authorized"));
            }

            // Exercise the production runtime called from the one-second capture status branch.
            // A periodic observation must not enumerate windows or grant permission to close a source.
            {
                var productionOutput = Path.Combine(root, "production-periodic-status");
                Directory.CreateDirectory(productionOutput);
                var statusProbe = new Probe();
                var constructor = typeof(TaskbarHideRuntime).GetConstructors(
                    System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic).Single();
                var production = (TaskbarHideRuntime)constructor.Invoke([
                    new TaskbarHideOptions(true, 42, 7, Start, 10), statusProbe, Location,
                    productionOutput, (Func<double>)(() => 0)]);
                production.CaptureInitialState();
                statusProbe.InspectCalls = 0;
                statusProbe.Changed = true;
                var periodic = Enumerable.Range(0, 4)
                    .Select(_ => JsonSerializer.SerializeToElement(production.GetStatus())).ToArray();
                Check("C1 production periodic status performs no window/process verification", statusProbe.InspectCalls == 0);
                Check("C1 production periodic status keeps source-close authorization unknown",
                    periodic.All(value => value.TryGetProperty("cleanupSafe", out var safe) && safe.ValueKind == JsonValueKind.Null
                        && value.TryGetProperty("workerCleanupSafe", out var worker) && worker.GetBoolean()));
                statusProbe.InspectCalls = 0;
                var rejected = JsonSerializer.SerializeToElement(production.GetSummary());
                Check("C1 production final Summary rechecks and rejects changed identity",
                    statusProbe.InspectCalls == 1 && !rejected.GetProperty("cleanupSafe").GetBoolean());
                statusProbe.Changed = false;
                production.Finish();
                statusProbe.InspectCalls = 0;
                var final = JsonSerializer.SerializeToElement(production.GetSummary());
                Check("C1 production final Summary freshly confirms early-stop cleanup",
                    statusProbe.InspectCalls == 1 && final.GetProperty("cleanupSafe").GetBoolean()
                        && final.GetProperty("stage").GetString() == "stopped-before-action");
            }

            Environment.ExitCode = 0;
            var path = Path.Combine(root, "taskbar-action.json");
            using (new FileStream(path, FileMode.CreateNew)) { }
            int lockedCloses = 0;
            var locked = TaskbarQaRuntime.CreateOffline(Options(root), new Probe(), Location, path,
                () => { lockedCloses++; return new("closed", true, 0, null); }, record => TaskbarQaRuntime.WriteFile(path, record));
            locked.TakeOwnership(); locked.WriteReport();
            using (var readLock = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read)) locked.Finish();
            Check("R3 existing report then write failure still cleans and fails exit", lockedCloses == 1 && locked.ReportFailed && Environment.ExitCode != 0);
            var original = File.ReadAllText(path); bool refused = false;
            var oldOptions = Options(root);
            try { TaskbarQaRuntime.Create(oldOptions, oldOptions.Remaining, CaptureArguments.Parse(oldOptions.Remaining)); }
            catch (IOException) { refused = true; }
            Check("R3 actual runtime refuses pre-existing evidence before native access", refused && File.ReadAllText(path) == original);

            foreach (var scenario in new[] { "success", "init-failure", "verify-before", "verify-after", "stop-after", "delete-failure", "delete-exception", "release-after-delete", "release-before-delete" })
            {
                var calls = new Calls { Init = scenario is "init-failure" or "release-before-delete" ? unchecked((int)0x80004005) : 0,
                    Delete = scenario == "delete-failure" ? unchecked((int)0x80070005) : 0, ThrowDelete = scenario == "delete-exception",
                    ThrowRelease = scenario is "release-after-delete" or "release-before-delete" };
                int verifies = 0;
                var trace = TaskbarList.ExecuteCalls(() => calls, 42,
                    () => (++verifies == (scenario == "verify-before" ? 1 : scenario == "verify-after" ? 2 : -1) ? (false, "identity-changed") : (true, "ok")),
                    () => scenario == "stop-after" && calls.Sequence.Contains("HrInit"));
                var wire = JsonSerializer.Deserialize<TaskbarList.CallTrace>(JsonSerializer.Serialize(trace))!;
                var execution = Execution.FromWorker(new(wire, true, true, false, false, false, false, null));
                bool deleteReached = scenario is "success" or "delete-failure" or "delete-exception" or "release-after-delete";

                var stRecords = new List<TaskbarActionRecord>();
                var st = new TaskbarHideStrategy(Options(root), new Probe(), () => 0, stRecords.Add, Location) { Execute = _ => execution };
                st.CaptureInitialState();
                st.OnFrame(new(1, 6.0, true, "HASH", 33.0, true, false));
                var stRecord = stRecords[^1];
                var stFailureJson = stRecord.Failure is null ? "" : JsonSerializer.Serialize(stRecord.Failure);
                string expectedStage = scenario switch
                {
                    "success" => "",
                    "init-failure" => "hr-init",
                    "verify-before" or "verify-after" or "stop-after" => "verify",
                    "delete-failure" or "delete-exception" => "delete-tab",
                    "release-after-delete" or "release-before-delete" => "release",
                    _ => "unknown"
                };
                bool stageMatches = scenario == "success" ? stRecord.Failure is null : stFailureJson.Contains($"\"stage\":\"{expectedStage}\"");
                bool notesTruthful = deleteReached
                    ? !stRecord.Notes.Any(n => n.Contains("DeleteTab was not attempted"))
                    : !stRecord.Notes.Any(n => n.Contains("DeleteTab failed"));

                Check("R3 shared COM flow and worker protocol " + scenario,
                    (execution.HrInit is not null) == (scenario != "verify-before")
                    && (execution.DeleteTab is not null) == deleteReached
                    && trace.Result.Succeeded == (scenario == "success")
                    && (scenario == "verify-before" || calls.Released)
                    && calls.Sequence.Count(value => value == "DeleteTab") == (deleteReached ? 1 : 0)
                    && stageMatches && notesTruthful);
            }

            // --- C1 non-blocking runtime checks: multi-frame continuation while pending + F1/F2/F3 seams + concurrent stop/exception/unconfirmed gates ---
            static double SourceTimeMs() => System.Diagnostics.Stopwatch.GetTimestamp() * 1000.0 / System.Diagnostics.Stopwatch.Frequency;
            static long NowUnixMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            {
                Environment.ExitCode = 0;
                using var startedGate = new ManualResetEventSlim(false);
                using var releaseGate = new ManualResetEventSlim(false);
                var nbProbe = new Probe();
                var nbRecords = new List<TaskbarActionRecord>();
                int nbCloses = 0, nbWorkerStarts = 0;
                var runtimeClock = 6.30; // +1.20s runtime clock offset relative to 5.10s capture clock
                TaskbarQaRuntime? nbRuntime = null;
                nbRuntime = TaskbarQaRuntime.CreateOffline(Options(root), nbProbe, Location, root,
                    () => { nbCloses++; nbProbe.Exists = false; return new("closed", true, 0, null); }, nbRecords.Add,
                    runtimeClockSeconds: () => runtimeClock);
                nbRuntime.Strategy.Execute = _ =>
                {
                    Interlocked.Increment(ref nbWorkerStarts);
                    nbRuntime!.Strategy.NotifyWorkerStarted();
                    startedGate.Set();
                    releaseGate.Wait(5000);
                    return Execution.FromWorker(new(
                        new(new(0, true, "DeleteTab", null), new(0, true, "HrInit", null), new(0, true, "DeleteTab", null)),
                        true, true, false, false, false, false, null));
                };
                var triggerDecision = nbRuntime.AfterFrame(214, 5.10, "H214", NowUnixMs(), SourceTimeMs(), true, false);
                bool enteredPending = startedGate.Wait(2000);
                var f215 = nbRuntime.AfterFrame(215, 5.13, "H215", NowUnixMs(), SourceTimeMs(), true, false);
                var f216 = nbRuntime.AfterFrame(216, 5.16, "H216", NowUnixMs(), SourceTimeMs(), true, false);
                var f217 = nbRuntime.AfterFrame(217, 5.20, "H217", NowUnixMs(), SourceTimeMs(), true, false);
                bool pendingStateOk = triggerDecision.Kind == "action-pending" && enteredPending && nbRuntime.IsActionPending
                    && f215.Kind == "action-pending" && f216.Kind == "action-pending" && f217.Kind == "action-pending"
                    && nbRuntime.Strategy.FramesWhilePending == 3 && nbWorkerStarts == 1;

                // Frame 218 is acquired BEFORE worker completion, then published AFTER completion (F1 counterexample).
                var f218AcquiredBeforeCompletionMs = SourceTimeMs();
                var f218CapturedAt = NowUnixMs();
                Thread.Sleep(15);
                runtimeClock = 6.55; // +0.25s elapsed since trigger -> completedAtSeconds = 5.10 + 0.25 = 5.35s (not 6.55s!)
                releaseGate.Set();
                var settledDecision = nbRuntime.SettlePendingAction(5000, requestStop: false);
                var beforePostFrameJson = TaskbarHideStrategy.Serialize(nbRecords[^1]);
                var f218InFlight = nbRuntime.AfterFrame(218, 5.36, "H218-INFLIGHT", f218CapturedAt, f218AcquiredBeforeCompletionMs, true, false);
                var afterInFlightJson = TaskbarHideStrategy.Serialize(nbRecords[^1]);
                var f219Fresh = nbRuntime.AfterFrame(219, 5.40, "H219-FRESH", NowUnixMs(), SourceTimeMs(), true, false);
                nbRuntime.Finish();
                var finalNbJson = TaskbarHideStrategy.Serialize(nbRecords[^1]);
                Check("C1 non-blocking runtime publishes frames while worker is pending and records postActionFrame only after completion",
                    pendingStateOk && settledDecision.Kind == "acted"
                    && f218InFlight.Kind == "pre-action-frame" && f219Fresh.Kind == "already-done"
                    && beforePostFrameJson.Contains("\"postActionFrame\":null", StringComparison.Ordinal)
                    && afterInFlightJson.Contains("\"postActionFrame\":null", StringComparison.Ordinal)
                    && afterInFlightJson.Contains("\"preCompletionFramesPublishedAfter\":1", StringComparison.Ordinal)
                    && finalNbJson.Contains("\"framesWhilePending\":3", StringComparison.Ordinal)
                    && finalNbJson.Contains("\"triggeredAtSeconds\":5.1", StringComparison.Ordinal)
                    && finalNbJson.Contains("\"runtimeClockOffsetSeconds\":1.2", StringComparison.Ordinal)
                    && finalNbJson.Contains("\"completedAtSeconds\":5.35", StringComparison.Ordinal)
                    && finalNbJson.Contains("\"completedAfterFrameSequence\":217", StringComparison.Ordinal)
                    && finalNbJson.Contains("\"postActionFrame\":{\"sequence\":219,", StringComparison.Ordinal)
                    && finalNbJson.Contains("\"hash\":\"H219-FRESH\"", StringComparison.Ordinal)
                    && nbCloses == 1 && nbWorkerStarts == 1 && Environment.ExitCode == 0);
            }

            // F3 runtime seam check: blocked in pre-action Inspect reports started=null while pending, and stop before Execute cancels cleanly.
            foreach (var cancelBeforeExec in new[] { false, true })
            {
                Environment.ExitCode = 0;
                using var inspectEntered = new ManualResetEventSlim(false);
                using var releaseInspect = new ManualResetEventSlim(false);
                int closeCalls = 0, execCalls = 0;
                var f3Records = new List<TaskbarActionRecord>();
                var f3Probe = new BlockingProbe(inspectEntered, releaseInspect);
                var f3Runtime = TaskbarQaRuntime.CreateOffline(Options(root), f3Probe, Location, root,
                    () => { closeCalls++; f3Probe.Exists = false; return new("closed", true, 0, null); }, f3Records.Add,
                    runtimeClockSeconds: () => 6.2);
                f3Runtime.Strategy.Execute = _ =>
                {
                    Interlocked.Increment(ref execCalls);
                    return Execution.FromWorker(TaskbarWorker.Run(
                        new("fake", 42, 7, Start.ToString("O"), Location, 30_000, "fake-stop.txt"),
                        () => f3Runtime.IsStopRequested,
                        () => new Worker { ExitNaturally = true },
                        onStarted: f3Runtime.Strategy.NotifyWorkerStarted));
                };
                f3Probe.BlockNextInspect = true;
                var dPending = f3Runtime.AfterFrame(30, 5.0, "H30", NowUnixMs(), SourceTimeMs(), true, false);
                bool blockedInInspect = inspectEntered.Wait(2000);
                var pendingWhileInspectJson = TaskbarHideStrategy.Serialize(f3Records[^1]);
                bool pendingFactsOk = dPending.Kind == "action-pending" && blockedInInspect && execCalls == 0
                    && pendingWhileInspectJson.Contains("\"actionScheduled\":true", StringComparison.Ordinal)
                    && pendingWhileInspectJson.Contains("\"executorEntered\":false", StringComparison.Ordinal)
                    && pendingWhileInspectJson.Contains("\"started\":null", StringComparison.Ordinal)
                    && pendingWhileInspectJson.Contains("\"exited\":null", StringComparison.Ordinal);
                if (cancelBeforeExec) f3Runtime.RequestStop();
                releaseInspect.Set();
                if (!cancelBeforeExec) f3Runtime.SettlePendingAction(5000, requestStop: false);
                f3Runtime.Finish();
                var finalF3Json = TaskbarHideStrategy.Serialize(f3Records[^1]);
                Check("C1 F3 runtime pre-action Inspect " + (cancelBeforeExec ? "cancelled-before-execute" : "executes-after-inspect"),
                    pendingFactsOk && closeCalls == 1 && !f3Probe.Exists && Environment.ExitCode == 0
                    && (cancelBeforeExec
                        ? execCalls == 0 && finalF3Json.Contains("\"started\":false", StringComparison.Ordinal) && finalF3Json.Contains("\"cancelled\":true", StringComparison.Ordinal)
                        : execCalls == 1 && finalF3Json.Contains("\"started\":true", StringComparison.Ordinal) && finalF3Json.Contains("\"exited\":true", StringComparison.Ordinal)));
            }

            foreach (var stopKind in new[] { "duration-expiry", "bound-stop", "frame-stop", "capture-exception" })
            {
                Environment.ExitCode = 0;
                using var startedGate = new ManualResetEventSlim(false);
                var stopProbe = new Probe();
                var stopRecords = new List<TaskbarActionRecord>();
                int stopCloses = 0, workerStarts = 0;
                bool externalStop = false;
                BlockingWorker? activeWorker = null;
                var stopRuntime = TaskbarQaRuntime.CreateOffline(Options(root), stopProbe, Location, root,
                    () => { stopCloses++; stopProbe.Exists = false; return new("closed", true, 0, null); }, stopRecords.Add);
                stopRuntime.BindStop(() => Volatile.Read(ref externalStop));
                stopRuntime.Strategy.Execute = _ => Execution.FromWorker(TaskbarWorker.Run(
                    new("fake", 42, 7, Start.ToString("O"), Location, 30_000, "fake-stop.txt"),
                    () => stopRuntime.IsStopRequested,
                    () =>
                    {
                        Interlocked.Increment(ref workerStarts);
                        activeWorker = new BlockingWorker(startedGate, confirmKill: true);
                        return activeWorker;
                    }));
                try
                {
                    var dTrigger = stopRuntime.AfterFrame(10, 5.5, "H10", 0, 330, true, false);
                    if (!startedGate.Wait(2000) || dTrigger.Kind != "action-pending")
                        throw new InvalidOperationException("worker did not enter pending state");
                    stopRuntime.AfterFrame(11, 5.53, "H11", 0, 363, true, false);
                    if (stopKind == "bound-stop") Volatile.Write(ref externalStop, true);
                    if (stopKind == "frame-stop") stopRuntime.AfterFrame(12, 5.56, "H12", 0, 396, true, stopRequested: true);
                    if (stopKind == "capture-exception") throw new IOException("simulated capture failure while worker pending");
                }
                catch (IOException) when (stopKind == "capture-exception") { }
                finally
                {
                    stopRuntime.Finish();
                }
                var stopJson = TaskbarHideStrategy.Serialize(stopRecords[^1]);
                Check("C1 non-blocking pending worker settles and cleans up on " + stopKind,
                    workerStarts == 1 && activeWorker is not null && activeWorker.Killed && activeWorker.Disposed
                    && stopCloses == 1 && !stopProbe.Exists
                    && stopJson.Contains("\"cancelled\":true", StringComparison.Ordinal)
                    && stopJson.Contains("\"terminated\":true", StringComparison.Ordinal)
                    && stopJson.Contains("\"closed\":true", StringComparison.Ordinal)
                    && Environment.ExitCode == 0);
            }

            foreach (var unconfirmedKind in new[] { "kill-unconfirmed", "settle-timeout" })
            {
                Environment.ExitCode = 0;
                using var startedGate = new ManualResetEventSlim(false);
                using var unblockAbandoned = new ManualResetEventSlim(false);
                var badProbe = new Probe();
                var badRecords = new List<TaskbarActionRecord>();
                int badCloses = 0;
                var badRuntime = TaskbarQaRuntime.CreateOffline(Options(root), badProbe, Location, root,
                    () => { badCloses++; badProbe.Exists = false; return new("closed", true, 0, null); }, badRecords.Add);
                if (unconfirmedKind == "settle-timeout") badRuntime.SettleTimeoutMs = 80;
                badRuntime.Strategy.Execute = _ =>
                {
                    if (unconfirmedKind == "settle-timeout")
                    {
                        startedGate.Set();
                        unblockAbandoned.Wait(5000);
                        return Execution.FromWorker(new(
                            new(new(0, true, "DeleteTab", null), new(0, true, "HrInit", null), new(0, true, "DeleteTab", null)),
                            true, true, false, false, false, false, null));
                    }
                    return Execution.FromWorker(TaskbarWorker.Run(
                        new("fake", 42, 7, Start.ToString("O"), Location, 30_000, "fake-stop.txt"),
                        () => badRuntime.IsStopRequested,
                        () => new BlockingWorker(startedGate, confirmKill: false)));
                };
                badRuntime.AfterFrame(20, 6.0, "H20", 0, 660, true, false);
                startedGate.Wait(2000);
                badRuntime.AfterFrame(21, 6.03, "H21", 0, 693, true, false);
                badRuntime.Finish();
                unblockAbandoned.Set();
                Thread.Sleep(50);
                var badJson = TaskbarHideStrategy.Serialize(badRecords[^1]);
                Check("C1 non-blocking unconfirmed pending worker refuses close (" + unconfirmedKind + ")",
                    badCloses == 0 && badProbe.Exists && Environment.ExitCode != 0
                    && badRecords[^1].Stage == "action-unconfirmed"
                    && badJson.Contains("\"outcome\":\"not-confirmed\"", StringComparison.Ordinal)
                    && badJson.Contains("\"closed\":false", StringComparison.Ordinal));
            }
        }
        finally { Environment.ExitCode = oldExit; }
    }

    private sealed class BlockingWorker(ManualResetEventSlim startedGate, bool confirmKill) : ITaskbarWorkerProcess
    {
        private readonly ManualResetEventSlim _killedGate = new(false);
        public bool Killed { get; private set; }
        public bool Disposed { get; private set; }
        public bool Start(TaskbarList.WorkerRequest request)
        {
            startedGate.Set();
            return true;
        }
        public bool WaitForExit(int ms)
        {
            if (!Killed)
            {
                _killedGate.Wait(Math.Min(ms, 25));
                return false;
            }
            return confirmKill;
        }
        public void Kill()
        {
            Killed = true;
            _killedGate.Set();
        }
        public TaskbarList.CallTrace ReadTrace() =>
            new(new(0, true, "DeleteTab", null), new(0, true, "HrInit", null), new(0, true, "DeleteTab", null));
        public void Dispose()
        {
            Disposed = true;
            _killedGate.Dispose();
        }
    }

    private sealed class BlockingProbe(ManualResetEventSlim inspectEntered, ManualResetEventSlim releaseInspect) : IWindowProbe
    {
        public bool Exists = true;
        public bool BlockNextInspect;
        public IReadOnlyList<WindowCandidate> FindByExactTitle(string location) => [];
        public WindowSnapshot Inspect(long hwnd)
        {
            if (BlockNextInspect)
            {
                BlockNextInspect = false;
                inspectEntered.Set();
                releaseInspect.Wait(5000);
            }
            return new(hwnd, 7, "wallpaper64", Location, Exists, true, false, false,
                0, 0, 100, 100, 0, 0, 0, 0, Start, 0);
        }
    }
}
