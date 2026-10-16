// Read-only playback observation sampler.
//
// Reads status.json, preview-status.json, and frames.jsonl from an explicitly specified
// playback run directory. It does not create, start, or stop playback processes, does not
// query CPU/GPU counters, windows, or processes, and touches nothing outside the paths it was given.
//
// Usage:
//   node qa/perf/watch-playback.mjs --run-dir <run-dir> --output <new-directory> [--seconds 90] [--interval-ms 1000] [--state real|synthetic]
//
// Exit codes:
//   0  observation completed and observation.json was written (even if partial or stopped via sentinel)
//   2  invocation was wrong (missing required arguments, non-existent run-dir, invalid duration)
//   3  output directory already exists or cannot be created (nothing overwritten)

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

async function pathExists(path) {
  try {
    await stat(resolve(path));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/** Parses frames.jsonl safely, skipping header and malformed/incomplete lines. */
export function parseFramesJsonl(content) {
  const lines = typeof content === 'string' ? content.split(/\r?\n/) : [];
  const records = [];
  let header = null;
  let incompleteLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      incompleteLines += 1;
      continue;
    }
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.frames === 'number') {
        records.push(parsed);
      } else if (parsed.log && !header) {
        header = parsed;
      }
    }
  }

  return { header, records, incompleteLines, totalLines: lines.length };
}

/** Extracts key pacing metrics while preserving null/undefined without synthesizing 0. */
export function sanitizePacing(data) {
  if (!data || typeof data !== 'object') return null;
  const p = data.pacing && typeof data.pacing === 'object' ? data.pacing : data;
  if (p.pacingWaitCount === undefined && p.postRecordCount === undefined && p.emptyRetryCount === undefined) {
    return null;
  }
  return {
    pacingWaitCount: typeof p.pacingWaitCount === 'number' ? p.pacingWaitCount : null,
    pacingWaitRequestedSumMs: typeof p.pacingWaitRequestedSumMs === 'number' ? p.pacingWaitRequestedSumMs : null,
    pacingWaitRequestedMaxMs: typeof p.pacingWaitRequestedMaxMs === 'number' ? p.pacingWaitRequestedMaxMs : null,
    pacingWaitActualSumMs: typeof p.pacingWaitActualSumMs === 'number' ? p.pacingWaitActualSumMs : null,
    pacingWaitActualMaxMs: typeof p.pacingWaitActualMaxMs === 'number' ? p.pacingWaitActualMaxMs : null,
    postRecordCount: typeof p.postRecordCount === 'number' ? p.postRecordCount : null,
    postRecordSumMs: typeof p.postRecordSumMs === 'number' ? p.postRecordSumMs : null,
    postRecordMaxMs: typeof p.postRecordMaxMs === 'number' ? p.postRecordMaxMs : null,
    statusPublishCount: typeof p.statusPublishCount === 'number' ? p.statusPublishCount : null,
    statusPublishSumMs: typeof p.statusPublishSumMs === 'number' ? p.statusPublishSumMs : null,
    statusPublishMaxMs: typeof p.statusPublishMaxMs === 'number' ? p.statusPublishMaxMs : null,
    emptyRetryCount: typeof p.emptyRetryCount === 'number' ? p.emptyRetryCount : null,
    emptyWaitRequestedSumMs: typeof p.emptyWaitRequestedSumMs === 'number' ? p.emptyWaitRequestedSumMs : null,
    emptyWaitRequestedMaxMs: typeof p.emptyWaitRequestedMaxMs === 'number' ? p.emptyWaitRequestedMaxMs : null,
    emptyWaitActualSumMs: typeof p.emptyWaitActualSumMs === 'number' ? p.emptyWaitActualSumMs : null,
    emptyWaitActualMaxMs: typeof p.emptyWaitActualMaxMs === 'number' ? p.emptyWaitActualMaxMs : null,
    cycleIntervalCount: typeof p.cycleIntervalCount === 'number' ? p.cycleIntervalCount : null,
    cycleIntervalSumMs: typeof p.cycleIntervalSumMs === 'number' ? p.cycleIntervalSumMs : null,
    cycleIntervalMaxMs: typeof p.cycleIntervalMaxMs === 'number' ? p.cycleIntervalMaxMs : null,
    totalWorkCount: typeof p.totalWorkCount === 'number' ? p.totalWorkCount : null,
    totalWorkSumMs: typeof p.totalWorkSumMs === 'number' ? p.totalWorkSumMs : null,
    totalWorkMaxMs: typeof p.totalWorkMaxMs === 'number' ? p.totalWorkMaxMs : null,
  };
}

