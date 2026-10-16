// Build the isolated C1 taskbar-hide QA from the accepted source.
//
// The accepted helper is READ ONLY: this script generates a copy, applies named anchors exactly once
// each, compiles it into a new directory and verifies afterwards that every accepted source file and
// every accepted asset still has the hash it had before the build.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const accepted = resolve(here, '../wallpaper-probe');
const xml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const sha256 = async path => createHash('sha256').update(await readFile(path)).digest('hex').toUpperCase();

/** Replace one anchor, refusing an absent or ambiguous anchor. */
function replaceOnce(text, from, to, label) {
  const parts = text.split(from);
  if (parts.length !== 2) throw new Error(`anchor '${label}' must appear exactly once, found ${parts.length - 1}`);
  return parts.join(to);
}

const acceptedFiles = ['Program.cs', 'AtomicFile.cs', 'CaptureArguments.cs', 'FrameLog.cs', 'FramePipe.cs', 'ProbeJournal.cs', 'SourceWindowHelper.cs', 'StagingReadback.cs', 'TaskbarList.cs', 'TaskbarWorker.cs', 'WindowIdentity.cs', 'TaskbarHideStrategy.cs', 'TaskbarHideRuntime.cs'];
const qaFiles = ['TaskbarQaOptions.cs', 'TaskbarHideSelfTest.cs', 'TaskbarQaRuntime.cs', 'TaskbarRuntimeSelfTest.cs'];

const { values } = parseArgs({ options: { output: { type: 'string' } } });
if (!values.output) throw new Error('Explicit new --output directory required');
const root = resolve(values.output);
await mkdir(root);
const generated = join(root, 'generated');
await mkdir(generated);

// ---------------------------------------------------------------------------------------------
// 1. Static generated files: the wrapper frame and the companion window accessors.
// ---------------------------------------------------------------------------------------------

// The QA code passes the accepted parsed request around, so that nested record must be at least as
// visible as the QA methods that take it. The patch is applied to a generated COPY; the accepted file
// stays byte-identical and the build proves it at the end.
let captureArgumentsSource = (await readFile(join(accepted, 'CaptureArguments.cs'), 'utf8')).replaceAll('\r\n', '\n');
captureArgumentsSource = replaceOnce(captureArgumentsSource, 'internal static class CaptureArguments', 'public static class CaptureArguments', 'capture-arguments-visibility');
captureArgumentsSource = replaceOnce(captureArgumentsSource, 'internal sealed record Parsed(', 'public sealed record Parsed(', 'parsed-visibility');
await writeFile(join(generated, 'CaptureArguments.cs'), captureArgumentsSource, { flag: 'wx' });

// ---------------------------------------------------------------------------------------------
// 2. The generated Program.cs: entry points, publication-aware trigger, then the wrapped body.
// ---------------------------------------------------------------------------------------------

const optionBlock = `// QA self-check entry points run before anything else: no desktop, no window enumeration, no COM.
if (args.Length >= 1 && args[0] == "--taskbar-worker") { Environment.ExitCode = TaskbarQaRuntime.RunWorkerEntry(args); return; }
if (args.Length == 1 && args[0] == "--taskbar-self-test") { TaskbarQaSelfTest.Run(); return; }
if (args.Length == 1 && args[0] == "--taskbar-self-test-options") { var optionFailures = 0; TaskbarQaOptions.SelfTest((name, ok, detail) => { if (!ok) optionFailures++; Console.WriteLine((ok ? "PASS " : "FAIL ") + name + (detail is null ? "" : ": " + detail)); }); Console.WriteLine(optionFailures == 0 ? "taskbar-qa options self-test: PASS" : "taskbar-qa options self-test: FAIL"); Environment.ExitCode = optionFailures == 0 ? 0 : 1; return; }
if (args.Length == 1 && args[0] == "--taskbar-self-test-com") { var comFailures = 0; TaskbarList.SelfTest((name, ok, detail) => { if (!ok) comFailures++; Console.WriteLine((ok ? "PASS " : "FAIL ") + name + (detail is null ? "" : ": " + detail)); }); Console.WriteLine(comFailures == 0 ? "taskbar-qa com self-test: PASS" : "taskbar-qa com self-test: FAIL"); Environment.ExitCode = comFailures == 0 ? 0 : 1; return; }
// The QA surface is extracted first, then the REMAINING argv goes through the one accepted parser.
// The experiment must agree with the request the capture will really run: same HWND, a JPEG mode, a
// bounded duration within the QA maximum, and a report inside this round's own output directory.
var taskbarOptions = TaskbarQaOptions.Extract(args);
args = taskbarOptions.Remaining;
if (taskbarOptions.Enabled)
{
    var acceptedRequest = CaptureArguments.Parse(args);
    TaskbarQaOptions.RequireMatchesCapture(taskbarOptions, acceptedRequest);
    taskbarQa = TaskbarQaRuntime.Create(taskbarOptions, args, acceptedRequest);
}
Native.EnsureDefaultDesktop();`;

