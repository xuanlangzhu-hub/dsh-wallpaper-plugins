// Supervised A-step control experiment: which way of tucking the source window
// away still lets Windows.Graphics.Capture produce fresh frames?
//
// One round = one uniquely named WE window; every phase uses the same capture
// settings, so the visible baseline is the control for the hidden and off-screen
// candidates. Run it only while the user is present (it opens a real window).
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

// Warm-up excluded from the steady-state numbers (GPU/encoder ramp and window show-up).
const WARMUP_SEC = 3;
const FREEZE_MS = 3000;

const PHASES = [
  { name: '01-baseline-visible', action: null, seconds: 60, purpose: 'control: window visible on screen, DSH in front' },
  { name: '02-test-hidden', action: 'hide', seconds: 90, purpose: 'candidate 1: ShowWindow(SW_HIDE)' },
  { name: '03-test-offscreen', action: 'offscreen', seconds: 90, purpose: 'candidate 2: SWP to -32000,-32000, no activation, keeps taskbar entry' },
  { name: '04-test-offscreen-tool', action: 'offscreen-tool', seconds: 90, purpose: 'candidate 3: off-screen plus WS_EX_TOOLWINDOW (drops Alt-Tab/taskbar)' },
  { name: '05-restore-onscreen', action: 'onscreen', seconds: 20, purpose: 'reversibility: back on screen and still producing frames' },
];

