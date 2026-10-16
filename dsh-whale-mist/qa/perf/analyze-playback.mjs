// Offline playback phase and segment analyzer.
//
// Reads an observation report (produced by watch-playback.mjs) and a segment manifest,
// computes throughput rates, phase timing distributions, strictly adjacent frame intervals,
// evaluates comparability gates, and writes analysis.json and analysis.md.
//
// Usage:
//   node qa/perf/analyze-playback.mjs --input <observation.json|observation-dir> --segments <segments.json> --output <new-directory>
//
// Exit codes:
//   0  a report was written (dataReady may be false: see status.reasons)
//   2  invocation was wrong (missing arguments)
//   3  input was rejected (broken JSON, invalid schema, negative times, non-finite bounds, conflicting frames, output exists)

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export class BadInput extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadInput';
  }
}

async function pathExists(path) {
  try {
    await stat(resolve(path));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function readJson(path, label) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    throw new BadInput(`${label}: cannot read file ${path} (${err.code || err.message})`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new BadInput(`${label}: ${path} is not valid JSON (${err.message})`);
  }
  return { path, data: parsed };
}

export function assertAllNumbersFinite(value, path = 'root') {
  if (value === null || value === undefined) return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new BadInput(`${path} contains non-finite number: ${value}`);
    }
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      assertAllNumbersFinite(value[i], `${path}[${i}]`);
    }
  } else if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      assertAllNumbersFinite(value[key], `${path}.${key}`);
    }
  }
}

export function computeStats(values) {
  const filtered = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (filtered.length === 0) return null;
  const sorted = [...filtered].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const p95Index = Math.round((sorted.length - 1) * 0.95);
  const p95 = sorted[p95Index];
  const max = sorted[sorted.length - 1];
  const min = sorted[0];

  return {
    count: sorted.length,
    mean: Number(mean.toFixed(2)),
    p50: Number(median.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    max: Number(max.toFixed(2)),
    min: Number(min.toFixed(2)),
  };
}

/** Computes intervals strictly from adjacent frame sequences: curr.frames === prev.frames + 1 */
export function computeAdjacentIntervals(records, segmentDurationMs = 0) {
  if (!Array.isArray(records) || records.length < 2) {
    return {
      adjacentPairs: 0,
      intervalsMs: null,
      longGapsOver250ms: 0,
      cadenceFps: null,
      coverageSpanSeconds: 0,
      coveredSeconds: 0,
      coverageRatio: 0,
      coverageAdequate: false,
      coverageNotice: '样本数不足2帧，无法计算相邻间隔。长停顿数0仅因无数据，不代表播放流畅。',
    };
  }

  // Ensure sorted by frames sequence
  const sorted = [...records].sort((a, b) => a.frames - b.frames);
  const pairs = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b.frames === a.frames + 1) {
      if (typeof a.seconds === 'number' && Number.isFinite(a.seconds) &&
          typeof b.seconds === 'number' && Number.isFinite(b.seconds) &&
          b.seconds >= a.seconds) {
        pairs.push({
          prevFrame: a.frames,
          currFrame: b.frames,
          gapMs: (b.seconds - a.seconds) * 1000,
          aSeconds: a.seconds,
          bSeconds: b.seconds,
        });
      }
    }
  }

  if (pairs.length === 0) {
    return {
      adjacentPairs: 0,
      intervalsMs: null,
      longGapsOver250ms: 0,
      cadenceFps: null,
      coverageSpanSeconds: 0,
      coveredSeconds: 0,
      coverageRatio: 0,
      coverageAdequate: false,
      coverageNotice: '无严格相邻帧对（存在序号跳跃或稀疏抽样）。稀疏跳跃不记作断帧或长停顿；长停顿计数0仅因无相邻对，不代表播放流畅。',
    };
  }

  const gaps = pairs.map(p => p.gapMs);
  const stats = computeStats(gaps);
  const longGaps = gaps.filter(g => g >= 250).length;

  const totalGapSeconds = gaps.reduce((acc, g) => acc + g, 0) / 1000;
  const cadenceFps = totalGapSeconds > 0 ? Number((pairs.length / totalGapSeconds).toFixed(2)) : null;

  const firstSec = pairs[0].aSeconds;
  const lastSec = pairs[pairs.length - 1].bSeconds;
  const coverageSpanSeconds = Number((lastSec - firstSec).toFixed(3));

  // Compute union of strictly adjacent intervals [aSeconds, bSeconds]
  const intervals = pairs.map(p => [p.aSeconds, p.bSeconds]).sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const iv of intervals) {
    if (merged.length === 0 || iv[0] > merged[merged.length - 1][1]) {
      merged.push([...iv]);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
    }
  }
  const coveredSeconds = Number(merged.reduce((acc, iv) => acc + (iv[1] - iv[0]), 0).toFixed(3));

  const segDurationSec = segmentDurationMs > 0 ? segmentDurationMs / 1000 : coverageSpanSeconds;
  const coverageRatio = segDurationSec > 0 ? Number(Math.min(1.0, coveredSeconds / segDurationSec).toFixed(3)) : 0;
  const coverageAdequate = pairs.length >= 2 && coverageRatio >= 0.5;

  return {
    adjacentPairs: pairs.length,
    intervalsMs: stats,
    longGapsOver250ms: longGaps,
    cadenceFps,
    coverageSpanSeconds,
    coveredSeconds,
    coverageRatio,
    coverageAdequate,
    coverageNotice: coverageAdequate
      ? '仅基于严格相邻帧序号（N与N+1）计算，稀疏跳帧不视作长停顿。'
      : `相邻帧有效覆盖时间（${coveredSeconds}s）不足本段时长的50%（覆盖率 ${(coverageRatio * 100).toFixed(1)}%），数据分布仅代表样本（P50/P95），不宣称完整阶段分布。`,
  };
}

export function validateObservation(obs, sourcePath) {
  const where = `observation ${sourcePath}`;
  if (!obs || typeof obs !== 'object') throw new BadInput(`${where}: root must be an object`);
  assertAllNumbersFinite(obs, where);
  if (obs.schemaVersion !== 1) throw new BadInput(`${where}: schemaVersion must be 1, got ${JSON.stringify(obs.schemaVersion)}`);
  if (!Array.isArray(obs.samples) || obs.samples.length === 0) {
    throw new BadInput(`${where}: samples must be a non-empty array`);
  }

  let prevElapsedMs = -Infinity;
  for (let i = 0; i < obs.samples.length; i += 1) {
    const s = obs.samples[i];
    if (!s || typeof s !== 'object') throw new BadInput(`${where}: samples[${i}] must be an object`);
    if (typeof s.elapsedMs !== 'number' || !Number.isFinite(s.elapsedMs) || s.elapsedMs < 0) {
      throw new BadInput(`${where}: samples[${i}].elapsedMs must be a non-negative finite number, got ${s.elapsedMs}`);
    }
    if (s.elapsedMs < prevElapsedMs) {
      throw new BadInput(`${where}: samples[${i}].elapsedMs (${s.elapsedMs}) decreased from previous (${prevElapsedMs})`);
    }
    prevElapsedMs = s.elapsedMs;

    // Check non-negative relative clocks and counts (G3)
    const statusData = s.status?.data;
    if (statusData && typeof statusData === 'object') {
      if (typeof statusData.seconds === 'number' && statusData.seconds < 0) {
        throw new BadInput(`${where}: samples[${i}].status.data.seconds must be non-negative, got ${statusData.seconds}`);
      }
      if (typeof statusData.frames === 'number' && statusData.frames < 0) {
        throw new BadInput(`${where}: samples[${i}].status.data.frames must be non-negative, got ${statusData.frames}`);
      }
      if (statusData.pacing && typeof statusData.pacing === 'object') {
        for (const [k, v] of Object.entries(statusData.pacing)) {
          if (typeof v === 'number' && v < 0) {
            throw new BadInput(`${where}: samples[${i}].status.data.pacing.${k} must be non-negative, got ${v}`);
          }
        }
      }
    }

    const previewData = s.previewStatus?.data;
    if (previewData && typeof previewData === 'object') {
      if (typeof previewData.seconds === 'number' && previewData.seconds < 0) {
        throw new BadInput(`${where}: samples[${i}].previewStatus.data.seconds must be non-negative, got ${previewData.seconds}`);
      }
      if (typeof previewData.received === 'number' && previewData.received < 0) {
        throw new BadInput(`${where}: samples[${i}].previewStatus.data.received must be non-negative, got ${previewData.received}`);
      }
      const clientData = previewData.client;
      if (clientData && typeof clientData === 'object') {
        if (typeof clientData.seconds === 'number' && clientData.seconds < 0) {
          throw new BadInput(`${where}: samples[${i}].previewStatus.data.client.seconds must be non-negative, got ${clientData.seconds}`);
        }
        if (typeof clientData.rendered === 'number' && clientData.rendered < 0) {
          throw new BadInput(`${where}: samples[${i}].previewStatus.data.client.rendered must be non-negative, got ${clientData.rendered}`);
        }
        if (typeof clientData.received === 'number' && clientData.received < 0) {
          throw new BadInput(`${where}: samples[${i}].previewStatus.data.client.received must be non-negative, got ${clientData.received}`);
        }
      }
    }
  }

  // Validate framesSnapshot for conflicting records and non-negative values
  const records = obs.framesSnapshot?.records;
  if (Array.isArray(records)) {
    const sequenceMap = new Map();
    for (let i = 0; i < records.length; i += 1) {
      const r = records[i];
      if (!r || typeof r !== 'object') continue;
      if (typeof r.seconds === 'number' && r.seconds < 0) {
        throw new BadInput(`${where}: framesSnapshot.records[${i}].seconds must be non-negative, got ${r.seconds}`);
      }
      if (typeof r.frames === 'number' && r.frames < 0) {
        throw new BadInput(`${where}: framesSnapshot.records[${i}].frames must be non-negative, got ${r.frames}`);
      }
      if (typeof r.cycleIntervalMs === 'number' && r.cycleIntervalMs < 0) {
        throw new BadInput(`${where}: framesSnapshot.records[${i}].cycleIntervalMs must be non-negative, got ${r.cycleIntervalMs}`);
      }
      if (typeof r.prevPacingRequestedMs === 'number' && r.prevPacingRequestedMs < 0) {
        throw new BadInput(`${where}: framesSnapshot.records[${i}].prevPacingRequestedMs must be non-negative, got ${r.prevPacingRequestedMs}`);
      }
      if (typeof r.prevPacingActualMs === 'number' && r.prevPacingActualMs < 0) {
        throw new BadInput(`${where}: framesSnapshot.records[${i}].prevPacingActualMs must be non-negative, got ${r.prevPacingActualMs}`);
      }
      if (typeof r.prevPostRecordMs === 'number' && r.prevPostRecordMs < 0) {
        throw new BadInput(`${where}: framesSnapshot.records[${i}].prevPostRecordMs must be non-negative, got ${r.prevPostRecordMs}`);
      }
      if (typeof r.prevEmptyWaitActualMs === 'number' && r.prevEmptyWaitActualMs < 0) {
        throw new BadInput(`${where}: framesSnapshot.records[${i}].prevEmptyWaitActualMs must be non-negative, got ${r.prevEmptyWaitActualMs}`);
      }
      if (typeof r.prevEmptyRetryCount === 'number' && r.prevEmptyRetryCount < 0) {
        throw new BadInput(`${where}: framesSnapshot.records[${i}].prevEmptyRetryCount must be non-negative, got ${r.prevEmptyRetryCount}`);
      }
      if (typeof r.frames === 'number') {
        if (sequenceMap.has(r.frames)) {
          const existing = sequenceMap.get(r.frames);
          // If sequence is same but timestamps or values conflict, reject!
          if (existing.seconds !== r.seconds || existing.sourceTimestampMs !== r.sourceTimestampMs) {
            throw new BadInput(`${where}: framesSnapshot contains conflicting records for sequence ${r.frames} (seconds: ${existing.seconds} vs ${r.seconds})`);
          }
        } else {
          sequenceMap.set(r.frames, r);
        }
      }
    }
  }
}