// Ownership is taken as soon as the run has a validated request, before any window or COM boundary.
const ownershipAnchor = 'var hwnd = (nint)handle;';
const ownershipHook = `// QA owns this round's window from here: the outermost finally closes it at most once.
taskbarQa?.TakeOwnership();
taskbarQa?.BindStop(() => stopSignal.IsCancellationRequested
    || File.Exists(Path.Combine(Path.GetFullPath(parsed.OutputDirectory), "stop.txt"))
    || (Native.GetAsyncKeyState(0x1B) & 0x8000) != 0);
var hwnd = (nint)handle;`;

// The publication result of THIS frame, captured where it is produced.
const publishFlagAnchor = '        taskbarHideRuntime?.AfterFrame(frames, clock.Elapsed.TotalSeconds, hash, capturedAt, frame.SystemRelativeTime.TotalMilliseconds, publishedThisFrame, stopSignal.IsCancellationRequested);';
const publishFlagHook = `        taskbarHideRuntime?.AfterFrame(frames, clock.Elapsed.TotalSeconds, hash, capturedAt, frame.SystemRelativeTime.TotalMilliseconds, publishedThisFrame, stopSignal.IsCancellationRequested);
        taskbarQa?.AfterFrame(frames, clock.Elapsed.TotalSeconds, hash, capturedAt, frame.SystemRelativeTime.TotalMilliseconds, publishedThisFrame, stopSignal.IsCancellationRequested);`;

// QA lifecycle encloses the ENTIRE accepted body, including all WGC initialization and using
// disposal. The accepted no-QA close path is preserved; only QA uses the worker cleanup gate.
let program = (await readFile(join(accepted, 'Program.cs'), 'utf8')).replaceAll('\r\n', '\n');
program = replaceOnce(program, 'Native.EnsureDefaultDesktop();\nif (args.Length >= 1 && args[0] == "--taskbar-worker") { Environment.ExitCode = TaskbarHideRuntime.RunWorkerEntry(args); return; }', optionBlock, 'entry');
program = replaceOnce(program, 'try\n{\n// QA self-check', 'TaskbarQaRuntime? taskbarQa = null;\ntry\n{\n// QA self-check', 'outer-lifecycle');
program = replaceOnce(program, publishFlagAnchor, publishFlagHook, 'publish-and-trigger');
program = replaceOnce(program, ownershipAnchor, ownershipHook, 'take-ownership');
program = replaceOnce(program, 'if (ownedLocation is not null && parentLost)',
  'if (taskbarQa is null && ownedLocation is not null && parentLost)', 'no-duplicate-qa-close');
program = replaceOnce(program, '// The bounded frame log:',
  'finally\n{\n    taskbarQa?.Finish();\n}\n\n// The bounded frame log:', 'outer-finally');
await writeFile(join(generated, 'Program.cs'), program, { flag: 'wx' });

// ---------------------------------------------------------------------------------------------
// 3. The runtime that wires the strategy to the real boundaries.
// ---------------------------------------------------------------------------------------------

