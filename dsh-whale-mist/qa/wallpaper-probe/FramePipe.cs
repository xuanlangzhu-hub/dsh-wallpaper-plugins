using System.Buffers.Binary;

// WHL1: 24-byte header followed by JPEG bytes. Stdout is binary-only in pipe mode.
static class FramePipe
{
    public static async Task Write(Stream output, byte[] jpeg, uint sequence, long capturedAt, int width, int height, CancellationToken cancellation)
    {
        if (jpeg.Length is < 1 or > 8 * 1024 * 1024) throw new InvalidDataException("Unexpected JPEG frame size.");
        var header = new byte[24];
        "WHL1"u8.CopyTo(header);
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(4), sequence);
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(8), (uint)jpeg.Length);
        BinaryPrimitives.WriteInt64LittleEndian(header.AsSpan(12), capturedAt);
        BinaryPrimitives.WriteUInt16LittleEndian(header.AsSpan(20), checked((ushort)width));
        BinaryPrimitives.WriteUInt16LittleEndian(header.AsSpan(22), checked((ushort)height));
        await output.WriteAsync(header, cancellation);
        await output.WriteAsync(jpeg, cancellation);
        await output.FlushAsync(cancellation);
    }
}
