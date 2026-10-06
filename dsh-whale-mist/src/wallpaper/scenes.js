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

/** The single accepted window size; the frontend cannot ask for arbitrary sizes. */
export const WINDOW_SIZE = Object.freeze({ width: 1280, height: 720 });

/** Why a preview cannot start, in a shape the UI can turn into a message. */
export const UNAVAILABLE_REASON = Object.freeze({
  platform: 'platform',
  host: 'host',
  helper: 'helper',
  scene: 'scene',
});

/**
 * Constrained frontend payload -> a validated scene request, or a refusal.
 * `exists` is injected so this stays testable and free of filesystem access.
 */
export function resolveSceneRequest(payload, { scenes = SCENES, exists = () => true } = {}) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const sceneId = typeof body.scene === 'string' ? body.scene : 'lucy';
  const scene = scenes[sceneId];
  if (!scene) throw new Error(`unknown scene: ${sceneId}`);
  if (!exists(scene.project)) throw new Error(`scene file is missing: ${sceneId}`);
  const requested = Number.isInteger(body.seconds) ? body.seconds : PREVIEW_SECONDS.default;
  const seconds = Math.min(PREVIEW_SECONDS.max, Math.max(PREVIEW_SECONDS.min, requested));
  return { sceneId, project: scene.project, seconds, width: WINDOW_SIZE.width, height: WINDOW_SIZE.height, fps: FPS };
}

/** Scene list for the UI, with the local sample dependency made explicit. */
export function describeScenes({ scenes = SCENES, exists = () => true } = {}) {
  return Object.values(scenes).map(scene => ({ id: scene.id, label: scene.label, available: exists(scene.project), project: scene.project }));
}