export function validateSegmentsManifest(manifest, sourcePath) {
  const where = `segments ${sourcePath}`;
  if (!manifest || typeof manifest !== 'object') throw new BadInput(`${where}: root must be an object`);
  assertAllNumbersFinite(manifest, where);
  if (manifest.schemaVersion !== 1) throw new BadInput(`${where}: schemaVersion must be 1, got ${JSON.stringify(manifest.schemaVersion)}`);
  if (!Array.isArray(manifest.segments) || manifest.segments.length === 0) {
    throw new BadInput(`${where}: segments must be a non-empty array`);
  }

  for (let i = 0; i < manifest.segments.length; i += 1) {
    const seg = manifest.segments[i];
    if (!seg || typeof seg !== 'object') throw new BadInput(`${where}: segment[${i}] must be an object`);
    if (typeof seg.id !== 'string' || !seg.id.trim()) throw new BadInput(`${where}: segment[${i}].id must be a non-empty string`);

    // Bounds can be startElapsedMs/endElapsedMs or startIndex/endIndex
    const hasElapsed = seg.startElapsedMs !== undefined || seg.endElapsedMs !== undefined;
    const hasIndex = seg.startIndex !== undefined || seg.endIndex !== undefined;
    if (!hasElapsed && !hasIndex) {
      throw new BadInput(`${where}: segment[${i}] must specify startElapsedMs/endElapsedMs or startIndex/endIndex`);
    }
    if (hasElapsed) {
      if (typeof seg.startElapsedMs !== 'number' || !Number.isFinite(seg.startElapsedMs) || seg.startElapsedMs < 0 ||
          typeof seg.endElapsedMs !== 'number' || !Number.isFinite(seg.endElapsedMs) || seg.endElapsedMs < 0 ||
          seg.startElapsedMs >= seg.endElapsedMs) {
        throw new BadInput(`${where}: segment[${i}] has invalid elapsed bounds: start=${seg.startElapsedMs}, end=${seg.endElapsedMs}`);
      }
    }
    if (hasIndex) {
      if (typeof seg.startIndex !== 'number' || !Number.isFinite(seg.startIndex) || seg.startIndex < 0 ||
          typeof seg.endIndex !== 'number' || !Number.isFinite(seg.endIndex) || seg.endIndex < 0 ||
          seg.startIndex >= seg.endIndex) {
        throw new BadInput(`${where}: segment[${i}] has invalid index bounds: start=${seg.startIndex}, end=${seg.endIndex}`);
      }
    }
  }
}

