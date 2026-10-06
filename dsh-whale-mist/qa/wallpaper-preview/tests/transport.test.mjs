import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FrameDecoder, MAX_FRAME_BYTES } from '../frame-protocol.js';
import { FrameHub, streamFrames } from '../frame-hub.js';

function packet(sequence, body = Buffer.from([255, 216, 255, 217])) {
  const bytes = Buffer.alloc(24 + body.length); bytes.write('WHL1');
  bytes.writeUInt32LE(sequence, 4); bytes.writeUInt32LE(body.length, 8); bytes.writeBigInt64LE(1700000000123n, 12);
  bytes.writeUInt16LE(1280, 20); bytes.writeUInt16LE(720, 22); body.copy(bytes, 24); return bytes;
}
test('decoder handles every split point and multiple frames per chunk', () => {
  const bytes = Buffer.concat([packet(1), packet(2), packet(3)]);
  for (let split = 0; split <= bytes.length; split++) {
    const found = [], decoder = new FrameDecoder(frame => found.push(frame.sequence));
    decoder.push(bytes.subarray(0, split)); decoder.push(bytes.subarray(split)); decoder.finish();
    assert.deepEqual(found, [1, 2, 3]);
  }
});
test('reject invalid magic, oversized frames, invalid dimensions, and truncated bodies', () => {
  for (const mutate of [b => b.write('BAD!'), b => b.writeUInt32LE(MAX_FRAME_BYTES + 1, 8), b => b.writeUInt16LE(0, 20)]) {
    const bytes = packet(1); mutate(bytes); assert.throws(() => new FrameDecoder(() => {}).push(bytes));
  }
  const decoder = new FrameDecoder(() => {}); decoder.push(packet(1).subarray(0, 25)); assert.throws(() => decoder.finish(), /Truncated/);
});
test('native C# encoder interoperates with JS decoder', () => {
  const exe = fileURLToPath(new URL('../../wallpaper-probe/bin/Release/net10.0-windows10.0.19041.0/WallpaperProbe.exe', import.meta.url));
  const result = spawnSync(exe, ['--self-test-pipe'], { windowsHide: true, timeout: 5000 });
  assert.equal(result.status, 0, result.stderr?.toString());
  const frames = [], decoder = new FrameDecoder(frame => frames.push(frame)); decoder.push(result.stdout); decoder.finish();
  assert.equal(frames.length, 1); assert.equal(frames[0].sequence, 7); assert.equal(frames[0].capturedAt, 1700000000123);
  assert.equal(frames[0].width, 1280); assert.equal(frames[0].height, 720); assert.deepEqual([...frames[0].jpeg], [255, 216, 255, 217]);
});
class Response extends EventEmitter {
  packets = []; blocked = false; ended = false;
  writeHead(code) { this.code = code; }
  flushHeaders() {}
  write(bytes) { this.packets.push(Buffer.from(bytes)); return !this.blocked; }
  end() { this.ended = true; }
}
test('slow viewer receives only the newest frame after drain, with bounded retention', () => {
  const hub = new FrameHub(), res = new Response(); res.blocked = true; streamFrames(hub, res);
  hub.push(packet(1)); for (let sequence = 2; sequence <= 1000; sequence++) hub.push(packet(sequence));
  assert.equal(res.packets.length, 1); assert.equal(hub.latest.sequence, 1000); assert.equal(hub.latest.packet.length, 28);
  res.blocked = false; res.emit('drain');
  assert.deepEqual(res.packets.map(bytes => bytes.readUInt32LE(4)), [1, 1000]);
  res.emit('close'); assert.equal(hub.listenerCount('frame'), 0); assert.equal(hub.listenerCount('end'), 0);
});
test('capture EOF closes viewers and detach prevents delivery after abort', () => {
  const hub = new FrameHub(), res = new Response(); streamFrames(hub, res); hub.push(packet(1)); hub.close();
  assert.equal(res.ended, true); assert.equal(hub.listenerCount('frame'), 0); assert.equal(res.listenerCount('drain'), 0);
  hub.push(packet(2)); assert.equal(res.packets.length, 1);
});
