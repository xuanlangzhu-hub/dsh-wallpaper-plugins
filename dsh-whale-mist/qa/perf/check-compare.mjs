// Synthetic checks for the offline phase comparison.
//
// Every case builds its own inputs under `.tmp/perf/compare-check-<unique>/`, runs the comparison with
// the in-process API, and asserts on concrete numbers and status flags. No shell, no live process, no
// counter query: a case either asserts something specific or it fails.
//
// Run: node qa/perf/check-compare.mjs
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { comparePhases } from './compare-phases.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const runRoot = resolve(repoRoot, '.tmp', 'perf', `compare-check-${stamp}-${process.pid}`);
await mkdir(runRoot, { recursive: true });

const results = [];
const check = async (label, fn) => {
  try { await fn(); results.push({ label, ok: true }); console.log(`PASS ${label}`); }
  catch (error) { results.push({ label, ok: false, error: error.message }); console.log(`FAIL ${label} :: ${error.message}`); }
};

// ---------------------------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------------------------

const ISO = seconds => new Date(Date.UTC(2026, 9, 9, 10, 0, 0) + seconds * 1000).toISOString();
/** The condition set a comparable case must carry: every field evidenced and matching fixedConditions. */
const SAME_CONDITIONS = Object.freeze({
  powerState: 'ac', weGlobalSettingsEvidence: 'manual: unchanged', dshViewport: { width: 1600, height: 900 },
  dpi: 100, foregroundEvidence: 'manual: dsh foreground', desktopPlaybackEvidence: 'manual: playing',
  projectSha256: 'a'.repeat(64), wallpaperPropertiesSha256: 'b'.repeat(64),
});
const sameConditions = () => structuredClone(SAME_CONDITIONS);
const LUID_A = 'luid_0x00000000_0x00019a40';
const LUID_B = 'luid_0x00000000_0x00019ed4';

/**
 * Builds a sampler report shaped like the real one: raw samples carry the values, and the summary
 * carries what the comparison must not simply copy.
 */
function buildReport({
  phaseId, logicalProcessors = 32, targets, samples, topologyKnown = true, topologySegments = null,
  identityStable = true, adapterLuidSet = LUID_A,
}) {
  return {
    phase: phaseId,
    label: `${phaseId} synthetic`,
    machine: { logicalProcessors, physicalCores: 28, sockets: 1, cpuPercentBasis: 'synthetic' },
    targets: targets.map(target => ({
      pid: target.pid, name: target.name, startTime: target.startTime, path: target.path ?? null,
      cpuReadable: target.cpuReadable !== false, note: target.note ?? null,
    })),
    secondsRequested: 45,
    intervalMs: 1000,
    rediscoverEvery: 12,
    discovery: { matchedExactPaths: [], foreignInstancesDropped: [], note: 'synthetic' },
    samples,
    adapterTopology: {
      changed: false,
      segments: topologySegments || [{ adapterLuidSet, topologyKnown, samples: samples.length, startAt: samples[0]?.readStartedAt ?? null, perPid: [] }],
      coverage: 'synthetic',
    },
    summary: {
      identityStable,
      samplesTotal: samples.length,
      samplesWithAllTargetsReadable: samples.length,
      idleRatherThanFailedSamples: 0,
      measuredSomething: true,
      identityChanges: [],
      unknownTopologySamples: topologyKnown ? 0 : samples.length,
      segments: [],
      caveat: 'synthetic',
    },
    counterErrors: [],
    notes: ['synthetic fixture'],
  };
}

/** One sample: per-PID CPU and memory, plus optional engine and GPU memory entries. */
function buildSample({
  index, processes, engines = [], vram = [], adapters = [{ instance: `${LUID_A}_phys_0`, luid: LUID_A, dedicatedUsageBytes: 0 }],
  luidSet = LUID_A,
}) {
  return {
    readStartedAt: ISO(index),
    cpuReadAt: ISO(index),
    gpuReadAt: ISO(index),
    gpuReadFinishedAt: ISO(index),
    availability: {
      processesWithReadableCpu: processes.filter(p => p.cpuSeconds !== null).length,
      processesWithReadableEngine: engines.length > 0 ? 1 : 0,
      processesWithReadableMemory: vram.length > 0 ? 1 : 0,
      counterReadOk: true, adapterReadOk: true,
      everyTargetReadable: processes.every(p => p.cpuSeconds !== null),
    },
    activity: { processesWithCpuAboveZero: 0, processesWithEngineAboveThreshold: 0, processesWithMemoryAboveZero: 0 },
    idleRatherThanFailed: false,
    measuredSomething: true,
    processes,
    processGpu: engines.length ? [{ pid: engines[0].pid, engines: engines.map(e => ({
      engineType: e.engineType, luid: e.luid,
      maxUtilizationPercent: e.max, values: [e.max], instanceNames: e.instanceNames || [`pid_${e.pid}_${e.luid}_phys_0_eng_0_engtype_${e.engineType}`],
    })) }] : [],
    processVram: vram.length ? [{ pid: vram[0].pid, adapters: vram.map(v => ({
      pid: v.pid, luid: v.luid, readAt: ISO(index),
      dedicatedBytes: v.dedicated ?? null, sharedBytes: v.shared ?? null,
      nonLocalBytes: v.nonLocal ?? null, totalCommittedBytes: v.totalCommitted ?? null,
    })) }] : [],
    gpuReadings: [],
    gpuIdentityVerifiedPids: processes.map(p => p.pid),
    adapters,
    adapterLuidSet: luidSet,
    rejectedReadings: [],
    invalidReadingCount: 0,
  };
}

/** A process row inside a sample. */
function processRow({ pid, cpuSeconds = null, cpuSecondsDelta = null, wallClockSecondsDelta = null, cpuPercent = null,
  workingSetBytes = null, privateBytes = null, identityChanged = false, alive = true, name = 'proc' }) {
  return {
    pid, name, alive, identityChanged, cpuSeconds,
    cpuSecondsDelta, wallClockSecondsDelta, cpuPercentOfLogicalCapacity: cpuPercent,
    workingSetBytes, privateBytes, threads: 10, handles: 100, note: identityChanged ? 'identity changed' : null,
  };
}

