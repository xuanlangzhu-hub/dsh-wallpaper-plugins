import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthorDiagnosticRecorder,beginAuthorDiagnostic} from './recorder.mjs';
test('transaction ring is bounded and evicted tokens cannot affect adjacent transactions',()=>{
 const r=createAuthorDiagnosticRecorder();const first=r.begin('adapter.apply',{generation:1});
 for(let i=0;i<40;i++){const token=r.begin('adapter.apply',{generation:i+2});r.finish(token,{ok:true});}
 assert.equal(r.event(first,'reply',{code:'author_apply_timeout'}),false);
 const s=r.snapshot();assert.equal(s.records.length,32);assert.equal(s.droppedTransactions,9);assert.equal(s.droppedEvents,1);
 assert.equal(s.historyComplete,false);assert.equal(s.records[0].generation,10);assert.equal(s.records.some(r=>r.events.length),false);
});
test('event cap preserves the terminal result and marks missing events unknown',()=>{
 const r=createAuthorDiagnosticRecorder(),t=r.begin('controller.write');for(let i=0;i<40;i++)r.event(t,'round',{round:i+1});r.finish(t,{ok:false,code:'burst-limit'});
 const s=r.snapshot();assert.equal(s.records[0].events.length,16);assert.equal(s.records[0].droppedEvents,24);assert.equal(s.records[0].incomplete,true);
 assert.equal(s.records[0].summary.code,'burst-limit');assert.equal(s.missingEventsProveNothing,true);
});
test('metadata is a whitelist; commands, author values, tokens and unknown error text never serialize',()=>{
 const secret='PRIVATE-CHAT-PATH-COMMAND-VALUE';const r=createAuthorDiagnosticRecorder({sources:{controller:'a'.repeat(64),token:secret}}),t=r.begin('controller.write',{generation:1,token:secret,values:{music:secret},revision:2});
 r.event(t,'reply',{route:'apply',code:secret,command:secret,stdout:secret,error:Error(secret)});r.finish(t,{ok:false,code:'author_apply_timeout',message:secret});
 const text=r.exportJson();assert.equal(text.includes(secret),false);assert.equal(JSON.parse(text).records[0].events[0].code,'other');
 assert.equal(JSON.parse(text).sources.controller,'A'.repeat(64));assert.equal('token' in JSON.parse(text).sources,false);
});
test('returned snapshots are detached copies and cannot mutate evidence or insert arbitrary data',()=>{
 const r=createAuthorDiagnosticRecorder(),t=r.begin('host.schema',{generation:1});r.event(t,'phase',{stage:'schema'});const s=r.snapshot();
 s.records[0].events[0].stage='PRIVATE';s.records.push({secret:'PRIVATE'});assert.equal(r.exportJson().includes('PRIVATE'),false);
});
test('unknown or copied tokens never join another recorder or fabricate a record',()=>{
 const a=createAuthorDiagnosticRecorder(),b=createAuthorDiagnosticRecorder(),t=a.begin('host.schema');
 assert.equal(b.event(t,'reply',{ok:true}),false);assert.equal(a.finish({...t},{ok:true}),false);assert.equal(b.snapshot().records.length,0);assert.equal(a.snapshot().records[0].finished,false);
});
test('phase duration uses one monotonic domain; a late child exit cannot rewrite an earlier unknown result',()=>{
 let time=0;const r=createAuthorDiagnosticRecorder({clock:()=>time}),t=r.begin('adapter.apply');time=5;r.event(t,'command-begin',{stage:'send'});time=15;r.event(t,'command-end',{stage:'send',exitConfirmed:false});
 r.finish(t,{ok:false,code:'author_apply_exit_unknown',sentMayHaveOccurred:true});time=25;r.event(t,'children-settled',{exitConfirmed:true});
 const s=r.snapshot().records[0];assert.equal(s.events[1].durationMs,10);assert.equal(s.events[2].late,true);assert.equal(s.summary.ok,false);assert.equal(s.summary.sentMayHaveOccurred,true);
});
test('throwing or backward clocks are explicit faults without throwing or negative durations',()=>{
 let n=0;const r=createAuthorDiagnosticRecorder({clock:()=>{n++;if(n===2)throw Error('clock');return n===1?100:50;}}),t=r.begin('host.draft');r.event(t,'request',{revision:1});r.finish(t,{ok:true});
 const s=r.snapshot();assert.equal(s.clockFault,true);assert.equal(s.records[0].elapsedMs,0);assert.equal(s.records[0].events[0].atMs,0);
});
test('safe span swallows begin, event and finish failures and disabled instrumentation has no callbacks',()=>{
 const fail=new Proxy({},{get(){throw Error('recorder');}});assert.doesNotThrow(()=>{const d=beginAuthorDiagnostic(fail,'controller.read');d.event('reply');d.finish({ok:true});});
 assert.doesNotThrow(()=>{const d=beginAuthorDiagnostic({begin:()=>({}),event(){throw Error('event');},finish(){throw Error('finish');}},'controller.read');d.event('reply');d.finish({ok:true});});
 assert.doesNotThrow(()=>beginAuthorDiagnostic(null,'host.schema').finish({ok:true}));
});
test('explicit export stays within the byte cap even with maximal allowed records and fields',()=>{
 const r=createAuthorDiagnosticRecorder();for(let i=0;i<32;i++){const t=r.begin('controller.write');for(let j=0;j<16;j++)r.event(t,'command-end',{generation:Number.MAX_SAFE_INTEGER,epoch:Number.MAX_SAFE_INTEGER,revision:Number.MAX_SAFE_INTEGER,round:Number.MAX_SAFE_INTEGER,ok:false,schemaSame:false,sentMayHaveOccurred:true,exitConfirmed:false,applyConfirmed:false,route:'schema',stage:'process-post',code:'author_discard_confirmation'});r.finish(t,{ok:false});}
 const s=r.snapshot(),text=r.exportJson(),exported=JSON.parse(text);assert.ok(Buffer.byteLength(text)<=131072);assert.equal(s.records.length,32);assert.ok(exported.exportDroppedTransactions>0);assert.equal(exported.historyComplete,false);
});
