from pathlib import Path
import importlib.util,json,tempfile
spec=importlib.util.spec_from_file_location('stage_evidence',Path(__file__).with_name('collect-stage-evidence.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
identity={'hwnd':42,'pid':7,'startUtc':'2026-10-29T00:00:00.1234567Z'}
loc='WhaleWallpaperProbe-261029000000-f001'
def payload(role='shell-worker',**patch):
    d={'purpose':m.PURPOSE,'role':role,'location':loc,'targetHwnd':42,'targetPid':7,'targetStartUtc':'2026-10-29T00:00:00.1234567+00:00',
       'clockId':role+'-pid-99','originTimestamp':'100','frequency':1000,'clockInvalid':False,'truncated':False,
       'events':[{'stage':'delete-tab-begin','elapsedMs':1},{'stage':'delete-tab-returned','elapsedMs':3}]}
    d.update(patch);return json.dumps(d).encode()
checks=[]
def check(name,ok):assert ok,name;checks.append(name)
t=m.timing(payload(),'shell-worker',identity,loc);check('same clock only: observed DeleteTab span',t['durationsMs']['deleteTab']==2)
check('missing stage remains null',t['durationsMs']['hrInit'] is None)
check('missing diagnostic unknown',m.timing(None,'shell-worker',identity,loc)['state']=='unknown')
check('malformed diagnostic unknown',m.timing(b'{','shell-worker',identity,loc)['state']=='unknown')
check('foreign target refused',m.timing(payload(targetPid=8),'shell-worker',identity,loc)['state']=='unknown')
check('foreign 100ns start identity refused',m.timing(payload(targetStartUtc='2026-10-29T00:00:00.1234568Z'),'shell-worker',identity,loc)['state']=='unknown')
check('invalid clock suppresses spans',m.timing(payload(clockInvalid=True),'shell-worker',identity,loc)['durationsMs']['deleteTab'] is None)
check('wrong clock role refused',m.timing(payload(),'capture-parent',identity,loc)['state']=='unknown')
check('negative timing refused',m.timing(payload(events=[{'stage':'delete-tab-begin','elapsedMs':-1}]),'shell-worker',identity,loc)['state']=='unknown')
with tempfile.TemporaryDirectory(prefix='stage-evidence-',dir=Path(__file__).resolve().parents[2]/'.tmp') as tmp:
    root=Path(tmp).resolve();assert root.is_relative_to(Path(__file__).resolve().parents[2]/'.tmp') and not root.is_symlink() and not root.is_junction()
    logs=root/'logs';logs.mkdir();source=logs/'2026-10-29T000000-one';source.mkdir()
    summary={'ownedLocation':loc,'windowClose':{'hwnd':42,'pid':7}}
    for name,data in {'summary.json':summary,'taskbar-action.json':{'location':loc,'requestedIdentity':identity},
                      'frames.jsonl':{},'preview-final.json':{},'preview-status.json':{},'status.json':{}}.items():
        (source/name).write_text(json.dumps(data),encoding='utf-8')
    (source/'taskbar-worker-timing.json').write_bytes(payload())
    playing={'session':{'location':loc,'pid':7},'childPid':55,'hwnd':42}
    cleanup={'passed':True,'active':False,'sessionAbsent':True,'capture':[],'sourceWindows':[],'location':loc,'originalCapturePid':55}
    out=m.collect(logs,playing,cleanup,root/'out');check('current run binds and preserves seven raw files',len(out['rawFiles'])==7 and out['timings']['taskbar-worker-timing.json']['durationsMs']['deleteTab']==2)
    check('missing parent does not become zero',out['timings']['taskbar-parent-timing.json']['durationsMs']['processStart'] is None)
    check('timing does not assert cleanup or visual success','cleanupSafe' not in out and out['visualDisappearanceTime'] is None)
    try:m.collect(logs,{**playing,'hwnd':43},cleanup,root/'wrong')
    except AssertionError:check('foreign window cannot collect',not (root/'wrong').exists())
    else:raise AssertionError('foreign window accepted')
print(json.dumps({'passed':True,'checks':len(checks),'cases':checks,'realApplicationOrNativeLogsRead':False}))
