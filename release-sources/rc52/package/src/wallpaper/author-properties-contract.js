// Shared by the future docked/detached forms and Host. No Node, DOM, eval or command execution.
import {isSceneId} from '../detachable-contract.js';
import {validateLocation} from './managed-window.js';

export const AUTHOR_SCHEMA_VERSION=1;
export const AUTHOR_LIMITS=Object.freeze({fields:256,options:64,label:160,text:256,key:64,number:1e6,bodyBytes:32768,drafts:32});
const banned=new Set(['__proto__','constructor','prototype']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
export const authorError=code=>Object.assign(new Error(code),{authorReason:code});
export const isAuthorKey=value=>typeof value==='string'&&/^[A-Za-z0-9_]{1,64}$/.test(value)&&!banned.has(value.toLowerCase());
export const isAuthorFingerprint=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
export const isAuthorObject=plain;
export function safeAuthorString(value,max=AUTHOR_LIMITS.text){
  if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f<>]/.test(value)||value.includes(')~END')||value.includes('RAW~(')||/^(?:[a-z]:[\\/]|\\\\|file:)/i.test(value))throw authorError('author_string_invalid');
  return value;
}

export function validateAuthorValue(field,value){
  if(!field||field.supported!==true||!isAuthorKey(field.key))throw authorError('author_field_unsupported');
  if(field.type==='bool'){if(typeof value!=='boolean')throw authorError('author_value_invalid');return value;}
  if(field.type==='slider'){
    if(!Number.isFinite(field.min)||!Number.isFinite(field.max)||field.min>field.max||Math.abs(field.min)>AUTHOR_LIMITS.number||Math.abs(field.max)>AUTHOR_LIMITS.number||typeof field.fraction!=='boolean'||field.step!==null&&field.step!==undefined&&(!Number.isFinite(field.step)||field.step<=0))throw authorError('author_schema_invalid');
    if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>AUTHOR_LIMITS.number||value<field.min||value>field.max||(!field.fraction&&!Number.isInteger(value)))throw authorError('author_value_invalid');
    if(field.step!==null&&field.step!==undefined){const n=(value-field.min)/field.step;if(!Number.isFinite(n)||Math.abs(n-Math.round(n))>1e-7)throw authorError('author_step_invalid');}
    return Object.is(value,-0)?0:value;
  }
  if(field.type==='color'){
    if(typeof value!=='string'||value.length>96||!/^\s*\d*\.?\d+(?:[eE][+-]?\d+)?\s+\d*\.?\d+(?:[eE][+-]?\d+)?\s+\d*\.?\d+(?:[eE][+-]?\d+)?\s*$/.test(value))throw authorError('author_color_invalid');
    const rgb=value.trim().split(/\s+/).map(Number);if(rgb.some(n=>!Number.isFinite(n)||n<0||n>1))throw authorError('author_color_invalid');return rgb.join(' ');
  }
  if(field.type==='textinput')return safeAuthorString(value);
  if(field.type==='combo'){
    if(!['string','boolean','number'].includes(typeof value)||typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>AUTHOR_LIMITS.number))throw authorError('author_value_invalid');
    if(typeof value==='string')safeAuthorString(value,128);
    if(!Array.isArray(field.options)||!field.options.some(o=>Object.is(o.value,value)))throw authorError('author_option_invalid');return value;
  }
  throw authorError('author_field_unsupported');
}

export function validateAuthorValues(schema,values,{partial=false}={}){
  if(!plain(values)||!Array.isArray(schema?.fields)||schema.fields.length>AUTHOR_LIMITS.fields)throw authorError('author_values_invalid');
  const fields=new Map(schema.fields.filter(f=>f.supported===true).map(f=>[f.key,f]));const keys=Object.keys(values);
  if(keys.length>AUTHOR_LIMITS.fields||!partial&&keys.length!==fields.size)throw authorError('author_values_invalid');
  const result=Object.create(null);
  for(const key of keys){if(!isAuthorKey(key)||!fields.has(key))throw authorError('author_key_invalid');result[key]=validateAuthorValue(fields.get(key),values[key]);}
  if(!partial&&[...fields.keys()].some(key=>!Object.hasOwn(result,key)))throw authorError('author_values_invalid');return result;
}

export function authorDefaults(schema){const values=Object.create(null);for(const field of schema.fields??[])if(field.supported)values[field.key]=validateAuthorValue(field,field.defaultValue);return values;}

