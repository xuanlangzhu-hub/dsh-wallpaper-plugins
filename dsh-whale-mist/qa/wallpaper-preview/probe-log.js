// Stderr diagnostic channel of the native WallpaperProbe.
//
// The probe writes one JSON object per line to stderr:
//   {"kind":"log","level":"info"|"warn"|"error","scope":"Desktop","message":"...","detail":"...","at":<ms>}
// Only "error" entries mean the capture failed. A successful run's diagnostics
// (for example the `[Desktop] OpenDesktop: ..., SetThreadDesktop: True` line)
// must never be reported as a capture failure.
//
// Plain text is still accepted for compatibility with an older helper: a
// non-JSON line is an error unless it carries the informational `[Desktop]`
// marker or a known non-fatal `[Capture]` recovery notice.

export const LOG_KIND = 'log';
// One stderr line is bounded before parsing; a status envelope carries one
// compact capture record, so its message budget is larger than a plain line.
export const MAX_LOG_LINE = 8192;
export const MAX_MESSAGE = 4000;
export const MAX_JOURNAL_ENTRIES = 200;
export const MAX_PENDING_TEXT = 16384;

const LEVELS = ['info', 'warn', 'error'];
const PLAIN_INFO = /^\[Desktop\]/;
const PLAIN_WARNING = /^\[Capture\]/;

/** Human-readable one-line summary used for status, logs, and failure text. */
export function describeLog(entry) {
  const scope = entry.scope ? `[${entry.scope}] ` : '';
  const detail = entry.detail ? `: ${entry.detail}` : '';
  return `${scope}${entry.message}${detail}`;
}

/**
 * Classify one stderr line. Never throws: malformed input becomes an error
 * entry, because unreadable diagnostics must not be silently dropped.
 */
export function parseLogLine(line) {
  const text = String(line).trim();
  if (!text) return null;
  if (text.startsWith('{') && text.endsWith('}')) {
    let value;
    try { value = JSON.parse(text); } catch { return { level: 'error', scope: '', message: `Unreadable helper log: ${text.slice(0, 300)}`, detail: '' }; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { level: 'error', scope: '', message: `Unrecognized helper output: ${text.slice(0, 300)}`, detail: '' };
    }
    // A well-formed envelope carries the intent; `level` defaults to info.
    if (value.kind === LOG_KIND) {
      if (typeof value.message !== 'string' || !value.message)
        return { level: 'error', scope: '', message: `Log envelope without a message: ${text.slice(0, 300)}`, detail: '' };
      return {
        level: LEVELS.includes(value.level) ? value.level : 'info',
        scope: typeof value.scope === 'string' ? value.scope.slice(0, 40) : '',
        message: value.message.slice(0, MAX_MESSAGE),
        detail: typeof value.detail === 'string' ? value.detail.slice(0, MAX_MESSAGE) : '',
      };
    }
    // A plain JSON diagnostic object (device description, start banner) is
    // informational for the same reason the plain-text [Desktop] line is.
    return { level: 'info', scope: 'Status', message: text.slice(0, MAX_MESSAGE), detail: '' };
  }
  if (PLAIN_INFO.test(text)) return { level: 'info', scope: 'Desktop', message: text.slice('[Desktop]'.length).trim().slice(0, 500), detail: '' };
  if (PLAIN_WARNING.test(text)) return { level: 'warn', scope: 'Capture', message: text.slice('[Capture]'.length).trim().slice(0, 500), detail: '' };
  return { level: 'error', scope: '', message: text.slice(0, 1000), detail: '' };
}

/**
 * Bounded stderr journal for one capture child. Lines are split across chunk
 * boundaries; the journal keeps the newest entries and the first fatal error.
 */
export class ProbeJournal {
  constructor(limit = MAX_JOURNAL_ENTRIES) {
    this.limit = limit; this.pending = ''; this.entries = []; this.errorCount = 0; this.firstError = null;
  }
  push(chunk) {
    const added = [];
    this.pending += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let newline;
    while ((newline = this.pending.indexOf('\n')) >= 0) {
      const raw = this.pending.slice(0, newline); this.pending = this.pending.slice(newline + 1);
      const entry = parseLogLine(raw.slice(0, MAX_LOG_LINE));
      if (!entry) continue;
      entry.at = Date.now();
      this.entries.push(entry);
      if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
      if (entry.level === 'error') { this.errorCount++; this.firstError ??= describeLog(entry); }
      added.push(entry);
    }
    if (this.pending.length > MAX_PENDING_TEXT) this.pending = this.pending.slice(-MAX_PENDING_TEXT);
    return added;
  }
  /** Flush a trailing line that never received a newline (process exit). */
  finish() { return this.pending ? this.push('\n') : []; }
  /** Bounded failure text for one entry, used when a capture must stop. */
  failureText(entry) {
    const text = describeLog(entry);
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  }
  snapshot() {
    return {
      count: this.entries.length,
      errors: this.errorCount,
      firstError: this.firstError,
      last: this.entries.length ? describeLog(this.entries[this.entries.length - 1]) : null,
      messages: this.entries.map(describeLog),
    };
  }
}
