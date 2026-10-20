import { mkdir, readdir, rename, rm, writeFile, unlink, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FrameHub, streamFrames } from './frame-hub.js';
import { CadenceTraceCollector } from './cadence-trace.js';
import { ProbeJournal } from './probe-log.js';
import { runHelper, waitForWindow, validateLocation, newLocation } from './managed-window.js';
import { createMediaBridge } from './media-bridge.js';
import { SCENES, PREVIEW_SECONDS, PLAYBACK_MODES, DEFAULT_PLAYBACK_MODE, WINDOW_SIZE, resolveSceneRequest, describeScenes, sceneSelection, isSceneId } from './scenes.js';

/**
 * Wallpaper Engine preview for the Whale Appearance theme.
 *
 * The window/capture lifecycle is the one verified by the supervised QA package
 * (qa/wallpaper-preview 0.0.7). What is specific to a real theme:
 *
 *  - no TEMP config file, no development path, no historical PID/HWND: the scene comes
 *    from the Host-side whitelist and the helper is resolved from this package;
 *  - the frontend submits only a constrained action plus a scene id — never a path, an
 *    output directory, a command or a window handle;
 *  - run metadata stays under a controlled per-user directory and is rotated;
 *  - operations are owned: a start, a stop and an unload cannot interleave into two
 *    live windows, and cleanup results are reported instead of being dropped.
 */

export const MAX_RUN_DIRECTORIES = 8;

export { SCENES, PREVIEW_SECONDS, PLAYBACK_MODES, DEFAULT_PLAYBACK_MODE, describeScenes, resolveSceneRequest, sceneSelection, isSceneId };

/** Resolves the helper and log root from this module's own package location. */
export function resolveHostResources(moduleUrl = import.meta.url, env = process.env) {
  const root = resolve(fileURLToPath(new URL('../..', moduleUrl)));
  const localAppData = env.LOCALAPPDATA ?? env.TEMP;
  if (!localAppData) throw new Error('no writable per-user directory is available');
  return { root, helper: join(root, 'assets', 'wallpaper', 'WallpaperProbe.exe'), logRoot: join(localAppData, 'Whale Appearance', 'wallpaper-preview') };
}

/**
 * Host-side availability. The theme is browser-only outside the official Windows desktop; capture
 * additionally needs the packaged helper.
 *
 * This is deliberately ONLY about the machine and the helper. Whether a particular wallpaper can
 * start is decided per selection (the sample by its own file, a catalogue entry by its restricted
 * record), so cancelling a subscription to one scene no longer disables every other one.
 */
export function probeHost({ platform = process.platform, env = process.env, helper, exists = existsSync } = {}) {
  if (platform !== 'win32') return { available: false, reason: 'platform', missing: [] };
  if (!env.LOCALAPPDATA) return { available: false, reason: 'host', missing: [] };
  if (!helper || !exists(helper)) return { available: false, reason: 'helper', missing: [] };
  return { available: true, reason: '', missing: [] };
}

/**
 * Machine readiness plus a per-scene report for the UI. `missing` lists the whitelisted samples whose
 * files are gone; that is information about those samples, not a verdict on the whole service.
 * `catalogUsable` lets the Host say that the bounded library also holds a startable scene, so a
 * machine that unsubscribed the sample still answers "available" for its own list.
 */
export function probeAvailability({ platform = process.platform, env = process.env, helper, scenes = SCENES, exists = existsSync, catalogUsable = false } = {}) {
  const host = probeHost({ platform, env, helper, exists });
  if (!host.available) return { ...host, missing: [] };
  const missing = Object.values(scenes).filter(scene => !exists(scene.project)).map(scene => scene.id);
  if (missing.length === Object.keys(scenes).length && !catalogUsable) return { available: false, reason: 'scene', missing };
  return { available: true, reason: '', missing };
}

/** Keeps the newest `limit` run directories and drops the rest. */
export async function pruneRuns(logRoot, limit = MAX_RUN_DIRECTORIES) {
  let entries;
  try { entries = await readdir(logRoot, { withFileTypes: true }); } catch { return []; }
  const directories = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const removed = [];
  for (const name of directories.slice(0, Math.max(0, directories.length - limit))) {
    try { await rm(join(logRoot, name), { recursive: true, force: true }); removed.push(name); } catch { /* keep the run */ }
  }
  return removed;
}

export async function prepareRunDirectory(logRoot, sceneId, now = Date.now(), suffix = Math.random().toString(16).slice(2, 6)) {
  // Millisecond precision plus a suffix: two starts in the same second must never share
  // a directory, because the native capture refuses to overwrite existing evidence.
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '').replace('Z', '').slice(0, 17);
  const output = join(logRoot, `${stamp}-${suffix}-${sceneId}`);
  await mkdir(output, { recursive: true });
  return output;
}

/**
 * In native Windows production: Queries running process IDs that match the specific location argument.
 * Returns a structured result { ok: true, pids: [...], processes: [...] } on success,
 * or { ok: false, error: ... } on query execution/parsing failure.
 */
export function queryWindowsProcesses(location, { execCommand = execFile, timeoutMs = 3000 } = {}) {
  return new Promise(resolveQuery => {
    if (!location || typeof location !== 'string' || !location.trim()) {
      resolveQuery({ ok: false, error: 'invalid-location', pids: [], processes: [] });
      return;
    }
    const safeLocation = location.replace(/'/g, "''");
    const cmd = `Get-CimInstance Win32_Process -Filter "CommandLine like '%${safeLocation}%'" -ErrorAction Stop | Where-Object { $_.ProcessId -ne $PID } | Select-Object ProcessId, Name, ExecutablePath, CommandLine, CreationDate | ConvertTo-Json -Compress`;

    const onResult = (err, stdout) => {
      if (err) {
        resolveQuery({
          ok: false,
          error: err.message || 'powershell-query-failed',
          pids: [],
          processes: [],
        });
        return;
      }
      if (!stdout || !stdout.trim()) {
        resolveQuery({ ok: true, pids: [], processes: [] });
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch (parseErr) {
        resolveQuery({
          ok: false,
          error: `process-query-parse-failed: ${parseErr.message}`,
          pids: [],
          processes: [],
        });
        return;
      }
      if (!parsed || typeof parsed !== 'object') {
        resolveQuery({
          ok: false,
          error: 'process-query-invalid-structure',
          pids: [],
          processes: [],
        });
        return;
      }
      const rawList = Array.isArray(parsed) ? parsed : [parsed];
      if (rawList.length === 0) {
        resolveQuery({ ok: true, pids: [], processes: [] });
        return;
      }
      const pids = [];
      const processes = [];
      for (const item of rawList) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          resolveQuery({
            ok: false,
            error: 'process-query-contains-invalid-item',
            pids: [],
            processes: [],
          });
          return;
        }
        const rawPid = item.ProcessId ?? item.processId;
        if (rawPid === undefined || rawPid === null) {
          resolveQuery({
            ok: false,
            error: 'process-query-missing-process-id',
            pids: [],
            processes: [],
          });
          return;
        }
        if (typeof rawPid !== 'number' || !Number.isInteger(rawPid) || rawPid <= 0) {
          resolveQuery({
            ok: false,
            error: 'process-query-invalid-pid-type',
            pids: [],
            processes: [],
          });
          return;
        }
        const pid = rawPid;
        const cmdLine = typeof item.CommandLine === 'string' ? item.CommandLine : '';
        if (!cmdLine) {
          resolveQuery({
            ok: false,
            error: 'process-query-missing-command-line',
            pids: [],
            processes: [],
          });
          return;
        }
        const name = typeof item.Name === 'string' ? item.Name : '';
        if (!name) {
          resolveQuery({
            ok: false,
            error: 'process-query-missing-name',
            pids: [],
            processes: [],
          });
          return;
        }
        // Worker processes or processes matching the query must never be silently swallowed.
        // The PowerShell query caller is already excluded via `$PID` in the PowerShell script itself.
        // A record claiming to be a worker or matching the target location must be retained.
        pids.push(pid);
        processes.push({
          pid,
          name,
          executablePath: typeof item.ExecutablePath === 'string' ? item.ExecutablePath : '',
          commandLine: cmdLine,
          creationDate: item.CreationDate,
        });
      }
      resolveQuery({ ok: true, pids, processes });
    };

    if (typeof execCommand !== 'function') {
      resolveQuery({ ok: false, error: 'execCommand is not a function', pids: [], processes: [] });
      return;
    }
    try {
      execCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { timeout: timeoutMs }, onResult);
    } catch (err) {
      resolveQuery({ ok: false, error: err.message || 'exec-failed', pids: [], processes: [] });
    }
  });
}

const ISO_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})$/;

export function parseIsoStartUtc(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(ISO_DATETIME_REGEX);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);
  const rawFrac = match[7] || '';
  const tz = match[8];

  // Calendar validation
  if (month < 1 || month > 12) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month]) return null;

  // Timezone validation & offset in seconds
  let tzOffsetSeconds = 0;
  if (tz !== 'Z') {
    const tzMatch = tz.match(/^([+-])(\d{2}):?(\d{2})$/);
    if (!tzMatch) return null;
    const sign = tzMatch[1] === '+' ? 1 : -1;
    const tzH = parseInt(tzMatch[2], 10);
    const tzM = parseInt(tzMatch[3], 10);
    if (tzH > 23 || tzM > 59) return null;
    tzOffsetSeconds = sign * (tzH * 3600 + tzM * 60);
  }

  // Calculate base UTC seconds without Date.parse normalization bugs
  const baseUtcSec = Math.floor(Date.UTC(year, month - 1, day, hour, minute, second) / 1000) - tzOffsetSeconds;

  // Normalize fraction to 7 digits (.NET ticks / 100ns precision)
  const frac7 = rawFrac.slice(0, 7).padEnd(7, '0');
  // If excess digits beyond 7 are non-zero, reject as exceeding precision
  if (rawFrac.length > 7 && rawFrac.slice(7).replace(/0+$/, '').length > 0) {
    return null;
  }

  const ms = baseUtcSec * 1000 + Math.floor(parseInt(frac7.slice(0, 3), 10));
  return { baseUtcSec, frac7, raw: trimmed, ms };
}

