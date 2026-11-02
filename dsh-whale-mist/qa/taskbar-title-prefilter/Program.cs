using System.Text;
using System.Text.Json;

// Actual helper + RealWindowProbe compiled with ALL native IO removed and Process aliased.
// Only fixture reads are permitted; launch/close/style APIs throw if reached.
var tests=new List<object>(); int failed=0;
void Check(string name,bool ok) { tests.Add(new { name,ok }); if(!ok)failed++; }
const string location="WhaleWallpaperProbe-offline-title";
var stable=new List<string>();
WindowSnapshot Inspect(long hwnd=1,int pid=7,DateTimeOffset? start=null) =>
    new RealWindowProbe(location,pid,start??Fixture.Start).Inspect(hwnd);
bool Refuses(Action action,string part) {
    try { action(); return false; } catch(InvalidOperationException ex) { return ex.Message.Contains(part); }
}
void One() => Fixture.Reset(new W(1,7,location));

// Shared observations: old and new must produce exactly equal results on stable inputs.
One(); var snapshot=Inspect(); stable.Add(JsonSerializer.Serialize(snapshot));
Check("real probe returns full identity and three fresh enumerations",snapshot.Exists && snapshot.Pid==7 && snapshot.StartTimeUtc==Fixture.Start && Fixture.Enumerations==3);
Check("real process clock is read once per probe",Fixture.StartReads==1);
Fixture.Processes[7].Start=Fixture.Start.AddTicks(1);
Check("100ns recycled process start is rejected on next observation",Refuses(()=>Inspect(),"start-time-changed"));
One(); Check("expected PID mismatch refused",Refuses(()=>Inspect(pid:8),"expected PID"));
One(); Check("wrong HWND refused",Refuses(()=>Inspect(hwnd:9),"not a valid window"));
Fixture.Reset(new W(1,7,location),new W(2,8,location));
Check("duplicate exact title refuses real probe",Refuses(()=>Inspect(),"ambiguous"));
Check("duplicate exact title refuses helper",Refuses(()=>SourceWindowHelper.RequireUniqueProbeWindow(location),"ambiguous"));
var close=SourceWindowHelper.EnsureProbeWindowClosed(location,0,7);
Check("duplicate title cannot authorize close",!close.SafeToCleanUp && close.Outcome=="ambiguous");
Fixture.Reset(new W(2,8,location));
close=SourceWindowHelper.EnsureProbeWindowClosed(location,0,7);
Check("foreign PID cannot authorize close",!close.SafeToCleanUp && close.Outcome=="identity-changed");
Fixture.Reset(); close=SourceWindowHelper.EnsureProbeWindowClosed(location,0,7);
Check("stable absent preserves inherited absent outcome",close.SafeToCleanUp && close.Outcome=="absent");
One(); Fixture.Processes[7].Name="not-wallpaper";
Check("same title foreign executable is not accepted",!Inspect().Exists);
One(); Fixture.Processes[7].Name="WallPaper64";
Check("process name remains ordinal-ignore-case",Inspect().Exists);
Fixture.Reset(new W(1,7,location.ToUpperInvariant()));
Check("title remains ordinal case-sensitive",!Inspect().Exists);
Fixture.Reset(new W(1,7,location+"-other"));
Check("exact lookup rejects prefix-only match",!Inspect().Exists);
Fixture.Reset(new W(1,0,location));
Check("zero PID rejected before process lookup",!Inspect().Exists && Fixture.ProcessGets==0);
One(); Fixture.Windows[0].Exists=false;
Check("dead HWND rejected before process lookup",!Inspect().Exists && Fixture.ProcessGets==0);
One(); Fixture.Processes[7].Throw=true;
Check("inaccessible process remains skipped by inherited scan",SourceWindowHelper.FindProbeWindows().Count==0);
One(); Fixture.Windows[0].ThrowText=true;
Check("title read exception remains contained by scan",SourceWindowHelper.FindProbeWindows().Count==0);
One(); Fixture.Windows[0].Cloaked=true;
Check("prefix finder preserves cloaked observation",SourceWindowHelper.FindProbeWindows().Single().Cloaked);
Check("exact finder rejects cloaked live target",Refuses(()=>SourceWindowHelper.RequireUniqueProbeWindow(location),"No open"));
foreach(var flag in new[]{"invisible","iconic"}) {
    One(); Fixture.Windows[0].Visible=flag!="invisible";Fixture.Windows[0].Iconic=flag=="iconic";
    var s=Inspect(); Check(flag+" flag preserved for downstream strategy",flag=="iconic"?s.Iconic:!s.Visible);
}
// Keeping the original post-process title check is essential for this race.
One(); Fixture.OnName=()=>Fixture.Windows[0].Title="unrelated";
Check("title changed during process read rejected by exact finder",Refuses(()=>SourceWindowHelper.RequireUniqueProbeWindow(location),"No open"));
One(); Fixture.OnName=()=>Fixture.Windows[0].Title="unrelated";
Check("title changed during process read rejected by prefix finder",SourceWindowHelper.FindProbeWindows().Count==0);
One(); Fixture.OnEnumeration=n=> { if(n==2)Fixture.Windows.Add(new W(2,7,location)); };
Check("duplicate appearing between fresh scans is rejected",Refuses(()=>Inspect(),"ambiguous"));
One(); Fixture.OnEnumeration=n=> { if(n==2)Fixture.Windows[0].Pid=8; };
Check("PID changing between scans is rejected",Refuses(()=>Inspect(),"expected PID"));
One(); Fixture.OnEnumeration=n=> { if(n==2)Fixture.Windows.Clear(); };
Check("closure between scans is rejected",Refuses(()=>Inspect(),"No open"));
One(); Fixture.OnName=()=>Fixture.Processes[7].Start=Fixture.Start.AddTicks(1);
Check("process recycling during scan is rejected by fresh clock",Refuses(()=>Inspect(),"start-time-changed"));
One(); Inspect(); Fixture.Processes[7].Start=null;
Check("process gone on later observation is rejected",Refuses(()=>Inspect(),"target-process-gone"));
One(); Inspect(); Fixture.Windows.Add(new W(2,7,location));
Check("no cross-call identity cache conceals later duplicate",Refuses(()=>Inspect(),"ambiguous"));

