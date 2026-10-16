/**
 * Motion Cadence Trace Collector.
 *
 * Diagnostic-only, bounded observation of frame timing across pipeline stages.
 * Default OFF: zero per-frame logs, HTTP requests, or serialization when disabled.
 * When enabled: records into a bounded ring buffer (default 8192 event entries,
 * sufficient for >1300 frames / >40s at 30fps), tracking sequence, monotonic timestamp,
 * and clock domain.
 */

export const CADENCE_TRACE_CAPACITY = 8192;
export const CADENCE_TRACE_SCHEMA_VERSION = 1;

export const ALLOWED_CLIENT_CADENCE_EVENTS = new Set([
  'client-accept',
  'client-schedule-fire',
  'client-decode-start',
  'client-decode-end',
  'client-draw-start',
  'client-draw-end',
  'client-draw-skipped',
  'client-draw-error',
  'client-drop-latest',
]);

export class CadenceTraceCollector {
  constructor(options = {}) {
    this.enabled = options.enabled === true;
    this.schemaVersion = CADENCE_TRACE_SCHEMA_VERSION;
    this.capacity = Math.max(16, options.capacity ?? CADENCE_TRACE_CAPACITY);
    this.runId = options.runId ?? '';
    this.clockDomain = options.clockDomain ?? 'host-mono';
    // Lazy allocation: do not create array when disabled
    this.events = this.enabled ? [] : null;
    this.totalRecorded = 0;
    this.overflowCount = 0;
    this.droppedBatchRecords = 0;
    this.schemaViolationCount = 0;
    this.clientOverflowCount = 0;
    this.clientDroppedCount = 0;
    this.clientTrailingUnsentCount = 0;
    this.clientFinalized = false;
    this.clientStreams = new Map();
    this.evictedUnfinalizedStreams = 0;
    this.evictedFinalizedStreams = 0;
    this.evictedTrailingUnsentCount = 0;
    this.evictedOverflowCount = 0;
    this.evictedDroppedCount = 0;
    this.issuedConnections = new Set();
    this.degraded = false;
    this.degradeReason = null;
  }

  updateClientStream(connectionId, generation, update = {}) {
    if (!connectionId || typeof connectionId !== 'string') return false;
    if (typeof generation !== 'number' || !Number.isInteger(generation) || generation < 0) {
      return false;
    }
    const gen = generation;
    const streamKey = `${connectionId}:${gen}`;
    let stream = this.clientStreams.get(streamKey);
    if (!stream) {
      if (this.clientStreams.size >= 32) {
        let victimKey = null;
        // Prefer compacting an already finalized, zero-trailing healthy stream first
        for (const [k, s] of this.clientStreams.entries()) {
          if (s.finalized === true && (s.trailingUnsentCount || 0) === 0 && (s.overflowCount || 0) === 0 && (s.droppedCount || 0) === 0) {
            victimKey = k;
            break;
          }
        }
        // Fallback to any finalized stream before evicting an unfinalized stream
        if (victimKey === null) {
          for (const [k, s] of this.clientStreams.entries()) {
            if (s.finalized === true) {
              victimKey = k;
              break;
            }
          }
        }
        if (victimKey === null) {
          victimKey = this.clientStreams.keys().next().value;
        }
        const victim = this.clientStreams.get(victimKey);
        if (victim) {
          if (victim.finalized === true) {
            this.evictedFinalizedStreams = (this.evictedFinalizedStreams || 0) + 1;
          } else {
            this.evictedUnfinalizedStreams = (this.evictedUnfinalizedStreams || 0) + 1;
          }
          this.evictedTrailingUnsentCount = (this.evictedTrailingUnsentCount || 0) + (victim.trailingUnsentCount || 0);
          this.evictedOverflowCount = (this.evictedOverflowCount || 0) + (victim.overflowCount || 0);
          this.evictedDroppedCount = (this.evictedDroppedCount || 0) + (victim.droppedCount || 0);
        }
        this.clientStreams.delete(victimKey);
      }
      stream = {
        connectionId,
        generation: gen,
        finalized: false,
        trailingUnsentCount: 0,
        overflowCount: 0,
        droppedCount: 0,
      };
      this.clientStreams.set(streamKey, stream);
    }
    if (typeof update.trailingUnsentCount === 'number' && Number.isFinite(update.trailingUnsentCount) && update.trailingUnsentCount >= 0) {
      stream.trailingUnsentCount = update.trailingUnsentCount;
    }
    if (update.isStop === true && !(update.trailingUnsentCount > 0)) {
      stream.finalized = true;
    }
    if (typeof update.overflowCount === 'number' && Number.isFinite(update.overflowCount) && update.overflowCount >= 0) {
      stream.overflowCount = Math.max(stream.overflowCount, update.overflowCount);
    }
    if (typeof update.droppedCount === 'number' && Number.isFinite(update.droppedCount) && update.droppedCount >= 0) {
      stream.droppedCount = Math.max(stream.droppedCount, update.droppedCount);
    }
    this.syncClientAggregates();
    return true;
  }

