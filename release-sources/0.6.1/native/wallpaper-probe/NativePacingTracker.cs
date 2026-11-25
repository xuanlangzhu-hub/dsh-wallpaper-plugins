using System.Text.Json.Serialization;

/// <summary>
/// Bounded, single-run owned metrics for native capture loop pacing and delay breakdown.
/// Covers:
/// 1. Pacing delay requested vs actual await duration.
/// 2. Post-record work (from record assembly to sleep, including status publish).
/// 3. Status publish work isolated from ordinary frames.
/// 4. Empty frame retries (WGC TryGetNextFrame == null) requested vs actual delay.
/// 5. Cycle interval between consecutive successful frame loop starts.
/// 6. Total active frame work (encodeMs + postRecordMs).
/// </summary>
internal sealed class NativePacingTracker
{
    public long PacingWaitCount { get; private set; }
    public double PacingWaitRequestedSumMs { get; private set; }
    public double? PacingWaitRequestedMaxMs { get; private set; }
    public double PacingWaitActualSumMs { get; private set; }
    public double? PacingWaitActualMaxMs { get; private set; }

    public long PostRecordCount { get; private set; }
    public double PostRecordSumMs { get; private set; }
    public double? PostRecordMaxMs { get; private set; }

    public long StatusPublishCount { get; private set; }
    public double StatusPublishSumMs { get; private set; }
    public double? StatusPublishMaxMs { get; private set; }

    public long EmptyRetryCount { get; private set; }
    public double EmptyWaitRequestedSumMs { get; private set; }
    public double? EmptyWaitRequestedMaxMs { get; private set; }
    public double EmptyWaitActualSumMs { get; private set; }
    public double? EmptyWaitActualMaxMs { get; private set; }

    public long CycleIntervalCount { get; private set; }
    public double CycleIntervalSumMs { get; private set; }
    public double? CycleIntervalMaxMs { get; private set; }

    public long TotalWorkCount { get; private set; }
    public double TotalWorkSumMs { get; private set; }
    public double? TotalWorkMaxMs { get; private set; }

    public void RecordPacingWait(double requestedMs, double actualMs)
    {
        var req = Math.Max(0, requestedMs);
        var act = Math.Max(0, actualMs);
        PacingWaitCount++;
        PacingWaitRequestedSumMs = Math.Round(PacingWaitRequestedSumMs + req, 2);
        PacingWaitRequestedMaxMs = Math.Round(Math.Max(PacingWaitRequestedMaxMs ?? 0, req), 2);
        PacingWaitActualSumMs = Math.Round(PacingWaitActualSumMs + act, 2);
        PacingWaitActualMaxMs = Math.Round(Math.Max(PacingWaitActualMaxMs ?? 0, act), 2);
    }

    public void RecordPostRecordWork(double postRecordMs, double totalWorkMs)
    {
        var pr = Math.Max(0, postRecordMs);
        var tw = Math.Max(0, totalWorkMs);
        PostRecordCount++;
        PostRecordSumMs = Math.Round(PostRecordSumMs + pr, 2);
        PostRecordMaxMs = Math.Round(Math.Max(PostRecordMaxMs ?? 0, pr), 2);

        TotalWorkCount++;
        TotalWorkSumMs = Math.Round(TotalWorkSumMs + tw, 2);
        TotalWorkMaxMs = Math.Round(Math.Max(TotalWorkMaxMs ?? 0, tw), 2);
    }

    public void RecordStatusPublish(double durationMs)
    {
        var dur = Math.Max(0, durationMs);
        StatusPublishCount++;
        StatusPublishSumMs = Math.Round(StatusPublishSumMs + dur, 2);
        StatusPublishMaxMs = Math.Round(Math.Max(StatusPublishMaxMs ?? 0, dur), 2);
    }

    public void RecordEmptyRetry(double requestedMs, double actualMs)
    {
        var req = Math.Max(0, requestedMs);
        var act = Math.Max(0, actualMs);
        EmptyRetryCount++;
        EmptyWaitRequestedSumMs = Math.Round(EmptyWaitRequestedSumMs + req, 2);
        EmptyWaitRequestedMaxMs = Math.Round(Math.Max(EmptyWaitRequestedMaxMs ?? 0, req), 2);
        EmptyWaitActualSumMs = Math.Round(EmptyWaitActualSumMs + act, 2);
        EmptyWaitActualMaxMs = Math.Round(Math.Max(EmptyWaitActualMaxMs ?? 0, act), 2);
    }

    public void RecordCycleInterval(double intervalMs)
    {
        var iv = Math.Max(0, intervalMs);
        CycleIntervalCount++;
        CycleIntervalSumMs = Math.Round(CycleIntervalSumMs + iv, 2);
        CycleIntervalMaxMs = Math.Round(Math.Max(CycleIntervalMaxMs ?? 0, iv), 2);
    }

    /// <summary>
    /// R1: Exact legacy pacing wait calculation using integer truncation.
    /// Math.Max(1, (int)(1000.0 / fps - elapsedSinceStartMs)).
    /// </summary>
    public static int ComputePacingRequested(int fps, double elapsedSinceStartMs)
    {
        return Math.Max(1, (int)(1000.0 / fps - elapsedSinceStartMs));
    }

