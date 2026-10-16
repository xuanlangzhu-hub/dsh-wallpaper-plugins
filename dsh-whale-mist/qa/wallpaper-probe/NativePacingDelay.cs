using System.ComponentModel;
using System.Diagnostics;
using System.Text.Json;

// P4 Production Component: Asynchronous pacing delay.
// Manages at most ONE dedicated timer thread and ONE pending delay per instance.
// Continuations run asynchronously off the timer thread.
// Automatically falls back to Task.Delay if high-resolution timer creation fails.
internal sealed class NativePacingDelay : IDisposable
{
    private readonly object gate = new();
    private readonly object disposeGate = new();
    private readonly KernelWaitTimer? timer;
    private readonly AutoResetEvent? ready;
    private readonly ManualResetEvent? stopping;
    private readonly CancellationTokenSource lifetime = new();
    private readonly Thread? thread;
    private Work? pending;
    private bool disposed;
    private bool cleanupFinished;
    private CancellationTokenSource? fallbackLinkedCts;
    private CancellationToken lastFallbackToken;
    private int fallbackLinkedCtsAllocations;

    public string BackendName { get; }
    public bool IsHighResolution { get; }
    public string? FallbackReason { get; }

    internal bool IsStopped => thread is null || !thread.IsAlive;
    internal bool IsHandleClosed => timer?.IsClosed ?? true;
    internal int LastCancelError => timer?.LastCancelError ?? 0;
    internal KernelWaitTimer? Timer => timer;
    internal int FallbackLinkedCtsAllocations => fallbackLinkedCtsAllocations;

    public NativePacingDelay()
        : this(false, default)
    {
    }

    public NativePacingDelay(bool forceFallback)
        : this(forceFallback, default)
    {
    }

    public NativePacingDelay(CancellationToken parentToken)
        : this(false, parentToken)
    {
    }

    public NativePacingDelay(bool forceFallback, CancellationToken parentToken)
    {
        if (parentToken.CanBeCanceled)
        {
            fallbackLinkedCts = CancellationTokenSource.CreateLinkedTokenSource(parentToken, lifetime.Token);
            lastFallbackToken = parentToken;
            fallbackLinkedCtsAllocations++;
        }

        if (forceFallback)
        {
            BackendName = "task-delay";
            IsHighResolution = false;
            FallbackReason = "Forced fallback for testing";
            return;
        }

        try
        {
            timer = new KernelWaitTimer(highResolution: true);
            ready = new AutoResetEvent(false);
            stopping = new ManualResetEvent(false);
            thread = new Thread(Loop) { IsBackground = true, Name = "Whale-Probe-PacingDelay" };
            thread.Start();
            BackendName = "kernel-highres-worker";
            IsHighResolution = true;
            FallbackReason = null;
        }
        catch (Exception ex)
        {
            BackendName = "task-delay";
            IsHighResolution = false;
            FallbackReason = $"{ex.GetType().Name}: {ex.Message}";
            try { timer?.Dispose(); } catch { }
            try { ready?.Dispose(); } catch { }
            try { stopping?.Dispose(); } catch { }
            timer = null;
            ready = null;
            stopping = null;
            thread = null;
        }
    }

