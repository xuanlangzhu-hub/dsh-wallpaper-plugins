using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Reflection.PortableExecutable;
using System.Security.Cryptography;
using System.Text.Json;

if (args.Length == 2 && args[0] == "--parse-host-argv") {
    var requests = JsonSerializer.Deserialize<string[][]>(await File.ReadAllTextAsync(args[1]))!;
    var results = requests.Select(argv => { var p=CaptureArguments.Parse(argv); return new { p.Forever,p.TaskbarHide,p.CaptureMode,p.OwnedLocation }; }).ToArray();
    Console.WriteLine(JsonSerializer.Serialize(new { passed=results.Length, results })); return;
}
// Inspection uses PEReader, never Assembly.Load or the WallpaperProbe entry point.
var old = Inspect(args[0]);
var updated = Inspect(args[1]);
var output = Path.GetFullPath(args[2]);
Directory.CreateDirectory(output);
var bodyChanges = old.Bodies.Keys.Union(updated.Bodies.Keys).Where(k => old.Bodies.GetValueOrDefault(k) != updated.Bodies.GetValueOrDefault(k)).ToArray();
var metadata = new {
    old.Identity, updatedIdentity = updated.Identity,
    refsEqual = old.References.SequenceEqual(updated.References), references = updated.References,
    apiEqual = old.Api.SequenceEqual(updated.Api), members = updated.Api.Length,
    machineEqual = old.Machine == updated.Machine, machine = updated.Machine,
    entryEqual = old.Entry == updated.Entry, entry = updated.Entry,
    bodyChanges, methods = updated.Bodies.Count,
};
await File.WriteAllTextAsync(Path.Combine(output, "metadata.json"), JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true }));
if (old.Identity != updated.Identity || !metadata.refsEqual || !metadata.apiEqual || !metadata.machineEqual || !metadata.entryEqual
    || bodyChanges.Length != 1 || !bodyChanges[0].StartsWith("TaskbarHideRuntime::Create:"))
    throw new Exception("Unexpected assembly contract/IL difference; inspect metadata.json");

var checks = new List<object>();
void Check(string name, bool ok) { checks.Add(new { name, ok }); if (!ok) throw new Exception(name); }
string loc = "WhaleWallpaperProbe-integration-offline";
string[] Valid(string duration = "--forever", bool hide = true) =>
    ["4242", output, duration, "30", "pipe", "--owned-location", loc, ..(hide ? new[] { "--taskbar-hide" } : Array.Empty<string>())];
