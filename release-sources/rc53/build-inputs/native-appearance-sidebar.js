// These rules belong to Whale's own view; a host class name alone provides no styling.
export const NATIVE_APPEARANCE_CONTROLS_CSS = `
[data-whale-native-sidebar] {
  display: flex; flex: 1 1 auto; flex-direction: column; height: 100%; min-height: 0;
  min-width: 0; overflow: hidden; box-sizing: border-box; line-height: 1.5;
  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-layer-1));
}
[data-whale-native-sidebar] [data-whale-settings-navigation] {
  display: flex; flex: none; gap: 8px; padding: 12px 16px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
[data-whale-native-sidebar] [data-whale-settings-section] { flex: 1; min-width: 0; }
[data-whale-native-sidebar] [data-whale-settings-section][aria-selected="true"] {
  color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-button-info-fill);
}
[data-whale-native-sidebar] [data-whale-playback-header] {
  flex: none; min-width: 0; padding: 8px 16px; border-bottom: 1px solid var(--dsw-alias-border-l2); background: transparent;
}
[data-whale-native-sidebar] [data-whale-playback-header] > p { margin: 8px 0; }
[data-whale-native-sidebar] [data-whale-current-object] {
  display: flex; align-items: center; gap: 8px; min-width: 0;
}
[data-whale-native-sidebar] [data-whale-object-preview] { width: 48px; flex: none; overflow: hidden; border-radius: 4px; }
[data-whale-native-sidebar] [data-whale-current-object] [data-whale-object-title] { flex: 1; min-width: 0; margin-bottom: 0; }
[data-whale-native-sidebar] [data-whale-object-title] {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; margin-bottom: 8px;
}
[data-whale-native-sidebar] [data-whale-page-panel] {
  flex: 1 1 auto; min-height: 0; min-width: 0; overflow: auto; overscroll-behavior: contain;
  padding: 16px; box-sizing: border-box;
}
[data-whale-native-sidebar] [data-whale-page-panel][hidden] { display: none; }
[data-whale-native-sidebar] :where(button, input, select, textarea) {
  box-sizing: border-box; font: inherit;
}
[data-whale-native-sidebar] button {
  color: inherit; cursor: pointer; line-height: 1.4;
}
[data-whale-native-sidebar] button:not([data-whale-gallery-item]) {
  min-height: 32px; padding: 5px 10px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-button-elevated-fill);
}
[data-whale-native-sidebar] button:not([data-whale-gallery-item]):enabled:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
[data-whale-native-sidebar] button:not([data-whale-gallery-item]):enabled:active {
  background: var(--dsw-alias-interactive-bg-active);
}
[data-whale-native-sidebar] button[data-whale-playback-action] {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px; width: auto; min-width: 32px; padding: 5px 8px;
  background: var(--dsw-alias-button-elevated-fill); color: var(--dsw-alias-label-primary);
}
[data-whale-native-sidebar] button[data-whale-playback-recovery="true"] { width: auto; }
[data-whale-native-sidebar] button:is([data-whale-playback-action="start"], [data-whale-playback-action="switch"]) { color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-play-icon] { width: 14px; height: 14px; fill: currentColor; }
[data-whale-native-sidebar] [data-whale-object-status]::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-inline-end: 5px; background: currentColor; }
[data-whale-native-sidebar] [data-whale-object-status][data-playing="true"]::before { background: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar][data-whale-settings-page="interface"] [data-whale-object-preview] { width: 32px; }
[data-whale-native-sidebar][data-whale-settings-page="interface"] [data-whale-playback-header] { padding-block: 5px; }
[data-whale-native-sidebar] [data-whale-object-row] { display: flex; align-items: center; gap: 6px; min-width: 0; }
[data-whale-native-sidebar] [data-whale-object-row] > [data-whale-current-object] { flex: 1; }
[data-whale-native-sidebar] [data-whale-header-actions] { max-width: 100%; flex-wrap: wrap; justify-content: flex-end; }
@container (max-width: 359px) { [data-whale-native-sidebar] [data-whale-object-row] { flex-wrap: wrap; } }
@container (max-width: 359px) { [data-whale-native-sidebar] [data-whale-object-row] > [data-whale-current-object] [data-whale-object-preview] { display: none; } }

[data-whale-native-sidebar] [data-whale-change-wallpaper] { margin-inline-end: 6px; }
[data-whale-native-sidebar] :where(input[type="search"], input[type="text"], input[type="number"], select, textarea) {
  min-height: 32px; padding: 5px 8px; border-radius: 6px;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-button-elevated-fill);
  border: 1px solid var(--dsw-alias-border-l2);
}
[data-whale-native-sidebar] input::placeholder { color: var(--dsw-alias-label-secondary); opacity: 1; }
[data-whale-native-sidebar] select { color-scheme: inherit; cursor: pointer; }
[data-whale-native-sidebar] input[type="checkbox"] {
  width: 16px; height: 16px; margin: 0; flex-shrink: 0; vertical-align: middle;
  accent-color: var(--dsw-alias-brand-primary); cursor: pointer;
}
[data-whale-native-sidebar] label:has(input[type="checkbox"]) { min-height: 32px; }
[data-whale-native-sidebar] input[type="range"] { min-height: 24px; cursor: pointer; }
[data-whale-native-sidebar] summary { min-height: 32px; padding-block: 5px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; list-style: none; cursor: pointer; }
[data-whale-native-sidebar] summary::marker { content: ''; }
[data-whale-native-sidebar] summary::-webkit-details-marker { display: none; }
[data-whale-native-sidebar] summary::before, [data-whale-native-sidebar] [data-whale-chevron] { content: ''; display: inline-block; width: .45em; height: .45em; flex: none; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); }
[data-whale-native-sidebar] details[open] > summary::before, [data-whale-native-sidebar] [data-whale-chevron="down"] { transform: rotate(45deg); }
[data-whale-native-sidebar] [data-whale-chevron="left"] { transform: rotate(135deg); }
[data-whale-native-sidebar] [data-whale-choice][aria-expanded="true"] [data-whale-choice-chevron] { transform: rotate(225deg); }
[data-whale-native-sidebar] :where(button, input, select, textarea):disabled {
  opacity: .45; cursor: not-allowed;
}
[data-whale-native-sidebar] [aria-busy="true"] { cursor: progress; }
[data-whale-native-sidebar] :where(button, input, select, textarea, summary):focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: 2px;
}
[data-whale-native-sidebar] [role="alert"] { color: var(--dsw-alias-label-error); }
[data-whale-native-sidebar] [data-whale-author-feedback] {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; min-width: 18px; flex: 0 0 18px; align-self: center;
  color: var(--dsw-alias-label-secondary);
}
[data-whale-native-sidebar] [data-whale-author-feedback][data-state="error"] { color: var(--dsw-alias-label-error); }
[data-whale-native-sidebar] [data-whale-author-feedback-text] {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
}
[data-whale-native-sidebar] [data-whale-author-heading] { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%; margin: 0 0 8px; }
[data-whale-native-sidebar] [data-whale-author-heading] [data-whale-author-read] { margin-inline-start: auto; min-width: 32px; }
[data-whale-native-sidebar] [data-whale-author-name] { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; }
[data-whale-native-sidebar] [data-whale-author-name] > label { min-width: 0; cursor: pointer; }
[data-whale-native-sidebar] [data-whale-author-bool-row] [data-whale-author-name] > label { display: flex; align-items: center; flex: 1; min-height: 32px; }
[data-whale-native-sidebar] [data-whale-author-name] [data-whale-action-menu] { flex: none; }
[data-whale-native-sidebar] [data-whale-action-menu] button[aria-haspopup="dialog"] { display: inline-grid; place-items: center; padding: 4px; min-width: 24px; min-height: 28px; }
[data-whale-native-sidebar] [data-whale-info-icon] { width: 14px; height: 14px; }
[data-whale-native-sidebar] [data-whale-help-content] { overflow-wrap: anywhere; }
[data-whale-native-sidebar] [data-whale-help-content] p { margin: 6px 4px 10px; font-size: .875em; font-weight: 400; }

[data-whale-native-sidebar] { container-type: inline-size; }
[data-whale-native-sidebar] [data-whale-settings-navigation] { gap: 20px; padding-block: 8px; }
[data-whale-native-sidebar] button[data-whale-settings-section] { flex: 0 0 auto; border: 0; border-radius: 0; background: transparent; padding-inline: 0; border-bottom: 2px solid transparent; }
[data-whale-native-sidebar] button[data-whale-settings-section][aria-selected="true"] { background: transparent; border-bottom-color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-object-summary] { min-width: 0; flex: 1; }
[data-whale-native-sidebar] [data-whale-object-title] { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
[data-whale-native-sidebar] [data-whale-object-status] { color: var(--dsw-alias-label-primary); font-size: .8125em; }
[data-whale-native-sidebar] [data-whale-preview-placeholder] { display: block; aspect-ratio: 16/9; background: var(--dsw-alias-button-elevated-fill); }
[data-whale-native-sidebar] [data-whale-header-actions] { display: flex; align-items: center; flex: none; gap: 4px; }

[data-whale-native-sidebar] button[data-whale-quiet] { border-color: transparent; background: transparent; color: var(--dsw-alias-label-secondary); }
[data-whale-native-sidebar] [data-whale-control-group] { border: 0; padding: 0; margin: 0 0 24px; min-width: 0; display: grid; gap: 12px; }
[data-whale-native-sidebar] [data-whale-control-group] > legend { padding: 0; margin-bottom: 12px; font-weight: 600; }
[data-whale-native-sidebar] [data-whale-fold], [data-whale-native-sidebar] [data-whale-playback-options], [data-whale-native-sidebar] [data-whale-presets] { margin: 0 0 12px; min-width: 0; }
[data-whale-native-sidebar] [data-whale-fold-body] { display: grid; gap: 12px; padding: 10px 0; }
[data-whale-native-sidebar] [data-whale-group-error] { color: var(--dsw-alias-label-error); }
[data-whale-native-sidebar] [data-whale-action-menu] { display: inline-flex; align-items: center; flex: none; }
[data-whale-native-sidebar] [data-whale-action-menu-popup] {
  box-sizing: border-box; padding: 4px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px;
  color: var(--dsw-alias-label-primary); background: var(--dsw-specific-menu, var(--dsw-alias-bg-base));
  font: inherit; line-height: 1.5; overflow: auto; overscroll-behavior: contain; box-shadow: 0 3px 12px rgb(0 0 0 / .14);
}
[data-whale-native-sidebar] [data-whale-action-menu-popup]::backdrop { background: transparent; pointer-events: none; }
[data-whale-native-sidebar] [data-whale-action-menu-popup] button { display: block; width: 100%; min-height: 32px; text-align: left; border: 0; background: transparent; }
[data-whale-native-sidebar] [data-whale-action-menu-popup] [data-danger="true"] { color: var(--dsw-alias-label-error); }
[data-whale-native-sidebar] [data-whale-presets] { display: grid; gap: 6px; padding-block: 12px; border-top: 1px solid var(--dsw-alias-border-l2); }
[data-whale-native-sidebar] [data-whale-preset-row] { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
[data-whale-native-sidebar] [data-whale-preset-label] { font-weight: 500; }
[data-whale-native-sidebar] [data-whale-preset-state], [data-whale-native-sidebar] [data-whale-preset-scope] { color: var(--dsw-alias-label-secondary); font-size: .8125em; }
[data-whale-native-sidebar] [data-whale-preset-feedback] { flex: 1 1 18px; min-width: 18px; text-align: end; color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-preset-confirm] { display: grid; gap: 8px; min-width: 0; padding-top: 6px; }
[data-whale-native-sidebar] [data-whale-preset-confirm] p { margin: 0; overflow-wrap: anywhere; }
[data-whale-native-sidebar] [data-whale-preset-values] { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 4px 12px; margin: 0; }
[data-whale-native-sidebar] [data-whale-preset-values] dd { margin: 0; font-variant-numeric: tabular-nums; }
[data-whale-native-sidebar] [data-whale-preset-confirm-actions] { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
[data-whale-native-sidebar] [data-whale-local-actions] { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
[data-whale-native-sidebar] [data-whale-playback-header] > :where(p,div[data-whale-selected-target]) { font-size: .875em; margin: 6px 0 0; }

[data-whale-native-sidebar] [data-whale-choice-segments] { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 4px; min-width: 0; }
[data-whale-native-sidebar] [data-whale-choice-segments="swatches"] { grid-template-columns: repeat(4,minmax(0,1fr)); gap: 6px; }
[data-whale-native-sidebar] [data-whale-choice-segment] { position: relative; min-width: 0; cursor: pointer; }
[data-whale-native-sidebar] [data-whale-choice-segment] input { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; opacity: 0; margin: 0; cursor: inherit; }
[data-whale-native-sidebar] [data-whale-segment-face] { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 5px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; box-sizing: border-box; color: var(--dsw-alias-label-secondary); background: transparent; }
[data-whale-native-sidebar] [data-whale-segment-text] { min-width: 0; overflow-wrap: anywhere; }
[data-whale-native-sidebar] [data-whale-segment-check] { flex: none; width: 1em; font-size: .8125em; text-align: center; }
[data-whale-native-sidebar] [data-whale-choice-segment] input:checked + [data-whale-segment-face] { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover); font-weight: 600; }
[data-whale-native-sidebar] [data-whale-choice-segment] input:focus-visible + [data-whale-segment-face] { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
[data-whale-native-sidebar] [data-whale-choice-segment]:has(input:disabled) { cursor: default; }
[data-whale-native-sidebar] [data-whale-choice-segment] input:active:enabled + [data-whale-segment-face] { transform: scale(.97); }
[data-whale-native-sidebar] [data-whale-choice-segments="swatches"] [data-whale-segment-face] { flex-wrap: wrap; gap: 4px; font-size: .8125em; padding: 8px 4px; }
[data-whale-native-sidebar] [data-whale-palette-swatch] { width: 100%; height: 22px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 4px; box-sizing: border-box; }
[data-whale-native-sidebar] [data-whale-choice-unavailable] { grid-column: 1 / -1; color: var(--dsw-alias-label-secondary); font-size: .8125em; }
@container (max-width: 359px) { [data-whale-native-sidebar] [data-whale-choice-segments="swatches"] { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (forced-colors: active) {
  [data-whale-native-sidebar] [data-whale-choice-segment] input:checked + [data-whale-segment-face] { border: 2px solid Highlight; color: CanvasText; background: Canvas; }
  [data-whale-native-sidebar] [data-whale-choice-segment] input:focus-visible + [data-whale-segment-face] { outline-color: Highlight; }
  [data-whale-native-sidebar] [data-whale-palette-swatch] { forced-color-adjust: none; }
}
@media (prefers-reduced-motion: reduce) { [data-whale-native-sidebar] [data-whale-choice-segment] input:active:enabled + [data-whale-segment-face] { transform: none; } }

@media (max-height: 400px) {
  [data-whale-native-sidebar] { overflow: auto; }
  [data-whale-native-sidebar] [data-whale-page-panel] { flex: none; overflow: visible; }
}

[data-whale-native-sidebar] :where(input,button,select,textarea,output) { font-variant-numeric: tabular-nums; }
[data-whale-native-sidebar] :where(button,input,textarea) { box-shadow: none; }
[data-whale-native-sidebar] [data-whale-author-switches] { margin: 0 0 24px !important; gap: 12px !important; }
[data-whale-native-sidebar] [data-whale-author-switches] > :is(label,[data-whale-author-bool-row]) { display: grid !important; grid-template-columns: minmax(0,1fr) auto; column-gap: 8px; align-items: center; min-height: 36px; }
[data-whale-native-sidebar] [data-whale-author-switches] > label > span:first-child { overflow-wrap: anywhere; }
[data-whale-native-sidebar] input[type="checkbox"]:is([data-whale-author-key],[data-whale-interface-toggle],[data-whale-playback-option]) {
  appearance: none; width: 30px; height: 18px; min-width: 30px; border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px; background: var(--dsw-specific-selector, var(--dsw-alias-button-elevated-fill)); border-color: var(--dsw-alias-label-secondary); position: relative; margin: 0;
}
[data-whale-native-sidebar] input[type="checkbox"]:is([data-whale-author-key],[data-whale-interface-toggle],[data-whale-playback-option])::before {
  content: ''; position: absolute; width: 12px; height: 12px; top: 2px; left: 2px;
  border-radius: 50%; background: var(--dsw-alias-label-primary);
}
[data-whale-native-sidebar] input[type="checkbox"]:is([data-whale-author-key],[data-whale-interface-toggle],[data-whale-playback-option]):checked { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] input[type="checkbox"]:is([data-whale-author-key],[data-whale-interface-toggle],[data-whale-playback-option]):checked::before { left: 14px; background: var(--wm-custom-btn-fg, #fff); }
[data-whale-native-sidebar] input[type="checkbox"][data-whale-interface-toggle]:indeterminate::before { left: 8px; }
[data-whale-native-sidebar] input[type="range"] { appearance: none; background: transparent; height: 24px; accent-color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] input[type="range"]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l2); }
[data-whale-native-sidebar] input[type="range"]::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; margin-top: -5px; border-radius: 50%; background: var(--dsw-alias-brand-primary); border: 1px solid var(--dsw-alias-border-l2); }
[data-whale-native-sidebar] input[type="range"]::-moz-range-track { height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l2); }
[data-whale-native-sidebar] input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 50%; background: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-gallery-grid] { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; min-width: 0; }
[data-whale-native-sidebar] button[data-whale-gallery-item] { position: relative; padding: 0; display: block; min-width: 0; overflow: hidden; text-align: left; font: inherit; color: inherit; background: transparent; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l2); }
[data-whale-native-sidebar] button[data-whale-gallery-item][aria-pressed="true"] { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-button-info-fill); }
[data-whale-native-sidebar] [data-whale-gallery-thumbnail] { position: relative; }
[data-whale-native-sidebar] [data-whale-gallery-type] { position: absolute; top: 4px; left: 4px; padding: 1px 5px; border-radius: 3px; font-size: .6875em; line-height: 1.5; color: var(--dsw-alias-label-primary); background: var(--dsw-specific-menu, var(--dsw-alias-bg-base)); }
[data-whale-native-sidebar] [data-whale-gallery-caption] { display: flex; align-items: center; gap: 4px; min-width: 0; padding: 6px; font-size: .8125em; }
[data-whale-native-sidebar] [data-whale-gallery-title] { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-whale-native-sidebar] [data-whale-gallery-selected] { flex: none; color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-gallery-item]:enabled:hover { background: var(--dsw-alias-interactive-bg-hover); }
[data-whale-native-sidebar] [data-whale-gallery-item]:disabled { opacity: .5; }
[data-whale-native-sidebar] [data-whale-gallery-playing] { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; font-size: .6875em; color: var(--dsw-alias-label-primary); background: var(--dsw-specific-menu, var(--dsw-alias-bg-base)); }
[data-whale-native-sidebar] [data-whale-gallery-count] { color: var(--dsw-alias-label-secondary); font-size: .8125em; }
[data-whale-native-sidebar] [data-whale-gallery-pagination] { position: sticky; bottom: -16px; margin-bottom: -16px; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 6px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: rgb(var(--wm-layer2-rgb)); color: var(--dsw-alias-label-primary); }
[data-whale-native-sidebar] [data-whale-gallery-pagination] output { font-size: .8125em; font-variant-numeric: tabular-nums; }
[data-whale-native-sidebar] [data-whale-gallery-pagination] button { min-width: 32px; }
@container (min-width: 480px) { [data-whale-native-sidebar] [data-whale-gallery-grid] { grid-template-columns: repeat(3,minmax(0,1fr)); } }
@container (max-width: 299px) { [data-whale-native-sidebar] [data-whale-gallery-grid] { grid-template-columns: minmax(0,1fr); } }
@media (forced-colors: active) {
  [data-whale-native-sidebar] input[type="checkbox"]:is([data-whale-author-key],[data-whale-interface-toggle],[data-whale-playback-option]),
  [data-whale-native-sidebar] input[type="range"] { appearance: auto; }
  [data-whale-native-sidebar] input[type="checkbox"]::before { display: none; }
}

[data-whale-native-sidebar] [data-whale-choice-root] { display: block; min-width: 0; }
[data-whale-native-sidebar] button[data-whale-choice] { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; padding: 5px 10px; min-height: 32px; }
[data-whale-native-sidebar] [data-whale-choice-label] { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-whale-native-sidebar] [data-whale-choice-chevron] { margin-inline: 4px; }
[data-whale-native-sidebar] [data-whale-choice-list] {
  box-sizing: border-box; padding: 4px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); font: inherit; line-height: 1.5;
  overflow: auto; overscroll-behavior: contain; box-shadow: 0 3px 12px rgb(0 0 0 / .14);
}
[data-whale-native-sidebar] [data-whale-choice-list]::backdrop { background: transparent; pointer-events: none; }
[data-whale-native-sidebar] [data-whale-choice-list] [role="option"] { display: flex; gap: 8px; align-items: baseline; min-height: 32px; padding: 5px 8px; border-radius: 4px; box-sizing: border-box; overflow-wrap: anywhere; cursor: pointer; }
[data-whale-native-sidebar] [data-whale-choice-check] { flex: 0 0 16px; color: var(--dsw-alias-brand-primary); }
[data-whale-native-sidebar] [data-whale-choice-list] [aria-selected="true"] { background: var(--dsw-alias-button-info-fill); }
[data-whale-native-sidebar] [data-whale-choice-list] [data-active="true"] { outline: 1px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: -1px; }
[data-whale-native-sidebar] [data-whale-choice-list] [role="option"]:not([aria-disabled="true"]):hover { background: var(--dsw-alias-interactive-bg-hover); }
[data-whale-native-sidebar] [data-whale-choice-list] [aria-disabled="true"] { color: var(--dsw-alias-label-secondary); cursor: not-allowed; }
@media (prefers-reduced-motion: reduce) { [data-whale-native-sidebar] *,[data-whale-native-sidebar] *::before { transition: none !important; } }

`;

export const NATIVE_APPEARANCE_TRIGGER_CSS = `
button[data-whale-native-trigger] {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 28px; padding: 4px 8px; box-sizing: border-box;
  border: 1px solid transparent; border-radius: 6px;
  color: inherit; background: transparent; font: inherit; line-height: 1.4; cursor: pointer;
}
button[data-whale-native-trigger]:enabled:hover { background: var(--dsw-alias-interactive-bg-hover); }
button[data-whale-native-trigger]:enabled:active { background: var(--dsw-alias-interactive-bg-active); }
button[data-whale-native-trigger]:disabled { opacity: .45; cursor: not-allowed; }
button[data-whale-native-trigger]:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: 2px;
}
`;

// One command gate belongs to the controller integration, not a provider/view generation.
/** One editor surface at a time; a timed-out close never grants editing permission. */
export function createAppearanceEditorGate({readBridge,dock,timers=globalThis,timeoutMs=4000}={}) {
  const listeners=new Set(),leases=new Set();
  let disposed=false,pending=null,blocked=false,message=null,snapshot;
  function bridgeSafe(){try{const value=readBridge();return value?.mode==='docked'&&value.unconfirmedCleanup===false;}catch{return false;}}
  function refresh(){
    if(disposed)return;
    const safe=bridgeSafe()&&!pending&&!blocked;
    const next={nativeAllowed:safe&&leases.size===0,legacyAllowed:safe&&leases.size>0,
      canRequestNative:leases.size===0&&!pending,busy:pending!==null,message:leases.size>0&&safe?'请先关闭通用设置或旧外观页':message};
    if(snapshot&&Object.keys(next).every(key=>Object.is(next[key],snapshot[key])))return;
    snapshot=Object.freeze(next);for(const fn of [...listeners])fn();
  }
  function prepare(){
    if(disposed)return {ok:false,error:'disposed'};
    if(pending)return {ok:false,error:'cleanup-busy'};
    // A late close result needs a new user gesture, including when it eventually succeeded.
    blocked=false;message=null;
    if(bridgeSafe()){refresh();return {ok:true};}
    const ticket={timer:null,expired:false};pending=ticket;message='正在关闭旧独立窗…';refresh();
    ticket.timer=timers.setTimeout(()=>{if(disposed||pending!==ticket)return;ticket.expired=true;blocked=true;message='独立窗关闭结果未确认，请稍后重试';refresh();},timeoutMs);
    Promise.resolve().then(()=>dock()).then(result=>{
      if(disposed||pending!==ticket)return;
      if(!ticket.expired&&!ticket.abandoned){blocked=result?.ok!==true||!bridgeSafe();message=blocked?'独立窗关闭未确认，请重试':'旧独立窗已关闭，请再次打开侧栏';}
    },()=>{if(!disposed&&pending===ticket){blocked=true;message='独立窗关闭未确认，请重试';}}).finally(()=>{
      timers.clearTimeout(ticket.timer);if(disposed||pending!==ticket)return;pending=null;refresh();
    });
    return {ok:false,error:'cleanup-required'};
  }
  refresh();
  return Object.freeze({getSnapshot:()=>snapshot,subscribe(fn){if(disposed)return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},refresh,
    prepareNative(){if(leases.size)return {ok:false,error:'legacy-editor-active'};return prepare();},
    acquireLegacy(){if(disposed)return()=>{};const token=Symbol('legacy-editor');leases.add(token);refresh();prepare();let released=false;
      return()=>{if(released)return;released=true;leases.delete(token);if(!leases.size&&pending){pending.abandoned=true;blocked=true;message='编辑页已关闭，请再次打开外观侧栏';}refresh();};},
    retry:prepare,
    dispose(){if(disposed)return;disposed=true;if(pending)timers.clearTimeout(pending.timer);leases.clear();listeners.clear();},
  });
}

