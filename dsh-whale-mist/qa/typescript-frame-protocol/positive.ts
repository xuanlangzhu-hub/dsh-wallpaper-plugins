import {FrameDecoder, HEADER_BYTES, MAX_FRAME_BYTES} from '../../src/wallpaper/frame-protocol.js';

const header: 24 = HEADER_BYTES;
const maximum: number = MAX_FRAME_BYTES;
const decoder = new FrameDecoder(frame => {
  const sequence: number = frame.sequence;
  const capturedAt: number = frame.capturedAt;
  const width: number = frame.width;
  const height: number = frame.height;
  const packet: Uint8Array = frame.packet;
  const jpeg: Uint8Array = frame.jpeg;
  const result: number = sequence + capturedAt + width + height + packet.byteLength + jpeg.byteLength;
  void result;
});
decoder.push(new Uint8Array(header));
decoder.push(new Uint8Array(new SharedArrayBuffer(32)));
const pushed: void = decoder.push(new Uint8Array(0));
const finished: void = decoder.finish();
void [maximum, pushed, finished];
