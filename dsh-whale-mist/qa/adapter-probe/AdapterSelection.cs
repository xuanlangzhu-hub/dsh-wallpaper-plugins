using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Vortice.DXGI;
using Windows.Graphics.DirectX.Direct3D11;

// Included only in the separately generated QA executable, never in the accepted probe.
internal static class AdapterSelection
{
    internal sealed record Options(long? Luid, string[] Remaining);
    internal sealed record AdapterInfo(string Description, string Luid, uint VendorId, bool Software);

    public static Options Extract(string[] args)
    {
        var tokens = args.ToList();
        int at = tokens.IndexOf("--qa-adapter-luid");
        if (at < 0) return new(null, args);
        if (tokens.Count(x => x == "--qa-adapter-luid") != 1 || at + 1 >= tokens.Count)
            throw new ArgumentException("--qa-adapter-luid requires exactly one decimal LUID");
        string value = tokens[at + 1];
        if (!Regex.IsMatch(value, @"^-?[0-9]+$") || !long.TryParse(value, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out long luid))
            throw new ArgumentException("--qa-adapter-luid requires a signed 64-bit decimal LUID");
        tokens.RemoveRange(at, 2);
        return new(luid, tokens.ToArray());
    }

    public static List<AdapterInfo> Inventory()
    {
        using var factory = DXGI.CreateDXGIFactory1<IDXGIFactory1>();
        var list = new List<AdapterInfo>();
        for (uint i = 0; i < 256; i++)
        {
            var result = factory.EnumAdapters1(i, out var adapter);
            if (result.Code == unchecked((int)0x887A0002)) return list; // DXGI_ERROR_NOT_FOUND
            result.CheckError();
            using (adapter)
            {
                var d = adapter.Description1;
                list.Add(new(d.Description, d.Luid.ToString(null, CultureInfo.InvariantCulture), d.VendorId, (d.Flags & AdapterFlags.Software) != 0));
            }
        }
        throw new InvalidOperationException("Unexpected adapter enumeration limit");
    }

    public static IDXGIAdapter1? Resolve(long? requested)
    {
        if (requested is null) return null; // The explicitly unselected control preserves default creation.
        using var factory = DXGI.CreateDXGIFactory1<IDXGIFactory1>();
        for (uint i = 0; i < 256; i++)
        {
            var result = factory.EnumAdapters1(i, out var adapter);
            if (result.Code == unchecked((int)0x887A0002)) break;
            result.CheckError();
            bool keep = false;
            try
            {
                var d = adapter.Description1;
                if (d.Luid == requested.Value)
                {
                    if ((d.Flags & AdapterFlags.Software) != 0) throw new InvalidOperationException("Software adapter selection is refused in this hardware QA");
                    keep = true;
                    return adapter;
                }
            }
            finally { if (!keep) adapter.Dispose(); }
        }
        throw new InvalidOperationException($"Requested hardware adapter LUID {requested} is unavailable; no default fallback");
    }

    public static void VerifyActual(IDirect3DDevice device, long? requested)
    {
        if (requested is null) return;
        using var actual = JsonDocument.Parse(StagingReadback.DescribeDevice(device));
        if (actual.RootElement.GetProperty("luid").GetString() != requested.Value.ToString(CultureInfo.InvariantCulture))
            throw new InvalidOperationException("Created device LUID differs from explicitly requested adapter");
    }

    public static void CheckOptions()
    {
        int checks = 0;
        var plain = Extract(["88", "out", "8", "30", "pipe"]);
        if (plain.Luid is not null || plain.Remaining.Length != 5) throw new Exception("Default control changed");
        checks++;
        var selected = Extract(["--qa-adapter-luid", "103941", "88", "out", "8", "30", "pipe"]);
        var parsed = CaptureArguments.Parse(selected.Remaining);
        if (selected.Luid != 103941 || parsed.CaptureMode != "pipe" || parsed.Duration != 8) throw new Exception("Capture argument roles changed");
        checks++;
        if (Extract(["--qa-adapter-luid", "-1"]).Luid != -1) throw new Exception("Signed LUID rejected");
        checks++;
        foreach (var args in new string[][] {
            ["--qa-adapter-luid"], ["--qa-adapter-luid", "0x19605"], ["--qa-adapter-luid", "+1"],
            ["--qa-adapter-luid", " 1"], ["--qa-adapter-luid", "9223372036854775808"],
            ["--qa-adapter-luid", "1", "--qa-adapter-luid", "2"] })
        {
            bool refused = false;
            try { Extract(args); } catch (ArgumentException) { refused = true; }
            if (!refused) throw new Exception("Invalid adapter option accepted");
            checks++;
        }
        Console.WriteLine(JsonSerializer.Serialize(new { checks, passed = checks, windowCapture = false }));
    }

    public static void CheckDevices()
    {
        var list = Inventory();
        var results = new List<object>();
        foreach (var entry in list.Where(x => !x.Software))
        {
            long luid = long.Parse(entry.Luid, CultureInfo.InvariantCulture);
            using var device = Native.CreateDevice(luid);
            VerifyActual(device, luid);
            using var description = JsonDocument.Parse(StagingReadback.DescribeDevice(device));
            results.Add(new { requestedLuid = entry.Luid, actual = description.RootElement.Clone(), matched = true });
        }
        if (results.Count == 0) throw new InvalidOperationException("No hardware adapters tested");
        long missing = long.MaxValue;
        while (list.Any(x => x.Luid == missing.ToString(CultureInfo.InvariantCulture))) missing--;
        bool missingRefused = false;
        try { using var wrong = Native.CreateDevice(missing); }
        catch (InvalidOperationException error) when (error.Message.Contains("no default fallback")) { missingRefused = true; }
        if (!missingRefused) throw new Exception("Missing adapter unexpectedly created a device");
        foreach (var entry in list.Where(x => x.Software))
        {
            bool refused = false;
            try { using var wrong = Native.CreateDevice(long.Parse(entry.Luid, CultureInfo.InvariantCulture)); }
            catch (InvalidOperationException error) when (error.Message.Contains("Software adapter")) { refused = true; }
            if (!refused) throw new Exception("Software adapter was not refused");
        }
        Console.WriteLine(JsonSerializer.Serialize(new { results, missingRefused, softwareAdaptersRefused = list.Count(x => x.Software), windowCapture = false }));
    }
}
