// Offline checks for the wallpaper picker in the settings UI.
//
// The client is a single bundled module with no export surface, so this check reads its source and
// extracts the exact expressions that decide persistence, the verified-scene set and the auto-start
// gate, then runs those expressions. That is stronger than a string search: a change that keeps the
// words but drops the rule fails here.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const source = await readFile(new URL('../../src/client.js', import.meta.url), 'utf8');
const cases = [];
const evidence = await mkdtemp(join(tmpdir(), 'wm-ui-library-'));

async function checked(name, run) {
  await test(name, async () => {
    try { await run(); cases.push({ name, passed: true }); }
    catch (error) { cases.push({ name, passed: false, error: error.message }); throw error; }
  });
}

/** Pull one balanced block out of the source, starting at the given literal. */
function block(startLiteral) {
  const start = source.indexOf(startLiteral);
  assert.notEqual(start, -1, `the source no longer contains ${startLiteral}`);
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced block at ${startLiteral}`);
}

/** Evaluate one extracted expression in a bare sandbox and return the produced value. */
function evaluate(expression, bindings = {}) {
  const names = Object.keys(bindings);
  const factory = new Function(...names, `"use strict"; return (${expression});`);
  return factory(...names.map(name => bindings[name]));
}

const patternSource = source.match(/const CATALOG_ID_PATTERN = (\/.*?\/);/);
const isSceneIdSource = source.match(/const isSceneId = (\(value\) => [^\n]*?);\r?\n/);
const verifiedSource = source.match(/const VERIFIED_SCENE_IDS = (Object\.freeze\(\[[^\]]*\]\));/);
const eligibleSource = source.match(/const eligible = \(\) => ([\s\S]*?);\r?\n/);
const normalizeSource = `({ ${source.match(/(weScene: isSceneId\(source\.weScene\)[^\n]*)/)[1].replace(/,$/, '')} }).weScene`;

const isSceneId = evaluate(isSceneIdSource[1], { CATALOG_ID_PATTERN: evaluate(patternSource[1]) });
const VERIFIED_SCENE_IDS = evaluate(verifiedSource[1]);

await checked('A stored catalogue id survives a reload instead of being replaced by the sample', () => {
  const normalizeWeScene = stored => evaluate(normalizeSource, { isSceneId, source: { weScene: stored }, DEFAULT_SETTINGS: { weScene: 'lucy' } });
  const catalogId = `we-${'a'.repeat(24)}`;
  assert.equal(normalizeWeScene(catalogId), catalogId, 'a well-formed id must be kept even before the list has loaded');
  assert.equal(normalizeWeScene('lucy'), 'lucy', 'the legacy value keeps working');
  // Only a value that is not an id at all falls back, and it falls back to the sample the user
  // already had, never to a different wallpaper.
  assert.equal(normalizeWeScene('nope'), 'lucy');
  assert.equal(normalizeWeScene(undefined), 'lucy');
  assert.equal(normalizeWeScene(7), 'lucy');
  assert.equal(normalizeWeScene('__proto__'), 'lucy');
  assert.equal(normalizeWeScene(`we-${'A'.repeat(24)}`), 'lucy', 'the published shape is lowercase hex');
  assert.equal(normalizeWeScene(`${'a'.repeat(24)}`), 'lucy', 'a bare hash is not the published id');
  assert.equal(normalizeWeScene(''), 'lucy');
  assert.equal(normalizeWeScene(null), 'lucy');
});

await checked('The id shape is a shape: it never accepts a path or a foreign name', () => {
  for (const value of ['../lucy', 'C:\\we-aaaaaaaaaaaaaaaaaaaaaaaa', 'we-', 'we-zzzzzzzzzzzzzzzzzzzzzzzz', 'we-aaaaaaaaaaaaaaaaaaaaaaaaa', 'constructor', 'toString'])
    assert.equal(isSceneId(value), false, `${value} must not pass the shape check`);
  assert.equal(isSceneId(`we-${'0'.repeat(24)}`), true, 'a well-formed but unknown id passes the shape and is refused later by the Host');
});

await checked('Only the accepted sample counts as verified', () => {
  assert.deepEqual([...VERIFIED_SCENE_IDS], ['lucy']);
  assert.equal(source.includes('playbackVerified: raw.playbackVerified === true && raw.id === "lucy"'), true,
    'the client must not trust a verified flag for anything but the accepted sample');
  assert.match(source, /未验证，实验播放/, 'the experimental label is present');
  assert.match(source, /已验证样例/, 'the verified label is present');
});

await checked('An unverified catalogue selection never auto-starts', () => {
  const eligible = (settings, state = {}) => evaluate(eligibleSource[1], {
    cancelled: false, disposed: false, started: false,
    autoStartWanted: settings.weAutoStart === true && settings.weMode === 'daily' && VERIFIED_SCENE_IDS.includes(settings.weScene),
    userActionRevision: 0, actionsAtStart: 0, playbackModeRevision: 0, modeAtStart: 0,
    settings, themeSignal: { getSnapshot: () => true },
  });
  assert.equal(eligible({ weAutoStart: true, weMode: 'daily', weScene: 'lucy', background: 'wallpaper' }), true, 'the accepted sample keeps its automatic path');
  assert.equal(eligible({ weAutoStart: true, weMode: 'daily', weScene: `we-${'b'.repeat(24)}`, background: 'wallpaper' }), false, 'an unverified selection must not auto-start');
  assert.equal(eligible({ weAutoStart: false, weMode: 'daily', weScene: 'lucy', background: 'wallpaper' }), false, 'the switch still decides');
  assert.equal(eligible({ weAutoStart: true, weMode: 'preview', weScene: 'lucy', background: 'wallpaper' }), false, 'preview is never the automatic mode');
});

await checked('The panel shows the next selection and the current picture separately', () => {
  assert.match(source, /data-wm-selected-scene/, 'the selected id is exposed');
  assert.match(source, /data-wm-playing-scene/, 'the playing id is exposed');
  assert.match(source, /selectedItem: "/, 'the selection label exists');
  assert.match(source, /playingItem: "/, 'the playing label exists');
  // The playing value comes from the Host's report of the live run, not from the selection.
  assert.match(source, /wallpaperStatus\.host\?\.activeSceneId/, 'the playing scene is read from the host status');
  assert.match(source, /selectedUnavailable/, 'a missing selection is stated instead of being silently replaced');
  assert.match(source, /autoStartSkipped/, 'the manual-only rule is explained');
});

await checked('An unavailable item is visible, explained and cannot become the selection', () => {
  // The list renderer is a JSX-free call expression; take from its declaration to the next top-level
  // declaration so the assertions look at the renderer itself.
  const start = source.indexOf('const libraryList = () =>');
  const end = source.indexOf('const wallpaperRow = () =>', start);
  assert.notEqual(start, -1, 'the list renderer must exist');
  assert.notEqual(end, -1, 'the list renderer must be followed by the row renderer');
  const listBlock = source.slice(start, end);
  assert.match(listBlock, /data-wm-scene-available/, 'availability is exposed per item');
  assert.match(listBlock, /aria-disabled/, 'an unavailable item is announced as disabled');
  assert.match(listBlock, /if \(item\.available\) update\("weScene", item\.id\)/, 'the click is guarded, so an unavailable item cannot be selected');
  assert.match(listBlock, /sceneReasonText\(item\)/, 'the reason is rendered');
  // The reason is plain text: no dangerouslySetInnerHTML anywhere in the picker.
  assert.equal(source.includes('dangerouslySetInnerHTML'), false, 'author text must never be inserted as markup');
});

await checked('Start and restart need a usable selection; stop never depends on the list', () => {
  assert.match(source, /"data-wm-action": "wallpaper-refresh"/, 'the refresh control exists');
  const startButton = source.match(/"data-wm-action": "wallpaper-start", disabled: ([^,]+),/)[1];
  const restartButton = source.match(/"data-wm-action": "wallpaper-restart", disabled: ([^,]+),/)[1];
  const stopButton = source.match(/"data-wm-action": "wallpaper-stop", disabled: ([^,]+),/)[1];
  // Start/restart are gated on the selection being usable, which is what the reviewer asked for.
  assert.match(startButton, /selectionUsable\(\)/, `start must require a usable selection: ${startButton}`);
  assert.match(restartButton, /selectionUsable\(\)/, `restart must require a usable selection: ${restartButton}`);
  // Stop must NOT be gated on the selection or on the library state: loading, a failed refresh or an
  // unusable selection may never take the stop control away.
  assert.equal(/selectionUsable|library|loading/.test(stopButton), false, `stop must stay independent of the list: ${stopButton}`);
  assert.match(stopButton, /previewActive/, 'stop stays available for a live run');
  assert.match(stopButton, /cleanupFailed/, 'stop stays available to retry an unproven close');
  // The action layer guards as well, so a programmatic click cannot submit the switch either.
  const runPreview = block('const runPreview = (action) => async () => {');
  assert.match(runPreview, /if \(!selectionUsable\(\)/, 'the action layer re-checks the selection');
});

await checked('R2: the sample and a confirmed entry stay usable while the list is busy', () => {
  // The same source text the buttons use, evaluated against the states the panel can be in. The
  // unknown-id contract now lives in the R2 check above; this one is about not over-blocking.
  // Both decisions are extracted as complete expressions: one is a one-liner, the other a block whose
  // closing brace sits at the same indentation as the declaration.
  const usableSource = source.match(/const selectionUsable = (\(\) => [^\n]*?);\r?\n/)[1];
  const stateStart = source.indexOf('const selectionState = () => {');
  const stateClosing = source.slice(stateStart).match(/\r?\n      };/);
  const stateEnd = stateClosing ? stateStart + stateClosing.index : -1;
  assert.notEqual(stateStart, -1, 'the selection state must exist');
  assert.notEqual(stateEnd, -1, 'the selection state must have an end at its own indentation');
  const stateSource = source.slice(stateStart + 'const selectionState = '.length, stateEnd + stateClosing[0].length - 1);
  const withState = (settings, item, libraryState) => {
    const fn = evaluate(usableSource, {
      library: libraryState,
      selectedItem: () => item,
      selectionState: evaluate(stateSource, {
        settings,
        library: libraryState,
        selectedItem: () => item,
        isSceneId: value => value === 'lucy' || /^we-[0-9a-f]{24}$/.test(String(value ?? '')),
        selectionIsSample: () => settings.weScene === 'lucy',
      }),
    });
    return fn();
  };
  // The sample is decided by its own file and must not flip while the list is loading.
  assert.equal(withState({ weScene: 'lucy' }, { id: 'lucy', available: true }, { loaded: false, state: 'idle', items: [] }), true, 'the sample stays usable before the list arrives');
  assert.equal(withState({ weScene: 'lucy' }, { id: 'lucy', available: true }, { loaded: true, state: 'ready', items: [] }), true, 'the sample stays usable with an empty library');
  assert.equal(withState({ weScene: 'lucy' }, { id: 'lucy', available: false }, { loaded: true, state: 'ready', items: [] }), false, 'a sample whose file is gone cannot be submitted');
  // A confirmed catalogue entry keeps working during a refresh.
  const catalogId = `we-${'a'.repeat(24)}`;
  assert.equal(withState({ weScene: catalogId }, { id: catalogId, available: true }, { loaded: true, state: 'ready', loading: true, items: [] }), true, 'a confirmed entry survives a refresh');
});

await checked('The list is read on demand and never by a status poll or a render', () => {
  assert.equal(source.includes('wallpaperStatus.host?.items'), false, 'the render path must not read or trigger a scan');
  assert.match(source, /React\.useEffect\(\(\) => \{ loadLibrary\(false\); \}, \[loadLibrary\]\)/, 'the panel loads the cached list once');
  assert.match(source, /loadLibrary\(true\)/, 'only the refresh control asks the Host to rescan');
  assert.match(source, /libraryAbort\.current\?\.abort/, 'a superseded read is aborted');
  assert.match(source, /request !== libraryRequest\.current/, 'a late answer is discarded');
  assert.match(source, /if \(!mounted\.current \|\| request !== libraryRequest\.current\) return;/, 'an unmounted panel discards its answer');
});

await checked('The picker keeps the layout rules it replaced the select with', () => {
  assert.match(source, /\.wm-wallpaper-list \{[\s\S]*?max-height:/, 'the list scrolls instead of stretching the panel');
  assert.match(source, /\.wm-wallpaper-item\[aria-disabled="true"\]/, 'a disabled item is visibly inert');
  assert.match(source, /\.wm-wallpaper-item-title \{[\s\S]*?text-overflow: ellipsis/, 'a long name is truncated with the full name kept in the title attribute');
  assert.match(source, /\.wm-wallpaper-selection-head \{[\s\S]*?flex-wrap: wrap/, 'the head wraps in a narrow panel');
  assert.match(source, /\.wm-wallpaper-refresh \{[\s\S]*?flex: 0 0 auto/, 'the refresh control keeps its own size');
  assert.match(source, /@container \(max-width: 320px\)/, 'the existing three-button narrow rule is untouched');
});

await checked('R2: an unconfirmed catalogue selection cannot be submitted', () => {
  // selectionState() is the decision both the buttons and the warning use, evaluated here against
  // the states the panel can really be in.
  const stateSource = block('const selectionState = () => {').replace('const selectionState = ', '');
  const at = (settings, libraryState, item) => {
    const fn = evaluate(stateSource, {
      settings,
      library: libraryState,
      selectedItem: () => item,
      isSceneId: value => value === 'lucy' || /^we-[0-9a-f]{24}$/.test(String(value ?? '')),
      selectionIsSample: () => settings.weScene === 'lucy',
    });
    return fn();
  };
  const catalogId = `we-${'a'.repeat(24)}`;
  const catalogSettings = { weScene: catalogId };

  // The two states the reviewer reproduced: an empty snapshot and no snapshot at all.
  assert.equal(at(catalogSettings, { loaded: false, state: 'idle', items: [] }, null), 'pending', 'an unloaded library cannot confirm the id');
  assert.equal(at(catalogSettings, { loaded: true, state: 'ready', items: [] }, null), 'unusable', 'a read empty library means the id is missing');
  assert.equal(at(catalogSettings, { loaded: true, state: 'ready', items: [{ id: 'other', available: true }] }, null), 'unusable', 'a read list without the id means it is missing');
  assert.equal(at(catalogSettings, { loaded: false, state: 'failed', items: [] }, null), 'pending', 'a failed read is "waiting", not "deleted"');
  // A confirmed entry, a listed-unavailable entry, and the sample with its own file state.
  assert.equal(at(catalogSettings, { loaded: true, state: 'ready', items: [] }, { id: catalogId, available: true }), 'verified', 'a confirmed entry is usable');
  assert.equal(at(catalogSettings, { loaded: true, state: 'ready', items: [] }, { id: catalogId, available: false }), 'unusable', 'a listed-unavailable entry is not usable');
  assert.equal(at({ weScene: 'lucy' }, { loaded: true, state: 'ready', items: [] }, { id: 'lucy', available: true }), 'verified', 'the sample is decided by its own file');
  assert.equal(at({ weScene: 'lucy' }, { loaded: true, state: 'ready', items: [] }, { id: 'lucy', available: false }), 'unusable', 'a sample whose file is gone blocks its own start');
  assert.equal(at({ weScene: 'nope' }, { loaded: true, state: 'ready', items: [] }, null), 'unknown', 'a value that is not an id at all is not usable');
  // A refresh keeps a confirmed entry usable: loading state alone never invalidates it.
  assert.equal(at(catalogSettings, { loaded: true, state: 'ready', loading: true, items: [] }, { id: catalogId, available: true }), 'verified', 'a confirmed entry survives a refresh');
});

await checked('R2: the buttons and the warning follow the selection state', () => {
  const startButton = source.match(/"data-wm-action": "wallpaper-start", disabled: ([^,]+),/)[1];
  const restartButton = source.match(/"data-wm-action": "wallpaper-restart", disabled: ([^,]+),/)[1];
  const stopButton = source.match(/"data-wm-action": "wallpaper-stop", disabled: ([^,]+),/)[1];
  // selectionUsable() is exactly "verified", so pending blocks both buttons.
  assert.match(source, /const selectionUsable = \(\) => selectionState\(\) === "verified";/, 'usable means confirmed');
  assert.match(source, /const selectionPending = \(\) => selectionState\(\) === "pending";/, 'pending is its own state');
  assert.match(startButton, /!selectionUsable\(\)/, 'start is disabled while the selection is unconfirmed');
  assert.match(restartButton, /!selectionUsable\(\)/, 'restart is disabled while the selection is unconfirmed');
  assert.equal(/selectionUsable|selectionPending|library|loading/.test(stopButton), false, `stop must stay independent of the list: ${stopButton}`);
  // The "waiting" wording exists and is shown for the pending state, not the unavailable one.
  assert.match(source, /selectionPending\(\)\s*\r?\n?\s*\? h\("p"/, 'the pending state renders its own line');
  assert.match(source, /selectedPending: "/, 'the waiting wording exists');
  const runPreview = block('const runPreview = (action) => async () => {');
  assert.match(runPreview, /if \(!selectionUsable\(\)/, 'the action layer refuses an unconfirmed selection');
});

after(async () => {
  await writeFile(join(evidence, 'ui-library-checks.json'), JSON.stringify({ cases, evidence, cleanup: 'Evidence only; nothing is deleted' }, null, 2));
  console.log('UI library check evidence:', evidence);
});
