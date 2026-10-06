using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Windows.Graphics.Capture;
using Windows.Graphics.DirectX;
using Windows.Graphics.DirectX.Direct3D11;
using Windows.Graphics.Imaging;
using Windows.Storage.Streams;

// Diagnostic only: reads ONE explicitly selected WE window; never captures the desktop.
// Stop with Esc, stop.txt, target close, the bounded duration, or (daily mode) the
// parent's stop command and pipe lifetime.
// Window lifecycle helpers verify the target identity before any side effect.
// CLI results use camelCase so scripts read the same field names everywhere.
const int OffscreenCoordinate = -32000;
// Daily playback runs indefinitely, so the per-frame log must be bounded: the file keeps
// the most recent window of records plus a header that states the bound and the totals.
const int FrameLogCapacity = 1200;
var cliJson = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
try
{
Native.EnsureDefaultDesktop();
if (args.Length == 1 && args[0] == "--self-test-pipe") { await FramePipe.Write(Console.OpenStandardOutput(), [255, 216, 255, 217], 7, 1700000000123, 1280, 720, CancellationToken.None); return; }
if (args.Length == 1 && args[0] == "--window-find") { Console.WriteLine(JsonSerializer.Serialize(SourceWindowHelper.FindProbeWindows(), cliJson)); return; }
if (args.Length >= 3 && args[0] == "--we-open") {
    string loc = args[1]; string file = args[2];
    int w = args.Length >= 4 && int.TryParse(args[3], out var pw) ? pw : 1280;
    int h = args.Length >= 5 && int.TryParse(args[4], out var ph) ? ph : 720;
    // Optional, explicit experiment entry: create the window at an off-screen position
    // instead of moving it there after the first frame. Off unless the caller asks.
    (int X, int Y)? initialPosition = Array.IndexOf(args, "--initial-offscreen") >= 0
        ? (OffscreenCoordinate, OffscreenCoordinate)
        : null;
    int launchPid = SourceWindowHelper.OpenWallpaper(loc, file, w, h, null, initialPosition);
    Console.WriteLine(JsonSerializer.Serialize(new
    {
        opened = true,
        location = loc,
        file = SourceWindowHelper.RequireProjectFile(file),
        wePid = launchPid,
        initialPosition,
        note = "launcher process; the rendering window belongs to the existing wallpaper64 process",
    }));
    return;
}
if (args.Length == 2 && args[0] == "--we-close") {
    var closing = SourceWindowHelper.CloseWallpaper(args[1]);
    Console.WriteLine(JsonSerializer.Serialize(closing));
    return;
}
if (args.Length == 2 && args[0] == "--window-status") {
    var state = SourceWindowHelper.RequireUniqueProbeWindow(args[1]);
    Console.WriteLine(JsonSerializer.Serialize(state));
    return;
}
if (args.Length >= 3 && args[0] == "--window-ensure-closed") {
    // Optional --expect-pid <pid>: also require the window to still belong to the
    // process the caller created/looked up, so a recycled handle is not closed as
    // if it were this round's window.
    uint? expectedPid = null;
    for (int index = 3; index < args.Length;)
    {
        if (args[index] == "--expect-pid" && index + 1 < args.Length && uint.TryParse(args[index + 1], out var pidValue)) { expectedPid = pidValue; index += 2; }
        else throw new ArgumentException($"Unknown --window-ensure-closed option '{args[index]}'.");
    }
    var closeReport = SourceWindowHelper.EnsureProbeWindowClosed(args[1], int.Parse(args[2]), expectedPid);
    Console.WriteLine(JsonSerializer.Serialize(closeReport, cliJson));
    return;
}
if (args.Length == 2 && args[0] == "--self-test-publish") { await AtomicFile.SelfTest(args[1]); return; }
if (args.Length == 2 && args[0] == "--parse-check") { await CaptureArguments.ParseCheck(args[1]); return; }
if (args.Length == 2 && args[0] == "--self-test-frame-log") { await SelfTestFrameLog(args[1]); return; }
if (args.Length == 1 && args[0] == "--self-test-lifecycle") { SelfTestLifecycle(); return; }
if (args.Length == 2 && args[0] == "--window-tree" && long.TryParse(args[1], out var treeHwnd)) { Native.PrintTree((nint)treeHwnd); return; }
if (args.Length == 2 && args[0] == "--window-inspect" && long.TryParse(args[1], out var inspectHwnd)) { Console.WriteLine(JsonSerializer.Serialize(SourceWindowHelper.Inspect((nint)inspectHwnd), cliJson)); return; }
if (args.Length >= 3 && args[0] == "--window-apply" && long.TryParse(args[1], out var applyHwnd))
{
    // The managed lifecycle always passes the expected round name; the bare form
    // (prefix check only) is kept for the supervised manual experiment runners.
    string? expectedLocation = null;
    int? expectedPid = null;
    for (int index = 3; index < args.Length;)
    {
        if (args[index] == "--location" && index + 1 < args.Length) { expectedLocation = SourceWindowHelper.RequireProbeLocation(args[index + 1]); index += 2; }
        else if (args[index] == "--pid" && index + 1 < args.Length && int.TryParse(args[index + 1], out var expected)) { expectedPid = expected; index += 2; }
        else throw new ArgumentException($"Unknown --window-apply option '{args[index]}'.");
    }
    Console.WriteLine(JsonSerializer.Serialize(SourceWindowHelper.ApplyAction((nint)applyHwnd, args[2], expectedLocation, expectedPid), cliJson));
    return;
}
if (args.Length == 1 && args[0] == "--self-test-window-ops") { SelfTestWindowOps(); return; }
if (args.Length == 1 && args[0] == "--window-foreground") { Console.WriteLine(JsonSerializer.Serialize(SourceWindowHelper.Foreground(), cliJson)); return; }
if (args.Length == 1 && args[0] == "--window-screen") { Console.WriteLine(JsonSerializer.Serialize(SourceWindowHelper.VirtualScreen(), cliJson)); return; }
if (args.Length == 2 && args[0] == "--window-onscreen" && long.TryParse(args[1], out var onHwnd))
{ Console.WriteLine(JsonSerializer.Serialize(SourceWindowHelper.OnScreenArea((nint)onHwnd), cliJson)); return; }
if (args.Length == 4 && args[0] == "--window-at" && int.TryParse(args[1], out var atX) && int.TryParse(args[2], out var atY) && long.TryParse(args[3], out var atProbe))
{ Console.WriteLine(JsonSerializer.Serialize(SourceWindowHelper.HitTest(atX, atY, atProbe), cliJson)); return; }
// The echo diagnostic flag is part of the shared parse, so an old QA invocation that still
// passes it keeps working instead of turning into an extra positional argument.
// The capture command line (owned-location, --forever, duration, fps, mode) is parsed by
// CaptureArguments, the same type the packaged-argument check exercises, so the exact argv the
// Host produces cannot be rejected by a difference between two hand-rolled parsers.
// --owned-location <this round's window name>: the probe accepts ownership of that window and
// closes it if the parent disconnects; without it the probe only reads the handle it was given.
var parsed = CaptureArguments.Parse(args);
var echoMode = parsed.EchoMode;
var ownedLocation = parsed.OwnedLocation;
var forever = parsed.Forever;
var handle = parsed.Handle;
var fps = parsed.Fps;
var duration = parsed.Duration;
var mode = parsed.CaptureMode;
var diagnostics = mode == "pipe" || echoMode ? Console.Error : Console.Out;
using var pipeOutput = mode == "pipe" ? Console.OpenStandardOutput() : Stream.Null;
using var stopSignal = new CancellationTokenSource();
if (mode == "pipe") _ = Task.Run(async () => {
    try {
        while (await Console.In.ReadLineAsync() is string command)
            if (command == "stop") break;
        stopSignal.Cancel(); // Parent closed stdin, or explicitly stopped this capture.
    } catch (ObjectDisposedException) { }
});

var hwnd = (nint)handle;
var output = Path.GetFullPath(parsed.OutputDirectory);
Directory.CreateDirectory(output);
if (File.Exists(Path.Combine(output, "frames.jsonl")) || File.Exists(Path.Combine(output, "summary.json")))
    throw new InvalidOperationException("Use a fresh output directory; existing capture evidence is preserved.");
SourceWindowHelper.VerifyTargetIdentity(hwnd);
Native.GetWindowThreadProcessId(hwnd, out var pid);
using var target = Process.GetProcessById((int)pid);
if (!GraphicsCaptureSession.IsSupported()) throw new InvalidOperationException("WGC not supported.");

using var device = Native.CreateDevice();
using var staging = new StagingReadback();
if (mode == "pipe") ProbeJournal.Info("Capture", StagingReadback.DescribeDevice(device));
else if (echoMode) ProbeJournal.Info("Status", StagingReadback.DescribeDevice(device));
else diagnostics.WriteLine(StagingReadback.DescribeDevice(device));
var item = Native.CreateItem(hwnd);
var captureSource = Native.LastItemKind;
var size = item.Size;
using var pool = Direct3D11CaptureFramePool.CreateFreeThreaded(device,
    DirectXPixelFormat.B8G8R8A8UIntNormalized, 2, size);
using var session = pool.CreateCaptureSession(item);
session.IsCursorCaptureEnabled = false;
// Keep the normal Windows capture indicator. Do not request border suppression.
var clock = Stopwatch.StartNew();
using var self = Process.GetCurrentProcess();
var cpuStart = self.TotalProcessorTime;
long frames = 0, changed = 0, skippedPublications = 0;
byte[]? lastBytes = null;
double nextStatusMs = 0;
string? previousHash = null;
string reason = "duration";
bool closed = false;
item.Closed += (_, _) => closed = true;
session.StartCapture();
diagnostics.WriteLine(JsonSerializer.Serialize(new { started = true, pid, hwnd = handle, size.Width, size.Height, fps, mode }));
await using var log = new FrameLog(Path.Combine(output, "frames.jsonl"), FrameLogCapacity);
try
{
    while (forever || clock.Elapsed.TotalSeconds < duration)
    {
        if (stopSignal.IsCancellationRequested) { reason = "parent-stop"; break; }
        // Daily playback must not stop because the user pressed Esc in some other
        // application: that poll belongs to the supervised experiment only. Daily runs end
        // on the parent's stop command, the parent pipe closing, the window closing, or a
        // failure; the supervised forms keep the Esc escape hatch.
        if (!forever && (Native.GetAsyncKeyState(0x1B) & 0x8000) != 0) { reason = "escape"; break; }
        if (File.Exists(Path.Combine(output, "stop.txt"))) { reason = "stop-file"; break; }
        if (closed || !Native.IsWindow(hwnd)) { reason = "target-closed"; break; }
        var start = clock.Elapsed.TotalMilliseconds;
        using var frame = pool.TryGetNextFrame();
        if (frame is null) { await Task.Delay(2); continue; }
        if (frame.ContentSize.Width < 1 || frame.ContentSize.Height < 1) continue;
        var acquiredAt = clock.Elapsed.TotalMilliseconds;
        // Do not await on the FrameArrived callback: copy/encode on this independent loop.
        var sourceAgeMs = Stopwatch.GetTimestamp() * 1000.0 / Stopwatch.Frequency - frame.SystemRelativeTime.TotalMilliseconds;
        var capturedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - (long)Math.Max(0, sourceAgeMs);
        using var bitmap = mode == "frames" ? null : mode == "staging" ? staging.Copy(frame.Surface) :
            await SoftwareBitmap.CreateCopyFromSurfaceAsync(frame.Surface, BitmapAlphaMode.Ignore).AsTask().WaitAsync(TimeSpan.FromSeconds(5));
        var copiedAt = clock.Elapsed.TotalMilliseconds;
        var w = Math.Min(frame.ContentSize.Width, bitmap?.PixelWidth ?? frame.ContentSize.Width);
        var h = Math.Min(frame.ContentSize.Height, bitmap?.PixelHeight ?? frame.ContentSize.Height);
        var encodedAt = copiedAt;
        var packedAt = copiedAt;
        string? hash = null;
        if (mode is not ("readback" or "frames"))
        {
            using var stream = new InMemoryRandomAccessStream();
            var encoder = await BitmapEncoder.CreateAsync(BitmapEncoder.JpegEncoderId, stream);
            encoder.SetSoftwareBitmap(bitmap);
            encoder.BitmapTransform.Bounds = new BitmapBounds { X = 0, Y = 0, Width = (uint)w, Height = (uint)h };
            await encoder.FlushAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(5));
            encodedAt = clock.Elapsed.TotalMilliseconds;
            stream.Seek(0);
            using var reader = new DataReader(stream.GetInputStreamAt(0));
            await reader.LoadAsync((uint)stream.Size);
            lastBytes = new byte[(int)stream.Size]; reader.ReadBytes(lastBytes);
            hash = Convert.ToHexString(SHA256.HashData(lastBytes));
            packedAt = clock.Elapsed.TotalMilliseconds;
        }
        frames++;
        if (hash is not null && hash != previousHash) changed++;
        previousHash = hash;
        if (mode == "disk" && lastBytes is not null)
        {
            if (!await AtomicFile.Publish(Path.Combine(output, "latest.jpg"), lastBytes)) skippedPublications++;
        }
        var pipeStart = clock.Elapsed.TotalMilliseconds;
        if (mode == "pipe" && lastBytes is not null)
            await FramePipe.Write(pipeOutput, lastBytes, checked((uint)frames), capturedAt, w, h, stopSignal.Token).WaitAsync(TimeSpan.FromSeconds(5));
        var pipeMs = mode == "pipe" ? clock.Elapsed.TotalMilliseconds - pipeStart : 0;
        if (mode != "pipe" && frames == 1 && lastBytes is not null) await File.WriteAllBytesAsync(Path.Combine(output, "first.jpg"), lastBytes);
        var writtenAt = clock.Elapsed.TotalMilliseconds;
        var winState = SourceWindowHelper.Inspect(hwnd);
        var record = new { frames, changed, seconds = Math.Round(clock.Elapsed.TotalSeconds, 3),
            width = w, height = h, bytes = lastBytes?.Length ?? 0, hash, mode, skippedPublications,
            captureSource,
            sourceTimestampMs = frame.SystemRelativeTime.TotalMilliseconds, capturedAt, pipeMs,
            sourceAgeMs,
            minimized = winState.Iconic, foreground = winState.Foreground, visible = winState.Visible,
            cloaked = winState.Cloaked, winLeft = winState.Left, winTop = winState.Top,
            acquireMs = acquiredAt - start, readbackMs = copiedAt - acquiredAt,
            jpegMs = encodedAt - copiedAt, packHashMs = packedAt - encodedAt,
            imageWriteMs = writtenAt - packedAt,
            encodeMs = Math.Round(clock.Elapsed.TotalMilliseconds - start, 2) };
        log.Add(frames, JsonSerializer.Serialize(record));
        if (clock.Elapsed.TotalMilliseconds >= nextStatusMs)
        {
            await log.FlushAsync();
            await AtomicFile.Publish(Path.Combine(output, "status.json"), Encoding.UTF8.GetBytes(JsonSerializer.Serialize(record)));
            if (mode == "pipe") ProbeJournal.Status(record);
            else if (!echoMode) diagnostics.WriteLine(JsonSerializer.Serialize(record));
            nextStatusMs = clock.Elapsed.TotalMilliseconds + 1000;
        }
        if (frame.ContentSize.Width != size.Width || frame.ContentSize.Height != size.Height)
        { size = frame.ContentSize; pool.Recreate(device, DirectXPixelFormat.B8G8R8A8UIntNormalized, 2, size); }
        await Task.Delay(Math.Max(1, (int)(1000.0 / fps - (clock.Elapsed.TotalMilliseconds - start))));
    }
}
catch (OperationCanceledException) when (stopSignal.IsCancellationRequested) { reason = "parent-stop"; }
catch (IOException) when (mode == "pipe") { reason = "pipe-disconnected"; }
catch (Exception ex) { ProbeJournal.Error("Capture", ex.GetType().Name, ex.Message); reason = ex.GetType().Name; throw; }
finally
{
    session.Dispose();
    if (mode != "pipe" && lastBytes is not null) await AtomicFile.Publish(Path.Combine(output, "latest.jpg"), lastBytes);

    // R2: the Host closes this round's window while it is alive. If the parent
    // disconnected instead (crash, kill, closed pipe), this process is the only
    // surviving owner, so it closes the round window it was told it owns. The
    // close is identity-checked and bounded; it never touches another round's
    // window or the wallpaper64 process itself.
    var parentLost = reason is "parent-stop" or "pipe-disconnected" or "pipe-eof" or "stdin-eof";
    SourceWindowHelper.CloseResult? windowClose = null;
    if (ownedLocation is not null && parentLost)
    {
        try
        {
            windowClose = SourceWindowHelper.EnsureProbeWindowClosed(ownedLocation, 15000);
            ProbeJournal.Info("Lifecycle", $"parent lost ({reason}); owned window close outcome={windowClose.Outcome} closed={windowClose.Closed}",
                windowClose.Error);
        }
        catch (Exception ex)
        {
            windowClose = new SourceWindowHelper.CloseResult("error", false, ownedLocation, 0, null, null, false, ex.Message);
            ProbeJournal.Error("Lifecycle", ex.GetType().Name, ex.Message);
        }
    }

    var summary = JsonSerializer.Serialize(new { frames, changed, skippedPublications, reason, seconds = clock.Elapsed.TotalSeconds, mode = forever ? "forever" : mode,
        captureSource,
        ownedLocation,
        windowClose,
        frameLog = new { bounded = true, retained = log.Retained, capacity = FrameLogCapacity, total = log.Total },
        cpuSeconds = (self.TotalProcessorTime - cpuStart).TotalSeconds, workingSetBytes = self.WorkingSet64 },
        new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
    await File.WriteAllTextAsync(Path.Combine(output, "summary.json"), summary);
    if (mode == "pipe") ProbeJournal.Info("Summary", summary);
    else if (echoMode) ProbeJournal.Info("Summary", summary);
    else diagnostics.WriteLine(summary);
}
}
catch (Exception error)
{
    // A machine-readable failure envelope; the Host reports it as the reason.
    ProbeJournal.Error("Probe", error.GetType().Name, error.Message);
    if (error is not ArgumentException) ProbeJournal.Error("Probe", error.ToString().Split('\n')[0].Trim());
    Environment.ExitCode = 1;
}

