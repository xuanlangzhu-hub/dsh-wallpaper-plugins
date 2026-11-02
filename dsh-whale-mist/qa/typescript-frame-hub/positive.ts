import {FrameHub, streamFrames} from './frame-hub.js';
import type {HubTrace, HubTraceRecord, FrameResponse, ClientTrace} from './frame-hub.js';
import type {ServerResponse} from 'node:http';
import {Buffer} from 'node:buffer';

const entries: HubTraceRecord[] = [];
const trace: HubTrace = {enabled: true, record(entry) {
  const sequence: number = entry.sequence;
  const clock: 'host-mono' = entry.clockDomain;
  if (entry.event === 'host-stream-write') { const blocked: boolean = entry.backpressure; void blocked; }
  if (entry.event === 'host-stream-skip' && entry.reason === 'latest-overwritten') {
    const skipped: number = entry.skippedCount; void skipped;
  }
  entries.push(entry); void [sequence, clock];
}};
const clientTrace: ClientTrace = {registerConnection(id) { const value: string = id; return value; }};
const hub = new FrameHub({cadenceTrace: trace, clientTrace, runId: 'test'});
new FrameHub({cadenceTrace: {enabled: false}});
new FrameHub({cadenceTrace: null, clientTrace: null});
hub.push(new Uint8Array(0));
hub.push(Buffer.alloc(0));
hub.runId = 'next';
const latest = hub.latest;
if (latest) {
  const seq: number = latest.sequence;
  const width: number = latest.width;
  const packet: Buffer = latest.packet;
  const jpeg: Buffer = latest.jpeg;
  void [seq,width,packet,jpeg];
}
const age: number | null = hub.snapshot().captureAgeMs;
const received: number = hub.snapshot().received;
const running: boolean = hub.snapshot().running;
declare const response: ServerResponse;
const minimal: FrameResponse = response;
const withoutFlush: Omit<FrameResponse, 'flushHeaders'> = response;
const stop: () => void = streamFrames(hub, minimal, {cadenceTrace: trace, clientTrace, runId:'test', connId:'conn',
  registerConnection(id) { const value: string = id; return new Set([value]); }});
streamFrames(hub, withoutFlush);
const extended: FrameHub & {clientTrace?: ClientTrace | null} = hub;
extended.clientTrace = clientTrace;
streamFrames(extended, response);
void [entries, age, received, running, stop];
