import {createAuthorDiagnosticRecorder} from './author-diagnostics.js';
// This object is created only by trusted Host code. HTTP requests cannot enable it,
// supply a recorder, replace source pins, or choose a file path.
export function createAuthorDiagnosticSession({enabled=false,build=null}={}){
 let disposed=false;
 if(enabled!==true)return Object.freeze({recorder:null,exportData:()=>({ok:false,error:'author-diagnostics-disabled'}),dispose(){disposed=true;}});
 const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
 if(!exact(build,['format','buildId','payloadVersion','sources'])||build.format!=='whale-author-build-v1'||!/^([a-f0-9]{64})$/.test(build.buildId)||!/^\d+\.\d+\.\d+-rc\.\d+$/.test(build.payloadVersion)||!exact(build.sources,['controller','host','adapter','recorder'])||Object.values(build.sources).some(v=>typeof v!=='string'||!/^[A-F0-9]{64}$/.test(v)))throw new TypeError('author-diagnostic-build-invalid');
 const pins=Object.freeze({...build.sources}),buildId=build.buildId,payloadVersion=build.payloadVersion;
 const recorder=createAuthorDiagnosticRecorder({sources:pins});
 return Object.freeze({recorder,
  exportData(expectedBuildId){
   if(disposed)return{ok:false,error:'author-diagnostics-disposed'};
   if(expectedBuildId!==buildId)return{ok:false,error:'author-diagnostic-build-mismatch'};
   try{const text=recorder.exportJson();if(typeof text!=='string'||text.length>131072)throw Error('size');
    const host=JSON.parse(text);if(host.format!=='whale-author-diagnostic-v1'||Object.keys(pins).some(k=>host.sources[k]!==pins[k]))throw Error('pins');
    return{ok:true,diagnostic:{format:'whale-author-export-v1',buildId,payloadVersion,experimental:true,host}};
   }catch{return{ok:false,error:'author-diagnostics-unavailable'};}
  },
  dispose(){disposed=true;},
 });
}