/** Mount the old controls only after the native editors have been withdrawn. */
export function createLegacyAppearanceBoundary({React,editorGate,Component}) {
  return function LegacyAppearanceBoundary(props){
    const state=React.useSyncExternalStore(editorGate.subscribe,editorGate.getSnapshot,editorGate.getSnapshot);
    const [admitted,setAdmitted]=React.useState(false);
    React.useEffect(()=>{const release=editorGate.acquireLegacy();setAdmitted(true);return()=>{release();};},[]);
    if(!admitted||!state.legacyAllowed)return React.createElement('div',{'data-whale-legacy-pending':true},
      React.createElement('span',{role:'status'},state.message??'外观编辑尚未就绪'),
      admitted&&!state.busy?React.createElement('button',{type:'button',className:'dsw-btn',onClick:()=>editorGate.retry()},'重试'):null);
    return React.createElement('div',{'data-whale-legacy-editor':true},React.createElement(Component,props));
  };
}

export function createNativePlaybackGate({timers=globalThis,timeoutMs=12000}={}) {
  const listeners=new Set(),tasks=new Set();
  let disposed=false,current=null,unknown=false,error=null;
  const deadline=Number.isFinite(timeoutMs)&&timeoutMs>0?timeoutMs:12000;
  const notify=()=>{if(!disposed)for(const fn of [...listeners])fn();};
  return {
    read:()=>({busy:!!current&&!current.uiDone,action:current?.action??null,unknown,error,draining:tasks.size>0,
      canStart:!disposed&&!unknown&&tasks.size===0,
      canStop:!disposed&&(!current||current.uiDone)&&![...tasks].some(task=>task.action==='stop')}),
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    run(action,invoke){
      if(disposed)return Promise.resolve({ok:false,error:'disposed'});
      if((current&&!current.uiDone)||(action==='start'&&(unknown||tasks.size))||(action==='stop'&&[...tasks].some(task=>task.action==='stop')))return Promise.resolve({ok:false,error:'busy'});
      const task={action,uiDone:false,timer:null,resolve:null};current=task;tasks.add(task);error=null;
      const result=new Promise(resolve=>{task.resolve=resolve;});
      const finishUI=value=>{if(task.uiDone)return;task.uiDone=true;timers.clearTimeout(task.timer);task.resolve(value);};
      task.timer=timers.setTimeout(()=>{if(disposed)return;finishUI({ok:false,error:'playback-result-unknown'});if(current===task){unknown=true;error='操作结果未确认';}notify();},deadline);
      // Publish the lock before invoking a controller that can synchronously notify other views.
      notify();
      let returned;
      try{returned=invoke();}catch{finish(false,null);return result;}
      Promise.resolve(returned).then(value=>finish(true,value),()=>finish(false,null));
      function finish(fulfilled,value){
        tasks.delete(task);
        if(disposed){finishUI({ok:false,error:'disposed'});return;}
        if(current===task){
          const failed=value?.ok===false||['error','cleanup-failed'].includes(value?.state)||
            (action==='stop'&&(!['idle','stopped'].includes(value?.state)||value?.cleanupPending===true));
          const recognized=fulfilled&&value&&['idle','stopped','starting','connecting','playing','waiting','retrying','stopping','error','cleanup-failed'].includes(value.state);
          unknown=!recognized||(action==='stop'&&failed);
          error=unknown?'操作结果未确认':failed?(action==='start'?'未能开始播放':'停止未确认，请重试清理'):null;
          finishUI({ok:recognized&&!failed,error:unknown?'playback-result-unknown':failed?'playback-failed':null});
        }else finishUI({ok:false,error:'superseded'});
        notify();
      }
      return result;
    },
    dispose(){if(disposed)return;disposed=true;listeners.clear();for(const task of tasks){timers.clearTimeout(task.timer);if(!task.uiDone){task.uiDone=true;task.resolve({ok:false,error:'disposed'});}}tasks.clear();},
  };
}

// Cache confirmation starts only from an explicit open/retry, never a render or visibility change.
export function createNativeCatalogRead(controller,{timers=globalThis,timeoutMs=4000}={}) {
  const listeners=new Set(),views=new Map(),viewReleases=new Set();
  let disposed=false,request=null,error=null;
  const ready=cache=>cache?.ok!==false&&cache?.state==='ready'&&cache?.loaded===true&&cache?.loading!==true;
  const notify=()=>{if(!disposed)for(const fn of [...listeners])fn();};
  const read=()=>({loading:request!==null,error});
  function cancel(){const old=request;if(!old)return;request=null;if(!error)error='目录加载已取消';timers.clearTimeout(old.timer);old.abort.abort();notify();}
  function ensure(){
    if(disposed||request)return;
    let cache;
    try{cache=controller.wallpaper.getLibrarySnapshot?.();}catch{error='壁纸目录暂不可用';notify();return;}
    if(ready(cache)){error=null;notify();return;}
    if(cache?.loading===true||cache?.state==='loading')return;
    if(typeof controller.wallpaper.readLibrary!=='function'){error='壁纸目录暂不可用';notify();return;}
    const own={abort:new AbortController(),timer:null};request=own;error=null;
    own.timer=timers.setTimeout(()=>{if(request!==own||disposed)return;error='壁纸目录读取超时';cancel();},Number.isFinite(timeoutMs)&&timeoutMs>0?timeoutMs:4000);
    notify();
    function finish(failed){
      if(disposed||request!==own)return;
      request=null;timers.clearTimeout(own.timer);
      try{error=!failed&&ready(controller.wallpaper.getLibrarySnapshot?.())?null:'壁纸目录读取失败';}catch{error='壁纸目录暂不可用';}
      notify();
    }
    try{Promise.resolve(controller.wallpaper.readLibrary({ensure:true,signal:own.abort.signal})).then(()=>finish(false),()=>finish(true));}
    catch{finish(true);}
  }
  return {read,ensure,cancel,
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    registerView(token,signal){
      if(disposed)return()=>{};
      views.set(token,false);let released=false;
      const remove=()=>{if(released)return;released=true;signal?.removeEventListener('abort',remove);viewReleases.delete(remove);
        const wasVisible=views.get(token),existed=views.delete(token);if(existed&&(!views.size||wasVisible&&![...views.values()].some(Boolean)))cancel();};
      viewReleases.add(remove);signal?.addEventListener('abort',remove,{once:true});
      if(signal?.aborted)remove();
      return remove;
    },
    visible(token,visible){if(disposed||!views.has(token))return;const had=[...views.values()].some(Boolean);views.set(token,visible===true);if(had&&![...views.values()].some(Boolean))cancel();},
    dispose(){if(disposed)return;cancel();disposed=true;for(const off of [...viewReleases])off();listeners.clear();views.clear();},
  };
}

export function nativeGalleryItems(library,ratings) {
  if(library?.ok===false||library?.state!=='ready'||library?.loaded!==true||library?.loading)return [];
  const seen=new Set(),rows=[];
  for(const item of Array.isArray(library.items)?library.items:[]) {
    if(!item||typeof item.id!=='string'||!/^(?:lucy|we-[a-f0-9]{24})$/.test(item.id)||seen.has(item.id))continue;
    seen.add(item.id);
    const rating=item.contentRating??(item.id==='lucy'?'Everyone':'unknown');
    if(!ratings.includes(rating))continue;
    const supported=['scene','video','web'].includes(item.type);
    rows.push(Object.freeze({id:item.id,title:typeof item.title==='string'&&item.title.trim()?item.title.slice(0,200):item.id==='lucy'?'Lucy':'未命名壁纸',
      type:supported?item.type:'unknown',contentRating:rating,selectable:item.available===true&&supported,
      hasPreview:item.available===true&&supported&&item.previewRef?.wallpaperId===item.id&&item.previewRef?.kind==='preview'}));
  }
  if(!seen.has('lucy')&&ratings.includes('Everyone'))rows.unshift(Object.freeze({id:'lucy',title:'Lucy',type:'scene',contentRating:'Everyone',selectable:true,hasPreview:true}));
  return Object.freeze(rows);
}

// Deadlines include queue wait. A reader ignoring abort keeps its physical slot until settlement.
export function createNativePreviewQueue(loadPreview,{timers=globalThis,timeoutMs=4000}={}) {
  const jobs=new Set(),queue=[];let active=0,disposed=false;
  function pump(){while(!disposed&&active<2&&queue.length){const job=queue.shift();if(job.done)continue;job.started=true;active++;
    let result;try{result=loadPreview(job.id,{signal:job.abort.signal});}catch(error){settled(job,error);continue;}
    Promise.resolve(result).then(blob=>settled(job,null,blob),error=>settled(job,error));}}
  function finishUI(job,error,blob){if(job.done)return;job.done=true;timers.clearTimeout(job.timer);job.signal?.removeEventListener('abort',job.cancel);
    if(error)job.reject(Error('preview-unavailable'));else job.resolve(blob);}
  function cancel(job){finishUI(job,true);job.abort.abort();if(!job.started){jobs.delete(job);const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);}pump();}
  function settled(job,error,blob){active--;jobs.delete(job);const valid=blob&&Number.isFinite(blob.size)&&blob.size>0&&blob.size<=4*1024*1024&&['image/png','image/jpeg','image/gif','image/webp'].includes(blob.type);
    finishUI(job,error||!valid||disposed||job.abort.signal.aborted,blob);pump();}
  return {read:()=>({active,queued:queue.length}),
    request(id,{signal}={}){if(disposed||signal?.aborted||typeof loadPreview!=='function'||typeof id!=='string'||!/^(?:lucy|we-[a-f0-9]{24})$/.test(id))return Promise.reject(Error('preview-unavailable'));
      return new Promise((resolve,reject)=>{const job={id,signal,resolve,reject,abort:new AbortController(),done:false,started:false,timer:null,cancel:null};job.cancel=()=>cancel(job);jobs.add(job);
        job.timer=timers.setTimeout(job.cancel,timeoutMs);signal?.addEventListener('abort',job.cancel,{once:true});queue.push(job);pump();});},
    dispose(){if(disposed)return;disposed=true;for(const job of [...jobs])cancel(job);jobs.clear();queue.length=0;},
  };
}

