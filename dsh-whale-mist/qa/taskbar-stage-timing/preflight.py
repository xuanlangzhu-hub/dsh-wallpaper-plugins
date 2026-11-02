"""Fixed rc54 staging with M1 DLL; no native entry, live OS queries, packaging, or install."""
from pathlib import Path
import argparse,hashlib,json,os,shutil,subprocess,tarfile,time
from xml.sax.saxutils import escape

here=Path(__file__).resolve().parent;root=here.parents[2]
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--inventory-only',action='store_true');a=p.parse_args()
out=Path(a.output).resolve();assert out.is_relative_to(root/'.tmp') and not out.exists();out.mkdir()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
manifest=read(root/'release-sources/rc54/package-manifest.json')
archive=root/'.tmp/rc54-taskbar-first-frame-candidate-20261028-b/dsh-whale-mist-0.6.0-rc.54.tgz'
assert sha(archive)==manifest['archiveSha256']=='D9E28918522C3ABFF974465D53604583BAC520806D388EAE773F84BCDAF2F096'
repair=root/'.tmp/taskbar-stage-timing-20261029-b';receipt=read(repair/'isolated/source-receipt.json');built=read(repair/'result.json')
assert built['passed'] and built['tests']=={'stage-timing':{'count':70,'failed':0},'first-frame-regression':{'count':41,'failed':0}}
native=repair/'isolated/native-source';build=native/'bin/Release/net10.0-windows10.0.19041.0'
assert all(sha(native/n)==h for n,h in receipt['outputHashes'].items())
assert all(sha(build/n)==h for n,h in built['nativeArtifacts'].items())
assert sha(build/'WallpaperProbe.dll')=='2C2C1FFEF7D0B491ED4EA68BC63FD60C32D58338DB2E008CD19938EC1EF4BB5F'
protected=read(root/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json')
assert all(sha(root/n)==h for n,h in protected.items())
qa={str(p.relative_to(root)):sha(p) for p in here.iterdir() if p.is_file()}
base=out/'baseline';base.mkdir();expected={r['file']:r['sha256'] for r in manifest['files']};seen=set()
with tarfile.open(archive,'r:gz') as tf:
    for m in tf:
        if m.isdir():continue
        assert m.isfile() and m.name.startswith('package/')
        name=m.name[len('package/'):];assert name in expected and name not in seen
        dest=(base/name).resolve();assert dest.is_relative_to(base)
        data=tf.extractfile(m).read();assert hashlib.sha256(data).hexdigest().upper()==expected[name]
        dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);seen.add(name)
