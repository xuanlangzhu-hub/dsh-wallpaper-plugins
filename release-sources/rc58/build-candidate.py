"""Build an isolated rc.58 trial from the verified rc.57 UI overlay; no live state."""
from pathlib import Path, PurePosixPath
import argparse, gzip, hashlib, io, json, tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sha = lambda b: hashlib.sha256(b).hexdigest().upper()
read = lambda p: json.loads(p.read_bytes())

def unpack(raw):
    files, modes, seen = {}, {}, set()
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
        for item in archive:
            p = PurePosixPath(item.name)
            assert item.isfile() and p.parts[0] == 'package' and not p.is_absolute()
            assert '..' not in p.parts and '\\' not in item.name and ':' not in item.name and item.size <= 40_000_000
            name = p.relative_to('package').as_posix()
            assert name.casefold() not in seen
            seen.add(name.casefold()); files[name] = archive.extractfile(item).read(); modes[name] = item.mode
    return files, modes

def pack(files, modes):
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode='wb', filename='', mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode='w', format=tarfile.USTAR_FORMAT) as archive:
            for name, data in sorted(files.items()):
                info = tarfile.TarInfo('package/' + name); info.size = len(data); info.mode = modes[name]
                info.mtime = info.uid = info.gid = 0; info.uname = info.gname = ''
                archive.addfile(info, io.BytesIO(data))
    return output.getvalue()

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--output', required=True); args = parser.parse_args()
    out = Path(args.output).resolve(); assert out.is_relative_to(ROOT / '.tmp') and not out.exists()
    source = ROOT / '.tmp/pixso-ui-sdk-integration-20261030-b'
    proof = read(source / 'final-verification.json'); inputs = read(source / 'integration-inputs.json')
    assert proof['passed'] and proof['caseExecutions'] == 102 and proof['protectedSharedInputsUnchanged']
    assert proof['installed'] is False and proof['packaged'] is False
    assert all(sha((ROOT / n).read_bytes()) == h for n, h in read(source / 'protected-before.json').items())
    assert all(sha((source / 'runtime' / n).read_bytes()) == h for n, h in inputs['runtimeHashes'].items())
    assert all(sha((source / 'frozen-qa' / n).read_bytes()) == h for n, h in inputs['frozenQaHashes'].items())
    daily = ROOT / '.tmp/rc57-author-diagnostic-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.57.tgz'
    original, modes = unpack(daily.read_bytes())
    assert sha(daily.read_bytes()) == proof['baseArchiveSha256'] == 'EE286630B7D6F090C8762A7409A9E816BCE31D892EF355D0DEE4CEEE7273D262'
    assert len(original) == 47
    files = {n: (source / 'runtime' / n).read_bytes() for n in inputs['runtimeHashes']}
    before = json.loads(files['package.json']); assert before['version'] == '0.6.0-rc.57'
    assert files['package.json'].count(b'"version": "0.6.0-rc.57"') == 1
    files['package.json'] = files['package.json'].replace(b'"version": "0.6.0-rc.57"', b'"version": "0.6.0-rc.58"')
    after = json.loads(files['package.json']); assert after.pop('version') == '0.6.0-rc.58'; before.pop('version'); assert before == after
    assert after['private'] is True and after['engines']['dsh'] == '0.2.1-rc.3'
    assert not any(n in after.get('scripts', {}) for n in ['preinstall', 'install', 'postinstall', 'prepare', 'prepublishOnly'])
    prefix = (HERE / 'README-prefix.md').read_bytes(); files['README.md'] = prefix + files['README.md']
    old = read(source / 'build.json'); native = (source / 'native-sidebar.mjs').read_bytes()
    assert sha(native) == old['sources']['controller']
    meta = dict(old, payloadVersion='0.6.0-rc.58')
    meta['buildId'] = hashlib.sha256(json.dumps({'version': meta['payloadVersion'], 'sourceBuildId': old['buildId'], 'sources': meta['sources'], 'recipeSha256': sha(Path(__file__).read_bytes()), 'readmePrefixSha256': sha(prefix)}, sort_keys=True).encode()).hexdigest()
    old_literal = json.dumps(old, ensure_ascii=True, separators=(',', ':')).encode(); new_literal = json.dumps(meta, ensure_ascii=True, separators=(',', ':')).encode()
    for n in ['src/client.js', 'src/wallpaper/author-diagnostic-build.js']:
        assert files[n].count(old_literal) == 1; files[n] = files[n].replace(old_literal, new_literal)
    changed = sorted(n for n in files if files[n] != (source / 'runtime' / n).read_bytes())
    assert changed == ['README.md', 'package.json', 'src/client.js', 'src/wallpaper/author-diagnostic-build.js']
    assets = [n for n in files if n.startswith('assets/')]; assert len(assets) == 14 and all(files[n] == original[n] for n in assets)
    raw = pack(files, modes); again, again_modes = unpack(raw); assert again == files and again_modes == modes
    out.mkdir(); name = 'dsh-whale-mist-0.6.0-rc.58.tgz'; (out / name).write_bytes(raw)
    for n, data in files.items():
        target = out / 'unpacked' / n; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
    (out / 'native-sidebar.mjs').write_bytes(native)
    (out / 'build.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
    manifest = {'version': '0.6.0-rc.58', 'archiveSha256': sha(raw), 'archiveBytes': len(raw), 'files': [{'file': n, 'sha256': sha(data), 'bytes': len(data), 'mode': modes[n]} for n, data in sorted(files.items())]}
    (out / 'package-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    audit = {'version': '0.6.0-rc.58', 'archive': name, 'sha256': sha(raw), 'bytes': len(raw), 'files': len(files), 'assetsUnchanged': len(assets), 'sourceIntegration': str(source.relative_to(ROOT)), 'sourceReceiptSha256': sha((source / 'final-verification.json').read_bytes()), 'changedFromSource': changed, 'defaultEnabled': False, 'defaultRollback': '0.6.0-rc.57', 'localTrialOnly': True, 'publicReleaseAuthorized': False, 'installed': False, 'nativeRecompiled': False, 'profileOrAppQueried': False, 'recipeSha256': sha(Path(__file__).read_bytes()), 'readmePrefixSha256': sha(prefix)}
    (out / 'candidate-audit.json').write_text(json.dumps(audit, indent=2), encoding='utf-8'); print(json.dumps(audit))

if __name__ == '__main__': main()
