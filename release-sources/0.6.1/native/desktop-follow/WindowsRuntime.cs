using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32.SafeHandles;
namespace DesktopQuery;
internal sealed class WindowsRuntime(RuntimeGrant permit):IQueryRuntime
{
    public CommandRead? LastCommand;
    public bool ChildLaunchAttempted;
    public static EngineIdentity Identity(int pid)
    {
        using var handle=OpenProcess(0x00101000,false,(uint)pid);
        var path=new StringBuilder(32768);uint length=(uint)path.Capacity;
        if(handle.IsInvalid||!QueryFullProcessImageName(handle,0,path,ref length)||
            !GetProcessTimes(handle,out long birth,out _,out _,out _)||WaitForSingleObject(handle,0)!=258)
            throw new IOException("WE identity unavailable");
        return new(pid,DateTime.FromFileTimeUtc(birth).Ticks,path.ToString());
    }
    public EnvironmentRead Read()
    {
        permit.Validate(DateTimeOffset.UtcNow);
        var engines=new List<EngineIdentity>();bool dsh=false;
        try
        {
            foreach(var p in Process.GetProcessesByName("wallpaper64"))
            {
                using(p)
                {
                    var identity=Identity(p.Id);
                    if(!StringComparer.OrdinalIgnoreCase.Equals(identity.ImagePath,permit.ImagePath))return new(false,engines,dsh,"unexpected-WE-image");
                    engines.Add(identity);
                }
            }
            if(permit.ExpectedEngine is not null && engines.Count==1 && engines[0]!=permit.ExpectedEngine)return new(false,engines,dsh,"expected-engine-changed");
            return new(true,engines.OrderBy(e=>e.Pid).ToArray(),dsh);
        }
        catch(Exception ex){return new(false,engines,dsh,ex.GetType().Name);}
    }
    public async Task<CommandRead> Query(int? monitor,CancellationToken cancellation)
    {
        if(permit.Kind!="query"||permit.ExpectedEngine is null)throw new IOException("query-kind-required");
        permit.Validate(DateTimeOffset.UtcNow);cancellation.ThrowIfCancellationRequested();
        if(Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(permit.ImagePath))).ToLowerInvariant()!=permit.ImageSha256.ToLowerInvariant())
            throw new IOException("WE image fingerprint changed");
        // Re-read before launch; never deliberately start WE when no original engine is present.
        if(!QueryCore.Ready(Read()))throw new IOException("Original WE unavailable before query");
        var start=new ProcessStartInfo(permit.ImagePath){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,
            RedirectStandardOutput=true,RedirectStandardError=true};
        foreach(var arg in QueryCore.Arguments(monitor))start.ArgumentList.Add(arg);
        using var stdout=new MemoryStream();using var stderr=new MemoryStream();
        ChildLaunchAttempted=true;
        using var child=Process.Start(start)??throw new IOException("Query not started");
        _=child.SafeHandle;int pid=child.Id;bool forced=false,timedOut=false,limit=false,exited=false;string? error=null;int? exitCode=null;
        async Task Pump(Stream input,MemoryStream target,CancellationToken token)
        {
            byte[] buffer=new byte[4096];
            while(true)
            {
                int n=await input.ReadAsync(buffer,token);if(n==0)return;
                if(target.Length+n>8192){limit=true;throw new IOException("query-output-limit");}
                target.Write(buffer,0,n);
            }
        }
        using var deadline=CancellationTokenSource.CreateLinkedTokenSource(cancellation);deadline.CancelAfter(TimeSpan.FromSeconds(4));
        Task? pipes=null;
        try
        {
            pipes=Task.WhenAll(Pump(child.StandardOutput.BaseStream,stdout,deadline.Token),Pump(child.StandardError.BaseStream,stderr,deadline.Token));
            await Task.WhenAll(child.WaitForExitAsync(deadline.Token),pipes).WaitAsync(deadline.Token);
        }
        catch(Exception ex)
        {
            error=ex.GetType().Name;timedOut=deadline.IsCancellationRequested;forced=true;
            try{if(!child.HasExited)child.Kill();}catch(Exception cleanup){error+=";kill:"+cleanup.GetType().Name;}
            try{await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(1));}catch(Exception cleanup){error+=";exit:"+cleanup.GetType().Name;}
        }
        finally
        {
            deadline.Cancel();
            try{if(pipes is not null)await pipes.WaitAsync(TimeSpan.FromSeconds(1));}catch(Exception){/* failure retained above */}
        }
        try{exited=child.HasExited;if(exited)exitCode=child.ExitCode;}catch(Exception ex){error+=";status:"+ex.GetType().Name;}
        return LastCommand=new(true,exited,exitCode,timedOut,forced,limit,!exited,pid,
            Convert.ToBase64String(stdout.ToArray()),Convert.ToBase64String(stderr.ToArray()),error);
    }
    [DllImport("kernel32.dll",SetLastError=true)]static extern SafeProcessHandle OpenProcess(uint access,bool inherit,uint pid);
    [DllImport("kernel32.dll",EntryPoint="QueryFullProcessImageNameW",ExactSpelling=true,CharSet=CharSet.Unicode,SetLastError=true)]
    [return:MarshalAs(UnmanagedType.Bool)]static extern bool QueryFullProcessImageName(SafeProcessHandle process,uint flags,StringBuilder path,ref uint length);
    [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]static extern bool GetProcessTimes(SafeProcessHandle process,out long created,out long exit,out long kernel,out long user);
    [DllImport("kernel32.dll")]static extern uint WaitForSingleObject(SafeProcessHandle process,uint milliseconds);
}
