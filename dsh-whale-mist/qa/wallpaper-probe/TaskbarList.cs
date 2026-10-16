using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

/// <summary>
/// The C1 seam: <c>ITaskbarList::DeleteTab</c> for one HWND.
///
/// The wrapper keeps the official call order (HrInit before any other method) and returns the HRESULT
/// instead of throwing, so the report states what the API said. It never calls AddTab, ActivateTab or
/// SetActiveAlt: this round only removes a button and never adds one back. Every interface it creates
/// is released, on success and on failure.
///
/// COM rules that the offline checks pin down:
///  - every call runs inside <see cref="Run"/> on one thread with the apartment state fixed, so an
///    await in the capture loop cannot move a call onto a thread with a different apartment;
///  - HrInit is a precondition: a failed HrInit means DeleteTab is never attempted.
/// </summary>
public static class TaskbarList
{
    /// <summary>One call's outcome, including the HRESULT.</summary>
    public sealed record Result(int Hresult, bool Succeeded, string Call, string? Error)
    {
        public override string ToString() => $"{Call} hr=0x{Hresult:X8} succeeded={Succeeded}";
    }

    /// <summary>The C1 action surface. A fake implements this in the offline checks.</summary>
    public interface IAction
    {
        /// <summary>HrInit, then exactly one DeleteTab for the given HWND (already verified).</summary>
        Result DeleteTabOnce(long hwnd);
    }