// UI conversion only. Protocol authorization/validation stays in the shared author contract.
export function nativeAuthorColor(value){
  if(typeof value!=='string'||!value.trim())return null;const rgb=value.trim().split(/\s+/).map(Number);
  if(rgb.length!==3||rgb.some(n=>!Number.isFinite(n)||n<0||n>1))return null;
  return {rgb,hex:'#'+rgb.map(n=>Math.round(n*255).toString(16).padStart(2,'0')).join('')};
}
export function nativeAuthorColorFromHex(text){return typeof text==='string'&&/^#[a-f0-9]{6}$/i.test(text)?[1,3,5].map(i=>parseInt(text.slice(i,i+2),16)/255).join(' '):null;}

// One UI transaction lane across provider/view replacement. Host still owns the real executor.
export function createNativeAuthorSwitches({request,timers=globalThis,validateValue}={}) {
  const listeners=new Set(),views=new Map();let context=null,wallpaperId=null,epoch=0,active=null,disposed=false,phase='idle',message=null,schema=null,revision=null;
  const initialReadMode=Object.freeze({});let initialReadEpoch=-1;
  let fields=Object.freeze([]),values={},marks={},desired=new Map(),snapshot,recovery=null,owned=null;
  const edits=new Map();
  function valid(field,value){try{return field.type==='bool'?typeof value==='boolean':typeof validateValue==='function'&&validateValue(field,value)===value;}catch{return false;}}
  function cancelEdits(view){for(const [key,edit]of edits)if(view===undefined||edit.ticket.view===view)edits.delete(key);}
  function invalidateStaleRecovery(){if(recovery?.stale&&recovery.allowed)recovery=Object.freeze({...recovery,allowed:false});}
  const currentEdit=ticket=>ticket&&edits.get(ticket.key)?.ticket===ticket&&ticket.epoch===epoch&&ticket.context===context&&views.get(ticket.view)===true&&!disposed;
  const visible=()=>[...views.values()].some(Boolean);
  function publish(){snapshot=Object.freeze({fields,values:Object.freeze({...values,...Object.fromEntries(desired),...Object.fromEntries([...edits].map(([key,edit])=>[key,edit.value]))}),marks:Object.freeze({...marks}),
    phase,message,loading:phase==='reading',busy:active!==null,editing:edits.size>0,canRead:!!context&&visible()&&!active&&!disposed,
    recovery,canDiscard:!!context&&visible()&&!active&&!disposed&&recovery?.allowed===true,
    canEdit:!!context&&visible()&&schema!==null&&!recovery&&['ready','writing'].includes(phase)&&!disposed});
    if(!disposed)for(const fn of [...listeners])fn();}
  function cancel(){if(active)active.abort.abort();}
  function check(job){if(disposed||active!==job||job.abort.signal.aborted||context!==job.context||epoch!==job.epoch||!visible())throw Error('cancelled');}
  function accept(result,{fingerprint=null,expected=null,dirty=[],requireActive=true,allowDirty=false}={}){
    const s=result?.schema,d=result?.draft;
    if(result?.ok!==true){const error=Error('request-failed');error.uncertain=result?.sentMayHaveOccurred===true;throw error;}
    if(!allowDirty&&!dirty.length&&Array.isArray(d?.dirtyKeys)&&d.dirtyKeys.length)throw Error('draft-pending');
    if(s?.wallpaperId!==wallpaperId||s.schemaVersion!==1||!/^([a-f0-9]{64})$/.test(s.fingerprint)||fingerprint&&fingerprint!==s.fingerprint||
      !Array.isArray(s.fields)||s.fields.length>256||!Number.isSafeInteger(d?.revision)||d.revision<0||expected!==null&&d.revision!==expected||d.stale||
      !Array.isArray(d.dirtyKeys)||d.dirtyKeys.length>256||new Set(d.dirtyKeys).size!==d.dirtyKeys.length||
      (allowDirty?d.dirtyKeys.some(key=>typeof key!=='string'||!/^[A-Za-z0-9_]{1,64}$/.test(key)||['__proto__','constructor','prototype'].includes(key.toLowerCase())||!s.fields.some(field=>field.supported===true&&field.key===key)):
        d.dirtyKeys.length!==dirty.length||d.dirtyKeys.some(key=>!dirty.includes(key))))throw Error('response-invalid');
    const found=[],seen=new Set(),next={};
    for(const field of s.fields){
      if(field.supported!==true||!['bool','slider','color','combo','textinput'].includes(field.type)||field.type!=='bool'&&typeof validateValue!=='function')continue;
      if(typeof field.key!=='string'||!/^[A-Za-z0-9_]{1,64}$/.test(field.key)||['__proto__','constructor','prototype'].includes(field.key.toLowerCase())||seen.has(field.key)||!valid(field,d.values?.[field.key]))throw Error('response-invalid');
      seen.add(field.key);
      if(typeof field.label!=='string'||!field.label.trim()||field.label.length>160||/[<>\x00-\x1f]/.test(field.label)||field.label.startsWith('ui_'))continue;
      let range={};
      if(field.type==='slider'){
        // Integer sliders with a fractional lattice need a different UI; never silently round them.
        if(!field.fraction&&field.step!=null&&(!Number.isInteger(field.min)||!Number.isInteger(field.step)))continue;
        range={min:field.min,max:field.max,step:field.step,fraction:field.fraction,supported:true,
          rangeMin:field.fraction?field.min:Math.ceil(field.min),rangeMax:field.fraction?field.max:Math.floor(field.max),rangeStep:field.step??(field.fraction?'any':1)};
        if(range.rangeMin>range.rangeMax)continue;
      }
      if(field.type==='combo'){
        if(!Array.isArray(field.options)||!field.options.length||field.options.length>64)throw Error('response-invalid');
        const options=[],identities=new Set();
        for(const option of field.options){
          if(!option||typeof option!=='object'||!valid(field,option.value)||identities.has(JSON.stringify(option.value)))throw Error('response-invalid');
          identities.add(JSON.stringify(option.value));options.push(Object.freeze({label:option.label,value:option.value}));
        }
        if(options.some(option=>typeof option.label!=='string'||!option.label.trim()||option.label.length>160||/[<>\x00-\x1f\x7f]/.test(option.label)||option.label.startsWith('ui_')))continue;
        range={options:Object.freeze(options)};
      }
      found.push(Object.freeze({key:field.key,label:field.label,type:field.type,supported:true,...range}));next[field.key]=d.values[field.key];
    }
    if(result.application?.available!==true||requireActive&&result.application?.targetActive!==true)throw Error('target-unavailable');
    const delivery=d.delivery?.revision===d.revision&&['none','not-sent','pending','confirmed','unknown','untracked'].includes(d.delivery.state)?d.delivery.state:'untracked';
    return {fingerprint:s.fingerprint,revision:d.revision,fields:Object.freeze(found),values:next,dirtyKeys:[...d.dirtyKeys],delivery};
  }
  function authorReadFailureCode(error,job){
    const d=error?.whaleReadDiagnostic??job?.readDiagnostic;
    const stages=['bridge','snapshot','schema'];
    const reasons=['disposed','disconnected','unavailable','cancelled','transport','http','json','permission','context','timeout','metadata','limit','rejected'];
    if(d&&stages.includes(d.stage)&&reasons.includes(d.reason))return d.stage+'.'+d.reason+(Number.isInteger(d.status)&&d.status>=100&&d.status<=599?'.'+d.status:'');
    const codes={'response-invalid':'validation.shape','target-unavailable':'target.unverified','cancelled':'controller.cancelled','draft-pending':'record.pending'};
    return codes[error?.message]??'controller.unknown';
  }
  function run(kind,work){
    if(disposed||active||!context||!visible()||typeof request!=='function')return Promise.resolve({ok:false,error:'unavailable'});
    const job={context,wallpaperId,epoch,abort:new AbortController(),applyPending:false};active=job;if(kind==='read'){initialReadEpoch=epoch;cancelEdits();}phase=kind==='read'?'reading':'writing';message=null;publish();
    let timer,onAbort;
    const guard=new Promise((_,reject)=>{onAbort=()=>reject(Error('cancelled'));job.abort.signal.addEventListener('abort',onAbort,{once:true});timer=timers.setTimeout(()=>job.abort.abort(),kind==='write'?12000:4000);});
    const physical=Promise.resolve().then(()=>{check(job);return work(job);});
    const release=()=>{if(active===job){active=null;publish();}};physical.then(release,release);
    return Promise.race([physical,guard]).then(()=>{if(disposed||context!==job.context||epoch!==job.epoch)return {ok:false,error:'stale'};phase=recovery?'blocked':'ready';message=null;publish();return {ok:true};},error=>{
      if(!disposed&&context===job.context&&epoch===job.epoch){phase='blocked';const uncertain=job.applyPending&&error.uncertain!==false||error.uncertain===true;
        message=error.message==='schema-readonly-stale'?'参数结构已变化，请手动重新读取以更新本机记录':error.message==='schema-refresh-blocked'?'作者设置已变化，旧待处理记录已保留，暂不能自动刷新':error.message==='schema-changed'?'作者设置已变化，请重新读取':error.message==='draft-pending'?'另有待发送修改，暂不能即时应用':kind==='discard'?'清除结果未确认，请重新读取':kind==='read'?'未能读取设置，请重试':uncertain?'下发结果未确认，请观察后重新读取':'未能应用，请重新读取后再修改';
        if(kind==='read'&&message==='未能读取设置，请重试')message+=' ['+authorReadFailureCode(error,job)+']';
        cancelEdits();if(recovery)recovery=Object.freeze({...recovery,allowed:false});for(const key of desired.keys())marks[key]=uncertain?'unknown':'error';publish();}
      return {ok:false,error:'author-switches-failed'};
    }).finally(()=>{timers.clearTimeout(timer);job.abort.signal.removeEventListener('abort',onAbort);});
  }
  async function call(job,route,payload){check(job);const result=await request(route,payload,{signal:job.abort.signal});check(job);if(route==='schema')job.readDiagnostic=result?.__whaleReadDiagnostic??null;
    if(result?.ok===false&&['author_schema_changed','author_schema_stale','author_schema_refresh_unsafe'].includes(result.error))throw Object.assign(Error(result.error==='author_schema_refresh_unsafe'?'schema-refresh-blocked':'schema-changed'),{uncertain:result.sentMayHaveOccurred===true});return result;}
  const api={
    read:()=>snapshot,subscribe(fn){if(disposed)return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},
    // The optional default preserves existing Lucy-only callers; the production provider
    // always supplies the selected wallpaper ID explicitly. Identity changes invalidate old IO.
    setContext(key,id='lucy'){const valid=typeof id==='string'&&/^(?:lucy|we-[a-f0-9]{24})$/.test(id);const next=typeof key==='string'&&valid?key:null,nextId=next?id:null;
      if(disposed||next===context&&nextId===wallpaperId)return;cancel();cancelEdits();epoch++;context=next;wallpaperId=nextId;schema=null;revision=null;fields=Object.freeze([]);values={};marks={};desired.clear();recovery=null;owned=null;phase='idle';message=null;publish();},
    view(token,isVisible){if(disposed)return;if(views.get(token)===true&&isVisible!==true)invalidateStaleRecovery();views.set(token,isVisible===true);if(isVisible!==true)cancelEdits(token);if(!visible())cancel();publish();},
    remove(token){if(views.get(token)===true)invalidateStaleRecovery();views.delete(token);cancelEdits(token);if(!visible())cancel();publish();},
    ensureLoaded(){
      if(disposed||!context||!visible()||active||phase!=='idle'||schema!==null||recovery||edits.size||desired.size||initialReadEpoch===epoch||typeof request!=='function')return Promise.resolve({ok:false,error:'initial-read-skipped'});
      return api.load(initialReadMode);
    },
    load(mode){const initial=mode===initialReadMode;return run('read',async job=>{let reply=await call(job,'schema',{wallpaperId:job.wallpaperId});
      if(reply?.ok===true&&reply.draft?.stale===true){
        const d=reply.draft;
        if(d.values!==null||!Array.isArray(d.dirtyKeys)||d.dirtyKeys.length||d.delivery?.revision!==d.revision)throw Error('schema-refresh-blocked');
        // Validate the new schema/defaults before asking Host to replace a clean local record.
        const defaults=Object.fromEntries((reply.schema?.fields??[]).filter(field=>field.supported===true).map(field=>[field.key,field.defaultValue]));
        const candidate=accept({...reply,draft:{...d,stale:false,values:defaults}},{requireActive:false});
        const old=d.staleRecord,states=['none','not-sent','pending','confirmed','unknown','untracked'];
        if(old&&(typeof old.schemaFingerprint!=='string'||!/^([a-f0-9]{64})$/.test(old.schemaFingerprint)||old.schemaFingerprint===candidate.fingerprint||old.revision!==d.revision||!Array.isArray(old.keys)||old.keys.length>256||new Set(old.keys).size!==old.keys.length||old.keys.some(key=>typeof key!=='string'||!/^[A-Za-z0-9_]{1,64}$/.test(key)||['__proto__','constructor','prototype'].includes(key.toLowerCase()))||!Array.isArray(old.labels)||old.labels.length!==old.keys.length||old.labels.some(label=>typeof label!=='string'||!label.trim()||label.length>160||/[<>\x00-\x1f\x7f]/.test(label)||label.startsWith('ui_'))||old.delivery?.revision!==d.revision||old.delivery?.state!==d.delivery.state||!states.includes(old.delivery.state)))throw Error('schema-refresh-blocked');
        if(!['none','confirmed'].includes(d.delivery.state)||old?.keys.length){
          if(!old)throw Error('schema-refresh-blocked');
          recovery=Object.freeze({stale:true,fingerprint:candidate.fingerprint,previousFingerprint:old.schemaFingerprint,revision:candidate.revision,
            keys:Object.freeze([...old.keys]),labels:Object.freeze([...old.labels]),delivery:old.delivery.state,defaults:Object.freeze({...candidate.values}),own:false,
            unknown:old.delivery.state!=='not-sent',pending:old.delivery.state==='pending'||reply.application?.busy===true,
            allowed:reply.application?.busy===false&&reply.application?.targetActive===true&&old.delivery.state!=='pending'});
          cancelEdits();publish();return;
        }
        if(initial)throw Error('schema-readonly-stale');
        if(reply.application?.busy!==false||reply.application?.targetActive!==true)throw Error('schema-refresh-blocked');
        const refreshed=await call(job,'draft',{wallpaperId:job.wallpaperId,schemaFingerprint:candidate.fingerprint,expectedRevision:candidate.revision,action:'refresh-schema'});
        const confirmed=accept(refreshed,{fingerprint:candidate.fingerprint,expected:candidate.revision+1});
        if(refreshed.refreshed!==true||refreshed.mutation!=='refresh-schema'||refreshed.currentValuesKnown!==false||refreshed.application?.busy!==false||refreshed.draft?.delivery?.revision!==confirmed.revision||refreshed.draft?.delivery?.state!=='none'||Object.keys(candidate.values).length!==Object.keys(confirmed.values).length||Object.keys(candidate.values).some(key=>candidate.values[key]!==confirmed.values[key]))throw Error('schema-refresh-unconfirmed');
        reply=refreshed;
      }
      const next=accept(reply,{allowDirty:true,requireActive:false});
      if(!next.dirtyKeys.length&&reply.application?.targetActive!==true)throw Error('target-unavailable');
      const isOwn=owned&&owned.revision===next.revision&&owned.fingerprint===next.fingerprint&&Object.keys(owned.values).length===next.dirtyKeys.length&&next.dirtyKeys.every(key=>Object.hasOwn(owned.values,key)&&owned.values[key]===next.values[key]);
      recovery=next.dirtyKeys.length?Object.freeze({revision:next.revision,fingerprint:next.fingerprint,keys:Object.freeze(next.dirtyKeys),
        labels:Object.freeze(next.dirtyKeys.map(key=>{const label=reply.schema.fields.find(field=>field.key===key)?.label;return typeof label==='string'&&label.trim()&&label.length<=160&&!/[<>\x00-\x1f]/.test(label)&&!label.startsWith('ui_')?label:'其它参数';})),
        own:!!isOwn,unknown:next.delivery!=='not-sent',pending:next.delivery==='pending'||reply.application.busy===true,
        allowed:reply.application.busy===false&&next.delivery!=='pending'}):null;
      schema=next.fingerprint;revision=next.revision;fields=next.fields;values=next.values;marks={};desired.clear();cancelEdits();publish();});},
    discard({confirm=false,observed=false,expected=null,view=null}={}){
      if(confirm!==true||!snapshot.canDiscard||expected!==recovery||recovery.unknown&&observed!==true||recovery.stale&&views.get(view)!==true)return Promise.resolve({ok:false,error:'confirmation-required'});
      if(expected.stale)return run('discard',async job=>{
        const reply=await call(job,'draft',{wallpaperId:job.wallpaperId,schemaFingerprint:expected.fingerprint,expectedRevision:expected.revision,action:'discard-stale-schema',
          previousSchemaFingerprint:expected.previousFingerprint,discardKeys:[...expected.keys],expectedDelivery:{revision:expected.revision,state:expected.delivery},confirmDiscard:true,acknowledgeUnknown:expected.unknown&&observed===true});
        const next=accept(reply,{fingerprint:expected.fingerprint,expected:expected.revision+1,requireActive:false}),proof=reply.discardedRecord;
        if(reply.discarded!==true||reply.refreshed!==true||reply.mutation!=='discard-stale-schema'||reply.currentValuesKnown!==false||reply.application?.busy!==false||reply.draft?.delivery?.revision!==next.revision||reply.draft?.delivery?.state!=='none'||proof?.schemaFingerprint!==expected.previousFingerprint||proof.revision!==expected.revision||!Array.isArray(proof.keys)||proof.keys.length!==expected.keys.length||new Set(proof.keys).size!==proof.keys.length||proof.keys.some(key=>!expected.keys.includes(key))||proof.delivery?.revision!==expected.revision||proof.delivery?.state!==expected.delivery||Object.keys(next.values).length!==Object.keys(expected.defaults).length||Object.keys(expected.defaults).some(key=>next.values[key]!==expected.defaults[key]))throw Error('discard-unconfirmed');
        schema=next.fingerprint;revision=next.revision;fields=next.fields;values=next.values;marks={};desired.clear();recovery=null;owned=null;publish();
      });
      return run('discard',async job=>{const reply=await call(job,'draft',{wallpaperId:job.wallpaperId,schemaFingerprint:expected.fingerprint,expectedRevision:expected.revision,action:'discard',discardKeys:[...expected.keys],acknowledgeUnknown:expected.unknown&&observed===true});
        const next=accept(reply,{fingerprint:expected.fingerprint,expected:expected.revision+1,requireActive:false});
        if(reply.discarded!==true||reply.mutation!=='discard'||reply.currentValuesKnown!==false||Object.keys(values).some(key=>next.values[key]!==values[key]))throw Error('discard-unconfirmed');
        schema=next.fingerprint;revision=next.revision;fields=next.fields;values=next.values;marks={};desired.clear();recovery=null;owned=null;publish();});
    },
    editStart(key,owner,view,expected){if(!snapshot.canEdit||views.get(view)!==true||edits.has(key)||!fields.some(field=>field.key===key&&['slider','color','textinput'].includes(field.type)&&(expected===undefined&&field.type!=='textinput'||field===expected)))return null;
      const ticket=Object.freeze({key,owner,view,epoch,context,base:snapshot.values[key]});edits.set(key,{ticket,value:ticket.base});publish();return ticket;},
    editCurrent:ticket=>snapshot.canEdit&&!!currentEdit(ticket),
    editPreview(ticket,value){const field=fields.find(field=>field.key===ticket?.key);if(!currentEdit(ticket)||!snapshot.canEdit||!field||!valid(field,value))return false;
      edits.get(ticket.key).value=value;publish();return true;},
    editCancel(ticket){if(!currentEdit(ticket))return false;edits.delete(ticket.key);publish();return true;},
    editEnd(ticket){if(!currentEdit(ticket))return Promise.resolve({ok:false,error:'stale'});const value=edits.get(ticket.key).value;edits.delete(ticket.key);publish();
      return value===ticket.base?Promise.resolve({ok:true,unchanged:true}):api.change(ticket.key,value);},
    select(key,index,expected,view){const field=fields.find(item=>item.key===key);
      if(!snapshot.canEdit||views.get(view)!==true||field!==expected||field?.type!=='combo'||typeof index!=='string'||!/^(?:0|[1-9]\d?)$/.test(index)||!field.options[Number(index)])return Promise.resolve({ok:false,error:'unavailable'});
      const value=field.options[Number(index)].value;return Object.is(snapshot.values[key],value)?Promise.resolve({ok:true,unchanged:true}):api.change(key,value);
    },
    change(key,value){if(disposed||!snapshot.canEdit||edits.has(key)||!fields.some(field=>field.key===key&&valid(field,value)))return Promise.resolve({ok:false,error:'unavailable'});
      desired.set(key,value);marks[key]='busy';publish();if(active)return Promise.resolve({ok:true,queued:true});
      return run('write',async job=>{
        for(let round=0;desired.size;round++){
          if(round>=4)throw Error('burst-limit');check(job);
          const patch=Object.fromEntries(desired),keys=Object.keys(patch),fingerprint=schema;
          const saved=await call(job,'draft',{wallpaperId:job.wallpaperId,schemaFingerprint:fingerprint,expectedRevision:revision,values:patch});
          const next=accept(saved,{fingerprint,expected:revision+1,dirty:keys});
          if(keys.some(key=>next.values[key]!==patch[key]))throw Error('save-mismatch');revision=next.revision;owned={fingerprint,revision,values:{...patch}};
          job.applyPending=true;const applied=await call(job,'apply',{wallpaperId:job.wallpaperId,schemaFingerprint:fingerprint,expectedRevision:revision});
          if(applied?.ok!==true){const error=Error('apply-failed');error.uncertain=applied?.sentMayHaveOccurred===true;throw error;}
          const confirmed=accept(applied,{fingerprint,expected:revision,requireActive:false});
          if(applied.applySent!==true||applied.currentValuesKnown!==false||keys.some(key=>confirmed.values[key]!==patch[key]))throw Error('apply-unconfirmed');
          job.applyPending=false;values=confirmed.values;owned=null;
          for(const key of keys){if(desired.get(key)===patch[key]){desired.delete(key);marks[key]='sent';}}publish();
        }
      });
    },
    dispose(){if(disposed)return;cancel();cancelEdits();disposed=true;listeners.clear();views.clear();desired.clear();schema=null;fields=Object.freeze([]);values={};recovery=null;owned=null;publish();},
  };publish();return api;
}

// Local completion/IME state only; both editors reuse the same author transaction lane.
export function createNativeAuthorTextEditor(options) {return createNativeAuthorInputEditor(options);}
export function createNativeAuthorNumberEditor(options) {
  if(options.field?.type!=='slider')throw TypeError('Numeric editor requires a slider descriptor');
  return createNativeAuthorInputEditor({...options,numeric:true});
}
function createNativeAuthorInputEditor({author,field,view,isCurrent=()=>false,numeric=false}) {
  const owner=Symbol('author-text'),listeners=new Set();let ticket=null,compositionTicket=null,composing=false,fence=false,error=null,disposed=false,off=null,snapshot;
  let text=record();
  function format(value){return numeric?typeof value==='number'&&Number.isFinite(value)?String(value):'':typeof value==='string'?value:'';}
  function record(){return format(author.read().values[field.key]);}
  function preview(value){if(!numeric)return author.editPreview(ticket,value);
    if(value.length>64||!(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/).test(value))return false;
    const number=Number(value);return Number.isFinite(number)&&author.editPreview(ticket,number);}
  const invalid=numeric?'数值不符合范围或步长':'文字不符合参数限制';
  function current(){try{return !disposed&&isCurrent()===true;}catch{return false;}}
  function publish(){const next=Object.freeze({text,error,composing,editing:!!ticket});if(snapshot&&Object.keys(next).every(key=>snapshot[key]===next[key]))return;snapshot=next;if(!disposed)for(const fn of [...listeners])fn();}
  function cancel(message=null){const old=ticket;ticket=null;compositionTicket=null;composing=false;fence=false;error=null;if(old)author.editCancel(old);text=record();error=message;publish();}
  function sync(){if(disposed)return;if(ticket&&(!author.editCurrent(ticket)||!current())){cancel();return;}if(!ticket){const next=record();if(numeric&&next!==text)error=null;text=next;}publish();}
  function begin(){if(!current())return false;if(author.editCurrent(ticket))return true;if(ticket)cancel();
    ticket=author.editStart(field.key,owner,view,field);if(!ticket)return false;text=format(ticket.base);error=null;composing=false;fence=false;publish();return true;}
  function input(value){if(!author.editCurrent(ticket)||!current()||typeof value!=='string'){sync();return false;}text=value;
    if(!composing)error=preview(value)?null:invalid;publish();return true;}
  function complete(reason){if(!ticket)return Promise.resolve({ok:true,unchanged:true});
    if(!current()||!author.editCurrent(ticket)||composing||fence){cancel();return Promise.resolve({ok:false,error:'cancelled'});}
    if(!preview(text)){if(reason==='blur')cancel(numeric?'数值无效，未应用':'文字无效，未应用');else{error=invalid;publish();}return Promise.resolve({ok:false,error:'invalid'});}
    const old=ticket;ticket=null;compositionTicket=null;composing=false;fence=false;error=null;const result=author.editEnd(old);text=record();publish();return result;}
  const api={read:()=>snapshot,subscribe(fn){if(disposed)return()=>{};listeners.add(fn);if(!off)off=author.subscribe(sync);sync();return()=>{listeners.delete(fn);if(!listeners.size){off?.();off=null;}};},
    focus:begin,paste(){if(!composing)fence=false;return begin();},input,cancel,sync,complete,
    compositionStart(){if(!begin())return false;compositionTicket=ticket;composing=true;fence=false;error=null;publish();return true;},
    compositionEnd(value){if(!compositionTicket||compositionTicket!==ticket||!author.editCurrent(ticket)||!current())return false;compositionTicket=null;composing=false;return input(value);},
    keyDown({key,isComposing=false,keyCode=0}){if(composing||isComposing||keyCode===229){fence=true;return {prevent:false,stop:key==='Enter'};}
      if(key==='Enter'){if(!fence)void complete('enter');return {prevent:!fence,stop:true};}
      if(key==='Escape'){cancel();return {prevent:true,stop:true};}
      fence=false;if(key?.length===1||['Backspace','Delete'].includes(key))begin();return {prevent:false,stop:false};},
    keyUp({isComposing=false,keyCode=0}={}){if(composing||isComposing||keyCode!==229)fence=false;},
    dispose(){if(disposed)return;off?.();off=null;cancel();disposed=true;listeners.clear();}
  };publish();return api;
}

// Native sidebar over ONE existing controller. No autonomous playback, scans or window IO.
export function createNativeAppearanceSidebar({ctx, React, controller,playback=null,catalogOptions,loadPreview,previewOptions,author=null,editorGate=null}) {
  const id = 'dsh-whale-mist/appearance-sidebar';
  const kind = 'whale-appearance';
  const right = ctx.sidebarRight;
  if (!right?.openTab || !right.mounted?.subscribe || !right.mounted?.getSnapshot ||
      !ctx.sidebarRightTabs?.register || !ctx.slots?.inject || !ctx.slots?.register ||
      !controller?.getSettingsSnapshot || !controller?.subscribeSettings ||
      !controller.wallpaper?.getStatus || !controller.wallpaper?.subscribeStatus) {
    throw Error('native-sidebar-services-unavailable');
  }
  const listeners = new Set(), releases = [];
  const transport=playback??createNativePlaybackGate();
  const catalogRead=createNativeCatalogRead(controller,catalogOptions);
  const previews=createNativePreviewQueue(loadPreview,previewOptions);
  const ranges = Object.freeze({brightness:[20,120],mask:[0,90],blur:[0,24],surface:[40,100],chatBackdrop:[0,100]});
  const themeIds=Object.freeze({mist:'whale-mist',abyss:'whale-abyss'});
  const paletteOptions=Object.freeze([['ocean','深海'],['graphite','石墨'],['violet','暗紫'],['jade','墨绿']]);
  const validPalette=value=>paletteOptions.some(([key])=>key===value);
  const validAccentColor=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
  const fieldErrors = {brightness:null,mask:null,blur:null,surface:null,chatBackdrop:null,textContrast:null,theme:null,palette:null,accentMode:null,accentColor:null,sidebar:null,canvas:null,glass:null,opaqueSidebar:null,motion:null,background:null,weMode:null,weAutoStart:null};
  const validValue = (key,value) => Object.hasOwn(ranges,key) && Number.isInteger(value) && value>=ranges[key][0] && value<=ranges[key][1];
  let disposed = false, failure = null, snapshot,galleryOpen=false,query='',page=0,selectionError=null;
  let accentColorRetry=null;
  let sourceEnableKey=null,sourceEnableEpoch=0;
  let sourceJob=null,imageKey=null,imageEpoch=0,videoKey=null,videoEpoch=0;
  const presetFields=['brightness','mask','blur','surface'],presetViews=new Map();
  let presetKey=null,presetEpoch=0,presetConfirmation=null,presetError=null,presetCacheKey=null,presetCache=null;
  const four=value=>value&&presetFields.every(key=>validValue(key,value[key]))?Object.freeze(Object.fromEntries(presetFields.map(key=>[key,value[key]]))):null;
  const sameFour=(a,b)=>!!a&&!!b&&presetFields.every(key=>a[key]===b[key]);
  function presetSnapshot(settings,status,context) {
    let available=false,target=null,saved=null,current=null,safe=false,reason='当前暂不可用';
    try{
      const p=controller.presets;
      available=settings.background==='wallpaper'&&['getSnapshot','subscribe','resolveTarget','save','apply','remove'].every(key=>typeof p?.[key]==='function');
      if(available){
        const resolution=p.resolveTarget(),store=p.getSnapshot();current=four(settings);
        const shape=store?.version===1&&store.entries&&typeof store.entries==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(store.entries));
        const identity=sceneId(resolution?.targetId);
        const eligible=context.allowed&&resolution?.ok===true&&identity===context.selectedId&&
          (context.state==='playing'?resolution.isPlaying===true&&context.activeId===identity:resolution.isPlaying===false);
        if(eligible&&shape){target=identity;const exists=Object.hasOwn(store.entries,target);saved=exists?four(store.entries[target]):null;
          safe=!!current&&(!exists||saved!==null);if(!safe)reason='预设数据暂不可用';}
        else if(resolution?.error==='mismatch')reason='请先停止播放或选回当前壁纸';
      }
    }catch{reason='预设暂时无法读取';}
    const nextKey=safe?JSON.stringify([context.key,target,current,saved]):null;
    if(nextKey!==presetKey){presetKey=nextKey;presetEpoch++;presetConfirmation=null;presetError=null;}
    const matching=sameFour(current,saved),cacheKey=JSON.stringify([available,target,context.title,current,saved,safe,matching,reason,presetEpoch,presetError]);
    if(presetCacheKey!==cacheKey||presetCache?.confirmation!==presetConfirmation){presetCacheKey=cacheKey;presetCache=Object.freeze({available,target,title:safe?context.title:null,current:safe?current:null,saved:safe?saved:null,safe,
      matching,canSave:safe&&!matching,canApply:safe&&!!saved&&!matching,canRemove:safe&&!!saved,ticket:safe?presetEpoch:null,reason:safe?null:reason,error:presetError,confirmation:presetConfirmation});}
    return presetCache;
  }
  let lastLibrary,lastFilter,lastSearch,lastPage,galleryVersion=0,galleryRows=Object.freeze([]),pageRows=Object.freeze([]),matches=0;
  const sceneId = value => typeof value === 'string' && /^(?:lucy|we-[a-f0-9]{24})$/.test(value) ? value : null;
  function activeTheme(){try{const id=ctx.theme?.getTheme?.()?.active?.id;return Object.keys(themeIds).find(key=>themeIds[key]===id)??null;}catch{return null;}}
  function canSetTheme(){try{return typeof ctx.theme?.getTheme==='function'&&typeof ctx.theme?.setTheme==='function';}catch{return false;}}
  function read() {
    let settings, status;
    try { settings = controller.getSettingsSnapshot(); status = controller.wallpaper.getStatus(); }
    catch { settings = {}; status = {state:'unknown'}; }
    settings ??= {}; status ??= {};
    if(accentColorRetry&&(accentColorRetry.actual!==settings.accentColor||accentColorRetry.mode!==settings.accentMode||
      accentColorRetry.theme!==settings.theme||accentColorRetry.active!==activeTheme()||accentColorRetry.session!==right.mounted.getSnapshot())){
      accentColorRetry=null;fieldErrors.accentColor=null;
    }
    const activeId = sceneId(status.activeSceneId) ?? sceneId(status.host?.activeSceneId);
    const hasActive=[status.activeSceneId,status.host?.activeSceneId].some(value=>value!=null);
    const selectedId=sceneId(settings.weScene);
    const gate=transport.read();
    const catalogState=catalogRead.read();
    let library=null,pendingCleanup=!!(status.cleanupPending||status.host?.cleanupPending||status.state==='stopping');
    try{library=controller.wallpaper.getLibrarySnapshot?.();}catch{}
    try{pendingCleanup ||=!!controller.wallpaper.hasPendingCleanup?.();}catch{pendingCleanup=true;}
    const ready=library?.ok!==false&&library?.loaded===true&&library?.state==='ready'&&library?.loading!==true;
    const ratings=typeof settings.weAgeRatings==='string'?settings.weAgeRatings.split(',').map(s=>s.trim()).filter(Boolean):['Everyone'];
    const allowed=ratings.every(s=>['Everyone','Questionable','Mature'].includes(s))?ratings:['Everyone'];
    const filter=allowed.join(',');
    if(lastLibrary!==library||lastFilter!==filter){lastLibrary=library;lastFilter=filter;galleryRows=nativeGalleryItems(library,allowed);galleryVersion++;lastSearch=null;}
    if(lastSearch!==query||lastPage!==page){const all=galleryRows.filter(row=>row.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));matches=all.length;
      page=Math.min(page,Math.max(0,Math.ceil(matches/12)-1));pageRows=Object.freeze(all.slice(page*12,page*12+12));lastSearch=query;lastPage=page;}
    const items=Array.isArray(library?.items)?library.items:[];
    const item=items.find(entry=>entry?.id===selectedId);
    const hostLucy=Array.isArray(status.host?.scenes)?status.host.scenes.find(entry=>entry?.id==='lucy'):null;
    const eligible=selectedId==='lucy'?allowed.includes('Everyone')&&item?.available!==false&&hostLucy?.available!==false:
      !!item&&allowed.includes(item.contentRating)&&item.available===true&&['scene','video','web'].includes(item.type);
    const labelFor=id=>{
      if(!id)return '身份未确认';
      if(id==='lucy')return 'Lucy';
      const entry=items.find(entry=>entry?.id===id);
      return entry&&allowed.includes(entry.contentRating)&&typeof entry.title==='string'&&entry.title.trim()?entry.title:'所选壁纸';
    };
    // Cached metadata only; respect the same age selection before exposing a title.
    let title = activeId === 'lucy' ? 'Lucy' : activeId ? '当前壁纸' : '无活动壁纸';
    try {
      const ratings = typeof settings.weAgeRatings === 'string' ? settings.weAgeRatings.split(',').map(s=>s.trim()) : [];
      const item = controller.wallpaper.getLibrarySnapshot?.()?.items?.find(v=>v.id === activeId);
      if (item && ratings.includes(item.contentRating) && typeof item.title === 'string' && item.title.trim()) title = item.title;
    } catch { /* Optional cached label does not affect playback or source identity. */ }
    const current = right.mounted.getSnapshot();
    const state = pendingCleanup ? 'stopping' : hasActive&&(!activeId||['idle','stopped'].includes(status.state))?'unknown':status.state;
    const labels = {idle:'未播放',stopped:'已停止',playing:'播放中',starting:'启动中',connecting:'连接中',waiting:'等待画面',stopping:'停止中',error:'播放异常','cleanup-failed':'待清理',retrying:'重试中'};
    const safeIdle=['idle','stopped','error'].includes(state)&&!hasActive&&!pendingCleanup;
    const needsStop=!safeIdle||gate.unknown;
    const canSwitch=needsStop&&!!activeId&&!!selectedId&&activeId!==selectedId&&
      [status.activeSceneId,status.host?.activeSceneId].every(id=>id==null||id===activeId)&&
      ['playing','connecting','waiting'].includes(state)&&!pendingCleanup&&!gate.unknown&&
      Number.isSafeInteger(status.generation)&&status.generation>=0&&typeof controller.wallpaper.restart==='function';
    const action=canSwitch?'switch':needsStop?'stop':'start';
    const mode=['daily','preview'].includes(settings.weMode)?settings.weMode:null;
    const session=typeof current==='string'&&current.length>0;
    const optionsEditable=session&&typeof controller.set==='function'&&!pendingCleanup&&!gate.busy&&!gate.draining&&!gate.unknown&&
      ['idle','stopped','error','playing','connecting','waiting','retrying'].includes(state);
    const autoStart=typeof settings.weAutoStart==='boolean'?settings.weAutoStart:null;
    const autoEligible=selectedId==='lucy'&&mode==='daily'&&settings.background==='wallpaper'&&ready&&eligible;
    const externalStarting=state==='starting'&&!gate.draining;
    const canStopActive=!sourceJob&&session&&!gate.busy&&!externalStarting&&gate.canStop&&typeof controller.wallpaper.stop==='function'&&!pendingCleanup;
    const canPlay=!sourceJob&&session&&!gate.busy&&!externalStarting&&(canSwitch?
      gate.canStart&&settings.background==='wallpaper'&&!!mode&&ready&&eligible&&author?.read?.()?.busy!==true:needsStop?canStopActive:
      gate.canStart&&settings.background==='wallpaper'&&!!mode&&!!selectedId&&ready&&eligible&&typeof controller.wallpaper.start==='function');
    const showEnableWallpaper=settings.background==='none'&&['idle','stopped'].includes(state)&&!needsStop&&!gate.busy&&!gate.draining;
    const sourceTheme=activeTheme(),canEnableWallpaper=!sourceJob&&showEnableWallpaper&&admitted()&&session&&typeof controller.enableBackgroundSource==='function'&&
      gate.canStart&&!gate.unknown&&!hasActive&&!pendingCleanup&&Number.isSafeInteger(status.generation)&&status.generation>=0&&
      ['mist','abyss'].includes(settings.theme)&&sourceTheme===settings.theme;
    let closeState=null;try{closeState=controller.readBackgroundCloseState?.();}catch{}
    const fenceState=closeState?.fence?.state??'unprepared';
    let sourceReleased=false;try{sourceReleased=controller.wallpaper.canEnableBackgroundSource?.()===true;}catch{}
    // A completed source save invalidates the observation's context, not its private
    // released admission. A later Close starts a new fence rather than inspecting it forever.
    const closeAction=fenceState==='unconfirmed'?'retry':['unprepared','released'].includes(fenceState)||sourceReleased?'prepare':'inspect';
    const inspectOnly=closeAction==='inspect'&&!!closeState;
    const canCloseWallpaper=!sourceJob&&settings.background==='wallpaper'&&admitted()&&session&&!gate.busy&&!gate.draining&&!gate.unknown&&
      (inspectOnly||!pendingCleanup&&!externalStarting&&(['idle','stopped','playing','waiting','connecting'].includes(state)||state==='cleanup-failed'&&fenceState==='unconfirmed'))&&
      Number.isSafeInteger(status.generation)&&status.generation>=0&&['mist','abyss'].includes(settings.theme)&&sourceTheme===settings.theme&&
      !!closeState&&(inspectOnly||!closeState.uncertain)&&['prepareBackgroundClose','inspectBackgroundClose','retryBackgroundClose','commitBackgroundClose'].every(key=>typeof controller[key]==='function');
    const nextSourceKey=canEnableWallpaper||canCloseWallpaper?JSON.stringify([current,state,status.generation,settings,sourceTheme,fenceState]):null;
    if(nextSourceKey!==sourceEnableKey){sourceEnableKey=nextSourceKey;sourceEnableEpoch++;}
    let imageInfo=null;try{imageInfo=controller.media?.getSnapshot?.()?.media?.image??null;}catch{}
    const showLocalImage=typeof controller.editBackgroundImage==='function'&&['none','image'].includes(settings.background);
    const canEditImage=showLocalImage&&!sourceJob&&admitted()&&session&&!pendingCleanup&&!gate.busy&&!gate.draining&&!gate.unknown&&
      ['idle','stopped'].includes(state)&&!hasActive&&Number.isSafeInteger(status.generation)&&status.generation>=0&&
      ['mist','abyss'].includes(settings.theme)&&sourceTheme===settings.theme;
    const nextImageKey=canEditImage?JSON.stringify([current,state,status.generation,settings,sourceTheme,imageInfo]):null;
    if(nextImageKey!==imageKey){imageKey=nextImageKey;imageEpoch++;}
    let videoInfo=null;try{videoInfo=controller.media?.getSnapshot?.()?.media?.video??null;}catch{}
    const showLocalVideo=typeof controller.editBackgroundVideo==='function'&&['none','video'].includes(settings.background);
    const canEditVideo=showLocalVideo&&!sourceJob&&admitted()&&session&&!pendingCleanup&&!gate.busy&&!gate.draining&&!gate.unknown&&
      ['idle','stopped'].includes(state)&&!hasActive&&Number.isSafeInteger(status.generation)&&status.generation>=0&&
      ['mist','abyss'].includes(settings.theme)&&sourceTheme===settings.theme;
    const nextVideoKey=canEditVideo?JSON.stringify([current,state,status.generation,settings,sourceTheme,videoInfo]):null;
    if(nextVideoKey!==videoKey){videoKey=nextVideoKey;videoEpoch++;}
    const playLabel=gate.busy?(gate.action==='start'?'正在启动…':'正在停止…'):externalStarting?'正在启动…':pendingCleanup?'正在清理…':
      gate.draining&&!gate.unknown?'等待本轮结束':gate.unknown?(gate.action==='stop'?(gate.canStop?'重试清理':'停止结果待确认'):'停止并确认'):
      canSwitch?'播放所选壁纸':needsStop?(state==='cleanup-failed'?'重试清理':'停止播放'):'开始播放';
    const playHint=gate.unknown?'操作结果未确认':state==='cleanup-failed'?'上次清理未完成':
      (safeIdle?gate.error:null)??(!showEnableWallpaper&&!needsStop&&!canPlay?(settings.background!=='wallpaper'?'请先选择壁纸背景':!selectedId?'请先选择壁纸':!mode?'播放模式未确认':!ready?'请先在壁纸目录确认所选项':!eligible?'所选壁纸当前不可播放':null):null);
    const presetAllowed=admitted()&&session&&typeof controller.set==='function'&&settings.background==='wallpaper'&&ready&&eligible&&
      !pendingCleanup&&!gate.busy&&!gate.draining&&!gate.unknown&&Number.isSafeInteger(status.generation)&&status.generation>=0&&
      ['mist','abyss'].includes(settings.theme)&&sourceTheme===settings.theme&&
      (['idle','stopped'].includes(state)?!hasActive:state==='playing'&&activeId===selectedId&&[status.activeSceneId,status.host?.activeSceneId].every(id=>id==null||id===selectedId));
    const preset=presetSnapshot(settings,status,{allowed:presetAllowed,selectedId,activeId,state,title:labelFor(selectedId),
      key:presetAllowed?JSON.stringify([current,state,status.generation,filter,Object.entries(settings).sort(([a],[b])=>a.localeCompare(b))]):null});
    // Resolve from all approved metadata, never from the searched/paginated gallery.
    // An uncertain active identity must not borrow the selected wallpaper's picture.
    const activeIdentities=[status.activeSceneId,status.host?.activeSceneId].filter(id=>id!=null);
    const previewId=hasActive?(activeId&&activeIdentities.every(id=>sceneId(id)===activeId)?activeId:null):safeIdle&&!gate.unknown?selectedId:null;
    const objectPreview=['none','wallpaper'].includes(settings.background)&&ready&&previewId?
      galleryRows.find(row=>row.id===previewId&&row.selectable&&row.hasPreview)??null:null;
    return Object.freeze({objectPreview,activeId,title,selectedId,state:labels[state] ? state : 'unknown',selectedTitle:selectedId?labelFor(selectedId):'尚未选择壁纸',
      preset,
      playAction:action,playMode:mode,playGeneration:Number.isSafeInteger(status.generation)?status.generation:null,playLabel,canPlay,canStopActive,playBusy:gate.busy||pendingCleanup||externalStarting,playHint,
      showEnableWallpaper,canEnableWallpaper,enableWallpaperTicket:canEnableWallpaper?sourceEnableEpoch:null,backgroundEnableError:fieldErrors.background,
      showCloseWallpaper:settings.background==='wallpaper'&&!!closeState,canCloseWallpaper,closeWallpaperTicket:canCloseWallpaper?sourceEnableEpoch:null,
      closeWallpaperAction:closeAction,sourceBusy:!!sourceJob,closeWallpaperLabel:sourceJob?.kind==='close'?'正在关闭…':closeAction==='retry'?'重试关闭':closeAction==='inspect'?'检查关闭':'关闭背景',
      showLocalImage,canEditImage,imageInfo,imageTicket:canEditImage?imageEpoch:null,imageBusy:sourceJob?.kind==='image',imageError:fieldErrors.image??null,
      showLocalVideo,canEditVideo,videoInfo,videoTicket:canEditVideo?videoEpoch:null,videoBusy:sourceJob?.kind==='video',videoError:fieldErrors.video??null,
      catalogLoading:catalogState.loading||library?.loading===true||library?.state==='loading',catalogError:!ready?(catalogState.error??(library?.state==='failed'?'壁纸目录读取失败':null)):null,
      galleryOpen,galleryQuery:query,galleryPage:page,galleryCount:matches,galleryPages:Math.max(1,Math.ceil(matches/12)),galleryRows:pageRows,galleryRatings:filter,galleryVersion,selectionError,
      autoStart,autoEligible,canSetMode:optionsEditable,canSetAutoStart:optionsEditable&&autoStart!==null&&(autoStart||autoEligible),
      modeError:fieldErrors.weMode,autoStartError:fieldErrors.weAutoStart,
      authorContext:author&&(!editorGate||editorGate.getSnapshot().nativeAllowed)&&session&&settings.background==='wallpaper'&&!!selectedId&&activeId===selectedId&&
        (selectedId==='lucy'||['scene','web'].includes(item?.type))&&[status.activeSceneId,status.host?.activeSceneId].every(id=>id==null||id===selectedId)&&ready&&eligible&&
        Number.isSafeInteger(status.generation)&&status.generation>=0&&!gate.busy&&!gate.draining&&!gate.unknown&&!pendingCleanup&&['playing','connecting','waiting'].includes(state)?JSON.stringify([current,selectedId,activeId,status.generation,filter]):null,
      statusLabel:labels[state] ?? '状态未知',brightness:validValue('brightness',settings.brightness) ? settings.brightness : null,
      mask:validValue('mask',settings.mask) ? settings.mask : null,
      blur:validValue('blur',settings.blur) ? settings.blur : null,
      surface:validValue('surface',settings.surface) ? settings.surface : null,
      chatBackdrop:validValue('chatBackdrop',settings.chatBackdrop) ? settings.chatBackdrop : null,
      textContrast:['standard','enhanced'].includes(settings.textContrast)?settings.textContrast:null,textContrastError:fieldErrors.textContrast,
      theme:['mist','abyss'].includes(settings.theme)?settings.theme:null,activeTheme:activeTheme(),canSetTheme:canSetTheme(),themeError:fieldErrors.theme,
      palette:validPalette(settings.palette)?settings.palette:null,paletteError:fieldErrors.palette,
      accentMode:['theme','custom'].includes(settings.accentMode)?settings.accentMode:null,
      accentColor:validAccentColor(settings.accentColor)?settings.accentColor.toLowerCase():null,
      accentModeError:fieldErrors.accentMode,accentColorError:fieldErrors.accentColor,
      canRetryAccentColor:accentColorRetry!==null,
      sidebar:['balanced','deep'].includes(settings.sidebar)?settings.sidebar:null,sidebarError:fieldErrors.sidebar,
      canvas:['soft','clear'].includes(settings.canvas)?settings.canvas:null,canvasError:fieldErrors.canvas,
      glass:['standard','restrained'].includes(settings.glass)?settings.glass:null,glassError:fieldErrors.glass,
      videoMotion:['focus','always'].includes(settings.motion)?settings.motion:null,motionError:fieldErrors.motion,
      canSetVideoMotion:settings.background==='video'&&canEditVideo&&typeof controller.set==='function'&&['focus','always'].includes(settings.motion),
      backgroundMode:['none','image','video','wallpaper'].includes(settings.background)?settings.background:null,
      opaqueSidebar:typeof settings.opaqueSidebar==='boolean'?settings.opaqueSidebar:null,opaqueSidebarError:fieldErrors.opaqueSidebar,
      brightnessError:fieldErrors.brightness,maskError:fieldErrors.mask,blurError:fieldErrors.blur,surfaceError:fieldErrors.surface,chatBackdropError:fieldErrors.chatBackdrop,canEdit:typeof controller.set==='function',
      canOpen:session,error:failure});
  }
  function refresh() {
    if (disposed) return;
    if(sourceJob&&!sourceJob.current())sourceJob.abort.abort();
    const next = read();
    author?.setContext(next.authorContext,next.selectedId);
    if (snapshot && Object.keys(next).every(key=>Object.is(next[key],snapshot[key]))) return;
    snapshot = next;
    for (const fn of [...listeners]) fn();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    sourceJob?.abort.abort();
    author?.setContext(null);
    for(const view of [...presetViews.values()])view.remove?.();
    catalogRead.dispose();
    previews.dispose();
    presetViews.clear();presetConfirmation=null;
    const errors=[];
    for (const off of releases.splice(0).reverse()) { try { off(); } catch(error) { errors.push(error); } }
    listeners.clear();
    if(!playback)transport.dispose();
    if(errors.length) throw new AggregateError(errors,'native-sidebar-dispose-failed');
  }
  const api = {
    getSnapshot: () => snapshot,
    subscribe(fn) { if(disposed) return ()=>{}; listeners.add(fn); return ()=>listeners.delete(fn); },
    registerView(token,signal){if(disposed)return()=>{};const off=catalogRead.registerView(token,signal),view={visible:false,lease:null};presetViews.set(token,view);let removed=false;
      const remove=()=>{if(removed)return;removed=true;signal?.removeEventListener('abort',remove);off();presetViews.delete(token);sourceEnableKey=null;sourceEnableEpoch++;imageKey=null;imageEpoch++;videoKey=null;videoEpoch++;if(presetConfirmation?.owner===token)presetConfirmation=null;refresh();};
      view.remove=remove;signal?.addEventListener('abort',remove,{once:true});if(signal?.aborted)remove();return remove;},
    viewVisible(token,visible){if(disposed)return;catalogRead.visible(token,visible);const view=presetViews.get(token);if(view){if(view.visible!==(visible===true)){sourceEnableKey=null;sourceEnableEpoch++;imageKey=null;imageEpoch++;videoKey=null;videoEpoch++;}view.visible=visible===true;if(!view.visible){view.lease=null;if(presetConfirmation?.owner===token)presetConfirmation=null;}refresh();}},
    setPresetOpen(token,open){const view=presetViews.get(token);if(disposed||!view)return null;if(open===true&&view.visible&&admitted()){view.lease??=Object.freeze({});return view.lease;}
      view.lease=null;if(presetConfirmation?.owner===token)presetConfirmation=null;refresh();return null;},
    presetAction(op,ticket,token,lease){return actPreset(op,ticket,token,lease,null);},
    confirmPreset(expected,token,lease){if(!expected||expected!==presetConfirmation)return {ok:false,error:'preset-confirmation-stale'};return actPreset(expected.op,expected.ticket,token,lease,expected);},
    cancelPreset(token,lease){if(presetViews.get(token)?.lease===lease&&presetConfirmation?.owner===token){presetConfirmation=null;refresh();}},
    retryCatalog(){if(!disposed&&admitted())catalogRead.ensure();},
    showGallery(open){if(disposed||!admitted())return;galleryOpen=open===true;selectionError=null;if(galleryOpen)catalogRead.ensure();refresh();},
    search(value){if(disposed||!admitted()||typeof value!=='string')return;query=value.slice(0,200);page=0;refresh();},
    changePage(delta){if(disposed||!admitted()||![1,-1].includes(delta))return;page=Math.max(0,page+delta);refresh();},
    setRating(rating,checked){if(disposed||!admitted()||!['Everyone','Questionable','Mature'].includes(rating)||typeof checked!=='boolean')return;
      refresh();const next=new Set(snapshot.galleryRatings.split(',').filter(Boolean));if(checked)next.add(rating);else next.delete(rating);
      try{const value=['Everyone','Questionable','Mature'].filter(value=>next.has(value)).join(',');controller.set('weAgeRatings',value);if(controller.getSettingsSnapshot()?.weAgeRatings!==value)throw Error('rejected');page=0;selectionError=null;}catch{selectionError='暂时无法更改筛选';}refresh();},
    selectWallpaper(id){if(disposed)return {ok:false,error:'disposed'};refresh();
      if(!admitted())return {ok:false,error:'editor-suspended'};
      const row=galleryRows.find(row=>row.id===id);if(!snapshot.canOpen||!galleryOpen||!row?.selectable||typeof controller.set!=='function')return {ok:false,error:'selection-unavailable'};
      try{controller.set('weScene',id);if(controller.getSettingsSnapshot()?.weScene!==id)throw Error('rejected');selectionError=null;refresh();return {ok:true};}
      catch{selectionError='暂时无法选择这张壁纸';refresh();return {ok:false,error:'selection-failed'};}
    },
    enableWallpaper(expectedTicket,token) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      refresh();
      if(!snapshot.canEnableWallpaper)return {ok:false,error:'background-enable-unavailable'};
      if(!Number.isSafeInteger(expectedTicket)||expectedTicket!==snapshot.enableWallpaperTicket)return {ok:false,error:'background-enable-stale'};
      return sourceAction('enable',token,options=>controller.enableBackgroundSource(options));
    },
    closeWallpaper(expectedTicket,token) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      refresh();
      if(!snapshot.canCloseWallpaper)return {ok:false,error:'background-close-unavailable'};
      if(expectedTicket!==snapshot.closeWallpaperTicket)return {ok:false,error:'background-close-stale'};
      const action=snapshot.closeWallpaperAction;
      return sourceAction('close',token,async options=>{
        const end=performance.now()+options.timeoutMs;
        let result=await controller[action==='prepare'?'prepareBackgroundClose':action==='retry'?'retryBackgroundClose':'inspectBackgroundClose'](options);
        if(!options.isCurrent())return {ok:false,error:'background-close-stale'};
        // One preparation and at most one inspection. Pending never becomes a polling loop.
        if(result.ok&&!result.permit&&action!=='inspect'&&result.snapshot?.state==='pending'&&performance.now()<end)result=await controller.inspectBackgroundClose({...options,timeoutMs:end-performance.now()});
        if(result.ok&&result.permit&&options.isCurrent())return controller.commitBackgroundClose(result.permit);
        return {...result,ok:false,error:result.error??'background-close-pending'};
      });
    },
    imageAction(action,file,ticket,token){return mediaAction('image',action,file,ticket,token);},
    videoAction(action,file,ticket,token){return mediaAction('video',action,file,ticket,token);},
    setPlaybackOption(key,value){
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!(key==='weMode'&&['daily','preview'].includes(value)||key==='weAutoStart'&&typeof value==='boolean'))return {ok:false,error:'invalid-playback-option'};
      refresh();
      if(!(key==='weMode'?snapshot.canSetMode:snapshot.canSetAutoStart)||key==='weAutoStart'&&value&&!snapshot.autoEligible)return {ok:false,error:'playback-option-unavailable'};
      fieldErrors[key]=null;
      try{
        const old=key==='weMode'?snapshot.playMode:snapshot.autoStart;
        if(old!==value)controller.set(key,value);
        if(controller.getSettingsSnapshot()?.[key]!==value)throw Error('rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors[key]='暂时无法更改，请重试';refresh();return {ok:false,error:'playback-option-failed'};}
    },
    play(action,expectedScene=snapshot.selectedId,expectedMode=snapshot.playMode,expectedActive=snapshot.activeId,expectedGeneration=snapshot.playGeneration) {
      if(disposed)return Promise.resolve({ok:false,error:'disposed'});
      if(!admitted())return Promise.resolve({ok:false,error:'editor-suspended'});
      refresh();
      // Use the rendered action as well as a fresh policy: a stale Start click must never become Stop.
      if(action!==snapshot.playAction||!snapshot.canPlay)return Promise.resolve({ok:false,error:'playback-unavailable'});
      if((action==='start'||action==='switch')&&(expectedScene!==snapshot.selectedId||expectedMode!==snapshot.playMode))return Promise.resolve({ok:false,error:'target-drift'});
      if((action==='stop'||action==='switch')&&(expectedActive!==snapshot.activeId||expectedGeneration!==snapshot.playGeneration))return Promise.resolve({ok:false,error:'target-drift'});
      const target=snapshot.selectedId,mode=snapshot.playMode;
      return transport.run(action==='switch'?'start':action,()=>action==='switch'?controller.wallpaper.restart(target,mode):action==='start'?controller.wallpaper.start(target,mode):controller.wallpaper.stop('user'));
    },
    stopActive(expectedActive,expectedGeneration){
      if(disposed)return Promise.resolve({ok:false,error:'disposed'});
      if(!admitted())return Promise.resolve({ok:false,error:'editor-suspended'});
      refresh();
      if(!snapshot.canStopActive||snapshot.playAction!=='switch')return Promise.resolve({ok:false,error:'playback-unavailable'});
      if(expectedActive!==snapshot.activeId||expectedGeneration!==snapshot.playGeneration)return Promise.resolve({ok:false,error:'target-drift'});
      return transport.run('stop',()=>controller.wallpaper.stop('user'));
    },
    setTheme(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['mist','abyss'].includes(value))return {ok:false,error:'invalid-theme'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||!snapshot.canSetTheme||snapshot.theme===null)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.theme=null;
      try{
        if(snapshot.theme!==value)controller.set('theme',value);
        else if(snapshot.activeTheme!==value)ctx.theme.setTheme(themeIds[value]);
        if(controller.getSettingsSnapshot()?.theme!==value||activeTheme()!==value)throw Error('theme-update-unconfirmed');
        refresh();return {ok:true,value};
      }catch{fieldErrors.theme='暂时无法切换主题，请重试';refresh();return {ok:false,error:'theme-update-failed'};}
    },
    setPalette(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!validPalette(value))return {ok:false,error:'invalid-palette'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.palette===null||snapshot.theme!=='abyss'||snapshot.activeTheme!=='abyss')return {ok:false,error:'appearance-unavailable'};
      fieldErrors.palette=null;
      try{
        if(snapshot.palette!==value)controller.set('palette',value);
        if(controller.getSettingsSnapshot()?.palette!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.palette='暂时无法更改配色，请重试';refresh();return {ok:false,error:'palette-update-failed'};}
    },
    setAccent(key,value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!(key==='accentMode'&&['theme','custom'].includes(value)||key==='accentColor'&&validAccentColor(value)))return {ok:false,error:'invalid-accent-value'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.accentMode===null||snapshot.accentColor===null||snapshot.theme===null||snapshot.activeTheme!==snapshot.theme||
        key==='accentColor'&&snapshot.accentMode!=='custom')return {ok:false,error:'appearance-unavailable'};
      const normalized=key==='accentColor'?value.toLowerCase():value;
      fieldErrors[key]=null;
      if(key==='accentColor')accentColorRetry=null;
      try{
        if(snapshot[key]!==normalized)controller.set(key,normalized);
        if(controller.getSettingsSnapshot()?.[key]!==normalized)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value:normalized};
      }catch{
        fieldErrors[key]='暂时无法更改强调色，请重试';
        if(key==='accentColor'){
          try{const actual=controller.getSettingsSnapshot();accentColorRetry={value:normalized,actual:actual?.accentColor,mode:actual?.accentMode,theme:actual?.theme,active:activeTheme(),session:right.mounted.getSnapshot()};}catch{accentColorRetry=null;}
        }
        refresh();return {ok:false,error:'accent-update-failed'};
      }
    },
    retryAccentColor(){
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      refresh();
      if(!accentColorRetry)return {ok:false,error:'retry-unavailable'};
      return api.setAccent('accentColor',accentColorRetry.value);
    },
    setSidebarDepth(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['balanced','deep'].includes(value))return {ok:false,error:'invalid-sidebar-depth'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.sidebar===null||snapshot.theme===null||snapshot.activeTheme!==snapshot.theme)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.sidebar=null;
      try{
        if(snapshot.sidebar!==value)controller.set('sidebar',value);
        if(controller.getSettingsSnapshot()?.sidebar!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.sidebar='暂时无法更改侧栏层次，请重试';refresh();return {ok:false,error:'sidebar-depth-update-failed'};}
    },
    setCanvasDepth(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['soft','clear'].includes(value))return {ok:false,error:'invalid-canvas-depth'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.canvas===null||snapshot.theme===null||snapshot.activeTheme!==snapshot.theme)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.canvas=null;
      try{
        if(snapshot.canvas!==value)controller.set('canvas',value);
        if(controller.getSettingsSnapshot()?.canvas!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.canvas='暂时无法更改背景层次，请重试';refresh();return {ok:false,error:'canvas-depth-update-failed'};}
    },
    setVideoMotion(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['focus','always'].includes(value))return {ok:false,error:'invalid-video-motion'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canSetVideoMotion)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.motion=null;
      try{
        if(snapshot.videoMotion!==value)controller.set('motion',value);
        const actual=controller.getSettingsSnapshot();
        if(actual?.motion!==value||actual.background!=='video')throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.motion='暂时无法更改播放策略，请重试';refresh();return {ok:false,error:'video-motion-update-failed'};}
    },
    setGlassStrength(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['standard','restrained'].includes(value))return {ok:false,error:'invalid-glass-strength'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.glass===null||snapshot.theme===null||snapshot.activeTheme!==snapshot.theme)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.glass=null;
      try{
        if(snapshot.glass!==value)controller.set('glass',value);
        if(controller.getSettingsSnapshot()?.glass!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.glass='暂时无法更改玻璃强度，请重试';refresh();return {ok:false,error:'glass-strength-update-failed'};}
    },
    setOpaqueSidebar(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(typeof value!=='boolean')return {ok:false,error:'invalid-opaque-sidebar'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.opaqueSidebar===null||snapshot.backgroundMode===null||snapshot.backgroundMode==='none'||
        snapshot.theme===null||snapshot.activeTheme!==snapshot.theme)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.opaqueSidebar=null;
      try{
        if(snapshot.opaqueSidebar!==value)controller.set('opaqueSidebar',value);
        if(controller.getSettingsSnapshot()?.opaqueSidebar!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.opaqueSidebar='暂时无法更改左侧栏底色，请重试';refresh();return {ok:false,error:'opaque-sidebar-update-failed'};}
    },
    setTextContrast(value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!['standard','enhanced'].includes(value))return {ok:false,error:'invalid-text-contrast'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit||snapshot.textContrast===null)return {ok:false,error:'appearance-unavailable'};
      fieldErrors.textContrast=null;
      try{
        if(snapshot.textContrast!==value)controller.set('textContrast',value);
        if(controller.getSettingsSnapshot()?.textContrast!==value)throw Error('appearance-update-rejected');
        refresh();return {ok:true,value};
      }catch{fieldErrors.textContrast='暂时无法调整，请重试';refresh();return {ok:false,error:'appearance-update-failed'};}
    },
    setAppearance(key,value) {
      if(disposed)return {ok:false,error:'disposed'};
      if(!admitted())return {ok:false,error:'editor-suspended'};
      if(!validValue(key,value))return {ok:false,error:'invalid-appearance-value'};
      refresh();
      if(!snapshot.canOpen)return {ok:false,error:'no-session'};
      if(!snapshot.canEdit || snapshot[key]===null)return {ok:false,error:'appearance-unavailable'};
      fieldErrors[key]=null;
      try {
        // The existing set() is synchronous: projects CSS/backdrop, persists locally, notifies all views.
        // Read the authoritative snapshot even after an exception; never invent a rollback or saved claim.
        if(snapshot[key]!==value)controller.set(key,value);
        if(controller.getSettingsSnapshot()?.[key]!==value)throw Error('appearance-update-rejected');
        refresh();
        return {ok:true,value};
      } catch {
        fieldErrors[key]='暂时无法调整，请重试';refresh();
        return {ok:false,error:'appearance-update-failed'};
      }
    },
    open() {
      if(disposed) return {ok:false,error:'disposed'};
      if(editorGate){const result=editorGate.prepareNative();if(!result.ok)return result;}
      refresh();
      if(!snapshot.canOpen) {failure='请先打开一个会话';refresh();return {ok:false,error:'no-session'};}
      try { right.openTab(kind); failure=null;catalogRead.ensure();refresh(); return {ok:true}; }
      catch {failure='暂时无法打开外观侧栏';refresh();return {ok:false,error:'open-failed'};}
    },
    dispose,
  };
  function actPreset(op,ticket,token,lease,confirmed) {
    if(disposed)return {ok:false,error:'disposed'};
    if(!admitted())return {ok:false,error:'editor-suspended'};
    refresh();const p=snapshot.preset,view=presetViews.get(token);
    if(!['save','apply','remove'].includes(op)||!view?.visible||!lease||view.lease!==lease||!p?.safe)return {ok:false,error:'preset-unavailable'};
    if(ticket!==p.ticket||!Number.isSafeInteger(ticket))return {ok:false,error:'preset-stale'};
    if(!(op==='save'?p.canSave:op==='apply'?p.canApply:p.canRemove))return {ok:false,error:'preset-unavailable'};
    if(op==='remove'||op==='save'&&p.saved){
      if(!confirmed){presetConfirmation=Object.freeze({op,ticket,owner:token,lease});presetError=null;refresh();return {ok:false,confirm:true};}
      if(confirmed!==presetConfirmation||confirmed.owner!==token||confirmed.lease!==lease)return {ok:false,error:'preset-confirmation-stale'};
    }
    const target=p.target,expected=op==='apply'?p.saved:p.current;
    presetKey=null;presetEpoch++;presetConfirmation=null;presetError=null;
    try{
      const before=controller.getSettingsSnapshot();
      const result=controller.presets[op](target);refresh();
      if(result?.ok!==true){presetError=result?.error==='storage-failed'?'本机存储未能更新':'预设操作未确认，请核对当前状态';refresh();return {ok:false,error:'preset-operation-failed'};}
      const actual=controller.presets.getSnapshot(),actualSettings=controller.getSettingsSnapshot();
      if(result.targetId!==target||snapshot.preset.target!==target||!snapshot.preset.safe||
        (op==='remove'?Object.hasOwn(actual.entries,target):op==='save'?!sameFour(four(actual.entries[target]),expected):!sameFour(four(actualSettings),expected))||
        Object.keys(before).some(key=>!(op==='apply'&&presetFields.includes(key))&&!Object.is(before[key],actualSettings[key])))throw Error('preset-result-unconfirmed');
      return {ok:true,operation:op};
    }catch{refresh();presetError='预设操作未确认，请核对当前状态';refresh();return {ok:false,error:'preset-operation-unknown'};}
  }
  function admitted(){return !editorGate||editorGate.getSnapshot().nativeAllowed;}
  function mediaAction(kind,action,file,ticket,token){
    if(disposed)return {ok:false,error:'disposed'};
    if(!admitted())return {ok:false,error:'editor-suspended'};
    refresh();
    const type=kind==='image'?'Image':'Video';
    if(!snapshot['canEdit'+type]||!['replace','use','remove'].includes(action))return {ok:false,error:kind+'-unavailable'};
    if(ticket!==snapshot[kind+'Ticket'])return {ok:false,error:kind+'-stale'};
    if(action==='replace'&&!file)return {ok:false,error:kind+'-cancelled'};
    return sourceAction(kind,token,options=>controller['editBackground'+type](action,file,options));
  }
  function localMediaError(kind,result){
    const name=kind==='image'?'图片':'视频',error=result?.error;
    if(error===kind+'-remove-storage')return name+'未能移除，请重试';
    if(result?.applied)return '设置已保存，请核对当前状态';
    if(result?.mediaSaved)return name+'已保存，背景尚未启用';
    return ({[kind+'-file-invalid']:kind==='image'?'请选择64MB以内的常见格式图片':'请选择1GB以内的MP4或WebM视频',
      [kind+'-decode']:kind==='image'?'图片无法读取，请换一张':'视频无法读取，请换一个',[kind+'-missing']:'没有已保存的'+name,
      [kind+'-source-active']:'请先停止并关闭壁纸背景',[kind+'-storage']:name+'未能保存，请重试',
      [kind+'-busy']:kind==='image'?'另有图片操作尚未结束':'另有本地背景操作尚未结束'}[error]??name+'更新未确认，请重试');
  }
  function sourceAction(kind,token,work){
    const view=presetViews.get(token);
    if(!view?.visible)return {ok:false,error:'background-view-unavailable'};
    const session=right.mounted.getSnapshot(),theme=activeTheme(),abort=new AbortController();
    const current=()=>!disposed&&!abort.signal.aborted&&admitted()&&right.mounted.getSnapshot()===session&&activeTheme()===theme&&presetViews.get(token)===view&&view.visible;
    if(!current()||sourceJob)return {ok:false,error:'background-view-unavailable'};
    const job={kind,abort,current},field=['image','video'].includes(kind)?kind:'background';sourceJob=job;sourceEnableKey=null;sourceEnableEpoch++;imageKey=null;imageEpoch++;videoKey=null;videoEpoch++;fieldErrors[field]=null;refresh();
    // Source APIs have their own bounded IO; this lane neither retries nor releases early.
    return Promise.resolve().then(()=>current()?work({signal:abort.signal,isCurrent:current,timeoutMs:['image','video'].includes(kind)?6000:3500}):{ok:false,error:'background-view-unavailable'}).then(result=>{
      if(current()&&result?.ok!==true)fieldErrors[field]=['image','video'].includes(kind)?localMediaError(kind,result):
        result?.applied?(result.error==='background-projection-failed'?'设置已保存，显示更新未完成':'设置已保存，请核对当前状态'):
        result?.error==='background-close-pending'?'尚未关闭，请稍后检查':result?.error==='background-storage-conflict'?'设置已变化，请重新打开侧栏':'背景更新未确认，请核对当前状态';
      return result;
    },()=>{if(current())fieldErrors[field]=['image','video'].includes(kind)?localMediaError(kind,null):'背景更新未确认，请核对当前状态';return {ok:false,error:'background-update-failed',value:controller.getSettingsSnapshot()?.background};})
      .finally(()=>{if(sourceJob===job)sourceJob=null;refresh();});
  }
  const h = (type,props,...children)=>React.createElement(type,typeof type==='function'&&children.length?{...props,children}:props,...children);
  // The popover stays in Whale's DOM/theme scope but uses the browser top layer,
  // so the independently scrolling sidebar cannot clip it. One owner per adapter.
  let openChoice=null;
  function Select({presentation='menu',...props}) {
    return presentation==='segments'||presentation==='swatches'?h(Choice,{...props,swatches:presentation==='swatches'}):h(SelectMenu,props);
  }
  function Choice({children=[],onChange,value,disabled,swatches=false,...props}) {
    const root=React.useRef(null),name=React.useId();
    const choices=(Array.isArray(children)?children:[children]).flat(Infinity).filter(Boolean).map(node=>({value:String(node.props.value),label:node.props.children??node.children,disabled:node.props.disabled===true,hint:node.props.title}));
    const context=()=>{const v=api.getSnapshot(),owner=root.current?.closest?.('[data-whale-native-sidebar]');return JSON.stringify([right.mounted.getSnapshot(),v.theme,v.activeTheme,v.canEdit,owner?.dataset.whaleSettingsPage]);};
    const snapshot=api.getSnapshot(),stamp=JSON.stringify([right.mounted.getSnapshot(),snapshot.theme,snapshot.activeTheme,snapshot.canEdit,'interface']);
    const choose=(entry,event)=>{
      if(disabled||entry.disabled||!entry.value||!root.current?.isConnected||!root.current.checkVisibility()||context()!==stamp)return;
      if(!root.current.contains(event.currentTarget)||!event.currentTarget.checked)return;
      onChange?.({currentTarget:event.currentTarget,value:entry.value});
    };
    const swatchColors={ocean:['#0b111d','#8c72f2'],graphite:['#16161a','#7f9cc7'],violet:['#19121f','#b07cf0'],jade:['#0e1d18','#56c79d']};
    return h('div',{...props,ref:root,role:'radiogroup','aria-disabled':disabled===true,'data-whale-choice-segments':swatches?'swatches':'segments'},
      ...choices.filter(entry=>entry.value).map((entry,index)=>{
        const selected=String(value)===entry.value,colors=swatchColors[entry.value],hintId=entry.hint?name+'-hint-'+index:undefined;
        return h('label',{key:entry.value,'data-whale-choice-segment':entry.value,title:entry.hint||(Array.isArray(entry.label)?entry.label.join(''):String(entry.label??''))},
          h('input',{type:'radio',name,value:entry.value,checked:selected,disabled:disabled||entry.disabled,
            'aria-invalid':props['aria-invalid'],'aria-describedby':[props['aria-describedby'],hintId].filter(Boolean).join(' ')||undefined,
            onChange:event=>choose(entry,event),onClick:event=>{if(selected)choose(entry,event);}}),
          h('span',{'data-whale-segment-face':true},
            swatches&&colors?h('span',{'data-whale-palette-swatch':entry.value,'aria-hidden':true,style:{background:`linear-gradient(135deg, ${colors[0]} 0 65%, ${colors[1]} 65% 100%)`}}):null,
            h('span',{'data-whale-segment-text':true},entry.label),h('span',{'data-whale-segment-check':true,'aria-hidden':true},selected?'✓':'')),entry.hint?h('span',{id:hintId,hidden:true},entry.hint):null);
      }),
      !choices.some(entry=>entry.value&&entry.value===String(value))?h('span',{'data-whale-choice-unavailable':true},'暂不可用'):null);
  }
  function SelectMenu({children=[],onChange,value,disabled,choiceScope=null,...props}) {
    const trigger=React.useRef(null),popup=React.useRef(null),session=React.useRef(null),latest=React.useRef(null);
    const [open,setOpen]=React.useState(false),[cursor,setCursor]=React.useState(-1),uid=React.useId();
    const choices=(Array.isArray(children)?children:[children]).flat(Infinity).filter(Boolean).map(node=>({value:String(node.props.value),label:node.props.children??node.children,disabled:node.props.disabled===true}));
    const text=entry=>Array.isArray(entry.label)?entry.label.join(''):String(entry.label??'');
    const signature=JSON.stringify(choices.map(c=>[c.value,text(c),c.disabled]));
    const context=()=>{const v=api.getSnapshot(),owner=trigger.current?.closest?.('[data-whale-native-sidebar]');return JSON.stringify([right.mounted.getSnapshot(),v.activeId,v.selectedId,v.playGeneration,v.theme,v.activeTheme,v.galleryOpen,v.authorContext,v.canEdit,owner?.dataset.whaleSettingsPage,owner?.dataset.whaleGalleryOpen]);};
    latest.current={choices,signature,value:String(value),disabled,context:context(),onChange,scope:choiceScope};
    const close=(focus=false,notify=true)=>{
      session.current=null;if(openChoice?.token===trigger)openChoice=null;
      try{if(popup.current?.matches(':popover-open'))popup.current.hidePopover();}catch{}
      if(notify){setOpen(false);setCursor(-1);}if(focus)trigger.current?.focus();
    };
    const admissible=()=>{
      const node=trigger.current,owner=node?.closest?.('[data-whale-native-sidebar]'),tab=node?.closest?.('[data-tab-id]');
      if(latest.current.disabled||author?.read?.().editing)return false;
      // DOM validity is checked at the actual user gesture, not by an old render.
      if(node?.isConnected===false||owner?.hidden||tab?.hidden)return false;
      if(node?.closest?.('[data-whale-page-panel]')?.hidden)return false;
      try{if(typeof right.focusedTarget==='function'&&right.focusedTarget(node)===undefined)return false;}catch{return false;}
      return true;
    };
    const place=()=>{
      const node=trigger.current,list=popup.current;if(!node?.getBoundingClientRect||!list)return;
      const rect=node.getBoundingClientRect(),win=node.ownerDocument.defaultView,w=win.innerWidth,h=win.innerHeight;
      const width=Math.max(0,Math.min(Math.max(rect.width,180),w-16)),below=Math.max(0,h-rect.bottom-12),above=Math.max(0,rect.top-12);
      const up=below<Math.min(240,list.scrollHeight)&&above>below,space=up?above:below,height=Math.min(240,space);
      Object.assign(list.style,{position:'fixed',inset:'auto',margin:'0',left:Math.max(8,Math.min(rect.left,w-width-8))+'px',width:width+'px',maxHeight:height+'px',top:up?'auto':Math.max(8,rect.bottom+4)+'px',bottom:up?Math.max(8,h-rect.top+4)+'px':'auto'});
    };
    const begin=node=>{
      if(node)trigger.current=node;if(!admissible())return false;
      if(session.current)return true;
      openChoice?.close();const index=choices.findIndex(c=>c.value===String(value)&&!c.disabled);
      session.current={context:context(),signature,scope:choiceScope,index:index>=0?index:choices.findIndex(c=>!c.disabled),prefix:'',at:0};
      openChoice={token:trigger,close:()=>close(false)};setOpen(true);setCursor(session.current.index);
      try{popup.current?.showPopover();}catch{close();return false;}place();return true;
    };
    const choose=index=>{
      const task=session.current,current=latest.current,choice=current.choices[index];
      if(!task||!admissible()||task.context!==context()||task.signature!==current.signature||task.scope!==current.scope||!choice||choice.disabled){close();return;}
      const changed=choice.value!==current.value;close(true);
      if(changed)current.onChange?.({currentTarget:trigger.current,value:choice.value});
    };
    const move=(key)=>{
      const task=session.current;if(!task)return;const usable=latest.current.choices.map((c,i)=>c.disabled?-1:i).filter(i=>i>=0);if(!usable.length)return;
      const at=usable.indexOf(task.index);task.index=key==='Home'?usable[0]:key==='End'?usable.at(-1):usable[(at+(key==='ArrowUp'?-1:1)+usable.length)%usable.length];setCursor(task.index);
      popup.current?.querySelector('[data-whale-choice-value="'+task.index+'"]')?.scrollIntoView?.({block:'nearest'});
    };
    React.useEffect(()=>{if(open&&(!admissible()||session.current?.context!==context()||session.current?.signature!==signature||session.current?.scope!==choiceScope))close();});
    React.useEffect(()=>{
      if(!open)return;const node=trigger.current,list=popup.current,doc=node?.ownerDocument,win=doc?.defaultView;if(!doc||!win)return;
      const outside=e=>{if(!node.contains(e.target)&&!list?.contains(e.target))close();};
      const focus=e=>{if(!node.contains(e.target)&&!list?.contains(e.target))close();};
      const hidden=()=>{if(doc.hidden)close();};const blur=()=>close();
      doc.addEventListener('pointerdown',outside,true);doc.addEventListener('focusin',focus,true);doc.addEventListener('visibilitychange',hidden);
      doc.addEventListener('scroll',place,true);win.addEventListener('resize',place);win.addEventListener('blur',blur);
      const observer=typeof ResizeObserver==='function'?new ResizeObserver(place):null;observer?.observe(node);place();
      return()=>{doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('focusin',focus,true);doc.removeEventListener('visibilitychange',hidden);doc.removeEventListener('scroll',place,true);win.removeEventListener('resize',place);win.removeEventListener('blur',blur);observer?.disconnect();};
    },[open]);
    React.useEffect(()=>()=>close(false,false),[]);
    const selected=choices.find(c=>c.value===String(value));
    return h('span',{'data-whale-choice-root':true},
      h('button',{...props,ref:trigger,type:'button',role:'combobox','data-whale-choice':true,value:String(value),disabled,
        'aria-expanded':open,'aria-haspopup':'listbox','aria-controls':uid+'-list','aria-activedescendant':open&&cursor>=0?uid+'-'+cursor:undefined,
        onPointerDown:event=>{if(event.button===0)event.preventDefault();},
        onClick:event=>{if(session.current)close();else if(begin(event.currentTarget))event.currentTarget.focus?.();},
        onKeyDown:event=>{
          if(event.isComposing)return;const key=event.key;
          if(['Enter',' ','ArrowDown','ArrowUp','Home','End'].includes(key)){
            event.preventDefault();const wasOpen=!!session.current;if(!begin(event.currentTarget))return;
            if(wasOpen&&(key==='Enter'||key===' '))choose(session.current.index);
            else if(['ArrowDown','ArrowUp','Home','End'].includes(key))move(key);return;
          }
          if(key==='Escape'){if(session.current){event.preventDefault();event.stopPropagation?.();close(true);}return;}
          if(key==='Tab'){close();return;}
          if(key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
            event.preventDefault();if(!begin(event.currentTarget))return;const task=session.current,now=Date.now();task.prefix=now-task.at<700?task.prefix+key:key;task.at=now;
            const index=choices.findIndex(c=>!c.disabled&&text(c).toLocaleLowerCase().startsWith(task.prefix.toLocaleLowerCase()));
            if(index>=0){task.index=index;setCursor(index);popup.current?.querySelector('[data-whale-choice-value="'+index+'"]')?.scrollIntoView?.({block:'nearest'});}
          }
        }},h('span',{'data-whale-choice-label':true},selected?text(selected):'暂不可用'),h('span',{'aria-hidden':true,'data-whale-choice-chevron':true,'data-whale-chevron':'down'})),
      h('div',{ref:popup,popover:'manual',id:uid+'-list',role:'listbox','aria-label':props['aria-label']??props.title??'选择设置','data-whale-choice-list':true},
        ...choices.map((choice,index)=>h('div',{key:choice.value,id:uid+'-'+index,role:'option',tabIndex:-1,
          'data-whale-choice-value':index,'data-value':choice.value,'aria-selected':choice.value===String(value),'aria-disabled':choice.disabled||undefined,
          'data-active':cursor===index?'true':undefined,onPointerDown:e=>e.preventDefault(),onClick:()=>choose(index)},
          h('span',{'aria-hidden':true,'data-whale-choice-check':true},choice.value===String(value)?'✓':''),h('span',null,text(choice))))));
  }

  function LocalMedia({kind,view,token}){
    const type=kind==='image'?'Image':'Video',name=kind==='image'?'图片':'视频';
    const info=view[kind+'Info'],busy=view[kind+'Busy'],error=view[kind+'Error'],enabled=view['canEdit'+type],ticket=view[kind+'Ticket'];
    const action=(op,file,t)=>api[kind+'Action'](op,file,t,token);
    const input=React.useRef(null),choice=React.useRef(null),errorId=React.useId();
    return h('fieldset',{['data-whale-local-'+kind]:true,'aria-busy':busy,style:{border:0,padding:0,margin:'16px 0',minWidth:0}},
      h('legend',{style:{padding:0,fontWeight:600}},'本地'+name),
      info?h('div',{title:info.name,style:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',margin:'8px 0'}},info.name||'已保存的'+name):null,
      h('input',{ref:input,type:'file',hidden:true,accept:kind==='image'?'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif':'video/mp4,video/webm',disabled:!enabled,['data-whale-'+kind+'-file']:true,
        onChange:event=>{const file=event.currentTarget.files?.[0],ticket=choice.current;event.currentTarget.value='';choice.current=null;if(file&&ticket!==null)void action('replace',file,ticket);},onCancel:()=>{choice.current=null;}}),
      h('div',{'data-whale-local-actions':true},
        h('button',{type:'button',className:'dsw-btn',['data-whale-'+kind+'-choose']:true,disabled:!enabled,'aria-describedby':error?errorId:undefined,
          onClick:()=>{choice.current=ticket;input.current?.click();}},busy?'处理中…':info?'更换'+name:'选择'+name),
        info&&view.backgroundMode==='none'?h('button',{type:'button',className:'dsw-btn',['data-whale-'+kind+'-use']:true,disabled:!enabled,onClick:()=>action('use',null,ticket)},'使用已存'+name):null,
        info||view.backgroundMode===kind?h(ActionMenu,{name:kind,label:'本地'+name+'更多操作',text:'更多',scope:ticket,entries:[{key:'remove',label:'移除'+name,disabled:!enabled,danger:true,attributes:{['data-whale-'+kind+'-remove']:true},action:()=>action('remove',null,ticket)}]}):null),
      kind==='video'&&view.backgroundMode==='video'?h(Fold,{name:'video-playback',title:'播放选项',error:view.motionError},h(VideoMotionControl,{view})):null,
      error?h('span',{id:errorId,['data-whale-'+kind+'-error']:true,role:'alert'},error):null);
  }
  function Preview({row,visible,version}) {
    const [near,setNear]=React.useState(false),[resource,setResource]=React.useState(null),[failed,setFailed]=React.useState(false);
    const element=React.useRef(null),owned=React.useRef(null);
    React.useEffect(()=>{if(!visible)return;if(typeof IntersectionObserver!=='function'){setNear(true);return;}
      const observer=new IntersectionObserver(entries=>setNear(entries.some(entry=>entry.isIntersecting)),{rootMargin:'64px'});
      if(element.current)observer.observe(element.current);return()=>observer.disconnect();},[visible]);
    React.useEffect(()=>{setResource(null);setFailed(false);if(!visible||!near||!row.hasPreview)return;
      let live=true,created=null;const abort=new AbortController();
      previews.request(row.id,{signal:abort.signal}).then(blob=>{if(!live)return;created={url:URL.createObjectURL(blob),rowId:row.id,version};owned.current=created;setResource(created);},()=>{if(live)setFailed(true);});
      return()=>{live=false;abort.abort();if(created&&owned.current===created){owned.current=null;URL.revokeObjectURL(created.url);}};
    },[row.id,row.hasPreview,visible,near,version]);
    // Withdraw stale DOM consumers during render, before passive effect cleanup frees
    // their URL. React may batch a preview response with a viewport/visibility change.
    const current=visible&&near&&row.hasPreview&&!failed&&resource&&owned.current===resource&&resource.rowId===row.id&&resource.version===version;
    return h('div',{ref:element,style:{aspectRatio:'16 / 9',overflow:'hidden',display:'grid',placeItems:'center',background:'var(--dsw-alias-bg-layer-2)'}},
      current?h('img',{key:resource.url,src:resource.url,alt:'',style:{width:'100%',height:'100%',objectFit:'cover'},onError:event=>{
        if(owned.current!==resource)return;
        event?.currentTarget?.removeAttribute('src');owned.current=null;URL.revokeObjectURL(resource.url);setFailed(true);
      }}):h('span',{style:{fontSize:'12px',opacity:0.65}},'无预览'));
  }
  function Gallery({view,visible}) {
    const uid=React.useId();
    return h('div',{'data-whale-gallery':true,style:{minWidth:0,display:'grid',gap:'12px'}},
      h('input',{type:'search','aria-label':'搜索壁纸',placeholder:'搜索壁纸',maxLength:200,value:view.galleryQuery,style:{width:'100%',minWidth:0,boxSizing:'border-box'},onChange:event=>api.search(event.currentTarget.value)}),
      h('fieldset',{style:{display:'flex',flexWrap:'wrap',gap:'12px',padding:0,margin:0,border:0},'aria-label':'年龄分级'},
        ...[['Everyone','全年龄'],['Questionable','敏感'],['Mature','成人']].map(([rating,label])=>h('label',{key:rating,title:rating,style:{display:'flex',alignItems:'center',gap:'4px'}},
          h('input',{type:'checkbox','data-whale-rating':rating,checked:view.galleryRatings.split(',').includes(rating),onChange:event=>api.setRating(rating,event.currentTarget.checked)}),label))),
      view.selectionError?h('p',{role:'alert'},view.selectionError):null,
      view.catalogLoading?h('span',{role:'status'},'正在读取壁纸目录…'):null,
      h('span',{'data-whale-gallery-count':true,role:'status'},`${view.galleryCount} 张`),
      h('div',{'data-whale-gallery-grid':true},
        ...view.galleryRows.map((row,index)=>{
          const selected=view.selectedId===row.id,playing=view.state==='playing'&&!view.playBusy&&view.activeId===row.id;
          const type={scene:'场景',video:'视频',web:'网页',unknown:'暂不可用'}[row.type],description=uid+'-item-'+index;
          return h('button',{key:row.id,type:'button','data-whale-gallery-item':row.id,'aria-pressed':selected,'aria-label':row.title,'aria-describedby':description,disabled:!row.selectable,
            title:row.title,className:'dsw-btn',onClick:()=>api.selectWallpaper(row.id)},
            h('div',{'data-whale-gallery-thumbnail':true},
              h(Preview,{key:row.id+':'+view.galleryVersion,row,visible,version:view.galleryVersion}),
              h('span',{'data-whale-gallery-type':true,'aria-hidden':true},type),
              playing?h('span',{'data-whale-gallery-playing':true,'aria-hidden':true,title:'正在播放'},'▶'):null),
            h('span',{'data-whale-gallery-caption':true},h('span',{'data-whale-gallery-title':true},row.title),
              selected?h('span',{'data-whale-gallery-selected':true,'aria-hidden':true,title:'已选中'},'✓'):null),
            h('span',{id:description,hidden:true},[type,!row.selectable?'当前不可选择':null,selected?'已选中':null,playing?'正在播放':null].filter(Boolean).join('，')));
        })),
      !view.galleryRows.length&&!view.catalogLoading&&!view.catalogError?h('p',{role:'status'},!view.galleryRatings?'请选择至少一个分级':view.galleryQuery?'没有匹配的壁纸':'此分级下暂无壁纸'):null,
      view.galleryPages>1?h('nav',{'data-whale-gallery-pagination':true,'aria-label':'壁纸分页'},
        h('button',{type:'button',className:'dsw-btn','aria-label':'上一页',title:'上一页',disabled:view.galleryPage===0,onClick:()=>api.changePage(-1)},h('span',{'data-whale-chevron':'left','aria-hidden':true})),
        h('output',{'aria-label':'图库页码'},`${view.galleryPage+1} / ${view.galleryPages}`),h('button',{type:'button',className:'dsw-btn','aria-label':'下一页',title:'下一页',disabled:view.galleryPage+1>=view.galleryPages,onClick:()=>api.changePage(1)},h('span',{'data-whale-chevron':'right','aria-hidden':true}))):null);
  }
  function RangeControl({setting,label,hint,value,view}) {
    const id=React.useId();
    const unit=setting==='blur'?'px':'%';
    const error=view[setting+'Error'];
    const disabled=!view.canOpen || !view.canEdit || value===null;
    return h('div',{'data-whale-appearance-field':setting,style:{display:'grid',gap:'8px',minWidth:0}},
      h('div',{style:{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'12px'}},
        h('label',{htmlFor:id,title:hint},label),
        h('output',{htmlFor:id,style:{fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}},value===null?'—':`${value}${unit}`)),
      h('input',{id,type:'range',min:ranges[setting][0],max:ranges[setting][1],step:1,value:value??ranges[setting][0],disabled,
        'data-whale-appearance-range':setting,'aria-valuetext':value===null?'暂不可用':`${value}${unit}`,'aria-invalid':error?true:undefined,
        'aria-describedby':error?id+'-error':undefined,title:hint,
        style:{width:'100%',minWidth:0,minHeight:'24px',margin:0,accentColor:'var(--dsw-alias-brand-primary, #8c72f2)',opacity:disabled?0.5:1},
        onChange:event=>api.setAppearance(setting,event.currentTarget.valueAsNumber)}),
      error?h('span',{id:id+'-error',role:'alert'},error):null);
  }
  function ThemeControl({view}) {
    const id=React.useId(),disabled=!view.canOpen||!view.canEdit||!view.canSetTheme||view.theme===null;
    return h('div',{'data-whale-interface-theme':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'主题'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'theme',value:view.theme??'',disabled,title:'切换鲸系主题，保留其它外观设置',
        'aria-invalid':view.themeError?true:undefined,'aria-describedby':view.themeError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setTheme(event.value)},
        view.theme===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'mist'},'鲸雾'),h('option',{value:'abyss'},'鲸渊')),
      view.themeError?h('span',{id:id+'-error',role:'alert'},view.themeError):null);
  }
  function PaletteControl({view}) {
    const id=React.useId();
    if(view.theme!=='abyss')return null;
    const disabled=!view.canOpen||!view.canEdit||view.activeTheme!=='abyss'||view.palette===null;
    return h('div',{'data-whale-interface-palette':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'深色配色'),
      h(Select,{id,presentation:'swatches','aria-labelledby':id+'-label','data-whale-interface-option':'palette',value:view.palette??'',disabled,
        title:'鲸渊的主题底色；跟随主题时同时决定强调色',
        'aria-invalid':view.paletteError?true:undefined,'aria-describedby':view.paletteError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setPalette(event.value)},
        view.palette===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        ...paletteOptions.map(([value,label])=>h('option',{key:value,value},label))),
      view.paletteError?h('span',{id:id+'-error',role:'alert'},view.paletteError):null);
  }
  function AccentControl({view}) {
    const id=React.useId(),colorId=id+'-color';
    const disabled=!view.canOpen||!view.canEdit||view.accentMode===null||view.accentColor===null||view.theme===null||view.activeTheme!==view.theme;
    return h('div',{'data-whale-interface-accent':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'强调色'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'accentMode',value:view.accentMode??'',disabled,
        title:'跟随主题配色，或自定义交互元素的强调色',
        'aria-invalid':view.accentModeError?true:undefined,'aria-describedby':view.accentModeError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setAccent('accentMode',event.value)},
        view.accentMode===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'theme'},'跟随主题'),h('option',{value:'custom'},'自定义')),
      view.accentModeError?h('span',{id:id+'-error',role:'alert'},view.accentModeError):null,
      view.accentMode==='custom'?h('div',{style:{display:'grid',gap:'8px',minWidth:0}},
        h('label',{htmlFor:view.accentColor===null?undefined:colorId},'自定义颜色'),
        view.accentColor===null?h('span',{'data-whale-accent-unavailable':true},'暂不可用'):
          h('div',{style:{display:'flex',alignItems:'center',gap:'12px',minWidth:0}},
            h('input',{id:colorId,type:'color','data-whale-interface-color':'accentColor',value:view.accentColor,disabled,
              'aria-invalid':view.accentColorError?true:undefined,'aria-describedby':view.accentColorError?colorId+'-error':undefined,
              style:{width:'44px',height:'32px',padding:'2px',border:'1px solid var(--dsw-alias-border-default, currentColor)',borderRadius:'4px',background:'transparent',opacity:disabled?0.5:1},
              onChange:event=>api.setAccent('accentColor',event.currentTarget.value)}),
            h('output',{htmlFor:colorId,'data-whale-accent-hex':true,style:{fontVariantNumeric:'tabular-nums'}},view.accentColor)),
        view.accentColorError?h('div',{style:{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}},
          h('span',{id:colorId+'-error',role:'alert'},view.accentColorError),
          view.canRetryAccentColor?h('button',{type:'button',className:'dsw-btn','data-whale-accent-retry':true,disabled,onClick:()=>api.retryAccentColor()},'重试'):null):null):null);
  }
  function SidebarDepthControl({view}) {
    const id=React.useId(),disabled=!view.canOpen||!view.canEdit||view.sidebar===null||view.theme===null||view.activeTheme!==view.theme;
    return h('div',{'data-whale-interface-sidebar':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'侧栏层次'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'sidebar',value:view.sidebar??'',disabled,title:'只改变侧栏与会话区的明度关系',
        'aria-invalid':view.sidebarError?true:undefined,'aria-describedby':view.sidebarError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setSidebarDepth(event.value)},
        view.sidebar===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'balanced',title:'保持侧栏与会话区接近的明度'},'均衡'),h('option',{value:'deep',title:'加深侧栏底色，与会话区拉开层次'},'加深')),
      view.sidebarError?h('span',{id:id+'-error',role:'alert'},view.sidebarError):null);
  }
  function CanvasDepthControl({view}) {
    const id=React.useId(),disabled=!view.canOpen||!view.canEdit||view.canvas===null||view.theme===null||view.activeTheme!==view.theme;
    return h('div',{'data-whale-interface-canvas':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'背景层次'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'canvas',value:view.canvas??'',disabled,title:'控制主画布的雾感与边界清晰度',
        'aria-invalid':view.canvasError?true:undefined,'aria-describedby':view.canvasError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setCanvasDepth(event.value)},
        view.canvas===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'soft',title:'主画布保留柔和的雾感'},'柔雾'),h('option',{value:'clear',title:'主画布使用更明确的底色层次'},'清晰')),
      view.canvasError?h('span',{id:id+'-error',role:'alert'},view.canvasError):null);
  }
  function VideoMotionControl({view}) {
    const id=React.useId(),disabled=!view.canSetVideoMotion;
    return h('div',{'data-whale-video-motion':true,style:{display:'grid',gap:'8px',minWidth:0,marginTop:'12px'}},
      h('label',{htmlFor:id},'播放策略'),
      h(Select,{id,'data-whale-video-option':'motion',value:view.videoMotion??'',disabled,
        title:'仅控制本地视频；页面隐藏或系统要求减少动态时仍暂停',
        'aria-invalid':view.motionError?true:undefined,'aria-describedby':view.motionError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setVideoMotion(event.value)},
        view.videoMotion===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'focus'},'失焦暂停'),h('option',{value:'always'},'始终播放')),
      view.motionError?h('span',{id:id+'-error','data-whale-video-motion-error':true,role:'alert'},view.motionError):null);
  }
  function GlassControl({view}) {
    const id=React.useId(),disabled=!view.canOpen||!view.canEdit||view.glass===null||view.theme===null||view.activeTheme!==view.theme;
    return h('div',{'data-whale-interface-glass':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'玻璃强度'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'glass',value:view.glass??'',disabled,title:'影响浮层和菜单，不影响输入卡片',
        'aria-invalid':view.glassError?true:undefined,'aria-describedby':view.glassError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setGlassStrength(event.value)},
        view.glass===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'standard',title:'保留浮层和菜单的玻璃感'},'标准'),h('option',{value:'restrained',title:'浮层和菜单更接近实色，不改变输入卡片'},'偏实色')),
      view.glassError?h('span',{id:id+'-error',role:'alert'},view.glassError):null);
  }
  function OpaqueSidebarControl({view}) {
    const id=React.useId();
    if(view.backgroundMode==='none')return null;
    const disabled=!view.canOpen||!view.canEdit||view.opaqueSidebar===null||view.backgroundMode===null||view.theme===null||view.activeTheme!==view.theme;
    return h('div',{'data-whale-interface-opaque-sidebar':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('label',{htmlFor:id,title:'勾选后左侧项目／会话栏使用主题实色；关闭后沿用界面不透明度',style:{display:'flex',alignItems:'flex-start',gap:'8px',minWidth:0}},
        h('input',{id,type:'checkbox','data-whale-interface-toggle':'opaqueSidebar',checked:view.opaqueSidebar===true,disabled,
          ref:node=>{if(node)node.indeterminate=view.opaqueSidebar===null;},'aria-checked':view.opaqueSidebar===null?'mixed':view.opaqueSidebar,
          'aria-invalid':view.opaqueSidebarError?true:undefined,'aria-describedby':view.opaqueSidebarError?id+'-error':undefined,
          style:{marginTop:'3px',flexShrink:0,accentColor:'var(--dsw-alias-brand-primary, #8c72f2)'},
          onChange:event=>api.setOpaqueSidebar(event.currentTarget.checked)}),
        h('span',null,'左侧项目／会话栏不透明底色')),
      view.opaqueSidebar===null||view.backgroundMode===null?h('span',null,'暂不可用'):null,
      view.opaqueSidebarError?h('span',{id:id+'-error',role:'alert'},view.opaqueSidebarError):null);
  }
  function ReadabilityControl({view}) {
    const id=React.useId(),disabled=!view.canOpen||!view.canEdit||view.textContrast===null;
    return h('div',{'data-whale-interface-readability':true,style:{display:'grid',gap:'8px',minWidth:0}},
      h('span',{id:id+'-label'},'文字可读性'),
      h(Select,{id,presentation:'segments','aria-labelledby':id+'-label','data-whale-interface-option':'textContrast',value:view.textContrast??'',disabled,
        title:view.textContrast==='enhanced'?'增强正文和普通说明，不改变状态含义':'保持主题原有文字，跟随系统高对比度',
        'aria-invalid':view.textContrastError?true:undefined,'aria-describedby':view.textContrastError?id+'-error':undefined,
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:disabled?0.5:1},
        onChange:event=>api.setTextContrast(event.value)},
        view.textContrast===null?h('option',{value:'',disabled:true},'暂不可用'):null,
        h('option',{value:'standard'},'标准'),h('option',{value:'enhanced'},'增强')),
      view.textContrastError?h('span',{id:id+'-error',role:'alert'},view.textContrastError):null);
  }
  function PresetControl({view,token,visible}) {return view.preset?.available?h(PresetEditor,{view,token,visible}):null;}
  function PresetEditor({view,token,visible}) {
    const [done,setDone]=React.useState(null),lease=React.useRef(null),primary=React.useRef(null),returnFocus=React.useRef(false),id=React.useId(),p=view.preset;
    React.useEffect(()=>{if(!visible){lease.current=null;api.setPresetOpen(token,false);}return()=>{lease.current=null;api.setPresetOpen(token,false);};},[token,visible]);
    React.useEffect(()=>{if(!visible){setDone(null);return;}if(!done)return;const timer=setTimeout(()=>setDone(null),1200);return()=>clearTimeout(timer);},[done,visible]);
    const complete=res=>{if(res.ok)setDone({ticket:api.getSnapshot().preset.ticket,operation:res.operation});return res;};
    const confirmation=p.confirmation?.owner===token&&p.confirmation.lease===lease.current?p.confirmation:null;
    React.useEffect(()=>{if(returnFocus.current&&!confirmation){returnFocus.current=false;primary.current?.focus();}},[confirmation]);
    // A visible row alone grants no action. Acquire the existing view lease only at an explicit gesture.
    const action=op=>{lease.current=api.setPresetOpen(token,visible);return complete(api.presetAction(op,p.ticket,token,lease.current));};
    const gesture=event=>visible&&event.currentTarget?.isConnected!==false&&authorViewCurrent(event.currentTarget)&&!author.read().editing;
    const keepEditor=event=>{if(event.button===0)event.preventDefault();};
    const cancel=()=>{returnFocus.current=true;api.cancelPreset(token,lease.current);};
    const operation=p.saved?'apply':'save',enabled=p.saved?p.canApply:p.canSave;
    return h('section',{'data-whale-presets':true,'aria-label':'此壁纸预设',onKeyDown:event=>{if(event.key==='Escape'&&confirmation){event.preventDefault();event.stopPropagation();cancel();}}},
      h('div',{'data-whale-preset-row':true},
        h('span',{'data-whale-preset-label':true},'此壁纸预设'),
        h('span',{'data-whale-preset-state':true},p.safe?(p.saved?(p.matching?'已保存':'有改动'):'未保存'):'暂不可用'),
        h('span',{'data-whale-preset-feedback':true,role:'status'},done?.ticket===p.ticket?h('span',{'aria-label':done.operation==='save'?'预设已保存':done.operation==='remove'?'预设已删除':'当前外观已恢复'},'✓'):null),
        h('button',{ref:primary,type:'button',className:'dsw-btn','data-whale-preset-action':operation,disabled:!enabled||!!confirmation,
          'aria-label':p.saved?'恢复此壁纸预设':'保存此壁纸预设','aria-describedby':id+'-scope'+(p.error?' '+id+'-error':''),
          onPointerDown:keepEditor,onClick:event=>{if(gesture(event))action(operation);}},p.saved?'恢复':'保存'),
        p.saved?h(ActionMenu,{name:'preset',label:'更多预设操作',scope:p.ticket,entries:[
          {key:'save',label:'更新预设…',disabled:!p.canSave||!!confirmation,attributes:{'data-whale-preset-action':'save'},action:()=>action('save')},
          {key:'remove',label:'删除预设…',disabled:!p.canRemove||!!confirmation,danger:true,attributes:{'data-whale-preset-action':'remove'},action:()=>action('remove')}]}):null),
      h('span',{id:id+'-scope','data-whale-preset-scope':true},'保存：亮度、遮罩、模糊、界面不透明度'),
      !p.safe?h('span',{role:'status','data-whale-preset-unavailable':true},p.reason):null,
      confirmation?h('div',{'data-whale-preset-confirm':confirmation.op,role:'group','aria-label':confirmation.op==='remove'?'确认删除预设':'确认覆盖预设'},
        h('p',null,confirmation.op==='remove'?`删除“${p.title}”的预设？`:`用当前四项覆盖“${p.title}”的预设？`),
        confirmation.op==='save'?h('dl',{'data-whale-preset-values':true,'aria-label':'将保存的四项'},
          ...[['brightness','亮度','%'],['mask','遮罩','%'],['blur','背景模糊','px'],['surface','界面不透明度','%']].flatMap(([key,label,unit])=>[
            h('dt',{key:key+'-label'},label),h('dd',{key},`${p.current[key]}${unit}`)])):null,
        h('div',{'data-whale-preset-confirm-actions':true},
          h('button',{type:'button',className:'dsw-btn','data-whale-preset-confirm-yes':true,onPointerDown:keepEditor,onClick:event=>{if(gesture(event)){returnFocus.current=true;complete(api.confirmPreset(confirmation,token,lease.current));}}},confirmation.op==='remove'?'确认删除':'确认覆盖'),
          h('button',{type:'button',className:'dsw-btn','data-whale-preset-cancel':true,onPointerDown:keepEditor,onClick:cancel},'取消'))):null,
      p.error?h('span',{id:id+'-error',role:'alert','data-whale-preset-error':true},p.error):null);
  }
  function PlaybackOptions({view}) {
    const id=React.useId(),node=React.useRef(null),error=view.modeError||view.autoStartError;
    React.useEffect(()=>{if(error&&node.current)node.current.open=true;},[error]);
    return h('details',{ref:node,'data-whale-playback-options':true,style:{marginTop:'16px',minWidth:0}},
      h('summary',{style:{cursor:'pointer'}},'播放选项',error?h('span',{'data-whale-group-error':true,'aria-label':'此组有问题'},' !'):null),
      h('div',{style:{display:'grid',gap:'12px',marginTop:'12px',minWidth:0}},
        h('div',{style:{display:'grid',gap:'6px',minWidth:0}},
          h('label',{htmlFor:id+'-mode'},'播放模式'),
          h(Select,{id:id+'-mode','data-whale-playback-option':'weMode',value:view.playMode??'',disabled:!view.canSetMode,
            title:'对下次播放生效',style:{width:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:view.canSetMode?1:0.5},
            'aria-invalid':view.modeError?true:undefined,'aria-describedby':view.modeError?id+'-mode-error':undefined,
            onChange:event=>api.setPlaybackOption('weMode',event.value)},
            view.playMode===null?h('option',{value:'',disabled:true},'请选择模式'):null,
            h('option',{value:'daily'},'日常（持续播放）'),h('option',{value:'preview'},'预览（限时）')),
          view.modeError?h('span',{id:id+'-mode-error',role:'alert'},view.modeError):null),
        h('div',{style:{display:'grid',gap:'6px',minWidth:0}},
          h('label',{htmlFor:id+'-auto',style:{display:'flex',alignItems:'center',gap:'8px'}},
            h('input',{id:id+'-auto',type:'checkbox','data-whale-playback-option':'weAutoStart',checked:view.autoStart===true,disabled:!view.canSetAutoStart,
              'aria-invalid':view.autoStartError?true:undefined,'aria-describedby':id+'-auto-hint'+(view.autoStartError?' '+id+'-auto-error':''),
              style:{accentColor:'var(--dsw-alias-brand-primary, #8c72f2)'},onChange:event=>api.setPlaybackOption('weAutoStart',event.currentTarget.checked)}),'随DSH启动自动播放'),
          h('span',{id:id+'-auto-hint',style:{fontSize:'12px',opacity:0.7}},view.autoStart===null?'自动播放设置未确认':'仅Lucy的日常模式可自动播放'),
          view.autoStartError?h('span',{id:id+'-auto-error',role:'alert'},view.autoStartError):null)));
  }
  // Host focus continuity may blur an input before React delivers tab.visible=false.
  // Read the live SDK target from that input instead of committing a stale render's blur.
  function authorViewCurrent(node){try{
    const owner=node?.closest?.('[data-whale-native-sidebar]');
    if(owner&&(owner.dataset.whaleSettingsPage!=='wallpaper'||owner.dataset.whaleGalleryOpen==='true'))return false;
    return typeof right.focusedTarget==='function'&&right.focusedTarget(node)!==undefined;
  }catch{return false;}}
  function authorLabel(field) {
    const names={'粒子/Particles':'粒子','光照/illumination':'光照','水袋/Water bag':'水袋','开场动画Opening animation':'开场动画','开关/Switch':'开关','关闭作者营销词 Hide marketing words':'隐藏作者营销文字'};
    if(Object.hasOwn(names,field.label))return names[field.label];
    if(/^ui_[A-Za-z0-9_]+$/.test(field.label))return '未命名设置 '+(author.read().fields.findIndex(item=>item.key===field.key)+1);
    return field.label;
  }
  function InfoPopover({name,label,scope=null,attributes={},children}) {
    return h(ActionMenu,{name,label,scope,attributes,disabled:author.read().editing,description:children,
      text:h('svg',{'data-whale-info-icon':true,'aria-hidden':true,viewBox:'0 0 16 16'},
        h('circle',{cx:8,cy:8,r:6,fill:'none',stroke:'currentColor'}),h('path',{d:'M8 7v5M8 4v1',fill:'none',stroke:'currentColor',strokeWidth:1.5}))});
  }
  function AuthorName({field,htmlFor}) {
    const label=authorLabel(field);
    return h('span',{'data-whale-author-name':field.key},
      h('label',{htmlFor,title:field.label,style:{overflowWrap:'anywhere'}},label),
      label!==field.label?h(InfoPopover,{name:'author-original-'+field.key,label:label+'：查看原始名称',scope:field.label},
        h('p',null,'原始名称'),h('p',{'data-whale-author-original':field.key},field.label)):null);
  }
  function AuthorFeedback({field,mark,id}) {
    const status={busy:['…','正在处理修改'],sent:['✓','下发已确认，效果请观察'],
      error:['!','修改未完成，请查看本组提示'],unknown:['?','本轮修改结果未确认']}[mark];
    const label=status?.[1]??'显示作者默认值或本机记录，未读取壁纸实际值';
    return h('span',{id,'data-whale-author-feedback':field.key,'data-state':status?mark:'record',title:label},
      h('span',{'aria-hidden':true},status?.[0]??''),h('span',{'data-whale-author-feedback-text':true},label));
  }
  function AuthorSlider({field,state,view,visible,signal,id,colorChannel=null,feedbackId=id+'-feedback'}) {
    const owner=React.useRef(Symbol('author-slider')).current,interaction=React.useRef(null),node=React.useRef(null),numberEditor=React.useRef(null);
    const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'];
    function finish(commit){commit=commit&&authorViewCurrent(node.current);const item=interaction.current;interaction.current=null;if(!item)return;
      if(commit)void author.editEnd(item.ticket);else author.editCancel(item.ticket);
      if(item.pointerId!==undefined&&node.current?.hasPointerCapture?.(item.pointerId))node.current.releasePointerCapture(item.pointerId);}
    function begin(mode,pointerId){if(interaction.current&&!author.editCurrent(interaction.current.ticket))finish(false);if(interaction.current)return mode==='keyboard'&&interaction.current.mode===mode;
      if(colorChannel===null&&authorViewCurrent(node.current))void numberEditor.current?.complete('blur');
      const ticket=author.editStart(field.key,owner,view);if(!ticket)return false;interaction.current={ticket,mode,pointerId};return true;}
    React.useEffect(()=>{const cancel=()=>finish(false);globalThis.addEventListener('blur',cancel);signal?.addEventListener('abort',cancel,{once:true});
      return()=>{globalThis.removeEventListener('blur',cancel);signal?.removeEventListener('abort',cancel);cancel();};},[view,signal]);
    React.useEffect(()=>{if(!visible||!state.canEdit)finish(false);},[visible,state.canEdit]);
    const mark=state.marks[field.key],isColor=colorChannel!==null;
    const value=isColor?Math.round(nativeAuthorColor(state.values[field.key]).rgb[colorChannel]*255):state.values[field.key];
    return h('div',{'data-whale-author-slider':field.key,style:{display:'grid',gap:'6px',minWidth:0}},
      h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',minWidth:0}},
        h(AuthorName,{field,htmlFor:id}),
        h('div',{style:{display:'flex',gap:'6px',alignItems:'center',minWidth:0}},
          !isColor?h(AuthorFeedback,{field,mark,id:feedbackId}):null,
          isColor?h('output',{htmlFor:id,style:{overflowWrap:'anywhere'}},String(value)):h(AuthorNumber,{field,state,view,visible,signal,id:id+'-number',editorRef:numberEditor,feedbackId}))),
      h('input',{id,ref:node,type:'range',min:isColor?0:field.rangeMin,max:isColor?255:field.rangeMax,step:isColor?1:field.rangeStep,value,disabled:!state.canEdit,
        'data-whale-author-key':isColor?undefined:field.key,'data-whale-author-channel':isColor?field.key+'-'+colorChannel:undefined,'aria-busy':mark==='busy','aria-describedby':feedbackId,
        title:!mark?'初始为作者默认值或插件记录，尚未读取实际值':'松手或结束按键后应用',
        style:{width:'100%',minWidth:0,margin:0,accentColor:'var(--dsw-alias-brand-primary, #8c72f2)'},
        onPointerDown:event=>{if(event.button!==0||!begin('pointer',event.pointerId))event.preventDefault();else event.currentTarget.setPointerCapture(event.pointerId);},
        onPointerUp:event=>{if(interaction.current?.mode==='pointer'&&interaction.current.pointerId===event.pointerId)finish(true);},
        onPointerCancel:event=>{if(interaction.current?.pointerId===event.pointerId)finish(false);},
        onLostPointerCapture:event=>{if(interaction.current?.pointerId===event.pointerId)finish(false);},
        onKeyDown:event=>{if(event.key==='Escape'){event.preventDefault();finish(false);}else if(keys.includes(event.key)&&!begin('keyboard'))event.preventDefault();},
        onKeyUp:event=>{if(keys.includes(event.key)&&interaction.current?.mode==='keyboard')finish(true);},
        onBlur:()=>finish(interaction.current?.mode==='keyboard'),
        onChange:event=>{const item=interaction.current;let next=event.currentTarget.valueAsNumber;
          if(isColor){const rgb=nativeAuthorColor(author.read().values[field.key]).rgb;rgb[colorChannel]=next/255;next=rgb.join(' ');}
          if(!item||!author.editPreview(item.ticket,next))event.currentTarget.value=String(value);}}));
  }
  function AuthorNumber({field,state,view,visible,signal,id,editorRef,feedbackId}) {
    const node=React.useRef(null);
    const editor=React.useMemo(()=>createNativeAuthorNumberEditor({author,field,view,isCurrent:()=>!signal?.aborted&&authorViewCurrent(node.current)}),[field,view,signal]);
    const local=React.useSyncExternalStore(editor.subscribe,editor.read,editor.read),mark=state.marks[field.key];
    React.useEffect(()=>{editorRef.current=editor;const cancel=()=>editor.cancel();globalThis.addEventListener('blur',cancel);signal?.addEventListener('abort',cancel,{once:true});return()=>{if(editorRef.current===editor)editorRef.current=null;globalThis.removeEventListener('blur',cancel);signal?.removeEventListener('abort',cancel);cancel();};},[editor,signal,editorRef]);
    React.useEffect(()=>{if(!visible||!state.canEdit)editor.cancel();},[editor,visible,state.canEdit]);
    const keyInfo=event=>({key:event.key,isComposing:event.nativeEvent?.isComposing===true,keyCode:event.nativeEvent?.keyCode??event.keyCode});
    return h('div',{'data-whale-author-number-field':field.key,style:{display:'grid',gap:'4px',minWidth:0,maxWidth:'100%'}},
      h('input',{id,ref:node,type:'text',inputMode:'decimal',value:local.text,autoComplete:'off',spellCheck:false,disabled:!state.canEdit,
        'data-whale-author-number':field.key,'aria-label':authorLabel(field)+'数值','aria-busy':mark==='busy','aria-invalid':local.error?true:undefined,'aria-describedby':[feedbackId,local.error?id+'-error':null].filter(Boolean).join(' '),
        title:'Enter或移开焦点后应用；Esc取消',style:{width:'6em',maxWidth:'100%',minWidth:0,boxSizing:'border-box',color:'inherit',font:'inherit',fontVariantNumeric:'tabular-nums',textAlign:'right',background:'transparent',border:'1px solid var(--dsw-alias-border-l2, #ffffff44)',borderRadius:'4px',padding:'4px 6px'},
        onFocus:()=>editor.focus(),onPointerDown:()=>editor.focus(),onPaste:()=>editor.paste(),onChange:event=>editor.input(event.currentTarget.value),onBlur:()=>{void editor.complete('blur');},
        onCompositionStart:()=>editor.compositionStart(),onCompositionEnd:event=>editor.compositionEnd(event.currentTarget.value),
        onKeyDown:event=>{const action=editor.keyDown(keyInfo(event));if(action.prevent)event.preventDefault();if(action.stop)event.stopPropagation();},onKeyUp:event=>editor.keyUp(keyInfo(event))}),
      local.error?h('span',{id:id+'-error',role:'alert',style:{fontSize:'12px',overflowWrap:'anywhere',maxWidth:'12em'}},local.error):null);
  }
  function AuthorColor({field,state,view,visible,signal,id}) {
    const owner=React.useRef(Symbol('author-color')).current,editing=React.useRef(null),input=React.useRef(null);
    const color=nativeAuthorColor(state.values[field.key]),[text,setText]=React.useState(color.hex),[open,setOpen]=React.useState(false),[error,setError]=React.useState(null);
    function reset(){setText(nativeAuthorColor(author.read().values[field.key])?.hex??'');}
    function finish(commit){commit=commit&&authorViewCurrent(input.current);const ticket=editing.current;editing.current=null;if(!ticket)return;
      const valid=nativeAuthorColorFromHex(input.current?.value);
      if(commit&&valid!==null){void author.editEnd(ticket);setError(null);}else{author.editCancel(ticket);setError(commit?'颜色格式无效，未应用':null);}reset();}
    React.useEffect(()=>{if(!editing.current)setText(color.hex);},[color.hex]);
    React.useEffect(()=>{const cancel=()=>finish(false);globalThis.addEventListener('blur',cancel);signal?.addEventListener('abort',cancel,{once:true});
      return()=>{globalThis.removeEventListener('blur',cancel);signal?.removeEventListener('abort',cancel);cancel();};},[view,signal]);
    React.useEffect(()=>{if(!visible||!state.canEdit){finish(false);setOpen(false);}},[visible,state.canEdit]);
    React.useEffect(()=>{if(editing.current&&!author.editCurrent(editing.current))finish(false);},[state]);
    const mark=state.marks[field.key];
    return h('div',{'data-whale-author-color':field.key,style:{display:'grid',gap:'8px',minWidth:0}},
      h('div',{style:{display:'flex',alignItems:'center',gap:'8px',minWidth:0}},
        h(AuthorName,{field,htmlFor:id+'-hex'}),
        h(AuthorFeedback,{field,mark,id:id+'-feedback'}),
        h('button',{type:'button',className:'dsw-btn','data-whale-author-color-toggle':field.key,'aria-label':authorLabel(field)+'调色','aria-expanded':open,'aria-controls':id+'-channels',disabled:!state.canEdit,
          title:open?'收起颜色调节':'展开颜色调节',onClick:()=>setOpen(!open),style:{padding:'5px',flexShrink:0}},
          h('span',{'aria-hidden':true,style:{display:'block',width:'24px',height:'20px',background:color.hex,border:'1px solid var(--dsw-alias-border-l2, #ffffff44)',borderRadius:'3px'}})),
        h('input',{id:id+'-hex',ref:input,type:'text',value:author.editCurrent(editing.current)?text:color.hex,maxLength:7,spellCheck:false,autoComplete:'off','data-whale-author-key':field.key,
          'aria-label':authorLabel(field)+'色值','aria-busy':mark==='busy','aria-invalid':error?true:undefined,'aria-describedby':[id+'-feedback',error?id+'-error':null].filter(Boolean).join(' '),
          disabled:!state.canEdit,title:'六位色值；Enter或移开焦点后应用',style:{width:'8ch',minWidth:0,flexShrink:0,color:'inherit',font:'inherit',background:'transparent',border:'1px solid var(--dsw-alias-border-l2, #ffffff44)',borderRadius:'4px',padding:'5px'},
          onFocus:()=>{editing.current=author.editStart(field.key,owner,view);setText(color.hex);},
          onChange:event=>{if(!author.editCurrent(editing.current)){reset();return;}const next=event.currentTarget.value;setText(next);const value=nativeAuthorColorFromHex(next);setError(value===null?'请输入六位色值，如 #336699':null);if(value!==null)author.editPreview(editing.current,value);},
          onPaste:()=>{if(!author.editCurrent(editing.current))editing.current=author.editStart(field.key,owner,view);},
          onBlur:()=>finish(true),onKeyDown:event=>{if(event.key==='Escape'){event.preventDefault();finish(false);}else if(event.key==='Enter'){event.preventDefault();if(nativeAuthorColorFromHex(event.currentTarget.value)===null)setError('请输入六位色值，如 #336699');else finish(true);}else if(!author.editCurrent(editing.current)&&(event.key.length===1||['Backspace','Delete'].includes(event.key)))editing.current=author.editStart(field.key,owner,view);}})),
      error?h('span',{id:id+'-error',role:'alert',style:{fontSize:'12px'}},error):null,
      open?h('div',{id:id+'-channels',style:{display:'grid',gap:'10px',minWidth:0,padding:'4px 0'}},...['红 R','绿 G','蓝 B'].map((label,channel)=>h(AuthorSlider,{key:channel,field:{...field,label},state,view,visible,signal,id:id+'-channel-'+channel,colorChannel:channel,feedbackId:id+'-feedback'}))):null);
  }
  function AuthorSelect({field,state,view,id}) {
    const mark=state.marks[field.key],index=field.options.findIndex(option=>Object.is(option.value,state.values[field.key]));
    return h('div',{'data-whale-author-select':field.key,style:{display:'grid',gap:'6px',minWidth:0}},
      h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',minWidth:0}},
        h(AuthorName,{field,htmlFor:id}),
        h(AuthorFeedback,{field,mark,id:id+'-feedback'})),
      h(Select,{id,choiceScope:field,'data-whale-author-key':field.key,value:String(index),disabled:!state.canEdit,
        'aria-busy':mark==='busy','aria-describedby':id+'-feedback',
        title:!mark?'初始为作者默认值或插件记录，尚未读取实际值':'选定即应用',
        style:{width:'100%',maxWidth:'100%',minWidth:0,boxSizing:'border-box',font:'inherit',opacity:state.canEdit?1:0.5},
        onChange:event=>{if(authorViewCurrent(event.currentTarget))void author.select(field.key,event.value,field,view);}},
        ...field.options.map((option,i)=>h('option',{key:i,value:String(i)},option.label))));
  }
  function AuthorText({field,state,view,visible,signal,id}) {
    const node=React.useRef(null);
    const editor=React.useMemo(()=>createNativeAuthorTextEditor({author,field,view,isCurrent:()=>!signal?.aborted&&authorViewCurrent(node.current)}),[field,view,signal]);
    const local=React.useSyncExternalStore(editor.subscribe,editor.read,editor.read),mark=state.marks[field.key];
    React.useEffect(()=>{const cancel=()=>editor.cancel();globalThis.addEventListener('blur',cancel);signal?.addEventListener('abort',cancel,{once:true});return()=>{globalThis.removeEventListener('blur',cancel);signal?.removeEventListener('abort',cancel);cancel();};},[editor,signal]);
    React.useEffect(()=>{if(!visible||!state.canEdit)editor.cancel();},[editor,visible,state.canEdit]);
    const keyInfo=event=>({key:event.key,isComposing:event.nativeEvent?.isComposing===true,keyCode:event.nativeEvent?.keyCode??event.keyCode});
    return h('div',{'data-whale-author-text':field.key,style:{display:'grid',gap:'6px',minWidth:0}},
      h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',minWidth:0}},h(AuthorName,{field,htmlFor:id}),
        h(AuthorFeedback,{field,mark,id:id+'-feedback'})),
      h('input',{id,ref:node,type:'text',value:local.text,autoComplete:'off',spellCheck:false,disabled:!state.canEdit,'data-whale-author-key':field.key,
        'aria-busy':mark==='busy','aria-invalid':local.error?true:undefined,'aria-describedby':[id+'-feedback',local.error?id+'-error':null].filter(Boolean).join(' '),
        title:'Enter或移开焦点后应用；Esc取消',style:{width:'100%',minWidth:0,boxSizing:'border-box',color:'inherit',font:'inherit',background:'transparent',border:'1px solid var(--dsw-alias-border-l2, #ffffff44)',borderRadius:'4px',padding:'6px'},
        onFocus:()=>editor.focus(),onPaste:()=>editor.paste(),onPointerDown:()=>editor.focus(),onChange:event=>editor.input(event.currentTarget.value),
        onCompositionStart:()=>editor.compositionStart(),onCompositionEnd:event=>editor.compositionEnd(event.currentTarget.value),
        onBlur:()=>{void editor.complete('blur');},onKeyDown:event=>{const action=editor.keyDown(keyInfo(event));if(action.prevent)event.preventDefault();if(action.stop)event.stopPropagation();},onKeyUp:event=>editor.keyUp(keyInfo(event))}),
      local.error?h('span',{id:id+'-error',role:'alert',style:{fontSize:'12px'}},local.error):null);
  }
  function AuthorSwitches({visible,signal,autoEligible=false}) {
    const state=React.useSyncExternalStore(author.subscribe,author.read,author.read),token=React.useRef(Symbol('author-view')).current,id=React.useId();
    const [confirmed,setConfirmed]=React.useState(false);
    React.useEffect(()=>{setConfirmed(false);},[state.recovery,visible]);
    React.useEffect(()=>{const remove=()=>author.remove(token);signal?.addEventListener('abort',remove,{once:true});return()=>{signal?.removeEventListener('abort',remove);remove();};},[token,signal]);
    React.useEffect(()=>{author.view(token,visible&&!signal?.aborted);},[token,visible,signal]);
    React.useEffect(()=>{if(visible&&autoEligible&&!signal?.aborted)void author.ensureLoaded?.();},[visible,autoEligible,signal,state.phase,state.busy,state.canRead]);
    return h('fieldset',{'data-whale-author-switches':true,'aria-label':'作者参数','aria-busy':state.busy,style:{border:0,padding:0,margin:'16px 0 0',minWidth:0,display:'grid',gap:'10px'}},
      h('legend',{'data-whale-author-heading':true},
        h('span',null,'作者参数'),
        h(InfoPopover,{name:'author-source',label:'作者参数说明',attributes:{'data-whale-author-source':true}},
          h('p',null,'这里显示作者默认值或本机记录，未读取壁纸实际值。修改后直接下发，无需额外保存。'),
          h('p',null,'重新读取只更新设置结构和本机记录，不读取壁纸实际值，不重复下发。')),
        h('button',{type:'button',className:'dsw-btn','data-whale-author-read':true,'data-whale-quiet':true,disabled:!state.canRead,'aria-busy':state.loading,
          'aria-label':state.loading?'正在读取作者参数':state.phase==='idle'?'读取作者参数':state.editing?'取消编辑并重新读取作者参数':state.phase==='blocked'&&!state.fields.length?'重试读取作者参数':'重新读取作者参数',
          title:state.editing?'取消未完成编辑后读取设置结构和本机记录；不读取壁纸实际值，不重复下发':'读取设置结构和本机记录；不读取壁纸实际值，不重复下发',
          onPointerDown:event=>{if(event.button===0)event.preventDefault();},onClick:()=>author.load()},state.loading?'…':state.phase==='idle'?'读取':state.editing?'取消编辑并重读':state.phase==='blocked'&&!state.fields.length?'重试读取':'↻')),
      ...state.fields.map(field=>field.type==='textinput'?h(AuthorText,{key:field.key,field,state,view:token,visible,signal,id:id+'-'+field.key}):field.type==='combo'?h(AuthorSelect,{key:field.key,field,state,view:token,id:id+'-'+field.key}):field.type==='color'?h(AuthorColor,{key:field.key,field,state,view:token,visible,signal,id:id+'-'+field.key}):field.type==='slider'?h(AuthorSlider,{key:field.key,field,state,view:token,visible,signal,id:id+'-'+field.key}):h('div',{key:field.key,'data-whale-author-bool-row':true,style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',minWidth:0}},
        h(AuthorName,{field,htmlFor:id+'-'+field.key}),h('span',{style:{display:'flex',alignItems:'center',gap:'6px'}},
          h(AuthorFeedback,{field,mark:state.marks[field.key],id:id+'-'+field.key+'-feedback'}),
          h('input',{id:id+'-'+field.key,type:'checkbox','data-whale-author-key':field.key,checked:state.values[field.key]===true,disabled:!state.canEdit,
            'aria-label':authorLabel(field),'aria-busy':state.marks[field.key]==='busy','aria-describedby':id+'-'+field.key+'-feedback',
            title:!state.marks[field.key]?'初始为作者默认值或插件记录，尚未读取实际值':state.marks[field.key]==='unknown'?'本轮修改结果未确认':'修改即应用',
            style:{accentColor:'var(--dsw-alias-brand-primary, #8c72f2)'},onChange:event=>author.change(field.key,event.currentTarget.checked)})))),
      state.phase==='ready'&&!state.fields.length?h('span',null,'暂无可直接应用的参数'):null,
      state.message?h('span',{role:'alert'},Object.values(state.marks).includes('unknown')&&state.message==='下发结果未确认，请观察后重新读取'?'本轮修改结果未确认，请观察画面后重新读取':state.message):null,
      state.recovery?h('div',{'data-whale-author-recovery':true,style:{display:'grid',gap:'8px',minWidth:0}},
        state.recovery.stale?h('span',null,'作者设置已变化，旧待处理记录已保留'):null,
        h('span',null,state.recovery.stale?`${state.recovery.keys.length}项旧参数记录`:`${state.recovery.keys.length}项待发送修改（${state.recovery.own?'本次修改':'其它或未确认来源'}）`),
        h('span',{style:{fontSize:'12px',overflowWrap:'anywhere'}},state.recovery.labels.join('、')),
        h('span',{role:'status'},state.recovery.pending?'命令仍待结束，请稍后重新读取':state.recovery.unknown?'可能已发送，请先观察画面':'这些修改尚未发送'),
        !state.recovery.pending?h('details',null,h('summary',null,state.recovery.stale?'处理旧结构记录':'清除待发送记录'),
          h('label',{style:{display:'flex',gap:'8px',alignItems:'center'}},h('input',{type:'checkbox','data-whale-author-discard-confirm':true,checked:confirmed,disabled:!state.canDiscard,onChange:event=>setConfirmed(event.currentTarget.checked)}),
            state.recovery.stale?(state.recovery.unknown?'我已观察画面，确认清除旧记录并刷新，不回退壁纸':'确认清除旧记录并刷新，不改变壁纸'):state.recovery.unknown?'我已观察画面，确认仅清除记录，不回退壁纸':'确认仅清除记录，不改变壁纸'),
          h('button',{type:'button',className:'dsw-btn','data-whale-author-discard':true,disabled:!confirmed||!state.canDiscard,onClick:event=>{if(!state.recovery.stale||authorViewCurrent(event.currentTarget))void author.discard({confirm:confirmed,observed:confirmed,expected:state.recovery,view:token});}},state.recovery.stale?'清除旧记录并刷新':'确认清除记录')):null):null,
      null);
  }
  function Body(props) {
    if(editorGate){const state=React.useSyncExternalStore(editorGate.subscribe,editorGate.getSnapshot,editorGate.getSnapshot);
      if(!state.nativeAllowed)return h('div',{'data-whale-native-suspended':true,role:'status',style:{padding:'16px'}},state.message??'旧外观窗口尚未关闭');}
    return h(EditorBody,props);
  }
  function Group({title,children}) {
    return h('fieldset',{'data-whale-control-group':title},h('legend',null,title),...(Array.isArray(children)?children:children==null?[]:[children]));
  }
  function Fold({title,name,error,children}) {
    const [open,setOpen]=React.useState(false);
    React.useEffect(()=>{if(error)setOpen(true);},[error]);
    return h('details',{'data-whale-fold':name,open,onToggle:event=>setOpen(event.currentTarget.open)},
      h('summary',null,title,error?h('span',{'aria-label':'此组有问题','data-whale-group-error':true},' !'):null),
      h('div',{'data-whale-fold-body':true},...(Array.isArray(children)?children:children==null?[]:[children])));
  }
  // Commands reuse their existing tickets. Opening/dismissing this menu never invokes a command.
  function ActionMenu({name,label,text='⋯',scope=null,entries=[],description=null,attributes={},disabled=false}) {
    if(description)entries=[{key:'dismiss',label:'关闭说明'}];
    const trigger=React.useRef(null),popup=React.useRef(null),session=React.useRef(null),latest=React.useRef(null);
    const [open,setOpen]=React.useState(false),uid=React.useId();
    const context=()=>{const v=api.getSnapshot(),owner=trigger.current?.closest?.('[data-whale-native-sidebar]');return JSON.stringify([right.mounted.getSnapshot(),v.activeId,v.selectedId,v.playGeneration,v.theme,v.activeTheme,v.backgroundMode,v.authorContext,v.state,owner?.dataset.whaleSettingsPage,owner?.dataset.whaleGalleryOpen]);};
    const signature=JSON.stringify([!!description,disabled,entries.map(e=>[e.key,e.label,e.disabled])]);
    latest.current={entries,signature,scope};
    const close=(focus=false,notify=true)=>{
      session.current=null;if(openChoice?.token===trigger)openChoice=null;
      try{if(popup.current?.matches(':popover-open'))popup.current.hidePopover();}catch{}
      if(notify)setOpen(false);if(focus)trigger.current?.focus();
    };
    const admissible=()=>{const node=trigger.current,owner=node?.closest?.('[data-whale-native-sidebar]');
      if(disabled||author?.read?.().editing||node?.isConnected===false||owner?.hidden||node?.closest?.('[data-tab-id]')?.hidden||node?.closest?.('[data-whale-page-panel]')?.hidden)return false;
      try{if(typeof right.focusedTarget==='function'&&right.focusedTarget(node)===undefined)return false;}catch{return false;}return true;};
    const valid=()=>session.current&&admissible()&&session.current.context===context()&&session.current.signature===latest.current.signature&&session.current.scope===latest.current.scope;
    const place=()=>{const node=trigger.current,list=popup.current;if(!node?.getBoundingClientRect||!list)return;
      const rect=node.getBoundingClientRect(),win=node.ownerDocument.defaultView,w=win.innerWidth,h=win.innerHeight;
      const owner=node.closest('[data-whale-native-sidebar]')?.getBoundingClientRect(),leftEdge=Math.max(8,(owner?.left??0)+8),rightEdge=Math.min(w-8,(owner?.right??w)-8);
      const width=Math.max(0,Math.min(description?300:220,rightEdge-leftEdge)),below=Math.max(0,h-rect.bottom-12),above=Math.max(0,rect.top-12),up=below<Math.min(160,list.scrollHeight)&&above>below;
      Object.assign(list.style,{position:'fixed',inset:'auto',margin:'0',left:Math.max(leftEdge,Math.min(rect.right-width,rightEdge-width))+'px',width:width+'px',maxHeight:Math.min(240,up?above:below)+'px',top:up?'auto':Math.max(8,rect.bottom+4)+'px',bottom:up?Math.max(8,h-rect.top+4)+'px':'auto'});};
    const focusItem=(last=false)=>{const items=[...(popup.current?.querySelectorAll('button:not(:disabled)')??[])];(last?items.at(-1):items[0])?.focus();};
    const begin=()=>{if(!admissible())return;openChoice?.close();trigger.current?.focus();session.current={context:context(),signature,scope};openChoice={token:trigger,close:()=>close()};setOpen(true);
      try{popup.current?.showPopover();}catch{close();return;}place();};
    const choose=key=>{const entry=latest.current.entries.find(e=>e.key===key);if(!valid()||!entry||entry.disabled){close();return;}close(true);return entry.action?.();};
    React.useEffect(()=>{if(open&&!valid())close();});
    React.useEffect(()=>{if(!open)return;const node=trigger.current,list=popup.current,doc=node?.ownerDocument,win=doc?.defaultView;if(!doc||!win)return;
      place();if(description){list.scrollTop=0;list.focus({preventScroll:true});}else focusItem();
      const outside=e=>{if(!node.contains(e.target)&&!list.contains(e.target))close();};
      const hidden=()=>{if(doc.hidden)close();},blur=()=>close();
      doc.addEventListener('pointerdown',outside,true);doc.addEventListener('focusin',outside,true);doc.addEventListener('visibilitychange',hidden);doc.addEventListener('scroll',place,true);win.addEventListener('resize',place);win.addEventListener('blur',blur);
      const observer=typeof ResizeObserver==='function'?new ResizeObserver(place):null;observer?.observe(node);observer?.observe(list);
      return()=>{doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('focusin',outside,true);doc.removeEventListener('visibilitychange',hidden);doc.removeEventListener('scroll',place,true);win.removeEventListener('resize',place);win.removeEventListener('blur',blur);observer?.disconnect();};
    },[open]);
    React.useEffect(()=>()=>close(false,false),[]);
    return h('span',{...attributes,'data-whale-action-menu':name,'data-whale-object-more':name==='object'?true:undefined,'data-whale-media-more':name==='object'?undefined:name},
      h('button',{ref:trigger,type:'button',disabled,'data-whale-menu-trigger':name,'data-whale-quiet':true,'aria-label':label,title:label,'aria-haspopup':description?'dialog':'menu','aria-expanded':open,'aria-controls':uid,
        onPointerDown:e=>{if(e.button===0)e.preventDefault();},onClick:()=>open?close(true):begin(),onKeyDown:e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(!open)begin();else focusItem(e.key==='ArrowUp');}else if(e.key==='Escape'&&open){e.preventDefault();close(true);}}},text),
      h('div',{ref:popup,id:uid,popover:'manual',role:description?'dialog':'menu',tabIndex:description?-1:undefined,'aria-describedby':description?uid+'-help':undefined,'aria-modal':description?'false':undefined,'aria-label':label,'data-whale-action-menu-popup':name,onKeyDown:e=>{
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}else if(e.key==='Tab'){close(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...popup.current.querySelectorAll('button:not(:disabled)')],at=items.indexOf(e.target);(e.key==='Home'?items[0]:e.key==='End'?items.at(-1):items[(at+(e.key==='ArrowUp'?-1:1)+items.length)%items.length])?.focus();}}},
        description?h('div',{id:uid+'-help','data-whale-help-content':true},description):null,
        ...entries.map(entry=>h('button',{...entry.attributes,key:entry.key,type:'button',role:description?'button':'menuitem',tabIndex:-1,disabled:entry.disabled,'data-danger':entry.danger?'true':undefined,
          onPointerDown:e=>{if(e.button===0)e.preventDefault();},onClick:()=>choose(entry.key)},entry.label))));
  }
  function PlaybackHeader({view,viewToken,sourceErrorId,showGallery,hideGallery,visible}) {
    const openedByPointer=React.useRef(false);
    if(['image','video'].includes(view.backgroundMode)){
      const media=view.backgroundMode==='image'?view.imageInfo:view.videoInfo;
      return h('header',{'data-whale-playback-header':true},
        h('div',{'data-whale-object-title':true},media?.name||(view.backgroundMode==='image'?'本地图片':'本地视频')));
    }
    const closeButton=()=>h('button',{type:'button','data-whale-close-wallpaper':true,disabled:!view.canCloseWallpaper,
      'aria-busy':view.sourceBusy,'aria-describedby':view.backgroundEnableError?sourceErrorId:undefined,
      onClick:()=>api.closeWallpaper(view.closeWallpaperTicket,viewToken)},view.closeWallpaperLabel);
    const recoveryClose=view.showCloseWallpaper&&view.closeWallpaperAction!=='prepare';
    return h('header',{'data-whale-playback-header':true},
      h('div',{'data-whale-object-row':true},h('div',{'data-whale-current-object':true},
        h('div',{'data-whale-object-preview':view.objectPreview?.id??'', 'aria-hidden':true},
          view.objectPreview?h(Preview,{row:view.objectPreview,visible,version:view.galleryVersion}):h('span',{'data-whale-preview-placeholder':true})),
        h('div',{'data-whale-object-summary':true},
          h('div',{'data-whale-object-title':true,title:view.activeId?view.title:view.selectedTitle},view.state==='unknown'?'壁纸状态待确认':view.activeId?view.title:view.selectedTitle),
          h('span',{'data-whale-object-status':true,'data-playing':['stop','switch'].includes(view.playAction)&&!view.playBusy?'true':'false','aria-live':'polite'},view.playBusy?view.playLabel:view.showEnableWallpaper?'背景已关闭':view.statusLabel))),
      h('div',{'data-whale-header-actions':true},
        view.showEnableWallpaper?h('button',{type:'button','data-whale-playback-action':'enable-background','data-whale-enable-wallpaper':true,
          disabled:!view.canEnableWallpaper,'aria-busy':view.sourceBusy,'aria-describedby':view.backgroundEnableError?sourceErrorId:undefined,
          title:'启用后仍需手动开始播放','aria-label':view.sourceBusy?'正在启用…':'启用壁纸背景',onClick:()=>api.enableWallpaper(view.enableWallpaperTicket,viewToken)},h('span',{'aria-hidden':true},'+')):
          h('button',{type:'button','data-whale-playback-action':view.playAction,'data-whale-playback-recovery':view.state==='cleanup-failed'?'true':undefined,disabled:!view.canPlay,'aria-busy':view.playBusy,
            'aria-describedby':view.backgroundEnableError?sourceErrorId:undefined,'aria-label':view.playLabel,title:view.playLabel,
            onClick:()=>api.play(view.playAction,view.selectedId,view.playMode,view.activeId,view.playGeneration)},view.state==='cleanup-failed'?null:h('svg',{'data-whale-play-icon':true,'aria-hidden':true,viewBox:'0 0 16 16'},h('path',{d:view.playAction==='stop'?'M3 3h10v10H3z':'M4 2l10 6-10 6z'})),view.state==='cleanup-failed'?view.playLabel:view.playBusy?'处理中':view.playAction==='stop'?'停止':'播放'),
        view.playAction==='switch'?h('button',{type:'button','data-whale-stop-current':true,'data-whale-quiet':true,disabled:!view.canStopActive,
          'aria-label':'停止当前播放',title:'停止当前播放',onClick:()=>api.stopActive(view.activeId,view.playGeneration)},'停止'):null,
        h('button',{type:'button','data-whale-change-wallpaper':true,'data-whale-quiet':true,'aria-expanded':view.galleryOpen,
          onPointerDown:event=>{if(event.button===0){openedByPointer.current=!view.galleryOpen;if(openedByPointer.current)showGallery();}},onPointerCancel:()=>{openedByPointer.current=false;},
          onClick:event=>{const opened=openedByPointer.current;openedByPointer.current=false;if(event.detail>0&&opened)return;if(view.galleryOpen)hideGallery();else showGallery();},
          'aria-label':view.galleryOpen?'壁纸参数':'更换壁纸',title:view.galleryOpen?'壁纸参数':'更换壁纸'},view.galleryOpen?'壁纸参数':'更换'),
        view.showCloseWallpaper&&!recoveryClose?h(ActionMenu,{name:'object',label:'壁纸更多操作',scope:view.closeWallpaperTicket,entries:[{key:'close',label:view.closeWallpaperLabel,disabled:!view.canCloseWallpaper,attributes:{'data-whale-close-wallpaper':true,'aria-busy':view.sourceBusy},action:()=>api.closeWallpaper(view.closeWallpaperTicket,viewToken)}]}):null)),
      recoveryClose?h('div',{'data-whale-close-recovery':true},closeButton()):null,
      view.activeId&&view.activeId!==view.selectedId?h('div',{'data-whale-selected-target':true},`所选：${view.selectedTitle}`):null,
      view.backgroundEnableError?h('span',{id:sourceErrorId,'data-whale-background-error':true,role:'alert'},view.backgroundEnableError):null,
      view.catalogLoading?h('p',{'data-whale-catalog-loading':true,role:'status'},'正在读取壁纸目录…'):
        view.catalogError?h('div',{'data-whale-catalog-error':true},h('span',{role:'status'},view.catalogError),
          h('button',{type:'button','data-whale-quiet':true,'aria-label':'重试加载壁纸目录',onClick:()=>api.retryCatalog()},'重试')):null,
      view.playHint&&!view.catalogLoading&&!view.catalogError?h('p',{'data-whale-playback-hint':true,role:view.state==='cleanup-failed'?'alert':'status'},view.playHint):null);
  }
  function EditorBody({useTabInfo}) {
    const {tab}=useTabInfo();
    const viewToken=React.useRef(Symbol('whale-header-view')).current;
    const contentToken=React.useRef(Symbol('whale-content-view')).current;
    const rootNode=React.useRef(null),sectionRef=React.useRef('wallpaper');
    const [section,setSection]=React.useState('wallpaper');
    const sourceErrorId=React.useId(),sectionId=React.useId();
    const view=React.useSyncExternalStore(api.subscribe,api.getSnapshot,api.getSnapshot);
    const wallpaperVisible=tab.visible===true&&section==='wallpaper'&&!view.galleryOpen;
    React.useEffect(()=>{
      const removeHeader=api.registerView(viewToken,tab.signal),removeContent=api.registerView(contentToken,tab.signal);
      return()=>{removeContent();removeHeader();};
    },[viewToken,contentToken,tab.signal]);
    React.useEffect(()=>{api.viewVisible(viewToken,tab.visible);},[viewToken,tab.visible]);
    React.useEffect(()=>{api.viewVisible(contentToken,wallpaperVisible);},[contentToken,wallpaperVisible]);
    function selectSection(next){
      if(!['wallpaper','interface'].includes(next)||sectionRef.current===next)return;
      sectionRef.current=next;
      if(rootNode.current)rootNode.current.dataset.whaleSettingsPage=next;
      api.viewVisible(contentToken,tab.visible===true&&next==='wallpaper'&&!api.getSnapshot().galleryOpen);
      setSection(next);
    }
    function hideGallery(){selectSection('wallpaper');api.showGallery(false);}
    function showGallery(){
      selectSection('wallpaper');
      if(api.getSnapshot().galleryOpen)return;
      if(rootNode.current)rootNode.current.dataset.whaleGalleryOpen='true';
      api.viewVisible(contentToken,false);api.showGallery(true);
    }
    const sectionButton=(key,label)=>h('button',{type:'button',role:'tab',id:sectionId+'-'+key,
      'data-whale-settings-section':key,'aria-selected':section===key,'aria-controls':sectionId+'-'+key+'-panel',tabIndex:section===key?0:-1,
      onPointerDown:event=>{if(event.button===0)selectSection(key);},onClick:()=>selectSection(key),
      onKeyDown:event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();const next=event.key==='Home'?'wallpaper':event.key==='End'?'interface':key==='wallpaper'?'interface':'wallpaper';
        selectSection(next);event.currentTarget.parentElement?.querySelector('[data-whale-settings-section="'+next+'"]')?.focus();}},label);
    return h('section',{ref:rootNode,'data-whale-native-sidebar':true,'data-tab-id':tab.id,'data-whale-settings-page':section,
      'data-whale-gallery-open':String(view.galleryOpen),'aria-label':'Whale 外观',style:{color:'var(--dsw-alias-label-primary)',minWidth:0}},
      h('style',{'data-whale-native-controls-style':true},NATIVE_APPEARANCE_CONTROLS_CSS),
      h('div',{'data-whale-settings-navigation':true,role:'tablist','aria-label':'外观分区'},sectionButton('wallpaper','壁纸'),sectionButton('interface','界面')),
      h(PlaybackHeader,{view,viewToken,sourceErrorId,showGallery,hideGallery,visible:tab.visible===true}),
      h('div',{key:view.galleryOpen?'gallery':'details','data-whale-page-panel':'wallpaper',role:'tabpanel',id:sectionId+'-wallpaper-panel',
        'aria-labelledby':sectionId+'-wallpaper',hidden:section!=='wallpaper'},
        view.galleryOpen?h(Gallery,{view,visible:tab.visible===true&&section==='wallpaper'}):h(React.Fragment,null,
          view.authorContext?h(AuthorSwitches,{visible:wallpaperVisible,signal:tab.signal,autoEligible:view.state==='playing'}):null,
      view.showLocalImage?h(LocalMedia,{kind:'image',view,token:contentToken}):null,
      view.showLocalVideo?h(LocalMedia,{kind:'video',view,token:contentToken}):null,
      h(Group,{title:'画面效果'},
        h(RangeControl,{setting:'brightness',label:'亮度',hint:'100%为原始亮度',value:view.brightness,view}),
        h(RangeControl,{setting:'mask',label:'遮罩',hint:'数值越大，主题底色覆盖越强',value:view.mask,view}),
        h(RangeControl,{setting:'blur',label:'背景模糊',hint:'只影响背景画面，0px不模糊',value:view.blur,view})),
      h(Group,{title:'界面透出'},
        h(RangeControl,{setting:'surface',label:'界面不透明度',hint:'数值越低，侧栏和卡片透出越多；菜单与输入卡片保持可读',value:view.surface,view}),
        h(RangeControl,{setting:'chatBackdrop',label:'聊天底色',hint:'0%保留壁纸，100%使用主题实色；不包含在壁纸预设中',value:view.chatBackdrop,view})),
      ['image','video'].includes(view.backgroundMode)?null:h(PlaybackOptions,{view}),
      h(PresetControl,{view,token:contentToken,visible:wallpaperVisible})),
        view.galleryOpen&&view.catalogError?h('div',{role:'status'},view.catalogError,h('button',{type:'button',onClick:()=>api.retryCatalog()},'重试')):null),
      h('div',{'data-whale-page-panel':'interface',role:'tabpanel',id:sectionId+'-interface-panel',
        'aria-labelledby':sectionId+'-interface',hidden:section!=='interface'},
        h('section',{'data-whale-interface-controls':true},
          h(Group,{title:'主题与配色'},h(ThemeControl,{view}),h(PaletteControl,{view}),h(AccentControl,{view})),
          h(Group,{title:'文字'},h(ReadabilityControl,{view})),
          h(Fold,{name:'interface',title:'更多外观',error:view.opaqueSidebarError||view.sidebarError||view.canvasError||view.glassError},
            h(OpaqueSidebarControl,{view}),h(SidebarDepthControl,{view}),h(CanvasDepthControl,{view}),h(GlassControl,{view})))));
  }
  function Title() {return h('span',{'data-whale-sidebar-title':true,title:'Whale 外观','aria-label':'Whale 外观'},'外观');}
  function Trigger() {
    const view=React.useSyncExternalStore(api.subscribe,api.getSnapshot,api.getSnapshot);
    return h('span',null,h('button',{type:'button',id:'whale-appearance-header-btn','data-whale-native-trigger':true,disabled:!view.canOpen,
      className:'dsw-btn dsw-header-action-btn',title:!view.canOpen?'请先打开一个会话':'打开Whale外观侧栏',onClick:()=>api.open()},'Whale 外观'),
      h('style',{'data-whale-native-trigger-style':true},NATIVE_APPEARANCE_TRIGGER_CSS),view.error ? h('span',{role:'alert'},view.error) : null);
  }
  api.Body=Body;api.Title=Title;api.Trigger=Trigger;
  // Install transactionally: failed later registration unwinds earlier registrations/subscriptions.
  try {
    refresh();
    releases.push(ctx.sidebarRightTabs.register({id,kind,title:()=> 'Whale 外观'}));
    releases.push(ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:id},Body)));
    releases.push(ctx.slots.inject('sidebar.right.pane.tab.title',()=>ctx.slots.register({name:'sidebar.right.pane.tab.title',key:id},Title)));
    releases.push(controller.subscribeSettings(refresh));
    if(typeof controller.media?.subscribe==='function')releases.push(controller.media.subscribe(refresh));
    if(typeof controller.presets?.subscribe==='function')releases.push(controller.presets.subscribe(refresh));
    releases.push(controller.wallpaper.subscribeStatus(refresh));
    if(typeof controller.wallpaper.subscribeCloseFence==='function')releases.push(controller.wallpaper.subscribeCloseFence(refresh));
    if(typeof controller.wallpaper.subscribeLibrary==='function')releases.push(controller.wallpaper.subscribeLibrary(refresh));
    releases.push(transport.subscribe(refresh));
    releases.push(catalogRead.subscribe(refresh));
    if(typeof ctx.on==='function')releases.push(ctx.on('theme/change',refresh));
    if(editorGate)releases.push(editorGate.subscribe(()=>{if(!admitted())catalogRead.cancel();refresh();}));
    releases.push(right.mounted.subscribe(()=>{failure=null;catalogRead.cancel();refresh();}));
  } catch(error) {dispose();throw error;}
  return Object.freeze(api);
}

