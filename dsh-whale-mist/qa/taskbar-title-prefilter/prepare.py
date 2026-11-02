"""Materialize pinned M1 inputs; add only two title prefilters, preserving downstream rechecks."""
from pathlib import Path
import argparse, difflib, hashlib, json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()

def prepare(output):
    pins=json.loads((HERE/'baseline.json').read_bytes())
    source=ROOT/pins['source']
    assert all(sha(source/n)==h for n,h in pins['hashes'].items()),'M1 input drift'
    output=Path(output).resolve()
    assert output.is_relative_to(ROOT/'.tmp') and not output.exists()
    native=output/'native-source';native.mkdir(parents=True)
    for n in pins['hashes']: (native/n).write_bytes((source/n).read_bytes())
    p=native/'SourceWindowHelper.cs';old=p.read_bytes();eol=b'\r\n' if b'\r\n' in old else b'\n'
    text=old.decode().replace('\r\n','\n')
    exact='''                using var proc = Process.GetProcessById((int)pid);
                if (!proc.ProcessName.Equals("wallpaper64", StringComparison.OrdinalIgnoreCase)) return true;'''
    prefix='''                        using var proc = Process.GetProcessById((int)pid);
                        if (proc.ProcessName.Equals("wallpaper64", StringComparison.OrdinalIgnoreCase))'''
    assert text.count(exact)==1 and text.count(prefix)==1
    for anchor,indent,predicate in [(exact,16,'Equals(exactTitle, StringComparison.Ordinal)'),
                                     (prefix,24,'StartsWith(prefix, StringComparison.Ordinal)')]:
        pad=' '*indent
        addition='\n'.join(pad+line for line in [
            '// Cheap prefilter only: retain the original process/title/snapshot checks below.',
            'var candidateTitle = new StringBuilder(512);',
            'GetWindowText(hWnd, candidateTitle, candidateTitle.Capacity);',
            f'if (!candidateTitle.ToString().{predicate}) return true;'])+'\n'
        text=text.replace(anchor,addition+anchor,1)
    p.write_bytes(text.replace('\n',eol.decode()).encode())
    hashes={n:sha(native/n) for n in pins['hashes']}
    assert [n for n in hashes if hashes[n]!=pins['hashes'][n]]==['SourceWindowHelper.cs']
    patch=''.join(difflib.unified_diff(old.decode().replace('\r\n','\n').splitlines(True),text.splitlines(True),fromfile='M1/SourceWindowHelper.cs',tofile='prefilter/SourceWindowHelper.cs'))
    (output/'native.patch').write_text(patch,encoding='utf-8',newline='\n')
    receipt={'baseline':pins['source'],'inputHashes':pins['hashes'],'outputHashes':hashes,
             'changedFiles':['SourceWindowHelper.cs'],'newNativeFiles':[],
             'originalRechecksRetained':True,'patchSha256':sha(output/'native.patch')}
    (output/'source-receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    return receipt

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',required=True)
    print(json.dumps(prepare(p.parse_args().output),indent=2))
