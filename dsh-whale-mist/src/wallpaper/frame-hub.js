import { EventEmitter } from 'node:events';
import { FrameDecoder } from './frame-protocol.js';

// One latest frame. Slow HTTP clients never enqueue every produced frame.
export class FrameHub extends EventEmitter {
  constructor(options = {}) {
    super(); this.latest = null; this.received = 0; this.bytes = 0; this.closed = false;
    this.startedAt = Date.now(); this.updatedAt = 0;
    this.cadenceTrace = options.cadenceTrace ?? null;
    this.runId = options.runId ?? '';
    this.decoder = new FrameDecoder(frame => {
      const atMonoMs = this.cadenceTrace?.enabled && typeof performance !== 'undefined' ? performance.now() : 0;
      const packet = Buffer.from(frame.packet);
      this.latest = { ...frame, packet, jpeg: packet.subarray(24) };
      this.received++; this.bytes += packet.length; this.updatedAt = Date.now();
      if (this.cadenceTrace?.enabled) {
        this.cadenceTrace.record({
          runId: this.runId,
          sequence: frame.sequence,
          clockDomain: 'host-mono',
          event: 'host-hub-received',
          atMonoMs,
          capturedAt: frame.capturedAt,
          packetBytes: packet.length,
        });
      }
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

export function streamFrames(hub, res, options = {}) {
  const cadenceTrace = options.cadenceTrace ?? hub.cadenceTrace ?? null;
  const clientTrace = options.clientTrace ?? hub.clientTrace ?? null;
  const runId = options.runId ?? hub.runId ?? '';
  const connId = options.connId ?? `conn-${Math.random().toString(16).slice(2, 8)}`;
  if (clientTrace?.registerConnection) clientTrace.registerConnection(connId);
  if (typeof options.registerConnection === 'function') options.registerConnection(connId);
  let blocked = false, lastSequence = -1, ended = false;
  const mono = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();
  const clean = () => { hub.off('frame', pump); hub.off('end', end); res.off('drain', drain); res.off('close', close); };
  const close = () => { ended = true; clean(); };
  const end = () => { if (ended) return; ended = true; clean(); res.end(); };
  const pump = () => {
    if (ended || blocked || !hub.latest) return;
    if (hub.latest.sequence === lastSequence) {
      if (cadenceTrace?.enabled) {
        cadenceTrace.record({
          runId,
          sequence: hub.latest.sequence,
          clockDomain: 'host-mono',
          event: 'host-stream-skip',
          atMonoMs: mono(),
          connectionId: connId,
          reason: 'duplicate-sequence',
        });
      }
      return;
    }
    const seq = hub.latest.sequence;
    if (lastSequence >= 0 && seq > lastSequence + 1) {
      if (cadenceTrace?.enabled) {
        cadenceTrace.record({
          runId,
          sequence: seq,
          clockDomain: 'host-mono',
          event: 'host-stream-skip',
          atMonoMs: mono(),
          connectionId: connId,
          reason: 'latest-overwritten',
          skippedFrom: lastSequence + 1,
          skippedTo: seq - 1,
          skippedCount: seq - lastSequence - 1,
        });
      }
    }
    lastSequence = seq;
    const writeStart = cadenceTrace?.enabled ? mono() : 0;
    try {
      const writeResult = res.write(hub.latest.packet);
      blocked = !writeResult;
      if (cadenceTrace?.enabled) {
        const writeEnd = mono();
        cadenceTrace.record({
          runId,
          sequence: seq,
          clockDomain: 'host-mono',
          event: 'host-stream-write',
          atMonoMs: writeStart,
          durationMs: writeEnd - writeStart,
          backpressure: blocked,
          connectionId: connId,
        });
      }
    } catch (err) {
      if (cadenceTrace?.enabled) {
        cadenceTrace.record({
          runId,
          sequence: seq,
          clockDomain: 'host-mono',
          event: 'host-stream-write-error',
          atMonoMs: writeStart,
          connectionId: connId,
          reason: String(err?.message ?? err),
        });
      }
      end();
    }
  };
  const drain = () => {
    blocked = false;
    if (cadenceTrace?.enabled) {
      cadenceTrace.record({
        runId,
        sequence: lastSequence,
        clockDomain: 'host-mono',
        event: 'host-stream-drain',
        atMonoMs: mono(),
        connectionId: connId,
      });
    }
    pump();
  };
  const headers = { 'content-type': 'application/x-whale-frames', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (cadenceTrace?.enabled) {
    headers['x-cadence-trace'] = '1';
    if (runId) headers['x-cadence-run-id'] = runId;
    if (connId) headers['x-cadence-connection-id'] = connId;
  }
  res.writeHead(200, headers);
  res.flushHeaders?.();
  hub.on('frame', pump); hub.on('end', end); res.on('drain', drain); res.on('close', close);
  if (hub.closed) end(); else pump();
  return end;
}