foreach (var (name, argv, forever, hide) in new[] {
    ("daily exact Host argv", Valid(), true, true), ("preview exact Host argv", Valid("20"), false, true),
    ("fallback exact Host argv", Valid(hide:false), true, false) }) {
    var parsed = CaptureArguments.Parse(argv);
    Check(name, parsed.Forever == forever && parsed.TaskbarHide == hide && parsed.OwnedLocation == loc && parsed.CaptureMode == "pipe");
}
foreach (var (name, argv) in new[] {
    ("duplicate taskbar flag", Valid().Concat(new[] { "--taskbar-hide" }).ToArray()),
    ("unknown flag", Valid().Concat(new[] { "--typo" }).ToArray()),
    ("unowned daily", new[] { "4242", output, "--forever", "30", "pipe" }),
    ("unowned hide", new[] { "4242", output, "20", "30", "pipe", "--taskbar-hide" }),
    ("nonpipe hide", new[] { "4242", output, "20", "30", "disk", "--taskbar-hide", "--owned-location", loc }),
    ("duration next to forever", new[] { "4242", output, "--forever", "20", "30", "pipe", "--owned-location", loc }),
    ("invalid fps", Valid().Select(s => s == "30" ? "31" : s).ToArray()) }) {
    bool rejected = false;
    try { CaptureArguments.Parse(argv); } catch (ArgumentException) { rejected = true; }
    Check(name, rejected);
}
using (var stream = new MemoryStream()) {
    await FramePipe.Write(stream, [255,216,255,217], 7, 1700000000123, 1280, 720, CancellationToken.None);
    await File.WriteAllBytesAsync(Path.Combine(output, "frame.whl"), stream.ToArray());
    Check("real FramePipe emitted 24-byte header and payload", stream.Length == 28);
}
var start = DateTimeOffset.Parse("2026-10-28T00:00:00Z");
// Only construct the public factory. Do not call its real probe or deferred worker closure.
var factory = TaskbarHideRuntime.Create(4242, 777, start, loc, output);
var options = (TaskbarHideOptions)typeof(TaskbarHideStrategy).GetField("_options", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(factory.Strategy)!;
var ctor = typeof(TaskbarHideRuntime).GetConstructors(BindingFlags.NonPublic | BindingFlags.Instance).Single();
TaskbarHideRuntime Make(string name, bool confirmed) {
    var folder = Path.Combine(output, name); Directory.CreateDirectory(folder);
    var runtime = (TaskbarHideRuntime)ctor.Invoke([options, new Probe(loc,start), loc, folder, (Func<double>)(() => .05)]);
    runtime.Strategy.Execute = _ => confirmed ? Execution.FromResult(new(0,true,"DeleteTab",null)) :
        Execution.FromWorker(new(new(new(0,true,"DeleteTab",null),new(0,true,"HrInit",null),new(0,true,"DeleteTab",null)),true,false,false,false,true,false,"injected unconfirmed exit"));
    runtime.CaptureInitialState(); return runtime;
}
var success = Make("confirmed", true);
success.AfterFrame(1,.05,"ABC",1700000000123,1,true,false); success.SettlePending(1000);
var status = success.GetStatus(); success.Finish();
var unsafeRuntime = Make("unconfirmed", false);
unsafeRuntime.AfterFrame(1,.05,"ABC",1700000000123,1,true,false); unsafeRuntime.SettlePending(1000); unsafeRuntime.Finish();
var unstarted = Make("unstarted", true); unstarted.Finish();
var samples = new { status, success = success.GetSummary(), unconfirmed = unsafeRuntime.GetSummary(), unstarted = unstarted.GetSummary() };
await File.WriteAllTextAsync(Path.Combine(output,"runtime.json"), JsonSerializer.Serialize(samples));
Check("factory threshold in protocol probe is zero", options.MinSeconds == 0);
Check("real summary emits confirmed cleanup", success.CanCloseOwned().Allowed);
Check("real summary refuses unconfirmed exit", !unsafeRuntime.CanCloseOwned().Allowed);
var error = Console.Error;
using (var writer = new StringWriter()) {
    Console.SetError(writer);
    try {
        ProbeJournal.Status(new { captureSource="window", frames=1, taskbarHide=status });
        ProbeJournal.Info("Summary", JsonSerializer.Serialize(new { reason="parent-stop", taskbarHide=samples.success }));
    } finally { Console.SetError(error); }
    await File.WriteAllTextAsync(Path.Combine(output,"journal.jsonl"), writer.ToString());
}
Console.WriteLine(JsonSerializer.Serialize(new { passed=checks.Count, checks, realWindowCalls=0, realShellCalls=0 }));

static Snapshot Inspect(string path) {
    using var stream = File.OpenRead(path); using var pe = new PEReader(stream);
    var reader = pe.GetMetadataReader(); var asm = reader.GetAssemblyDefinition();
    string TypeName(TypeDefinitionHandle handle) {
        var t=reader.GetTypeDefinition(handle); var parent=t.GetDeclaringType();
        return parent.IsNil ? reader.GetString(t.Namespace)+(reader.GetString(t.Namespace).Length==0 ? "" : ".")+reader.GetString(t.Name)
            : TypeName(parent)+"+"+reader.GetString(t.Name);
    }
    var api = new List<string>(); var bodies = new SortedDictionary<string,string>(StringComparer.Ordinal);
    var methodNames = new Dictionary<int,string>();
    foreach (var th in reader.TypeDefinitions) {
        var type = reader.GetTypeDefinition(th); var name = TypeName(th); api.Add("T:"+name+":"+type.Attributes);
        foreach (var fh in type.GetFields()) { var f=reader.GetFieldDefinition(fh); api.Add("F:"+name+":"+reader.GetString(f.Name)+":"+f.Attributes+":"+Convert.ToHexString(reader.GetBlobBytes(f.Signature))); }
        foreach (var mh in type.GetMethods()) {
            var m = reader.GetMethodDefinition(mh);
            var key = name+"::"+reader.GetString(m.Name)+":"+Convert.ToHexString(reader.GetBlobBytes(m.Signature));
            api.Add("M:"+key+":"+m.Attributes+":"+m.ImplAttributes); methodNames[MetadataTokens.GetToken(mh)]=key;
            if (m.RelativeVirtualAddress!=0) {
                var body=pe.GetMethodBody(m.RelativeVirtualAddress);
                var content=Convert.ToHexString(body.GetILBytes() ?? [])+":"+body.MaxStack+":"+body.LocalVariablesInitialized+":"+MetadataTokens.GetToken(body.LocalSignature)
                    +":"+JsonSerializer.Serialize(body.ExceptionRegions);
                bodies.Add(key,Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(content))));
            }
        }
    }
    var refs = reader.AssemblyReferences.Select(h=> {var a=reader.GetAssemblyReference(h);return reader.GetString(a.Name)+","+a.Version+","+Convert.ToHexString(reader.GetBlobBytes(a.PublicKeyOrToken));}).Order(StringComparer.Ordinal).ToArray();
    var entryToken=pe.PEHeaders.CorHeader!.EntryPointTokenOrRelativeVirtualAddress;
    return new(reader.GetString(asm.Name)+","+asm.Version,refs,api.Order(StringComparer.Ordinal).ToArray(),bodies,
        pe.PEHeaders.CoffHeader.Machine.ToString(),methodNames.GetValueOrDefault(entryToken,entryToken.ToString()));
}
sealed record Snapshot(string Identity,string[] References,string[] Api,SortedDictionary<string,string> Bodies,string Machine,string Entry);
sealed class Probe(string loc,DateTimeOffset start) : IWindowProbe {
    public IReadOnlyList<WindowCandidate> FindByExactTitle(string location)=>[];
    public WindowSnapshot Inspect(long hwnd)=> new(hwnd,777,"wallpaper64",loc,true,true,false,false,0,0,1280,720,0,0,0,0,start,0);
}