export function areStartUtcsEquivalent(a, b) {
  const parsedA = parseIsoStartUtc(a);
  const parsedB = parseIsoStartUtc(b);
  if (!parsedA || !parsedB) return false;
  return parsedA.baseUtcSec === parsedB.baseUtcSec && parsedA.frac7 === parsedB.frac7;
}

/**
 * In native Windows production: Queries a specific process ID to obtain its creation time in UTC.
 * Preserves full 7-digit ISO round-trip precision matching native System.Diagnostics.Process.StartTime.ToUniversalTime().
 * Returns { ok: true, pid, startUtc } on success or { ok: false, error } on failure.
 */
export function queryWindowsProcessCreationUtc(pid, { execCommand = execFile, timeoutMs = 3000 } = {}) {
  return new Promise(resolveQuery => {
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
      resolveQuery({ ok: false, error: 'invalid-process-id', startUtc: null });
      return;
    }
    const numPid = pid;
    // Query process creation time using .NET System.Diagnostics.Process StartTime.ToUniversalTime().ToString('o')
    // and format as explicit JSON string to prevent PowerShell ConvertTo-Json from degrading to /Date(ms)/.
    const cmd = `$p = Get-Process -Id ${numPid} -ErrorAction Stop; [pscustomobject]@{ ProcessId = $p.Id; CreationDate = $p.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress`;

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      resolveQuery(result);
    };

    const timeoutTimer = setTimeout(() => {
      finish({ ok: false, error: 'process-identity-timeout', startUtc: null });
    }, timeoutMs + 1000);

    const onResult = (err, stdout) => {
      try {
        if (err) {
          return finish({ ok: false, error: err.message || 'process-identity-query-failed', startUtc: null });
        }
        if (!stdout || !stdout.trim()) {
          return finish({ ok: false, error: 'process-identity-empty', startUtc: null });
        }
        let parsed;
        try {
          parsed = JSON.parse(stdout.trim());
        } catch (parseErr) {
          return finish({ ok: false, error: `process-identity-parse-failed: ${parseErr.message}`, startUtc: null });
        }
        // Strict root structure: must be a single non-null plain object, NEVER an array
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return finish({
            ok: false,
            error: Array.isArray(parsed)
              ? 'process-identity-ambiguous-array-records'
              : 'process-identity-invalid-root-structure',
            startUtc: null,
          });
        }
        // Strict ProcessId presence, positive integer type, and match with requested PID
        const rawPid = parsed.ProcessId ?? parsed.processId;
        if (rawPid === undefined || rawPid === null) {
          return finish({ ok: false, error: 'process-identity-missing-pid', startUtc: null });
        }
        if (typeof rawPid !== 'number' || !Number.isInteger(rawPid) || rawPid <= 0) {
          return finish({ ok: false, error: 'process-identity-invalid-pid-type', startUtc: null });
        }
        if (rawPid !== numPid) {
          return finish({
            ok: false,
            error: `process-identity-pid-mismatch: requested ${numPid}, returned ${rawPid}`,
            startUtc: null,
          });
        }
        // Strict CreationDate presence
        const rawDate = parsed.CreationDate ?? parsed.creationDate ?? parsed.StartUtc ?? parsed.startUtc;
        if (rawDate === undefined || rawDate === null) {
          return finish({ ok: false, error: 'process-identity-missing-creation-date', startUtc: null });
        }

        let isoCandidate = null;
        if (typeof rawDate === 'string') {
          const trimmed = rawDate.trim();
          const dateMatch = trimmed.match(/^\/Date\((\d+)(?:[+-]\d+)?\)\/$/);
          if (dateMatch) {
            const ms = Number(dateMatch[1]);
            if (!Number.isFinite(ms) || ms < 0 || ms > 8640000000000000) {
              return finish({ ok: false, error: 'process-identity-date-out-of-range', startUtc: null });
            }
            const d = new Date(ms);
            if (Number.isNaN(d.getTime())) {
              return finish({ ok: false, error: 'process-identity-invalid-date-value', startUtc: null });
            }
            try {
              isoCandidate = d.toISOString();
            } catch (convErr) {
              return finish({ ok: false, error: `process-identity-date-conversion-failed: ${convErr.message}`, startUtc: null });
            }
          } else if (ISO_DATETIME_REGEX.test(trimmed)) {
            isoCandidate = trimmed;
          } else {
            // WMI format YYYYMMDDHHMMSS.ffffff+UUU
            const wmiMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.(\d{6})([+-]\d{3})$/);
            if (wmiMatch) {
              const offsetMin = parseInt(wmiMatch[8], 10);
              const sign = offsetMin >= 0 ? '+' : '-';
              const absMin = Math.abs(offsetMin);
              const tzH = String(Math.floor(absMin / 60)).padStart(2, '0');
              const tzM = String(absMin % 60).padStart(2, '0');
              isoCandidate = `${wmiMatch[1]}-${wmiMatch[2]}-${wmiMatch[3]}T${wmiMatch[4]}:${wmiMatch[5]}:${wmiMatch[6]}.${wmiMatch[7]}0${sign}${tzH}:${tzM}`;
            } else {
              return finish({ ok: false, error: 'process-identity-unsupported-date-format', startUtc: null });
            }
          }
        } else if (typeof rawDate === 'number') {
          if (!Number.isFinite(rawDate) || rawDate < 0 || rawDate > 8640000000000000) {
            return finish({ ok: false, error: 'process-identity-date-out-of-range', startUtc: null });
          }
          const d = new Date(rawDate);
          if (Number.isNaN(d.getTime())) {
            return finish({ ok: false, error: 'process-identity-invalid-date-value', startUtc: null });
          }
          try {
            isoCandidate = d.toISOString();
          } catch (convErr) {
            return finish({ ok: false, error: `process-identity-date-conversion-failed: ${convErr.message}`, startUtc: null });
          }
        } else {
          return finish({ ok: false, error: 'process-identity-invalid-date-type', startUtc: null });
        }

        const verified = isoCandidate ? parseIsoStartUtc(isoCandidate) : null;
        if (!verified) {
          return finish({ ok: false, error: 'process-identity-invalid-creation-date', startUtc: null });
        }
        return finish({ ok: true, pid: rawPid, startUtc: verified.raw });
      } catch (handlerErr) {
        return finish({ ok: false, error: `process-identity-handler-error: ${handlerErr?.message || String(handlerErr)}`, startUtc: null });
      }
    };

    if (typeof execCommand !== 'function') {
      finish({ ok: false, error: 'execCommand is not a function', startUtc: null });
      return;
    }
    try {
      execCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { timeout: timeoutMs }, onResult);
    } catch (err) {
      finish({ ok: false, error: err.message || 'exec-failed', startUtc: null });
    }
  });
}

/**
 * Independently verifies that the capture process and taskbar worker for this run have fully
 * and safely exited, before source window cleanup is allowed to proceed.
 */
