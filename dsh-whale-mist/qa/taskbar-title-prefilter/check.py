"""Bounded red/green bottom-IO replays, existing regressions, compile-only native validation."""
from pathlib import Path
import argparse,hashlib,json,os,shutil,subprocess,sys,time
from prepare import prepare
from io_transform import substitute

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args()
out=Path(args.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists()
out.mkdir();deadline=time.monotonic()+210;commands=[]
protected=json.loads((ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json').read_bytes())
qa={str(p.relative_to(ROOT)):sha(p) for p in HERE.iterdir() if p.is_file()}
pins=json.loads((HERE/'baseline.json').read_bytes());baseline=ROOT/pins['source']
archives={str(p.relative_to(ROOT)):sha(p) for p in [
    ROOT/'.tmp/rc53-gallery-author-candidate-20261028-a/dsh-whale-mist-0.6.0-rc.53.tgz',
    ROOT/'.tmp/rc54-taskbar-first-frame-candidate-20261028-b/dsh-whale-mist-0.6.0-rc.54.tgz',
    ROOT/'.tmp/rc55-taskbar-stage-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.55.tgz']}
assert all(sha(ROOT/n)==h for n,h in protected.items())

def run(label,argv,limit,expected=0):
    left=deadline-time.monotonic();assert left>0,'total deadline exhausted'
    child=subprocess.Popen([str(x) for x in argv],cwd=out,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                           creationflags=0x08000000 if os.name=='nt' else 0)
    timed=False
    try:data,error=child.communicate(timeout=min(left,limit))
    except subprocess.TimeoutExpired:
        timed=True
        if child.poll() is None:
            if os.name=='nt':subprocess.run(['taskkill.exe','/PID',str(child.pid),'/T','/F'],capture_output=True,timeout=4,creationflags=0x08000000)
            else:child.kill()
        data,error=child.communicate(timeout=5)
    (out/(label+'.stdout.txt')).write_bytes(data);(out/(label+'.stderr.txt')).write_bytes(error)
    commands.append({'label':label,'pid':child.pid,'code':child.returncode,'expectedCode':expected,
                     'exitConfirmed':child.returncode is not None,'timedOut':timed})
    (out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8')
    assert not timed and child.returncode==expected,(label,'inspect retained output')
    return data

receipt=prepare(out/'isolated');native=out/'isolated/native-source'
dotnet=shutil.which('dotnet');assert dotnet
flags=['-c','Release','--disable-build-servers','-p:UseSharedCompilation=false','-p:NuGetAudit=false','--verbosity','quiet']
head='<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0-windows</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><EnableDefaultCompileItems>false</EnableDefaultCompileItems><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup><Compile Include="Program.cs" />'
def project(d,files):
    (d/'Replay.csproj').write_text(head+''.join(f'<Compile Include="{f}" />' for f in files)+'</ItemGroup></Project>',encoding='utf-8')
    run(d.name+'-build',[dotnet,'build',d/'Replay.csproj',*flags],40)
    return d/'bin/Release/net10.0-windows/Replay.dll'

results={};replacements={}
for mode,source in [('red',baseline),('green',native)]:
    d=out/mode;d.mkdir();shutil.copyfile(HERE/'Program.cs',d/'Program.cs')
    for n in ['SourceWindowHelper.cs','WindowIdentity.cs']:
        text,names=substitute((source/n).read_text(encoding='utf-8'),identity=n=='WindowIdentity.cs')
        (d/n).write_text(text,encoding='utf-8');replacements[mode+'/'+n]=names
    dll=project(d,['SourceWindowHelper.cs','WindowIdentity.cs'])
    results[mode]=json.loads(run(mode+'-tests',[dotnet,dll],15,expected=1 if mode=='red' else 0))
    if mode=='red':
        assert results[mode]['failed']==3 and all(t['ok'] or t['name'].startswith('optimization:') for t in results[mode]['tests']), 'unexpected baseline failure'
red,green=results['red'],results['green']
assert red['failed']==3 and all(t['ok'] or t['name'].startswith('optimization:') for t in red['tests'])
assert green['failed']==0 and red['stable']==green['stable'],'stable observations changed'
assert green['probeStats']['Enumerations']==red['probeStats']['Enumerations']==3
for n in ['prefixStats','exactStats','probeStats']:
    assert red[n]['UnrelatedReads']>0 and green[n]['UnrelatedReads']==0
(out/'io-replacements.json').write_text(json.dumps(replacements,indent=2),encoding='utf-8')
# Existing state-machine/worker/COM monitor replays still use their original bottom IO substitutes.
links=['TaskbarTiming.cs','TaskbarHideRuntime.cs','TaskbarHideStrategy.cs','TaskbarWorker.cs','TaskbarList.cs','WindowIdentity.cs','SourceWindowHelper.cs','AtomicFile.cs']
for label,test in [('stage-timing',HERE.parent/'taskbar-stage-timing/Program.cs'),('first-frame',HERE.parent/'taskbar-first-frame/Program.cs')]:
    d=out/label;d.mkdir();shutil.copyfile(test,d/'Program.cs')
    dll=project(d,['../isolated/native-source/'+n for n in links])
    results[label]=json.loads(run(label+'-tests',[dotnet,dll],15))
    assert results[label]['failed']==0
empty=out/'empty-nuget-source';empty.mkdir()
run('full-native-build',[dotnet,'build',native/'WallpaperProbe.csproj',*flags,'--source',empty],45)
assert all(sha(ROOT/n)==h for n,h in protected.items())
assert all(sha(ROOT/n)==h for n,h in qa.items())
assert all(sha(ROOT/n)==h for n,h in archives.items())
assert all(sha(baseline/n)==h for n,h in pins['hashes'].items())
assert all(sha(native/n)==h for n,h in receipt['outputHashes'].items())
changed=[n for n,h in pins['hashes'].items() if sha(native/n)!=h]
assert changed==['SourceWindowHelper.cs']
dll=native/'bin/Release/net10.0-windows10.0.19041.0/WallpaperProbe.dll'
summary={'passed':True,'changedFiles':changed,'sourceFiles':19,'nativeDllSha256':sha(dll),
         'tests':{k:{'count':v['count'],'failed':v['failed']} for k,v in results.items()},
         'differentialObservations':len(red['stable']),'stableOutputsEqual':True,
         'queryCounts':{k:{m:results[m][k] for m in ['red','green']} for k in ['prefixStats','exactStats','probeStats']},
         'protectedInputs':len(protected),'protectedUnchanged':True,'qaUnchanged':True,'archivesUnchanged':True,
         'baselineUnchanged':True,'onlyTwoAddedPrefilters':True,'totalDeadlineSeconds':210,'commands':commands,
         'realWindowQueries':0,'realProcessQueries':0,'realComCaptureRuns':0,'installed':False,
         'limit':'IO counts are fixture observations, not elapsed time or taskbar visual acceptance.'}
(out/'result.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
