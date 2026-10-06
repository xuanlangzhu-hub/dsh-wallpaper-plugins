// 审查要求的补测：同一分辨率、明确 window 来源的可见基线 + 连续 60 秒屏幕外记录。
//
// 第一屏的基线窗口尺寸由 WE 创建参数决定（868×517 逻辑像素），而屏幕外段被
// `--window-apply offscreen` 改成 1280×720，两段物理分辨率不同，无法直接比较。
// 这里在建窗后先把窗口固定为同一尺寸，再分别录两段 60 秒。
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runHelper } from '../managed-window.js';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROBE_EXE = fileURLToPath(new URL('../../wallpaper-probe/bin/Release/net10.0-windows10.0.19041.0/WallpaperProbe.exe', import.meta.url));
const SAMPLE_PROJECT = 'E:\\SteamLibrary\\steamapps\\workshop\\content\\431960\\3521337568\\project.json';
const EXP_ROOT = 'F:\\deepseekharness\\.tmp\\wallpaper-window-modes-control-20261005';
const FPS = 30;
const WARMUP_SEC = 5;
const SECONDS = 60;
const helper = args => runHelper(execFile, PROBE_EXE, args);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const pct = (values, q) => { const s = [...values].filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : null; };
const mean = values => { const s = values.filter(Number.isFinite); return s.length ? Number((s.reduce((a, b) => a + b, 0) / s.length).toFixed(2)) : null; };

