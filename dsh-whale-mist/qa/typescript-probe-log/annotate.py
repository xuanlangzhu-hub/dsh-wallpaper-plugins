"""Exact comment/cast recipe for the fixed rc.57 log module; no runtime source writes."""
TYPES='''/** @typedef {'info' | 'warn' | 'error'} ProbeLogLevel */
/**
 * @typedef {object} ProbeLogEntry
 * @property {ProbeLogLevel} level
 * @property {string} scope
 * @property {string} message
 * @property {string} detail
 * @property {number} [at] Absent on a freshly parsed line.
 */
/** @typedef {ProbeLogEntry & {at: number}} JournalLogEntry */
/** @typedef {{message: string, scope?: string, detail?: string}} LogTextFields */
/** @typedef {{toString(encoding: 'utf8'): string}} Utf8LogChunk */
/**
 * JSON grammar permits these kinds; fields/elements remain unknown until checked.
 * This is not a validated log envelope.
 * @typedef {null | boolean | number | string | unknown[] | Record<string, unknown>} ParsedJson
 */

'''
def annotate(raw):
 replacements=[
  ("export const LOG_KIND = 'log';",TYPES+"export const LOG_KIND = 'log';"),
  ("const LEVELS = ['info', 'warn', 'error'];","/** @type {readonly unknown[]} Membership may be tested with an untrusted JSON field. */\nconst LEVELS = ['info', 'warn', 'error'];"),
  ('/** Human-readable one-line summary used for status, logs, and failure text. */','/** Human-readable one-line summary used for status, logs, and failure text.\n * @param {LogTextFields} entry\n * @returns {string}\n */'),
  (' * entry, because unreadable diagnostics must not be silently dropped.',' * entry, because unreadable diagnostics must not be silently dropped.\n * String conversion itself retains the existing throwing-object behaviour.\n * @param {unknown} line\n * @returns {ProbeLogEntry | null}'),
  ('    let value;','    /** @type {ParsedJson} */\n    let value;'),
  ("level: LEVELS.includes(value.level) ? value.level : 'info',","// Membership in the fixed list above proves this local enum assertion.\n        level: LEVELS.includes(value.level) ? /** @type {ProbeLogLevel} */ (value.level) : 'info',"),
  ('  constructor(limit = MAX_JOURNAL_ENTRIES) {','  /** @param {number} [limit] */\n  constructor(limit = MAX_JOURNAL_ENTRIES) {'),
  ("this.limit = limit; this.pending = ''; this.entries = []; this.errorCount = 0; this.firstError = null;","this.limit = limit; this.pending = '';\n    /** @type {JournalLogEntry[]} */\n    this.entries = []; this.errorCount = 0;\n    /** @type {string | null} */\n    this.firstError = null;"),
  ('  push(chunk) {',"  /** @param {string | Utf8LogChunk} chunk\n   * @returns {JournalLogEntry[]}\n   */\n  push(chunk) {"),
  ('    const added = [];','    /** @type {JournalLogEntry[]} */\n    const added = [];'),
  ('      this.entries.push(entry);','      // The assignment immediately above proves the required timestamp.\n      this.entries.push(/** @type {JournalLogEntry} */ (entry));'),
  ('      added.push(entry);','      added.push(/** @type {JournalLogEntry} */ (entry));'),
  ('  /** Bounded failure text for one entry, used when a capture must stop. */','  /** Bounded failure text for one entry, used when a capture must stop.\n   * @param {LogTextFields} entry\n   * @returns {string}\n   */')]
 for before,after in replacements:
  assert raw.count(before)==1,('annotation anchor',before)
  raw=raw.replace(before,after)
 return raw
