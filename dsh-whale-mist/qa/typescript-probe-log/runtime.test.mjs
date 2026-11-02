import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const info=JSON.parse(fs.readFileSync(process.env.PROBE_TYPE_INPUTS,'utf8'));
const baseline=await import(pathToFileURL(info.baseline)),typed=await import(pathToFileURL(info.module));
for(const [label,api] of [['baseline',baseline],['typed',typed]]){
 test(label+': line variants preserve classification, limits and null',()=>{
  assert.equal(api.parseLogLine(' \r\n'),null);
  for(const [line,level] of [['[Desktop] ready','info'],['[Capture] recovered','warn'],['plain failure','error'],['{bad json}','error'],['{"kind":"log"}','error'],['{"other":true}','info']])assert.equal(api.parseLogLine(line).level,level);
  for(const level of ['verbose',null,1,{},['error']])assert.equal(api.parseLogLine(JSON.stringify({kind:'log',level,message:'x'})).level,'info');
  const entry=api.parseLogLine(JSON.stringify({kind:'log',level:'warn',scope:'s'.repeat(50),message:'m'.repeat(5000),detail:'d'.repeat(5000),at:99}));
  assert.equal(entry.scope.length,40);assert.equal(entry.message.length,api.MAX_MESSAGE);assert.equal(entry.detail.length,api.MAX_MESSAGE);assert.equal(entry.at,undefined);
 });
 test(label+': UTF8 Buffer chunks and every byte split preserve journal results',()=>{
  const bytes=Buffer.from('{"kind":"log","level":"error","message":"fatal"}\n[Desktop] ready\n');
  for(let split=0;split<=bytes.length;split++){
   const j=new api.ProbeJournal();j.push(bytes.subarray(0,split));j.push(bytes.subarray(split));j.finish();
   assert.deepEqual(j.snapshot().messages,['fatal','[Desktop] ready']);assert.equal(j.firstError,'fatal');assert.equal(j.errorCount,1);assert.ok(j.entries.every(x=>typeof x.at==='number'));
  }
 });
 test(label+': bounded journal, pending suffix and first error remain unchanged',()=>{
  const j=new api.ProbeJournal(2);j.push('first\nsecond\n[Desktop] normal\n');assert.equal(j.snapshot().count,2);assert.equal(j.firstError,'first');assert.equal(j.errorCount,2);
  j.push('x'.repeat(api.MAX_PENDING_TEXT+50));assert.equal(j.pending.length,api.MAX_PENDING_TEXT);j.finish();assert.equal(j.pending,'');assert.ok(j.failureText(j.entries.at(-1)).length<=301);
  assert.equal(new api.ProbeJournal().snapshot().last,null);assert.equal(new api.ProbeJournal().snapshot().firstError,null);
 });
 test(label+': existing string conversion and chunk exceptions still propagate',()=>{
  const error=Error('conversion-sentinel');assert.throws(()=>api.parseLogLine({toString(){throw error;}}),x=>x===error);
  assert.throws(()=>new api.ProbeJournal().push(null),TypeError);
 });
}
