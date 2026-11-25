using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;

internal sealed record Box(int Left, int Top, int Right, int Bottom)
{
    internal bool HasArea => Left < Right && Top < Bottom;
    internal bool Contains(Box other, int trailingTolerance = 0) =>
        other.HasArea && Left <= other.Left && Top <= other.Top &&
        (long)Right + trailingTolerance >= other.Right && (long)Bottom + trailingTolerance >= other.Bottom;
    internal bool Intersects(Box other) =>
        Left < other.Right && Right > other.Left && Top < other.Bottom && Bottom > other.Top;
}

internal sealed record Node(long Hwnd, long Parent, uint Thread, string ClassName, Box Client, bool Visible, uint Dpi);
internal sealed record Snapshot(Node Root, Box Frame, Node[] Children, int OtherProcessWindows);
internal sealed record Selection(string Status, Node? Candidate = null);
internal sealed record ReadPlan(string Scope, Guid RunId, bool UserConvenient, DateTimeOffset CreatedUtc,
    DateTimeOffset ExpiresUtc, string Target, int Pid, long Hwnd, string StartTicks, string ImagePath, string? Location);
internal sealed record Replay(string Target, Snapshot Before, Snapshot After);

internal static class Locator
{
    internal const int ChildLimit = 64;
    internal const string SceneRoot = "WPEOverlappedWallpaper";
    internal const string SceneRenderer = "WPEDesktopDX11Window";
    internal const string ChatRenderer = "Chrome_RenderWidgetHostHWND";

    internal static void Require(bool condition, string reason)
    {
        if (!condition) throw new InvalidOperationException(reason);
    }

    internal static void Validate(ReadPlan plan, DateTimeOffset now)
    {
        Require(plan.Scope == "fixed-canvas-surface-locator-v1" && plan.UserConvenient && plan.RunId != Guid.Empty &&
            plan.CreatedUtc.Offset == TimeSpan.Zero && plan.ExpiresUtc.Offset == TimeSpan.Zero &&
            plan.CreatedUtc <= now && now < plan.ExpiresUtc &&
            plan.ExpiresUtc - plan.CreatedUtc <= TimeSpan.FromMinutes(2), "fresh-surface-plan-required");
        ValidateIdentity(plan);
    }

    internal static void ValidateIdentity(ReadPlan plan)
    {
        Require(plan.Pid > 0 && plan.Hwnd is > 0 and not 65535 &&
            long.TryParse(plan.StartTicks, NumberStyles.None, CultureInfo.InvariantCulture, out long ticks) && ticks > 0 &&
            !string.IsNullOrEmpty(plan.ImagePath) && Path.IsPathFullyQualified(plan.ImagePath), "surface-plan-identity");
        string image = Path.GetFileName(plan.ImagePath);
        Require(plan.Target switch
        {
            "dsh" => plan.Location is null && image.Equals("DeepSeek Harness.exe", StringComparison.OrdinalIgnoreCase),
            "we-scene" or "we-client" => plan.Location is { Length: > 22 and <= 120 } name &&
                name.StartsWith("WhaleWallpaperProbe-", StringComparison.Ordinal) &&
                name.All(c => char.IsAsciiLetterOrDigit(c) || c == '-') &&
                image.Equals("wallpaper64.exe", StringComparison.OrdinalIgnoreCase),
            _ => false
        }, "surface-plan-target");
    }

    internal static Selection Compare(string target, Snapshot before, Snapshot after)
    {
        if (before.Root != after.Root || before.Frame != after.Frame ||
            before.OtherProcessWindows != after.OtherProcessWindows ||
            !before.Children.OrderBy(node => node.Hwnd).SequenceEqual(after.Children.OrderBy(node => node.Hwnd)))
            return new("surface-topology-changed");
        return Select(target, after);
    }

    // During a DSH drag compare identities instead of requiring identical screen coordinates.
    // The ordinary one-shot picker still requires a consistent root and renderer snapshot.
    internal static Selection CompareDshWatch(Snapshot before, Snapshot after)
    {
        static bool SameNode(Node left, Node right) => left with { Client = right.Client } == right;
        if (!SameNode(before.Root, after.Root) || before.OtherProcessWindows != after.OtherProcessWindows ||
            before.Children.Length != after.Children.Length ||
            !before.Children.OrderBy(node => node.Hwnd).Zip(after.Children.OrderBy(node => node.Hwnd), SameNode).All(same => same))
            return new("surface-topology-changed");
        return Select("dsh", after, requireDshAlignment: false);
    }

    private static Selection Select(string target, Snapshot snapshot, bool requireDshAlignment = true)
    {
        Node root = snapshot.Root;
        if (root.Hwnd <= 0 || root.Parent != 0 || root.Thread == 0 || !root.Visible || !root.Client.HasArea ||
            root.Dpi == 0 || !snapshot.Frame.HasArea || snapshot.OtherProcessWindows < 0 ||
            snapshot.Children.Length > ChildLimit ||
            snapshot.OtherProcessWindows > ChildLimit - snapshot.Children.Length ||
            snapshot.Children.Any(node => node.Hwnd <= 0 || node.Hwnd == root.Hwnd || node.Parent <= 0 || node.Thread == 0) ||
            snapshot.Children.Select(node => node.Hwnd).Distinct().Count() != snapshot.Children.Length)
            return new("invalid-surface-topology");
        var children = snapshot.Children.ToDictionary(node => node.Hwnd);
        string rendererClass = target switch
        {
            "dsh" => ChatRenderer,
            "we-scene" when root.ClassName == SceneRoot => SceneRenderer,
            _ => ""
        };
        if (rendererClass.Length == 0) return new("unsupported-surface-topology");
        var candidates = snapshot.Children.Where(child => child.ClassName == rendererClass && child.Visible &&
            child.Dpi == root.Dpi && (target == "we-scene"
                ? child.Parent == root.Hwnd && root.Client.Contains(child.Client)
                // A CSS viewport at fractional DPI can round its far edges up by one physical pixel.
                : child.Client.HasArea && Anchored(child, root.Hwnd, children) &&
                    (!requireDshAlignment || (root.Client.Contains(child.Client, trailingTolerance: 1) &&
                        snapshot.Frame.Contains(child.Client))))).ToArray();
        return candidates.Length switch
        {
            0 => new("surface-candidate-unavailable"),
            1 => new("surface-candidate", candidates[0]),
            _ => new("surface-candidate-ambiguous")
        };
    }

    private static bool Anchored(Node node, long root, Dictionary<long, Node> children)
    {
        var seen = new HashSet<long> { node.Hwnd };
        while (node.Parent != root)
        {
            if (!seen.Add(node.Parent) || !children.TryGetValue(node.Parent, out var parent)) return false;
            node = parent;
        }
        return true;
    }
}

