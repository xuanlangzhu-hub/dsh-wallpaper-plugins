using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text.Json;

internal static class DailyFixedCanvas
{
    private const int IntervalMs = 25;
    private static readonly Box Monitor = new(0, 0, 2560, 1440);
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    [MTAThread]
    public static int Main(string[] args)
    {
        try
        {
            if (args is ["--self-test"])
            {
                Output(new { locator = SelfTests.Run(), watch = SurfaceWatch.SelfTest(),
                    proof = OffscreenEdgeTests.Run(), daily = TestSelection(), client = WallpaperClientProof.SelfTest(), nativeCalls = 0 });
                return 0;
            }
            return args switch
            {
                ["--monitor"] => ReadMonitor(),
                ["--watch-dsh", var pid, var image, var run, var generation] => Watch(int.Parse(pid), image,
                    Guid.ParseExact(run, "D"), long.Parse(generation)),
                ["--prove-source", var pid, var hwnd, var image, var start, var location, var run] =>
                    ProveSource(int.Parse(pid), long.Parse(hwnd), image, start, location, Guid.ParseExact(run, "D")),
                ["--prove-client", var pid, var hwnd, var image, var start, var location, var run] =>
                    ProveSource(int.Parse(pid), long.Parse(hwnd), image, start, location, Guid.ParseExact(run, "D"), client: true),
                _ => 2
            };
        }
        catch (Exception error)
        {
            Output(new { ok = false, error = error is InvalidOperationException ? error.Message : error.GetType().Name });
            return 2;
        }
    }

    private static void Output(object data) => Console.WriteLine(JsonSerializer.Serialize(data, Json));

    private static int ReadMonitor()
    {
        Output(new { monitor = NativeSurface.ReadPrimaryMonitor() });
        return 0;
    }

    private static int ProveSource(int pid, long hwnd, string image, string start, string location, Guid run, bool client = false)
    {
        Locator.Require(DateTimeOffset.TryParse(start, CultureInfo.InvariantCulture, DateTimeStyles.None, out var created),
            "source-start-unavailable");
        Locator.Require(NativeSurface.ReadPrimaryMonitor() == Monitor, "unsupported-monitor");
        var at = DateTimeOffset.UtcNow;
        Locator.Require(run != Guid.Empty, "surface-run-required");
        var plan = new ReadPlan("fixed-canvas-surface-locator-v1", run, false, at, at.AddSeconds(10),
            client ? "we-client" : "we-scene", pid, hwnd, Ticks(created.UtcTicks), image, location);
        Locator.ValidateIdentity(plan);
        // The existing capture proof also rechecks the exact offscreen root and its child while reading.
        bool MonitorMatches() => NativeSurface.ReadPrimaryMonitor() == Monitor;
        return client ? WallpaperClientProof.Read(plan, MonitorMatches, Output)
            : OffscreenEdgeProbe.Capture(plan, MonitorMatches, Output);
    }

