// Interleaved off-screen comparison. The first screen showed that a plain
// phase-per-state design cannot separate the state effect from machine load
// (the same window state produced 12.75 fps and 9.54 fps), and that a window
// moved off screen after capture started silently captures the whole monitor
// instead (1902x1071 instead of 1284x767).
//
// This runner therefore alternates visible / off screen short phases in one run
// and makes the probe refuse any non-window capture item, so throughput numbers
// are only comparable when every phase captured the window itself.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const WE_EXE = 'E:\\SteamLibrary\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe';
const SAMPLE_PROJECT = 'E:\\SteamLibrary\\steamapps\\workshop\\content\\431960\\3521337568\\project.json';
const PROBE_EXE = 'F:\\deepseekharness\\dsh-whale-mist\\qa\\wallpaper-probe\\bin\\Release\\net10.0-windows10.0.19041.0\\WallpaperProbe.exe';
const EXP_ROOT = 'F:\\deepseekharness\\.tmp\\wallpaper-window-modes-control-20261005';

const FPS = 30;
const REPS = 3;
const PHASE_SECONDS = 12;
const WARMUP_SEC = 2;

// Every phase forces the window into its state BEFORE capture starts, so the
// capture item is created for exactly the state under test.
const PHASES = [];
for (let rep = 1; rep <= REPS; rep++) {
  PHASES.push({ name: `${String(rep).padStart(2, '0')}a-visible`, action: 'onscreen', state: 'visible', seconds: PHASE_SECONDS });
  PHASES.push({ name: `${String(rep).padStart(2, '0')}b-offscreen`, action: 'offscreen', state: 'offscreen', seconds: PHASE_SECONDS });
}
// Production-shaped variant: capture starts while the window is still visible
// and the window is moved off screen once frames are flowing.
PHASES.push({ name: '04-stream-then-offscreen', action: 'onscreen', state: 'visible', seconds: 20, midAction: { atSec: 6, action: 'offscreen' } });
PHASES.push({ name: '05-final-visible', action: 'onscreen', state: 'visible', seconds: 12 });

async function helper(args) {
  const { stdout } = await execFileAsync(PROBE_EXE, args, { encoding: 'utf8', timeout: 40000, windowsHide: true });
  const text = stdout.trim();
  return text ? JSON.parse(text) : null;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}
const mean = values => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;

