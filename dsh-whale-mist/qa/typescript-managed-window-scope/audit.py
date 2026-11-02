"""Read-only type baseline and source boundary inventory; never execute managed helpers."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import argparse
import hashlib
import shutil

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
QA = ROOT / 'dsh-whale-mist/qa'
sys.path.insert(0, str(QA / 'typescript-check'))
from common import Stages, read, save, sha, verify_compiler, verify_protected
sys.path.insert(0, str(QA / 'typescript-node-environment'))
from prepare import payload

parser = argparse.ArgumentParser()
for name in ['output', 'compiler-root', 'cache', 'protected-manifest']:
    parser.add_argument('--' + name, required=True)
args = parser.parse_args()
out = Path(args.output).resolve()
assert out.is_relative_to(ROOT / '.tmp') and not out.exists()
out.mkdir()
try:
    protected = read(Path(args.protected_manifest).resolve())
    assert len(protected) == 421
    verify_protected(ROOT, protected)
    own = {p.relative_to(ROOT).as_posix(): sha(p) for p in HERE.iterdir() if p.is_file()}
    assert len(own) == 2
    compiler = Path(args.compiler_root).resolve()
    compiler_files = verify_compiler(compiler, read(QA / 'typescript-frame-protocol/compiler-lock.json'))
    cache = Path(args.cache).resolve()
    lock_file = QA / 'typescript-node-environment/lock.json'
    lock = read(lock_file)
    receipt, status = read(cache / 'cache-receipt.json'), read(cache / 'prepare-status.json')
    assert status['passed'] and status['exitConfirmed'] and not status['timedOut']
    assert receipt['passed'] and receipt['lockSha256'] == sha(lock_file)
    watched = {str(cache / n): sha(cache / n) for n in ['cache-receipt.json', 'prepare-status.json']}
    for item in lock['packages']:
        archive = cache / (item['key'] + '.tgz')
        files, _ = payload(archive.read_bytes(), item)
        expected = {n: hashlib.sha256(data).hexdigest().upper() for n, data in files.items()}
        directory = cache / 'types' / item['directory']
        assert expected == receipt['packages'][item['key']]['files']
        verify_protected(directory, expected)
        assert {p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file()} == set(expected)
        watched.update({str(directory / n): h for n, h in expected.items()})
        for p in [archive, cache / (item['key'] + '-metadata.json')]:
            watched[str(p)] = sha(p)
    source = ROOT / 'dsh-whale-mist/src/wallpaper/managed-window.js'
    fixed = ROOT / 'release-sources/rc53/package/src/wallpaper/managed-window.js'
    manifest = ROOT / 'release-sources/rc57/package-manifest.json'
    entry = next(row for row in read(manifest)['files'] if row['file'] == 'src/wallpaper/managed-window.js')
    assert sha(source) == sha(fixed) == entry['sha256']
    candidates = [source, ROOT / 'dsh-whale-mist/src/wallpaper/author-properties-contract.js',
                  ROOT / 'dsh-whale-mist/src/wallpaper/close-fence.js']
    consumers = [ROOT / 'dsh-whale-mist/src/wallpaper/session.js', candidates[1]]
    tests = [QA / 'wallpaper/type-normalization.test.mjs',
             QA / 'wallpaper-preview/tests/lifecycle.test.mjs',
             QA / 'wallpaper-preview/tests/managed-session.e2e.mjs',
             QA / 'wallpaper/close-fence.test.mjs']
    inspected = {p.relative_to(ROOT).as_posix(): sha(p) for p in set(candidates + consumers + tests + [fixed, manifest])}
    frozen = out / 'frozen'
    frozen.mkdir()
    for name in own:
        shutil.copyfile(ROOT / name, frozen / Path(name).name)
    save(out / 'inputs.json', dict(source=str(source), fixed=str(fixed), candidates=list(map(str, candidates)),
         consumers=list(map(str, consumers)), tests=list(map(str, tests)), cache=str(cache),
         compilerModule=str(compiler / 'package/lib/typescript.js')))
    stages = Stages(out, total_seconds=30)
    node = shutil.which('node')
    assert node
    stages.run('read-only-type-scope', [node, frozen / 'audit.mjs', out], stage_seconds=15)
    verify_protected(ROOT, protected)
    verify_protected(ROOT, own)
    verify_protected(ROOT, inspected)
    verify_protected(compiler / 'package', compiler_files)
    assert all(sha(Path(name)) == h for name, h in watched.items())
    assert not any(list(out.rglob(s)) for s in ['*.d.ts', '*.map', '*.tsbuildinfo'])
    save(out / 'protected-after.json', protected | own)
    save(out / 'result.json', dict(passed=True, scopeOnly=True, protectedInputs=421, continuationInputs=423,
         inspectedHashes=inspected, qaHashes=own, cacheFilesVerified=len(watched), commands=stages.commands,
         findings=read(out / 'scope.json'), moduleOrTestsExecuted=False, runtimeSourceChanged=False,
         nativeOrLiveAppsUsed=False, dependenciesInstalled=False))
    print('PASS: managed-window read-only type baseline and source boundaries; no helper/module/test execution')
except Exception as error:
    save(out / 'result.json', dict(passed=False, errorType=type(error).__name__, error=str(error),
         commands=read(out / 'commands.json') if (out / 'commands.json').exists() else []))
    raise
