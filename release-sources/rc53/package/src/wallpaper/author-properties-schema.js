// Host-only projection of bounded author metadata, never raw project JSON or current WE values.
import {createHash} from 'node:crypto';
import {isSceneId} from '../detachable-contract.js';
import {AUTHOR_LIMITS,AUTHOR_SCHEMA_VERSION,isAuthorObject,isAuthorKey,safeAuthorString,validateAuthorValue,authorError} from './author-properties-contract.js';

function label(value,fallback,localization,locale){
  let text=typeof value==='string'?value:fallback;
  if(text.startsWith('ui_'))for(const lang of [...new Set([locale,'zh-chs','en-us'])]){const table=localization?.[lang];if(isAuthorObject(table)&&Object.hasOwn(table,text)&&typeof table[text]==='string'){text=table[text];break;}}
  return text.slice(0,AUTHOR_LIMITS.label*4).replace(/<[^>]*>/g,'').replace(/[<>\x00-\x1f\x7f]/g,' ').slice(0,AUTHOR_LIMITS.label).trim()||fallback;
}

export function createAuthorSchema(metadata,{locale='zh-chs'}={}){
  if(!isSceneId(metadata?.wallpaperId)||!['scene','web'].includes(metadata.type)||!['Everyone','Questionable','Mature'].includes(metadata.contentRating))throw authorError('author_metadata_invalid');
  if(!['zh-chs','en-us'].includes(locale))throw authorError('author_locale_invalid');
  const raw=metadata.properties;if(raw!==null&&raw!==undefined&&!isAuthorObject(raw))throw authorError('author_schema_invalid');
  const entries=Object.entries(raw??{});if(entries.length>AUTHOR_LIMITS.fields)throw authorError('author_schema_limit');
  const fields=[];let omittedInvalidKeys=0;
  for(const [key,input]of entries){
    if(!isAuthorKey(key)){omittedInvalidKeys++;continue;}
    const value=isAuthorObject(input)?input:{},type=typeof value.type==='string'&&value.type.length<=24?value.type:'unknown';
    const field={key,type,label:label(value.text,key,metadata.localization,locale),order:Number.isFinite(value.order)?Math.max(-1e6,Math.min(1e6,value.order)):fields.length,supported:false,reason:'unsupported-type'};
    if(Object.hasOwn(value,'condition')&&value.condition!==null&&value.condition!==undefined&&value.condition!==''){field.reason='unsupported-condition';fields.push(field);continue;}
    try{
      if(!['bool','slider','color','combo','textinput'].includes(type)){fields.push(field);continue;}
      if(type==='slider'){
        if(!Number.isFinite(value.min)||!Number.isFinite(value.max)||Math.abs(value.min)>AUTHOR_LIMITS.number||Math.abs(value.max)>AUTHOR_LIMITS.number||value.max<value.min||value.fraction!==undefined&&typeof value.fraction!=='boolean')throw authorError('slider-invalid');
        field.min=value.min;field.max=value.max;field.fraction=value.fraction===true;field.step=value.step===undefined?null:value.step;
        if(field.step!==null&&(!Number.isFinite(field.step)||field.step<=0||field.step>AUTHOR_LIMITS.number))throw authorError('slider-invalid');
      }
      if(type==='combo'){
        if(!Array.isArray(value.options)||!value.options.length||value.options.length>AUTHOR_LIMITS.options)throw authorError('combo-invalid');
        const seen=new Set();field.options=value.options.map((option,index)=>{if(!isAuthorObject(option)||!['string','boolean','number'].includes(typeof option.value)||typeof option.value==='number'&&(!Number.isFinite(option.value)||Math.abs(option.value)>AUTHOR_LIMITS.number))throw authorError('combo-invalid');if(typeof option.value==='string')safeAuthorString(option.value,128);const identity=JSON.stringify(option.value);if(seen.has(identity))throw authorError('combo-invalid');seen.add(identity);return{label:label(option.label,String(index+1),metadata.localization,locale),value:option.value};});
      }
      field.supported=true;field.defaultValue=validateAuthorValue(field,value.value);field.reason=null;
    }catch{field.supported=false;field.reason='invalid-declaration';delete field.defaultValue;delete field.options;delete field.min;delete field.max;delete field.step;delete field.fraction;}
    fields.push(field);
  }
  fields.sort((a,b)=>a.order-b.order||a.key.localeCompare(b.key,'en'));
  const schema={schemaVersion:AUTHOR_SCHEMA_VERSION,wallpaperId:metadata.wallpaperId,type:metadata.type,contentRating:metadata.contentRating,defaultsOnly:true,currentValuesKnown:false,state:entries.length===0?'empty':fields.some(f=>f.supported)?'ready':'unsupported',fields,omittedInvalidKeys};
  const fingerprint=createHash('sha256').update(JSON.stringify(schema)).digest('hex');return{...schema,fingerprint};
}
