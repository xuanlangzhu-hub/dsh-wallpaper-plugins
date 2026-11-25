namespace DesktopQuery;

internal sealed record EngineIdentity(int Pid,long BirthUtcTicks,string ImagePath);
internal sealed record EnvironmentRead(bool Complete,IReadOnlyList<EngineIdentity> Engines,bool DshRunning,string? Error=null);
internal sealed record CommandRead(bool Started,bool Exited,int? ExitCode,bool TimedOut,bool Forced,
    bool OutputLimit,bool ExitUnconfirmed,int? Pid,string StdoutBase64,string StderrBase64,string? Error);
internal sealed record QueryReport(bool Succeeded,string Reason,EnvironmentRead Before,EnvironmentRead? After,CommandRead? Command);
internal interface IQueryRuntime
{
    EnvironmentRead Read();
    Task<CommandRead> Query(int? monitor,CancellationToken cancellation);
}
internal static class QueryCore
{
    public static string[] Arguments(int? monitor)
    {
        if(monitor is <0)throw new ArgumentException("invalid-monitor");
        return monitor is null?["-control","getWallpaper"]:["-control","getWallpaper","-monitor",monitor.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)];
    }
    // DSH may be running during normal follow mode. A QA launcher's closed-state backup
    // precondition is separate from this read-only engine-query contract.
    public static bool Ready(EnvironmentRead e)=>e.Complete&&e.Error is null&&e.Engines.Count==1;
    public static async Task<QueryReport> Run(IQueryRuntime runtime,int? monitor,CancellationToken cancellation)
    {
        _=Arguments(monitor);
        var before=runtime.Read();
        if(!Ready(before))return new(false,"environment-not-ready",before,null,null);
        cancellation.ThrowIfCancellationRequested();
        var command=await runtime.Query(monitor,cancellation);
        var after=runtime.Read();
        bool stable=Ready(after)&&before.Engines.SequenceEqual(after.Engines);
        bool exited=command.Started&&command.Exited&&command.ExitCode==0&&!command.TimedOut&&!command.Forced&&
            !command.OutputLimit&&!command.ExitUnconfirmed&&command.Error is null;
        return new(stable&&exited,stable?(exited?"query-exited-with-stable-engine":"query-command-unconfirmed"):"engine-or-closed-state-changed",before,after,command);
    }
}
