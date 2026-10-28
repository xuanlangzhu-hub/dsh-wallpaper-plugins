"""Build a separate npm carrier from the accepted rc.53 tgz. Never publishes/installs."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile


def sha(data):
    return hashlib.sha256(data).hexdigest().upper()


def text(path):
    return path.read_text(encoding='utf-8').replace('\r\n', '\n').encode('utf-8')


def members(data):
    result = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for item in archive:
            path = PurePosixPath(item.name)
            assert not path.is_absolute() and '..' not in path.parts and '\\' not in item.name
            assert path.parts[0] == 'package'
            if item.isdir():
                continue
            assert item.isfile() and item.size < 40_000_000
            name = path.relative_to('package').as_posix()
            assert name not in result
            result[name] = archive.extractfile(item).read()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True, help='New, nonexistent directory')
    parser.add_argument('--node', type=Path, required=True)
    parser.add_argument('--npm-cli', type=Path, required=True)
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    repo = here.parents[1]
    manifest = json.loads((here.parent / 'rc53/package-manifest.json').read_bytes())
    raw = args.archive.read_bytes()
    assert sha(raw) == manifest['archiveSha256'] and len(raw) == manifest['archiveBytes']
    files = members(raw)
    assert len(files) == len(manifest['files']) == 43
    for item in manifest['files']:
        assert sha(files[item['file']]) == item['sha256'] and len(files[item['file']]) == item['bytes']
    expected = dict(files)
    package = json.loads(files['package.json'])
    assert package['name'] == 'dsh-whale-mist' and package['version'] == '0.6.0-rc.53'
    package['version'] = '0.6.0-rc.53.npm.1'
    package['private'] = False
    package.pop('scripts', None)  # The fixed payload has no development scripts or QA tree.
    package['publishConfig'] = {'registry': 'https://registry.npmjs.org/', 'access': 'public', 'tag': 'next'}
    package['repository'] = {'type': 'git', 'url': 'git+https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins.git'}
    package['homepage'] = 'https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins#readme'
    package['bugs'] = {'url': 'https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/issues'}
    package['keywords'] = ['deepseek-harness', 'theme', 'wallpaper-engine']
    package['os'] = ['win32']
    package['cpu'] = ['x64']
    expected['README.md'] = text(here / 'README-package.md')
    expected['LICENSE'] = text(repo / 'LICENSE')
    expected['THIRD_PARTY_NOTICES.md'] = text(repo / 'THIRD_PARTY_NOTICES.md')
    for name in ['Vortice.Windows-MIT.txt', 'Vortice.Mathematics-MIT.txt',
                 'SharpGenTools-MIT.txt', 'DeepSeek-Harness-MIT.txt',
                 'Windows-SDK-license.rtf', 'Microsoft-components-terms.md']:
        src = repo / 'licenses' / name
        expected['licenses/' + name] = src.read_bytes() if name.endswith('.rtf') else text(src)
    for name in ['third-party-inventory.json', 'license-sources.json']:
        expected[name] = text(here.parent / 'rc53' / name)
    package['files'] = sorted(expected)
    expected['package.json'] = (json.dumps(package, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    assert len(expected) == 53
    args.output.mkdir(parents=True, exist_ok=False)
    stage = args.output / 'package'
    for name, data in expected.items():
        dst = stage / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(data)
    result = subprocess.run([str(args.node), str(args.npm_cli), 'pack', str(stage.resolve()),
                             '--ignore-scripts', '--json', '--pack-destination', str(args.output.resolve())],
                            cwd=args.output.resolve(), capture_output=True, timeout=35)
    (args.output / 'npm-pack.stdout.json').write_bytes(result.stdout)
    (args.output / 'npm-pack.stderr.txt').write_bytes(result.stderr)
    result.check_returncode()
    packed = json.loads(result.stdout)
    assert len(packed) == 1
    archive_path = args.output / packed[0]['filename']
    packed_bytes = archive_path.read_bytes()
    actual = members(packed_bytes)
    assert actual == expected, 'npm pack changed or omitted a payload file'
    changed = sorted(name for name in files if actual[name] != files[name])
    assert changed == ['README.md', 'package.json']
    assert len(set(actual) - set(files)) == 10
    assert all(actual[name] == files[name] for name in files if name not in changed)
    report = {'name': package['name'], 'version': package['version'], 'distTag': 'next',
              'archive': archive_path.name, 'archiveBytes': len(packed_bytes),
              'sha256': sha(packed_bytes), 'shasum': hashlib.sha1(packed_bytes).hexdigest(),
              'integrity': 'sha512-' + base64.b64encode(hashlib.sha512(packed_bytes).digest()).decode(),
              'baseArchiveSha256': sha(raw), 'baseFilesUnchanged': 41,
              'changedBaseFiles': changed, 'addedFiles': sorted(set(actual) - set(files)),
              'fileCount': len(actual), 'published': False,
              'files': [{'file': name, 'bytes': len(data), 'sha256': sha(data)} for name, data in sorted(actual.items())]}
    (args.output / 'package-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (args.output / 'SHA256SUMS').write_text(f'{sha(packed_bytes)}  {archive_path.name}\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'files'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
