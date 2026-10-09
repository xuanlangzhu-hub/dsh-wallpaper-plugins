// Offline phase comparison for the source-performance protocol.
//
// Reads a phase manifest and the sampler reports it names, recomputes per-process numbers from the raw
// samples, and writes a comparison report. It never starts a process, queries a live counter, opens a
// window or touches anything outside the paths it was given: the only inputs are JSON files, and the
// only output is a new directory.
//
// Usage:
//   node qa/perf/compare-phases.mjs --manifest <manifest.json> --output <new-directory>
//
// Exit codes:
//   0  a report was written (dataReady may still be false: see the report's status section)
//   2  the invocation itself was wrong (missing arguments, unreadable manifest)
//   3  the input was rejected: bad JSON, wrong schema, wrong phase order, bad measurement window,
//      a target set that does not match the manifest, or a non-finite/negative CPU interval.
//      Nothing is written in that case; a rejected input must not produce a report that looks finished.
//
// The distinction the report draws, and the CLI keeps, is between "a report was produced" and "the data
// is sufficient to compare". `status.dataReady` and `status.inconclusive` carry the second meaning, and
// no single PASS/FAIL word is used for both.
import { readFile, writeFile, mkdir, stat, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const REQUIRED_PHASE_ORDER = ['A0', 'B', 'C', 'D', 'A1'];
const REQUIRED_ROLES_BASE = ['we', 'dsh-app'];
const REQUIRED_ROLES_CAPTURE = ['we', 'capture', 'dsh-app'];
const KNOWN_ROLES = ['we', 'we-source', 'capture', 'dsh-app', 'dsh-host', 'dsh-client', 'dsh-gpu'];
const CONDITION_FIELDS = [
  'powerState', 'weGlobalSettingsEvidence', 'dshViewport', 'dpi',
  'foregroundEvidence', 'desktopPlaybackEvidence', 'projectSha256', 'wallpaperPropertiesSha256',
];
const MEMORY_METRICS = ['dedicatedBytes', 'sharedBytes', 'nonLocalBytes', 'totalCommittedBytes'];

/** A rejected input. The message names the concrete path and reason. */
class BadInput extends Error {
  constructor(message) { super(message); this.name = 'BadInput'; }
}

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeNumber = value => isFiniteNumber(value) && value >= 0;

/** Reads a JSON file and hashes the bytes that were read, so the report can name its own inputs. */
async function readJson(path, label) {
  let raw;
  try {
    raw = await readFile(path);
  } catch (error) {
    throw new BadInput(`${label}: cannot read ${path} (${error.code || error.message})`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch (error) {
    throw new BadInput(`${label}: ${path} is not valid JSON (${error.message})`);
  }
  return { path, value: parsed, sha256: createHash('sha256').update(raw).digest('hex'), bytes: raw.length };
}

/** Parses an ISO timestamp, rejecting anything that is not a time. */
function parseIso(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new BadInput(`${label}: expected an ISO timestamp string, got ${JSON.stringify(value)}`);
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new BadInput(`${label}: ${JSON.stringify(value)} is not a valid timestamp`);
  return time;
}

/** Rounds for display without introducing float noise into the stored value. */
const round = (value, digits) => (isFiniteNumber(value) ? Number(value.toFixed(digits)) : value);

/** Arithmetic mean over the values that are present; null when nothing is present. */
function mean(values) {
  const present = values.filter(isFiniteNumber);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

// ---------------------------------------------------------------------------------------------
// Manifest validation
// ---------------------------------------------------------------------------------------------

function validateManifest(manifest, manifestPath) {
  const where = `manifest ${manifestPath}`;
  if (!isPlainObject(manifest)) throw new BadInput(`${where}: expected an object`);
  if (manifest.schemaVersion !== 1) throw new BadInput(`${where}: schemaVersion must be 1, got ${JSON.stringify(manifest.schemaVersion)}`);
  if (manifest.state !== 'real' && manifest.state !== 'synthetic') {
    throw new BadInput(`${where}: state must be "real" or "synthetic", got ${JSON.stringify(manifest.state)}. A "template" manifest is not a measurement and is refused.`);
  }
  if (!isPlainObject(manifest.fixedConditions)) throw new BadInput(`${where}: fixedConditions must be an object`);
  if (!isPlainObject(manifest.minimumCoverage)) throw new BadInput(`${where}: minimumCoverage must be an object`);
  for (const key of ['cpuIntervals', 'cpuValidSeconds', 'metricObservations']) {
    if (!isNonNegativeNumber(manifest.minimumCoverage[key])) {
      throw new BadInput(`${where}: minimumCoverage.${key} must be a non-negative number, got ${JSON.stringify(manifest.minimumCoverage[key])}`);
    }
  }
  if (!Array.isArray(manifest.phases) || manifest.phases.length === 0) throw new BadInput(`${where}: phases must be a non-empty array`);

  const ids = manifest.phases.map((phase, index) => {
    if (!isPlainObject(phase)) throw new BadInput(`${where}: phases[${index}] must be an object`);
    return phase.id;
  });
  for (let index = 0; index < REQUIRED_PHASE_ORDER.length; index += 1) {
    if (ids[index] !== REQUIRED_PHASE_ORDER[index]) {
      throw new BadInput(`${where}: phases must be exactly ${REQUIRED_PHASE_ORDER.join(', ')} in that order; position ${index} is ${JSON.stringify(ids[index])}`);
    }
  }
  if (ids.length !== REQUIRED_PHASE_ORDER.length) throw new BadInput(`${where}: expected ${REQUIRED_PHASE_ORDER.length} phases, got ${ids.length}`);

  for (const phase of manifest.phases) {
    const at = `${where}: phase ${phase.id}`;
    if (phase.state !== 'measured') {
      throw new BadInput(`${at}: state must be "measured" for a completed phase, got ${JSON.stringify(phase.state)}. A planned phase is not a measurement.`);
    }
    if (typeof phase.samplerReport !== 'string' || phase.samplerReport.trim() === '') throw new BadInput(`${at}: samplerReport must be a path string`);
    if (!isPlainObject(phase.measurement)) throw new BadInput(`${at}: measurement must be an object`);
    const started = parseIso(phase.measurement.startedAt, `${at}: measurement.startedAt`);
    const ended = parseIso(phase.measurement.endedAt, `${at}: measurement.endedAt`);
    if (ended <= started) throw new BadInput(`${at}: measurement.endedAt must be strictly after startedAt`);
    if (phase.processes !== undefined && !Array.isArray(phase.processes)) throw new BadInput(`${at}: processes must be an array when present`);
    if (phase.unresolvedRoles !== undefined && !Array.isArray(phase.unresolvedRoles)) throw new BadInput(`${at}: unresolvedRoles must be an array when present`);
    for (const [index, process] of (phase.processes || []).entries()) {
      const pAt = `${at}: processes[${index}]`;
      if (!Number.isInteger(process.pid) || process.pid <= 0) throw new BadInput(`${pAt}: pid must be a positive integer, got ${JSON.stringify(process.pid)}`);
      if (typeof process.startTime !== 'string' || process.startTime.trim() === '') throw new BadInput(`${pAt}: startTime must be the start time string the sampler report carries`);
      if (process.path !== null && typeof process.path !== 'string') throw new BadInput(`${pAt}: path must be a string or null`);
      if (!Array.isArray(process.roles) || process.roles.some(role => typeof role !== 'string')) throw new BadInput(`${pAt}: roles must be an array of strings`);
      const unknown = process.roles.filter(role => !KNOWN_ROLES.includes(role));
      if (unknown.length > 0) throw new BadInput(`${pAt}: unknown role(s) ${unknown.join(', ')}; known roles are ${KNOWN_ROLES.join(', ')}`);
      const duplicated = process.roles.filter((role, index2) => process.roles.indexOf(role) !== index2);
      if (duplicated.length > 0) throw new BadInput(`${pAt}: roles contains duplicates ${duplicated.join(', ')}`);
      if (typeof process.evidence !== 'string' || process.evidence.trim() === '') throw new BadInput(`${pAt}: evidence is required (a relative path or a note saying it is manual)`);
    }
  }
  return manifest;
}

// ---------------------------------------------------------------------------------------------
// Per-phase recomputation from raw samples
// ---------------------------------------------------------------------------------------------

/**
 * Recomputes one target's numbers from the raw samples. CPU is rebuilt from the intervals rather than
 * copied from the sampler's summary, because the summary cannot show how many intervals were usable or
 * whether any of them crossed an identity change.
 */
function computeTargetMetrics(report, target) {
  const samples = report.samples || [];
  let cpuDeltaTotal = 0;
  let cpuSecondsTotal = 0;
  let cpuIntervals = 0;
  let cpuIntervalsRejected = 0;
  const workingSet = [];
  const privateBytes = [];
  const cpuPercents = [];
  const identityChanges = [];
  let samplesPresent = 0;
  let samplesWithCpuReading = 0;

  const memoryByAdapter = new Map(); // luid -> { metric -> observations[] }
  const engineByKey = new Map();     // pid|luid|engineType -> { observations[], instanceNames:Set }

  for (const sample of samples) {
    const entry = (sample.processes || []).find(candidate => candidate.pid === target.pid);
    if (!entry || entry.alive === false) continue;
    samplesPresent += 1;
    if (entry.identityChanged) identityChanges.push({ at: sample.readStartedAt ?? null, note: entry.note ?? null });

    // CPU: both deltas must be present, finite and non-negative; the interval must not cross an
    // identity change. Anything else is counted as rejected, never as zero.
    const delta = entry.cpuSecondsDelta;
    const wall = entry.wallClockSecondsDelta;
    if (isFiniteNumber(delta) && isFiniteNumber(wall) && delta >= 0 && wall > 0 && !entry.identityChanged) {
      cpuDeltaTotal += delta;
      cpuSecondsTotal += wall;
      cpuIntervals += 1;
      if (isFiniteNumber(entry.cpuPercentOfLogicalCapacity)) cpuPercents.push(entry.cpuPercentOfLogicalCapacity);
    } else if (delta !== null || wall !== null) {
      cpuIntervalsRejected += 1;
    }
    if (isFiniteNumber(entry.cpuSeconds)) samplesWithCpuReading += 1;
    if (isFiniteNumber(entry.workingSetBytes)) workingSet.push(entry.workingSetBytes);
    if (isFiniteNumber(entry.privateBytes)) privateBytes.push(entry.privateBytes);

    for (const vram of (sample.processVram || [])) {
      if (vram.pid !== target.pid) continue;
      for (const adapter of (vram.adapters || [])) {
        if (typeof adapter.luid !== 'string') continue;
        if (!memoryByAdapter.has(adapter.luid)) {
          memoryByAdapter.set(adapter.luid, { dedicatedBytes: [], sharedBytes: [], nonLocalBytes: [], totalCommittedBytes: [] });
        }
        const bucket = memoryByAdapter.get(adapter.luid);
        for (const metric of MEMORY_METRICS) if (isFiniteNumber(adapter[metric])) bucket[metric].push(adapter[metric]);
      }
    }

    for (const gpu of (sample.processGpu || [])) {
      if (gpu.pid !== target.pid) continue;
      for (const engine of (gpu.engines || [])) {
        const key = `${target.pid}|${engine.luid}|${engine.engineType}`;
        if (!engineByKey.has(key)) {
          engineByKey.set(key, { pid: target.pid, luid: engine.luid, engineType: engine.engineType, observations: [], instanceNames: new Set() });
        }
        const bucket = engineByKey.get(key);
        if (isFiniteNumber(engine.maxUtilizationPercent)) bucket.observations.push(engine.maxUtilizationPercent);
        for (const name of (engine.instanceNames || [])) bucket.instanceNames.add(name);
      }
    }
  }

  const logicalProcessors = report.machine?.logicalProcessors;
  const cpuPercentFromIntervals = cpuSecondsTotal > 0 && isFiniteNumber(logicalProcessors)
    ? 100 * cpuDeltaTotal / (cpuSecondsTotal * logicalProcessors)
    : null;

  return {
    pid: target.pid,
    name: target.name ?? null,
    roles: target.roles,
    startTime: target.startTime,
    samplesPresent,
    samplesWithCpuReading,
    cpu: {
      intervals: cpuIntervals,
      intervalsRejected: cpuIntervalsRejected,
      validSeconds: round(cpuSecondsTotal, 6),
      deltaSeconds: round(cpuDeltaTotal, 6),
      // Percentage points against this machine's logical capacity, recomputed from the intervals.
      percentOfLogicalCapacity: round(cpuPercentFromIntervals, 9),
      percentObservationMean: round(mean(cpuPercents), 9),
      percentObservations: cpuPercents.length,
    },
    workingSetBytes: { observations: workingSet.length, mean: mean(workingSet) === null ? null : Math.round(mean(workingSet)) },
    privateBytes: { observations: privateBytes.length, mean: mean(privateBytes) === null ? null : Math.round(mean(privateBytes)) },
    identityChanges,
    gpuMemoryByAdapter: [...memoryByAdapter.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([luid, bucket]) => ({
      luid,
      metrics: Object.fromEntries(MEMORY_METRICS.map(metric => [metric, {
        observations: bucket[metric].length,
        meanBytes: mean(bucket[metric]) === null ? null : Math.round(mean(bucket[metric])),
      }])),
    })),
    gpuEngines: [...engineByKey.values()].map(bucket => ({
      luid: bucket.luid,
      engineType: bucket.engineType,
      observations: bucket.observations.length,
      observationMeanPercent: round(mean(bucket.observations), 6),
      maxPercent: bucket.observations.length ? round(Math.max(...bucket.observations), 6) : null,
      instanceNames: [...bucket.instanceNames].sort(),
    })).sort((a, b) => `${a.luid}|${a.engineType}`.localeCompare(`${b.luid}|${b.engineType}`)),
  };
}

/** Builds the phase result: identity checks first, then the numbers. */
async function analyzePhase(manifest, phase, manifestDir, report, reportFingerprint) {
  const warnings = [];
  const phaseId = phase.id;
  // Carried on the phase so the pair gates can compare the two machines' capacities.
  const logicalProcessors = report.machine?.logicalProcessors;
  const requiredRoles = phaseId === 'C' || phaseId === 'D' ? REQUIRED_ROLES_CAPTURE : REQUIRED_ROLES_BASE;

  // Duplicate PID inside a phase is rejected: two entries would mean the identity boundary is unclear.
  const seenPids = new Map();
  for (const process of phase.processes || []) {
    if (seenPids.has(process.pid)) {
      throw new BadInput(`manifest: phase ${phaseId}: pid ${process.pid} appears twice; a phase must name each PID once so the identity boundary is unambiguous`);
    }
    seenPids.set(process.pid, process);
  }

  // Evidence is recorded as a path when it looks like one. The tool does not parse native or Host logs
  // in this version; it only checks that a named file exists, and treats a note as a manual claim.
  for (const process of phase.processes || []) {
    const evidence = (process.evidence || '').trim();
    const looksLikePath = /\.(json|jsonl|txt|log|md|png)$/i.test(evidence);
    if (looksLikePath) {
      const evidencePath = resolve(manifestDir, evidence);
      // eslint-disable-next-line no-await-in-loop -- a handful of small existence checks
      const present = await access(evidencePath).then(() => true, () => false);
      process.__evidence = { kind: 'file', path: evidence, present };
      if (!present) warnings.push({ note: `evidence file for pid ${process.pid} is not present: ${evidence}` });
    } else {
      process.__evidence = { kind: 'manual', note: evidence };
    }
  }

  const unresolvedRoles = new Set(phase.unresolvedRoles || []);
  const identityIssues = [];
  const reportTargets = new Map((report.targets || []).map(target => [target.pid, target]));
  const targetsMatched = [];

  for (const process of phase.processes || []) {
    const reportTarget = reportTargets.get(process.pid);
    if (!reportTarget) {
      identityIssues.push({ pid: process.pid, roles: process.roles, reason: 'pid is not present in the sampler report targets' });
      for (const role of process.roles) unresolvedRoles.add(role);
      continue;
    }
    if (reportTarget.startTime !== process.startTime) {
      identityIssues.push({
        pid: process.pid, roles: process.roles,
        reason: `start time differs: manifest ${process.startTime}, report ${reportTarget.startTime}`,
      });
      for (const role of process.roles) unresolvedRoles.add(role);
      continue;
    }
    if (process.path !== null && reportTarget.path !== null && process.path !== reportTarget.path) {
      identityIssues.push({ pid: process.pid, roles: process.roles, reason: `executable path differs: manifest ${process.path}, report ${reportTarget.path}` });
      for (const role of process.roles) unresolvedRoles.add(role);
      continue;
    }
    if (reportTarget.cpuReadable === false) warnings.push({ pid: process.pid, note: 'CPU was not readable for this target; CPU values stay null' });
    targetsMatched.push({ manifest: process, reportTarget });
  }

  const manifestPids = new Set((phase.processes || []).map(process => process.pid));
  const extraReportPids = (report.targets || []).map(target => target.pid).filter(pid => !manifestPids.has(pid));
  // A different target set is legitimate but insufficient rather than broken: the values are kept and
  // the phase is inconclusive, and no identity difference may be computed from it (F3).
  if (extraReportPids.length > 0) {
    warnings.push({ note: `the sampler report covers PIDs that the manifest does not: ${extraReportPids.join(', ')}. They are not assigned roles here, and this phase is not used for identity differences.` });
  }
  const targetSetMatches = extraReportPids.length === 0
    && targetsMatched.length === (phase.processes || []).length
    && (report.targets || []).length === targetsMatched.length;
  if (!targetSetMatches) {
    warnings.push({ note: 'the report target set does not match the manifest exactly; this phase is not used for identity differences' });
  }

  // A role is resolved when a matched process carries it; otherwise it stays unresolved even if the
  // manifest forgot to list it.
  const resolvedRoles = new Set();
  for (const match of targetsMatched) for (const role of match.manifest.roles) resolvedRoles.add(role);
  for (const role of requiredRoles) if (!resolvedRoles.has(role)) unresolvedRoles.add(role);

  const metrics = targetsMatched.map(match => computeTargetMetrics(report, {
    pid: match.manifest.pid,
    name: match.reportTarget.name,
    roles: match.manifest.roles,
    startTime: match.manifest.startTime,
  }));

  // The report's own adapter topology decides whether a whole-phase GPU figure is meaningful. The
  // label in `summary` is not trusted on its own: the samples' own adapterLuidSet values are checked,
  // and the phase is split into segments by that set (F4).
  const declaredSegments = report.adapterTopology?.segments || [];
  const samples = report.samples || [];
  const sampleLuidSets = [];
  for (const sample of samples) {
    const set = typeof sample.adapterLuidSet === 'string' ? sample.adapterLuidSet : null;
    if (!sampleLuidSets.includes(set)) sampleLuidSets.push(set);
  }
  const unknownSampleLuidSets = sampleLuidSets.filter(set => set === null || set === '').length;
  const declaredUnknown = declaredSegments.some(segment => segment.topologyKnown === false)
    || (typeof report.summary?.unknownTopologySamples === 'number' && report.summary.unknownTopologySamples > 0);
  const topologyKnown = declaredSegments.length > 0 && !declaredUnknown && unknownSampleLuidSets === 0;
  // A run of consecutive samples with the same adapter set is one segment. Grouping by set alone would
  // merge two separate A stretches into one and lose when they happened (R4).
  const runSegments = [];
  for (const sample of samples) {
    const rawSet = typeof sample.adapterLuidSet === 'string' && sample.adapterLuidSet !== '' ? sample.adapterLuidSet : null;
    const previous = runSegments[runSegments.length - 1];
    // An unknown set is its own run every time: it cannot be assumed to continue a known run, and a
    // later known run must start a new segment even if its set matches an earlier one.
    const continues = previous && rawSet !== null && previous.adapterLuidSet === rawSet;
    if (continues) {
      previous.samples.push(sample);
    } else {
      runSegments.push({ adapterLuidSet: rawSet, topologyKnown: rawSet !== null, samples: [sample] });
    }
  }
  const topologyChangedBySamples = runSegments.filter(segment => segment.topologyKnown).length > 1;
  const topologyChanged = report.adapterTopology?.changed === true || topologyChangedBySamples;
  // The unknown-sample count is taken from the samples that were actually read, not from the report's
  // own summary label.
  const unknownTopologySamples = runSegments
    .filter(segment => !segment.topologyKnown)
    .reduce((sum, segment) => sum + segment.samples.length, 0);
  const gpuPhaseComparable = topologyKnown && !topologyChanged;

  // Per-segment values, one entry per contiguous run: when the adapter set is not single and known the
  // whole-phase GPU mean would mix segments, so each run reports its own values and time bounds.
  const segmentGroups = [];
  {
    for (const run of runSegments) {
      const group = run.samples;
      const perPid = [];
      for (const metric of metrics) {
        const perTarget = { pid: metric.pid, gpuEngines: [], gpuMemoryByAdapter: [] };
        const engineByKey = new Map();
        const memoryByKey = new Map();
        for (const sample of group) {
          for (const gpu of (sample.processGpu || [])) {
            if (gpu.pid !== metric.pid) continue;
            for (const engine of (gpu.engines || [])) {
              const key = `${engine.luid}|${engine.engineType}`;
              if (!engineByKey.has(key)) engineByKey.set(key, { luid: engine.luid, engineType: engine.engineType, observations: [] });
              if (isFiniteNumber(engine.maxUtilizationPercent)) engineByKey.get(key).observations.push(engine.maxUtilizationPercent);
            }
          }
          for (const vram of (sample.processVram || [])) {
            if (vram.pid !== metric.pid) continue;
            for (const adapter of (vram.adapters || [])) {
              if (typeof adapter.luid !== 'string') continue;
              const key = `${adapter.luid}`;
              if (!memoryByKey.has(key)) memoryByKey.set(key, { luid: adapter.luid, metrics: Object.fromEntries(MEMORY_METRICS.map(name => [name, []])) });
              for (const name of MEMORY_METRICS) if (isFiniteNumber(adapter[name])) memoryByKey.get(key).metrics[name].push(adapter[name]);
            }
          }
        }
        perTarget.gpuEngines = [...engineByKey.values()].map(bucket => ({
          luid: bucket.luid, engineType: bucket.engineType, observations: bucket.observations.length,
          observationMeanPercent: round(mean(bucket.observations), 6),
          maxPercent: bucket.observations.length ? round(Math.max(...bucket.observations), 6) : null,
        }));
        perTarget.gpuMemoryByAdapter = [...memoryByKey.values()].map(bucket => ({
          luid: bucket.luid,
          metrics: Object.fromEntries(MEMORY_METRICS.map(name => [name, {
            observations: bucket.metrics[name].length,
            meanBytes: mean(bucket.metrics[name]) === null ? null : Math.round(mean(bucket.metrics[name])),
          }])),
        }));
        perPid.push(perTarget);
      }
      segmentGroups.push({
        adapterLuidSet: run.adapterLuidSet,
        topologyKnown: run.topologyKnown,
        samples: group.length,
        startedAt: group[0]?.readStartedAt ?? null,
        endedAt: group[group.length - 1]?.gpuReadFinishedAt ?? group[group.length - 1]?.readStartedAt ?? null,
        perPid,
      });
    }
  }

  // Every read timestamp the phase records is checked, not only the two that were checked before: a
  // missing or out-of-window cpuReadAt/gpuReadAt is a boundary problem just as much as the start (R3).
  const startedAt = Date.parse(phase.measurement.startedAt);
  const endedAt = Date.parse(phase.measurement.endedAt);
  const timeFields = ['readStartedAt', 'cpuReadAt', 'gpuReadAt', 'gpuReadFinishedAt'];
  const missingTimes = [];
  const outsideTimes = [];
  const unorderedTimes = [];
  for (const [index, sample] of (report.samples || []).entries()) {
    const parsed = {};
    for (const field of timeFields) {
      const value = sample[field];
      if (value === undefined || value === null) { missingTimes.push({ index, field }); continue; }
      const time = Date.parse(value);
      if (!Number.isFinite(time)) { missingTimes.push({ index, field }); continue; }
      parsed[field] = time;
      if (time < startedAt || time > endedAt) outsideTimes.push({ index, field });
    }
    // The reads within a sample are sequential: start <= cpu <= gpu <= gpu end.
    const order = ['readStartedAt', 'cpuReadAt', 'gpuReadAt', 'gpuReadFinishedAt']
      .map(field => ({ field, time: parsed[field] }))
      .filter(entry => entry.time !== undefined);
    for (let position = 1; position < order.length; position += 1) {
      if (order[position].time < order[position - 1].time) unorderedTimes.push({ index, field: order[position].field });
    }
  }
  const outsideWindow = outsideTimes.length + missingTimes.length + unorderedTimes.length;

  // Coverage is evaluated per PID and per metric. The phase totals stay as information, but a sum over
  // several processes must never let one sparse process pass the minimum (F2).
  //
  // A metric the phase never observed at all is "not measured here", which is different from "measured
  // too little": it is absent, not sparse. Only a metric that appears somewhere in this phase with fewer
  // than the minimum observations for a PID is reported as below the minimum, and only that PID/metric
  // is blocked from a difference.
  const minimum = manifest.minimumCoverage;
  const perProcessCoverage = metrics.map(metric => {
    const cpuAppears = metric.cpu.intervals > 0 || metric.cpu.intervalsRejected > 0;
    const workingSetAppears = metric.workingSetBytes.observations > 0;
    const privateAppears = metric.privateBytes.observations > 0;
    // GPU memory and engines are evaluated per LUID/metric and per LUID/engineType: one sparse key must
    // not mark the family unusable while other keys have enough observations (R2).
    const memoryRows = [];
    for (const adapter of metric.gpuMemoryByAdapter) {
      for (const name of MEMORY_METRICS) {
        const observations = adapter.metrics[name].observations;
        memoryRows.push({ luid: adapter.luid, metric: name, observations, appears: observations > 0, met: observations >= minimum.metricObservations });
      }
    }
    const engineRows = metric.gpuEngines.map(engine => ({
      luid: engine.luid, engineType: engine.engineType, observations: engine.observations,
      appears: engine.observations > 0, met: engine.observations >= minimum.metricObservations,
    }));
    const memoryAppears = memoryRows.some(row => row.appears);
    const engineAppears = engineRows.some(row => row.appears);
    const memoryOk = memoryAppears && memoryRows.every(row => !row.appears || row.met);
    const engineOk = engineAppears && engineRows.every(row => !row.appears || row.met);

    const cpuOk = metric.cpu.intervals >= minimum.cpuIntervals && metric.cpu.validSeconds >= minimum.cpuValidSeconds;
    const workingSetOk = metric.workingSetBytes.observations >= minimum.metricObservations;
    const privateOk = metric.privateBytes.observations >= minimum.metricObservations;

    return {
      pid: metric.pid,
      cpu: { intervals: metric.cpu.intervals, validSeconds: metric.cpu.validSeconds, appears: cpuAppears, met: cpuOk },
      workingSetBytes: { observations: metric.workingSetBytes.observations, appears: workingSetAppears, met: workingSetOk },
      privateBytes: { observations: metric.privateBytes.observations, appears: privateAppears, met: privateOk },
      gpuMemory: { adapters: metric.gpuMemoryByAdapter.length, rows: memoryRows, appears: memoryAppears, met: memoryOk },
      gpuEngine: { keys: metric.gpuEngines.length, rows: engineRows, appears: engineAppears, met: engineOk },
      // "Complete" means every metric this phase observed for this PID reached the minimum.
      allMet: (!cpuAppears || cpuOk) && (!workingSetAppears || workingSetOk) && (!privateAppears || privateOk)
        && (!memoryAppears || memoryOk) && (!engineAppears || engineOk),
    };
  });
  // Per-family availability, kept apart so a missing optional GPU does not erase a valid CPU (R1/R2).
  const perFamilyObserved = {
    cpu: perProcessCoverage.some(entry => entry.cpu.appears),
    memory: perProcessCoverage.some(entry => entry.workingSetBytes.appears || entry.privateBytes.appears),
    gpu: perProcessCoverage.some(entry => entry.gpuMemory.appears || entry.gpuEngine.appears),
  };
  const noUsableObservation = !perFamilyObserved.cpu && !perFamilyObserved.memory && !perFamilyObserved.gpu;
  const coverage = {
    // Phase totals: information only, never the gate for a single process.
    cpuIntervals: metrics.reduce((sum, metric) => sum + metric.cpu.intervals, 0),
    cpuValidSeconds: round(metrics.reduce((sum, metric) => sum + metric.cpu.validSeconds, 0), 6),
    metricObservations: metrics.reduce((sum, metric) => sum + metric.workingSetBytes.observations, 0),
    perProcess: perProcessCoverage,
    processesMeetingEveryMetric: perProcessCoverage.filter(entry => entry.allMet).length,
  };
  // The phase-level flags answer "did every process carry enough of its own data for the metrics this
  // phase actually observed", not "is the sum large".
  const anyProcessCovered = perProcessCoverage.length > 0 && perProcessCoverage.some(entry => entry.allMet);
  const coverageMet = {
    cpuIntervals: perProcessCoverage.length > 0 && perProcessCoverage.every(entry => !entry.cpu.appears || entry.cpu.met),
    cpuValidSeconds: perProcessCoverage.length > 0 && perProcessCoverage.every(entry => !entry.cpu.appears || entry.cpu.met),
    metricObservations: perProcessCoverage.length > 0 && perProcessCoverage.every(entry => !entry.workingSetBytes.appears || entry.workingSetBytes.met),
    gpuMemoryKeys: perProcessCoverage.length > 0 && perProcessCoverage.every(entry => entry.gpuMemory.met),
    gpuEngineKeys: perProcessCoverage.length > 0 && perProcessCoverage.every(entry => entry.gpuEngine.met),
    anyProcessCovered,
  };

  // Identity: a required role that is unresolved, or a PID whose identity did not match, makes the
  // phase's numbers describe an uncertain target set.
  const requiredRolesUnresolved = requiredRoles.filter(role => unresolvedRoles.has(role));
  const identityStable = identityIssues.length === 0
    && metrics.every(metric => metric.identityChanges.length === 0)
    && report.summary?.identityStable !== false;
  const identityConclusive = identityStable && requiredRolesUnresolved.length === 0;

  const conditions = isPlainObject(phase.conditions) ? phase.conditions : null;
  const missingConditions = conditions === null
    ? CONDITION_FIELDS.slice()
    : CONDITION_FIELDS.filter(field => conditions[field] === null || conditions[field] === undefined);

  const reasons = [];
  if (requiredRolesUnresolved.length > 0) reasons.push(`required role(s) unresolved: ${requiredRolesUnresolved.join(', ')}`);
  if (identityIssues.length > 0) reasons.push(`${identityIssues.length} target identit(ies) did not match the report`);
  if (!identityStable) reasons.push('an identity change was recorded during the phase');
  for (const entry of perProcessCoverage) {
    if (entry.cpu.appears && !entry.cpu.met) reasons.push(`pid ${entry.pid}: CPU coverage ${entry.cpu.intervals} interval(s) / ${entry.cpu.validSeconds}s is below ${minimum.cpuIntervals} / ${minimum.cpuValidSeconds}s`);
    if (entry.workingSetBytes.appears && !entry.workingSetBytes.met) reasons.push(`pid ${entry.pid}: working-set observations ${entry.workingSetBytes.observations} < ${minimum.metricObservations}`);
    if (entry.privateBytes.appears && !entry.privateBytes.met) reasons.push(`pid ${entry.pid}: private-byte observations ${entry.privateBytes.observations} < ${minimum.metricObservations}`);
    for (const row of entry.gpuMemory.rows) {
      if (row.appears && !row.met) reasons.push(`pid ${entry.pid}: GPU memory ${row.metric}@${row.luid} has ${row.observations} observation(s), below ${minimum.metricObservations}`);
    }
    for (const row of entry.gpuEngine.rows) {
      if (row.appears && !row.met) reasons.push(`pid ${entry.pid}: GPU engine ${row.engineType}@${row.luid} has ${row.observations} observation(s), below ${minimum.metricObservations}`);
    }
  }
  // A required role that is present but produced no readable value at all is legitimate input that is
  // insufficient: the values stay null and the phase is inconclusive with a specific reason (R1).
  if (noUsableObservation) reasons.push('no usable observation for any target: CPU, memory and GPU readings are all empty');
  if (!perFamilyObserved.cpu) reasons.push('CPU has no observation in this phase; its values are unavailable rather than zero');
  if (!perFamilyObserved.memory) reasons.push('memory has no observation in this phase; its values are unavailable rather than zero');
  // GPU is only called out when the phase's own samples do report engine or memory entries: a phase that
  // never records them (A/B by design) has nothing to be inconclusive about (R1).
  const phaseReportsGpuEntries = samples.some(sample =>
    (sample.processGpu || []).some(gpu => (gpu.engines || []).length > 0)
    || (sample.processVram || []).some(vram => (vram.adapters || []).length > 0));
  if (phaseReportsGpuEntries && !perFamilyObserved.gpu) reasons.push('GPU readings are present but carry no usable observation in this phase');
  if (!targetSetMatches) reasons.push('the report target set does not match the manifest');
  if (outsideWindow > 0) reasons.push(`${outsideWindow} read timestamp(s) are missing, out of order, or outside the declared measurement window`);
  if (missingConditions.length > 0) reasons.push(`conditions not evidenced: ${missingConditions.join(', ')}`);

  return {
    id: phaseId,
    state: phase.state,
    measurement: { startedAt: phase.measurement.startedAt, endedAt: phase.measurement.endedAt },
    conditions,
    conditionsMissing: missingConditions,
    logicalProcessors,
    requiredRoles,
    resolvedRoles: [...resolvedRoles].sort(),
    unresolvedRoles: [...unresolvedRoles].sort(),
    requiredRolesUnresolved,
    processes: metrics,
    identity: { stable: identityStable, conclusive: identityConclusive, issues: identityIssues },
    targetSetMatches,
    coverage,
    coverageMet,
    topology: {
      known: topologyKnown,
      changed: topologyChanged,
      unknownTopologySamples,
      declaredSegments: declaredSegments.map(segment => ({ adapterLuidSet: segment.adapterLuidSet ?? null, topologyKnown: segment.topologyKnown !== false, samples: segment.samples ?? null })),
      // Recomputed from the samples themselves; these carry the per-segment values.
      sampleLuidSets,
      segments: segmentGroups,
      gpuPhaseComparable,
    },
    sourceWindow: phase.sourceWindow ?? null,
    captureFrameSize: phase.captureFrameSize ?? null,
    motion: phase.motion ?? null,
    timing: { missingTimes, outsideTimes, unorderedTimes, windowOk: outsideWindow === 0 },
    reportFingerprint,
    reportPhaseMismatch: report.phase !== undefined && report.phase !== phaseId ? report.phase : null,
    warnings,
    conclusions: {
      // Every phase number is shown regardless; these flags say whether it may be compared. Each metric
      // is decided on its own evidence: a sparse engine reading cannot pass on CPU coverage.
      targetSetMatches,
      perFamilyObserved,
      noUsableObservation,
      // These are "this phase produced usable values at all" flags. Whether a specific PID may be
      // differenced is decided per PID and per metric in comparePair, so one sparse process does not
      // suppress a well-covered one (F2). Each family is decided on its own availability, so a missing
      // GPU reading never removes a valid CPU difference (R1/R2).
      cpuCoveragePresent: identityConclusive && targetSetMatches && outsideWindow === 0 && !noUsableObservation && perFamilyObserved.cpu,
      cpuComparable: identityConclusive && targetSetMatches && coverageMet.cpuIntervals && outsideWindow === 0
        && perProcessCoverage.every(entry => !entry.cpu.appears || entry.cpu.met),
      memoryCoveragePresent: identityConclusive && targetSetMatches && outsideWindow === 0 && !noUsableObservation && perFamilyObserved.memory,
      memoryComparable: identityConclusive && targetSetMatches && outsideWindow === 0
        && perProcessCoverage.every(entry => (!entry.workingSetBytes.appears || entry.workingSetBytes.met) && (!entry.privateBytes.appears || entry.privateBytes.met)),
      // GPU needs its own topology gate, kept apart from the pair's shared gates: unknown or changed
      // adapter sets block GPU rows only, never CPU or RAM (R2).
      gpuTopologyOk: topologyKnown && !topologyChanged,
      gpuCoveragePresent: identityConclusive && targetSetMatches && outsideWindow === 0 && !noUsableObservation && topologyKnown && !topologyChanged
        && (perFamilyObserved.gpu || !phaseReportsGpuEntries),
      gpuComparable: identityConclusive && targetSetMatches && outsideWindow === 0 && topologyKnown && !topologyChanged,
    },
    inconclusiveReasons: reasons,
  };
}

// ---------------------------------------------------------------------------------------------
// Cross-phase comparison
// ---------------------------------------------------------------------------------------------

/**
 * Run-condition gates for one pair of phases. These are checked before any metric: two phases that were
 * not run under the same conditions, on the same logical capacity, or with the same capture frame size
 * may still be reported side by side, but no difference may be computed from them (F1).
 */
function pairGates(from, to, manifest) {
  const gates = [];
  if (!from.identity.conclusive) gates.push(`${from.id}: identity is not conclusive`);
  if (!to.identity.conclusive) gates.push(`${to.id}: identity is not conclusive`);
  // A phase whose report target set does not match its manifest cannot support an identity difference,
  // even when the roles themselves happen to be covered (F3).
  if (!from.conclusions.targetSetMatches) gates.push(`${from.id}: the report target set does not match the manifest`);
  if (!to.conclusions.targetSetMatches) gates.push(`${to.id}: the report target set does not match the manifest`);

  const capacityFrom = from.logicalProcessors;
  const capacityTo = to.logicalProcessors;
  if (!isFiniteNumber(capacityFrom) || !isFiniteNumber(capacityTo)) {
    gates.push('logical processor capacity is unknown in one of the phases');
  } else if (capacityFrom !== capacityTo) {
    gates.push(`logical processor capacity differs (${capacityFrom} vs ${capacityTo}), so CPU percentages are not on the same basis`);
  }

  // Frame size is a capture-phase property. Between the two capture phases both sides must have measured
  // a stable size and the sizes must match: two nulls are not an equal size, they are an unproven work
  // equivalence (R3). A pair without a capture phase has nothing to check.
  const bothCapturePhases = ['C', 'D'].includes(from.id) && ['C', 'D'].includes(to.id);
  const sizeFrom = from.captureFrameSize;
  const sizeTo = to.captureFrameSize;
  if (bothCapturePhases) {
    if (!sizeFrom || !sizeTo) {
      gates.push(`capture frame size is not measured in both capture phases (${from.id}: ${sizeFrom ? `${sizeFrom.width}x${sizeFrom.height}` : 'unknown'}, ${to.id}: ${sizeTo ? `${sizeTo.width}x${sizeTo.height}` : 'unknown'}), so the same work is not established`);
    } else if (sizeFrom.width !== sizeTo.width || sizeFrom.height !== sizeTo.height) {
      gates.push(`capture frame size differs (${sizeFrom.width}x${sizeFrom.height} vs ${sizeTo.width}x${sizeTo.height}), so the work is not the same`);
    }
  } else if (sizeFrom && sizeTo && (sizeFrom.width !== sizeTo.width || sizeFrom.height !== sizeTo.height)) {
    gates.push(`capture frame size differs (${sizeFrom.width}x${sizeFrom.height} vs ${sizeTo.width}x${sizeTo.height}), so the work is not the same`);
  }

  // Conditions must match each other and the manifest's fixed conditions. A phase that silently drifted
  // from the fixed value is not comparable even if all phases drifted together.
  for (const field of CONDITION_FIELDS) {
    const valueFrom = from.conditions ? (from.conditions[field] ?? null) : null;
    const valueTo = to.conditions ? (to.conditions[field] ?? null) : null;
    if (valueFrom === null || valueTo === null) { gates.push(`${field} is not evidenced in both phases`); continue; }
    if (JSON.stringify(valueFrom) !== JSON.stringify(valueTo)) { gates.push(`${field} differs between the phases`); continue; }
    const fixed = manifest.fixedConditions ? (manifest.fixedConditions[field] ?? null) : null;
    if (fixed !== null && JSON.stringify(fixed) !== JSON.stringify(valueFrom)) {
      gates.push(`${field} does not match the manifest's fixed condition`);
    }
  }

  // The adapter set is a GPU-only gate: a phase that ran on one adapter set and a phase that ran on
  // another cannot yield a whole-phase GPU figure, but their CPU and RAM readings stay comparable (R2).
  const luidSetFrom = [...(from.topology.sampleLuidSets || [])].filter(value => value !== null).sort().join('|');
  const luidSetTo = [...(to.topology.sampleLuidSets || [])].filter(value => value !== null).sort().join('|');
  const adapterSetsMatch = luidSetFrom !== '' && luidSetTo !== '' && luidSetFrom === luidSetTo;
  const gpuTopologyReasons = [];
  if (!adapterSetsMatch) {
    gpuTopologyReasons.push(`the adapter sets differ (${from.id}: ${luidSetFrom || 'unknown'} vs ${to.id}: ${luidSetTo || 'unknown'})`);
  }
  if (!from.conclusions.gpuTopologyOk) gpuTopologyReasons.push(`${from.id}: adapter topology is unknown or changed within the phase`);
  if (!to.conclusions.gpuTopologyOk) gpuTopologyReasons.push(`${to.id}: adapter topology is unknown or changed within the phase`);

  return {
    passed: gates.length === 0,
    reasons: gates,
    gpuTopology: { reasons: gpuTopologyReasons, passed: gpuTopologyReasons.length === 0 },
    adapterSets: { from: luidSetFrom || null, to: luidSetTo || null, equal: adapterSetsMatch },
    logicalCapacity: { from: capacityFrom ?? null, to: capacityTo ?? null, equal: isFiniteNumber(capacityFrom) && capacityFrom === capacityTo },
    captureFrameSize: {
      from: sizeFrom ?? null,
      to: sizeTo ?? null,
      // Both absent is a match (neither phase measured a frame); one absent is not a match.
      equal: (sizeFrom === null && sizeTo === null)
        || Boolean(sizeFrom && sizeTo && sizeFrom.width === sizeTo.width && sizeFrom.height === sizeTo.height),
    },
  };
}

function comparePair(from, to, labels, manifest) {
  const gates = pairGates(from, to, manifest);
  // Per-metric pairing gates: the run conditions are a pair-level matter, while each metric also needs
  // both phases to have concluded that this metric is usable there. A window overrun or a sparse PID
  // disqualifies its own metric without touching the others, and the reason names the phase and its own
  // first blocking reason rather than a bare flag.
  const metricReasonFor = (family, flagFrom, flagTo) => {
    if (flagFrom && flagTo) return null;
    const blocked = !flagFrom ? from : to;
    const first = (blocked.inconclusiveReasons || [])[0] || 'the phase is not comparable for this metric';
    return `${blocked.id} is not comparable for ${family}: ${first}`;
  };
  const metricGates = {
    cpu: metricReasonFor('CPU', from.conclusions.cpuCoveragePresent, to.conclusions.cpuCoveragePresent),
    memory: metricReasonFor('memory', from.conclusions.memoryCoveragePresent, to.conclusions.memoryCoveragePresent),
    // GPU keeps its own topology gate; a pair-level failure there blocks GPU rows only (R2).
    gpu: metricReasonFor('GPU', from.conclusions.gpuCoveragePresent, to.conclusions.gpuCoveragePresent)
      || (gates.gpuTopology.passed ? null : `${gates.gpuTopology.reasons[0]}, so no whole-phase GPU figure may be compared`),
  };
  const findings = [];
  const byPidFrom = new Map(from.processes.map(process => [process.pid, process]));
  const byPidTo = new Map(to.processes.map(process => [process.pid, process]));
  const coverageFrom = new Map((from.coverage.perProcess || []).map(entry => [entry.pid, entry]));
  const coverageTo = new Map((to.coverage.perProcess || []).map(entry => [entry.pid, entry]));

  const sharedPids = [...byPidFrom.keys()].filter(pid => byPidTo.has(pid));
  const onlyFrom = [...byPidFrom.keys()].filter(pid => !byPidTo.has(pid));
  const onlyTo = [...byPidTo.keys()].filter(pid => !byPidFrom.has(pid));

  // The same PID with a different start time is a different process; it is reported, not differenced.
  const identityMismatch = sharedPids.filter(pid => byPidFrom.get(pid).startTime !== byPidTo.get(pid).startTime);
  const comparablePids = sharedPids.filter(pid => !identityMismatch.includes(pid));

  for (const pid of comparablePids) {
    const a = byPidFrom.get(pid);
    const b = byPidTo.get(pid);
    const roles = [...new Set([...a.roles, ...b.roles])].sort();
    const coverA = coverageFrom.get(pid);
    const coverB = coverageTo.get(pid);

    // Each metric is gated on its own evidence: the pair's run conditions, this PID's coverage for this
    // metric in both phases, and a non-null value on both sides.
    const gateFor = (family, metricOk, valueOk, why) => {
      if (!gates.passed) return `run conditions are not comparable: ${gates.reasons[0]}`;
      if (metricGates[family]) return metricGates[family];
      if (!metricOk) return why;
      if (!valueOk) return 'the value is missing in one of the phases';
      return null;
    };
    const cpuReason = gateFor('cpu',
      Boolean(coverA && coverB && coverA.cpu.met && coverB.cpu.met),
      a.cpu.percentOfLogicalCapacity !== null && b.cpu.percentOfLogicalCapacity !== null,
      `CPU coverage for pid ${pid} is below the minimum in one of the phases`,
    );
    const workingSetReason = gateFor('memory',
      Boolean(coverA && coverB && coverA.workingSetBytes.met && coverB.workingSetBytes.met),
      a.workingSetBytes.mean !== null && b.workingSetBytes.mean !== null,
      `working-set observations for pid ${pid} are below the minimum in one of the phases`,
    );
    const privateReason = gateFor('memory',
      Boolean(coverA && coverB && coverA.privateBytes.met && coverB.privateBytes.met),
      a.privateBytes.mean !== null && b.privateBytes.mean !== null,
      `private-byte observations for pid ${pid} are below the minimum in one of the phases`,
    );
    const gpuTopologyOk = from.conclusions.gpuComparable && to.conclusions.gpuComparable;
    // GPU rows are decided per LUID/metric and per LUID/engineType: one sparse or missing key leaves its
    // own row null while the other keys still produce their differences (R2).
    const gpuFamilyGate = !gates.passed
      ? `run conditions are not comparable: ${gates.reasons[0]}`
      : (metricGates.gpu || (gpuTopologyOk ? null : 'GPU topology is insufficient'));

    findings.push({
      pid,
      roles,
      identity: 'same pid and start time',
      cpu: cpuReason === null ? {
        unit: 'percentage points of logical capacity',
        from: a.cpu.percentOfLogicalCapacity,
        to: b.cpu.percentOfLogicalCapacity,
        delta: round(b.cpu.percentOfLogicalCapacity - a.cpu.percentOfLogicalCapacity, 9),
        fromCoverage: { intervals: a.cpu.intervals, validSeconds: a.cpu.validSeconds },
        toCoverage: { intervals: b.cpu.intervals, validSeconds: b.cpu.validSeconds },
      } : { delta: null, reason: cpuReason },
      workingSetBytes: workingSetReason === null ? {
        unit: 'bytes (working set, arithmetic mean of valid observations)',
        from: a.workingSetBytes.mean, to: b.workingSetBytes.mean,
        delta: b.workingSetBytes.mean - a.workingSetBytes.mean,
        fromObservations: a.workingSetBytes.observations, toObservations: b.workingSetBytes.observations,
      } : { delta: null, reason: workingSetReason },
      privateBytes: privateReason === null ? {
        unit: 'bytes (private bytes, arithmetic mean of valid observations)',
        from: a.privateBytes.mean, to: b.privateBytes.mean,
        delta: b.privateBytes.mean - a.privateBytes.mean,
        fromObservations: a.privateBytes.observations, toObservations: b.privateBytes.observations,
      } : { delta: null, reason: privateReason },
      gpuMemory: mergeMemoryDeltas(a.gpuMemoryByAdapter, b.gpuMemoryByAdapter, {
        familyGate: gpuFamilyGate,
        coverageA: coverA ? coverA.gpuMemory.rows : [],
        coverageB: coverB ? coverB.gpuMemory.rows : [],
        observationsRequired: manifest.minimumCoverage.metricObservations,
      }),
      gpuEngines: mergeEngineDeltas(a.gpuEngines, b.gpuEngines, {
        familyGate: gpuFamilyGate,
        coverageA: coverA ? coverA.gpuEngine.rows : [],
        coverageB: coverB ? coverB.gpuEngine.rows : [],
        observationsRequired: manifest.minimumCoverage.metricObservations,
      }),
    });
  }

  return {
    pair: `${from.id}->${to.id}`,
    labels,
    gates,
    sharedPids: comparablePids,
    onlyInFrom: onlyFrom,
    onlyInTo: onlyTo,
    identityMismatch: identityMismatch.map(pid => ({
      pid, fromStart: byPidFrom.get(pid).startTime, toStart: byPidTo.get(pid).startTime,
      reason: 'same pid, different start time: a different process, so no difference is computed',
    })),
    // A process that exists in only one phase is reported as such; inventing a zero for the other side
    // would turn "not present" into "used nothing".
    newProcesses: onlyTo.length > 0 ? onlyTo : [],
    disappearedProcesses: onlyFrom.length > 0 ? onlyFrom : [],
    findings,
  };
}

/**
 * Per LUID and per metric, the from/to means and their difference; never summed across adapters (F4).
 * Each row decides for itself: one metric that is missing or sparse leaves its own row null with its own
 * reason while the other metrics on the same adapter still produce a difference (R2).
 */
function mergeMemoryDeltas(fromAdapters, toAdapters, options = {}) {
  const { familyGate = null, coverageA = [], coverageB = [], observationsRequired = 0 } = options;
  const keys = new Set([...fromAdapters.map(adapter => adapter.luid), ...toAdapters.map(adapter => adapter.luid)]);
  for (const row of [...coverageA, ...coverageB]) keys.add(row.luid);
  const rows = [];
  for (const luid of [...keys].sort()) {
    const a = fromAdapters.find(adapter => adapter.luid === luid) || null;
    const b = toAdapters.find(adapter => adapter.luid === luid) || null;
    for (const metric of MEMORY_METRICS) {
      const aMetric = a ? a.metrics[metric] : null;
      const bMetric = b ? b.metrics[metric] : null;
      const coverRowA = coverageA.find(row => row.luid === luid && row.metric === metric) || null;
      const coverRowB = coverageB.find(row => row.luid === luid && row.metric === metric) || null;
      const fromMean = aMetric ? aMetric.meanBytes : null;
      const toMean = bMetric ? bMetric.meanBytes : null;
      let reason = null;
      if (familyGate) reason = familyGate;
      else if ((aMetric ? aMetric.observations : 0) < observationsRequired || (bMetric ? bMetric.observations : 0) < observationsRequired) reason = `the ${metric} reading has fewer than ${observationsRequired} observations on one side`;
      else if (coverRowA && !coverRowA.met) reason = `${'from'} phase has ${coverRowA.observations} observation(s) for ${metric}, below ${observationsRequired}`;
      else if (coverRowB && !coverRowB.met) reason = `${'to'} phase has ${coverRowB.observations} observation(s) for ${metric}, below ${observationsRequired}`;
      else if (fromMean === null || toMean === null) reason = `the ${metric} value is missing in one of the phases`;
      rows.push({
        luid, metric,
        unit: 'bytes (arithmetic mean of valid observations, per adapter and metric)',
        fromMeanBytes: fromMean,
        toMeanBytes: toMean,
        deltaBytes: reason === null ? toMean - fromMean : null,
        reason,
        fromObservations: coverRowA ? coverRowA.observations : (aMetric ? aMetric.observations : 0),
        toObservations: coverRowB ? coverRowB.observations : (bMetric ? bMetric.observations : 0),
      });
    }
  }
  const computed = rows.filter(row => row.deltaBytes !== null).length;
  return {
    rows,
    delta: null,
    unit: 'per adapter LUID and metric; the four metrics are not added together',
    computedRows: computed,
    blockedRows: rows.length - computed,
  };
}

/**
 * Per engine key, the from/to observation means and their difference; never summed across engines.
 * As with memory, each key decides for itself so a sparse 3D reading does not remove a valid Copy
 * difference (R2).
 */
function mergeEngineDeltas(fromEngines, toEngines, options = {}) {
  const { familyGate = null, coverageA = [], coverageB = [], observationsRequired = 0 } = options;
  const keys = new Set([...fromEngines.map(e => `${e.luid}|${e.engineType}`), ...toEngines.map(e => `${e.luid}|${e.engineType}`)]);
  for (const row of [...coverageA, ...coverageB]) keys.add(`${row.luid}|${row.engineType}`);
  const rows = [];
  for (const key of [...keys].sort()) {
    const a = fromEngines.find(engine => `${engine.luid}|${engine.engineType}` === key) || null;
    const b = toEngines.find(engine => `${engine.luid}|${engine.engineType}` === key) || null;
    const [luid, engineType] = key.split('|');
    const coverRowA = coverageA.find(row => row.luid === luid && row.engineType === engineType) || null;
    const coverRowB = coverageB.find(row => row.luid === luid && row.engineType === engineType) || null;
    const fromMean = a ? a.observationMeanPercent : null;
    const toMean = b ? b.observationMeanPercent : null;
    let reason = null;
    if (familyGate) reason = familyGate;
    else if ((a ? a.observations : 0) < observationsRequired || (b ? b.observations : 0) < observationsRequired) reason = `the ${engineType} reading has fewer than ${observationsRequired} observations on one side`;
    else if (coverRowA && !coverRowA.met) reason = `from phase has ${coverRowA.observations} observation(s) for ${engineType}, below ${observationsRequired}`;
    else if (coverRowB && !coverRowB.met) reason = `to phase has ${coverRowB.observations} observation(s) for ${engineType}, below ${observationsRequired}`;
    else if (fromMean === null || toMean === null) reason = `the ${engineType} reading is missing in one of the phases`;
    rows.push({
      luid, engineType,
      unit: 'per-cent of this process\'s engine instance maximum, observation mean',
      fromMeanPercent: fromMean,
      toMeanPercent: toMean,
      deltaPercent: reason === null ? round(toMean - fromMean, 6) : null,
      reason,
      fromObservations: coverRowA ? coverRowA.observations : (a ? a.observations : 0),
      toObservations: coverRowB ? coverRowB.observations : (b ? b.observations : 0),
      fromMaxPercent: a ? a.maxPercent : null,
      toMaxPercent: b ? b.maxPercent : null,
      instanceNamesChanged: a && b ? JSON.stringify(a.instanceNames) !== JSON.stringify(b.instanceNames) : null,
    });
  }
  const computed = rows.filter(row => row.deltaPercent !== null).length;
  return {
    rows,
    delta: null,
    unit: 'per PID+LUID+engineType; not a share of the whole GPU',
    computedRows: computed,
    blockedRows: rows.length - computed,
  };
}

// ---------------------------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------------------------

function renderMarkdown(result) {
  const lines = [];
  lines.push('# Phase comparison');
  lines.push('');
  lines.push(`Manifest: \`${result.manifest.path}\` (sha256 \`${result.manifest.sha256}\`)`);
  lines.push(`Manifest state: **${result.status.manifestState}**`);
  lines.push(`Report produced: **yes**. Data sufficient to compare: **${result.status.dataReady ? 'yes' : 'no'}**${result.status.inconclusive ? ' (inconclusive)' : ''}`);
  lines.push('');
  if (result.status.inconclusive) {
    lines.push('## Why this comparison is inconclusive');
    lines.push('');
    for (const reason of result.status.reasons) lines.push(`- ${reason}`);
    lines.push('');
  }
  lines.push('## Status per phase');
  lines.push('');
  lines.push('| Phase | Required roles resolved | Identity | CPU coverage | Metrics | Topology | Comparable (CPU/RAM/GPU) |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const phase of result.phases) {
    const cpu = `${phase.coverage.cpuIntervals} intervals / ${phase.coverage.cpuValidSeconds}s${phase.coverageMet.cpuIntervals && phase.coverageMet.cpuValidSeconds ? '' : ' (below minimum)'}`;
    const metrics = `${phase.coverage.metricObservations} observations${phase.coverageMet.metricObservations ? '' : ' (below minimum)'}`;
    const topo = phase.topology.known ? (phase.topology.changed ? 'changed' : 'known') : `unknown (${phase.topology.unknownTopologySamples} samples)`;
    lines.push(`| ${phase.id} | ${phase.requiredRolesUnresolved.length === 0 ? 'yes' : 'no: ' + phase.requiredRolesUnresolved.join(', ')} | ${phase.identity.stable ? 'stable' : 'unstable'} | ${cpu} | ${metrics} | ${topo} | ${phase.conclusions.cpuComparable ? 'Y' : 'n'}/${phase.conclusions.memoryComparable ? 'Y' : 'n'}/${phase.conclusions.gpuComparable ? 'Y' : 'n'} |`);
  }
  lines.push('');
  lines.push('## Per process, per phase');
  lines.push('');
  lines.push('CPU is recomputed from the raw intervals: total delta over total valid time, as percentage points of this machine\'s logical capacity.');
  lines.push('');
  lines.push('| Phase | PID | Roles | CPU pp | CPU intervals / seconds | Working set mean | GPU engines |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const phase of result.phases) {
    for (const process of phase.processes) {
      const engines = process.gpuEngines.length === 0 ? 'none observed'
        : process.gpuEngines.map(engine => `${engine.engineType}@${engine.luid.slice(-8)} mean ${engine.observationMeanPercent ?? 'null'}/max ${engine.maxPercent ?? 'null'} (n=${engine.observations})`).join('; ');
      lines.push(`| ${phase.id} | ${process.pid} (${process.name ?? 'name unknown'}) | ${process.roles.join(', ')} | ${process.cpu.percentOfLogicalCapacity ?? 'null'} | ${process.cpu.intervals} / ${process.cpu.validSeconds} | ${process.workingSetBytes.mean ?? 'null'} | ${engines} |`);
    }
    if (phase.processes.length === 0) lines.push(`| ${phase.id} | (no matched processes) | | | | | |`);
  }
  lines.push('');
  lines.push('## Differences');
  lines.push('');
  lines.push('A difference is only computed when both phases are comparable for that metric; otherwise the row explains why.');
  lines.push('');
  for (const pair of result.comparisons) {
    lines.push(`### ${pair.pair}${pair.labels ? ` (${pair.labels})` : ''}`);
    lines.push('');
    if (!pair.gates.passed) {
      lines.push(`Run conditions are not comparable for this pair, so no difference is computed:`);
      lines.push('');
      for (const reason of pair.gates.reasons) lines.push(`- ${reason}`);
      lines.push('');
    }
    if (pair.findings.length === 0) lines.push('No process is present in both phases with the same identity.');
    for (const finding of pair.findings) {
      lines.push(`- **pid ${finding.pid}** (${finding.roles.join(', ') || 'no role'}):`);
      lines.push(`  - CPU: ${finding.cpu.delta === null ? `no difference — ${finding.cpu.reason}` : `${finding.cpu.from} -> ${finding.cpu.to} = **${finding.cpu.delta}** ${finding.cpu.unit}`}`);
      lines.push(`  - Working set: ${finding.workingSetBytes.delta === null ? `no difference — ${finding.workingSetBytes.reason}` : `${finding.workingSetBytes.from} -> ${finding.workingSetBytes.to} = **${finding.workingSetBytes.delta}** ${finding.workingSetBytes.unit}`}`);
      lines.push(`  - Private bytes: ${finding.privateBytes.delta === null ? `no difference — ${finding.privateBytes.reason}` : `${finding.privateBytes.from} -> ${finding.privateBytes.to} = **${finding.privateBytes.delta}** ${finding.privateBytes.unit}`}`);
      if (finding.gpuMemory.delta === null && finding.gpuMemory.rows.length === 0) {
        lines.push(`  - GPU memory: no difference — ${finding.gpuMemory.reason}`);
      } else {
        for (const row of finding.gpuMemory.rows) {
          lines.push(`  - GPU memory ${row.metric}@${row.luid.slice(-8)}: mean ${row.fromMeanBytes ?? 'null'} -> ${row.toMeanBytes ?? 'null'} = **${row.deltaBytes ?? 'null'}** bytes (n ${row.fromObservations}/${row.toObservations})`);
        }
      }
      if (finding.gpuEngines.delta === null) {
        lines.push(`  - GPU: no difference — ${finding.gpuEngines.reason}`);
      } else if (finding.gpuEngines.rows.length === 0) {
        lines.push('  - GPU: no engine instance observed in either phase');
      } else {
        for (const row of finding.gpuEngines.rows) {
          lines.push(`  - GPU ${row.engineType}@${row.luid.slice(-8)}: mean ${row.fromMeanPercent ?? 'null'} -> ${row.toMeanPercent ?? 'null'} = **${row.deltaPercent ?? 'null'}** (${row.unit})`);
        }
      }
    }
    if (pair.identityMismatch.length > 0) {
      lines.push(`- Not compared (same PID, different start time): ${pair.identityMismatch.map(item => `${item.pid}`).join(', ')}`);
    }
    if (pair.onlyInTo.length > 0) lines.push(`- Present only in ${pair.pair.split('->')[1]}: ${pair.onlyInTo.join(', ')} (no value invented for the other phase)`);
    if (pair.onlyInFrom.length > 0) lines.push(`- Present only in ${pair.pair.split('->')[0]}: ${pair.onlyInFrom.join(', ')}`);
    lines.push('');
  }
  lines.push('## Limits of this report');
  lines.push('');
  lines.push('- Counts and sizes in the motion/size fields come from the manifest. They are **not** independently recomputed here.');
  lines.push('- No claim is made about total system cost, whole-GPU percentage or game impact: engine numbers are per-process counters.');
  lines.push('- Conditions are compared only as recorded; a null condition means it was not evidenced, not that it matched.');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

export async function comparePhases({ manifestPath, outputDir }) {
  const manifestFile = await readJson(manifestPath, 'manifest');
  const manifest = validateManifest(manifestFile.value, manifestPath);
  const manifestDir = dirname(resolve(manifestPath));

  const phases = [];
  const inputs = [];
  for (const phase of manifest.phases) {
    const reportPath = resolve(manifestDir, phase.samplerReport);
    const reportFile = await readJson(reportPath, `phase ${phase.id} samplerReport`);
    inputs.push({ phase: phase.id, path: reportPath, sha256: reportFile.sha256, bytes: reportFile.bytes });
    // Structure first: the report has to be the shape this tool reads, rather than silently defaulting
    // to empty arrays or filtering bad values away.
    if (!Array.isArray(reportFile.value.samples)) {
      throw new BadInput(`phase ${phase.id}: ${reportPath} has no samples array`);
    }
    if (!Array.isArray(reportFile.value.targets)) {
      throw new BadInput(`phase ${phase.id}: ${reportPath} has no targets array`);
    }
    if (!isFiniteNumber(reportFile.value.machine?.logicalProcessors) || reportFile.value.machine.logicalProcessors <= 0
      || !Number.isInteger(reportFile.value.machine.logicalProcessors)) {
      throw new BadInput(`phase ${phase.id}: ${reportPath} machine.logicalProcessors must be a positive integer, got ${JSON.stringify(reportFile.value.machine?.logicalProcessors)}`);
    }
    // The report names the phase it measured. A report whose label is a different phase is the wrong
    // file for this slot, so it is rejected rather than carried as a warning (F3).
    if (reportFile.value.phase !== phase.id) {
      throw new BadInput(`phase ${phase.id}: ${reportPath} reports phase ${JSON.stringify(reportFile.value.phase)}; a report must name the phase it measured`);
    }
    for (const [index, target] of reportFile.value.targets.entries()) {
      if (!Number.isInteger(target.pid) || target.pid <= 0) throw new BadInput(`phase ${phase.id}: targets[${index}].pid must be a positive integer, got ${JSON.stringify(target.pid)}`);
      if (typeof target.startTime !== 'string' || target.startTime.trim() === '') throw new BadInput(`phase ${phase.id}: targets[${index}].startTime is required`);
    }
    const targetPids = reportFile.value.targets.map(target => target.pid);
    if (new Set(targetPids).size !== targetPids.length) {
      throw new BadInput(`phase ${phase.id}: ${reportPath} lists the same target pid more than once`);
    }
    // A CPU interval that is not finite, or a negative one, is a broken input rather than a gap. The same
    // applies to the wall clock and to a sample without any usable read time.
    for (const [index, sample] of reportFile.value.samples.entries()) {
      if (!isPlainObject(sample)) throw new BadInput(`phase ${phase.id}: samples[${index}] is not an object`);
      if (!Array.isArray(sample.processes)) throw new BadInput(`phase ${phase.id}: samples[${index}].processes is not an array`);
      if (sample.readStartedAt === undefined || sample.readStartedAt === null) {
        throw new BadInput(`phase ${phase.id}: samples[${index}].readStartedAt is required so the read interval can be checked`);
      }
      for (const [pIndex, entry] of sample.processes.entries()) {
        for (const field of ['cpuSecondsDelta', 'wallClockSecondsDelta', 'cpuPercentOfLogicalCapacity', 'cpuSeconds', 'workingSetBytes', 'privateBytes']) {
          const value = entry[field];
          if (value !== null && value !== undefined && !isFiniteNumber(value)) {
            throw new BadInput(`phase ${phase.id}: sample ${index} processes[${pIndex}] pid ${entry.pid} ${field} is not a finite number (${JSON.stringify(value)})`);
          }
        }
        for (const field of ['cpuSecondsDelta', 'wallClockSecondsDelta', 'workingSetBytes', 'privateBytes']) {
          if (isFiniteNumber(entry[field]) && entry[field] < 0) {
            throw new BadInput(`phase ${phase.id}: sample ${index} pid ${entry.pid} has a negative ${field} (${entry[field]}); a negative interval is a broken reading, not a gap`);
          }
        }
      }
    }
    const analyzed = await analyzePhase(manifest, phase, manifestDir, reportFile.value, chooseFingerprint(phase, reportFile));
    phases.push(analyzed);
  }

  const comparisons = [];
  const pairOrder = [['A0', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A1'], ['A0', 'A1'], ['B', 'A0'], ['D', 'A0'], ['B', 'A1'], ['D', 'A1']];
  const byId = new Map(phases.map(phase => [phase.id, phase]));
  for (const [fromId, toId] of pairOrder) {
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to) continue;
    comparisons.push(comparePair(from, to, pairLabels(fromId, toId), manifest));
  }

  // Conditions are compared as recorded. A null is "not evidenced", which is different from "matched",
  // and differing values are recorded so a reader does not have to diff the manifest by hand.
  const conditionComparison = CONDITION_FIELDS.map(field => {
    const values = phases.map(phase => ({ phase: phase.id, value: phase.conditions ? (phase.conditions[field] ?? null) : null }));
    const present = values.filter(entry => entry.value !== null);
    const distinct = new Set(present.map(entry => JSON.stringify(entry.value)));
    const unevidenced = values.filter(entry => entry.value === null).map(entry => entry.phase);
    return {
      field,
      values,
      evidencedIn: present.map(entry => entry.phase),
      unevidencedIn: unevidenced,
      allEqual: present.length === values.length && distinct.size === 1,
      // Only a claim that the condition matched may rely on this; an empty or partial field cannot.
      comparableAsSame: present.length === values.length && distinct.size === 1,
    };
  });
  // Reasons are collected from each phase first, then from the cross-phase condition check: a phase
  // that cannot be interpreted, and conditions that do not match, are different kinds of insufficiency.
  const reasons = [];
  for (const phase of phases) {
    for (const reason of phase.inconclusiveReasons) reasons.push(`${phase.id}: ${reason}`);
  }
  const differingConditions = conditionComparison.filter(entry => entry.evidencedIn.length > 1 && !entry.allEqual).map(entry => entry.field);
  for (const field of differingConditions) reasons.push(`fixed condition differs between phases: ${field}`);
  const unevidencedConditions = conditionComparison.filter(entry => entry.unevidencedIn.length > 0).map(entry => entry.field);
  if (unevidencedConditions.length > 0) reasons.push(`conditions not evidenced in every phase: ${unevidencedConditions.join(', ')}`);
  // A pair that cannot be compared at all is itself a reason the data is not ready: the report is
  // written and every value is kept, but "sufficient to compare" must not be claimed.
  for (const comparison of comparisons) {
    if (!comparison.gates.passed) {
      reasons.push(`${comparison.pair}: not comparable — ${comparison.gates.reasons[0]}`);
    } else if (!comparison.gates.gpuTopology.passed) {
      // A GPU-only limitation is recorded as an insufficiency without invalidating the CPU/RAM rows.
      reasons.push(`${comparison.pair}: GPU not comparable — ${comparison.gates.gpuTopology.reasons[0]}`);
    }
  }
  const dataReady = reasons.length === 0;

  return {
    schemaVersion: 1,
    generatedBy: 'qa/perf/compare-phases.mjs',
    manifest: { path: resolve(manifestPath), sha256: manifestFile.sha256, bytes: manifestFile.bytes },
    inputs,
    status: {
      manifestState: manifest.state,
      // Two separate statements: a report exists, and whether the data supports comparison.
      reportWritten: true,
      dataReady,
      inconclusive: !dataReady,
      reasons,
      syntheticNotice: manifest.state === 'synthetic'
        ? 'This manifest declares state=synthetic. Nothing here is a real measurement and no real-machine result may be claimed from it.'
        : null,
      verdict: 'No optimisation conclusion is drawn by this tool; it reports numbers, coverage and comparability only.',
    },
    fixedConditions: manifest.fixedConditions,
    conditionComparison,
    minimumCoverage: manifest.minimumCoverage,
    phases,
    comparisons,
  };
}

/** The sampler report's own fingerprint is the phase provenance when the manifest does not override it. */
function chooseFingerprint(phase, reportFile) {
  return { path: reportFile.path, sha256: reportFile.sha256, bytes: reportFile.bytes, declaredPhase: phase.id };
}

function pairLabels(fromId, toId) {
  const labels = {
    'A0->B': 'adding the extra source',
    'B->C': 'adding native capture',
    'C->D': 'full plugin chain versus the offline native chain',
    'D->A1': 'after stopping the chain',
    'A0->A1': 'baseline drift, no chain in either phase',
  };
  return labels[`${fromId}->${toId}`] || null;
}

async function main() {
  let args;
  try {
    args = parseArgs({ options: { manifest: { type: 'string' }, output: { type: 'string' } }, allowPositionals: false });
  } catch (error) {
    console.error(`compare-phases: ${error.message}`);
    process.exit(2);
  }
  const manifestPath = args.values.manifest;
  const outputDir = args.values.output;
  if (!manifestPath || !outputDir) {
    console.error('usage: node compare-phases.mjs --manifest <manifest.json> --output <new-directory>');
    process.exit(2);
  }
  if (await pathExists(outputDir)) {
    console.error(`compare-phases: output directory already exists: ${outputDir}. Refusing to write into it: nothing is cleared or overwritten.`);
    process.exit(3);
  }

  let result;
  try {
    result = await comparePhases({ manifestPath, outputDir });
  } catch (error) {
    if (error instanceof BadInput) {
      console.error(`compare-phases: input rejected — ${error.message}`);
      console.error('compare-phases: no report was written.');
      process.exit(3);
    }
    throw error;
  }

  await mkdir(outputDir, { recursive: false });
  const jsonPath = join(outputDir, 'comparison.json');
  const mdPath = join(outputDir, 'comparison.md');
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  await writeFile(mdPath, renderMarkdown(result), { flag: 'wx' });

  console.log(`compare-phases: wrote ${jsonPath}`);
  console.log(`compare-phases: wrote ${mdPath}`);
  console.log(`compare-phases: report written = yes; data sufficient to compare = ${result.status.dataReady ? 'yes' : 'no'}`);
  if (!result.status.dataReady) {
    console.log('compare-phases: inconclusive reasons:');
    for (const reason of result.status.reasons) console.log(`  - ${reason}`);
  }
  process.exit(0);
}

async function pathExists(path) {
  try { await stat(resolve(path)); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().catch(error => {
    console.error(`compare-phases: unexpected failure — ${error.stack || error.message}`);
    process.exit(1);
  });
}
