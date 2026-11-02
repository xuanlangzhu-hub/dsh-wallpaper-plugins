from pathlib import Path
import argparse,difflib,hashlib,json,shutil
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
def prepare(out):
 pins=json.loads((HERE/'inputs.json').read_bytes());assert all(sha(ROOT/n)==h for n,h in pins['files'].items())
 out=Path(out).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir(parents=True)
 runtime=out/'runtime';shutil.copytree(ROOT/pins['runtime'],runtime);patches=[]
 def change(text,old,new):assert text.count(old)==1,(old[:90],text.count(old));return text.replace(old,new)
 def save(path,old,new):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(new,encoding='utf-8',newline='\n');patches.append(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='baseline/'+path.name,tofile='ui/'+path.name)))
 old_recorder=(runtime/'src/wallpaper/author-diagnostics.js').read_text(encoding='utf-8');recorder=old_recorder+'\n'+(HERE/'validation.mjs').read_text(encoding='utf-8');save(runtime/'src/wallpaper/author-diagnostics.js',old_recorder,recorder)
 lifecycle=(HERE/'lifecycle.mjs').read_text(encoding='utf-8');save(runtime/'src/wallpaper/author-diagnostic-lifecycle.js','',lifecycle)
 old=(ROOT/pins['controller']).read_text(encoding='utf-8');prefix=old_recorder.replace('export ','')+'\n';assert old.startswith(prefix);text=recorder.replace('export ','')+'\n'+lifecycle.replace('export ','')+'\n'+old[len(prefix):]
 text=change(text,'author=null,editorGate=null})','author=null,editorGate=null,diagnostic=null})')
 # Stable fallback snapshot for useSyncExternalStore, no conditional hooks.
 text=change(text,'export function createNativeAppearanceSidebar(',"const NO_AUTHOR_DIAGNOSTIC_STATE=Object.freeze({enabled:false,busy:false,mark:null});\nexport function createNativeAppearanceSidebar(")
 actions="""  function AuthorDiagnosticActions({visible,signal}) {
    const token=React.useRef(Symbol('diagnostic-view')).current;
    const diagnosticState=React.useSyncExternalStore(diagnostic?.subscribe??(()=>()=>{}),diagnostic?.read??(()=>NO_AUTHOR_DIAGNOSTIC_STATE),diagnostic?.read??(()=>NO_AUTHOR_DIAGNOSTIC_STATE));
    React.useEffect(()=>{diagnostic?.view(token,visible&&!signal?.aborted);const abort=()=>diagnostic?.remove(token);signal?.addEventListener('abort',abort,{once:true});return()=>{signal?.removeEventListener('abort',abort);diagnostic?.remove(token);};},[token,visible,signal]);
    if(!diagnosticState.enabled)return null;
    return h('div',{'data-whale-author-diagnostic-actions':true,style:{display:'flex',justifyContent:'flex-end',gap:'6px',margin:'8px 0'}},
        h('button',{type:'button',className:'dsw-btn','data-whale-quiet':true,'data-whale-author-diagnostic-export':true,disabled:diagnosticState.busy||!visible||signal?.aborted===true,
          title:diagnosticState.busy?'正在生成诊断文件':diagnosticState.mark==='download'?'已交给浏览器下载，请确认文件':diagnosticState.mark==='error'?'导出未完成，点击重试':'导出脱敏参数诊断（JSON）',
          'aria-label':'导出参数诊断',onClick:()=>diagnostic.exportFile(token)},diagnosticState.busy?'…':diagnosticState.mark==='download'?'✓ 导出诊断':diagnosticState.mark==='error'?'! 导出诊断':'导出诊断'),
        diagnosticState.busy?h('button',{type:'button',className:'dsw-btn','data-whale-quiet':true,'data-whale-author-diagnostic-cancel':true,'aria-label':'取消导出参数诊断',onClick:()=>diagnostic.cancel()},'取消'):null);
  }
"""
 text=change(text,'  function AuthorSwitches({visible,signal,autoEligible=false}) {',actions+'  function AuthorSwitches({visible,signal,autoEligible=false}) {')
 text=change(text,"        view.galleryOpen?h(Gallery,{view,visible:tab.visible===true&&section==='wallpaper'}):h(React.Fragment,null,", "        h(AuthorDiagnosticActions,{visible:wallpaperVisible,signal:tab.signal}),\n        view.galleryOpen?h(Gallery,{view,visible:tab.visible===true&&section==='wallpaper'}):h(React.Fragment,null,")
 text=change(text,'editorGate=null,diagnostics=null})','editorGate=null,diagnostics=null,diagnosticOptions=null})')
 text=change(text,'  const author=typeof requestAuthor',"  const download=diagnosticOptions?createAuthorDiagnosticDownload(diagnosticOptions.downloadOptions):null;\n  const diagnostic=diagnosticOptions?createAuthorDiagnosticLifecycle({expectedBuild:diagnosticOptions.expectedBuild,createRecorder:createAuthorDiagnosticRecorder,normalizeBuild:normalizeAuthorDiagnosticBuild,validateSnapshot:validateAuthorDiagnosticSnapshot,requestHost:diagnosticOptions.requestHost,readConnection:diagnosticOptions.readConnection,save:download.save}):null;\n  const author=typeof requestAuthor")
 text=change(text,'createNativeAuthorSwitches({request:requestAuthor,validateValue,diagnostics})','createNativeAuthorSwitches({request:requestAuthor,validateValue,diagnostics:diagnostic?.recorder??diagnostics})')
 text=change(text,"    open(){if(disposed)return{ok:false,error:'disposed'};", "    configureAuthorDiagnostics(value){return diagnostic?.configure(value)===true;},\n    open(){if(disposed)return{ok:false,error:'disposed'};")
 text=change(text,'offGate?.();listeners.clear();playback.dispose();author?.dispose();','offGate?.();listeners.clear();diagnostic?.dispose();download?.dispose();playback.dispose();author?.dispose();')
 text=change(text,'previewOptions,author,editorGate});','previewOptions,author,editorGate,diagnostic});')
 save(out/'native-sidebar.mjs',old,text)
 sources={'controller':sha(out/'native-sidebar.mjs'),'host':sha(runtime/'src/wallpaper/author-properties-host.js'),'adapter':sha(runtime/'src/wallpaper/author-properties-apply.js'),'recorder':sha(runtime/'src/wallpaper/author-diagnostics.js')}
 build_id=hashlib.sha256(json.dumps({'inputs':pins,'sources':sources,'recipe':{n:sha(HERE/n) for n in ['prepare.py','validation.mjs','lifecycle.mjs']}},sort_keys=True).encode()).hexdigest()
 meta={'format':'whale-author-build-v1','buildId':build_id,'payloadVersion':'0.6.0-rc.56','sources':sources}
 save(runtime/'src/wallpaper/author-diagnostic-build.js','', 'export const AUTHOR_DIAGNOSTIC_BUILD=Object.freeze('+json.dumps(meta,ensure_ascii=True,separators=(',',':'))+');\n')
 (out/'build.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
 old=(runtime/'src/index.js').read_text(encoding='utf-8');text="import {createAuthorDiagnosticSession} from './wallpaper/author-diagnostic-export.js';\nimport {AUTHOR_DIAGNOSTIC_BUILD} from './wallpaper/author-diagnostic-build.js';\n"+old
 text=change(text,"    const host = createDetachableHttpHost({\n      library,", "    const authorDiagnosticSession=createAuthorDiagnosticSession({enabled:process.env.WM_AUTHOR_DIAGNOSTICS==='1',build:AUTHOR_DIAGNOSTIC_BUILD});\n    const host = createDetachableHttpHost({\n      library,authorDiagnosticSession,")
 text=change(text,'createAuthorApplyAdapter({readTarget: createWallpaperReadTarget(wallpaper)})','createAuthorApplyAdapter({readTarget: createWallpaperReadTarget(wallpaper),diagnostics:authorDiagnosticSession.recorder})')
 text=change(text,'res.end(JSON.stringify({ ok: true, port, mainToken }));','res.end(JSON.stringify({ ok: true, port, mainToken,...(authorDiagnosticSession.recorder?{authorDiagnostics:AUTHOR_DIAGNOSTIC_BUILD}:{}) }));')
 save(runtime/'src/index.js',old,text)
 old=(runtime/'src/client.js').read_text(encoding='utf-8');text=old
 text=change(text,'    const inject = ["theme", "slots"];','    const WM_AUTHOR_DIAGNOSTIC_BUILD=Object.freeze('+json.dumps(meta,ensure_ascii=True,separators=(',',':'))+');\n    const inject = ["theme", "slots"];')
 text=change(text,'attachNativeAppearanceSidebar({ ctx, React, controller, editorGate,','attachNativeAppearanceSidebar({ ctx, React, controller, editorGate,\n        diagnosticOptions:{expectedBuild:WM_AUTHOR_DIAGNOSTIC_BUILD,requestHost:(...args)=>appearanceBridge.getClient()?.requestAuthorDiagnostics(...args)??Promise.reject(Error("diagnostic-disconnected")),readConnection:()=>appearanceBridge.getClient()?.authorConnected?{generation:appearanceBridge.getSnapshot().generation}:null},')
 text=change(text,'        let mainToken = boot?.mainToken;','        let mainToken = boot?.mainToken;\n        let diagnosticBootstrap=null;')
 text=change(text,'                mainToken = data.mainToken;','                mainToken = data.mainToken;\n                diagnosticBootstrap=data.authorDiagnostics;')
 text=change(text,'          await bridgeClientInstance.connect().catch(() => {});','          await bridgeClientInstance.connect().catch(() => {});\n          if(!disposed)nativeSidebar.configureAuthorDiagnostics(bridgeClientInstance.authorConnected===true?diagnosticBootstrap:null);')
 build=out/'build';(build/'scripts').mkdir(parents=True);(build/'src/sidebar').mkdir(parents=True);shutil.copyfile(ROOT/'dsh-whale-mist/scripts/build-native-sidebar.mjs',build/'scripts/build-native-sidebar.mjs');shutil.copyfile(out/'native-sidebar.mjs',build/'src/sidebar/native-appearance-sidebar.js');save(build/'src/client.js',old,text)
 (out/'integration.patch').write_text(''.join(patches),encoding='utf-8')
 return{'build':meta,'inputPins':pins['files'],'defaultEnabled':False,'optInEnvironment':'WM_AUTHOR_DIAGNOSTICS=1','automaticFileWrites':False,'installedOrPackaged':False}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);print(json.dumps(prepare(p.parse_args().output)))