await writeFile(join(generated, 'TaskbarQaSelfTest.cs'), `using System.Text.Json;
public static class TaskbarQaSelfTest
{
    private static int _failed;

    public static void Run()
    {
        var lines = new List<string>();
        void Report(string name, bool ok, string? detail)
        {
            if (!ok) _failed++;
            var line = (ok ? "PASS " : "FAIL ") + name + (detail is null ? "" : ": " + detail);
            lines.Add(line);
            Console.WriteLine(line);
        }
        TaskbarQaOptions.SelfTest(Report);
        TaskbarHideSelfTest.Run(Report);
        TaskbarList.SelfTest(Report);
        TaskbarRuntimeSelfTest.Run(Report);
        Console.WriteLine($"taskbar-hide self-test: {lines.Count - _failed}/{lines.Count} passed");
        var reportPath = Environment.GetEnvironmentVariable("WM_TASKBAR_SELFTEST_OUT");
        if (!string.IsNullOrEmpty(reportPath))
            File.WriteAllText(reportPath, JsonSerializer.Serialize(new { passed = lines.Count - _failed, total = lines.Count, lines }, new JsonSerializerOptions { WriteIndented = true }));
        Environment.ExitCode = _failed == 0 ? 0 : 1;
    }
}
`, { flag: 'wx' });

// ---------------------------------------------------------------------------------------------
// 4. Project file, input record, build, and the accepted-unchanged proof.
// ---------------------------------------------------------------------------------------------

await writeFile(join(generated, 'WallpaperProbeTaskbarQa.csproj'), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0-windows10.0.19041.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>enable</Nullable><PlatformTarget>x64</PlatformTarget><AssemblyName>WallpaperProbeTaskbarQa</AssemblyName><RootNamespace>WallpaperProbeTaskbarQa</RootNamespace></PropertyGroup>
  <ItemGroup><PackageReference Include="Vortice.Direct3D11" Version="3.8.3" />
    <Compile Include="${xml(join(generated, 'Program.cs'))}" />
    <Compile Include="${xml(join(generated, 'TaskbarQaSelfTest.cs'))}" />
${acceptedFiles.filter(file => file !== 'Program.cs' && file !== 'CaptureArguments.cs').map(file => `    <Compile Include="${xml(join(accepted, file))}" Link="${file}" />`).join('\n')}
    <Compile Include="${xml(join(generated, 'CaptureArguments.cs'))}" />
${qaFiles.map(file => `    <Compile Include="${xml(join(here, file))}" Link="${file}" />`).join('\n')}
  </ItemGroup>
</Project>`, { flag: 'wx' });

const asset = resolve(here, '../../assets/wallpaper');
const inputs = {
  generatedAt: new Date().toISOString(),
  root,
  acceptedSources: await Promise.all(acceptedFiles.map(async file => ({ file: join(accepted, file), sha256: await sha256(join(accepted, file)) }))),
  qaSources: await Promise.all(qaFiles.map(async file => ({ file: join(here, file), sha256: await sha256(join(here, file)) }))),
  acceptedAssets: await Promise.all(['WallpaperProbe.exe', 'WallpaperProbe.dll'].map(async file => ({ file: join(asset, file), sha256: await sha256(join(asset, file)) }))),
};
await writeFile(join(root, 'build-inputs.json'), JSON.stringify(inputs, null, 2), { flag: 'wx' });

const buildArgs = ['publish', join(generated, 'WallpaperProbeTaskbarQa.csproj'), '-c', 'Release', '--self-contained', 'false', '-o', join(root, 'native')];
const child = spawn('dotnet', buildArgs, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { log += data; process.stdout.write(data); });
const exit = await new Promise((resolveExit, rejectExit) => { child.once('error', rejectExit); child.once('close', resolveExit); });
await writeFile(join(root, 'build.log'), log, { flag: 'wx' });
if (exit !== 0) throw new Error('Isolated taskbar QA build failed; generated source and log retained');

const changed = [];
for (const entry of [...inputs.acceptedSources, ...inputs.qaSources, ...inputs.acceptedAssets])
  if (await sha256(entry.file) !== entry.sha256) changed.push(entry.file);
if (changed.length) throw new Error(`Accepted source/asset changed during the build: ${changed.join(', ')}`);

const outputHashes = await Promise.all(['WallpaperProbeTaskbarQa.exe', 'WallpaperProbeTaskbarQa.dll']
  .map(async file => ({ file: join(root, 'native', file), sha256: await sha256(join(root, 'native', file)) })));
await writeFile(join(root, 'build-result.json'), JSON.stringify({ acceptedUnchanged: true, outputHashes }, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ built: root, acceptedUnchanged: true, outputHashes }));
