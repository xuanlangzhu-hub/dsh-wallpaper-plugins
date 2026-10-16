// Offline integration: inspect the generated call sites, then compile and execute the EXACT outer
// catch/finally with fake initialization failures. No WGC/window/Shell operation is executed.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const { values } = parseArgs({ options: { build: { type: 'string' }, output: { type: 'string' } } });
if (!values.build || !values.output) throw Error('--build and fresh --output are required');
const root = resolve(values.output), build = resolve(values.build), here = dirname(fileURLToPath(import.meta.url));
await mkdir(root);
const program = await readFile(join(build, 'generated/Program.cs'), 'utf8');
const opener = 'TaskbarQaRuntime? taskbarQa = null;\ntry\n{';
const outerStart = program.indexOf(opener);
const catchStart = program.indexOf('\n}\ncatch (Exception error)\n{');
const tailEnd = program.indexOf('// The bounded frame log:');
assert(outerStart >= 0 && catchStart > outerStart && tailEnd > catchStart);
const tail = program.slice(catchStart, tailEnd);
assert(tail.includes('finally\n{\n    taskbarQa?.Finish();\n}'), 'cleanup must be in translation-unit finally');
const created = program.indexOf('taskbarQa = TaskbarQaRuntime.Create(taskbarOptions, args, acceptedRequest);');
assert(created > outerStart, 'TaskbarQaRuntime.Create must be inside outer try block');
assert(created < program.indexOf('Native.EnsureDefaultDesktop();'), 'creation must precede EnsureDefaultDesktop');
assert(created < program.indexOf('using var pipeOutput = '), 'creation must precede stream setup');
assert(created < program.indexOf('using var stopSignal = '), 'creation must precede cancellation setup');
assert(created < program.indexOf('var hwnd = (nint)handle;'), 'creation must precede handle acquisition');
for (const call of ['Native.CreateDevice()', 'Native.CreateItem(hwnd)', 'pool.CreateCaptureSession(item)', 'session.StartCapture()', 'AtomicFile.Publish('])
    assert(program.indexOf(call) > created && program.indexOf(call) < catchStart, `${call} must be after creation and inside outer lifecycle`);
assert.equal(program.split('taskbarQa?.Finish();').length - 1, 1);
assert(program.includes('if (taskbarQa is null && ownedLocation is not null && parentLost)'), 'QA must not bypass its cleanup gate');
assert(program.indexOf('taskbarQa?.AfterFrame(') > program.indexOf('await FramePipe.Write('), 'trigger must follow frame publication');
assert(program.includes('taskbarQa?.BindStop(() => stopSignal.IsCancellationRequested'), 'stdin cancellation must reach worker monitor');
assert(program.includes('File.Exists(Path.Combine(Path.GetFullPath(parsed.OutputDirectory), "stop.txt"))'));

const afterFrameStart = program.indexOf('        var writtenAt = clock.Elapsed.TotalMilliseconds;');
const afterFrameEnd = program.indexOf('\n        var winState = SourceWindowHelper.Inspect(hwnd);', afterFrameStart);
assert(afterFrameStart > created && afterFrameEnd > afterFrameStart && afterFrameEnd < catchStart, 'AfterFrame hook must be inside capture loop');
const afterFrameHook = program.slice(afterFrameStart, afterFrameEnd);
assert(afterFrameHook.includes('taskbarQa?.AfterFrame(frames, clock.Elapsed.TotalSeconds, hash, capturedAt, frame.SystemRelativeTime.TotalMilliseconds, publishedThisFrame, stopSignal.IsCancellationRequested);'));

