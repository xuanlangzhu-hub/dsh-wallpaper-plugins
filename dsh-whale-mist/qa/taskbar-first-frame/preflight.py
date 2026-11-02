"""Offline rc53 integration inspection. No package/version/install or native entry execution."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import time
from xml.sax.saxutils import escape

here = Path(__file__).resolve().parent
root = here.parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args()
out = Path(args.output).resolve()
if not out.is_relative_to((root / '.tmp').resolve()) or out == (root / '.tmp').resolve():
    raise SystemExit('use a NEW output under workspace .tmp')
out.mkdir(exist_ok=False)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest().upper()
manifest = json.loads((root / 'release-sources/rc53/package-manifest.json').read_text(encoding='utf-8-sig'))
archive = root / '.tmp/rc53-gallery-author-candidate-20261028-a/dsh-whale-mist-0.6.0-rc.53.tgz'
if sha(archive) != manifest['archiveSha256']:
    raise SystemExit('fixed archive drift')
repair = root / '.tmp/taskbar-first-frame-repair-20261028-c'
receipt = json.loads((repair / 'green/source-receipt.json').read_text())
native = repair / 'green/native-source'
for name, expected in receipt['outputSha256'].items():
    if sha(native / name) != expected:
        raise SystemExit('reviewed repair source drift: ' + name)
build = native / 'bin/Release/net10.0-windows10.0.19041.0'
repair_result = json.loads((repair / 'result.json').read_text())
for name, expected in repair_result['isolatedNativeArtifacts'].items():
    if sha(build / name) != expected:
        raise SystemExit('reviewed native output drift: ' + name)
protected = json.loads((root / '.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json').read_text(encoding='utf-8-sig'))
for name, expected in protected.items():
    if sha(root / name) != expected:
        raise SystemExit('protected input drift: ' + name)

base = out / 'baseline'
base.mkdir()
expected = {x['file']: x['sha256'] for x in manifest['files']}
seen = set()
with tarfile.open(archive, 'r:gz') as tf:
    for member in tf:
        if member.isdir():
            continue
        if not member.isfile() or not member.name.startswith('package/'):
            raise SystemExit('unexpected archive member: ' + member.name)
        name = member.name[len('package/'):]
        if name not in expected or name in seen:
            raise SystemExit('unexpected/duplicate archive path: ' + name)
        data = tf.extractfile(member).read()
        if hashlib.sha256(data).hexdigest().upper() != expected[name]:
            raise SystemExit('archive entry hash mismatch: ' + name)
        target = base / name
        if not target.resolve().is_relative_to(base.resolve()):
            raise SystemExit('archive path escape')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        seen.add(name)
if seen != expected.keys():
    raise SystemExit('incomplete archive')
staging = out / 'staging'
shutil.copytree(base, staging)
shutil.copyfile(build / 'WallpaperProbe.dll', staging / 'assets/wallpaper/WallpaperProbe.dll')
delta = [name for name, h in expected.items() if sha(staging / name) != h]
if delta != ['assets/wallpaper/WallpaperProbe.dll']:
    raise SystemExit('unexpected staged delta: ' + repr(delta))
old_deps = json.loads((base / 'assets/wallpaper/WallpaperProbe.deps.json').read_text())
new_deps = json.loads((build / 'WallpaperProbe.deps.json').read_text())
old_graph = old_deps['targets'][old_deps['runtimeTarget']['name']]
new_graph = new_deps['targets'][new_deps['runtimeTarget']['name']]
if old_graph != new_graph or old_deps['libraries'] != new_deps['libraries']:
    raise SystemExit('dependency graph differs beyond runtime target packaging')
deps = [name for name in expected if name.startswith('assets/wallpaper/') and name.endswith('.dll') and not name.endswith('/WallpaperProbe.dll')]
dependency_hashes = {name: sha(build / Path(name).name) == expected[name] for name in deps}
if len(deps) != 8 or not all(dependency_hashes.values()):
    raise SystemExit('native dependency byte drift')
if b'WallpaperProbe.dll\x00' not in (base / 'assets/wallpaper/WallpaperProbe.exe').read_bytes():
    raise SystemExit('expected managed entry name missing from accepted apphost')

inspector = out / 'inspector'
inspector.mkdir()
shutil.copyfile(here / 'IntegrationProbe.cs', inspector / 'Program.cs')
linked = ['TaskbarHideStrategy.cs','TaskbarHideRuntime.cs','TaskbarList.cs','TaskbarWorker.cs','WindowIdentity.cs',
          'SourceWindowHelper.cs','AtomicFile.cs','CaptureArguments.cs','FramePipe.cs','ProbeJournal.cs']
project = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0-windows</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><EnableDefaultCompileItems>false</EnableDefaultCompileItems><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup><Compile Include="Program.cs"/>'
project += ''.join('<Compile Include="'+escape(str(native / n), {'"':'&quot;'})+'"/>' for n in linked)
project += '</ItemGroup></Project>'
(inspector / 'Inspector.csproj').write_text(project, encoding='utf-8')
commands = []
total_deadline = time.monotonic() + 120
env = dict(os.environ, WM_PREFLIGHT_ROOT=str(out))

def run(label, argv, seconds):
    remaining = total_deadline - time.monotonic()
    if remaining <= 0:
        raise SystemExit('overall preflight deadline exceeded')
    child = subprocess.Popen([str(a) for a in argv], cwd=root, env=env, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    timeout = False
    try:
        stdout, stderr = child.communicate(timeout=min(seconds, remaining))
    except subprocess.TimeoutExpired:
        timeout = True
        child.kill()
        stdout, stderr = child.communicate(timeout=5)
    (out / (label+'.stdout.txt')).write_bytes(stdout)
    (out / (label+'.stderr.txt')).write_bytes(stderr)
    commands.append({'label':label,'pid':child.pid,'code':child.returncode,'timedOut':timeout,'exitConfirmed':child.returncode is not None})
    (out / 'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8')
    if timeout or child.returncode != 0:
        raise SystemExit(label+' failed; inspect preserved logs (do not install)')
    return stdout

dotnet = shutil.which('dotnet')
node = shutil.which('node')
run('inspector-build',[dotnet,'build',inspector/'Inspector.csproj','-c','Release','--disable-build-servers','-p:UseSharedCompilation=false','-p:NuGetAudit=false','--verbosity','quiet'],40)
exe = inspector/'bin/Release/net10.0-windows/Inspector.dll'
native_check = json.loads(run('metadata-protocol',[dotnet,exe,base/'assets/wallpaper/WallpaperProbe.dll',staging/'assets/wallpaper/WallpaperProbe.dll',out/'protocol'],12))
run('fixed-host-protocol',[node,'--test','--test-concurrency=1','--test-timeout=10000',here/'host-preflight.test.mjs'],20)
argv_check = json.loads(run('actual-host-argv',[dotnet,exe,'--parse-host-argv',out/'host-argv.json'],8))
drift = [name for name, h in protected.items() if sha(root/name) != h]
result = {'acceptedFiles':len(expected),'stagingDelta':delta,'dependencyHashes':dependency_hashes,
          'normalizedDependencyGraphsEqual':True,'oldRuntimeTarget':old_deps['runtimeTarget']['name'],'buildRuntimeTarget':new_deps['runtimeTarget']['name'],
          'metadata':json.loads((out/'protocol/metadata.json').read_text()),'pureNativeChecks':native_check['passed'],
          'hostArgvRoundTrips':argv_check['passed'],'protectedInputs':len(protected),'changedProtectedInputs':drift,
          'sourceArchiveSha256':sha(archive),'newDllSha256':sha(staging/'assets/wallpaper/WallpaperProbe.dll'),
          'qaSha256':{p.name:sha(p) for p in here.iterdir() if p.is_file()},
          'nativeEntryExecuted':False,'realWindowShellComCalls':0,'installPackageCreated':False,'visualAcceptance':False}
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
if drift:
    raise SystemExit('protected input drift after checks')
