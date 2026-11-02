"""Only derive SHA-pinned isolated instrumentation; never change shared runtime inputs."""
from pathlib import Path
import argparse,difflib,hashlib,json,shutil
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
def prepare(out):
 p=json.loads((HERE/'inputs.json').read_bytes());out=Path(out).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir(parents=True)
 assert all(sha(ROOT/n)==h for n,h in p['files'].items())
 recorder=(HERE/'recorder.mjs').read_text(encoding='utf-8');outputs={};patches=[]
 def change(text,before,after):
  assert text.count(before)==1,(before[:100],text.count(before));return text.replace(before,after)
 def save(name,old,new):
  dest=out/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(new,encoding='utf-8',newline='\n');outputs[name]=sha(dest)
  patches.append(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='baseline/'+name,tofile='diagnostic/'+name)))
 old=(ROOT/p['controller']).read_text(encoding='utf-8');text=old
 text=change(text,'createNativeAuthorSwitches({request,timers=globalThis,validateValue}={})','createNativeAuthorSwitches({request,timers=globalThis,validateValue,diagnostics=null}={})')
 text=change(text,'const job={context,wallpaperId,epoch,abort:new AbortController(),applyPending:false};','const job={context,wallpaperId,epoch,abort:new AbortController(),applyPending:false,diagnostic:beginAuthorDiagnostic(diagnostics,\'controller.\'+kind,{epoch,revision})};if(kind===\'write\')job.diagnostic.event(\'commit\');')
 text=change(text,'timer=timers.setTimeout(()=>job.abort.abort(),kind===\'write\'?12000:4000);',"timer=timers.setTimeout(()=>{job.deadlineExpired=true;job.diagnostic.event('deadline',{code:'controller-deadline'});job.abort.abort();},kind==='write'?12000:4000);")
 text=change(text,"if(disposed||context!==job.context||epoch!==job.epoch)return {ok:false,error:'stale'};phase=recovery?'blocked':'ready';", "if(disposed||context!==job.context||epoch!==job.epoch){job.diagnostic.finish({ok:false,code:'stale',sentMayHaveOccurred:job.diagnosticMayHaveSent,confirmedRounds:job.diagnosticConfirmedRounds});return {ok:false,error:'stale'};}job.diagnostic.finish({ok:true,revision,sentMayHaveOccurred:job.diagnosticMayHaveSent,confirmedRounds:job.diagnosticConfirmedRounds});phase=recovery?'blocked':'ready';")
 text=change(text,"},error=>{\n      if(!disposed&&context===job.context", "},error=>{\n      job.diagnostic.finish({ok:false,round:job.diagnosticRound,confirmedRounds:job.diagnosticConfirmedRounds,code:job.deadlineExpired?'controller-deadline':job.errorCode??error.message,sentMayHaveOccurred:job.diagnosticMayHaveSent===true||job.applyPending&&error.uncertain!==false||error.uncertain===true?true:undefined});\n      if(!disposed&&context===job.context")
 text=change(text,'const result=await request(route,payload,{signal:job.abort.signal});check(job);',"let result;try{result=await request(route,payload,{signal:job.abort.signal});}catch(error){job.errorCode='transport-failed';job.diagnostic.event('reply',{route,ok:false,code:'transport-failed'});throw error;}job.diagnostic.event('reply',{route,ok:result?.ok===true,code:result?.error,revision:payload.expectedRevision,sentMayHaveOccurred:result?.sentMayHaveOccurred===true||result?.applySent===true?true:undefined,applyConfirmed:result?.applySent===true?true:undefined});if(result?.sentMayHaveOccurred===true||result?.applySent===true)job.diagnosticMayHaveSent=true;if(route==='apply'&&result?.applySent===true)job.diagnosticConfirmedRounds=(job.diagnosticConfirmedRounds??0)+1;if(result?.ok===false)job.errorCode=result.error;check(job);")
 text=change(text,"if(active)return Promise.resolve({ok:true,queued:true});", "if(active){active.diagnostic.event('queued');return Promise.resolve({ok:true,queued:true});}")
 text=change(text,"if(round>=4)throw Error('burst-limit');check(job);", "job.diagnosticRound=round+1;job.diagnostic.event('round',{round:round+1});if(round>=4)throw Error('burst-limit');check(job);")
 # Recorder factory + safe span are self-contained; no client-side module import.
 save('native-sidebar.mjs',old,recorder.replace('export ','')+'\n'+text)
 base=ROOT/p['runtime'];old=(base/'src/wallpaper/author-properties-host.js').read_text(encoding='utf-8');text=old
 text="import {beginAuthorDiagnostic} from './author-diagnostics.js';\n"+text
 text=change(text,"root=ROOT,applyAdapter=null}={}","root=ROOT,applyAdapter=null,diagnostics=null}={}")
 text=change(text,'    async handler(req,res){\n      const send=', '    async handler(req,res){\n      let diagnostic=null;\n      const send=')
 text=change(text,'res.end(JSON.stringify(value));};', "res.end(JSON.stringify(value));diagnostic?.finish({ok:value?.ok===true,code:value?.error,sentMayHaveOccurred:value?.sentMayHaveOccurred===true||value?.applySent===true?true:undefined,applyConfirmed:value?.applySent===true?true:undefined});};")
 text=change(text,'        const ticket=capture(req);',"        const ticket=capture(req);diagnostic=beginAuthorDiagnostic(diagnostics,'host.'+path.slice(path.lastIndexOf('/')+1),{generation:ticket.lifecycle.generation});")
 text=change(text,'          const {schema,targetActive,boundIdentity}=await readSchemaForGet(req,ticket);',"          diagnostic.event('phase',{stage:'schema'});const {schema,targetActive,boundIdentity}=await readSchemaForGet(req,ticket);")
 text=change(text,'        const body=await bodyJson(req,bodyTimeoutMs);check(req,ticket);',"        const body=await bodyJson(req,bodyTimeoutMs);diagnostic.event('request',{revision:body.expectedRevision});check(req,ticket);")
 save('runtime/src/wallpaper/author-properties-host.js',old,text)
 old=(base/'src/wallpaper/author-properties-apply.js').read_text(encoding='utf-8');text="import {beginAuthorDiagnostic} from './author-diagnostics.js';\n"+old
 text=change(text,'timeoutMs=5000,pollMs=25}={}', 'timeoutMs=5000,pollMs=25,diagnostics=null}={}')
 text=change(text,'      let sent=false,timer,poller,rejectAbort;',"      const diagnostic=beginAuthorDiagnostic(diagnostics,'adapter.apply',{generation:initial.generation});\n      let stage=null,verificationRound=0;\n      let sent=false,timer,poller,rejectAbort;")
 text=change(text,'const command=async(file,argv,verbatim=false)=>{','const command=async(file,argv,verbatim=false,commandStage)=>{')
 text=change(text,'        assertCurrent();const job=runChild(file,argv,',"        assertCurrent();stage=commandStage;diagnostic.event('command-begin',{stage});const job=runChild(file,argv,")
 text=change(text,'        const r=await job.result;assertCurrent();',"        const r=await job.result;diagnostic.event('command-end',{stage:commandStage,ok:r?.ok===true,exitConfirmed:r?.exitConfirmed===true});assertCurrent();")
 text=change(text,'        let win,proc;',"        const suffix=verificationRound++===0?'pre':'post';let win,proc;")
 text=change(text,"command(initial.helper,['--window-inspect',String(initial.hwnd)])", "command(initial.helper,['--window-inspect',String(initial.hwnd)],false,'window-'+suffix)")
 text=change(text,"command(powershell,['-NoProfile','-NonInteractive','-Command',script])", "command(powershell,['-NoProfile','-NonInteractive','-Command',script],false,'process-'+suffix)")
 text=change(text,'assertCurrent();await verifyIdentity();await validate();assertCurrent();',"assertCurrent();await verifyIdentity();stage='validate-pre';diagnostic.event('phase',{stage});await validate();assertCurrent();")
 text=change(text,'sent=true;await command(AUTHOR_WE_EXE,args,true);',"sent=true;await command(AUTHOR_WE_EXE,args,true,'send');")
 text=change(text,'          await verifyIdentity();await validate();assertCurrent();',"          await verifyIdentity();stage='validate-post';diagnostic.event('phase',{stage});await validate();assertCurrent();")
 text=change(text,'        return await Promise.race([work,cancelled]);',"        const result=await Promise.race([work,cancelled]);diagnostic.finish({ok:true,sentMayHaveOccurred:sent});return result;")
 text=change(text,'      }catch(e){controller.abort(e);if(sent)',"      }catch(e){diagnostic.finish({ok:false,code:e.authorReason,stage,sentMayHaveOccurred:sent});controller.abort(e);if(sent)")
 text=change(text,'Promise.allSettled(jobs.map(j=>j.settled)).then(release);',"Promise.allSettled(jobs.map(j=>j.settled)).then(results=>{release();diagnostic.event('children-settled',{exitConfirmed:results.every(r=>r.status==='fulfilled')});});")
 save('runtime/src/wallpaper/author-properties-apply.js',old,text)
 save('runtime/src/wallpaper/author-diagnostics.js','',recorder)
 for n,h in p['files'].items():assert sha(ROOT/n)==h
 (out/'diagnostic.patch').write_text(''.join(patches),encoding='utf-8')
 receipt={'inputs':p['files'],'outputs':outputs,'defaultEnabled':False,'runtimeWiringOrExportUIAdded':False,'realWindowsIo':False,'installedOrPackaged':False}
 (out/'receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');return receipt
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);print(json.dumps(prepare(p.parse_args().output)))