    /// <summary>
    /// Measures post-record work (from recordAssembledAt to beforeSleep)
    /// and total active work (from frameStart to beforeSleep).
    /// </summary>
    public (double postRecordMs, double totalWorkMs) MeasurePostRecord(
        double recordAssembledAtMs,
        double frameStartMs,
        double currentElapsedMs)
    {
        var postRecord = Math.Max(0, currentElapsedMs - recordAssembledAtMs);
        var totalWork = Math.Max(0, currentElapsedMs - frameStartMs);
        RecordPostRecordWork(postRecord, totalWork);
        return (postRecord, totalWork);
    }

    /// <summary>
    /// R3: Executes the pacing wait with injectable clock/delay delegates.
    /// </summary>
    public async Task<(int requestedMs, double actualMs)> ExecutePacingWaitAsync(
        int fps,
        double elapsedBeforeWaitMs,
        Func<double>? getClockElapsedMs = null,
        Func<int, Task>? delayFunc = null)
    {
        int requested = ComputePacingRequested(fps, elapsedBeforeWaitMs);
        double actual;
        if (delayFunc != null && getClockElapsedMs != null)
        {
            var start = getClockElapsedMs();
            await delayFunc(requested);
            actual = Math.Max(0, getClockElapsedMs() - start);
        }
        else
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            await Task.Delay(requested);
            actual = sw.Elapsed.TotalMilliseconds;
        }
        RecordPacingWait(requested, actual);
        return (requested, actual);
    }

    /// <summary>
    /// R3: Executes an empty retry wait with injectable clock/delay delegates.
    /// </summary>
    public async Task<(double requestedMs, double actualMs)> ExecuteEmptyRetryWaitAsync(
        double requestedMs,
        Func<double>? getClockElapsedMs = null,
        Func<int, Task>? delayFunc = null)
    {
        double actual;
        if (delayFunc != null && getClockElapsedMs != null)
        {
            var start = getClockElapsedMs();
            await delayFunc((int)requestedMs);
            actual = Math.Max(0, getClockElapsedMs() - start);
        }
        else
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            await Task.Delay((int)requestedMs);
            actual = sw.Elapsed.TotalMilliseconds;
        }
        RecordEmptyRetry(requestedMs, actual);
        return (requestedMs, actual);
    }

    public static async Task SelfTest(string outputDir)
    {
        Directory.CreateDirectory(outputDir);
        var options = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase };

        // 1. Verify R1 delay truncation cases
        var r1Cases = new[]
        {
            (fps: 30, work: 15.6, expected: 17),
            (fps: 30, work: 15.3, expected: 18),
            (fps: 30, work: 17.8, expected: 15),
            (fps: 30, work: 34.0, expected: 1),
        };
        foreach (var (f, w, exp) in r1Cases)
        {
            int req = ComputePacingRequested(f, w);
            if (req != exp) throw new InvalidOperationException($"R1 mismatch for fps={f}, work={w}: got {req}, expected {exp}");
        }

        // 2. Initial state verification
        var tracker = new NativePacingTracker();
        var initSnap = tracker.GetSnapshot();
        if (initSnap.PacingWaitCount != 0 || initSnap.PacingWaitRequestedMaxMs != null || initSnap.TotalWorkMaxMs != null)
            throw new InvalidOperationException("Initial tracker state is not zero/null.");

        // 3. Inject empty frame retries (3 retries: requested 2ms, actual 5ms each)
        double virtualClock = 100.0;
        for (int i = 0; i < 3; i++)
        {
            await tracker.ExecuteEmptyRetryWaitAsync(
                2.0,
                () => virtualClock,
                async (ms) => { virtualClock += 5.0; await Task.CompletedTask; });
        }

        // 4. Frame 1: cycleInterval, post-record, pacing wait
        double frame1Start = virtualClock; // 115.0
        double recordAssembledAt = frame1Start + 15.0; // 130.0 (encodeMs = 15)
        tracker.RecordStatusPublish(2.0); // status publish = 2ms
        virtualClock = recordAssembledAt + 20.0; // 150.0 (postRecord = 20, totalWork = 35)

        var (pr1, tw1) = tracker.MeasurePostRecord(recordAssembledAt, frame1Start, virtualClock);
        if (pr1 != 20.0 || tw1 != 35.0)
            throw new InvalidOperationException($"Post-record measurement mismatch: got pr={pr1}, tw={tw1}");

        // Injected pacing wait: 23.33ms elapsed yields exact (int)(33.33 - 23.33) = 10ms requested, actual 25ms
        await tracker.ExecutePacingWaitAsync(
            30,
            23.33, // elapsedBeforeWait
            () => virtualClock,
            async (ms) => { virtualClock += 25.0; await Task.CompletedTask; });

        // Record cycle interval for Frame 2
        tracker.RecordCycleInterval(40.0);

        var snap = tracker.GetSnapshot();

        // Write status.json and summary.json using the real probe payload shape
        var statusRecord = new
        {
            frames = 1,
            changed = 1,
            seconds = 0.05,
            width = 1280,
            height = 720,
            bytes = 4096,
            hash = "synthetic-hash",
            mode = "pipe",
            skippedPublications = 0,
            captureSource = "window",
            sourceTimestampMs = 1700000000100L,
            capturedAt = 1700000000100L,
            pipeMs = 0.5,
            sourceAgeMs = 1.0,
            minimized = false,
            foreground = true,
            visible = true,
            cloaked = false,
            winLeft = 0,
            winTop = 0,
            acquireMs = 1.0,
            readbackMs = 5.0,
            jpegMs = 8.0,
            packHashMs = 0.5,
            imageWriteMs = 0.5,
            encodeMs = 15.0,
            cycleIntervalMs = 40.0,
            prevPacingRequestedMs = 10,
            prevPacingActualMs = 25.0,
            prevPostRecordMs = 20.0,
            prevEmptyRetryCount = 3,
            prevEmptyWaitActualMs = 15.0,
            isStatusFrame = true,
            pacing = snap,
        };

        await AtomicFile.Publish(Path.Combine(outputDir, "status.json"), System.Text.Encoding.UTF8.GetBytes(System.Text.Json.JsonSerializer.Serialize(statusRecord, options)));

        var summary = System.Text.Json.JsonSerializer.Serialize(new
        {
            frames = 1,
            seconds = 0.05,
            captureSource = "window",
            pacing = snap,
        }, options);
        await File.WriteAllTextAsync(Path.Combine(outputDir, "summary.json"), summary);

        // Also emit ProbeJournal Status and Summary to stderr so Host parser can exercise journal.push
        ProbeJournal.Status(statusRecord);
        ProbeJournal.Info("Summary", summary);

        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new
        {
            ok = true,
            mismatches = 0,
            r1Checked = true,
            snapshotFields = 22,
            pacing = snap,
        }, options));
    }

    public NativePacingSnapshot GetSnapshot() => new(
        PacingWaitCount,
        PacingWaitRequestedSumMs,
        PacingWaitRequestedMaxMs,
        PacingWaitActualSumMs,
        PacingWaitActualMaxMs,
        PostRecordCount,
        PostRecordSumMs,
        PostRecordMaxMs,
        StatusPublishCount,
        StatusPublishSumMs,
        StatusPublishMaxMs,
        EmptyRetryCount,
        EmptyWaitRequestedSumMs,
        EmptyWaitRequestedMaxMs,
        EmptyWaitActualSumMs,
        EmptyWaitActualMaxMs,
        CycleIntervalCount,
        CycleIntervalSumMs,
        CycleIntervalMaxMs,
        TotalWorkCount,
        TotalWorkSumMs,
        TotalWorkMaxMs
    );
}