    private static string Ticks(long ticks) => ticks.ToString(CultureInfo.InvariantCulture);
    private static int Watch(int pid, string image, Guid runId, long ownerGeneration)
    {
        Locator.Require(ownerGeneration is > 0 and <= 9007199254740991 && runId != Guid.Empty &&
            Path.IsPathFullyQualified(image) && Path.GetFileName(image).Equals("DeepSeek Harness.exe", StringComparison.OrdinalIgnoreCase),
            "surface-watch-binding");
        using var desktop = Process.GetProcessById(pid);
        using var self = Process.GetCurrentProcess();
        Locator.Require(!desktop.HasExited && desktop.SessionId == self.SessionId &&
            StringComparer.OrdinalIgnoreCase.Equals(desktop.MainModule?.FileName, image), "desktop-process-mismatch");

        // The owning Node process holds this pipe. Its exit ends the observer even without a signal.
        Task stop = Task.Run(Console.ReadLine);
        bool Running() => !stop.IsCompleted && !desktop.HasExited;
        nint root = NativeSurface.FindDesktopRoot(pid);
        var at = DateTimeOffset.UtcNow;
        string startTicks = Ticks(desktop.StartTime.ToUniversalTime().Ticks);
        var window = new ReadPlan("fixed-canvas-surface-locator-v1", runId, false, at, at.AddSeconds(10),
            "dsh", pid, (long)root, startTicks, image, null);
        Locator.ValidateIdentity(window);
        var clock = Stopwatch.StartNew();
        void Check()
        {
            Locator.Require(Running(), "surface-watch-stopped");
            Locator.Require(clock.ElapsedMilliseconds < 200, "surface-sample-deadline");
        }

        Locator.Require(NativeSurface.ReadPrimaryMonitor() == Monitor, "unsupported-monitor");
        var before = NativeSurface.Read(window, Check);
        var seed = Locator.Compare("dsh", before, NativeSurface.Read(window, Check)).Candidate
            ?? throw new InvalidOperationException("surface-renderer-not-unique");
        var plan = new WatchPlan(SurfaceWatch.Scope, window, ownerGeneration, seed.Hwnd, seed.Thread);
        string hwnd = Ticks(window.Hwnd), rendererHwnd = Ticks(seed.Hwnd);
        Output(new { header = true, runId, ownerGeneration, pid, hwnd, startTicks, rendererHwnd, rendererThread = seed.Thread });
        for (long sequence = 1; Running(); sequence++)
        {
            clock.Restart();
            long startedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            WatchSample sample;
            try
            {
                if (!NativeSurface.IsSameRoot(root, pid, before.Root.Thread)) break;
                Box firstMonitor = NativeSurface.ReadPrimaryMonitor();
                if (firstMonitor != Monitor) break;
                Snapshot first = NativeSurface.Read(window, Check);
                Snapshot last = NativeSurface.Read(window, Check);
                Box lastMonitor = NativeSurface.ReadPrimaryMonitor();
                Check();
                if (lastMonitor != Monitor) break;
                sample = SurfaceWatch.Resolve(plan, first, last, firstMonitor, lastMonitor);
            }
            catch (InvalidOperationException error)
            {
                bool terminal = error.Message is "surface-process-changed" or "surface-single-primary-monitor-required";
                sample = new(null, error.Message, terminal);
            }
            if (!Running()) break;
            Output(new { scope = SurfaceWatch.Scope, runId, pid, hwnd, startTicks, ownerGeneration, rendererHwnd,
                rendererThread = seed.Thread, sequence, startedAt, sampledAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                available = sample.Geometry is not null, sample.Geometry, sample.Terminal });
            if (sample.Terminal) break;
            // Wait on the pipe instead of sleeping through a requested stop.
            stop.Wait((int)Math.Max(1, IntervalMs - clock.ElapsedMilliseconds));
        }
        return 0;
    }

    private static int TestSelection()
    {
        nint pick(params nint[] roots) => NativeSurface.UniqueDesktopRoot(roots);
        Locator.Require(pick(10) == 10, "one-desktop-root");
        foreach (nint[] ambiguous in new nint[][] { [], [10, 11] })
        {
            try { pick(ambiguous); }
            catch (InvalidOperationException error) when (error.Message == "surface-desktop-root-not-unique") { continue; }
            throw new InvalidOperationException("ambiguous-desktop-root");
        }
        return 3;
    }
}

internal static partial class NativeSurface
{
    internal static nint UniqueDesktopRoot(IReadOnlyList<nint> candidates)
    {
        Locator.Require(candidates.Count == 1, "surface-desktop-root-not-unique");
        return candidates[0];
    }

    internal static nint FindDesktopRoot(int browserPid)
    {
        var candidates = new List<nint>(2);
        EnumWindows((hwnd, _) =>
        {
            if (GetWindowThreadProcessId(hwnd, out uint pid) != 0 && pid == browserPid && IsWindowVisible(hwnd) &&
                !IsIconic(hwnd) && GetWindow(hwnd, 4) == 0 && GetClass(hwnd) == "Chrome_WidgetWin_1" &&
                DwmCloak(hwnd, 14, out uint cloak, sizeof(uint)) == 0 && cloak == 0) candidates.Add(hwnd);
            return candidates.Count < 2;
        }, 0);
        return UniqueDesktopRoot(candidates);
    }

    internal static bool IsSameRoot(nint hwnd, int pid, uint thread) =>
        GetWindowThreadProcessId(hwnd, out uint currentPid) == thread && currentPid == pid && GetAncestor(hwnd, 2) == hwnd;

    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumCallback callback, nint data);
    [DllImport("user32.dll")] private static extern nint GetWindow(nint hwnd, uint command);
}