// The bounded frame log: a long daily run must not grow the evidence file without limit.
// This replays 5000 frames into a tiny window and checks the ceiling, the header, and the
// retention policy on the real frame numbers (dense tail plus every Nth older frame). It
// touches only the directory it is given and writes the same records production writes.
static async Task SelfTestFrameLog(string directory)
{
    Directory.CreateDirectory(directory);
    var path = Path.Combine(directory, "bounded-frames.jsonl");
    if (File.Exists(path)) throw new IOException("Use a new self-test directory.");
    const int capacity = 40;
    const int sampleEvery = 5;
    const int denseTail = 10;
    const int totalFrames = 5000;
    var log = new FrameLog(path, capacity, sampleEvery, denseTail);
    for (int frame = 1; frame <= totalFrames; frame++)
        log.Add(frame, $"{{\"kind\":\"frame\",\"frames\":{frame},\"changed\":{frame},\"seconds\":{frame * 0.033:F3},\"mode\":\"forever\"}}");
    await log.DisposeAsync();

    var lines = await File.ReadAllLinesAsync(path);
    var header = JsonSerializer.Deserialize<JsonElement>(lines[0]);
    var retained = header.GetProperty("retained").GetInt32();
    var total = header.GetProperty("total").GetInt64();
    var policy = header.GetProperty("policy").GetString();
    var oldestHeader = header.GetProperty("oldestRetainedFrame").GetInt64();
    var newestHeader = header.GetProperty("newestRetainedFrame").GetInt64();
    var body = lines.Skip(1).Where(line => line.Length > 0).ToArray();
    var frames = body.Select(line => JsonSerializer.Deserialize<JsonElement>(line).GetProperty("frames").GetInt64()).ToArray();
    var payloadBytes = new FileInfo(path).Length;

    var denseStart = totalFrames - denseTail + 1;
    var dense = frames.Where(frame => frame >= denseStart).ToArray();
    var sparse = frames.Where(frame => frame < denseStart).ToArray();
    var sparseSampled = sparse.Where(frame => frame % sampleEvery == 0).ToArray();
    var ascending = frames.Zip(frames.Skip(1), (previous, next) => next > previous).All(ok => ok);
    // A real frame record is ~110 bytes; the stub used to be ~12. Report the measured ceiling
    // in bytes per record so the production bound can be stated from a measurement.
    var bytesPerRecord = body.Length == 0 ? 0 : (double)(payloadBytes - lines[0].Length) / body.Length;
    var projectedProductionBytes = (long)(bytesPerRecord * capacity + lines[0].Length * 2);

    var checks = new (string Name, bool Ok, string Detail)[]
    {
        ("total counts every frame", total == totalFrames, total.ToString()),
        ("retained stays within capacity", retained <= capacity, retained.ToString()),
        ("header matches the body", retained == body.Length, $"{retained} vs {body.Length}"),
        ("header states the retention policy", policy == "dense-tail-plus-frame-sampling", policy ?? "null"),
        ("the newest frame survives", frames[^1] == totalFrames, frames[^1].ToString()),
        ("the whole dense tail is present", dense.Length == denseTail && dense[0] == denseStart, $"{dense.Length} from {denseStart}"),
        ("older frames follow frame-number sampling", sparse.Length == sparseSampled.Length && sparse.All(frame => frame % sampleEvery == 0), $"{sparse.Length} sparse, {sparseSampled.Length} multiples of {sampleEvery}"),
        ("retained frames are in order", ascending, "ascending"),
        ("header frames match the body", oldestHeader == frames[0] && newestHeader == frames[^1], $"{oldestHeader}..{newestHeader}"),
        ("file size stays bounded", payloadBytes < 64 * 1024, payloadBytes.ToString()),
    };
    var failed = checks.Where(check => !check.Ok).ToArray();
    Console.WriteLine(JsonSerializer.Serialize(new
    {
        capacity, sampleEvery, denseTail, totalFrames, retained, total, policy,
        retainedFrames = frames,
        sparseFrames = sparse,
        bytes = payloadBytes,
        bytesPerRecord = Math.Round(bytesPerRecord, 1),
        projectedProductionBytesAtCapacity = projectedProductionBytes,
        checks,
        failed = failed.Length,
    }, new JsonSerializerOptions { WriteIndented = true }));
    if (failed.Length != 0) Environment.ExitCode = 1;
}

