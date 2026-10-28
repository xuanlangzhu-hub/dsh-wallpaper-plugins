// Authenticated author state service, composed by the existing detachable Host.
// Apply delegates only validated stored deltas to the Host-owned adapter.
import {isSceneId} from '../detachable-contract.js';
import {createAuthorSchema} from './author-properties-schema.js';
import {AUTHOR_LIMITS,isAuthorObject,isAuthorFingerprint,authorDefaults,validateAuthorValues,planAuthorProperties,authorError} from './author-properties-contract.js';

const ROOT='/whale-author-properties';
const copy=value=>JSON.parse(JSON.stringify(value));
const ratingNames=['Everyone','Questionable','Mature'];
function context(value){
  if(!value||value.authorized!==true||typeof value.owner!=='string'||! /^[A-Za-z0-9:._-]{1,96}$/.test(value.owner)||!isSceneId(value.selectedId)||!Number.isSafeInteger(value.revision)||value.revision<0)throw authorError('author_unauthorized');
  if(!Array.isArray(value.allowedRatings)||!value.allowedRatings.length||value.allowedRatings.length>3||!value.allowedRatings.every(r=>ratingNames.includes(r)))throw authorError('author_rating_denied');
  const life=value.lifecycle;
  if(!life||!Number.isSafeInteger(life.generation)||life.generation<0||!(life.activeSceneId===null||isSceneId(life.activeSceneId))||!(life.location===null||typeof life.location==='string'&&life.location.length<=120)||typeof life.cleanupPending!=='boolean'||typeof life.busy!=='boolean')throw authorError('author_context_invalid');
  if(life.cleanupPending||life.busy)throw authorError('author_cleanup_pending');
  // Frame counters advance the renderer snapshot revision without changing the author target.
  // Compare author authority/policy/lifecycle here; the draft's own revision still guards writes.
  return{owner:value.owner,selectedId:value.selectedId,allowedRatings:[...new Set(value.allowedRatings)].sort(),lifecycle:{generation:life.generation,activeSceneId:life.activeSceneId,location:life.location,cleanupPending:life.cleanupPending,busy:life.busy}};
}

async function bodyJson(req,timeoutMs){
  if(typeof req.headers?.['content-type']!=='string'||!/^application\/json(?:;|$)/i.test(req.headers['content-type']))throw authorError('author_content_type');
  const iterator=req[Symbol.asyncIterator]();let bytes=0,parts=[],timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(authorError('author_body_timeout')),timeoutMs);});
  try{
    while(true){const next=await Promise.race([iterator.next(),deadline]);if(next.done)break;const part=Buffer.from(next.value);bytes+=part.length;if(bytes>AUTHOR_LIMITS.bodyBytes)throw authorError('author_body_limit');parts.push(part);}
    let value;try{value=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw authorError('author_body_invalid');}
    if(!isAuthorObject(value))throw authorError('author_body_invalid');return value;
  }finally{clearTimeout(timer);try{Promise.resolve(iterator.return?.()).catch(()=>{});}catch{}}
}