/** Writes one case's manifest and reports, returning the paths. */
async function writeCase(name, { state = 'synthetic', phases, fixedConditions = null, minimumCoverage = null, mutateManifest = null }) {
  const dir = join(runRoot, name);
  await mkdir(dir, { recursive: true });
  for (const phase of phases) {
    await mkdir(join(dir, phase.id), { recursive: true });
    await writeFile(join(dir, phase.id, 'sample.json'), JSON.stringify(phase.report, null, 1));
  }
  const manifest = {
    schemaVersion: 1,
    state,
    runId: `${name}`,
    candidateVersion: '0.6.0-rc.23',
    fixedConditions: fixedConditions || {
      sceneId: 'lucy', projectSha256: 'a'.repeat(64), wallpaperPropertiesSha256: 'b'.repeat(64),
      sourceRenderFps: null, captureFpsCap: 30, requestedWindowSize: { width: 1280, height: 720 },
      powerState: 'ac', weGlobalSettingsEvidence: 'manual: unchanged', dshViewport: { width: 1600, height: 900 },
      dpi: 100, foregroundEvidence: 'manual: dsh foreground', desktopPlaybackEvidence: 'manual: playing',
    },
    minimumCoverage: minimumCoverage || { cpuIntervals: 5, cpuValidSeconds: 30, metricObservations: 5 },
    phases: phases.map(phase => ({
      id: phase.id, state: 'measured', samplerReport: `${phase.id}/sample.json`,
      measurement: { startedAt: ISO(phase.start ?? 0), endedAt: ISO(phase.end ?? 60) },
      conditions: phase.conditions === undefined ? {
        powerState: 'ac', weGlobalSettingsEvidence: 'manual: unchanged', dshViewport: { width: 1600, height: 900 },
        dpi: 100, foregroundEvidence: 'manual: dsh foreground', desktopPlaybackEvidence: 'manual: playing',
        projectSha256: 'a'.repeat(64), wallpaperPropertiesSha256: 'b'.repeat(64),
      } : phase.conditions,
      processes: phase.processes,
      unresolvedRoles: phase.unresolvedRoles || [],
      sourceWindow: phase.sourceWindow === undefined ? null : phase.sourceWindow,
      captureMode: phase.captureMode ?? null,
      captureFrameSize: phase.captureFrameSize ?? null,
      motion: phase.motion ?? null,
      evidence: phase.evidence || ['manual: synthetic case'],
    })),
  };
  if (mutateManifest) mutateManifest(manifest, dir);
  const manifestPath = join(dir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
  return { dir, manifestPath };
}

/** Runs the comparison and returns the parsed report plus the raw output directory. */
async function runCase(name, options) {
  const { manifestPath, dir } = await writeCase(name, options);
  const outputDir = join(dir, 'out');
  const result = await comparePhases({ manifestPath, outputDir });
  await mkdir(outputDir);
  await writeFile(join(outputDir, 'comparison.json'), JSON.stringify(result, null, 1));
  await writeFile(join(outputDir, 'comparison.md'), '# synthetic\n');
  return { result, outputDir, manifestPath, dir };
}

const pidOf = (result, phaseId, pid) => result.phases.find(p => p.id === phaseId).processes.find(p => p.pid === pid);
const pairOf = (result, pair) => result.comparisons.find(c => c.pair === pair);

// A long CPU series: irregular intervals so a weighted result differs from a plain mean.
function longCpuSeries({ pid, deltas, walls, workingSet = 100 * 1024 * 1024, engineFactory = null, vramFactory = null, name = 'we' }) {
  const samples = [];
  let cursor = 0;
  for (let index = 0; index < deltas.length; index += 1) {
    const entry = processRow({
      pid, name,
      cpuSeconds: 100 + deltas.slice(0, index + 1).reduce((sum, value) => sum + value, 0),
      cpuSecondsDelta: deltas[index], wallClockSecondsDelta: walls[index],
      cpuPercent: 100 * deltas[index] / (walls[index] * 32),
      workingSetBytes: workingSet, privateBytes: workingSet * 2,
    });
    samples.push(buildSample({
      index: cursor, processes: [entry],
      engines: engineFactory ? engineFactory(index).map(spec => ({ pid, ...spec })) : [],
      vram: vramFactory ? vramFactory(index).map(spec => ({ pid, ...spec })) : [],
    }));
    cursor += walls[index];
  }
  return samples;
}

// ---------------------------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------------------------

const WE = { pid: 12312, startTime: '2026-10-09T09:00:00.000Z', path: 'C:/WallpaperEngine/wallpaper64.exe', name: 'wallpaper64' };
const DSH = { pid: 46592, startTime: '2026-10-09T09:05:00.000Z', path: 'C:/dsh/dsh.exe', name: 'dsh' };
const CAP = { pid: 17744, startTime: '2026-10-09T09:10:00.000Z', path: 'C:/plugin/WallpaperProbe.exe', name: 'WallpaperProbe' };

const manifestProcess = (target, roles, evidence = 'manual: synthetic identity') => ({
  pid: target.pid, startTime: target.startTime, path: target.path, roles, evidence,
});

// 1. Uneven CPU intervals must be weighted, not averaged.
await check('CPU uses a weighted recomputation over uneven intervals', async () => {
  const deltas = [0.6, 0.1, 0.9, 0.2, 0.05, 0.7];
  const walls = [10, 1, 20, 2, 1, 6];
  const { result } = await runCase('cpu-weighted', {
    phases: [{
      id: 'A0', start: 0, end: 1000,
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])],
      report: buildReport({
        phaseId: 'A0', targets: [WE, DSH],
        samples: longCpuSeries({ pid: WE.pid, deltas, walls }).map(sample => {
          sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 50, cpuSecondsDelta: 0.01, wallClockSecondsDelta: 10, cpuPercent: 0.01 / 320, workingSetBytes: 1024, privateBytes: 2048, name: 'dsh' }));
          return sample;
        }),
      }),
    }, ...['B', 'C', 'D', 'A1'].map(id => ({
      id, start: 0, end: 1000,
      captureFrameSize: id === 'C' || id === 'D' ? { width: 1302, height: 776 } : null,
      sourceWindow: id === 'C' || id === 'D' ? { location: id + '-w', hwnd: 1, renderPid: WE.pid, inspectSize: { width: 1280, height: 720 } } : null, conditions: sameConditions(),
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])],
      report: buildReport({
        phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])],
        samples: longCpuSeries({ pid: WE.pid, deltas, walls }).map(sample => {
          sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 50, cpuSecondsDelta: 0.01, wallClockSecondsDelta: 10, cpuPercent: 0.01 / 320, workingSetBytes: 1024, privateBytes: 2048, name: 'dsh' }));
          if (id === 'C' || id === 'D') sample.processes.push(processRow({ pid: CAP.pid, cpuSeconds: 20, cpuSecondsDelta: 0.02, wallClockSecondsDelta: 10, cpuPercent: 0.02 / 320, workingSetBytes: 2048, privateBytes: 4096, name: 'WallpaperProbe' }));
          return sample;
        }),
      }),
    }))],
  });
  const we = pidOf(result, 'A0', WE.pid);
  const deltaTotal = deltas.reduce((sum, value) => sum + value, 0);
  const wallTotal = walls.reduce((sum, value) => sum + value, 0);
  const expected = 100 * deltaTotal / (wallTotal * 32);
  assert.equal(we.cpu.intervals, deltas.length, `expected ${deltas.length} intervals, got ${we.cpu.intervals}`);
  assert.ok(Math.abs(we.cpu.percentOfLogicalCapacity - expected) < 1e-6, `weighted ${we.cpu.percentOfLogicalCapacity} != ${expected}`);
  const naiveMean = mean(we.cpu.percentObservationMean);
  assert.ok(Math.abs(naiveMean - we.cpu.percentOfLogicalCapacity) > 1e-9, 'the plain mean of per-sample percents must differ from the weighted value');
  assert.equal(we.cpu.validSeconds, wallTotal, `valid seconds ${we.cpu.validSeconds} != ${wallTotal}`);
  assert.ok(result.status.reasons.length === 0, `unexpected inconclusive reasons: ${result.status.reasons.join('; ')}`);
});

function mean(value) { return value; }

// 2. Idle zero is a valid observation; all-null is missing, not zero.
await check('valid idle zero differs from an all-null CPU series', async () => {
  const idleSamples = longCpuSeries({ pid: WE.pid, deltas: [0, 0, 0, 0, 0, 0], walls: [10, 10, 10, 10, 10, 10] });
  const nullSamples = idleSamples.map((sample, index) => {
    const clone = structuredClone(sample);
    clone.processes[0].cpuSeconds = null;
    clone.processes[0].cpuSecondsDelta = null;
    clone.processes[0].wallClockSecondsDelta = null;
    clone.processes[0].cpuPercentOfLogicalCapacity = null;
    clone.processes[0].workingSetBytes = null;
    clone.readStartedAt = ISO(index * 10);
    return clone;
  });
  const { result } = await runCase('idle-vs-null', {
    phases: [{
      id: 'A0', start: 0, end: 1000,
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])],
      report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples: idleSamples.map(sample => {
        sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 1, cpuSecondsDelta: 0.001, wallClockSecondsDelta: 10, cpuPercent: 0.001 / 320, workingSetBytes: 100, privateBytes: 200, name: 'dsh' }));
        return sample;
      }) }),
    }, {
      id: 'B', start: 0, end: 1000,
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])],
      report: buildReport({ phaseId: 'B', targets: [WE, DSH], samples: nullSamples.map(sample => {
        sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 1, cpuSecondsDelta: 0.001, wallClockSecondsDelta: 10, cpuPercent: 0.001 / 320, workingSetBytes: 100, privateBytes: 200, name: 'dsh' }));
        return sample;
      }) }),
    }, ...['C', 'D', 'A1'].map(id => ({
      id, start: 0, end: 1000, conditions: sameConditions(),
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])],
      report: buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples: idleSamples.map(sample => {
        sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 1, cpuSecondsDelta: 0.001, wallClockSecondsDelta: 10, cpuPercent: 0.001 / 320, workingSetBytes: 100, privateBytes: 200, name: 'dsh' }));
        if (id === 'C' || id === 'D') sample.processes.push(processRow({ pid: CAP.pid, cpuSeconds: 1, cpuSecondsDelta: 0.002, wallClockSecondsDelta: 10, cpuPercent: 0.002 / 320, workingSetBytes: 100, privateBytes: 200, name: 'WallpaperProbe' }));
        return sample;
      }) }),
    }))],
  });
  const idle = pidOf(result, 'A0', WE.pid);
  const missing = pidOf(result, 'B', WE.pid);
  assert.equal(idle.cpu.intervals, 6, 'a zero delta is a valid interval');
  assert.equal(idle.cpu.percentOfLogicalCapacity, 0, 'idle must read as a real 0');
  assert.equal(missing.cpu.intervals, 0, 'a null series has no valid intervals');
  assert.equal(missing.cpu.percentOfLogicalCapacity, null, 'a null series must stay null, not become 0');
  assert.equal(missing.workingSetBytes.observations, 0);
  assert.equal(missing.workingSetBytes.mean, null);
});

// 3. Insufficient coverage still produces a report, and says so.
await check('insufficient coverage yields a report with dataReady=false', async () => {
  const short = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5], walls: [1, 1] });
  const full = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  const phases = [{ id: 'A0', start: 0, end: 1000, samples: full }, { id: 'B', start: 0, end: 1000, samples: short },
    { id: 'C', start: 0, end: 1000, samples: full, capture: true }, { id: 'D', start: 0, end: 1000, samples: full, capture: true },
    { id: 'A1', start: 0, end: 1000, samples: full }];
  const { result } = await runCase('coverage-short', {
    phases: phases.map(phase => ({
      id: phase.id, start: phase.start, end: phase.end,
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(phase.capture ? [manifestProcess(CAP, ['capture'])] : [])],
      report: buildReport({
        phaseId: phase.id,
        targets: [WE, DSH, ...(phase.capture ? [CAP] : [])],
        samples: phase.samples.map(sample => {
          sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 9, cpuSecondsDelta: 0.01, wallClockSecondsDelta: 10, cpuPercent: 0.01 / 320, workingSetBytes: 4096, privateBytes: 8192, name: 'dsh' }));
          if (phase.capture) sample.processes.push(processRow({ pid: CAP.pid, cpuSeconds: 9, cpuSecondsDelta: 0.02, wallClockSecondsDelta: 10, cpuPercent: 0.02 / 320, workingSetBytes: 8192, privateBytes: 16384, name: 'WallpaperProbe' }));
          return sample;
        }),
      }),
    })),
  });
  assert.equal(result.status.reportWritten, true);
  assert.equal(result.status.dataReady, false, 'a phase below the minimum must not be called ready');
  assert.ok(result.status.reasons.some(reason => reason.startsWith(`B: pid ${WE.pid}`) && reason.includes('CPU coverage')), `expected a per-PID coverage reason for B, got ${JSON.stringify(result.status.reasons)}`);
  // The DSH process in B is also short, and its reason must name its own PID rather than a phase total.
  assert.ok(result.status.reasons.some(reason => reason.startsWith(`B: pid ${DSH.pid}`) && reason.includes('CPU coverage')), 'each sparse PID gets its own reason');
  const b = pidOf(result, 'B', WE.pid);
  assert.equal(b.cpu.intervals, 2, 'the readable values are still reported');
  const pair = pairOf(result, 'A0->B');
  assert.equal(pair.findings.find(f => f.pid === WE.pid).cpu.delta, null, 'no difference may be computed without coverage');
});

// 4. One PID carrying two roles is one process row.
await check('a PID with two roles appears once', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  const { result } = await runCase('two-roles', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess(WE, ['we', 'we-source']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples }) },
      ...['B', 'C', 'D', 'A1'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples }) }))],
  });
  const a0 = result.phases.find(p => p.id === 'A0');
  const weRows = a0.processes.filter(process => process.pid === WE.pid);
  assert.equal(weRows.length, 1, `expected one row for pid ${WE.pid}, got ${weRows.length}`);
  assert.deepEqual(weRows[0].roles, ['we', 'we-source']);
});

