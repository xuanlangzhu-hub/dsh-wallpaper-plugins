"""Add only JSDoc and the existing catch-value field view to an isolated Hub string."""
TYPES="""/** @typedef {{runId: string, sequence: number, clockDomain: 'host-mono', atMonoMs: number}} HubTraceBase */
/** @typedef {HubTraceBase & {event: 'host-hub-received', capturedAt: number, packetBytes: number}} HubReceivedRecord */
/** @typedef {HubTraceBase & {event: 'host-stream-skip', connectionId: string, reason: 'duplicate-sequence'}} DuplicateRecord */
/** @typedef {HubTraceBase & {event: 'host-stream-skip', connectionId: string, reason: 'latest-overwritten', skippedFrom: number, skippedTo: number, skippedCount: number}} OverwrittenRecord */
/** @typedef {HubTraceBase & {event: 'host-stream-write', connectionId: string, durationMs: number, backpressure: boolean}} WriteRecord */
/** @typedef {HubTraceBase & {event: 'host-stream-write-error', connectionId: string, reason: string}} WriteErrorRecord */
/** @typedef {HubTraceBase & {event: 'host-stream-drain', connectionId: string}} DrainRecord */
/** @typedef {HubReceivedRecord | DuplicateRecord | OverwrittenRecord | WriteRecord | WriteErrorRecord | DrainRecord} HubTraceRecord */
/** A full sink may toggle enabled; a disabled hook need not provide record.
 * @typedef {{enabled: boolean, record: (entry: HubTraceRecord) => void} | {enabled?: false, record?: (entry: HubTraceRecord) => void}} HubTrace
 */
/** @typedef {{registerConnection?: (connectionId: string) => unknown}} ClientTrace */
/**
 * @typedef {object} HubOptions
 * @property {HubTrace | null} [cadenceTrace]
 * @property {string} [runId]
 * @property {ClientTrace | null} [clientTrace] Accepted from existing callers; not stored by the constructor.
 */
/**
 * @typedef {object} StreamOptions
 * @property {HubTrace | null} [cadenceTrace]
 * @property {ClientTrace | null} [clientTrace]
 * @property {string} [runId]
 * @property {string} [connId]
 * @property {(connectionId: string) => unknown} [registerConnection]
 */
/** @typedef {Pick<import('node:http').ServerResponse, 'writeHead' | 'write' | 'end' | 'on' | 'off'> & Partial<Pick<import('node:http').ServerResponse, 'flushHeaders'>>} FrameResponse */

"""


def annotate(raw):
    def replace(old,new):
        nonlocal raw
        assert raw.count(old)==1,old
        raw=raw.replace(old,new)
    replace('// One latest frame.',TYPES+'// One latest frame.')
    replace('  constructor(options = {}) {','  /** @param {HubOptions} [options] */\n  constructor(options = {}) {')
    replace('  push(bytes) {','  /** @param {Uint8Array} bytes */\n  push(bytes) {')
    replace('export function streamFrames(hub, res, options = {}) {',
            "/** @param {FrameHub & {clientTrace?: ClientTrace | null}} hub\n * @param {FrameResponse} res\n * @param {StreamOptions} [options]\n * @returns {() => void}\n */\nexport function streamFrames(hub, res, options = {}) {")
    replace('String(err?.message ?? err)',"String((/** @type {{message?: unknown} | null | undefined} */ (err))?.message ?? err)")
    replace("  const headers = { 'content-type':", "  /** @type {Record<string, string>} */\n  const headers = { 'content-type':")
    return raw