// Argument and identity guards of the window lifecycle helpers. No window is
// created, moved, or closed: every refusal case must fail before any side effect.
static void SelfTestLifecycle()
{
    var cases = new List<LifecycleCase>();
    void Check(string name, bool expectedRefusal, Action action)
    {
        try { action(); cases.Add(new LifecycleCase(name, expectedRefusal, false, null)); }
        catch (Exception ex) { cases.Add(new LifecycleCase(name, expectedRefusal, true, $"{ex.GetType().Name}: {ex.Message}")); }
    }

    Check("close: empty location", true, () => SourceWindowHelper.RequireProbeLocation(""));
    Check("close: wrong prefix", true, () => SourceWindowHelper.RequireProbeLocation("SomeOtherWindow"));
    Check("close: command injection attempt", true, () => SourceWindowHelper.RequireProbeLocation("WhaleWallpaperProbe-x\" -control pause"));
    Check("close: separator in location", true, () => SourceWindowHelper.RequireProbeLocation("WhaleWallpaperProbe-a/b"));
    Check("close: overlong location", true, () => SourceWindowHelper.RequireProbeLocation("WhaleWallpaperProbe-" + new string('a', 200)));
    Check("open: non-json file", true, () => SourceWindowHelper.RequireProjectFile(@"C:\temp\scene.pkg"));
    Check("open: quotes in file", true, () => SourceWindowHelper.RequireProjectFile("C:\\a\".json"));
    Check("open: valid workshop project", false, () => SourceWindowHelper.RequireProjectFile(@"E:\SteamLibrary\steamapps\workshop\content\431960\3521337568\project.json"));
    Check("close: valid round name", false, () => SourceWindowHelper.RequireProbeLocation("WhaleWallpaperProbe-20261005-123456"));
    Check("identity: invalid hwnd", true, () => SourceWindowHelper.VerifyTargetIdentity(999));
    Check("identity: missing window for location", true, () => SourceWindowHelper.RequireUniqueProbeWindow("WhaleWallpaperProbe-self-test-absent", 1));
    Check("action: unknown window action", true, () => SourceWindowHelper.ApplyAction(0, "explode"));

    var mismatches = cases.Where(c => c.Refused != c.ExpectedRefusal).ToList();
    Console.WriteLine(JsonSerializer.Serialize(new { cases, mismatches = mismatches.Count }, new JsonSerializerOptions { WriteIndented = true }));
    if (mismatches.Count != 0) Environment.ExitCode = 1;
}