/** Extracts key status fields while preserving null/undefined without synthesizing 0. */
export function sanitizeStatus(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    frames: typeof data.frames === 'number' ? data.frames : null,
    changed: typeof data.changed === 'number' ? data.changed : null,
    seconds: typeof data.seconds === 'number' ? data.seconds : null,
    width: typeof data.width === 'number' ? data.width : null,
    height: typeof data.height === 'number' ? data.height : null,
    bytes: typeof data.bytes === 'number' ? data.bytes : null,
    hash: typeof data.hash === 'string' ? data.hash : null,
    mode: typeof data.mode === 'string' ? data.mode : null,
    skippedPublications: typeof data.skippedPublications === 'number' ? data.skippedPublications : null,
    captureSource: typeof data.captureSource === 'string' ? data.captureSource : null,
    sourceTimestampMs: typeof data.sourceTimestampMs === 'number' ? data.sourceTimestampMs : null,
    capturedAt: typeof data.capturedAt === 'number' ? data.capturedAt : null,
    pipeMs: typeof data.pipeMs === 'number' ? data.pipeMs : null,
    sourceAgeMs: typeof data.sourceAgeMs === 'number' ? data.sourceAgeMs : null,
    minimized: typeof data.minimized === 'boolean' ? data.minimized : null,
    foreground: typeof data.foreground === 'boolean' ? data.foreground : null, // NOTE: WE source window state
    visible: typeof data.visible === 'boolean' ? data.visible : null,
    cloaked: typeof data.cloaked === 'boolean' ? data.cloaked : null,
    winLeft: typeof data.winLeft === 'number' ? data.winLeft : null,
    winTop: typeof data.winTop === 'number' ? data.winTop : null,
    acquireMs: typeof data.acquireMs === 'number' ? data.acquireMs : null,
    readbackMs: typeof data.readbackMs === 'number' ? data.readbackMs : null,
    jpegMs: typeof data.jpegMs === 'number' ? data.jpegMs : null,
    packHashMs: typeof data.packHashMs === 'number' ? data.packHashMs : null,
    imageWriteMs: typeof data.imageWriteMs === 'number' ? data.imageWriteMs : null,
    encodeMs: typeof data.encodeMs === 'number' ? data.encodeMs : null,
    cycleIntervalMs: typeof data.cycleIntervalMs === 'number' ? data.cycleIntervalMs : null,
    prevPacingRequestedMs: typeof data.prevPacingRequestedMs === 'number' ? data.prevPacingRequestedMs : null,
    prevPacingActualMs: typeof data.prevPacingActualMs === 'number' ? data.prevPacingActualMs : null,
    prevPostRecordMs: typeof data.prevPostRecordMs === 'number' ? data.prevPostRecordMs : null,
    prevEmptyRetryCount: typeof data.prevEmptyRetryCount === 'number' ? data.prevEmptyRetryCount : null,
    prevEmptyWaitActualMs: typeof data.prevEmptyWaitActualMs === 'number' ? data.prevEmptyWaitActualMs : null,
    isStatusFrame: typeof data.isStatusFrame === 'boolean' ? data.isStatusFrame : null,
    pacing: sanitizePacing(data.pacing || data),
  };
}