export function analyzeSegment(segDef, observation) {
  const samples = observation.samples || [];

  // Filter samples belonging to this segment
  let segSamples = [];
  if (typeof segDef.startElapsedMs === 'number' && typeof segDef.endElapsedMs === 'number') {
    segSamples = samples.filter(s => s.elapsedMs >= segDef.startElapsedMs && s.elapsedMs <= segDef.endElapsedMs);
  } else if (typeof segDef.startIndex === 'number' && typeof segDef.endIndex === 'number') {
    segSamples = samples.slice(segDef.startIndex, segDef.endIndex + 1);
  }

  const result = {
    id: segDef.id,
    label: segDef.label || segDef.id,
    valid: false,
    sampleCount: segSamples.length,
    window: {
      startElapsedMs: segDef.startElapsedMs ?? (segSamples[0]?.elapsedMs ?? null),
      endElapsedMs: segDef.endElapsedMs ?? (segSamples[segSamples.length - 1]?.elapsedMs ?? null),
      actualDurationMs: null,
    },
    conditions: { ...(segDef.conditions || {}) },
    nativeThroughput: null,
    hostThroughput: null,
    clientThroughput: null,
    frontendStages: null,
    nativePacing: null,
    timings: null,
    frameIntervals: null,
    latencyReference: null,
    reasons: [],
  };

  if (segSamples.length < 2) {
    result.reasons.push('insufficient_samples_in_window (样本数少于2个)');
    return result;
  }

  result.window.actualDurationMs = segSamples[segSamples.length - 1].elapsedMs - segSamples[0].elapsedMs;

  const validStatusSamples = segSamples.filter(s => s.status && s.status.readOk && s.status.data && typeof s.status.data.frames === 'number');
  const validPreviewSamples = segSamples.filter(s => s.previewStatus && s.previewStatus.readOk && s.previewStatus.data);

  // Check in-segment dimension consistency (R1)
  let firstObservedWidth = null;
  let firstObservedHeight = null;
  let dimensionChangedInside = false;
  for (const s of validStatusSamples) {
    const w = s.status.data.width;
    const h = s.status.data.height;
    if (typeof w === 'number' && typeof h === 'number') {
      if (firstObservedWidth === null) {
        firstObservedWidth = w;
        firstObservedHeight = h;
      } else if (w !== firstObservedWidth || h !== firstObservedHeight) {
        dimensionChangedInside = true;
        break;
      }
    }
  }

  if (dimensionChangedInside) {
    result.reasons.push(`interior_size_change (段内画面尺寸发生变化: 首个为 ${firstObservedWidth}x${firstObservedHeight})`);
  }
  result.conditions.observedWidth = firstObservedWidth;
  result.conditions.observedHeight = firstObservedHeight;

  // Check expected dimension condition if specified
  if (typeof segDef.conditions?.expectedWidth === 'number' && firstObservedWidth !== null && segDef.conditions.expectedWidth !== firstObservedWidth) {
    result.reasons.push(`expected_width_mismatch: 期望 ${segDef.conditions.expectedWidth} != 实测 ${firstObservedWidth}`);
  }
  if (typeof segDef.conditions?.expectedHeight === 'number' && firstObservedHeight !== null && segDef.conditions.expectedHeight !== firstObservedHeight) {
    result.reasons.push(`expected_height_mismatch: 期望 ${segDef.conditions.expectedHeight} != 实测 ${firstObservedHeight}`);
  }

  // Directional check for non-negative relative clocks and counts (G3)
  for (let i = 0; i < segSamples.length; i += 1) {
    const s = segSamples[i];
    if (s.status?.data) {
      if (typeof s.status.data.seconds === 'number' && s.status.data.seconds < 0) {
        throw new BadInput(`analyzeSegment: negative native seconds (${s.status.data.seconds}) in segment ${segDef.id}`);
      }
      if (typeof s.status.data.frames === 'number' && s.status.data.frames < 0) {
        throw new BadInput(`analyzeSegment: negative native frames (${s.status.data.frames}) in segment ${segDef.id}`);
      }
      const p = s.status.data.pacing || s.status.data;
      if (p && typeof p === 'object') {
        for (const [k, v] of Object.entries(p)) {
          if (typeof v === 'number' && v < 0) {
            throw new BadInput(`analyzeSegment: negative pacing metric ${k} (${v}) in segment ${segDef.id}`);
          }
        }
      }
    }
    if (s.previewStatus?.data) {
      if (typeof s.previewStatus.data.seconds === 'number' && s.previewStatus.data.seconds < 0) {
        throw new BadInput(`analyzeSegment: negative preview seconds (${s.previewStatus.data.seconds}) in segment ${segDef.id}`);
      }
      if (typeof s.previewStatus.data.received === 'number' && s.previewStatus.data.received < 0) {
        throw new BadInput(`analyzeSegment: negative preview received (${s.previewStatus.data.received}) in segment ${segDef.id}`);
      }
      if (s.previewStatus.data.client) {
        const c = s.previewStatus.data.client;
        if (typeof c.seconds === 'number' && c.seconds < 0) {
          throw new BadInput(`analyzeSegment: negative client seconds (${c.seconds}) in segment ${segDef.id}`);
        }
        if (typeof c.rendered === 'number' && c.rendered < 0) {
          throw new BadInput(`analyzeSegment: negative client rendered (${c.rendered}) in segment ${segDef.id}`);
        }
        if (typeof c.received === 'number' && c.received < 0) {
          throw new BadInput(`analyzeSegment: negative client received (${c.received}) in segment ${segDef.id}`);
        }
      }
    }
  }

  // 1. Native Throughput & In-segment Rollback Detection (R2 & F3)
  const statusSamples = segSamples.filter(s => s.status && s.status.readOk && s.status.data);
  const statusWithClock = statusSamples.filter(s =>
    typeof s.status.data.frames === 'number' && Number.isFinite(s.status.data.frames) &&
    typeof s.status.data.seconds === 'number' && Number.isFinite(s.status.data.seconds)
  );
  const hasStatusMissingClock = statusSamples.some(s =>
    typeof s.status.data.frames === 'number' &&
    (s.status.data.seconds == null || typeof s.status.data.seconds !== 'number' || !Number.isFinite(s.status.data.seconds))
  );

  if (hasStatusMissingClock) {
    result.reasons.push('native_clock_missing (原生状态中时间秒数缺失或为空，不可虚构为0)');
  }

  let nativeRollback = false;
  for (let i = 1; i < statusWithClock.length; i += 1) {
    const prev = statusWithClock[i - 1].status.data;
    const curr = statusWithClock[i].status.data;
    if (curr.frames < prev.frames || curr.seconds < prev.seconds) {
      nativeRollback = true;
      break;
    }
  }

  if (nativeRollback) {
    result.reasons.push('native_counter_rollback (原生计数或秒数在段内发生回退/重置)');
  }

  if (!hasStatusMissingClock && statusWithClock.length >= 2 && !nativeRollback) {
    const sFirst = statusWithClock[0].status.data;
    const sLast = statusWithClock[statusWithClock.length - 1].status.data;

    const framesDelta = sLast.frames - sFirst.frames;
    const secondsDelta = sLast.seconds - sFirst.seconds;

    if (secondsDelta <= 0) {
      result.nativeThroughput = {
        deliveryRateFps: null,
        framesDelta,
        secondsDelta: Number(secondsDelta.toFixed(3)),
        label: '原生处理/送帧计数速率',
        note: '时间秒数未推进，无法计算速率',
      };
    } else {
      const rate = Number((framesDelta / secondsDelta).toFixed(2));
      result.nativeThroughput = {
        deliveryRateFps: rate,
        framesDelta,
        secondsDelta: Number(secondsDelta.toFixed(3)),
        label: '原生处理/送帧计数速率（每秒Native向Host输出帧数）',
        note: '非Wallpaper Engine源渲染FPS；包含采集、回读、编码与管道输出全过程。',
      };
    }

    result.conditions.observedNativeForeground = sLast.foreground; // WE window foreground
  } else {
    result.nativeThroughput = {
      deliveryRateFps: null,
      framesDelta: null,
      secondsDelta: null,
      label: '原生处理/送帧计数速率',
      note: hasStatusMissingClock
        ? '原生时钟缺失，无法计算速率'
        : (nativeRollback ? '原生计数或时钟发生回退' : '有效原生状态样本不足'),
    };
    if (statusWithClock.length > 0) {
      result.conditions.observedNativeForeground = statusWithClock[statusWithClock.length - 1].status.data.foreground;
    }
  }

  // 2. Host Throughput
  let hostRollback = false;
  for (let i = 1; i < validPreviewSamples.length; i += 1) {
    const prev = validPreviewSamples[i - 1].previewStatus.data;
    const curr = validPreviewSamples[i].previewStatus.data;
    if (typeof curr.received === 'number' && typeof prev.received === 'number' && curr.received < prev.received) {
      hostRollback = true;
      break;
    }
  }

  if (hostRollback) {
    result.reasons.push('host_counter_rollback (Host接收计数在段内发生回退/重置)');
  }

  if (validPreviewSamples.length >= 2 && !hostRollback) {
    const pFirst = validPreviewSamples[0].previewStatus.data;
    const pLast = validPreviewSamples[validPreviewSamples.length - 1].previewStatus.data;
    const tFirst = validPreviewSamples[0].elapsedMs;
    const tLast = validPreviewSamples[validPreviewSamples.length - 1].elapsedMs;

    if (typeof pFirst.received === 'number' && typeof pLast.received === 'number' &&
        Number.isFinite(pFirst.received) && Number.isFinite(pLast.received)) {
      const receivedDelta = pLast.received - pFirst.received;
      const elapsedSec = (tLast - tFirst) / 1000;

      let effectiveSecondsDelta = elapsedSec;
      if (typeof pLast.seconds === 'number' && typeof pFirst.seconds === 'number' &&
          Number.isFinite(pLast.seconds) && Number.isFinite(pFirst.seconds) &&
          pLast.seconds > pFirst.seconds) {
        effectiveSecondsDelta = pLast.seconds - pFirst.seconds;
      }

      if (effectiveSecondsDelta > 0 && receivedDelta >= 0) {
        result.hostThroughput = {
          receivedRateFps: Number((receivedDelta / effectiveSecondsDelta).toFixed(2)),
          receivedDelta,
          effectiveSecondsDelta: Number(effectiveSecondsDelta.toFixed(3)),
          label: 'Host接收帧速率',
        };
      }
    }
  }

  // 3. Client Throughput (R2 null count handling, in-segment reset detection, hidden & visibility guard, F3 missing clock, G1 progress coverage)
  if (validPreviewSamples.length >= 2) {
    const samplesWithClient = validPreviewSamples.filter(s => s.previewStatus.data.client && typeof s.previewStatus.data.client === 'object');
    if (samplesWithClient.length < 2) {
      result.clientThroughput = {
        valid: false,
        renderRateFps: null,
        receivedRateFps: null,
        reason: 'client_missing (客户端上报数据缺失或样本不足)',
      };
    } else {
      const cFirst = samplesWithClient[0].previewStatus.data.client;
      const cLast = samplesWithClient[samplesWithClient.length - 1].previewStatus.data.client;

      // Check for missing/null counts (F3: never synthesize 0 for null)
      const hasMissingClientCounts = samplesWithClient.some(s => {
        const c = s.previewStatus.data.client;
        return c.rendered == null || typeof c.rendered !== 'number' || !Number.isFinite(c.rendered) ||
               c.received == null || typeof c.received !== 'number' || !Number.isFinite(c.received);
      });

      // Check for missing/null client clocks (F3: legal missing clock remains null and blocks foreground comparison)
      const hasMissingClientClock = samplesWithClient.some(s => {
        const c = s.previewStatus.data.client;
        return c.seconds == null || typeof c.seconds !== 'number' || !Number.isFinite(c.seconds);
      });

      // Check hidden in ANY sample in segment
      const hasHidden = samplesWithClient.some(s => s.previewStatus?.data?.client?.hidden === 1 || s.previewStatus?.data?.client?.hidden === true);

      // Check unknown visibility (F2: hidden is not strictly 0 and not false)
      const hasUnknownVisibility = samplesWithClient.some(s => {
        const h = s.previewStatus?.data?.client?.hidden;
        return h !== 0 && h !== false;
      });

      if (hasMissingClientCounts) {
        result.clientThroughput = {
          valid: false,
          renderRateFps: null,
          receivedRateFps: null,
          renderedDelta: null,
          receivedDelta: null,
          clientSecondsDelta: null,
          reason: 'client_counts_missing (客户端rendered或received计数为null/缺失，不可虚构为0)',
        };
      } else if (hasMissingClientClock) {
        result.clientThroughput = {
          valid: false,
          renderRateFps: null,
          receivedRateFps: null,
          renderedDelta: null,
          receivedDelta: null,
          clientSecondsDelta: null,
          reason: 'client_clock_missing (客户端上报秒数缺失或为null，不可虚构为0)',
        };
      } else if (hasHidden) {
        result.clientThroughput = {
          valid: false,
          renderRateFps: null,
          receivedRateFps: null,
          reason: 'client_hidden (页面在后台，丢帧属主动停绘，不作为前台呈现速率)',
        };
      } else if (hasUnknownVisibility) {
        result.clientThroughput = {
          valid: false,
          renderRateFps: null,
          receivedRateFps: null,
          reason: 'client_visibility_unknown (页面可见性未知，不可作为前台呈现速率)',
        };
      } else {
        // Check client reset/rollback within segment (R2)
        let clientRollback = false;
        for (let i = 1; i < samplesWithClient.length; i += 1) {
          const prevC = samplesWithClient[i - 1].previewStatus.data.client;
          const currC = samplesWithClient[i].previewStatus.data.client;
          if (currC.rendered < prevC.rendered || currC.received < prevC.received || currC.seconds < prevC.seconds) {
            clientRollback = true;
            break;
          }
        }

        if (clientRollback) {
          result.clientThroughput = {
            valid: false,
            renderRateFps: null,
            receivedRateFps: null,
            reason: 'client_counter_reset (客户端计数或秒数在段内发生重置/回退)',
          };
        } else {
          const clientSecondsDelta = cLast.seconds - cFirst.seconds;
          if (typeof clientSecondsDelta !== 'number' || !Number.isFinite(clientSecondsDelta) || clientSecondsDelta <= 0) {
            result.clientThroughput = {
              valid: false,
              renderRateFps: null,
              receivedRateFps: null,
              reason: 'client_stale (客户端秒数未推进或陈旧)',
            };
          } else {
            const renderedDelta = cLast.rendered - cFirst.rendered;
            const receivedDelta = cLast.received - cFirst.received;

            // Compute client advancement coverage relative to observer window (G1)
            const segDurationSec = (result.window.actualDurationMs || 0) > 0
              ? result.window.actualDurationMs / 1000
              : clientSecondsDelta;
            const progressRatio = segDurationSec > 0
              ? Number((clientSecondsDelta / segDurationSec).toFixed(3))
              : 1.0;

            // Track distinct reports across segment
            let distinctClientReports = 0;
            let lastSeenClient = null;
            for (const s of samplesWithClient) {
              const c = s.previewStatus.data.client;
              if (!lastSeenClient || lastSeenClient.seconds !== c.seconds ||
                  lastSeenClient.rendered !== c.rendered || lastSeenClient.received !== c.received) {
                distinctClientReports += 1;
                lastSeenClient = c;
              }
            }

            // Freshness gate (G1): client seconds advancement must cover at least 50% of the observer window
            // to represent the entire phase (allowing for 500ms client reporting cadence vs 1000ms polling jitter)
            const coverageAdequate = progressRatio >= 0.5;

            if (!coverageAdequate) {
              result.clientThroughput = {
                valid: false,
                coverageAdequate: false,
                renderRateFps: Number((renderedDelta / clientSecondsDelta).toFixed(2)),
                receivedRateFps: Number((receivedDelta / clientSecondsDelta).toFixed(2)),
                renderedDelta,
                receivedDelta,
                clientSecondsDelta: Number(clientSecondsDelta.toFixed(3)),
                observedDurationMs: result.window.actualDurationMs,
                progressRatio,
                distinctReportCount: distinctClientReports,
                reason: `client_progress_insufficient (客户端推进时长 ${clientSecondsDelta.toFixed(3)}s 不足观察区间 ${segDurationSec.toFixed(3)}s 的 50%，覆盖率 ${(progressRatio * 100).toFixed(1)}%)`,
                label: '前端解码准备投递局部速率（覆盖不足，不可代表完整阶段）',
                note: 'rendered为前端解码完成准备投递给订阅者的计数，在进入paintWallpaper前统计，不代表canvas drawImage完成或物理屏幕呈现。',
              };
            } else {
              result.clientThroughput = {
                valid: true,
                coverageAdequate: true,
                renderRateFps: Number((renderedDelta / clientSecondsDelta).toFixed(2)),
                receivedRateFps: Number((receivedDelta / clientSecondsDelta).toFixed(2)),
                renderedDelta,
                receivedDelta,
                clientSecondsDelta: Number(clientSecondsDelta.toFixed(3)),
                observedDurationMs: result.window.actualDurationMs,
                progressRatio,
                distinctReportCount: distinctClientReports,
                label: '前端解码准备投递速率',
                note: 'rendered为前端解码完成准备投递给订阅者的计数，在进入paintWallpaper前统计，不代表canvas drawImage完成或物理屏幕呈现。',
              };
            }
          }
        }
      }

      // Latency reference (cumulative from client)
      result.latencyReference = {
        cumulativeMeanMs: cLast.meanLatencyMs ?? null,
        cumulativeMaxMs: cLast.maxLatencyMs ?? null,
        note: '客户端自启动以来的累计值，非本阶段P95或鼠标到屏幕的端到端响应时间。',
      };

      // 3b. Frontend Stages (P2: wait callback, decode, sync, drawImage, overwrite breakdown)
      const hasStageMetrics = cFirst.waitRafCount !== null && cFirst.waitRafCount !== undefined;
      if (!hasStageMetrics) {
        result.frontendStages = {
          available: false,
          valid: false,
          reason: 'frontend_stages_missing (客户端未包含P2前端分段指标)',
        };
      } else {
        const stageKeys = [
          'waitRafCount', 'waitRafSumMs', 'waitRafMaxMs',
          'waitTimeoutCount', 'waitTimeoutSumMs', 'waitTimeoutMaxMs',
          'waitCancelledCount',
          'decodeSuccessCount', 'decodeSuccessSumMs', 'decodeSuccessMaxMs',
          'decodeFailCount', 'decodeFailSumMs', 'decodeFailMaxMs',
          'discardHiddenCount', 'discardStaleCount',
          'syncCount', 'syncSumMs', 'syncMaxMs', 'syncErrorCount',
          'drawCount', 'drawSumMs', 'drawMaxMs', 'drawErrorCount',
          'dropDecodingCount', 'dropSyncCount', 'dropWaitingCallbackCount', 'dropOtherCount',
        ];

        const hasInvalidStageMetric = samplesWithClient.some(s => {
          const c = s.previewStatus?.data?.client;
          if (!c) return true;
          return stageKeys.some(k => c[k] == null || typeof c[k] !== 'number' || !Number.isFinite(c[k]) || c[k] < 0);
        });

        const stageCounterKeys = [
          'waitRafCount', 'waitRafSumMs',
          'waitTimeoutCount', 'waitTimeoutSumMs',
          'waitCancelledCount',
          'decodeSuccessCount', 'decodeSuccessSumMs',
          'decodeFailCount', 'decodeFailSumMs',
          'discardHiddenCount', 'discardStaleCount',
          'syncCount', 'syncSumMs', 'syncErrorCount',
          'drawCount', 'drawSumMs', 'drawErrorCount',
          'dropDecodingCount', 'dropSyncCount', 'dropWaitingCallbackCount', 'dropOtherCount',
        ];

        let stageRollback = false;
        for (let i = 1; i < samplesWithClient.length; i += 1) {
          const prevC = samplesWithClient[i - 1].previewStatus?.data?.client;
          const currC = samplesWithClient[i].previewStatus?.data?.client;
          if (prevC && currC) {
            for (const k of stageCounterKeys) {
              if (currC[k] < prevC[k]) {
                stageRollback = true;
                break;
              }
            }
          }
          if (stageRollback) break;
        }

        if (hasInvalidStageMetric) {
          result.frontendStages = {
            available: true,
            valid: false,
            reason: 'frontend_stages_invalid (前端分段指标缺失、非数字、非有限值或为负数)',
          };
        } else if (stageRollback) {
          result.frontendStages = {
            available: true,
            valid: false,
            reason: 'frontend_stages_counter_reset (前端阶段计数在段内发生重置/回退)',
          };
        } else {
          const waitRafCountDelta = cLast.waitRafCount - cFirst.waitRafCount;
          const waitRafSumMsDelta = Number((cLast.waitRafSumMs - cFirst.waitRafSumMs).toFixed(3));
          const waitRafMeanMs = waitRafCountDelta === 0 ? null : (waitRafSumMsDelta === 0 ? 0 : Number((waitRafSumMsDelta / waitRafCountDelta).toFixed(2)));

          const waitTimeoutCountDelta = cLast.waitTimeoutCount - cFirst.waitTimeoutCount;
          const waitTimeoutSumMsDelta = Number((cLast.waitTimeoutSumMs - cFirst.waitTimeoutSumMs).toFixed(3));
          const waitTimeoutMeanMs = waitTimeoutCountDelta === 0 ? null : (waitTimeoutSumMsDelta === 0 ? 0 : Number((waitTimeoutSumMsDelta / waitTimeoutCountDelta).toFixed(2)));

          const waitCancelledCountDelta = cLast.waitCancelledCount - cFirst.waitCancelledCount;

          const decodeSuccessCountDelta = cLast.decodeSuccessCount - cFirst.decodeSuccessCount;
          const decodeSuccessSumMsDelta = Number((cLast.decodeSuccessSumMs - cFirst.decodeSuccessSumMs).toFixed(3));
          const decodeSuccessMeanMs = decodeSuccessCountDelta === 0 ? null : (decodeSuccessSumMsDelta === 0 ? 0 : Number((decodeSuccessSumMsDelta / decodeSuccessCountDelta).toFixed(2)));

          const decodeFailCountDelta = cLast.decodeFailCount - cFirst.decodeFailCount;
          const decodeFailSumMsDelta = Number((cLast.decodeFailSumMs - cFirst.decodeFailSumMs).toFixed(3));
          const decodeFailMeanMs = decodeFailCountDelta === 0 ? null : (decodeFailSumMsDelta === 0 ? 0 : Number((decodeFailSumMsDelta / decodeFailCountDelta).toFixed(2)));

          const discardHiddenCountDelta = cLast.discardHiddenCount - cFirst.discardHiddenCount;
          const discardStaleCountDelta = cLast.discardStaleCount - cFirst.discardStaleCount;

          const syncCountDelta = cLast.syncCount - cFirst.syncCount;
          const syncSumMsDelta = Number((cLast.syncSumMs - cFirst.syncSumMs).toFixed(3));
          const syncMeanMs = syncCountDelta === 0 ? null : (syncSumMsDelta === 0 ? 0 : Number((syncSumMsDelta / syncCountDelta).toFixed(2)));
          const syncErrorCountDelta = cLast.syncErrorCount - cFirst.syncErrorCount;

          const drawCountDelta = cLast.drawCount - cFirst.drawCount;
          const drawSumMsDelta = Number((cLast.drawSumMs - cFirst.drawSumMs).toFixed(3));
          const drawMeanMs = drawCountDelta === 0 ? null : (drawSumMsDelta === 0 ? 0 : Number((drawSumMsDelta / drawCountDelta).toFixed(2)));
          const drawErrorCountDelta = cLast.drawErrorCount - cFirst.drawErrorCount;

          const clientSecDelta = (result.clientThroughput && typeof result.clientThroughput.clientSecondsDelta === 'number')
            ? result.clientThroughput.clientSecondsDelta
            : (cLast.seconds != null && cFirst.seconds != null ? cLast.seconds - cFirst.seconds : null);

          const drawRateFps = (clientSecDelta && clientSecDelta > 0 && drawCountDelta != null)
            ? Number((drawCountDelta / clientSecDelta).toFixed(2))
            : null;

          const dropDecodingDelta = cLast.dropDecodingCount - cFirst.dropDecodingCount;
          const dropSyncDelta = cLast.dropSyncCount - cFirst.dropSyncCount;
          const dropWaitingCallbackDelta = cLast.dropWaitingCallbackCount - cFirst.dropWaitingCallbackCount;
          const dropOtherDelta = cLast.dropOtherCount - cFirst.dropOtherCount;
          const droppedTotalDelta = (cLast.dropped != null && cFirst.dropped != null) ? (cLast.dropped - cFirst.dropped) : null;
          const droppedSumCalculated = dropDecodingDelta + dropSyncDelta + dropWaitingCallbackDelta + dropOtherDelta;
          const droppedBreakdownMatches = (droppedTotalDelta != null && droppedSumCalculated === droppedTotalDelta);
          const isThroughputValid = result.clientThroughput?.valid === true;
          let stagesValid = isThroughputValid;
          let stagesReason = isThroughputValid ? null : (result.clientThroughput?.reason || 'client_throughput_invalid');
          if (stagesValid && !droppedBreakdownMatches) {
            stagesValid = false;
            stagesReason = `frontend_stages_dropped_mismatch (覆盖丢帧分类增量之和 ${droppedSumCalculated} 与总 dropped 增量 ${droppedTotalDelta} 不一致)`;
          }

          result.frontendStages = {
            available: true,
            valid: stagesValid,
            reason: stagesReason,
            drawRateFps,
            waitRaf: {
              count: waitRafCountDelta,
              sumMs: waitRafSumMsDelta,
              meanMs: waitRafMeanMs,
              cumulativeMaxMs: cLast.waitRafMaxMs ?? null,
            },
            waitTimeout: {
              count: waitTimeoutCountDelta,
              sumMs: waitTimeoutSumMsDelta,
              meanMs: waitTimeoutMeanMs,
              cumulativeMaxMs: cLast.waitTimeoutMaxMs ?? null,
            },
            waitCancelled: {
              count: waitCancelledCountDelta,
            },
            decodeSuccess: {
              count: decodeSuccessCountDelta,
              sumMs: decodeSuccessSumMsDelta,
              meanMs: decodeSuccessMeanMs,
              cumulativeMaxMs: cLast.decodeSuccessMaxMs ?? null,
            },
            decodeFail: {
              count: decodeFailCountDelta,
              sumMs: decodeFailSumMsDelta,
              meanMs: decodeFailMeanMs,
              cumulativeMaxMs: cLast.decodeFailMaxMs ?? null,
            },
            discard: {
              hiddenCount: discardHiddenCountDelta,
              staleCount: discardStaleCountDelta,
            },
            sync: {
              count: syncCountDelta,
              sumMs: syncSumMsDelta,
              meanMs: syncMeanMs,
              cumulativeMaxMs: cLast.syncMaxMs ?? null,
              errorCount: syncErrorCountDelta,
            },
            draw: {
              count: drawCountDelta,
              sumMs: drawSumMsDelta,
              meanMs: drawMeanMs,
              cumulativeMaxMs: cLast.drawMaxMs ?? null,
              errorCount: drawErrorCountDelta,
            },
            droppedBreakdown: {
              dropDecoding: dropDecodingDelta,
              dropSync: dropSyncDelta,
              dropWaitingCallback: dropWaitingCallbackDelta,
              dropOther: dropOtherDelta,
              totalDroppedDelta: droppedTotalDelta,
              calculatedSum: droppedSumCalculated,
              matches: droppedBreakdownMatches,
            },
            notes: {
              cumulativeMaxNotice: 'cumulativeMaxMs 为客户端自启动以来的全局累计最大值，非本测量阶段内的实际最大值或P95。',
              canvasDrawNotice: 'drawImage 耗时仅测量 CanvasRenderingContext2D.drawImage 同步调用时长，返回不代表物理屏幕呈现或DWM合成。',
              droppedNotice: '待处理帧覆盖分类反映新帧到达时最新帧所处的生命周期状态，非鼠标交互的因果证明。',
            },
          };
        }
      }
    }
  } else {
    result.clientThroughput = {
      valid: false,
      renderRateFps: null,
      receivedRateFps: null,
      reason: 'preview_status_missing (缺乏足够的PreviewStatus样本)',
    };
    result.frontendStages = {
      available: false,
      valid: false,
      reason: 'preview_status_missing (缺乏足够的PreviewStatus样本)',
    };
  }

  // 3c. Native Pacing Stages (P3: pacing wait, post-record, status publish, empty retries, cycle interval, total work)
  const getPacing = s => (s.status?.data?.pacing && typeof s.status.data.pacing === 'object') ? s.status.data.pacing : s.status?.data;

  const pacingRequiredCounterKeys = [
    'pacingWaitCount', 'pacingWaitRequestedSumMs', 'pacingWaitActualSumMs',
    'postRecordCount', 'postRecordSumMs',
    'statusPublishCount', 'statusPublishSumMs',
    'emptyRetryCount', 'emptyWaitRequestedSumMs', 'emptyWaitActualSumMs',
    'cycleIntervalCount', 'cycleIntervalSumMs',
    'totalWorkCount', 'totalWorkSumMs',
  ];

  // Distinguish whether this run has P3 pacing support:
  // An old log has NO pacing object or keys in any sample.
  const hasPacingSupport = validStatusSamples.some(s => {
    const d = s.status?.data;
    if (!d || typeof d !== 'object') return false;
    if (d.pacing && typeof d.pacing === 'object') return true;
    return d.pacingWaitCount !== undefined || d.postRecordCount !== undefined || d.emptyRetryCount !== undefined;
  });

  if (!hasPacingSupport) {
    result.nativePacing = {
      available: false,
      valid: false,
      reason: 'native_pacing_missing (缺乏原生pacing状态数据)',
    };
  } else if (validStatusSamples.length < 2) {
    result.nativePacing = {
      available: true,
      valid: false,
      reason: 'native_pacing_insufficient_samples (有效原生状态样本不足2个)',
    };
    result.reasons.push('native_pacing_insufficient_samples (有效原生状态样本不足2个)');
  } else {
    // Check every valid status sample for missing or invalid pacing metrics
    let hasInvalidPacingMetric = false;
    for (const s of validStatusSamples) {
      const p = getPacing(s);
      if (!p || typeof p !== 'object') {
        hasInvalidPacingMetric = true;
        break;
      }
      for (const k of pacingRequiredCounterKeys) {
        const v = p[k];
        if (v == null || typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          hasInvalidPacingMetric = true;
          break;
        }
      }
      if (hasInvalidPacingMetric) break;
    }

    // Check rollback across all consecutive valid status samples
    let pacingRollback = false;
    for (let i = 1; i < validStatusSamples.length; i += 1) {
      const prevP = getPacing(validStatusSamples[i - 1]);
      const currP = getPacing(validStatusSamples[i]);
      if (prevP && currP) {
        for (const k of pacingRequiredCounterKeys) {
          if (typeof prevP[k] === 'number' && typeof currP[k] === 'number' && currP[k] < prevP[k]) {
            pacingRollback = true;
            break;
          }
        }
      }
      if (pacingRollback) break;
    }

    if (pacingRollback) {
      result.nativePacing = {
        available: true,
        valid: false,
        reason: 'native_pacing_counter_reset (原生pacing计数在段内发生重置/回退)',
      };
      result.reasons.push('native_pacing_counter_reset (原生pacing计数在段内发生重置/回退)');
    }
    if (hasInvalidPacingMetric) {
      if (!result.nativePacing || result.nativePacing.valid) {
        result.nativePacing = {
          available: true,
          valid: false,
          reason: 'native_pacing_invalid (原生pacing指标缺失、非数字、非有限值或为负数)',
        };
      }
      result.reasons.push('native_pacing_invalid (原生pacing指标缺失、非数字、非有限值或为负数)');
    }

    if (!pacingRollback && !hasInvalidPacingMetric) {
      const pFirst = getPacing(validStatusSamples[0]);
      const pLast = getPacing(validStatusSamples[validStatusSamples.length - 1]);

      const pacingWaitCountDelta = pLast.pacingWaitCount - pFirst.pacingWaitCount;
      const pacingWaitRequestedSumMsDelta = Number((pLast.pacingWaitRequestedSumMs - pFirst.pacingWaitRequestedSumMs).toFixed(3));
      const pacingWaitRequestedMeanMs = pacingWaitCountDelta === 0 ? null : (pacingWaitRequestedSumMsDelta === 0 ? 0 : Number((pacingWaitRequestedSumMsDelta / pacingWaitCountDelta).toFixed(2)));

      const pacingWaitActualSumMsDelta = Number((pLast.pacingWaitActualSumMs - pFirst.pacingWaitActualSumMs).toFixed(3));
      const pacingWaitActualMeanMs = pacingWaitCountDelta === 0 ? null : (pacingWaitActualSumMsDelta === 0 ? 0 : Number((pacingWaitActualSumMsDelta / pacingWaitCountDelta).toFixed(2)));

      const pacingWaitDiscrepancyMeanMs = (pacingWaitActualMeanMs != null && pacingWaitRequestedMeanMs != null)
        ? Number((pacingWaitActualMeanMs - pacingWaitRequestedMeanMs).toFixed(2))
        : null;

      const postRecordCountDelta = pLast.postRecordCount - pFirst.postRecordCount;
      const postRecordSumMsDelta = Number((pLast.postRecordSumMs - pFirst.postRecordSumMs).toFixed(3));
      const postRecordMeanMs = postRecordCountDelta === 0 ? null : (postRecordSumMsDelta === 0 ? 0 : Number((postRecordSumMsDelta / postRecordCountDelta).toFixed(2)));

      const statusPublishCountDelta = pLast.statusPublishCount - pFirst.statusPublishCount;
      const statusPublishSumMsDelta = Number((pLast.statusPublishSumMs - pFirst.statusPublishSumMs).toFixed(3));
      const statusPublishMeanMs = statusPublishCountDelta === 0 ? null : (statusPublishSumMsDelta === 0 ? 0 : Number((statusPublishSumMsDelta / statusPublishCountDelta).toFixed(2)));

      const emptyRetryCountDelta = pLast.emptyRetryCount - pFirst.emptyRetryCount;
      const emptyWaitRequestedSumMsDelta = Number((pLast.emptyWaitRequestedSumMs - pFirst.emptyWaitRequestedSumMs).toFixed(3));
      const emptyWaitActualSumMsDelta = Number((pLast.emptyWaitActualSumMs - pFirst.emptyWaitActualSumMs).toFixed(3));
      const emptyWaitActualMeanMs = emptyRetryCountDelta === 0 ? null : (emptyWaitActualSumMsDelta === 0 ? 0 : Number((emptyWaitActualSumMsDelta / emptyRetryCountDelta).toFixed(2)));

      const cycleIntervalCountDelta = pLast.cycleIntervalCount - pFirst.cycleIntervalCount;
      const cycleIntervalSumMsDelta = Number((pLast.cycleIntervalSumMs - pFirst.cycleIntervalSumMs).toFixed(3));
      const cycleIntervalMeanMs = cycleIntervalCountDelta === 0 ? null : (cycleIntervalSumMsDelta === 0 ? 0 : Number((cycleIntervalSumMsDelta / cycleIntervalCountDelta).toFixed(2)));
      const cycleCadenceFps = (cycleIntervalSumMsDelta > 0 && cycleIntervalCountDelta > 0)
        ? Number((cycleIntervalCountDelta / (cycleIntervalSumMsDelta / 1000)).toFixed(2))
        : null;

      const totalWorkCountDelta = pLast.totalWorkCount - pFirst.totalWorkCount;
      const totalWorkSumMsDelta = Number((pLast.totalWorkSumMs - pFirst.totalWorkSumMs).toFixed(3));
      const totalWorkMeanMs = totalWorkCountDelta === 0 ? null : (totalWorkSumMsDelta === 0 ? 0 : Number((totalWorkSumMsDelta / totalWorkCountDelta).toFixed(2)));

      result.nativePacing = {
        available: true,
        valid: true,
        pacingWait: {
          count: pacingWaitCountDelta,
          requestedSumMs: pacingWaitRequestedSumMsDelta,
          requestedMeanMs: pacingWaitRequestedMeanMs,
          cumulativeRequestedMaxMs: pLast.pacingWaitRequestedMaxMs ?? null,
          actualSumMs: pacingWaitActualSumMsDelta,
          actualMeanMs: pacingWaitActualMeanMs,
          cumulativeActualMaxMs: pLast.pacingWaitActualMaxMs ?? null,
          discrepancyMeanMs: pacingWaitDiscrepancyMeanMs,
        },
        postRecord: {
          count: postRecordCountDelta,
          sumMs: postRecordSumMsDelta,
          meanMs: postRecordMeanMs,
          cumulativeMaxMs: pLast.postRecordMaxMs ?? null,
        },
        statusPublish: {
          count: statusPublishCountDelta,
          sumMs: statusPublishSumMsDelta,
          meanMs: statusPublishMeanMs,
          cumulativeMaxMs: pLast.statusPublishMaxMs ?? null,
        },
        emptyWait: {
          retryCount: emptyRetryCountDelta,
          requestedSumMs: emptyWaitRequestedSumMsDelta,
          actualSumMs: emptyWaitActualSumMsDelta,
          actualMeanMs: emptyWaitActualMeanMs,
          cumulativeActualMaxMs: pLast.emptyWaitActualMaxMs ?? null,
        },
        cycleInterval: {
          count: cycleIntervalCountDelta,
          sumMs: cycleIntervalSumMsDelta,
          meanMs: cycleIntervalMeanMs,
          cadenceFps: cycleCadenceFps,
          cumulativeMaxMs: pLast.cycleIntervalMaxMs ?? null,
        },
        totalWork: {
          count: totalWorkCountDelta,
          sumMs: totalWorkSumMsDelta,
          meanMs: totalWorkMeanMs,
          cumulativeMaxMs: pLast.totalWorkMaxMs ?? null,
        },
        notes: {
          hierarchyNotice: '空帧等待与正常pacing等待已独立统计，未合并；postRecordMs与encodeMs独立，不重复相加；sourceAgeMs未混入循环耗时。',
          cumulativeMaxNotice: 'cumulativeMaxMs 为Native自启动以来的全局累计最大值，非本测量阶段内的实际最大值或P95。',
        },
      };
    }
  }

  // 4. Timing Breakdown (R2 & G2: exclude duplicate samples to avoid artificial inflation, never fallback to duplicates)
  const timingKeys = ['acquireMs', 'readbackMs', 'jpegMs', 'packHashMs', 'pipeMs', 'encodeMs', 'sourceAgeMs', 'cycleIntervalMs', 'prevPacingRequestedMs', 'prevPacingActualMs', 'prevPostRecordMs', 'prevEmptyWaitActualMs'];
  const framesRecords = observation.framesSnapshot?.records || [];

  let matchedFrameRecords = [];
  if (framesRecords.length > 0 && statusWithClock.length >= 2) {
    const minSec = statusWithClock[0].status.data.seconds;
    const maxSec = statusWithClock[statusWithClock.length - 1].status.data.seconds;
    matchedFrameRecords = framesRecords.filter(r => typeof r.seconds === 'number' && Number.isFinite(r.seconds) && r.seconds >= minSec && r.seconds <= maxSec);
  }

  const hasFrameTimings = matchedFrameRecords.length >= 2 && matchedFrameRecords.some(r => typeof r.encodeMs === 'number');

  // If using status samples, exclude duplicates so sample counts aren't falsely inflated (R2 & G2)
  const nonDuplicateStatus = validStatusSamples.filter(s => !s.status.duplicate);
  const timingSource = hasFrameTimings
    ? matchedFrameRecords
    : nonDuplicateStatus.map(s => s.status.data);

  const timingStats = {};
  for (const key of timingKeys) {
    const values = timingSource.map(item => item[key]).filter(v => typeof v === 'number');
    timingStats[key] = computeStats(values);
  }
  timingStats.hierarchyNotice = 'encodeMs 已包含 readbackMs 与 jpegMs，总耗时不可叠加；sourceAgeMs 不可相加。';
  timingStats.source = hasFrameTimings ? 'frame_records' : 'status_samples';
  timingStats.observedSamples = timingSource.length;
  timingStats.duplicateSamplesIgnored = hasFrameTimings ? 0 : (validStatusSamples.length - nonDuplicateStatus.length);
  result.timings = timingStats;

  // 5. Frame Intervals & Coverage (R4)
  result.frameIntervals = computeAdjacentIntervals(matchedFrameRecords.length >= 2 ? matchedFrameRecords : [], result.window.actualDurationMs || 0);

  // Segment validity check
  result.valid = result.reasons.length === 0 &&
                 result.nativeThroughput !== null &&
                 result.nativeThroughput.deliveryRateFps !== null;

  return result;
}