assert set(expected)==seen and len(seen)==43
staging=out/'staging';shutil.copytree(base,staging);shutil.copyfile(build/'WallpaperProbe.dll',staging/'assets/wallpaper/WallpaperProbe.dll')
delta=[n for n,h in expected.items() if sha(staging/n)!=h];assert delta==['assets/wallpaper/WallpaperProbe.dll']
old_deps=read(base/'assets/wallpaper/WallpaperProbe.deps.json');new_deps=read(build/'WallpaperProbe.deps.json')
assert old_deps['targets'][old_deps['runtimeTarget']['name']]==new_deps['targets'][new_deps['runtimeTarget']['name']]
assert old_deps['libraries']==new_deps['libraries']
dependencies=[n for n in expected if n.startswith('assets/wallpaper/') and n.endswith('.dll') and not n.endswith('/WallpaperProbe.dll')]
assert len(dependencies)==8 and all(sha(build/Path(n).name)==expected[n] for n in dependencies)
assert b'WallpaperProbe.dll\x00' in (base/'assets/wallpaper/WallpaperProbe.exe').read_bytes()
deadline=time.monotonic()+120;commands=[];env=dict(os.environ,WM_PREFLIGHT_ROOT=str(out))
def run(label,args,seconds):
    remaining=deadline-time.monotonic();assert remaining>0
    child=subprocess.Popen([str(x) for x in args],cwd=out,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000 if os.name=='nt' else 0)
    timeout=False
    try:data,error=child.communicate(timeout=min(seconds,remaining))
    except subprocess.TimeoutExpired:
        timeout=True
        if child.poll() is None:
            if os.name=='nt':subprocess.run(['taskkill.exe','/PID',str(child.pid),'/T','/F'],capture_output=True,timeout=4,creationflags=0x08000000)
            else:child.kill()
        data,error=child.communicate(timeout=5)
    (out/(label+'.stdout.txt')).write_bytes(data);(out/(label+'.stderr.txt')).write_bytes(error)
    commands.append({'label':label,'pid':child.pid,'code':child.returncode,'timedOut':timeout,'exitConfirmed':child.returncode is not None})
    (out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8')
    assert not timeout and child.returncode==0,(label,'see retained evidence')
    return data
dotnet=shutil.which('dotnet');node=shutil.which('node');assert dotnet and node
flags=['-c','Release','--disable-build-servers','-p:UseSharedCompilation=false','-p:NuGetAudit=false','--verbosity','quiet']
inspector=out/'metadata-inspector';inspector.mkdir();shutil.copyfile(here/'MetadataProbe.cs',inspector/'Program.cs')
(inspector/'Inspector.csproj').write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><NuGetAudit>false</NuGetAudit></PropertyGroup></Project>',encoding='utf-8')
run('metadata-build',[dotnet,'build',inspector/'Inspector.csproj',*flags],35)
run('metadata-inventory',[dotnet,inspector/'bin/Release/net10.0/Inspector.dll',base/'assets/wallpaper/WallpaperProbe.dll',staging/'assets/wallpaper/WallpaperProbe.dll',out/'metadata.json'],15)
metadata=read(out/'metadata.json')
if a.inventory_only:
    print(json.dumps({'inventoryOnly':True,'integrationAccepted':False,'metadata':str(out/'metadata.json'),'commands':commands}));raise SystemExit(0)
allow=read(here/'metadata-allowlist.json')
assert allow['baselineDllSha256']==expected['assets/wallpaper/WallpaperProbe.dll']
assert allow['newDllSha256']==sha(staging/'assets/wallpaper/WallpaperProbe.dll')
assert metadata['oldIdentity']==metadata['newIdentity'] and metadata['oldEntry']==metadata['newEntry'] and metadata['referencesEqual'] and metadata['oldMachine']==metadata['newMachine']=='Amd64'
for field in ['added','removed','changed','bodies']:assert metadata[field]==allow[field],('unexpected metadata delta',field)
for key,values in allow['changedDefinitionValues'].items():assert [metadata['oldDefinitions'].get(key),metadata['newDefinitions'].get(key)]==values,key
for key,values in allow['changedBodyHashes'].items():assert [metadata['oldBodies'][key],metadata['newBodies'][key]]==values,key
assert all(k.startswith('T:TaskbarTiming') for k in metadata['added'] if k.startswith('T:') and 'TaskbarTiming' in k)

protocol=out/'protocol-inspector';protocol.mkdir()
text=(here.parent/'taskbar-first-frame/IntegrationProbe.cs').read_text(encoding='utf-8')
start=text.index('// Inspection uses PEReader,');end=text.index('var checks = new List<object>();')
text=text[:start]+'var output=Path.GetFullPath(args[2]); Directory.CreateDirectory(output);\n'+text[end:]
start=text.index('static Snapshot Inspect(');end=text.index('sealed class Probe(')
text=text[:start]+text[end:]
anchor='confirmed ? Execution.FromResult(new(0,true,"DeleteTab",null)) :'
assert text.count(anchor)==1
text=text.replace(anchor,'confirmed ? Execution.FromWorker(new(new(new(0,true,"DeleteTab",null),new(0,true,"HrInit",null),new(0,true,"DeleteTab",null)),true,true,false,false,false,false,null)) :')
(protocol/'Program.cs').write_text(text,encoding='utf-8')
linked=['TaskbarTiming.cs','TaskbarHideStrategy.cs','TaskbarHideRuntime.cs','TaskbarList.cs','TaskbarWorker.cs','WindowIdentity.cs','SourceWindowHelper.cs','AtomicFile.cs','CaptureArguments.cs','FramePipe.cs','ProbeJournal.cs']
project='<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0-windows</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><EnableDefaultCompileItems>false</EnableDefaultCompileItems><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup><Compile Include="Program.cs"/>'
project+=''.join('<Compile Include="'+escape(str(native/n),{'"':'&quot;'})+'"/>' for n in linked)+'</ItemGroup></Project>'
(protocol/'Inspector.csproj').write_text(project,encoding='utf-8')
run('protocol-build',[dotnet,'build',protocol/'Inspector.csproj',*flags],35)
exe=protocol/'bin/Release/net10.0-windows/Inspector.dll'
samples=json.loads(run('native-protocol',[dotnet,exe,'unused-old','unused-new',out/'protocol'],12))
host=(here.parent/'taskbar-first-frame/host-preflight.test.mjs').read_text(encoding='utf-8')
host=host.replace('    env:disabled?',"    queryProcesses:async()=>({ok:true,processes:[]}),\n    queryProcessIdentity:async()=>({ok:true,startUtc:'2026-10-28T00:00:00Z'}),\n    execCommand:async()=>{throw Error('Unexpected OS command in offline harness');},\n    env:disabled?")
assert 'Unexpected OS command in offline harness' in host
(out/'host-preflight.test.mjs').write_text(host,encoding='utf-8')
shutil.copyfile(here/'sidecar-host.test.mjs',out/'sidecar-host.test.mjs')
run('fixed-host-protocol',[node,'--test','--test-concurrency=1','--test-timeout=10000',out/'host-preflight.test.mjs',out/'sidecar-host.test.mjs'],20)
argv=json.loads(run('host-argv-roundtrip',[dotnet,exe,'--parse-host-argv',out/'host-argv.json'],8))
assert all(sha(root/n)==h for n,h in protected.items()) and all(sha(root/n)==h for n,h in qa.items())
assert all(sha(native/n)==h for n,h in receipt['outputHashes'].items())
assert all(sha(build/n)==h for n,h in built['nativeArtifacts'].items())
staged={n:sha(staging/n) for n in expected};(out/'staging-manifest.json').write_text(json.dumps(staged,indent=2),encoding='utf-8')
result={'passed':True,'acceptedFiles':43,'stagingDelta':delta,'unchangedFiles':42,'dependencyDllsByteIdentical':8,
 'normalizedDependencyGraphEqual':True,'oldApphostDepsRuntimeconfigPreserved':True,'metadataAllowlistMatched':True,
 'metadataCounts':{k:len(metadata[k]) for k in ['added','removed','changed','bodies']},'oldMemberCount':metadata['oldMembers'],'newMemberCount':metadata['newMembers'],
 'nativeProtocolChecks':samples['passed'],'hostArgvRoundTrips':argv['passed'],'protectedInputs':len(protected),
 'protectedSourcesAndM1ArtifactsUnchanged':True,'newDllSha256':sha(staging/'assets/wallpaper/WallpaperProbe.dll'),
 'nativeEntryExecuted':False,'realWorkerComCaptureRuns':0,'liveProcessQueries':0,'installPackageCreated':False,'visualAcceptance':False,
 'qaHashes':qa,'commands':commands,'overallDeadlineSeconds':120}
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
