"""Apply only the reviewed documentation recipe to an isolated scene-rules string."""
TYPES = """/** @typedef {'preview' | 'daily'} PlaybackMode */
/**
 * @typedef {object} SceneDefinition
 * @property {string} id
 * @property {string} label
 * @property {string} project
 * @property {boolean} [playbackVerified]
 */
/** @typedef {Readonly<Record<string, Readonly<SceneDefinition>>>} SceneMap */
/** Unknown field view after the existing object check; not a validated request.
 * @typedef {object} RequestFields
 * @property {unknown} [scene]
 * @property {unknown} [mode]
 * @property {unknown} [seconds]
 */
/**
 * @typedef {object} SceneSelection
 * @property {string} sceneId
 * @property {unknown} mode Not validated until resolveSceneRequest.
 */
/**
 * @typedef {object} ResolveSceneOptions
 * @property {SceneMap} [scenes]
 * @property {(project: string) => boolean} [exists]
 * @property {((sceneId: string) => unknown) | null} [resolveProject] Result is checked at runtime.
 */
/**
 * @typedef {object} SceneRequest
 * @property {string} sceneId Shape/lookup validation remains runtime work.
 * @property {PlaybackMode} mode
 * @property {string} project
 * @property {number | null} seconds
 * @property {number} width
 * @property {number} height
 * @property {number} fps
 */

"""


def annotate(raw):
    def replace(old, new, count=1):
        nonlocal raw
        assert raw.count(old) == count, old
        raw = raw.replace(old, new)
    replace('/** Scenes verified by the supervised experiments.', TYPES + '/** Scenes verified by the supervised experiments.')
    replace('export function isSceneId(value)', '/** @param {unknown} [value]\n * @returns {boolean} String coercion means this is not a string type predicate.\n */\nexport function isSceneId(value)')
    replace('export function sceneSelection(payload)', '/** @param {unknown} [payload]\n * @returns {SceneSelection}\n */\nexport function sceneSelection(payload)')
    replace('export function resolveSceneRequest(payload,', '/** @param {unknown} [payload]\n * @param {ResolveSceneOptions} [options]\n * @returns {SceneRequest}\n */\nexport function resolveSceneRequest(payload,')
    replace("  const body = payload && typeof payload === 'object' ? payload : {};", "  /** @type {RequestFields} */\n  const body = payload && typeof payload === 'object' ? payload : {};", 2)
    replace('Number.isInteger(body.seconds) ? body.seconds :', 'Number.isInteger(body.seconds) ? /** @type {number} */ (body.seconds) :')
    replace('return { sceneId, mode, project, seconds, width: WINDOW_SIZE.width, height: WINDOW_SIZE.height, fps: FPS };',
            'return /** @type {SceneRequest} */ ({ sceneId, mode, project, seconds, width: WINDOW_SIZE.width, height: WINDOW_SIZE.height, fps: FPS });')
    replace('export function describeScenes(', "/** @param {Pick<ResolveSceneOptions, 'scenes' | 'exists'>} [options] */\nexport function describeScenes(")
    return raw
