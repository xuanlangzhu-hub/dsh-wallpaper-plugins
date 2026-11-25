using Windows.Graphics;

internal static class SceneBoundaryTests
{
    internal static int Run()
    {
        int checks = 0;
        void Check(bool ok)
        {
            if (!ok) throw new InvalidOperationException($"scene-boundary fixture {checks + 1} failed");
            checks++;
        }
        void Reject(Action action, string reason)
        {
            try { action(); }
            catch (InvalidOperationException exception) when (exception.Message == reason) { Check(true); return; }
            Check(false);
        }

        var render = new Node(11, 10, 20, Locator.SceneRenderer, new(4102, -69, 4166, -22), true, 144);
        var root = new Node(10, 0, 20, Locator.SceneRoot, render.Client, true, 144);
        var snapshot = new Snapshot(root, new(4096, -90, 4169, -18), [render], 0);
        var rootSize = Size(73, 72);
        var childSize = Size(64, 47);
        var crop = SceneEvidence.Crop(snapshot, render, rootSize, childSize);
        Check(crop == new SceneCrop(6, 21, 64, 47));
        Check(Locator.Compare("we-scene", snapshot, snapshot).Candidate == render);
        Check(Locator.Compare("we-scene", snapshot, snapshot with { Children = [render with { Hwnd = 12 }] })
            .Status == "surface-topology-changed");
        var multiple = snapshot with { Children = [render, render with { Hwnd = 12 }] };
        Check(Locator.Compare("we-scene", multiple, multiple).Status == "surface-candidate-ambiguous");
        Reject(() => SceneEvidence.Crop(snapshot, render, Size(74, 72), childSize), "root-frame-size-differs-from-dwm");
        Reject(() => SceneEvidence.Crop(snapshot, render, rootSize, Size(63, 47)), "renderer-frame-differs-from-client");
        Reject(() => SceneEvidence.Crop(snapshot, render with { Client = new(4095, -69, 4159, -22) }, rootSize, childSize),
            "renderer-frame-differs-from-client");

        var child = new byte[childSize.Width * childSize.Height * 4];
        new Random(160).NextBytes(child);
        byte[] ParentFrame(byte[] content, int x)
        {
            var parent = new byte[rootSize.Width * rootSize.Height * 4];
            for (int row = 0; row < childSize.Height; row++)
                content.AsSpan(row * childSize.Width * 4, childSize.Width * 4).CopyTo(
                    parent.AsSpan(((row + crop.Y) * rootSize.Width + x) * 4));
            return parent;
        }

        var pixels = ParentFrame(child, crop.X);
        var good = SceneEvidence.Match(pixels, rootSize, child, crop);
        Check(good.Confirmed && good.ZoneErrors.All(error => error == 0) && good.NearestShiftError > 0.75);
        Check(SceneEvidence.Match(child, childSize, child, new(0, 0, 64, 47)).Confirmed);
        var offset = SceneEvidence.Match(ParentFrame(child, crop.X + 1), rootSize, child, crop);
        Check(!offset.Confirmed && offset.Reason == "pixels-differ");
        Array.Fill(pixels, (byte)0, (crop.Y * rootSize.Width + crop.X) * 4, childSize.Width * 4);
        Check(SceneEvidence.Match(pixels, rootSize, child, crop).ZoneErrors[0] > 4);
        Array.Clear(child);
        Check(SceneEvidence.Match(ParentFrame(child, crop.X), rootSize, child, crop).Reason == "insufficient-image-detail");
        for (int y = 0; y < childSize.Height; y++)
            Array.Fill(child, (byte)(40 + 4 * y), y * childSize.Width * 4, childSize.Width * 4);
        var gradient = ParentFrame(child, crop.X);
        for (int y = 0; y < childSize.Height; y++)
        {
            int right = ((y + crop.Y) * rootSize.Width + crop.X + crop.Width) * 4;
            Array.Fill(gradient, (byte)(40 + 4 * y), right, 4);
        }
        Check(SceneEvidence.Match(gradient, rootSize, child, crop).Reason == "pixel-origin-ambiguous");

        var now = TimeSpan.FromMilliseconds(10_000);
        Check(SceneEvidence.SameTime(now.AddMs(-15), now.AddMs(-34), now));
        Check(!SceneEvidence.SameTime(now.AddMs(-15), now.AddMs(-50), now));
        Check(!SceneEvidence.SameTime(now.AddMs(-201), now.AddMs(-200), now));
        Check(!SceneEvidence.SameTime(now, now.AddMs(1), now));
        return checks;
    }

    private static SizeInt32 Size(int width, int height) => new() { Width = width, Height = height };

    private static TimeSpan AddMs(this TimeSpan time, int milliseconds) => time + TimeSpan.FromMilliseconds(milliseconds);
}
