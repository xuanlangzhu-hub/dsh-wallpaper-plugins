using System.Reflection;
using System.Text.Json;

// Frozen production classes; window inspection, Shell execution and time are injected.
// No capture, COM initialization, window enumeration or worker process is executed.
var results = new List<object>();
var failed = 0;
void Check(string name, bool ok) { results.Add(new { name, ok }); if (!ok) failed++; }
var start = DateTimeOffset.Parse("2026-10-28T00:00:00Z");
var location = "WhaleWallpaperProbe-taskbar-offline";

// The production factory constructs a deferred worker closure; don't run that closure,
// don't inspect its real probe, don't call CaptureInitialState/Finish/CanCloseOwned.
var runtime = TaskbarHideRuntime.Create(4242, 777, start, location, Path.GetFullPath("unused-output"));
var optionsField = typeof(TaskbarHideStrategy).GetField("_options", BindingFlags.NonPublic | BindingFlags.Instance)!;
var productionOptions = (TaskbarHideOptions)optionsField.GetValue(runtime.Strategy)!;
Check("production factory removes the experimental ten-second delay", productionOptions.MinSeconds == 0);

(TaskbarHideStrategy Strategy, FakeProbe Probe, List<TaskbarActionRecord> Records, Counter Calls) Make(int minSeconds)
{
    var probe = new FakeProbe(new WindowSnapshot(4242, 777, "wallpaper64", location, true, true, false, false,
        4096, 0, 1280, 720, 0, 0x100, 0, 0, start, 0));
    var records = new List<TaskbarActionRecord>();
    var calls = new Counter();
    var strategy = new TaskbarHideStrategy(productionOptions with { MinSeconds = minSeconds }, probe, () => 20,
        records.Add, location)
    {
        SourceClockMs = () => 10000,
        Execute = _ => { Interlocked.Increment(ref calls.Count); return Execution.FromResult(new TaskbarList.Result(0, true, "DeleteTab", null)); }
    };
    strategy.CaptureInitialState();
    return (strategy, probe, records, calls);
}
FrameObservation Frame(long sequence, double seconds, bool encoded = true, bool published = true, bool stop = false) =>
    new(sequence, seconds, encoded, encoded ? "ABC" : null, 10000 + sequence, published, stop, 1700000000000 + sequence);

// Positive control retains the historical experiment's baseline independently of production.
var baseline = Make(10);
Check("baseline first published frame does not trigger at 50ms", baseline.Strategy.OnFrame(Frame(1, .05)).Kind == "waiting" && baseline.Calls.Count == 0);
Check("baseline remains waiting at 9.999 seconds", baseline.Strategy.OnFrame(Frame(2, 9.999)).Kind == "waiting" && baseline.Calls.Count == 0);
baseline.Strategy.OnFrame(Frame(3, 10));
Check("baseline triggers once at ten seconds", baseline.Calls.Count == 1 && baseline.Strategy.Attempted);
baseline.Strategy.OnFrame(Frame(4, 10.1));
Check("baseline does not repeat on later frames", baseline.Calls.Count == 1);
var text = TaskbarHideStrategy.Serialize(baseline.Records.Last());
using (var doc = JsonDocument.Parse(text))
    Check("fake Shell success does not claim visual taskbar hidden", doc.RootElement.GetProperty("taskbarHidden").ValueKind == JsonValueKind.Null);

var noEncode = Make(productionOptions.MinSeconds);
Check("proposed first-frame gate still rejects unencoded input", noEncode.Strategy.OnFrame(Frame(1, 12, encoded:false)).Kind == "skipped" && !noEncode.Strategy.Attempted);
var unpublished = Make(productionOptions.MinSeconds);
Check("proposed first-frame gate still rejects unpublished input", unpublished.Strategy.OnFrame(Frame(1, .05, published:false)).Kind == "waiting" && !unpublished.Strategy.Attempted);
var stopped = Make(productionOptions.MinSeconds);
Check("proposed first-frame gate honours stop before dispatch", stopped.Strategy.OnFrame(Frame(1, .05, stop:true)).Kind == "stopped" && stopped.Calls.Count == 0);
var hidden = Make(productionOptions.MinSeconds); hidden.Probe.State = hidden.Probe.State with { Visible = false };
Check("proposed first-frame gate refuses a hidden source", hidden.Strategy.OnFrame(Frame(1, .05)).Kind == "blocked" && hidden.Calls.Count == 0);
var gone = Make(productionOptions.MinSeconds); gone.Probe.Failure = "identity-changed (injected IO boundary)";
Check("proposed first-frame gate refuses probe verification failure", gone.Strategy.OnFrame(Frame(1, .05)).Kind == "blocked" && gone.Calls.Count == 0);
var early = Make(productionOptions.MinSeconds); early.Strategy.OnFrame(Frame(1, .05));
Check("proposed configuration can trigger at first published frame", early.Calls.Count == 1);
early.Strategy.OnFrame(Frame(2, .1));
Check("proposed configuration still performs only one action", early.Calls.Count == 1);

