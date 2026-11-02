using System.Reflection;
using System.Text.Json;

// Runs real call ordering/worker monitoring with only bottom-level process/COM IO replaced.
// This executable does not run the WallpaperProbe entry or create windows, workers, COM, or capture.
var results = new List<object>(); int failed = 0;
void Check(string name, bool ok) { results.Add(new { name, ok }); if (!ok) failed++; }
var start = DateTimeOffset.Parse("2026-10-29T00:00:00Z");
const string location = "WhaleWallpaperProbe-stage-offline";
var utc = () => start;
long tick = 1000; string? saved = null;
TaskbarTiming Timing(Action<string>? write = null, bool allowed = true) =>
    new("offline", 42, 7, start.ToString("O"), location, write ?? (text => saved = text), allowed,
        () => Interlocked.Add(ref tick, 10), 1000, utc);
string[] Stages(TaskbarTiming t) => t.Inspect().Events.Select(e => e.Stage).ToArray();
bool Has(TaskbarTiming t, string stage) => Stages(t).Contains(stage);
double? Span(TaskbarTiming t, string begin, string end) {
    var e = t.Inspect().Events;
    var a = e.FirstOrDefault(e => e.Stage == begin)?.ElapsedMs;
    var b = e.FirstOrDefault(e => e.Stage == end)?.ElapsedMs;
    return a.HasValue && b.HasValue ? b - a : null;
}

var timed = Timing(); timed.Mark("a"); timed.Mark("b");
Check("fake clock gives a same-origin duration", Span(timed, "a", "b") == 10);
Check("missing stage duration is unknown", Span(timed, "a", "missing") is null);
Check("target identity is diagnostic-bound", timed.Inspect().TargetHwnd == 42 && timed.Inspect().TargetPid == 7 && timed.Inspect().Location == location);
Check("purpose explicitly denies termination authority", timed.Inspect().Purpose.Contains("not-termination-proof"));
Check("save once produces bounded JSON", timed.Save() && saved is not null && saved.Length < 32768 && !timed.Save());
using (var doc = JsonDocument.Parse(saved!))
    Check("JSON keeps frequency/origin and has no success proof", doc.RootElement.GetProperty("frequency").GetInt64() == 1000
        && doc.RootElement.GetProperty("originTimestamp").ValueKind == JsonValueKind.String
        && !doc.RootElement.TryGetProperty("cleanupSafe", out _) && !doc.RootElement.TryGetProperty("exited", out _));
var denied = Timing(allowed:false); denied.Mark("entry");
Check("unauthorized diagnostic cannot write", !denied.Save()); denied.AllowWrite();
Check("existing authorization permits later write", denied.Save());
var writes = 0; var broken = Timing(_ => { writes++; throw new IOException("injected sink failure"); });
broken.Mark("entry"); Check("sink failure is contained with no retries", !broken.Save() && !broken.Save() && writes == 1);
var full = Timing(); for (int i=0; i<1000; i++) full.Mark("event");
Check("event buffer bounded at 64", full.Inspect().Events.Length == 64 && full.Inspect().Truncated);
long clock = 100; var backwards = new TaskbarTiming("test",42,7,start.ToString("O"),location,_=>{},true,()=>clock,1000,utc);
clock = 90; backwards.Mark("backward");
Check("backwards clock remains unknown instead of negative", backwards.Inspect().ClockInvalid && backwards.Inspect().Events[0].ElapsedMs is null);
long large = long.MaxValue-100;
var precise=new TaskbarTiming("test",42,7,start.ToString("O"),location,_=>{},true,()=>large,1000,utc);
large+=10;precise.Mark("small-delta");
Check("large timestamp preserves small same-origin deltas", precise.Inspect().Events[0].ElapsedMs==10);
var throwsClock = new TaskbarTiming("test",42,7,start.ToString("O"),location,_=>{},true,()=>throw new IOException(),1000,()=>throw new IOException());
throwsClock.Mark("clock-unavailable");
Check("clock and UTC failure contained", throwsClock.Inspect().ClockInvalid && throwsClock.Inspect().Events[0].ElapsedMs is null && throwsClock.Inspect().Events[0].Utc is null);
Check("invalid worker argv adds no IO", TaskbarTiming.ForWorker(["--taskbar-worker"]) is null);
var fileDir = Path.Combine(AppContext.BaseDirectory,"diagnostics"); Directory.CreateDirectory(fileDir);
var workerArgs = new[]{"--taskbar-worker","42","7",start.ToString("O"),location,Path.Combine(fileDir,"stop.txt")};
var workerRecord = TaskbarTiming.ForWorker(workerArgs);
Check("valid argv can buffer but cannot create file before authorization", workerRecord is not null && !workerRecord.Save() && !File.Exists(Path.Combine(fileDir,"taskbar-worker-timing.json")));
workerRecord!.AllowWrite(); workerRecord.Mark("authorized");
Check("authorized worker creates only its sidecar", workerRecord.Save() && File.Exists(Path.Combine(fileDir,"taskbar-worker-timing.json")));
var duplicate = TaskbarTiming.ForWorker(workerArgs)!; duplicate.AllowWrite();
Check("existing diagnostic file is preserved", !duplicate.Save());