// 5. A PID that merely shares a prefix must not be picked up.
await check('pid 420 is not counted for pid 42', async () => {
  const samples = longCpuSeries({ pid: 42, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  for (const sample of samples) {
    sample.processes.push(processRow({ pid: 420, cpuSeconds: 99, cpuSecondsDelta: 5, wallClockSecondsDelta: 10, cpuPercent: 5 / 320, workingSetBytes: 1 << 30, privateBytes: 1 << 30, name: 'impostor' }));
  }
  const impostor = { pid: 420, startTime: '2026-10-09T09:00:00.000Z', path: null, name: 'impostor' };
  const { result } = await runCase('pid-prefix', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess({ pid: 42, startTime: WE.startTime, path: null }, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [{ ...WE, pid: 42 }, DSH, { ...impostor, startTime: WE.startTime }], samples }) },
      ...['B', 'C', 'D', 'A1'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess({ pid: 42, startTime: WE.startTime, path: null }, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [{ ...WE, pid: 42 }, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples }) }))],
  });
  const a0 = result.phases.find(p => p.id === 'A0');
  assert.equal(a0.processes.some(process => process.pid === 420), false, 'the unlisted pid 420 must not appear');
  assert.ok(a0.warnings.some(warning => String(warning.note).includes('420')), 'the extra report PID should be reported as a warning');
  void impostor;
});

// 6. A target whose start time differs is not compared.
await check('a changed start time makes the phase inconclusive and blocks the difference', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  const restarted = { ...WE, startTime: '2026-10-09T09:30:00.000Z' };
  const { result } = await runCase('identity-change', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples }) },
      { id: 'B', start: 0, end: 1000, processes: [manifestProcess(restarted, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'B', targets: [{ ...restarted, startTime: '2026-10-09T09:45:00.000Z' }, DSH], samples }) },
      ...['C', 'D', 'A1'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples }) }))],
  });
  const b = result.phases.find(p => p.id === 'B');
  assert.equal(b.identity.conclusive, false, 'a start-time change must make the phase inconclusive');
  assert.ok(b.requiredRolesUnresolved.includes('we'), 'the unresolved role must be recorded');
  const pair = pairOf(result, 'A0->B');
  // The target whose identity did not match never enters either comparable set, so it cannot be
  // differenced; the process that did match on both sides is the one that appears.
  assert.equal(pair.findings.some(finding => finding.pid === WE.pid), false, 'the mismatched identity must not be differenced');
  assert.equal(pair.sharedPids.includes(WE.pid), false, 'the mismatched identity must not be treated as shared');
  assert.equal(result.status.dataReady, false, 'the comparison is inconclusive overall');
});

// 7. A missing required role is inconclusive, not silently comparable.
await check('a missing required role produces unresolvedRoles', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  const { result } = await runCase('missing-role', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples }) },
      ...['B', 'C', 'D', 'A1'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples }) }))],
  });
  for (const phase of ['B', 'C', 'D', 'A1']) {
    const entry = result.phases.find(p => p.id === phase);
    assert.ok(entry.requiredRolesUnresolved.includes('we'), `${phase} should report we as unresolved`);
    assert.equal(entry.conclusions.cpuComparable, false, `${phase} must not be CPU comparable`);
  }
  assert.ok(result.status.reasons.some(reason => reason.includes('required role(s) unresolved')), 'the reason must appear in the status');
});

// 8. GPU memory: one metric missing, two LUIDs kept apart, engine mean differs from phase max.
await check('GPU memory keeps LUIDs and metrics apart, and a missing metric stays null', async () => {
  const engines = index => [{ engineType: '3d', luid: LUID_A, max: index < 3 ? 10 : 40 }];
  const vram = (index) => [
    { luid: LUID_A, dedicated: 100 * 1024 * 1024, shared: 200 * 1024 * 1024, totalCommitted: 300 * 1024 * 1024 },
    { luid: LUID_B, dedicated: null, shared: 50 * 1024 * 1024, totalCommitted: 50 * 1024 * 1024 },
  ];
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10], engineFactory: engines, vramFactory: vram });
  const { result } = await runCase('gpu-memory', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples, adapterLuidSet: `${LUID_A}|${LUID_B}` }) },
      ...['B', 'C', 'D', 'A1'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples, adapterLuidSet: `${LUID_A}|${LUID_B}` }) }))],
  });
  const we = pidOf(result, 'A0', WE.pid);
  assert.equal(we.gpuMemoryByAdapter.length, 2, 'the two LUIDs must be separate rows');
  const a = we.gpuMemoryByAdapter.find(row => row.luid === LUID_A);
  const b = we.gpuMemoryByAdapter.find(row => row.luid === LUID_B);
  assert.equal(a.metrics.dedicatedBytes.meanBytes, 100 * 1024 * 1024);
  assert.equal(b.metrics.dedicatedBytes.meanBytes, null, 'a missing metric must stay null');
  assert.equal(b.metrics.dedicatedBytes.observations, 0);
  assert.equal(b.metrics.sharedBytes.meanBytes, 50 * 1024 * 1024, 'the other metric on the same LUID is still reported');
  const engine = we.gpuEngines[0];
  assert.equal(engine.observations, 6);
  assert.equal(engine.maxPercent, 40, 'the phase maximum is the observed maximum');
  assert.ok(Math.abs(engine.observationMeanPercent - ((10 * 3 + 40 * 3) / 6)) < 1e-6, `observation mean ${engine.observationMeanPercent}`);
  assert.notEqual(engine.observationMeanPercent, engine.maxPercent, 'the mean must not be the summary maximum');
});

// 9. A topology change splits the phases apart and leaves the whole-phase GPU difference null.
await check('a changed adapter set leaves the whole-phase GPU difference null', async () => {
  const engines = index => [{ engineType: '3d', luid: LUID_A, max: 20 + index }];
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10], engineFactory: engines });
  const { result } = await runCase('topology', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples, adapterLuidSet: LUID_A }) },
      ...['B', 'C', 'D'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples, adapterLuidSet: LUID_A }) })),
      { id: 'A1', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A1', targets: [WE, DSH], samples, topologyKnown: false, topologySegments: [{ adapterLuidSet: null, topologyKnown: false, samples: 6, startAt: ISO(400), perPid: [] }] }) }],
  });
  const a1 = result.phases.find(p => p.id === 'A1');
  assert.equal(a1.topology.known, false, 'an unknown segment must be reported as unknown');
  assert.equal(a1.topology.gpuPhaseComparable, false);
  assert.equal(a1.conclusions.gpuComparable, false);
  assert.equal(a1.conclusions.cpuComparable, true, 'CPU coverage is evaluated on its own');
  const pair = pairOf(result, 'D->A1');
  const finding = pair.findings.find(item => item.pid === WE.pid);
  assert.ok(finding.gpuEngines.delta === null, 'the whole-phase GPU difference must stay null');
  const gpuRowReasons = finding.gpuEngines.rows.map(row => String(row.reason));
  assert.equal(gpuRowReasons.every(reason => reason.includes('GPU')), true, `every GPU row should carry the GPU gate reason: ${JSON.stringify(gpuRowReasons)}`);
  assert.notEqual(finding.cpu.delta, null, 'the CPU difference is still available');
});

// 10. Baseline drift is kept, and a negative difference is not clamped.
await check('baseline drift keeps a negative difference', async () => {
  const heavier = longCpuSeries({ pid: WE.pid, deltas: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9], walls: [10, 10, 10, 10, 10, 10], workingSet: 300 * 1024 * 1024 });
  const lighter = longCpuSeries({ pid: WE.pid, deltas: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3], walls: [10, 10, 10, 10, 10, 10], workingSet: 100 * 1024 * 1024 });
  const { result } = await runCase('baseline-drift', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples: heavier }) },
      ...['B', 'C', 'D'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples: heavier }) })),
      { id: 'A1', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A1', targets: [WE, DSH], samples: lighter }) }],
  });
  const pair = pairOf(result, 'A0->A1');
  const finding = pair.findings.find(item => item.pid === WE.pid);
  assert.ok(finding.cpu.delta < 0, `expected a negative CPU difference, got ${finding.cpu.delta}`);
  assert.ok(finding.workingSetBytes.delta < 0, `expected a negative memory difference, got ${finding.workingSetBytes.delta}`);
  assert.equal(finding.workingSetBytes.delta, (100 - 300) * 1024 * 1024, 'the drift is kept as measured');
});

// 11. Different conditions are recorded and make the comparison inconclusive.
await check('differing fixed conditions are recorded and block dataReady', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  const conditionsFor = id => ({
    powerState: id === 'D' ? 'battery' : 'ac',
    weGlobalSettingsEvidence: 'manual: unchanged',
    dshViewport: id === 'D' ? { width: 1920, height: 1080 } : { width: 1600, height: 900 },
    dpi: id === 'D' ? 125 : 100,
    foregroundEvidence: 'manual: dsh foreground',
    desktopPlaybackEvidence: 'manual: playing',
    projectSha256: 'a'.repeat(64), wallpaperPropertiesSha256: 'b'.repeat(64),
  });
  const { result } = await runCase('conditions-differ', {
    phases: [{ id: 'A0', start: 0, end: 1000, conditions: conditionsFor('A0'), processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples }) },
      ...['B', 'C', 'D'].map(id => ({ id, start: 0, end: 1000, conditions: conditionsFor(id), processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples }) })),
      { id: 'A1', start: 0, end: 1000, conditions: conditionsFor('A1'), processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A1', targets: [WE, DSH], samples }) }],
  });
  const fields = result.conditionComparison.filter(entry => !entry.allEqual).map(entry => entry.field);
  assert.ok(fields.includes('powerState'), `powerState should differ, got ${fields.join(', ')}`);
  assert.ok(fields.includes('dpi'), 'dpi should differ');
  assert.equal(result.status.dataReady, false);
  assert.ok(result.status.reasons.some(reason => reason.includes('powerState')), 'the differing field must be named');
  const pair = pairOf(result, 'C->D');
  assert.ok(pair, 'the protocol pair must still be present so the numbers can be read');
  assert.ok(result.conditionComparison.find(entry => entry.field === 'dshViewport').allEqual === false, 'the viewport difference must be recorded');
});

