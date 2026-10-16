/**
 * Motion Cadence Offline Analyzer.
 *
 * Implements:
 * 1. Monotonic timeline alignment across Native, Host, and Client domains using runId + sequence.
 * 2. Stage duration analysis (Host receive, Host stream write, Client accept, decode, draw).
 * 3. Presentation cadence proxy ratio: delta(WGC_source) / delta(Client_draw_end).
 * 4. Synthetic fixture comparisons to illustrate rate masking (steady vs burst).
 * 5. Strict grouping by (runId, connectionId, generation) to prevent cross-run / cross-stream contamination.
 */

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function computeStats(values) {
  if (!values || values.length === 0) {
    return { count: 0, mean: null, stdDev: null, min: null, p50: null, p90: null, p95: null, max: null };
  }
  const clean = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (clean.length === 0) {
    return { count: 0, mean: null, stdDev: null, min: null, p50: null, p90: null, p95: null, max: null };
  }
  const sorted = [...clean].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  return {
    count: sorted.length,
    mean: Number(mean.toFixed(3)),
    stdDev: Number(stdDev.toFixed(3)),
    min: Number(sorted[0].toFixed(3)),
    p50: Number(quantile(sorted, 0.50).toFixed(3)),
    p90: Number(quantile(sorted, 0.90).toFixed(3)),
    p95: Number(quantile(sorted, 0.95).toFixed(3)),
    max: Number(sorted[sorted.length - 1].toFixed(3)),
  };
}

export function computeIntervals(timestamps) {
  if (!timestamps || timestamps.length < 2) return [];
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }
  return intervals;
}