/** Extracts key preview-status fields while preserving null/undefined. */
function sanitizePreviewStatus(data) {
  if (!data || typeof data !== 'object') return null;
  const win = data.window && typeof data.window === 'object' ? data.window : {};
  const client = data.client && typeof data.client === 'object' ? data.client : null;

  return {
    transport: typeof data.transport === 'string' ? data.transport : null,
    childPid: typeof data.childPid === 'number' ? data.childPid : null,
    window: {
      location: typeof win.location === 'string' ? win.location : null,
      pid: typeof win.pid === 'number' ? win.pid : null,
      created: typeof win.created === 'boolean' ? win.created : null,
      captureStarted: typeof win.captureStarted === 'boolean' ? win.captureStarted : null,
      cleanup: win.cleanup !== undefined ? win.cleanup : null,
    },
    stopping: typeof data.stopping === 'boolean' ? data.stopping : null,
    failure: data.failure !== undefined ? data.failure : null,
    received: typeof data.received === 'number' ? data.received : null,
    bytes: typeof data.bytes === 'number' ? data.bytes : null,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : null, // Frame arrival at host
    sourceSequence: typeof data.sourceSequence === 'number' ? data.sourceSequence : null,
    running: typeof data.running === 'boolean' ? data.running : null,
    seconds: typeof data.seconds === 'number' ? data.seconds : null,
    client: client ? {
      received: typeof client.received === 'number' ? client.received : null,
      rendered: typeof client.rendered === 'number' ? client.rendered : null,
      dropped: typeof client.dropped === 'number' ? client.dropped : null,
      sourceSequence: typeof client.sourceSequence === 'number' ? client.sourceSequence : null,
      seconds: typeof client.seconds === 'number' ? client.seconds : null,
      meanLatencyMs: typeof client.meanLatencyMs === 'number' ? client.meanLatencyMs : null,
      maxLatencyMs: typeof client.maxLatencyMs === 'number' ? client.maxLatencyMs : null,
      decodeErrors: typeof client.decodeErrors === 'number' ? client.decodeErrors : null,
      hidden: typeof client.hidden === 'number' ? client.hidden : null,
      waitRafCount: typeof client.waitRafCount === 'number' ? client.waitRafCount : null,
      waitRafSumMs: typeof client.waitRafSumMs === 'number' ? client.waitRafSumMs : null,
      waitRafMaxMs: typeof client.waitRafMaxMs === 'number' ? client.waitRafMaxMs : null,
      waitTimeoutCount: typeof client.waitTimeoutCount === 'number' ? client.waitTimeoutCount : null,
      waitTimeoutSumMs: typeof client.waitTimeoutSumMs === 'number' ? client.waitTimeoutSumMs : null,
      waitTimeoutMaxMs: typeof client.waitTimeoutMaxMs === 'number' ? client.waitTimeoutMaxMs : null,
      waitCancelledCount: typeof client.waitCancelledCount === 'number' ? client.waitCancelledCount : null,
      decodeSuccessCount: typeof client.decodeSuccessCount === 'number' ? client.decodeSuccessCount : null,
      decodeSuccessSumMs: typeof client.decodeSuccessSumMs === 'number' ? client.decodeSuccessSumMs : null,
      decodeSuccessMaxMs: typeof client.decodeSuccessMaxMs === 'number' ? client.decodeSuccessMaxMs : null,
      decodeFailCount: typeof client.decodeFailCount === 'number' ? client.decodeFailCount : null,
      decodeFailSumMs: typeof client.decodeFailSumMs === 'number' ? client.decodeFailSumMs : null,
      decodeFailMaxMs: typeof client.decodeFailMaxMs === 'number' ? client.decodeFailMaxMs : null,
      discardHiddenCount: typeof client.discardHiddenCount === 'number' ? client.discardHiddenCount : null,
      discardStaleCount: typeof client.discardStaleCount === 'number' ? client.discardStaleCount : null,
      syncCount: typeof client.syncCount === 'number' ? client.syncCount : null,
      syncSumMs: typeof client.syncSumMs === 'number' ? client.syncSumMs : null,
      syncMaxMs: typeof client.syncMaxMs === 'number' ? client.syncMaxMs : null,
      syncErrorCount: typeof client.syncErrorCount === 'number' ? client.syncErrorCount : null,
      drawCount: typeof client.drawCount === 'number' ? client.drawCount : null,
      drawSumMs: typeof client.drawSumMs === 'number' ? client.drawSumMs : null,
      drawMaxMs: typeof client.drawMaxMs === 'number' ? client.drawMaxMs : null,
      drawErrorCount: typeof client.drawErrorCount === 'number' ? client.drawErrorCount : null,
      dropDecodingCount: typeof client.dropDecodingCount === 'number' ? client.dropDecodingCount : null,
      dropSyncCount: typeof client.dropSyncCount === 'number' ? client.dropSyncCount : null,
      dropWaitingCallbackCount: typeof client.dropWaitingCallbackCount === 'number' ? client.dropWaitingCallbackCount : null,
      dropOtherCount: typeof client.dropOtherCount === 'number' ? client.dropOtherCount : null,
    } : null,
    native: data.native && typeof data.native === 'object' ? sanitizeStatus(data.native) : null,
  };
}