    public Task DelayAsync(int milliseconds, CancellationToken token = default, Action? afterArming = null)
    {
        KernelWaitTimer.RelativeDueTime(milliseconds);
        lock (gate)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            if (pending is not null) throw new InvalidOperationException("Only one pending delay is supported");
            if (token.IsCancellationRequested) return Task.FromCanceled(token);
            if (lifetime.IsCancellationRequested) return Task.FromCanceled(lifetime.Token);

            if (!IsHighResolution || timer is null || thread is null || ready is null || stopping is null)
            {
                // Fallback to Task.Delay while enforcing single-pending contract and cancellation
                var fallbackTcs = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                var fallbackWork = new Work(milliseconds, token, afterArming, fallbackTcs);
                pending = fallbackWork;
                afterArming?.Invoke();

                CancellationToken delayToken;
                if (!token.CanBeCanceled)
                {
                    delayToken = lifetime.Token;
                }
                else if (fallbackLinkedCts is not null && !fallbackLinkedCts.IsCancellationRequested && token == lastFallbackToken)
                {
                    delayToken = fallbackLinkedCts.Token;
                }
                else
                {
                    fallbackLinkedCts?.Dispose();
                    fallbackLinkedCts = CancellationTokenSource.CreateLinkedTokenSource(token, lifetime.Token);
                    lastFallbackToken = token;
                    fallbackLinkedCtsAllocations++;
                    delayToken = fallbackLinkedCts.Token;
                }

                var instanceToken = lifetime.Token;
                _ = Task.Delay(milliseconds, delayToken).ContinueWith(t =>
                {
                    lock (gate)
                    {
                        if (ReferenceEquals(pending, fallbackWork)) pending = null;
                    }
                    if (t.IsCanceled)
                    {
                        var cancelToken = token.IsCancellationRequested ? token : instanceToken;
                        fallbackTcs.TrySetCanceled(cancelToken);
                    }
                    else if (t.IsFaulted) fallbackTcs.TrySetException(t.Exception!.InnerExceptions);
                    else fallbackTcs.TrySetResult();
                }, TaskScheduler.Default);
                return fallbackTcs.Task;
            }

            var work = new Work(milliseconds, token, afterArming,
                new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously));
            pending = work;
            ready.Set();
            return work.Completion.Task;
        }
    }

    private void Loop()
    {
        try
        {
            while (WaitHandle.WaitAny([stopping!, ready!]) != 0)
            {
                Work? work;
                lock (gate) work = pending;
                if (work is null) continue;
                Exception? error = null;
                try
                {
                    timer!.Wait(work.Milliseconds, work.Token, work.AfterArming, lifetime.Token);
                }
                catch (Exception exception)
                {
                    error = exception;
                }
                if (error is null && timer!.LastCancelError != 0)
                {
                    error = new Win32Exception(timer.LastCancelError, "Timer cleanup failed");
                }
                lock (gate) pending = null;
                if (error is OperationCanceledException cancelled)
                    work.Completion.TrySetCanceled(cancelled.CancellationToken);
                else if (error is not null)
                    work.Completion.TrySetException(error);
                else
                    work.Completion.TrySetResult();
            }
        }
        finally
        {
            // If stopping woke before or during work dequeue, complete abandoned request
            Work? abandoned;
            lock (gate) { abandoned = pending; pending = null; }
            if (abandoned is not null)
            {
                if (lifetime.IsCancellationRequested)
                    abandoned.Completion.TrySetCanceled(lifetime.Token);
                else
                    abandoned.Completion.TrySetCanceled();
            }
        }
    }

    public void Dispose()
    {
        if (thread is not null && Thread.CurrentThread == thread)
            throw new InvalidOperationException("Worker cannot dispose itself");

        lock (disposeGate)
        {
            if (cleanupFinished) return;
            Work? fallbackAbandoned = null;
            lock (gate)
            {
                disposed = true;
                if (!IsHighResolution || thread is null)
                {
                    fallbackAbandoned = pending;
                    pending = null;
                }
            }
            lifetime.Cancel();
            fallbackAbandoned?.Completion.TrySetCanceled(lifetime.Token);
            stopping?.Set();
            if (thread is not null)
            {
                if (!thread.Join(2000))
                    throw new TimeoutException("Timer worker did not stop; handles retained");
            }
            timer?.Dispose();
            ready?.Dispose();
            stopping?.Dispose();
            fallbackLinkedCts?.Dispose();
            fallbackLinkedCts = null;
            lifetime.Dispose();
            cleanupFinished = true;
        }
    }

    private sealed record Work(int Milliseconds, CancellationToken Token, Action? AfterArming,
        TaskCompletionSource Completion);

    public static async Task<List<string>> RunComprehensiveSelfTests(string? outputDir = null)
    {
        var checks = new List<string>();
        void Check(bool condition, string name)
        {
            if (!condition) throw new InvalidOperationException($"Self-test check failed: {name}");
            checks.Add(name);
        }
        static bool Throws<T>(Action action) where T : Exception
        {
            try { action(); return false; } catch (T) { return true; }
        }

        // 1. Creation failure fallback to Task.Delay
        KernelWaitTimer.SimulateCreateTimerFailure = true;
        try
        {
            using var fallbackDelay = new NativePacingDelay();
            Check(fallbackDelay.BackendName == "task-delay", "fallback-backend-name");
            Check(!fallbackDelay.IsHighResolution, "fallback-is-not-highres");
            Check(fallbackDelay.FallbackReason != null && fallbackDelay.FallbackReason.Contains("Simulated"), "fallback-reason-recorded");
            Check(fallbackDelay.IsStopped, "fallback-no-thread-running");
            var sw = Stopwatch.StartNew();
            await fallbackDelay.DelayAsync(5);
            Check(sw.ElapsedMilliseconds >= 3, "fallback-delay-executes");
            using var cancelled = new CancellationTokenSource();
            cancelled.Cancel();
            Check(fallbackDelay.DelayAsync(5, cancelled.Token).IsCanceled, "fallback-pre-cancelled-task");
        }
        finally
        {
            KernelWaitTimer.SimulateCreateTimerFailure = false;
        }

        // R1 regression: Fallback Dispose cancels accepted wait without requiring parent token cancellation
        {
            var fallback = new NativePacingDelay(forceFallback: true);
            using var parent = new CancellationTokenSource();
            var wait = fallback.DelayAsync(5000, parent.Token);
            Check(!wait.IsCompleted, "fallback-accepted-delay-running");
            fallback.Dispose();
            Check(wait.IsCanceled, "fallback-dispose-cancels-accepted-delay");
        }

        // 2. Relative 100ns due time conversion
        Check(KernelWaitTimer.RelativeDueTime(18) == -180000L, "relative-100ns-due-time");
        Check(KernelWaitTimer.RelativeDueTime(1) == -10000L, "relative-100ns-due-time-1ms");
        Check(KernelWaitTimer.RelativeDueTime(10) == -100000L, "relative-100ns-due-time-10ms");

        // 3. Invalid duration rejected
        Check(Throws<ArgumentOutOfRangeException>(() => KernelWaitTimer.RelativeDueTime(0)) &&
            Throws<ArgumentOutOfRangeException>(() => KernelWaitTimer.RelativeDueTime(-1)) &&
            Throws<ArgumentOutOfRangeException>(() => KernelWaitTimer.RelativeDueTime(10001)), "invalid-duration-rejected");

        // 4. High-resolution requested flag
        using (var timer = new KernelWaitTimer(true))
        {
            Check(timer.Flags == 2, "high-resolution-requested");

            // 5. Arm failure injection
            timer.SimulateSetTimerFailure = true;
            try
            {
                Check(Throws<Win32Exception>(() => timer.Wait(10)), "arm-failure-injection");
            }
            finally
            {
                timer.SimulateSetTimerFailure = false;
            }

            // 6. Watchdog timeout injection
            timer.OverrideWatchdogMs = 1;
            try
            {
                var sw = Stopwatch.StartNew();
                Check(Throws<TimeoutException>(() => timer.Wait(5000)) && sw.ElapsedMilliseconds < 500, "watchdog-timeout-injection");
            }
            finally
            {
                timer.OverrideWatchdogMs = null;
            }

            // 7. Cancel failure injection and next wait rejection
            timer.SimulateCancelTimerFailure = true;
            try
            {
                Check(Throws<Win32Exception>(() => timer.Wait(1)) && timer.LastCancelError != 0, "cancel-error-recorded");
                Check(Throws<Win32Exception>(() => timer.Wait(1)), "next-wait-gated-on-cancel-error");
            }
            finally
            {
                timer.SimulateCancelTimerFailure = false;
            }
        }

        // 8. Pre-cancelled does not arm
        using var timer2 = new KernelWaitTimer(true);
        using (var cancelled = new CancellationTokenSource())
        {
            cancelled.Cancel();
            var armed = false;
            Check(Throws<OperationCanceledException>(() => timer2.Wait(5000, cancelled.Token, () => armed = true)) && !armed,
                "pre-cancelled-does-not-arm");
        }

        // 9. Concurrent wait rejected, dispose while waiting rejected, in-flight cancellation
        using (var cancellation = new CancellationTokenSource())
        using (var armed = new ManualResetEventSlim())
        {
            Exception? error = null;
            var thread = new Thread(() =>
            {
                try { timer2.Wait(5000, cancellation.Token, armed.Set); }
                catch (Exception exception) { error = exception; }
            }) { IsBackground = true };
            thread.Start();
            if (!armed.Wait(1000)) { cancellation.Cancel(); thread.Join(1000); throw new TimeoutException("Wait did not arm"); }
            Check(Throws<InvalidOperationException>(() => timer2.Wait(1)), "concurrent-wait-rejected");
            Check(Throws<InvalidOperationException>(() => timer2.Dispose()), "dispose-while-waiting-rejected");
            var stopClock = Stopwatch.StartNew();
            cancellation.Cancel();
            Check(thread.Join(1000) && error is OperationCanceledException && stopClock.ElapsedMilliseconds < 1000,
                "in-flight-five-second-wait-cancelled");
        }

        // 10. Twenty cancel-and-rearm cycles
        for (var i = 0; i < 20; i++)
        {
            using var cancellation = new CancellationTokenSource();
            if (!Throws<OperationCanceledException>(() => timer2.Wait(5000, cancellation.Token, cancellation.Cancel)))
                throw new InvalidOperationException("Cancel/timer reuse failed");
            var clock = Stopwatch.StartNew();
            timer2.Wait(2);
            if (clock.Elapsed.TotalMilliseconds < 1.9) throw new InvalidOperationException("Stale signal completed next wait early");
        }
        Check(timer2.LastCancelError == 0, "twenty-cancel-and-rearm-cycles");

        // 11. Native handle closed, disposed wait rejected, double dispose safe
        timer2.Dispose();
        Check(timer2.IsClosed, "native-handle-closed");
        Check(Throws<ObjectDisposedException>(() => timer2.Wait(1)), "disposed-wait-rejected");
        timer2.Dispose();
        checks.Add("double-dispose-safe");

        // 12. Worker asynchronous tests
        using var asyncTimer = new NativePacingDelay();
        Check(asyncTimer.BackendName == "kernel-highres-worker", "worker-backend-name");
        Check(asyncTimer.IsHighResolution, "worker-is-highres");
        using (var cancelled = new CancellationTokenSource())
        {
            cancelled.Cancel();
            Check(asyncTimer.DelayAsync(5000, cancelled.Token).IsCanceled, "worker-pre-cancelled-task");
        }
        using (var cancellation = new CancellationTokenSource())
        using (var armed = new ManualResetEventSlim())
        {
            var wait = asyncTimer.DelayAsync(5000, cancellation.Token, armed.Set);
            Check(!wait.IsCompleted && armed.Wait(1000), "worker-caller-remains-asynchronous");
            Check(Throws<InvalidOperationException>(() => asyncTimer.DelayAsync(1)), "worker-concurrent-delay-rejected");
            var stopClock = Stopwatch.StartNew();
            cancellation.Cancel();
            var caught = false;
            try { await wait.WaitAsync(TimeSpan.FromSeconds(1)); }
            catch (OperationCanceledException) { caught = true; }
            Check(caught, "worker-in-flight-cancellation");
        }
        for (var i = 0; i < 20; i++)
        {
            using var cancellation = new CancellationTokenSource();
            var caught = false;
            try { await asyncTimer.DelayAsync(5000, cancellation.Token, cancellation.Cancel); }
            catch (OperationCanceledException) { caught = true; }
            if (!caught) throw new InvalidOperationException("Worker cancel/rearm failed");
            var clock = Stopwatch.StartNew();
            await asyncTimer.DelayAsync(2);
            if (clock.Elapsed.TotalMilliseconds < 1.9) throw new InvalidOperationException("Worker reused stale signal");
        }
        checks.Add("worker-twenty-cancel-and-rearm-cycles");
        asyncTimer.Dispose();
        Check(asyncTimer.IsStopped && asyncTimer.IsHandleClosed, "worker-stopped-handle-closed");
        Check(Throws<ObjectDisposedException>(() => asyncTimer.DelayAsync(1)), "worker-disposed-delay-rejected");

        // R2 regression: Cancel failure is immediately exposed on current wait
        using (var cancelWorker = new NativePacingDelay())
        {
            cancelWorker.Timer!.SimulateCancelTimerFailure = true;
            var caught = false;
            try { await cancelWorker.DelayAsync(2); }
            catch (Win32Exception) { caught = true; }
            Check(caught, "worker-cancel-failure-current-wait");
            Check(cancelWorker.LastCancelError == 87, "worker-cancel-error-code-87");
        }

        // 13. Active wait dispose completes cleanly
        using (var armed = new ManualResetEventSlim())
        using (var activeInstance = new NativePacingDelay())
        {
            var wait = activeInstance.DelayAsync(5000, afterArming: armed.Set);
            if (!armed.Wait(1000)) throw new TimeoutException("Active dispose control did not arm");
            var stopClock = Stopwatch.StartNew();
            activeInstance.Dispose();
            Check(wait.IsCanceled && activeInstance.IsStopped && activeInstance.IsHandleClosed,
                "worker-armed-delay-dispose-completes");
        }

        // 14. Accepted delay dispose race
        for (var i = 0; i < 20; i++)
        {
            var instance = new NativePacingDelay();
            var wait = instance.DelayAsync(5000);
            instance.Dispose();
            try { await wait.WaitAsync(TimeSpan.FromSeconds(1)); }
            catch (OperationCanceledException) { continue; }
            throw new InvalidOperationException("Accepted request was not cancelled on dispose");
        }
        for (var i = 0; i < 20; i++)
        {
            var instance = new NativePacingDelay(forceFallback: true);
            var wait = instance.DelayAsync(5000);
            instance.Dispose();
            try { await wait.WaitAsync(TimeSpan.FromSeconds(1)); }
            catch (OperationCanceledException) { continue; }
            throw new InvalidOperationException("Fallback accepted request was not cancelled on dispose");
        }
        checks.Add("worker-accepted-delay-dispose-race-completes");

        // 15. Fallback linked CTS reuse (F1 regression check: no per-frame allocation)
        using (var fallbackParentCts = new CancellationTokenSource())
        using (var fallbackReuse = new NativePacingDelay(forceFallback: true, parentToken: fallbackParentCts.Token))
        {
            Check(fallbackReuse.FallbackLinkedCtsAllocations == 1, "fallback-prebound-cts-allocated-once");
            for (var i = 0; i < 50; i++)
            {
                await fallbackReuse.DelayAsync(1, fallbackParentCts.Token);
            }
            Check(fallbackReuse.FallbackLinkedCtsAllocations == 1, "fallback-steady-state-zero-per-frame-allocations");
        }

        // 16. Formal parent stop seam: "stop" command interrupts in-flight native wait (F2)
        using (var nativeDelayStop = new NativePacingDelay())
        using (var stopReader = new TriggerReader("stop"))
        {
            var res = await ParentStopChannel.ExecuteWaitUnderParentStopAsync(
                stopReader, nativeDelayStop, 5000, afterArming: stopReader.Trigger,
                canClosePredicate: () => true, mockCloseAction: () => { });
            Check(res.Reason == "parent-stop", "parent-stop-command-reason");
            Check(res.DelayCanceled, "parent-stop-command-delay-canceled");
            Check(res.IsStopped && res.IsHandleClosed, "parent-stop-command-cleaned");
            Check(res.MockCloseInvoked, "parent-stop-command-mock-close");
        }

        // 17. Formal parent stop seam: stdin EOF interrupts in-flight native wait (F2)
        using (var nativeDelayEof = new NativePacingDelay())
        using (var eofReader = new TriggerReader(null))
        {
            var res = await ParentStopChannel.ExecuteWaitUnderParentStopAsync(
                eofReader, nativeDelayEof, 5000, afterArming: eofReader.Trigger,
                canClosePredicate: () => true, mockCloseAction: () => { });
            Check(res.Reason == "parent-stop", "parent-eof-reason");
            Check(res.DelayCanceled, "parent-eof-delay-canceled");
            Check(res.IsStopped && res.IsHandleClosed, "parent-eof-cleaned");
            Check(res.MockCloseInvoked, "parent-eof-mock-close");
        }

        // 18. Formal parent stop seam: "stop" command interrupts in-flight fallback wait (F2)
        using (var fallbackDelayStop = new NativePacingDelay(forceFallback: true))
        using (var fallbackStopReader = new TriggerReader("stop"))
        {
            var res = await ParentStopChannel.ExecuteWaitUnderParentStopAsync(
                fallbackStopReader, fallbackDelayStop, 5000, afterArming: fallbackStopReader.Trigger,
                canClosePredicate: () => true, mockCloseAction: () => { });
            Check(res.Reason == "parent-stop", "fallback-parent-stop-command-reason");
            Check(res.DelayCanceled, "fallback-parent-stop-command-delay-canceled");
            Check(res.MockCloseInvoked, "fallback-parent-stop-command-mock-close");
        }

        // 19. Formal parent stop seam: stdin EOF interrupts in-flight fallback wait (F2)
        using (var fallbackDelayEof = new NativePacingDelay(forceFallback: true))
        using (var fallbackEofReader = new TriggerReader(null))
        {
            var res = await ParentStopChannel.ExecuteWaitUnderParentStopAsync(
                fallbackEofReader, fallbackDelayEof, 5000, afterArming: fallbackEofReader.Trigger,
                canClosePredicate: () => true, mockCloseAction: () => { });
            Check(res.Reason == "parent-stop", "fallback-parent-eof-reason");
            Check(res.DelayCanceled, "fallback-parent-eof-delay-canceled");
            Check(res.MockCloseInvoked, "fallback-parent-eof-mock-close");
        }

        if (!string.IsNullOrEmpty(outputDir))
        {
            Directory.CreateDirectory(outputDir);
            var report = new { passed = true, checks, noWindowsOrCapture = true };
            await File.WriteAllTextAsync(Path.Combine(outputDir, "self-test.json"),
                JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
        }

        Console.WriteLine($"self-test passed: {checks.Count} checks");
        return checks;
    }
}