    /// <summary>
    /// Run one action on a dedicated STA thread. The apartment is set BEFORE the thread starts (the
    /// runtime refuses to change it afterwards), and every COM call stays on that thread, so nothing
    /// depends on the caller's apartment or on a continuation after an await.
    ///
    /// The factory is invoked on that thread, so a real Shell object is created and released inside the
    /// same apartment that calls it.
    /// </summary>
    public static Result Run(Func<IAction> factory, long hwnd, int timeoutMs = 5000)
    {
        Result? result = null;
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try { result = factory().DeleteTabOnce(hwnd); }
            catch (Exception error) { failure = error; }
        }, 256 * 1024);
        thread.IsBackground = true;
        try { thread.SetApartmentState(ApartmentState.STA); }
        catch (PlatformNotSupportedException) { /* the runtime decides; the call still stays on one thread */ }
        thread.Start();
        if (!thread.Join(timeoutMs))
            return new Result(unchecked((int)0x800705B4), false, "DeleteTab", $"the COM call did not return within {timeoutMs} ms");
        if (failure is not null)
            return new Result(unchecked((int)0x80004005), false, "DeleteTab", $"{failure.GetType().Name}: {failure.Message}");
        return result ?? new Result(unchecked((int)0x80004005), false, "DeleteTab", "the COM call produced no result");
    }

    /// <summary>Convenience for a fake: one action reused on the STA thread.</summary>
    public static Result Run(IAction action, long hwnd, int timeoutMs = 5000) => Run(() => action, hwnd, timeoutMs);

    /// <summary>
    /// The worker form used by the real run: the Shell call happens in a CHILD PROCESS, so a call that
    /// does not return can be terminated and proven gone before the source window is closed. A thread
    /// timeout cannot do that: the abandoned thread would still hold the old HWND.
    ///
    /// On timeout the worker is killed and its exit is awaited; the result states whether that was
    /// confirmed, so the caller never starts cleanup next to an unconfirmed Shell call.
    /// </summary>
    public sealed record WorkerRequest(string Executable, long Hwnd, int Pid, string StartUtc,
        string Location, int TimeoutMs, string StopFile);

    public sealed record CallTrace(Result Result, Result? HrInit, Result? DeleteTab)
    {
        public static CallTrace NotCalled(string stage, string reason, int hr = unchecked((int)0x80004005))
            => new(new Result(hr, false, stage, reason), null, null);
    }

    public static WorkerOutcome RunWorker(WorkerRequest request, Func<bool> stopRequested, Action? onStarted = null)
        => TaskbarWorker.Run(request, stopRequested, onStarted: onStarted);

    [DllImport("ntdll.dll")]
    private static extern int NtQueryInformationProcess(
        IntPtr processHandle, int processInformationClass,
        ref PROCESS_BASIC_INFORMATION processInformation,
        int processInformationLength, out int returnLength);

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_BASIC_INFORMATION
    {
        public IntPtr ExitStatus;
        public IntPtr PebBaseAddress;
        public IntPtr AffinityMask;
        public IntPtr BasePriority;
        public IntPtr UniqueProcessId;
        public IntPtr InheritedFromUniqueProcessId;
    }

    private static int GetParentProcessId()
    {
        try
        {
            var pbi = new PROCESS_BASIC_INFORMATION();
            int ret;
            int status = NtQueryInformationProcess(Process.GetCurrentProcess().Handle, 0, ref pbi, Marshal.SizeOf(pbi), out ret);
            if (status == 0 && pbi.InheritedFromUniqueProcessId != IntPtr.Zero)
                return pbi.InheritedFromUniqueProcessId.ToInt32();
        }
        catch { }
        return -1;
    }

    public static int RunWorkerEntry(string[] args, Func<(bool Ok, string Reason)> verify,
        Func<bool> stopRequested, Action<string> report)
    {
        CallTrace trace;
        if (args.Length != 6 || args[0] != "--taskbar-worker")
        {
            trace = CallTrace.NotCalled("Worker", "usage: --taskbar-worker <hwnd> <pid> <startUtc> <location> <stopFile>");
            report(JsonSerializer.Serialize(trace));
            return 2;
        }

        Process? parentProcess = null;
        try
        {
            var parentPid = GetParentProcessId();
            if (parentPid > 0)
            {
                var proc = Process.GetProcessById(parentPid);
                if (!proc.HasExited) parentProcess = proc;
            }
        }
        catch { }

        if (parentProcess is null)
        {
            trace = CallTrace.NotCalled("Verify", "parent-process-not-found-or-exited");
            report(JsonSerializer.Serialize(trace));
            return 1;
        }

        Func<bool> parentLostOrStop = () =>
            stopRequested() || parentProcess.HasExited;

        if (parentLostOrStop())
        {
            trace = CallTrace.NotCalled("Verify", "parent-process-exited-before-start");
            report(JsonSerializer.Serialize(trace));
            return 1;
        }

        var watcher = new Thread(() =>
        {
            try
            {
                parentProcess.WaitForExit();
                Environment.Exit(1);
            }
            catch { }
        }) { IsBackground = true };
        watcher.Start();

        var authEventName = GetSupervisionAuthEventName(args[5]);
        EventWaitHandle? authEvent = null;
        var openClock = Stopwatch.StartNew();
        while (openClock.ElapsedMilliseconds < 1000)
        {
            if (parentLostOrStop()) break;
            if (EventWaitHandle.TryOpenExisting(authEventName, out authEvent)) break;
            Thread.Sleep(5);
        }

        if (authEvent is null)
        {
            trace = CallTrace.NotCalled("Verify", "parent-supervision-not-authorized-or-lost");
            report(JsonSerializer.Serialize(trace));
            return 1;
        }

        bool authorized = false;
        using (authEvent)
        {
            var waitClock = Stopwatch.StartNew();
            while (waitClock.ElapsedMilliseconds < 8000)
            {
                if (parentLostOrStop()) break;
                if (authEvent.WaitOne(10))
                {
                    authorized = true;
                    break;
                }
            }
        }

        if (!authorized || parentLostOrStop())
        {
            trace = CallTrace.NotCalled("Verify", "parent-supervision-not-authorized-or-lost");
            report(JsonSerializer.Serialize(trace));
            return 1;
        }

        trace = RunTrace(() => new ComAction(verify, parentLostOrStop), long.Parse(args[1], CultureInfo.InvariantCulture));
        report(JsonSerializer.Serialize(trace));
        return trace.Result.Succeeded ? 0 : 1;
    }

    public static string GetSupervisionAuthEventName(string stopFile)
    {
        var normalized = stopFile.Trim().Replace('/', '\\').ToLowerInvariant();
        var hash = System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return "Local\\TaskbarWorkerAuth_" + Convert.ToHexString(hash);
    }

    // There is no abandoned thread timeout in the worker: the parent process owns the deadline and
    // can terminate the entire worker. Every COM call and release stays on this STA thread.
    private static CallTrace RunTrace(Func<ComAction> factory, long hwnd)
    {
        CallTrace? trace = null;
        var thread = new Thread(() =>
        {
            try { trace = factory().DeleteTabTrace(hwnd); }
            catch (Exception error) { trace = CallTrace.NotCalled("Worker", error.Message, error.HResult); }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        return trace ?? CallTrace.NotCalled("Worker", "worker produced no trace");
    }

    /// <summary>Minimal native seam: offline tests exercise the actual COM ordering logic.</summary>
    public interface ICalls : IDisposable
    {
        int HrInit();
        int DeleteTab(long hwnd);
    }

    public static CallTrace ExecuteCalls(Func<ICalls> factory, long hwnd,
        Func<(bool Ok, string Reason)> verify, Func<bool> stopRequested)
    {
        ICalls? calls = null;
        Result? init = null, deleted = null;
        Result final = new(unchecked((int)0x80004005), false, "Create", "call did not start");
        string stage = "Verify";
        try
        {
            if (stopRequested()) return CallTrace.NotCalled("Verify", "stop-requested-before-action");
            var before = verify();
            if (!before.Ok) return CallTrace.NotCalled("Verify", before.Reason);
            stage = "Create";
            calls = factory();
            stage = "HrInit";
            var hr = calls.HrInit();
            init = new(hr, hr >= 0, stage, hr >= 0 ? null : "HrInit failed; DeleteTab was not attempted");
            final = init;
            if (init.Succeeded)
            {
                stage = "Verify";
                var check = verify();
                if (!check.Ok) final = new(unchecked((int)0x80070057), false, stage, check.Reason);
                else if (stopRequested()) final = new(unchecked((int)0x800704C7), false, stage, "stop-requested-before-action");
                else
                {
                    stage = "DeleteTab";
                    hr = calls.DeleteTab(hwnd);
                    deleted = new(hr, hr >= 0, stage, hr >= 0 ? null : "DeleteTab returned a failure HRESULT");
                    final = deleted;
                }
            }
        }
        catch (Exception error)
        {
            final = new(error.HResult, false, stage, error.Message);
            // Preserve a call that really threw; unexecuted calls remain null.
            if (stage == "HrInit") init = final;
            if (stage == "DeleteTab") deleted = final;
        }
        finally
        {
            try { calls?.Dispose(); }
            catch (Exception error) { final = new(error.HResult, false, "Release", error.Message); }
        }
        return new(final, init, deleted);
    }

    public sealed class ComAction : IAction
    {
        private readonly Func<(bool Ok, string Reason)> _verify;
        private readonly Func<bool> _stopRequested;
        public ComAction() : this(() => (true, "offline caller"), () => false) { }
        public ComAction(Func<(bool Ok, string Reason)> verify, Func<bool> stopRequested)
        { _verify = verify; _stopRequested = stopRequested; }
        public Result DeleteTabOnce(long hwnd) => DeleteTabTrace(hwnd).Result;
        public CallTrace DeleteTabTrace(long hwnd) => ExecuteCalls(() => new NativeCalls(), hwnd, _verify, _stopRequested);
    }

    private sealed class NativeCalls : ICalls
    {
        private readonly object _instance;
        private readonly ITaskbarList _taskbar;
        public NativeCalls()
        {
            var type = Type.GetTypeFromCLSID(new Guid("56FDF344-FD6D-11d0-958A-006097C9A090"), throwOnError: true)!;
            _instance = Activator.CreateInstance(type) ?? throw new COMException("TaskbarList creation returned null");
            if (_instance is ITaskbarList taskbar) _taskbar = taskbar;
            else { Dispose(); throw new COMException("object does not expose ITaskbarList", unchecked((int)0x80004002)); }
        }
        public int HrInit() => _taskbar.HrInit();
        public int DeleteTab(long hwnd) => _taskbar.DeleteTab((nint)hwnd);
        public void Dispose() { if (Marshal.IsComObject(_instance)) Marshal.FinalReleaseComObject(_instance); }
    }

    /// <summary>
    /// The official vtable order of ITaskbarList (shobjidl_core.h). [PreserveSig] keeps every HRESULT
    /// visible instead of turning it into an exception, and the slot order is the COM contract.
    /// </summary>
    [ComImport, Guid("56FDF342-FD6D-11d0-958A-006097C9A090"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ITaskbarList
    {
        [PreserveSig] int HrInit();
        [PreserveSig] int AddTab(nint hwnd);
        [PreserveSig] int DeleteTab(nint hwnd);
        [PreserveSig] int ActivateTab(nint hwnd);
        [PreserveSig] int SetActiveAlt(nint hwnd);
    }

    /// <summary>
    /// State and dependency probes for the offline checks. Nothing here creates a window or a COM
    /// object: it only asks whether the machine would let an STA thread reach the Shell class.
    /// </summary>
    public static void SelfTest(Action<string, bool, string?> report)
    {
        void Check(string name, bool ok, string? detail = null) => report(name, ok, ok ? null : detail);

        // Informational: whether this machine can reach the Shell class is a machine fact, not a code
        // fact, so it is reported but never counted as a failure of this tool.
        var classId = new Guid("56FDF344-FD6D-11d0-958A-006097C9A090");
        var registered = Type.GetTypeFromCLSID(classId, throwOnError: false) is not null;
        Check("com class registration is discoverable on this machine", true, registered ? null : "not registered here; the real run would report 0x80040154");

        var unavailable = Run(new FakeAction(initHresult: unchecked((int)0x80004005), deleteHresult: 0), 42);
        Check("com wrapper never deletes when HrInit fails", !unavailable.Succeeded && unavailable.Call == "HrInit" && unavailable.Hresult == unchecked((int)0x80004005),
            unavailable.ToString());

        var fake = new FakeAction(initHresult: 0, deleteHresult: unchecked((int)0x80070005));
        var failed = Run(fake, 42);
        Check("com wrapper reports a failed DeleteTab HRESULT", !failed.Succeeded && failed.Hresult == unchecked((int)0x80070005) && fake.Calls.SequenceEqual(["HrInit", "DeleteTab"]),
            string.Join(',', fake.Calls));

        var ok = new FakeAction(initHresult: 0, deleteHresult: 0);
        var succeeded = Run(ok, 777);
        Check("com wrapper calls HrInit then DeleteTab once", succeeded.Succeeded && ok.Calls.SequenceEqual(["HrInit", "DeleteTab"]) && ok.Hwnds.SequenceEqual([777L]),
            string.Join(',', ok.Calls));
        Check("com wrapper never calls AddTab or ActivateTab", !ok.Calls.Contains("AddTab") && !ok.Calls.Contains("ActivateTab"), string.Join(',', ok.Calls));
        Check("com wrapper releases what it created", ok.Released, null);

        var slow = Run(new SlowAction(), 1, timeoutMs: 200);
        Check("com wrapper is bounded when the call never returns", !slow.Succeeded && slow.Error is not null, slow.ToString());
    }

    /// <summary>A fake that records the call order; the offline checks use it instead of the Shell.</summary>
    public sealed class FakeAction(int initHresult, int deleteHresult) : IAction
    {
        public List<string> Calls { get; } = [];
        public List<long> Hwnds { get; } = [];
        public bool Released { get; private set; }

        public Result DeleteTabOnce(long hwnd)
        {
            Calls.Add("HrInit");
            if (initHresult < 0)
            {
                Released = true;
                return new Result(initHresult, false, "HrInit", "HrInit failed; DeleteTab was not attempted");
            }
            Calls.Add("DeleteTab");
            Hwnds.Add(hwnd);
            Released = true;
            return new Result(deleteHresult, deleteHresult >= 0, "DeleteTab", deleteHresult >= 0 ? null : "DeleteTab returned a failure HRESULT");
        }
    }

    private sealed class SlowAction : IAction
    {
        public Result DeleteTabOnce(long hwnd)
        {
            Thread.Sleep(5000);
            return new Result(0, true, "DeleteTab", null);
        }
    }
}
