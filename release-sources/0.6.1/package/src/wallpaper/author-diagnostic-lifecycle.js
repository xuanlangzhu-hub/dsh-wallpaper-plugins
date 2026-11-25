// Browser-safe lifecycle: no globals are read until an explicit download handoff.
export function createAuthorDiagnosticDownload({document:doc=globalThis.document,urlApi=globalThis.URL,BlobType=globalThis.Blob,timers=globalThis}={}){
 const urls=new Map();let disposed=false;
 const drop=url=>{const timer=urls.get(url);urls.delete(url);if(timer!==undefined)timers.clearTimeout(timer);try{urlApi.revokeObjectURL(url);}catch{}};
 return Object.freeze({
  save(text,buildId){
   if(disposed||typeof text!=='string'||text.length>300000||typeof buildId!=='string'||!/^[a-f0-9]{64}$/.test(buildId)||!doc?.body||typeof doc.createElement!=='function'||typeof urlApi?.createObjectURL!=='function')throw Error('diagnostic-download-unavailable');
   let url,anchor;
   try{const blob=new BlobType([text],{type:'application/json'});if(blob.size>300000)throw Error('diagnostic-file-limit');
    while(urls.size>=2)drop(urls.keys().next().value);
    url=urlApi.createObjectURL(blob);if(typeof url!=='string'||!url.startsWith('blob:'))throw Error('diagnostic-url-invalid');urls.set(url,undefined);anchor=doc.createElement('a');anchor.href=url;anchor.download='whale-author-diagnostic-'+buildId.slice(0,12)+'.json';anchor.rel='noopener';anchor.hidden=true;doc.body.appendChild(anchor);anchor.click();
    if(disposed)drop(url);else urls.set(url,timers.setTimeout(()=>drop(url),1500));return{ok:true,handedToBrowser:true};
   }catch(error){if(url)drop(url);throw error;}finally{try{anchor?.remove();}catch{}}
  },
  dispose(){if(disposed)return;disposed=true;for(const url of [...urls.keys()])drop(url);},
 });
}

export function createAuthorDiagnosticLifecycle({expectedBuild,createRecorder,normalizeBuild,validateSnapshot,requestHost,readConnection,save,timers=globalThis,timeoutMs=5000}={}){
 const expected=normalizeBuild(expectedBuild),listeners=new Set(),views=new Set();let recorder=null,epoch=0,active=null,disposed=false,mark=null;
 if(!Number.isInteger(timeoutMs)||timeoutMs<20||timeoutMs>5000)throw TypeError('diagnostic-timeout-invalid');
 let snapshot;
 const publish=()=>{snapshot=Object.freeze({enabled:!!recorder&&!disposed,busy:!!active,mark});if(!disposed)for(const fn of [...listeners]){try{fn();}catch{}}};
 const connection=()=>{try{const v=readConnection?.();return Number.isSafeInteger(v?.generation)&&v.generation>0?v.generation:null;}catch{return null;}};
 const current=job=>!disposed&&recorder&&active===job&&job.epoch===epoch&&views.has(job.view)&&!job.abort.signal.aborted&&connection()===job.generation;
 const cancel=()=>{if(active){active.abort.abort();active.reject(Error('cancelled'));}};
 const proxy=Object.freeze({begin(kind,fields){if(!recorder||disposed)return null;return{epoch,recorder,token:recorder.begin(kind,fields)};},event(t,...args){if(!disposed&&t?.epoch===epoch&&t.recorder===recorder)recorder?.event(t.token,...args);},finish(t,...args){if(!disposed&&t?.epoch===epoch&&t.recorder===recorder)recorder?.finish(t.token,...args);}});
 const api={
  recorder:proxy,read:()=>snapshot,subscribe(fn){if(disposed)return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},
  configure(value){
   if(disposed)return false;const next=normalizeBuild(value);
   if(!expected||!next||JSON.stringify(next)!==JSON.stringify(expected)){epoch++;cancel();recorder=null;mark=null;publish();return false;}
   if(!recorder){epoch++;recorder=createRecorder({sources:expected.sources});mark=null;publish();}return true;
  },
  view(token,visible){if(disposed)return;if(visible===true)views.add(token);else{views.delete(token);if(active?.view===token)cancel();}},
  remove(token){api.view(token,false);},cancel,
  async exportFile(view){
   const generation=connection();if(disposed||!recorder||active||!views.has(view)||generation===null||!expected)return{ok:false,error:'unavailable'};
   const job={epoch,view,generation,abort:new AbortController(),reject:null};let timer;const guard=new Promise((_,reject)=>{job.reject=reject;timer=timers.setTimeout(()=>{job.abort.abort();reject(Error('timeout'));},timeoutMs);});active=job;mark=null;publish();
   const work=(async()=>{
    const response=await requestHost(expected.buildId,{signal:job.abort.signal});if(!current(job))throw Error('cancelled');
    const d=response?.diagnostic;
    if(!response||Object.keys(response).sort().join(',')!=='diagnostic,ok'||response.ok!==true||!d||Object.keys(d).sort().join(',')!=='buildId,experimental,format,host,payloadVersion'||d.format!=='whale-author-export-v1'||d.buildId!==expected.buildId||d.payloadVersion!==expected.payloadVersion||d.experimental!==true)throw Error('invalid');
    const hostText=JSON.stringify(d.host);const host=validateSnapshot(hostText,expected.sources),renderer=validateSnapshot(recorder.exportJson(),expected.sources);
    const text=JSON.stringify({format:'whale-author-diagnostics-v1',build:expected,clockDomains:{renderer:'renderer-local-monotonic',host:'host-local-monotonic',crossProcessTiming:'not-correlated'},renderer,host});
    if(text.length>300000||!current(job))throw Error('invalid');const result=save(text,expected.buildId);if(result?.ok!==true||result.handedToBrowser!==true)throw Error('download');return{ok:true,handedToBrowser:true};
   })();
   try{const result=await Promise.race([work,guard]);if(current(job)){mark='download';publish();}return result;}
   catch(error){const code=['cancelled','timeout'].includes(error.message)?error.message:'unavailable';if(!disposed&&job.epoch===epoch){mark=code==='cancelled'?'cancelled':'error';publish();}return{ok:false,error:code};}
   finally{timers.clearTimeout(timer);job.abort.abort();if(active===job)active=null;publish();}
  },
  dispose(){if(disposed)return;disposed=true;epoch++;cancel();recorder=null;views.clear();listeners.clear();publish();},
 };publish();return Object.freeze(api);
}
