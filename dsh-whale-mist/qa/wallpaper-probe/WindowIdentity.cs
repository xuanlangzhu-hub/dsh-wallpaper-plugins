using System.Diagnostics;
using System.Runtime.InteropServices;

/// <summary>
/// The identity and window facts the strategy needs, captured in one place so a fake can supply them
/// in the offline self-checks. <see cref="StartTimeUtc"/> is the process creation time: a recycled PID
/// has a different one, which is what makes "same PID" an insufficient identity.
/// </summary>
public sealed record WindowSnapshot(
    long Hwnd,
    uint Pid,
    string ProcessName,
    string Title,
    bool Exists,
    bool Visible,
    bool Iconic,
    bool Cloaked,
    int Left,
    int Top,
    int Width,
    int Height,
    long Style,
    long ExStyle,
    long Owner,
    long Parent,
    DateTimeOffset? StartTimeUtc,
    long ZOrderIndex);

/// <summary>One candidate window that carries the expected round name.</summary>
public sealed record WindowCandidate(long Hwnd, uint Pid, string Title);

/// <summary>The window and process observations, injectable so the state machine is testable.</summary>
public interface IWindowProbe
{
    /// <summary>Every window whose title is exactly the round name. Never a prefix match.</summary>
    IReadOnlyList<WindowCandidate> FindByExactTitle(string location);

    /// <summary>The full snapshot of one HWND, or a snapshot with Exists=false when it is gone.</summary>
    WindowSnapshot Inspect(long hwnd);
}

/// <summary>
/// Reads the real window process StartTime. The offline checks replace this so they never touch a real
/// process, and the report always states which source was used.
/// </summary>
public interface IProcessClock
{
    DateTimeOffset? StartTimeUtc(int pid);
}

public sealed class RealProcessClock : IProcessClock
{
    public DateTimeOffset? StartTimeUtc(int pid)
    {
        try
        {
            using var process = Process.GetProcessById(pid);
            return new DateTimeOffset(process.StartTime.ToUniversalTime(), TimeSpan.Zero);
        }
        catch (ArgumentException) { return null; }
        catch (InvalidOperationException) { return null; }
    }
}

/// <summary>
/// The real probe. It reuses the accepted helper's strong verification
/// (<c>VerifyExpectedWindow</c> with <c>waitMs: 0</c>) for the location/PID/process-name checks and
/// adds the process StartTime plus the owner/parent/Z facts the QA report has to prove.
/// </summary>
public sealed class RealWindowProbe : IWindowProbe
{
    private readonly string _location;
    private readonly int _expectedPid;
    private readonly DateTimeOffset _expectedStart;
    private readonly IProcessClock _clock;

    public RealWindowProbe(string location, int expectedPid, DateTimeOffset expectedStart, IProcessClock? clock = null)
    {
        _location = location;
        _expectedPid = expectedPid;
        _expectedStart = expectedStart;
        _clock = clock ?? new RealProcessClock();
    }

    public IReadOnlyList<WindowCandidate> FindByExactTitle(string location)
        => [.. SourceWindowHelperQa.FindExactTitle(location).Select(window => new WindowCandidate(window.Hwnd, window.Pid, window.Title))];

    /// <summary>
    /// Verify the target and return its snapshot, or throw with a specific reason. The accepted
    /// verification runs first (it refuses an invalid HWND, a missing/ambiguous title, a different
    /// owner PID and a non-wallpaper64 process); the StartTime check is added here.
    /// </summary>
    public WindowSnapshot Inspect(long hwnd)
    {
        var matches = SourceWindowHelperQa.FindExactTitle(_location);
        if (matches.Count == 0) return Missing(hwnd, "target-closed");
        if (matches.Count > 1) throw new InvalidOperationException($"target-ambiguous: {matches.Count} windows named '{_location}'");
        var verified = SourceWindowHelper.VerifyExpectedWindow((nint)hwnd, _location, _expectedPid, waitMs: 0);
        var start = _clock.StartTimeUtc((int)verified.Pid);
        if (start is null) throw new InvalidOperationException("target-process-gone");
        if (start.Value != _expectedStart)
            throw new InvalidOperationException($"target-start-time-changed: expected {_expectedStart:O}, got {start.Value:O}");
        return Snapshot(verified, start.Value);
    }

    public DateTimeOffset? StartTime(int pid) => _clock.StartTimeUtc(pid);

    /// <summary>The snapshot without any verification, used for logging a target this round does not own.</summary>
    public WindowSnapshot ObserveUnverified(long hwnd)
    {
        var state = SourceWindowHelper.Inspect((nint)hwnd);
        return Snapshot(state, _clock.StartTimeUtc((int)state.Pid));
    }

    private static WindowSnapshot Missing(long hwnd, string reason) => new WindowSnapshot(
        hwnd, 0, string.Empty, reason, false, false, false, false,
        0, 0, 0, 0, 0, 0, 0, 0, null, -1);

    private static WindowSnapshot Snapshot(WindowState state, DateTimeOffset? start) => new WindowSnapshot(
        state.Hwnd,
        state.Pid,
        state.ProcessName,
        state.Title,
        state.Exists,
        state.Visible,
        state.Iconic,
        state.Cloaked,
        state.Left,
        state.Top,
        state.Width,
        state.Height,
        state.Style,
        state.ExStyle,
        // Owner, parent and Z are read through the QA companion: the accepted record does not carry them.
        SourceWindowHelperQa.OwnerOf((nint)state.Hwnd),
        SourceWindowHelperQa.ParentOf((nint)state.Hwnd),
        start,
        SourceWindowHelperQa.ZOrderIndexOf((nint)state.Hwnd));

}

public static class SourceWindowHelperQa
{
    private const long GW_OWNER = 4;

    public static List<WindowState> FindExactTitle(string location)
    {
        var name = SourceWindowHelper.RequireProbeLocation(location);
        return [.. SourceWindowHelper.FindProbeWindows().Where(window => window.Title == name)];
    }

    public static long OwnerOf(nint hwnd) => (long)GetWindow(hwnd, unchecked((uint)GW_OWNER));
    public static long ParentOf(nint hwnd) => (long)GetParent(hwnd);

    public static long ZOrderIndexOf(nint hwnd)
    {
        var index = 0L;
        foreach (var window in SourceWindowHelper.FindProbeWindows())
        {
            if (window.Hwnd == (long)hwnd) return index;
            index++;
        }
        return -1;
    }

    [DllImport("user32.dll")] private static extern nint GetWindow(nint hwnd, uint cmd);
    [DllImport("user32.dll")] private static extern nint GetParent(nint hwnd);
}