internal sealed record NativePacingSnapshot(
    [property: JsonPropertyName("pacingWaitCount")] long PacingWaitCount,
    [property: JsonPropertyName("pacingWaitRequestedSumMs")] double PacingWaitRequestedSumMs,
    [property: JsonPropertyName("pacingWaitRequestedMaxMs")] double? PacingWaitRequestedMaxMs,
    [property: JsonPropertyName("pacingWaitActualSumMs")] double PacingWaitActualSumMs,
    [property: JsonPropertyName("pacingWaitActualMaxMs")] double? PacingWaitActualMaxMs,
    [property: JsonPropertyName("postRecordCount")] long PostRecordCount,
    [property: JsonPropertyName("postRecordSumMs")] double PostRecordSumMs,
    [property: JsonPropertyName("postRecordMaxMs")] double? PostRecordMaxMs,
    [property: JsonPropertyName("statusPublishCount")] long StatusPublishCount,
    [property: JsonPropertyName("statusPublishSumMs")] double StatusPublishSumMs,
    [property: JsonPropertyName("statusPublishMaxMs")] double? StatusPublishMaxMs,
    [property: JsonPropertyName("emptyRetryCount")] long EmptyRetryCount,
    [property: JsonPropertyName("emptyWaitRequestedSumMs")] double EmptyWaitRequestedSumMs,
    [property: JsonPropertyName("emptyWaitRequestedMaxMs")] double? EmptyWaitRequestedMaxMs,
    [property: JsonPropertyName("emptyWaitActualSumMs")] double EmptyWaitActualSumMs,
    [property: JsonPropertyName("emptyWaitActualMaxMs")] double? EmptyWaitActualMaxMs,
    [property: JsonPropertyName("cycleIntervalCount")] long CycleIntervalCount,
    [property: JsonPropertyName("cycleIntervalSumMs")] double CycleIntervalSumMs,
    [property: JsonPropertyName("cycleIntervalMaxMs")] double? CycleIntervalMaxMs,
    [property: JsonPropertyName("totalWorkCount")] long TotalWorkCount,
    [property: JsonPropertyName("totalWorkSumMs")] double TotalWorkSumMs,
    [property: JsonPropertyName("totalWorkMaxMs")] double? TotalWorkMaxMs
);
