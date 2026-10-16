using System.Text;
using System.Text.Json;

/// <summary>
/// Motion Cadence Trace Collector for the Native Probe.
///
/// Records frame timestamps across capture and pipe write stages into a bounded ring buffer.
/// When disabled, all record calls are immediate no-ops with zero allocation.
/// When enabled, keeps at most Capacity (default 2048) events and tracks overflow.
/// </summary>
internal sealed class CadenceTrace
{
    public const int DefaultCapacity = 8192;
    public const int SchemaVersion = 1;

    public sealed record RecordEntry(
        string RunId,
        uint Sequence,
        string ClockDomain,
        string Event,
        double AtMonoMs,
        double? WgcTimestampMs = null,
        long? CapturedAt = null,
        double? DurationMs = null,
        bool? Success = null,
        string? Reason = null);

    private readonly string _runId;
    private readonly int _capacity;
    private readonly RecordEntry[] _ring;
    private int _head;
    private int _count;
    private long _totalRecorded;
    private long _overflowCount;

    public bool Enabled { get; }
    public int Capacity => _capacity;
    public long TotalRecorded => _totalRecorded;
    public long OverflowCount => _overflowCount;
    public bool FlushFailed { get; private set; }

    public CadenceTrace(bool enabled, string runId, int capacity = DefaultCapacity)
    {
        Enabled = enabled;
        _runId = runId ?? string.Empty;
        _capacity = Math.Max(16, capacity);
        _ring = enabled ? new RecordEntry[_capacity] : [];
    }

    public void Record(
        string runId,
        uint sequence,
        string eventName,
        double atMonoMs,
        double? wgcTimestampMs = null,
        long? capturedAt = null,
        double? durationMs = null,
        bool? success = null,
        string? reason = null)
    {
        if (!Enabled) return;
        lock (_ring)
        {
            _totalRecorded++;
            var entry = new RecordEntry(
                string.IsNullOrEmpty(runId) ? _runId : runId,
                sequence,
                "native-mono",
                eventName,
                Math.Round(atMonoMs, 3),
                wgcTimestampMs.HasValue ? Math.Round(wgcTimestampMs.Value, 3) : null,
                capturedAt,
                durationMs.HasValue ? Math.Round(durationMs.Value, 3) : null,
                success,
                reason);

            if (_count < _capacity)
            {
                var idx = (_head + _count) % _capacity;
                _ring[idx] = entry;
                _count++;
            }
            else
            {
                // Ring overflow: advance head to drop oldest
                _ring[_head] = entry;
                _head = (_head + 1) % _capacity;
                _overflowCount++;
            }
        }
    }

    public RecordEntry[] Snapshot()
    {
        if (!Enabled) return [];
        lock (_ring)
        {
            var result = new RecordEntry[_count];
            for (var i = 0; i < _count; i++)
            {
                result[i] = _ring[(_head + i) % _capacity];
            }
            return result;
        }
    }

    private Task<bool>? _activePublishTask;
    private readonly object _publishLock = new();

    public async Task<bool> FlushAsync(string outputPath, int timeoutMs = 500)
    {
        if (!Enabled || string.IsNullOrEmpty(outputPath)) return false;

        Task<bool> currentTask;
        CancellationTokenSource cts;

        lock (_publishLock)
        {
            if (_activePublishTask != null && !_activePublishTask.IsCompleted)
            {
                FlushFailed = true;
                return false;
            }

            cts = new CancellationTokenSource();
            _activePublishTask = DoPublishAsync(outputPath, cts);
            currentTask = _activePublishTask;
        }

        try
        {
            var delayTask = Task.Delay(timeoutMs);
            var completed = await Task.WhenAny(currentTask, delayTask);
            if (completed == currentTask)
            {
                return await currentTask;
            }
            else
            {
                FlushFailed = true;
                cts.Cancel();
                return false;
            }
        }
        catch
        {
            FlushFailed = true;
            cts.Cancel();
            return false;
        }
    }