async function readFrames(file) {
  const raw = await readFile(file, 'utf8').catch(() => '');
  return raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

function analyse(frames, summary, seconds) {
  const warm = frames.filter(frame => frame.seconds > WARMUP_SEC);
  const span = warm.length > 1 ? warm.at(-1).seconds - warm[0].seconds : 0;
  let maxGapMs = 0;
  for (let index = 1; index < frames.length; index++)
    maxGapMs = Math.max(maxGapMs, (frames[index].seconds - frames[index - 1].seconds) * 1000);
  const of = key => warm.map(frame => frame[key]).filter(value => typeof value === 'number');
  const dimensions = [...new Set(frames.map(frame => `${frame.width}x${frame.height}`))];
  const sources = [...new Set(frames.map(frame => frame.captureSource ?? 'unknown'))];
  return {
    frames: frames.length,
    summaryFrames: summary?.frames ?? null,
    summaryReason: summary?.reason ?? null,
    distinctHashes: new Set(frames.map(frame => frame.hash).filter(Boolean)).size,
    distinctSourceTimestamps: new Set(frames.map(frame => frame.sourceTimestampMs)).size,
    steadyStateFps: span > 0 ? Number((warm.length / span).toFixed(2)) : null,
    wholeRunFps: summary ? Number((summary.frames / summary.seconds).toFixed(2)) : null,
    maxFrameGapMs: Number(maxGapMs.toFixed(1)),
    dimensions,
    captureSources: sources,
    windowItemCaptured: sources.length === 1 && sources[0] === 'window',
    skippedPublications: summary?.skippedPublications ?? null,
    timing: {
      readbackMs: { mean: mean(of('readbackMs')), p50: percentile(of('readbackMs'), 0.5), p95: percentile(of('readbackMs'), 0.95) },
      jpegMs: { mean: mean(of('jpegMs')), p50: percentile(of('jpegMs'), 0.5) },
      encodeMs: { mean: mean(of('encodeMs')), p50: percentile(of('encodeMs'), 0.5) },
      sourceAgeMs: { mean: mean(of('sourceAgeMs')), p50: percentile(of('sourceAgeMs'), 0.5) },
    },
  };
}

async function runPhase(phase, hwnd, runId, results) {
  console.log(`\n--- ${phase.name} (${phase.state}, ${phase.seconds}s${phase.midAction ? `, mid-action ${phase.midAction.action}@${phase.midAction.atSec}s` : ''}) ---`);
  const applied = await helper(['--window-apply', String(hwnd), phase.action]);
  const onScreen = await helper(['--window-onscreen', String(hwnd)]);
  console.log(`    state visible=${applied.visible} iconic=${applied.iconic} pos=(${applied.left},${applied.top}) ${applied.width}x${applied.height} exStyle=0x${applied.exStyle.toString(16)} visibleFractionOfScreen=${onScreen.visibleFraction}`);

  const phaseDir = join(EXP_ROOT, runId, phase.name);
  await mkdir(phaseDir, { recursive: true });
  const child = spawn(PROBE_EXE, [String(hwnd), phaseDir, String(phase.seconds), String(FPS), 'memory', '--require-window-item', '--echo-on-stderr'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stdout.resume();
  child.stderr.on('data', chunk => { stderr += chunk; });

  const samples = [];
  const sampler = setInterval(async () => {
    const [state, foreground] = await Promise.all([
      helper(['--window-status', hwnd]).catch(() => null),
      helper(['--window-foreground']).catch(() => null),
    ]);
    samples.push({ at: Date.now(), state, foreground });
  }, 2000);
  let midAction = null;
  const midTimer = phase.midAction ? setTimeout(async () => {
    midAction = await helper(['--window-apply', String(hwnd), phase.midAction.action]).catch(error => ({ error: error.message }));
    console.log(`    mid-action '${phase.midAction.action}' -> visible=${midAction.visible} pos=(${midAction.left},${midAction.top})`);
  }, phase.midAction.atSec * 1000) : null;

  const exitCode = await new Promise(resolve => child.on('close', resolve));
  clearInterval(sampler); clearTimeout(midTimer);
  await sleep(250);

  const summary = JSON.parse(await readFile(join(phaseDir, 'summary.json'), 'utf8').catch(() => 'null'));
  const frames = await readFrames(join(phaseDir, 'frames.jsonl'));
  const metrics = analyse(frames, summary, phase.seconds);
  const probeForeground = samples.filter(sample => sample.foreground && sample.state && sample.foreground.hwnd === hwnd).length;
  console.log(`    exit=${exitCode} frames=${metrics.frames} fps=${metrics.steadyStateFps} maxGapMs=${metrics.maxFrameGapMs} dims=${metrics.dimensions.join(',')} source=${metrics.captureSources.join(',')} reason=${metrics.summaryReason}`);
  if (exitCode !== 0) console.log(`    stderr: ${stderr.trim().split('\n').slice(-2).join(' | ').slice(0, 600)}`);
  results.push({ phase: phase.name, state: phase.state, midAction: phase.midAction?.action ?? null, exitCode,
    applied: { visible: applied.visible, iconic: applied.iconic, left: applied.left, top: applied.top, width: applied.width, height: applied.height, exStyle: applied.exStyle },
    visibleFractionOfScreen: onScreen.visibleFraction, probeWasForegroundSamples: probeForeground, sampleCount: samples.length,
    stderrTail: stderr.trim().split('\n').slice(-3), ...metrics });
}

async function main() {
  const runId = `WhaleWallpaperProbe-20261005-int-${new Date().toISOString().replace(/[:.]/g, '').slice(11, 17)}`;
  console.log(`=== interleaved off-screen comparison (${runId}) ===`);
  await mkdir(join(EXP_ROOT, runId), { recursive: true });
  const results = [];
  let hwnd = null, target = null, cleanup = null, error = null;

  try {
    await helper(['--we-open', runId, SAMPLE_PROJECT, '1280', '720']);
    for (let attempt = 0; attempt < 40 && !target; attempt++) {
      await sleep(500);
      const found = await helper(['--window-find']).catch(() => []);
      target = found.find(window => window.title === runId) ?? null;
    }
    if (!target) throw new Error(`window ${runId} did not appear`);
    hwnd = target.hwnd;
    console.log(`target hwnd=${hwnd} pid=${target.pid} rect=(${target.left},${target.top}) ${target.width}x${target.height}`);
    await sleep(2500);
    for (const phase of PHASES) await runPhase(phase, hwnd, runId, results);
  } catch (caught) {
    error = caught.message;
    console.error(`aborted: ${error}`);
  } finally {
    const closeReport = await helper(['--window-ensure-closed', runId, '20000']).catch(caught => ({ closed: false, error: caught.message }));
    const remaining = await helper(['--window-find']).catch(() => []);
    cleanup = { closeReport, remainingProbeWindows: remaining.length, foregroundAfter: await helper(['--window-foreground']).catch(() => null) };
    console.log(`\n[cleanup] closed=${closeReport.closed} remaining=${remaining.length}`);

    const visible = results.filter(result => result.state === 'visible' && result.frames > 0 && result.windowItemCaptured);
    const offscreen = results.filter(result => result.state === 'offscreen' && result.frames > 0 && result.windowItemCaptured);
    const summary = {
      visiblePhases: visible.length, offscreenPhases: offscreen.length,
      visibleFpsValues: visible.map(result => result.steadyStateFps),
      offscreenFpsValues: offscreen.map(result => result.steadyStateFps),
      visibleMeanFps: mean(visible.map(result => result.steadyStateFps)),
      offscreenMeanFps: mean(offscreen.map(result => result.steadyStateFps)),
      offscreenPercentOfVisible: visible.length && offscreen.length
        ? Number(((mean(offscreen.map(r => r.steadyStateFps)) / mean(visible.map(r => r.steadyStateFps))) * 100).toFixed(1)) : null,
    };
    console.log(`=== comparison ===\nvisible mean fps=${summary.visibleMeanFps} (${summary.visibleFpsValues.join(', ')})`);
    console.log(`offscreen mean fps=${summary.offscreenMeanFps} (${summary.offscreenFpsValues.join(', ')}) => ${summary.offscreenPercentOfVisible}%`);

    await writeFile(join(EXP_ROOT, runId, 'interleaved-results.json'),
      JSON.stringify({ runId, startedAt: new Date().toISOString(), fps: FPS, warmupSec: WARMUP_SEC, phases: results, summary, cleanup, error }, null, 2));
    console.log(`[report] ${join(EXP_ROOT, runId, 'interleaved-results.json')}`);
  }
  if (error) process.exitCode = 1;
}

main().catch(caught => { console.error(caught); process.exit(1); });