// 12. Phase B has no capture helper and no capture numbers are invented.
await check('phase B without capture invents no capture numbers', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  const captureSamples = structuredClone(samples);
  for (const sample of captureSamples) {
    sample.processes.push(processRow({ pid: CAP.pid, cpuSeconds: 5, cpuSecondsDelta: 0.6, wallClockSecondsDelta: 10, cpuPercent: 0.6 / 320, workingSetBytes: 64 * 1024 * 1024, privateBytes: 96 * 1024 * 1024, name: 'WallpaperProbe' }));
  }
  const { result } = await runCase('b-without-capture', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples }) },
      { id: 'B', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'B', targets: [WE, DSH], samples }) },
      ...['C', 'D'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), manifestProcess(CAP, ['capture'])], report: buildReport({ phaseId: id, targets: [WE, DSH, CAP], samples: captureSamples }) })),
      { id: 'A1', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A1', targets: [WE, DSH], samples }) }],
  });
  const bRow = result.phases.find(p => p.id === 'B').processes.find(process => process.pid === CAP.pid);
  assert.equal(bRow, undefined, 'phase B must not carry a capture process');
  const cRow = result.phases.find(p => p.id === 'C').processes.find(process => process.pid === CAP.pid);
  assert.ok(cRow.cpu.intervals > 0, 'phase C reports the helper on its own');
  const pair = pairOf(result, 'B->C');
  const finding = pair.findings.find(item => item.pid === CAP.pid);
  assert.equal(finding, undefined, 'a process new in C must not be given a fabricated B value');
  assert.ok(pair.newProcesses.includes(CAP.pid), 'the new PID is reported as new');
});

// 13. A frame cap is never turned into a measured source FPS.
await check('a capture cap of 30 is not reported as a source FPS', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  const { result } = await runCase('frame-cap', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples }) },
      ...['B', 'C', 'D'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples }) })),
      { id: 'A1', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A1', targets: [WE, DSH], samples }) }],
  });
  assert.equal(result.fixedConditions.captureFpsCap, 30);
  assert.equal(result.fixedConditions.sourceRenderFps, null, 'the source FPS stays null when it was not measured');
  const serialized = JSON.stringify(result);
  assert.equal(/sourceRenderFps":\s*30/.test(serialized), false, 'the cap must never be written as a measured FPS');
});

// 14. Bad inputs are rejected, and nothing is written.
await check('bad JSON, wrong order and a template manifest are rejected without output', async () => {
  const cases = [];
  // (a) broken JSON
  {
    const { manifestPath, dir } = await writeCase('bad-json', { phases: [] }).catch(() => ({}));
    void manifestPath;
    const brokenDir = join(runRoot, 'bad-json');
    await mkdir(join(brokenDir, 'A0'), { recursive: true });
    await writeFile(join(brokenDir, 'A0', 'sample.json'), '{ not json');
    const manifest = { schemaVersion: 1, state: 'synthetic', fixedConditions: {}, minimumCoverage: { cpuIntervals: 5, cpuValidSeconds: 30, metricObservations: 5 }, phases: [{ id: 'A0', state: 'measured', samplerReport: 'A0/sample.json', measurement: { startedAt: ISO(0), endedAt: ISO(60) }, processes: [] }] };
    await writeFile(join(brokenDir, 'manifest.json'), JSON.stringify(manifest));
    cases.push({ name: 'bad JSON', manifestPath: join(brokenDir, 'manifest.json') });
    void dir;
  }
  // (b) wrong phase order
  {
    const { manifestPath } = await writeCase('bad-order', { phases: [{ id: 'A0', start: 0, end: 1000, processes: [], report: buildReport({ phaseId: 'A0', targets: [], samples: [] }) }] }).catch(() => ({}));
    if (manifestPath) {
      const text = JSON.parse(await readFile(manifestPath, 'utf8'));
      text.phases = [text.phases[0]];
      await writeFile(manifestPath, JSON.stringify(text));
      cases.push({ name: 'wrong phase set', manifestPath });
    }
  }
  // (c) template manifest
  cases.push({ name: 'template manifest', manifestPath: resolve(repoRoot, '..', 'docs', 'perf-phase-manifest.example.json') });

  for (const entry of cases) {
    const outputDir = join(runRoot, `reject-${entry.name.replace(/\W+/g, '-')}`, 'out');
    let failed = false;
    try {
      await comparePhases({ manifestPath: entry.manifestPath, outputDir });
    } catch (error) {
      failed = true;
      assert.equal(error.name, 'BadInput', `${entry.name}: expected a BadInput, got ${error.name}: ${error.message}`);
    }
    assert.equal(failed, true, `${entry.name}: the input should have been rejected`);
    assert.equal(existsSync(outputDir), false, `${entry.name}: no output directory may be created`);
  }
});

// 15. An existing output directory is refused and a sentinel file is left alone.
await check('an existing output directory is refused and its sentinel is untouched', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  const { manifestPath } = await writeCase('existing-output', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples }) },
      ...['B', 'C', 'D', 'A1'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples }) }))],
  });
  const outputDir = join(dirname(manifestPath), 'occupied');
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'sentinel.txt'), 'do not touch');
  const { spawnSync } = await import('node:child_process');
  const run = spawnSync(process.execPath, [join(here, 'compare-phases.mjs'), '--manifest', manifestPath, '--output', outputDir], { encoding: 'utf8' });
  assert.equal(run.status, 3, `expected exit 3, got ${run.status}: ${run.stdout} ${run.stderr}`);
  assert.equal(await readFile(join(outputDir, 'sentinel.txt'), 'utf8'), 'do not touch', 'the sentinel must be unchanged');
  const listing = await readdir(outputDir);
  assert.deepEqual(listing, ['sentinel.txt'], `nothing may be added to an existing output directory, found ${listing.join(', ')}`);
});

// 16. A target set that is present but unresolved still produces readable numbers.
await check('an unresolved target set is inconclusive but keeps the readable values', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  for (const sample of samples) {
    sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 9, cpuSecondsDelta: 0.02, wallClockSecondsDelta: 10, cpuPercent: 0.02 / 320, workingSetBytes: 4096, privateBytes: 8192, name: 'dsh' }));
  }
  const { result } = await runCase('unresolved', {
    phases: [{ id: 'A0', start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])], report: buildReport({ phaseId: 'A0', targets: [WE, DSH], samples }) },
      ...['B', 'C', 'D', 'A1'].map(id => ({ id, start: 0, end: 1000, processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])], report: buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples }) }))],
    mutateManifest: manifest => {
      manifest.phases.find(phase => phase.id === 'B').unresolvedRoles = ['dsh-client'];
      manifest.phases.find(phase => phase.id === 'B').processes = manifest.phases.find(phase => phase.id === 'B').processes.filter(process => !process.roles.includes('we'));
    },
  });
  const b = result.phases.find(phase => phase.id === 'B');
  assert.equal(b.identity.conclusive, false);
  assert.ok(b.requiredRolesUnresolved.includes('we'));
  assert.equal(b.processes.length, 1, 'the remaining target is still reported');
  assert.ok(b.processes[0].cpu.percentOfLogicalCapacity !== null, 'its CPU value is still readable');
  assert.equal(result.status.dataReady, false);
  assert.equal(result.status.reportWritten, true);
});

// ---------------------------------------------------------------------------------------------
// F1-F4 regression cases added after the review
// ---------------------------------------------------------------------------------------------

/** A five-phase set with a single overridden field, so each case changes exactly one thing. */
async function fivePhaseCase(name, { override = {}, conditionsOverride = null, minimumCoverage = null, onManifest = null } = {}) {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  for (const sample of samples) {
    sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 9, cpuSecondsDelta: 0.02, wallClockSecondsDelta: 10, cpuPercent: 0.02 / 320, workingSetBytes: 4096, privateBytes: 8192, name: 'dsh' }));
  }
  const captureSamples = structuredClone(samples);
  for (const sample of captureSamples) {
    sample.processes.push(processRow({ pid: CAP.pid, cpuSeconds: 5, cpuSecondsDelta: 0.03, wallClockSecondsDelta: 10, cpuPercent: 0.03 / 320, workingSetBytes: 8192, privateBytes: 16384, name: 'WallpaperProbe' }));
  }
  const phases = ['A0', 'B', 'C', 'D', 'A1'].map(id => {
    const needsCapture = id === 'C' || id === 'D';
    const report = buildReport({
      phaseId: id,
      logicalProcessors: override[id]?.logicalProcessors ?? 32,
      targets: [WE, DSH, ...(needsCapture ? [CAP] : [])],
      samples: needsCapture ? captureSamples : samples,
      adapterLuidSet: override[id]?.adapterLuidSet ?? LUID_A,
    });
    if (override[id]?.reportPhase) report.phase = override[id].reportPhase;
    if (override[id]?.readStartsAt) report.samples = report.samples.map((sample, index) => ({ ...sample, readStartedAt: ISO(override[id].readStartsAt + index * 10), gpuReadFinishedAt: ISO(override[id].readStartsAt + index * 10 + 1) }));
    if (override[id]?.readEndsAt) {
      report.samples = report.samples.map((sample, index) => ({ ...sample, gpuReadFinishedAt: ISO(override[id].readEndsAt + index) }));
    }
    if (override[id]?.captureFrameSize !== undefined) { /* set on the manifest below */ }
    const manifestPhase = {
      id, start: 0, end: 1000,
      conditions: conditionsOverride ? conditionsOverride(id) : undefined,
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(needsCapture ? [manifestProcess(CAP, ['capture'])] : [])],
      report,
      captureFrameSize: override[id]?.captureFrameSize ?? (needsCapture ? { width: 1302, height: 776 } : null),
      sourceWindow: needsCapture ? { location: `${id}-window`, hwnd: 1000 + id.length, renderPid: WE.pid, inspectSize: { width: 1280, height: 720 } } : null,
      captureMode: id === 'C' ? 'memory' : id === 'D' ? 'pipe' : null,
    };
    return manifestPhase;
  });
  const built = await writeCase(name, { phases, minimumCoverage });
  if (onManifest) {
    const text = JSON.parse(await readFile(built.manifestPath, 'utf8'));
    onManifest(text);
    await writeFile(built.manifestPath, JSON.stringify(text, null, 1));
  }
  const outputDir = join(built.dir, 'out');
  const result = await comparePhases({ manifestPath: built.manifestPath, outputDir });
  await mkdir(outputDir);
  await writeFile(join(outputDir, 'comparison.json'), JSON.stringify(result, null, 1));
  return { result, manifestPath: built.manifestPath, dir: built.dir };
}

