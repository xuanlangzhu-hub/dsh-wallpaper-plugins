import { EventEmitter } from 'node:events';
import { FrameDecoder } from './frame-protocol.js';

// One latest frame. Slow HTTP clients never enqueue every produced frame.
export class FrameHub extends EventEmitter {
  constructor() {
    super(); this.latest = null; this.received = 0; this.bytes = 0; this.closed = false;
    this.startedAt = Date.now(); this.updatedAt = 0;
    this.decoder = new FrameDecoder(frame => {
      const packet = Buffer.from(frame.packet);
      this.latest = { ...frame, packet, jpeg: packet.subarray(24) };
      this.received++; this.bytes += packet.length; this.updatedAt = Date.now();
      this.emit('frame');
    });
  }
  push(bytes) { if (!this.closed) this.decoder.push(bytes); }
  close() { if (!this.closed) { this.closed = true; this.emit('end'); } }
  snapshot() { return { received: this.received, bytes: this.bytes, updatedAt: this.updatedAt,
    sourceSequence: this.latest?.sequence ?? 0, frameBytes: this.latest?.jpeg.length ?? 0,
    captureAgeMs: this.latest ? Date.now() - this.latest.capturedAt : null,
    running: !this.closed, seconds: (Date.now() - this.startedAt) / 1000 }; }
}

export function streamFrames(hub, res) {
  let blocked = false, lastSequence = -1, ended = false;
  const clean = () => { hub.off('frame', pump); hub.off('end', end); res.off('drain', drain); res.off('close', close); };
  const close = () => { ended = true; clean(); };
  const end = () => { if (ended) return; ended = true; clean(); res.end(); };
  const pump = () => {
    if (ended || blocked || !hub.latest || hub.latest.sequence === lastSequence) return;
    lastSequence = hub.latest.sequence;
    try { blocked = !res.write(hub.latest.packet); } catch { end(); }
  };
  const drain = () => { blocked = false; pump(); };
  res.writeHead(200, { 'content-type': 'application/x-whale-frames', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.flushHeaders?.();
  hub.on('frame', pump); hub.on('end', end); res.on('drain', drain); res.on('close', close);
  if (hub.closed) end(); else pump();
  return end;
}
