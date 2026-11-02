"""Promote the accepted rc.61 archive; no source build, installation or publication."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VERSION = '0.6.0'
BASE = '0.6.0-rc.61'


def sha(data):
    return hashlib.sha256(data).hexdigest().upper()


def text(file):
    return file.read_text(encoding='utf-8').replace('\r\n', '\n').encode('utf-8')


def dump(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def unpack(raw):
    files = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
        for row in archive:
            path = PurePosixPath(row.name)
            assert not path.is_absolute() and '..' not in path.parts
            assert '\\' not in row.name and ':' not in row.name and path.parts[0] == 'package'
            if row.isdir():
                continue
            assert row.isfile() and row.size < 40_000_000
            name = path.relative_to('package').as_posix()
            assert name and name.casefold() not in {n.casefold() for n in files}
            files[name] = archive.extractfile(row).read()
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['archive', 'output', 'node', 'npm-cli']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    assert not args.output.exists()
    manifest = json.loads((HERE.parent / 'rc61/package-manifest.json').read_bytes())
    raw = args.archive.read_bytes()
    assert sha(raw) == manifest['archiveSha256'] and len(raw) == manifest['archiveBytes']
    original = unpack(raw)
    expected_hashes = {r['file']: r['sha256'] for r in manifest['files']}
    assert len(original) == 47 and {n: sha(b) for n, b in original.items()} == expected_hashes
    package = json.loads(original['package.json'])
    assert package['name'] == 'dsh-whale-mist' and package['version'] == BASE
    assert package['private'] is True and package['engines']['dsh'] == '0.2.1-rc.3'
    expected = dict(original)
    package.update(version=VERSION, private=False,
                   publishConfig={'registry': 'https://registry.npmjs.org/', 'access': 'public', 'tag': 'latest'},
                   repository={'type': 'git', 'url': 'git+https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins.git'},
                   homepage='https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins#readme',
                   bugs={'url': 'https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/issues'},
                   keywords=['deepseek-harness', 'theme', 'wallpaper-engine'], os=['win32'], cpu=['x64'])
    package.pop('scripts', None)
    expected['README.md'] = text(HERE / 'README-package.md')
    expected['LICENSE'] = text(ROOT / 'LICENSE')
    for name in ['THIRD_PARTY_NOTICES.md', 'third-party-inventory.json', 'license-sources.json']:
        expected[name] = text(HERE / name)
    for name in ['Vortice.Windows-MIT.txt', 'Vortice.Mathematics-MIT.txt', 'SharpGenTools-MIT.txt',
                 'DeepSeek-Harness-MIT.txt', 'Windows-SDK-license.rtf', 'Microsoft-components-terms.md']:
        source = ROOT / 'licenses' / name
        expected['licenses/' + name] = source.read_bytes() if name.endswith('.rtf') else text(source)
    inventory = json.loads(expected['third-party-inventory.json'])
    assert len(inventory['files']) == 8
    for item in inventory['files']:
        assert item['unmodified'] is True and sha(original[item['file']]) == item['sha256']
    assert sha(expected['licenses/Windows-SDK-license.rtf']) == 'DD07EB178E00C6BBA4148457FC00FF77CD4887EB521D504186FE59C9EC8BBE62'
    # Diagnostic identities belong to the unchanged code build, not distribution metadata.
    build = json.loads((HERE.parent / 'rc61/build.json').read_bytes())
    literal = json.dumps(build, ensure_ascii=True, separators=(',', ':')).encode()
    assert all(original[n].count(literal) == 1 for n in ['src/client.js', 'src/wallpaper/author-diagnostic-build.js'])
    provenance = dict(distributionVersion=VERSION, runtimeSourceVersion=BASE,
                      baseArchiveSha256=sha(raw), diagnosticBuild=build,
                      runtimeFilesUnchanged=45, assetsUnchanged=14,
                      changedOriginalFiles=['README.md', 'package.json'],
                      nativeRecompiled=False, runtimeCodeModified=False,
                      compatibility='Windows x64; DeepSeek Harness 0.2.1-rc.3')
    expected['BUILD_PROVENANCE.json'] = dump(provenance)
    package['files'] = sorted(set(expected) | {'package.json'})
    expected['package.json'] = dump(package)
    assert len(expected) == 58
    # The runtime-facing configuration is unchanged apart from distribution fields.
    before = json.loads(original['package.json'])
    distribution = {'version', 'private', 'scripts', 'files', 'publishConfig', 'repository',
                    'homepage', 'bugs', 'keywords', 'os', 'cpu'}
    assert {k: v for k, v in package.items() if k not in distribution} == {
        k: v for k, v in before.items() if k not in distribution}
    args.output.mkdir(parents=True, exist_ok=False)
    stage = args.output / 'package'
    for name, data in expected.items():
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    command = [str(args.node), str(args.npm_cli), 'pack', str(stage.resolve()), '--ignore-scripts',
               '--json', '--pack-destination', str(args.output.resolve())]
    child = subprocess.run(command, cwd=args.output.resolve(), capture_output=True, timeout=35)
    (args.output / 'npm-pack.stdout.json').write_bytes(child.stdout)
    (args.output / 'npm-pack.stderr.txt').write_bytes(child.stderr)
    child.check_returncode()
    result = json.loads(child.stdout)
    assert len(result) == 1
    tgz_name = f'dsh-whale-mist-{VERSION}.tgz'
    assert result[0]['filename'] == tgz_name
    packed = (args.output / tgz_name).read_bytes()
    actual = unpack(packed)
    assert actual == expected
    changed = sorted(n for n in original if actual[n] != original[n])
    assert changed == ['README.md', 'package.json']
    assert all(actual[n] == original[n] for n in original if n not in changed)
    payload = dict(version=VERSION, archive=tgz_name, archiveBytes=len(packed), sha256=sha(packed),
                   shasum=hashlib.sha1(packed).hexdigest(),
                   integrity='sha512-' + base64.b64encode(hashlib.sha512(packed).digest()).decode(),
                   baseArchiveSha256=sha(raw), originalFilesUnchanged=45,
                   originalFilesChanged=changed, addedFiles=sorted(set(actual) - set(original)),
                   files=[dict(file=n, bytes=len(b), sha256=sha(b)) for n, b in sorted(actual.items())])
    (args.output / 'package-manifest.json').write_bytes(dump(payload))
    install = text(HERE / 'INSTALL.md').replace(b'{{TGZ_SHA256}}', sha(packed).encode())
    outer = {tgz_name: packed, 'INSTALL.md': install, 'package-manifest.json': dump(payload),
             'LICENSE': expected['LICENSE'], 'THIRD_PARTY_NOTICES.md': expected['THIRD_PARTY_NOTICES.md']}
    outer.update({n: b for n, b in expected.items() if n.startswith('licenses/')})
    outer['SHA256SUMS'] = ''.join(f'{sha(b)}  {n}\n' for n, b in sorted(outer.items())).encode()
    zip_name = f'dsh-whale-mist-{VERSION}-windows-x64.zip'
    with zipfile.ZipFile(args.output / zip_name, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(outer.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            info.create_system = 3
            z.writestr(info, data, compresslevel=9)
    with zipfile.ZipFile(args.output / zip_name) as z:
        assert z.testzip() is None and set(z.namelist()) == set(outer)
        assert all(z.read(n) == b for n, b in outer.items())
    zip_bytes = (args.output / zip_name).read_bytes()
    (args.output / (zip_name + '.sha256')).write_bytes(f'{sha(zip_bytes)}  {zip_name}\n'.encode())
    audit = dict(version=VERSION, baseVersion=BASE, packageFiles=58, unchangedRuntimeFiles=45,
                 unchangedAssets=14, npmArchive=tgz_name, npmBytes=len(packed), npmSha256=sha(packed),
                 zip=zip_name, zipBytes=len(zip_bytes), zipSha256=sha(zip_bytes),
                 published=False, installed=False, diagnosticCodeBuildRetained=True)
    (args.output / 'audit.json').write_bytes(dump(audit))
    print(json.dumps(audit, indent=2))


if __name__ == '__main__':
    main()