await check('F1: a differing logical capacity blocks CPU differences with a stated reason', async () => {
  const { result } = await fivePhaseCase('f1-capacity', { override: { B: { logicalProcessors: 16 } } });
  const pair = pairOf(result, 'A0->B');
  assert.equal(pair.gates.passed, false, 'the pair gates must not pass when the capacity differs');
  assert.ok(pair.gates.reasons.some(reason => reason.includes('capacity differs')), `the capacity reason must be stated, got ${JSON.stringify(pair.gates.reasons)}`);
  const finding = pair.findings.find(item => item.pid === WE.pid);
  assert.equal(finding.cpu.delta, null, 'no CPU difference across a different logical capacity');
  assert.ok(String(finding.cpu.reason).includes('run conditions'), `the CPU row must explain the gate, got ${finding.cpu.reason}`);
  assert.ok(pair.gates.reasons.some(reason => reason.includes('capacity')), 'the pair gate names the capacity as the reason');
  assert.equal(finding.cpu.from, undefined, 'the blocked row must not carry a computed value');
  assert.equal(finding.workingSetBytes.delta, null, 'the pair gate covers every metric, not only the capacity-dependent one');
  assert.equal(result.status.dataReady, false);
});

await check('F1: a differing C/D frame size blocks the comparison', async () => {
  const { result } = await fivePhaseCase('f1-frame-size', { override: { D: { captureFrameSize: { width: 1902, height: 1071 } } } });
  const pair = pairOf(result, 'C->D');
  assert.equal(pair.gates.passed, false, 'a different frame size must not be comparable');
  assert.ok(pair.gates.reasons.some(reason => reason.includes('capture frame size differs')), `expected a frame-size reason, got ${JSON.stringify(pair.gates.reasons)}`);
  const finding = pair.findings.find(item => item.pid === WE.pid);
  assert.equal(finding.cpu.delta, null);
  assert.equal(pair.gates.captureFrameSize.equal, false);
  // B has no captureFrameSize at all, which is normal and must not be treated as an error.
  const pairB = pairOf(result, 'A0->B');
  assert.equal(pairB.gates.reasons.some(reason => reason.includes('capture frame size')), false, 'a phase without capture frames is not an error');
});

await check('F1: a fixed condition that drifted in every phase is still not comparable', async () => {
  const conditionsFor = () => ({
    powerState: 'battery', // the manifest's fixed value says 'ac'
    weGlobalSettingsEvidence: 'manual: unchanged', dshViewport: { width: 1600, height: 900 }, dpi: 100,
    foregroundEvidence: 'manual: dsh foreground', desktopPlaybackEvidence: 'manual: playing',
    projectSha256: 'a'.repeat(64), wallpaperPropertiesSha256: 'b'.repeat(64),
  });
  const { result } = await fivePhaseCase('f1-drift-all', { conditionsOverride: conditionsFor });
  const pair = pairOf(result, 'A0->B');
  assert.equal(pair.gates.passed, false, 'all phases drifting together must not look like a match');
  assert.ok(pair.gates.reasons.some(reason => reason.includes("does not match the manifest's fixed condition")), `expected a fixed-condition reason, got ${JSON.stringify(pair.gates.reasons)}`);
  assert.equal(pair.findings.find(item => item.pid === WE.pid).cpu.delta, null);
});

await check('F2: a sparse PID is blocked even when the phase total is large', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  // DSH is well covered; WE has one interval of 10 s in B only.
  for (const sample of samples) {
    sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 9, cpuSecondsDelta: 0.02, wallClockSecondsDelta: 10, cpuPercent: 0.02 / 320, workingSetBytes: 4096, privateBytes: 8192, name: 'dsh' }));
  }
  const sparseSamples = structuredClone(samples).map((sample, index) => {
    const target = sample.processes.find(entry => entry.pid === WE.pid);
    if (index === 0) { target.cpuSecondsDelta = 0.5; target.wallClockSecondsDelta = 10; target.cpuPercentOfLogicalCapacity = 0.5 / 320; }
    else { target.cpuSecondsDelta = null; target.wallClockSecondsDelta = null; target.cpuPercentOfLogicalCapacity = null; }
    target.workingSetBytes = 100 * 1024 * 1024;
    return sample;
  });
  const captureSamples = structuredClone(samples);
  for (const sample of captureSamples) {
    sample.processes.push(processRow({ pid: CAP.pid, cpuSeconds: 5, cpuSecondsDelta: 0.03, wallClockSecondsDelta: 10, cpuPercent: 0.03 / 320, workingSetBytes: 8192, privateBytes: 16384, name: 'WallpaperProbe' }));
  }
  const phases = ['A0', 'B', 'C', 'D', 'A1'].map(id => {
    const needsCapture = id === 'C' || id === 'D';
    const useSparse = id === 'B';
    return {
      id, start: 0, end: 1000, conditions: sameConditions(),
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(needsCapture ? [manifestProcess(CAP, ['capture'])] : [])],
      report: buildReport({
        phaseId: id, targets: [WE, DSH, ...(needsCapture ? [CAP] : [])],
        samples: needsCapture ? captureSamples : (useSparse ? sparseSamples : samples),
      }),
      captureFrameSize: needsCapture ? { width: 1302, height: 776 } : null,
      sourceWindow: needsCapture ? { location: `${id}-w`, hwnd: 1, renderPid: WE.pid, inspectSize: { width: 1280, height: 720 } } : null,
    };
  });
  const { manifestPath, dir } = await writeCase('f2-sparse-pid', { phases });
  const outputDir = join(dir, 'out');
  const result = await comparePhases({ manifestPath, outputDir });
  const b = result.phases.find(phase => phase.id === 'B');
  const coverage = b.coverage.perProcess.find(entry => entry.pid === WE.pid);
  assert.equal(coverage.cpu.met, false, 'the sparse PID must fail its own CPU gate');
  assert.equal(coverage.workingSetBytes.met, true, 'its working-set observations are enough');
  const pair = pairOf(result, 'A0->B');
  const finding = pair.findings.find(item => item.pid === WE.pid);
  assert.equal(finding.cpu.delta, null, 'no CPU difference for the sparse PID');
  assert.ok(String(finding.cpu.reason).includes(`pid ${WE.pid}`), `the reason must name the PID, got ${finding.cpu.reason}`);
  const dshFinding = pair.findings.find(item => item.pid === DSH.pid);
  assert.notEqual(dshFinding.cpu.delta, null, 'the well-covered PID is unaffected');
});

await check('F2: one sparse engine observation blocks the GPU difference without touching CPU', async () => {
  const engineFactory = index => [{ engineType: '3d', luid: LUID_A, max: index === 0 ? 10 : 40 }];
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10], engineFactory });
  for (const sample of samples) {
    sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 9, cpuSecondsDelta: 0.02, wallClockSecondsDelta: 10, cpuPercent: 0.02 / 320, workingSetBytes: 4096, privateBytes: 8192, name: 'dsh' }));
  }
  // In B only the first sample carries an engine reading for WE.
  const sparseEngine = structuredClone(samples).map((sample, index) => {
    if (index > 0) sample.processGpu = [];
    return sample;
  });
  const phases = ['A0', 'B', 'C', 'D', 'A1'].map(id => {
    const needsCapture = id === 'C' || id === 'D';
    return {
      id, start: 0, end: 1000, conditions: sameConditions(),
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(needsCapture ? [manifestProcess(CAP, ['capture'])] : [])],
      report: buildReport({ phaseId: id, targets: [WE, DSH, ...(needsCapture ? [CAP] : [])], samples: id === 'B' ? sparseEngine : samples }),
      captureFrameSize: needsCapture ? { width: 1302, height: 776 } : null,
      sourceWindow: needsCapture ? { location: `${id}-w`, hwnd: 1, renderPid: WE.pid, inspectSize: { width: 1280, height: 720 } } : null,
    };
  });
  const { manifestPath, dir } = await writeCase('f2-sparse-engine', { phases });
  const outputDir = join(dir, 'out');
  const result = await comparePhases({ manifestPath, outputDir });
  const pair = pairOf(result, 'A0->B');
  const finding = pair.findings.find(item => item.pid === WE.pid);
  assert.equal(finding.gpuEngines.delta, null, 'a single engine observation must not produce a difference');
  assert.equal(finding.gpuEngines.rows.some(row => row.deltaPercent !== null), false, "a single engine observation must block its row");
  assert.notEqual(finding.cpu.delta, null, 'CPU is evaluated on its own and still compares');
});

await check('F3: a report labelled with the wrong phase is rejected', async () => {
  const { manifestPath, dir } = await fivePhaseCase('f3-wrong-phase', { override: { B: { reportPhase: 'A0' } } }).then(async value => value).catch(() => ({}));
  if (!manifestPath) {
    // fivePhaseCase throws on a rejected input, which is the expected path; rebuild it to assert the error.
  }
  const built = await writeCase('f3-wrong-phase-direct', {
    phases: ['A0', 'B', 'C', 'D', 'A1'].map(id => ({
      id, start: 0, end: 1000, conditions: sameConditions(),
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(id === 'C' || id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])],
      report: (() => {
        const report = buildReport({ phaseId: id, targets: [WE, DSH, ...(id === 'C' || id === 'D' ? [CAP] : [])], samples: longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] }) });
        if (id === 'B') report.phase = 'A0';
        return report;
      })(),
    })),
  });
  const outputDir = join(built.dir, 'out');
  let error = null;
  try { await comparePhases({ manifestPath: built.manifestPath, outputDir }); } catch (caught) { error = caught; }
  assert.ok(error, 'a mislabelled report must be rejected');
  assert.equal(error.name, 'BadInput');
  assert.ok(error.message.includes('reports phase'), `the message must say which phase it named, got ${error.message}`);
  assert.equal(existsSync(outputDir), false, 'nothing may be written for a rejected input');
  void dir;
});

