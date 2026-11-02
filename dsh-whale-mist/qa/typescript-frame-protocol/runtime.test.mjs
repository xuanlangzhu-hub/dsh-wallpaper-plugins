import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const info=JSON.parse(fs.readFileSync(process.env.FRAME_TYPE_INPUTS,'utf8'));
const baseline=await import(pathToFileURL(info.baseline)),typed=await import(pathToFileURL(info.module));
function packet(sequence=1){const bytes=Buffer.alloc(28);bytes.write('WHL1');bytes.writeUInt32LE(sequence,4);bytes.writeUInt32LE(4,8);bytes.writeBigInt64LE(1700000000123n,12);bytes.writeUInt16LE(1280,20);bytes.writeUInt16LE(720,22);bytes.set([255,216,255,217],24);return bytes;}
for(const [label,{FrameDecoder,MAX_FRAME_BYTES}] of [['baseline',baseline],['typed',typed]]){
 test(label+': every split and multiple frames use the same actual decoder',()=>{
  const bytes=Buffer.concat([packet(1),packet(2),packet(3)]);
  for(let split=0;split<=bytes.length;split++){
   const frames=[],decoder=new FrameDecoder(f=>frames.push(f));decoder.push(bytes.subarray(0,split));decoder.push(bytes.subarray(split));decoder.finish();
   assert.deepEqual(frames.map(x=>x.sequence),[1,2,3]);assert.deepEqual([...frames[0].jpeg],[255,216,255,217]);assert.equal(frames[0].width,1280);assert.equal(frames[0].height,720);assert.equal(frames[0].capturedAt,1700000000123);
  }
 });
 test(label+': corrupted magic and all existing bounds are still rejected',()=>{
  for(const mutate of [b=>b.write('BAD!'),b=>b.writeUInt32LE(0,8),b=>b.writeUInt32LE(MAX_FRAME_BYTES+1,8),b=>b.writeUInt16LE(0,20),b=>b.writeUInt16LE(16385,20),b=>b.writeUInt16LE(0,22),b=>b.writeUInt16LE(16385,22),b=>b.writeBigInt64LE(0n,12),b=>b.writeBigInt64LE(-1n,12),b=>b.writeBigInt64LE(BigInt(Number.MAX_SAFE_INTEGER)+1n,12)]){
   const bytes=packet();mutate(bytes);assert.throws(()=>new FrameDecoder(()=>{}).push(bytes),/Invalid/);
  }
 });
 test(label+': truncated headers and bodies still fail finish',()=>{
  for(const size of [1,23,24,27]){const decoder=new FrameDecoder(()=>{});decoder.push(packet().subarray(0,size));assert.throws(()=>decoder.finish(),/Truncated/);}
 });
 test(label+': bad input and oversized chunks retain runtime guards',()=>{
  const decoder=new FrameDecoder(()=>{});for(const input of ['bad',null,{},new DataView(new ArrayBuffer(8))])assert.throws(()=>decoder.push(input),/Expected byte buffer/);
  assert.throws(()=>decoder.push(new Uint8Array(32*1024*1024+1)),/Oversized input chunk/);
 });
 test(label+': offset views, SharedArrayBuffer and empty input work',()=>{
  const bytes=packet(0xffffffff),padded=new Uint8Array(33);padded.set(bytes,3);const frames=[],decoder=new FrameDecoder(f=>frames.push(f));decoder.push(padded.subarray(3,31));decoder.push(new Uint8Array(0));decoder.finish();assert.equal(frames[0].sequence,0xffffffff);
  const shared=new Uint8Array(new SharedArrayBuffer(bytes.length));shared.set(bytes);decoder.push(shared);decoder.finish();assert.equal(frames.length,2);
 });
 test(label+': callback errors propagate without annotation changing control flow',()=>{const error=Error('callback-sentinel');assert.throws(()=>new FrameDecoder(()=>{throw error;}).push(packet()),x=>x===error);});
}