export function createAuthorPropertiesHost({library,readContext,locale='zh-chs',timeoutMs=1500,bodyTimeoutMs=1500,maxDrafts=AUTHOR_LIMITS.drafts,maxReads=2,root=ROOT,applyAdapter=null}={}){
  if(typeof library?.getAuthorMetadata!=='function'||typeof readContext!=='function')throw new TypeError('Author P0 needs an explicit library and authenticated controller context');
  if(!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>5000||!Number.isInteger(bodyTimeoutMs)||bodyTimeoutMs<10||bodyTimeoutMs>5000||!Number.isInteger(maxDrafts)||maxDrafts<1||maxDrafts>AUTHOR_LIMITS.drafts||!Number.isInteger(maxReads)||maxReads<1||maxReads>4)throw new TypeError('Invalid author service limits');
  if(applyAdapter&&['apply','canApply','busy','dispose'].some(name=>typeof applyAdapter[name]!=='function'))throw new TypeError('Invalid author adapter');
  if(![ROOT,'/api/author-properties'].includes(root))throw new TypeError('Invalid author route root');
  const records=new Map(),pending=new Set(),applying=new Map();let disposed=false,inFlight=0;
  const capture=req=>{if(disposed)throw authorError('author_disposed');return context(readContext(req));};
  const check=(req,ticket)=>{if(JSON.stringify(capture(req))!==JSON.stringify(ticket))throw authorError('author_context_changed');};
  const key=ticket=>JSON.stringify([ticket.owner,ticket.selectedId]);
  const delivery=record=>({revision:record.revision,state:record.delivery?.revision===record.revision&&['none','not-sent','pending','confirmed','unknown'].includes(record.delivery.state)?record.delivery.state:Object.keys(record.dirty).length?'untracked':'none'});
  const oldLabel=(key,value)=>typeof value==='string'&&value.trim()&&value.length<=160&&!/[<>\x00-\x1f\x7f]/.test(value)&&!value.startsWith('ui_')?value:key.startsWith('ui_')?'旧参数':key;
  const labelsFor=schema=>Object.fromEntries(schema.fields.filter(field=>field.supported).map(field=>[field.key,oldLabel(field.key,field.label)]));
  async function schemaFor(req,ticket){
    if(inFlight>=maxReads)throw authorError('author_read_busy');
    const controller=new AbortController();controller.authorOwner=ticket.owner;pending.add(controller);inFlight++;
    let timer,rejectGuard;
    const onAbort=()=>rejectGuard(authorError('author_cancelled'));
    const guard=new Promise((_,reject)=>{rejectGuard=reject;controller.signal.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>{reject(authorError('author_read_timeout'));controller.abort();},timeoutMs);});
    const onRequestAbort=()=>controller.abort();req.once?.('aborted',onRequestAbort);
    if(req.aborted===true)controller.abort();
    const operation=(async()=>{
      const metadata=await library.getAuthorMetadata(ticket.selectedId,{allowedRatings:ticket.allowedRatings,signal:controller.signal});
      if(controller.signal.aborted)throw authorError('author_cancelled');check(req,ticket);
      if(metadata.wallpaperId!==ticket.selectedId||!ticket.allowedRatings.includes(metadata.contentRating))throw authorError('author_rating_denied');
      return createAuthorSchema(metadata,{locale});
    })();
    operation.finally(()=>{inFlight--;pending.delete(controller);}).catch(()=>{});
    try{return await Promise.race([operation,guard]);}
    finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);req.off?.('aborted',onRequestAbort);}
  }
  async function readSchemaForGet(req,ticket){
    if(inFlight>=maxReads)throw authorError('author_read_busy');
    const controller=new AbortController();controller.authorOwner=ticket.owner;pending.add(controller);inFlight++;
    let timer,rejectGuard;
    const onAbort=()=>rejectGuard(controller.signal.reason??authorError('author_cancelled'));
    const guard=new Promise((_,reject)=>{rejectGuard=reject;controller.signal.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>{controller.abort(authorError('author_read_timeout'));reject(authorError('author_read_timeout'));},timeoutMs);});
    const onRequestAbort=()=>controller.abort(authorError('author_cancelled'));
    req.once?.('aborted',onRequestAbort);
    if(req.aborted===true)controller.abort(authorError('author_cancelled'));
    const operation=(async()=>{
      const metadata=await library.getAuthorMetadata(ticket.selectedId,{allowedRatings:ticket.allowedRatings,signal:controller.signal});
      if(controller.signal.aborted)throw(controller.signal.reason??authorError('author_cancelled'));
      check(req,ticket);
      if(metadata.wallpaperId!==ticket.selectedId||!ticket.allowedRatings.includes(metadata.contentRating))throw authorError('author_rating_denied');
      const schema=createAuthorSchema(metadata,{locale});
      let targetActive=false;
      let boundIdentity=null;
      if(applyAdapter){
        if(applyAdapter.canApply(ticket.selectedId,ticket.lifecycle.generation)){
          boundIdentity=applyAdapter.currentBoundIdentity?.()??null;
          targetActive=true;
        }else if(typeof applyAdapter.waitForReady==='function'){
          const waitResult=await applyAdapter.waitForReady(ticket.selectedId,ticket.lifecycle.generation,{signal:controller.signal});
          if(waitResult?.ok===true){
            check(req,ticket);
            boundIdentity=waitResult.boundIdentity??waitResult.target;
            if(applyAdapter.isBoundTargetCurrent&&boundIdentity){
              targetActive=applyAdapter.isBoundTargetCurrent(boundIdentity);
            }else{
              targetActive=applyAdapter.canApply(ticket.selectedId,ticket.lifecycle.generation)===true;
            }
          }else{
            // Explicitly consume wait failure: targetActive MUST NOT become true!
            targetActive=false;
            boundIdentity=null;
          }
        }else{
          targetActive=false;
        }
      }
      if(controller.signal.aborted)throw(controller.signal.reason??authorError('author_cancelled'));
      check(req,ticket);
      return {schema,targetActive,boundIdentity};
    })();
    operation.finally(()=>{inFlight--;pending.delete(controller);}).catch(()=>{});
    try{return await Promise.race([operation,guard]);}
    finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);req.off?.('aborted',onRequestAbort);}
  }
  function state(schema,ticket,{targetActive,boundIdentity}={}){
    const id=key(ticket);let record=records.get(id);
    if(!record){if(records.size>=maxDrafts)throw authorError('author_draft_limit');record={fingerprint:schema.fingerprint,revision:0,values:authorDefaults(schema),dirty:{},labels:labelsFor(schema)};records.set(id,record);}
    const stale=record.fingerprint!==schema.fingerprint,keys=Object.keys(record.dirty);
    let isTargetActive=false;
    if(typeof targetActive==='boolean'){
      isTargetActive=targetActive;
      if(isTargetActive&&applyAdapter?.isBoundTargetCurrent&&boundIdentity){
        isTargetActive=applyAdapter.isBoundTargetCurrent(boundIdentity);
      }
    }else{
      isTargetActive=applyAdapter?.canApply(ticket.selectedId,ticket.lifecycle.generation)===true;
    }
    return{ok:true,application:{available:Boolean(applyAdapter),busy:applyAdapter?.busy()===true,targetActive:isTargetActive,sent:record.sent??null},schema,draft:{revision:record.revision,stale,values:stale?null:copy(record.values),dirtyKeys:stale?[]:keys,delivery:delivery(record),source:'plugin-memory',...(stale?{staleRecord:{schemaFingerprint:record.fingerprint,revision:record.revision,keys,labels:keys.map(key=>oldLabel(key,record.labels?.[key])),delivery:delivery(record)}}:{})}};
  }
  const statusFor=code=>code==='author_unauthorized'||code==='author_rating_denied'?403:code==='author_disposed'?503:code==='author_read_timeout'||code==='author_body_timeout'?504:code==='author_read_busy'||code==='author_draft_limit'?429:code.startsWith('author_body')||code==='author_content_type'||code==='author_request_invalid'?400:409;
  return {
    async handler(req,res){
      const send=(status,value)=>{if(res.destroyed||res.writableEnded)return;if(!res.headersSent){res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');res.writeHead(status);}res.end(JSON.stringify(value));};
      try{
        const url=new URL(req.url,'http://localhost'),path=url.pathname;
        if(path===root+'/apply'&&!applyAdapter){send(404,{ok:false,error:'author_route_unknown'});return;}
        if(!((req.method==='GET'&&path===root+'/schema')||(req.method==='POST'&&[root+'/draft',root+'/plan',root+'/apply'].includes(path)))){send(404,{ok:false,error:'author_route_unknown'});return;}
        const ticket=capture(req);
        if(req.method==='GET'){
          if([...url.searchParams.keys()].some(k=>k!=='wallpaperId')||url.searchParams.getAll('wallpaperId').length!==1||url.searchParams.get('wallpaperId')!==ticket.selectedId)throw authorError('author_request_invalid');
          const {schema,targetActive,boundIdentity}=await readSchemaForGet(req,ticket);
          check(req,ticket);
          let verifiedTargetActive=targetActive;
          if(verifiedTargetActive&&applyAdapter){
            if(applyAdapter.isBoundTargetCurrent&&boundIdentity){
              verifiedTargetActive=applyAdapter.isBoundTargetCurrent(boundIdentity);
            }else if(!applyAdapter.canApply(ticket.selectedId,ticket.lifecycle.generation)){
              verifiedTargetActive=false;
            }
          }
          send(200,state(schema,ticket,{targetActive:verifiedTargetActive,boundIdentity}));
          return;
        }
        if(url.search)throw authorError('author_request_invalid');
        const body=await bodyJson(req,bodyTimeoutMs);check(req,ticket);
        const isApply=path===root+'/apply',isPlan=path===root+'/plan',allowed=isPlan||isApply?['wallpaperId','schemaFingerprint','expectedRevision']:['wallpaperId','schemaFingerprint','expectedRevision','values','action','discardKeys','acknowledgeUnknown','previousSchemaFingerprint','expectedDelivery','confirmDiscard'];
        if(Object.keys(body).some(k=>!allowed.includes(k))||body.wallpaperId!==ticket.selectedId||!isAuthorFingerprint(body.schemaFingerprint)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw authorError('author_request_invalid');
        if(!isPlan&&!(body.action===undefined||['set','reset','discard','refresh-schema','discard-stale-schema'].includes(body.action)))throw authorError('author_request_invalid');
        const isDiscard=!isApply&&!isPlan&&body.action==='discard',isStaleDiscard=!isApply&&!isPlan&&body.action==='discard-stale-schema';
        if(!isDiscard&&!isStaleDiscard&&(body.discardKeys!==undefined||body.acknowledgeUnknown!==undefined))throw authorError('author_request_invalid');
        if(!isStaleDiscard&&(body.previousSchemaFingerprint!==undefined||body.expectedDelivery!==undefined||body.confirmDiscard!==undefined))throw authorError('author_request_invalid');
        const schema=await schemaFor(req,ticket);check(req,ticket);
        const record=records.get(key(ticket));
        if(!record||record.revision!==body.expectedRevision)throw authorError('author_revision_conflict');
        if(schema.fingerprint!==body.schemaFingerprint)throw authorError('author_schema_changed');
        if(isApply){
          if(!applyAdapter)throw authorError('author_apply_unavailable');
          if(record.fingerprint!==schema.fingerprint)throw authorError('author_schema_stale');
          // Successful sends clear the dirty delta; a repeated click cannot replay old defaults.
          if(applyAdapter.busy())throw authorError('author_apply_busy');
          const plan=planAuthorProperties(schema,record.dirty,ticket.lifecycle),controller=new AbortController();
          const token={controller,owner:ticket.owner};applying.set(token,token);
          const inheritedUnknown=Object.keys(record.dirty).length>0&&delivery(record).state!=='not-sent';
          record.delivery={revision:record.revision,state:'pending'};
          const abort=()=>controller.abort();const closed=()=>{if(!res.writableEnded)abort();};
          req.once?.('aborted',abort);res.once?.('close',closed);
          const checkRecord=()=>{check(req,ticket);if(records.get(key(ticket))!==record)throw authorError('author_revision_conflict');};
          try{
            const result=await applyAdapter.apply(plan,{signal:controller.signal,check:checkRecord,validate:async()=>{
              const latest=await schemaFor(req,ticket);checkRecord();if(latest.fingerprint!==schema.fingerprint)throw authorError('author_schema_changed');
            }});
            try{checkRecord();}catch(error){throw Object.assign(error,{sentMayHaveOccurred:result?.sent===true});}
            if(result?.ok!==true||result.sent!==true)throw authorError('author_apply_uncertain');
            record.dirty={};record.sent={revision:record.revision,generation:ticket.lifecycle.generation};
            record.delivery={revision:record.revision,state:'confirmed'};
            send(200,{...state(schema,ticket),applySent:true,currentValuesKnown:false});return;
          }catch(error){
            if(records.get(key(ticket))===record)record.delivery={revision:record.revision,state:inheritedUnknown||error?.sentMayHaveOccurred===true||!error?.authorReason||error.authorReason==='author_apply_uncertain'?'unknown':'not-sent'};
            throw error;
          }finally{applying.delete(token);req.off?.('aborted',abort);res.off?.('close',closed);}
        }
        if(isPlan){
          if(record.fingerprint!==schema.fingerprint)throw authorError('author_schema_stale');
          send(200,{ok:true,plan:planAuthorProperties(schema,record.dirty,ticket.lifecycle),draftRevision:record.revision});return;
        }
        if(applyAdapter?.busy())throw authorError('author_apply_busy');
        if(record.revision>=Number.MAX_SAFE_INTEGER)throw authorError('author_revision_limit');
        if(isStaleDiscard){
          if(body.values!==undefined||body.confirmDiscard!==true||!isAuthorFingerprint(body.previousSchemaFingerprint)||typeof body.acknowledgeUnknown!=='boolean'||!isAuthorObject(body.expectedDelivery)||Object.keys(body.expectedDelivery).sort().join(',')!=='revision,state')throw authorError('author_request_invalid');
          if(applying.size||delivery(record).state==='pending')throw authorError('author_apply_busy');
          if(applyAdapter?.canApply(ticket.selectedId,ticket.lifecycle.generation)!==true)throw authorError('author_target_inactive');
          if(record.fingerprint===schema.fingerprint)throw authorError('author_schema_unchanged');
          if(record.fingerprint!==body.previousSchemaFingerprint)throw authorError('author_schema_stale');
          const keys=Object.keys(record.dirty),proof=delivery(record);
          if(!keys.length&&['none','confirmed'].includes(proof.state))throw authorError('author_no_changes');
          if(proof.state==='pending')throw authorError('author_apply_busy');
          if(proof.state!=='not-sent'&&!body.acknowledgeUnknown)throw authorError('author_discard_confirmation');
          check(req,ticket);records.set(key(ticket),{...record,fingerprint:schema.fingerprint,revision:record.revision+1,dirty:{},delivery:{revision:record.revision+1,state:'none'}});
          send(200,{...state(schema,ticket),mutation:'discard-stale-schema',discarded:true,currentValuesKnown:false});return;
        }
        if(isDiscard){
          if(record.fingerprint!==schema.fingerprint)throw authorError('author_schema_stale');
          const keys=Object.keys(record.dirty),proof=delivery(record);
          if(!keys.length)throw authorError('author_no_changes');
          if(body.values!==undefined||typeof body.acknowledgeUnknown!=='boolean'||!Array.isArray(body.discardKeys)||body.discardKeys.length!==keys.length||new Set(body.discardKeys).size!==keys.length||body.discardKeys.some(key=>!keys.includes(key)))throw authorError('author_request_invalid');
          if(proof.state==='pending')throw authorError('author_apply_busy');
          if(proof.state!=='not-sent'&&!body.acknowledgeUnknown)throw authorError('author_discard_confirmation');
          // CAS and mutation are synchronous. This only clears pending intent; never executes or rolls back WE.
          check(req,ticket);records.set(key(ticket),{...record,revision:record.revision+1,dirty:{},delivery:{revision:record.revision+1,state:'none'}});
          send(200,{...state(schema,ticket),mutation:'discard',discarded:true,currentValuesKnown:false});return;
        }
        let values,dirty;
        if(body.action==='reset'){if(body.values!==undefined)throw authorError('author_request_invalid');values=authorDefaults(schema);dirty={...values};}
        else{
          if(record.fingerprint!==schema.fingerprint)throw authorError('author_schema_stale');
          const patch=validateAuthorValues(schema,body.values,{partial:true});if(!Object.keys(patch).length)throw authorError('author_no_changes');values=validateAuthorValues(schema,{...record.values,...patch});dirty={...record.dirty,...patch};
        }
        // No await between the revision comparison and this sole mutation; concurrent tabs conflict.
        const inheritedUnknown=Object.keys(record.dirty).length>0&&delivery(record).state!=='not-sent';
        check(req,ticket);records.set(key(ticket),{fingerprint:schema.fingerprint,revision:record.revision+1,values,dirty,labels:labelsFor(schema),delivery:{revision:record.revision+1,state:inheritedUnknown?'unknown':'not-sent'}});send(200,{...state(schema,ticket),mutation:body.action==='reset'?'reset':'set'});
      }catch(error){const raw=error?.authorReason??error?.catalogReason;const code=typeof raw==='string'&&/^[a-z_]{1,64}$/.test(raw)?raw:'author_unavailable';send(statusFor(code),{ok:false,error:code,...(error?.sentMayHaveOccurred?{sentMayHaveOccurred:true}:{})});}
    },
    dispose(){
      disposed=true;
      for(const {controller}of applying.values())controller.abort(authorError('author_disposed'));
      for(const controller of pending)controller.abort(authorError('author_disposed'));
      records.clear();
      return applyAdapter?.dispose()??{ok:true};
    },
    clearOwner(owner){for(const token of applying.values())if(token.owner===owner)token.controller.abort();for(const controller of pending)if(controller.authorOwner===owner)controller.abort();for(const k of records.keys())if(JSON.parse(k)[0]===owner)records.delete(k);},
    diagnostics:()=>({drafts:records.size,inFlight,disposed}),
  };
}

/** Explicit P0 registration seam, exercised by offline tests; no default production registration. */
export function registerAuthorPropertiesRoutes(ctx,options){
  const host=createAuthorPropertiesHost(options);
  ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:ROOT,handler:host.handler}));
  ctx.effect(()=>()=>host.dispose());return host;
}