export function alignCadenceTrace({ nativeTrace = null, hostTrace = null, clientTrace = null } = {}) {
  const metadata = {
    valid: true,
    schemaVersion: 1,
    overflowCount: 0,
    droppedBatchRecords: 0,
    schemaViolationCount: 0,
    degraded: false,
    degradeReasons: [],
    crossRunCount: 0,
    clockDomainMismatchCount: 0,
    duplicateEventCount: 0,
    unavailable: false,
    hasClientTrace: Boolean(clientTrace && Array.isArray(clientTrace.records) && clientTrace.records.length > 0),
  };

  const traceConfigs = [
    { name: 'native', trace: nativeTrace, domain: 'native-mono' },
    { name: 'host', trace: hostTrace, domain: 'host-mono' },
    { name: 'client', trace: clientTrace, domain: 'client-mono' },
  ];

  let totalRawRecords = 0;
  for (const { name, trace, domain } of traceConfigs) {
    if (!trace) continue;
    if (trace.schemaVersion && trace.schemaVersion !== 1) {
      metadata.valid = false;
      metadata.degraded = true;
      metadata.degradeReasons.push(`Invalid schemaVersion ${trace.schemaVersion} in ${name}`);
    }
    if (trace.overflowCount && typeof trace.overflowCount === 'number') {
      metadata.overflowCount += trace.overflowCount;
    }
    if (typeof trace.clientOverflowCount === 'number') {
      metadata.clientOverflowCount = (metadata.clientOverflowCount || 0) + trace.clientOverflowCount;
      metadata.overflowCount += trace.clientOverflowCount;
    }
    if (typeof trace.clientDroppedCount === 'number') {
      metadata.clientDroppedCount = (metadata.clientDroppedCount || 0) + trace.clientDroppedCount;
      metadata.droppedBatchRecords += trace.clientDroppedCount;
    }
    if (typeof trace.clientTrailingUnsentCount === 'number') {
      metadata.clientTrailingUnsentCount = (metadata.clientTrailingUnsentCount || 0) + trace.clientTrailingUnsentCount;
    }
    if (domain === 'client-mono') {
      if (typeof trace.clientFinalized === 'boolean') {
        metadata.clientFinalized = trace.clientFinalized;
      }
      const evictedTrailing = typeof trace.evictedTrailingUnsentCount === 'number' && trace.evictedTrailingUnsentCount > 0 ? trace.evictedTrailingUnsentCount : 0;
      if (evictedTrailing > 0) {
        metadata.evictedTrailingUnsentCount = (metadata.evictedTrailingUnsentCount || 0) + evictedTrailing;
      }
      if (typeof trace.evictedUnfinalizedStreams === 'number' && trace.evictedUnfinalizedStreams > 0) {
        metadata.evictedUnfinalizedStreams = (metadata.evictedUnfinalizedStreams || 0) + trace.evictedUnfinalizedStreams;
        metadata.clientFinalized = false;
      }
      if (trace.clientStreams && typeof trace.clientStreams === 'object') {
        metadata.clientStreams = trace.clientStreams;
        const streamList = Object.values(trace.clientStreams);
        if (streamList.length > 0) {
          const allFinalized = streamList.every(s => s && s.finalized === true);
          if (!allFinalized) {
            metadata.clientFinalized = false;
          }
          let sumTrailing = evictedTrailing;
          for (const s of streamList) {
            if (s && typeof s.trailingUnsentCount === 'number') sumTrailing += s.trailingUnsentCount;
          }
          if (sumTrailing > (metadata.clientTrailingUnsentCount || 0)) {
            metadata.clientTrailingUnsentCount = sumTrailing;
          }
        } else if (evictedTrailing > (metadata.clientTrailingUnsentCount || 0)) {
          metadata.clientTrailingUnsentCount = evictedTrailing;
        }
      }
    }
    if (trace.droppedBatchRecords && typeof trace.droppedBatchRecords === 'number') {
      metadata.droppedBatchRecords += trace.droppedBatchRecords;
    }
    if (trace.schemaViolationCount && typeof trace.schemaViolationCount === 'number') {
      metadata.schemaViolationCount += trace.schemaViolationCount;
    }
    if (trace.degraded || trace.flushFailed === true) {
      metadata.degraded = true;
      if (trace.flushFailed === true) metadata.flushFailed = true;
      if (trace.degradeReason) metadata.degradeReasons.push(trace.degradeReason);
      else if (trace.flushFailed === true) metadata.degradeReasons.push(`${name}-flush-failed`);
    }
    if (trace.clockDomain && trace.clockDomain !== domain) {
      metadata.clockDomainMismatchCount++;
    }
    if (Array.isArray(trace.records)) {
      totalRawRecords += trace.records.length;
      for (const r of trace.records) {
        if (r && r.clockDomain && r.clockDomain !== domain) {
          metadata.clockDomainMismatchCount++;
        }
      }
    }
  }

  if (totalRawRecords === 0) {
    metadata.unavailable = true;
    const empty = [];
    empty.metadata = metadata;
    return empty;
  }

  // Detect distinct runs
  const runIds = new Set();
  for (const { trace } of traceConfigs) {
    if (trace?.runId) runIds.add(trace.runId);
    if (Array.isArray(trace?.records)) {
      for (const r of trace.records) {
        if (r?.runId) runIds.add(r.runId);
      }
    }
  }
  if (runIds.size > 1) {
    metadata.crossRunCount = runIds.size - 1;
  }

  const primaryRunId = hostTrace?.runId || clientTrace?.runId || nativeTrace?.runId || (runIds.values().next().value ?? '');

  const frames = new Map();
  const seenEvents = new Set();

  const getFrame = (runId, seq) => {
    const key = `${runId}:${seq}`;
    if (!frames.has(key)) {
      frames.set(key, {
        runId,
        sequence: seq,
        nativeSourceMonoMs: null,
        wgcTimestampMs: null,
        capturedAt: null,
        nativeReadEndMonoMs: null,
        nativeEncodeEndMonoMs: null,
        nativePipeWriteMonoMs: null,
        nativePipeDurationMs: null,
        nativePipeSuccess: null,
        hostHubReceivedMonoMs: null,
        hostStreamWrites: [],
        hostStreamWriteMonoMs: null,
        hostStreamWriteDurationMs: null,
        hostStreamBackpressure: null,
        hostStreamSkips: [],
        hostStreamSkip: false,
        hostStreamSkipReason: null,
        hostStreamSkippedCount: 0,
        clientAccepts: [],
        clientAcceptMonoMs: null,
        clientSchedules: [],
        clientScheduleFireMonoMs: null,
        clientScheduleSource: null,
        clientDecodes: [],
        clientDecodeStartMonoMs: null,
        clientDecodeEndMonoMs: null,
        clientDecodeDurationMs: null,
        clientDecodeSuccess: null,
        clientDrawStartMonoMs: null,
        clientDrawEndMonoMs: null,
        clientDrawDurationMs: null,
        clientDrawSuccess: null,
        clientDrawSkippedReason: null,
        clientDraws: [],
        clientDrawSkips: [],
      });
    }
    return frames.get(key);
  };

  const checkDuplicate = (runId, connId, gen, seq, event, extraKey = '') => {
    const eventKey = `${runId}:${connId ?? ''}:${gen ?? ''}:${seq}:${event}${extraKey ? `:${extraKey}` : ''}`;
    if (seenEvents.has(eventKey)) {
      metadata.duplicateEventCount++;
      return true;
    }
    seenEvents.add(eventKey);
    return false;
  };

  // 1. Process Native Records
  if (nativeTrace && Array.isArray(nativeTrace.records)) {
    for (const r of nativeTrace.records) {
      if (!r || typeof r.sequence !== 'number' || !Number.isInteger(r.sequence) || r.sequence < 0) {
        metadata.schemaViolationCount++;
        continue;
      }
      if (typeof r.atMonoMs !== 'number' || !Number.isFinite(r.atMonoMs) || r.atMonoMs < 0) {
        metadata.schemaViolationCount++;
        continue;
      }
      if (r.wgcTimestampMs !== undefined && r.wgcTimestampMs !== null && (typeof r.wgcTimestampMs !== 'number' || !Number.isFinite(r.wgcTimestampMs) || r.wgcTimestampMs < 0)) {
        metadata.schemaViolationCount++;
        continue;
      }
      if (r.durationMs !== undefined && r.durationMs !== null && (typeof r.durationMs !== 'number' || !Number.isFinite(r.durationMs) || r.durationMs < 0)) {
        metadata.schemaViolationCount++;
        continue;
      }
      if (r.success !== undefined && r.success !== null && typeof r.success !== 'boolean') {
        metadata.schemaViolationCount++;
        continue;
      }
      if ((r.clockDomain && r.clockDomain !== 'native-mono') || (nativeTrace.clockDomain && nativeTrace.clockDomain !== 'native-mono')) {
        continue;
      }
      checkDuplicate(r.runId ?? primaryRunId, null, null, r.sequence, r.event);
      const f = getFrame(r.runId ?? primaryRunId, r.sequence);
      if (r.event === 'native-source') {
        f.nativeSourceMonoMs = r.atMonoMs;
        f.wgcTimestampMs = r.wgcTimestampMs ?? null;
        f.capturedAt = r.capturedAt ?? null;
      } else if (r.event === 'native-read') {
        f.nativeReadEndMonoMs = r.atMonoMs;
      } else if (r.event === 'native-encode') {
        f.nativeEncodeEndMonoMs = r.atMonoMs;
      } else if (r.event === 'native-pipe-write') {
        f.nativePipeWriteMonoMs = r.atMonoMs;
        f.nativePipeDurationMs = r.durationMs ?? null;
        f.nativePipeSuccess = r.success ?? true;
      }
    }
  }

  // 2. Process Host Records
  if (hostTrace && Array.isArray(hostTrace.records)) {
    for (const r of hostTrace.records) {
      if (!r || typeof r.sequence !== 'number' || !Number.isInteger(r.sequence) || r.sequence < 0) {
        metadata.schemaViolationCount++;
        continue;
      }
      if (typeof r.atMonoMs !== 'number' || !Number.isFinite(r.atMonoMs) || r.atMonoMs < 0) {
        metadata.schemaViolationCount++;
        continue;
      }
      if (r.durationMs !== undefined && r.durationMs !== null && (typeof r.durationMs !== 'number' || !Number.isFinite(r.durationMs) || r.durationMs < 0)) {
        metadata.schemaViolationCount++;
        continue;
      }
      if (r.backpressure !== undefined && r.backpressure !== null && typeof r.backpressure !== 'boolean') {
        metadata.schemaViolationCount++;
        continue;
      }
      if (r.skippedCount !== undefined && r.skippedCount !== null && (typeof r.skippedCount !== 'number' || !Number.isInteger(r.skippedCount) || r.skippedCount < 0)) {
        metadata.schemaViolationCount++;
        continue;
      }
      if ((r.clockDomain && r.clockDomain !== 'host-mono') || (hostTrace.clockDomain && hostTrace.clockDomain !== 'host-mono')) {
        continue;
      }
      const hostExtraKey = r.event === 'host-stream-skip'
        ? `${r.reason ?? 'skip'}:${r.skippedFrom ?? ''}:${r.skippedTo ?? ''}`
        : r.event === 'host-stream-drain'
          ? String(r.atMonoMs)
          : '';
      const isDup = checkDuplicate(r.runId ?? primaryRunId, r.connectionId, null, r.sequence, r.event, hostExtraKey);
      const f = getFrame(r.runId ?? primaryRunId, r.sequence);
      if (r.event === 'host-hub-received') {
        f.hostHubReceivedMonoMs = r.atMonoMs;
      } else if (r.event === 'host-stream-write') {
        f.hostStreamWrites.push({
          sequence: r.sequence,
          connectionId: r.connectionId ?? '',
          atMonoMs: r.atMonoMs,
          durationMs: r.durationMs ?? null,
          backpressure: r.backpressure ?? false,
          isDuplicate: isDup,
        });
        f.hostStreamWriteMonoMs = r.atMonoMs;
        f.hostStreamWriteDurationMs = r.durationMs ?? null;
        if (r.backpressure === true) f.hostStreamBackpressure = true;
      } else if (r.event === 'host-stream-skip') {
        f.hostStreamSkips.push({
          sequence: r.sequence,
          connectionId: r.connectionId ?? '',
          atMonoMs: r.atMonoMs,
          reason: r.reason ?? 'skip',
          skippedCount: r.skippedCount ?? 0,
          isDuplicate: isDup,
        });
        f.hostStreamSkip = true;
        f.hostStreamSkipReason = r.reason ?? 'skip';
        if (r.skippedCount) f.hostStreamSkippedCount += r.skippedCount;
      }
    }
  }

  // 3. Process Client Records
  if (clientTrace && Array.isArray(clientTrace.records)) {
    for (const r of clientTrace.records) {
      if (!r || typeof r.sequence !== 'number' || !Number.isInteger(r.sequence) || r.sequence < 0) {
        metadata.schemaViolationCount++;
        continue;
      }
      if (typeof r.atMonoMs !== 'number' || !Number.isFinite(r.atMonoMs) || r.atMonoMs < 0) {
        metadata.schemaViolationCount++;
        continue;
      }
      if ((r.clockDomain && r.clockDomain !== 'client-mono') || (clientTrace.clockDomain && clientTrace.clockDomain !== 'client-mono')) {
        continue; // Handled in mismatch count above
      }
      const isDup = checkDuplicate(r.runId ?? primaryRunId, r.connectionId, r.generation, r.sequence, r.event);
      const f = getFrame(r.runId ?? primaryRunId, r.sequence);
      if (r.event === 'client-accept') {
        f.clientAccepts.push({
          runId: r.runId ?? primaryRunId,
          connectionId: r.connectionId ?? '',
          generation: r.generation ?? 0,
          sequence: r.sequence,
          atMonoMs: r.atMonoMs,
        });
        f.clientAcceptMonoMs = r.atMonoMs;
        if (!f.capturedAt && r.capturedAt) f.capturedAt = r.capturedAt;
      } else if (r.event === 'client-schedule-fire') {
        f.clientSchedules.push({
          runId: r.runId ?? primaryRunId,
          connectionId: r.connectionId ?? '',
          generation: r.generation ?? 0,
          sequence: r.sequence,
          atMonoMs: r.atMonoMs,
          scheduleSource: r.scheduleSource ?? null,
          isDuplicate: isDup,
        });
        f.clientScheduleFireMonoMs = r.atMonoMs;
        f.clientScheduleSource = r.scheduleSource ?? null;
      } else if (r.event === 'client-decode-start') {
        f.clientDecodeStartMonoMs = r.atMonoMs;
      } else if (r.event === 'client-decode-end') {
        f.clientDecodes.push({
          runId: r.runId ?? primaryRunId,
          connectionId: r.connectionId ?? '',
          generation: r.generation ?? 0,
          sequence: r.sequence,
          atMonoMs: r.atMonoMs,
          durationMs: r.durationMs ?? null,
          success: r.success ?? true,
          isDuplicate: isDup,
        });
        f.clientDecodeEndMonoMs = r.atMonoMs;
        f.clientDecodeDurationMs = r.durationMs ?? null;
        f.clientDecodeSuccess = r.success ?? true;
      } else if (r.event === 'client-draw-start') {
        f.clientDrawStartMonoMs = r.atMonoMs;
      } else if (r.event === 'client-draw-end') {
        f.clientDraws.push({
          runId: r.runId ?? primaryRunId,
          connectionId: r.connectionId ?? '',
          generation: r.generation ?? 0,
          sequence: r.sequence,
          atMonoMs: r.atMonoMs,
          durationMs: r.durationMs ?? null,
          success: r.success ?? true,
          isDuplicate: isDup,
        });
        f.clientDrawEndMonoMs = r.atMonoMs;
        f.clientDrawDurationMs = r.durationMs ?? null;
        f.clientDrawSuccess = r.success ?? true;
      } else if (r.event === 'client-draw-skipped') {
        f.clientDrawSkips.push({
          runId: r.runId ?? primaryRunId,
          connectionId: r.connectionId ?? '',
          generation: r.generation ?? 0,
          sequence: r.sequence,
          atMonoMs: r.atMonoMs,
          reason: r.reason ?? 'skipped',
          isDuplicate: isDup,
        });
        f.clientDrawSuccess = false;
        f.clientDrawSkippedReason = r.reason ?? 'skipped';
      }
    }
  }

  const aligned = Array.from(frames.values()).sort((a, b) => {
    if (a.runId !== b.runId) return String(a.runId).localeCompare(String(b.runId));
    return a.sequence - b.sequence;
  });
  aligned.metadata = metadata;
  return aligned;
}