export function compareSegments(segA, segB, observation) {
  const comparison = {
    comparable: false,
    segmentA: segA?.id ?? null,
    segmentB: segB?.id ?? null,
    blockedReasons: [],
    deltas: null,
    frontendStageDeltas: null,
    nativePacingDeltas: null,
    note: '仅反映受控前台条件下的测量差值，不构成唯一瓶颈结论。',
  };

  if (!segA || !segA.valid) {
    comparison.blockedReasons.push(`segment_A_invalid (${segA?.id}): ${segA?.reasons?.join(', ') || 'unknown'}`);
  }
  if (!segB || !segB.valid) {
    comparison.blockedReasons.push(`segment_B_invalid (${segB?.id}): ${segB?.reasons?.join(', ') || 'unknown'}`);
  }
  if (comparison.blockedReasons.length > 0) return comparison;

  // Gate 1: Session & Run Identity Verification (R1 & F2)
  if (!observation.runDir || typeof observation.runDir !== 'string' || !observation.runDir.trim()) {
    comparison.blockedReasons.push('unknown_run_dir (未指定有效的运行目录)');
  }
  if (observation.session && observation.session.stable === false) {
    comparison.blockedReasons.push('session_identity_changed (观察期间进程或窗口标识变化)');
  }

  const observedChildPids = new Set();
  const observedLocations = new Set();
  if (observation.session?.childPid != null) observedChildPids.add(observation.session.childPid);
  if (observation.session?.location != null) observedLocations.add(observation.session.location);

  for (const s of (observation.samples || [])) {
    const pData = s.previewStatus?.data;
    if (pData) {
      if (pData.childPid != null) observedChildPids.add(pData.childPid);
      const loc = pData.window?.location ?? pData.location;
      if (loc != null) observedLocations.add(loc);
    }
  }

  if (observedChildPids.size === 0 || observedLocations.size === 0) {
    comparison.blockedReasons.push('unknown_run_identity (未获取到已知childPid或location，无法验证属于同一运行会话)');
  } else if (observedChildPids.size > 1 || observedLocations.size > 1) {
    comparison.blockedReasons.push('session_identity_changed (观察期间childPid或location发生变化)');
  }

  // Gate 2: Dimension match
  const dimA = `${segA.conditions.observedWidth}x${segA.conditions.observedHeight}`;
  const dimB = `${segB.conditions.observedWidth}x${segB.conditions.observedHeight}`;
  if (dimA !== dimB || segA.conditions.observedWidth === null) {
    comparison.blockedReasons.push(`dimension_mismatch: Segment A (${dimA}) != Segment B (${dimB})`);
  }

  // Gate 3: Fixed conditions match (R1: userManualMouseAction is independent variable, others must match)
  const condA = segA.conditions || {};
  const condB = segB.conditions || {};
  const allKeys = new Set([...Object.keys(condA), ...Object.keys(condB)]);
  for (const key of allKeys) {
    if (key === 'userManualMouseAction' || key === 'observedNativeForeground' || key === 'observedWidth' || key === 'observedHeight') {
      continue; // Independent variable or observed stats
    }
    if (condA[key] !== condB[key]) {
      comparison.blockedReasons.push(`fixed_condition_mismatch: ${key} (${condA[key]} != ${condB[key]})`);
    }
  }

  // Gate 4: DSH foreground confirmation (R1 & F2)
  if (condA.userManualDshForeground === false || condB.userManualDshForeground === false) {
    comparison.blockedReasons.push('user_manual_dsh_foreground_false (声明的DSH前台条件不满足)');
  } else if (condA.userManualDshForeground !== true || condB.userManualDshForeground !== true) {
    comparison.blockedReasons.push('user_manual_dsh_foreground_not_confirmed (未确认人工DSH前台记录，不可声称受控前台对照)');
  }

  // Gate 5: Client throughput readiness for foreground comparison (R1)
  if (!segA.clientThroughput?.valid || !segB.clientThroughput?.valid) {
    comparison.blockedReasons.push('client_throughput_unavailable_for_foreground_comparison (客户端非前台可见或指标不足)');
  }

  if (comparison.blockedReasons.length > 0) return comparison;

  comparison.comparable = true;
  comparison.deltas = {
    nativeDeliveryRateFps: (segB.nativeThroughput?.deliveryRateFps != null && segA.nativeThroughput?.deliveryRateFps != null)
      ? Number((segB.nativeThroughput.deliveryRateFps - segA.nativeThroughput.deliveryRateFps).toFixed(2))
      : null,
    hostReceivedRateFps: (segB.hostThroughput?.receivedRateFps != null && segA.hostThroughput?.receivedRateFps != null)
      ? Number((segB.hostThroughput.receivedRateFps - segA.hostThroughput.receivedRateFps).toFixed(2))
      : null,
    clientRenderRateFps: (segB.clientThroughput?.valid && segA.clientThroughput?.valid &&
                          segB.clientThroughput.renderRateFps != null && segA.clientThroughput.renderRateFps != null)
      ? Number((segB.clientThroughput.renderRateFps - segA.clientThroughput.renderRateFps).toFixed(2))
      : null,
    clientDrawRateFps: (segB.frontendStages?.valid && segA.frontendStages?.valid &&
                        segB.frontendStages.drawRateFps != null && segA.frontendStages.drawRateFps != null)
      ? Number((segB.frontendStages.drawRateFps - segA.frontendStages.drawRateFps).toFixed(2))
      : null,
    readbackMeanMs: (segB.timings?.readbackMs?.mean != null && segA.timings?.readbackMs?.mean != null)
      ? Number((segB.timings.readbackMs.mean - segA.timings.readbackMs.mean).toFixed(2))
      : null,
    jpegMeanMs: (segB.timings?.jpegMs?.mean != null && segA.timings?.jpegMs?.mean != null)
      ? Number((segB.timings.jpegMs.mean - segA.timings.jpegMs.mean).toFixed(2))
      : null,
    encodeMeanMs: (segB.timings?.encodeMs?.mean != null && segA.timings?.encodeMs?.mean != null)
      ? Number((segB.timings.encodeMs.mean - segA.timings.encodeMs.mean).toFixed(2))
      : null,
    frameIntervalP50Ms: (segB.frameIntervals?.coverageAdequate && segA.frameIntervals?.coverageAdequate &&
                         segB.frameIntervals?.intervalsMs?.p50 != null && segA.frameIntervals?.intervalsMs?.p50 != null)
      ? Number((segB.frameIntervals.intervalsMs.p50 - segA.frameIntervals.intervalsMs.p50).toFixed(2))
      : null,
    frameIntervalP95Ms: (segB.frameIntervals?.coverageAdequate && segA.frameIntervals?.coverageAdequate &&
                         segB.frameIntervals?.intervalsMs?.p95 != null && segA.frameIntervals?.intervalsMs?.p95 != null)
      ? Number((segB.frameIntervals.intervalsMs.p95 - segA.frameIntervals.intervalsMs.p95).toFixed(2))
      : null,
  };

  if (segA.frontendStages?.available && segB.frontendStages?.available && segA.frontendStages.valid && segB.frontendStages.valid) {
    comparison.frontendStageDeltas = {
      drawRateFps: (segB.frontendStages.drawRateFps != null && segA.frontendStages.drawRateFps != null)
        ? Number((segB.frontendStages.drawRateFps - segA.frontendStages.drawRateFps).toFixed(2)) : null,
      waitRafMeanMs: (segB.frontendStages.waitRaf?.meanMs != null && segA.frontendStages.waitRaf?.meanMs != null)
        ? Number((segB.frontendStages.waitRaf.meanMs - segA.frontendStages.waitRaf.meanMs).toFixed(2)) : null,
      waitTimeoutMeanMs: (segB.frontendStages.waitTimeout?.meanMs != null && segA.frontendStages.waitTimeout?.meanMs != null)
        ? Number((segB.frontendStages.waitTimeout.meanMs - segA.frontendStages.waitTimeout.meanMs).toFixed(2)) : null,
      decodeSuccessMeanMs: (segB.frontendStages.decodeSuccess?.meanMs != null && segA.frontendStages.decodeSuccess?.meanMs != null)
        ? Number((segB.frontendStages.decodeSuccess.meanMs - segA.frontendStages.decodeSuccess.meanMs).toFixed(2)) : null,
      decodeFailMeanMs: (segB.frontendStages.decodeFail?.meanMs != null && segA.frontendStages.decodeFail?.meanMs != null)
        ? Number((segB.frontendStages.decodeFail.meanMs - segA.frontendStages.decodeFail.meanMs).toFixed(2)) : null,
      syncMeanMs: (segB.frontendStages.sync?.meanMs != null && segA.frontendStages.sync?.meanMs != null)
        ? Number((segB.frontendStages.sync.meanMs - segA.frontendStages.sync.meanMs).toFixed(2)) : null,
      drawMeanMs: (segB.frontendStages.draw?.meanMs != null && segA.frontendStages.draw?.meanMs != null)
        ? Number((segB.frontendStages.draw.meanMs - segA.frontendStages.draw.meanMs).toFixed(2)) : null,
      droppedTotalDeltaDiff: (segB.frontendStages.droppedBreakdown?.totalDroppedDelta != null && segA.frontendStages.droppedBreakdown?.totalDroppedDelta != null)
        ? (segB.frontendStages.droppedBreakdown.totalDroppedDelta - segA.frontendStages.droppedBreakdown.totalDroppedDelta) : null,
      dropDecodingDiff: (segB.frontendStages.droppedBreakdown?.dropDecoding != null && segA.frontendStages.droppedBreakdown?.dropDecoding != null)
        ? (segB.frontendStages.droppedBreakdown.dropDecoding - segA.frontendStages.droppedBreakdown.dropDecoding) : null,
      dropSyncDiff: (segB.frontendStages.droppedBreakdown?.dropSync != null && segA.frontendStages.droppedBreakdown?.dropSync != null)
        ? (segB.frontendStages.droppedBreakdown.dropSync - segA.frontendStages.droppedBreakdown.dropSync) : null,
      dropWaitingCallbackDiff: (segB.frontendStages.droppedBreakdown?.dropWaitingCallback != null && segA.frontendStages.droppedBreakdown?.dropWaitingCallback != null)
        ? (segB.frontendStages.droppedBreakdown.dropWaitingCallback - segA.frontendStages.droppedBreakdown.dropWaitingCallback) : null,
      dropOtherDiff: (segB.frontendStages.droppedBreakdown?.dropOther != null && segA.frontendStages.droppedBreakdown?.dropOther != null)
        ? (segB.frontendStages.droppedBreakdown.dropOther - segA.frontendStages.droppedBreakdown.dropOther) : null,
    };
  } else {
    comparison.frontendStageDeltas = null;
  }

  if (segA.nativePacing?.available && segB.nativePacing?.available && segA.nativePacing.valid && segB.nativePacing.valid) {
    comparison.nativePacingDeltas = {
      pacingWaitRequestedMeanMs: (segB.nativePacing.pacingWait?.requestedMeanMs != null && segA.nativePacing.pacingWait?.requestedMeanMs != null)
        ? Number((segB.nativePacing.pacingWait.requestedMeanMs - segA.nativePacing.pacingWait.requestedMeanMs).toFixed(2)) : null,
      pacingWaitActualMeanMs: (segB.nativePacing.pacingWait?.actualMeanMs != null && segA.nativePacing.pacingWait?.actualMeanMs != null)
        ? Number((segB.nativePacing.pacingWait.actualMeanMs - segA.nativePacing.pacingWait.actualMeanMs).toFixed(2)) : null,
      pacingWaitDiscrepancyMeanMs: (segB.nativePacing.pacingWait?.discrepancyMeanMs != null && segA.nativePacing.pacingWait?.discrepancyMeanMs != null)
        ? Number((segB.nativePacing.pacingWait.discrepancyMeanMs - segA.nativePacing.pacingWait.discrepancyMeanMs).toFixed(2)) : null,
      postRecordMeanMs: (segB.nativePacing.postRecord?.meanMs != null && segA.nativePacing.postRecord?.meanMs != null)
        ? Number((segB.nativePacing.postRecord.meanMs - segA.nativePacing.postRecord.meanMs).toFixed(2)) : null,
      statusPublishMeanMs: (segB.nativePacing.statusPublish?.meanMs != null && segA.nativePacing.statusPublish?.meanMs != null)
        ? Number((segB.nativePacing.statusPublish.meanMs - segA.nativePacing.statusPublish.meanMs).toFixed(2)) : null,
      emptyWaitActualMeanMs: (segB.nativePacing.emptyWait?.actualMeanMs != null && segA.nativePacing.emptyWait?.actualMeanMs != null)
        ? Number((segB.nativePacing.emptyWait.actualMeanMs - segA.nativePacing.emptyWait.actualMeanMs).toFixed(2)) : null,
      cycleIntervalMeanMs: (segB.nativePacing.cycleInterval?.meanMs != null && segA.nativePacing.cycleInterval?.meanMs != null)
        ? Number((segB.nativePacing.cycleInterval.meanMs - segA.nativePacing.cycleInterval.meanMs).toFixed(2)) : null,
      cycleCadenceFps: (segB.nativePacing.cycleInterval?.cadenceFps != null && segA.nativePacing.cycleInterval?.cadenceFps != null)
        ? Number((segB.nativePacing.cycleInterval.cadenceFps - segA.nativePacing.cycleInterval.cadenceFps).toFixed(2)) : null,
      totalWorkMeanMs: (segB.nativePacing.totalWork?.meanMs != null && segA.nativePacing.totalWork?.meanMs != null)
        ? Number((segB.nativePacing.totalWork.meanMs - segA.nativePacing.totalWork.meanMs).toFixed(2)) : null,
    };
  } else {
    comparison.nativePacingDeltas = null;
  }

  return comparison;
}

