// D offline implementation candidate. No filesystem reads, processes, timers, routes or playback.
// The Host must supply its private approved catalogue; a match still needs the existing live
// library.resolveForPlayback() and content-rating checks before any future playback request.
import { win32 } from 'node:path';
import { isSceneId, parseAgeRatings } from '../appearance-contract.js';

export function currentWallpaperArgs({ monitor = null } = {}) {
  if (monitor !== null && (!Number.isSafeInteger(monitor) || monitor < 0)) throw Error('invalid-monitor');
  return ['-control', 'getWallpaper', ...(monitor === null ? [] : ['-monitor', String(monitor)])];
}

function localPath(value) {
  if (typeof value !== 'string' || value.length > 32767 || !/^[a-z]:[\\/]/i.test(value)) return null;
  const rest = value.slice(3).replaceAll('/', '\\');
  if (!rest) return null;
  if (/[<>:"|?*\x00-\x1f\x7f]/.test(rest)) return null;
  if (rest.split('\\').some(part => part === '..' || /[. ]$/.test(part))) return null;
  return win32.normalize(value).toLowerCase();
}

export function parseCurrentWallpaperResult(result) {
  if (result?.exited !== true || result?.timedOut !== false || result?.exitCode !== 0 || result?.signal != null) {
    return { status: 'query-error', reason: 'command-unconfirmed' };
  }
  if (typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout, 'utf8') > 65536) {
    return { status: 'query-error', reason: 'invalid-output' };
  }
  let path = result.stdout.replace(/^\uFEFF/, '').replace(/(?:\r\n|\n)$/, '');
  if (!path) return { status: 'query-error', reason: 'empty-output' };
  if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);
  const key = localPath(path);
  return key ? { status: 'resolved-path', key } : { status: 'query-error', reason: 'invalid-path' };
}

export function resolveDesktopSelection(query, privateRecords, allowedRatings = ['Everyone']) {
  const parsed = parseCurrentWallpaperResult(query);
  if (parsed.status !== 'resolved-path') return parsed;
  if (!Array.isArray(privateRecords)) return { status: 'blocked', reason: 'catalog-unavailable' };
  const matches = privateRecords.filter(item => item &&
    [item.project, item.entry].some(path => localPath(path) === parsed.key));
  if (!matches.length) return { status: 'blocked', reason: 'outside-approved-catalog' };
  if (matches.length !== 1) return { status: 'blocked', reason: 'ambiguous-catalog-match' };
  const item = matches[0];
  if (!isSceneId(item.id) || !localPath(item.project) || !localPath(item.entry)) {
    return { status: 'blocked', reason: 'invalid-catalog-record' };
  }
  if (!['scene', 'video', 'web'].includes(item.type) || item.available !== true) {
    return { status: 'blocked', reason: 'unsupported-or-unavailable' };
  }
  if (!['Everyone', 'Questionable', 'Mature'].includes(item.contentRating) ||
      !parseAgeRatings(allowedRatings).includes(item.contentRating)) {
    return { status: 'blocked', reason: 'rating-not-allowed' };
  }
  return { status: 'candidate', sceneId: item.id, type: item.type,
    requiresLibraryReverification: true, synchronization: 'same-file-independent-instance' };
}

export function createFollowState({ manualSceneId = null, monitor = null, allowedRatings = ['Everyone'] } = {}) {
  if (manualSceneId !== null && !isSceneId(manualSceneId)) throw Error('invalid-manual-selection');
  currentWallpaperArgs({ monitor });
  return { enabled: false, manualSceneId, monitor, allowedRatings: parseAgeRatings(allowedRatings),
    generation: 0, serial: 0, pending: null, status: 'manual', desiredSceneId: manualSceneId, reason: null };
}

export function configureFollow(state, patch) {
  const enabled = Object.hasOwn(patch, 'enabled') ? patch.enabled : state.enabled;
  if (typeof enabled !== 'boolean') throw Error('invalid-enabled-state');
  const manualSceneId = Object.hasOwn(patch, 'manualSceneId') ? patch.manualSceneId : state.manualSceneId;
  if (manualSceneId !== null && !isSceneId(manualSceneId)) throw Error('invalid-manual-selection');
  const monitor = Object.hasOwn(patch, 'monitor') ? patch.monitor : state.monitor;
  currentWallpaperArgs({ monitor });
  const allowedRatings = Object.hasOwn(patch, 'allowedRatings') ? parseAgeRatings(patch.allowedRatings) : state.allowedRatings;
  return { ...state, enabled, manualSceneId, monitor, allowedRatings: [...allowedRatings],
    generation: state.generation + 1, pending: null, status: enabled ? 'awaiting-query' : 'manual',
    desiredSceneId: enabled ? null : manualSceneId, reason: null };
}

export function beginFollowQuery(state) {
  if (!state.enabled) throw Error('follow-disabled');
  if (state.pending) return { state, request: { ...state.pending }, joined: true };
  const serial = state.serial + 1;
  const request = { generation: state.generation, serial, monitor: state.monitor };
  return { state: { ...state, serial, pending: request }, request: { ...request }, joined: false };
}

export function settleFollowQuery(state, request, query, privateRecords) {
  if (!state.enabled || !state.pending || request?.generation !== state.generation ||
      request?.serial !== state.pending.serial || request?.monitor !== state.monitor) {
    return { state, accepted: false, reason: 'stale-or-cancelled-query' };
  }
  const selected = resolveDesktopSelection(query, privateRecords, state.allowedRatings);
  return { accepted: true, targetChanged: (selected.sceneId ?? null) !== state.desiredSceneId,
    state: { ...state, pending: null,
    status: selected.status === 'candidate' ? 'candidate' : 'suspended',
    desiredSceneId: selected.sceneId ?? null, reason: selected.reason ?? null }, selection: selected };
}
