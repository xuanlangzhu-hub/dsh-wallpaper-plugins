"""Wrap the exact accepted tgz; never builds or installs the plugin. Python 3 stdlib."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import tarfile
import zipfile


def sha(data):
    return hashlib.sha256(data).hexdigest().upper()


def text_bytes(path):
    # Match Git's canonical text across Windows CRLF and LF checkouts.
    return path.read_text(encoding='utf-8').replace('\r\n', '\n').encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path,
                        help='New directory; must not already exist')
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    repo = here.parents[1]
    manifest_bytes = text_bytes(here / 'package-manifest.json')
    manifest = json.loads(manifest_bytes)
    archive = args.archive.read_bytes()
    assert len(archive) == manifest['archiveBytes']
    assert sha(archive) == manifest['archiveSha256'], 'Accepted tgz hash mismatch'
    expected = {item['file']: item for item in manifest['files']}
    assert len(expected) == 43
    found = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
        for member in tar:
            path = PurePosixPath(member.name)
            assert not path.is_absolute() and '..' not in path.parts
            assert '\\' not in member.name and path.parts[0] == 'package'
            if member.isdir():
                continue
            assert member.isfile(), 'Links and special files are forbidden'
            name = path.relative_to('package').as_posix()
            assert name in expected and name not in found, name
            item = expected[name]
            assert member.size == item['bytes']
            data = tar.extractfile(member).read()
            assert sha(data) == item['sha256'], name
            found[name] = data
    assert set(found) == set(expected)
    package = json.loads(found['package.json'])
    assert package['version'] == '0.6.0-rc.53' and package['private'] is True
    inventory_bytes = text_bytes(here / 'third-party-inventory.json')
    inventory = json.loads(inventory_bytes)
    assert len(inventory['files']) == 8
    for item in inventory['files']:
        assert sha(found[item['file']]) == item['sha256']
        assert item['unmodified'] is True
    tgz_name = 'dsh-whale-mist-0.6.0-rc.53.tgz'
    files = {tgz_name: archive, 'INSTALL.md': text_bytes(here / 'INSTALL.md'),
             'LICENSE': text_bytes(repo / 'LICENSE'),
             'THIRD_PARTY_NOTICES.md': text_bytes(repo / 'THIRD_PARTY_NOTICES.md'),
             'package-manifest.json': manifest_bytes,
             'third-party-inventory.json': inventory_bytes,
             'license-sources.json': text_bytes(here / 'license-sources.json')}
    license_names = ['Vortice.Windows-MIT.txt', 'Vortice.Mathematics-MIT.txt',
                     'SharpGenTools-MIT.txt', 'DeepSeek-Harness-MIT.txt',
                     'Windows-SDK-license.rtf', 'Microsoft-components-terms.md']
    for name in license_names:
        source = repo / 'licenses' / name
        files['licenses/' + name] = source.read_bytes() if name.endswith('.rtf') else text_bytes(source)
    assert sha(files['licenses/Windows-SDK-license.rtf']) == (
        'DD07EB178E00C6BBA4148457FC00FF77CD4887EB521D504186FE59C9EC8BBE62')
    files['SHA256SUMS'] = ''.join(
        f'{sha(data)}  {name}\n' for name, data in sorted(files.items())).encode('utf-8')
    # Fail if the directory exists: old candidates/evidence are never overwritten.
    args.output.mkdir(parents=True, exist_ok=False)
    zip_name = 'dsh-whale-mist-0.6.0-rc.53-windows-x64.zip'
    output = args.output / zip_name
    with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED,
                         compresslevel=9) as bundle:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            info.create_system = 3
            bundle.writestr(info, data, compresslevel=9)
    with zipfile.ZipFile(output) as bundle:
        assert bundle.testzip() is None
        assert sorted(bundle.namelist()) == sorted(files)
        for name, data in files.items():
            assert bundle.read(name) == data, name
        assert sha(bundle.read(tgz_name)) == manifest['archiveSha256']
    zip_sha = sha(output.read_bytes())
    (args.output / (zip_name + '.sha256')).write_text(
        f'{zip_sha}  {zip_name}\n', encoding='utf-8', newline='\n')
    result = {'version': package['version'], 'bundle': zip_name,
              'bundleSha256': zip_sha, 'bundleBytes': output.stat().st_size,
              'bundleEntries': len(files), 'tgzSha256': manifest['archiveSha256'],
              'verifiedPayloadFiles': len(found), 'verifiedThirdPartyDlls': 8,
              'sourceSnapshotCommit': '27d61ef21f9c71b02c624699d13c6cb5b753e620',
              'published': False, 'publicReleaseReady': False,
              'materialsPrepared': True, 'iconAttributionIncluded': True,
              'pending': ['User decision to publish GitHub prerelease']}
    (args.output / 'audit.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
