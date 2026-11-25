using System.Diagnostics;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using Windows.Graphics;
using Windows.Graphics.Capture;
using Windows.Graphics.DirectX;
using Windows.Graphics.Imaging;
using Windows.Storage.Streams;

[assembly: SupportedOSPlatform("windows10.0.19041")]

internal static class SceneBoundary
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    [MTAThread]
    public static int Main(string[] args)
    {
        if (args is ["--self-test"])
        {
            Output(new { checks = SceneBoundaryTests.Run(), nativeCalls = 0 });
            return 0;
        }
        if (args is not ["--sample", var file, var digest] || !Path.IsPathFullyQualified(file)) return 2;

        string stage = "plan";
        SceneCrop? candidate = null;
        PixelMatch? match = null;
        SizeInt32? rootSize = null, childSize = null;
        Snapshot? before = null;
        Node? renderer = null;
        int pairs = 0;
        double? skewMs = null;
        try
        {
            var plan = ReadPlanFile(file, digest);
            Locator.Require(plan.Scope == "fixed-canvas-scene-boundary-v1" && plan.Target == "we-scene", "standalone-scene-plan-required");
            var locatorPlan = plan with { Scope = "fixed-canvas-surface-locator-v1" };
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(8));
            void Check()
            {
                deadline.Token.ThrowIfCancellationRequested();
                if (File.Exists(file + ".stop")) throw new OperationCanceledException("user-stop");
                Locator.Validate(locatorPlan, DateTimeOffset.UtcNow);
            }
            Check();
            using (new FileStream(file + ".claimed", FileMode.CreateNew, FileAccess.Write)) { }

            stage = "topology";
            Snapshot baseline = NativeSurface.Read(plan, Check);
            before = baseline;
            Node selected = CheckTopology();
            renderer = selected;
            long startedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            Node CheckTopology()
            {
                Check();
                Selection selection = Locator.Compare(plan.Target, baseline, NativeSurface.Read(plan, Check));
                Locator.Require(selection.Status == "surface-candidate" && selection.Candidate is not null, selection.Status);
                return selection.Candidate!;
            }

            stage = "device";
            Locator.Require(GraphicsCaptureSession.IsSupported(), "wgc-unsupported");
            using var device = CaptureApi.Device();
            CheckTopology();
            stage = "root-item";
            var rootItem = CaptureApi.Item(plan.Hwnd);
            rootSize = rootItem.Size;
            CheckTopology();
            // Keep the geometric candidate even if WGC rejects a direct child capture.
            var client = selected.Client;
            var clientSize = new SizeInt32 { Width = client.Right - client.Left, Height = client.Bottom - client.Top };
            stage = "root-geometry";
            candidate = SceneEvidence.Crop(baseline, selected, rootSize.Value, clientSize);
            stage = "renderer-item";
            var childItem = CaptureApi.Item(selected.Hwnd);
            childSize = childItem.Size;
            CheckTopology();
            stage = "renderer-geometry";
            SceneEvidence.Crop(baseline, selected, rootSize.Value, childSize.Value);

            stage = "capture-session";
            using var rootPool = Direct3D11CaptureFramePool.CreateFreeThreaded(device,
                DirectXPixelFormat.B8G8R8A8UIntNormalized, 2, rootSize.Value);
            using var childPool = Direct3D11CaptureFramePool.CreateFreeThreaded(device,
                DirectXPixelFormat.B8G8R8A8UIntNormalized, 2, childSize.Value);
            using var rootSession = rootPool.CreateCaptureSession(rootItem);
            using var childSession = childPool.CreateCaptureSession(childItem);
            rootSession.IsCursorCaptureEnabled = false;
            childSession.IsCursorCaptureEnabled = false;
            CheckTopology();
            TimeSpan captureStart = RelativeTime();
            rootSession.StartCapture();
            childSession.StartCapture();

            stage = "frame-pair";
            var clock = Stopwatch.StartNew();
            var rootPixels = new byte[checked(rootSize.Value.Width * rootSize.Value.Height * 4)];
            var childPixels = new byte[checked(childSize.Value.Width * childSize.Value.Height * 4)];
            long nextRead = 0;
            Direct3D11CaptureFrame? root = null, child = null;
            try
            {
                while (clock.ElapsedMilliseconds < 4500 && pairs < 8 && match?.Confirmed != true)
                {
                    Check();
                    TakeLatest(rootPool, ref root);
                    TakeLatest(childPool, ref child);
                    if (root is null || child is null || clock.ElapsedMilliseconds < nextRead ||
                        root.SystemRelativeTime < captureStart || child.SystemRelativeTime < captureStart ||
                        !SceneEvidence.SameTime(root.SystemRelativeTime, child.SystemRelativeTime, RelativeTime()))
                    {
                        Thread.Sleep(10);
                        continue;
                    }
                    CheckTopology();
                    ReadPixels(root, rootSize.Value, rootPixels, deadline.Token);
                    ReadPixels(child, childSize.Value, childPixels, deadline.Token);
                    CheckTopology();
                    pairs++;
                    skewMs = (root.SystemRelativeTime - child.SystemRelativeTime).Duration().TotalMilliseconds;
                    match = SceneEvidence.Match(rootPixels, rootSize.Value, childPixels, candidate);
                    nextRead = clock.ElapsedMilliseconds + 150;
                    root.Dispose();
                    child.Dispose();
                    root = child = null;
                }
            }
            finally { root?.Dispose(); child?.Dispose(); }

            CheckTopology();
            bool confirmed = match?.Confirmed == true;
            Output(new
            {
                outcome = confirmed ? "content-rect-confirmed" : "content-rect-unconfirmed",
                reason = match?.Reason ?? "no-paired-frames", plan.RunId, plan.Pid, plan.StartTicks,
                startedAt, sampledAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                rootHwnd = plan.Hwnd, childHwnd = selected.Hwnd, frame = baseline.Frame, client,
                rootSize = Dimensions(rootSize), childSize = Dimensions(childSize), candidate, match, pairs, skewMs
            });
            return confirmed ? 0 : 1;
        }
        catch (Exception error)
        {
            Output(new
            {
                outcome = "content-rect-unconfirmed", stage, reason = error is InvalidOperationException ? error.Message : error.GetType().Name,
                hresult = $"0x{error.HResult:X8}", rootHwnd = before?.Root.Hwnd, childHwnd = renderer?.Hwnd,
                frame = before?.Frame, client = renderer?.Client, rootSize = Dimensions(rootSize),
                childSize = Dimensions(childSize), candidate, pairs, skewMs
            });
            return 1;
        }
    }

    internal static ReadPlan ReadPlanFile(string path, string digest)
    {
        Locator.Require(new FileInfo(path).LinkTarget is null, "surface-plan-path");
        using var file = File.OpenRead(path);
        Locator.Require(file.Length is > 0 and <= 32768, "surface-input-size");
        var bytes = new byte[checked((int)file.Length)];
        file.ReadExactly(bytes);
        Locator.Require(Convert.ToHexStringLower(SHA256.HashData(bytes)) == digest, "surface-plan-hash");
        return JsonSerializer.Deserialize<ReadPlan>(bytes, Json) ?? throw new InvalidOperationException("surface-input-json");
    }

    internal static void ReadPixels(Direct3D11CaptureFrame frame, SizeInt32 size, byte[] output, CancellationToken token)
    {
        Locator.Require(frame.ContentSize.Width == size.Width && frame.ContentSize.Height == size.Height, "frame-resized");
        using var bitmap = SoftwareBitmap.CreateCopyFromSurfaceAsync(frame.Surface, BitmapAlphaMode.Ignore)
            .AsTask(token).GetAwaiter().GetResult();
        Locator.Require(bitmap.BitmapPixelFormat == BitmapPixelFormat.Bgra8 && bitmap.PixelWidth == size.Width &&
            bitmap.PixelHeight == size.Height, "unexpected-frame-bitmap");
        bitmap.CopyToBuffer(output.AsBuffer());
    }

    private static void TakeLatest(Direct3D11CaptureFramePool pool, ref Direct3D11CaptureFrame? current)
    {
        var next = pool.TryGetNextFrame();
        if (next is null) return;
        current?.Dispose();
        current = next;
    }

    internal static TimeSpan RelativeTime() => TimeSpan.FromSeconds((double)Stopwatch.GetTimestamp() / Stopwatch.Frequency);

    private static object? Dimensions(SizeInt32? size) => size is { } value ? new { value.Width, value.Height } : null;

    private static void Output(object result) => Console.WriteLine(JsonSerializer.Serialize(result, Json));
}
