export const HEADER_BYTES = 24;
export const MAX_FRAME_BYTES = 8 * 1024 * 1024;

export class FrameDecoder {
  constructor(onFrame) { this.onFrame = onFrame; this.pending = new Uint8Array(0); }
  push(chunk) {
    if (!(chunk instanceof Uint8Array)) throw new TypeError('Expected byte buffer');
    if (chunk.byteLength > 32 * 1024 * 1024) throw new Error('Oversized input chunk');
    let bytes = chunk;
    if (this.pending.byteLength) {
      bytes = new Uint8Array(this.pending.byteLength + chunk.byteLength);
      bytes.set(this.pending); bytes.set(chunk, this.pending.byteLength);
    }
    let offset = 0;
    while (bytes.byteLength - offset >= HEADER_BYTES) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, HEADER_BYTES);
      if (view.getUint32(0, false) !== 0x57484c31) throw new Error('Invalid WHL1 frame magic');
      const length = view.getUint32(8, true);
      const width = view.getUint16(20, true), height = view.getUint16(22, true);
      const capturedAt = Number(view.getBigInt64(12, true));
      if (!length || length > MAX_FRAME_BYTES || !width || !height || width > 16384 || height > 16384 || !Number.isSafeInteger(capturedAt) || capturedAt <= 0)
        throw new Error('Invalid frame bounds');
      if (bytes.byteLength - offset < HEADER_BYTES + length) break;
      const packet = bytes.subarray(offset, offset + HEADER_BYTES + length);
      this.onFrame({ sequence: view.getUint32(4, true), capturedAt, width, height,
        packet, jpeg: packet.subarray(HEADER_BYTES) });
      offset += HEADER_BYTES + length;
    }
    this.pending = bytes.slice(offset);
  }
  finish() { if (this.pending.byteLength) throw new Error('Truncated frame stream'); }
}