export function renderMarkdownReport(analysis) {
  const lines = [];
  lines.push('# 复杂壁纸回放性能阶段分析报告');
  lines.push('');
  lines.push(`- **数据来源**: **${analysis.state === 'synthetic' ? 'SYNTHETIC (合成测试数据)' : 'REAL (实测数据)'}**`);
  lines.push(`- **生成时间**: ${analysis.createdAt}`);
  lines.push(`- **场景名称**: ${analysis.metadata.scene || '未命名场景'}`);
  lines.push(`- **运行目录**: \`${analysis.metadata.runDir || 'unknown'}\``);
  lines.push(`- **状态判定**: 报告已生成: **${analysis.status.reportWritten ? '是' : '否'}** | 数据支持对比 (dataReady): **${analysis.status.dataReady ? '是' : '否'}**`);
  if (!analysis.status.dataReady && analysis.status.reasons.length > 0) {
    lines.push(`- **未就绪原因**: ${analysis.status.reasons.join('; ')}`);
  }
  lines.push('');

  lines.push('## 1. 阶段概述');
  lines.push('');
  lines.push('| 阶段 ID | 描述 | 人工动作标注 | 样本数 | 原生送帧速率 (fps) | Host 接收速率 (fps) | 前端解码投递 (fps) | 画布绘制速率 (fps) |');
  lines.push('|---|---|---|---:|---:|---:|---:|---:|');
  for (const seg of analysis.segments) {
    const nativeFps = seg.nativeThroughput?.deliveryRateFps ?? 'N/A';
    const hostFps = seg.hostThroughput?.receivedRateFps ?? 'N/A';
    const clientFps = seg.clientThroughput?.valid ? seg.clientThroughput.renderRateFps : `N/A (${seg.clientThroughput?.reason || 'invalid'})`;
    const drawFps = (seg.frontendStages?.available && seg.frontendStages?.valid && seg.frontendStages.drawRateFps != null)
      ? seg.frontendStages.drawRateFps
      : (seg.frontendStages?.available ? 'N/A' : '-');
    const action = seg.conditions.userManualMouseAction || 'none';
    lines.push(`| ${seg.id} | ${seg.label} | ${action} | ${seg.sampleCount} | ${nativeFps} | ${hostFps} | ${clientFps} | ${drawFps} |`);
  }
  lines.push('');

  lines.push('## 2. 原生各阶段耗时分布 (ms)');
  lines.push('');
  lines.push('> [!IMPORTANT]');
  lines.push('> `encodeMs` 已包含 `readbackMs` 与 `jpegMs` 等步骤，绝不能再次将它们与 `encodeMs` 累加作为总耗时；`sourceAgeMs` 语义不同，不可相加。');
  lines.push('');
  for (const seg of analysis.segments) {
    lines.push(`### 阶段: ${seg.label} (${seg.id})`);
    lines.push(`- 数据源: \`${seg.timings?.source || 'unknown'}\` (有效样本: ${seg.timings?.observedSamples ?? 0}, 忽略重复: ${seg.timings?.duplicateSamplesIgnored ?? 0})`);
    lines.push('');
    lines.push('| 耗时阶段 | 样本数 | 均值 (mean) | 中位数 (P50) | P95 | 最大值 (max) |');
    lines.push('|---|---:|---:|---:|---:|---:|');
    const order = ['acquireMs', 'readbackMs', 'jpegMs', 'packHashMs', 'pipeMs', 'encodeMs', 'sourceAgeMs'];
    for (const key of order) {
      const s = seg.timings?.[key];
      if (s) {
        lines.push(`| ${key} | ${s.count} | ${s.mean} | ${s.p50} | ${s.p95} | ${s.max} |`);
      } else {
        lines.push(`| ${key} | 0 | N/A | N/A | N/A | N/A |`);
      }
    }
    lines.push('');

    if (seg.nativePacing?.available && seg.nativePacing.valid) {
      const np = seg.nativePacing;
      lines.push('#### 原生采集节奏与延迟分解 (P3 Native Pacing)');
      lines.push(`- 循环起点节奏: **${np.cycleInterval?.cadenceFps != null ? `${np.cycleInterval.cadenceFps} fps` : 'N/A'}** (均值: **${np.cycleInterval?.meanMs ?? 'N/A'} ms**)`);
      lines.push(`- Pacing 请求等待均值: **${np.pacingWait?.requestedMeanMs ?? 'N/A'} ms** | 实际等待均值: **${np.pacingWait?.actualMeanMs ?? 'N/A'} ms** | 调度偏差: **${np.pacingWait?.discrepancyMeanMs ?? 'N/A'} ms**`);
      lines.push(`- 记录后工作均值: **${np.postRecord?.meanMs ?? 'N/A'} ms** | 状态发布均值: **${np.statusPublish?.meanMs ?? 'N/A'} ms** (发布次数: ${np.statusPublish?.count ?? 0})`);
      lines.push(`- 空帧重试次数: **${np.emptyWait?.retryCount ?? 0}** | 空帧等待均值: **${np.emptyWait?.actualMeanMs ?? 'N/A'} ms** (请求均值: ${np.emptyWait?.requestedSumMs != null && np.emptyWait?.retryCount > 0 ? (np.emptyWait.requestedSumMs / np.emptyWait.retryCount).toFixed(2) : 'N/A'} ms)`);
      lines.push(`- 整帧活跃工作均值: **${np.totalWork?.meanMs ?? 'N/A'} ms**`);
      lines.push('');
      lines.push('| 原生节奏指标 | 增量次数 | 耗时均值 (mean ms) | 累计最大值 (max ms) | 说明 |');
      lines.push('|---|---:|---:|---:|---|');
      lines.push(`| 循环起点间隔 (cycleInterval) | ${np.cycleInterval?.count ?? 0} | ${np.cycleInterval?.meanMs ?? 'N/A'} | ${np.cycleInterval?.cumulativeMaxMs ?? 'N/A'} | 连续两帧循环起点间隔 |`);
      lines.push(`| Pacing 请求等待 (requested) | ${np.pacingWait?.count ?? 0} | ${np.pacingWait?.requestedMeanMs ?? 'N/A'} | ${np.pacingWait?.cumulativeRequestedMaxMs ?? 'N/A'} | 扣除工作后向系统申请的等待 |`);
      lines.push(`| Pacing 实际等待 (actual) | ${np.pacingWait?.count ?? 0} | ${np.pacingWait?.actualMeanMs ?? 'N/A'} | ${np.pacingWait?.cumulativeActualMaxMs ?? 'N/A'} | 单调时钟测得实际 await 耗时 |`);
      lines.push(`| 调度恢复偏差 (discrepancy) | ${np.pacingWait?.count ?? 0} | ${np.pacingWait?.discrepancyMeanMs ?? 'N/A'} | - | 实际等待减去请求等待的额外调度延迟 |`);
      lines.push(`| 记录后工作 (postRecord) | ${np.postRecord?.count ?? 0} | ${np.postRecord?.meanMs ?? 'N/A'} | ${np.postRecord?.cumulativeMaxMs ?? 'N/A'} | record组装后至发起等待前的主线程耗时 |`);
      lines.push(`| 状态发布耗时 (statusPublish) | ${np.statusPublish?.count ?? 0} | ${np.statusPublish?.meanMs ?? 'N/A'} | ${np.statusPublish?.cumulativeMaxMs ?? 'N/A'} | 仅在状态帧触发的落盘/IPC耗时 |`);
      lines.push(`| 空帧重试等待 (emptyWait) | ${np.emptyWait?.retryCount ?? 0} | ${np.emptyWait?.actualMeanMs ?? 'N/A'} | ${np.emptyWait?.cumulativeActualMaxMs ?? 'N/A'} | WGC取空帧时的延时重试耗时 |`);
      lines.push(`| 整帧活跃工作 (totalWork) | ${np.totalWork?.count ?? 0} | ${np.totalWork?.meanMs ?? 'N/A'} | ${np.totalWork?.cumulativeMaxMs ?? 'N/A'} | encodeMs + postRecordMs 完整耗时 |`);
      lines.push('');
    }
  }

  lines.push('## 3. 严格相邻帧间隔与长间隔');
  lines.push('');
  lines.push('> [!NOTE]');
  lines.push('> 仅基于严格相邻帧序号（N 与 N+1）计算，稀疏日志抽样跳号不计作断帧或长停顿。');
  lines.push('');
  for (const seg of analysis.segments) {
    lines.push(`### 阶段: ${seg.label} (${seg.id})`);
    const fi = seg.frameIntervals;
    if (fi && fi.adjacentPairs > 0 && fi.intervalsMs) {
      lines.push(`- 相邻帧对数: **${fi.adjacentPairs}** 对 (有效覆盖: ${fi.coveredSeconds ?? fi.coverageSpanSeconds}s / 首尾跨度: ${fi.coverageSpanSeconds}s, 覆盖占比: ${(fi.coverageRatio * 100).toFixed(1)}%)`);
      lines.push(`- 节奏速率: **${fi.cadenceFps ?? 'N/A'} fps**`);
      lines.push(`- 间隔均值: **${fi.intervalsMs.mean} ms** | P50: **${fi.intervalsMs.p50} ms** | P95: **${fi.intervalsMs.p95} ms** | 最大: **${fi.intervalsMs.max} ms**`);
      lines.push(`- ≥250ms 长间隔数: **${fi.longGapsOver250ms}**`);
      lines.push(`- 覆盖说明: ${fi.coverageNotice}`);
    } else {
      lines.push(`- ${fi?.coverageNotice || '无有效相邻对'}`);
    }
    lines.push('');
  }

  const hasFrontendStages = analysis.segments.some(seg => seg.frontendStages?.available);
  if (hasFrontendStages) {
    lines.push('## 4. 前端分阶段耗时与丢帧分解');
    lines.push('');
    lines.push('> [!NOTE]');
    lines.push('> - **前端解码投递 (rendered)** 为解码完成准备交由订阅者处理的计数，在进入 `paintWallpaper` 之前统计，不代表 `canvas.drawImage` 完成或物理屏幕呈现。');
    lines.push('> - **画布绘制 (drawImage)** 仅测量 `CanvasRenderingContext2D.drawImage` 同步执行时长，返回不代表物理呈现。');
    lines.push('> - **累计最大值 (Max)** 为客户端自启动以来的全局累计值，非本测量阶段内的实际最大值或 P95；样本数为 0 时均值为 N/A (unknown)。');
    lines.push('> - **待处理旧帧覆盖** 分类反映新帧到达时最新帧所处的生命周期状态，非鼠标交互的因果证明。');
    lines.push('');
    for (const seg of analysis.segments) {
      lines.push(`### 阶段: ${seg.label} (${seg.id})`);
      const fs = seg.frontendStages;
      if (!fs || !fs.available) {
        lines.push(`- 前端分阶段指标: 未包含 (${fs?.reason || 'unavailable'})`);
        lines.push('');
        continue;
      }
      if (!fs.valid) {
        lines.push(`- 前端分阶段指标判定无效: ${fs.reason}`);
      }
      lines.push(`- 画布绘制速率: **${fs.drawRateFps != null ? `${fs.drawRateFps} fps` : 'N/A'}**`);
      lines.push('');
      lines.push('| 执行阶段 | 增量次数 | 耗时均值 (mean ms) | 客户端累计最大 (max ms) | 异常 / 取消数 |');
      lines.push('|---|---:|---:|---:|---:|');
      lines.push(`| RAF 等待 (waitRaf) | ${fs.waitRaf?.count ?? 0} | ${fs.waitRaf?.meanMs ?? 'N/A'} | ${fs.waitRaf?.cumulativeMaxMs ?? 'N/A'} | 取消: ${fs.waitCancelled?.count ?? 0} |`);
      lines.push(`| 定时器等待 (waitTimeout) | ${fs.waitTimeout?.count ?? 0} | ${fs.waitTimeout?.meanMs ?? 'N/A'} | ${fs.waitTimeout?.cumulativeMaxMs ?? 'N/A'} | - |`);
      lines.push(`| 解码成功 (decodeSuccess) | ${fs.decodeSuccess?.count ?? 0} | ${fs.decodeSuccess?.meanMs ?? 'N/A'} | ${fs.decodeSuccess?.cumulativeMaxMs ?? 'N/A'} | 失败: ${fs.decodeFail?.count ?? 0} (均值: ${fs.decodeFail?.meanMs ?? 'N/A'} ms) |`);
      lines.push(`| 同步通知 (sync) | ${fs.sync?.count ?? 0} | ${fs.sync?.meanMs ?? 'N/A'} | ${fs.sync?.cumulativeMaxMs ?? 'N/A'} | 订阅者异常: ${fs.sync?.errorCount ?? 0} |`);
      lines.push(`| 画布绘制 (drawImage) | ${fs.draw?.count ?? 0} | ${fs.draw?.meanMs ?? 'N/A'} | ${fs.draw?.cumulativeMaxMs ?? 'N/A'} | 绘制异常: ${fs.draw?.errorCount ?? 0} |`);
      lines.push('');
      lines.push(`- 解码后废弃: 隐藏时废弃 **${fs.discard?.hiddenCount ?? 0}** 帧 | 过期代际废弃 **${fs.discard?.staleCount ?? 0}** 帧`);
      lines.push('');
      lines.push('#### 待处理旧帧覆盖分解');
      lines.push('');
      lines.push('| 覆盖所处阶段 | 增量次数 | 占比 |');
      lines.push('|---|---:|---:|');
      const dropTotal = fs.droppedBreakdown?.totalDroppedDelta ?? 0;
      const fmtDrop = (cnt) => {
        if (dropTotal > 0 && cnt != null) {
          return `${cnt} | ${((cnt / dropTotal) * 100).toFixed(1)}%`;
        }
        return `${cnt ?? 0} | -`;
      };
      lines.push(`| 等待回调中被覆盖 (dropWaitingCallback) | ${fmtDrop(fs.droppedBreakdown?.dropWaitingCallback)} |`);
      lines.push(`| 解码执行中被覆盖 (dropDecoding) | ${fmtDrop(fs.droppedBreakdown?.dropDecoding)} |`);
      lines.push(`| 同步处理中被覆盖 (dropSync) | ${fmtDrop(fs.droppedBreakdown?.dropSync)} |`);
      lines.push(`| 其它状态被覆盖 (dropOther) | ${fmtDrop(fs.droppedBreakdown?.dropOther)} |`);
      lines.push(`| **合计 / dropped 增量** | **${fs.droppedBreakdown?.calculatedSum ?? 0} / ${dropTotal}** | **核对${fs.droppedBreakdown?.matches ? '一致' : '不一致'}** |`);
      lines.push('');
    }
  }

  const diffSectionNum = hasFrontendStages ? '5' : '4';
  lines.push(`## ${diffSectionNum}. 阶段对比 (Diff)`);
  lines.push('');
  const comp = analysis.comparison;
  if (!comp || !comp.comparable) {
    lines.push(`> [!WARNING]`);
    lines.push(`> 阶段不可比，未生成差值。原因:`);
    for (const r of (comp?.blockedReasons || ['unknown'])) {
      lines.push(`> - ${r}`);
    }
  } else {
    lines.push(`对比基准: \`${comp.segmentA}\` → \`${comp.segmentB}\``);
    lines.push('');
    lines.push('| 指标 | 差值 (Segment B - Segment A) | 单位 | 说明 |');
    lines.push('|---|---:|---|---|');
    const d = comp.deltas;
    lines.push(`| 原生送帧速率 | ${d.nativeDeliveryRateFps ?? 'N/A'} | fps | 正值为B比A高 |`);
    lines.push(`| Host 接收速率 | ${d.hostReceivedRateFps ?? 'N/A'} | fps | 正值为B比A高 |`);
    lines.push(`| 前端解码投递速率 | ${d.clientRenderRateFps ?? 'N/A'} | fps | 前台可见有效对比 |`);
    if (d.clientDrawRateFps !== null && d.clientDrawRateFps !== undefined) {
      lines.push(`| 画布绘制速率 | ${d.clientDrawRateFps ?? 'N/A'} | fps | 前台有效绘制对比 |`);
    }
    lines.push(`| 回读耗时均值 | ${d.readbackMeanMs ?? 'N/A'} | ms | 正值为B更耗时 |`);
    lines.push(`| JPEG 耗时均值 | ${d.jpegMeanMs ?? 'N/A'} | ms | 正值为B更耗时 |`);
    lines.push(`| 整帧编码均值 | ${d.encodeMeanMs ?? 'N/A'} | ms | 正值为B更耗时 |`);
    lines.push(`| 帧间隔 P50 | ${d.frameIntervalP50Ms ?? 'N/A'} | ms | 正值为B间隔更长 |`);
    lines.push(`| 帧间隔 P95 | ${d.frameIntervalP95Ms ?? 'N/A'} | ms | 正值为B离散度更高 |`);
    if (comp.frontendStageDeltas) {
      const fsd = comp.frontendStageDeltas;
      lines.push('');
      lines.push('#### 前端分阶段耗时与丢帧差值 (Segment B - Segment A)');
      lines.push('');
      lines.push('| 前端分阶段指标 | 差值 | 单位 | 说明 |');
      lines.push('|---|---:|---|---|');
      lines.push(`| 画布绘制速率差 | ${fsd.drawRateFps ?? 'N/A'} | fps | 正值为B比A高 |`);
      lines.push(`| RAF 等待耗时均值差 | ${fsd.waitRafMeanMs ?? 'N/A'} | ms | 正值为B更耗时 |`);
      lines.push(`| 定时器等待耗时均值差 | ${fsd.waitTimeoutMeanMs ?? 'N/A'} | ms | 正值为B更耗时 |`);
      lines.push(`| 解码成功耗时均值差 | ${fsd.decodeSuccessMeanMs ?? 'N/A'} | ms | 正值为B更耗时 |`);
      lines.push(`| 同步通知耗时均值差 | ${fsd.syncMeanMs ?? 'N/A'} | ms | 正值为B更耗时 |`);
      lines.push(`| 画布绘制耗时均值差 | ${fsd.drawMeanMs ?? 'N/A'} | ms | 正值为B更耗时 |`);
      lines.push(`| 待处理丢帧增量差 (总计) | ${fsd.droppedTotalDeltaDiff ?? 'N/A'} | 帧 | 正值为B丢帧增量更多 |`);
      lines.push(`| - 解码中覆盖差 | ${fsd.dropDecodingDiff ?? 'N/A'} | 帧 | 正值为B更多 |`);
      lines.push(`| - 同步处理中覆盖差 | ${fsd.dropSyncDiff ?? 'N/A'} | 帧 | 正值为B更多 |`);
      lines.push(`| - 等待回调中覆盖差 | ${fsd.dropWaitingCallbackDiff ?? 'N/A'} | 帧 | 正值为B更多 |`);
      lines.push(`| - 其它状态覆盖差 | ${fsd.dropOtherDiff ?? 'N/A'} | 帧 | 正值为B更多 |`);
    } else if (hasFrontendStages) {
      lines.push('');
      lines.push('#### 前端分阶段耗时与丢帧差值 (Segment B - Segment A)');
      lines.push('');
      lines.push('> [!WARNING]');
      lines.push('> 前端分阶段指标无效或分类不一致，已抑制前端分阶段对比差值。整体 P1 数据对比依然有效（dataReady），但不代表 P2 前端分阶段指标通过核对。');
    }
    if (comp.nativePacingDeltas) {
      const npd = comp.nativePacingDeltas;
      lines.push('');
      lines.push('#### 原生采集节奏与延迟分解差值 (Segment B - Segment A)');
      lines.push('');
      lines.push('| 原生节奏指标 | 差值 | 单位 | 说明 |');
      lines.push('|---|---:|---|---|');
      lines.push(`| 循环起点间隔均值差 | ${npd.cycleIntervalMeanMs ?? 'N/A'} | ms | 正值为B间隔更长 |`);
      lines.push(`| 循环起点节奏速率差 | ${npd.cycleCadenceFps ?? 'N/A'} | fps | 正值为B比A快 |`);
      lines.push(`| Pacing 请求等待均值差 | ${npd.pacingWaitRequestedMeanMs ?? 'N/A'} | ms | 正值为B请求更多等待 |`);
      lines.push(`| Pacing 实际等待均值差 | ${npd.pacingWaitActualMeanMs ?? 'N/A'} | ms | 正值为B实际等待更长 |`);
      lines.push(`| 调度恢复偏差均值差 | ${npd.pacingWaitDiscrepancyMeanMs ?? 'N/A'} | ms | 正值为B调度延迟更大 |`);
      lines.push(`| 记录后工作耗时均值差 | ${npd.postRecordMeanMs ?? 'N/A'} | ms | 正值为B记录后工作更长 |`);
      lines.push(`| 状态发布耗时均值差 | ${npd.statusPublishMeanMs ?? 'N/A'} | ms | 正值为B状态发布耗时更长 |`);
      lines.push(`| 空帧等待耗时均值差 | ${npd.emptyWaitActualMeanMs ?? 'N/A'} | ms | 正值为B空帧等待更长 |`);
      lines.push(`| 整帧活跃工作均值差 | ${npd.totalWorkMeanMs ?? 'N/A'} | ms | 正值为B总处理工作更耗时 |`);
    }
    lines.push('');
    lines.push(`*说明: ${comp.note}*`);
  }
  lines.push('');

  const boundSectionNum = hasFrontendStages ? '6' : '5';
  lines.push(`## ${boundSectionNum}. 口径与边界说明`);
  lines.push('');
  for (const b of analysis.boundaries) {
    lines.push(`- ${b}`);
  }
  lines.push('');

  return lines.join('\n');
}

