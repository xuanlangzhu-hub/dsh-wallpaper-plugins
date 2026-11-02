"""Bounded isolated diagnostic build/regressions. Does not execute WallpaperProbe or live IO."""
from pathlib import Path
import argparse,ast,hashlib,json,os,shutil,subprocess,sys,time

here=Path(__file__).resolve().parent;root=here.parents[2]
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args()
out=Path(a.output).resolve();assert out.is_relative_to(root/'.tmp') and not out.exists()
out.mkdir();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
protected=json.loads((root/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json').read_bytes())
assert all(sha(root/n)==h for n,h in protected.items())
qa={str(p.relative_to(root)):sha(p) for p in here.iterdir() if p.is_file()}
archives={'.tmp/rc54-taskbar-first-frame-candidate-20261028-b/dsh-whale-mist-0.6.0-rc.54.tgz':'D9E28918522C3ABFF974465D53604583BAC520806D388EAE773F84BCDAF2F096',
          '.tmp/rc53-gallery-author-candidate-20261028-a/dsh-whale-mist-0.6.0-rc.53.tgz':'8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA'}
assert all(sha(root/n)==h for n,h in archives.items())
deadline=time.monotonic()+180;commands=[]
def run(label,args,limit):
    left=deadline-time.monotonic();assert left>0,'total deadline exhausted'
    child=subprocess.Popen([str(x) for x in args],cwd=out,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000 if os.name=='nt' else 0)
    timed=False
    try:data,error=child.communicate(timeout=min(left,limit))
    except subprocess.TimeoutExpired:
        timed=True
        if child.poll() is None:
            if os.name=='nt':subprocess.run(['taskkill.exe','/PID',str(child.pid),'/T','/F'],capture_output=True,timeout=4,creationflags=0x08000000)
            else:child.kill()
        data,error=child.communicate(timeout=5)
    (out/(label+'.stdout.txt')).write_bytes(data);(out/(label+'.stderr.txt')).write_bytes(error)
    commands.append({'label':label,'pid':child.pid,'code':child.returncode,'exitConfirmed':child.returncode is not None,'timedOut':timed})
    (out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8')
    assert not timed and child.returncode==0,(label,'see retained stdout/stderr')
    return data

run('prepare',[sys.executable,'-X','utf8',here/'prepare.py','--output',out/'isolated'],8)
native=out/'isolated/native-source';receipt=json.loads((out/'isolated/source-receipt.json').read_bytes())
old=root/receipt['baseline']
assert {n for n in receipt['inputHashes'] if sha(native/n)!=sha(old/n)}==set(receipt['changedExistingFiles']),'unexpected byte delta outside five source edits'
# The real child authorization/parent-loss flow is unchanged; no real parent-process or named-event
# queries are run in this QA. Strip only the listed diagnostic insertions and compare its body.
before=(old/'TaskbarList.cs').read_text(encoding='utf-8')
before=before.split('public static int RunWorkerEntry(',1)[1].split('        CallTrace trace;',1)[1].split('    public static string GetSupervisionAuthEventName',1)[0]
after=(native/'TaskbarList.cs').read_text(encoding='utf-8').split('private static int RunWorkerEntryCore(',1)[1]
after=after.split('        CallTrace trace;',1)[1].split('    public static string GetSupervisionAuthEventName',1)[0]
after=after.replace('        timing?.AllowWrite();\n','').replace('        timing?.Mark("supervision-authorized");\n','')
after=after.replace('new ComAction(verify, parentLostOrStop, timing)','new ComAction(verify, parentLostOrStop)')
assert before==after,'worker authorization flow changed'
worker=(native/'TaskbarWorker.cs').read_text(encoding='utf-8')
assert 'worker.WaitForExit(50)' in worker and 'elapsedMilliseconds() >= request.TimeoutMs' in worker and 'worker.WaitForExit(5000)' in worker
assert 'JobObjectContainer.Assign(_jobHandle, _process.Handle)' in worker and '_authEvent?.Set();' in worker
assert 'public sealed record WorkerOutcome(TaskbarList.CallTrace Trace, bool Started, bool Exited,' in worker
assert 'public sealed record CallTrace(Result Result, Result? HrInit, Result? DeleteTab)' in (native/'TaskbarList.cs').read_text(encoding='utf-8')
project_head='''<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0-windows</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><EnableDefaultCompileItems>false</EnableDefaultCompileItems><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup><Compile Include="Program.cs" />'''
links=['TaskbarTiming.cs','TaskbarHideRuntime.cs','TaskbarHideStrategy.cs','TaskbarWorker.cs','TaskbarList.cs','WindowIdentity.cs','SourceWindowHelper.cs','AtomicFile.cs']
dotnet=shutil.which('dotnet');assert dotnet
flags=['-c','Release','--disable-build-servers','-p:UseSharedCompilation=false','-p:NuGetAudit=false','--verbosity','quiet']
results={}
for label,test in [('stage-timing',here/'Program.cs'),('first-frame-regression',here.parent/'taskbar-first-frame/Program.cs')]:
    d=out/label;d.mkdir();shutil.copyfile(test,d/'Program.cs')
    xml=project_head+''.join(f'<Compile Include="../isolated/native-source/{name}" />' for name in links)+'</ItemGroup></Project>'
    (d/'Replay.csproj').write_text(xml,encoding='utf-8')
    run(label+'-build',[dotnet,'build',d/'Replay.csproj',*flags],40)
    result=json.loads(run(label+'-tests',[dotnet,d/'bin/Release/net10.0-windows/Replay.dll'],12))
    assert result['failed']==0;results[label]=result
empty=out/'empty-nuget-source';empty.mkdir()
run('full-native-build',[dotnet,'build',native/'WallpaperProbe.csproj',*flags,'--source',empty],45)
assert all(sha(root/n)==h for n,h in protected.items())
assert all(sha(root/n)==h for n,h in archives.items())
assert all(sha(root/n)==h for n,h in qa.items())
assert all(sha(old/n)==h for n,h in receipt['inputHashes'].items())
result={'passed':True,'tests':{k:{'count':v['count'],'failed':v['failed']} for k,v in results.items()},
 'changedExistingFiles':receipt['changedExistingFiles'],'newNativeFiles':receipt['newFiles'],
 'workerAuthorizationBodyUnchanged':True,'existingTerminalProtocolRecordsUnchanged':True,
 'sourceFiles':19,'protectedInputs':len(protected),'protectedInputsUnchanged':True,'archivesUnchanged':True,
 'originalNativeInputsUnchanged':True,'qaInputsUnchanged':True,'commands':commands,
 'nativeArtifacts':{p.name:sha(p) for p in (native/'bin/Release/net10.0-windows10.0.19041.0').glob('WallpaperProbe.*') if p.is_file()},
 'realWorkerProcessRuns':0,'realWindowComCaptureRuns':0,'visualAcceptance':False,'totalDeadlineSeconds':180,
 'limits':'Worker entry parent-process/named-event flow checked structurally; native Start/Job operations not executed. Monitor and COM flow use bottom-level IO substitutes.'}
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