/** Keep sidebar provider replacement local: never make the whole theme/player depend on it. */
export function attachNativeAppearanceSidebar({ctx,React,controller,playbackOptions,catalogOptions,loadPreview,previewOptions,requestAuthor,validateValue,editorGate=null}) {
  const listeners=new Set();
  const playback=createNativePlaybackGate(playbackOptions);
  const author=typeof requestAuthor==='function'?createNativeAuthorSwitches({request:requestAuthor,validateValue}):null;
  let disposed=false,active=null;
  let snapshot=Object.freeze({ready:false,canOpen:false,error:null});
  function publish() {
    if(disposed)return;
    const current=active?.getSnapshot();
    const gate=editorGate?.getSnapshot();
    const next={ready:active!==null,canOpen:current?.canOpen===true&&(!gate||gate.canRequestNative),error:gate?.message??current?.error??null};
    if(Object.keys(next).every(key=>Object.is(next[key],snapshot[key])))return;
    snapshot=Object.freeze(next);
    for(const fn of [...listeners])fn();
  }
  const api={
    getSnapshot:()=>snapshot,
    subscribe(fn){if(disposed)return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},
    open(){if(disposed)return{ok:false,error:'disposed'};return active?.open()??{ok:false,error:'native-sidebar-unavailable'};},
    async dispose(){if(disposed)return;disposed=true;offGate?.();listeners.clear();playback.dispose();author?.dispose();await dependency.dispose();},
  };
  const offGate=editorGate?.subscribe(publish);
  const dependency=ctx.inject(['sidebarRightTabs','sidebarRight'],child=>{
    if(disposed)return;
    const instance=createNativeAppearanceSidebar({ctx:child,React,controller,playback,catalogOptions,loadPreview,previewOptions,author,editorGate});
    active=instance;
    const off=instance.subscribe(()=>{if(active===instance)publish();});
    publish();
    child.effect(()=>()=>{
      off();
      if(active===instance){active=null;publish();}
      instance.dispose();
    },'whale: native sidebar dependency generation');
  });
  function Trigger(){
    const state=React.useSyncExternalStore(api.subscribe,api.getSnapshot,api.getSnapshot);
    return React.createElement('span',null,React.createElement('button',{
      type:'button',id:'whale-appearance-header-btn','data-whale-native-trigger':true,className:'dsw-btn dsw-header-action-btn',disabled:!state.canOpen,
      title:state.error??(!state.ready?'外观侧栏尚未就绪':!state.canOpen?'请先打开一个会话':'打开Whale外观侧栏'),
      onClick:()=>api.open(),
    },'Whale 外观'),React.createElement('style',{'data-whale-native-trigger-style':true},NATIVE_APPEARANCE_TRIGGER_CSS),state.error?React.createElement('span',{role:'alert'},state.error):null);
  }
  return Object.freeze({...api,Trigger});
}
