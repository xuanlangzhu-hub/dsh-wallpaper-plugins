"""Create an isolated diagnostic-only native tree; all edits use exact frozen anchors."""
from pathlib import Path
import argparse,difflib,hashlib,json,shutil

here=Path(__file__).resolve().parent;root=here.parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);a=parser.parse_args()
out=Path(a.output).resolve();assert out.is_relative_to(root/'.tmp') and not out.exists()
baseline=json.loads((here.parent/'taskbar-first-frame/baseline.json').read_bytes())
source=root/baseline['source'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
assert all(sha(source/n)==h for n,h in baseline['files'].items())
texts={n:(source/n).read_text(encoding='utf-8') for n in baseline['files']}
texts['TaskbarHideRuntime.cs']=texts['TaskbarHideRuntime.cs'].replace('            MinSeconds: 10);',
 '            // The historical delay supplied a before/after baseline for the C1 experiment.\n'
 '            // Production keeps the encoded/published-frame gate without that observation delay.\n'
 '            MinSeconds: 0);')
base=dict(texts)
def edit(name,old,new,count=1):
    assert texts[name].count(old)==count,(name,old,texts[name].count(old))
    texts[name]=texts[name].replace(old,new)

edit('Program.cs','Native.EnsureDefaultDesktop();\nif (args.Length >= 1 && args[0] == "--taskbar-worker") { Environment.ExitCode = TaskbarHideRuntime.RunWorkerEntry(args); return; }',
 '''// [TASKBAR-STAGE] Buffer only; worker diagnostics cannot write before supervision authorization.
var workerTiming = TaskbarTiming.ForWorker(args);
workerTiming?.Mark("entry-before-desktop");
Native.EnsureDefaultDesktop();
workerTiming?.Mark("desktop-returned");
if (args.Length >= 1 && args[0] == "--taskbar-worker") { Environment.ExitCode = TaskbarHideRuntime.RunWorkerEntry(args, workerTiming); return; }''')
edit('TaskbarHideRuntime.cs','    private readonly string _location;','    private readonly string _location;\n    private readonly TaskbarTiming? _timing;')
edit('TaskbarHideRuntime.cs','        _location = location;','''        _location = location;
        _timing = TaskbarTiming.ForParent(outputDirectory, options.Hwnd ?? 0, options.Pid ?? 0, options.Start ?? default, location);
        _timing?.Mark("runtime-created");''')
edit('TaskbarHideRuntime.cs','            ExternalStopRequested = () => Volatile.Read(ref _stopping) || _stopRequested(),','''            ExternalStopRequested = () => Volatile.Read(ref _stopping) || _stopRequested(),
            DiagnosticStage = stage => _timing?.Mark(stage),''')
edit('TaskbarHideRuntime.cs','                onStarted: runtime._strategy.NotifyWorkerStarted);',
 '                onStarted: runtime._strategy.NotifyWorkerStarted, timing: runtime._timing);')
edit('TaskbarHideRuntime.cs','        _strategy.Write(_strategy.Stage);','''        _strategy.Write(_strategy.Stage);
        _timing?.Mark("runtime-finish-snapshot");
        _timing?.Save();''')
edit('TaskbarHideRuntime.cs','public static int RunWorkerEntry(string[] args)','public static int RunWorkerEntry(string[] args, TaskbarTiming? timing = null)')
edit('TaskbarHideRuntime.cs','        }, () => File.Exists(args[5]), Console.WriteLine);','        }, () => File.Exists(args[5]), Console.WriteLine, timing);')
edit('TaskbarHideStrategy.cs','    public Action<long>? BeforeCall { get; init; }','''    public Action<long>? BeforeCall { get; init; }
    public Action<string>? DiagnosticStage { get; init; }''')
edit('TaskbarHideStrategy.cs','            _pendingAction = Task.Run(RunActionCore);','''            try { DiagnosticStage?.Invoke("action-scheduled"); } catch { /* diagnostics never gate work */ }
            _pendingAction = Task.Run(RunActionCore);''')

edit('TaskbarWorker.cs','        Action? onStarted = null)','        Action? onStarted = null, TaskbarTiming? timing = null)')
edit('TaskbarWorker.cs','        ITaskbarWorkerProcess? worker = null;','        timing?.Mark("executor-entered");\n        ITaskbarWorkerProcess? worker = null;')
edit('TaskbarWorker.cs','worker = (factory ?? (() => new RealWorker()))();','worker = (factory ?? (() => new RealWorker(timing)))();')
edit('TaskbarWorker.cs','                started = worker.Start(request);','''                timing?.Mark("worker-start-begin");
                started = worker.Start(request);
                timing?.Mark("worker-start-returned");''')
edit('TaskbarWorker.cs','                    if (worker.WaitForExit(50)) { exited = true; break; }','                    if (worker.WaitForExit(50)) { exited = true; timing?.Mark("exit-observed"); break; }')
edit('TaskbarWorker.cs','                if (exited) trace = worker.ReadTrace();','''                if (exited)
                {
                    timing?.Mark("result-read-begin");
                    trace = worker.ReadTrace();
                    timing?.Mark("result-read-returned");
                }''')
edit('TaskbarWorker.cs','                    try { worker.Kill(); }','                    try { timing?.Mark("termination-begin"); worker.Kill(); timing?.Mark("termination-returned"); }')
edit('TaskbarWorker.cs','                    try { exited = worker.WaitForExit(5000); }','                    try { exited = worker.WaitForExit(5000); timing?.Mark(exited ? "termination-exit-observed" : "termination-exit-unknown"); }')
edit('TaskbarWorker.cs','            try { worker?.Dispose(); }','            try { if (worker is not null) { timing?.Mark("worker-dispose-begin"); worker.Dispose(); timing?.Mark("worker-dispose-returned"); } }')
edit('TaskbarWorker.cs','        return new(trace, started, exited, timedOut, cancelled, terminationRequested, terminated, failure);','        timing?.Mark("executor-returning");\n        return new(trace, started, exited, timedOut, cancelled, terminationRequested, terminated, failure);')
edit('TaskbarWorker.cs','        private readonly Process _process = new();','''        private readonly Process _process = new();
        private readonly TaskbarTiming? _timing;
        public RealWorker(TaskbarTiming? timing) => _timing = timing;''')
edit('TaskbarWorker.cs','            _jobHandle = JobObjectContainer.CreateKillOnCloseJob();','''            _timing?.Mark("job-create-begin");
            _jobHandle = JobObjectContainer.CreateKillOnCloseJob();
            _timing?.Mark("job-create-returned");''')
edit('TaskbarWorker.cs','            if (!_process.Start())','            _timing?.Mark("process-start-begin");\n            if (!_process.Start())')
edit('TaskbarWorker.cs','            if (!JobObjectContainer.Assign(_jobHandle, _process.Handle))','''            _timing?.Mark("process-start-returned");
            _timing?.Mark("job-assign-begin");
            if (!JobObjectContainer.Assign(_jobHandle, _process.Handle))''')
edit('TaskbarWorker.cs','            _authEvent?.Set();','''            _timing?.Mark("job-assign-returned");
            _authEvent?.Set();
            if (_authEvent is not null) _timing?.Mark("supervision-signalled");''')

edit('TaskbarList.cs','''        Func<bool> stopRequested, Action<string> report)
    {
        CallTrace trace;''','''        Func<bool> stopRequested, Action<string> report, TaskbarTiming? timing = null)
    {
        try
        {
            return RunWorkerEntryCore(args, verify, stopRequested, text =>
            {
                timing?.Mark("result-output-begin");
                report(text);
                timing?.Mark("result-output-returned");
            }, timing);
        }
        finally { timing?.Mark("entry-returning"); timing?.Save(); }
    }

    private static int RunWorkerEntryCore(string[] args, Func<(bool Ok, string Reason)> verify,
        Func<bool> stopRequested, Action<string> report, TaskbarTiming? timing)
    {
        timing?.Mark("worker-entry-core");
        CallTrace trace;''')
edit('TaskbarList.cs','        trace = RunTrace(() => new ComAction(verify, parentLostOrStop), long.Parse(args[1], CultureInfo.InvariantCulture));','''        timing?.AllowWrite();
        timing?.Mark("supervision-authorized");
        trace = RunTrace(() => new ComAction(verify, parentLostOrStop, timing), long.Parse(args[1], CultureInfo.InvariantCulture));''')
edit('TaskbarList.cs','''        Func<(bool Ok, string Reason)> verify, Func<bool> stopRequested)
    {
        ICalls? calls''','''        Func<(bool Ok, string Reason)> verify, Func<bool> stopRequested, TaskbarTiming? timing = null)
    {
        ICalls? calls''')
for old,new in [
 ('            var before = verify();','            timing?.Mark("verify-before-begin");\n            var before = verify();\n            timing?.Mark("verify-before-returned");'),
 ('            calls = factory();','            timing?.Mark("com-create-begin");\n            calls = factory();\n            timing?.Mark("com-create-returned");'),
 ('            var hr = calls.HrInit();','            timing?.Mark("hr-init-begin");\n            var hr = calls.HrInit();\n            timing?.Mark("hr-init-returned");'),
 ('                var check = verify();','                timing?.Mark("verify-after-begin");\n                var check = verify();\n                timing?.Mark("verify-after-returned");'),
 ('                    hr = calls.DeleteTab(hwnd);','                    timing?.Mark("delete-tab-begin");\n                    hr = calls.DeleteTab(hwnd);\n                    timing?.Mark("delete-tab-returned");'),
 ('            try { calls?.Dispose(); }','            try { if (calls is not null) { timing?.Mark("com-release-begin"); calls.Dispose(); timing?.Mark("com-release-returned"); } }')]:edit('TaskbarList.cs',old,new)
edit('TaskbarList.cs','''        private readonly Func<bool> _stopRequested;
        public ComAction()''','''        private readonly Func<bool> _stopRequested;
        private readonly TaskbarTiming? _timing;
        public ComAction()''')
edit('TaskbarList.cs','''public ComAction(Func<(bool Ok, string Reason)> verify, Func<bool> stopRequested)
        { _verify = verify; _stopRequested = stopRequested; }''','''public ComAction(Func<(bool Ok, string Reason)> verify, Func<bool> stopRequested, TaskbarTiming? timing = null)
        { _verify = verify; _stopRequested = stopRequested; _timing = timing; }''')
edit('TaskbarList.cs','ExecuteCalls(() => new NativeCalls(), hwnd, _verify, _stopRequested);','ExecuteCalls(() => new NativeCalls(), hwnd, _verify, _stopRequested, _timing);')

changed=[n for n in texts if texts[n]!=base[n]]
assert set(changed)=={'Program.cs','TaskbarHideRuntime.cs','TaskbarHideStrategy.cs','TaskbarWorker.cs','TaskbarList.cs'}
out.mkdir();native=out/'native-source';native.mkdir()
for n,t in texts.items():
    if n in changed:(native/n).write_text(t,encoding='utf-8',newline='\r\n')
    else:shutil.copyfile(source/n,native/n)
shutil.copyfile(here/'TaskbarTiming.cs',native/'TaskbarTiming.cs')
assert {n for n in baseline['files'] if sha(native/n)!=sha(source/n)}==set(changed)
patch=''.join(''.join(difflib.unified_diff(base[n].splitlines(True),texts[n].splitlines(True),fromfile='rc54/'+n,tofile='timing/'+n)) for n in changed)
(out/'native.patch').write_text(patch,encoding='utf-8')
receipt={'baseline':str(source.relative_to(root)),'rc54FactoryDelay':0,'changedExistingFiles':changed,
 'newFiles':['TaskbarTiming.cs'],'inputHashes':baseline['files'],
 'outputHashes':{p.name:sha(p) for p in native.iterdir()},'patchSha256':sha(out/'native.patch'),
 'recipeHashes':{p.name:sha(p) for p in here.iterdir() if p.is_file()}}
(out/'source-receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps({'native':str(native),'changed':changed,'new':['TaskbarTiming.cs']}))
