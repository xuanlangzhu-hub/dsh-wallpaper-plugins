// Real process/pipe/termination regression, using ONLY a console fake worker. No Shell or WE.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const { values } = parseArgs({ options: { output: { type: 'string' } } });
if (!values.output) throw Error('fresh --output required');
const root = resolve(values.output), here = dirname(fileURLToPath(import.meta.url));
await mkdir(root);
const xml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
await writeFile(join(root, 'Check.csproj'), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0-windows</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Program.cs"/><Compile Include="${xml(join(resolve(here, '../wallpaper-probe'), 'TaskbarList.cs'))}"/><Compile Include="${xml(join(resolve(here, '../wallpaper-probe'), 'TaskbarWorker.cs'))}"/></ItemGroup></Project>`, { flag: 'wx' });
await writeFile(join(root, 'Program.cs'), `using System.Diagnostics;
using System.Text.Json;
if (args.Length == 6 && args[0] == "--taskbar-worker")
{
    var marker = args[5];
    File.WriteAllText(marker + ".started", JsonSerializer.Serialize(new { pid = Environment.ProcessId,
        startUtc = Process.GetCurrentProcess().StartTime.ToUniversalTime().ToString("O") }));
    if (args[4] is "timeout" or "cancel")
    {
        Thread.Sleep(1500);
        File.WriteAllText(marker + ".late", "fake late action");
    }
    if (args[4] == "hold-until-release")
    {
        var releaseWatch = Stopwatch.StartNew();
        while (!File.Exists(marker + ".release") && releaseWatch.ElapsedMilliseconds < 5000)
            Thread.Sleep(15);
    }
    if (args[4] == "bad-protocol") { Console.WriteLine("{invalid-json"); return; }
    // A fake native-call boundary exercises the same COM flow and full protocol as the real worker.
    var trace = TaskbarList.ExecuteCalls(() => new FakeCalls(), 42, () => (true, "fake"), () => false);
    Console.WriteLine(JsonSerializer.Serialize(trace));
    return;
}
var results = new List<object>();
var evidenceRoot = Path.Combine(AppContext.BaseDirectory, "cases");
Directory.CreateDirectory(evidenceRoot);
foreach (var name in new[] { "success", "bad-protocol", "timeout", "cancel", "hold-until-release" })
{
    var marker = Path.Combine(evidenceRoot, name);
    var clock = Stopwatch.StartNew();
    // Wait for the fake worker to boot before starting its tiny operation deadline.
    long? bootAt = null;
    long Elapsed()
    {
        if (bootAt is null && File.Exists(marker + ".started")) bootAt = clock.ElapsedMilliseconds;
        if (clock.ElapsedMilliseconds > 5000) return 6000;
        return bootAt is null ? 0 : clock.ElapsedMilliseconds - bootAt.Value;
    }
    int framesWhilePending = 0;
    WorkerOutcome outcome;
    if (name == "hold-until-release")
    {
        var bg = Task.Run(() => TaskbarWorker.Run(new(Environment.ProcessPath!, 42, Environment.ProcessId,
            "2026-10-12T00:00:00Z", name, 4000, marker), () => false, elapsedMilliseconds: Elapsed));
        while (!File.Exists(marker + ".started") && clock.ElapsedMilliseconds < 4000) Thread.Sleep(10);
        if (!File.Exists(marker + ".started") || bg.IsCompleted)
            throw new Exception("child worker did not remain pending before release");
        for (int f = 0; f < 4; f++)
        {
            if (bg.IsCompleted) throw new Exception("child worker completed before release signal");
            framesWhilePending++;
        }
        File.WriteAllText(marker + ".release", "go");
        outcome = bg.GetAwaiter().GetResult();
    }
    else
    {
        outcome = TaskbarWorker.Run(new(Environment.ProcessPath!, 42, Environment.ProcessId,
            "2026-10-12T00:00:00Z", name, 250, marker),
            () => name == "cancel" && File.Exists(marker + ".started"), elapsedMilliseconds: Elapsed);
    }
    bool correct = name switch
    {
        "success" => outcome.Exited && outcome.Trace.HrInit?.Succeeded == true && outcome.Trace.DeleteTab?.Succeeded == true,
        "hold-until-release" => framesWhilePending == 4 && outcome.Exited && outcome.Trace.HrInit?.Succeeded == true && outcome.Trace.DeleteTab?.Succeeded == true,
        "bad-protocol" => outcome.Exited && !outcome.Trace.Result.Succeeded && outcome.Error is not null,
        "timeout" => outcome.TimedOut && outcome.Exited && outcome.Terminated,
        _ => outcome.Cancelled && outcome.Exited && outcome.Terminated,
    };
    if (!correct) throw new Exception("worker regression " + name + ": " + JsonSerializer.Serialize(outcome));
    var markerData = JsonDocument.Parse(File.ReadAllText(marker + ".started"));
    var pid = markerData.RootElement.GetProperty("pid").GetInt32();
    bool stillRunning;
    try { using var process = Process.GetProcessById(pid); stillRunning = !process.HasExited
        && process.StartTime.ToUniversalTime().ToString("O") == markerData.RootElement.GetProperty("startUtc").GetString(); }
    catch (ArgumentException) { stillRunning = false; }
    if (stillRunning) throw new Exception("fake worker still running " + name);
    results.Add(new { name, framesWhilePending, outcome, stillRunning });
}
Thread.Sleep(1700); // past the fake workers' late-action time; neither may write its marker now.
if (Directory.GetFiles(evidenceRoot, "*.late").Length != 0) throw new Exception("late fake action after worker cancellation");
File.WriteAllText(Path.Combine(AppContext.BaseDirectory, "worker-check.json"), JsonSerializer.Serialize(new { passed = 5, results }));
Console.WriteLine(JsonSerializer.Serialize(new { passed = 5, lateActions = 0, realShellActions = 0, results }));
public sealed class FakeCalls : TaskbarList.ICalls
{ public int HrInit() => 0; public int DeleteTab(long hwnd) => 0; public void Dispose() {} }
`, { flag: 'wx' });
const child = spawn('dotnet', ['run', '--project', join(root, 'Check.csproj'), '-c', 'Release'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { log += data; process.stdout.write(data); });
const exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', done); });
await writeFile(join(root, 'check.log'), log, { flag: 'wx' });
assert.equal(exit, 0, 'fake worker process check failed');
