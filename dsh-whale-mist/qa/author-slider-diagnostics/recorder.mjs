// Dependency-free and inert until explicitly injected. No IO, timers or observers.
const AUTHOR_DIAGNOSTIC_CODES=new Set(['other','cancelled','stale','burst-limit','request-failed','transport-failed','response-invalid','target-unavailable','draft-pending','apply-failed','apply-unconfirmed','save-mismatch','discard-unconfirmed','schema-changed','schema-readonly-stale','schema-refresh-blocked','controller-deadline',
 'author_apply_busy','author_apply_cancelled','author_apply_command_failed','author_apply_exit_unknown','author_apply_timeout','author_apply_unavailable','author_apply_uncertain','author_body_invalid','author_body_limit','author_body_timeout','author_cancelled','author_cleanup_pending','author_color_invalid','author_command_limit','author_content_type','author_context_changed','author_context_invalid','author_delivery_changed','author_discard_confirmation','author_disposed','author_draft_limit','author_field_unsupported','author_id_invalid','author_key_invalid','author_limit_invalid','author_locale_invalid','author_metadata_invalid','author_no_changes','author_no_fields','author_option_invalid','author_plan_invalid','author_rating_denied','author_read_busy','author_read_timeout','author_request_invalid','author_response_invalid','author_revision_conflict','author_revision_limit','author_route_unknown','author_schema_changed','author_schema_invalid','author_schema_limit','author_schema_stale','author_schema_unchanged','author_step_invalid','author_string_invalid','author_target_changed','author_target_inactive','author_target_unverified','author_unauthorized','author_unavailable','author_value_invalid','author_values_invalid']);
const AUTHOR_DIAGNOSTIC_KINDS=new Set(['controller.read','controller.write','controller.discard','host.schema','host.draft','host.apply','host.plan','adapter.apply']);
const AUTHOR_DIAGNOSTIC_EVENTS=new Set(['commit','queued','round','reply','request','phase','command-begin','command-end','children-settled','deadline']);
const AUTHOR_DIAGNOSTIC_STAGES=new Set(['window-pre','process-pre','send','window-post','process-post','validate-pre','validate-post','schema']);
const AUTHOR_DIAGNOSTIC_NOOP=Object.freeze({event(){},finish(){}});

function authorDiagnosticFields(input){
 const out={};
 try{
  for(const key of ['generation','epoch','revision','round','confirmedRounds'])if(Number.isSafeInteger(input?.[key])&&input[key]>=0)out[key]=input[key];
  for(const key of ['ok','schemaSame','sentMayHaveOccurred','exitConfirmed','applyConfirmed'])if(typeof input?.[key]==='boolean')out[key]=input[key];
  if(['schema','draft','apply','plan'].includes(input?.route))out.route=input.route;
  if(AUTHOR_DIAGNOSTIC_STAGES.has(input?.stage))out.stage=input.stage;
  if(typeof input?.code==='string')out.code=AUTHOR_DIAGNOSTIC_CODES.has(input.code)?input.code:'other';
 }catch{} // An untrusted diagnostic payload never changes the operation.
 return out;
}

export function createAuthorDiagnosticRecorder({clock=()=>performance.now(),sources={}}={}){
 const records=new Map();let serial=0,droppedTransactions=0,droppedEvents=0,last=0,clockFault=false;
 const sourcePins={};
 for(const name of ['controller','host','adapter','recorder'])if(typeof sources[name]==='string'&&/^[a-f0-9]{64}$/i.test(sources[name]))sourcePins[name]=sources[name].toUpperCase();
 const increment=n=>Math.min(Number.MAX_SAFE_INTEGER,n+1);
 const now=()=>{try{const value=clock();if(Number.isFinite(value)&&value>=last&&value<=Number.MAX_SAFE_INTEGER){last=value;return value;}}catch{}clockFault=true;return last;};
 const elapsed=(start,end)=>Math.round(Math.min(604800000,Math.max(0,end-start))*1000)/1000;
 const capture=()=>({format:'whale-author-diagnostic-v1',clockDomain:'local-monotonic-only',sources:{...sourcePins},limits:{transactions:32,eventsPerTransaction:16,exportBytes:131072},
  droppedTransactions,droppedEvents,clockFault,historyComplete:droppedTransactions===0&&droppedEvents===0,
  missingEventsProveNothing:true,records:[...records.values()].map(r=>({sequence:r.sequence,kind:r.kind,...r.fields,finished:r.finished,
   ...(r.finished?{elapsedMs:r.elapsedMs,summary:{...r.summary}}:{}),droppedEvents:r.droppedEvents,incomplete:!r.finished||r.droppedEvents>0,
   events:r.events.map(e=>({...e}))}))});
 return Object.freeze({
  begin(kind,fields){
   if(!AUTHOR_DIAGNOSTIC_KINDS.has(kind)||serial>=Number.MAX_SAFE_INTEGER)return null;
   const token=Object.freeze({});if(records.size===32){records.delete(records.keys().next().value);droppedTransactions=increment(droppedTransactions);}
   records.set(token,{sequence:++serial,kind,fields:authorDiagnosticFields(fields),start:now(),finished:false,summary:null,events:[],starts:new Map(),droppedEvents:0});return token;
  },
  event(token,event,fields){
   const r=records.get(token);if(!r){droppedEvents=increment(droppedEvents);return false;}
   if(!AUTHOR_DIAGNOSTIC_EVENTS.has(event))return false;
   if(r.events.length>=16){r.droppedEvents=increment(r.droppedEvents);droppedEvents=increment(droppedEvents);return false;}
   const time=now(),safe=authorDiagnosticFields(fields),entry={event,atMs:elapsed(r.start,time),...safe,...(r.finished?{late:true}:{})};
   if(event==='command-begin'&&safe.stage)r.starts.set(safe.stage,time);
   if(event==='command-end'&&safe.stage&&r.starts.has(safe.stage)){entry.durationMs=elapsed(r.starts.get(safe.stage),time);r.starts.delete(safe.stage);}
   r.events.push(entry);return true;
  },
  finish(token,fields){const r=records.get(token);if(!r){droppedEvents=increment(droppedEvents);return false;}if(r.finished)return false;
   r.finished=true;r.elapsedMs=elapsed(r.start,now());r.summary=authorDiagnosticFields(fields);return true;},
  snapshot:()=>capture(),
  exportJson(){const snapshot=capture();snapshot.exportDroppedTransactions=0;let text=JSON.stringify(snapshot);
   while(text.length>131072&&snapshot.records.length){snapshot.records.shift();snapshot.exportDroppedTransactions++;snapshot.historyComplete=false;text=JSON.stringify(snapshot);}
   if(text.length>131072)throw Error('diagnostic-export-limit');return text;},
 });
}

export function beginAuthorDiagnostic(recorder,kind,fields){
 if(!recorder)return AUTHOR_DIAGNOSTIC_NOOP;
 try{const token=recorder.begin(kind,fields);if(!token)return AUTHOR_DIAGNOSTIC_NOOP;
  return Object.freeze({event(event,fields){try{recorder.event(token,event,fields);}catch{}},finish(fields){try{recorder.finish(token,fields);}catch{}}});
 }catch{return AUTHOR_DIAGNOSTIC_NOOP;}
}
