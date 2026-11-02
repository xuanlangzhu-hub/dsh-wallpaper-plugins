"""Materialize a hash-pinned isolated native tree. Never edit installed/shared assets."""
import argparse
import difflib
import hashlib
import json
from pathlib import Path
import shutil

here = Path(__file__).resolve().parent
root = here.parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--baseline', action='store_true', help='Build unpatched red-test control')
args = parser.parse_args()
output = Path(args.output).resolve()
scratch = (root / '.tmp').resolve()
if not output.is_relative_to(scratch) or output == scratch:
    raise SystemExit('output must be a NEW directory below workspace .tmp')
baseline = json.loads((here / 'baseline.json').read_text(encoding='utf-8'))
source = root / baseline['source']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest().upper()
for name, expected in baseline['files'].items():
    if sha(source / name) != expected:
        raise SystemExit('frozen baseline drift: ' + name)
output.mkdir(exist_ok=False)
native = output / 'native-source'
native.mkdir()
for name in baseline['files']:
    shutil.copyfile(source / name, native / name)
runtime = native / 'TaskbarHideRuntime.cs'
original = runtime.read_text(encoding='utf-8')
anchor = '            MinSeconds: 10);'
replacement = ('            // The historical delay supplied a before/after baseline for the C1 experiment.\n'
               '            // Production keeps the encoded/published-frame gate without that observation delay.\n'
               '            MinSeconds: 0);')
if original.count(anchor) != 1:
    raise SystemExit('ambiguous production factory anchor')
patched = original.replace(anchor, replacement)
# Pin the reviewed patch itself, rather than silently permitting a different transformation.
expected_patch = ''.join(difflib.unified_diff(original.splitlines(True), patched.splitlines(True),
    fromfile='rc39/TaskbarHideRuntime.cs', tofile='first-published-frame/TaskbarHideRuntime.cs', n=0))
declared_patch = (here / 'runtime.patch').read_text(encoding='utf-8')
if declared_patch != expected_patch:
    raise SystemExit('declared patch differs from generated source diff')
if not args.baseline:
    runtime.write_text(patched, encoding='utf-8', newline='\r\n')
changed = [name for name, expected in baseline['files'].items() if sha(native / name) != expected]
if changed != ([] if args.baseline else ['TaskbarHideRuntime.cs']):
    raise SystemExit('unexpected native delta: ' + repr(changed))
replay = output / 'replay'
replay.mkdir()
shutil.copyfile(here / 'Program.cs', replay / 'Program.cs')
replay_names = ['TaskbarHideStrategy.cs', 'TaskbarHideRuntime.cs', 'TaskbarList.cs', 'TaskbarWorker.cs',
                'WindowIdentity.cs', 'SourceWindowHelper.cs', 'AtomicFile.cs']
project = '''<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType><TargetFramework>net10.0-windows</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems><NuGetAudit>false</NuGetAudit>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="Program.cs" />
'''
project += ''.join(f'    <Compile Include="../native-source/{name}" />\n' for name in replay_names)
project += '  </ItemGroup>\n</Project>\n'
(replay / 'Replay.csproj').write_text(project, encoding='utf-8')
receipt = {'baselineControl': args.baseline, 'source': baseline['source'], 'changedNativeFiles': changed,
           'inputSha256': baseline['files'], 'outputSha256': {name: sha(native / name) for name in baseline['files']},
           'patchSha256': sha(here / 'runtime.patch'), 'testSha256': sha(here / 'Program.cs')}
(output / 'source-receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
print(json.dumps({'output': str(output), 'baselineControl': args.baseline, 'changed': changed}))
