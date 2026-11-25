using Windows.Graphics;

internal static class OffscreenEdgeTests
{
    internal static int Run()
    {
        int count = 0;
        void Check(bool value)
        {
            if (!value) throw new InvalidOperationException($"offscreen edge assertion {count + 1} failed");
            count++;
        }
        void Reject(Action action, string reason)
        {
            try { action(); }
            catch (InvalidOperationException error) when (error.Message == reason) { Check(true); return; }
            Check(false);
        }

        var size = new SizeInt32 { Width = 248, Height = 152 };
        var crop = new SceneCrop(3, 5, 236, 140);
        var frame = new byte[size.Width * size.Height * 4];
        static TimeSpan Ms(int value) => TimeSpan.FromMilliseconds(value);
        static byte Texture(int x, int y, int phase) => (byte)(40 + (x + 2 * y) % 96 + phase);
        void Paint(int phase, Func<int, int, int, byte> color)
        {
            Array.Fill(frame, (byte)245);
            for (int y = 0; y < crop.Height; y++)
                for (int x = 0; x < crop.Width; x++)
                {
                    int i = ((y + crop.Y) * size.Width + x + crop.X) * 4;
                    frame[i] = frame[i + 1] = frame[i + 2] = color(x, y, phase);
                }
        }

        OffscreenEdgeReport Sequence(Func<int, int, int, byte> color)
        {
            var evidence = new OffscreenEdgeEvidence(size, crop);
            for (int i = 0; i < 9; i++)
            {
                Paint(i % 2 * 26, color);
                evidence.Add(frame, Ms(500 + i * 300));
            }
            return evidence.Report();
        }

        var evidence = new OffscreenEdgeEvidence(size, crop);
        Check(!evidence.Report().Usable && evidence.Report().Edges.All(edge => edge.StaticUniformPrefixPx is null));
        Reject(() => evidence.Add(frame[..^1], Ms(500)), "edge-pixel-buffer-size");
        Check(evidence.Add(frame, Ms(500)) && !evidence.Add(frame, Ms(500)) && evidence.Report().Frames == 1);
        Reject(() => evidence.Add(frame, Ms(499)), "edge-frame-order");
        for (int i = 0; i < 8; i++) evidence.Add(frame, Ms(2000 + 300 * i));
        Check(!evidence.Report().Usable && evidence.Report().MaxGapMs == 1500);

        OffscreenEdgeReport plain = Sequence(Texture);
        Check(plain.Usable && plain.InteriorMotion && plain.Frames == 9 && plain.SpanMs == 2400);
        Check(plain.Edges.All(edge => edge.StaticUniformPrefixPx == 0 && edge.FirstChangingDepth == 0));
        Check(plain.Edges.All(edge => edge.Lines.Length == 33 && edge.Lines.All(line => line.Points == 24)));
        Check(plain.Edges.All(edge => edge.Lines[0].ChangingPoints == 24 && edge.Lines[0].MaxTemporalRange == 26));

        OffscreenEdgeReport banded = Sequence((x, y, phase) =>
            y < 3 || y >= crop.Height - 5 || x < 4 || x >= crop.Width - 7 ? (byte)9 : Texture(x, y, phase));
        Check(banded.InteriorMotion && banded.Edges.Select(edge => edge.Side).SequenceEqual(new[] { "top", "bottom", "left", "right" }));
        Check(banded.Edges.Select(edge => edge.StaticUniformPrefixPx).SequenceEqual(new int?[] { 3, 5, 4, 7 }));
        Check(banded.Edges.Select(edge => edge.FirstChangingDepth).SequenceEqual(new int?[] { 3, 5, 4, 7 }));
        Check(banded.Edges[0].Lines[0].ChangingPoints == 0 && banded.Edges[0].Lines[3].ChangingPoints == 24);

        OffscreenEdgeReport stillArtwork = Sequence((x, y, phase) => Texture(x, y, y < 4 ? 0 : phase));
        Check(stillArtwork.Edges[0].StaticUniformPrefixPx == 0 && stillArtwork.Edges[0].FirstChangingDepth == 4);
        OffscreenEdgeReport still = Sequence((x, y, _) => Texture(x, y, 0));
        Check(still.Usable && !still.InteriorMotion && still.Edges.All(edge => edge.StaticUniformPrefixPx is null));
        OffscreenEdgeReport broad = Sequence((x, y, phase) => y < 36 ? (byte)0 : Texture(x, y, phase));
        Check(broad.Edges[0].StaticUniformPrefixPx == 33 && broad.Edges[0].FirstChangingDepth is null);
        return count;
    }
}
