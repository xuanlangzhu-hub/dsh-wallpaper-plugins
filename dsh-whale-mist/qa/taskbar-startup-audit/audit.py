"""Offline source/order and retained-evidence audit. Never enumerate live processes/windows."""
from pathlib import Path
from datetime import datetime
import hashlib, json, sys

ROOT=Path(__file__).resolve().parents[3]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))

def run(destination):
    out=Path(destination).resolve()
    assert out.is_relative_to(ROOT/'.tmp') and not out.exists(), 'Fresh workspace .tmp output required'
    pins=read(ROOT/'dsh-whale-mist/qa/taskbar-first-frame/baseline.json')
    old=ROOT/pins['source']
    native=ROOT/'.tmp/taskbar-first-frame-repair-20261028-c/green/native-source'
    protected=read(ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json')
    assert all(sha(ROOT/p)==h for p,h in protected.items())
    source_hashes={}
    old_line='            MinSeconds: 10);'
    new_lines=('            // The historical delay supplied a before/after baseline for the C1 experiment.\n'
               '            // Production keeps the encoded/published-frame gate without that observation delay.\n'
               '            MinSeconds: 0);')
    for name,h in pins['files'].items():
        assert sha(old/name)==h, name
        expected=(old/name).read_text(encoding='utf-8')
        if name=='TaskbarHideRuntime.cs':
            assert expected.count(old_line)==1
            expected=expected.replace(old_line,new_lines)
        assert (native/name).read_text(encoding='utf-8')==expected, name
        source_hashes[str((native/name).relative_to(ROOT))]=sha(native/name)
    host=ROOT/'release-sources/rc53/package/src/wallpaper/session.js'
    manifest=read(ROOT/'release-sources/rc53/package-manifest.json')
    assert sha(host)==next(r['sha256'] for r in manifest['files'] if r['file']=='src/wallpaper/session.js')
    source_hashes[str(host.relative_to(ROOT))]=sha(host)
    facts=[]
    def chain(path,needles,label):
        text=path.read_text(encoding='utf-8');positions=[text.index(n) for n in needles]
        assert positions==sorted(positions),label
        facts.append({'kind':'source-order','label':label,'file':str(path.relative_to(ROOT)),
                      'points':[{'line':text.count('\n',0,i)+1,'anchor':n} for i,n in zip(positions,needles)]})
    chain(host,['windowCreated = true;','const opened = helper(openArgs);','const window = await polls;',
                'const openFailure = await settledWithFailure;','windowStartUtc = startUtc;',
                'child = spawnChild(config.helper, childArgs,'], 'Host acquires visible source before capture process')
    chain(native/'Program.cs',['Native.EnsureDefaultDesktop();','if (args.Length >= 1 && args[0] == "--taskbar-worker")',
                              'taskbarHideRuntime.CaptureInitialState();','var item = Native.CreateItem(hwnd);',
                              'session.StartCapture();','taskbarHideRuntime?.AfterFrame('], 'Native first-frame trigger follows source acquisition and capture setup')
    chain(native/'TaskbarHideStrategy.cs',['public StrategyDecision OnFrameAsync(',
        'if (!frame.Published) return new StrategyDecision','if (frame.ElapsedSeconds < _options.MinSeconds)',
        '_pendingAction = Task.Run(RunActionCore);'], 'Real async trigger preserves published-frame gate')
    chain(native/'TaskbarHideRuntime.cs',['MinSeconds: 0);','runtime._strategy.Execute = targetHwnd =>',
        'var outcome = TaskbarWorker.Run('], 'Zero delay factory still creates worker only through executor')
    chain(native/'TaskbarWorker.cs',['private sealed class RealWorker','var info = new ProcessStartInfo(request.Executable)',
        'if (!_process.Start())','if (!JobObjectContainer.Assign(','_authEvent?.Set();'], 'Child launch precedes job authorization')
    chain(native/'TaskbarList.cs',['public static int RunWorkerEntry(','EventWaitHandle.TryOpenExisting',
        'if (authEvent.WaitOne(10))','trace = RunTrace('], 'Worker entry waits for current parent authorization')
    chain(native/'TaskbarList.cs',['public static CallTrace ExecuteCalls(', 'var before = verify();',
        'calls = factory();','var hr = calls.HrInit();','var check = verify();','hr = calls.DeleteTab(hwnd);'],
        'Verified STA COM order has no per-stage durations')
    opened=(native/'SourceWindowHelper.cs').read_text(encoding='utf-8').split('public static int OpenWallpaper(',1)[1].split('public static bool CloseWallpaper(',1)[0]
    assert '-playInWindow' in opened and '-borderless' in opened
    assert not any(n in opened for n in ['CreateWindowEx','SetWindowLongPtr(','SetParent(','ShowWindow(','DeleteTab('])
    assert "offscreenStart = process.env.WM_WALLPAPER_OFFSCREEN_START !== '0'" in host.read_text(encoding='utf-8')
    facts.append({'kind':'source-boundary','defaultRouteOffscreen':True,'helperCreatesWeWindowIndirectly':True,
                  'openHelperSetsOwnerOrToolStyle':False,'positionIsNotTaskbarEligibility':True})
    runs=[];artifact_hashes={}
    for directory,play in [('rc54-taskbar-first-frame-short-trial-20261028-a','2026-10-28T11:52:41.210Z'),
                           ('rc54-taskbar-visual-short-trial-20261029-a','2026-10-29T01:02:35.501Z')]:
        base=ROOT/'.tmp'/directory
        action_path=base/'native-run-evidence/taskbar-action.json'
        action=read(action_path);summary=read(base/'native-run-evidence/summary.json');p=read(base/'playing-status.json')
        closed=read(base/'closed-out.json');b=read(base/'closed-backup.json')
        assert closed['roundReusable'] is False
        assert action['location']==summary['ownedLocation']==p['session']['location']
        assert action['requestedIdentity']['hwnd']==summary['windowClose']['hwnd']==int(p['hwnd'])
        assert action['requestedIdentity']['pid']==summary['windowClose']['pid']==p['session']['pid']
        first=action['firstFrame'];trigger=action['trigger'];done=action['action']
        assert first['published'] and first['sequence']==trigger['sequence']==1 and trigger['minSeconds']==0
        assert done['exited'] and done['cleanupSafe'] and not done['pending'] and not done['timedOut']
        assert action['beforeIdentity']==action['afterIdentity']
        assert action['beforeIdentity']['visible'] and action['beforeIdentity']['owner']==0
        assert action['beforeIdentity']['exStyle']=='0x00000000'
        assert summary['windowClose']['closed']
        play_ms=datetime.fromisoformat(play.replace('Z','+00:00')).timestamp()*1000
        runs.append({'round':directory,'location':action['location'],'captureFirstSeconds':trigger['elapsedSeconds'],
            'captureCompletedSeconds':done['completedAtSeconds'],
            'reportedTriggerToWorkerCompletionSeconds':round(done['completedAtSeconds']-trigger['elapsedSeconds'],3),
            'reportedClickToFirstFrameWallSeconds':round((first['capturedAt']-play_ms)/1000,3),
            'reportedClickToWorkerCompletionWallSeconds':round((done['completedAtUnixMs']-play_ms)/1000,3),
            'rawTaskbarHidden':action['taskbarHidden'],'sourceVisibleUnownedNormalStyle':True,
            'sourcePidIsOriginalWe':p['session']['pid'] in [w['pid'] for w in b['wallpaper']],
            'framesWhilePending':done['framesWhilePending'],'postActionSequence':done['postActionFrame']['sequence'],
            'exactWindowCreationTimeKnown':False,'actualDeleteTabDurationKnown':False,
            'visualDisappearanceTimeKnown':False})
        for artifact in [action_path,base/'native-run-evidence/summary.json',base/'playing-status.json',base/'closed-out.json',base/'closed-backup.json']:
            artifact_hashes[str(artifact.relative_to(ROOT))]=sha(artifact)
    report={'passed':True,'kind':'offline-source-and-retained-report-audit-not-shell-or-visual-retest',
            'sourceFilesVerified':len(source_hashes),'protectedInputs':len(protected),'facts':facts,'runs':runs,
            'sourceHashes':source_hashes,'artifactHashes':artifact_hashes,
            'windowOrProcessQueries':0,'applicationActions':0,'buildOrInstallActions':0,
            'conclusion':'Existing ordering permits an initial taskbar entry; worker-only speedups cannot guarantee no initial entry. Stage durations remain unknown.'}
    out.mkdir()
    (out/'source-snapshot').mkdir()
    for name in ['Program.cs','SourceWindowHelper.cs','TaskbarHideRuntime.cs','TaskbarHideStrategy.cs','TaskbarWorker.cs','TaskbarList.cs','WindowIdentity.cs']:
        (out/'source-snapshot'/name).write_bytes((native/name).read_bytes())
    (out/'source-snapshot/session.js').write_bytes(host.read_bytes())
    assert all(sha(ROOT/p)==h for p,h in protected.items())
    assert all(sha(ROOT/p)==h for p,h in source_hashes.items())
    assert all(sha(ROOT/p)==h for p,h in artifact_hashes.items())
    with (out/'result.json').open('x',encoding='utf-8') as f:json.dump(report,f,ensure_ascii=False,indent=2)
    print(json.dumps({k:v for k,v in report.items() if k not in ['facts','sourceHashes','artifactHashes']},ensure_ascii=False))

if __name__=='__main__':
    assert len(sys.argv)==2,'Provide a fresh output directory'
    run(sys.argv[1])
