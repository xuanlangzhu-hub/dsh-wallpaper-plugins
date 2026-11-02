"""Restore only stale-record clear proof/CAS semantics on the fixed Host.

Do not copy the development Host: that would remove the fixed capture-ready read path.
"""
from pathlib import Path
import difflib,hashlib,json
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda b:hashlib.sha256(b).hexdigest().upper()
def prepare_host(out):
 pins=json.loads((HERE/'baseline.json').read_bytes());name='src/wallpaper/author-properties-host.js';source=ROOT/pins['fixedRuntime']/name
 raw=source.read_bytes();assert sha(raw)==pins['runtimeInputs'][name]
 text=raw.decode('utf-8');old="""          const keys=Object.keys(record.dirty),proof=delivery(record);
          if(!keys.length&&['none','confirmed'].includes(proof.state))throw authorError('author_no_changes');
          if(proof.state==='pending')throw authorError('author_apply_busy');
          if(proof.state!=='not-sent'&&!body.acknowledgeUnknown)throw authorError('author_discard_confirmation');
          check(req,ticket);records.set(key(ticket),{...record,fingerprint:schema.fingerprint,revision:record.revision+1,dirty:{},delivery:{revision:record.revision+1,state:'none'}});
          send(200,{...state(schema,ticket),mutation:'discard-stale-schema',discarded:true,currentValuesKnown:false});return;"""
 new="""          const keys=Object.keys(record.dirty),proof=delivery(record);
          if(!keys.length&&['none','confirmed'].includes(proof.state))throw authorError('author_no_changes');
          if(proof.state==='pending')throw authorError('author_apply_busy');
          if(!Array.isArray(body.discardKeys)||body.discardKeys.length!==keys.length||new Set(body.discardKeys).size!==keys.length||body.discardKeys.some(key=>!keys.includes(key)))throw authorError('author_request_invalid');
          if(body.expectedDelivery.revision!==proof.revision||body.expectedDelivery.state!==proof.state)throw authorError('author_delivery_changed');
          if(proof.state!=='not-sent'&&!body.acknowledgeUnknown)throw authorError('author_discard_confirmation');
          const discardedRecord={schemaFingerprint:record.fingerprint,revision:record.revision,keys,delivery:proof};
          // Clear reviewed old local intent; new defaults remain clean and are never sent.
          check(req,ticket);records.set(key(ticket),{fingerprint:schema.fingerprint,revision:record.revision+1,values:authorDefaults(schema),dirty:{},labels:labelsFor(schema),delivery:{revision:record.revision+1,state:'none'}});
          send(200,{...state(schema,ticket),mutation:'discard-stale-schema',discarded:true,refreshed:true,discardedRecord,currentValuesKnown:false});return;"""
 assert text.count(old)==1
 changed=text.replace(old,new);out=Path(out);assert not out.exists();out.mkdir()
 (out/'author-properties-host.js').write_text(changed,encoding='utf-8',newline='\n')
 (out/'host.patch').write_text(''.join(difflib.unified_diff(text.splitlines(True),changed.splitlines(True),fromfile='rc56/author-properties-host.js',tofile='repair/author-properties-host.js')),encoding='utf-8')
 result={'inputSha256':sha(raw),'outputSha256':sha((out/'author-properties-host.js').read_bytes()),'fixedCaptureReadyReadAndDisposeKept':True,'scope':'stale local record clear only; exact key/delivery proof and clean defaults/receipt; no WE send'}
 (out/'receipt.json').write_text(json.dumps(result,indent=2),encoding='utf-8');return result
