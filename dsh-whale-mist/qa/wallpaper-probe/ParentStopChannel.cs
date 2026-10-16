using System.Diagnostics;

// P4 Formal Parent Stop Channel Seam:
// Manages reading "stop" commands or stdin EOF from the parent process (Console.In or custom TextReader).
// Provides shared coordination for both production Program.cs and offline QA tests.
internal sealed class ParentStopChannel : IDisposable
{
    private readonly CancellationTokenSource cts;
    private readonly bool ownsCts;
    private readonly Task? readLoop;

    public CancellationTokenSource Source => cts;
    public CancellationToken Token => cts.Token;
    public bool IsCancellationRequested => cts.IsCancellationRequested;

    private ParentStopChannel(CancellationTokenSource cts, bool ownsCts, TextReader reader, bool enabled)
    {
        this.cts = cts;
        this.ownsCts = ownsCts;
        if (enabled)
        {
            readLoop = Task.Run(async () =>
            {
                try
                {
                    while (await reader.ReadLineAsync().ConfigureAwait(false) is string command)
                    {
                        if (command == "stop") break;
                    }
                    cts.Cancel();
                }
                catch (ObjectDisposedException) { }
                catch (IOException) { cts.Cancel(); }
            });
        }
    }

    public static ParentStopChannel Start(TextReader reader, CancellationTokenSource? externalCts = null, bool enabled = true)
    {
        var owns = externalCts == null;
        var cts = externalCts ?? new CancellationTokenSource();
        return new ParentStopChannel(cts, owns, reader, enabled);
    }

    public void Cancel() => cts.Cancel();

    public void Dispose()
    {
        if (ownsCts) cts.Dispose();
    }

    internal sealed record ExecutionResult(
        string Reason,
        bool DelayCanceled,
        bool IsStopped,
        bool IsHandleClosed,
        bool MockCloseInvoked);

    /// <summary>
    /// Shared formal parent stop seam test harness:
    /// Runs a wait under an active ParentStopChannel and observes stop/EOF attribution and cleanup.
    /// </summary>
    public static async Task<ExecutionResult> ExecuteWaitUnderParentStopAsync(
        TextReader reader,
        NativePacingDelay delay,
        int requestedMs = 5000,
        Action? afterArming = null,
        Func<bool>? canClosePredicate = null,
        Action? mockCloseAction = null)
    {
        using var channel = Start(reader, enabled: true);
        string reason = "completed";
        bool delayCanceled = false;
        try
        {
            await delay.DelayAsync(requestedMs, channel.Token, afterArming);
        }
        catch (OperationCanceledException) when (channel.IsCancellationRequested)
        {
            reason = "parent-stop";
            delayCanceled = true;
        }
        finally
        {
            delay.Dispose();
        }

        var parentLost = reason is "parent-stop" or "pipe-disconnected" or "pipe-eof" or "stdin-eof";
        bool mockCloseInvoked = false;
        if (parentLost && (canClosePredicate == null || canClosePredicate()))
        {
            mockCloseAction?.Invoke();
            mockCloseInvoked = true;
        }

        return new ExecutionResult(
            reason,
            delayCanceled,
            delay.IsStopped,
            delay.IsHandleClosed,
            mockCloseInvoked);
    }
}

internal sealed class TriggerReader : TextReader
{
    private readonly TaskCompletionSource<string?> tcs = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly string? payload;
    private int readCount;

    public TriggerReader(string? payload) => this.payload = payload;

    public void Trigger() => tcs.TrySetResult(payload);

    public override async Task<string?> ReadLineAsync()
    {
        if (Interlocked.Increment(ref readCount) > 1) return null;
        return await tcs.Task.ConfigureAwait(false);
    }
}
