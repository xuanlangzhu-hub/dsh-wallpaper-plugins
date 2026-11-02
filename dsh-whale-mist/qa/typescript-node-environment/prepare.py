"""Fetch pinned declaration data into .tmp; no npm, hooks, runtime imports or node_modules."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path,PurePosixPath
import argparse,base64,hashlib,io,json,os,shutil,subprocess,tarfile,time,urllib.request
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]


def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest().upper()
def save(path,value):path.write_text(json.dumps(value,indent=2),encoding='utf-8')


def payload(raw,item):
    assert len(raw)<=4_000_000
    assert 'sha512-'+base64.b64encode(hashlib.sha512(raw).digest()).decode()==item['integrity']
    assert hashlib.sha1(raw).hexdigest()==item['shasum']
    files={};roots=set();folded=set();total=0;entry_count=0
    with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as archive:
        for entry in archive:
            entry_count+=1;assert entry_count<=512
            part=PurePosixPath(entry.name)
            assert not part.is_absolute() and '..' not in part.parts and '\\' not in entry.name and ':' not in entry.name
            assert len(part.parts)>=1
            roots.add(part.parts[0]);assert len(roots)==1
            if entry.isdir():continue
            assert entry.isfile() and 0<=entry.size<=4_000_000
            relative=PurePosixPath(*part.parts[1:]).as_posix()
            assert relative not in ['', '.'] and relative.casefold() not in folded
            assert relative.endswith(('.d.ts','.md','.json')) or PurePosixPath(relative).name.upper() in ['LICENSE','LICENCE']
            folded.add(relative.casefold())
            data=archive.extractfile(entry).read();total+=len(data)
            assert len(data)==entry.size and total<=16_000_000 and len(files)<512
            files[relative]=data
    package=json.loads(files['package.json'])
    assert package['name']==item['name'] and package['version']==item['version'] and package['license']==item['license']
    assert package.get('dependencies',{})==item['dependencies']
    assert not package.get('optionalDependencies') and not package.get('peerDependencies')
    # This registry field counts tar entries, including the Node archive's directories.
    assert entry_count==item['fileCount'] and total==item['unpackedSize'], (entry_count,len(files),total)
    return files,next(iter(roots))


def worker(out,lock):
    deadline=time.monotonic()+40
    allowed={i[k] for i in lock['packages'] for k in ['metadata','tarball']}
    def fetch(url,limit):
        assert url in allowed and time.monotonic()<deadline
        with urllib.request.urlopen(url,timeout=8) as response:
            assert response.url==url
            raw=response.read(limit+1)
        assert len(raw)<=limit and time.monotonic()<deadline
        return raw
    receipts={};pending=[]
    for item in lock['packages']:
        meta_raw=fetch(item['metadata'],1_000_000)
        (out/(item['key']+'-metadata.json')).write_bytes(meta_raw)
        meta=json.loads(meta_raw)
        assert all(meta[k]==item[k] for k in ['name','version','license'])
        assert meta.get('dependencies',{})==item['dependencies']
        assert not meta.get('optionalDependencies') and not meta.get('peerDependencies')
        assert all(meta['dist'][k]==item[k] for k in ['tarball','integrity','shasum','fileCount','unpackedSize'])
        raw=fetch(item['tarball'],4_000_000)
        (out/(item['key']+'.tgz')).write_bytes(raw)
        files,prefix=payload(raw,item)
        receipts[item['key']]=dict(name=item['name'],version=item['version'],metadata=item['metadata'],
             metadataSha256=hashlib.sha256(meta_raw).hexdigest().upper(),archiveSha256=hashlib.sha256(raw).hexdigest().upper(),
             archiveRoot=prefix,integrity=item['integrity'],archiveEntryCount=item['fileCount'],fileCount=len(files),
             archiveDirectoryCount=item['fileCount']-len(files),unpackedSize=sum(map(len,files.values())),
             files={name:hashlib.sha256(data).hexdigest().upper() for name,data in files.items()})
        pending.append((item,files))
    for item,files in pending:
        for name,data in files.items():
            target=out/'types'/item['directory']/name
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    receipt=dict(passed=True,target='isolated QA Node24 declarations; host runtime unverified',
         lockSha256=sha(HERE/'lock.json'),packages=receipts,packageHooksExecuted=False,
         projectOrGlobalDependencyInstalled=False,nodeModulesCreated=False,runtimeSourcesChanged=False)
    save(out/'cache-receipt.json',receipt)
    print(json.dumps({k:v for k,v in receipt.items() if k!='packages'}))


def main():
    p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--worker',action='store_true',help=argparse.SUPPRESS)
    a=p.parse_args();out=Path(a.output).resolve()
    assert out.is_relative_to(ROOT/'.tmp')
    lock=read(HERE/'lock.json')
    assert lock['targetMajor']==24 and [x['key'] for x in lock['packages']]==['node','undici']
    assert lock['packages'][0]['dependencies']=={'undici-types':'~'+lock['packages'][1]['version']}
    if a.worker:
        assert out.is_dir() and (out/'parent-intent.json').is_file()
        worker(out,lock);return
    assert not out.exists();out.mkdir()
    before={f.name:sha(f) for f in HERE.iterdir() if f.is_file()}
    frozen=out/'frozen';frozen.mkdir()
    for name in before:shutil.copyfile(HERE/name,frozen/name)
    save(out/'parent-intent.json',dict(purpose='pinned declarations only',qaHashes=before))
    child=subprocess.Popen([sys.executable,'-X','utf8',__file__,'--output',str(out),'--worker'],
          stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000 if os.name=='nt' else 0)
    timed=False;cleanup_error=None
    try:data,error=child.communicate(timeout=45)
    except subprocess.TimeoutExpired:
        timed=True
        try:child.kill()
        except OSError as failure:cleanup_error=type(failure).__name__
        try:data,error=child.communicate(timeout=3)
        except subprocess.TimeoutExpired as failure:
            cleanup_error='exit-or-pipes-unconfirmed';data,error=failure.output or b'',failure.stderr or b'';child.poll()
    unchanged=all(sha(HERE/n)==h for n,h in before.items())
    status=dict(passed=not timed and cleanup_error is None and child.returncode==0 and unchanged,pid=child.pid,
         code=child.returncode,exitConfirmed=child.returncode is not None,timedOut=timed,cleanupError=cleanup_error,
         deadlineSeconds=45,qaInputsUnchanged=unchanged)
    save(out/'prepare-status.json',status)
    (out/'fetch.stdout.txt').write_bytes(data);(out/'fetch.stderr.txt').write_bytes(error)
    sys.stdout.buffer.write(data);sys.stderr.buffer.write(error)
    assert status['passed'],'Inspect retained cache preparation status/output'


if __name__=='__main__':main()