// Deterministic differential inventory: serialized observations must match baseline exactly.
var random=new Random(1977);
for(int sample=0;sample<150;sample++) {
    var windows=Enumerable.Range(1,40).Select(i=>new W(i,(uint)(i+100),
        random.Next(4)==0?"WhaleWallpaperProbe-"+random.Next(5):"Other-"+i) {
            Visible=random.Next(3)!=0,Iconic=random.Next(4)==0,Cloaked=random.Next(5)==0,Exists=random.Next(9)!=0 }).ToArray();
    Fixture.Reset(windows);
    foreach(var process in Fixture.Processes.Values)process.Name=random.Next(3)==0?"other":"wallpaper64";
    stable.Add(JsonSerializer.Serialize(SourceWindowHelper.FindProbeWindows()));
    try { stable.Add(JsonSerializer.Serialize(SourceWindowHelper.RequireUniqueProbeWindow("WhaleWallpaperProbe-2"))); }
    catch(InvalidOperationException e) { stable.Add(e.Message); }
}
Check("150 stable differential fixtures evaluated",stable.Count==301);

// Work counts, not timing claims. Process queries in Inspect are included.
W[] Busy() => Enumerable.Range(10,120).Select(i=>new W(i,(uint)(i+1000),"Unrelated-"+i))
    .Append(new W(1,7,location)).ToArray();