export async function analyzePlayback(options) {
  const { inputPath, segmentsPath, outputDir } = options;

  if (!inputPath || !segmentsPath || !outputDir) {
    throw new Error('inputPath, segmentsPath, and outputDir are all required');
  }

  const resolvedOut = resolve(outputDir);
  if (await pathExists(resolvedOut)) {
    const err = new Error(`output directory already exists: ${resolvedOut}`);
    err.code = 'EEXIST';
    throw err;
  }

  // Resolve observation.json path
  let obsFile = resolve(inputPath);
  const obsStat = await stat(obsFile).catch(err => {
    throw new BadInput(`cannot access input path ${inputPath}: ${err.message}`);
  });
  if (obsStat.isDirectory()) {
    obsFile = join(obsFile, 'observation.json');
  }

  const { data: obsData } = await readJson(obsFile, 'observation');
  validateObservation(obsData, obsFile);

  const { data: segData } = await readJson(resolve(segmentsPath), 'segments manifest');
  validateSegmentsManifest(segData, segmentsPath);

  const analyzedSegments = segData.segments.map(seg => analyzeSegment(seg, obsData));

  // Compare first two segments if >= 2
  let comparison = null;
  if (analyzedSegments.length >= 2) {
    comparison = compareSegments(analyzedSegments[0], analyzedSegments[1], obsData);
  }

  const inconclusiveReasons = [];
  for (const s of analyzedSegments) {
    if (!s.valid) inconclusiveReasons.push(...s.reasons);
  }
  if (comparison && !comparison.comparable) {
    inconclusiveReasons.push(...comparison.blockedReasons);
  }

  const state = obsData.state || segData.state || 'real';
  const dataReady = analyzedSegments.length >= 2 &&
                    analyzedSegments.every(s => s.valid) &&
                    (comparison ? comparison.comparable : false);

  const analysis = {
    schemaVersion: 1,
    tool: 'analyze-playback',
    state,
    createdAt: new Date().toISOString(),
    status: {
      reportWritten: true,
      dataReady,
      inconclusive: !dataReady,
      reasons: inconclusiveReasons,
    },
    metadata: {
      state,
      input: obsFile,
      segmentsManifest: resolve(segmentsPath),
      scene: segData.userNamedScene || 'unknown',
      runDir: obsData.runDir || 'unknown',
      session: obsData.session || null,
    },
    segments: analyzedSegments,
    comparison,
    boundaries: [
      '1. Native encodeMs 已包含 readbackMs 与 jpegMs 等阶段，各分项不可再次叠加求和。',
      '2. client.hidden=1 时 dropped 包含页面主动后台停绘，不可作为前台呈现速率结论。',
      '3. Native foreground 为壁纸源窗口状态，非 DSH 前台窗口状态。',
      '4. 稀疏帧日志仅在严格相邻序号（N 与 N+1）间计算间隔，不跨步计算虚假长停顿。',
      '5. 客户端累计延迟与各阶段累计最大值仅作为参考基线，不代表本阶段 P95 或端到端鼠标响应时间。',
      '6. rendered 为前端解码准备投递计数，在进入 paintWallpaper 之前统计，不代表画布 drawImage 成功或物理屏幕呈现。',
      '7. drawImage 耗时仅测量 Canvas2D 同步执行时长，返回不代表物理呈现；待处理帧覆盖分类反映新帧到达时 latest 所处的生命周期状态，非鼠标交互的因果证明。',
      '8. 只有在同会话、同分辨率且满足前台与固定条件时才生成对比差值；任一条件不满足时对比阻断。',
    ],
  };

  await mkdir(resolvedOut, { recursive: false });
  const jsonPath = join(resolvedOut, 'analysis.json');
  const mdPath = join(resolvedOut, 'analysis.md');

  await writeFile(jsonPath, `${JSON.stringify(analysis, null, 2)}\n`, { flag: 'wx' });
  await writeFile(mdPath, `${renderMarkdownReport(analysis)}\n`, { flag: 'wx' });

  return { analysis, jsonPath, mdPath, outputDir: resolvedOut };
}

