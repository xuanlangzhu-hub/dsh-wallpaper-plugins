/**
 * Whale Companion Window Application Logic.
 *
 * Browser-safe module for the standalone Edge companion window.
 * - Imports solely from detachable-contract.js (zero Node or CDN dependencies).
 * - Single-use token burned on connect and immediately scrubbed from address bar.
 * - Controls:
 *   - 4 Visual fields: brightness (20-120), mask (0-90), blur (0-24), surface (40-100)
 *   - Interface fields: theme (mist/abyss), palette, textContrast, chatBackdrop (0-100), accentMode, accentColor
 *   - 4-Field Presets: save, apply, remove with strict authoritative gating
 * - Real-time dragging projection and monotonic snapshot synchronization.
 * - Orderly docking, closing, and disconnect handling.
 */

import {
  createHttpCompanionTransport,
  createCompanionClient,
  RANGE_BOUNDS,
  ALLOWED_ENUMS,
  HEX_COLOR_PATTERN,
  DETACHABLE_ACTIONS,
  DETACHABLE_MODES,
  isSceneId,
} from '../detachable-contract.js';

import {createAuthorPanel} from '../wallpaper/author-properties-panel.js';

export function createCompanionApp({
  windowObj = (typeof window !== 'undefined' ? window : null),
  documentObj = (typeof document !== 'undefined' ? document : null),
  customTransport = null,
  actionTimeoutMs = 5000,
} = {}) {
  if (!windowObj || !documentObj) return null;

  const urlParams = new URLSearchParams(windowObj.location.search);
  const token = urlParams.get('token');
  const instanceId = urlParams.get('instanceId');

  // Immediately scrub token and credentials from browser URL bar and history
  if (windowObj.history && typeof windowObj.history.replaceState === 'function') {
    try {
      windowObj.history.replaceState({}, documentObj.title, windowObj.location.pathname);
    } catch {}
  }

  // Header & Status elements
  const statusPill = documentObj.getElementById('status-pill');
  const statusText = documentObj.getElementById('status-text');
  const errorBanner = documentObj.getElementById('error-banner');

  // Navigation & View Switcher Elements (Narrow mode)
  const tabBtnGallery = documentObj.getElementById('tab-btn-gallery');
  const tabBtnDetails = documentObj.getElementById('tab-btn-details');
  const columnGallery = documentObj.getElementById('column-gallery');
  const columnDetails = documentObj.getElementById('column-details');
  const btnBackToGallery = documentObj.getElementById('btn-back-to-gallery');

  // Gallery Elements
  const galleryCountBadge = documentObj.getElementById('gallery-count-badge');
  const btnRefreshCatalog = documentObj.getElementById('btn-refresh-catalog');
  const galleryNotice = documentObj.getElementById('gallery-notice');
  const wallpaperCardGrid = documentObj.getElementById('wallpaper-card-grid');
  const filterRatingEveryone = documentObj.getElementById('filter-rating-everyone');
  const filterRatingQuestionable = documentObj.getElementById('filter-rating-questionable');
  const filterRatingMature = documentObj.getElementById('filter-rating-mature');

  // Details Elements
  const detailsPreviewPlaceholder = documentObj.getElementById('details-preview-placeholder');
  const detailsPreviewImg = documentObj.getElementById('details-preview-img');
  const detailsTitle = documentObj.getElementById('details-title');
  const badgeDetailsType = documentObj.getElementById('badge-details-type');
  const badgeDetailsStatus = documentObj.getElementById('badge-details-status');
  const badgeDetailsPlaying = documentObj.getElementById('badge-details-playing');
  const badgeDetailsSelected = documentObj.getElementById('badge-details-selected');
  const detailsPlaybackText = documentObj.getElementById('details-playback-text');
  const detailsMismatchBanner = documentObj.getElementById('details-mismatch-banner');
  const btnStartWallpaper = documentObj.getElementById('btn-start-wallpaper');
  const btnStopWallpaper = documentObj.getElementById('btn-stop-wallpaper');
  const selectPlaybackMode = documentObj.getElementById('select-playback-mode');
  const checkboxAutoStart = documentObj.getElementById('checkbox-we-autostart');

  // Visual Adjustment Elements
  const visualTargetNotice = documentObj.getElementById('visual-target-notice');
  const sliderBrightness = documentObj.getElementById('slider-brightness');
  const inputBrightness = documentObj.getElementById('input-brightness');
  const sliderMask = documentObj.getElementById('slider-mask');
  const inputMask = documentObj.getElementById('input-mask');
  const sliderBlur = documentObj.getElementById('slider-blur');
  const inputBlur = documentObj.getElementById('input-blur');
  const sliderSurface = documentObj.getElementById('slider-surface');
  const inputSurface = documentObj.getElementById('input-surface');

  // Interface Elements
  const btnThemeMist = documentObj.getElementById('btn-theme-mist');
  const btnThemeAbyss = documentObj.getElementById('btn-theme-abyss');
  const btnPaletteOcean = documentObj.getElementById('btn-palette-ocean');
  const btnPaletteGraphite = documentObj.getElementById('btn-palette-graphite');
  const btnPaletteViolet = documentObj.getElementById('btn-palette-violet');
  const btnPaletteJade = documentObj.getElementById('btn-palette-jade');
  const btnContrastStandard = documentObj.getElementById('btn-contrast-standard');
  const btnContrastEnhanced = documentObj.getElementById('btn-contrast-enhanced');
  const sliderChatBackdrop = documentObj.getElementById('slider-chatBackdrop');
  const inputChatBackdrop = documentObj.getElementById('input-chatBackdrop');
  const btnAccentTheme = documentObj.getElementById('btn-accent-theme');
  const btnAccentCustom = documentObj.getElementById('btn-accent-custom');
  const inputAccentColor = documentObj.getElementById('input-accent-color');
  const textAccentHex = documentObj.getElementById('text-accent-hex');
  const accentColorPickerWrap = documentObj.getElementById('accent-color-picker-wrap');

  // Presets Elements
  const presetTargetTitle = documentObj.getElementById('preset-target-title');
  const presetStatusText = documentObj.getElementById('preset-status-text');
  const presetHint = documentObj.getElementById('preset-hint');
  const btnPresetSave = documentObj.getElementById('btn-preset-save');
  const btnPresetApply = documentObj.getElementById('btn-preset-apply');
  const btnPresetDelete = documentObj.getElementById('btn-preset-delete');

  // Footer Actions
  const btnDock = documentObj.getElementById('btn-dock');
  const btnClose = documentObj.getElementById('btn-close');

  let client = null;
  const authorRoot=documentObj.getElementById('author-properties-panel');
  const authorPanel=authorRoot ? createAuthorPanel({root:authorRoot,documentObj,request:(...args)=>client.requestAuthor(...args)}) : null;
  let isConnected = false;
  let currentSnapshot = null;
  let targetSceneId = 'lucy';
  let activeTab = 'gallery';
  const MAX_BLOB_URLS = 64;
  const blobUrls = new Map();
  const inFlightBlobs = new Map();
  let detailsEpoch = 0;
  let isDisposed = false;
  let previousDetailsSceneId = null;
  let previousScannedAt = null;
  let previousAllowedRatingsKey = null;
  let currentConnectionEpoch = 0;
  let currentCatalogEpoch = 0;
  let currentFilterEpoch = 0;
  let inFlightInstanceCounter = 0;

  const AGE_RATINGS = Object.freeze(['Everyone', 'Questionable', 'Mature']);
  const DEFAULT_AGE_RATINGS = Object.freeze(['Everyone']);

  function parseAgeRatings(strOrArr) {
    if (Array.isArray(strOrArr)) {
      if (strOrArr.length === 0) return [];
      const allValid = strOrArr.every(r => typeof r === 'string' && AGE_RATINGS.includes(r));
      if (!allValid) return [...DEFAULT_AGE_RATINGS];
      const filtered = [...new Set(strOrArr)];
      filtered.sort((a, b) => AGE_RATINGS.indexOf(a) - AGE_RATINGS.indexOf(b));
      return filtered;
    }
    if (typeof strOrArr === 'string') {
      const trimmed = strOrArr.trim();
      if (trimmed === '') return [];
      const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return [...DEFAULT_AGE_RATINGS];
      const allValid = parts.every(r => AGE_RATINGS.includes(r));
      if (!allValid) return [...DEFAULT_AGE_RATINGS];
      const filtered = [...new Set(parts)];
      filtered.sort((a, b) => AGE_RATINGS.indexOf(a) - AGE_RATINGS.indexOf(b));
      return filtered;
    }
    return [...DEFAULT_AGE_RATINGS];
  }

  function formatAgeRatings(arr) {
    if (!Array.isArray(arr)) return 'Everyone';
    if (arr.length === 0) return '';
    const allValid = arr.every(r => typeof r === 'string' && AGE_RATINGS.includes(r));
    if (!allValid) return 'Everyone';
    const filtered = [...new Set(arr)];
    filtered.sort((a, b) => AGE_RATINGS.indexOf(a) - AGE_RATINGS.indexOf(b));
    return filtered.join(',');
  }

  const MAX_STALE_RETRIES = 3;
  const actionQueue = [];
  let activeInFlight = null;
  let actionIdGen = 0;
  let workerRunning = false;

  function settleItem(item, result) {
    if (!item || item.settled) return;
    item.settled = true;
    if (item.abortController && !item.abortController.signal.aborted) {
      try { item.abortController.abort(); } catch {}
    }
    if (item.resolve) {
      item.resolve(result);
    }
  }

  function hasPendingOrInFlight(key) {
    if (activeInFlight && activeInFlight.kind === 'setting' && activeInFlight.key === key && !activeInFlight.settled) {
      return true;
    }
    for (const item of actionQueue) {
      if (item.kind === 'setting' && item.key === key && !item.settled) {
        return true;
      }
    }
    return false;
  }

  function getLatestPendingOrInFlightValue(key) {
    for (let i = actionQueue.length - 1; i >= 0; i--) {
      const item = actionQueue[i];
      if (item.kind === 'setting' && item.key === key && !item.settled) {
        return item.value;
      }
    }
    if (activeInFlight && activeInFlight.kind === 'setting' && activeInFlight.key === key && !activeInFlight.settled) {
      return activeInFlight.value;
    }
    return undefined;
  }

  function cancelRemainingQueue(reason) {
    if (activeInFlight) {
      settleItem(activeInFlight, { ok: false, error: reason });
    }
    for (const item of actionQueue) {
      settleItem(item, { ok: false, error: reason });
    }
    actionQueue.length = 0;
  }

  function setStatus(state, message) {
    if (!statusPill || !statusText) return;
    statusPill.className = `status-pill status-${state}`;
    statusText.textContent = message;
  }

  function showError(msg) {
    if (!errorBanner) return;
    if (!msg) {
      errorBanner.textContent = '';
      errorBanner.classList.add('hidden');
    } else {
      errorBanner.textContent = msg;
      errorBanner.classList.remove('hidden');
    }
  }

  function setControlsEnabled(enabled) {
    const allInputs = [
      sliderBrightness, inputBrightness,
      sliderMask, inputMask,
      sliderBlur, inputBlur,
      sliderSurface, inputSurface,
      sliderChatBackdrop, inputChatBackdrop,
      inputAccentColor,
      filterRatingEveryone, filterRatingQuestionable, filterRatingMature,
      selectPlaybackMode, checkboxAutoStart,
    ];
    for (const el of allInputs) {
      if (el) el.disabled = !enabled;
    }

    const allButtons = [
      btnThemeMist, btnThemeAbyss,
      btnPaletteOcean, btnPaletteGraphite, btnPaletteViolet, btnPaletteJade,
      btnContrastStandard, btnContrastEnhanced,
      btnAccentTheme, btnAccentCustom,
      btnDock, btnClose,
      btnRefreshCatalog,
    ];
    for (const el of allButtons) {
      if (el) el.disabled = !enabled;
    }

    if (!enabled) {
      if (btnPresetSave) btnPresetSave.disabled = true;
      if (btnPresetApply) btnPresetApply.disabled = true;
      if (btnPresetDelete) btnPresetDelete.disabled = true;
      if (btnStartWallpaper) btnStartWallpaper.disabled = true;
      if (btnStopWallpaper) btnStopWallpaper.disabled = true;
    } else if (currentSnapshot) {
      updatePresetsView(currentSnapshot);
      updateDetailsView(currentSnapshot);
    }
  }

  function resolvePresetTargetFromSnapshot(snap) {
    if (!snap) return { ok: false, error: 'unavailable' };

    // 1. Authoritative resolution provided by host if present
    if (snap.presetTarget && typeof snap.presetTarget === 'object') {
      return snap.presetTarget;
    }

    // 2. Strict offline fallback matching controller rules
    const wp = snap.wallpaper || {};
    const wpState = wp.state ?? 'idle';
    const cleanupPending = Boolean(wp.cleanupPending);
    const selectedScene = snap.settings?.weScene;
    const activeScene = wp.activeSceneId;

    if (cleanupPending) {
      return { ok: false, error: 'transition', state: 'stopping' };
    }
    if (['starting', 'connecting', 'waiting', 'stopping'].includes(wpState)) {
      return { ok: false, error: 'transition', state: wpState };
    }
    if (wpState === 'cleanup-failed') {
      return { ok: false, error: 'cleanup-failed' };
    }
    if (wpState === 'error') {
      return { ok: false, error: 'error' };
    }
    if (wpState === 'playing') {
      if (!activeScene || !isSceneId(activeScene)) {
        return { ok: false, error: 'unknown-scene' };
      }
      if (activeScene !== selectedScene) {
        return { ok: false, error: 'mismatch', activeId: activeScene, selectedId: selectedScene };
      }
      if (activeScene === 'lucy') {
        return { ok: true, targetId: 'lucy', isPlaying: true };
      }
      return { ok: false, error: 'scene-unconfirmed', sceneId: activeScene };
    }
    if (['idle', 'stopped'].includes(wpState)) {
      if (!selectedScene || !isSceneId(selectedScene)) {
        return { ok: false, error: 'invalid-scene' };
      }
      if (selectedScene === 'lucy') {
        return { ok: true, targetId: 'lucy', isPlaying: false };
      }
      return { ok: false, error: 'scene-unconfirmed', sceneId: selectedScene };
    }

    return { ok: false, error: 'state-disallowed', state: wpState };
  }

  function updatePresetsView(snap) {
    if (!snap) return;

    const resolution = resolvePresetTargetFromSnapshot(snap);
    const presetsEntries = snap.presets?.entries || {};

    if (resolution.ok) {
      targetSceneId = resolution.targetId;
      const isPlaying = Boolean(resolution.isPlaying);
      const sceneDisplayTitle = targetSceneId === 'lucy' ? 'Lucy' : targetSceneId;
      const targetPrefix = isPlaying ? '当前播放' : '所选壁纸';
      const hasPreset = Boolean(presetsEntries[targetSceneId]);

      if (presetTargetTitle) {
        presetTargetTitle.textContent = `${targetPrefix}：${sceneDisplayTitle}`;
      }
      if (presetStatusText) {
        presetStatusText.textContent = hasPreset ? '已保存预设' : '未保存预设';
      }
      if (presetHint) {
        presetHint.textContent = '每张壁纸保存一份亮度、遮罩、模糊与不透明度；手动应用到当前外观，全局恢复默认不删除预设';
      }

      const enabled = isConnected;
      if (btnPresetSave) btnPresetSave.disabled = !enabled;
      if (btnPresetApply) btnPresetApply.disabled = !(enabled && hasPreset);
      if (btnPresetDelete) btnPresetDelete.disabled = !(enabled && hasPreset);
    } else {
      targetSceneId = null;
      let title = '壁纸预设不可用';
      let hint = '当前状态不支持预设操作';

      if (resolution.error === 'transition') {
        title = '播放状态切换中';
        hint = '播放状态切换中，预设暂不可用';
      } else if (resolution.error === 'cleanup-failed') {
        title = '清理未确认';
        hint = '源窗口关闭未确认，请重试清理';
      } else if (resolution.error === 'mismatch') {
        title = '壁纸不一致';
        hint = '请先停止当前播放或切换到所选壁纸';
      } else if (resolution.error === 'scene-unconfirmed') {
        title = `所选壁纸：${resolution.sceneId || '未确认'}`;
        hint = '壁纸目录未确认，预设暂不可用';
      } else if (resolution.error === 'scene-unavailable') {
        title = `所选壁纸：${resolution.sceneId || '不可用'}`;
        hint = '壁纸当前不可用，预设暂不可用';
      } else if (resolution.error === 'unknown-scene') {
        title = '当前播放：未知壁纸';
        hint = '当前播放壁纸未知，预设暂不可用';
      } else if (resolution.error === 'invalid-scene') {
        title = '壁纸无效';
        hint = '所选壁纸标识无效，预设暂不可用';
      } else if (resolution.error === 'error') {
        title = 'Wallpaper Engine 错误';
        hint = 'Wallpaper Engine 播放当前不可用';
      }

      if (presetTargetTitle) presetTargetTitle.textContent = title;
      if (presetStatusText) presetStatusText.textContent = '不可用';
      if (presetHint) presetHint.textContent = hint;

      if (btnPresetSave) btnPresetSave.disabled = true;
      if (btnPresetApply) btnPresetApply.disabled = true;
      if (btnPresetDelete) btnPresetDelete.disabled = true;
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    if (tab === 'gallery') {
      if (tabBtnGallery) {
        tabBtnGallery.classList.add('is-active');
        tabBtnGallery.setAttribute('aria-selected', 'true');
      }
      if (tabBtnDetails) {
        tabBtnDetails.classList.remove('is-active');
        tabBtnDetails.setAttribute('aria-selected', 'false');
      }
      if (columnGallery) columnGallery.classList.remove('tab-hidden');
      if (columnDetails) columnDetails.classList.add('tab-hidden');
    } else {
      if (tabBtnDetails) {
        tabBtnDetails.classList.add('is-active');
        tabBtnDetails.setAttribute('aria-selected', 'true');
      }
      if (tabBtnGallery) {
        tabBtnGallery.classList.remove('is-active');
        tabBtnGallery.setAttribute('aria-selected', 'false');
      }
      if (columnDetails) columnDetails.classList.remove('tab-hidden');
      if (columnGallery) columnGallery.classList.add('tab-hidden');
    }
  }

  async function loadPreviewBlob(sceneId, imgEl, placeholderEl, { isDetails = false, epoch = 0 } = {}) {
    if (!sceneId || !imgEl || isDisposed) return;

    const reqConnEpoch = currentConnectionEpoch;
    const reqCatEpoch = currentCatalogEpoch;
    const reqFilterEpoch = currentFilterEpoch;
    const reqId = ++inFlightInstanceCounter;

    imgEl.onerror = () => {
      applyPlaceholder();
    };

    const applyUrl = (url) => {
      if (isDisposed || !isConnected) return;
      if (reqConnEpoch !== currentConnectionEpoch || reqCatEpoch !== currentCatalogEpoch || reqFilterEpoch !== currentFilterEpoch) return;
      if (isDetails && epoch !== detailsEpoch) return;
      imgEl.src = url;
      imgEl.classList.remove('hidden');
      if (placeholderEl) placeholderEl.classList.add('hidden');
    };

    const applyPlaceholder = () => {
      if (isDisposed) return;
      if (reqConnEpoch !== currentConnectionEpoch || reqCatEpoch !== currentCatalogEpoch || reqFilterEpoch !== currentFilterEpoch) return;
      if (isDetails && epoch !== detailsEpoch) return;
      imgEl.classList.add('hidden');
      if (placeholderEl) placeholderEl.classList.remove('hidden');
    };

    const allowedRatings = parseAgeRatings(currentSnapshot?.settings?.weAgeRatings);
    const cat = currentSnapshot?.catalog;
    const item = sceneId === 'lucy'
      ? { contentRating: 'Everyone' }
      : cat?.items?.find(i => i.id === sceneId);
    const itemRating = item?.contentRating || (sceneId === 'lucy' ? 'Everyone' : 'unknown');
    if (!allowedRatings.includes(itemRating)) {
      applyPlaceholder();
      return;
    }

    if (blobUrls.has(sceneId)) {
      applyUrl(blobUrls.get(sceneId));
      return;
    }

    if (!client || !isConnected) {
      applyPlaceholder();
      return;
    }

    let inFlight = inFlightBlobs.get(sceneId);
    if (!inFlight) {
      const abortCtrl = new AbortController();
      let timer = null;
      const callbacks = new Set();
      const promise = (async () => {
        try {
          const timeoutPromise = new Promise((_, rej) => {
            timer = setTimeout(() => {
              try { abortCtrl.abort(); } catch {}
              rej(new Error('preview-timeout'));
            }, 3000);
          });
          const blob = await Promise.race([
            client.fetchPreviewBlob(sceneId, { signal: abortCtrl.signal }),
            timeoutPromise,
          ]);
          clearTimeout(timer);

          const isStillCurrent = !isDisposed && isConnected
            && reqConnEpoch === currentConnectionEpoch
            && reqCatEpoch === currentCatalogEpoch
            && reqFilterEpoch === currentFilterEpoch
            && !abortCtrl.signal.aborted;

          if (!isStillCurrent) {
            return null;
          }

          const latestAllowed = parseAgeRatings(currentSnapshot?.settings?.weAgeRatings);
          if (!latestAllowed.includes(itemRating)) {
            return null;
          }

          const urlHelper = (windowObj && windowObj.URL) || (typeof URL !== 'undefined' ? URL : null);
          if (blob && urlHelper && typeof urlHelper.createObjectURL === 'function') {
            const objectUrl = urlHelper.createObjectURL(blob);
            if (!isConnected || isDisposed || reqConnEpoch !== currentConnectionEpoch || reqCatEpoch !== currentCatalogEpoch || reqFilterEpoch !== currentFilterEpoch || abortCtrl.signal.aborted) {
              try { urlHelper.revokeObjectURL(objectUrl); } catch {}
              return null;
            }
            if (blobUrls.size >= MAX_BLOB_URLS) {
              const oldestKey = blobUrls.keys().next().value;
              const oldestUrl = blobUrls.get(oldestKey);
              blobUrls.delete(oldestKey);
              try { urlHelper.revokeObjectURL(oldestUrl); } catch {}
            }
            blobUrls.set(sceneId, objectUrl);
            return objectUrl;
          }
          return null;
        } catch {
          return null;
        } finally {
          clearTimeout(timer);
          if (inFlightBlobs.get(sceneId)?.id === reqId) {
            inFlightBlobs.delete(sceneId);
          }
        }
      })();

      inFlight = { id: reqId, connEpoch: reqConnEpoch, catEpoch: reqCatEpoch, filterEpoch: reqFilterEpoch, promise, abortCtrl, timer, callbacks };
      inFlightBlobs.set(sceneId, inFlight);
    }

    inFlight.callbacks.add(applyUrl);

    try {
      const url = await inFlight.promise;
      if (url) {
        applyUrl(url);
      } else {
        applyPlaceholder();
      }
    } catch {
      applyPlaceholder();
    }
  }

  function cleanupBlobsOnDisconnect() {
    currentConnectionEpoch++;
    detailsEpoch++;
    for (const inFlight of inFlightBlobs.values()) {
      try { inFlight.abortCtrl.abort(); } catch {}
      if (inFlight.timer) clearTimeout(inFlight.timer);
    }
    inFlightBlobs.clear();
    const urlHelper = (windowObj && windowObj.URL) || (typeof URL !== 'undefined' ? URL : null);
    for (const url of blobUrls.values()) {
      try {
        if (urlHelper && typeof urlHelper.revokeObjectURL === 'function') {
          urlHelper.revokeObjectURL(url);
        }
      } catch {}
    }
    blobUrls.clear();
    if (detailsPreviewImg) {
      detailsPreviewImg.src = '';
      detailsPreviewImg.classList.add('hidden');
    }
    if (detailsPreviewPlaceholder) {
      detailsPreviewPlaceholder.classList.remove('hidden');
      const textSpan = (typeof detailsPreviewPlaceholder.querySelector === 'function')
        ? (detailsPreviewPlaceholder.querySelector('.placeholder-text') || detailsPreviewPlaceholder.querySelector('span:last-child'))
        : null;
      if (textSpan) textSpan.textContent = '暂无安全预览图';
    }
  }

  function disposeBlobUrls() {
    isDisposed = true;
    authorPanel?.dispose();
    cleanupBlobsOnDisconnect();
  }

  function handleSelectWallpaper(sceneId) {
    if (!isConnected) return;
    const cat = currentSnapshot?.catalog;
    const item = cat?.items?.find(i => i.id === sceneId);
    if (item && item.available === false) {
      return;
    }
    applySettingSerialized('weScene', sceneId);
    if (typeof windowObj !== 'undefined' && windowObj.innerWidth < 720) {
      switchTab('details');
    }
  }

  function startWallpaperSerialized(sceneId) {
    if (!client || !isConnected) return Promise.resolve({ ok: false, error: 'not-connected' });
    return new Promise((resolve, reject) => {
      actionQueue.push({
        id: ++actionIdGen,
        kind: 'wallpaper-start',
        sceneId,
        resolve,
        reject,
        settled: false,
      });
      runActionQueue();
    });
  }

  function stopWallpaperSerialized() {
    if (!client || !isConnected) return Promise.resolve({ ok: false, error: 'not-connected' });
    return new Promise((resolve, reject) => {
      actionQueue.push({
        id: ++actionIdGen,
        kind: 'wallpaper-stop',
        resolve,
        reject,
        settled: false,
      });
      runActionQueue();
    });
  }

  function refreshCatalogSerialized() {
    if (!client || !isConnected) return Promise.resolve({ ok: false, error: 'not-connected' });
    return new Promise((resolve, reject) => {
      actionQueue.push({
        id: ++actionIdGen,
        kind: 'catalog-refresh',
        resolve,
        reject,
        settled: false,
      });
      runActionQueue();
    });
  }

  async function handleStartWallpaper() {
    if (!client || !isConnected) return { ok: false, error: 'not-connected' };
    const selectedSceneId = currentSnapshot?.settings?.weScene || 'lucy';
    if (btnStartWallpaper) btnStartWallpaper.disabled = true;
    showError('');
    try {
      const res = await startWallpaperSerialized(selectedSceneId);
      if (!res || !res.ok) {
        showError(`启动壁纸失败: ${res?.error || '未知错误'}`);
      }
      return res;
    } catch (err) {
      showError(`启动壁纸异常: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  async function handleStopWallpaper() {
    if (!client || !isConnected) return { ok: false, error: 'not-connected' };
    if (btnStopWallpaper) btnStopWallpaper.disabled = true;
    showError('');
    try {
      const res = await stopWallpaperSerialized();
      if (!res || !res.ok) {
        showError(`停止壁纸失败: ${res?.error || '未知错误'}`);
      }
      return res;
    } catch (err) {
      showError(`停止壁纸异常: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  async function handleRefreshCatalog() {
    if (!client || !isConnected) return { ok: false, error: 'not-connected' };
    if (btnRefreshCatalog) btnRefreshCatalog.disabled = true;
    showError('');
    try {
      const res = await refreshCatalogSerialized();
      if (!res || !res.ok) {
        showError(`刷新壁纸列表失败: ${res?.error || '未知错误'}`);
      }
      return res;
    } catch (err) {
      showError(`刷新壁纸列表异常: ${err.message}`);
      return { ok: false, error: err.message };
    } finally {
      if (btnRefreshCatalog) btnRefreshCatalog.disabled = !isConnected;
    }
  }

  function handleAgeFilterChange() {
    if (!isConnected) return;
    const selected = [];
    if (filterRatingEveryone && filterRatingEveryone.checked) selected.push('Everyone');
    if (filterRatingQuestionable && filterRatingQuestionable.checked) selected.push('Questionable');
    if (filterRatingMature && filterRatingMature.checked) selected.push('Mature');
    const formatted = formatAgeRatings(selected);
    applySettingSerialized('weAgeRatings', formatted);
  }

  function updateGalleryView(snap) {
    if (!wallpaperCardGrid) return;
    const cat = snap.catalog || { items: [], state: 'idle', loaded: false, loading: false };
    const wp = snap.wallpaper || { state: 'idle', activeSceneId: null };
    const selectedSceneId = snap.settings?.weScene || 'lucy';
    const activeSceneId = isSceneId(wp.activeSceneId) ? wp.activeSceneId : (isSceneId(wp.host && wp.host.activeSceneId) ? wp.host.activeSceneId : null);
    const isPlayingState = wp.state === 'playing' || wp.state === 'starting';

    const allowedRatings = parseAgeRatings(snap.settings?.weAgeRatings);

    // 2. Items
    const rawItems = Array.isArray(cat.items) ? cat.items.map(i => ({
      ...i,
      contentRating: ['Everyone', 'Questionable', 'Mature'].includes(i.contentRating) ? i.contentRating : (i.id === 'lucy' ? 'Everyone' : 'unknown'),
    })) : [];
    if (cat.state !== 'failed' && !rawItems.some(item => item.id === 'lucy')) {
      const verified = Array.isArray(wp?.host?.scenes) ? wp.host.scenes.find(scene => scene.id === 'lucy') : null;
      rawItems.unshift({
        id: 'lucy',
        title: 'Lucy',
        type: 'scene',
        contentRating: 'Everyone',
        available: verified ? verified.available !== false : true,
        playbackVerified: true,
      });
    }

    const visibleItems = rawItems.filter(item => allowedRatings.includes(item.contentRating));

    if (galleryNotice) {
      if (cat.loading) {
        galleryNotice.textContent = '正在刷新壁纸库...';
        galleryNotice.className = 'gallery-notice';
      } else if (cat.error) {
        galleryNotice.textContent = `读取失败: ${cat.error}`;
        galleryNotice.className = 'gallery-notice is-error';
      } else if (cat.truncated) {
        galleryNotice.textContent = '壁纸较多，已显示前部分条目';
        galleryNotice.className = 'gallery-notice is-warning';
      } else if (cat.loaded && (!visibleItems || visibleItems.length === 0)) {
        galleryNotice.textContent = allowedRatings.length === 0 ? '未勾选任何年龄分级' : '未发现可用壁纸';
        galleryNotice.className = 'gallery-notice';
      } else {
        galleryNotice.textContent = '';
        galleryNotice.className = 'gallery-notice hidden';
      }
    }

    if (galleryCountBadge) {
      galleryCountBadge.textContent = `${visibleItems.length} 项`;
    }

    // 3. Render cards in #wallpaper-card-grid
    wallpaperCardGrid.innerHTML = '';
    for (const item of visibleItems) {
      const isSelected = item.id === selectedSceneId;
      const isPlaying = item.id === activeSceneId && isPlayingState;

      const card = documentObj.createElement('button');
      card.type = 'button';
      card.className = `wallpaper-card${isSelected ? ' is-selected' : ''}${isPlaying ? ' is-playing' : ''}`;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(isSelected));
      card.setAttribute('data-scene-id', item.id);
      card.disabled = !isConnected || item.available === false;

      // Thumbnail wrap
      const thumbWrap = documentObj.createElement('div');
      thumbWrap.className = 'card-thumb-wrap';

      const thumbPlaceholder = documentObj.createElement('div');
      thumbPlaceholder.className = 'card-thumb-placeholder';
      const pIcon = documentObj.createElement('span');
      pIcon.textContent = '🖼';
      const pText = documentObj.createElement('span');
      pText.textContent = '无预览图';
      thumbPlaceholder.appendChild(pIcon);
      thumbPlaceholder.appendChild(pText);

      const thumbImg = documentObj.createElement('img');
      thumbImg.className = 'card-thumb-img hidden';
      thumbImg.alt = item.title || item.id;

      thumbWrap.appendChild(thumbPlaceholder);
      thumbWrap.appendChild(thumbImg);

      // Card body
      const cardBody = documentObj.createElement('div');
      cardBody.className = 'card-body';

      const titleEl = documentObj.createElement('div');
      titleEl.className = 'card-title';
      titleEl.title = item.title || item.id;
      titleEl.textContent = item.title || item.id;

      const metaRow = documentObj.createElement('div');
      metaRow.className = 'card-meta-row';

      const typeTag = documentObj.createElement('span');
      typeTag.className = 'item-tag';
      typeTag.textContent = item.type || 'scene';
      metaRow.appendChild(typeTag);

      const statusTag = documentObj.createElement('span');
      statusTag.className = `item-tag ${item.playbackVerified ? 'tag-verified' : 'tag-experimental'}`;
      statusTag.textContent = item.playbackVerified ? '已验证' : (item.available ? '实验性' : '不可用');
      metaRow.appendChild(statusTag);

      if (isPlaying) {
        const playingTag = documentObj.createElement('span');
        playingTag.className = 'item-tag tag-playing';
        playingTag.textContent = '正在播放';
        metaRow.appendChild(playingTag);
      }

      if (isSelected) {
        const selectedTag = documentObj.createElement('span');
        selectedTag.className = 'item-tag tag-selected';
        selectedTag.textContent = '本次选择';
        metaRow.appendChild(selectedTag);
      }

      cardBody.appendChild(titleEl);
      cardBody.appendChild(metaRow);

      card.appendChild(thumbWrap);
      card.appendChild(cardBody);

      card.addEventListener('click', () => {
        handleSelectWallpaper(item.id);
      });

      wallpaperCardGrid.appendChild(card);

      loadPreviewBlob(item.id, thumbImg, thumbPlaceholder, { isDetails: false });
    }
  }

  function updateDetailsView(snap) {
    const cat = snap.catalog || { items: [] };
    const wp = snap.wallpaper || { state: 'idle', activeSceneId: null, cleanupPending: false };
    const selectedSceneId = snap.settings?.weScene || 'lucy';
    const activeSceneId = isSceneId(wp.activeSceneId) ? wp.activeSceneId : (isSceneId(wp.host && wp.host.activeSceneId) ? wp.host.activeSceneId : null);
    const wpState = wp.state || 'idle';
    const cleanupPending = Boolean(wp.cleanupPending);

    const allowedRatings = parseAgeRatings(snap.settings?.weAgeRatings);

    const rawItems = Array.isArray(cat.items) ? cat.items.map(i => ({
      ...i,
      contentRating: ['Everyone', 'Questionable', 'Mature'].includes(i.contentRating) ? i.contentRating : (i.id === 'lucy' ? 'Everyone' : 'unknown'),
    })) : [];
    if (cat.state !== 'failed' && !rawItems.some(item => item.id === 'lucy')) {
      const verified = Array.isArray(wp?.host?.scenes) ? wp.host.scenes.find(scene => scene.id === 'lucy') : null;
      rawItems.unshift({
        id: 'lucy',
        title: 'Lucy',
        type: 'scene',
        contentRating: 'Everyone',
        available: verified ? verified.available !== false : true,
        playbackVerified: true,
      });
    }

    const item = rawItems.find(i => i.id === selectedSceneId) || {
      id: selectedSceneId,
      title: selectedSceneId,
      type: 'unknown',
      contentRating: selectedSceneId === 'lucy' ? 'Everyone' : 'unknown',
      available: false,
      playbackVerified: false,
      reason: 'unknown_wallpaper',
    };

    const isSelectedHidden = !allowedRatings.includes(item.contentRating);

    if (detailsTitle) {
      detailsTitle.textContent = isSelectedHidden
        ? `${item.title || item.id}（已被筛选隐藏）`
        : (item.title || item.id);
    }

    if (badgeDetailsType) {
      badgeDetailsType.textContent = item.type || 'scene';
    }

    if (badgeDetailsStatus) {
      badgeDetailsStatus.textContent = item.playbackVerified ? '已验证' : (item.available ? '实验性' : '不可用');
      badgeDetailsStatus.className = `item-tag ${item.playbackVerified ? 'tag-verified' : 'tag-experimental'}`;
    }

    const isSelectedPlaying = item.id === activeSceneId && (wpState === 'playing' || wpState === 'starting');
    if (badgeDetailsPlaying) {
      badgeDetailsPlaying.classList.toggle('hidden', !isSelectedPlaying);
    }

    if (item.id !== previousDetailsSceneId || isSelectedHidden) {
      if (detailsPreviewImg) {
        detailsPreviewImg.src = '';
        detailsPreviewImg.classList.add('hidden');
      }
      if (detailsPreviewPlaceholder) {
        detailsPreviewPlaceholder.classList.remove('hidden');
      }
      previousDetailsSceneId = item.id;
    }

    detailsEpoch++;
    const thisEpoch = detailsEpoch;

    if (isSelectedHidden) {
      if (detailsPreviewPlaceholder && typeof detailsPreviewPlaceholder.querySelector === 'function') {
        const textSpan = detailsPreviewPlaceholder.querySelector('.placeholder-text') || detailsPreviewPlaceholder.querySelector('span:last-child');
        if (textSpan) textSpan.textContent = '已被年龄分级筛选隐藏';
      }
    } else {
      if (detailsPreviewPlaceholder && typeof detailsPreviewPlaceholder.querySelector === 'function') {
        const textSpan = detailsPreviewPlaceholder.querySelector('.placeholder-text') || detailsPreviewPlaceholder.querySelector('span:last-child');
        if (textSpan) textSpan.textContent = '暂无安全预览图';
      }
      loadPreviewBlob(item.id, detailsPreviewImg, detailsPreviewPlaceholder, { isDetails: true, epoch: thisEpoch });
    }

    if (detailsPlaybackText) {
      if (wpState === 'playing') {
        detailsPlaybackText.textContent = `正在播放：${activeSceneId === 'lucy' ? 'Lucy' : (activeSceneId || '未知壁纸')}`;
      } else if (wpState === 'starting') {
        detailsPlaybackText.textContent = '壁纸启动中...';
      } else if (wpState === 'stopping' || cleanupPending) {
        detailsPlaybackText.textContent = '壁纸停止/清理中...';
      } else if (wpState === 'cleanup-failed') {
        detailsPlaybackText.textContent = '源窗口清理未确认，请重试停止';
      } else {
        detailsPlaybackText.textContent = '未开始播放';
      }
    }

    if (detailsMismatchBanner) {
      if (wpState === 'playing' && activeSceneId && activeSceneId !== selectedSceneId) {
        detailsMismatchBanner.textContent = `当前正在播放另一张壁纸「${activeSceneId === 'lucy' ? 'Lucy' : activeSceneId}」。请先停止当前播放，再开始所选项。`;
        detailsMismatchBanner.classList.remove('hidden');
      } else {
        detailsMismatchBanner.classList.add('hidden');
      }
    }

    const isBusy = wpState === 'starting' || wpState === 'stopping' || cleanupPending;
    const isCurrentlyPlaying = wpState === 'playing';
    const isMismatch = isCurrentlyPlaying && activeSceneId !== selectedSceneId;
    const isLucy = selectedSceneId === 'lucy';
    const catalogReady = cat.state === 'ready' && cat.loaded === true;
    const isStartableType = ['scene', 'video', 'web'].includes(item.type);
    const STARTABLE_STATES = ['idle', 'stopped', 'error'];
    const isStartableState = STARTABLE_STATES.includes(wpState) && !cleanupPending && wpState !== 'cleanup-failed' && activeSceneId == null;
    const canStart = isConnected && !isBusy && isStartableState && !isSelectedHidden && catalogReady && (isLucy ? item.available !== false : (item.available === true && isStartableType)) && !isMismatch;
    const canStop = isConnected && (isCurrentlyPlaying || wpState === 'starting' || wpState === 'cleanup-failed');

    if (btnStartWallpaper) btnStartWallpaper.disabled = !canStart;
    if (btnStopWallpaper) btnStopWallpaper.disabled = !canStop;

    const playbackControlsEnabled = isConnected && !isBusy && isStartableState;
    const modePending = typeof hasPendingOrInFlight === 'function' && hasPendingOrInFlight('weMode');
    const autoPending = typeof hasPendingOrInFlight === 'function' && hasPendingOrInFlight('weAutoStart');
    const settingsMode = snap.settings && snap.settings.weMode;
    const settingsAuto = snap.settings && snap.settings.weAutoStart;
    if (selectPlaybackMode) {
      if (!modePending && (settingsMode === 'daily' || settingsMode === 'preview')) {
        selectPlaybackMode.value = settingsMode;
      } else if (!modePending) {
        selectPlaybackMode.value = 'preview';
      }
      selectPlaybackMode.disabled = !playbackControlsEnabled;
    }
    if (checkboxAutoStart) {
      if (!autoPending) checkboxAutoStart.checked = settingsAuto === true;
      checkboxAutoStart.disabled = !playbackControlsEnabled;
    }
  }

  function applySnapshot(snap) {
    if (!snap || typeof snap !== 'object') return;
    const snapRev = Number.isInteger(snap.revision) ? snap.revision : 0;
    const currRev = Number.isInteger(currentSnapshot?.revision) ? currentSnapshot.revision : 0;
    const clientRev = Number.isInteger(client?.getCurrentRevision?.()) ? client.getCurrentRevision() : 0;

    // Strict monotonic guard: never roll back to an older revision
    if (currentSnapshot && (snapRev < currRev || snapRev < clientRev)) {
      return;
    }
    currentSnapshot = snap;
    const s = snap.settings || {};

    // 1. Visual fields (protect in-flight and queued changes from rollback)
    const b = s.brightness ?? snap.brightness;
    if (b != null && documentObj.activeElement !== inputBrightness && !hasPendingOrInFlight('brightness')) {
      if (sliderBrightness) sliderBrightness.value = String(b);
      if (inputBrightness) inputBrightness.value = String(b);
    }

    const m = s.mask ?? snap.mask;
    if (m != null && documentObj.activeElement !== inputMask && !hasPendingOrInFlight('mask')) {
      if (sliderMask) sliderMask.value = String(m);
      if (inputMask) inputMask.value = String(m);
    }

    const bl = s.blur;
    if (bl != null && documentObj.activeElement !== inputBlur && !hasPendingOrInFlight('blur')) {
      if (sliderBlur) sliderBlur.value = String(bl);
      if (inputBlur) inputBlur.value = String(bl);
    }

    const sf = s.surface;
    if (sf != null && documentObj.activeElement !== inputSurface && !hasPendingOrInFlight('surface')) {
      if (sliderSurface) sliderSurface.value = String(sf);
      if (inputSurface) inputSurface.value = String(sf);
    }

    // 2. Interface fields
    const cb = s.chatBackdrop;
    if (cb != null && documentObj.activeElement !== inputChatBackdrop && !hasPendingOrInFlight('chatBackdrop')) {
      if (sliderChatBackdrop) sliderChatBackdrop.value = String(cb);
      if (inputChatBackdrop) inputChatBackdrop.value = String(cb);
    }

    const theme = s.theme;
    if (theme && !hasPendingOrInFlight('theme')) {
      if (btnThemeMist) {
        btnThemeMist.classList.toggle('is-active', theme === 'mist');
        btnThemeMist.setAttribute('aria-pressed', String(theme === 'mist'));
      }
      if (btnThemeAbyss) {
        btnThemeAbyss.classList.toggle('is-active', theme === 'abyss');
        btnThemeAbyss.setAttribute('aria-pressed', String(theme === 'abyss'));
      }
    }

    const palette = s.palette;
    if (palette && !hasPendingOrInFlight('palette')) {
      const paletteMap = {
        ocean: btnPaletteOcean,
        graphite: btnPaletteGraphite,
        violet: btnPaletteViolet,
        jade: btnPaletteJade,
      };
      for (const [pId, btn] of Object.entries(paletteMap)) {
        if (btn) {
          const isActive = palette === pId;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-pressed', String(isActive));
        }
      }
    }

    const contrast = s.textContrast;
    if (contrast && !hasPendingOrInFlight('textContrast')) {
      if (btnContrastStandard) {
        btnContrastStandard.classList.toggle('is-active', contrast === 'standard');
        btnContrastStandard.setAttribute('aria-pressed', String(contrast === 'standard'));
      }
      if (btnContrastEnhanced) {
        btnContrastEnhanced.classList.toggle('is-active', contrast === 'enhanced');
        btnContrastEnhanced.setAttribute('aria-pressed', String(contrast === 'enhanced'));
      }
    }

    const accentMode = s.accentMode;
    if (accentMode && !hasPendingOrInFlight('accentMode')) {
      if (btnAccentTheme) {
        btnAccentTheme.classList.toggle('is-active', accentMode === 'theme');
        btnAccentTheme.setAttribute('aria-pressed', String(accentMode === 'theme'));
      }
      if (btnAccentCustom) {
        btnAccentCustom.classList.toggle('is-active', accentMode === 'custom');
        btnAccentCustom.setAttribute('aria-pressed', String(accentMode === 'custom'));
      }
      if (accentColorPickerWrap) {
        accentColorPickerWrap.classList.toggle('hidden', accentMode !== 'custom');
      }
    }

    const accentColor = s.accentColor;
    if (accentColor && HEX_COLOR_PATTERN.test(accentColor) && !hasPendingOrInFlight('accentColor')) {
      if (inputAccentColor && documentObj.activeElement !== inputAccentColor) {
        inputAccentColor.value = accentColor;
      }
      if (textAccentHex) {
        textAccentHex.textContent = accentColor.toLowerCase();
      }
    }

    // 3. Age filter checkboxes & invalidation
    const allowedRatings = parseAgeRatings(s.weAgeRatings);
    if (filterRatingEveryone && documentObj.activeElement !== filterRatingEveryone) {
      filterRatingEveryone.checked = allowedRatings.includes('Everyone');
    }
    if (filterRatingQuestionable && documentObj.activeElement !== filterRatingQuestionable) {
      filterRatingQuestionable.checked = allowedRatings.includes('Questionable');
    }
    if (filterRatingMature && documentObj.activeElement !== filterRatingMature) {
      filterRatingMature.checked = allowedRatings.includes('Mature');
    }

    const catScannedAt = snap.catalog?.scannedAt || null;
    if (previousScannedAt !== null && catScannedAt !== null && catScannedAt !== previousScannedAt) {
      currentCatalogEpoch++;
      cleanupBlobsOnDisconnect();
    }
    previousScannedAt = catScannedAt;

    const allowedKey = [...allowedRatings].sort().join(',');
    if (previousAllowedRatingsKey !== null && previousAllowedRatingsKey !== allowedKey) {
      currentFilterEpoch++;
      const cat = snap.catalog || { items: [] };
      const rawItems = Array.isArray(cat.items) ? cat.items : [];
      const getRatingForScene = (sceneId) => {
        if (sceneId === 'lucy') return 'Everyone';
        const it = rawItems.find(i => i.id === sceneId);
        return it?.contentRating || 'unknown';
      };

      const urlHelper = (windowObj && windowObj.URL) || (typeof URL !== 'undefined' ? URL : null);
      for (const [sceneId, url] of [...blobUrls.entries()]) {
        const rating = getRatingForScene(sceneId);
        if (!allowedRatings.includes(rating)) {
          if (urlHelper && typeof urlHelper.revokeObjectURL === 'function') {
            try { urlHelper.revokeObjectURL(url); } catch {}
          }
          blobUrls.delete(sceneId);
        }
      }

      for (const [sceneId, inFlight] of [...inFlightBlobs.entries()]) {
        const rating = getRatingForScene(sceneId);
        if (!allowedRatings.includes(rating)) {
          try { inFlight.abortCtrl.abort(); } catch {}
          if (inFlight.timer) clearTimeout(inFlight.timer);
          inFlightBlobs.delete(sceneId);
        }
      }
    }
    previousAllowedRatingsKey = allowedKey;

    // 4. Wallpaper Gallery & Details views
    updateGalleryView(snap);
    updateDetailsView(snap);
    const authorId=snap.settings?.weScene||'lucy';
    const authorItem=(snap.catalog?.items??[]).find(item=>item.id===authorId);
    authorPanel?.update({wallpaperId:authorId,connected:isConnected,
      allowed:authorItem?.available===true&&['scene','web'].includes(authorItem.type)&&allowedRatings.includes(authorItem.contentRating),
      contextKey:JSON.stringify([s.weAgeRatings,snap.wallpaper?.state,snap.wallpaper?.activeSceneId,snap.wallpaper?.cleanupPending,snap.catalog?.scannedAt])});

    // 4. Presets view
    updatePresetsView(snap);

    // 5. Visual target notice
    const wp = snap.wallpaper || {};
    if (visualTargetNotice) {
      if (wp.state === 'playing') {
        const activeName = wp.activeSceneId === 'lucy' ? 'Lucy' : (wp.activeSceneId || '当前壁纸');
        visualTargetNotice.textContent = `调节对当前播放的壁纸「${activeName}」生效`;
      } else {
        visualTargetNotice.textContent = '当前未播放壁纸；四项调节属于 DSH 背景渲染全局效果';
      }
    }
  }

  function revertAllControlsToAuthoritative() {
    if (!currentSnapshot) return;
    const s = currentSnapshot.settings || {};
    if (selectPlaybackMode) selectPlaybackMode.value = s.weMode === 'daily' ? 'daily' : 'preview';
    if (checkboxAutoStart) checkboxAutoStart.checked = s.weAutoStart === true;

    const b = s.brightness ?? 70;
    if (sliderBrightness) sliderBrightness.value = String(b);
    if (inputBrightness) inputBrightness.value = String(b);

    const m = s.mask ?? 45;
    if (sliderMask) sliderMask.value = String(m);
    if (inputMask) inputMask.value = String(m);

    const bl = s.blur ?? 0;
    if (sliderBlur) sliderBlur.value = String(bl);
    if (inputBlur) inputBlur.value = String(bl);

    const sf = s.surface ?? 82;
    if (sliderSurface) sliderSurface.value = String(sf);
    if (inputSurface) inputSurface.value = String(sf);

    const cb = s.chatBackdrop ?? 0;
    if (sliderChatBackdrop) sliderChatBackdrop.value = String(cb);
    if (inputChatBackdrop) inputChatBackdrop.value = String(cb);

    const theme = s.theme ?? 'abyss';
    if (btnThemeMist) {
      btnThemeMist.classList.toggle('is-active', theme === 'mist');
      btnThemeMist.setAttribute('aria-pressed', String(theme === 'mist'));
    }
    if (btnThemeAbyss) {
      btnThemeAbyss.classList.toggle('is-active', theme === 'abyss');
      btnThemeAbyss.setAttribute('aria-pressed', String(theme === 'abyss'));
    }

    const palette = s.palette ?? 'ocean';
    const paletteMap = {
      ocean: btnPaletteOcean,
      graphite: btnPaletteGraphite,
      violet: btnPaletteViolet,
      jade: btnPaletteJade,
    };
    for (const [pId, btn] of Object.entries(paletteMap)) {
      if (btn) {
        const isActive = palette === pId;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      }
    }

    const contrast = s.textContrast ?? 'standard';
    if (btnContrastStandard) {
      btnContrastStandard.classList.toggle('is-active', contrast === 'standard');
      btnContrastStandard.setAttribute('aria-pressed', String(contrast === 'standard'));
    }
    if (btnContrastEnhanced) {
      btnContrastEnhanced.classList.toggle('is-active', contrast === 'enhanced');
      btnContrastEnhanced.setAttribute('aria-pressed', String(contrast === 'enhanced'));
    }

    const accentMode = s.accentMode ?? 'theme';
    if (btnAccentTheme) {
      btnAccentTheme.classList.toggle('is-active', accentMode === 'theme');
      btnAccentTheme.setAttribute('aria-pressed', String(accentMode === 'theme'));
    }
    if (btnAccentCustom) {
      btnAccentCustom.classList.toggle('is-active', accentMode === 'custom');
      btnAccentCustom.setAttribute('aria-pressed', String(accentMode === 'custom'));
    }
    if (accentColorPickerWrap) {
      accentColorPickerWrap.classList.toggle('hidden', accentMode !== 'custom');
    }

    const accentColor = s.accentColor ?? '#8c72f2';
    if (inputAccentColor) inputAccentColor.value = accentColor;
    if (textAccentHex) textAccentHex.textContent = accentColor.toLowerCase();

    const allowedRatings = parseAgeRatings(s.weAgeRatings);
    if (filterRatingEveryone) filterRatingEveryone.checked = allowedRatings.includes('Everyone');
    if (filterRatingQuestionable) filterRatingQuestionable.checked = allowedRatings.includes('Questionable');
    if (filterRatingMature) filterRatingMature.checked = allowedRatings.includes('Mature');
  }

  function parseClamped(val, min, max, defaultVal) {
    const parsed = Number.parseInt(val, 10);
    const num = Number.isFinite(parsed) ? parsed : defaultVal;
    return Math.max(min, Math.min(max, num));
  }

  function runActionQueue() {
    if (workerRunning) return;
    workerRunning = true;

    (async () => {
      await Promise.resolve();
      try {
        while (actionQueue.length > 0) {
          const item = actionQueue.shift();
          if (!item || item.settled) continue;

          activeInFlight = item;

          if (!client || !isConnected) {
            settleItem(item, { ok: false, error: 'not-connected' });
            cancelRemainingQueue('not-connected');
            break;
          }

          if (item.kind === 'setting') {
            const { key, value } = item;
            const cur = currentSnapshot?.settings?.[key] ?? currentSnapshot?.[key];
            if (cur === value) {
              settleItem(item, { ok: true, snapshot: currentSnapshot });
              activeInFlight = null;
              continue;
            }

            if (!item.deadline) {
              item.deadline = performance.now() + actionTimeoutMs;
            }
            const remainingMs = Math.max(0, item.deadline - performance.now());
            if (remainingMs <= 0) {
              showError(`设置 ${key} 超时: 服务端状态未确认`);
              settleItem(item, { ok: false, error: 'action-timeout', serverCommitted: 'unknown' });
              cancelRemainingQueue('aborted-after-failure');
              revertAllControlsToAuthoritative();
              activeInFlight = null;
              break;
            }

            let res;
            let timedOut = false;
            let actionTimer = null;
            const abortController = new AbortController();
            item.abortController = abortController;
            try {
              res = await Promise.race([
                client.setSetting(key, value, { signal: abortController.signal }),
                new Promise((_, reject) => {
                  actionTimer = setTimeout(() => {
                    abortController.abort();
                    reject(new Error('action-timeout'));
                  }, remainingMs);
                }),
              ]);
            } catch (err) {
              if (err.message === 'action-timeout' || abortController.signal.aborted) {
                timedOut = true;
              }
              res = { ok: false, error: err.message || 'action-timeout' };
            } finally {
              if (actionTimer) clearTimeout(actionTimer);
            }

            if (item.settled) {
              activeInFlight = null;
              continue;
            }

            if (timedOut) {
              abortController.abort();
              showError(`设置 ${key} 超时: 服务端状态未确认`);
              settleItem(item, { ok: false, error: 'action-timeout', serverCommitted: 'unknown' });
              cancelRemainingQueue('aborted-after-failure');
              revertAllControlsToAuthoritative();
              activeInFlight = null;
              break;
            }

            if (!res.ok) {
              if (res.error === 'stale-revision' && res.snapshot) {
                applySnapshot(res.snapshot);

                // Check if a newer setting for `key` is already queued in the SAME barrier segment
                let hasNewerInSameBatch = false;
                for (const queued of actionQueue) {
                  if (queued.kind === 'preset' || queued.kind.startsWith('wallpaper-') || queued.kind === 'catalog-refresh') {
                    // Reached an action barrier! Edits across barrier cannot supersede edits before it.
                    break;
                  }
                  if (queued.kind === 'setting' && queued.key === key && !queued.settled) {
                    hasNewerInSameBatch = true;
                    break;
                  }
                }

                if (hasNewerInSameBatch) {
                  settleItem(item, { ok: true, superseded: true, snapshot: res.snapshot });
                  activeInFlight = null;
                  continue;
                }

                const newCur = res.snapshot.settings?.[key] ?? res.snapshot[key];
                if (newCur === value) {
                  settleItem(item, res);
                  activeInFlight = null;
                  continue;
                }

                item.attempts = (item.attempts || 0) + 1;
                if (item.attempts >= MAX_STALE_RETRIES) {
                  showError(`设置 ${key} 冲突次数超限，请稍后重试`);
                  settleItem(item, { ok: false, error: 'max-stale-retries-exceeded', snapshot: res.snapshot });
                  cancelRemainingQueue('aborted-after-failure');
                  revertAllControlsToAuthoritative();
                  activeInFlight = null;
                  break;
                }

                await new Promise(r => setTimeout(r, 0));
                actionQueue.unshift(item);
                activeInFlight = null;
                continue;
              } else {
                showError(`设置 ${key} 失败: ${res.error || '未知错误'}`);
                if (res.snapshot) applySnapshot(res.snapshot);
                settleItem(item, res);
                cancelRemainingQueue('aborted-after-failure');
                revertAllControlsToAuthoritative();
                activeInFlight = null;
                break;
              }
            } else {
              showError('');
              if (res.snapshot) applySnapshot(res.snapshot);
              settleItem(item, res);
              activeInFlight = null;
            }
          } else if (item.kind === 'preset') {
            const resolution = resolvePresetTargetFromSnapshot(currentSnapshot);
            if (!resolution.ok) {
              showError(`预设操作失败: ${resolution.error}`);
              settleItem(item, { ok: false, error: resolution.error });
              activeInFlight = null;
              continue;
            }
            if (resolution.targetId !== item.expectedSceneId) {
              showError('壁纸目标已发生改变，已取消先前的预设操作');
              settleItem(item, { ok: false, error: 'target-changed' });
              activeInFlight = null;
              continue;
            }

            showError('');
            let actionType;
            if (item.action === 'save') actionType = DETACHABLE_ACTIONS.SAVE_PRESET;
            else if (item.action === 'apply') actionType = DETACHABLE_ACTIONS.APPLY_PRESET;
            else if (item.action === 'remove') actionType = DETACHABLE_ACTIONS.REMOVE_PRESET;

            if (!item.deadline) {
              item.deadline = performance.now() + actionTimeoutMs;
            }
            const remainingMs = Math.max(0, item.deadline - performance.now());
            if (remainingMs <= 0) {
              showError('预设操作超时: 服务端状态未确认');
              settleItem(item, { ok: false, error: 'action-timeout', serverCommitted: 'unknown' });
              cancelRemainingQueue('aborted-after-failure');
              revertAllControlsToAuthoritative();
              activeInFlight = null;
              break;
            }

            let res;
            let timedOut = false;
            let actionTimer = null;
            const abortController = new AbortController();
            item.abortController = abortController;
            try {
              res = await Promise.race([
                client.dispatch(actionType, { sceneId: item.expectedSceneId }, { signal: abortController.signal }),
                new Promise((_, reject) => {
                  actionTimer = setTimeout(() => {
                    abortController.abort();
                    reject(new Error('action-timeout'));
                  }, remainingMs);
                }),
              ]);
            } catch (err) {
              if (err.message === 'action-timeout' || abortController.signal.aborted) {
                timedOut = true;
              }
              res = { ok: false, error: err.message || 'action-timeout' };
            } finally {
              if (actionTimer) clearTimeout(actionTimer);
            }

            if (item.settled) {
              activeInFlight = null;
              continue;
            }

            if (timedOut) {
              abortController.abort();
              showError('预设操作超时: 服务端状态未确认');
              settleItem(item, { ok: false, error: 'action-timeout', serverCommitted: 'unknown' });
              cancelRemainingQueue('aborted-after-failure');
              revertAllControlsToAuthoritative();
              activeInFlight = null;
              break;
            }

            if (!res.ok) {
              showError(`预设操作失败: ${res.error || '未通过场景门禁'}`);
            } else if (res.snapshot) {
              applySnapshot(res.snapshot);
            }
            settleItem(item, res);
            activeInFlight = null;
          } else if (item.kind === 'wallpaper-start' || item.kind === 'wallpaper-stop' || item.kind === 'catalog-refresh') {
            if (!item.deadline) {
              item.deadline = performance.now() + actionTimeoutMs;
            }
            const remainingMs = Math.max(0, item.deadline - performance.now());
            if (remainingMs <= 0) {
              showError(`${item.kind} 操作超时: 服务端状态未确认`);
              settleItem(item, { ok: false, error: 'action-timeout', serverCommitted: 'unknown' });
              cancelRemainingQueue('aborted-after-failure');
              revertAllControlsToAuthoritative();
              activeInFlight = null;
              break;
            }

            let res;
            let timedOut = false;
            let actionTimer = null;
            const abortController = new AbortController();
            item.abortController = abortController;
            try {
              let actionPromise;
              if (item.kind === 'wallpaper-start') {
                actionPromise = client.startWallpaper(item.sceneId, { signal: abortController.signal });
              } else if (item.kind === 'wallpaper-stop') {
                actionPromise = client.stopWallpaper({ signal: abortController.signal });
              } else {
                actionPromise = client.refreshCatalog({ signal: abortController.signal });
              }

              res = await Promise.race([
                actionPromise,
                new Promise((_, reject) => {
                  actionTimer = setTimeout(() => {
                    abortController.abort();
                    reject(new Error('action-timeout'));
                  }, remainingMs);
                }),
              ]);
            } catch (err) {
              if (err.message === 'action-timeout' || abortController.signal.aborted) {
                timedOut = true;
              }
              res = { ok: false, error: err.message || 'action-timeout' };
            } finally {
              if (actionTimer) clearTimeout(actionTimer);
            }

            if (item.settled) {
              activeInFlight = null;
              continue;
            }

            if (timedOut) {
              abortController.abort();
              showError(`${item.kind} 操作超时: 服务端状态未确认`);
              settleItem(item, { ok: false, error: 'action-timeout', serverCommitted: 'unknown' });
              cancelRemainingQueue('aborted-after-failure');
              revertAllControlsToAuthoritative();
              activeInFlight = null;
              break;
            }

            if (!res || !res.ok) {
              showError(`${item.kind} 失败: ${res?.error || '未知错误'}`);
            } else if (res.snapshot) {
              applySnapshot(res.snapshot);
            }
            settleItem(item, res);
            activeInFlight = null;
          }
        }
      } finally {
        activeInFlight = null;
        workerRunning = false;
      }
    })();
  }

  function applySettingSerialized(key, targetVal) {
    return new Promise((resolve, reject) => {
      let lastBarrierIndex = -1;
      for (let i = actionQueue.length - 1; i >= 0; i--) {
        if (actionQueue[i].kind === 'preset' || actionQueue[i].kind.startsWith('wallpaper-') || actionQueue[i].kind === 'catalog-refresh') {
          lastBarrierIndex = i;
          break;
        }
      }

      let existingItemIndex = -1;
      for (let i = actionQueue.length - 1; i > lastBarrierIndex; i--) {
        if (actionQueue[i].kind === 'setting' && actionQueue[i].key === key) {
          existingItemIndex = i;
          break;
        }
      }

      if (existingItemIndex !== -1) {
        const existing = actionQueue[existingItemIndex];
        settleItem(existing, { ok: true, superseded: true });
        actionQueue[existingItemIndex] = {
          id: ++actionIdGen,
          kind: 'setting',
          key,
          value: targetVal,
          attempts: 0,
          resolve,
          reject,
          settled: false,
        };
      } else {
        actionQueue.push({
          id: ++actionIdGen,
          kind: 'setting',
          key,
          value: targetVal,
          attempts: 0,
          resolve,
          reject,
          settled: false,
        });
      }

      runActionQueue();
    });
  }

  function dispatchPresetActionSerialized(type) {
    if (!client || !isConnected || !targetSceneId) {
      showError('无法执行预设操作：未连接或目标壁纸不可用');
      return Promise.resolve({ ok: false, error: 'target-unavailable' });
    }
    const expectedSceneId = targetSceneId;
    return new Promise((resolve, reject) => {
      actionQueue.push({
        id: ++actionIdGen,
        kind: 'preset',
        action: type,
        expectedSceneId,
        resolve,
        reject,
        settled: false,
      });
      runActionQueue();
    });
  }

  // Handlers for Visual adjustments
  async function handleBrightnessChange(val) {
    const bounds = RANGE_BOUNDS.brightness;
    const clamped = parseClamped(val, bounds.min, bounds.max, 70);
    if (sliderBrightness) sliderBrightness.value = String(clamped);
    if (inputBrightness) inputBrightness.value = String(clamped);
    return applySettingSerialized('brightness', clamped);
  }

  async function handleMaskChange(val) {
    const bounds = RANGE_BOUNDS.mask;
    const clamped = parseClamped(val, bounds.min, bounds.max, 45);
    if (sliderMask) sliderMask.value = String(clamped);
    if (inputMask) inputMask.value = String(clamped);
    return applySettingSerialized('mask', clamped);
  }

  async function handleBlurChange(val) {
    const bounds = RANGE_BOUNDS.blur;
    const clamped = parseClamped(val, bounds.min, bounds.max, 0);
    if (sliderBlur) sliderBlur.value = String(clamped);
    if (inputBlur) inputBlur.value = String(clamped);
    return applySettingSerialized('blur', clamped);
  }

  async function handleSurfaceChange(val) {
    const bounds = RANGE_BOUNDS.surface;
    const clamped = parseClamped(val, bounds.min, bounds.max, 82);
    if (sliderSurface) sliderSurface.value = String(clamped);
    if (inputSurface) inputSurface.value = String(clamped);
    return applySettingSerialized('surface', clamped);
  }

  // Handlers for Interface customizations
  async function handleChatBackdropChange(val) {
    const bounds = RANGE_BOUNDS.chatBackdrop;
    const clamped = parseClamped(val, bounds.min, bounds.max, 0);
    if (sliderChatBackdrop) sliderChatBackdrop.value = String(clamped);
    if (inputChatBackdrop) inputChatBackdrop.value = String(clamped);
    return applySettingSerialized('chatBackdrop', clamped);
  }

  async function handleThemeChange(theme) {
    if (!ALLOWED_ENUMS.theme.includes(theme)) return;
    if (btnThemeMist) {
      btnThemeMist.classList.toggle('is-active', theme === 'mist');
      btnThemeMist.setAttribute('aria-pressed', String(theme === 'mist'));
    }
    if (btnThemeAbyss) {
      btnThemeAbyss.classList.toggle('is-active', theme === 'abyss');
      btnThemeAbyss.setAttribute('aria-pressed', String(theme === 'abyss'));
    }
    return applySettingSerialized('theme', theme);
  }

  async function handlePaletteChange(palette) {
    if (!ALLOWED_ENUMS.palette.includes(palette)) return;
    return applySettingSerialized('palette', palette);
  }

  async function handleTextContrastChange(contrast) {
    if (!ALLOWED_ENUMS.textContrast.includes(contrast)) return;
    return applySettingSerialized('textContrast', contrast);
  }

  async function handleAccentModeChange(mode) {
    if (!ALLOWED_ENUMS.accentMode.includes(mode)) return;
    if (accentColorPickerWrap) {
      accentColorPickerWrap.classList.toggle('hidden', mode !== 'custom');
    }
    return applySettingSerialized('accentMode', mode);
  }

  async function handleAccentColorChange(hex) {
    if (typeof hex !== 'string') return;
    const normalized = hex.startsWith('#') ? hex.toLowerCase() : `#${hex.toLowerCase()}`;
    if (!HEX_COLOR_PATTERN.test(normalized)) return;
    if (textAccentHex) textAccentHex.textContent = normalized;
    if (inputAccentColor) inputAccentColor.value = normalized;
    return applySettingSerialized('accentColor', normalized);
  }

  function playbackSettingsEditable() {
    if (!client || !isConnected || !currentSnapshot) return false;
    const wp = currentSnapshot.wallpaper || {};
    const wpState = wp.state || 'idle';
    const cleanupPending = Boolean(wp.cleanupPending);
    const activeSceneId = isSceneId(wp.activeSceneId) ? wp.activeSceneId : (isSceneId(wp.host && wp.host.activeSceneId) ? wp.host.activeSceneId : null);
    return (wpState === 'idle' || wpState === 'stopped' || wpState === 'error') && !cleanupPending && wpState !== 'cleanup-failed' && activeSceneId == null;
  }

  async function handlePlaybackModeChange(mode) {
    if (!playbackSettingsEditable()) return;
    if (!ALLOWED_ENUMS.weMode.includes(mode)) return;
    return applySettingSerialized('weMode', mode);
  }

  async function handleAutoStartChange(enabled) {
    if (!playbackSettingsEditable()) return;
    if (enabled !== true && enabled !== false) return;
    return applySettingSerialized('weAutoStart', enabled === true);
  }

  // Preset operations
  function handleSavePreset() {
    return dispatchPresetActionSerialized('save');
  }

  function handleApplyPreset() {
    return dispatchPresetActionSerialized('apply');
  }

  function handleRemovePreset() {
    return dispatchPresetActionSerialized('remove');
  }

  function bindInputBlurRecovery(input, key, defaultVal) {
    if (!input) return;
    input.addEventListener('blur', () => {
      if (hasPendingOrInFlight(key)) {
        const pendingVal = getLatestPendingOrInFlightValue(key);
        if (pendingVal !== undefined) {
          input.value = String(pendingVal);
          return;
        }
      }
      const confirmedVal = currentSnapshot?.settings?.[key] ?? defaultVal;
      input.value = String(confirmedVal);
    });
  }

  // Event wiring
  // 1. Visual range controls (support real-time dragging via 'input')
  if (sliderBrightness) {
    sliderBrightness.addEventListener('input', (e) => handleBrightnessChange(e.target.value));
  }
  if (inputBrightness) {
    inputBrightness.addEventListener('change', (e) => handleBrightnessChange(e.target.value));
    bindInputBlurRecovery(inputBrightness, 'brightness', 70);
  }
  if (sliderMask) {
    sliderMask.addEventListener('input', (e) => handleMaskChange(e.target.value));
  }
  if (inputMask) {
    inputMask.addEventListener('change', (e) => handleMaskChange(e.target.value));
    bindInputBlurRecovery(inputMask, 'mask', 45);
  }
  if (sliderBlur) {
    sliderBlur.addEventListener('input', (e) => handleBlurChange(e.target.value));
  }
  if (inputBlur) {
    inputBlur.addEventListener('change', (e) => handleBlurChange(e.target.value));
    bindInputBlurRecovery(inputBlur, 'blur', 0);
  }
  if (sliderSurface) {
    sliderSurface.addEventListener('input', (e) => handleSurfaceChange(e.target.value));
  }
  if (inputSurface) {
    inputSurface.addEventListener('change', (e) => handleSurfaceChange(e.target.value));
    bindInputBlurRecovery(inputSurface, 'surface', 82);
  }

  // 2. Interface controls
  if (btnThemeMist) {
    btnThemeMist.addEventListener('click', () => handleThemeChange('mist'));
  }
  if (btnThemeAbyss) {
    btnThemeAbyss.addEventListener('click', () => handleThemeChange('abyss'));
  }
  if (btnPaletteOcean) {
    btnPaletteOcean.addEventListener('click', () => handlePaletteChange('ocean'));
  }
  if (btnPaletteGraphite) {
    btnPaletteGraphite.addEventListener('click', () => handlePaletteChange('graphite'));
  }
  if (btnPaletteViolet) {
    btnPaletteViolet.addEventListener('click', () => handlePaletteChange('violet'));
  }
  if (btnPaletteJade) {
    btnPaletteJade.addEventListener('click', () => handlePaletteChange('jade'));
  }
  if (btnContrastStandard) {
    btnContrastStandard.addEventListener('click', () => handleTextContrastChange('standard'));
  }
  if (btnContrastEnhanced) {
    btnContrastEnhanced.addEventListener('click', () => handleTextContrastChange('enhanced'));
  }
  if (sliderChatBackdrop) {
    sliderChatBackdrop.addEventListener('input', (e) => handleChatBackdropChange(e.target.value));
  }
  if (inputChatBackdrop) {
    inputChatBackdrop.addEventListener('change', (e) => handleChatBackdropChange(e.target.value));
    bindInputBlurRecovery(inputChatBackdrop, 'chatBackdrop', 0);
  }
  if (btnAccentTheme) {
    btnAccentTheme.addEventListener('click', () => handleAccentModeChange('theme'));
  }
  if (btnAccentCustom) {
    btnAccentCustom.addEventListener('click', () => handleAccentModeChange('custom'));
  }
  if (inputAccentColor) {
    inputAccentColor.addEventListener('input', (e) => handleAccentColorChange(e.target.value));
    inputAccentColor.addEventListener('change', (e) => handleAccentColorChange(e.target.value));
  }

  // 3. Preset buttons
  if (btnPresetSave) {
    btnPresetSave.addEventListener('click', () => handleSavePreset());
  }
  if (btnPresetApply) {
    btnPresetApply.addEventListener('click', () => handleApplyPreset());
  }
  if (btnPresetDelete) {
    btnPresetDelete.addEventListener('click', () => handleRemovePreset());
  }

  // 3b. Navigation & View Switcher (Narrow mode)
  if (tabBtnGallery) {
    tabBtnGallery.addEventListener('click', () => switchTab('gallery'));
  }
  if (tabBtnDetails) {
    tabBtnDetails.addEventListener('click', () => switchTab('details'));
  }
  if (btnBackToGallery) {
    btnBackToGallery.addEventListener('click', () => switchTab('gallery'));
  }

  // 3c. Wallpaper Gallery & Playback Actions
  if (btnRefreshCatalog) {
    btnRefreshCatalog.addEventListener('click', () => handleRefreshCatalog());
  }
  if (selectPlaybackMode) {
    selectPlaybackMode.addEventListener('change', (event) => {
      const el = event && event.currentTarget;
      if (!el || el.disabled) return;
      const next = typeof el.value === 'string' ? el.value : '';
      if (next !== 'daily' && next !== 'preview') return;
      Promise.resolve(handlePlaybackModeChange(next)).catch((err) => {
        showError(err && err.message ? err.message : '播放模式保存失败');
      });
    });
  }
  if (checkboxAutoStart) {
    checkboxAutoStart.addEventListener('change', (event) => {
      const el = event && event.currentTarget;
      if (!el || el.disabled) return;
      if (el.checked !== true && el.checked !== false) return;
      Promise.resolve(handleAutoStartChange(el.checked === true)).catch((err) => {
        showError(err && err.message ? err.message : '自动播放保存失败');
      });
    });
  }
  if (btnStartWallpaper) {
    btnStartWallpaper.addEventListener('click', () => handleStartWallpaper());
  }
  if (btnStopWallpaper) {
    btnStopWallpaper.addEventListener('click', () => handleStopWallpaper());
  }
  if (filterRatingEveryone) {
    filterRatingEveryone.addEventListener('change', handleAgeFilterChange);
  }
  if (filterRatingQuestionable) {
    filterRatingQuestionable.addEventListener('change', handleAgeFilterChange);
  }
  if (filterRatingMature) {
    filterRatingMature.addEventListener('change', handleAgeFilterChange);
  }

  // 3d. Object URL cleanup on unload
  if (windowObj && windowObj.addEventListener) {
    windowObj.addEventListener('pagehide', disposeBlobUrls);
    windowObj.addEventListener('beforeunload', disposeBlobUrls);
  }

  // 4. Footer buttons
  if (btnDock) {
    btnDock.addEventListener('click', async () => {
      if (!client || !isConnected) return;
      btnDock.disabled = true;
      setStatus('connecting', '吸附中...');
      try {
        const res = await client.requestDock();
        if (res.ok) {
          setStatus('connected', '已吸附回主界面');
          setControlsEnabled(false);
          try { windowObj.close(); } catch {}
        } else {
          btnDock.disabled = false;
          setStatus('connected', '已连接');
          showError(`吸附失败: ${res.error || '未能完成窗口清理'}`);
        }
      } catch (err) {
        btnDock.disabled = false;
        setStatus('connected', '已连接');
        showError(`吸附异常: ${err.message}`);
      }
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', async () => {
      if (!client || !isConnected) {
        try { windowObj.close(); } catch {}
        return;
      }
      btnClose.disabled = true;
      try {
        await client.closeWindow();
        try { windowObj.close(); } catch {}
      } catch {
        try { windowObj.close(); } catch {}
      }
    });
  }

  // Initialization & Connection
  async function start() {
    if (!token || !instanceId) {
      setStatus('error', '未授权');
      showError('缺少有效的一次性连接凭证，请从主界面重新打开独立窗口。');
      setControlsEnabled(false);
      return;
    }

    setStatus('connecting', '连接中...');
    setControlsEnabled(false);

    const transport = customTransport || createHttpCompanionTransport({
      baseUrl: windowObj.location.origin,
      token,
      instanceId,
    });

    client = createCompanionClient({ transport });

    client.subscribe((state) => {
      if (state.connected) {
        isConnected = true;
        setStatus('connected', '已连接');
        setControlsEnabled(true);
        if (state.snapshot) {
          applySnapshot(state.snapshot);
        }
      } else {
        isConnected = false;
        authorPanel?.update({connected:false});
        cleanupBlobsOnDisconnect();
        setStatus('disconnected', '已断开连接');
        setControlsEnabled(false);
        showError('与宿主主窗口的连接已断开，请在宿主界面重新打开。');
        cancelRemainingQueue('disconnected');
        revertAllControlsToAuthoritative();
      }
    });

    try {
      const conn = await client.connect();
      if (!conn.ok) {
        setStatus('error', '连接失败');
        showError(`连接宿主失败: ${conn.error || '凭证无效或已过期'}`);
        setControlsEnabled(false);
        return;
      }
      isConnected = true;
      setStatus('connected', '已连接');
      setControlsEnabled(true);
      if (conn.snapshot) {
        applySnapshot(conn.snapshot);
      }
    } catch (err) {
      setStatus('error', '连接错误');
      showError(`连接异常: ${err.message}`);
      setControlsEnabled(false);
    }
  }

  return {
    start,
    getClient: () => client,
    getSnapshot: () => currentSnapshot,
    isConnected: () => isConnected,
    switchTab,
    handleSelectWallpaper,
    handleStartWallpaper,
    handleStopWallpaper,
    handleRefreshCatalog,
    handleAgeFilterChange,
    disposeBlobUrls,
    updateGalleryView,
    updateDetailsView,
    handleBrightnessChange,
    handleMaskChange,
    handleBlurChange,
    handleSurfaceChange,
    handleChatBackdropChange,
    handleThemeChange,
    handlePaletteChange,
    handleTextContrastChange,
    handleAccentModeChange,
    handleAccentColorChange,
    handleSavePreset,
    handleApplyPreset,
    handleRemovePreset,
  };
}

// Auto-run if running in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const app = createCompanionApp({ windowObj: window, documentObj: document });
  if (app) {
    app.start().catch((err) => console.error('[Whale Companion] Start failed:', err));
  }
}
