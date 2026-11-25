using Windows.Graphics;

internal sealed record SceneCrop(int X, int Y, int Width, int Height);
internal sealed record PixelMatch(bool Confirmed, string Reason, double[] ZoneErrors, double? NearestShiftError);

internal static class SceneEvidence
{
    internal static SceneCrop Crop(Snapshot snapshot, Node renderer, SizeInt32 rootSize, SizeInt32 childSize)
    {
        Box frame = snapshot.Frame;
        Box content = renderer.Client;
        Locator.Require(frame.Right - frame.Left == rootSize.Width && frame.Bottom - frame.Top == rootSize.Height,
            "root-frame-size-differs-from-dwm");
        Locator.Require(frame.Contains(content) && content.Right - content.Left == childSize.Width &&
            content.Bottom - content.Top == childSize.Height, "renderer-frame-differs-from-client");
        Locator.Require(childSize.Width >= 32 && childSize.Height >= 32 &&
            (long)rootSize.Width * rootSize.Height <= 10_000_000, "unsupported-frame-size");
        return new(content.Left - frame.Left, content.Top - frame.Top, childSize.Width, childSize.Height);
    }

    internal static bool SameTime(TimeSpan root, TimeSpan child, TimeSpan now) =>
        root > TimeSpan.Zero && child > TimeSpan.Zero && root <= now && child <= now &&
        now - root <= TimeSpan.FromMilliseconds(200) && now - child <= TimeSpan.FromMilliseconds(200) &&
        (root - child).Duration() <= TimeSpan.FromMilliseconds(34);

    internal static PixelMatch Match(byte[] root, SizeInt32 rootSize, byte[] child, SceneCrop crop)
    {
        int width = crop.Width;
        int height = crop.Height;
        const int grid = 24;
        int[] error = new int[5];
        int[] count = new int[5];
        int low = 255, high = 0;
        for (int row = 0; row < grid; row++)
        {
            int y = row * (height - 1) / (grid - 1);
            for (int col = 0; col < grid; col++)
            {
                int x = col * (width - 1) / (grid - 1);
                int childAt = (y * width + x) * 4;
                int rootAt = ((y + crop.Y) * rootSize.Width + x + crop.X) * 4;
                int sum = 0;
                for (int channel = 0; channel < 3; channel++)
                    sum += Math.Abs(root[rootAt + channel] - child[childAt + channel]);
                int luma = (child[childAt] + 2 * child[childAt + 1] + child[childAt + 2]) / 4;
                low = Math.Min(low, luma);
                high = Math.Max(high, luma);
                if (row < 2) Add(0, sum);
                if (row >= grid - 2) Add(1, sum);
                if (col < 2) Add(2, sum);
                if (col >= grid - 2) Add(3, sum);
                if (row >= 2 && row < grid - 2 && col >= 2 && col < grid - 2) Add(4, sum);
            }
        }
        void Add(int zone, int value) { error[zone] += value; count[zone] += 3; }

        double[] zones = Enumerable.Range(0, 5).Select(zone => (double)error[zone] / count[zone]).ToArray();
        if (zones.Any(value => value > 4)) return new(false, "pixels-differ", zones, null);
        if (high - low < 24) return new(false, "insufficient-image-detail", zones, null);

        double? nearest = null;
        for (int dy = -1; dy <= 1; dy++)
        {
            for (int dx = -1; dx <= 1; dx++)
            {
                int shiftedX = crop.X + dx, shiftedY = crop.Y + dy;
                if ((dx == 0 && dy == 0) || shiftedX < 0 || shiftedY < 0 ||
                    shiftedX + width > rootSize.Width || shiftedY + height > rootSize.Height) continue;
                double shifted = MeanError(shiftedX, shiftedY);
                nearest = nearest is double previous ? Math.Min(previous, shifted) : shifted;
            }
        }
        bool ambiguous = nearest is double rival && rival < MeanError(crop.X, crop.Y) + 0.75;
        return new(!ambiguous, ambiguous ? "pixel-origin-ambiguous" : "paired-pixels-match", zones, nearest);

        double MeanError(int left, int top)
        {
            int sum = 0;
            for (int row = 0; row < grid; row++)
            {
                int y = row * (height - 1) / (grid - 1);
                for (int col = 0; col < grid; col++)
                {
                    int x = col * (width - 1) / (grid - 1);
                    int childAt = (y * width + x) * 4;
                    int rootAt = ((y + top) * rootSize.Width + x + left) * 4;
                    for (int channel = 0; channel < 3; channel++)
                        sum += Math.Abs(root[rootAt + channel] - child[childAt + channel]);
                }
            }
            return (double)sum / (grid * grid * 3);
        }
    }
}
