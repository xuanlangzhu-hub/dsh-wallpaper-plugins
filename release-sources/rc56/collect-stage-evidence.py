"""Collect only the current stopped run; timing files are optional diagnostics, never cleanup proof."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,math,re

PURPOSE='taskbar-stage-timing-not-termination-proof'
PARENT_PAIRS={'scheduleToExecutor':['action-scheduled','executor-entered'],
 'workerStart':['worker-start-begin','worker-start-returned'],'processStart':['process-start-begin','process-start-returned'],
 'jobCreate':['job-create-begin','job-create-returned'],'jobAssign':['job-assign-begin','job-assign-returned'],
 'waitForWorkerExit':['worker-start-returned','exit-observed'],'resultRead':['result-read-begin','result-read-returned']}
WORKER_PAIRS={'desktopCheck':['entry-before-desktop','desktop-returned'],
 'entryToAuthorization':['worker-entry-core','supervision-authorized'],'verifyBefore':['verify-before-begin','verify-before-returned'],
 'comCreate':['com-create-begin','com-create-returned'],'hrInit':['hr-init-begin','hr-init-returned'],
 'verifyAfter':['verify-after-begin','verify-after-returned'],'deleteTab':['delete-tab-begin','delete-tab-returned'],
 'comRelease':['com-release-begin','com-release-returned']}

def utc_ticks(value):
    m=re.fullmatch(r'(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,7}))?(Z|[+-]\d\d:\d\d)',value)
    if not m:raise ValueError('timestamp must include timezone, preserving up to 100ns precision')
    return datetime.fromisoformat(m[1]+m[3].replace('Z','+00:00')).astimezone(timezone.utc),(m[2] or '').ljust(7,'0')

def timing(raw,role,identity,location):
    pairs=PARENT_PAIRS if role=='capture-parent' else WORKER_PAIRS
    unknown={'state':'unknown','reason':'missing','durationsMs':{k:None for k in pairs}}
    if raw is None:return unknown
    try:
        d=json.loads(raw);assert isinstance(d,dict) and d.get('purpose')==PURPOSE and d.get('role')==role
        assert d.get('location')==location and type(d.get('targetHwnd')) is int and d['targetHwnd']==identity['hwnd']
        assert type(d.get('targetPid')) is int and d['targetPid']==identity['pid']
        assert utc_ticks(d['targetStartUtc'])==utc_ticks(identity['startUtc'])
        assert re.fullmatch(re.escape(role)+r'-pid-\d+',d['clockId'])
        assert isinstance(d['originTimestamp'],str) and re.fullmatch(r'-?\d{1,24}',d['originTimestamp'])
        assert type(d['frequency']) is int and d['frequency']>0
        assert type(d['clockInvalid']) is bool and type(d['truncated']) is bool
        events=d['events'];assert isinstance(events,list) and len(events)<=64
        found={};previous=-1
        for event in events:
            assert isinstance(event,dict) and re.fullmatch(r'[a-z-]{1,64}',event['stage'])
            assert event['stage'] not in found
            value=event['elapsedMs'];assert value is None or (type(value) in (int,float) and math.isfinite(value) and value>=previous and value>=0)
            if value is not None:previous=value
            elif not d['clockInvalid']:raise ValueError('missing elapsed without invalid-clock flag')
            found[event['stage']]=value
        durations={}
        for name,(start,end) in pairs.items():
            a,b=found.get(start),found.get(end)
            durations[name]=round(b-a,6) if not d['clockInvalid'] and a is not None and b is not None and b>=a else None
        return {'state':'partial' if d['clockInvalid'] or d['truncated'] or any(v is None for v in durations.values()) else 'observed',
                'reason':'clock-invalid' if d['clockInvalid'] else None,'clockId':d['clockId'],'durationsMs':durations,
                'truncated':d['truncated'],'workerPidIndependentlyVerified':False}
    except (ValueError,TypeError,KeyError,AssertionError):
        return {**unknown,'reason':'invalid-or-foreign-diagnostic'}

def read_json(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def collect(log_root,playing,cleanup,destination):
    assert cleanup['passed'] and not cleanup['active'] and cleanup['sessionAbsent'] and not cleanup['capture'] and not cleanup['sourceWindows']
    location=playing['session']['location'];assert cleanup['location']==location and cleanup['originalCapturePid']==playing['childPid']
    stamp=re.fullmatch(r'WhaleWallpaperProbe-(\d{6})(\d{6})-[A-Za-z0-9]{4}',location);assert stamp,'unexpected run location'
    prefix=datetime.strptime(stamp[1],'%y%m%d').strftime('%Y-%m-%dT')+stamp[2]+'-'
    root=Path(log_root).resolve();dest=Path(destination).resolve();assert not dest.exists()
    candidates=[]
    for folder in root.glob(prefix+'*'):
        assert not folder.is_symlink() and not folder.is_junction() and folder.resolve().is_relative_to(root)
        if folder.is_dir() and (folder/'summary.json').is_file():
            summary=read_json(folder/'summary.json')
            if summary.get('ownedLocation')==location:candidates.append((folder,summary))
    assert len(candidates)==1,'ambiguous or missing native run'
    source,summary=candidates[0];action=read_json(source/'taskbar-action.json');identity=action['requestedIdentity']
    assert action['location']==summary['ownedLocation']==location
    assert type(identity['hwnd']) is int and identity['hwnd']==summary['windowClose']['hwnd']==int(playing['hwnd'])
    assert type(identity['pid']) is int and identity['pid']==summary['windowClose']['pid']==playing['session']['pid']
    utc_ticks(identity['startUtc'])
    required=['frames.jsonl','preview-final.json','preview-status.json','status.json','summary.json','taskbar-action.json']
    optional=['taskbar-parent-timing.json','taskbar-worker-timing.json'];data={}
    for name in required+optional:
        file=source/name
        if not file.exists():
            assert name in optional,'required native evidence missing';continue
        assert file.is_file() and not file.is_symlink() and not file.is_junction()
        assert file.stat().st_size<=8_000_000
        data[name]=file.read_bytes()
        assert len(data[name])<=8_000_000 and hashlib.sha256(file.read_bytes()).digest()==hashlib.sha256(data[name]).digest(),'native evidence still changing'
    analyses={}
    for name,role in zip(optional,['capture-parent','shell-worker']):
        analyses[name]=timing(data.get(name),role,identity,location)
    dest.mkdir()
    hashes={}
    for name,raw in data.items():
        with (dest/name).open('xb') as f:f.write(raw)
        hashes[name]=hashlib.sha256(raw).hexdigest().upper()
    return {'purpose':'diagnostic-collection-not-cleanup-authorization','location':location,'capturePid':playing['childPid'],
            'source':str(source),'sourceIdentity':identity,'rawFiles':hashes,'timings':analyses,
            'visualDisappearanceTime':None,'crossProcessElapsedSubtraction':False}

if __name__=='__main__':
    from trial_guard import require_authorization
    config=require_authorization();r=Path(__file__).resolve().parent
    for label in ['snapshotPlaying','verifyLiveCleanup']:
        proof=read_json(r/(label+'-result.json'))
        assert proof['label']==label and proof['passed'] and proof['exitConfirmed'] and proof['code']==0 and not proof['timedOut']
    import os
    result=collect(Path(os.environ['LOCALAPPDATA'])/'Whale Appearance/wallpaper-preview',
                   read_json(r/'playing-status.json'),read_json(r/'live-cleanup-verified.json'),r/'native-run-evidence')
    with (r/'evidence-collection.json').open('x',encoding='utf-8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
    print(json.dumps({'collected':True,'files':len(result['rawFiles']),'timingStates':{n:v['state'] for n,v in result['timings'].items()},'notCleanupProof':True}))
