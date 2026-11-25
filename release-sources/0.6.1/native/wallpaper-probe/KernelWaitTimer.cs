using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

// P4 Production Component: High-resolution kernel timer wrapper.
// Encapsulates CreateWaitableTimerExW, SetWaitableTimerEx, CancelWaitableTimer.
// Blocks only the caller of Wait(); must be managed by NativePacingDelay for asynchronous capture pacing.
internal sealed class KernelWaitTimer : IDisposable
{
    private readonly object gate = new();
    private readonly TimerWaitHandle timer;
    private bool waiting;
    private bool disposed;

    internal int LastCancelError { get; private set; }
    internal bool IsClosed => timer.SafeWaitHandle.IsClosed;
    internal uint Flags { get; }

    // Fault injection hooks for testing
    internal static bool SimulateCreateTimerFailure { get; set; }
    internal bool SimulateSetTimerFailure { get; set; }
    internal int? OverrideWatchdogMs { get; set; }
    internal bool SimulateCancelTimerFailure { get; set; }

    internal KernelWaitTimer(bool highResolution)
    {
        if (SimulateCreateTimerFailure)
        {
            throw new Win32Exception(1450 /* ERROR_NO_SYSTEM_RESOURCES */, "Simulated CreateWaitableTimerExW failure");
        }

        Flags = highResolution ? 0x00000002u : 0;
        // Unnamed, non-inheritable, synchronization + modify-state rights only (0x00100002).
        var handle = CreateWaitableTimerExW(0, null, Flags, 0x00100002);
        if (handle.IsInvalid)
        {
            var error = Marshal.GetLastWin32Error();
            handle.Dispose();
            throw new Win32Exception(error, "CreateWaitableTimerExW");
        }
        timer = new TimerWaitHandle(handle);
    }

    internal static long RelativeDueTime(int milliseconds)
    {
        if (milliseconds is < 1 or > 10000) throw new ArgumentOutOfRangeException(nameof(milliseconds));
        return checked(-10000L * milliseconds);
    }

    internal void Wait(int milliseconds, CancellationToken cancellationToken = default, Action? afterArming = null,
        CancellationToken lifetimeToken = default)
    {
        var dueTime = RelativeDueTime(milliseconds);
        lock (gate)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            if (waiting) throw new InvalidOperationException("Only one wait at a time is supported");
            if (LastCancelError != 0) throw new Win32Exception(LastCancelError, "Timer cleanup previously failed");
            cancellationToken.ThrowIfCancellationRequested();
            lifetimeToken.ThrowIfCancellationRequested();
            waiting = true;
        }
        Exception? primaryException = null;
        try
        {
            // A single non-blocking consume protects reuse after a cancel/timer race.
            timer.WaitOne(0);
            if (SimulateSetTimerFailure || !SetWaitableTimerEx(timer.SafeWaitHandle, ref dueTime, 0, 0, 0, 0, 0))
            {
                var err = SimulateSetTimerFailure ? 87 : Marshal.GetLastWin32Error();
                throw new Win32Exception(err, "SetWaitableTimerEx");
            }
            afterArming?.Invoke();
            var watchdogMs = OverrideWatchdogMs ?? (milliseconds + 1000);
            if (cancellationToken.CanBeCanceled || lifetimeToken.CanBeCanceled)
            {
                // Reuse caller and lifetime token wait handles rather than allocating linked CTS/event per frame.
                WaitHandle[] handles = cancellationToken.CanBeCanceled && lifetimeToken.CanBeCanceled
                    ? [lifetimeToken.WaitHandle, cancellationToken.WaitHandle, timer]
                    : [(cancellationToken.CanBeCanceled ? cancellationToken : lifetimeToken).WaitHandle, timer];
                var index = WaitHandle.WaitAny(handles, watchdogMs);
                if (index == WaitHandle.WaitTimeout) throw new TimeoutException("Native timer watchdog expired");
            }
            else if (!timer.WaitOne(watchdogMs))
            {
                throw new TimeoutException("Native timer watchdog expired");
            }
            cancellationToken.ThrowIfCancellationRequested();
            lifetimeToken.ThrowIfCancellationRequested();
        }
        catch (Exception ex)
        {
            primaryException = ex;
            throw;
        }
        finally
        {
            // Cleanup happens before clearing waiting, so Dispose cannot close a waited handle.
            int cancelError = 0;
            if (SimulateCancelTimerFailure || !CancelWaitableTimer(timer.SafeWaitHandle))
            {
                cancelError = SimulateCancelTimerFailure ? 87 : Marshal.GetLastWin32Error();
                LastCancelError = cancelError;
            }
            lock (gate) waiting = false;
            if (cancelError != 0 && primaryException is null)
            {
                throw new Win32Exception(cancelError, "CancelWaitableTimer failed");
            }
        }
    }

    public void Dispose()
    {
        lock (gate)
        {
            if (disposed) return;
            if (waiting) throw new InvalidOperationException("Cancel and join the current wait before disposing");
            disposed = true;
            timer.Dispose();
        }
    }

    private sealed class TimerWaitHandle : WaitHandle
    {
        internal TimerWaitHandle(SafeWaitHandle handle) => SafeWaitHandle = handle;
    }

    [DllImport("kernel32.dll", EntryPoint = "CreateWaitableTimerExW", ExactSpelling = true, CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeWaitHandle CreateWaitableTimerExW(nint attributes, string? name, uint flags, uint access);

    [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWaitableTimerEx(SafeWaitHandle handle, ref long dueTime, int period,
        nint completion, nint context, nint wakeContext, uint tolerableDelay);

    [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CancelWaitableTimer(SafeWaitHandle handle);
}
