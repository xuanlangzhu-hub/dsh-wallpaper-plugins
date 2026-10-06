using System.Runtime.InteropServices;
using System.Runtime.InteropServices.WindowsRuntime;
using Vortice.Direct3D11;
using Windows.Graphics.DirectX.Direct3D11;
using Windows.Graphics.Imaging;
using WinRT;

// Isolated alternative to SoftwareBitmap.CreateCopyFromSurfaceAsync for a controlled comparison.
sealed class StagingReadback : IDisposable
{
    ID3D11Texture2D? staging;
    byte[] pixels = [];

    public static string DescribeDevice(IDirect3DDevice device)
    {
        var access = device.As<IDirect3DDxgiInterfaceAccess>();
        var iid = typeof(ID3D11Device).GUID;
        Marshal.ThrowExceptionForHR(access.GetInterface(ref iid, out var pointer));
        using var d3d = new ID3D11Device(pointer);
        using var dxgi = d3d.QueryInterface<Vortice.DXGI.IDXGIDevice>();
        using var adapter = dxgi.GetAdapter();
        return System.Text.Json.JsonSerializer.Serialize(new { adapter = adapter.Description.Description,
            luid = adapter.Description.Luid.ToString(), vendorId = adapter.Description.VendorId });
    }

    public SoftwareBitmap Copy(IDirect3DSurface surface)
    {
        var access = surface.As<IDirect3DDxgiInterfaceAccess>();
        var iid = typeof(ID3D11Texture2D).GUID;
        Marshal.ThrowExceptionForHR(access.GetInterface(ref iid, out var pointer));
        using var texture = new ID3D11Texture2D(pointer);
        using var device = texture.Device;
        using var context = device.ImmediateContext;
        var desc = texture.Description;
        if (staging is null || staging.Description.Width != desc.Width || staging.Description.Height != desc.Height)
        {
            staging?.Dispose();
            desc.Usage = ResourceUsage.Staging;
            desc.BindFlags = BindFlags.None;
            desc.CPUAccessFlags = CpuAccessFlags.Read;
            desc.MiscFlags = ResourceOptionFlags.None;
            staging = device.CreateTexture2D(desc);
            pixels = new byte[checked((int)(desc.Width * desc.Height * 4))];
        }
        context.CopyResource(staging, texture);
        var mapped = context.Map(staging, 0, MapMode.Read, Vortice.Direct3D11.MapFlags.None);
        try
        {
            int rowBytes = checked((int)desc.Width * 4);
            for (int row = 0; row < desc.Height; row++)
                Marshal.Copy(mapped.DataPointer + checked(row * (int)mapped.RowPitch), pixels, row * rowBytes, rowBytes);
        }
        finally { context.Unmap(staging, 0); }
        return SoftwareBitmap.CreateCopyFromBuffer(pixels.AsBuffer(), BitmapPixelFormat.Bgra8,
            checked((int)desc.Width), checked((int)desc.Height), BitmapAlphaMode.Ignore);
    }

    public void Dispose() => staging?.Dispose();

    [ComImport, Guid("A9B3D012-3DF2-4EE3-B8D1-8695F457D3C1"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IDirect3DDxgiInterfaceAccess
    {
        [PreserveSig] int GetInterface(ref Guid iid, out nint pointer);
    }
}
