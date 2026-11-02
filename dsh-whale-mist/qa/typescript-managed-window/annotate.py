"""JSDoc-only recipe, with grouped local views for existing runtime checks."""
TYPES = """/** @typedef {Pick<import('node:child_process').ChildProcess, 'on' | 'kill' | 'stdout' | 'stderr'>} HelperProcess */
/** @typedef {(command: string, args: readonly string[], options: {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']}) => HelperProcess} HelperSpawn */
/** @typedef {{hwnd?: unknown, Hwnd?: unknown, pid?: unknown, Pid?: unknown, title?: unknown, Title?: unknown, startUtc?: unknown, StartUtc?: unknown, visible?: unknown, Visible?: unknown, left?: unknown, Left?: unknown, top?: unknown, Top?: unknown}} WindowFields */
/** @typedef {{hwnd: number, pid: number | null, title: unknown, visible: unknown, left: unknown, top: unknown, startUtc: string | null}} NormalizedWindow */
/** Validated-by-caller array contract, NOT a claim that runHelper validates raw JSON.
 * @typedef {(args: readonly string[]) => Promise<ReadonlyArray<{title?: unknown}> | null | undefined>} FindWindows
 */
/** @typedef {{fastAttempts?: number, fastDelayMs?: number, attempts?: number, delayMs?: number, graceAttempts?: number, graceDelayMs?: number, sleep?: (ms: number) => Promise<unknown>}} WaitOptions */

"""


def annotate(raw):
    def replace(old, new):
        nonlocal raw
        assert raw.count(old) == 1, old
        raw = raw.replace(old, new)
    replace('export const LOCATION_PREFIX', TYPES+'export const LOCATION_PREFIX')
    replace('export function validateLocation(value)', '/** @param {unknown} value @returns {string} */\nexport function validateLocation(value)')
    replace('const code = character.codePointAt(0);', 'const code = /** @type {number} */ (character.codePointAt(0));')
    replace('export function validateProjectFile(value)', '/** @param {unknown} value @returns {string} */\nexport function validateProjectFile(value)')
    replace('export function validateSize(value, fallback)', '/** @template T @param {unknown} value @param {T} fallback @returns {number | T} */\nexport function validateSize(value, fallback)')
    replace('value < 160 || value > 7680', '(/** @type {number} */ (value)) < 160 || (/** @type {number} */ (value)) > 7680')
    replace("  return value;\n}\n\n/** Round-unique", "  return /** @type {number} */ (value);\n}\n\n/** Round-unique")
    replace('export function runHelper(spawnImpl, helper, args,', '/** @param {HelperSpawn} spawnImpl @param {string} helper @param {readonly string[]} args\n * @param {{timeoutMs?: number}} [options] @returns {Promise<unknown>}\n */\nexport function runHelper(spawnImpl, helper, args,')
    replace('    const finish = (error, value) => {', '    /** @param {unknown} error @param {unknown} [value] */\n    const finish = (error, value) => {')
    replace('export const defaultSleep =', '/** @param {number} ms @returns {Promise<unknown>} */\nexport const defaultSleep =')
    replace('export async function waitForWindow(runHelperFn, location,', '/** @param {FindWindows} runHelperFn @param {string} location\n * @param {WaitOptions} [options] @returns {Promise<NormalizedWindow | null>}\n */\nexport async function waitForWindow(runHelperFn, location,')
    replace('export function normalizeWindow(window)', '/** @param {unknown} window @returns {NormalizedWindow} */\nexport function normalizeWindow(window)')
    start=raw.index('export function normalizeWindow(window)')
    head, tail=raw[:start], raw[start:]
    # The object guard already executed. Property views leave values unknown.
    import re
    tail=re.sub(r'\bwindow\.(\w+)',r'(/** @type {WindowFields} */ (window)).\1',tail)
    old='const hwnd = (/** @type {WindowFields} */ (window)).hwnd ?? (/** @type {WindowFields} */ (window)).Hwnd;'
    assert tail.count(old)==1
    tail=tail.replace(old, 'const hwnd = /** @type {number} */ ((/** @type {WindowFields} */ (window)).hwnd ?? (/** @type {WindowFields} */ (window)).Hwnd);')
    return head+tail
