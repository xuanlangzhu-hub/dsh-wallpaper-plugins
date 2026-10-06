using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

public record WindowState(
    long Hwnd,
    uint Pid,
    string ProcessName,
    string Title,
    bool Exists,
    bool Visible,
    bool Iconic,
    bool Zoomed,
    bool Foreground,
    bool Cloaked,
    int Left,
    int Top,
    int Width,
    int Height,
    long Style,
    long ExStyle
);

public static class SourceWindowHelper
{
    private const int GWL_STYLE = -16;
    private const int GWL_EXSTYLE = -20;
    private const long WS_EX_TOOLWINDOW = 0x00000080L;
    private const long WS_EX_APPWINDOW = 0x00040000L;

    private const int SW_HIDE = 0;
    private const int SW_SHOWNOACTIVATE = 4;
    private const int SW_RESTORE = 9;

    private static readonly nint HWND_BOTTOM = 1;
    private static readonly nint HWND_TOP = 0;

    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_FRAMECHANGED = 0x0020;
    private const uint SWP_SHOWWINDOW = 0x0040;
    private const uint SWP_NOOWNERZORDER = 0x0200;

    private const int DWMWA_CLOAKED = 14;

    private const int SM_XVIRTUALSCREEN = 76;
    private const int SM_YVIRTUALSCREEN = 77;
    private const int SM_CXVIRTUALSCREEN = 78;
    private const int SM_CYVIRTUALSCREEN = 79;

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int nIndex);

    public sealed record ScreenBounds(int X, int Y, int Width, int Height, int Right, int Bottom);

    /// <summary>Virtual desktop bounds of this session.</summary>
    public static ScreenBounds VirtualScreen()
    {
        int x = GetSystemMetrics(SM_XVIRTUALSCREEN), y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        int width = GetSystemMetrics(SM_CXVIRTUALSCREEN), height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        return new ScreenBounds(x, y, width, height, x + width, y + height);
    }

    /// <summary>How much of the window rect lies on the virtual desktop.</summary>
    public static object OnScreenArea(nint hwnd)
    {
        var screen = VirtualScreen();
        var state = Inspect(hwnd);
        int left = Math.Max(state.Left, screen.X), top = Math.Max(state.Top, screen.Y);
        int right = Math.Min(state.Left + state.Width, screen.Right), bottom = Math.Min(state.Top + state.Height, screen.Bottom);
        long visibleArea = Math.Max(0, right - left) * (long)Math.Max(0, bottom - top);
        long windowArea = Math.Max(1L, (long)state.Width * state.Height);
        return new { window = state, screen, visibleArea, windowArea, visibleFraction = Math.Round((double)visibleArea / windowArea, 4) };
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    private delegate bool EnumWindowsProc(nint hWnd, nint lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, nint lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(nint hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(nint hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(nint hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(nint hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(nint hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsZoomed(nint hWnd);

    [DllImport("user32.dll")]
    public static extern nint GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern nint WindowFromPoint(POINT point);

    [DllImport("user32.dll")]
    public static extern nint GetAncestor(nint hWnd, uint gaFlags);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X;
        public int Y;
    }

    /// <summary>
    /// Top-level window receiving input at a screen point, and whether that
    /// window belongs to this round's wallpaper window. Used to prove that a
    /// lowered or off-screen source does not cover the DSH window.
    /// </summary>
    public static object HitTest(int x, int y, long probeHwnd)
    {
        var point = new POINT { X = x, Y = y };
        var hit = WindowFromPoint(point);
        var root = hit == 0 ? 0 : GetAncestor(hit, 2 /* GA_ROOT */);
        var state = root == 0 ? null : Inspect(root);
        return new
        {
            x,
            y,
            probeHwnd,
            hitHwnd = (long)hit,
            rootHwnd = (long)root,
            isProbeWindow = root != 0 && (long)root == probeHwnd,
            root = state,
        };
    }

    public static WindowState? Foreground() => Inspect(GetForegroundWindow());

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(nint hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(nint hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(nint hWnd, nint hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern nint GetWindowLongPtr(nint hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
    private static extern nint SetWindowLongPtr(nint hWnd, int nIndex, nint dwNewLong);

    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(nint hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

    private const string DefaultWeExe = @"E:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe";

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2;
        public nint lpReserved2, hStdInput, hStdOutput, hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public nint hProcess, hThread;
        public int dwProcessId, dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcess(
        string? lpApplicationName, string lpCommandLine, nint lpProcessAttributes, nint lpThreadAttributes,
        bool bInheritHandles, uint dwCreationFlags, nint lpEnvironment, string? lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll")] private static extern bool CloseHandle(nint hObject);

    public static int LaunchOnDefaultDesktop(string exePath, string arguments)
    {
        var si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(si);
        si.lpDesktop = @"WinSta0\Default";
        string cmdLine = JoinArguments(exePath, arguments);
        if (CreateProcess(null, cmdLine, 0, 0, false, 0, 0, null, ref si, out var pi))
        {
            CloseHandle(pi.hThread);
            CloseHandle(pi.hProcess);
            return pi.dwProcessId;
        }
        throw new InvalidOperationException($"CreateProcess failed with Win32 error {Marshal.GetLastWin32Error()}");
    }

    public const string ProbeWindowPrefix = "WhaleWallpaperProbe-";

    /// <summary>Window actions accepted by the helper; validated before any side effect.</summary>
    public static readonly HashSet<string> WindowActions = new(StringComparer.OrdinalIgnoreCase)
    { "hide", "show", "restore", "offscreen", "offscreen-tool", "onscreen", "bottom" };

    private const int MaxLocationLength = 120;

    /// <summary>
    /// Quote one CreateProcess argument. Wallpaper Engine expects the window
    /// location as a single argument even when it contains spaces.
    /// </summary>
    private static string QuoteArgument(string value)
    {
        if (value.Length > 0 && value.IndexOfAny(new[] { ' ', '\t' }) < 0) return value;
        var quoted = new StringBuilder("\"");
        for (int i = 0; i < value.Length; i++)
        {
            if (value[i] == '"') quoted.Append('\\');
            quoted.Append(value[i]);
        }
        return quoted.Append('"').ToString();
    }

    private static string JoinArguments(string exePath, string arguments) =>
        string.IsNullOrEmpty(arguments) ? QuoteArgument(exePath) : $"{QuoteArgument(exePath)} {arguments}";

    /// <summary>
    /// A round-unique window location: required prefix plus a safe ASCII suffix.
    /// Rejecting separators, quotes, whitespace and control characters keeps the
    /// value safe as a CreateProcess argument and as a WE window key.
    /// </summary>
    public static string RequireProbeLocation(string? location)
    {
        var value = (location ?? "").Trim();
        if (value.Length == 0 || value.Length > MaxLocationLength)
            throw new ArgumentException($"Wallpaper window location must be 1..{MaxLocationLength} characters.");
        if (!value.StartsWith(ProbeWindowPrefix, StringComparison.Ordinal))
            throw new ArgumentException($"Wallpaper window location must start with '{ProbeWindowPrefix}'.");
        foreach (char c in value)
            if (c < 0x21 || c > 0x7E || c == '"' || c == '\\' || c == '/' || c == ';' || c == '&' || c == '|' || c == '^' || c == '%')
                throw new ArgumentException($"Wallpaper window location contains unsupported character 0x{(int)c:X2}.");
        return value;
    }

    /// <summary>Only the workshop project.json of the supervised sample is accepted.</summary>
    public static string RequireProjectFile(string? file)
    {
        var value = (file ?? "").Trim().Trim('"');
        if (value.Length == 0 || value.Length > 400 || !value.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Wallpaper project file must be an absolute .json path.");
        foreach (char c in value)
            if (c < 0x20 || c == '"' || c == ';') throw new ArgumentException("Wallpaper project file contains unsupported characters.");
        return Path.GetFullPath(value);
    }

    public static int OpenWallpaper(string location, string file, int width = 1280, int height = 720, string? weExe = null)
    {
        string exe = weExe ?? DefaultWeExe;
        location = RequireProbeLocation(location);
        file = RequireProjectFile(file);
        if (width < 160 || width > 7680 || height < 120 || height > 4320)
            throw new ArgumentException("Wallpaper window size is out of range.");
        string args = $"-control openWallpaper -file {QuoteArgument(file)} -playInWindow {QuoteArgument(location)} -width {width} -height {height}";
        return LaunchOnDefaultDesktop(exe, args);
    }

    /// <summary>
    /// Close exactly this round's wallpaper window. The identity check runs
    /// before the side effect: no matching window, an ambiguous match, or a
    /// window that is not this round's probe window is refused instead of
    /// silently closing something else.
    /// </summary>
    public static bool CloseWallpaper(string location, string? weExe = null, bool verified = false)
    {
        string exe = weExe ?? DefaultWeExe;
        location = RequireProbeLocation(location);
        if (!verified) RequireUniqueProbeWindow(location);
        string args = $"-control closeWallpaper -location {QuoteArgument(location)}";
        LaunchOnDefaultDesktop(exe, args);
        return true;
    }

    /// <summary>Exactly one probe window with this round's location, or a refusal.</summary>
    public static WindowState RequireUniqueProbeWindow(string? location, int waitMs = 0)
    {
        var name = RequireProbeLocation(location);
        var deadline = DateTime.UtcNow.AddMilliseconds(Math.Max(0, waitMs));
        while (true)
        {
            var matches = FindWindowsByTitle(name);
            if (matches.Count == 1) return matches[0];
            if (matches.Count > 1)
                throw new InvalidOperationException($"{matches.Count} windows match '{name}'; refusing to act on an ambiguous target.");
            if (DateTime.UtcNow >= deadline)
                throw new InvalidOperationException($"No open wallpaper window matches '{name}'.");
            Thread.Sleep(250);
        }
    }

    private static List<WindowState> FindWindowsByTitle(string exactTitle)
    {
        var list = new List<WindowState>();
        EnumWindows((hWnd, lParam) =>
        {
            if (!IsWindow(hWnd)) return true;
            GetWindowThreadProcessId(hWnd, out var pid);
            if (pid == 0) return true;
            try
            {
                using var proc = Process.GetProcessById((int)pid);
                if (!proc.ProcessName.Equals("wallpaper64", StringComparison.OrdinalIgnoreCase)) return true;
                var sb = new StringBuilder(512);
                GetWindowText(hWnd, sb, sb.Capacity);
                if (!sb.ToString().Equals(exactTitle, StringComparison.Ordinal)) return true;
                var state = Inspect(hWnd);
                if (state.Cloaked) return true; // a cloaked window cannot be the live source
                list.Add(state);
            }
            catch { }
            return true;
        }, 0);
        return list;
    }

    /// <summary>Result of a bounded close attempt; never reports success without proof.</summary>
    public sealed record CloseResult(string Outcome, bool Closed, string Location, long WaitedMs, long? Hwnd, uint? Pid, bool SafeToCleanUp, string? Error);

    private static CloseResult ClosedResult(string location, long waitedMs, WindowState? window) =>
        new("closed", true, location, waitedMs, window?.Hwnd, window?.Pid, true, null);

    private static CloseResult AbsentResult(string location, long waitedMs) =>
        new("absent", true, location, waitedMs, null, null, true, null);

    private static CloseResult AmbiguousResult(string location, long waitedMs, int count) =>
        new("ambiguous", false, location, waitedMs, null, null, false, $"{count} windows match '{location}'; refusing to act on an ambiguous target.");

    private static CloseResult TimeoutResult(string location, long waitedMs, WindowState? window, string error) =>
        new("timeout", false, location, waitedMs, window?.Hwnd, window?.Pid, false, error);

    /// <summary>
    /// Close this round's window and prove the outcome. "The window is already
    /// gone", "the identity is ambiguous" and "the close timed out" are separate
    /// results; only a proven-gone window counts as cleaned up.
    /// </summary>
    public static CloseResult EnsureProbeWindowClosed(string location, int timeoutMs = 15000, uint? expectedPid = null)
    {
        var name = RequireProbeLocation(location);
        var start = Stopwatch.StartNew();
        var matches = FindWindowsByTitle(name);
        if (matches.Count > 1) return AmbiguousResult(name, start.ElapsedMilliseconds, matches.Count);
        if (matches.Count == 0) return AbsentResult(name, start.ElapsedMilliseconds);
        var target = matches[0];
        if (expectedPid is uint pid && target.Pid != pid)
            return new CloseResult("identity-changed", false, name, start.ElapsedMilliseconds, target.Hwnd, target.Pid, false,
                $"Window '{name}' is now owned by PID {target.Pid}, not the expected PID {pid}; refusing to close it.");

        string? closeError = null;
        try { CloseWallpaper(name, null, verified: true); }
        catch (Exception ex) { closeError = ex.Message; }

        var deadline = DateTime.UtcNow.AddMilliseconds(Math.Max(0, timeoutMs));
        while (DateTime.UtcNow < deadline)
        {
            var remaining = FindWindowsByTitle(name);
            if (remaining.Count == 0) return ClosedResult(name, start.ElapsedMilliseconds, target);
            if (remaining.Count > 1) return AmbiguousResult(name, start.ElapsedMilliseconds, remaining.Count);
            Thread.Sleep(250);
        }
        return TimeoutResult(name, start.ElapsedMilliseconds, target, closeError ?? "Window still existed after the close wait.");
    }

    public static void VerifyTargetIdentity(nint hwnd, string requiredPrefix = ProbeWindowPrefix)
    {
        if (!IsWindow(hwnd))
            throw new InvalidOperationException($"Target HWND {hwnd} is not a valid window.");

        GetWindowThreadProcessId(hwnd, out var pid);
        if (pid == 0)
            throw new InvalidOperationException($"Target HWND {hwnd} has no associated process.");

        using var process = Process.GetProcessById((int)pid);
        var exeName = Path.GetFileName(process.MainModule?.FileName ?? string.Empty);
        if (!exeName.Equals("wallpaper64.exe", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Target process '{exeName}' is not wallpaper64.exe (PID {pid}).");

        var sb = new StringBuilder(512);
        GetWindowText(hwnd, sb, sb.Capacity);
        var title = sb.ToString();
        if (!title.StartsWith(requiredPrefix, StringComparison.Ordinal))
            throw new InvalidOperationException($"Target window title '{title}' does not match required prefix '{requiredPrefix}'.");
    }

    public static WindowState Inspect(nint hwnd)
    {
        if (!IsWindow(hwnd))
        {
            return new WindowState(
                Hwnd: (long)hwnd,
                Pid: 0,
                ProcessName: "",
                Title: "",
                Exists: false,
                Visible: false,
                Iconic: false,
                Zoomed: false,
                Foreground: false,
                Cloaked: false,
                Left: 0,
                Top: 0,
                Width: 0,
                Height: 0,
                Style: 0,
                ExStyle: 0
            );
        }

        GetWindowThreadProcessId(hwnd, out var pid);
        string procName = "";
        try
        {
            using var proc = Process.GetProcessById((int)pid);
            procName = proc.ProcessName;
        }
        catch { }

        var sb = new StringBuilder(512);
        GetWindowText(hwnd, sb, sb.Capacity);

        GetWindowRect(hwnd, out var r);
        var visible = IsWindowVisible(hwnd);
        var iconic = IsIconic(hwnd);
        var zoomed = IsZoomed(hwnd);
        var fg = GetForegroundWindow() == hwnd;

        int cloakedVal = 0;
        try { DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, out cloakedVal, sizeof(int)); } catch { }

        var style = (long)GetWindowLongPtr(hwnd, GWL_STYLE);
        var exStyle = (long)GetWindowLongPtr(hwnd, GWL_EXSTYLE);

        return new WindowState(
            Hwnd: (long)hwnd,
            Pid: pid,
            ProcessName: procName,
            Title: sb.ToString(),
            Exists: true,
            Visible: visible,
            Iconic: iconic,
            Zoomed: zoomed,
            Foreground: fg,
            Cloaked: cloakedVal != 0,
            Left: r.Left,
            Top: r.Top,
            Width: r.Right - r.Left,
            Height: r.Bottom - r.Top,
            Style: style,
            ExStyle: exStyle
        );
    }

    /// <summary>
    /// Verify that an HWND still is the caller's expected round window before any
    /// side effect. The expected round name and owning process must come from the
    /// caller: comparing the window only against its own current title would
    /// accept a recycled HWND that happens to carry another round's valid name.
    /// </summary>
    public static WindowState VerifyExpectedWindow(nint hwnd, string? expectedLocation, int? expectedPid = null, int waitMs = 2000)
    {
        if (!IsWindow(hwnd))
            throw new InvalidOperationException($"Target HWND {hwnd} is not a valid window.");

        var name = RequireProbeLocation(expectedLocation);
        var matches = FindWindowsByTitle(name);
        if (matches.Count == 0)
            throw new InvalidOperationException($"No open wallpaper window matches '{name}'; refusing to act on HWND {hwnd}.");
        if (matches.Count > 1)
            throw new InvalidOperationException($"{matches.Count} windows match '{name}'; refusing to act on an ambiguous target.");

        var current = matches[0];
        if (current.Hwnd != (long)hwnd)
            throw new InvalidOperationException($"HWND {hwnd} is window '{current.Title}' ({current.Hwnd}) now, not the expected window '{name}'; refusing to act.");
        if (expectedPid is int pid && current.Pid != (uint)pid)
            throw new InvalidOperationException($"Window '{name}' is owned by PID {current.Pid}, not the expected PID {pid}; refusing to act.");

        GetWindowThreadProcessId(hwnd, out var actualPid);
        try
        {
            using var process = Process.GetProcessById((int)actualPid);
            if (!process.ProcessName.Equals("wallpaper64", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException($"Target process '{process.ProcessName}' is not wallpaper64 (PID {actualPid}).");
        }
        catch (ArgumentException)
        {
            throw new InvalidOperationException($"Target HWND {hwnd} has no live process; refusing to act.");
        }

        if (waitMs > 0) Thread.Sleep(Math.Min(waitMs, 2000));
        return current;
    }

    /// <summary>
    /// Apply one window action to the caller's expected round window. The
    /// expected name and PID are required for the managed lifecycle; the legacy
    /// no-name form still checks the probe prefix, which is weaker.
    /// </summary>
    public static WindowState ApplyAction(nint hwnd, string action, string? expectedLocation = null, int? expectedPid = null)
    {
        if (expectedLocation is null)
        {
            VerifyTargetIdentity(hwnd);
        }
        else
        {
            VerifyExpectedWindow(hwnd, expectedLocation, expectedPid);
        }
        if (!WindowActions.Contains(action))
            throw new ArgumentException($"Unknown window action '{action}'.");

        switch (action.ToLowerInvariant())
        {
            case "hide":
                // Standard SW_HIDE
                ShowWindow(hwnd, SW_HIDE);
                break;

            case "show":
            case "restore":
                ShowWindow(hwnd, SW_RESTORE);
                break;

            case "offscreen":
                if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
                // Place at -32000, -32000 (standard Windows off-screen placement), keep visible and sized, no activate
                SetWindowPos(hwnd, HWND_BOTTOM, -32000, -32000, 1280, 720,
                    SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_SHOWWINDOW);
                break;

            case "offscreen-tool":
                if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
                // Place off-screen AND strip taskbar button (WS_EX_TOOLWINDOW, remove WS_EX_APPWINDOW)
                var currentEx = (long)GetWindowLongPtr(hwnd, GWL_EXSTYLE);
                var newEx = (currentEx | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW;
                SetWindowLongPtr(hwnd, GWL_EXSTYLE, (nint)newEx);
                SetWindowPos(hwnd, HWND_BOTTOM, -32000, -32000, 1280, 720,
                    SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_SHOWWINDOW | SWP_FRAMECHANGED);
                break;

            case "onscreen":
                if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
                // Bring back to normal desktop view at (100, 100), 1280x720, normal window
                var exToRestore = (long)GetWindowLongPtr(hwnd, GWL_EXSTYLE);
                var restoredEx = (exToRestore & ~WS_EX_TOOLWINDOW) | WS_EX_APPWINDOW;
                SetWindowLongPtr(hwnd, GWL_EXSTYLE, (nint)restoredEx);
                SetWindowPos(hwnd, HWND_TOP, 100, 100, 1280, 720,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED);
                break;

            case "bottom":
                // Place at bottom of z-order without moving or resizing
                SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                break;

            default:
                // Unreachable: the action set is validated before any side effect.
                throw new ArgumentException($"Unknown window action '{action}'.");
        }

        Thread.Sleep(50); // Give DWM a brief moment to update state
        return Inspect(hwnd);
    }

    public static List<WindowState> FindProbeWindows(string prefix = ProbeWindowPrefix)
    {
        var list = new List<WindowState>();
        EnumWindows((hWnd, lParam) =>
        {
            if (IsWindow(hWnd))
            {
                GetWindowThreadProcessId(hWnd, out var pid);
                if (pid != 0)
                {
                    try
                    {
                        using var proc = Process.GetProcessById((int)pid);
                        if (proc.ProcessName.Equals("wallpaper64", StringComparison.OrdinalIgnoreCase))
                        {
                            var sb = new StringBuilder(512);
                            GetWindowText(hWnd, sb, sb.Capacity);
                            var title = sb.ToString();
                            if (title.StartsWith(prefix, StringComparison.Ordinal))
                            {
                                list.Add(Inspect(hWnd));
                            }
                        }
                    }
                    catch { }
                }
            }
            return true;
        }, 0);
        return list;
    }
}