export async function verifyIndependentWorkerCleanup({
  location,
  windowHwnd = null,
  windowPid = null,
  expectedStartUtc = null,
  outputDir = null,
  captureChild = null,
  captureClosed = false,
  captureSpawned = false,
  queryProcesses = null,
  readFile: customReadFile = readFile,
  exists = existsSync,
  writeFile: customWriteFile = writeFile,
  taskbarHideActive = true,
  now = Date.now,
}) {
  if (!taskbarHideActive) {
    return { safe: true, reason: 'taskbar-hide-disabled' };
  }

  if (captureChild && !captureClosed && captureChild.exitCode === null) {
    return { safe: false, reason: 'capture process is still running' };
  }

  // Proactively signal worker to exit by writing stop.txt if outputDir exists
  if (outputDir) {
    try {
      const stopFilePath = join(outputDir, 'stop.txt');
      if (!exists(stopFilePath)) {
        await (customWriteFile || writeFile)(stopFilePath, 'stop\n').catch(() => {});
      }
    } catch { /* best effort */ }
  }

  // 1. Process presence in OS
  if (typeof queryProcesses === 'function') {
    const procResult = await queryProcesses(location);
    if (!procResult || procResult.ok !== true) {
      return { safe: false, reason: `process query failed: ${procResult?.error || 'unknown'}` };
    }
    const matchingProcs = procResult.processes || [];
    if (matchingProcs.length > 0) {
      const workerProc = matchingProcs.find(p => p.commandLine && p.commandLine.includes('--taskbar-worker'));
      if (workerProc) {
        return { safe: false, reason: `worker process ${workerProc.pid} is still running` };
      }
      if (captureChild && captureChild.pid && matchingProcs.some(p => p.pid === captureChild.pid)) {
        return { safe: false, reason: `capture process ${captureChild.pid} is still running in OS` };
      }
      return { safe: false, reason: `processes still active for location: ${matchingProcs.map(p => p.pid).join(', ')}` };
    }
  }

  // 2. Terminal proof from taskbar-action.json
  const actionFilePath = outputDir ? join(outputDir, 'taskbar-action.json') : null;
  if (!actionFilePath || !exists(actionFilePath)) {
    if (!captureSpawned) {
      return { safe: true, reason: 'worker not started before capture process was spawned' };
    }
    return { safe: false, reason: 'taskbar-action.json missing; cannot confirm worker state' };
  }

  let content;
  try {
    content = await (customReadFile || readFile)(actionFilePath, 'utf8');
  } catch (err) {
    return { safe: false, reason: `failed to read taskbar-action.json: ${err.message}` };
  }
  let record;
  try {
    record = JSON.parse(content);
  } catch (err) {
    return { safe: false, reason: `corrupted taskbar-action.json: ${err.message}` };
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { safe: false, reason: 'invalid taskbar-action.json structure' };
  }
  if (record.schemaVersion !== 1) {
    return { safe: false, reason: `unsupported taskbar-action schemaVersion: ${record.schemaVersion}` };
  }
  if (record.location !== location) {
    return { safe: false, reason: `taskbar-action location mismatch: expected ${location}, found ${record.location}` };
  }

  const pendingStages = ['action-pending', 'action-unconfirmed', 'pending'];
  if (pendingStages.includes(record.stage)) {
    return { safe: false, reason: `taskbar-action settled in pending stage: ${record.stage}` };
  }

  if (!record.requestedIdentity || typeof record.requestedIdentity !== 'object' || Array.isArray(record.requestedIdentity)) {
    return { safe: false, reason: 'taskbar-action missing requestedIdentity' };
  }
  const reqHwnd = Number(record.requestedIdentity.hwnd);
  if (!Number.isInteger(reqHwnd) || reqHwnd <= 0) {
    return { safe: false, reason: 'taskbar-action missing or invalid requestedIdentity.hwnd' };
  }
  if (windowHwnd && reqHwnd !== windowHwnd) {
    return { safe: false, reason: `taskbar-action hwnd mismatch: expected ${windowHwnd}, found ${reqHwnd}` };
  }

  const reqPid = Number(record.requestedIdentity.pid);
  if (!Number.isInteger(reqPid) || reqPid <= 0) {
    return { safe: false, reason: 'taskbar-action missing or invalid requestedIdentity.pid' };
  }
  if (windowPid && reqPid !== windowPid) {
    return { safe: false, reason: `taskbar-action pid mismatch: expected ${windowPid}, found ${reqPid}` };
  }

  if (!expectedStartUtc || typeof expectedStartUtc !== 'string' || !expectedStartUtc.trim()) {
    return { safe: false, reason: 'missing expected creation identity baseline for window' };
  }
  const parsedExpected = parseIsoStartUtc(expectedStartUtc);
  if (!parsedExpected) {
    return { safe: false, reason: `invalid expectedStartUtc format: ${expectedStartUtc}` };
  }

  if (!record.requestedIdentity.startUtc || typeof record.requestedIdentity.startUtc !== 'string') {
    return { safe: false, reason: 'taskbar-action missing requestedIdentity.startUtc' };
  }
  const parsedReqStart = parseIsoStartUtc(record.requestedIdentity.startUtc);
  if (!parsedReqStart) {
    return { safe: false, reason: `taskbar-action invalid requestedIdentity.startUtc format: ${record.requestedIdentity.startUtc}` };
  }
  const currentNowMs = typeof now === 'function' ? now() : Date.now();
  if (parsedReqStart.ms > currentNowMs + 60000) {
    return { safe: false, reason: `taskbar-action requestedIdentity.startUtc is in the future: ${record.requestedIdentity.startUtc}` };
  }

  if (!areStartUtcsEquivalent(record.requestedIdentity.startUtc, expectedStartUtc)) {
    return { safe: false, reason: `taskbar-action startUtc mismatch with expected: expected ${expectedStartUtc}, found ${record.requestedIdentity.startUtc}` };
  }

  if (record.beforeIdentity && typeof record.beforeIdentity === 'object' && record.beforeIdentity.startUtc) {
    if (!areStartUtcsEquivalent(record.requestedIdentity.startUtc, record.beforeIdentity.startUtc)) {
      return { safe: false, reason: 'taskbar-action startUtc mismatch between requestedIdentity and beforeIdentity' };
    }
  }

  // Branch A: Terminal proof of worker stopped before action
  if (record.stage === 'stopped-before-action') {
    if (!('action' in record) || !('trigger' in record)) {
      return { safe: false, reason: 'taskbar-action stopped-before-action missing action or trigger property' };
    }
    if (record.trigger !== null) {
      return { safe: false, reason: 'taskbar-action stopped-before-action trigger is not null' };
    }
    if (record.action !== null) {
      if (typeof record.action !== 'object' || Array.isArray(record.action)) {
        return { safe: false, reason: 'taskbar-action stopped-before-action has invalid action property' };
      }
      if (record.action.started !== false) {
        return { safe: false, reason: 'taskbar-action stopped-before-action action.started is not false' };
      }
      if (record.action.cleanupSafe !== true) {
        return { safe: false, reason: 'taskbar-action stopped-before-action action.cleanupSafe is not true' };
      }
      if (record.action.pending !== false) {
        return { safe: false, reason: 'taskbar-action stopped-before-action action.pending is not false' };
      }
      if (record.action.timedOut !== false) {
        return { safe: false, reason: 'taskbar-action stopped-before-action action.timedOut is not false' };
      }
      if (record.action.terminated !== false) {
        return { safe: false, reason: 'taskbar-action stopped-before-action action.terminated is not false' };
      }
      if (record.action.exited !== false && record.action.exited !== null) {
        return { safe: false, reason: 'taskbar-action stopped-before-action action.exited is not false or null' };
      }
    }
    return { safe: true, record, reason: 'taskbar worker stopped before action in terminal state' };
  }

  // Branch B: Terminal proof of action executed
  const validSettledStages = ['action-done', 'action-failed', 'failed', 'done', 'success', 'blocked'];
  if (!validSettledStages.includes(record.stage)) {
    return { safe: false, reason: `unsettled taskbar stage: ${record.stage}` };
  }

  if (!record.action || typeof record.action !== 'object' || Array.isArray(record.action)) {
    return { safe: false, reason: 'taskbar-action missing action object' };
  }
  if (record.action.cleanupSafe !== true) {
    return { safe: false, reason: `taskbar worker action cleanupSafe is not true (got ${record.action.cleanupSafe})` };
  }
  if (record.action.exited !== true) {
    return { safe: false, reason: `taskbar worker action not confirmed exited (got exited=${record.action.exited})` };
  }
  if (record.action.started !== true) {
    return { safe: false, reason: `taskbar worker action not marked started (got started=${record.action.started})` };
  }
  if (record.action.pending !== false) {
    return { safe: false, reason: `taskbar worker action pending is not false (got pending=${record.action.pending})` };
  }
  if (record.action.timedOut !== false) {
    return { safe: false, reason: `taskbar worker action timedOut is not false (got timedOut=${record.action.timedOut})` };
  }
  if (record.action.terminated !== false) {
    return { safe: false, reason: `taskbar worker action terminated is not false (got terminated=${record.action.terminated})` };
  }

  return { safe: true, record, reason: 'taskbar worker confirmed exited safely via action report' };
}

/**
 * One preview run. `create` builds this run's instance; `stop` is idempotent and always
 * ends by proving this run's window is gone. Injectable for tests: spawnChild,
 * helperRun, sleep, now, exists.
 */
