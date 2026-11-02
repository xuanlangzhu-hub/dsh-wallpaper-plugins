"""Select D2's second module without changing runtime code or running capture tests."""
from pathlib import Path
import argparse,base64,hashlib,io,json,os,re,shutil,subprocess,tarfile,time
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
protected=read(ROOT/'.tmp/typescript-frame-protocol-20261030-f/protected-after.json');assert len(protected)==369 and all(sha(ROOT/n)==h for n,h in protected.items())
fixed=ROOT/'.tmp/rc57-author-diagnostic-candidate-20261029-b/unpacked';source=ROOT/'dsh-whale-mist/src/wallpaper/probe-log.js';assert source.read_bytes()==(fixed/'src/wallpaper/probe-log.js').read_bytes()
compiler=ROOT/'.tmp/typescript-compiler-5.9.3-supervised-20261030-a';lock=read(ROOT/'dsh-whale-mist/qa/typescript-frame-protocol/compiler-lock.json');raw=(compiler/'typescript-5.9.3.tgz').read_bytes()
assert 'sha512-'+base64.b64encode(hashlib.sha512(raw).digest()).decode()==lock['integrity']
with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as archive:
 members={entry.name.removeprefix('package/'):hashlib.sha256(archive.extractfile(entry).read()).hexdigest().upper() for entry in archive if entry.isfile()}
assert all(sha(compiler/'package'/n)==h for n,h in members.items())
inputs=[source,ROOT/'dsh-whale-mist/src/wallpaper/session.js',fixed/'src/wallpaper/session.js',ROOT/'dsh-whale-mist/src/wallpaper/frame-hub.js',fixed/'src/wallpaper/frame-hub.js',ROOT/'dsh-whale-mist/qa/wallpaper-preview/tests/log-journal.test.mjs',ROOT/'dsh-whale-mist/qa/wallpaper-preview/probe-log.js',ROOT/'dsh-whale-mist/package.json']
before={str(x.relative_to(ROOT)):sha(x) for x in inputs};(out/'inputs.json').write_text(json.dumps(dict(source=str(source),compilerModule=str(compiler/'package/lib/typescript.js')),indent=2),encoding='utf-8')
text=source.read_text(encoding='utf-8');assert len(text.splitlines())==106 and not re.search(r'^import\b',text,re.M)
qa=(ROOT/'dsh-whale-mist/qa/wallpaper-preview/tests/log-journal.test.mjs').read_text(encoding='utf-8');start=qa.index("test('a successful [Desktop]");stop=qa.index("test('the native helper reports failures")
pure="import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { ProbeJournal, parseLogLine, describeLog } from "+repr(source.as_uri())+";\n"+qa[start:stop]
assert len(re.findall(r'^test\(',pure,re.M))==8 and 'spawnSync' not in pure and 'probeExe' not in pure
(out/'existing-pure-log-tests.mjs').write_text(pure,encoding='utf-8')
for f in HERE.iterdir():
 if f.is_file():shutil.copyfile(f,out/f.name)
deadline=time.monotonic()+30;commands=[];node=shutil.which('node');assert node
for label,argv in [('scope-baseline',[node,HERE/'audit.mjs',out]),('existing-pure-regressions',[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=3000',out/'existing-pure-log-tests.mjs'])]:
 child=subprocess.Popen([str(x) for x in argv],cwd=out,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000);timed=False
 try:data,error=child.communicate(timeout=min(12,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:timed=True;child.kill();data,error=child.communicate(timeout=3)
 commands.append(dict(label=label,pid=child.pid,code=child.returncode,exitConfirmed=child.returncode is not None,timedOut=timed));(out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8');(out/(label+'.stdout.txt')).write_bytes(data);(out/(label+'.stderr.txt')).write_bytes(error)
 assert not timed and child.returncode==0,(label,'inspect retained evidence')
 if label=='existing-pure-regressions':assert b'# tests 8' in data and b'# fail 0' in data
assert all(sha(ROOT/n)==h for n,h in protected.items()) and all(sha(ROOT/n)==h for n,h in before.items())
result=dict(passed=True,scopeOnly=True,selectedModule='dsh-whale-mist/src/wallpaper/probe-log.js',selectedSha256=sha(source),sameAsFixedRc57=True,selectedLines=106,imports=0,sharedSessionExcluded=inputs[1].read_bytes()!=inputs[2].read_bytes(),sharedFrameHubExcluded=inputs[3].read_bytes()!=inputs[4].read_bytes(),legacyQaModuleSameAsProduction=inputs[6].read_bytes()==source.read_bytes(),typeBaseline=read(out/'scope-types.json'),existingPureTests=8,nativeTestExcluded=True,protectedInputs=369,sourceHashes=before,commands=commands,runtimeSourceChanged=False,installedOrPackaged=False,liveAppOrProfileUsed=False)
(out/'scope-audit.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['typeBaseline','sourceHashes','commands']}))
