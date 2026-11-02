"""Bounded offline red/green regression and isolated native compilation; no app execution."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

here = Path(__file__).resolve().parent
root = here.parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args()
out = Path(args.output).resolve()
scratch = (root / '.tmp').resolve()
if not out.is_relative_to(scratch) or out == scratch:
    raise SystemExit('output must be a NEW directory under workspace .tmp')
out.mkdir(exist_ok=False)
dotnet = shutil.which('dotnet')
if not dotnet:
    raise SystemExit('dotnet SDK required')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest().upper()
audit = root / '.tmp/taskbar-postrelease-audit-20261028-a'
protected = json.loads((audit / 'protected-before.json').read_text(encoding='utf-8-sig'))
drift = [name for name, expected in protected.items() if sha(root / name) != expected]
if drift:
    raise SystemExit('protected baseline drift: ' + repr(drift))
results = []
total_deadline = time.monotonic() + 180

def run(label, command, deadline):
    remaining = total_deadline - time.monotonic()
    if remaining <= 0:
        raise SystemExit('overall 180-second deadline reached before ' + label)
    child = subprocess.Popen(command, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    timed_out = False
    try:
        stdout, stderr = child.communicate(timeout=min(deadline, remaining))
    except subprocess.TimeoutExpired:
        timed_out = True
        child.kill()
        stdout, stderr = child.communicate(timeout=5)
    (out / (label + '.stdout.txt')).write_bytes(stdout)
    (out / (label + '.stderr.txt')).write_bytes(stderr)
    result = {'label': label, 'command': [str(c) for c in command], 'pid': child.pid,
              'returnCode': child.returncode, 'timedOut': timed_out, 'exitConfirmed': child.returncode is not None}
    results.append(result)
    (out / 'commands.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    if timed_out:
        raise SystemExit('deadline reached; preserve evidence and review any compiler descendant: ' + label)
    return child.returncode, stdout

def require(code, label):
    if code != 0:
        raise SystemExit(label + ' failed; see retained stdout/stderr')

build_flags = ['-c', 'Release', '--disable-build-servers', '-p:UseSharedCompilation=false',
               '-p:NuGetAudit=false', '--verbosity', 'quiet']
red = out / 'red'
code, _ = run('red-prepare', [sys.executable, here / 'prepare.py', '--baseline', '--output', red], 8)
require(code, 'red preparation')
code, _ = run('red-build', [dotnet, 'build', red / 'replay/Replay.csproj', *build_flags], 40)
require(code, 'red build')
code, data = run('red-test', [dotnet, red / 'replay/bin/Release/net10.0-windows/Replay.dll'], 12)
red_result = json.loads(data)
if code != 1 or red_result['failed'] == 0 or not any(
        'production factory removes' in c['name'] and not c['ok'] for c in red_result['results']):
    raise SystemExit('red control did not expose the original production factory gate')
green = out / 'green'
code, _ = run('green-prepare', [sys.executable, here / 'prepare.py', '--output', green], 8)
require(code, 'green preparation')
code, _ = run('green-build', [dotnet, 'build', green / 'replay/Replay.csproj', *build_flags], 40)
require(code, 'green build')
code, data = run('green-test', [dotnet, green / 'replay/bin/Release/net10.0-windows/Replay.dll'], 12)
require(code, 'green test')
green_result = json.loads(data)
if green_result['failed'] or green_result['count'] != red_result['count']:
    raise SystemExit('red/green test scope mismatch')

# Compile all 18 original native inputs plus the isolated one-file patch. Offline NuGet source
# prevents a slow registry fallback; all SDK/packages must already exist in the local cache.
empty_source = out / 'empty-nuget-source'
empty_source.mkdir()
code, _ = run('native-build', [dotnet, 'build', green / 'native-source/WallpaperProbe.csproj',
                            *build_flags, '--source', empty_source], 45)
require(code, 'isolated full native build')
drift = [name for name, expected in protected.items() if sha(root / name) != expected]
baseline = json.loads((here / 'baseline.json').read_text(encoding='utf-8'))
frozen_drift = [name for name, expected in baseline['files'].items() if sha(root / baseline['source'] / name) != expected]
receipt = {'red': {'count': red_result['count'], 'failed': red_result['failed'],
                   'failures': [c['name'] for c in red_result['results'] if not c['ok']]},
           'green': {'count': green_result['count'], 'failed': green_result['failed']},
           'protectedInputs': len(protected), 'changedProtectedInputs': drift,
           'frozenNativeInputs': len(baseline['files']), 'changedFrozenInputs': frozen_drift,
           'nativeBuildExit': code, 'realWindowShellComCalls': 0, 'realCaptureRuns': 0,
           'productionAssetsChanged': False, 'visualAcceptance': False,
           'overallDeadlineSeconds': 180,
           'qaSha256': {p.name: sha(p) for p in here.iterdir() if p.is_file()},
           'isolatedNativeArtifacts': {p.name: sha(p) for p in (green / 'native-source/bin/Release/net10.0-windows10.0.19041.0').glob('WallpaperProbe.*') if p.is_file()}}
(out / 'result.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
print(json.dumps(receipt, indent=2))
raise SystemExit(1 if drift or frozen_drift else 0)