async function phase(name, hwnd, runDir, action) {
  const applied = await helper(['--window-apply', String(hwnd), action]);
  const onScreen = await helper(['--window-onscreen', String(hwnd)]);
  const dir = join(runDir, name);
  await mkdir(dir, { recursive: true });
  const child = spawn(PROBE_EXE, [String(hwnd), dir, String(SECONDS), String(FPS), 'memory'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stdout.resume();
  child.stderr.on('data', chunk => { stderr += chunk; });
  const samples = [];
  const sampler = setInterval(async () => {
    const [state, foreground] = await Promise.all([helper(['--window-find']).catch(() => []), helper(['--window-foreground']).catch(() => null)]);
    samples.push({ at: Date.now(), window: state.find(w => w.hwnd === hwnd) ?? null, foreground });
  }, 5000);
  const code = await new Promise(resolve => child.on('close', resolve));
  clearInterval(sampler);

  const summary = JSON.parse(await readFile(join(dir, 'summary.json'), 'utf8').catch(() => 'null'));
  const frames = (await readFile(join(dir, 'frames.jsonl'), 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const warm = frames.filter(frame => frame.seconds > WARMUP_SEC);
  const span = warm.length > 1 ? warm.at(-1).seconds - warm[0].seconds : 0;
  let maxGapMs = 0, maxGapAtSec = null;
  for (let index = 1; index < frames.length; index++) {
    const gap = (frames[index].seconds - frames[index - 1].seconds) * 1000;
    if (gap > maxGapMs) { maxGapMs = gap; maxGapAtSec = frames[index].seconds; }
  }
  const dims = [...new Set(frames.map(frame => `${frame.width}x${frame.height}`))];
  const sources = [...new Set(frames.map(frame => frame.captureSource))];
  const windowItemFrames = frames.filter(frame => frame.captureSource === 'window').length;
  const result = {
    phase: name, action, exitCode: code,
    applied: { visible: applied.visible, left: applied.left, top: applied.top, width: applied.width, height: applied.height, exStyle: applied.exStyle },
    visibleFractionOfScreen: onScreen.visibleFraction,
    requestedSeconds: SECONDS,
    frames: frames.length, windowItemFrames, dimensions: dims, captureSources: sources,
    summaryFrames: summary?.frames ?? null, summaryReason: summary?.reason ?? null, skippedPublications: summary?.skippedPublications ?? null,
    steadyStateFps: span > 0 ? Number((warm.length / span).toFixed(2)) : null,
    wholeRunFps: summary ? Number((summary.frames / summary.seconds).toFixed(2)) : null,
    distinctHashes: new Set(frames.map(frame => frame.hash)).size,
    distinctSourceTimestamps: new Set(frames.map(frame => frame.sourceTimestampMs)).size,
    maxFrameGapMs: Number(maxGapMs.toFixed(1)), maxFrameGapAtSec: maxGapAtSec,
    frozenOverFreezeLimit: maxGapMs > 3000,
    timing: {
      readbackMs: { mean: mean(warm.map(f => f.readbackMs)), p50: pct(warm.map(f => f.readbackMs), 0.5), p95: pct(warm.map(f => f.readbackMs), 0.95) },
      jpegMs: { mean: mean(warm.map(f => f.jpegMs)), p50: pct(warm.map(f => f.jpegMs), 0.5) },
      encodeMs: { mean: mean(warm.map(f => f.encodeMs)), p50: pct(warm.map(f => f.encodeMs), 0.5) },
      sourceAgeMs: { mean: mean(warm.map(f => f.sourceAgeMs)), p50: pct(warm.map(f => f.sourceAgeMs), 0.5) },
    },
    windowSamples: samples.filter(sample => sample.window).length,
    windowWasForeground: samples.some(sample => sample.window && sample.foreground && sample.foreground.hwnd === hwnd),
    positionsSeen: [...new Set(samples.filter(s => s.window).map(s => `${s.window.left},${s.window.top}`))],
    foregroundProcesses: [...new Set(samples.map(s => s.foreground?.processName).filter(Boolean))],
    stderrTail: stderr.trim().split('\n').slice(-2),
  };
  console.log(`${name}: frames=${result.frames} windowItemFrames=${result.windowItemFrames} dims=${dims.join(',')} sources=${sources.join(',')} fps=${result.steadyStateFps} maxGapMs=${result.maxFrameGapMs} pos=${result.applied.left},${result.applied.top}`);
  return result;
}

const runId = `WhaleWallpaperProbe-20261005-redo-${new Date().toISOString().replace(/[:.]/g, '').slice(11, 17)}`;
const runDir = join(EXP_ROOT, runId);
await mkdir(runDir, { recursive: true });
console.log(`=== 补测：同分辨率可见基线 + 连续 60 秒屏幕外（${runId}）===`);
const results = { runId, startedAt: new Date().toISOString(), fps: FPS, warmupSec: WARMUP_SEC, seconds: SECONDS, phases: {}, cleanup: null };
let hwnd = null, error = null;

try {
  await helper(['--we-open', runId, SAMPLE_PROJECT, '1280', '720']);
  let target = null;
  for (let attempt = 0; attempt < 40 && !target; attempt++) {
    await sleep(500);
    target = (await helper(['--window-find'])).find(window => window.title === runId) ?? null;
  }
  if (!target) throw new Error(`窗口 ${runId} 未出现`);
  hwnd = target.hwnd;
  console.log(`窗口 hwnd=${hwnd} pid=${target.pid} 初始尺寸=${target.width}x${target.height}`);
  // 先把窗口固定为 1280×720，使两段录制的物理分辨率一致。
  await helper(['--window-apply', String(hwnd), 'onscreen']);
  await sleep(2500);

  results.phases.baselineVisible = await phase('01-baseline-visible-60s', hwnd, runDir, 'onscreen');
  await sleep(1500);
  results.phases.offscreen = await phase('02-offscreen-60s', hwnd, runDir, 'offscreen');
  await sleep(1500);
  results.phases.restore = await phase('03-restore-onscreen-20s', hwnd, runDir, 'onscreen');
} catch (caught) {
  error = caught.message;
  console.error(`补测中止：${error}`);
} finally {
  const closed = await helper(['--window-ensure-closed', runId, '20000']).catch(caught => ({ closed: false, error: caught.message }));
  const remaining = await helper(['--window-find']).catch(() => []);
  results.cleanup = { closed, remainingProbeWindows: remaining.length };
  results.error = error;
  console.log(`[清理] closed=${closed.closed} outcome=${closed.outcome} 剩余 probe 窗口=${remaining.length}`);

  const baseline = results.phases.baselineVisible;
  const offscreen = results.phases.offscreen;
  if (baseline && offscreen) {
    const sameDims = baseline.dimensions.length === 1 && offscreen.dimensions.length === 1 && baseline.dimensions[0] === offscreen.dimensions[0];
    results.comparison = {
      sameDimensions: sameDims, dimensions: sameDims ? baseline.dimensions[0] : [baseline.dimensions, offscreen.dimensions],
      bothWindowSource: baseline.captureSources.join() === 'window' && offscreen.captureSources.join() === 'window',
      visibleFps: baseline.steadyStateFps, offscreenFps: offscreen.steadyStateFps,
      offscreenPercentOfVisible: baseline.steadyStateFps ? Number(((offscreen.steadyStateFps / baseline.steadyStateFps) * 100).toFixed(1)) : null,
      visibleReadbackP50: baseline.timing.readbackMs.p50, offscreenReadbackP50: offscreen.timing.readbackMs.p50,
      interpretation: '两段同分辨率、同来源、连续测量的比例才是位置效应；与其它运行之间的差异另有负载混杂。',
    };
    console.log(`[对比] 同分辨率=${sameDims} 同来源=${results.comparison.bothWindowSource} 屏幕外/可见=${results.comparison.offscreenPercentOfVisible}%`);
  }
  await writeFile(join(runDir, 'redo-results.json'), JSON.stringify(results, null, 2));
  console.log(`[报告] ${join(runDir, 'redo-results.json')}`);
}
if (error) process.exitCode = 1;