async function main() {
  let args;
  try {
    args = parseArgs({
      options: {
        input: { type: 'string' },
        segments: { type: 'string' },
        output: { type: 'string' },
      },
    });
  } catch (err) {
    console.error(`analyze-playback: argument parsing failed: ${err.message}`);
    process.exit(2);
  }

  const inputPath = args.values.input;
  const segmentsPath = args.values.segments;
  const outputDir = args.values.output;

  if (!inputPath || !segmentsPath || !outputDir) {
    console.error('usage: node analyze-playback.mjs --input <observation.json|dir> --segments <segments.json> --output <new-directory>');
    process.exit(2);
  }

  if (await pathExists(outputDir)) {
    console.error(`analyze-playback: output directory already exists: ${outputDir}. Refusing to overwrite.`);
    process.exit(3);
  }

  let result;
  try {
    result = await analyzePlayback({ inputPath, segmentsPath, outputDir });
  } catch (error) {
    if (error instanceof BadInput) {
      console.error(`analyze-playback: input rejected — ${error.message}`);
      console.error('analyze-playback: no report was written.');
      process.exit(3);
    }
    if (error.code === 'EEXIST') {
      console.error(`analyze-playback: output directory already exists: ${outputDir}. Refusing to overwrite.`);
      process.exit(3);
    }
    console.error(`analyze-playback: unexpected error — ${error.stack || error.message}`);
    process.exit(1);
  }

  console.log(`analyze-playback: wrote ${result.jsonPath}`);
  console.log(`analyze-playback: wrote ${result.mdPath}`);
  console.log(`analyze-playback: report written = yes; data sufficient to compare = ${result.analysis.status.dataReady ? 'yes' : 'no'}`);
  if (!result.analysis.status.dataReady) {
    console.log('analyze-playback: inconclusive reasons:');
    for (const r of result.analysis.status.reasons) {
      console.log(`  - ${r}`);
    }
  }
  process.exit(0);
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main();
}