await check('F3: an extra report target makes the phase inconclusive and blocks its differences', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  for (const sample of samples) {
    sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 9, cpuSecondsDelta: 0.02, wallClockSecondsDelta: 10, cpuPercent: 0.02 / 320, workingSetBytes: 4096, privateBytes: 8192, name: 'dsh' }));
  }
  const stowaway = { pid: 420, startTime: WE.startTime, path: null, name: 'stowaway' };
  const phases = ['A0', 'B', 'C', 'D', 'A1'].map(id => {
    const needsCapture = id === 'C' || id === 'D';
    return {
      id, start: 0, end: 1000, conditions: sameConditions(),
      processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(needsCapture ? [manifestProcess(CAP, ['capture'])] : [])],
      report: buildReport({
        phaseId: id,
        targets: [WE, DSH, ...(needsCapture ? [CAP] : []), ...(id === 'B' ? [stowaway] : [])],
        samples,
      }),
      captureFrameSize: needsCapture ? { width: 1302, height: 776 } : null,
      sourceWindow: needsCapture ? { location: `${id}-w`, hwnd: 1, renderPid: WE.pid, inspectSize: { width: 1280, height: 720 } } : null,
    };
  });
  const { manifestPath, dir } = await writeCase('f3-extra-target', { phases });
  const outputDir = join(dir, 'out');
  const result = await comparePhases({ manifestPath, outputDir });
  const b = result.phases.find(phase => phase.id === 'B');
  assert.ok(b.warnings.some(warning => String(warning.note).includes('420')), 'the extra target must be reported');
  assert.equal(result.status.dataReady, false, 'a mismatched target set is legitimate but insufficient');
  const pair = pairOf(result, 'A0->B');
  assert.equal(pair.gates.passed, false, 'no difference may be computed from a mismatched target set');
  assert.equal(pair.findings.every(item => item.cpu.delta === null && item.workingSetBytes.delta === null && item.gpuEngines.delta === null), true, 'no difference of any kind may come from a mismatched target set');
  assert.equal(result.status.reportWritten, true, 'the report is still produced');
});

await check('F3: a negative wall-clock interval is a broken input, not a gap', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  samples[2].processes[0].wallClockSecondsDelta = -1;
  const phases = ['A0', 'B', 'C', 'D', 'A1'].map(id => ({
    id, start: 0, end: 1000,
    processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])],
    report: buildReport({ phaseId: id, targets: [WE, DSH], samples: id === 'B' ? samples : longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] }) }),
  }));
  const { manifestPath, dir } = await writeCase('f3-negative-interval', { phases });
  const outputDir = join(dir, 'out');
  let error = null;
  try { await comparePhases({ manifestPath, outputDir }); } catch (caught) { error = caught; }
  assert.ok(error, 'a negative interval must be rejected');
  assert.equal(error.name, 'BadInput');
  assert.ok(error.message.includes('negative wallClockSecondsDelta'), `the message must name the field, got ${error.message}`);
  assert.equal(existsSync(outputDir), false);
});

await check('F3: a read that finishes outside the window is reported and blocks comparability', async () => {
  const samples = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10] });
  for (const sample of samples) {
    sample.processes.push(processRow({ pid: DSH.pid, cpuSeconds: 9, cpuSecondsDelta: 0.02, wallClockSecondsDelta: 10, cpuPercent: 0.02 / 320, workingSetBytes: 4096, privateBytes: 8192, name: 'dsh' }));
  }
  // B's last GPU read finishes long after the declared window ends.
  const late = structuredClone(samples).map((sample, index) => ({ ...sample, gpuReadFinishedAt: ISO(index === samples.length - 1 ? 2000 : index * 10 + 1) }));
  const phases = ['A0', 'B', 'C', 'D', 'A1'].map(id => ({
    id, start: 0, end: 60,
    processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app'])],
    report: buildReport({ phaseId: id, targets: [WE, DSH], samples: id === 'B' ? late : samples }),
  }));
  const { manifestPath, dir } = await writeCase('f3-read-outside-window', { phases });
  const outputDir = join(dir, 'out');
  const result = await comparePhases({ manifestPath, outputDir });
  const b = result.phases.find(phase => phase.id === 'B');
  assert.ok(b.inconclusiveReasons.some(reason => reason.includes('measurement window')), `expected a window reason, got ${JSON.stringify(b.inconclusiveReasons)}`);
  assert.equal(b.conclusions.cpuComparable, false, 'a read outside the window blocks comparability');
  const pair = pairOf(result, 'A0->B');
  assert.equal(pair.findings.every(item => item.cpu.delta === null), true, 'no CPU difference from a phase whose reads left the window');
  assert.ok(String(pair.findings[0].cpu.reason).includes('window'), `the reason must name the window, got ${pair.findings[0].cpu.reason}`);
  assert.equal(result.status.dataReady, false);
});

await check('F4: a true A to B to A adapter switch is split into segments', async () => {
  const engineFactory = index => [{ engineType: '3d', luid: LUID_A, max: 20 + index }];
  const samplesA = longCpuSeries({ pid: WE.pid, deltas: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], walls: [10, 10, 10, 10, 10, 10], engineFactory });
  const samplesB = structuredClone(samplesA).map(sample => ({ ...sample, adapterLuidSet: `${LUID_A}|${LUID_B}` }));
  const phases = [
    { id: 'A0', samples: samplesA, adapterLuidSet: LUID_A },
    { id: 'B', samples: samplesB, adapterLuidSet: `${LUID_A}|${LUID_B}` },
    { id: 'C', samples: samplesB, adapterLuidSet: `${LUID_A}|${LUID_B}` },
    { id: 'D', samples: samplesB, adapterLuidSet: `${LUID_A}|${LUID_B}` },
    { id: 'A1', samples: samplesA, adapterLuidSet: LUID_A },
  ].map(entry => ({
    id: entry.id, start: 0, end: 1000, conditions: sameConditions(),
    processes: [manifestProcess(WE, ['we']), manifestProcess(DSH, ['dsh-app']), ...(entry.id === 'C' || entry.id === 'D' ? [manifestProcess(CAP, ['capture'])] : [])],
    report: buildReport({ phaseId: entry.id, targets: [WE, DSH, ...(entry.id === 'C' || entry.id === 'D' ? [CAP] : [])], samples: entry.samples, adapterLuidSet: entry.adapterLuidSet }),
    captureFrameSize: entry.id === 'C' || entry.id === 'D' ? { width: 1302, height: 776 } : null,
    sourceWindow: entry.id === 'C' || entry.id === 'D' ? { location: `${entry.id}-w`, hwnd: 1, renderPid: WE.pid, inspectSize: { width: 1280, height: 720 } } : null,
  }));
  const { manifestPath, dir } = await writeCase('f4-topology-switch', { phases });
  const outputDir = join(dir, 'out');
  const result = await comparePhases({ manifestPath, outputDir });
  const b = result.phases.find(phase => phase.id === 'B');
  assert.deepEqual(b.topology.sampleLuidSets.sort(), [`${LUID_A}|${LUID_B}`], 'B has one adapter set of its own');
  assert.equal(b.topology.changed, false, 'within a phase the set is stable');
  assert.ok(b.topology.segments.length >= 1, 'the segment values must be present');
  assert.ok(b.topology.segments[0].perPid.length >= 1, 'each segment carries per-PID values');
  const pair = pairOf(result, 'A0->B');
  assert.equal(pair.gates.captureFrameSize.equal, true);
  // A0 and B ran on different adapter sets, which is exactly what must prevent a whole-phase GPU figure.
  const a0 = result.phases.find(phase => phase.id === 'A0');
  const engineDelta = pairOf(result, 'A0->B').findings.find(item => item.pid === WE.pid).gpuEngines;
  assert.notEqual(result.status.dataReady, true, 'a differing adapter set across the pair must not be called ready');
  assert.notEqual(a0.topology.sampleLuidSets.join(','), b.topology.sampleLuidSets.join(','), 'the two phases ran on different adapter sets');
  void engineDelta;
});

await check('F4: reference pairs B/D against A0/A1 are present, and equal conditions still give a difference', async () => {
  const { result } = await fivePhaseCase('f4-reference-pairs', {});
  const pairs = result.comparisons.map(entry => entry.pair);
  for (const expected of ['B->A0', 'D->A0', 'B->A1', 'D->A1']) {
    assert.ok(pairs.includes(expected), `the reference pair ${expected} must be produced, got ${pairs.join(', ')}`);
  }
  const forward = pairOf(result, 'A0->B').findings.find(item => item.pid === WE.pid).cpu.delta;
  const reverse = pairOf(result, 'B->A0').findings.find(item => item.pid === WE.pid).cpu.delta;
  assert.ok(forward !== null && reverse !== null, 'both directions must be computed when the data allows it');
  assert.ok(Math.abs(forward + reverse) < 1e-9, `the reverse pair must keep its sign: ${forward} vs ${reverse}`);
  assert.equal(result.status.dataReady, true, `a clean case must be ready, got ${JSON.stringify(result.status.reasons)}`);
  const finding = pairOf(result, 'A0->B').findings.find(item => item.pid === WE.pid);
  assert.ok(Array.isArray(finding.gpuMemory.rows), 'GPU memory differences are reported per LUID/metric');
  assert.notEqual(finding.privateBytes.delta, null, 'private bytes have their own difference');
});


// ---------------------------------------------------------------------------------------------
// R1-R4 regression cases from the second review
// ---------------------------------------------------------------------------------------------



