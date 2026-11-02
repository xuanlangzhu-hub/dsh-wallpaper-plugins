"""Check an isolated annotation candidate; never writes the development log module."""
from pathlib import Path
import argparse,base64,hashlib,io,json,os,re,shutil,subprocess,tarfile,time
from annotate import annotate
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
protected=read(ROOT/'.tmp/typescript-probe-log-scope-20261030-a/protected-after.json');assert len(protected)==371 and all(sha(ROOT/n)==h for n,h in protected.items())
source=ROOT/'dsh-whale-mist/src/wallpaper/probe-log.js';assert sha(source)=='3E49A454180A249AA7C49912C428E524385C8A7C2A532E825147C25819F99C82'
fixed=ROOT/'.tmp/rc57-author-diagnostic-candidate-20261029-b/unpacked/src/wallpaper/probe-log.js';assert fixed.read_bytes()==source.read_bytes()
compiler=ROOT/'.tmp/typescript-compiler-5.9.3-supervised-20261030-a';lock=read(ROOT/'dsh-whale-mist/qa/typescript-frame-protocol/compiler-lock.json');archive_bytes=(compiler/'typescript-5.9.3.tgz').read_bytes()
assert 'sha512-'+base64.b64encode(hashlib.sha512(archive_bytes).digest()).decode()==lock['integrity']
with tarfile.open(fileobj=io.BytesIO(archive_bytes),mode='r:gz') as archive:
 hashes={e.name.removeprefix('package/'):hashlib.sha256(archive.extractfile(e).read()).hexdigest().upper() for e in archive if e.isfile()}
assert all(sha(compiler/'package'/n)==h for n,h in hashes.items())
qa_hashes={f.name:sha(f) for f in HERE.iterdir() if f.is_file()};frozen=out/'frozen';frozen.mkdir()
for n in qa_hashes:shutil.copyfile(HERE/n,frozen/n)
inputs=out/'inputs';inputs.mkdir();(out/'package.json').write_text('{"type":"module"}',encoding='utf-8')
(inputs/'baseline.js').write_bytes(source.read_bytes());(inputs/'probe-log.js').write_text(annotate(source.read_text(encoding='utf-8')),encoding='utf-8');shutil.copyfile(HERE/'positive.ts',inputs/'positive.ts')
cases=[('number-chunk',"new ProbeJournal().push(123);",2345),('wrong-encoding',"new ProbeJournal().push({toString(encoding: 'hex') { return encoding; }});",2322),('wrong-chunk-result',"new ProbeJournal().push({toString() { return 123; }});",2322),('null-parse-result',"describeLog(parseLogLine(''));",2345),('wrong-message-type',"const e = parseLogLine('x'); if(e) { const m: number = e.message; void m; }",2322),('unparsed-timestamp',"const e = parseLogLine('x'); if(e) { const at: number = e.at; void at; }",2322),('invalid-level',"const e = parseLogLine('x'); if(e) e.level = 'fatal';",2322),('nullable-first-error',"const first: string = new ProbeJournal().snapshot().firstError; void first;",2322),('journal-record-missing-time',"new ProbeJournal().entries.push({level:'info',scope:'',message:'x',detail:''});",2345)]
negatives=[]
for name,body,code in cases:
 dest=inputs/(name+'.ts');dest.write_text("import {parseLogLine,describeLog,ProbeJournal} from './probe-log.js';\n"+body,encoding='utf-8');negatives.append(dict(name=name,file=str(dest),code=code))
info=dict(module=str(inputs/'probe-log.js'),baseline=str(inputs/'baseline.js'),positive=str(inputs/'positive.ts'),negatives=negatives,compilerModule=str(compiler/'package/lib/typescript.js'))
(out/'inputs.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
config=read(ROOT/'dsh-whale-mist/qa/typescript-frame-protocol/tsconfig.json');config['files']=[info['module'],info['positive']];(out/'tsconfig.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
oldtest=ROOT/'dsh-whale-mist/qa/wallpaper-preview/tests/log-journal.test.mjs';oldsha=sha(oldtest);text=oldtest.read_text(encoding='utf-8');start=text.index("test('a successful [Desktop]");end=text.index("test('the native helper reports failures")
pure="import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {ProbeJournal,parseLogLine,describeLog} from "+repr((inputs/'probe-log.js').as_uri())+";\n"+text[start:end]
assert len(re.findall(r'^test\(',pure,re.M))==8 and 'spawnSync' not in pure and 'probeExe' not in pure;(out/'existing-pure.test.mjs').write_text(pure,encoding='utf-8')
initial={str(f.relative_to(out)):sha(f) for f in out.rglob('*') if f.is_file()};commands=[];deadline=time.monotonic()+65;node=shutil.which('node');assert node
env=dict(os.environ,PROBE_TYPE_INPUTS=str(out/'inputs.json'))
def run(label,argv):
 child=subprocess.Popen([str(x) for x in argv],cwd=out,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000);timed=False
 try:data,error=child.communicate(timeout=min(20,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:timed=True;child.kill();data,error=child.communicate(timeout=3)
 commands.append(dict(label=label,pid=child.pid,code=child.returncode,exitConfirmed=child.returncode is not None,timedOut=timed));(out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8');(out/(label+'.stdout.txt')).write_bytes(data);(out/(label+'.stderr.txt')).write_bytes(error)
 assert not timed and child.returncode==0,(label,'inspect retained output');return data.decode('utf-8')
run('syntax',[node,'--check',inputs/'probe-log.js'])
run('tsc-noemit',[node,compiler/'package/lib/tsc.js','--project',out/'tsconfig.json','--pretty','false','--listFiles'])
added={str(f.relative_to(out)) for f in out.rglob('*') if f.is_file()}-set(initial);assert added=={'commands.json','syntax.stdout.txt','syntax.stderr.txt','tsc-noemit.stdout.txt','tsc-noemit.stderr.txt'},added
run('types-and-ast',[node,frozen/'verify.mjs',out])
for label,files,count in [('existing-pure',[out/'existing-pure.test.mjs'],8),('runtime-equivalence',[frozen/'runtime.test.mjs'],8)]:
 data=run(label,[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=3000',*files]);assert f'# tests {count}' in data and '# fail 0' in data
assert all(sha(ROOT/n)==h for n,h in protected.items()) and sha(oldtest)==oldsha and all(sha(HERE/n)==h for n,h in qa_hashes.items())
assert not list(out.rglob('*.d.ts')) and not list(out.rglob('*.map')) and not list(out.rglob('*.tsbuildinfo'))
result=dict(passed=True,isolatedOnly=True,candidateSha256=sha(inputs/'probe-log.js'),baselineSha256=sha(source),typeResults=read(out/'type-results.json'),retainedPureTests=8,newRuntimeTests=8,protectedInputs=371,compilerEmittedFiles=0,qaHashes=qa_hashes,commands=commands,developmentSourceChanged=False,nativeOrLiveAppsUsed=False,installedOrPackaged=False)
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['qaHashes','commands','typeResults']}))
