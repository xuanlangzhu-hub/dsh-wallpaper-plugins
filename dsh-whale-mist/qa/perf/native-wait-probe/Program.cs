using System.Diagnostics;
using System.Text.Json;

internal static class Program
{
    private static readonly int[] Requests = [1, 2, 10, 16, 18, 30];
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
    };

    private static async Task<int> Main(string[] args)
    {
        try
        {
            if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Windows timing experiment only");
            var options = new Dictionary<string, string>();
            for (var i = 0; i < args.Length; i += 2)
            {
                if (i + 1 >= args.Length || !args[i].StartsWith("--") || !options.TryAdd(args[i], args[i + 1]))
                    throw new ArgumentException("Use --mode baseline|compare|self-test --output <new-directory> [--iterations 24]");
            }
            if (options.Keys.Any(key => key is not ("--mode" or "--output" or "--iterations" or "--methods")))
                throw new ArgumentException("Unknown argument");
            var mode = options.GetValueOrDefault("--mode", "baseline");
            if (mode is not ("baseline" or "compare" or "self-test")) throw new ArgumentException("Unknown mode");
            var output = Path.GetFullPath(options["--output"]);
            var iterations = int.Parse(options.GetValueOrDefault("--iterations", "24"));
            if (iterations is < 8 or > 128) throw new ArgumentOutOfRangeException(nameof(iterations));
            if (Directory.Exists(output) || File.Exists(output)) throw new IOException("Output must not exist");
            Directory.CreateDirectory(output);
            if (mode == "self-test")
            {
                var checks = await RunSelfTests();
                await Save(output, "self-test.json", new { passed = true, checks, noWindowsOrCapture = true });
                Console.WriteLine($"self-test passed: {checks.Count} checks");
                return 0;
            }
            var results = new List<object>();
            var precisionPassed = true;
            var precisionCohortsEvaluated = 0;
            string[] methods = mode == "baseline" ? ["task-delay-tracked"] :
                ["task-delay-plain", "task-delay-tracked", "kernel-normal-direct", "kernel-highres-direct", "kernel-highres-worker"];
            if (options.TryGetValue("--methods", out var selectedMethods))
            {
                var selected = selectedMethods.Split(',');
                if (mode != "compare" || selected.Length == 0 || selected.Distinct().Count() != selected.Length || selected.Any(value => !methods.Contains(value)))
                    throw new ArgumentException("--methods requires a unique supported subset in compare mode");
                methods = selected;
            }
            for (var round = 0; round < (mode == "compare" ? 2 : 1); round++)
            {
                foreach (var method in round == 0 ? methods : methods.Reverse())
                foreach (var request in round == 0 ? Requests : Requests.Reverse())
                {
                    var result = await Measure(method, request, iterations, round);
                    if (mode == "baseline" || method.StartsWith("kernel-highres"))
                    {
                        precisionCohortsEvaluated++;
                        precisionPassed &= result.MeanExcessMs <= 2 && result.P95ExcessMs <= 5 && result.EarlyByMoreThanPointOneMs == 0;
                    }
                    results.Add(result);
                    Console.WriteLine($"round={round} {method} request={request}ms actualMean={result.Actual.MeanMs:F3}ms excessMean={result.MeanExcessMs:F3}ms cpuMs={result.CpuMs:F3}");
                }
            }
            var report = new
            {
                schemaVersion = 1,
                state = "local_wait_experiment",
                createdAt = DateTimeOffset.UtcNow,
                mode,
                iterations,
                requestsMs = Requests,
                runtime = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                synchronizationContext = SynchronizationContext.Current?.GetType().FullName ?? "none",
                precisionGoal = new { meanExcessAtMostMs = 2, p95ExcessAtMostMs = 5,
                    evaluatedCohorts = precisionCohortsEvaluated, passed = precisionCohortsEvaluated == 0 ? (bool?)null : precisionPassed },
                results,
                boundaries = new[] { "Actual OS waits, no WGC/WE/DSH/windows/GPU operations.", "Direct native modes block the caller. Worker mode uses one private timer thread with asynchronously dispatched continuations. Neither is integrated into capture.", "CPU percent is one logical core, not machine capacity or power.", "Timing criteria are a local experiment gate, not deterministic CI or wallpaper FPS proof." },
            };
            await Save(output, "results.json", report);
            return precisionCohortsEvaluated == 0 || precisionPassed ? 0 : 5;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"{exception.GetType().Name}: {exception.Message}");
            return 2;
        }
    }

    private static async Task<Measurement> Measure(string method, int request, int iterations, int round)
    {
        var clock = Stopwatch.StartNew();
        var tracker = new NativePacingTracker();
        using var timer = method.EndsWith("-direct") ? new KernelWaitTimer(method == "kernel-highres-direct") : null;
        using var worker = method == "kernel-highres-worker" ? new NativePacingDelay() : null;
        // Fractional margin keeps the real legacy integer truncation exactly at request.
        var work = 1000.0 / 30 - request - 0.25;
        if (NativePacingTracker.ComputePacingRequested(30, work) != request)
            throw new InvalidOperationException("Legacy pacing request differs");
        async Task<double> Once()
        {
            if (method == "task-delay-plain")
            {
                var start = clock.Elapsed.TotalMilliseconds;
                await Task.Delay(request);
                return clock.Elapsed.TotalMilliseconds - start;
            }
            var (_, actual) = await tracker.ExecutePacingWaitAsync(30, work,
                () => clock.Elapsed.TotalMilliseconds, ms =>
                {
                    if (worker is not null) return worker.DelayAsync(ms);
                    if (timer is null) return Task.Delay(ms);
                    timer.Wait(ms);
                    return Task.CompletedTask;
                });
            return actual;
        }
        for (var i = 0; i < 4; i++) await Once();
        using var process = Process.GetCurrentProcess();
        process.Refresh();
        var cpuStart = process.TotalProcessorTime.TotalMilliseconds;
        var start = clock.Elapsed.TotalMilliseconds;
        var samples = new List<double>();
        for (var i = 0; i < iterations; i++) samples.Add(await Once());
        var wall = clock.Elapsed.TotalMilliseconds - start;
        process.Refresh();
        var cpu = process.TotalProcessorTime.TotalMilliseconds - cpuStart;
        var sorted = samples.Order().ToArray();
        var actualStats = new Stats(sorted.Length, sorted.Average(), sorted[0],
            sorted[sorted.Length / 2], sorted[(int)Math.Ceiling(sorted.Length * .95) - 1], sorted[^1]);
        if (timer?.LastCancelError is > 0) throw new InvalidOperationException("Timer cancellation failed");
        return new(method, round, request, actualStats, actualStats.MeanMs - request, actualStats.P95Ms - request,
            wall, cpu, 100 * cpu / wall, samples.Count(value => value < request - .1), samples);
    }

    private static async Task<List<string>> RunSelfTests()
    {
        return await NativePacingDelay.RunComprehensiveSelfTests();
    }

    private static async Task Save(string output, string name, object value)
    {
        await using var stream = new FileStream(Path.Combine(output, name), FileMode.CreateNew, FileAccess.Write);
        await JsonSerializer.SerializeAsync(stream, value, Json);
    }

    private sealed record Stats(int Count, double MeanMs, double MinMs, double P50Ms, double P95Ms, double MaxMs);
    private sealed record Measurement(string Method, int Round, int RequestedMs, Stats Actual, double MeanExcessMs,
        double P95ExcessMs, double WallMs, double CpuMs, double OneCoreCpuPercent, int EarlyByMoreThanPointOneMs, List<double> SamplesMs);
}
