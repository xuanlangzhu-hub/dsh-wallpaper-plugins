"""Verify the reviewed log annotations at the actual development import path."""
from pathlib import Path
import argparse,base64,hashlib,io,json,os,shutil,subprocess,tarfile,time
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
prior=ROOT/'.tmp/typescript-probe-log-20261030-d';proof=read(prior/'result.json');assert proof['passed'] and proof['isolatedOnly'] and len(proof['typeResults']['negativeCases'])==9
assert all(sha(HERE/n)==h for n,h in proof['qaHashes'].items())
protected=read(prior/'protected-after.json');assert len(protected)==377
name='dsh-whale-mist/src/wallpaper/probe-log.js';source=ROOT/name;candidate=prior/'inputs/probe-log.js';baseline=prior/'inputs/baseline.js'
assert sha(candidate)==proof['candidateSha256'] and sha(baseline)==proof['baselineSha256']==protected[name]
assert source.read_text(encoding='utf-8')==candidate.read_text(encoding='utf-8'),'Development source differs from the reviewed annotations'
assert all(sha(ROOT/n)==h for n,h in protected.items() if n!=name);source_before=sha(source)
compiler=ROOT/'.tmp/typescript-compiler-5.9.3-supervised-20261030-a';lock=read(ROOT/'dsh-whale-mist/qa/typescript-frame-protocol/compiler-lock.json');archive_bytes=(compiler/'typescript-5.9.3.tgz').read_bytes()
assert 'sha512-'+base64.b64encode(hashlib.sha512(archive_bytes).digest()).decode()==lock['integrity']
with tarfile.open(fileobj=io.BytesIO(archive_bytes),mode='r:gz') as archive:
 hashes={e.name.removeprefix('package/'):hashlib.sha256(archive.extractfile(e).read()).hexdigest().upper() for e in archive if e.isfile()}
assert all(sha(compiler/'package'/n)==h for n,h in hashes.items())
frozen=out/'frozen';frozen.mkdir();source_receipts={str(HERE/'check-source.py'):sha(HERE/'check-source.py')}
shutil.copyfile(HERE/'check-source.py',frozen/'check-source.py')
for n,h in proof['qaHashes'].items():
 assert sha(prior/'frozen'/n)==h;shutil.copyfile(prior/'frozen'/n,frozen/n)
rel=os.path.relpath(source,frozen).replace('\\','/');assert rel.startswith('.')
positive=frozen/'positive.ts';positive.write_text((prior/'inputs/positive.ts').read_text(encoding='utf-8').replace('./probe-log.js',rel),encoding='utf-8')
shutil.copyfile(baseline,out/'baseline.js');negatives=[]
for row in read(prior/'inputs.json')['negatives']:
 src=Path(row['file']);dest=frozen/src.name;dest.write_text(src.read_text(encoding='utf-8').replace('./probe-log.js',rel),encoding='utf-8');negatives.append(dict(name=row['name'],file=str(dest),code=row['code']))
(out/'package.json').write_text('{"type":"module"}',encoding='utf-8')
info=dict(module=str(source),baseline=str(out/'baseline.js'),positive=str(positive),negatives=negatives,compilerModule=str(compiler/'package/lib/typescript.js'))
(out/'inputs.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
config=read(prior/'tsconfig.json');config['files']=[str(source),str(positive)];(out/'tsconfig.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
pure=(prior/'existing-pure.test.mjs').read_text(encoding='utf-8');assert pure.count(candidate.as_uri())==1;pure=pure.replace(candidate.as_uri(),source.as_uri());(out/'existing-pure.test.mjs').write_text(pure,encoding='utf-8')
initial={str(f.relative_to(out)):sha(f) for f in out.rglob('*') if f.is_file()};commands=[];deadline=time.monotonic()+65;env=dict(os.environ,PROBE_TYPE_INPUTS=str(out/'inputs.json'));node=shutil.which('node');assert node
def run(label,argv):
 child=subprocess.Popen([str(x) for x in argv],cwd=out,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000);timed=False
 try:data,error=child.communicate(timeout=min(20,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:timed=True;child.kill();data,error=child.communicate(timeout=3)
 commands.append(dict(label=label,pid=child.pid,code=child.returncode,exitConfirmed=child.returncode is not None,timedOut=timed));(out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8');(out/(label+'.stdout.txt')).write_bytes(data);(out/(label+'.stderr.txt')).write_bytes(error)
 assert not timed and child.returncode==0,(label,'inspect retained output');return data.decode('utf-8')
run('syntax',[node,'--check',source]);run('tsc-noemit',[node,compiler/'package/lib/tsc.js','--project',out/'tsconfig.json','--pretty','false','--listFiles'])
added={str(f.relative_to(out)) for f in out.rglob('*') if f.is_file()}-set(initial);assert added=={'commands.json','syntax.stdout.txt','syntax.stderr.txt','tsc-noemit.stdout.txt','tsc-noemit.stderr.txt'},added
run('types-and-ast',[node,frozen/'verify.mjs',out])
for label,files,count in [('existing-pure',[out/'existing-pure.test.mjs'],8),('runtime-equivalence',[frozen/'runtime.test.mjs'],8)]:
 data=run(label,[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=3000',*files]);assert f'# tests {count}' in data and '# fail 0' in data
assert sha(source)==source_before and all(sha(ROOT/n)==h for n,h in protected.items() if n!=name)
assert all(sha(Path(n))==h for n,h in source_receipts.items()) and all(sha(HERE/n)==h for n,h in proof['qaHashes'].items())
assert not list(out.rglob('*.d.ts')) and not list(out.rglob('*.map')) and not list(out.rglob('*.tsbuildinfo'))
result=dict(passed=True,checkedActualDevelopmentSource=True,source=str(source),sourceSha256=sha(source),reviewedCandidateSha256=proof['candidateSha256'],normalizedSourceMatchesReviewedCandidate=True,typeResults=read(out/'type-results.json'),runtimeTests=16,compilerEmittedFiles=0,unchangedPriorInputs=376,sourceReceipts=source_receipts,commands=commands,sourceWrittenByCheck=False,nativeOrLiveAppsUsed=False,installedOrPackaged=False)
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['typeResults','sourceReceipts','commands']}))