// Identity rules of the window actions. Uses only invalid handles: no window is
// created, moved, or closed.
static void SelfTestWindowOps()
{
    var cases = new List<LifecycleCase>();
    void Check(string name, bool expectedRefusal, Action action)
    {
        try { action(); cases.Add(new LifecycleCase(name, expectedRefusal, false, null)); }
        catch (Exception ex) { cases.Add(new LifecycleCase(name, expectedRefusal, true, $"{ex.GetType().Name}: {ex.Message}")); }
    }

    // R5: the expected round identity must come from the caller, so a handle that
    // now belongs to another round's window is still refused.
    Check("apply: expected name with invalid handle", true,
        () => SourceWindowHelper.ApplyAction(999, "offscreen", "WhaleWallpaperProbe-other-round", null));
    Check("apply: expected name and pid with invalid handle", true,
        () => SourceWindowHelper.ApplyAction(999, "offscreen", "WhaleWallpaperProbe-round-a", 1234));
    Check("apply: missing window for expected name", true,
        () => SourceWindowHelper.ApplyAction(999, "offscreen", "WhaleWallpaperProbe-self-test-absent", null));
    Check("apply: unknown action is refused before acting", true,
        () => SourceWindowHelper.ApplyAction(999, "explode", "WhaleWallpaperProbe-round-a", null));
    Check("apply: bad expected name is refused", true,
        () => SourceWindowHelper.ApplyAction(999, "offscreen", "NotOurWindow", null));
    Check("verify: bad expected name is refused", true,
        () => SourceWindowHelper.VerifyExpectedWindow(999, "NotOurWindow"));
    Check("verify: absent expected name is refused", true,
        () => SourceWindowHelper.VerifyExpectedWindow(999, "WhaleWallpaperProbe-self-test-absent"));
    Check("apply: bare legacy form still requires a valid handle", true,
        () => SourceWindowHelper.ApplyAction(999, "offscreen"));

    var mismatches = cases.Where(c => c.Refused != c.ExpectedRefusal).ToList();
    Console.WriteLine(JsonSerializer.Serialize(new { cases, mismatches = mismatches.Count }, new JsonSerializerOptions { WriteIndented = true }));
    if (mismatches.Count != 0) Environment.ExitCode = 1;
}