/** One CPU-and-memory sample carrying both required roles, so identity checks can pass. */
function rSample(index, { engines = [], vram = [], luidSet = LUID_A } = {}) {
  const rows = [
    processRow({ pid: WE.pid, name: 'wallpaper64', cpuSeconds: 100 + index * 5, cpuSecondsDelta: 5, wallClockSecondsDelta: 10, cpuPercent: 5 / 320, workingSetBytes: 100 << 20, privateBytes: 200 << 20 }),
    processRow({ pid: DSH.pid, name: 'dsh', cpuSeconds: 50 + index, cpuSecondsDelta: 1, wallClockSecondsDelta: 10, cpuPercent: 1 / 320, workingSetBytes: 200 << 20, privateBytes: 300 << 20 }),
  ];
  const sample = buildSample({ index, processes: rows, engines, vram });
  sample.adapterLuidSet = luidSet;
  return sample;
}
const R_TARGETS = [WE, DSH];

/** Manifest processes that match a phase's report targets exactly, so identity checks can pass. */
function processesFor(targets, captureAlways = false) {
  const roles = { [WE.pid]: ['we'], [DSH.pid]: ['dsh-app'], [CAP.pid]: ['capture'] };
  return targets.map(target => ({
    pid: target.pid,
    startTime: target.startTime,
    path: target.path ?? null,
    roles: roles[target.pid] || ['dsh-host'],
    evidence: 'manual: R case identity',
  }));
}

/** Builds one phase description with the shared defaults used by the R cases. */
function rPhase(id, { samples, targets, roles = null, conditions = true }) {
  const needsCapture = id === 'C' || id === 'D';
  return {
    id, start: 0, end: 1000,
    processes: roles || processesFor(targets),
    conditions: conditions ? sameConditions() : undefined,
    report: buildReport({ phaseId: id, targets, samples }),
    captureFrameSize: needsCapture ? { width: 1302, height: 776 } : null,
    sourceWindow: needsCapture ? { location: id + '-w', hwnd: 1, renderPid: WE.pid, inspectSize: { width: 1280, height: 720 } } : null,
  };
}

/** The five ids with a set of samples per id; C/D get the capture process added. */
function rSamples(samplesByPhase, pids = [WE, DSH, CAP]) {
  return ['A0', 'B', 'C', 'D', 'A1'].map(id => {
    const needsCapture = id === 'C' || id === 'D';
    const wanted = pids.filter(target => needsCapture || target !== CAP);
    return { id, samples: samplesByPhase(id), targets: wanted };
  });
}

// R1: a phase set where every value is null must not be called ready.
await check('R1: all values missing is inconclusive, not ready', async () => {
  const blankSamples = index => [0, 1, 2, 3, 4, 5, 6, 7].map(step => {
    const rows = [processRow({ pid: WE.pid, name: 'wallpaper64' }), processRow({ pid: DSH.pid, name: 'dsh' })];
    if (index === 'C' || index === 'D') rows.push(processRow({ pid: CAP.pid, name: 'WallpaperProbe' }));
    return buildSample({ index: step, processes: rows, engines: [], vram: [] });
  });
  const phases = rSamples(blankSamples).map(entry => rPhase(entry.id, { samples: entry.samples, targets: entry.targets }));
  const { manifestPath, dir } = await writeCase('r1-all-missing', { phases });
  const outputDir = join(dir, 'out');
  const result = await comparePhases({ manifestPath, outputDir });
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'comparison.json'), JSON.stringify(result, null, 1));
  assert.equal(result.status.dataReady, false, 'a set with no usable observation must not be ready');
  assert.ok(result.status.reasons.some(reason => reason.includes('no usable observation')), 'the reason must say no observation was usable: ' + JSON.stringify(result.status.reasons.slice(0, 4)));
  const b = result.phases.find(phase => phase.id === 'B');
  assert.equal(b.conclusions.perFamilyObserved.cpu, false, 'CPU has no observation in this phase');
  assert.equal(b.conclusions.cpuCoveragePresent, false, 'a phase with no CPU reading is not CPU-comparable');
  const pair = pairOf(result, 'A0->B');
  assert.equal(pair.findings.every(finding => finding.cpu.delta === null), true, 'null values must not produce a delta');
  assert.equal(pair.findings.every(finding => finding.workingSetBytes.delta === null), true);
});

// R1/R2: a phase with no GPU reading at all must still show its CPU difference.
await check('R1/R2: a missing GPU reading does not remove a valid CPU difference', async () => {
  const withGpu = [0, 1, 2, 3, 4, 5, 6, 7].map(step => rSample(step, { engines: [{ pid: WE.pid, engineType: '3d', luid: LUID_A, max: 30 + step }] }));
  const cpuOnly = [0, 1, 2, 3, 4, 5, 6, 7].map(step => rSample(step));
  const phases = [
    rPhase('A0', { samples: withGpu, targets: R_TARGETS }),
    rPhase('B', { samples: cpuOnly, targets: R_TARGETS }),
    rPhase('C', { samples: cpuOnly, targets: [...R_TARGETS, CAP] }),
    rPhase('D', { samples: cpuOnly, targets: [...R_TARGETS, CAP] }),
    rPhase('A1', { samples: withGpu, targets: R_TARGETS }),
  ];
  const { manifestPath, dir } = await writeCase('r2-gpu-missing-cpu-valid', { phases });
  const outputDir = join(dir, 'out');
  const result = await comparePhases({ manifestPath, outputDir });
  const pair = pairOf(result, 'A0->B');
  const finding = pair.findings.find(item => item.pid === WE.pid);
  assert.notEqual(finding.cpu.delta, null, 'a valid CPU difference must survive a missing GPU reading');
  assert.equal(finding.gpuEngines.rows.length > 0, true, 'the engine row is present');
  assert.equal(finding.gpuEngines.rows.every(row => row.deltaPercent === null), true, 'the engine row itself is null');
});

// R2: one missing memory metric must not remove the other three.
await check('R2: one missing GPU memory metric leaves the other metrics comparable', async () => {
  const build = () => [0, 1, 2, 3, 4, 5, 6, 7].map(step => rSample(step, {
    vram: [{ pid: WE.pid, luid: LUID_A, dedicated: null, shared: 200 + step * 10, nonLocal: 0, totalCommitted: 1000 }],
  }));
  const phases = [
    rPhase('A0', { samples: build(), targets: R_TARGETS }),
    rPhase('B', { samples: build(), targets: R_TARGETS }),
    rPhase('C', { samples: build(), targets: [...R_TARGETS, CAP] }),
    rPhase('D', { samples: build(), targets: [...R_TARGETS, CAP] }),
    rPhase('A1', { samples: build(), targets: R_TARGETS }),
  ];
  const { manifestPath, dir } = await writeCase('r2-memory-metric-missing', { phases });
  const result = await comparePhases({ manifestPath: join(dir, 'manifest.json'), outputDir: join(dir, 'out') });
  await mkdir(join(dir, 'out'), { recursive: true });
  await writeFile(join(dir, 'out', 'comparison.json'), JSON.stringify(result, null, 1));
  const pair = pairOf(result, 'A0->B');
  const finding = pair.findings.find(item => item.pid === WE.pid);
  const dedicated = finding.gpuMemory.rows.find(row => row.metric === 'dedicatedBytes');
  const shared = finding.gpuMemory.rows.find(row => row.metric === 'sharedBytes');
  assert.equal(dedicated.deltaBytes, null, 'the missing metric stays null');
  assert.ok(dedicated.reason, 'the missing metric carries a reason');
  assert.equal(shared.deltaBytes, 0, 'the valid metric reports a real zero difference when both sides match');
  assert.equal(shared.fromObservations > 0 && shared.toObservations > 0, true, 'the valid metric keeps its observation counts');
});

// R2: a sparse engine key must not remove a valid sibling key.
await check('R2: a sparse engine key leaves a valid sibling key comparable', async () => {
  const build = (sparse3d, copyValue) => [0, 1, 2, 3, 4, 5, 6, 7].map(step => {
    const engines = [{ pid: WE.pid, engineType: 'copy', luid: LUID_A, max: copyValue }];
    if (!sparse3d || step === 0) engines.unshift({ pid: WE.pid, engineType: '3d', luid: LUID_A, max: 10 + step });
    return rSample(step, { engines });
  });
  const phases = [
    rPhase('A0', { samples: build(false, 10), targets: R_TARGETS }),
    rPhase('B', { samples: build(true, 30), targets: R_TARGETS }),
    rPhase('C', { samples: build(false, 30), targets: [...R_TARGETS, CAP] }),
    rPhase('D', { samples: build(false, 30), targets: [...R_TARGETS, CAP] }),
    rPhase('A1', { samples: build(false, 10), targets: R_TARGETS }),
  ];
  const { manifestPath, dir } = await writeCase('r2-engine-key-sparse', { phases });
  const result = await comparePhases({ manifestPath: join(dir, 'manifest.json'), outputDir: join(dir, 'out') });
  await mkdir(join(dir, 'out'), { recursive: true });
  await writeFile(join(dir, 'out', 'comparison.json'), JSON.stringify(result, null, 1));
  const pair = pairOf(result, 'A0->B');
  const finding = pair.findings.find(item => item.pid === WE.pid);
  const threeD = finding.gpuEngines.rows.find(row => row.engineType === '3d');
  const copy = finding.gpuEngines.rows.find(row => row.engineType === 'copy');
  assert.equal(threeD.deltaPercent, null, 'the sparse key stays null');
  assert.ok(threeD.reason, 'the sparse key carries a reason');
  assert.equal(copy.deltaPercent, 20, 'the sibling key still reports its difference: ' + JSON.stringify(copy));
  assert.equal(copy.fromObservations, 8);
  assert.equal(copy.toObservations, 8);
});

