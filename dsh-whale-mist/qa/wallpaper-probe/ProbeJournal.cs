using System.Text.Json;

/// <summary>
/// Stderr diagnostic channel of the native probe. One JSON object per line:
/// {"kind":"log","level":"info"|"warn"|"error","scope":"...","message":"...","detail":"...","at":&lt;ms&gt;}
/// The Host classifies an entry as a capture failure only when level is "error".
/// Plain text on stderr has no level, so every diagnostic that a successful run
/// can produce must go through this journal.
/// </summary>
public static class ProbeJournal
{
    private static readonly object Gate = new();

    private static readonly JsonSerializerOptions Line = new()
    {
        // The Host reads one line at a time; indentation would break framing.
        WriteIndented = false,
        // Nested records (CloseResult, status objects) keep the same camelCase
        // shape the rest of the capture records use.
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static void Write(string level, string scope, string message, string? detail = null)
    {
        var payload = JsonSerializer.Serialize(new
        {
            kind = "log",
            level,
            scope,
            message,
            detail,
            at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        }, Line);
        lock (Gate)
        {
            Console.Error.WriteLine(payload);
            Console.Error.Flush();
        }
    }

    public static void Info(string scope, string message, string? detail = null) => Write("info", scope, message, detail);

    public static void Warning(string scope, string message, string? detail = null) => Write("warn", scope, message, detail);

    public static void Error(string scope, string message, string? detail = null) => Write("error", scope, message, detail);

    /// <summary>Periodic capture status; the Host exposes the message as parsed JSON.</summary>
    public static void Status(object record) => Write("info", "Status", JsonSerializer.Serialize(record, Line));
}
