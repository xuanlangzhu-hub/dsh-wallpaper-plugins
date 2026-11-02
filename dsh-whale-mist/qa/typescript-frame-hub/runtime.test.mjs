import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const info=JSON.parse(fs.readFileSync(process.env.HUB_TYPE_INPUTS,'utf8'));
const baseline=await import(pathToFileURL(info.baseline)),typed=await import(pathToFileURL(info.module));
function packet(sequence){
 const bytes=Buffer.alloc(28);bytes.write('WHL1');bytes.writeUInt32LE(sequence,4);bytes.writeUInt32LE(4,8);
 bytes.writeBigInt64LE(1700000000123n,12);bytes.writeUInt16LE(1280,20);bytes.writeUInt16LE(720,22);bytes.set([255,216,255,217],24);return bytes;
}
// Bottom-level HTTP IO double only; Node events and the actual Hub/decoder execute unchanged.
class Response extends EventEmitter {
 packets=[];blocked=false;ended=false;endCount=0;throwEnabled=false;throwValue=null;
 writeHead(code,headers){this.code=code;this.headers=headers;}
 flushHeaders(){this.flushed=true;}
 write(bytes){this.packets.push(Buffer.from(bytes));if(this.throwEnabled)throw this.throwValue;return !this.blocked;}
 end(){this.ended=true;this.endCount++;}
}
function scenario(api){
 const records=[],registered=[],trace={enabled:true,record(entry){records.push({...entry});}};
 const hub=new api.FrameHub({cadenceTrace:trace,runId:'hub-run'}),res=new Response();res.blocked=true;
 const stop=api.streamFrames(hub,res,{runId:'stream-run',connId:'connection',
  clientTrace:{registerConnection:id=>registered.push('client:'+id)},registerConnection:id=>registered.push('outer:'+id)});
 for(const seq of [1,3,4])hub.push(packet(seq));
 res.blocked=false;res.emit('drain');res.emit('drain');
 stop();hub.close();
 return {hub,res,records,registered};
}
for(const [label,api] of [['baseline',baseline],['typed',typed]]){
 test(label+': disabled trace stays untouched and constructor does not store clientTrace',()=>{
  const trace={enabled:false,record(){throw Error('disabled-trace-used');}};
  const hub=new api.FrameHub({cadenceTrace:trace,clientTrace:{registerConnection(){throw Error('constructor-must-not-register');}}});
  assert.equal(Object.hasOwn(hub,'clientTrace'),false);
  const res=new Response(),stop=api.streamFrames(hub,res,{connId:'conn'});hub.push(packet(1));
  assert.equal(res.headers['x-cadence-trace'],undefined);assert.equal(res.packets.length,1);
  assert.equal(hub.latest.sequence,1);assert.ok(Buffer.isBuffer(hub.latest.packet));assert.ok(Buffer.isBuffer(hub.latest.jpeg));
  assert.equal(hub.snapshot().received,1);assert.equal(hub.snapshot().frameBytes,4);
  stop();hub.close();assert.equal(hub.listenerCount('frame'),0);assert.equal(res.listenerCount('drain'),0);
 });
 test(label+': trace observes latest-frame backpressure, skipped and duplicate sequences',()=>{
  const {hub,res,records,registered}=scenario(api);
  assert.deepEqual(registered,['client:connection','outer:connection']);
  assert.deepEqual(res.packets.map(b=>b.readUInt32LE(4)),[1,4]);
  assert.equal(res.headers['x-cadence-trace'],'1');assert.equal(res.headers['x-cadence-run-id'],'stream-run');
  assert.equal(res.headers['x-cadence-connection-id'],'connection');
  const writes=records.filter(e=>e.event==='host-stream-write');assert.deepEqual(writes.map(e=>e.backpressure),[true,false]);
  assert.ok(writes.every(e=>Number.isFinite(e.durationMs)&&e.durationMs>=0));
  const skip=records.find(e=>e.reason==='latest-overwritten');assert.equal(skip.skippedFrom,2);assert.equal(skip.skippedTo,3);assert.equal(skip.skippedCount,2);
  assert.equal(records.filter(e=>e.reason==='duplicate-sequence').length,1);
  assert.ok(records.every(e=>e.clockDomain==='host-mono'&&Number.isFinite(e.atMonoMs)&&e.atMonoMs>=0));
  assert.ok(records.filter(e=>e.event==='host-hub-received').every(e=>e.runId==='hub-run'&&e.packetBytes===28&&e.capturedAt===1700000000123));
  assert.equal(hub.listenerCount('frame'),0);assert.equal(res.endCount,1);
 });
 test(label+': explicit options override hub hooks and optional client fallback remains possible',()=>{
  const hubRecords=[],streamRecords=[],registered=[];
  const hub=new api.FrameHub({cadenceTrace:{enabled:true,record:e=>hubRecords.push(e)},runId:'hub'});
  hub.clientTrace={registerConnection:id=>registered.push('fallback:'+id)};
  const first=new Response(),stop1=api.streamFrames(hub,first,{cadenceTrace:{enabled:true,record:e=>streamRecords.push(e)},
   clientTrace:{registerConnection:id=>registered.push('override:'+id)},connId:'first',runId:'stream'});
  hub.push(packet(1));assert.deepEqual(hubRecords.map(e=>e.event),['host-hub-received']);
  assert.deepEqual(streamRecords.map(e=>e.event),['host-stream-write']);stop1();
  const second=new Response(),stop2=api.streamFrames(hub,second,{connId:'second'});stop2();hub.close();
  assert.deepEqual(registered,['override:first','fallback:second']);
 });
 test(label+': write failures keep error coercion, one end and listener cleanup',()=>{
  for(const [value,message] of [[Error('sentinel'),'sentinel'],['plain','plain'],[7,'7'],[null,'null'],[{message:0},'0']]){
   const records=[],hub=new api.FrameHub({cadenceTrace:{enabled:true,record:e=>records.push(e)}}),res=new Response();
   res.throwEnabled=true;res.throwValue=value;
   const stop=api.streamFrames(hub,res,{connId:'conn'});hub.push(packet(1));
   assert.equal(records.find(e=>e.event==='host-stream-write-error').reason,message);
   assert.equal(res.endCount,1);assert.equal(hub.closed,false);assert.equal(hub.listenerCount('frame'),0);
   assert.equal(res.listenerCount('drain'),0);stop();assert.equal(res.endCount,1);hub.close();
  }
 });
 test(label+': trace callback exceptions preserve the original propagation and catch boundary',()=>{
  const sentinel=Error('trace-sentinel');
  const hub=new api.FrameHub({cadenceTrace:{enabled:true,record(){throw sentinel;}}}),res=new Response();
  const stop=api.streamFrames(hub,res,{connId:'conn'});
  assert.throws(()=>hub.push(packet(1)),e=>e===sentinel);assert.equal(hub.latest.sequence,1);assert.equal(res.packets.length,0);stop();hub.close();
  const events=[],second=new api.FrameHub({cadenceTrace:{enabled:true,record(e){events.push(e.event);if(e.event==='host-stream-write')throw sentinel;}}}),other=new Response();
  api.streamFrames(second,other,{connId:'conn'});second.push(packet(1));
  assert.deepEqual(events,['host-hub-received','host-stream-write','host-stream-write-error']);
  assert.equal(other.packets.length,1);assert.equal(other.endCount,1);assert.equal(second.listenerCount('frame'),0);second.close();
 });
 test(label+': closed hubs, aborted viewers and missing flushHeaders keep lifecycle bounds',()=>{
  const closed=new api.FrameHub();closed.close();const res=new Response(),end=api.streamFrames(closed,res,{connId:'closed'});
  assert.equal(res.endCount,1);end();assert.equal(res.endCount,1);assert.equal(closed.listenerCount('end'),0);
  const hub=new api.FrameHub(),other=new Response();other.flushHeaders=undefined;
  api.streamFrames(hub,other,{connId:'open'});hub.push(packet(1));other.emit('close');hub.push(packet(2));
  assert.equal(other.packets.length,1);assert.equal(other.endCount,0);assert.equal(hub.listenerCount('frame'),0);assert.equal(other.listenerCount('drain'),0);hub.close();
 });
}
test('baseline and typed stable IO transcripts agree after excluding clock measurements',()=>{
 function transcript(api){const {hub,res,records,registered}=scenario(api);return {
  headers:res.headers,packets:res.packets.map(b=>b.toString('hex')),registered,endCount:res.endCount,
  counts:[hub.received,hub.bytes,hub.closed,hub.latest.sequence],
  records:records.map(({atMonoMs,durationMs,...stable})=>stable)};}
 assert.deepEqual(transcript(baseline),transcript(typed));
});
