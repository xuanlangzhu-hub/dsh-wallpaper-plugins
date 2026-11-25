using Windows.Graphics;

internal sealed record EdgeLine(int Depth, int Points, int ChangingPoints, int MaxTemporalRange, int MaxSpatialRange);
internal sealed record EdgeProfile(string Side, int? StaticUniformPrefixPx, int? FirstChangingDepth, EdgeLine[] Lines);
internal sealed record OffscreenEdgeReport(int Frames, double SpanMs, double MaxGapMs, bool Usable,
    bool InteriorMotion, EdgeLine Interior, EdgeProfile[] Edges);

internal sealed class OffscreenEdgeEvidence(SizeInt32 size, SceneCrop crop)
{
    private const int PointsPerLine = 24;
    private const int MotionRange = 12;
    private const int UniformRange = 6;
    private const int MinMovingPoints = 4;

    private readonly (string Side, SampleLine[] Lines)[] edges = MakeEdges(size, crop);
    private readonly SampleLine interior = new(InteriorOffsets(size, crop));
    private TimeSpan firstFrame, lastFrame, maxGap;
    private int frames;

    internal bool Add(ReadOnlySpan<byte> bgra, TimeSpan frameTime)
    {
        Locator.Require(bgra.Length == (long)size.Width * size.Height * 4, "edge-pixel-buffer-size");
        Locator.Require(frameTime > TimeSpan.Zero && frameTime >= lastFrame, "edge-frame-order");
        if (frameTime == lastFrame) return false;
        if (frames == 0) firstFrame = frameTime;
        else if (frameTime - lastFrame > maxGap) maxGap = frameTime - lastFrame;
        lastFrame = frameTime;
        frames++;
        interior.Add(bgra);
        foreach (var (_, lines) in edges)
            foreach (SampleLine line in lines) line.Add(bgra);
        return true;
    }

    internal OffscreenEdgeReport Report()
    {
        double spanMs = (lastFrame - firstFrame).TotalMilliseconds;
        var middle = interior.Report(-1);
        bool usable = frames >= 6 && spanMs >= 2000 && maxGap.TotalMilliseconds <= 1250;
        bool interiorMotion = usable && middle.ChangingPoints >= MinMovingPoints;
        var profiles = edges.Select(edge =>
        {
            var lines = edge.Lines.Select((line, depth) => line.Report(depth)).ToArray();
            int? firstChanging = usable ? lines.FirstOrDefault(line => line.ChangingPoints >= MinMovingPoints)?.Depth : null;
            int? prefix = interiorMotion
                ? lines.TakeWhile(line => line.MaxSpatialRange <= UniformRange && line.MaxTemporalRange <= UniformRange).Count()
                : null;
            return new EdgeProfile(edge.Side, prefix, firstChanging, lines);
        }).ToArray();

        return new(frames, spanMs, maxGap.TotalMilliseconds, usable, interiorMotion, middle, profiles);
    }

    private static (string Side, SampleLine[] Lines)[] MakeEdges(SizeInt32 size, SceneCrop crop)
    {
        int outerDepth = Math.Min(32, (Math.Min(crop.Width, crop.Height) - 1) / 3);
        SampleLine[] Lines(bool horizontal, bool far)
        {
            int along = horizontal ? crop.Width : crop.Height;
            int across = horizontal ? crop.Height : crop.Width;
            return Enumerable.Range(0, outerDepth + 1).Select(depth => new SampleLine(
                Enumerable.Range(1, PointsPerLine).Select(i =>
                {
                    int position = i * along / (PointsPerLine + 1);
                    int edge = far ? across - 1 - depth : depth;
                    return Offset(size, crop, horizontal ? position : edge, horizontal ? edge : position);
                }).ToArray())).ToArray();
        }

        return [("top", Lines(true, false)), ("bottom", Lines(true, true)),
                ("left", Lines(false, false)), ("right", Lines(false, true))];
    }

    private static int[] InteriorOffsets(SizeInt32 size, SceneCrop crop) =>
        (from row in Enumerable.Range(0, 4)
         from column in Enumerable.Range(0, 6)
         select Offset(size, crop, crop.Width * (7 + 2 * column) / 24, crop.Height * (5 + 2 * row) / 16)).ToArray();

    private static int Offset(SizeInt32 size, SceneCrop crop, int x, int y) =>
        ((crop.Y + y) * size.Width + crop.X + x) * 4;

    private sealed class SampleLine(int[] offsets)
    {
        private readonly byte[] minimum = Enumerable.Repeat((byte)255, offsets.Length * 3).ToArray();
        private readonly byte[] maximum = new byte[offsets.Length * 3];
        private int spatialRange;

        internal void Add(ReadOnlySpan<byte> bgra)
        {
            Span<byte> frameMin = stackalloc byte[3] { 255, 255, 255 };
            Span<byte> frameMax = stackalloc byte[3];
            frameMax.Clear();
            for (int i = 0; i < offsets.Length; i++)
                for (int channel = 0; channel < 3; channel++)
                {
                    byte value = bgra[offsets[i] + channel];
                    int index = i * 3 + channel;
                    minimum[index] = Math.Min(minimum[index], value);
                    maximum[index] = Math.Max(maximum[index], value);
                    frameMin[channel] = Math.Min(frameMin[channel], value);
                    frameMax[channel] = Math.Max(frameMax[channel], value);
                }
            for (int channel = 0; channel < 3; channel++)
                spatialRange = Math.Max(spatialRange, frameMax[channel] - frameMin[channel]);
        }

        internal EdgeLine Report(int depth)
        {
            int changing = 0, temporal = 0;
            for (int i = 0; i < minimum.Length; i += 3)
            {
                int range = Math.Max(maximum[i] - minimum[i],
                    Math.Max(maximum[i + 1] - minimum[i + 1], maximum[i + 2] - minimum[i + 2]));
                if (range >= MotionRange) changing++;
                temporal = Math.Max(temporal, range);
            }
            return new(depth, offsets.Length, changing, temporal, spatialRange);
        }
    }
}
