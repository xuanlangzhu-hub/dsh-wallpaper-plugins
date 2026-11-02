"""Bounded pure controller regressions on fixed rc56 code and isolated repair."""
from pathlib import Path
import argparse,hashlib,json,os,re,shutil,subprocess,sys,time
from prepare import prepare
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args();out=Path(args.output).resolve()
assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
pins=json.loads((HERE/'baseline.json').read_bytes());fixed=ROOT/pins['fixedRuntime'];old=ROOT/pins['source']
assert sha(old)==pins['sha256'] and sha(fixed/'src/client.js')==pins['clientSha256']
assert all(sha(fixed/n)==h for n,h in pins['runtimeInputs'].items())
protected=json.loads((ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json').read_bytes());assert all(sha(ROOT/n)==h for n,h in protected.items())
receipt=prepare(out/'repair');node=shutil.which('node');assert node
env=dict(os.environ,AUTHOR_CONTRACT_SOURCE=str(fixed/'src/wallpaper/author-properties-contract.js'),AUTHOR_APPLY_SOURCE=str(fixed/'src/wallpaper/author-properties-apply.js'))
deadline=time.monotonic()+75;commands=[]
def run(label,argv,expected=0):
 child=subprocess.Popen([str(x) for x in argv],cwd=out,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000)
 timed=False
 try:data,error=child.communicate(timeout=min(25,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:
  timed=True
  if child.poll() is None:subprocess.run(['taskkill.exe','/PID',str(child.pid),'/T','/F'],capture_output=True,timeout=3,creationflags=0x08000000)
  data,error=child.communicate(timeout=4)
 (out/(label+'.stdout.txt')).write_bytes(data);(out/(label+'.stderr.txt')).write_bytes(error)
 commands.append({'label':label,'pid':child.pid,'code':child.returncode,'exitConfirmed':child.returncode is not None,'timedOut':timed})
 assert not timed and child.returncode==expected,(label,'inspect retained output')
 return data.decode('utf-8')
env['AUTHOR_SIDEBAR_SOURCE']=str(old)
run('baseline-repro',[node,HERE/'repro.mjs'])
red=run('red',[node,'--test','--test-reporter=tap','--test-timeout=2500',HERE/'retry.test.mjs'],1)
assert '# fail 3' in red,red[-500:]
env['AUTHOR_SIDEBAR_SOURCE']=str(out/'repair/native-sidebar.mjs')
green=run('green',[node,'--test','--test-reporter=tap','--test-timeout=2500',HERE/'retry.test.mjs'])
assert '# tests 12' in green and '# pass 12' in green
component=run('component',[node,'--test','--test-reporter=tap','--test-timeout=2500',HERE/'component.test.mjs'])
assert '# tests 5' in component and '# pass 5' in component
tests=[]
for name in ['native-author-sliders.test.mjs','native-author-switches.test.mjs','native-author-recovery.test.mjs','native-author-stale-recovery.test.mjs']:
 text=(ROOT/'dsh-whale-mist/qa'/name).read_text(encoding='utf-8')
 text=text.replace("'../src/sidebar/native-appearance-sidebar.js'",(out/'repair/native-sidebar.mjs').as_uri().__repr__())
 text=re.sub(r"(['\"])\.\./src/([^'\"]+)\1",lambda m:(fixed/'src'/m[2]).as_uri().__repr__(),text)
 target=out/name;target.write_text(text,encoding='utf-8');tests.append(target)
legacy=run('legacy',[node,'--test','--test-reporter=tap','--test-concurrency=1','--test-timeout=2500',*tests])
assert '# fail 0' in legacy
assert all(sha(ROOT/n)==h for n,h in protected.items()) and sha(old)==pins['sha256']
assert all(sha(fixed/n)==h for n,h in pins['runtimeInputs'].items())
result={'passed':True,'retryChecks':12,'componentChecks':5,'redExpectedFailures':3,'legacyTests':int(re.search(r'# tests (\d+)',legacy)[1]),'protectedInputs':len(protected),'sourceReceipt':receipt,'commands':commands,'realWindowOrProcessIO':False,'longRunRootCauseConfirmed':False,'hostOrDailyRuntimeChanged':False,'clientGenerated':False,'totalDeadlineSeconds':75}
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