export function createPreviewSession(options = {}) {
  const {
    spawnChild = spawn,
    helperRun = (helper, args) => runHelper(spawn, helper, args),
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    now = Date.now,
    exists = existsSync,
    sceneResolver = null,
    env = process.env,
    childExitTimeoutMs = 12000,
    childKillTimeoutMs = 2000,
    cadenceTrace = false,
    writeFile: customWriteFile = null,
    unlink: customUnlink = null,
    rename: customRename = null,
    readFile: customReadFile = null,
    execCommand: customExecCommand = null,
    queryProcesses: customQueryProcesses = null,
    queryProcessIdentity = null,
  } = options;
  const cadenceTraceEnabled = cadenceTrace === true || env.WM_WALLPAPER_CADENCE_TRACE === '1';
  const issuedConnections = new Set();
  const hostTrace = new CadenceTraceCollector({ enabled: cadenceTraceEnabled, clockDomain: 'host-mono' });
  const clientTrace = new CadenceTraceCollector({ enabled: cadenceTraceEnabled, clockDomain: 'client-mono' });
  clientTrace.issuedConnections = issuedConnections;
  const hub = new FrameHub({ cadenceTrace: hostTrace, clientTrace });
  const journal = new ProbeJournal();

  let closeAttempts = 0;
  let config = null;
  let child = null;
  let childClosed = false;
  let mediaLease = null;
  let terminalTaskbarHide = null;
  let stopping = false;
  let stopRequested = false;
  let failure = null;
  let nativeStatus = null;
  let clientStatus = null;
  let location = null;
  let windowCreated = false;
  let windowPid = null;
  let windowStartUtc = null;
  let captureStarted = false;
  let cleaning = null;
  let attached = false;
  let cleanupResult = null;
  let windowAcquisitionWait = null;
  let reportTimer = null;
  let killTimer = null;

  const helper = args => helperRun(config.helper, args);

  const report = () => ({
    transport: 'pipe-stream',
    childPid: child?.pid ?? null,
    window: { location, pid: windowPid, created: windowCreated, captureStarted, cleanup: cleanupResult },
    stopping,
    failure,
    native: nativeStatus,
    diagnostics: journal.snapshot(),
    client: clientStatus,
    ...hub.snapshot(),
  });

  /** True only when this run's window is proven gone. */
  const isClosed = () => cleanupResult?.closed === true;

  const writeReport = async name => {
    if (!config?.output) return;
    try {
      let timer = null;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 200); });
      await Promise.race([(customWriteFile || writeFile)(join(config.output, name), JSON.stringify(report(), null, 2)), timeout]);
      if (timer) clearTimeout(timer);
    } catch { /* evidence is best effort */ }
  };

  let activeWriteTask = null;
  let activeWriteToken = null;

  const writeCadenceTrace = async () => {
    if (!config?.output || !cadenceTraceEnabled) return;
    if (activeWriteTask) {
      let reentrantTimer = null;
      const timeout = new Promise((_, reject) => {
        reentrantTimer = setTimeout(() => reject(new Error('timeout')), 200);
      });
      return Promise.race([activeWriteTask, timeout])
        .catch(() => {
          if (activeWriteToken) activeWriteToken.cancelled = true;
          hostTrace.degraded = true;
          hostTrace.degradeReason = 'export-timeout';
          clientTrace.degraded = true;
          clientTrace.degradeReason = 'export-timeout';
        })
        .finally(() => {
          if (reentrantTimer) clearTimeout(reentrantTimer);
        });
    }

    const token = { cancelled: false };
    activeWriteToken = token;
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        token.cancelled = true;
        reject(new Error('timeout'));
      }, 200);
    });

    const writeTask = (async () => {
      let hostTmp = null;
      let clientTmp = null;
      let hostFinal = null;
      let clientFinal = null;
      try {
        const hostSnapshot = hostTrace.snapshot();
        const clientSnapshot = clientTrace.snapshot();

        const hostJson = JSON.stringify(hostSnapshot, null, 2);
        const clientJson = JSON.stringify(clientSnapshot, null, 2);

        hostTmp = join(config.output, `cadence-trace-host.${Date.now()}-${Math.random().toString(36).slice(2, 6)}.tmp`);
        clientTmp = join(config.output, `cadence-trace-client.${Date.now()}-${Math.random().toString(36).slice(2, 6)}.tmp`);

        await (customWriteFile || writeFile)(hostTmp, hostJson);
        if (token.cancelled) throw new Error('cancelled');

        await (customWriteFile || writeFile)(clientTmp, clientJson);
        if (token.cancelled) throw new Error('cancelled');

        const hostDest = join(config.output, 'cadence-trace-host.json');
        const clientDest = join(config.output, 'cadence-trace-client.json');

        if (token.cancelled) throw new Error('cancelled');

        await (customRename || rename)(hostTmp, hostDest);
        hostTmp = null;
        hostFinal = hostDest;

        if (token.cancelled) {
          try { await (customUnlink || unlink)(hostFinal); } catch {}
          hostFinal = null;
          throw new Error('cancelled');
        }

        await (customRename || rename)(clientTmp, clientDest);
        clientTmp = null;
        clientFinal = clientDest;

        if (token.cancelled) {
          try { await (customUnlink || unlink)(hostFinal); } catch {}
          try { await (customUnlink || unlink)(clientFinal); } catch {}
          hostFinal = null;
          clientFinal = null;
          throw new Error('cancelled');
        }
      } catch (err) {
        if (hostTmp) { try { await (customUnlink || unlink)(hostTmp); } catch {} }
        if (clientTmp) { try { await (customUnlink || unlink)(clientTmp); } catch {} }
        if (hostFinal) { try { await (customUnlink || unlink)(hostFinal); } catch {} }
        if (clientFinal) { try { await (customUnlink || unlink)(clientFinal); } catch {} }
        const reason = token.cancelled ? 'export-timeout' : String(err?.message ?? err);
        hostTrace.degraded = true;
        hostTrace.degradeReason = reason;
        clientTrace.degraded = true;
        clientTrace.degradeReason = reason;
      } finally {
        activeWriteTask = null;
        activeWriteToken = null;
      }
    })();

    activeWriteTask = writeTask;

    return Promise.race([writeTask, timeout])
      .catch(err => {
        token.cancelled = true;
        const reason = err?.message === 'timeout' ? 'export-timeout' : String(err?.message ?? err);
        hostTrace.degraded = true;
        hostTrace.degradeReason = reason;
        clientTrace.degraded = true;
        clientTrace.degradeReason = reason;
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
  };

  /**
   * One close attempt. Idempotent while it is in flight, but a finished attempt that
   * could NOT prove the window gone must not freeze the session forever: a later stop
   * retries the close instead of returning the cached failure.
   *
   * The reporting loop and the capture subscriptions are removed for the whole close. Only
   * an unproven close re-attaches them (the capture may still be alive and its evidence is
   * still worth keeping), so a successful stop leaves no timer and no duplicate listener.
   */
  const waitForChildClose = async timeoutMs => {
    if (!child || childClosed || typeof child.once !== "function") return true;
    return new Promise(resolve => {
      let timer = null;
      const onDone = () => {
        if (timer) clearTimeout(timer);
        child?.removeListener('close', onDone);
        childClosed = true;
        resolve(true);
      };
      timer = setTimeout(() => {
        child?.removeListener('close', onDone);
        resolve(childClosed);
      }, timeoutMs);
      timer?.unref?.();
      child.once('close', onDone);
    });
  };

  const runClose = async () => {
    closeAttempts += 1;
    stopping = true;
    stopReporting();
    hub.close();
    child?.stdin?.end('stop\n');
    await writeReport('preview-final.json');

    // Bounded verdict: a stop that lands while the window is still being created must
    // still close the window that appears afterwards.
    if (windowAcquisitionWait) { try { await windowAcquisitionWait; } catch { /* reported by create/stop */ } }

    // Controlled shutdown sequence: await capture process close (including stdio drain)
    let childClosedInBudget = await waitForChildClose(childExitTimeoutMs);
    let forceKilled = false;
    if (!childClosedInBudget && child && !childClosed && (child.exitCode === null || child.exitCode === undefined)) {
      forceKilled = true;
      try { child.kill(); } catch { /* best effort */ }
      childClosedInBudget = await waitForChildClose(childKillTimeoutMs);
    }

    // Verify worker exit safety:
    // Host accepts explicit terminal states:
    // 1) Fallback switch disabled (WM_WALLPAPER_TASKBAR_HIDE === '0'), so no worker was requested.
    // 2) Worker confirmed not started (attempted === false, stage === 'armed' or 'disabled' or 'stopped-before-action').
    // 3) Worker confirmed exited safely (cleanupSafe === true AND stage is in a terminal settled state, NOT pending).
    // Any missing status on abnormal exit, force-killed child, unclosed stream, pending state, or cleanupSafe === false is rejected.
    const taskbarHideActive = env.WM_WALLPAPER_TASKBAR_HIDE !== '0';
    let workerCleanupSafe = false;
    let verificationError = null;

    if (!taskbarHideActive) {
      workerCleanupSafe = true;
    } else if (child) {
      let streamConfirmed = false;
      if (!forceKilled && childClosedInBudget && (child.exitCode === null || child.exitCode === 0)) {
        const th = terminalTaskbarHide;
        if (th && typeof th === 'object' && th.cleanupSafe === true) {
          const pendingStages = ['action-pending', 'action-unconfirmed', 'pending'];
          if (!pendingStages.includes(th.stage)) {
            const validNotStarted = th.attempted === false && ['armed', 'disabled', 'stopped-before-action', 'observing'].includes(th.stage);
            const validSettled = ['action-done', 'action-failed', 'failed', 'done', 'success', 'armed', 'stopped-before-action'].includes(th.stage);
            streamConfirmed = Boolean(validNotStarted || validSettled);
          }
        }
      }

      if (streamConfirmed) {
        workerCleanupSafe = true;
      } else if (closeAttempts > 1) {
        const activeQuery = customQueryProcesses || (loc => queryWindowsProcesses(loc, { execCommand: customExecCommand || execFile }));
        const verification = await verifyIndependentWorkerCleanup({
          location,
          windowHwnd: config?.window ?? null,
          windowPid,
          expectedStartUtc: windowStartUtc,
          outputDir: config?.output ?? null,
          captureChild: child,
          captureClosed: childClosed,
          captureSpawned: Boolean(child),
          queryProcesses: activeQuery,
          readFile: customReadFile || readFile,
          exists,
          writeFile: customWriteFile || writeFile,
          taskbarHideActive,
          now,
        });
        if (verification.safe === true) {
          workerCleanupSafe = true;
        } else {
          workerCleanupSafe = false;
          verificationError = verification.reason;
        }
      }
    } else {
      workerCleanupSafe = !forceKilled;
    }

    if (!childClosedInBudget || !workerCleanupSafe) {
      cleanupResult = {
        outcome: 'worker-unconfirmed',
        closed: false,
        error: !childClosedInBudget && child?.exitCode === null
          ? 'capture process did not exit within budget'
          : forceKilled
            ? 'capture process force-killed; worker exit could not be confirmed'
            : verificationError || 'worker exit could not be confirmed',
      };
      if (mediaLease) cleanupResult.error = 'MEDIA_BRIDGE_WORKER: source or worker exit unconfirmed; retain media and retry cleanup';
      failure = `Window cleanup incomplete (worker-unconfirmed): ${cleanupResult.error}`;
      reattach();
      if (cadenceTraceEnabled) {
        await clientTrace.waitForClientFinalize?.(100, issuedConnections);
      }
      await writeCadenceTrace();
      await writeReport('preview-final.json');
      return cleanupResult;
    }

    detach();

    let nextCleanupResult = cleanupResult;
    if (windowCreated && location) {
      const closeArgs = ['--window-ensure-closed', location, '15000'];
      if (Number.isInteger(windowPid) && windowPid > 0) closeArgs.push('--expect-pid', String(windowPid));
      try {
        const closed = await helper(closeArgs);
        nextCleanupResult = { outcome: closed?.outcome ?? null, closed: closed?.closed === true, waitedMs: closed?.waitedMs ?? null, error: mediaLease && closed?.error ? 'MEDIA_BRIDGE_CLOSE: close failed; retain files and retry cleanup' : closed?.error ?? null };
      } catch (error) {
        nextCleanupResult = { outcome: 'error', closed: false, error: mediaLease ? 'MEDIA_BRIDGE_CLOSE: close failed; retain files and retry cleanup' : error.message };
      }
      if (nextCleanupResult.closed !== true) {
        const attempt = Number.isInteger(cleanupResult?.attempts) ? cleanupResult.attempts + 1 : 1;
        nextCleanupResult = { ...nextCleanupResult, attempts: attempt };
        failure = `Window cleanup incomplete (${nextCleanupResult.outcome ?? 'unknown'}): ${nextCleanupResult.error ?? 'no result'}`;
        // The capture may still be running this window: keep its evidence flowing until the
        // next attempt proves the window gone.
        reattach();
      } else if (failure?.startsWith('Window cleanup incomplete')) {
        failure = null;
      }
    }
    detach();
    if (cadenceTraceEnabled) {
      await clientTrace.waitForClientFinalize?.(100, issuedConnections);
    }
    if (mediaLease && (!windowCreated || nextCleanupResult?.closed === true)) {
      try {
        await mediaLease.release({ neverOpened: !windowCreated && !child, closed: nextCleanupResult?.closed === true, workersExited: childClosedInBudget && workerCleanupSafe });
        mediaLease = null;
      } catch (error) {
        nextCleanupResult = { outcome: 'media-bridge-retained', closed: false, error: error.message };
        failure = error.message;
      }
    }
    cleanupResult = nextCleanupResult;
    await writeCadenceTrace();
    await writeReport('preview-final.json');
    return cleanupResult;
  };

  let inClose = false;
  const cleanup = () => {
    if (inClose) return cleaning;
    inClose = true;
    cleaning = (async () => {
      try {
        return await runClose();
      } finally {
        cleaning = null;
        inClose = false;
      }
    })();
    return cleaning;
  };

  const stop = () => {
    stopRequested = true;
    if (inClose || cleaning) return cleaning;            // one in-flight close stays idempotent
    if (cleanupResult?.closed === true) return Promise.resolve(cleanupResult);
    return cleanup();                                    // retry after an unproven close
  };

  async function create({ helper: helperPath, output, scene, offscreenStart = false, mediaLease: preparedMedia = null }) {
    if (cleaning) throw new Error('this playback run has already ended');
    if (config) throw new Error('this session already started a run');
    mediaLease = preparedMedia;
    // The selection was already re-verified by the caller against the Host's own snapshot; only the
    // id and the re-proved project file reach this point, and neither comes from the request body.
    // The legacy `{ scene, mode }` form is still accepted for a caller that resolved the sample
    // itself (the contract tests and the pre-library path), and it never carries a catalogue id.
    const selection = scene && typeof scene === 'object' ? scene : {};
    const legacyScene = typeof selection.sceneId === 'string' ? null : sceneSelection(selection);
    const request = resolveSceneRequest(
      { scene: selection.sceneId ?? legacyScene.sceneId, mode: selection.mode, seconds: selection.seconds },
      { exists, resolveProject: () => {
        const project = typeof selection.project === 'string' && selection.project ? selection.project : SCENES.lucy.project;
        const sceneId = selection.sceneId ?? legacyScene.sceneId;
        // Only the sample may fall back to the whitelisted project; anything else must carry the
        // project file the Host just re-verified.
        if (sceneId !== 'lucy' && !(typeof selection.project === 'string' && selection.project)) throw new Error(`unknown scene: ${String(sceneId)}`);
        return project;
      } },
    );
    if (/\.mp4$/i.test(request.project) && (!mediaLease || mediaLease.path !== request.project || !/^[\x20-\x7e]+$/.test(request.project))) {
      throw new Error('MEDIA_BRIDGE_SELECTION: video requires a verified Host media lease');
    }
    config = {
      helper: helperPath,
      output,
      // The window name is always this round's own. A caller-supplied name is ignored, so a stale
      // or crafted value can never name somebody else's window.
      location: validateLocation(newLocation(now())),
      project: request.project,
      mode: request.mode,
      seconds: request.seconds,
      width: request.width,
      height: request.height,
      fps: request.fps,
      sceneId: request.sceneId,
      // The start-off-screen experiment stays off unless the caller asks for it; the
      // accepted order (create visible, capture, then move off screen) remains the default.
      offscreenStart,
    };
    location = config.location;
    if (cadenceTraceEnabled) {
      hostTrace.runId = location;
      clientTrace.runId = location;
      hub.runId = location;
    }
    if (stopRequested) { await stop(); throw new Error('this playback run was stopped before it started'); }

    // Recheck the published copy and original declaration immediately before the side effect.
    if (mediaLease) {
      await mediaLease.verify();
      if (stopRequested) { await stop(); throw new Error('this playback run was stopped before it started'); }
    }

    // 1. Create this run's own window; the name is claimed before the side effect.
    windowCreated = true;
    try {
      const polls = waitForWindow(helper, location, { sleep });
      const openArgs = ['--we-open', location, config.project, String(config.width), String(config.height)];
      if (config.offscreenStart) openArgs.push('--initial-offscreen');
      const opened = helper(openArgs);
      const settledWithFailure = opened.then(() => null, error => error);
      let openSettled = false;
      settledWithFailure.then(() => { openSettled = true; }).catch(() => {});
      const createWait = Promise.race([
        settledWithFailure.then(() => 'settled'),
        sleep(6000).then(() => 'grace'),
      ]).catch(() => 'grace');
      const extend = () => waitForWindow(helper, location, { sleep, fastAttempts: 0, graceAttempts: 0, attempts: 100, delayMs: 100 });
      windowAcquisitionWait = (async () => {
        const phase = await createWait;
        const openError = await settledWithFailure;
        const found = await polls;
        if (found) return found;
        const late = phase === 'settled' ? null : await extend();
        if (openError) throw openError;
        return late;
      })();
      windowAcquisitionWait.catch(() => {});

      const window = await polls;
      const openFailure = await settledWithFailure;
      if (openFailure) {
        const late = await windowAcquisitionWait.catch(() => null);
        if (late) {
          config.window = late.hwnd;
          windowPid = Number.isInteger(late.pid) && late.pid > 0 ? late.pid : null;
          let lateStartUtc = late.startUtc || late.StartUtc || null;
          if (!lateStartUtc && windowPid) {
            if (typeof queryProcessIdentity === 'function') {
              const res = await queryProcessIdentity(windowPid);
              if (res && res.ok && res.startUtc) lateStartUtc = res.startUtc;
            } else {
              const res = await queryWindowsProcessCreationUtc(windowPid, { execCommand: customExecCommand || execFile });
              if (res && res.ok && res.startUtc) lateStartUtc = res.startUtc;
            }
          }
          windowStartUtc = lateStartUtc;
        }
        throw openFailure;
      }
      if (!window) {
        failure ??= 'Window setup failed: the window did not appear';
        await stop();
        throw new Error(failure);
      }
      config.window = window.hwnd;
      windowPid = Number.isInteger(window.pid) && window.pid > 0 ? window.pid : null;
      let startUtc = window.startUtc || window.StartUtc || null;
      if (!startUtc && windowPid) {
        if (typeof queryProcessIdentity === 'function') {
          const res = await queryProcessIdentity(windowPid);
          if (res && res.ok && res.startUtc) startUtc = res.startUtc;
        } else {
          const res = await queryWindowsProcessCreationUtc(windowPid, { execCommand: customExecCommand || execFile });
          if (res && res.ok && res.startUtc) startUtc = res.startUtc;
        }
      }
      windowStartUtc = startUtc;
      nativeStatus = { windowReady: { hwnd: window.hwnd, pid: window.pid, visible: window.visible, left: window.left, top: window.top } };
    } catch (error) {
      failure = failure ?? (mediaLease ? 'MEDIA_BRIDGE_OPEN: video source could not be opened; stop and retry after checking the file' : `Window setup failed: ${error.message}`);
      await stop();
      throw new Error(failure);
    }
    if (stopRequested) { await stop(); throw new Error('this playback run was stopped before capture started'); }

    // 2. Capture. The native side builds the capture item while the window is still
    //    visible (WGC refuses hidden and tool windows), then the window is tucked away.
    //    Daily mode has no timer at all: the capture loop runs until this run is stopped
    //    by the user, the child exits, the source window goes away, or the parent pipe
    //    closes. Preview mode keeps its bounded seconds.
    const durationArg = config.mode === 'daily' ? '--forever' : String(config.seconds);
    const childArgs = [String(config.window), output, durationArg, String(config.fps), 'pipe',
      '--owned-location', location];
    if (env.WM_WALLPAPER_TASKBAR_HIDE !== '0') {
      childArgs.push('--taskbar-hide');
    }
    if (cadenceTraceEnabled) {
      childArgs.push('--cadence-trace');
    }
    child = spawnChild(config.helper, childArgs, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.on('error', () => {});
    attachCapture();
    return report();
  }

  /**
   * Subscribe to the capture child: frames, native status and its exit. The listeners are
   * named so they can be removed again; `attachCapture` refuses to install a second copy,
   * which is what keeps a close retry from accumulating listeners and log timers.
   */
  const onChildStdout = data => { try { hub.push(data); } catch { /* keep the last frame */ } };
  const onChildError = error => { failure = error.message; stop(); };
  const onChildClose = code => {
    childClosed = true;
    clearTimeout(killTimer);
    stopReporting();
    journal.finish();
    try { hub.decoder.finish(); } catch { /* keep the last frame */ }
    if (code && !stopping) failure ??= `Capture exited: ${code}`;
    stop();
  };
  const onChildStderr = data => {
    for (const entry of journal.push(data)) {
      if (entry.level === 'error' && !stopping) { failure ??= journal.failureText(entry); stop(); }
      if (entry.scope === 'Status' || entry.scope === 'Summary') {
        try {
          const value = JSON.parse(entry.message);
          const record = value.record && typeof value.record === 'object' ? value.record : value;
          const captureSource = record.captureSource ?? value.captureSource;
          const hidePayload = value.taskbarHide ?? record.taskbarHide;
          if (entry.scope === 'Summary' && hidePayload && typeof hidePayload === 'object') {
            terminalTaskbarHide = hidePayload;
          }
          nativeStatus = {
            ...nativeStatus,
            ...record,
            ...(value.taskbarHide ? { taskbarHide: value.taskbarHide } : {}),
            ...(value.reason ? { reason: value.reason } : {}),
            ...(value.windowClose ? { windowClose: value.windowClose } : {})
          };
          if (captureSource === 'window' && !captureStarted) {
            captureStarted = true;
            const args = ['--window-apply', String(config.window), 'offscreen', '--location', location];
            if (windowPid) args.push('--pid', String(windowPid));
            (async () => {
              if (config.offscreenStart) {
                const area = await helper(['--window-onscreen', String(config.window)]);
                if (stopRequested) return null;
                const source = area?.window;
                if (area?.visibleArea === 0 && source?.hwnd === config.window && source.title === location &&
                    source.pid === windowPid && source.visible && !source.iconic && !source.cloaked) {
                  // Already outside the desktop. Repositioning/resizing again inflated the capture
                  // through DPI virtualization; preserve the actual source size after verification.
                  return { ...source, strategy: 'initial-position' };
                }
              }
              if (stopRequested) return null;
              return { ...await helper(args), strategy: 'capture-then-tuck' };
            })()
              .then(state => { if (state && !stopRequested) nativeStatus = { ...nativeStatus, tucked: { visible: state.visible, left: state.left, top: state.top, width: state.width, height: state.height, strategy: state.strategy } }; })
              .catch(error => { if (stopRequested) return; nativeStatus = { ...nativeStatus, tuckError: error.message }; failure ??= `Window tuck failed: ${error.message}`; stop(); });
          }
        } catch { /* keep the last readable status */ }
      }
    }
  };

  const stopReporting = () => {
    if (reportTimer) { clearInterval(reportTimer); reportTimer = null; }
  };

  function attachCapture() {
    if (attached || !child) return false;
    attached = true;
    child.stdout.on('data', onChildStdout);
    child.stderr.on('data', onChildStderr);
    child.on('error', onChildError);
    child.on('close', onChildClose);
    reportTimer = setInterval(() => { writeReport('preview-status.json'); }, 1000);
    reportTimer.unref();
    return true;
  }

  /** Remove every capture subscription and the reporting loop; safe to call repeatedly. */
  function detach() {
    stopReporting();
    if (!attached || !child) return false;
    attached = false;
    child.stdout.off('data', onChildStdout);
    child.stderr.off('data', onChildStderr);
    child.off('error', onChildError);
    child.off('close', onChildClose);
    return true;
  }

  /**
   * Re-take ownership of a capture child that is still running after an unproven close.
   * Only that case re-attaches: a successful stop must leave no timer and no listener behind.
   */
  const reattach = () => {
    if (!child || child.exitCode !== null) return false;
    detach();
    return attachCapture();
  };

  return {
    hub,
    journal,
    report,
    create,
    stop,
    reattach,
    isClosed,
    ending: () => cleaning !== null,
    /** Test/diagnostic view of the lifecycle bookkeeping. */
    stats: () => ({
      attached,
      reporting: reportTimer !== null,
      closeListeners: child ? child.listenerCount('close') : 0,
      stdoutListeners: child?.stdout ? child.stdout.listenerCount('data') : 0,
      stderrListeners: child?.stderr ? child.stderr.listenerCount('data') : 0,
      cleanup: cleanupResult,
    }),
    state: () => ({ config, location, windowCreated, windowPid, captureStarted, stopRequested, cleanup: cleanupResult }),
    setClientStatus: value => { clientStatus = value; },
    cadenceTrace: { host: hostTrace, client: clientTrace },
    issuedConnections,
    hasInternalCadenceDrain: true,
  };
}

/**
 * Host routes for the theme.
 *
 * Ownership rules (see the review of rc.2):
 *  - the operation lock is taken before the first await, so two starts cannot both pass
 *    the "already running" check;
 *  - a stop or unload invalidates an in-flight start: it bumps the generation and the
 *    start aborts before it builds anything;
 *  - while cleanup runs, ownership is retained, so a new start cannot overlap a window
 *    that is still closing;
 *  - when a close cannot be proven, the failed run is retained and reported, so the UI
 *    can say "cleanup failed" instead of showing a false success.
 *
 * The packaged native helper starts the source at a verified positive screen-external position.
 * WM_WALLPAPER_OFFSCREEN_START=0 or an explicit false retains the old create/capture/tuck order.
 */
export function registerWallpaperRoutes(ctx, { scenes = SCENES, helper, logRoot, sessionFactory = createPreviewSession, exists = existsSync, offscreenStart = process.env.WM_WALLPAPER_OFFSCREEN_START !== '0', onWarn = message => console.warn(message), library = null, verifyScene = null, cadenceTrace = false, queryProcesses = null, execCommand = null, readFile = null, queryProcessIdentity = null, mediaBridge = null } = {}) {
  const bridge = mediaBridge ?? createMediaBridge();
  const buildSession = (opts = {}) => sessionFactory({ exists, cadenceTrace: opts.cadenceTrace ?? cadenceTrace, queryProcesses, execCommand, readFile, queryProcessIdentity });
  // The Host's last failure to re-verify a selection, surfaced to the UI instead of being swallowed.
  let lastSelectionError = null;

  let ownership = null;          // { kind: 'start' | 'stop', generation, promise }
  let generation = 0;
  // Bumped by every EXTERNAL stop and by unloading. A pending start/restart compares it to the value
  // it captured, so a cancellation that happened during a long verification cannot be forgotten and
  // the late request cannot pick up the newest ownership and start anyway.
  let cancelGeneration = 0;
  let session = null;            // live or not-yet-proven-closed run
  let lastCleanup = null;        // last close outcome, kept for the UI and for retrying
  let lastError = '';

  const claim = kind => {
    // The cancellation marker is captured with the token: an external stop or an unload during this
    // operation makes the token stale even though the operation itself keeps owning the lock.
    const token = { kind, generation, cancelGeneration, promise: null };
    ownership = token;
    return token;
  };
  const release = token => { if (ownership === token) ownership = null; };
  const isCurrent = token => generation === token.generation && cancelGeneration === token.cancelGeneration;

  /** What the UI may know about the list: counts, health and the verified sample, never a path. */
  const libraryPayload = () => {
    if (!library) {
      return { configured: false, loaded: false, state: 'unconfigured', items: 0, rootsConfigured: 0, rootsAvailable: 0, truncated: false, scannedAt: null, scanMs: null, error: null };
    }
    const health = library.health();
    return {
      configured: library.roots.length > 0,
      loaded: library.hasSnapshot(),
      state: library.hasSnapshot() ? 'ready' : health.state,
      items: health.items,
      rootsConfigured: health.rootsConfigured,
      rootsAvailable: health.rootsAvailable,
      truncated: health.truncated,
      scannedAt: health.scannedAt,
      scanMs: health.scanMs,
      rootWarnings: health.rootWarnings ?? [],
      error: health.error,
    };
  };

  /**
   * Re-verify one selection against the Host's own snapshot and files. This runs before any run
   * resource exists and after the ownership token was taken, so a stop or unload can still
   * invalidate it; it returns the id, the re-proved project file and the mode, never a path taken
   * from the request.
   */
  /**
   * The ONLY fields a request may contribute to a start. Everything else in the body (a path, a
   * project, a pre-verified shape, a window name) is dropped here, so no request field can ever be
   * mistaken for Host-internal state. The id is normalised by sceneSelection, which refuses a value
   * that is not a usable id instead of falling back to the sample.
   */
  const projectSelectionRequest = body => {
    const source = body && typeof body === 'object' ? body : {};
    const projected = {};
    if (Object.hasOwn(source, 'scene')) projected.scene = source.scene;
    if (Object.hasOwn(source, 'mode')) projected.mode = source.mode;
    if (Object.hasOwn(source, 'seconds')) projected.seconds = source.seconds;
    return projected;
  };

  const verifySelection = async body => {
    const selection = sceneSelection(body);
    // The bounded duration belongs to the caller's request; the Host re-verifies the id, not the clock.
    const seconds = Number.isInteger(body?.seconds) ? { seconds: body.seconds } : {};
    // The verified sample is resolved by its own whitelisted project, not by a lookup that could
    // silently answer for an unknown id. Its own file must exist: a missing sample is refused here
    // with its own message rather than being confused with "the whole service is unavailable".
    if (selection.sceneId === 'lucy') {
      if (!exists(SCENES.lucy.project)) throw new Error(`scene file is missing: lucy`);
      return { ...selection, ...seconds, project: SCENES.lucy.project };
    }
    const verify = verifyScene ?? (library ? id => library.resolveForPlayback ? library.resolveForPlayback(id) : library.resolveSelection(id) : null);
    // A well-formed catalogue id is a real selection that this Host cannot resolve, which is a
    // different answer from a name that is not an id at all. Neither falls back to the sample.
    if (!verify) throw new Error(`the wallpaper library is not configured, so ${selection.sceneId} cannot be verified`);
    const verified = await verify(selection.sceneId);
    if (!verified || verified.sceneId !== selection.sceneId) throw new Error(`the wallpaper library could not verify ${selection.sceneId}`);
    return { sceneId: selection.sceneId, project: verified.project, type: verified.type, sourceProject: verified.sourceProject, entry: verified.entry, mode: selection.mode, ...seconds };
  };

  const prepareSelection = async (token, selection) => {
    if (selection.type !== 'video') {
      if (/\.mp4$/i.test(selection.project ?? '')) throw new Error('MEDIA_BRIDGE_SELECTION: refresh the wallpaper library before starting video');
      return selection;
    }
    resolveSceneRequest({ scene: selection.sceneId, mode: selection.mode, ...(selection.seconds !== undefined ? { seconds: selection.seconds } : {}) }, { resolveProject: () => selection.project });
    token.preparing = true;
    const describe = value => ({ sceneId: value.sceneId, type: value.type, project: value.sourceProject, entry: value.entry });
    try {
      token.mediaLease = await bridge.prepare(describe(selection), {
        isCurrent: () => isCurrent(token),
        reverify: async () => describe(await verifySelection({ scene: selection.sceneId, mode: selection.mode, seconds: selection.seconds })),
      });
      if (!isCurrent(token)) throw new Error('MEDIA_BRIDGE_CANCELLED: playback was stopped during media preparation');
      return { ...selection, project: token.mediaLease.path };
    } finally { token.preparing = false; }
  };

  const statusPayload = (extra = {}) => {
    // A run that reached its time limit or ended on its own has already closed its window;
    // archive it so the reported state and the next explicit start agree.
    releaseFinishedSession();
    // A retained run keeps its own close evidence, so the reported failure is the real one
    // even when the run ended by itself and never went through the route's stop path. A
    // caller that already knows the close result passes it explicitly and wins.
    if (session && extra.lastCleanup === undefined) lastCleanup = session.state?.().cleanup ?? lastCleanup;
    // A catalogue entry the Host confirmed startable keeps the service available even when the
    // sample is gone; each whitelisted sample still keeps its own missing-file report.
    const catalogUsable = Boolean(library && library.publicItems().some(item => item.available === true));
    const availability = probeAvailability({ helper, scenes, exists, catalogUsable });
    const live = Boolean(session);
    const running = live && session.isClosed?.() !== true;
    const liveConfig = live ? session.state?.().config ?? null : null;
    return {
      available: availability.available,
      unavailableReason: availability.reason,
      missingScenes: availability.missing,
      previewSeconds: PREVIEW_SECONDS,
      modes: PLAYBACK_MODES,
      defaultMode: DEFAULT_PLAYBACK_MODE,
      scenes: describeScenes({ scenes, exists }),
      active: running,
      // The mode of the run that is actually live, so the UI never shows a countdown for a
      // daily run or a stale mode after a restart.
      mode: liveConfig?.mode ?? null,
      // The scene the live run is really capturing, taken from this run's own config. The UI must
      // never present the next selection as if the picture had already switched.
      activeSceneId: running ? liveConfig?.sceneId ?? null : null,
      // Bounded catalogue state for the picker. The list itself is a separate, explicit read.
      library: libraryPayload(),
      // A retained session whose close failed is reported as failed, never as stopped. The
      // caller's own close result (when there is one) decides this instead of stale evidence.
      failed: extra.cleanup ? extra.cleanup.closed !== true : Boolean(lastCleanup && lastCleanup.closed !== true),
      lastCleanup,
      error: extra.error ?? lastError,
      selectionError: lastSelectionError ? lastSelectionError.message : null,
      session: live ? session.report() : null,
      ...extra,
    };
  };

  /**
   * Archive a run that has finished and proven its window gone (time limit, capture ended).
   * A run that only stopped producing frames, or whose close is unproven, keeps ownership:
   * its window may still exist and the next start must not overlap it.
   */
  const releaseFinishedSession = () => {
    if (!session) return false;
    if (ownership?.kind === 'stop') return false;
    const state = session.state?.() ?? {};
    // Only a close that has actually been attempted and proven gone releases ownership. A
    // run that merely stopped producing frames, or whose close is still in flight or
    // unproven, keeps it: its window may still exist.
    if (state.cleanup?.closed !== true) return false;
    lastCleanup = state.cleanup;
    session = null;
    return true;
  };

  const closeSession = async () => {
    const current = session;
    if (!current) return { outcome: 'absent', closed: true };
    if (current.isClosed?.() === true) {
      // Already proven closed by the run itself: archive and release without a new close.
      const cleanup = current.state?.().cleanup ?? { outcome: 'closed', closed: true };
      lastCleanup = cleanup;
      session = null;
      lastError = '';
      return cleanup;
    }
    if (!current.hasInternalCadenceDrain && current.cadenceTrace?.client?.enabled) {
      try { current.hub?.close?.(); } catch {}
      await current.cadenceTrace.client.waitForClientFinalize?.(100, current.issuedConnections);
    }
    const result = await current.stop().catch(error => ({ outcome: 'error', closed: false, error: error.message }));
    lastCleanup = result ?? null;
    if (result?.closed === true) {
      session = null;
      lastError = '';
    } else {
      // Keep the failed run: its window may still exist, and the user needs a retry path.
      lastError = `Window cleanup incomplete (${result?.outcome ?? 'unknown'}): ${result?.error ?? 'no result'}`;
      onWarn(`[Whale wallpaper] ${lastError}`);
    }
    return result;
  };

  /**
   * Run one start. The ownership token is created by the caller before the request body is
   * read, so the whole "read body -> prepare -> create" sequence is covered by the lock and
   * a stop or unload can invalidate it before any resource exists.
   */
  const startWithToken = (token, body) => {
    token.promise = (async () => {
      if (!body) throw new Error('the request body was not read');
      if (!isCurrent(token)) throw new Error('the preview was stopped while it was starting');
      // A run that ended on its own is released here as well, so a plain start works right
      // after the time limit instead of being refused by a session that no longer runs.
      releaseFinishedSession();
      if (session) throw new Error('a preview is already running or still being cleaned up');
      // Only the machine and the helper are checked here. The selection is verified below, so a
      // missing sample file cannot refuse a different wallpaper whose own files are complete.
      const host = probeHost({ helper, exists });
      if (!host.available) throw new Error(`wallpaper engine preview is unavailable: ${host.reason}`);
      // Re-verify the selection against the Host's own snapshot and the files before any run
      // resource exists. A refusal here is reported, never replaced by the default sample.
      //
      // A restart has already verified the next item (before it closed the old run) and stores that
      // result on its own token, which is Host-internal state. It is NEVER read from the request body:
      // a request field called `resolveFrom` (or any other "already verified" shape) must not be able
      // to hand this function a project path, because that would bypass the whole id -> approved-root
      // resolution the browser is not allowed to perform.
      let selection = token.verifiedSelection ?? null;
      if (!selection) {
        try {
          selection = await verifySelection(projectSelectionRequest(body));
          lastSelectionError = null;
        } catch (error) {
          lastSelectionError = error;
          throw error;
        }
      }
      if (!token.verifiedSelection) selection = await prepareSelection(token, selection);
      // A stop or unload that arrived during re-verification wins over this start.
      if (!isCurrent(token)) throw new Error('the preview was stopped while it was starting');
      const output = await prepareRunDirectory(logRoot, selection.sceneId);
      await pruneRuns(logRoot);
      // A stop or unload that arrived during preparation wins over this start.
      if (!isCurrent(token)) throw new Error('the preview was stopped while it was starting');
      const next = buildSession({ cadenceTrace });
      session = next;
      token.started = true;
      try {
        const preparedMedia = token.mediaLease ?? null;
        token.mediaLease = null; // ownership transfers even when create throws; session.stop proves release
        await next.create({ helper, output, scene: { sceneId: selection.sceneId, project: selection.project, mode: selection.mode, ...(selection.seconds !== undefined ? { seconds: selection.seconds } : {}) }, offscreenStart, mediaLease: preparedMedia });
      } catch (error) {
        await next.stop().catch(() => {});
        const result = next.state().cleanup ?? { outcome: 'absent', closed: true };
        lastCleanup = result;
        if (result.closed === true) session = null;
        throw error;
      }
      if (!isCurrent(token)) {
        // Stopped or unloaded during creation: tear the fresh run down and report it.
        await closeSession();
        throw new Error('the preview was stopped while it was starting');
      }
      lastError = '';
      return statusPayload();
    })();
    token.promise.catch(() => {});   // the HTTP handler reports it
    return token;
  };

  const settle = async token => {
    try {
      const payload = await token.promise;
      return { ok: true, payload };
    } catch (error) {
      lastError = error.message;
      return { ok: false, payload: statusPayload({ error: error.message }) };
    } finally {
      if (token.mediaLease) {
        try { await token.mediaLease.release({ neverOpened: true }); }
        catch (error) { lastError = error.message; onWarn('[Whale wallpaper] ' + error.message); }
        token.mediaLease = null;
      }
      release(token);
    }
  };

  /**
   * Close the current run in place, without touching ownership or the cancellation marker.
   *
   * A restart calls this while it still owns its token: going through stopNow() would bump the
   * generation and claim a stop token, and a late restart could then re-claim the newest ownership and
   * start after the user had already stopped.
   */
  const closeRun = async () => {
    releaseFinishedSession();
    return closeSession();
  };

  /**
   * Stop the current run without waiting for an in-flight start.
   *
   * A stop must answer now: waiting for a pending start would look like a hang, and the
   * generation bump already invalidates it — including one whose request body has not
   * arrived yet. Only a start that has really begun building this run's window is waited
   * for, so its rollback finishes before the close is decided.
   */
  const stopNow = async () => {
    generation += 1;
    // An external stop is a cancellation for anything that is still verifying a selection.
    cancelGeneration += 1;
    const pending = ownership;
    const inFlight = pending?.kind === 'start' && (pending.started || pending.preparing) ? pending.promise.catch(() => {}) : null;
    if (!session) {
      return { payload: statusPayload({ stopped: true, cleanup: null, pending: Boolean(inFlight), error: '' }), ok: true };
    }
    const token = claim('stop');
    token.promise = (async () => {
      if (inFlight) await inFlight;
      const result = await closeSession();
      // Placeholder: the payload is rebuilt after the settle below, so it always reflects the
      // state that the close actually produced instead of the state before it ran.
      return { cleanup: result ?? null };
    })();
    token.promise.catch(() => {});
    const outcome = await settle(token);
    const stopped = outcome.payload?.cleanup?.closed === true;
    return { ok: outcome.ok, payload: statusPayload({ stopped, cleanup: outcome.payload?.cleanup ?? null }) };
  };

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/whale-wallpaper',
    async handler(req, res) {
      const path = new URL(req.url, 'http://localhost').pathname;
      res.setHeader('cache-control', 'no-store');
      const send = (status, payload) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (req.method === 'GET' && path === '/whale-wallpaper/status') { send(200, statusPayload()); return; }

      // The bounded library list. `ensure=1` means "I need a list, not just a cache peek": the Host
      // performs the first bounded scan here, so opening the settings area once really loads the
      // wallpapers instead of showing an empty cache until the user guesses to press refresh.
      // Reading with the snapshot already present stays a pure cached read, and concurrent calls
      // share one scan.
      if (req.method === 'GET' && path === '/whale-wallpaper/library') {
        if (!library) { send(200, { ...libraryPayload(), items: [] }); return; }
        const ensure = new URL(req.url, 'http://localhost').searchParams.get('ensure') === '1';
        if (ensure && !library.hasSnapshot()) {
          try {
            const outcome = await library.refresh();
            send(200, { ...libraryPayload(), items: library.publicItems(), ensureScan: outcome?.joined !== true });
          } catch (error) {
            send(502, { ...libraryPayload(), items: library.publicItems(), ensureScan: false, error: String(error.message ?? error) });
          }
          return;
        }
        send(200, { ...libraryPayload(), items: library.publicItems(), ensureScan: false });
        return;
      }

      if (req.method === 'POST' && path === '/whale-wallpaper/library/refresh') {
        if (!library) { send(409, { ...libraryPayload(), error: 'the wallpaper library is not configured' }); return; }
        try {
          // The answer says whether this caller performed the scan or joined one already running.
          const outcome = await library.refresh();
          send(200, { ...libraryPayload(), items: library.publicItems(), joined: outcome?.joined === true });
        } catch (error) {
          // A failed refresh keeps the previous list visible; it is reported, not hidden.
          send(502, { ...libraryPayload(), items: library.publicItems(), error: String(error.message ?? error) });
        }
        return;
      }

      if (req.method === 'GET' && path === '/whale-wallpaper/stream') {
        if (!session || session.isClosed?.() === true || !session.hub.latest || session.hub.closed) {
          res.writeHead(503); res.end('Preview unavailable'); return;
        }
        streamFrames(session.hub, res, {
          cadenceTrace: session.cadenceTrace?.host,
          clientTrace: session.cadenceTrace?.client,
          runId: session.state().location,
          registerConnection: id => session.issuedConnections?.add(id),
        });
        return;
      }

      if (req.method === 'POST' && (path === '/whale-wallpaper/start' || path === '/whale-wallpaper/restart')) {
        // The ownership token is created BEFORE the body is read, and it covers the whole
        // "read body -> prepare -> create" sequence. A second request that arrives while
        // the first body is still pending is refused immediately; a stop or unload during
        // that window invalidates the token, so the late body can no longer create
        // anything.
        if (ownership) { send(409, statusPayload({ error: 'a wallpaper preview operation is already in progress' })); return; }
        // A restart takes ownership BEFORE it reads the body and keeps it across the whole
        // "read body -> verify the next selection -> close the old run -> create the new run"
        // sequence. It never goes through stopNow(): that would bump the generation and let this late
        // request claim the newest ownership, which is exactly how a stop during verification used to
        // be forgotten. The cancellation marker is captured in the token, so a stop or an unload
        // during the verification makes every later step of this request refuse.
        if (path.endsWith('/restart')) {
          const token = claim('start');
          token.promise = (async () => {
            let body;
            try { body = await readJsonBody(req, 2048); }
            catch (error) { lastError = error.message; throw error; }
            if (!body) throw new Error('the request body was not read');
            if (!isCurrent(token)) throw new Error('the preview was stopped while it was starting');
            const host = probeHost({ helper, exists });
            if (!host.available) throw new Error(`wallpaper engine preview is unavailable: ${host.reason}`);
            // Verify the NEXT selection before anything is closed: an unusable new item must leave the
            // current picture playing.
            let selection = await verifySelection(projectSelectionRequest(body)).catch(error => {
              lastSelectionError = error;
              throw error;
            });
            lastSelectionError = null;
            selection = await prepareSelection(token, selection);
            if (!isCurrent(token)) throw new Error('the preview was stopped while it was starting');
            // Close the old run in place, still under this token. An unproven close keeps its run and
            // refuses the new one.
            const closed = await closeRun();
            if (closed?.closed !== true && session) {
              const reason = `Window cleanup incomplete (${closed?.outcome ?? 'unknown'}): ${closed?.error ?? 'no result'}`;
              lastError = reason;
              throw new Error(reason);
            }
            if (!isCurrent(token)) throw new Error('the preview was stopped while it was starting');
            // The verified result stays on this token: Host-internal state, never a request field.
            // This is the single verification of the new item; the start path below reuses it.
            token.verifiedSelection = selection;
            return startWithToken(token, body).promise;
          })();
          token.promise.catch(() => {});
          const outcome = await settle(token);
          // A cancelled restart is a conflict, not a malformed request.
          send(outcome.ok ? 200 : 409, outcome.payload);
          return;
        }
        const token = claim('start');
        // Body reading happens while the token is owned, so this request is visible to a
        // stop or unload even before its body has arrived; both bump the generation, which
        // makes the late body unable to create anything.
        token.promise = (async () => {
          let body;
          try { body = await readJsonBody(req, 2048); }
          catch (error) { lastError = error.message; throw error; }
          return startWithToken(token, body).promise;
        })();
        token.promise.catch(() => {});
        const outcome = await settle(token);
        const badBody = !outcome.ok && /body|JSON/.test(String(outcome.payload?.error ?? ''));
        send(outcome.ok ? 200 : badBody ? 400 : 409, outcome.payload);
        return;
      }

      if (req.method === 'POST' && path === '/whale-wallpaper/stop') {
        // A stop answers immediately even while a start is preparing; the queued close
        // still runs once that start has settled. A close that could not be proven is
        // reported as a failure, never as a successful stop.
        const outcome = await stopNow();
        const failed = !outcome.ok || outcome.payload?.failed === true;
        send(failed ? 409 : 200, outcome.payload);
        return;
      }

      if (req.method === 'POST' && path === '/whale-wallpaper/metrics') {
        try {
          const value = await readJsonBody(req, 2048);
          const allowed = [
            'received', 'rendered', 'dropped', 'sourceSequence', 'seconds', 'meanLatencyMs', 'maxLatencyMs', 'decodeErrors', 'hidden',
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
          const clean = Object.fromEntries(allowed.filter(key => typeof value?.[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0).map(key => [key, value[key]]));
          session?.setClientStatus(clean);
          res.writeHead(204); res.end();
        } catch { if (!res.headersSent) res.writeHead(400); res.end(); }
        return;
      }

      if (req.method === 'GET' && path === '/whale-wallpaper/cadence-trace') {
        const live = Boolean(session && session.isClosed?.() !== true);
        const hostSnapshot = session?.cadenceTrace?.host?.snapshot();
        const clientSnapshot = session?.cadenceTrace?.client?.snapshot();
        send(200, {
          enabled: Boolean(hostSnapshot?.enabled),
          schemaVersion: 1,
          runId: session?.state?.().location ?? null,
          active: live,
          host: hostSnapshot ?? null,
          client: clientSnapshot ?? null,
        });
        return;
      }

      if (req.method === 'POST' && path === '/whale-wallpaper/cadence-trace') {
        try {
          const body = await readJsonBody(req, 262144);
          if (!session || session.isClosed?.() === true) {
            res.writeHead(409); res.end('No active preview session'); return;
          }
          const activeLocation = session.state?.().location;
          if (!body?.runId || !activeLocation || body.runId !== activeLocation) {
            res.writeHead(400); res.end('Run mismatch'); return;
          }
          if (body?.clockDomain !== 'client-mono') {
            res.writeHead(400); res.end('Invalid clock domain'); return;
          }
          if (!body?.connectionId || typeof body.connectionId !== 'string') {
            res.writeHead(400); res.end('Missing connectionId'); return;
          }
          const issued = session.issuedConnections ?? session.cadenceTrace?.client?.issuedConnections;
          if (issued && !issued.has(body.connectionId)) {
            res.writeHead(400); res.end('Unknown or foreign connectionId'); return;
          }
          if (!Array.isArray(body?.records) || (body.records.length === 0 && body.isStop !== true)) {
            res.writeHead(400); res.end('Invalid records'); return;
          }
          const clientCollector = session.cadenceTrace?.client;
          const recordSchemaViolation = (droppedLen = 0) => {
            if (clientCollector) {
              clientCollector.schemaViolationCount = (clientCollector.schemaViolationCount || 0) + 1;
              if (droppedLen > 0) {
                clientCollector.droppedBatchRecords = (clientCollector.droppedBatchRecords || 0) + droppedLen;
              }
            }
          };
          if (body.generation !== undefined) {
            if (typeof body.generation !== 'number' || !Number.isInteger(body.generation) || body.generation < 0) {
              recordSchemaViolation(body.records.length);
              res.writeHead(400); res.end('Invalid generation'); return;
            }
          } else if (body.records.length === 0) {
            recordSchemaViolation(0);
            res.writeHead(400); res.end('Missing generation'); return;
          }
          for (const counterField of ['trailingUnsentCount', 'overflowCount', 'droppedCount']) {
            if (body[counterField] !== undefined) {
              if (typeof body[counterField] !== 'number' || !Number.isInteger(body[counterField]) || body[counterField] < 0) {
                recordSchemaViolation(body.records.length);
                res.writeHead(400); res.end(`Invalid ${counterField}`); return;
              }
            }
          }
          let effectiveGeneration = body.generation;
          if (effectiveGeneration === undefined && body.records.length > 0) {
            const firstGen = body.records[0]?.generation;
            if (typeof firstGen === 'number' && Number.isInteger(firstGen) && firstGen >= 0) {
              effectiveGeneration = firstGen;
            }
          }
          if (Array.isArray(body.records) && body.records.length > 0) {
            const result = clientCollector?.appendBatch(body.records, activeLocation, {
              connectionId: body.connectionId,
              issuedConnections: issued,
              generation: effectiveGeneration,
            });
            if (result && ((result.appended === 0 && (result.dropped > 0 || result.schemaViolations > 0)) || result.schemaViolations > 0)) {
              res.writeHead(400); res.end('Batch rejected'); return;
            }
          }
          if (clientCollector) {
            if (typeof clientCollector.updateClientStream === 'function') {
              const ok = clientCollector.updateClientStream(body.connectionId, effectiveGeneration, {
                isStop: body.isStop === true,
                trailingUnsentCount: body.trailingUnsentCount,
                overflowCount: body.overflowCount,
                droppedCount: body.droppedCount,
              });
              if (!ok) {
                recordSchemaViolation(0);
                res.writeHead(400); res.end('Invalid stream state'); return;
              }
            } else {
              if (body.isStop === true) {
                clientCollector.clientFinalized = true;
              }
              if (typeof body.overflowCount === 'number') {
                clientCollector.clientOverflowCount = Math.max(clientCollector.clientOverflowCount || 0, body.overflowCount);
              }
              if (typeof body.droppedCount === 'number') {
                clientCollector.clientDroppedCount = Math.max(clientCollector.clientDroppedCount || 0, body.droppedCount);
              }
              if (typeof body.trailingUnsentCount === 'number') {
                clientCollector.clientTrailingUnsentCount = body.trailingUnsentCount;
              }
            }
          }
          res.writeHead(204); res.end();
          clientCollector?.notifyFinalizationWaiters?.();
        } catch {
          if (!res.headersSent) { res.writeHead(400); res.end(); }
        }
        return;
      }

      res.writeHead(404); res.end();
    },
  }), 'whale-mist: wallpaper engine preview routes');

  // Cordis awaits a disposer's returned promise, so unloading waits for the real close.
  ctx.effect(() => () => {
    generation += 1;                     // invalidate a start that is still preparing
    cancelGeneration += 1;               // and any restart that is still verifying its selection
    const pending = ownership;
    // A start whose request body has not been read yet owns nothing, so unloading must not
    // wait for that client; it waits only for a run that has really begun to be built.
    const inFlight = pending && (pending.kind !== 'start' || pending.started || pending.preparing) ? pending.promise.catch(() => {}) : null;
    return (async () => {
      if (inFlight) await inFlight;
      await closeSession();
    })();
  }, 'whale-mist: wallpaper preview lifetime');

  return { statusPayload, stopNow, closeSession, releaseFinishedSession, currentSession: () => session, ownership: () => ownership, generation: () => generation };
}

async function readJsonBody(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request body too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}