export async function watchPlayback(options) {
  const {
    runDir,
    outputDir,
    seconds = 90,
    intervalMs = 1000,
    state = 'real',
  } = options;

  if (!runDir || !outputDir) {
    throw new Error('Both runDir and outputDir are required');
  }

  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0 || seconds > 120) {
    throw new Error(`watchPlayback: seconds must be a positive number <= 120, got ${seconds}`);
  }
  if (typeof intervalMs !== 'number' || !Number.isFinite(intervalMs) || intervalMs < 10) {
    throw new Error(`watchPlayback: intervalMs must be a number >= 10, got ${intervalMs}`);
  }
  if (state !== 'real' && state !== 'synthetic') {
    throw new Error(`watchPlayback: state must be "real" or "synthetic", got ${state}`);
  }

  const resolvedRun = resolve(runDir);
  const resolvedOut = resolve(outputDir);

  if (!(await pathExists(resolvedRun))) {
    const error = new Error(`run directory does not exist: ${resolvedRun}`);
    error.code = 'ENOENT';
    throw error;
  }

  if (await pathExists(resolvedOut)) {
    const error = new Error(`output directory already exists: ${resolvedOut}`);
    error.code = 'EEXIST';
    throw error;
  }

  await mkdir(resolvedOut, { recursive: false });
  const rawDir = join(resolvedOut, 'raw');
  await mkdir(rawDir, { recursive: false });

  const statusPath = join(resolvedRun, 'status.json');
  const previewPath = join(resolvedRun, 'preview-status.json');
  const framesPath = join(resolvedRun, 'frames.jsonl');
  const stopSentinelPath = join(resolvedOut, 'STOP');

  const MAX_FRAMES_BYTES = 50 * 1024 * 1024; // 50MB bound

  // Initial read of frames.jsonl
  let initialFramesSnapshot = null;
  try {
    const fStat = await stat(framesPath);
    if (fStat.size > MAX_FRAMES_BYTES) {
      initialFramesSnapshot = { recordCount: 0, incompleteLines: 0, error: 'frames.jsonl exceeds 50MB bound', readAt: new Date().toISOString() };
    } else {
      const rawFrames = await readFile(framesPath, 'utf8');
      const parsed = parseFramesJsonl(rawFrames);
      initialFramesSnapshot = {
        recordCount: parsed.records.length,
        incompleteLines: parsed.incompleteLines,
        firstSequence: parsed.records.length > 0 ? parsed.records[0].frames : null,
        lastSequence: parsed.records.length > 0 ? parsed.records[parsed.records.length - 1].frames : null,
        readAt: new Date().toISOString(),
        bytes: Buffer.byteLength(rawFrames),
      };
      await writeFile(join(rawDir, 'frames-initial.jsonl'), rawFrames, { flag: 'wx' });
    }
  } catch (err) {
    initialFramesSnapshot = { recordCount: 0, incompleteLines: 0, firstSequence: null, lastSequence: null, error: err.message, readAt: new Date().toISOString() };
  }

  const samples = [];
  const startPerf = performance.now();
  const startUtc = new Date().toISOString();
  let stopReason = null;
  let interrupted = false;

  const onInterrupt = () => {
    interrupted = true;
    stopReason = 'interrupted';
  };
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onInterrupt);

  let lastStatusRaw = null;
  let lastStatusMtime = null;
  let lastPreviewRaw = null;
  let lastPreviewMtime = null;
  let observedChildPid = null;
  let observedLocation = null;
  let identityStable = true;

  try {
    const maxDurationMs = seconds * 1000;
    let sampleIndex = 0;

    while (!interrupted) {
      const nowPerf = performance.now();
      const elapsedMs = nowPerf - startPerf;

      // Check STOP sentinel
      if (await pathExists(stopSentinelPath)) {
        stopReason = 'sentinel';
        break;
      }

      // Check duration limit
      if (elapsedMs >= maxDurationMs) {
        stopReason = 'completed';
        break;
      }

      const sampleStart = performance.now();
      const utc = new Date().toISOString();

      // Read status.json
      let statusResult = { exists: false, mtime: null, bytes: null, readOk: false, duplicate: false, zeroIncrement: false, data: null };
      try {
        const sStat = await stat(statusPath);
        statusResult.exists = true;
        statusResult.mtime = sStat.mtime.toISOString();
        statusResult.bytes = sStat.size;

        const content = await readFile(statusPath, 'utf8');
        const parsed = JSON.parse(content);
        const sanitized = sanitizeStatus(parsed);
        statusResult.readOk = true;

        if (lastStatusRaw && sanitized) {
          const isSameContent = lastStatusRaw.frames === sanitized.frames && lastStatusRaw.seconds === sanitized.seconds;
          const isSameMtime = lastStatusMtime === statusResult.mtime;
          if (isSameContent && isSameMtime) {
            statusResult.duplicate = true;
          } else if (sanitized.seconds !== null && lastStatusRaw.seconds !== null &&
                     sanitized.seconds > lastStatusRaw.seconds && sanitized.frames === lastStatusRaw.frames) {
            // Seconds advanced with fresh mtime, but frames count did not advance: genuine 0 increment!
            statusResult.zeroIncrement = true;
          }
        }
        statusResult.data = sanitized;
        lastStatusRaw = sanitized;
        lastStatusMtime = statusResult.mtime;
      } catch (err) {
        statusResult.error = err.message;
      }

      // Read preview-status.json
      let previewResult = { exists: false, mtime: null, bytes: null, readOk: false, duplicate: false, data: null };
      try {
        const pStat = await stat(previewPath);
        previewResult.exists = true;
        previewResult.mtime = pStat.mtime.toISOString();
        previewResult.bytes = pStat.size;

        const content = await readFile(previewPath, 'utf8');
        const parsed = JSON.parse(content);
        const sanitized = sanitizePreviewStatus(parsed);
        previewResult.readOk = true;

        if (lastPreviewRaw && sanitized) {
          const isSameCount = lastPreviewRaw.received === sanitized.received && lastPreviewRaw.seconds === sanitized.seconds;
          const isSameMtime = lastPreviewMtime === previewResult.mtime;
          if (isSameCount && isSameMtime) {
            previewResult.duplicate = true;
          }
        }
        previewResult.data = sanitized;

        // Identity tracking
        if (sanitized.childPid !== null) {
          if (observedChildPid === null) observedChildPid = sanitized.childPid;
          else if (observedChildPid !== sanitized.childPid) identityStable = false;
        }
        if (sanitized.window && sanitized.window.location !== null) {
          if (observedLocation === null) observedLocation = sanitized.window.location;
          else if (observedLocation !== sanitized.window.location) identityStable = false;
        }

        lastPreviewRaw = sanitized;
        lastPreviewMtime = previewResult.mtime;
      } catch (err) {
        previewResult.error = err.message;
      }

      const sampleEnd = performance.now();
      const readDurationMs = sampleEnd - sampleStart;

      samples.push({
        sampleIndex,
        elapsedMs: Math.round(elapsedMs * 10) / 10,
        utc,
        readDurationMs: Math.round(readDurationMs * 10) / 10,
        status: statusResult,
        previewStatus: previewResult,
      });

      sampleIndex += 1;

      // Sleep until next interval or remaining duration budget
      const totalElapsedMs = performance.now() - startPerf;
      const remainingMs = maxDurationMs - totalElapsedMs;
      if (remainingMs <= 0) {
        stopReason = 'completed';
        break;
      }

      const loopTime = performance.now() - nowPerf;
      const desiredSleepMs = Math.max(0, intervalMs - loopTime);
      const sleepMs = Math.min(desiredSleepMs, remainingMs);
      if (sleepMs > 0) {
        // Break sleep into smaller chunks to react quickly to interrupt, deadline, or STOP sentinel
        const step = Math.min(sleepMs, 50);
        let waited = 0;
        while (waited < sleepMs && !interrupted) {
          await new Promise(r => setTimeout(r, step));
          waited += step;
          if (await pathExists(stopSentinelPath)) {
            stopReason = 'sentinel';
            break;
          }
          if (performance.now() - startPerf >= maxDurationMs) {
            stopReason = 'completed';
            break;
          }
        }
        if (stopReason === 'sentinel' || stopReason === 'completed') break;
      } else {
        if (performance.now() - startPerf >= maxDurationMs) {
          stopReason = 'completed';
          break;
        }
      }
    }
  } finally {
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onInterrupt);
  }

  if (!stopReason) stopReason = 'completed';

  // Terminal read of frames.jsonl
  let terminalFramesSnapshot = null;
  let parsedFramesRecords = [];
  try {
    const fStat = await stat(framesPath);
    if (fStat.size > MAX_FRAMES_BYTES) {
      terminalFramesSnapshot = { recordCount: 0, incompleteLines: 0, error: 'frames.jsonl exceeds 50MB bound', readAt: new Date().toISOString() };
    } else {
      const rawFrames = await readFile(framesPath, 'utf8');
      const parsed = parseFramesJsonl(rawFrames);
      parsedFramesRecords = parsed.records;
      terminalFramesSnapshot = {
        recordCount: parsed.records.length,
        incompleteLines: parsed.incompleteLines,
        firstSequence: parsed.records.length > 0 ? parsed.records[0].frames : null,
        lastSequence: parsed.records.length > 0 ? parsed.records[parsed.records.length - 1].frames : null,
        readAt: new Date().toISOString(),
        bytes: Buffer.byteLength(rawFrames),
      };
      // Save raw frames snapshot to rawDir
      await writeFile(join(rawDir, 'frames.jsonl'), rawFrames, { flag: 'wx' });
    }
  } catch (err) {
    terminalFramesSnapshot = { recordCount: 0, incompleteLines: 0, error: err.message, readAt: new Date().toISOString() };
  }

  // Save raw final status files if available
  try {
    const sRaw = await readFile(statusPath, 'utf8');
    await writeFile(join(rawDir, 'status.json'), sRaw, { flag: 'wx' });
  } catch { /* ignore if missing */ }

  try {
    const pRaw = await readFile(previewPath, 'utf8');
    await writeFile(join(rawDir, 'preview-status.json'), pRaw, { flag: 'wx' });
  } catch { /* ignore if missing */ }

  const endPerf = performance.now();
  const durationActualMs = Math.round((endPerf - startPerf) * 10) / 10;

  const validStatusCount = samples.filter(s => s.status && s.status.readOk).length;
  const duplicateStatusCount = samples.filter(s => s.status && s.status.duplicate).length;
  const validPreviewCount = samples.filter(s => s.previewStatus && s.previewStatus.readOk).length;
  const duplicatePreviewCount = samples.filter(s => s.previewStatus && s.previewStatus.duplicate).length;

  const observation = {
    schemaVersion: 1,
    tool: 'watch-playback',
    state,
    createdAt: startUtc,
    completedAt: new Date().toISOString(),
    runDir: resolvedRun,
    options: {
      durationSeconds: seconds,
      intervalMs,
    },
    session: {
      childPid: observedChildPid,
      location: observedLocation,
      stable: identityStable,
    },
    summary: {
      totalDurationMs: durationActualMs,
      sampleCount: samples.length,
      validStatusSamples: validStatusCount,
      duplicateStatusSamples: duplicateStatusCount,
      validPreviewSamples: validPreviewCount,
      duplicatePreviewSamples: duplicatePreviewCount,
      identityStable,
      stopReason,
      partial: stopReason !== 'completed',
    },
    framesSnapshot: {
      initial: initialFramesSnapshot,
      terminal: terminalFramesSnapshot,
      records: parsedFramesRecords,
    },
    samples,
    boundary: '只读观察器数据快照。口径备忘：1. Native encodeMs 已包含 readbackMs 与 jpegMs，总耗时不可叠加；2. Native foreground 为壁纸源窗口状态，非 DSH 前台；3. Host updatedAt 为画面到达 Host 时间，非客户端指标上报时间；4. client.hidden=1 时 dropped 包含主动后台停绘，不可视作前台性能问题；5. frames 稀疏日志仅在相邻序号间计算间隔。',
  };

  const observationJsonPath = join(resolvedOut, 'observation.json');
  await writeFile(observationJsonPath, `${JSON.stringify(observation, null, 2)}\n`, { flag: 'wx' });

  return { observation, observationJsonPath, outputDir: resolvedOut };
}

