using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;

/// <summary>Worker facts are independent of the Shell HRESULT. Only confirmed exit permits cleanup.</summary>
public sealed record WorkerOutcome(TaskbarList.CallTrace Trace, bool Started, bool Exited,
    bool TimedOut, bool Cancelled, bool TerminationRequested, bool Terminated, string? Error)
{
    public bool CleanupSafe => !Started || Exited;
}

/// <summary>The process boundary used by the same monitor in production QA and offline tests.</summary>
public interface ITaskbarWorkerProcess : IDisposable
{
    bool Start(TaskbarList.WorkerRequest request);
    bool WaitForExit(int milliseconds);
    void Kill();
    TaskbarList.CallTrace ReadTrace();
}

public static class TaskbarWorker
{
    public static WorkerOutcome Run(TaskbarList.WorkerRequest request, Func<bool> stopRequested,
        Func<ITaskbarWorkerProcess>? factory = null, Func<long>? elapsedMilliseconds = null,
        Action? onStarted = null, TaskbarTiming? timing = null)
    {
        timing?.Mark("executor-entered");
        ITaskbarWorkerProcess? worker = null;
        bool started = false, exited = false, timedOut = false, cancelled = false;
        bool terminationRequested = false, terminated = false;
        string? failure = null;
        var trace = TaskbarList.CallTrace.NotCalled("Worker", "worker did not run");
        var clock = Stopwatch.StartNew();
        elapsedMilliseconds ??= () => clock.ElapsedMilliseconds;
        try
        {
            if (stopRequested())
            {
                cancelled = true;
                trace = TaskbarList.CallTrace.NotCalled("Verify", "stop-requested-before-worker");
            }
            else
            {
                worker = (factory ?? (() => new RealWorker(timing)))();
                // A Start exception can occur after process creation. Until proven otherwise it owns
                // a possibly live worker, rather than claiming that no work started.
                started = true;
                timing?.Mark("worker-start-begin");
                started = worker.Start(request);
                timing?.Mark("worker-start-returned");
                if (!started) throw new InvalidOperationException("QA worker did not start");
                onStarted?.Invoke();
                while (true)
                {
                    if (stopRequested()) { cancelled = true; break; }
                    if (elapsedMilliseconds() >= request.TimeoutMs) { timedOut = true; break; }
                    if (worker.WaitForExit(50)) { exited = true; timing?.Mark("exit-observed"); break; }
                }
                if (exited)
                {
                    timing?.Mark("result-read-begin");
                    trace = worker.ReadTrace();
                    timing?.Mark("result-read-returned");
                }
                else trace = TaskbarList.CallTrace.NotCalled("Worker", cancelled
                    ? "worker cancelled; call results are unknown"
                    : "worker timed out; call results are unknown", timedOut ? unchecked((int)0x800705B4) : unchecked((int)0x800704C7));
            }
        }
        catch (Exception error)
        {
            failure = $"{error.GetType().Name}: {error.Message}";
            trace = TaskbarList.CallTrace.NotCalled("Worker", failure);
        }
        finally
        {
            // This also covers exceptions from wait, stop checks, reading and parsing the protocol.
            // Dispose releases the handle; it never substitutes for terminating/confirming the child.
            if (worker is not null && started && !exited)
            {
                try { exited = worker.WaitForExit(0); }
                catch (Exception error) { failure ??= error.Message; }
                if (!exited)
                {
                    terminationRequested = true;
                    try { timing?.Mark("termination-begin"); worker.Kill(); timing?.Mark("termination-returned"); }
                    catch (Exception error) { failure ??= error.Message; }
                    try { exited = worker.WaitForExit(5000); timing?.Mark(exited ? "termination-exit-observed" : "termination-exit-unknown"); }
                    catch (Exception error) { failure ??= error.Message; }
                    terminated = exited;
                }
                else if (failure is not null && failure.Contains("Failed to bind worker process to job container"))
                {
                    terminationRequested = true;
                    terminated = true;
                }
                if (!exited) failure = "worker exit could not be confirmed";
            }
            try { if (worker is not null) { timing?.Mark("worker-dispose-begin"); worker.Dispose(); timing?.Mark("worker-dispose-returned"); } }
            catch (Exception error) { failure ??= error.Message; }
        }
        timing?.Mark("executor-returning");
        return new(trace, started, exited, timedOut, cancelled, terminationRequested, terminated, failure);
    }

