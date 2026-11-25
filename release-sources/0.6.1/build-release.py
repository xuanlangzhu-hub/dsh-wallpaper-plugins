"""Create the npm tarball and Windows release ZIP from the frozen package tree."""
import argparse
import base64
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


HERE = Path(__file__).resolve().parent
PACKAGE = HERE / 'package'
VERSION = '0.6.1'
TGZ_NAME = f'dsh-whale-mist-{VERSION}.tgz'
ZIP_NAME = f'dsh-whale-mist-{VERSION}-windows-x64.zip'


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def package_files():
    manifest = json.loads((PACKAGE / 'package.json').read_bytes())
    names = manifest['files']
    assert manifest['name'] == 'dsh-whale-mist'
    assert manifest['version'] == VERSION and not manifest.get('private')
    assert not manifest.get('scripts')
    assert sorted(names) == names and len(set(names)) == len(names) == 93
    assert all(not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts
               and '\\' not in name and ':' not in name for name in names)
    actual = {f.relative_to(PACKAGE).as_posix() for f in PACKAGE.rglob('*') if f.is_file()}
    assert set(names) == actual, f'Unexpected package files: {actual ^ set(names)}'
    expected = {name: (PACKAGE / name).read_bytes() for name in names}
    for item in json.loads(expected['third-party-inventory.json'])['files']:
        assert sha256(expected[item['file']]) == item['sha256'].lower(), item['file']
    return expected


def verify_tarball(file, expected):
    with tarfile.open(file, 'r:gz') as tar:
        members = tar.getmembers()
        names = [m.name.removeprefix('package/') for m in members]
        assert all(m.isfile() and m.name.startswith('package/') for m in members)
        assert len(set(names)) == len(members) and set(names) == set(expected)
        for member, name in zip(members, names):
            with tar.extractfile(member) as data:
                assert data.read() == expected[name], name


def build(output, node, npm_cli):
    expected = package_files()
    output.mkdir(parents=True)
    command = [node, str(npm_cli), 'pack', str(PACKAGE), '--ignore-scripts', '--json',
               '--pack-destination', str(output)]
    result = subprocess.run(command, cwd=output, capture_output=True, check=True, timeout=45)
    [record] = json.loads(result.stdout)
    assert record['filename'] == TGZ_NAME
    tgz = output / TGZ_NAME
    verify_tarball(tgz, expected)
    packed = tgz.read_bytes()
    digest = sha256(packed)
    manifest = {
        'version': VERSION,
        'archive': TGZ_NAME,
        'archiveBytes': len(packed),
        'sha256': digest,
        'shasum': hashlib.sha1(packed).hexdigest(),
        'integrity': 'sha512-' + base64.b64encode(hashlib.sha512(packed).digest()).decode('ascii'),
        'files': [{'file': name, 'bytes': len(data), 'sha256': sha256(data)}
                  for name, data in expected.items()],
    }
    manifest_bytes = (json.dumps(manifest, indent=2) + '\n').encode('utf8')
    (output / 'package-manifest.json').write_bytes(manifest_bytes)
    outer = {
        TGZ_NAME: packed,
        'INSTALL.md': (HERE / 'INSTALL.md').read_bytes().replace(b'{{TGZ_SHA256}}', digest.encode()),
        'RELEASE_NOTES.md': (HERE / 'RELEASE_NOTES.md').read_bytes(),
        'package-manifest.json': manifest_bytes,
        'LICENSE': expected['LICENSE'],
        'THIRD_PARTY_NOTICES.md': expected['THIRD_PARTY_NOTICES.md'],
    }
    outer.update({name: data for name, data in expected.items() if name.startswith('licenses/')})
    outer['SHA256SUMS'] = ''.join(f'{sha256(data)}  {name}\n' for name, data in sorted(outer.items())).encode()
    bundle = output / ZIP_NAME
    with ZipFile(bundle, 'x', compression=ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(outer.items()):
            member = ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            member.external_attr = 0o100644 << 16
            member.create_system = 3
            z.writestr(member, data, compress_type=ZIP_DEFLATED, compresslevel=9)
    with ZipFile(bundle) as z:
        assert z.testzip() is None and set(z.namelist()) == set(outer)
        assert all(z.read(name) == data for name, data in outer.items())
    zip_digest = sha256(bundle.read_bytes())
    (output / f'{ZIP_NAME}.sha256').write_text(f'{zip_digest}  {ZIP_NAME}\n', encoding='ascii', newline='\n')
    print(json.dumps({'files': len(expected), 'tgzSha256': digest, 'zipSha256': zip_digest}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default=shutil.which('node'), help='Node.js executable')
    parser.add_argument('--npm-cli', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if not args.node:
        parser.error('Node.js executable is required')
    build(args.output.resolve(), args.node, args.npm_cli.resolve(strict=True))
