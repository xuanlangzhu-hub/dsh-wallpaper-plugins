using System.Text;

/// <summary>
/// Bounded per-frame evidence for a run that may last hours.
///
/// Retention is defined on the real frame sequence, not on array positions: the newest
/// <c>denseTail</c> frames are kept one by one, and older frames are kept when their frame
/// number is a multiple of <c>sampleEvery</c>. The file is rewritten (header plus the window)
/// on each flush, so its size has a ceiling that does not depend on the run time, and the
/// header states which policy produced the window.
/// </summary>
internal sealed class FrameLog : IAsyncDisposable
{
    private readonly string _path;
    private readonly int _capacity;
    private readonly int _sampleEvery;
    private readonly LinkedList<(long Frame, string Line)> _window = new();
    private long _total;
    private bool _disposed;

    public FrameLog(string path, int capacity, int sampleEvery = 30, int denseTail = 200)
    {
        _path = path;
        _capacity = Math.Max(2, capacity);
        _sampleEvery = Math.Max(1, sampleEvery);
        DenseTail = Math.Max(0, Math.Min(denseTail, _capacity - 1));
    }

    /// <summary>How many of the newest frames are kept one by one.</summary>
    public int DenseTail { get; }

    /// <summary>Records the file currently holds.</summary>
    public int Retained => _window.Count;

    /// <summary>Total frames this session recorded, including the sampled-away ones.</summary>
    public long Total => _total;

    /// <summary>Frame numbers currently retained, oldest first (used by the self test).</summary>
    public long[] RetainedFrames() => _window.Select(entry => entry.Frame).ToArray();

    /// <summary>Records one frame and keeps the window bounded.</summary>
    public void Add(long frame, string line)
    {
        _total = Math.Max(_total + 1, frame);
        _window.AddLast((frame, line));
        if (_window.Count <= _capacity) return;
        // Drop an old frame that the sampling policy does not require: the oldest entry whose
        // frame number is not a multiple of sampleEvery, and never one inside the dense tail.
        var oldest = _window.First;
        var denseStart = Math.Max(0, _window.Count - DenseTail);
        var index = 0;
        while (oldest is not null && index < denseStart)
        {
            if (oldest.Value.Frame % _sampleEvery != 0) { _window.Remove(oldest); return; }
            oldest = oldest.Next;
            index++;
        }
        // Everything outside the dense tail is a sample already: drop the oldest of them.
        if (_window.Count > DenseTail) _window.RemoveFirst();
    }

    /// <summary>Writes the bounded file: a header describing the retention, then the window.</summary>
    public async Task FlushAsync()
    {
        var frames = RetainedFrames();
        var builder = new StringBuilder(_window.Count * 320 + 260);
        builder.Append("{\"log\":\"bounded\",\"policy\":\"dense-tail-plus-frame-sampling\"")
            .Append(",\"retained\":").Append(_window.Count)
            .Append(",\"capacity\":").Append(_capacity)
            .Append(",\"sampleEvery\":").Append(_sampleEvery)
            .Append(",\"denseTail\":").Append(DenseTail)
            .Append(",\"total\":"); builder.Append(_total);
        if (frames.Length > 0)
        {
            builder.Append(",\"oldestRetainedFrame\":").Append(frames[0])
                .Append(",\"newestRetainedFrame\":").Append(frames[^1]);
        }
        builder.Append("}\n");
        foreach (var entry in _window) builder.Append(entry.Line).Append('\n');
        await AtomicFile.Publish(_path, Encoding.UTF8.GetBytes(builder.ToString()));
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;
        await FlushAsync();
    }
}
