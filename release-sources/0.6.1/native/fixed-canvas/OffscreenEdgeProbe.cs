using System.Diagnostics;
using System.Text.Json;
using Windows.Graphics;
using Windows.Graphics.Capture;
using Windows.Graphics.DirectX;

internal static class OffscreenEdgeProbe
{
    internal static int Capture(ReadPlan plan, Func<bool> current, Action<object> Output)
    {
        string stage = "offscreen-topology";
        OffscreenEdgeEvidence? evidence = null;
        try
        {
            var locatorPlan = plan;
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(8));
            void Check()
            {
                deadline.Token.ThrowIfCancellationRequested();
                Locator.Require(current(), "source-monitor-changed");
            }
            stage = "offscreen-topology";
            Snapshot baseline = NativeSurface.Read(locatorPlan, Check);
            Node Recheck()
            {
                Check();
                Selection selection = Locator.Compare(plan.Target, baseline, NativeSurface.Read(locatorPlan, Check));
                Locator.Require(selection.Status == "surface-candidate" && selection.Candidate is not null, selection.Status);
                return selection.Candidate!;
            }
            Node renderer = Recheck();

            stage = "root-item";
            Locator.Require(GraphicsCaptureSession.IsSupported(), "wgc-unsupported");
            using var device = CaptureApi.Device();
            Recheck();
            var item = CaptureApi.Item(plan.Hwnd);
            SizeInt32 size = item.Size;
            var clientSize = new SizeInt32 { Width = renderer.Client.Right - renderer.Client.Left,
                Height = renderer.Client.Bottom - renderer.Client.Top };
            SceneCrop crop = SceneEvidence.Crop(baseline, renderer, size, clientSize);
            evidence = new(size, crop);

            stage = "root-capture";
            using var pool = Direct3D11CaptureFramePool.CreateFreeThreaded(device,
                DirectXPixelFormat.B8G8R8A8UIntNormalized, 2, size);
            using var session = pool.CreateCaptureSession(item);
            session.IsCursorCaptureEnabled = false;
            Recheck();
            TimeSpan captureStart = SceneBoundary.RelativeTime();
            session.StartCapture();
            var pixels = new byte[checked(size.Width * size.Height * 4)];
            try
            {
                var clock = Stopwatch.StartNew();
                TimeSpan nextSample = captureStart;
                int samples = 0;
                while (clock.ElapsedMilliseconds < 4500 && samples < 12)
                {
                    Check();
                    using var frame = pool.TryGetNextFrame();
                    if (frame is not null)
                    {
                        TimeSpan timestamp = frame.SystemRelativeTime;
                        TimeSpan age = SceneBoundary.RelativeTime() - timestamp;
                        if (timestamp >= nextSample && age >= TimeSpan.Zero && age <= TimeSpan.FromMilliseconds(200))
                        {
                            Recheck();
                            SceneBoundary.ReadPixels(frame, size, pixels, deadline.Token);
                            Recheck();
                            evidence.Add(pixels, timestamp);
                            samples++;
                            nextSample = timestamp + TimeSpan.FromMilliseconds(300);
                            continue;
                        }
                    }
                    Thread.Sleep(10);
                }
            }
            finally { Array.Clear(pixels); }
            Recheck();
            var report = evidence.Report();
            Output(new { outcome = report.Usable ? "offscreen-root-profile-recorded" : "offscreen-root-profile-incomplete",
                plan.RunId, plan.Pid, plan.StartTicks, rootHwnd = plan.Hwnd, childHwnd = renderer.Hwnd,
                frame = baseline.Frame, client = renderer.Client, rootSize = new { size.Width, size.Height }, crop,
                capture = new { report.Usable, report.InteriorMotion }, screenPixelReads = 0, imagesSaved = false });
            return report.Usable ? 0 : 1;
        }
        catch (Exception error)
        {
            Output(new { outcome = "offscreen-root-profile-incomplete", stage,
                reason = error is InvalidOperationException ? error.Message : error.GetType().Name,
                hresult = $"0x{error.HResult:X8}",
                contentBoundaryVerified = false, screenPixelReads = 0, imagesSaved = false });
            return 1;
        }
    }

}