async function helper(args, { json = true } = {}) {
  const { stdout, stderr } = await execFileAsync(PROBE_EXE, args, { encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (!json) return { stdout, stderr };
  const text = stdout.trim();
  return text ? JSON.parse(text) : null;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

async function readFrames(file) {
  const raw = await readFile(file, 'utf8').catch(() => '');
  return raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

// Phase metrics come from the probe's own per-frame log, so the capture numbers
// never depend on how the runner samples state.
function analyse(frames, summary, seconds, samples) {
  const warm = frames.filter(frame => frame.seconds > WARMUP_SEC);
  const span = warm.length > 1 ? warm.at(-1).seconds - warm[0].seconds : 0;
  let maxGapMs = 0, gapAt = null;
  for (let index = 1; index < frames.length; index++) {
    const gap = (frames[index].seconds - frames[index - 1].seconds) * 1000;
    if (gap > maxGapMs) { maxGapMs = gap; gapAt = frames[index].seconds; }
  }
  const of = key => warm.map(frame => frame[key]);
  const hashes = frames.map(frame => frame.hash).filter(Boolean);
  return {
    requestedSeconds: seconds,
    summaryFrames: summary?.frames ?? null,
    summaryReason: summary?.reason ?? null,
    summarySeconds: summary?.seconds ?? null,
    frames: frames.length,
    changeCount: frames.at(-1)?.changed ?? null,
    distinctHashes: new Set(hashes).size,
    steadyStateFps: span > 0 ? Number((warm.length / span).toFixed(2)) : null,
    wholeRunFps: summary ? Number((summary.frames / summary.seconds).toFixed(2)) : null,
    maxFrameGapMs: Number(maxGapMs.toFixed(1)),
    maxFrameGapAtSec: gapAt,
    frozenOverFreezeLimit: maxGapMs > FREEZE_MS,
    skippedPublications: summary?.skippedPublications ?? frames.at(-1)?.skippedPublications ?? null,
    timing: {
      readbackMs: { mean: mean(of('readbackMs')), p50: percentile(of('readbackMs'), 0.5), p95: percentile(of('readbackMs'), 0.95) },
      jpegMs: { mean: mean(of('jpegMs')), p50: percentile(of('jpegMs'), 0.5), p95: percentile(of('jpegMs'), 0.95) },
      encodeMs: { mean: mean(of('encodeMs')), p50: percentile(of('encodeMs'), 0.5), p95: percentile(of('encodeMs'), 0.95) },
      sourceAgeMs: { mean: mean(of('sourceAgeMs')), p50: percentile(of('sourceAgeMs'), 0.5), p95: percentile(of('sourceAgeMs'), 0.95) },
    },
    windowVisibleSamples: samples.filter(sample => sample.state?.visible).length,
    windowCloakedSamples: samples.filter(sample => sample.state?.cloaked).length,
    probeWasForeground: samples.some(sample => sample.foreground?.hwnd === sample.probeHwnd),
    foregroundProcesses: [...new Set(samples.map(sample => sample.foreground?.process).filter(Boolean))],
  };
}

function mean(values) {
  const clean = values.filter(value => typeof value === 'number' && Number.isFinite(value));
  return clean.length ? Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(2)) : null;
}

async function sampleWindow(hwnd, foregroundHwnds) {
  const [state, foreground] = await Promise.all([
    helper(['--window-status', hwnd]).catch(() => null),
    helper(['--window-foreground']).catch(() => null),
  ]);
  const foregroundState = foreground && foreground.exists === false ? null : foreground;
  if (foregroundState) foregroundHwnds.add(foregroundState.pid);
  return {
    at: new Date().toISOString(),
    probeHwnd: hwnd,
    state: state ? { visible: state.visible, iconic: state.iconic, cloaked: state.cloaked, left: state.left, top: state.top, width: state.width, height: state.height, exStyle: state.exStyle, style: state.style } : null,
    foreground: foregroundState ? { hwnd: foregroundState.hwnd, pid: foregroundState.pid, process: foregroundState.processName, title: foregroundState.title } : null,
  };
}

async function runPhase(phase, hwnd, runId) {
  console.log(`\n--- phase ${phase.name}: ${phase.purpose} (${phase.seconds}s) ---`);
  if (phase.action) {
    const state = await helper(['--window-apply', String(hwnd), phase.action]);
    console.log(`    action '${phase.action}' -> visible=${state.visible} iconic=${state.iconic} pos=(${state.left},${state.top}) ${state.width}x${state.height} exStyle=0x${state.exStyle.toString(16)}`);
  }
  const onScreen = await helper(['--window-onscreen', String(hwnd)]).catch(() => null);
  const phaseDir = join(EXP_ROOT, runId, phase.name);
  await mkdir(phaseDir, { recursive: true });

  const child = spawn(PROBE_EXE, [String(hwnd), phaseDir, String(phase.seconds), String(FPS), 'memory'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });

  const samples = [], foregroundHwnds = new Set();
  const sampler = setInterval(() => { sampleWindow(hwnd, foregroundHwnds).then(sample => samples.push(sample)).catch(() => {}); }, 2000);
  const exitCode = await new Promise(resolve => child.on('close', resolve));
  clearInterval(sampler);
  await sleep(300); // let one last sample land

  const summary = JSON.parse(await readFile(join(phaseDir, 'summary.json'), 'utf8').catch(() => 'null'));
  const frames = await readFrames(join(phaseDir, 'frames.jsonl'));
  const metrics = analyse(frames, summary, phase.seconds, samples);
  const hitTest = await helper(['--window-at', '860', '480', String(hwnd)]).catch(() => null);

  console.log(`    exit=${exitCode} frames=${metrics.frames} distinctHashes=${metrics.distinctHashes} steadyFps=${metrics.steadyStateFps} maxGapMs=${metrics.maxFrameGapMs} reason=${metrics.summaryReason}`);
  if (exitCode !== 0) console.log(`    probe stdout=${stdout.slice(0, 400)} stderr=${stderr.slice(0, 400)}`);

  return {
    action: phase.action,
    purpose: phase.purpose,
    exitCode,
    onScreenAtPhaseStart: onScreen,
    hitTestAtDshPoint: hitTest,
    samples,
    ...metrics,
  };
}

async function main() {
  const stamp = new Date();
  const runId = `WhaleWallpaperProbe-20261005-ctl-${stamp.toISOString().replace(/[:.]/g, '').slice(11, 17)}`;
  const startedAt = stamp.toISOString();
  console.log(`=== WE source-window control experiment (${runId}) ===`);
  await mkdir(join(EXP_ROOT, runId), { recursive: true });

  const pre = {
    startedAt,
    runId,
    wallpaperEngine: await helper(['--window-find'], { json: true }).catch(() => null),
    screen: await helper(['--window-screen']).catch(() => null),
    foreground: await helper(['--window-foreground']).catch(() => null),
    existingProbeWindows: [],
    weProcesses: [],
  };
  pre.existingProbeWindows = pre.wallpaperEngine ?? [];

  let hwnd = null, target = null;
  const phases = {};
  let cleanup = null;

  try {
    console.log(`[1] opening supervised WE window: ${runId}`);
    await helper(['--we-open', runId, SAMPLE_PROJECT, '1280', '720']);
    for (let attempt = 0; attempt < 40 && !target; attempt++) {
      await sleep(500);
      const found = await helper(['--window-find']).catch(() => []);
      target = found.find(window => window.title === runId) ?? null;
    }
    if (!target) throw new Error(`window ${runId} did not appear within 20s`);
    hwnd = target.hwnd;
    console.log(`[2] target hwnd=${hwnd} pid=${target.pid} rect=(${target.left},${target.top}) ${target.width}x${target.height} visible=${target.visible} exStyle=0x${target.exStyle.toString(16)}`);
    await sleep(2500); // let the scene render before the first capture

    for (const phase of PHASES) phases[phase.name] = await runPhase(phase, hwnd, runId);
  } catch (error) {
    console.error(`experiment aborted: ${error.message}`);
    phases.error = error.message;
  } finally {
    console.log(`\n[cleanup] closing ${runId} through the native identity-checked path`);
    const closeReport = await helper(['--window-ensure-closed', runId, '20000']).catch(error => ({ closed: false, error: error.message }));
    const after = await helper(['--window-find']).catch(() => []);
    cleanup = {
      closeReport,
      remainingProbeWindows: after,
      probeWindowsClosed: after.length === 0,
      foregroundAfter: await helper(['--window-foreground']).catch(() => null),
    };
    console.log(`[cleanup] closed=${closeReport.closed} remainingProbeWindows=${after.length}`);

    const results = { runId, startedAt, finishedAt: new Date().toISOString(), fps: FPS, warmupSec: WARMUP_SEC, freezeMs: FREEZE_MS, pre, target, phases, cleanup };
    await writeFile(join(EXP_ROOT, runId, 'experiment-results.json'), JSON.stringify(results, null, 2));
    console.log(`[report] ${join(EXP_ROOT, runId, 'experiment-results.json')}`);

    const baseline = phases['01-baseline-visible'];
    for (const phase of PHASES.slice(1)) {
      const value = phases[phase.name];
      if (!value) continue;
      const ratio = baseline?.steadyStateFps ? ((value.steadyStateFps / baseline.steadyStateFps) * 100).toFixed(0) : 'n/a';
      console.log(`  ${phase.name}: steadyFps=${value.steadyStateFps} (${ratio}% of baseline) maxGapMs=${value.maxFrameGapMs} visibleSamples=${value.windowVisibleSamples}/${value.samples.length}`);
    }
  }
  if (phases.error) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exit(1); });