const xml = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
await writeFile(join(root, 'Check.csproj'), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0-windows</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup>
<Compile Include="Program.cs"/><Compile Include="Stubs.cs"/>
<Compile Include="${xml(join(build, 'generated/CaptureArguments.cs'))}"/>
${['TaskbarQaRuntime.cs', 'TaskbarQaOptions.cs'].map(file => `<Compile Include="${xml(join(here, file))}"/>`).join('\n')}\n${['TaskbarWorker.cs', 'TaskbarList.cs', 'TaskbarHideStrategy.cs', 'TaskbarHideRuntime.cs', 'WindowIdentity.cs'].map(file => `<Compile Include="${xml(join(resolve(here, '../wallpaper-probe'), file))}"/>`).join('\n')}
</ItemGroup></Project>`, { flag: 'wx' });
await writeFile(join(root, 'Program.cs'), `using System.Diagnostics;
using System.Text.Json;
var records = new List<object>();
var phases = new[]
{
    "PreCreationReject", "EnsureDefaultDesktop", "StreamSetup", "CreateDevice", "CreateItem",
    "FramePool", "Session", "StartCapture", "Publication", "Stop", "Normal", "IdentityChanged", "Unowned",
    "PendingFramesThenComplete", "PendingDurationExpiry", "PendingStopSignal", "PendingCaptureException", "PendingUnconfirmedBlocksClose",
    "PendingBlockedInspectCancel"
};
foreach (var phase in phases)
    CheckPhase(phase);
Console.WriteLine(JsonSerializer.Serialize(new { passed = records.Count, records }));
File.WriteAllText(Path.Combine(AppContext.BaseDirectory, "integration.json"), JsonSerializer.Serialize(records));
Environment.ExitCode = 0;
static double NowQpcMs() => Stopwatch.GetTimestamp() * 1000.0 / Stopwatch.Frequency;
void CheckPhase(string phase)
{
    var probe = new FakeProbe(); int closes = 0, workerStarts = 0;
    var output = new List<TaskbarActionRecord>();
    using var startedGate = new ManualResetEventSlim(false);
    using var releaseGate = new ManualResetEventSlim(false);
    using var inspectGate = new ManualResetEventSlim(false);
    using var releaseInspectGate = new ManualResetEventSlim(false);
    BlockingFakeWorker? activeWorker = null;
    var runtimeClock = 6.30; // +1.20s startup offset relative to 5.10s capture clock
    Environment.ExitCode = 0;
    ${opener}
        if (phase == "PreCreationReject") throw new ArgumentException("fake rejection before creation");
        var options = TaskbarQaOptions.Extract(["--taskbar-qa", "--taskbar-hwnd", "42", "--taskbar-pid", "7", "--taskbar-start", "2026-10-12T00:00:00Z", "42", "offline", "25", "30", "memory", "--owned-location", "WhaleWallpaperProbe-fake"]);
        taskbarQa = TaskbarQaRuntime.CreateOffline(options, probe, "WhaleWallpaperProbe-fake", "offline",
            () => { closes++; probe.Exists = false; return new("closed", true, 0, null); }, output.Add,
            takeOwnership: phase != "Unowned", runtimeClockSeconds: () => runtimeClock);
        using var stopSignal = new CancellationTokenSource();
        taskbarQa.BindStop(() => stopSignal.IsCancellationRequested);
        if (phase.StartsWith("Pending", StringComparison.Ordinal))
        {
            if (phase == "PendingBlockedInspectCancel")
            {
                probe.BlockNextInspect = true;
                probe.InspectEntered = inspectGate;
                probe.ReleaseInspect = releaseInspectGate;
            }
            taskbarQa.Strategy.Execute = _ =>
            {
                if (phase == "PendingFramesThenComplete")
                {
                    Interlocked.Increment(ref workerStarts);
                    taskbarQa.Strategy.NotifyWorkerStarted();
                    startedGate.Set();
                    releaseGate.Wait(5000);
                    return Execution.FromWorker(new(
                        new(new(0, true, "DeleteTab", null), new(0, true, "HrInit", null), new(0, true, "DeleteTab", null)),
                        true, true, false, false, false, false, null));
                }
                return Execution.FromWorker(TaskbarWorker.Run(
                    new("fake", 42, 7, "2026-10-12T00:00:00Z", "WhaleWallpaperProbe-fake", 30_000, "fake-stop.txt"),
                    () => taskbarQa.IsStopRequested,
                    () =>
                    {
                        Interlocked.Increment(ref workerStarts);
                        activeWorker = new BlockingFakeWorker(startedGate, confirmKill: phase != "PendingUnconfirmedBlocksClose");
                        return activeWorker;
                    },
                    onStarted: taskbarQa.Strategy.NotifyWorkerStarted));
            };
            var clock = new FakeClock();
            var mode = "pipe";
            var skippedPublications = 0; TaskbarHideRuntime? taskbarHideRuntime = null;
            byte[]? lastBytes = [1, 2, 3];
            void RunGeneratedFrame(long frames, double seconds, string hash, double? sourceMs = null, long? capAt = null)
            {
                clock.Elapsed = TimeSpan.FromSeconds(seconds);
                var capturedAt = capAt ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var frame = new FakeFrame(TimeSpan.FromMilliseconds(sourceMs ?? NowQpcMs()));
${afterFrameHook}
            }
            if (phase == "PendingBlockedInspectCancel")
            {
                RunGeneratedFrame(30, 5.10, "H30");
                if (!inspectGate.Wait(2000) || !taskbarQa.IsActionPending || workerStarts != 0)
                    throw new Exception("PendingBlockedInspectCancel did not block in pre-action Inspect");
                var blockedJson = TaskbarHideStrategy.Serialize(output[^1]);
                if (!blockedJson.Contains("\\"actionScheduled\\":true") || !blockedJson.Contains("\\"executorEntered\\":false") || !blockedJson.Contains("\\"started\\":null"))
                    throw new Exception("PendingBlockedInspectCancel reported started=true before Execute: " + blockedJson);
                stopSignal.Cancel();
                releaseInspectGate.Set();
            }
            else
            {
                RunGeneratedFrame(214, 5.10, "H214");
                if (!startedGate.Wait(2000) || !taskbarQa.IsActionPending)
                    throw new Exception("generated AfterFrame did not enter non-blocking pending state: " + phase);
                RunGeneratedFrame(215, 5.13, "H215");
                RunGeneratedFrame(216, 5.16, "H216");
                RunGeneratedFrame(217, 5.20, "H217");
                if (taskbarQa.Strategy.FramesWhilePending != 3 || workerStarts != 1)
                    throw new Exception("generated frame loop blocked or re-triggered while pending: " + phase);
                if (phase == "PendingFramesThenComplete")
                {
                    var inFlightSourceMs = NowQpcMs();
                    var inFlightCapturedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    Thread.Sleep(15);
                    runtimeClock = 6.55; // +0.25s elapsed -> completedAtSeconds = 5.35s on capture clock
                    releaseGate.Set();
                    taskbarQa.SettlePendingAction(5000, requestStop: false);
                    RunGeneratedFrame(218, 5.36, "H218-INFLIGHT", inFlightSourceMs, inFlightCapturedAt);
                    var afterInFlightJson = TaskbarHideStrategy.Serialize(output[^1]);
                    if (!afterInFlightJson.Contains("\\"postActionFrame\\":null") || !afterInFlightJson.Contains("\\"preCompletionFramesPublishedAfter\\":1"))
                        throw new Exception("in-flight frame was falsely promoted to postActionFrame: " + afterInFlightJson);
                    RunGeneratedFrame(219, 5.40, "H219-FRESH");
                }
                else if (phase == "PendingStopSignal")
                {
                    stopSignal.Cancel();
                    RunGeneratedFrame(218, 5.25, "H218");
                }
                else if (phase == "PendingCaptureException")
                {
                    throw new IOException("simulated capture failure while worker pending");
                }
            }
        }
        else
        {
            if (phase == "EnsureDefaultDesktop") throw new IOException("fake EnsureDefaultDesktop failure");
            if (phase == "StreamSetup") throw new IOException("fake StreamSetup failure");
            if (phase == "IdentityChanged") { probe.ThrowInspect = true; throw new IOException("fake IdentityChanged failure"); }
            if (phase != "Normal" && phase != "Unowned") throw new IOException("fake " + phase + " failure");
        }
    ${tail}
    if (phase == "PreCreationReject")
    {
        if (taskbarQa is not null || closes != 0) throw new Exception("PreCreationReject must not create runtime or close window");
        records.Add(new { phase, closes, sourceStillExists = probe.Exists, cleanup = (object?)null });
        return;
    }
    if (phase == "Unowned")
    {
        if (closes != 0 || output[^1].Cleanup is null) throw new Exception("Unowned phase closed window or missing report");
        records.Add(new { phase, closes, sourceStillExists = probe.Exists, cleanup = output[^1].Cleanup });
        return;
    }
    if (phase == "IdentityChanged")
    {
        if (closes != 0) throw new Exception("IdentityChanged must NOT close window when identity fails check");
        records.Add(new { phase, closes, sourceStillExists = probe.Exists, cleanup = output[^1].Cleanup });
        return;
    }
    if (phase == "PendingUnconfirmedBlocksClose")
    {
        var json = TaskbarHideStrategy.Serialize(output[^1]);
        if (closes != 0 || !probe.Exists || Environment.ExitCode == 0 || output[^1].Stage != "action-unconfirmed" || !json.Contains("\\"outcome\\":\\"not-confirmed\\""))
            throw new Exception("PendingUnconfirmedBlocksClose failed to block close: " + json);
        records.Add(new { phase, closes, sourceStillExists = probe.Exists, stage = output[^1].Stage, cleanup = output[^1].Cleanup });
        return;
    }
    if (phase == "PendingFramesThenComplete")
    {
        var json = TaskbarHideStrategy.Serialize(output[^1]);
        if (closes != 1 || probe.Exists || workerStarts != 1 || !json.Contains("\\"framesWhilePending\\":3") || !json.Contains("\\"completedAfterFrameSequence\\":217") || !json.Contains("\\"completedAtSeconds\\":5.35") || !json.Contains("\\"preCompletionFramesPublishedAfter\\":1") || !json.Contains("\\"postActionFrame\\":{\\"sequence\\":219,"))
            throw new Exception("PendingFramesThenComplete failed: " + json);
        records.Add(new { phase, closes, workerStarts, framesWhilePending = 3, sourceStillExists = probe.Exists, stage = output[^1].Stage, cleanup = output[^1].Cleanup });
        return;
    }
    if (phase == "PendingBlockedInspectCancel")
    {
        var json = TaskbarHideStrategy.Serialize(output[^1]);
        if (closes != 1 || probe.Exists || workerStarts != 0 || !json.Contains("\\"executorEntered\\":false") || !json.Contains("\\"started\\":false") || !json.Contains("\\"cancelled\\":true"))
            throw new Exception("PendingBlockedInspectCancel failed: " + json);
        records.Add(new { phase, closes, workerStarts, sourceStillExists = probe.Exists, stage = output[^1].Stage, cleanup = output[^1].Cleanup });
        return;
    }
    if (phase.StartsWith("Pending", StringComparison.Ordinal))
    {
        var json = TaskbarHideStrategy.Serialize(output[^1]);
        if (closes != 1 || probe.Exists || workerStarts != 1 || activeWorker is null || !activeWorker.Killed || !activeWorker.Disposed || !json.Contains("\\"cancelled\\":true") || !json.Contains("\\"terminated\\":true"))
            throw new Exception("Pending stop/expiry/exception phase failed: " + phase + " " + json);
        records.Add(new { phase, closes, workerStarts, sourceStillExists = probe.Exists, stage = output[^1].Stage, cleanup = output[^1].Cleanup });
        return;
    }
    if (closes != 1 || probe.Exists || output[^1].Cleanup is null) throw new Exception("outer cleanup regression: " + phase);
    records.Add(new { phase, closes, sourceStillExists = probe.Exists, cleanup = output[^1].Cleanup });
}
public sealed class FakeClock { public TimeSpan Elapsed { get; set; } }
public sealed record FakeFrame(TimeSpan SystemRelativeTime);
public sealed class BlockingFakeWorker(ManualResetEventSlim startedGate, bool confirmKill) : ITaskbarWorkerProcess
{
    private readonly ManualResetEventSlim _killedGate = new(false);
    public bool Killed { get; private set; }
    public bool Disposed { get; private set; }
    public bool Start(TaskbarList.WorkerRequest request) { startedGate.Set(); return true; }
    public bool WaitForExit(int ms) { if (!Killed) { _killedGate.Wait(Math.Min(ms, 25)); return false; } return confirmKill; }
    public void Kill() { Killed = true; _killedGate.Set(); }
    public TaskbarList.CallTrace ReadTrace() => new(new(0, true, "DeleteTab", null), new(0, true, "HrInit", null), new(0, true, "DeleteTab", null));
    public void Dispose() { Disposed = true; _killedGate.Dispose(); }
}
public sealed class FakeProbe : IWindowProbe
{
    public bool Exists = true;
    public bool ThrowInspect = false;
    public bool BlockNextInspect = false;
    public ManualResetEventSlim? InspectEntered;
    public ManualResetEventSlim? ReleaseInspect;
    public IReadOnlyList<WindowCandidate> FindByExactTitle(string location) => [];
    public WindowSnapshot Inspect(long hwnd)
    {
        if (BlockNextInspect)
        {
            BlockNextInspect = false;
            InspectEntered?.Set();
            ReleaseInspect?.Wait(5000);
        }
        if (ThrowInspect) throw new InvalidOperationException("identity changed");
        return new(hwnd, 7, "wallpaper64", "WhaleWallpaperProbe-fake", Exists, true, false, false, 0, 0, 100, 100, 0, 0, 0, 0, DateTimeOffset.Parse("2026-10-12T00:00:00Z"), 0);
    }
}`, { flag: 'wx' });
await writeFile(join(root, 'Stubs.cs'), `// Every native boundary is a throwing stub; accidentally crossing one fails this test.
public record WindowState(long Hwnd, uint Pid, string ProcessName, string Title, bool Exists, bool Visible, bool Iconic, bool Cloaked, int Left, int Top, int Width, int Height, long Style, long ExStyle);
public static class SourceWindowHelper
{
    public static string RequireProbeLocation(string? value) => value ?? throw new ArgumentException();
    public static List<WindowState> FindProbeWindows() => throw new Exception("native boundary forbidden");
    public static WindowState VerifyExpectedWindow(nint hwnd, string location, int pid, int waitMs) => throw new Exception("native boundary forbidden");
    public static WindowState Inspect(nint hwnd) => throw new Exception("native boundary forbidden");
    public record CloseResult(string Outcome, bool Closed, long WaitedMs, string? Error);
    public static CloseResult EnsureProbeWindowClosed(string location, int waitMs, uint expectedPid) => throw new Exception("real close forbidden");
}
public static class Native { public static short GetAsyncKeyState(int key) => throw new Exception("native boundary forbidden"); }
public static class ProbeJournal { public static void Error(string scope, string message, string? detail = null) {} }
`, { flag: 'wx' });
const child = spawn('dotnet', ['run', '--project', join(root, 'Check.csproj'), '-c', 'Release'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { log += data; process.stdout.write(data); });
const exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', done); });
await writeFile(join(root, 'check.log'), log, { flag: 'wx' });
assert.equal(exit, 0, 'generated lifecycle check failed');
await writeFile(join(root, 'result.json'), JSON.stringify({ passed: 19, generatedScopeChecks: true, nonBlockingFrameLoopChecks: 6, realNativeActions: false }, null, 2), { flag: 'wx' });
