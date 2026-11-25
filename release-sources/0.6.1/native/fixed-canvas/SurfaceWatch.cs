using System.Diagnostics;
using System.Globalization;

internal sealed record WatchPlan(string Scope, ReadPlan Window, long OwnerGeneration, long RendererHwnd, uint RendererThread);
internal sealed record WatchGeometry(Box NativeClient, Box RendererClient, Box Monitor, uint WindowDpi);
internal sealed record WatchSample(WatchGeometry? Geometry, string? Reason, bool Terminal = false);

internal static class SurfaceWatch
{
    internal const string Scope = "fixed-canvas-surface-watch-v1";
    private const int IntervalMs = 65;
    private const int DurationMs = 30000;

    internal static void Validate(WatchPlan plan, DateTimeOffset now)
    {
        Locator.Require(plan.Scope == Scope && plan.Window is { Target: "dsh" } &&
            plan.OwnerGeneration is > 0 and <= 9007199254740991 &&
            plan.RendererHwnd is > 0 and not 65535 && plan.RendererHwnd != plan.Window.Hwnd &&
            plan.RendererThread > 0, "surface-watch-binding");
        Locator.Validate(plan.Window, now);
    }

    internal static WatchSample Resolve(WatchPlan plan, Snapshot before, Snapshot after, Box firstMonitor, Box lastMonitor)
    {
        if (firstMonitor != lastMonitor || !lastMonitor.HasArea)
            return new(null, "surface-monitor-changed");
        Selection found = Locator.CompareDshWatch(before, after);
        if (found.Candidate is not Node candidate)
            return new(null, found.Status);
        if (candidate.Hwnd != plan.RendererHwnd || candidate.Thread != plan.RendererThread)
            return new(null, "surface-renderer-replaced", true);
        if (!lastMonitor.Intersects(candidate.Client))
            return new(null, "surface-outside-monitor");
        return new(new(after.Root.Client, candidate.Client, lastMonitor, after.Root.Dpi), null);
    }

    internal static int SelfTest()
    {
        var now = new DateTimeOffset(2026, 11, 23, 0, 0, 0, TimeSpan.Zero);
        var read = new ReadPlan("fixed-canvas-surface-locator-v1", Guid.NewGuid(), true, now, now.AddMinutes(1),
            "dsh", 12, 20, "9001", @"C:\Fixture\DeepSeek Harness.exe", null);
        var plan = new WatchPlan(Scope, read, 4, 21, 6);
        Validate(plan, now);
        var client = new Box(320, 68, 2239, 1300);
        var root = new Node(20, 0, 6, "Chrome_WidgetWin_1", client, true, 144);
        var child = new Node(21, 20, 6, Locator.ChatRenderer, client with { Right = 2240, Bottom = 1301 }, true, 144);
        var snapshot = new Snapshot(root, new(318, 68, 2241, 1302), [child], 0);
        var monitor = new Box(0, 0, 2560, 1440);
        Locator.Require(Resolve(plan, snapshot, snapshot, monitor, monitor).Geometry?.RendererClient == child.Client, "watch-test-ready");
        Locator.Require(Resolve(plan, snapshot, snapshot, monitor, monitor with { Right = 1920 }).Reason == "surface-monitor-changed",
            "watch-test-monitor");
        Locator.Require(Resolve(plan, snapshot, snapshot, monitor, monitor).Geometry?.NativeClient == client, "watch-test-client");
        Locator.Require(Resolve(plan, snapshot, snapshot with { Children = [child with { Visible = false }] }, monitor, monitor)
            .Reason == "surface-topology-changed", "watch-test-visibility");
        Locator.Require(Resolve(plan with { RendererThread = 7 }, snapshot, snapshot, monitor, monitor).Terminal, "watch-test-replaced");
        var draggedClient = new Box(96, 88, 2016, 1321);
        var dragged = snapshot with { Root = root with { Client = draggedClient }, Frame = draggedClient,
            Children = [child with { Client = draggedClient }] };
        Locator.Require(Resolve(plan, snapshot, dragged, monitor, monitor).Geometry?.RendererClient == draggedClient,
            "watch-test-pure-translation");
        var resizedClient = draggedClient with { Right = 1612 };
        var resized = dragged with { Children = [child with { Client = resizedClient }] };
        Locator.Require(Resolve(plan, dragged, resized, monitor, monitor).Geometry?.RendererClient == resizedClient,
            "watch-test-resize-between-reads");
        var uneven = resized with { Root = root with { Client = client } };
        Locator.Require(Resolve(plan, resized, uneven, monitor, monitor).Geometry?.RendererClient == resizedClient,
            "watch-test-root-lags-renderer");
        Locator.Require(Resolve(plan, snapshot, dragged with { Children = [child with { Thread = 8 }] }, monitor, monitor)
            .Reason == "surface-topology-changed", "watch-test-drag-does-not-relax-identity");
        Locator.Require(Locator.Compare("dsh", snapshot, dragged).Status == "surface-topology-changed",
            "watch-test-still-selection-remains-strict");
        return 11;
    }
}
