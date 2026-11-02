"""Build/audit local rc54 from fixed rc53 + reviewed DLL. No app, npm or network calls."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import tarfile

here = Path(__file__).resolve().parent
root = here.parents[1]
sha = lambda data: hashlib.sha256(data).hexdigest().upper()


def unpack(raw):
    files, modes = {}, {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
        for entry in archive:
            path = PurePosixPath(entry.name)
            if path.is_absolute() or '..' in path.parts or '\\' in entry.name or path.parts[0] != 'package':
                raise ValueError('unsafe archive path: ' + entry.name)
            if entry.isdir():
                continue
            if not entry.isfile() or entry.size > 40_000_000:
                raise ValueError('unsafe archive entry: ' + entry.name)
            name = path.relative_to('package').as_posix()
            if name in files:
                raise ValueError('duplicate archive entry: ' + name)
            files[name] = archive.extractfile(entry).read()
            modes[name] = entry.mode
    return files, modes


def pack(files, modes):
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.USTAR_FORMAT) as archive:
            for name, data in sorted(files.items()):
                entry = tarfile.TarInfo('package/' + name)
                entry.size = len(data)
                entry.mode = modes[name]
                entry.mtime = 0
                entry.uid = entry.gid = 0
                entry.uname = entry.gname = ''
                archive.addfile(entry, io.BytesIO(data))
    return buffer.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    out = args.output.resolve()
    scratch = (root / '.tmp').resolve()
    if not out.is_relative_to(scratch) or out == scratch:
        raise ValueError('use a NEW directory inside workspace .tmp')
    if out.exists():
        raise FileExistsError(out)
    base_manifest = json.loads((here.parent / 'rc53/package-manifest.json').read_bytes())
    base_path = root / '.tmp/rc53-gallery-author-candidate-20261028-a/dsh-whale-mist-0.6.0-rc.53.tgz'
    raw = base_path.read_bytes()
    assert sha(raw) == base_manifest['archiveSha256'] and len(raw) == base_manifest['archiveBytes']
    baseline, modes = unpack(raw)
    assert len(baseline) == len(base_manifest['files']) == 43
    for item in base_manifest['files']:
        assert sha(baseline[item['file']]) == item['sha256'] and len(baseline[item['file']]) == item['bytes']

    qa = root / 'dsh-whale-mist/qa/taskbar-first-frame'
    plan = json.loads((qa / 'integration-plan.json').read_bytes())
    preflight_dir = root / '.tmp/taskbar-first-frame-integration-20261028-c'
    preflight = json.loads((preflight_dir / 'result.json').read_bytes())
    closeout = json.loads((preflight_dir / 'closeout-integrity.json').read_bytes())
    assert sha((qa / 'integration-plan.json').read_bytes()) == closeout['integrationPlanSha256']
    assert plan['baseArchiveSha256'] == base_manifest['archiveSha256']
    assert preflight['stagingDelta'] == ['assets/wallpaper/WallpaperProbe.dll']
    assert preflight['metadata']['refsEqual'] and preflight['metadata']['apiEqual'] and preflight['metadata']['entryEqual']
    assert preflight['normalizedDependencyGraphsEqual'] and all(preflight['dependencyHashes'].values())
    for name, expected in preflight['qaSha256'].items():
        assert sha((qa / name).read_bytes()) == expected, 'reviewed QA drift: ' + name
    replacement = plan['replacementFiles']['assets/wallpaper/WallpaperProbe.dll']
    dll = (root / replacement['source']).read_bytes()
    assert sha(dll) == replacement['sha256'] == preflight['newDllSha256']
    assert sha(dll) == '6313602FE6CB8E8A80DCB93BE0D3D44EF8E961CCA1B7CC10E8F4F1AD5CCCD37D'

    protected = json.loads((root / '.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json').read_bytes())
    assert all(sha((root / n).read_bytes()) == h for n, h in protected.items()), 'protected input drift'
    files = dict(baseline)
    files['assets/wallpaper/WallpaperProbe.dll'] = dll
    anchor = b'"version": "0.6.0-rc.53"'
    assert files['package.json'].count(anchor) == 1
    files['package.json'] = files['package.json'].replace(anchor, b'"version": "0.6.0-rc.54"')
    old_package, package = json.loads(baseline['package.json']), json.loads(files['package.json'])
    assert package.pop('version') == '0.6.0-rc.54'
    assert old_package.pop('version') == '0.6.0-rc.53' and package == old_package
    assert package['private'] is True and package['engines']['dsh'] == '0.2.1-rc.3'
    assert not any(n in package.get('scripts', {}) for n in ('preinstall','install','postinstall','prepare','prepublishOnly'))
    prefix = (here / 'README-prefix.md').read_text(encoding='utf-8').replace('\r\n','\n').encode('utf-8')
    files['README.md'] = prefix + baseline['README.md']
    changed = sorted(n for n in files if files[n] != baseline[n])
    assert changed == ['README.md','assets/wallpaper/WallpaperProbe.dll','package.json']
    assert len(files) == 43 and files.keys() == baseline.keys()
    # Relative import closure was checked for fixed rc53; exact source bytes must remain unchanged.
    javascript = [n for n in files if n.endswith('.js')]
    assert len(javascript) == 23 and all(files[n] == baseline[n] for n in javascript)
    asset_names = [n for n in files if n.startswith('assets/')]
    assert len(asset_names) == 14
    assert all(files[n] == baseline[n] for n in asset_names if n != 'assets/wallpaper/WallpaperProbe.dll')
    packed = pack(files, modes)
    actual, actual_modes = unpack(packed)
    assert actual == files and actual_modes == modes, 'actual archive content/mode mismatch'
    out.mkdir(parents=True, exist_ok=False)
    filename = 'dsh-whale-mist-0.6.0-rc.54.tgz'
    (out / filename).write_bytes(packed)
    actual_dir = out / 'unpacked'
    for name, data in actual.items():
        target = actual_dir / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    assert all((actual_dir / name).read_bytes() == data for name, data in files.items())
    after_drift = [n for n,h in protected.items() if sha((root/n).read_bytes()) != h]
    manifest = {'version':'0.6.0-rc.54','archiveSha256':sha(packed),'archiveBytes':len(packed),
                'files':[{'file':n,'sha256':sha(data),'bytes':len(data)} for n,data in sorted(actual.items())]}
    (out / 'package-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    result = {'version':'0.6.0-rc.54','archive':filename,'sha256':sha(packed),'bytes':len(packed),
              'files':len(actual),'changedFromRc53':changed,'unchangedFiles':40,'unchangedJavaScript':len(javascript),
              'unchangedAssets':13,'inheritedApphostDepsRuntimeconfig':True,'originalFileModesPreserved':True,
              'manifestOnlyVersionChanged':True,'private':True,'enginesDsh':'0.2.1-rc.3','protectedInputs':len(protected),
              'changedProtectedInputs':after_drift,'sourceArchiveSha256':sha(raw),'replacementDllSha256':sha(dll),
              'recipeSha256':sha(Path(__file__).read_bytes()),'readmePrefixSha256':sha(prefix),
              'preflightReceiptSha256':sha((preflight_dir/'result.json').read_bytes()),
              'nativeRecompiled':False,'installed':False,'published':False,'realApplicationOperations':0,'visualAcceptance':False}
    (out / 'candidate-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))
    assert not after_drift


if __name__ == '__main__':
    main()
