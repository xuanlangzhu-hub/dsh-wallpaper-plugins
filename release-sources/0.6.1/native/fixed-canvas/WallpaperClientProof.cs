using Windows.Graphics;
using Windows.Graphics.Capture;

internal static class WallpaperClientProof
{
    internal static int Read(ReadPlan plan, Func<bool> monitorMatches, Action<object> output)
    {
        void Check() => Locator.Require(monitorMatches(), "source-monitor-changed");

        Check();
        Snapshot before = NativeSurface.Read(plan, Check);
        Locator.Require(GraphicsCaptureSession.IsSupported(), "wgc-unsupported");
        SizeInt32 size = CaptureApi.Item(plan.Hwnd).Size;
        Snapshot after = NativeSurface.Read(plan, Check);
        Check();
        SceneCrop crop = Crop(before, after, size);
        output(new { outcome = "offscreen-client-profile-recorded", plan.RunId, plan.Pid, plan.StartTicks,
            rootHwnd = plan.Hwnd, rootClass = after.Root.ClassName, frame = after.Frame, client = after.Root.Client,
            rootSize = new { size.Width, size.Height }, crop, screenPixelReads = 0, imagesSaved = false });
        return 0;
    }

    private static SceneCrop Crop(Snapshot before, Snapshot after, SizeInt32 size)
    {
        Locator.Require(before.Root == after.Root && before.Frame == after.Frame, "wallpaper-client-changed");
        Box client = after.Root.Client;
        return SceneEvidence.Crop(after, after.Root, size, new SizeInt32 {
            Width = client.Right - client.Left, Height = client.Bottom - client.Top,
        });
    }

    internal static int SelfTest()
    {
        var frame = new Box(3072, 1952, 5654, 3448);
        var client = new Box(3083, 1980, 5643, 3420);
        var root = new Node(11, 0, 12, Locator.SceneRoot, client, true, 144);
        var baseline = new Snapshot(root, frame, [], 0);
        var frameSize = new SizeInt32 { Width = 2582, Height = 1496 };
        Locator.Require(Crop(baseline, baseline, frameSize) == new SceneCrop(11, 28, 2560, 1440),
            "client-offset-from-measured-frame");
        var full = baseline with { Frame = client };
        Locator.Require(Crop(full, full, new SizeInt32 { Width = 2560, Height = 1440 }) ==
            new SceneCrop(0, 0, 2560, 1440), "full-frame-client");
        var outside = baseline with { Root = root with { Client = client with { Right = frame.Right + 1 } } };
        Reject(baseline, baseline with { Root = root with { Thread = 13 } }, frameSize, "wallpaper-client-changed");
        Reject(baseline, full, frameSize, "wallpaper-client-changed");
        Reject(outside, outside, frameSize, "renderer-frame-differs-from-client");
        Reject(baseline, baseline, new SizeInt32 { Width = 2560, Height = 1440 }, "root-frame-size-differs-from-dwm");
        return 6;
    }

    private static void Reject(Snapshot before, Snapshot after, SizeInt32 size, string reason)
    {
        try { Crop(before, after, size); }
        catch (InvalidOperationException error) when (error.Message == reason) { return; }
        throw new InvalidOperationException("invalid-wallpaper-client-accepted");
    }
}