    private static class JobObjectContainer
    {
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string? lpName);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr hObject);

        private const int JobObjectExtendedLimitInformation = 9;
        private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public nuint MinimumWorkingSetSize;
            public nuint MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public nuint Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct IO_COUNTERS
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public nuint ProcessMemoryLimit;
            public nuint JobMemoryLimit;
            public nuint PeakProcessMemoryLimit;
            public nuint PeakJobMemoryLimit;
        }

        public static IntPtr CreateKillOnCloseJob()
        {
            try
            {
                var handle = CreateJobObject(IntPtr.Zero, null);
                if (handle == IntPtr.Zero) return IntPtr.Zero;
                var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
                IntPtr ptr = Marshal.AllocHGlobal(length);
                try
                {
                    Marshal.StructureToPtr(info, ptr, false);
                    if (!SetInformationJobObject(handle, JobObjectExtendedLimitInformation, ptr, (uint)length))
                    {
                        CloseHandle(handle);
                        return IntPtr.Zero;
                    }
                }
                finally
                {
                    Marshal.FreeHGlobal(ptr);
                }
                return handle;
            }
            catch
            {
                return IntPtr.Zero;
            }
        }

        public static bool Assign(IntPtr jobHandle, IntPtr processHandle)
        {
            if (jobHandle == IntPtr.Zero || processHandle == IntPtr.Zero) return false;
            try { return AssignProcessToJobObject(jobHandle, processHandle); }
            catch { return false; }
        }

        public static void SafeClose(IntPtr handle)
        {
            if (handle != IntPtr.Zero)
            {
                try { CloseHandle(handle); } catch { }
            }
        }
    }

    private sealed class RealWorker : ITaskbarWorkerProcess
    {
        private readonly Process _process = new();
        private readonly TaskbarTiming? _timing;
        public RealWorker(TaskbarTiming? timing) => _timing = timing;
        private IntPtr _jobHandle = IntPtr.Zero;
        private Task<string>? _stdout, _stderr;
        private EventWaitHandle? _authEvent;
        public bool Start(TaskbarList.WorkerRequest request)
        {
            var info = new ProcessStartInfo(request.Executable)
            {
                UseShellExecute = false, RedirectStandardOutput = true,
                RedirectStandardError = true, CreateNoWindow = true,
            };
            foreach (var value in new[] { "--taskbar-worker", request.Hwnd.ToString(System.Globalization.CultureInfo.InvariantCulture),
                request.Pid.ToString(System.Globalization.CultureInfo.InvariantCulture), request.StartUtc,
                request.Location, request.StopFile }) info.ArgumentList.Add(value);
            _process.StartInfo = info;
            var authName = TaskbarList.GetSupervisionAuthEventName(request.StopFile);
            try
            {
                _authEvent = new EventWaitHandle(false, EventResetMode.ManualReset, authName);
                _authEvent.Reset();
            }
            catch
            {
                _authEvent = null;
            }
            _timing?.Mark("job-create-begin");
            _jobHandle = JobObjectContainer.CreateKillOnCloseJob();
            _timing?.Mark("job-create-returned");
            if (_jobHandle == IntPtr.Zero)
            {
                _authEvent?.Dispose();
                _authEvent = null;
                return false;
            }
            _timing?.Mark("process-start-begin");
            if (!_process.Start())
            {
                JobObjectContainer.SafeClose(_jobHandle);
                _jobHandle = IntPtr.Zero;
                _authEvent?.Dispose();
                _authEvent = null;
                return false;
            }
            _timing?.Mark("process-start-returned");
            _timing?.Mark("job-assign-begin");
            if (!JobObjectContainer.Assign(_jobHandle, _process.Handle))
            {
                try { _process.Kill(entireProcessTree: true); } catch { }
                try { _process.WaitForExit(2000); } catch { }
                JobObjectContainer.SafeClose(_jobHandle);
                _jobHandle = IntPtr.Zero;
                _authEvent?.Dispose();
                _authEvent = null;
                throw new InvalidOperationException("Failed to bind worker process to job container");
            }
            _timing?.Mark("job-assign-returned");
            _authEvent?.Set();
            if (_authEvent is not null) _timing?.Mark("supervision-signalled");
            _stdout = _process.StandardOutput.ReadToEndAsync();
            _stderr = _process.StandardError.ReadToEndAsync();
            return true;
        }
        public bool WaitForExit(int milliseconds) => _process.WaitForExit(milliseconds);
        public void Kill() => _process.Kill(entireProcessTree: true);
        public TaskbarList.CallTrace ReadTrace()
        {
            if (_stdout is null || _stderr is null || !Task.WhenAll(_stdout, _stderr).Wait(1000))
                throw new IOException("worker exited but output did not complete");
            var line = _stdout.Result.Split('\n').LastOrDefault(value => value.TrimStart().StartsWith('{'));
            if (line is null) throw new IOException($"worker produced no result: {_stderr.Result.Trim()}");
            var trace = JsonSerializer.Deserialize<TaskbarList.CallTrace>(line,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (trace?.Result is null) throw new IOException("worker protocol has no result");
            if (_process.ExitCode != 0 && trace.Result.Succeeded)
                throw new IOException("worker failed but protocol claimed success");
            return trace;
        }
        public void Dispose()
        {
            JobObjectContainer.SafeClose(_jobHandle);
            _jobHandle = IntPtr.Zero;
            _authEvent?.Dispose();
            _authEvent = null;
            _process.Dispose();
        }
    }
}