    private async Task<bool> DoPublishAsync(string outputPath, CancellationTokenSource cts)
    {
        try
        {
            FlushFailed = false;
            var records = Snapshot();
            var oldestSeq = records.Length > 0 ? records[0].Sequence : 0;
            var newestSeq = records.Length > 0 ? records[^1].Sequence : 0;

            var payload = new
            {
                enabled = true,
                schemaVersion = SchemaVersion,
                clockDomain = "native-mono",
                runId = _runId,
                capacity = _capacity,
                totalRecorded = _totalRecorded,
                retained = records.Length,
                overflowCount = _overflowCount,
                flushFailed = FlushFailed,
                oldestSequence = oldestSeq,
                newestSequence = newestSeq,
                records,
            };

            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true,
            };
            var jsonBytes = JsonSerializer.SerializeToUtf8Bytes(payload, options);

            var ok = await AtomicFile.Publish(outputPath, jsonBytes);

            if (cts.IsCancellationRequested)
            {
                TryDelete(outputPath);
                TryDelete(outputPath + ".tmp");
                FlushFailed = true;
                return false;
            }

            if (!ok)
            {
                FlushFailed = true;
                return false;
            }

            FlushFailed = false;
            return true;
        }
        catch
        {
            TryDelete(outputPath);
            TryDelete(outputPath + ".tmp");
            FlushFailed = true;
            return false;
        }
        finally
        {
            lock (_publishLock)
            {
                _activePublishTask = null;
            }
            try { cts.Dispose(); } catch { }
        }
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }

    public static async Task SelfTest(string? testDir)
    {
        var dir = testDir ?? Path.Combine(Path.GetTempPath(), $"cadence-trace-selftest-{Guid.NewGuid():N}");
        Directory.CreateDirectory(dir);
        try
        {
            // 1. Test disabled trace: 0 allocations, no file written
            var disabled = new CadenceTrace(false, "run-disabled", 16);
            disabled.Record("run-disabled", 1, "test-event", 10.0);
            if (disabled.TotalRecorded != 0) throw new InvalidOperationException("Disabled trace must not record");
            var disabledFile = Path.Combine(dir, "disabled.json");
            await disabled.FlushAsync(disabledFile);
            if (File.Exists(disabledFile)) throw new InvalidOperationException("Disabled trace must not write file");

            // 2. Test enabled trace & ring buffer wrap
            const int cap = 32;
            var trace = new CadenceTrace(true, "run-test-1", cap);
            for (uint i = 1; i <= 50; i++)
            {
                trace.Record("run-test-1", i, "native-pipe-write", i * 33.3, wgcTimestampMs: i * 33.0, durationMs: 0.5, success: true);
            }

            if (trace.TotalRecorded != 50) throw new InvalidOperationException($"TotalRecorded expected 50, got {trace.TotalRecorded}");
            if (trace.OverflowCount != 18) throw new InvalidOperationException($"OverflowCount expected 18, got {trace.OverflowCount}");

            var snap = trace.Snapshot();
            if (snap.Length != cap) throw new InvalidOperationException($"Snapshot length expected {cap}, got {snap.Length}");
            if (snap[0].Sequence != 19) throw new InvalidOperationException($"Oldest sequence expected 19, got {snap[0].Sequence}");
            if (snap[^1].Sequence != 50) throw new InvalidOperationException($"Newest sequence expected 50, got {snap[^1].Sequence}");

            // 3. Test serialization & schema
            var outFile = Path.Combine(dir, "cadence-trace-native.json");
            await trace.FlushAsync(outFile);
            if (!File.Exists(outFile)) throw new InvalidOperationException("Trace file was not published");

            var text = await File.ReadAllTextAsync(outFile);
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            if (root.GetProperty("schemaVersion").GetInt32() != SchemaVersion) throw new InvalidOperationException("SchemaVersion mismatch");
            if (root.GetProperty("clockDomain").GetString() != "native-mono") throw new InvalidOperationException("ClockDomain mismatch");
            if (root.GetProperty("retained").GetInt32() != cap) throw new InvalidOperationException("Retained count mismatch");
            // 4. Test FlushAsync timeout/failure resilience
            var timeoutFile = Path.Combine(dir, "timeout.json");
            var ok = await trace.FlushAsync(timeoutFile, timeoutMs: 2000);
            if (!ok || trace.FlushFailed) throw new InvalidOperationException("FlushAsync should succeed under normal conditions");

            Console.WriteLine(JsonSerializer.Serialize(new
            {
                ok = true,
                schemaVersion = SchemaVersion,
                retained = snap.Length,
                overflowCount = trace.OverflowCount,
                totalRecorded = trace.TotalRecorded,
            }));
        }
        finally
        {
            try { Directory.Delete(dir, true); } catch { }
        }
    }
}