async function main() {
  let args;
  try {
    args = parseArgs({
      options: {
        'run-dir': { type: 'string' },
        output: { type: 'string' },
        seconds: { type: 'string', default: '90' },
        'interval-ms': { type: 'string', default: '1000' },
        state: { type: 'string', default: 'real' },
      },
    });
  } catch (err) {
    console.error(`watch-playback: argument parsing failed: ${err.message}`);
    process.exit(2);
  }

  const runDir = args.values['run-dir'];
  const outputDir = args.values.output;
  const seconds = Number(args.values.seconds);
  const intervalMs = Number(args.values['interval-ms']);
  const state = args.values.state;

  if (!runDir || !outputDir) {
    console.error('usage: node watch-playback.mjs --run-dir <run-dir> --output <new-directory> [--seconds 90] [--interval-ms 1000] [--state real|synthetic]');
    process.exit(2);
  }

  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 120) {
    console.error(`watch-playback: --seconds must be a positive number <= 120, got ${args.values.seconds}`);
    process.exit(2);
  }

  if (!Number.isFinite(intervalMs) || intervalMs < 10) {
    console.error(`watch-playback: --interval-ms must be a number >= 10, got ${args.values['interval-ms']}`);
    process.exit(2);
  }

  if (state !== 'real' && state !== 'synthetic') {
    console.error(`watch-playback: --state must be "real" or "synthetic", got ${state}`);
    process.exit(2);
  }

  try {
    const result = await watchPlayback({ runDir, outputDir, seconds, intervalMs, state });
    console.log(`watch-playback: wrote ${result.observationJsonPath}`);
    console.log(`watch-playback: samples collected = ${result.observation.summary.sampleCount}, reason = ${result.observation.summary.stopReason}`);
    process.exit(0);
  } catch (error) {
    if (error.code === 'EEXIST') {
      console.error(`watch-playback: output directory already exists: ${outputDir}. Refusing to overwrite.`);
      process.exit(3);
    }
    if (error.code === 'ENOENT') {
      console.error(`watch-playback: path not found: ${error.message}`);
      process.exit(2);
    }
    console.error(`watch-playback: unexpected error — ${error.stack || error.message}`);
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main();
}