using var entered = new ManualResetEventSlim();
using var release = new ManualResetEventSlim();
var pending = Make(productionOptions.MinSeconds);
pending.Strategy.Execute = _ => {
    Interlocked.Increment(ref pending.Calls.Count); entered.Set();
    if (!release.Wait(1500)) throw new TimeoutException("offline executor release deadline");
    return Execution.FromResult(new TaskbarList.Result(0, true, "DeleteTab", null));
};
try {
    Check("async entry returns pending before simulated Shell completes", pending.Strategy.OnFrameAsync(Frame(1, .05)).Kind == "action-pending" && entered.Wait(1000));
    Check("later frame continues while action pending", pending.Strategy.OnFrameAsync(Frame(2, .1)).Kind == "action-pending" && pending.Strategy.FramesWhilePending == 1);
    Check("unconfirmed action blocks source cleanup", !pending.Strategy.CanCloseOwned().Allowed);
} finally { release.Set(); pending.Strategy.SettlePending(1500, requestStop:false); }
Check("released fake action settles once", pending.Calls.Count == 1 && !pending.Strategy.IsActionPending);

// Re-enter the production Runtime.AfterFrame/Finish/Summary path. The private constructor only
// substitutes its IWindowProbe and clock; options come unchanged from the public production factory.
TaskbarHideRuntime Runtime(FakeProbe probe, Func<long, Execution> execute)
{
    var ctor = typeof(TaskbarHideRuntime).GetConstructors(BindingFlags.Instance | BindingFlags.NonPublic).Single();
    var directory = Path.Combine(AppContext.BaseDirectory, "cases", Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(directory);
    var value = (TaskbarHideRuntime)ctor.Invoke([productionOptions, probe, location, directory, (Func<double>)(() => .05)]);
    value.Strategy.Execute = execute;
    value.CaptureInitialState();
    return value;
}
var rp = Make(productionOptions.MinSeconds).Probe;
int runtimeCalls = 0;
var wired = Runtime(rp, _ => { Interlocked.Increment(ref runtimeCalls); return Execution.FromResult(new(0, true, "DeleteTab", null)); });
Check("Runtime.AfterFrame skips null encoded hash", wired.AfterFrame(1, .01, null, 10001, 1, true, false).Kind == "skipped" && runtimeCalls == 0);
Check("Runtime.AfterFrame waits for publication", wired.AfterFrame(2, .02, "ABC", 10002, 2, false, false).Kind == "waiting" && runtimeCalls == 0);
var first = wired.AfterFrame(3, .05, "ABC", 10003, 3, true, false);
if (first.Kind == "action-pending") wired.SettlePending(1000);
Check("Runtime.AfterFrame dispatches first published frame using factory options", first.Kind == "action-pending" && runtimeCalls == 1);
var beforeStatus = rp.Inspections;
_ = wired.GetStatus();
Check("Runtime.GetStatus does not inspect windows", rp.Inspections == beforeStatus);
wired.Finish(); wired.Finish();
Check("Runtime.Finish preserves confirmed result and performs no second action", runtimeCalls == 1 && wired.CanCloseOwned().Allowed);
rp.Failure = "identity-changed";
Check("Runtime summary refuses cleanup when identity probe fails", !JsonSerializer.SerializeToElement(wired.GetSummary()).GetProperty("cleanupSafe").GetBoolean());
var beforeStart = Runtime(Make(productionOptions.MinSeconds).Probe, _ => throw new Exception("must not execute"));
beforeStart.BindStop(() => true);
Check("Runtime bound stop prevents first-frame dispatch", beforeStart.AfterFrame(1, .05, "ABC", 1, 1, true, false).Kind == "stopped");
beforeStart.Finish();
Check("Runtime pre-action finish is safely terminal", beforeStart.Strategy.Stage == "stopped-before-action" && beforeStart.CanCloseOwned().Allowed);

// The real strategy must not turn a result that arrives after timeout into cleanup permission.
using var lateEntered = new ManualResetEventSlim();
using var lateRelease = new ManualResetEventSlim();
var late = Make(0); // independent terminal-protocol check, also runs in the red control
late.Strategy.Execute = _ => {
    lateEntered.Set();
    if (!lateRelease.Wait(1500)) throw new TimeoutException("late executor deadline");
    return Execution.FromResult(new(0, true, "DeleteTab", null));
};
try {
    late.Strategy.OnFrameAsync(Frame(1, .05));
    Check("late-result executor entered before deadline", lateEntered.Wait(1000));
    Check("settle timeout remains unconfirmed", late.Strategy.SettlePending(20).Kind == "action-unconfirmed" && !late.Strategy.CanCloseOwned().Allowed);
} finally {
    lateRelease.Set();
    var pendingTask = (Task?)typeof(TaskbarHideStrategy).GetField("_pendingAction", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(late.Strategy);
    if (pendingTask is null || !pendingTask.Wait(1000)) throw new TimeoutException("late executor did not exit");
}
Check("late success cannot overwrite terminal uncertainty", late.Strategy.Stage == "action-unconfirmed" && !late.Strategy.CanCloseOwned().Allowed);

// Actual worker monitor and COM call ordering, with process/native IO injected. No process or COM.
foreach (var scenario in new[] { "success", "bad-protocol", "timeout", "cancel", "wait-exception", "post-start-exception", "unconfirmed", "stop-before-start", "start-refused" })
{
    var worker = new FakeWorker(scenario);
    var outcome = TaskbarWorker.Run(new("unused", 4242, 777, start.ToString("O"), location, 100, "unused-stop"),
        () => scenario == "stop-before-start" || (scenario == "cancel" && worker.Elapsed >= 50),
        () => worker, () => worker.Elapsed);
    bool ok = scenario switch {
        "success" => outcome.Exited && outcome.Trace.Result.Succeeded && !worker.Killed,
        "bad-protocol" => outcome.Exited && !outcome.Trace.Result.Succeeded,
        "timeout" => outcome.TimedOut && outcome.Exited && outcome.Terminated,
        "cancel" => outcome.Cancelled && outcome.Exited && outcome.Terminated,
        "wait-exception" or "post-start-exception" => outcome.Exited && worker.Killed && outcome.Error is not null,
        "unconfirmed" => !outcome.Exited && !outcome.CleanupSafe && worker.Killed,
        "start-refused" => !outcome.Started && outcome.CleanupSafe && !worker.Killed,
        _ => !outcome.Started && outcome.Cancelled && outcome.CleanupSafe && !worker.Started,
    };
    Check("real worker monitor: " + scenario, ok && (scenario == "stop-before-start" || worker.Disposed));
}
foreach (var scenario in new[] { "success", "init-failed", "identity-changed", "stop-after-init" })
{
    var calls = new FakeCalls(scenario);
    int verifyCount = 0, stopCount = 0;
    var trace = TaskbarList.ExecuteCalls(() => calls, 4242,
        () => (++verifyCount == 2 && scenario == "identity-changed" ? (false, "identity-changed") : (true, "ok")),
        () => ++stopCount == 2 && scenario == "stop-after-init");
    Check("real COM flow with native substitute: " + scenario,
        calls.Released && calls.Deleted == (scenario == "success" ? 1 : 0) && trace.Result.Succeeded == (scenario == "success"));
}
Console.WriteLine(JsonSerializer.Serialize(new { scope = "real frozen strategy; window/Shell IO substituted; no visual acceptance", count = results.Count, failed, results }, new JsonSerializerOptions { WriteIndented = true }));
Environment.ExitCode = failed == 0 ? 0 : 1;

sealed class Counter { public int Count; }
sealed class FakeProbe(WindowSnapshot state) : IWindowProbe {
    public WindowSnapshot State = state;
    public string? Failure;
    public int Inspections;
    public IReadOnlyList<WindowCandidate> FindByExactTitle(string location) => [new(State.Hwnd, State.Pid, State.Title)];
    public WindowSnapshot Inspect(long hwnd) { Interlocked.Increment(ref Inspections); if (Failure is not null) throw new InvalidOperationException(Failure); return State; }
}
sealed class FakeWorker(string scenario) : ITaskbarWorkerProcess {
    public long Elapsed;
    public bool Started, Killed, Disposed;
    public bool Start(TaskbarList.WorkerRequest request) {
        if (scenario == "start-refused") return false;
        Started = true;
        if (scenario == "post-start-exception") throw new IOException("injected post-start exception");
        return true;
    }
    public bool WaitForExit(int ms) {
        Elapsed += ms;
        if (scenario == "wait-exception" && !Killed) throw new IOException("injected wait exception");
        return scenario is "success" or "bad-protocol" || (Killed && scenario != "unconfirmed");
    }
    public void Kill() => Killed = true;
    public TaskbarList.CallTrace ReadTrace() {
        if (scenario == "bad-protocol") throw new IOException("injected malformed worker protocol");
        return new(new(0, true, "DeleteTab", null), new(0, true, "HrInit", null), new(0, true, "DeleteTab", null));
    }
    public void Dispose() => Disposed = true;
}
sealed class FakeCalls(string scenario) : TaskbarList.ICalls {
    public int Deleted;
    public bool Released;
    public int HrInit() => scenario == "init-failed" ? unchecked((int)0x80004005) : 0;
    public int DeleteTab(long hwnd) { Deleted++; return 0; }
    public void Dispose() => Released = true;
}
