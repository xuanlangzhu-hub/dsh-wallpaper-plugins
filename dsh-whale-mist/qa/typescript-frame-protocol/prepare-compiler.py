"""Fetch one pinned compiler, verify SRI before extracting. No npm/hooks/global install."""
from pathlib import Path,PurePosixPath
import argparse,base64,hashlib,io,json,subprocess,sys,tarfile,time,urllib.request
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--worker',action='store_true',help=argparse.SUPPRESS);a=p.parse_args();out=Path(a.output).resolve()
assert out.is_relative_to(ROOT/'.tmp') and not out.exists()
if not a.worker:
 child=subprocess.Popen([sys.executable,'-X','utf8',__file__,'--output',str(out),'--worker'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000)
 timed=False
 try:data,error=child.communicate(timeout=45)
 except subprocess.TimeoutExpired:timed=True;child.kill();data,error=child.communicate(timeout=3)
 if out.exists():
  (out/'fetch-supervision.json').write_text(json.dumps(dict(pid=child.pid,code=child.returncode,exitConfirmed=child.returncode is not None,timedOut=timed,deadlineSeconds=45),indent=2),encoding='utf-8')
  (out/'fetch.stdout.txt').write_bytes(data);(out/'fetch.stderr.txt').write_bytes(error)
 sys.stdout.buffer.write(data);sys.stderr.buffer.write(error)
 raise SystemExit(1 if timed else child.returncode)
out.mkdir()
lock=json.loads((HERE/'compiler-lock.json').read_bytes());deadline=time.monotonic()+40
def fetch(url,limit):
 assert url in [lock['metadata'],lock['tarball']]
 with urllib.request.urlopen(url,timeout=12) as response:
  assert response.url==url;data=response.read(limit+1)
 assert len(data)<=limit and time.monotonic()<deadline
 return data
meta_bytes=fetch(lock['metadata'],500_000);meta=json.loads(meta_bytes)
assert meta['name']==lock['name'] and meta['version']==lock['version'] and meta['license']==lock['license']
assert all(meta['dist'][k]==lock[k] for k in ['tarball','integrity','shasum'])
raw=fetch(lock['tarball'],10_000_000)
assert 'sha512-'+base64.b64encode(hashlib.sha512(raw).digest()).decode()==lock['integrity']
assert hashlib.sha1(raw).hexdigest()==lock['shasum']
files={};total=0
with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as archive:
 for entry in archive:
  path=PurePosixPath(entry.name)
  assert not path.is_absolute() and path.parts[0]=='package' and '..' not in path.parts and '\\' not in entry.name and ':' not in entry.name
  if entry.isdir():continue
  assert entry.isfile() and entry.size<=12_000_000
  name=path.relative_to('package').as_posix();assert name and name.casefold() not in files
  data=archive.extractfile(entry).read();total+=len(data);assert total<100_000_000
  files[name.casefold()]=(name,data)
package=json.loads(files['package.json'][1]);assert package['name']==lock['name'] and package['version']==lock['version']
manifest={}
for name,data in files.values():
 target=out/'package'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);manifest[name]=hashlib.sha256(data).hexdigest().upper()
(out/'typescript-5.9.3.tgz').write_bytes(raw);(out/'metadata.json').write_bytes(meta_bytes)
receipt=dict(passed=True,version=lock['version'],registry=lock['metadata'],integrity=lock['integrity'],archiveSha256=hashlib.sha256(raw).hexdigest().upper(),files=manifest,packageHooksExecuted=False,globalOrProjectDependencyInstalled=False,elapsedSeconds=time.monotonic()-(deadline-40))
(out/'compiler-receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in receipt.items() if k!='files'}))