// R2/R3: unknown GPU topology blocks GPU rows but not CPU.
await check('R2/R3: unknown adapter topology blocks GPU rows only', async () => {
  const build = luidSet => [0, 1, 2, 3, 4, 5, 6, 7].map(step => {
    const sample = rSample(step, { engines: [{ pid: WE.pid, engineType: '3d', luid: LUID_A, max: 30 + step }], luidSet });
    if (luidSet === null) sample.adapters = [];
    return sample;
  });
  const phases = [
    rPhase('A0', { samples: build(LUID_A), targets: R_TARGETS }),
    rPhase('B', { samples: build(null), targets: R_TARGETS }),
    rPhase('C', { samples: build(LUID_A), targets: [...R_TARGETS, CAP] }),
    rPhase('D', { samples: build(LUID_A), targets: [...R_TARGETS, CAP] }),
    rPhase('A1', { samples: build(LUID_A), targets: R_TARGETS }),
  ];
  const { manifestPath, dir } = await writeCase('r2-topology-unknown-cpu-valid', { phases });
  const result = await comparePhases({ manifestPath: join(dir, 'manifest.json'), outputDir: join(dir, 'out') });
  await mkdir(join(dir, 'out'), { recursive: true });
  await writeFile(join(dir, 'out', 'comparison.json'), JSON.stringify(result, null, 1));
  const b = result.phases.find(phase => phase.id === 'B');
  assert.equal(b.topology.known, false, 'B has an unknown adapter set');
  assert.equal(b.topology.unknownTopologySamples, 8, 'the unknown samples are counted from the samples themselves');
  const pair = pairOf(result, 'A0->B');
  const finding = pair.findings.find(item => item.pid === WE.pid);
  assert.notEqual(finding.cpu.delta, null, 'the CPU difference is independent of the GPU topology');
  assert.equal(finding.gpuEngines.rows.every(row => row.deltaPercent === null), true, 'every GPU row is blocked');
  assert.equal(String(finding.gpuEngines.rows[0].reason).includes('GPU'), true, 'the row reason names the GPU gate: ' + finding.gpuEngines.rows[0].reason);
});

// R3: a cpuReadAt outside the window is caught.
await check('R3: a cpuReadAt outside the measurement window is caught', async () => {
  const build = lateCpu => [0, 1, 2, 3, 4, 5, 6, 7].map(step => {
    const rows = [processRow({ pid: WE.pid, name: 'wallpaper64', cpuSeconds: 100 + step * 5, cpuSecondsDelta: 5, wallClockSecondsDelta: 10, cpuPercent: 5 / 320, workingSetBytes: 100 << 20, privateBytes: 200 << 20 })];
    const sample = buildSample({ index: step, processes: rows });
    if (lateCpu && step === 3) sample.cpuReadAt = ISO(5000);
    return sample;
  });
  const phases = [
    rPhase('A0', { samples: build(false), targets: [WE] }),
    rPhase('B', { samples: build(true), targets: [WE] }),
    rPhase('C', { samples: build(false), targets: [WE, CAP] }),
    rPhase('D', { samples: build(false), targets: [WE, CAP] }),
    rPhase('A1', { samples: build(false), targets: [WE] }),
  ];
  const { manifestPath, dir } = await writeCase('r3-cpu-timestamp-outside', { phases });
  const result = await comparePhases({ manifestPath: join(dir, 'manifest.json'), outputDir: join(dir, 'out') });
  await mkdir(join(dir, 'out'), { recursive: true });
  await writeFile(join(dir, 'out', 'comparison.json'), JSON.stringify(result, null, 1));
  const b = result.phases.find(phase => phase.id === 'B');
  assert.equal(b.timing.windowOk, false, 'a read timestamp outside the window must be recorded');
  assert.ok(b.inconclusiveReasons.some(reason => reason.includes('timestamp')), 'the reason must mention timestamps: ' + JSON.stringify(b.inconclusiveReasons));
  const pair = pairOf(result, 'A0->B');
  assert.equal(pair.findings.find(item => item.pid === WE.pid).cpu.delta, null, 'the CPU row is blocked');
});

// R3: a missing gpuReadFinishedAt is caught rather than filtered away.
await check('R3: a missing gpuReadFinishedAt is counted, not filtered away', async () => {
  const build = dropEnd => [0, 1, 2, 3, 4, 5, 6, 7].map(step => {
    const rows = [processRow({ pid: WE.pid, name: 'wallpaper64', cpuSeconds: 100 + step * 5, cpuSecondsDelta: 5, wallClockSecondsDelta: 10, cpuPercent: 5 / 320, workingSetBytes: 100 << 20, privateBytes: 200 << 20 })];
    const sample = buildSample({ index: step, processes: rows });
    if (dropEnd) delete sample.gpuReadFinishedAt;
    return sample;
  });
  const phases = [
    rPhase('A0', { samples: build(false), targets: [WE] }),
    rPhase('B', { samples: build(true), targets: [WE] }),
    rPhase('C', { samples: build(false), targets: [WE, CAP] }),
    rPhase('D', { samples: build(false), targets: [WE, CAP] }),
    rPhase('A1', { samples: build(false), targets: [WE] }),
  ];
  const { manifestPath, dir } = await writeCase('r3-gpu-end-missing', { phases });
  const result = await comparePhases({ manifestPath: join(dir, 'manifest.json'), outputDir: join(dir, 'out') });
  await mkdir(join(dir, 'out'), { recursive: true });
  await writeFile(join(dir, 'out', 'comparison.json'), JSON.stringify(result, null, 1));
  const b = result.phases.find(phase => phase.id === 'B');
  assert.equal(b.timing.missingTimes.length, 8, 'all eight missing end timestamps are counted');
  assert.equal(b.timing.windowOk, false);
  assert.equal(pairOf(result, 'A0->B').findings.find(item => item.pid === WE.pid).cpu.delta, null);
});

// R3: C and D with unknown frame sizes are not an equal pair.
await check('R3: two unknown capture frame sizes are not a match', async () => {
  const build = [0, 1, 2, 3, 4, 5, 6, 7].map(step => {
    const rows = [processRow({ pid: WE.pid, name: 'wallpaper64', cpuSeconds: 100 + step * 5, cpuSecondsDelta: 5, wallClockSecondsDelta: 10, cpuPercent: 5 / 320, workingSetBytes: 100 << 20, privateBytes: 200 << 20 })];
    return buildSample({ index: step, processes: rows });
  });
  const phases = [
    rPhase('A0', { samples: build, targets: [WE] }),
    rPhase('B', { samples: build, targets: [WE] }),
    rPhase('C', { samples: build, targets: [WE, CAP] }),
    rPhase('D', { samples: build, targets: [WE, CAP] }),
    rPhase('A1', { samples: build, targets: [WE] }),
  ];
  for (const phase of phases) if (phase.id === 'C' || phase.id === 'D') phase.captureFrameSize = null;
  const { manifestPath, dir } = await writeCase('r3-both-sizes-unknown', { phases });
  const result = await comparePhases({ manifestPath: join(dir, 'manifest.json'), outputDir: join(dir, 'out') });
  await mkdir(join(dir, 'out'), { recursive: true });
  await writeFile(join(dir, 'out', 'comparison.json'), JSON.stringify(result, null, 1));
  const pair = pairOf(result, 'C->D');
  assert.equal(pair.gates.passed, false, 'two unknown frame sizes must not pass the gate');
  assert.ok(pair.gates.reasons.some(reason => reason.includes('capture frame size is not measured')), 'the reason names the unknown size: ' + JSON.stringify(pair.gates.reasons));
  assert.equal(pair.findings.every(finding => finding.cpu.delta === null), true, 'no difference without a proven equal frame size');
  // A pair without any capture phase is still fine.
  assert.equal(pairOf(result, 'A0->B').gates.reasons.some(reason => reason.includes('capture frame size')), false);
});

// R4: A, A, B, B, A, A must be three contiguous segments.
await check('R4: a contiguous A-B-A run is three segments, not two groups', async () => {
  const order = [LUID_A, LUID_A, LUID_A + '|' + LUID_B, LUID_A + '|' + LUID_B, LUID_A, LUID_A];
  const samples = order.map((luidSet, step) => {
    const rows = [processRow({ pid: WE.pid, name: 'wallpaper64', cpuSeconds: 100 + step * 5, cpuSecondsDelta: 5, wallClockSecondsDelta: 10, cpuPercent: 5 / 320, workingSetBytes: 100 << 20, privateBytes: 200 << 20 })];
    const sample = buildSample({ index: step, processes: rows, engines: [{ pid: WE.pid, engineType: '3d', luid: LUID_A, max: 10 + step }] });
    sample.adapterLuidSet = luidSet;
    return sample;
  });
  const { manifestPath, dir } = await writeCase('r4-a-b-a-segments', {
    phases: [rPhase('A0', { samples, targets: [WE] }),
      rPhase('B', { samples, targets: [WE] }),
      rPhase('C', { samples, targets: [WE, CAP] }),
      rPhase('D', { samples, targets: [WE, CAP] }),
      rPhase('A1', { samples, targets: [WE] })],
  });
  const result = await comparePhases({ manifestPath: join(dir, 'manifest.json'), outputDir: join(dir, 'out') });
  await mkdir(join(dir, 'out'), { recursive: true });
  await writeFile(join(dir, 'out', 'comparison.json'), JSON.stringify(result, null, 1));
  const a0 = result.phases.find(phase => phase.id === 'A0');
  assert.equal(a0.topology.segments.length, 3, 'three contiguous runs, not two groups: ' + JSON.stringify(a0.topology.segments.map(segment => segment.samples)));
  assert.deepEqual(a0.topology.segments.map(segment => segment.samples), [2, 2, 2], 'the run is A,A,B,B,A,A');
  assert.equal(a0.topology.segments[0].adapterLuidSet, LUID_A);
  assert.equal(a0.topology.segments[1].adapterLuidSet, LUID_A + '|' + LUID_B);
  assert.equal(a0.topology.segments[2].adapterLuidSet, LUID_A);
  assert.equal(a0.topology.changed, true, 'a phase with more than one known run is a changed topology');
  assert.equal(a0.topology.segments[0].startedAt !== a0.topology.segments[2].startedAt, true, 'each run carries its own time bounds');
  assert.equal(a0.topology.segments[0].perPid.length, 1, 'each run carries its own per-PID values');
});

// ---------------------------------------------------------------------------------------------

const failed = results.filter(entry => !entry.ok);
console.log('');
console.log(`compare checks: ${results.length - failed.length}/${results.length} passed`);
console.log(`evidence: ${runRoot}`);
if (failed.length > 0) { console.log(JSON.stringify(failed, null, 1)); process.exitCode = 1; }