foreach (var scenario in new[]{"success","init-failed","verify-before","verify-after","stop-before","stop-after","create-throws","init-throws","delete-failed","delete-throws","release-throws"}) {
    var calls = new Calls(scenario); int verify=0, stop=0;
    var timing = Timing();
    var result = TaskbarList.ExecuteCalls(() => { if(scenario=="create-throws")throw new IOException("create"); return calls; },42,
        () => (++verify == (scenario=="verify-before"?1:scenario=="verify-after"?2:-1) ? (false,"changed"):(true,"ok")),
        () => scenario=="stop-before" || (++stop==2 && scenario=="stop-after"), timing);
    bool deleted = scenario is "success" or "delete-failed" or "delete-throws" or "release-throws";
    Check("real COM flow preserves gates: " + scenario, calls.Deletes==(deleted?1:0) && result.Result.Succeeded==(scenario=="success"));
    Check("real COM timing follows reached calls: " + scenario, Has(timing,"delete-tab-begin")==deleted
        && Has(timing,"delete-tab-returned")== (deleted && scenario!="delete-throws")
        && Has(timing,"hr-init-begin")== (scenario is not "stop-before" and not "verify-before" and not "create-throws"));
    if(scenario=="init-failed")Check("failed HrInit does not fabricate DeleteTab duration", Span(timing,"delete-tab-begin","delete-tab-returned") is null);
    if(scenario=="delete-throws")Check("throwing DeleteTab remains unknown duration with original failure", Span(timing,"delete-tab-begin","delete-tab-returned") is null && result.Result.Call=="DeleteTab" && result.DeleteTab is not null);
    if(scenario=="release-throws")Check("release exception keeps successful call evidence but failed final result", result.DeleteTab?.Succeeded==true && result.Result.Call=="Release" && !Has(timing,"com-release-returned"));
    if(scenario=="success")Check("COM phase order and positive spans", string.Join(",",Stages(timing))=="verify-before-begin,verify-before-returned,com-create-begin,com-create-returned,hr-init-begin,hr-init-returned,verify-after-begin,verify-after-returned,delete-tab-begin,delete-tab-returned,com-release-begin,com-release-returned" && Span(timing,"hr-init-begin","hr-init-returned")==10);
}

foreach (var scenario in new[]{"success","bad-protocol","timeout","cancel","wait-throws","start-throws","bind-throws","unconfirmed","stop-before-start","start-refused"}) {
    var worker = new Worker(scenario); var timing = Timing(_ => throw new IOException("sink"));
    var outcome = TaskbarWorker.Run(new("unused",42,7,start.ToString("O"),location,100,"unused-stop"),
        () => scenario=="stop-before-start" || (scenario=="cancel" && worker.Elapsed>=50),
        () => worker, () => worker.Elapsed, timing:timing);
    bool ok = scenario switch {
        "success" => outcome.Exited && outcome.Trace.Result.Succeeded && !worker.Killed,
        "bad-protocol" => outcome.Exited && !outcome.Trace.Result.Succeeded,
        "timeout" => outcome.TimedOut && outcome.Exited && outcome.Terminated,
        "cancel" => outcome.Cancelled && outcome.Exited && outcome.Terminated,
        "wait-throws" or "start-throws" or "bind-throws" => outcome.Exited && worker.Killed && outcome.Error is not null,
        "unconfirmed" => !outcome.Exited && !outcome.CleanupSafe && worker.Killed,
        "start-refused" => !outcome.Started && outcome.CleanupSafe && !worker.Killed,
        _ => !outcome.Started && outcome.Cancelled && outcome.CleanupSafe && !worker.Started
    };
    Check("real worker monitor preserved: " + scenario, ok && (scenario=="stop-before-start" || worker.Disposed));
    Check("diagnostic sink failure cannot change outcome: " + scenario, !timing.Save() && outcome.CleanupSafe==(scenario!="unconfirmed"));
    if(scenario is "timeout" or "unconfirmed" or "cancel")Check("late worker trace is not read: " + scenario, worker.Reads==0 && !Has(timing,"result-read-returned") && Has(timing,"termination-begin"));
    if(scenario=="success")Check("parent has start/exit/read intervals", Has(timing,"worker-start-begin") && Has(timing,"worker-start-returned") && Has(timing,"exit-observed") && Has(timing,"result-read-returned"));
}
// Pure bad-usage branch returns before querying parent processes or opening supervision objects.
var usageTiming=Timing(allowed:false); string? wire=null;int reportCount=0;
var usage=TaskbarList.RunWorkerEntry(["--taskbar-worker"],()=>throw new Exception("must not verify"),()=>false,s=>{wire=s;reportCount++;},usageTiming);
Check("invalid worker protocol still reports once without diagnostics IO", usage==2 && wire is not null && reportCount==1 && !usageTiming.Save());

