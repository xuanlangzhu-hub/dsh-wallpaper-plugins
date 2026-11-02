"""Bounded single-module D2 check. Default checks the real development JS module."""
from pathlib import Path
import argparse,base64,hashlib,io,json,os,re,shutil,subprocess,tarfile,time
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
BASE_HASH='074AB958CFA6E9D0050067BA8AD5B280605671D9630615194ACB282DCD79DED9'
DOC='''/**
 * A decoded WHL1 packet. Numeric bounds remain enforced by the runtime parser.
 * @typedef {object} WhlFrame
 * @property {number} sequence
 * @property {number} capturedAt
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} packet
 * @property {Uint8Array} jpeg
 */

'''
def annotated(raw):
 assert raw.count('export class FrameDecoder {')==1 and raw.count('  constructor(onFrame)')==1 and raw.count('  push(chunk)')==1
 return raw.replace('export class FrameDecoder {',DOC+'export class FrameDecoder {').replace('  constructor(onFrame)','  /** @param {(frame: WhlFrame) => void} onFrame */\n  constructor(onFrame)').replace('  push(chunk)','  /** @param {Uint8Array} chunk */\n  push(chunk)')
parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);parser.add_argument('--isolated',action='store_true');parser.add_argument('--compiler-root',default=str(ROOT/'.tmp/typescript-compiler-5.9.3-20261030-a'));args=parser.parse_args()
out=Path(args.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
compiler=Path(args.compiler_root).resolve();assert compiler.is_relative_to(ROOT/'.tmp');receipt=read(compiler/'compiler-receipt.json');assert receipt['passed'] and receipt['version']=='5.9.3'
lock=read(HERE/'compiler-lock.json');archive_bytes=(compiler/'typescript-5.9.3.tgz').read_bytes()
assert 'sha512-'+base64.b64encode(hashlib.sha512(archive_bytes).digest()).decode()==lock['integrity']==receipt['integrity']
with tarfile.open(fileobj=io.BytesIO(archive_bytes),mode='r:gz') as archive:
 archived={entry.name.removeprefix('package/'):hashlib.sha256(archive.extractfile(entry).read()).hexdigest().upper() for entry in archive if entry.isfile()}
assert archived==receipt['files'],'Compiler receipt must match the pinned archive, not only its own file list'
assert all(sha(compiler/'package'/n)==h for n,h in receipt['files'].items())
source=ROOT/'dsh-whale-mist/src/wallpaper/frame-protocol.js';fixed=ROOT/'.tmp/rc57-author-diagnostic-candidate-20261029-b/unpacked';assert sha(fixed/'src/wallpaper/frame-protocol.js')==BASE_HASH
before_source=sha(source);protected=read(ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json');allowed='dsh-whale-mist/src/wallpaper/frame-protocol.js'
assert all(sha(ROOT/n)==h for n,h in protected.items() if n!=allowed)
raw=(fixed/'src/wallpaper/frame-protocol.js').read_text(encoding='utf-8');expected=annotated(raw)
if args.isolated:assert before_source==BASE_HASH
else:assert source.read_text(encoding='utf-8')==expected,'Only the reviewed annotation patch is accepted'
(out/'package.json').write_text('{"type":"module"}',encoding='utf-8');inputs=out/'inputs';inputs.mkdir();(inputs/'baseline.js').write_bytes((fixed/'src/wallpaper/frame-protocol.js').read_bytes())
module=inputs/'frame-protocol.js' if args.isolated else source
if args.isolated:module.write_text(expected,encoding='utf-8',newline='\n')
frozen=out/'frozen';frozen.mkdir();qa_hashes={f.name:sha(f) for f in HERE.iterdir() if f.is_file()}
for n in qa_hashes:shutil.copyfile(HERE/n,frozen/n)
rel=os.path.relpath(module,frozen).replace('\\','/');rel=rel if rel.startswith('.') else './'+rel
positive=(frozen/'positive.ts');positive.write_text((HERE/'positive.ts').read_text(encoding='utf-8').replace('../../src/wallpaper/frame-protocol.js',rel),encoding='utf-8')
config=read(HERE/'tsconfig.json');config['files']=[str(module),str(positive)];(out/'tsconfig.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
cases=[('string-chunk',"new FrameDecoder(() => {}).push('bad');",2345),('wrong-callback',"new FrameDecoder((frame: string) => { void frame; });",2345),('unknown-frame-field',"new FrameDecoder(frame => { void frame.notAField; });",2339),('wrong-width-type',"new FrameDecoder(frame => { const width: string = frame.width; void width; });",2322),('missing-callback',"new FrameDecoder();",2554),('bad-jpeg-element',"new FrameDecoder(frame => { frame.jpeg[0] = 'bad'; });",2322),('bad-sequence-field',"new FrameDecoder(frame => { frame.sequence = 'bad'; });",2322)]
negatives=[]
for name,body,code in cases:
 dest=frozen/(name+'.ts');dest.write_text("import {FrameDecoder} from '"+rel+"';\n"+body,encoding='utf-8');negatives.append(dict(name=name,file=str(dest),code=code))
inline=out/'inline';(inline/'scripts').mkdir(parents=True);(inline/'src/wallpaper').mkdir(parents=True)
shutil.copyfile(ROOT/'dsh-whale-mist/scripts/build-wm-protocol.mjs',inline/'scripts/build-wm-protocol.mjs');shutil.copyfile(module,inline/'src/wallpaper/frame-protocol.js');shutil.copyfile(fixed/'src/client.js',inline/'src/client.js')
original_inline=(inline/'src/client.js').read_text(encoding='utf-8')
clients=[ROOT/'dsh-whale-mist/src/client.js',fixed/'src/client.js',inline/'src/client.js'];info=dict(module=str(module),baseline=str(inputs/'baseline.js'),positive=str(positive),negatives=negatives,clients=[str(x) for x in clients],compilerModule=str(compiler/'package/lib/typescript.js'))
(out/'inputs.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
watched=[source,*clients[:2],ROOT/'dsh-whale-mist/package.json',ROOT/'dsh-whale-mist/scripts/build-wm-protocol.mjs'];before={str(x):sha(x) for x in watched}
snapshot=lambda:{str(p.relative_to(out)):sha(p) for p in out.rglob('*') if p.is_file()}
initial=snapshot();commands=[];deadline=time.monotonic()+65;env=dict(os.environ,FRAME_TYPE_INPUTS=str(out/'inputs.json'));node=shutil.which('node');assert node
def run(label,argv):
 child=subprocess.Popen([str(x) for x in argv],cwd=out,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000);timed=False
 try:data,error=child.communicate(timeout=min(20,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:timed=True;child.kill();data,error=child.communicate(timeout=3)
 commands.append(dict(label=label,pid=child.pid,code=child.returncode,exitConfirmed=child.returncode is not None,timedOut=timed));(out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8');(out/(label+'.stdout.txt')).write_bytes(data);(out/(label+'.stderr.txt')).write_bytes(error)
 assert not timed and child.returncode==0,(label,'inspect retained outputs');return data.decode('utf-8')
listed=run('tsc-noemit',[node,compiler/'package/lib/tsc.js','--project',out/'tsconfig.json','--pretty','false','--listFiles'])
after=snapshot();new=set(after)-set(initial);assert new=={'commands.json','tsc-noemit.stdout.txt','tsc-noemit.stderr.txt'},new
run('inline-first',[node,inline/'scripts/build-wm-protocol.mjs']);first_hash=sha(inline/'src/client.js')
run('inline-idempotent',[node,inline/'scripts/build-wm-protocol.mjs']);assert sha(inline/'src/client.js')==first_hash
generated_inline=(inline/'src/client.js').read_text(encoding='utf-8')
outside=lambda text:(text.split('/* WM_FRAME_PROTOCOL */')[0],text.split('/* WM_FRAME_PROTOCOL_END */')[1])
assert outside(generated_inline)==outside(original_inline),'Inliner changed unrelated client contents'
run('inline-syntax',[node,'--check',inline/'src/client.js'])
run('type-contracts',[node,frozen/'verify-types.mjs',out])
runtime=run('runtime-protocol',[node,'--test','--test-isolation=none','--test-concurrency=1','--test-reporter=tap','--test-timeout=3000',frozen/'runtime.test.mjs']);assert '# tests 12' in runtime and '# fail 0' in runtime
assert all(sha(Path(n))==h for n,h in before.items()) and all(sha(ROOT/n)==h for n,h in protected.items() if n!=allowed)
assert all(sha(HERE/n)==h for n,h in qa_hashes.items())
assert not list(out.rglob('*.tsbuildinfo')) and not list(out.rglob('*.map')) and not list(out.rglob('*.d.ts'))
result=dict(passed=True,mode='isolated-annotations' if args.isolated else 'real-development-source',compilerVersion='5.9.3',baselineSha256=BASE_HASH,checkedModule=str(module),checkedModuleSha256=sha(module),sourceBeforeSha256=before_source,typeResults=read(out/'type-results.json'),runtimeTests=12,compilerEmittedFiles=0,isolatedInlinerExecuted=True,isolatedInlinerIdempotent=True,unrelatedClientContentsUnchanged=True,protectedOtherInputs=len(protected)-(allowed in protected),developmentSourceChangedByCheck=False,qaHashes=qa_hashes,commands=commands,nativeOrLiveAppsUsed=False,installedOrPackaged=False)
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['commands','qaHashes','typeResults']}))