Fixture.Reset(Busy());SourceWindowHelper.FindProbeWindows();
var prefixStats=new { Fixture.ProcessGets,Fixture.NameReads,Fixture.UnrelatedReads,Fixture.TextReads };
Check("optimization: prefix scan never reads unrelated process metadata",Fixture.UnrelatedReads==0);
Fixture.Reset(Busy());SourceWindowHelper.RequireUniqueProbeWindow(location);
var exactStats=new { Fixture.ProcessGets,Fixture.NameReads,Fixture.UnrelatedReads,Fixture.TextReads };
Check("optimization: exact scan never reads unrelated process metadata",Fixture.UnrelatedReads==0);
Fixture.Reset(Busy());Inspect();
var probeStats=new { Fixture.ProcessGets,Fixture.NameReads,Fixture.UnrelatedReads,Fixture.TextReads,Fixture.Enumerations };
Check("optimization: real probe never reads unrelated process metadata",Fixture.UnrelatedReads==0);
Check("optimization keeps all three real-probe enumerations",Fixture.Enumerations==3);
// Negative control: all candidate titles still require their own fresh process reads.
Fixture.Reset(Enumerable.Range(1,12).Select(i=>new W(i,(uint)(i+100),"WhaleWallpaperProbe-"+i)).ToArray());
SourceWindowHelper.FindProbeWindows();
Check("every prefix candidate still gets process and snapshot reads",Fixture.ProcessGets==24 && Fixture.NameReads==24);
Check("QA native style entry is a throwing sentinel",Refuses(()=>SourceWindowHelper.ShowWindow(1,0),"OFFLINE forbidden native IO: ShowWindow"));
Check("QA process launch entry is a throwing sentinel",Refuses(()=>SourceWindowHelper.LaunchOnDefaultDesktop("never-run.exe",""),"OFFLINE forbidden native IO: CreateProcess"));
Console.WriteLine(JsonSerializer.Serialize(new { count=tests.Count,failed,tests,stable,prefixStats,exactStats,probeStats,
    liveWindows=false,realProcessQueries=false,realComCapture=false }));
return failed==0?0:1;

sealed class W(long h,uint p,string t) {
    public long Hwnd=h;public uint Pid=p;public string Title=t;
    public bool Exists=true,Visible=true,Iconic=false,Cloaked=false,ThrowText=false;
}
sealed class P { public string Name="wallpaper64";public DateTimeOffset? Start=Fixture.Start;public bool Throw=false; }
static class Fixture {
    public static readonly DateTimeOffset Start=DateTimeOffset.Parse("2026-10-29T00:00:00Z");
    public static List<W> Windows=[];public static Dictionary<uint,P> Processes=[];
    public static int Enumerations,ProcessGets,NameReads,UnrelatedReads,TextReads,StartReads;
    public static Action<int>? OnEnumeration;public static Action? OnName;
    public static void Reset(params W[] windows) {
        Windows=[..windows];Processes=windows.Select(w=>w.Pid).Append(8u).Distinct().ToDictionary(p=>p,_=>new P());
        Enumerations=ProcessGets=NameReads=UnrelatedReads=TextReads=StartReads=0;OnEnumeration=null;OnName=null;
    }
    public static W At(nint h)=>Windows.First(w=>w.Hwnd==(long)h);
    public static bool Exists(nint h)=>Windows.Any(w=>w.Hwnd==(long)h && w.Exists);
    public static uint Pid(nint h)=>At(h).Pid;
    public static bool Enum(Func<nint,nint,bool> callback,nint arg) {
        Enumerations++; OnEnumeration?.Invoke(Enumerations);
        foreach(var w in Windows.ToArray())if(!callback((nint)w.Hwnd,arg))break;
        return true;
    }
    public static int Text(nint h,StringBuilder text,int count) {
        TextReads++;var w=At(h);if(w.ThrowText)throw new IOException("fixture title");
        text.Append(w.Title[..Math.Min(w.Title.Length,count-1)]);return text.Length;
    }
}
sealed class FixtureProcess(uint pid):IDisposable {
    public static FixtureProcess GetProcessById(int pid) {
        Fixture.ProcessGets++;if(!Fixture.Processes.TryGetValue((uint)pid,out var p)||p.Throw)throw new ArgumentException("fixture gone");
        return new((uint)pid);
    }
    public string ProcessName { get {
        Fixture.NameReads++;
        if(Fixture.Windows.Any(w=>w.Pid==pid && w.Title.StartsWith("Unrelated-")))Fixture.UnrelatedReads++;
        var action=Fixture.OnName;Fixture.OnName=null;action?.Invoke();return Fixture.Processes[pid].Name;
    } }
    public DateTime StartTime { get { Fixture.StartReads++;return Fixture.Processes[pid].Start?.UtcDateTime??throw new ArgumentException("gone"); } }
    public Module MainModule=>throw new InvalidOperationException("OFFLINE MainModule forbidden");
    public void Dispose() { }
    public sealed class Module { public string FileName=>throw new InvalidOperationException("OFFLINE Module forbidden"); }
}
