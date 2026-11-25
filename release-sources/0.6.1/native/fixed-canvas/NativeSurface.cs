using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;

internal static partial class NativeSurface
{
    internal static Snapshot Read(ReadPlan plan, Action check)
    {
        nint previous = SetThreadDpiAwarenessContext(-4); // Per-monitor v2 physical coordinates.
        Locator.Require(previous != 0, "surface-dpi-context");
        try
        {
            var hwnd = (nint)plan.Hwnd;
            CheckRoot(hwnd, plan);
            var root = ReadNode(hwnd, 0);
            Locator.Require(DwmGetWindowAttribute(hwnd, 9, out Rect extended, Marshal.SizeOf<Rect>()) == 0,
                "surface-root-visible-frame");
            Locator.Require(GetWindowRect(hwnd, out Rect outer), "surface-root-frame");
            Box frame = extended.ToBox();
            if (plan.Target is "we-scene" or "we-client")
            {
                Box desktop = PrimaryMonitor();
                Locator.Require(!desktop.Intersects(frame) && !desktop.Intersects(outer.ToBox()) &&
                    !desktop.Intersects(root.Client), "surface-source-not-offscreen");
            }

            if (plan.Target == "we-client")
            {
                check();
                CheckRoot(hwnd, plan);
                return new(root, frame, [], 0);
            }

            var handles = new List<nint>();
            bool truncated = false;
            EnumChildWindows(hwnd, (child, _) =>
            {
                if (handles.Count == Locator.ChildLimit)
                {
                    truncated = true;
                    return false;
                }
                handles.Add(child);
                return true;
            }, 0);
            Locator.Require(!truncated, "surface-enumeration-limit");
            var children = new List<Node>();
            int otherProcessWindows = 0;
            foreach (nint child in handles)
            {
                check();
                nint parent = GetAncestor(child, 1);
                uint thread = GetWindowThreadProcessId(child, out uint pid);
                Locator.Require(parent != 0 && thread != 0 && GetAncestor(child, 2) == hwnd, "surface-child-reparented");
                if (pid != plan.Pid)
                {
                    otherProcessWindows++;
                    continue;
                }
                Node node = ReadNode(child, (long)parent);
                Locator.Require(node.Thread == thread && GetWindowThreadProcessId(child, out uint afterPid) == thread &&
                    afterPid == pid && GetAncestor(child, 1) == parent && GetAncestor(child, 2) == hwnd,
                    "surface-child-changed");
                children.Add(node);
            }
            CheckRoot(hwnd, plan);
            return new(root, frame, children.OrderBy(child => child.Hwnd).ToArray(), otherProcessWindows);
        }
        finally
        {
            Locator.Require(SetThreadDpiAwarenessContext(previous) != 0, "surface-dpi-restore");
        }
    }

    private static Box PrimaryMonitor()
    {
        nint monitor = MonitorFromPoint(default, 1);
        var info = new MonitorInfo { Size = (uint)Marshal.SizeOf<MonitorInfo>() };
        Locator.Require(GetSystemMetrics(80) == 1 && monitor != 0 && GetMonitorInfo(monitor, ref info) &&
            (info.Flags & 1) != 0 && info.Monitor.ToBox().HasArea, "surface-single-primary-monitor-required");
        return info.Monitor.ToBox();
    }

    internal static Box ReadPrimaryMonitor()
    {
        nint previous = SetThreadDpiAwarenessContext(-4);
        Locator.Require(previous != 0, "surface-dpi-context");
        try { return PrimaryMonitor(); }
        finally { Locator.Require(SetThreadDpiAwarenessContext(previous) != 0, "surface-dpi-restore"); }
    }

    private static void CheckRoot(nint hwnd, ReadPlan plan)
    {
        Locator.Require(GetWindowThreadProcessId(hwnd, out uint pid) != 0 && pid == plan.Pid &&
            GetAncestor(hwnd, 2) == hwnd && IsWindowVisible(hwnd) && !IsIconic(hwnd) &&
            DwmCloak(hwnd, 14, out uint cloak, sizeof(uint)) == 0 && cloak == 0, "surface-root-identity");
        using var process = Process.GetProcessById(plan.Pid);
        string? image = process.MainModule?.FileName;
        string start = process.StartTime.ToUniversalTime().Ticks.ToString(CultureInfo.InvariantCulture);
        Locator.Require(!process.HasExited && StringComparer.OrdinalIgnoreCase.Equals(image, plan.ImagePath) &&
            start == plan.StartTicks, "surface-process-changed");
        if (plan.Target is "we-scene" or "we-client")
        {
            var title = new StringBuilder(256);
            Locator.Require(GetClass(hwnd) == Locator.SceneRoot &&
                GetWindowText(hwnd, title, title.Capacity) == plan.Location!.Length &&
                title.ToString() == plan.Location, "surface-source-location-changed");
        }
    }

    private static Node ReadNode(nint hwnd, long parent)
    {
        uint thread = GetWindowThreadProcessId(hwnd, out _);
        Locator.Require(GetClientRect(hwnd, out Rect client) && thread != 0, "surface-child-client");
        var origin = new Point { X = client.Left, Y = client.Top };
        // A second coordinate transform can pick up another move of the same window.
        Locator.Require(ClientToScreen(hwnd, ref origin), "surface-client-origin");
        int right = checked(origin.X + (client.Right - client.Left));
        int bottom = checked(origin.Y + (client.Bottom - client.Top));
        return new((long)hwnd, parent, thread, GetClass(hwnd), new(origin.X, origin.Y, right, bottom),
            IsWindowVisible(hwnd), GetDpiForWindow(hwnd));
    }

    private static string GetClass(nint hwnd)
    {
        var name = new StringBuilder(256);
        Locator.Require(GetClassName(hwnd, name, name.Capacity) > 0, "surface-window-class");
        return name.ToString();
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left, Top, Right, Bottom;
        internal readonly Box ToBox() => new(Left, Top, Right, Bottom);
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)]
    private struct MonitorInfo { public uint Size; public Rect Monitor, Work; public uint Flags; }

    private delegate bool EnumCallback(nint hwnd, nint data);
    [DllImport("user32.dll")] private static extern bool EnumChildWindows(nint hwnd, EnumCallback callback, nint data);
    [DllImport("user32.dll")] private static extern nint GetAncestor(nint hwnd, uint flags);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(nint hwnd, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(nint hwnd, StringBuilder name, int count);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(nint hwnd, StringBuilder value, int count);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(nint hwnd);
    [DllImport("user32.dll")] private static extern bool IsIconic(nint hwnd);
    [DllImport("user32.dll")] private static extern bool GetClientRect(nint hwnd, out Rect rect);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(nint hwnd, out Rect rect);
    [DllImport("user32.dll")] private static extern bool ClientToScreen(nint hwnd, ref Point point);
    [DllImport("user32.dll")] private static extern uint GetDpiForWindow(nint hwnd);
    [DllImport("user32.dll")] private static extern nint SetThreadDpiAwarenessContext(nint value);
    [DllImport("user32.dll")] private static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] private static extern nint MonitorFromPoint(Point point, uint flags);
    [DllImport("user32.dll", EntryPoint = "GetMonitorInfoW")] private static extern bool GetMonitorInfo(nint monitor, ref MonitorInfo info);
    [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(nint hwnd, int flag, out Rect value, int size);
    [DllImport("dwmapi.dll", EntryPoint = "DwmGetWindowAttribute")] private static extern int DwmCloak(nint hwnd, int flag, out uint value, int size);
}
