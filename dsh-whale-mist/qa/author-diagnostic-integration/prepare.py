"""Fixed diagnostic client + controlled export experiment. Never installs or packs."""
from pathlib import Path
import argparse,difflib,hashlib,json,shutil
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
def prepare(out):
 pins=json.loads((HERE/'inputs.json').read_bytes());assert all(sha(ROOT/n)==h for n,h in pins['files'].items())
 out=Path(out).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir(parents=True)
 base=ROOT/pins['runtime'];runtime=out/'runtime';shutil.copytree(base,runtime)
 patches=[]
 def change(text,old,new):assert text.count(old)==1,(old[:90],text.count(old));return text.replace(old,new)
 def save(path,old,new):path.write_text(new,encoding='utf-8',newline='\n');patches.append(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='baseline/'+path.name,tofile='integrated/'+path.name)))
 old=(ROOT/pins['controller']).read_text(encoding='utf-8');text=old
 text=change(text,'requestAuthor,validateValue,editorGate=null})','requestAuthor,validateValue,editorGate=null,diagnostics=null})')
 text=change(text,'createNativeAuthorSwitches({request:requestAuthor,validateValue})','createNativeAuthorSwitches({request:requestAuthor,validateValue,diagnostics})')
 save(out/'native-sidebar.mjs',old,text)
 dest=runtime/'src/wallpaper/author-diagnostic-export.js';shutil.copyfile(HERE/'export-session.mjs',dest)
 old=(runtime/'src/detachable-host.js').read_text(encoding='utf-8');text=old
 text=change(text,'  authorApplyAdapter = null,','  authorApplyAdapter = null,\n  authorDiagnosticSession = null,')
 text=change(text,"createAuthorPropertiesHost({library,applyAdapter:authorApplyAdapter,root:","createAuthorPropertiesHost({library,applyAdapter:authorApplyAdapter,diagnostics:authorDiagnosticSession?.recorder,root:")
 # Only the existing main/snapshot handler gets this explicit export branch.
 anchor="        if (pathname === '/api/main/snapshot' && req.method === 'POST') {"
 index=text.index(anchor);point=text.index('          if (body.snapshot) {',index)
 text=text[:point]+(HERE/'snapshot-export-branch.txt').read_text(encoding='utf-8')+text[point:]
 text=change(text,"      const authorCleanup=authorHost?.dispose();","      const authorCleanup=authorHost?.dispose();authorDiagnosticSession?.dispose();")
 save(runtime/'src/detachable-host.js',old,text)
 # Original generator runs in this new build root; shared client is never written.
 build=out/'build';(build/'scripts').mkdir(parents=True);(build/'src/sidebar').mkdir(parents=True)
 shutil.copyfile(ROOT/'dsh-whale-mist/scripts/build-native-sidebar.mjs',build/'scripts/build-native-sidebar.mjs');shutil.copyfile(out/'native-sidebar.mjs',build/'src/sidebar/native-appearance-sidebar.js')
 old=(runtime/'src/client.js').read_text(encoding='utf-8');text=old
 text=change(text,'      async function requestAuthor(route,payload,{signal}={}) {',(HERE/'bridge-method.txt').read_text(encoding='utf-8')+'      async function requestAuthor(route,payload,{signal}={}) {')
 text=change(text,'        requestAuthor,\n        dispose,','        requestAuthor,\n        requestAuthorDiagnostics,\n        dispose,')
 save(build/'src/client.js',old,text)
 sources={'controller':sha(out/'native-sidebar.mjs'),'host':sha(runtime/'src/wallpaper/author-properties-host.js'),'adapter':sha(runtime/'src/wallpaper/author-properties-apply.js'),'recorder':sha(runtime/'src/wallpaper/author-diagnostics.js')}
 build_id=hashlib.sha256(json.dumps({'inputs':pins,'sources':sources,'recipes':{n:sha(HERE/n) for n in ['prepare.py','export-session.mjs','bridge-method.txt','snapshot-export-branch.txt']}},sort_keys=True).encode()).hexdigest()
 meta={'format':'whale-author-build-v1','buildId':build_id,'payloadVersion':'0.6.0-rc.56','sources':sources}
 (out/'build.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');(out/'integration.patch').write_text(''.join(patches),encoding='utf-8')
 return{'build':meta,'inputs':pins['files'],'defaultEnabled':False,'productionBootstrapOrExportUiWired':False,'installedOrPackaged':False}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);print(json.dumps(prepare(p.parse_args().output)))