/** A preview only. P0 contains no executable/path or IO adapter. Location can never be omitted. */
export function planAuthorProperties(schema,values,lifecycle){
  if(!isSceneId(schema?.wallpaperId)||!isAuthorFingerprint(schema?.fingerprint)||!lifecycle||lifecycle.activeSceneId!==schema.wallpaperId||lifecycle.cleanupPending||lifecycle.busy||!Number.isSafeInteger(lifecycle.generation)||lifecycle.generation<0)throw authorError('author_target_inactive');
  const location=validateLocation(lifecycle.location),validated=validateAuthorValues(schema,values,{partial:true});
  if(!Object.keys(validated).length)throw authorError('author_no_fields');
  const json=JSON.stringify(validated);if(json.length>AUTHOR_LIMITS.bodyBytes||json.includes(')~END')||json.includes('RAW~('))throw authorError('author_plan_invalid');
  return {planOnly:true,executed:false,wallpaperId:schema.wallpaperId,schemaFingerprint:schema.fingerprint,generation:lifecycle.generation,location,args:['-control','applyProperties','-properties',`RAW~(${json})~END`,'-location',location]};
}

/** Ephemeral per-wallpaper form state; response tickets and revisions prevent late A overwriting B. */
export function createAuthorFormModel({maxDrafts=16}={}){
  if(!Number.isInteger(maxDrafts)||maxDrafts<1||maxDrafts>AUTHOR_LIMITS.drafts)throw authorError('author_limit_invalid');
  const drafts=new Map();let selectedId=null,sequence=0;
  const copy=value=>JSON.parse(JSON.stringify(value));
  return {
    select(id){if(!isSceneId(id))throw authorError('author_id_invalid');selectedId=id;sequence++;return this.ticket();},
    ticket(){sequence++;return {wallpaperId:selectedId,sequence};},
    accept(ticket,response){
      if(ticket?.sequence!==sequence||ticket.wallpaperId!==selectedId||response?.schema?.wallpaperId!==selectedId)return false;
      const {schema,draft}=response;if(schema.schemaVersion!==AUTHOR_SCHEMA_VERSION||!isAuthorFingerprint(schema.fingerprint)||!Number.isSafeInteger(draft?.revision)||draft.revision<0)throw authorError('author_response_invalid');
      const prior=drafts.get(selectedId);if(prior&&draft.revision<prior.draft.revision)return false;
      if(!prior&&drafts.size>=maxDrafts)throw authorError('author_draft_limit');
      let values=draft.stale?null:validateAuthorValues(schema,draft.values);const dirtyKeys=Array.isArray(draft.dirtyKeys)?draft.dirtyKeys:[];if(dirtyKeys.length>AUTHOR_LIMITS.fields||dirtyKeys.some(key=>!isAuthorKey(key)||!schema.fields.some(f=>f.supported&&f.key===key)))throw authorError('author_response_invalid');
      let pending={},stale=draft.stale===true;
      if(prior&&response.mutation!=='reset'){
        if(Object.keys(prior.pending).length&&(stale||prior.schema.fingerprint!==schema.fingerprint)){pending=copy(prior.pending);stale=true;values=null;}
        else if(values!==null){for(const[key,value]of Object.entries(prior.pending))if(!Object.is(values[key],value)){pending[key]=validateAuthorValue(schema.fields.find(f=>f.key===key),value);values[key]=value;}}
      }
      drafts.set(selectedId,{schema:copy(schema),draft:{revision:draft.revision,stale,values:values===null?null:copy(values),dirtyKeys:[...dirtyKeys]},pending});return true;
    },
    edit(patch){const current=drafts.get(selectedId);if(!current||current.draft.stale)throw authorError('author_schema_stale');const values=validateAuthorValues(current.schema,patch,{partial:true});current.draft.values={...current.draft.values,...values};current.pending={...current.pending,...values};sequence++;return this.snapshot();},
    request(){const current=drafts.get(selectedId);if(!current||current.draft.stale)throw authorError('author_schema_stale');if(!Object.keys(current.pending).length)throw authorError('author_no_changes');return{wallpaperId:selectedId,schemaFingerprint:current.schema.fingerprint,expectedRevision:current.draft.revision,values:copy(current.pending)};},
    planRequest(){const current=drafts.get(selectedId);if(!current||current.draft.stale||Object.keys(current.pending).length)throw authorError('author_schema_stale');return{wallpaperId:selectedId,schemaFingerprint:current.schema.fingerprint,expectedRevision:current.draft.revision};},
    resetRequest(){const current=drafts.get(selectedId);if(!current)throw authorError('author_schema_stale');return{wallpaperId:selectedId,schemaFingerprint:current.schema.fingerprint,expectedRevision:current.draft.revision,action:'reset'};},
    snapshot(){const current=drafts.get(selectedId);return current?copy({wallpaperId:selectedId,...current}):null;},
    clear(){drafts.clear();selectedId=null;sequence++;},
  };
}