internal sealed record LifecycleCase(string Name, bool ExpectedRefusal, bool Refused, string? Detail);

static class Native
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(nint hwnd, StringBuilder text, int maxCount);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(nint hwnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindow(nint hwnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(nint hwnd);
    [DllImport("user32.dll")] public static extern nint GetForegroundWindow();
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
    [DllImport("d3d11.dll")] static extern int D3D11CreateDevice(nint adapter, int driverType, nint software,
        uint flags, nint featureLevels, uint levels, uint sdk, out nint device, out int level, out nint context);
    [DllImport("d3d11.dll")] static extern int CreateDirect3D11DeviceFromDXGIDevice(nint dxgi, out nint device);
    [DllImport("combase.dll", CharSet = CharSet.Unicode)] static extern int WindowsCreateString(string value, int length, out nint result);
    [DllImport("combase.dll")] static extern int WindowsDeleteString(nint value);
    [DllImport("combase.dll")] static extern int RoGetActivationFactory(nint name, ref Guid iid, out nint factory);

    public static IDirect3DDevice CreateDevice()
    {
        Marshal.ThrowExceptionForHR(D3D11CreateDevice(0, 1, 0, 0x20, 0, 0, 7, out var d3d, out _, out var context));
        nint dxgi = 0, inspectable = 0;
        try
        {
            var iid = new Guid("54ec77fa-1377-44e6-8c32-88fd5f44c84c");
            Marshal.ThrowExceptionForHR(Marshal.QueryInterface(d3d, in iid, out dxgi));
            Marshal.ThrowExceptionForHR(CreateDirect3D11DeviceFromDXGIDevice(dxgi, out inspectable));
            return WinRT.MarshalInterface<IDirect3DDevice>.FromAbi(inspectable);
        }
        finally { if (inspectable != 0) Marshal.Release(inspectable); if (dxgi != 0) Marshal.Release(dxgi); Marshal.Release(context); Marshal.Release(d3d); }
    }

    [DllImport("user32.dll")] public static extern bool EnumChildWindows(nint hWnd, EnumChildProc proc, nint lp);
    public delegate bool EnumChildProc(nint hWnd, nint lp);

    public static string LastItemKind { get; private set; } = "unknown";

    /// <summary>
    /// Capture item for one explicitly selected window. Only that window is ever
    /// captured: a failure (hidden window, tool-window style, recycled handle)
    /// throws instead of silently widening the capture to a child window or the
    /// whole monitor, which would report unrelated desktop content as the source.
    /// </summary>
    public static GraphicsCaptureItem CreateItem(nint hwnd)
    {
        const string name = "Windows.Graphics.Capture.GraphicsCaptureItem";
        Marshal.ThrowExceptionForHR(WindowsCreateString(name, name.Length, out var hs));
        nint factory = 0, item = 0;
        try
        {
            var iid = typeof(IGraphicsCaptureItemInterop).GUID;
            Marshal.ThrowExceptionForHR(RoGetActivationFactory(hs, ref iid, out factory));
            var interop = (IGraphicsCaptureItemInterop)Marshal.GetObjectForIUnknown(factory);
            var itemId = new Guid("79c3f95b-31f7-4ec2-a464-632ef5d30760");
            int hr = interop.CreateForWindow(hwnd, ref itemId, out item);
            if (hr == 0 && item != 0)
            {
                LastItemKind = "window";
                return WinRT.MarshalInterface<GraphicsCaptureItem>.FromAbi(item);
            }

            GetWindowRect(hwnd, out var r);
            bool vis = IsWindowVisible(hwnd);
            var sb = new StringBuilder(256);
            GetWindowText(hwnd, sb, sb.Capacity);
            throw new InvalidOperationException(
                $"CreateForWindow(hwnd: 0x{hwnd:X8}, Title: '{sb}', Rect: {r.Left},{r.Top} {r.Right - r.Left}x{r.Bottom - r.Top}, Vis: {vis}) returned HR 0x{hr:X8}; " +
                "this window cannot be captured. Only the selected window is ever captured, so no child-window or monitor fallback is attempted.");
        }
        finally { if (item != 0) Marshal.Release(item); if (factory != 0) Marshal.Release(factory); WindowsDeleteString(hs); }
    }

    [DllImport("user32.dll")] public static extern bool GetWindowRect(nint hWnd, out SourceWindowHelper.RECT rect);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(nint hwnd);

    [DllImport("user32.dll", SetLastError = true)] public static extern nint OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetThreadDesktop(nint hDesktop);

    public static bool EnsureDefaultDesktop()
    {
        try
        {
            nint hDesk = OpenDesktop("Default", 0, false, 0x01FF);
            if (hDesk != 0)
            {
                bool ok = SetThreadDesktop(hDesk);
                int err = Marshal.GetLastWin32Error();
                // Informational even when the call fails: the capture pipeline
                // reports its own errors, and this diagnostic is only a probe.
                ProbeJournal.Info("Desktop", $"OpenDesktop: {hDesk}, SetThreadDesktop: {ok}, err: {err}");
                return ok;
            }
        }
        catch { }
        return false;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(nint hwnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, nint lParam);
    public delegate bool EnumWindowsProc(nint hWnd, nint lParam);

    public static void DiagWgc()
    {
        const string name = "Windows.Graphics.Capture.GraphicsCaptureItem";
        Marshal.ThrowExceptionForHR(WindowsCreateString(name, name.Length, out var hs));
        nint factory = 0;
        try
        {
            var iid = typeof(IGraphicsCaptureItemInterop).GUID;
            Marshal.ThrowExceptionForHR(RoGetActivationFactory(hs, ref iid, out factory));
            var interop = (IGraphicsCaptureItemInterop)Marshal.GetObjectForIUnknown(factory);
            var itemId = new Guid("79c3f95b-31f7-4ec2-a464-632ef5d30760");

            EnumWindows((hWnd, lp) =>
            {
                if (IsWindow(hWnd))
                {
                    var sb = new StringBuilder(256);
                    GetWindowText(hWnd, sb, sb.Capacity);
                    var cls = new StringBuilder(256);
                    GetClassName(hWnd, cls, cls.Capacity);
                    string title = sb.ToString();
                    string c = cls.ToString();
                    if (!string.IsNullOrWhiteSpace(title) && c != "IME" && c != "MSCTFIME UI")
                    {
                        int hr = interop.CreateForWindow(hWnd, ref itemId, out var itm);
                        if (itm != 0) Marshal.Release(itm);
                        Console.WriteLine($"HWND 0x{hWnd:X8} ({hWnd}), Class: {c}, Title: '{title}', HR: 0x{hr:X8}");
                    }
                }
                return true;
            }, 0);
        }
        finally
        {
            if (factory != 0) Marshal.Release(factory);
            WindowsDeleteString(hs);
        }
    }

    public static void PrintTree(nint h)
    {
        var sb = new StringBuilder(256);
        var cls = new StringBuilder(256);
        GetWindowText(h, sb, sb.Capacity);
        GetClassName(h, cls, cls.Capacity);
        GetWindowRect(h, out var r);
        Console.WriteLine($"TOP: 0x{h:X8} ({h}), Class: {cls}, Title: '{sb}', Rect: ({r.Left},{r.Top}) {r.Right - r.Left}x{r.Bottom - r.Top}");
        EnumChildWindows(h, (ch, lp) => {
            var csb = new StringBuilder(256);
            var ccls = new StringBuilder(256);
            GetWindowText(ch, csb, csb.Capacity);
            GetClassName(ch, ccls, ccls.Capacity);
            GetWindowRect(ch, out var cr);
            Console.WriteLine($"  CHILD: 0x{ch:X8} ({ch}), Class: {ccls}, Title: '{csb}', Rect: ({cr.Left},{cr.Top}) {cr.Right - cr.Left}x{cr.Bottom - cr.Top}");
            return true;
        }, 0);
    }

    [ComImport, Guid("3628e81b-3cac-4c60-b7f4-23ce0e0c3356"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IGraphicsCaptureItemInterop
    {
        [PreserveSig] int CreateForWindow(nint window, ref Guid iid, out nint result);
        [PreserveSig] int CreateForMonitor(nint monitor, ref Guid iid, out nint result);
    }
}
