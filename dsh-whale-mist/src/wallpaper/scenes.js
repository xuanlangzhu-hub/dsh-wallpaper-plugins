/**
 * Pure scene and availability rules for the Wallpaper Engine preview.
 *
 * This module must stay free of Node built-ins and of browser globals: the Host
 * imports it for whitelist validation, and the settings UI imports the same lists so
 * the frontend and the Host can never disagree about what may be started.
 */

/** Scenes verified by the supervised experiments. Only these can be started. */
export const SCENES = Object.freeze({
  lucy: Object.freeze({
    id: 'lucy',
    label: 'Lucy（已验证样例）',
    project: 'E:\\SteamLibrary\\steamapps\\workshop\\content\\431960\\3521337568\\project.json',
  }),
});

export const PREVIEW_SECONDS = Object.freeze({ min: 30, max: 300, default: 180 });
export const FPS = 30;

/**
 * Playback modes. `preview` is the supervised, time-boxed experiment and stays the
 * migration default for requests that predate the field. `daily` has no timer at all:
 * it ends on an explicit stop, the capture child exiting, the source window closing,
 * a pipe/parent loss, or the host unloading.
 */
export const PLAYBACK_MODES = Object.freeze(['preview', 'daily']);
export const DEFAULT_PLAYBACK_MODE = 'preview';

/** The single accepted window size; the frontend cannot ask for arbitrary sizes. */
export const WINDOW_SIZE = Object.freeze({ width: 1280, height: 720 });

/** Why playback cannot start, in a shape the UI can turn into a message. */
export const UNAVAILABLE_REASON = Object.freeze({
  platform: 'platform',
  host: 'host',
  helper: 'helper',
  scene: 'scene',
});

/**
 * Constrained frontend payload -> a validated request, or a refusal.
 *
 * Only the scene id, the mode and (in preview mode) the seconds are accepted; nothing
 * else from the caller reaches the capture command. `seconds` is null in daily mode,
 * which is what the capture child turns into its no-timer loop.
 * `exists` is injected so this stays testable and free of filesystem access.
 */
export function resolveSceneRequest(payload, { scenes = SCENES, exists = () => true } = {}) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const sceneId = typeof body.scene === 'string' ? body.scene : 'lucy';
  const scene = scenes[sceneId];
  if (!scene) throw new Error(`unknown scene: ${sceneId}`);
  if (!exists(scene.project)) throw new Error(`scene file is missing: ${sceneId}`);
  const mode = body.mode === undefined ? DEFAULT_PLAYBACK_MODE : body.mode;
  if (typeof mode !== 'string' || !PLAYBACK_MODES.includes(mode)) throw new Error(`unknown mode: ${String(mode)}`);
  let seconds = null;
  if (mode === 'preview') {
    const requested = Number.isInteger(body.seconds) ? body.seconds : PREVIEW_SECONDS.default;
    seconds = Math.min(PREVIEW_SECONDS.max, Math.max(PREVIEW_SECONDS.min, requested));
  } else if (body.seconds !== undefined && body.seconds !== null) {
    // A daily request has no timer; accepting a duration would silently recreate one.
    throw new Error('daily mode does not take a duration');
  }
  return { sceneId, mode, project: scene.project, seconds, width: WINDOW_SIZE.width, height: WINDOW_SIZE.height, fps: FPS };
}

/** Scene list for the UI, with the local sample dependency made explicit. */
export function describeScenes({ scenes = SCENES, exists = () => true } = {}) {
  return Object.values(scenes).map(scene => ({ id: scene.id, label: scene.label, available: exists(scene.project), project: scene.project }));
}