// The real strategy's observer is diagnostic-only even if an injected observer throws.
var snapshot=new WindowSnapshot(42,7,"wallpaper64",location,true,true,false,false,4096,0,800,600,0,0,0,0,start,0);
int actions=0;
var strategy=new TaskbarHideStrategy(new(true,42,7,start,0),new Probe(snapshot),()=>1,_=>{},location) {
    DiagnosticStage=_=>throw new IOException("observer"),
    Execute=_=> { Interlocked.Increment(ref actions); return Execution.FromResult(new(0,true,"DeleteTab",null)); }
};
strategy.CaptureInitialState();
strategy.OnFrame(new(1,.1,true,"HASH",10000,true,false));
Check("throwing schedule observer cannot block real strategy", actions==1 && !strategy.IsActionPending);
// Run the real Runtime finish/summary with a genuine local diagnostic IO failure and fake window IO.
var blocked=Path.Combine(AppContext.BaseDirectory,"blocked-output");File.WriteAllText(blocked,"not a directory");
var constructor=typeof(TaskbarHideRuntime).GetConstructors(BindingFlags.Instance|BindingFlags.NonPublic).Single();
var runtime=(TaskbarHideRuntime)constructor.Invoke([new TaskbarHideOptions(true,42,7,start,0),new Probe(snapshot),location,blocked,(Func<double>)(()=>1)]);
runtime.Strategy.Execute=_=>Execution.FromResult(new(0,true,"DeleteTab",null));
runtime.CaptureInitialState();runtime.AfterFrame(1,.1,"HASH",10000,10000,true,false);runtime.SettlePending(1000);runtime.Finish();
using(var summary=JsonDocument.Parse(JsonSerializer.Serialize(runtime.GetSummary())))
    Check("real runtime diagnostic file failure does not change safe close result", runtime.CanCloseOwned().Allowed && summary.RootElement.GetProperty("cleanupSafe").GetBoolean());

Console.WriteLine(JsonSerializer.Serialize(new { count=results.Count, failed, scope="real monitor/COM/strategy with bottom-level IO substitutes; no real Shell/worker/visual acceptance", results },new JsonSerializerOptions{WriteIndented=true}));
Environment.ExitCode=failed==0?0:1;

sealed class Calls(string scenario):TaskbarList.ICalls {
    public int Deletes;
    public int HrInit() { if(scenario=="init-throws")throw new IOException("init"); return scenario=="init-failed"?unchecked((int)0x80004005):0; }
    public int DeleteTab(long hwnd) { Deletes++;if(scenario=="delete-throws")throw new IOException("delete");return scenario=="delete-failed"?unchecked((int)0x80004005):0; }
    public void Dispose() { if(scenario=="release-throws")throw new IOException("release"); }
}
sealed class Worker(string scenario):ITaskbarWorkerProcess {
    public long Elapsed;public bool Started,Killed,Disposed; public int Reads;
    public bool Start(TaskbarList.WorkerRequest request) {
        if(scenario=="start-refused")return false;Started=true;
        if(scenario=="start-throws")throw new IOException("post start");
        if(scenario=="bind-throws")throw new InvalidOperationException("Failed to bind worker process to job container");return true;
    }
    public bool WaitForExit(int ms) { Elapsed+=ms;if(scenario=="wait-throws"&&!Killed)throw new IOException("wait");return scenario is "success" or "bad-protocol" || (Killed&&scenario!="unconfirmed"); }
    public void Kill()=>Killed=true;
    public TaskbarList.CallTrace ReadTrace() { Reads++;if(scenario=="bad-protocol")throw new IOException("malformed");return new(new(0,true,"DeleteTab",null),new(0,true,"HrInit",null),new(0,true,"DeleteTab",null)); }
    public void Dispose()=>Disposed=true;
}
sealed class Probe(WindowSnapshot state):IWindowProbe {
    public IReadOnlyList<WindowCandidate> FindByExactTitle(string loc)=>[new(state.Hwnd,state.Pid,state.Title)];
    public WindowSnapshot Inspect(long hwnd)=>state;
}