export function analyzeCadenceTimeline(alignedFrames) {
  const meta = alignedFrames?.metadata || {};

  const hasClientTrace = meta.hasClientTrace !== false &&
    alignedFrames &&
    alignedFrames.some(f => (Array.isArray(f.clientDraws) && f.clientDraws.length > 0) || f.clientAcceptMonoMs !== null);

  if (!alignedFrames || alignedFrames.length === 0 || meta.unavailable || !hasClientTrace) {
    let hostBackpressureCount = 0;
    let hostDuplicateSkipCount = 0;
    let hostLatestSkipCount = 0;
    let hostSkippedFrameCount = 0;
    if (Array.isArray(alignedFrames)) {
      for (const f of alignedFrames) {
        if (Array.isArray(f.hostStreamWrites) && f.hostStreamWrites.length > 0) {
          for (const w of f.hostStreamWrites) {
            if (!w.isDuplicate && w.backpressure === true) hostBackpressureCount++;
          }
        } else if (f.hostStreamBackpressure === true) {
          hostBackpressureCount++;
        }
        if (Array.isArray(f.hostStreamSkips) && f.hostStreamSkips.length > 0) {
          for (const sk of f.hostStreamSkips) {
            if (sk.isDuplicate) continue;
            if (sk.reason === 'duplicate-sequence') hostDuplicateSkipCount++;
            else if (sk.reason === 'latest-overwritten') {
              hostLatestSkipCount++;
              hostSkippedFrameCount += (sk.skippedCount || 0);
            }
          }
        } else if (f.hostStreamSkip) {
          if (f.hostStreamSkipReason === 'duplicate-sequence') hostDuplicateSkipCount++;
          else if (f.hostStreamSkipReason === 'latest-overwritten') {
            hostLatestSkipCount++;
            hostSkippedFrameCount += f.hostStreamSkippedCount;
          }
        }
      }
    }

    return {
      state: 'unavailable',
      unknown: true,
      totalFrames: alignedFrames?.length ?? 0,
      metadata: { ...meta, unavailable: true },
      anomalies: {
        unavailable: true,
        hostBackpressureCount,
        hostDuplicateSkipCount,
        hostLatestSkipCount,
        hostSkippedFrameCount,
        crossRunCount: meta.crossRunCount ?? 0,
        clockDomainMismatchCount: meta.clockDomainMismatchCount ?? 0,
        duplicateEventCount: meta.duplicateEventCount ?? 0,
        schemaViolationCount: meta.schemaViolationCount ?? 0,
        overflowCount: meta.overflowCount ?? 0,
        droppedBatchRecords: meta.droppedBatchRecords ?? 0,
      },
    };
  }

  // Partition frames by runId to prevent cross-run interval contamination
  const runs = new Map();
  for (const f of alignedFrames) {
    if (!runs.has(f.runId)) runs.set(f.runId, []);
    runs.get(f.runId).push(f);
  }

  const allWgcIntervals = [];
  const allNativeWriteIntervals = [];
  const allHostReceivedIntervals = [];
  const allHostWriteIntervals = [];
  const allClientAcceptIntervals = [];
  const allClientDrawIntervals = [];
  const decodeDurations = [];
  const drawDurations = [];
  const cadenceRatios = [];

  for (const [runId, runFrames] of runs) {
    const wgcTimestamps = [];
    const nativeWriteTimestamps = [];
    const hostReceivedTimestamps = [];
    // Group Host writes strictly per connectionId
    const hostConnWrites = new Map();
    // Group Client accepts strictly per (connectionId, generation)
    const clientAcceptStreams = new Map();

    // Group client draws by client stream: `${runId}:${connectionId}:${generation}`
    const clientStreams = new Map();

    for (let i = 0; i < runFrames.length; i++) {
      const f = runFrames[i];
      if (f.wgcTimestampMs !== null) wgcTimestamps.push(f.wgcTimestampMs);
      if (f.nativePipeWriteMonoMs !== null) nativeWriteTimestamps.push(f.nativePipeWriteMonoMs);
      if (f.hostHubReceivedMonoMs !== null) hostReceivedTimestamps.push(f.hostHubReceivedMonoMs);
      if (Array.isArray(f.clientDecodes) && f.clientDecodes.length > 0) {
        for (const dec of f.clientDecodes) {
          if (!dec.isDuplicate && typeof dec.durationMs === 'number') {
            decodeDurations.push(dec.durationMs);
          }
        }
      } else if (f.clientDecodeDurationMs !== null) {
        decodeDurations.push(f.clientDecodeDurationMs);
      }

      if (Array.isArray(f.clientDraws) && f.clientDraws.length > 0) {
        for (const drw of f.clientDraws) {
          if (!drw.isDuplicate && drw.success && typeof drw.durationMs === 'number') {
            drawDurations.push(drw.durationMs);
          }
        }
      } else if (f.clientDrawDurationMs !== null) {
        drawDurations.push(f.clientDrawDurationMs);
      }

      if (Array.isArray(f.hostStreamWrites) && f.hostStreamWrites.length > 0) {
        for (const w of f.hostStreamWrites) {
          const connId = w.connectionId ?? '';
          if (!hostConnWrites.has(connId)) hostConnWrites.set(connId, []);
          hostConnWrites.get(connId).push(w);
        }
      } else if (f.hostStreamWriteMonoMs !== null) {
        if (!hostConnWrites.has('')) hostConnWrites.set('', []);
        hostConnWrites.get('').push({ sequence: f.sequence, atMonoMs: f.hostStreamWriteMonoMs });
      }

      if (Array.isArray(f.clientAccepts) && f.clientAccepts.length > 0) {
        for (const a of f.clientAccepts) {
          const key = `${a.connectionId}:${a.generation}`;
          if (!clientAcceptStreams.has(key)) clientAcceptStreams.set(key, []);
          clientAcceptStreams.get(key).push(a);
        }
      } else if (f.clientAcceptMonoMs !== null) {
        if (!clientAcceptStreams.has('')) clientAcceptStreams.set('', []);
        clientAcceptStreams.get('').push({ sequence: f.sequence, atMonoMs: f.clientAcceptMonoMs });
      }

      if (Array.isArray(f.clientDraws)) {
        for (const d of f.clientDraws) {
          if (!d.success || d.isDuplicate) continue;
          const streamKey = `${d.runId}:${d.connectionId}:${d.generation}`;
          if (!clientStreams.has(streamKey)) clientStreams.set(streamKey, []);
          clientStreams.get(streamKey).push({
            ...d,
            wgcTimestampMs: f.wgcTimestampMs,
          });
        }
      }
    }

    allWgcIntervals.push(...computeIntervals(wgcTimestamps));
    allNativeWriteIntervals.push(...computeIntervals(nativeWriteTimestamps));
    allHostReceivedIntervals.push(...computeIntervals(hostReceivedTimestamps));

    for (const writes of hostConnWrites.values()) {
      writes.sort((a, b) => a.sequence - b.sequence || a.atMonoMs - b.atMonoMs);
      allHostWriteIntervals.push(...computeIntervals(writes.map(w => w.atMonoMs)));
    }

    for (const accepts of clientAcceptStreams.values()) {
      accepts.sort((a, b) => a.sequence - b.sequence || a.atMonoMs - b.atMonoMs);
      allClientAcceptIntervals.push(...computeIntervals(accepts.map(a => a.atMonoMs)));
    }

    // Calculate client draw intervals and cadenceProxyRatio strictly within each stream
    for (const [streamKey, streamFrames] of clientStreams) {
      streamFrames.sort((a, b) => a.sequence - b.sequence || a.atMonoMs - b.atMonoMs);
      const drawTimestamps = streamFrames.map(d => d.atMonoMs);
      allClientDrawIntervals.push(...computeIntervals(drawTimestamps));

      let prevDrawn = null;
      for (const currDrawn of streamFrames) {
        if (prevDrawn !== null) {
          // Strict pair verification: both adjacent drawn frames must possess valid WGC timestamps
          if (currDrawn.wgcTimestampMs !== null && prevDrawn.wgcTimestampMs !== null) {
            const drawDelta = currDrawn.atMonoMs - prevDrawn.atMonoMs;
            const wgcDelta = currDrawn.wgcTimestampMs - prevDrawn.wgcTimestampMs;
            if (drawDelta > 0 && wgcDelta >= 0) {
              cadenceRatios.push(Number((wgcDelta / drawDelta).toFixed(3)));
            }
          }
        }
        prevDrawn = currDrawn;
      }
    }
  }

  let hostBackpressureCount = 0;
  let hostDuplicateSkipCount = 0;
  let hostLatestSkipCount = 0;
  let hostSkippedFrameCount = 0;
  let decodeFailCount = 0;
  let drawFailCount = 0;
  let drawSkippedCount = 0;
  let timeoutScheduleCount = 0;
  let rafScheduleCount = 0;

  for (const f of alignedFrames) {
    if (Array.isArray(f.hostStreamWrites) && f.hostStreamWrites.length > 0) {
      for (const w of f.hostStreamWrites) {
        if (!w.isDuplicate && w.backpressure === true) hostBackpressureCount++;
      }
    } else if (f.hostStreamBackpressure === true) {
      hostBackpressureCount++;
    }
    if (Array.isArray(f.hostStreamSkips) && f.hostStreamSkips.length > 0) {
      for (const sk of f.hostStreamSkips) {
        if (sk.isDuplicate) continue;
        if (sk.reason === 'duplicate-sequence') hostDuplicateSkipCount++;
        else if (sk.reason === 'latest-overwritten') {
          hostLatestSkipCount++;
          hostSkippedFrameCount += (sk.skippedCount || 0);
        }
      }
    } else if (f.hostStreamSkip) {
      if (f.hostStreamSkipReason === 'duplicate-sequence') hostDuplicateSkipCount++;
      else if (f.hostStreamSkipReason === 'latest-overwritten') {
        hostLatestSkipCount++;
        hostSkippedFrameCount += f.hostStreamSkippedCount;
      }
    }
    if (Array.isArray(f.clientDecodes) && f.clientDecodes.length > 0) {
      for (const dec of f.clientDecodes) {
        if (!dec.isDuplicate && dec.success === false) decodeFailCount++;
      }
    } else if (f.clientDecodeSuccess === false) {
      decodeFailCount++;
    }

    if (Array.isArray(f.clientDraws) && f.clientDraws.length > 0) {
      for (const drw of f.clientDraws) {
        if (!drw.isDuplicate && drw.success === false) drawFailCount++;
      }
    } else if (f.clientDrawSuccess === false && f.clientDrawEndMonoMs !== null) {
      drawFailCount++;
    }

    if (Array.isArray(f.clientDrawSkips) && f.clientDrawSkips.length > 0) {
      for (const skp of f.clientDrawSkips) {
        if (!skp.isDuplicate) drawSkippedCount++;
      }
    } else if (f.clientDrawSkippedReason) {
      drawSkippedCount++;
    }

    if (Array.isArray(f.clientSchedules) && f.clientSchedules.length > 0) {
      for (const sch of f.clientSchedules) {
        if (!sch.isDuplicate) {
          if (sch.scheduleSource === 'timeout') timeoutScheduleCount++;
          else if (sch.scheduleSource === 'raf') rafScheduleCount++;
        }
      }
    } else if (f.clientScheduleSource) {
      if (f.clientScheduleSource === 'timeout') timeoutScheduleCount++;
      else if (f.clientScheduleSource === 'raf') rafScheduleCount++;
    }
  }

  const hasNegativeIntervals = allClientDrawIntervals.some(i => i < 0) ||
                               allClientAcceptIntervals.some(i => i < 0) ||
                               allHostWriteIntervals.some(i => i < 0) ||
                               allHostReceivedIntervals.some(i => i < 0) ||
                               allNativeWriteIntervals.some(i => i < 0) ||
                               allWgcIntervals.some(i => i < 0);
  const clientUnfinalized = Boolean(hasClientTrace && meta.clientFinalized === false);
  const isDegraded = Boolean(
    meta.degraded ||
    (meta.overflowCount ?? 0) > 0 ||
    (meta.clientOverflowCount ?? 0) > 0 ||
    (meta.droppedBatchRecords ?? 0) > 0 ||
    (meta.clientDroppedCount ?? 0) > 0 ||
    (meta.clientTrailingUnsentCount ?? 0) > 0 ||
    (meta.clockDomainMismatchCount ?? 0) > 0 ||
    (meta.duplicateEventCount ?? 0) > 0 ||
    (meta.schemaViolationCount ?? 0) > 0 ||
    (meta.crossRunCount ?? 0) > 0 ||
    decodeFailCount > 0 ||
    drawFailCount > 0 ||
    clientUnfinalized ||
    hasNegativeIntervals
  );

  const stats = {
    state: isDegraded ? 'degraded' : 'available',
    unknown: false,
    totalFrames: alignedFrames.length,
    metadata: {
      ...meta,
      state: isDegraded ? 'degraded' : 'available',
    },
    wgcIntervals: computeStats(allWgcIntervals),
    nativeWriteIntervals: computeStats(allNativeWriteIntervals),
    hostReceivedIntervals: computeStats(allHostReceivedIntervals),
    hostWriteIntervals: computeStats(allHostWriteIntervals),
    clientAcceptIntervals: computeStats(allClientAcceptIntervals),
    clientDrawIntervals: computeStats(allClientDrawIntervals),
    decodeDurations: computeStats(decodeDurations),
    drawDurations: computeStats(drawDurations),
    cadenceProxyRatio: computeStats(cadenceRatios),
    anomalies: {
      hostBackpressureCount,
      hostDuplicateSkipCount,
      hostLatestSkipCount,
      hostSkippedFrameCount,
      decodeFailCount,
      drawFailCount,
      drawSkippedCount,
      timeoutScheduleCount,
      rafScheduleCount,
      clientUnfinalized: clientUnfinalized ? 1 : 0,
      duplicateEventCount: meta.duplicateEventCount ?? 0,
      schemaViolationCount: meta.schemaViolationCount ?? 0,
      crossRunCount: meta.crossRunCount ?? 0,
      clockDomainMismatchCount: meta.clockDomainMismatchCount ?? 0,
      overflowCount: meta.overflowCount ?? 0,
      droppedBatchRecords: meta.droppedBatchRecords ?? 0,
      clientOverflowCount: meta.clientOverflowCount ?? 0,
      clientDroppedCount: meta.clientDroppedCount ?? 0,
      clientTrailingUnsentCount: meta.clientTrailingUnsentCount ?? 0,
      trailingUnsentCount: meta.clientTrailingUnsentCount ?? 0,
    },
  };

  return stats;
}

export function generateSyntheticFixtureComparison() {
  const steadyDraws = [33, 33, 34, 33, 33, 34, 33, 33, 34];
  const burstDraws  = [10, 10, 80, 10, 10, 80, 10, 10, 80];

  const steadyStats = computeStats(steadyDraws);
  const burstStats = computeStats(burstDraws);

  return {
    label: 'synthetic',
    steady: steadyStats,
    burst: burstStats,
    maskedRate: steadyStats.mean === burstStats.mean,
    p95DivergenceMs: burstStats.p95 - steadyStats.p95,
  };
}
