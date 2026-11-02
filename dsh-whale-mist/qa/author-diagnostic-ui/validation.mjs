// Appended to the audited recorder module, where its closed enum sets are in scope.
export function normalizeAuthorDiagnosticBuild(value){
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
 try{
  if(!exact(value,['format','buildId','payloadVersion','sources'])||value.format!=='whale-author-build-v1'||typeof value.buildId!=='string'||!/^[a-f0-9]{64}$/.test(value.buildId)||typeof value.payloadVersion!=='string'||!/^\d+\.\d+\.\d+-rc\.\d+$/.test(value.payloadVersion)||!exact(value.sources,['controller','host','adapter','recorder'])||Object.values(value.sources).some(v=>typeof v!=='string'||!/^[A-F0-9]{64}$/.test(v)))return null;
  return Object.freeze({format:value.format,buildId:value.buildId,payloadVersion:value.payloadVersion,sources:Object.freeze({controller:value.sources.controller,host:value.sources.host,adapter:value.sources.adapter,recorder:value.sources.recorder})});
 }catch{return null;}
}

export function validateAuthorDiagnosticSnapshot(text,sources){
 const fail=()=>{throw Error('diagnostic-snapshot-invalid');};
 if(typeof text!=='string'||text.length>131072)fail();let value;try{value=JSON.parse(text);}catch{fail();}
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
 const integer=v=>Number.isSafeInteger(v)&&v>=0;
 const duration=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=604800000;
 const metaKeys=['generation','epoch','revision','round','confirmedRounds','ok','schemaSame','sentMayHaveOccurred','exitConfirmed','applyConfirmed','route','stage','code'];
 const fields=(obj,extras)=>{
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!metaKeys.includes(k)&&!extras.includes(k)))fail();
  for(const k of ['generation','epoch','revision','round','confirmedRounds'])if(Object.hasOwn(obj,k)&&!integer(obj[k]))fail();
  for(const k of ['ok','schemaSame','sentMayHaveOccurred','exitConfirmed','applyConfirmed'])if(Object.hasOwn(obj,k)&&typeof obj[k]!=='boolean')fail();
  if(Object.hasOwn(obj,'route')&&!['schema','draft','apply','plan'].includes(obj.route))fail();
  if(Object.hasOwn(obj,'stage')&&!AUTHOR_DIAGNOSTIC_STAGES.has(obj.stage))fail();
  if(Object.hasOwn(obj,'code')&&!AUTHOR_DIAGNOSTIC_CODES.has(obj.code))fail();
 };
 if(!exact(value,['format','clockDomain','sources','limits','droppedTransactions','droppedEvents','clockFault','historyComplete','missingEventsProveNothing','records','exportDroppedTransactions'])||value.format!=='whale-author-diagnostic-v1'||value.clockDomain!=='local-monotonic-only'||value.missingEventsProveNothing!==true||!exact(value.sources,['controller','host','adapter','recorder'])||Object.keys(sources).some(k=>value.sources[k]!==sources[k])||!exact(value.limits,['transactions','eventsPerTransaction','exportBytes'])||value.limits.transactions!==32||value.limits.eventsPerTransaction!==16||value.limits.exportBytes!==131072||!Array.isArray(value.records)||value.records.length>32)fail();
 for(const k of ['droppedTransactions','droppedEvents','exportDroppedTransactions'])if(!integer(value[k]))fail();
 for(const k of ['clockFault','historyComplete'])if(typeof value[k]!=='boolean')fail();
 if((value.droppedTransactions||value.droppedEvents||value.exportDroppedTransactions)&&value.historyComplete!==false)fail();
 let sequence=0;
 for(const r of value.records){
  fields(r,['sequence','kind','finished','elapsedMs','summary','droppedEvents','incomplete','events']);
  if(!integer(r.sequence)||r.sequence<=sequence||!AUTHOR_DIAGNOSTIC_KINDS.has(r.kind)||typeof r.finished!=='boolean'||typeof r.incomplete!=='boolean'||!integer(r.droppedEvents)||!Array.isArray(r.events)||r.events.length>16)fail();sequence=r.sequence;
  if((!r.finished||r.droppedEvents>0)&&r.incomplete!==true)fail();
  if(r.finished){if(!duration(r.elapsedMs))fail();fields(r.summary,[]);}else if(Object.hasOwn(r,'summary')||Object.hasOwn(r,'elapsedMs'))fail();
  for(const e of r.events){fields(e,['event','atMs','durationMs','late']);if(!AUTHOR_DIAGNOSTIC_EVENTS.has(e.event)||!duration(e.atMs)||Object.hasOwn(e,'durationMs')&&!duration(e.durationMs)||Object.hasOwn(e,'late')&&e.late!==true)fail();}
 }
 return value;
}
