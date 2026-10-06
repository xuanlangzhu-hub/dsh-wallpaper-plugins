// Fine-grained toggle probe: which single window operation breaks the WGC
// window item, and does turning it back off restore capture?
//
// The first screen only tested whole states. Here every phase changes exactly
// one thing, and each capture refuses any non-window item, so a phase that
// produced frames really captured this window.
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

// step: 'none' keeps the inherited state; otherwise --window-apply <action>.
const STEPS = [
  { name: '1-onscreen-baseline', action: 'onscreen', seconds: 8, why: 'normal visible window' },
  { name: '2-hide', action: 'hide', seconds: 8, why: 'SW_HIDE on the source window' },
  { name: '3-show-after-hide', action: 'show', seconds: 8, why: 'can capture resume after SW_HIDE + SW_RESTORE?' },
  { name: '4-offscreen', action: 'offscreen', seconds: 8, why: 'moved to -32000,-32000, still a taskbar window' },
  { name: '5-onscreen-again', action: 'onscreen', seconds: 8, why: 'back on screen from off screen' },
  { name: '6-offscreen-tool', action: 'offscreen-tool', seconds: 8, why: 'off screen plus WS_EX_TOOLWINDOW' },
  { name: '7-onscreen-after-tool', action: 'onscreen', seconds: 8, why: 'does removing WS_EX_TOOLWINDOW restore capture?' },
  { name: '8-bottom', action: 'bottom', seconds: 8, why: 'z-order bottom, no size or style change' },
];

async function helper(args) {
  const { stdout } = await execFileAsync(PROBE_EXE, args, { encoding: 'utf8', timeout: 40000, windowsHide: true });
  const text = stdout.trim();
  return text ? JSON.parse(text) : null;
}

async function main() {
  const runId = `WhaleWallpaperProbe-20261005-tgl-${new Date().toISOString().replace(/[:.]/g, '').slice(11, 17)}`;
  const runDir = join(EXP_ROOT, runId);
  await mkdir(runDir, { recursive: true });
  console.log(`=== window-operation toggle probe (${runId}) ===`);
  const results = [];
  let hwnd = null, target = null, error = null, cleanup = null;

  try {
    await helper(['--we-open', runId, SAMPLE_PROJECT, '1280', '720']);
    for (let attempt = 0; attempt < 40 && !target; attempt++) {
      await sleep(500);
      target = (await helper(['--window-find']).catch(() => [])).find(window => window.title === runId) ?? null;
    }
    if (!target) throw new Error(`window ${runId} did not appear`);
    hwnd = target.hwnd;
    await sleep(2000);

    for (const step of STEPS) {
      const applied = await helper(['--window-apply', String(hwnd), step.action]);
      const dir = join(runDir, step.name);
      await mkdir(dir, { recursive: true });
      const child = spawn(PROBE_EXE, [String(hwnd), dir, String(step.seconds), String(FPS), 'readback', '--require-window-item'],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stdout.resume();
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', chunk => { stderr += chunk; });
      const exitCode = await new Promise(resolve => child.on('close', resolve));
      const summary = JSON.parse(await readFile(join(dir, 'summary.json'), 'utf8').catch(() => 'null'));
      const frames = (await readFile(join(dir, 'frames.jsonl'), 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      const reason = summary?.reason ?? stderr.trim().split('\n').filter(Boolean).at(-1)?.slice(0, 220) ?? null;
      const row = {
        step: step.name, why: step.why, action: step.action, exitCode,
        visible: applied.visible, iconic: applied.iconic, cloaked: applied.cloaked,
        left: applied.left, top: applied.top, width: applied.width, height: applied.height,
        exStyle: applied.exStyle, style: applied.style,
        frames: frames.length, framesPerSecond: summary ? Number((summary.frames / summary.seconds).toFixed(2)) : 0,
        distinctHashes: new Set(frames.map(frame => frame.hash)).size,
        captureSources: [...new Set(frames.map(frame => frame.captureSource))],
        reason,
      };
      results.push(row);
      console.log(`${step.name.padEnd(22)} exit=${exitCode} frames=${String(row.frames).padStart(4)} fps=${String(row.framesPerSecond).padStart(5)} visible=${row.visible} exStyle=0x${row.exStyle.toString(16)} pos=(${row.left},${row.top}) source=${row.captureSources.join(',') || '-'} ${row.frames ? '' : 'reason=' + row.reason}`);
    }
    await writeFile(join(runDir, 'toggle-results.json'), JSON.stringify({ runId, steps: results, cleanup: null }, null, 2));
  } catch (caught) {
    error = caught.message;
    console.error(`aborted: ${error}`);
  } finally {
    const closeReport = await helper(['--window-ensure-closed', runId, '20000']).catch(caught => ({ closed: false, error: caught.message }));
    const remaining = await helper(['--window-find']).catch(() => []);
    cleanup = { closeReport, remainingProbeWindows: remaining.length };
    console.log(`[cleanup] closed=${closeReport.closed} remaining=${remaining.length} closedAfterToolWindow=${closeReport.closed}`);
    const report = join(runDir, 'toggle-results.json');
    const existing = JSON.parse(await readFile(report, 'utf8').catch(() => '{"steps":[]}'));
    await writeFile(report, JSON.stringify({ ...existing, cleanup, error }, null, 2));
    console.log(`[report] ${report}`);
  }
  if (error) process.exitCode = 1;
}

main().catch(caught => { console.error(caught); process.exit(1); });