  hasPendingClientFinalization(issuedConnections = this.issuedConnections) {
    if (!this.enabled || this.clockDomain !== 'client-mono') return false;
    if (this.clientStreams.size > 0) {
      for (const s of this.clientStreams.values()) {
        if (s.finalized !== true || (s.trailingUnsentCount || 0) > 0) {
          return true;
        }
      }
      return false;
    }
    const issuedSize = (issuedConnections?.size ?? 0) || (this.issuedConnections?.size ?? 0);
    if (issuedSize > 0 && !this.clientFinalized && (!this.events || this.events.length === 0)) {
      return true;
    }
    return false;
  }

  notifyFinalizationWaiters() {
    if (!this.finalizationWaiters || this.finalizationWaiters.size === 0) return;
    for (const check of Array.from(this.finalizationWaiters)) {
      try { check(); } catch {}
    }
  }

  waitForClientFinalize(timeoutMs = 100, issuedConnections = this.issuedConnections) {
    if (!this.hasPendingClientFinalization(issuedConnections)) {
      return Promise.resolve(true);
    }
    if (!this.finalizationWaiters) {
      this.finalizationWaiters = new Set();
    }
    return new Promise(resolve => {
      let settled = false;
      let timer = null;
      const done = result => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        this.finalizationWaiters.delete(check);
        resolve(result);
      };
      const check = () => {
        if (!this.hasPendingClientFinalization(issuedConnections)) {
          done(true);
        }
      };
      this.finalizationWaiters.add(check);
      timer = setTimeout(() => done(false), timeoutMs);
      timer?.unref?.();
    });
  }

  syncClientAggregates() {
    if (this.clientStreams.size === 0 && (this.evictedUnfinalizedStreams || 0) === 0 && (this.evictedFinalizedStreams || 0) === 0) return;
    let allFinalized = (this.evictedUnfinalizedStreams || 0) === 0;
    let totalTrailing = this.evictedTrailingUnsentCount || 0;
    let totalOverflow = this.evictedOverflowCount || 0;
    let totalDropped = this.evictedDroppedCount || 0;
    for (const s of this.clientStreams.values()) {
      if (s.finalized !== true) allFinalized = false;
      totalTrailing += (s.trailingUnsentCount || 0);
      totalOverflow += (s.overflowCount || 0);
      totalDropped += (s.droppedCount || 0);
    }
    this.clientFinalized = allFinalized;
    this.clientTrailingUnsentCount = totalTrailing;
    this.clientOverflowCount = Math.max(this.clientOverflowCount || 0, totalOverflow);
    this.clientDroppedCount = Math.max(this.clientDroppedCount || 0, totalDropped);
  }

  getClientFinalized() {
    if ((this.evictedUnfinalizedStreams || 0) > 0) {
      return false;
    }
    if (this.clientStreams.size === 0) {
      if ((this.evictedFinalizedStreams || 0) > 0) return true;
      return Boolean(this.clientFinalized);
    }
    for (const s of this.clientStreams.values()) {
      if (s.finalized !== true) return false;
    }
    return true;
  }

  getClientTrailingUnsentCount() {
    if (this.clientStreams.size === 0 && (this.evictedTrailingUnsentCount || 0) === 0) {
      return this.clientTrailingUnsentCount || 0;
    }
    let total = this.evictedTrailingUnsentCount || 0;
    for (const s of this.clientStreams.values()) {
      total += (s.trailingUnsentCount || 0);
    }
    return total;
  }

  getClientOverflowCount() {
    if (this.clientStreams.size === 0 && (this.evictedOverflowCount || 0) === 0) {
      return this.clientOverflowCount || 0;
    }
    let total = this.evictedOverflowCount || 0;
    for (const s of this.clientStreams.values()) {
      total += (s.overflowCount || 0);
    }
    return Math.max(total, this.clientOverflowCount || 0);
  }

  getClientDroppedCount() {
    if (this.clientStreams.size === 0 && (this.evictedDroppedCount || 0) === 0) {
      return this.clientDroppedCount || 0;
    }
    let total = this.evictedDroppedCount || 0;
    for (const s of this.clientStreams.values()) {
      total += (s.droppedCount || 0);
    }
    return Math.max(total, this.clientDroppedCount || 0);
  }

  registerConnection(connId) {
    if (connId && typeof connId === 'string') {
      this.issuedConnections.add(connId);
    }
  }

  record(entry) {
    if (!this.enabled || !this.events || this.degraded) return;
    try {
      if (typeof entry.sequence !== 'number' || !Number.isInteger(entry.sequence) || entry.sequence < 0) {
        throw new Error('Invalid sequence');
      }
      if (typeof entry.atMonoMs !== 'number' || !Number.isFinite(entry.atMonoMs) || entry.atMonoMs < 0) {
        throw new Error('Invalid atMonoMs');
      }
      this.totalRecorded++;
      const item = {
        runId: entry.runId ?? this.runId,
        sequence: entry.sequence,
        clockDomain: entry.clockDomain ?? this.clockDomain,
        event: String(entry.event ?? 'unknown'),
        atMonoMs: Number(entry.atMonoMs.toFixed(3)),
      };

      if (entry.wgcTimestampMs !== undefined && entry.wgcTimestampMs !== null) item.wgcTimestampMs = Number(entry.wgcTimestampMs.toFixed(3));
      if (entry.capturedAt !== undefined) item.capturedAt = entry.capturedAt;
      if (entry.durationMs !== undefined && entry.durationMs !== null) {
        if (typeof entry.durationMs !== 'number' || !Number.isFinite(entry.durationMs) || entry.durationMs < 0) {
          throw new Error('Invalid durationMs: expected finite non-negative number');
        }
        item.durationMs = Number(entry.durationMs.toFixed(3));
      }
      if (entry.success !== undefined && entry.success !== null) {
        if (typeof entry.success !== 'boolean') {
          throw new Error('Invalid success field: expected boolean');
        }
        item.success = entry.success;
      }
      if (entry.backpressure !== undefined && entry.backpressure !== null) {
        if (typeof entry.backpressure !== 'boolean') {
          throw new Error('Invalid backpressure: expected boolean');
        }
        item.backpressure = entry.backpressure;
      }
      if (entry.connectionId !== undefined) item.connectionId = String(entry.connectionId);
      if (entry.generation !== undefined && entry.generation !== null) {
        if (typeof entry.generation !== 'number' || !Number.isInteger(entry.generation) || entry.generation < 0) {
          throw new Error('Invalid generation: expected non-negative integer');
        }
        item.generation = entry.generation;
      }
      if (entry.scheduleSource !== undefined && entry.scheduleSource !== null) {
        if (typeof entry.scheduleSource !== 'string') {
          throw new Error('Invalid scheduleSource: expected string');
        }
        item.scheduleSource = entry.scheduleSource;
      }
      if (entry.reason !== undefined && entry.reason !== null) item.reason = String(entry.reason);
      if (entry.packetBytes !== undefined) item.packetBytes = entry.packetBytes;
      if (entry.skippedFrom !== undefined) item.skippedFrom = entry.skippedFrom;
      if (entry.skippedTo !== undefined) item.skippedTo = entry.skippedTo;
      if (entry.skippedCount !== undefined) item.skippedCount = entry.skippedCount;

      if (this.events.length >= this.capacity) {
        this.overflowCount++;
        this.events.shift(); // ring buffer overwrite oldest
      }
      this.events.push(item);
    } catch (err) {
      this.degraded = true;
      this.degradeReason = String(err?.message ?? err);
      this.schemaViolationCount = (this.schemaViolationCount || 0) + 1;
      throw err;
    }
  }

  appendBatch(batch, expectedRunId, options = {}) {
    const expectedClockDomain = typeof options === 'string' ? options : (options?.expectedClockDomain ?? 'client-mono');
    const allowedConnectionId = typeof options === 'object' ? (options?.connectionId ?? null) : null;
    const expectedGeneration = typeof options === 'object' && options?.generation !== undefined ? options.generation : null;
    const issuedConnections = typeof options === 'object' && options?.issuedConnections
      ? options.issuedConnections
      : this.issuedConnections;

    if (!this.enabled || !this.events || this.degraded) {
      return { appended: 0, dropped: Array.isArray(batch) ? batch.length : 0, schemaViolations: 0 };
    }
    if (!Array.isArray(batch)) return { appended: 0, dropped: 0, schemaViolations: 0 };
    let appended = 0;
    let dropped = 0;
    let schemaViolations = 0;

    for (const raw of batch) {
      if (!raw || typeof raw !== 'object') {
        dropped++;
        schemaViolations++;
        continue;
      }
      // Scope validation: must match expected runId
      if (!raw.runId || (expectedRunId && raw.runId !== expectedRunId)) {
        dropped++;
        continue;
      }
      // ConnectionId validation: must be provided and registered
      if (!raw.connectionId || typeof raw.connectionId !== 'string') {
        dropped++;
        schemaViolations++;
        continue;
      }
      if (allowedConnectionId && raw.connectionId !== allowedConnectionId) {
        dropped++;
        schemaViolations++;
        continue;
      }
      if (issuedConnections && !issuedConnections.has(raw.connectionId)) {
        dropped++;
        schemaViolations++;
        continue;
      }
      // Clock domain validation: client batches must strictly be client-mono
      if (!raw.clockDomain || raw.clockDomain !== expectedClockDomain) {
        dropped++;
        schemaViolations++;
        continue;
      }
      // Generation validation: must be non-negative integer and match envelope if specified
      if (typeof raw.generation !== 'number' || !Number.isInteger(raw.generation) || raw.generation < 0) {
        dropped++;
        schemaViolations++;
        continue;
      }
      if (expectedGeneration !== null && raw.generation !== expectedGeneration) {
        dropped++;
        schemaViolations++;
        continue;
      }
      // Sequence validation: must be non-negative integer
      if (typeof raw.sequence !== 'number' || !Number.isInteger(raw.sequence) || raw.sequence < 0) {
        dropped++;
        schemaViolations++;
        continue;
      }
      // atMonoMs validation: must be finite non-negative number
      if (typeof raw.atMonoMs !== 'number' || !Number.isFinite(raw.atMonoMs) || raw.atMonoMs < 0) {
        dropped++;
        schemaViolations++;
        continue;
      }
      // Event validation: must be one of allowed client cadence events
      if (!raw.event || !ALLOWED_CLIENT_CADENCE_EVENTS.has(raw.event)) {
        dropped++;
        schemaViolations++;
        continue;
      }
      // Optional fields validation: success, durationMs, backpressure, scheduleSource
      if (raw.success !== undefined && raw.success !== null && typeof raw.success !== 'boolean') {
        dropped++;
        schemaViolations++;
        continue;
      }
      if (raw.durationMs !== undefined && raw.durationMs !== null) {
        if (typeof raw.durationMs !== 'number' || !Number.isFinite(raw.durationMs) || raw.durationMs < 0) {
          dropped++;
          schemaViolations++;
          continue;
        }
      }
      if (raw.backpressure !== undefined && raw.backpressure !== null && typeof raw.backpressure !== 'boolean') {
        dropped++;
        schemaViolations++;
        continue;
      }
      if (raw.scheduleSource !== undefined && raw.scheduleSource !== null && typeof raw.scheduleSource !== 'string') {
        dropped++;
        schemaViolations++;
        continue;
      }

      try {
        this.record(raw);
        appended++;
        this.updateClientStream(raw.connectionId, raw.generation, {});
      } catch {
        dropped++;
        schemaViolations++;
      }
    }
    this.droppedBatchRecords += dropped;
    this.schemaViolationCount += schemaViolations;
    return { appended, dropped, schemaViolations };
  }

  snapshot() {
    this.syncClientAggregates();
    const isFinalized = this.getClientFinalized();
    const trailingUnsent = this.getClientTrailingUnsentCount();
    const overflow = this.getClientOverflowCount();
    const dropped = this.getClientDroppedCount();

    const streamSnapshots = {};
    for (const [k, s] of this.clientStreams) {
      streamSnapshots[k] = { ...s };
    }

    if (!this.enabled || !this.events) {
      return {
        enabled: false,
        schemaVersion: this.schemaVersion,
        clockDomain: this.clockDomain,
        runId: this.runId,
        capacity: this.capacity,
        totalRecorded: 0,
        retained: 0,
        overflowCount: 0,
        droppedBatchRecords: 0,
        schemaViolationCount: 0,
        clientOverflowCount: overflow,
        clientDroppedCount: dropped,
        clientTrailingUnsentCount: trailingUnsent,
        clientFinalized: isFinalized,
        clientStreams: streamSnapshots,
        evictedUnfinalizedStreams: this.evictedUnfinalizedStreams || 0,
        evictedTrailingUnsentCount: this.evictedTrailingUnsentCount || 0,
        issuedConnections: Array.from(this.issuedConnections),
        degraded: false,
        degradeReason: null,
        oldestSequence: 0,
        newestSequence: 0,
        records: [],
      };
    }
    return {
      enabled: true,
      schemaVersion: this.schemaVersion,
      clockDomain: this.clockDomain,
      runId: this.runId,
      capacity: this.capacity,
      totalRecorded: this.totalRecorded,
      retained: this.events.length,
      overflowCount: this.overflowCount,
      droppedBatchRecords: this.droppedBatchRecords,
      schemaViolationCount: this.schemaViolationCount,
      clientOverflowCount: overflow,
      clientDroppedCount: dropped,
      clientTrailingUnsentCount: trailingUnsent,
      clientFinalized: isFinalized,
      clientStreams: streamSnapshots,
      evictedUnfinalizedStreams: this.evictedUnfinalizedStreams || 0,
      evictedTrailingUnsentCount: this.evictedTrailingUnsentCount || 0,
      issuedConnections: Array.from(this.issuedConnections),
      degraded: this.degraded,
      degradeReason: this.degradeReason,
      oldestSequence: this.events[0]?.sequence ?? 0,
      newestSequence: this.events[this.events.length - 1]?.sequence ?? 0,
      records: [...this.events],
    };
  }

  clear() {
    if (this.events) this.events = [];
    this.totalRecorded = 0;
    this.overflowCount = 0;
    this.droppedBatchRecords = 0;
    this.schemaViolationCount = 0;
    this.clientOverflowCount = 0;
    this.clientDroppedCount = 0;
    this.clientTrailingUnsentCount = 0;
    this.clientFinalized = false;
    this.clientStreams.clear();
    this.evictedUnfinalizedStreams = 0;
    this.evictedFinalizedStreams = 0;
    this.evictedTrailingUnsentCount = 0;
    this.evictedOverflowCount = 0;
    this.evictedDroppedCount = 0;
    this.issuedConnections.clear();
    this.degraded = false;
    this.degradeReason = null;
  }
}
