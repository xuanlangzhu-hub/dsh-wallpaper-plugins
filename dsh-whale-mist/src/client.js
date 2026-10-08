window.__ModuleLoader__.load({
  id: "dsh-whale-mist",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { FishLogo } = require("@deepseek-ai/dsh-client-ui-primitives");

    /* WM_FRAME_PROTOCOL */
      const HEADER_BYTES = 24;
      const MAX_FRAME_BYTES = 8 * 1024 * 1024;

      class WM_FRAME_DECODER {
        constructor(onFrame) { this.onFrame = onFrame; this.pending = new Uint8Array(0); }
        push(chunk) {
          if (!(chunk instanceof Uint8Array)) throw new TypeError('Expected byte buffer');
          if (chunk.byteLength > 32 * 1024 * 1024) throw new Error('Oversized input chunk');
          let bytes = chunk;
          if (this.pending.byteLength) {
            bytes = new Uint8Array(this.pending.byteLength + chunk.byteLength);
            bytes.set(this.pending); bytes.set(chunk, this.pending.byteLength);
          }
          let offset = 0;
          while (bytes.byteLength - offset >= HEADER_BYTES) {
            const view = new DataView(bytes.buffer, bytes.byteOffset + offset, HEADER_BYTES);
            if (view.getUint32(0, false) !== 0x57484c31) throw new Error('Invalid WHL1 frame magic');
            const length = view.getUint32(8, true);
            const width = view.getUint16(20, true), height = view.getUint16(22, true);
            const capturedAt = Number(view.getBigInt64(12, true));
            if (!length || length > MAX_FRAME_BYTES || !width || !height || width > 16384 || height > 16384 || !Number.isSafeInteger(capturedAt) || capturedAt <= 0)
              throw new Error('Invalid frame bounds');
            if (bytes.byteLength - offset < HEADER_BYTES + length) break;
            const packet = bytes.subarray(offset, offset + HEADER_BYTES + length);
            this.onFrame({ sequence: view.getUint32(4, true), capturedAt, width, height,
              packet, jpeg: packet.subarray(HEADER_BYTES) });
            offset += HEADER_BYTES + length;
          }
          this.pending = bytes.slice(offset);
        }
        finish() { if (this.pending.byteLength) throw new Error('Truncated frame stream'); }
      }
      /* WM_FRAME_PROTOCOL_END */

    const THEME_ID = "whale-mist";
    const ABYSS_THEME_ID = "whale-abyss";
    const ACTIVE_CLASS = "dsh-whale-mist-active";
    const ABYSS_ACTIVE_CLASS = "dsh-whale-abyss-active";
    const THEME_IDS = Object.freeze({ mist: THEME_ID, abyss: ABYSS_THEME_ID });
    const MANAGED_THEME_IDS = new Set(Object.values(THEME_IDS));
    const STYLE_ID = "dsh-whale-mist/theme.css";
    // Keep the v1 key: new fields are additive and normalizeSettings fills
    // defaults, so existing theme choices survive the upgrade.
    const STORAGE_KEY = "dsh-whale-mist.appearance.v1";
    const DEFAULT_SETTINGS = Object.freeze({
      theme: "abyss",
      palette: "ocean",
      canvas: "soft",
      sidebar: "balanced",
      glass: "standard",
      background: "none",
      motion: "focus",
      weScene: "lucy",
      weMode: "preview",
      weAutoStart: false,
      // Per-region backgrounds: which areas may cover the wallpaper with their own colour. Both
      // default to off, so the visual result stays exactly what the previous release shipped.
      opaqueSidebar: false,
      opaqueChat: false,
      brightness: 70,
      mask: 45,
      blur: 0,
      surface: 82
    });
    const ALLOWED_SETTINGS = Object.freeze({
      theme: Object.freeze(["mist", "abyss"]),
      palette: Object.freeze(["ocean", "graphite", "violet", "jade"]),
      canvas: Object.freeze(["soft", "clear"]),
      sidebar: Object.freeze(["balanced", "deep"]),
      glass: Object.freeze(["standard", "restrained"]),
      background: Object.freeze(["none", "image", "video", "wallpaper"]),
      motion: Object.freeze(["focus", "always"]),
      /** `daily` is the daily-driver mode; `preview` is the supervised time-boxed one. */
      weMode: Object.freeze(["daily", "preview"])
    });
    /** Scene ids come from the Host whitelist; a stale stored value falls back to Lucy. */
    const WALLPAPER_SCENES = Object.freeze(["lucy"]);
    /**
     * The migration default, matching the Host (`DEFAULT_PLAYBACK_MODE = 'preview'`): an older
     * stored setting that predates the mode field stays a time-boxed preview until the user
     * explicitly picks the daily mode.
     */
    const DEFAULT_PLAYBACK_MODE = "preview";
    const RANGE_SETTINGS = Object.freeze({
      brightness: Object.freeze([20, 100]),
      mask: Object.freeze([0, 90]),
      blur: Object.freeze([0, 24]),
      surface: Object.freeze([40, 100])
    });

    function clampRange(key, value) {
      const [min, max] = RANGE_SETTINGS[key];
      return typeof value === "number" && Number.isFinite(value)
        ? Math.round(Math.min(max, Math.max(min, value)))
        : DEFAULT_SETTINGS[key];
    }

    /**
     * Settings that are strictly boolean: anything that is not an explicit `true` reads as false, so
     * an older stored value (the field did not exist) and a corrupt one (a string or a number) both
     * land on the off state instead of switching a region on by accident.
     */
    const BOOLEAN_SETTINGS = Object.freeze(["weAutoStart", "opaqueSidebar", "opaqueChat"]);

    function isValidSetting(key, value) {
      if (Object.hasOwn(ALLOWED_SETTINGS, key)) return ALLOWED_SETTINGS[key].includes(value);
      if (BOOLEAN_SETTINGS.includes(key)) return typeof value === "boolean";
      return Object.hasOwn(RANGE_SETTINGS, key) && typeof value === "number" && Number.isFinite(value);
    }

    function normalizeSettings(value) {
      const source = value && typeof value === "object" ? value : {};
      return {
        ...Object.fromEntries(Object.entries(ALLOWED_SETTINGS).map(([key, allowed]) => [
          key,
          allowed.includes(source[key]) ? source[key] : DEFAULT_SETTINGS[key]
        ])),
        ...Object.fromEntries(Object.keys(RANGE_SETTINGS).map((key) => [key, clampRange(key, source[key])])),
        weScene: WALLPAPER_SCENES.includes(source.weScene) ? source.weScene : DEFAULT_SETTINGS.weScene,
        // Opt-in flags: only an explicit boolean true turns one on.
        ...Object.fromEntries(BOOLEAN_SETTINGS.map((key) => [key, source[key] === true]))
      };
    }

    function readSettings() {
      try {
        return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    }

    function persistSettings(settings) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {}
    }

    const PROJECTED_VARIABLES = Object.freeze({
      brightness: ["--wm-bg-brightness", (value) => String(value / 100)],
      mask: ["--wm-bg-mask", (value) => String(value / 100)],
      blur: ["--wm-bg-blur", (value) => `${value}px`],
      surface: ["--wm-ui-alpha", (value) => String(value / 100)]
    });
    /** Region switches are projected as body attributes, one per region. */
    const PROJECTED_FLAGS = Object.freeze({
      opaqueSidebar: "wmOpaqueSidebar",
      opaqueChat: "wmOpaqueChat"
    });

    function projectSettings(settings) {
      const body = document.body;
      body.dataset.wmTheme = settings.theme;
      body.dataset.wmPalette = settings.palette;
      body.dataset.wmCanvas = settings.canvas;
      body.dataset.wmSidebar = settings.sidebar;
      body.dataset.wmGlass = settings.glass;
      for (const [key, name] of Object.entries(PROJECTED_FLAGS)) {
        if (settings[key]) body.dataset[name] = "true";
        else delete body.dataset[name];
      }
      for (const [key, [name, format]] of Object.entries(PROJECTED_VARIABLES)) {
        body.style.setProperty(name, format(settings[key]));
      }
    }

    function clearProjection() {
      const body = document.body;
      for (const key of ["wmTheme", "wmPalette", "wmCanvas", "wmSidebar", "wmGlass"]) delete body.dataset[key];
      for (const name of Object.values(PROJECTED_FLAGS)) delete body.dataset[name];
      for (const [name] of Object.values(PROJECTED_VARIABLES)) body.style.removeProperty(name);
    }

    // Dark palettes layered on top of Whale Abyss. `ocean` is the registered
    // Abyss token set itself, so the default look stays byte-for-byte as before.
    const PALETTES = Object.freeze({
      graphite: Object.freeze({
        base: [11, 11, 13], primary: [16, 16, 19], l1: [22, 22, 26], l2: [31, 31, 36], l3: [38, 38, 44],
        sidebar: [18, 18, 21], sidebarDeep: [12, 12, 14], border: [140, 143, 154],
        accent: [127, 156, 199], citation: "#a9bfdf", button: "#5d79a3", buttonHover: "#7190bd",
        glow: [127, 156, 199, 0.07], glow2: [120, 124, 136, 0.08]
      }),
      violet: Object.freeze({
        base: [13, 9, 18], primary: [18, 13, 26], l1: [25, 18, 37], l2: [35, 25, 50], l3: [42, 31, 59],
        sidebar: [21, 15, 31], sidebarDeep: [14, 10, 21], border: [156, 134, 186],
        accent: [176, 124, 240], citation: "#c9a4ff", button: "#8853d0", buttonHover: "#9c6be0",
        glow: [176, 104, 232, 0.15], glow2: [214, 92, 168, 0.08]
      }),
      jade: Object.freeze({
        base: [7, 16, 13], primary: [10, 21, 18], l1: [14, 29, 24], l2: [20, 39, 33], l3: [26, 47, 40],
        sidebar: [12, 25, 21], sidebarDeep: [8, 17, 14], border: [122, 168, 152],
        accent: [86, 199, 157], citation: "#7fdcb6", button: "#2c8a6b", buttonHover: "#37a07e",
        glow: [72, 190, 146, 0.1], glow2: [64, 132, 151, 0.1]
      })
    });
    const PALETTE_SWATCHES = Object.freeze({
      ocean: ["#0b111d", "#8c72f2"],
      graphite: ["#16161a", "#7f9cc7"],
      violet: ["#19121f", "#b07cf0"],
      jade: ["#0e1d18", "#56c79d"]
    });

    const rgb = (color, alpha) => alpha === undefined
      ? `rgb(${color.join(" ")})`
      : `rgb(${color.join(" ")} / ${alpha})`;
    const mix = (a, b, weight = 0.5) => a.map((value, index) => Math.round(value * (1 - weight) + b[index] * weight));
    const scale = (color, factor) => color.map((value) => Math.round(value * factor));

    function paletteCss(id, p) {
      const s = `body.${ABYSS_ACTIVE_CLASS}[data-wm-palette="${id}"]`;
      const mid = mix(p.l1, p.l2);
      const deepBase = scale(p.base, 0.86);
      return `
      ${s} {
        --wm-base-rgb: ${p.base.join(" ")};
        --wm-sidebar-rgb: ${p.sidebar.join(" ")};
        --wm-layer1-rgb: ${p.l1.join(" ")};
        --wm-layer2-rgb: ${p.l2.join(" ")};
        --wm-layer3-rgb: ${p.l3.join(" ")};
        --wm-accent-rgb: ${p.accent.join(" ")};
        --dsw-alias-bg-base: ${rgb(p.base)} !important;
        --dsw-alias-bg-primary: ${rgb(p.primary)} !important;
        --dsw-alias-bg-layer-1: ${rgb(p.l1, 0.94)} !important;
        --dsw-alias-bg-layer-2: ${rgb(p.l2, 0.92)} !important;
        --dsw-alias-bg-layer-3: ${rgb(p.l3, 0.96)} !important;
        --dsw-alias-bg-overlay: ${rgb(p.l2, 0.98)} !important;
        --dsw-alias-bg-module-platform: ${rgb(mid, 0.9)} !important;
        --dsw-alias-border-l2: ${rgb(p.border, 0.16)} !important;
        --dsw-alias-border-l2-darkmode-thin: ${rgb(p.border, 0.13)} !important;
        --dsw-alias-border-l3: ${rgb(p.border, 0.23)} !important;
        --dsw-alias-border-l4: ${rgb(p.border, 0.32)} !important;
        --dsw-alias-border-secondary: ${rgb(p.border, 0.18)} !important;
        --dsw-alias-line-secondary: ${rgb(p.border, 0.13)} !important;
        --dsw-alias-separator-primary: ${rgb(p.border, 0.12)} !important;
        --dsw-alias-brand-primary: ${rgb(p.accent)} !important;
        --dsw-alias-brand-primary-new-colorprimary-new-color: ${rgb(p.accent)} !important;
        --dsw-alias-button-primary-fill: ${p.button} !important;
        --dsw-alias-button-primary-hover: ${p.buttonHover} !important;
        --dsw-alias-button-info-fill: ${rgb(p.accent, 0.18)} !important;
        --dsw-alias-button-info-hover: ${rgb(p.accent, 0.26)} !important;
        --dsw-alias-button-elevated-fill: ${rgb(p.l3, 0.92)} !important;
        --dsw-alias-button-floating-fill: ${rgb(p.l2, 0.96)} !important;
        --dsw-alias-button-floating-hover: ${rgb(p.l3, 0.98)} !important;
        --dsw-alias-button-ghost-active-fill: ${rgb(p.accent, 0.2)} !important;
        --dsw-alias-interactive-bg-primary: ${rgb(p.accent, 0.16)} !important;
        --dsw-alias-interactive-bg-active: ${rgb(p.accent, 0.2)} !important;
        --dsw-alias-interactive-bg-hover-solid: ${rgb(mix(p.l2, p.l3))} !important;
        --dsw-alias-fill-l2: ${rgb(p.border, 0.16)} !important;
        --dsw-alias-scrollbar-bg-l2: ${rgb(p.border, 0.28)} !important;
        --dsw-alias-scrollbar-hover-l2: ${rgb(p.border, 0.42)} !important;
        --dsw-alias-markdown-citation: ${p.citation} !important;
        --dsw-alias-markdown-code-block: ${rgb(scale(p.primary, 0.92), 0.94)} !important;
        --dsw-alias-markdown-code-block-banner: ${rgb(mid, 0.98)} !important;
        --dsw-alias-state-business-primary: ${p.citation} !important;
        --dsw-alias-state-business-tertiary: ${rgb(p.accent, 0.2)} !important;
        --dsw-specific-sidebar-fill: ${rgb(p.sidebar, 0.94)} !important;
        --dsw-specific-sidebar-nav-item-active: ${rgb(p.accent, 0.16)} !important;
        --dsw-specific-sidebar-nav-item-active-accent: ${rgb(p.accent)} !important;
        --dsw-specific-input-major: linear-gradient(180deg, ${rgb(p.l2)} 0%, ${rgb(mid)} 100%) !important;
        --dsw-specific-bubble: ${rgb(scale(p.accent, 0.5), 0.46)} !important;
        --dsw-specific-menu: ${rgb(mid, 0.98)} !important;
        --dsw-specific-selector: ${rgb(p.l3, 0.94)} !important;
        --dsw-specific-tip: ${rgb(p.l2, 0.96)} !important;
        background:
          radial-gradient(60rem 38rem at 82% -14%, ${rgb(p.glow.slice(0, 3), p.glow[3])} 0%, transparent 66%),
          radial-gradient(46rem 34rem at -12% 78%, ${rgb(p.glow2.slice(0, 3), p.glow2[3])} 0%, transparent 72%),
          linear-gradient(145deg, ${rgb(p.primary)} 0%, ${rgb(p.base)} 52%, ${rgb(deepBase)} 100%);
      }

      ${s}::before {
        background: linear-gradient(108deg, ${rgb(p.border, 0.025)}, transparent 38%, ${rgb(p.accent, 0.035)});
      }

      ${s}[data-wm-canvas="clear"] {
        --dsw-alias-bg-base: ${rgb(p.base)} !important;
        --dsw-alias-bg-layer-1: ${rgb(p.l1)} !important;
        --dsw-alias-bg-layer-2: ${rgb(p.l2)} !important;
        background:
          radial-gradient(58rem 36rem at 84% -16%, ${rgb(p.glow.slice(0, 3), p.glow[3] * 0.7)} 0%, transparent 68%),
          linear-gradient(145deg, ${rgb(mix(p.primary, p.l1, 0.2))} 0%, ${rgb(p.base)} 58%, ${rgb(deepBase)} 100%);
      }

      ${s}[data-wm-sidebar="deep"] {
        --wm-sidebar-rgb: ${p.sidebarDeep.join(" ")};
        --dsw-specific-sidebar-fill: ${rgb(p.sidebarDeep, 0.98)} !important;
        --dsw-specific-sidebar-nav-item-active: ${rgb(p.accent, 0.18)} !important;
      }

      ${s}[data-wm-glass="restrained"] {
        --dsw-alias-bg-layer-1: ${rgb(p.l1, 0.985)} !important;
        --dsw-alias-bg-layer-2: ${rgb(p.l2, 0.985)} !important;
        --dsw-alias-bg-layer-3: ${rgb(p.l3, 0.99)} !important;
        --dsw-alias-bg-overlay: ${rgb(p.l2)} !important;
        --dsw-specific-menu: ${rgb(mid)} !important;
        --dsw-specific-selector: ${rgb(p.l3)} !important;
        --dsw-mask-blur: blur(12px) saturate(106%) !important;
      }

      ${s} .wm-session-status {
        background: ${rgb(mid, 0.9)};
      }

      @media (prefers-reduced-transparency: reduce) {
        ${s} {
          --dsw-alias-bg-layer-1: ${rgb(p.l1)} !important;
          --dsw-alias-bg-layer-2: ${rgb(p.l2)} !important;
          --dsw-alias-bg-overlay: ${rgb(p.l2)} !important;
          --dsw-specific-sidebar-fill: ${rgb(p.l1)} !important;
          --dsw-specific-input-major: ${rgb(p.l2)} !important;
          --dsw-specific-menu: ${rgb(mid)} !important;
          --dsw-mask-blur: none !important;
        }
      }

      @media (prefers-contrast: more) {
        ${s} {
          --dsw-alias-border-l2: ${rgb(p.border, 0.38)} !important;
          --dsw-alias-border-l3: ${rgb(p.border, 0.52)} !important;
          --dsw-alias-bg-layer-1: ${rgb(p.l1, 0.99)} !important;
        }
      }
      `;
    }

    // User-picked wallpapers live in this origin's IndexedDB. The plugin never
    // receives a filesystem path and the Host exposes no file route, so a
    // stored Blob is the only thing the background layer can ever read.
    const MEDIA_DB = "dsh-whale-mist.media";
    const MEDIA_STORE = "backgrounds";
    const MEDIA_LIMITS = Object.freeze({ image: 64 * 1024 * 1024, video: 1024 * 1024 * 1024 });

    function openMediaDb() {
      return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
          reject(new Error("IndexedDB unavailable"));
          return;
        }
        const request = indexedDB.open(MEDIA_DB, 1);
        let blocked = false;
        request.onupgradeneeded = () => request.result.createObjectStore(MEDIA_STORE);
        request.onsuccess = () => {
          if (blocked) { request.result.close(); return; }
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => { blocked = true; reject(new Error("IndexedDB blocked")); };
      });
    }

    async function mediaTransaction(mode, run) {
      const db = await openMediaDb();
      try {
        return await new Promise((resolve, reject) => {
          const transaction = db.transaction(MEDIA_STORE, mode);
          const request = run(transaction.objectStore(MEDIA_STORE));
          let result;
          request.onsuccess = () => { result = request.result; };
          transaction.oncomplete = () => resolve(result);
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
        });
      } finally {
        db.close();
      }
    }

    const readMedia = (kind) => mediaTransaction("readonly", (store) => store.get(kind));
    const writeMedia = (kind, record) => mediaTransaction("readwrite", (store) => store.put(record, kind));
    const deleteMedia = (kind) => mediaTransaction("readwrite", (store) => store.delete(kind));

    function describeMedia(record) {
      return record && record.blob instanceof Blob
        ? { name: String(record.name || ""), size: record.blob.size, type: record.blob.type }
        : null;
    }

    /**
     * Wallpaper Engine preview transport.
     *
     * The Host owns the native window and the capture process; this side only sends
     * constrained actions (`start` / `stop` / `restart` plus a scene id) and reads the
     * authenticated frame stream. It never sends a path, a command or a window handle.
     */
    function createWallpaperEngine({ fetchImpl = (...args) => fetch(...args), now = () => Date.now(), firstFrameTimeoutMs, idleTimeoutMs, retryDelayMs, hostStatusTimeoutMs } = {}) {
      firstFrameTimeoutMs = firstFrameTimeoutMs ?? 20000;
      idleTimeoutMs = idleTimeoutMs ?? 8000;
      retryDelayMs = retryDelayMs ?? 400;
      hostStatusTimeoutMs = hostStatusTimeoutMs ?? 4000;
      const listeners = new Set();
      const statusListeners = new Set();
      const frameListeners = new Set();
      // Subscriptions of the layer: a stall (not a terminal state) hides the last frame
      // while the client keeps trying to recover.
      const stallListeners = new Set();
      let hideStalledFrames = false;
      let running = false;
      let busy = false;
      let disposed = false;
      let abort = null;
      let pollTimer = null;
      let status = Object.freeze({ state: "idle", error: "", host: null, generation: 0 });
      const metrics = { received: 0, rendered: 0, dropped: 0, sourceSequence: 0, decodeErrors: 0 };
      let latest = null;
      let painting = false;
      let frameRequest = 0;
      let startedAt = 0;
      let latencySum = 0;
      let latencyMax = 0;
      let lastFrameAt = 0;
      // Every start/stop/switch gets a new generation. Responses, decoded frames and
      // stream callbacks from an older generation can never change the current state,
      // so a late start reply cannot revive a run the user already stopped.
      let generation = 0;
      let lastCleanup = null;

      const emitStatus = (patch) => {
        status = Object.freeze({ ...status, ...patch });
        statusListeners.forEach(listener => listener(status));
      };
      const emitFrame = (bitmap, frame) => frameListeners.forEach(listener => listener(bitmap, frame));
      const notifyStop = (reason) => listeners.forEach(listener => listener(reason));
      const notifyStalled = () => stallListeners.forEach(listener => listener());

      const snapshot = () => ({ ...metrics, seconds: startedAt ? (now() - startedAt) / 1000 : 0,
        meanLatencyMs: metrics.rendered ? latencySum / metrics.rendered : 0, maxLatencyMs: latencyMax,
        hidden: Number(document.hidden) });

      const reportMetrics = () => {
        if (!running) return;
        fetchImpl("/whale-wallpaper/metrics", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(snapshot()), keepalive: true }).catch(() => {});
      };

      const paint = async (runGeneration) => {
        frameRequest = 0;
        if (!running || painting || !latest || document.hidden || runGeneration !== generation) return;
        painting = true;
        const frame = latest; latest = null;
        let bitmap = null;
        try {
          bitmap = await createImageBitmap(new Blob([frame.jpeg], { type: "image/jpeg" }));
          if (running && !document.hidden && runGeneration === generation) {
            metrics.rendered++; metrics.sourceSequence = frame.sequence;
            const latency = Math.max(0, now() - frame.capturedAt);
            latencySum += latency; latencyMax = Math.max(latencyMax, latency);
            emitFrame(bitmap, frame);
            emitStatus({ rendered: metrics.rendered, decodeErrors: metrics.decodeErrors, state: "playing", error: "" });
            bitmap = null;                      // ownership moved to the layer
          }
        } catch { metrics.decodeErrors++; }
        finally {
          bitmap?.close?.();
          painting = false;
          if (latest && running && !document.hidden) schedulePaint(generation);
        }
      };

      // requestAnimationFrame keeps painting aligned with the display, but it does not
      // fire in a hidden or non-composited page (and may hand back 0). The timeout
      // backstop guarantees an already running preview still paints instead of stalling.
      let paintBackstop = 0;
      let paintFrameId = 0;
      const schedulePaint = (runGeneration) => {
        if (frameRequest || painting || runGeneration !== generation) return;
        const run = () => {
          window.clearTimeout(paintBackstop);
          cancelAnimationFrame(paintFrameId);
          paintBackstop = 0; paintFrameId = 0; frameRequest = 0;
          if (latest) paint(runGeneration);
        };
        paintFrameId = requestAnimationFrame(run);
        paintBackstop = window.setTimeout(run, 250);
        frameRequest = paintBackstop;
      };

      const accept = (runGeneration, frame) => {
        if (runGeneration !== generation) return;
        metrics.received++; lastFrameAt = now();
        if (latest) metrics.dropped++;
        latest = { ...frame, jpeg: frame.jpeg.slice() };
        if (!painting && !frameRequest && !document.hidden) schedulePaint(runGeneration);
      };

      /**
       * Read frames with two independent bounds, both measured on the client clock so a
       * stalled clock-based check and the deadline agree:
       *  - `idleTimeoutMs` without a frame: the run stops delivering, withdraws the stale
       *    picture and ends as a failure (the Host is then asked to clean up);
       *  - `deadline` for the whole first-frame window: an open connection that never
       *    produces a frame ends the same way instead of waiting forever.
       * Both are enforced by a timer, never by `reader.read`, because an open connection
       * that sends nothing would hang that promise indefinitely.
       */
      async function runStream(runGeneration) {
        // Two bounds, both enforced by the timer below and never by `reader.read`, because an
        // open connection that sends nothing would hang that promise forever:
        //  - silence longer than `idleTimeoutMs` ends the run (the capture stopped, the window
        //    is gone or the machine slept: the Host is asked to clean up);
        //  - `firstFrameTimeoutMs` bounds the wait for the first frame even if short answers
        //    (503 while the capture is being prepared) keep the connection busy.
        // A stream that keeps delivering frames is never overdue, so a healthy preview may
        // run for as long as the Host allows it.
        let attempts = 0;
        let haveFrame = false;
        const startedAt = now();
        while (running && runGeneration === generation) {
          attempts += 1;
          let response;
          try {
            response = await fetchImpl("/whale-wallpaper/stream", { signal: abort?.signal, cache: "no-store" });
          } catch (error) {
            if (!running || runGeneration !== generation) return { ending: "stopped" };
            if (!haveFrame && now() - startedAt > firstFrameTimeoutMs) return { ending: "first-frame-timeout", error: "first-frame-timeout" };
            emitStatus({ state: haveFrame ? "waiting" : "connecting", error: "", attempts });
            await new Promise(resolve => window.setTimeout(resolve, retryDelayMs));
            continue;
          }
          if (!response.ok || !response.body) {
            if (!running || runGeneration !== generation) return { ending: "stopped" };
            if (!haveFrame && now() - startedAt > firstFrameTimeoutMs) return { ending: "first-frame-timeout", error: "first-frame-timeout" };
            emitStatus({ state: haveFrame ? "waiting" : "connecting", error: "", attempts });
            await new Promise(resolve => window.setTimeout(resolve, retryDelayMs));
            continue;
          }
          const decoder = new WM_FRAME_DECODER(frame => { haveFrame = true; accept(runGeneration, frame); });
          const reader = response.body.getReader();
          let stallOutcome = null;
          let watchdog = 0;
          const onAbort = () => {
            if (stallOutcome) return;
            if (watchdog) { window.clearInterval(watchdog); watchdog = 0; }
            // The wait may have ended the run; do not let a pending read keep it open.
            reader.cancel?.().catch(() => {});
          };
          abort?.signal.addEventListener("abort", onAbort, { once: true });
          watchdog = window.setInterval(() => {
            if (stallOutcome) return;
            if (!running || runGeneration !== generation) { window.clearInterval(watchdog); watchdog = 0; return; }
            const idle = now() - lastFrameAt;
            const firstFrameOverdue = !haveFrame && now() - startedAt > firstFrameTimeoutMs;
            if (idle < idleTimeoutMs && !firstFrameOverdue) return;
            stallOutcome = firstFrameOverdue
              ? { ending: "first-frame-timeout", error: "first-frame-timeout" }
              : { ending: "no-frames", error: "no-frames" };
            window.clearInterval(watchdog); watchdog = 0;
            emitStatus({ state: "waiting", error: "" });
            hideStalledFrames = true;
            notifyStalled();
            abort?.abort();
            reader.cancel?.().catch(() => {});
          }, Math.max(250, Math.min(1000, Math.floor(idleTimeoutMs / 4))));
          try {
            while (running && runGeneration === generation) {
              const { value, done } = await reader.read();
              if (done) break;
              decoder.push(value);
            }
            if (running && runGeneration === generation && !stallOutcome) decoder.finish();
          } catch (error) {
            if (!running || runGeneration !== generation) return { ending: "stopped" };
            if (!stallOutcome) return { ending: "stream-error", error: String(error?.message || "stream-failed") };
          } finally {
            if (watchdog) { window.clearInterval(watchdog); watchdog = 0; }
            abort?.signal.removeEventListener("abort", onAbort);
            reader.releaseLock?.();
          }
          if (!running || runGeneration !== generation) return { ending: "stopped" };
          // Silence longer than the idle bound is terminal: a preview that stopped delivering
          // frames is over, and the caller closes the Host resources for it.
          if (stallOutcome) return stallOutcome;
          // The stream ended while the run is still active: the preview hit its time limit
          // or the capture stopped. Report it and let the layer drop the last frame.
          return { ending: "stream-end" };
        }
        return { ending: "stopped" };
      }

      /** Every run reports only its own frames, latency and source sequence. */
      const resetRunMetrics = () => {
        metrics.received = 0; metrics.rendered = 0; metrics.dropped = 0;
        metrics.sourceSequence = 0; metrics.decodeErrors = 0;
        latencySum = 0; latencyMax = 0;
        hideStalledFrames = false;
      };

      async function connect(runGeneration) {
        abort = new AbortController();
        // This engine object lives for the whole page, so the counters must be cleared for
        // each new run; otherwise the UI shows the previous run's totals with this run's
        // seconds, which makes the frame rate look far too high. Only the generation that
        // really started is allowed to reset anything.
        if (runGeneration === generation) { resetRunMetrics(); emitStatus({ rendered: 0, decodeErrors: 0 }); }
        emitStatus({ state: "connecting", error: "" });
        pollTimer = window.setInterval(() => {
          if (!running || runGeneration !== generation) return;
          reportMetrics();
          const seconds = snapshot().seconds;
          if (hideStalledFrames) { hideStalledFrames = false; return; }
          const fresh = now() - lastFrameAt < idleTimeoutMs;
          // A preview that stopped delivering frames stops presenting the last one: the
          // ordinary theme comes back while the client keeps trying to recover.
          emitStatus(fresh
            ? { state: "playing", error: "", rendered: metrics.rendered, decodeErrors: metrics.decodeErrors, seconds }
            : { state: "waiting", error: "", rendered: metrics.rendered, decodeErrors: metrics.decodeErrors, seconds });
        }, 500);
        const outcome = await runStream(runGeneration);
        window.clearInterval(pollTimer); pollTimer = null;
        if (!running || runGeneration !== generation || outcome.ending === "stopped") return;
        running = false; busy = false;
        const message = outcome.ending === "stream-end" ? "" : String(outcome.error || outcome.ending);
        const failed = outcome.ending !== "stream-end";
        emitStatus({ state: failed ? "error" : "stopped", error: message,
          rendered: metrics.rendered, decodeErrors: metrics.decodeErrors });
        notifyStop(failed ? "failed" : "ended");
        // A failed run must not leave its Host resources behind; the close result is
        // reported so an unproven cleanup is visible instead of being swallowed.
        if (failed) await stop("failed", { bump: false });
      }

      async function command(action, body = {}) {
        const response = await fetchImpl(`/whale-wallpaper/${action}`, { method: "POST",
          headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const payload = await response.json().catch(() => ({}));
        return { ok: response.ok, payload };
      }

      const invalidate = () => { generation += 1; return generation; };

      const stop = (reason = "user", { bump = true } = {}) => {
        // A user stop uses a new generation so a late start reply cannot revive the run.
        // The internal close that follows a terminal failure keeps the generation: that run
        // is already over, and bumping it would erase the failure the user must see.
        const stopGeneration = bump ? invalidate() : generation;
        const keptError = reason === "failed" ? status.error : "";
        const keptState = reason === "failed" && ["error", "cleanup-failed"].includes(status.state) ? status.state : null;
        running = false; busy = false;
        abort?.abort(); abort = null;
        window.clearInterval(pollTimer); pollTimer = null;
        cancelAnimationFrame(frameRequest); frameRequest = 0;
        latest = null;
        // The ended run keeps no live timing: a later run measures its own elapsed time
        // instead of inheriting the stopped one's total.
        startedAt = 0;
        hideStalledFrames = false;
        emitStatus({ state: keptState ?? (reason === "user" ? "stopped" : "idle"), error: keptError, generation: stopGeneration, seconds: 0 });
        // The layer is dropped right away; a close that cannot be proven is reported
        // afterwards so the UI can say so instead of pretending the run stopped cleanly.
        notifyStop(reason);
        return command("stop").then(({ ok, payload }) => {
          lastCleanup = payload?.cleanup ?? payload?.lastCleanup ?? null;
          const proven = ok && lastCleanup?.closed !== false;
          if (!proven) {
            const detail = payload?.error || lastCleanup?.error || `cleanup not confirmed (${lastCleanup?.outcome ?? "unknown"})`;
            emitStatus({ state: "cleanup-failed", error: String(detail), host: payload });
          } else {
            emitStatus({ state: keptState ?? (reason === "user" ? "stopped" : "idle"), error: keptError, host: payload });
          }
          return status;
        }).catch(error => {
          emitStatus({ state: "cleanup-failed", error: String(error?.message || "stop-failed") });
          return status;
        });
      };

      return {
        // The backdrop layer subscribes with { onFrame, onStop }; a plain function is
        // accepted too, so a test or a future consumer can watch frames only.
        subscribe(listener) {
          const frameListener = typeof listener === "function" ? listener : listener?.onFrame;
          if (typeof frameListener !== "function") throw new TypeError("wallpaper subscriber needs an onFrame function");
          const stopListener = typeof listener?.onStop === "function" ? listener.onStop : null;
          const stallListener = typeof listener?.onStall === "function" ? listener.onStall : null;
          frameListeners.add(frameListener);
          if (stopListener) listeners.add(stopListener);
          if (stallListener) stallListeners.add(stallListener);
          return () => {
            frameListeners.delete(frameListener);
            if (stopListener) listeners.delete(stopListener);
            if (stallListener) stallListeners.delete(stallListener);
          };
        },
        subscribeStatus(listener) { statusListeners.add(listener); listener(status); return () => statusListeners.delete(listener); },
        getStatus: () => status,
        running: () => running,
        /**
         * Reads the host status with a bounded wait.
         *
         * Readiness must mean "the host answered successfully AND said it can run": an HTTP
         * error body (503 while the service is still starting) or a 200 with a malformed
         * payload is NOT ready. Without a timeout a single hanging fetch would keep the
         * automatic start waiting forever, so the whole read is bounded and cancellable.
         */
        async loadHostStatus({ timeoutMs, signal = null } = {}) {
          const boundedMs = timeoutMs ?? hostStatusTimeoutMs;
          const controller = typeof AbortController === "function" ? new AbortController() : null;
          const onAbort = () => controller?.abort();
          if (signal) {
            if (signal.aborted) return null;
            signal.addEventListener("abort", onAbort, { once: true });
          }
          let timer = 0;
          try {
            const read = async () => {
              const response = await fetchImpl("/whale-wallpaper/status", { cache: "no-store", signal: controller?.signal });
              if (!response.ok) throw new Error(`host-status-${response.status}`);
              const payload = await response.json().catch(() => null);
              // The availability answer must be a real boolean; anything else is not a ready host.
              if (!payload || typeof payload.available !== "boolean") throw new Error("host-status-invalid");
              return payload;
            };
            let payload;
            if (controller) {
              // Bounds the fetch AND the body read: either can hang on its own.
              const timeout = new Promise((_, reject) => {
                timer = window.setTimeout(() => { controller.abort(); reject(new Error("host-status-timeout")); }, boundedMs);
              });
              payload = await Promise.race([read(), timeout]);
            } else {
              payload = await read();
            }
            emitStatus({ host: payload, error: "", previewError: "" });
            return payload;
          } catch (error) {
            emitStatus({ host: null, error: String(error?.message || "unavailable") });
            return null;
          } finally {
            if (timer) window.clearTimeout(timer);
            if (signal) signal.removeEventListener("abort", onAbort);
          }
        },
        async start(scene = "lucy", mode = DEFAULT_PLAYBACK_MODE) {
          if (disposed || busy) return status;
          busy = true;
          const runGeneration = invalidate();
          emitStatus({ state: "starting", error: "", generation: runGeneration });
          try {
            const { ok, payload } = await command("start", { scene, mode });
            // A stop, a source switch or an unload during the request invalidates this run;
            // the late reply must not resurrect it.
            if (disposed || runGeneration !== generation) {
              if (ok) await command("stop").catch(() => {});
              return status;
            }
            if (!ok) throw new Error(payload?.error || "start-failed");
            running = true; busy = false;
            startedAt = now(); lastFrameAt = now();
            emitStatus({ host: payload, rendered: 0, decodeErrors: 0, mode });
            connect(runGeneration);
            return status;
          } catch (error) {
            if (runGeneration !== generation) return status;
            busy = false; running = false;
            emitStatus({ state: "error", error: String(error?.message || "start-failed") });
            return status;
          }
        },
        async restart(scene = "lucy", mode = DEFAULT_PLAYBACK_MODE) {
          if (disposed || busy) return status;
          busy = true;
          const restartGeneration = invalidate();
          emitStatus({ state: "starting", error: "", generation: restartGeneration });
          try {
            const { ok, payload } = await command("restart", { scene, mode });
            if (disposed || restartGeneration !== generation) {
              if (ok) await command("stop").catch(() => {});
              return status;
            }
            if (!ok) throw new Error(payload?.error || "restart-failed");
            running = true; busy = false;
            startedAt = now(); lastFrameAt = now();
            emitStatus({ host: payload, rendered: 0, decodeErrors: 0, mode });
            connect(restartGeneration);
            return status;
          } catch (error) {
            // A failed restart stays failed and says why; it does not enter a fake connected state.
            if (restartGeneration !== generation) return status;
            busy = false; running = false;
            emitStatus({ state: "error", error: String(error?.message || "restart-failed") });
            return status;
          }
        },
        stop,
        snapshot,
        /** Last close result reported by the Host, or null when nothing was closed yet. */
        lastCleanup: () => lastCleanup,
        dispose() {
          disposed = true;
          invalidate();
          running = false; busy = false;
          abort?.abort(); abort = null;
          window.clearInterval(pollTimer); pollTimer = null;
          cancelAnimationFrame(frameRequest);
          frameListeners.clear(); statusListeners.clear(); listeners.clear(); stallListeners.clear();
          latest = null;
        },
      };
    }

    function createBackdrop(engine) {
      const listeners = new Set();
      const versions = { image: 0, video: 0 };
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let state = Object.freeze({ status: "off", error: "", media: Object.freeze({ image: null, video: null }) });
      let settings = { ...DEFAULT_SETTINGS };
      let themeActive = false;
      let running = false;
      let mountedKey = "";
      let loadId = 0;
      let layer = null;
      let video = null;
      let objectUrl = null;
      let pendingLoad = null;
      const pendingImports = new Set();
      // Wallpaper Engine preview layer. It is a canvas painted from the authenticated
      // frame stream, so the existing brightness/mask/blur/surface variables apply to it
      // exactly like they do to an image or video, and it never captures pointer events.
      let wallpaperLayer = null;
      let wallpaperPainted = false;
      let wallpaperError = "";

      const releaseMedia = (element) => {
        if (!element) return;
        if (element.tagName === "VIDEO") element.pause();
        element.removeAttribute("src");
        if (element.tagName === "VIDEO") element.load();
      };

      const emit = (patch) => {
        if (!running) return;
        state = Object.freeze({ ...state, ...patch });
        listeners.forEach((listener) => listener());
      };

      const shouldPlay = () => !document.hidden && !reducedMotion.matches &&
        (settings.motion === "always" || document.hasFocus());
      const updatePlayback = () => {
        if (!video) return;
        if (shouldPlay()) video.play().catch(() => {});
        else video.pause();
      };

      // A sticky composer shares the scrollport with a potentially very tall view. A mask
      // anchored to the view's bottom follows the content, not the visible input position.
      // Clip only that sibling view, using viewport coordinates for both boxes. No wrapper,
      // composer, footer, or portal is clipped, and no background is painted to hide messages.
      const HISTORY_CLIP = "--wm-history-clip-bottom";
      const HISTORY_ATTRIBUTE = "data-wm-history-clip";
      const clippedViews = new Map();
      let historyResize = null;
      let historyMutation = null;
      let historyFrame = null;
      let historyTracking = false;
      let historyObserved = new Set();
      const restoreHistoryView = (view, previous) => {
        if (previous.value) view.style.setProperty(HISTORY_CLIP, previous.value, previous.priority);
        else view.style.removeProperty(HISTORY_CLIP);
        if (previous.attribute === null) view.removeAttribute(HISTORY_ATTRIBUTE);
        else view.setAttribute(HISTORY_ATTRIBUTE, previous.attribute);
        clippedViews.delete(view);
      };
      const measureHistory = () => {
        historyFrame = null;
        if (!historyTracking) return;
        const found = new Set();
        const observed = new Set();
        for (const scroll of document.querySelectorAll("[data-conversation-scroll]")) {
          const content = scroll.closest("[data-conversation-content]");
          if (content?.dataset.contentPhase !== "active") continue;
          const seat = scroll.querySelector(":scope > [data-composer-seat]");
          const card = seat?.querySelector(".RlGAzG_card");
          if (!card || !card.getClientRects().length) continue;
          const cardTop = card.getBoundingClientRect().top;
          observed.add(scroll); observed.add(seat); observed.add(card);
          for (const view of scroll.querySelectorAll(":scope > .Dc7zOa_viewArea, :scope > [data-slot='conversation.session'] > .Dc7zOa_viewArea")) {
            if (!view.getClientRects().length) continue;
            found.add(view); observed.add(view);
            if (!clippedViews.has(view)) clippedViews.set(view, {
              value: view.style.getPropertyValue(HISTORY_CLIP),
              priority: view.style.getPropertyPriority(HISTORY_CLIP),
              attribute: view.getAttribute(HISTORY_ATTRIBUTE),
            });
            const rect = view.getBoundingClientRect();
            // Rounding outward hides subpixel text at the boundary rather than leaving a sliver.
            const bottom = Math.ceil(Math.max(0, Math.min(rect.height, rect.bottom - cardTop)));
            const value = `${bottom}px`;
            if (view.style.getPropertyValue(HISTORY_CLIP) !== value) view.style.setProperty(HISTORY_CLIP, value);
            if (!view.hasAttribute(HISTORY_ATTRIBUTE)) view.setAttribute(HISTORY_ATTRIBUTE, "");
          }
        }
        for (const [view, previous] of clippedViews) if (!found.has(view)) restoreHistoryView(view, previous);
        if (historyResize) {
          for (const target of historyObserved) if (!observed.has(target)) historyResize.unobserve(target);
          for (const target of observed) if (!historyObserved.has(target)) historyResize.observe(target);
        }
        historyObserved = observed;
      };
      const queueHistoryMeasure = () => {
        if (historyTracking && historyFrame === null) historyFrame = requestAnimationFrame(measureHistory);
      };
      const startHistoryTracking = () => {
        if (historyTracking) return; // Wallpaper frames must not rebuild observers every frame.
        historyTracking = true;
        if (typeof ResizeObserver === "function") historyResize = new ResizeObserver(queueHistoryMeasure);
        if (typeof MutationObserver === "function") {
          historyMutation = new MutationObserver(queueHistoryMeasure);
          historyMutation.observe(document.getElementById("root") || document.body, {
            childList: true, subtree: true, attributes: true, attributeFilter: ["data-content-phase"],
          });
        }
        document.addEventListener("scroll", queueHistoryMeasure, true);
        window.addEventListener("resize", queueHistoryMeasure);
        measureHistory();
      };
      function stopHistoryTracking() {
        historyTracking = false;
        historyResize?.disconnect(); historyResize = null;
        historyMutation?.disconnect(); historyMutation = null;
        if (historyFrame !== null) cancelAnimationFrame(historyFrame);
        historyFrame = null;
        document.removeEventListener("scroll", queueHistoryMeasure, true);
        window.removeEventListener("resize", queueHistoryMeasure);
        for (const [view, previous] of clippedViews) restoreHistoryView(view, previous);
        historyObserved.clear();
      }

      const unmount = () => {
        loadId += 1;
        pendingLoad?.abort();
        pendingLoad = null;
        mountedKey = "";
        stopHistoryTracking();
        delete document.body.dataset.wmBackdrop;
        if (layer) releaseMedia(layer.querySelector(".wm-backdrop-media"));
        video = null;
        layer?.remove();
        layer = null;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      };

      const unmountWallpaper = () => {
        stopHistoryTracking();
        wallpaperLayer?.remove();
        wallpaperLayer = null;
        wallpaperPainted = false;
        wallpaperError = "";
        if (document.body.dataset.wmBackdrop === "wallpaper") delete document.body.dataset.wmBackdrop;
      };

      /** Keeps the layer but stops presenting a stale frame (used while waiting to recover). */
      const hideWallpaper = () => {
        if (!wallpaperLayer) return;
        wallpaperPainted = false;
        wallpaperLayer.hidden = true;
        if (document.body.dataset.wmBackdrop === "wallpaper") delete document.body.dataset.wmBackdrop;
      };

      const paintWallpaper = (bitmap, frame) => {
        // A frame is never dropped just because the layer is missing: as long as this source
        // is still the selected one, the layer is (re)created here. A stop removes it, so a
        // new run would otherwise paint into nothing until some unrelated setting change.
        if (!wallpaperLayer && running && settings.background === "wallpaper" && themeActive) mountWallpaper();
        if (!wallpaperLayer || !running) { bitmap.close?.(); return; }        const canvas = wallpaperLayer.querySelector(".wm-backdrop-media");
        if (!canvas) { bitmap.close?.(); return; }
        if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
          canvas.width = bitmap.width; canvas.height = bitmap.height;
        }
        canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0);
        bitmap.close?.();
        // The layer becomes visible and the UI becomes transparent only together with a
        // real frame, so a loading or stalled preview never leaves the chat see-through.
        wallpaperPainted = true;
        wallpaperLayer.hidden = false;
        document.body.dataset.wmBackdrop = "wallpaper";
        startHistoryTracking();
        wallpaperLayer.dataset.wmSequence = String(frame.sequence);
      };

      const mountWallpaper = () => {
        if (wallpaperLayer) return wallpaperLayer;
        const next = document.createElement("div");
        next.id = "wm-backdrop";
        next.setAttribute("aria-hidden", "true");
        next.dataset.wmKind = "wallpaper";
        next.hidden = true;
        const canvas = document.createElement("canvas");
        canvas.className = "wm-backdrop-media";
        const shade = document.createElement("div");
        shade.className = "wm-backdrop-mask";
        next.append(canvas, shade);
        document.body.prepend(next);
        wallpaperLayer = next;
        // The status channel carries the terminal cases: the preview time limit, a closed
        // stream, a stalled source and errors. The last painted frame is withdrawn and the
        // opaque theme is restored, so nothing stays frozen behind the chat.
        engine?.subscribe({
          onFrame: paintWallpaper,
          onStop: () => unmountWallpaper(),
          // A stall is not a terminal state: keep the layer, stop presenting the stale frame,
          // and let the next real frame bring the picture back.
          onStall: () => hideWallpaper(),
          onStatus: (patch) => {
            const nextError = patch.error ?? wallpaperError;
            if (nextError !== wallpaperError) { wallpaperError = nextError; emit({ error: nextError }); }
            if (["stopped", "error", "cleanup-failed", "idle"].includes(patch.state)) unmountWallpaper();
            else if (patch.state === "waiting") hideWallpaper();
          },
        });
        return next;
      };

      const createMedia = (kind, url, signal) => new Promise((resolve, reject) => {
        const element = document.createElement(kind === "image" ? "img" : "video");
        let finished = false;
        const timer = window.setTimeout(() => finish(new Error("decode")), 20000);
        const abort = () => finish(new DOMException("Media load cancelled", "AbortError"));
        const done = () => finish();
        const fail = () => finish(new Error("decode"));
        function finish(error) {
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          element.removeEventListener("loadeddata", done);
          element.removeEventListener("error", fail);
          if (error) { releaseMedia(element); reject(error); }
          else resolve(element);
        }
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) { abort(); return; }
        if (kind === "image") {
          element.alt = "";
          element.decoding = "async";
          element.src = url;
          element.decode().then(done, fail);
          return;
        }
        element.muted = true;
        element.defaultMuted = true;
        element.loop = true;
        element.playsInline = true;
        element.preload = "auto";
        element.disablePictureInPicture = true;
        element.setAttribute("muted", "");
        element.addEventListener("loadeddata", done);
        element.addEventListener("error", fail);
        element.src = url;
      });

      const load = async (kind, key) => {
        pendingLoad?.abort();
        const abort = new AbortController();
        pendingLoad = abort;
        const id = ++loadId;
        mountedKey = key;
        emit({ status: "loading", error: "" });
        let record;
        try {
          record = await readMedia(kind);
        } catch {
          if (id === loadId) {
            unmount(); mountedKey = key;
            emit({ status: "error", error: "storage" });
          }
          return;
        }
        if (id !== loadId) return;
        if (!record || !(record.blob instanceof Blob)) {
          unmount();
          mountedKey = key;
          emit({ status: "missing", error: "" });
          return;
        }
        const url = URL.createObjectURL(record.blob);
        let element;
        try {
          element = await createMedia(kind, url, abort.signal);
        } catch {
          URL.revokeObjectURL(url);
          if (id !== loadId) return;
          unmount();
          mountedKey = key;
          emit({ status: "error", error: kind === "video" ? "video-decode" : "image-decode" });
          return;
        }
        if (id !== loadId) {
          releaseMedia(element);
          URL.revokeObjectURL(url);
          return;
        }
        const previousUrl = objectUrl;
        const nextLayer = document.createElement("div");
        nextLayer.id = "wm-backdrop";
        nextLayer.setAttribute("aria-hidden", "true");
        nextLayer.dataset.wmKind = kind;
        element.className = "wm-backdrop-media";
        const shade = document.createElement("div");
        shade.className = "wm-backdrop-mask";
        nextLayer.append(element, shade);
        element.addEventListener("error", () => {
          if (layer !== nextLayer) return;
          unmount(); mountedKey = key;
          emit({ status: "error", error: `${kind}-decode` });
        });
        if (layer) releaseMedia(layer.querySelector(".wm-backdrop-media"));
        layer?.remove();
        document.body.prepend(nextLayer);
        layer = nextLayer;
        video = kind === "video" ? element : null;
        objectUrl = url;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        document.body.dataset.wmBackdrop = kind;
        startHistoryTracking();
        updatePlayback();
        emit({ status: "ready", error: "" });
      };

      const reconcile = () => {
        if (!running) return;
        const kind = settings.background;
        // Only one background may be active: whichever kind is selected owns the layer.
        if (kind !== "wallpaper" && wallpaperLayer) unmountWallpaper();
        if (kind !== "wallpaper" && engine?.running()) engine.stop("background-changed");
        if (kind === "none" || !themeActive) {
          if (mountedKey) unmount();
          if (state.status !== "off") emit({ status: "off", error: "" });
          return;
        }
        if (kind === "wallpaper") {
          if (mountedKey) unmount();
          mountWallpaper();
          emit({ status: "ready", error: wallpaperError });
          return;
        }
        const key = `${kind}:${versions[kind]}`;
        if (key !== mountedKey) load(kind, key);
        else updatePlayback();
      };

      const refreshInfo = async () => {
        try {
          const [imageRecord, videoRecord] = await Promise.all([readMedia("image"), readMedia("video")]);
          emit({ media: Object.freeze({ image: describeMedia(imageRecord), video: describeMedia(videoRecord) }) });
        } catch {
          emit({ error: "storage" });
        }
      };

      return {
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSnapshot: () => state,
        start(initialSettings, initialThemeActive) {
          running = true;
          settings = initialSettings;
          themeActive = initialThemeActive;
          document.addEventListener("visibilitychange", updatePlayback);
          window.addEventListener("focus", updatePlayback);
          window.addEventListener("blur", updatePlayback);
          reducedMotion.addEventListener("change", updatePlayback);
          refreshInfo();
          reconcile();
        },
        stop() {
          running = false;
          for (const abort of pendingImports) abort.abort();
          pendingImports.clear();
          document.removeEventListener("visibilitychange", updatePlayback);
          window.removeEventListener("focus", updatePlayback);
          window.removeEventListener("blur", updatePlayback);
          reducedMotion.removeEventListener("change", updatePlayback);
          unmount();
          unmountWallpaper();
          objectUrl = null;
          state = Object.freeze({ ...state, status: "off", error: "" });
        },
        update(nextSettings, nextThemeActive = themeActive) {
          settings = nextSettings;
          themeActive = nextThemeActive;
          reconcile();
        },
        async store(kind, file) {
          if (!running || !Object.hasOwn(MEDIA_LIMITS, kind) || !(file instanceof Blob)) return false;
          if (!file.type.startsWith(`${kind}/`)) {
            emit({ status: "error", error: "type" });
            return false;
          }
          if (file.size > MEDIA_LIMITS[kind]) {
            emit({ status: "error", error: "size" });
            return false;
          }
          emit({ status: "saving", error: "" });
          // Validate first so an unreadable replacement cannot destroy the saved wallpaper.
          const abort = new AbortController();
          pendingImports.add(abort);
          const checkUrl = URL.createObjectURL(file);
          try {
            const checked = await createMedia(kind, checkUrl, abort.signal);
            releaseMedia(checked);
          } catch (error) {
            if (running && error.name !== "AbortError") emit({ status: "error", error: `${kind}-decode` });
            return false;
          } finally {
            pendingImports.delete(abort);
            URL.revokeObjectURL(checkUrl);
          }
          if (!running) return false;
          try {
            await writeMedia(kind, { blob: file, name: file.name || "", savedAt: Date.now() });
          } catch (error) {
            emit({ status: "error", error: error?.name === "QuotaExceededError" ? "quota" : "storage" });
            return false;
          }
          versions[kind] += 1;
          await refreshInfo();
          if (!running) return false;
          if (state.status === "saving") emit({ status: "off" });
          reconcile();
          return true;
        },
        async remove(kind) {
          if (!running || !Object.hasOwn(MEDIA_LIMITS, kind)) return;
          try {
            await deleteMedia(kind);
          } catch {
            emit({ status: "error", error: "storage" });
            return;
          }
          versions[kind] += 1;
          await refreshInfo();
          reconcile();
        }
      };
    }

    function selectedThemeId(settings) {
      return THEME_IDS[settings.theme] ?? ABYSS_THEME_ID;
    }

    function createBooleanSignal(initialValue = false) {
      let value = initialValue;
      const listeners = new Set();
      return Object.freeze({
        getSnapshot: () => value,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set: (nextValue) => {
          if (value === nextValue) return;
          value = nextValue;
          listeners.forEach((listener) => listener());
        }
      });
    }

    const theme = Object.freeze({
      id: THEME_ID,
      colorScheme: "light",
      tokens: Object.freeze({
        "--dsw-alias-bg-base": "rgba(239, 247, 254, 0.78)",
        "--dsw-alias-bg-primary": "rgba(247, 251, 255, 0.7)",
        "--dsw-alias-bg-layer-1": "rgba(255, 255, 255, 0.62)",
        "--dsw-alias-bg-layer-2": "rgba(230, 242, 251, 0.7)",
        "--dsw-alias-bg-layer-3": "rgba(252, 254, 255, 0.78)",
        "--dsw-alias-bg-overlay": "rgba(248, 252, 255, 0.86)",
        "--dsw-alias-bg-mask-1": "rgba(11, 44, 67, 0.16)",
        "--dsw-alias-bg-module-platform": "rgba(218, 235, 249, 0.58)",

        "--dsw-alias-border-l1": "rgba(255, 255, 255, 0.78)",
        "--dsw-alias-border-l2": "rgba(54, 101, 136, 0.16)",
        "--dsw-alias-border-l2-darkmode-thin": "rgba(54, 101, 136, 0.18)",
        "--dsw-alias-border-l3": "rgba(54, 101, 136, 0.23)",
        "--dsw-alias-border-l4": "rgba(36, 77, 107, 0.32)",
        "--dsw-alias-border-secondary": "rgba(54, 101, 136, 0.18)",
        "--dsw-alias-border-inverted": "rgba(255, 255, 255, 0.72)",
        "--dsw-alias-line-secondary": "rgba(54, 101, 136, 0.14)",
        "--dsw-alias-separator-primary": "rgba(54, 101, 136, 0.13)",

        "--dsw-alias-label-primary": "#153047",
        "--dsw-alias-label-primary-bluish": "#163b57",
        "--dsw-alias-label-primary-foreground": "#0a263d",
        "--dsw-alias-label-secondary": "#62798c",
        "--dsw-alias-label-tertiary": "#8094a5",
        "--dsw-alias-label-quaternary": "#9aabba",
        "--dsw-alias-label-caption": "#6f879a",
        "--dsw-alias-label-dimmed": "#8da0af",
        "--dsw-alias-label-primary-dimmed": "#7890a2",
        "--dsw-alias-label-inverse": "#f8fcff",
        "--dsw-alias-label-error": "#b14754",

        "--dsw-alias-brand-primary": "#1468a8",
        "--dsw-alias-brand-primary-new-colorprimary-new-color": "#1468a8",
        "--dsw-alias-button-primary-fill": "#1468a8",
        "--dsw-alias-button-primary-hover": "#0f5e97",
        "--dsw-alias-button-info-fill": "rgba(20, 104, 168, 0.12)",
        "--dsw-alias-button-info-hover": "rgba(20, 104, 168, 0.18)",
        "--dsw-alias-button-elevated-fill": "rgba(255, 255, 255, 0.58)",
        "--dsw-alias-button-floating-fill": "rgba(252, 254, 255, 0.74)",
        "--dsw-alias-button-floating-hover": "rgba(255, 255, 255, 0.9)",
        "--dsw-alias-button-ghost-active-fill": "rgba(33, 128, 193, 0.15)",

        "--dsw-alias-interactive-bg-primary": "rgba(33, 128, 193, 0.12)",
        "--dsw-alias-interactive-bg-hover": "rgba(33, 128, 193, 0.09)",
        "--dsw-alias-interactive-bg-active": "rgba(33, 128, 193, 0.15)",
        "--dsw-alias-interactive-bg-hover-solid": "#e6f2fb",
        "--dsw-alias-interactive-bg-hover-danger": "rgba(184, 72, 84, 0.1)",
        "--dsw-alias-fill-l2": "rgba(89, 133, 165, 0.14)",
        "--dsw-alias-fill-tsp-secondary": "rgba(255, 255, 255, 0.44)",

        "--dsw-alias-scrollbar-bg-l2": "rgba(62, 105, 136, 0.2)",
        "--dsw-alias-scrollbar-hover-l2": "rgba(48, 90, 121, 0.32)",
        "--dsw-alias-markdown-citation": "#1468a8",
        "--dsw-alias-markdown-code-block": "rgba(223, 237, 248, 0.72)",
        "--dsw-alias-markdown-code-block-banner": "rgba(213, 231, 245, 0.84)",

        "--dsw-alias-state-business-primary": "#1468a8",
        "--dsw-alias-state-business-tertiary": "rgba(20, 104, 168, 0.13)",
        "--dsw-alias-state-success-primary": "#2b8164",
        "--dsw-alias-state-success-tertiary": "rgba(43, 129, 100, 0.12)",
        "--dsw-alias-state-warn-primary": "#a96a22",
        "--dsw-alias-state-warn-secondary": "#bd7e35",
        "--dsw-alias-state-warn-tertiary": "rgba(169, 106, 34, 0.12)",
        "--dsw-alias-state-warn-label": "#87541b",
        "--dsw-alias-state-error-primary": "#b14754",
        "--dsw-alias-state-error-secondary": "#c35a66",

        "--dsw-font-family": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        "--dsw-font-mono": "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
        "--dsw-mask-blur": "blur(24px) saturate(132%)",
        "--dsw-shadow-lv1": "0 1px 2px rgba(36, 76, 106, 0.06), 0 5px 16px rgba(45, 91, 124, 0.06)",
        "--dsw-shadow-lv2": "0 1px 2px rgba(36, 76, 106, 0.07), 0 15px 40px rgba(45, 91, 124, 0.11)",
        "--dsw-shadow-lv3": "0 3px 8px rgba(36, 76, 106, 0.08), 0 28px 70px rgba(45, 91, 124, 0.16)",

        "--dsw-specific-sidebar-fill": "rgba(220, 237, 250, 0.76)",
        "--dsw-specific-sidebar-nav-item-active": "rgba(255, 255, 255, 0.64)",
        "--dsw-specific-sidebar-nav-item-active-accent": "#4aa4dd",
        "--dsw-specific-sidebar-nav-item-hover": "rgba(255, 255, 255, 0.46)",
        "--dsw-specific-input-major": "linear-gradient(180deg, #fbfdff 0%, #f4f9fd 100%)",
        "--dsw-specific-bubble": "rgba(210, 233, 250, 0.68)",
        "--dsw-specific-menu": "rgba(249, 252, 255, 0.88)",
        "--dsw-specific-selector": "rgba(255, 255, 255, 0.66)",
        "--dsw-specific-tip": "rgba(238, 247, 254, 0.9)"
      })
    });

    const abyssTheme = Object.freeze({
      id: ABYSS_THEME_ID,
      colorScheme: "dark",
      tokens: Object.freeze({
        "--dsw-alias-bg-base": "#080b14",
        "--dsw-alias-bg-primary": "#0b111d",
        "--dsw-alias-bg-layer-1": "rgba(15, 23, 38, 0.94)",
        "--dsw-alias-bg-layer-2": "rgba(23, 34, 54, 0.92)",
        "--dsw-alias-bg-layer-3": "rgba(28, 40, 62, 0.96)",
        "--dsw-alias-bg-overlay": "rgba(23, 34, 54, 0.98)",
        "--dsw-alias-bg-mask-1": "rgba(2, 5, 12, 0.68)",
        "--dsw-alias-bg-module-platform": "rgba(20, 30, 48, 0.9)",

        "--dsw-alias-border-l1": "rgba(231, 236, 245, 0.06)",
        "--dsw-alias-border-l2": "rgba(125, 145, 177, 0.16)",
        "--dsw-alias-border-l2-darkmode-thin": "rgba(125, 145, 177, 0.13)",
        "--dsw-alias-border-l3": "rgba(125, 145, 177, 0.23)",
        "--dsw-alias-border-l4": "rgba(151, 168, 194, 0.32)",
        "--dsw-alias-border-secondary": "rgba(125, 145, 177, 0.18)",
        "--dsw-alias-border-inverted": "rgba(231, 236, 245, 0.14)",
        "--dsw-alias-line-secondary": "rgba(125, 145, 177, 0.13)",
        "--dsw-alias-separator-primary": "rgba(125, 145, 177, 0.12)",

        "--dsw-alias-label-primary": "#e7ecf5",
        "--dsw-alias-label-primary-bluish": "#dce5f5",
        "--dsw-alias-label-primary-foreground": "#080b14",
        "--dsw-alias-label-secondary": "#a7b2c5",
        "--dsw-alias-label-tertiary": "#7f8da5",
        "--dsw-alias-label-quaternary": "#647188",
        "--dsw-alias-label-caption": "#8f9db3",
        "--dsw-alias-label-dimmed": "#657188",
        "--dsw-alias-label-primary-dimmed": "#b5bfd0",
        "--dsw-alias-label-inverse": "#080b14",
        "--dsw-alias-label-error": "#ff8795",

        "--dsw-alias-brand-primary": "#8c72f2",
        "--dsw-alias-brand-primary-new-colorprimary-new-color": "#8c72f2",
        "--dsw-alias-button-primary-fill": "#7d63de",
        "--dsw-alias-button-primary-hover": "#9078ed",
        "--dsw-alias-button-info-fill": "rgba(140, 114, 242, 0.18)",
        "--dsw-alias-button-info-hover": "rgba(140, 114, 242, 0.26)",
        "--dsw-alias-button-elevated-fill": "rgba(31, 44, 68, 0.92)",
        "--dsw-alias-button-floating-fill": "rgba(24, 35, 56, 0.96)",
        "--dsw-alias-button-floating-hover": "rgba(36, 49, 74, 0.98)",
        "--dsw-alias-button-ghost-active-fill": "rgba(140, 114, 242, 0.2)",

        "--dsw-alias-interactive-bg-primary": "rgba(140, 114, 242, 0.16)",
        "--dsw-alias-interactive-bg-hover": "rgba(231, 236, 245, 0.07)",
        "--dsw-alias-interactive-bg-active": "rgba(140, 114, 242, 0.2)",
        "--dsw-alias-interactive-bg-hover-solid": "#1b2940",
        "--dsw-alias-interactive-bg-hover-danger": "rgba(255, 91, 111, 0.14)",
        "--dsw-alias-fill-l2": "rgba(125, 145, 177, 0.16)",
        "--dsw-alias-fill-tsp-secondary": "rgba(231, 236, 245, 0.08)",

        "--dsw-alias-scrollbar-bg-l2": "rgba(111, 128, 157, 0.28)",
        "--dsw-alias-scrollbar-hover-l2": "rgba(151, 168, 194, 0.42)",
        "--dsw-alias-markdown-citation": "#a992ff",
        "--dsw-alias-markdown-code-block": "rgba(10, 16, 28, 0.94)",
        "--dsw-alias-markdown-code-block-banner": "rgba(19, 29, 47, 0.98)",

        "--dsw-alias-state-business-primary": "#9a82f5",
        "--dsw-alias-state-business-tertiary": "rgba(140, 114, 242, 0.2)",
        "--dsw-alias-state-success-primary": "#64cda2",
        "--dsw-alias-state-success-tertiary": "rgba(72, 177, 136, 0.16)",
        "--dsw-alias-state-warn-primary": "#e3a85d",
        "--dsw-alias-state-warn-secondary": "#efbb78",
        "--dsw-alias-state-warn-tertiary": "rgba(227, 168, 93, 0.16)",
        "--dsw-alias-state-warn-label": "#efbb78",
        "--dsw-alias-state-error-primary": "#ff7185",
        "--dsw-alias-state-error-secondary": "#ff8fa0",

        "--dsw-font-family": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        "--dsw-font-mono": "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
        "--dsw-mask-blur": "blur(22px) saturate(118%)",
        "--dsw-shadow-lv1": "0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 22px rgba(1, 4, 12, 0.24)",
        "--dsw-shadow-lv2": "0 2px 5px rgba(0, 0, 0, 0.34), 0 18px 46px rgba(1, 4, 12, 0.38)",
        "--dsw-shadow-lv3": "0 5px 12px rgba(0, 0, 0, 0.38), 0 32px 78px rgba(1, 4, 12, 0.5)",

        "--dsw-specific-sidebar-fill": "rgba(15, 23, 38, 0.94)",
        "--dsw-specific-sidebar-nav-item-active": "rgba(140, 114, 242, 0.16)",
        "--dsw-specific-sidebar-nav-item-active-accent": "#8c72f2",
        "--dsw-specific-sidebar-nav-item-hover": "rgba(231, 236, 245, 0.06)",
        "--dsw-specific-input-major": "linear-gradient(180deg, #172236 0%, #121b2c 100%)",
        "--dsw-specific-bubble": "rgba(72, 56, 119, 0.46)",
        "--dsw-specific-menu": "rgba(19, 29, 47, 0.98)",
        "--dsw-specific-selector": "rgba(28, 40, 62, 0.94)",
        "--dsw-specific-tip": "rgba(23, 34, 54, 0.96)"
      })
    });

    function WhaleAppearanceSettings({ controller }) {
      const h = React.createElement;
      const [settings, setSettings] = React.useState(() => controller.read());
      const mediaState = React.useSyncExternalStore(controller.media.subscribe, controller.media.getSnapshot);
      const wallpaperStatus = React.useSyncExternalStore(controller.wallpaper.subscribeStatus, controller.wallpaper.getStatus);
      const [busy, setBusy] = React.useState(false);
      const [previewBusy, setPreviewBusy] = React.useState(false);
      // A control-level failure (the action itself refusing to run) is shown in the status
      // row, so the buttons can be used again without hiding what went wrong.
      const [previewActionError, setPreviewActionError] = React.useState("");
      const inputs = React.useRef({});
      const chinese = (navigator.language || "").toLowerCase().startsWith("zh");
      const copy = chinese ? {
        title: "鲸系外观",
        badge: "Whale",
        description: "选择浅雾或深色配色，可设置图片或视频背景；输入卡片始终保持不透明。",
        reset: "恢复默认",
        theme: "主题",
        themeHint: "在鲸雾蓝与鲸渊深色之间切换",
        mist: "鲸雾",
        abyss: "鲸渊",
        palette: "深色配色",
        paletteHint: "鲸渊的底色与强调色",
        ocean: "深海",
        graphite: "石墨",
        violet: "暗紫",
        jade: "墨绿",
        canvas: "背景层次",
        canvasHint: "控制主画布的雾感与边界清晰度",
        soft: "柔雾",
        clear: "清晰",
        sidebar: "侧栏层次",
        sidebarHint: "只改变侧栏与会话区的明度关系",
        balanced: "均衡",
        deep: "稍深",
        glass: "玻璃强度",
        glassHint: "影响浮层和菜单，不影响输入卡片",
        standard: "标准",
        restrained: "克制",
        wallpaper: "背景壁纸",
        background: "背景",
        backgroundHint: "文件保存在本机；恢复默认会关闭背景，但保留已选文件",
        none: "无",
        image: "图片",
        video: "视频",
        wallpaperEngine: "Wallpaper Engine（实验）",
        wallpaperEngineHint: "只支持已验证的 Lucy 场景；日常模式持续播放，直到你停止或退出",
        scene: "场景",
        sceneHint: "首版只接入本机已验证的样例工程",
        playMode: "播放模式",
        modeDaily: "日常（持续播放）",
        modePreview: "预览（限时）",
        autoStart: "随 DSH 启动自动播放",
        autoStartHint: "只保存下一次启动的选择；本次仍需点「开始播放」",
        startPreview: "开始播放",
        stopPreview: "停止播放",
        restartPreview: "重新开始",
        previewIdle: "未开始。点击「开始播放」创建本轮源窗口",
        previewStarting: "正在创建源窗口…",
        previewConnecting: "已连接，等待第一帧…",
        previewWaiting: "画面暂时中断，等待恢复…",
        previewLimit: "预览上限",
        previewPlaying: "预览中",
        dailyPlaying: "持续播放中",
        runningFor: "已运行",
        framesThisRun: "本轮帧数",
        previewStopped: "已停止。停止或失效后源窗口已清理",
        previewCleanupFailed: "关闭未确认，源窗口可能仍在；可再次点击重试清理",
        retryCleanup: "重试清理",
        errorUnavailable: "Wallpaper Engine 播放当前不可用",
        errorHelper: "缺少打包的原生采集程序",
        errorScene: "本机缺少已验证的样例工程",
        errorPlatform: "此环境不支持 Wallpaper Engine 播放",
        errorHost: "官方 Windows Desktop 之外不启动播放",
        imageFile: "图片文件",
        videoFile: "视频文件",
        imageEmpty: "未选择 · 支持 JPG / PNG / WebP / GIF，≤ 64 MB",
        videoEmpty: "未选择 · 建议 H.264 MP4 或 WebM，≤ 1 GB，静音循环",
        choose: "选择",
        replace: "更换",
        remove: "移除",
        brightness: "背景亮度",
        brightnessHint: "只调暗壁纸本身",
        mask: "遮罩",
        maskHint: "用主题底色压低壁纸，提升文字可读性",
        blur: "模糊",
        blurHint: "柔化壁纸细节，视频较大时会增加显卡负担",
        surface: "界面不透明度",
        surfaceHint: "侧栏与卡片；菜单和输入卡片保持不透明",
        regionTitle: "区域底色",
        opaqueSidebar: "左侧项目／会话栏使用不透明底色",
        opaqueSidebarHint: "勾选后用主题侧栏实色，未勾选沿用现有底色与界面不透明度",
        opaqueChat: "聊天区（含会话标题与标签栏）使用不透明底色",
        opaqueChatHint: "勾选后盖住整个右侧聊天列，包括会话标题与「对话／轨迹」标签栏；输入卡片与窗口顶条不受影响",
        motion: "视频播放",
        motionHint: "窗口最小化或隐藏时总是暂停",
        focus: "失焦暂停",
        always: "始终播放",
        status: {
          loading: "正在载入背景…",
          saving: "正在保存到本机…",
          missing: "尚未选择该类型的文件",
          storage: "本机存储不可用，背景未能读取或保存",
          quota: "本机存储空间不足，请换一个较小的文件",
          type: "文件类型不符",
          size: "文件超过大小上限",
          "image-decode": "这张图片无法解码",
          "video-decode": "视频无法播放，建议转为 H.264 MP4 或 WebM"
        }
      } : {
        title: "Whale appearance",
        badge: "Whale",
        description: "Choose mist or a dark palette, and optionally an image or video background. The composer stays opaque.",
        reset: "Reset",
        theme: "Theme",
        themeHint: "Switch between Whale Mist and Whale Abyss",
        mist: "Mist",
        abyss: "Abyss",
        palette: "Dark palette",
        paletteHint: "Base and accent colors for Whale Abyss",
        ocean: "Ocean",
        graphite: "Graphite",
        violet: "Violet",
        jade: "Jade",
        canvas: "Canvas depth",
        canvasHint: "Controls mist and edge separation on the main canvas",
        soft: "Soft",
        clear: "Clear",
        sidebar: "Sidebar depth",
        sidebarHint: "Changes only the brightness relationship with conversation",
        balanced: "Balanced",
        deep: "Deeper",
        glass: "Glass strength",
        glassHint: "Affects overlays and menus, never the composer",
        standard: "Standard",
        restrained: "Restrained",
        wallpaper: "Wallpaper",
        background: "Background",
        backgroundHint: "Stored locally. Reset turns the background off and keeps your chosen files.",
        none: "None",
        image: "Image",
        video: "Video",
        wallpaperEngine: "Wallpaper Engine (experimental)",
        wallpaperEngineHint: "Verified Lucy scene only; daily mode keeps playing until you stop it or exit",
        scene: "Scene",
        sceneHint: "This first version wires up the one verified local sample",
        playMode: "Playback",
        modeDaily: "Daily (continuous)",
        modePreview: "Preview (time-boxed)",
        autoStart: "Start playing with DSH",
        autoStartHint: "Saves the choice for the next launch; this session still needs the play button",
        startPreview: "Start playing",
        stopPreview: "Stop playing",
        restartPreview: "Restart",
        previewIdle: "Not running. Start playing creates this round's source window",
        previewStarting: "Creating the source window…",
        previewConnecting: "Connected, waiting for the first frame…",
        previewWaiting: "Frames paused; waiting to recover…",
        previewLimit: "limit",
        previewPlaying: "Previewing",
        dailyPlaying: "Playing continuously",
        runningFor: "running for",
        framesThisRun: "frames this run",
        previewStopped: "Stopped. The source window was cleaned up",
        previewCleanupFailed: "Close not confirmed; the source window may still exist. Retry to clean it up",
        retryCleanup: "Retry cleanup",
        errorUnavailable: "The Wallpaper Engine playback is unavailable",
        errorHelper: "The packaged native capture helper is missing",
        errorScene: "The verified local sample is missing",
        errorPlatform: "This environment does not support Wallpaper Engine playback",
        errorHost: "Playback only starts inside the official Windows desktop",
        imageFile: "Image file",
        videoFile: "Video file",
        imageEmpty: "None · JPG / PNG / WebP / GIF, up to 64 MB",
        videoEmpty: "None · H.264 MP4 or WebM recommended, up to 1 GB, muted loop",
        choose: "Choose",
        replace: "Replace",
        remove: "Remove",
        brightness: "Brightness",
        brightnessHint: "Dims only the wallpaper",
        mask: "Scrim",
        maskHint: "Tints the wallpaper with the theme base for readable text",
        blur: "Blur",
        blurHint: "Softens detail; costs more GPU on large videos",
        surface: "Surface opacity",
        surfaceHint: "Sidebar and cards; menus and the composer stay opaque",
        regionTitle: "Region backgrounds",
        opaqueSidebar: "Give the project/session sidebar an opaque background",
        opaqueSidebarHint: "Uses the theme's sidebar colour; unchecked keeps the current fill and surface opacity",
        opaqueChat: "Give the chat area (session title and tabs included) an opaque background",
        opaqueChatHint: "Covers the whole right-hand column, including the session title and the conversation/trace tabs; the composer and the window title bar are unaffected",
        motion: "Video playback",
        motionHint: "Always pauses while minimized or hidden",
        focus: "Pause when unfocused",
        always: "Always play",
        status: {
          loading: "Loading background…",
          saving: "Saving locally…",
          missing: "No file chosen for this type yet",
          storage: "Local storage is unavailable",
          quota: "Not enough local storage; try a smaller file",
          type: "Unsupported file type",
          size: "File exceeds the size limit",
          "image-decode": "This image could not be decoded",
          "video-decode": "This video cannot play; try H.264 MP4 or WebM"
        }
      };

      const update = (key, value) => {
        setSettings(controller.set(key, value));
      };
      const reset = () => {
        setSettings(controller.reset());
      };
      const row = (key, label, hint, values) => h("div", {
        className: "wm-settings-row",
        key
      }, [
        h("div", { className: "wm-settings-copy", key: "copy" }, [
          h("div", { className: "wm-settings-label", key: "label" }, label),
          h("div", { className: "wm-settings-hint", key: "hint" }, hint)
        ]),
        h("div", {
          className: "wm-settings-segment",
          role: "group",
          "aria-label": label,
          key: "segment"
        }, values.map((value) => h("button", {
          type: "button",
          className: `wm-settings-option${settings[key] === value ? " is-selected" : ""}`,
          "aria-pressed": settings[key] === value,
          "data-wm-setting": key,
          "data-wm-value": value,
          onClick: () => update(key, value),
          key: value
        }, key === "palette" ? [
          h("span", { className: "wm-palette-swatch", "aria-hidden": "true", key: "swatch",
            style: { background: `linear-gradient(135deg, ${PALETTE_SWATCHES[value][0]} 50%, ${PALETTE_SWATCHES[value][1]} 50%)` } }),
          copy[value]
        ] : key === "background" && value === "wallpaper" ? copy.wallpaperEngine : copy[value])))
      ]);

      const range = (key) => h("label", { className: "wm-settings-row", key }, [
        h("span", { className: "wm-settings-copy", key: "copy" }, [
          h("span", { className: "wm-settings-label", key: "label" }, copy[key]),
          h("span", { className: "wm-settings-hint", key: "hint" }, copy[`${key}Hint`])
        ]),
        h("span", { className: "wm-range-control", key: "range" }, [
          h("input", { type: "range", min: RANGE_SETTINGS[key][0], max: RANGE_SETTINGS[key][1], step: 1,
            value: settings[key], "aria-label": copy[key], "data-wm-setting": key,
            onChange: (event) => update(key, Number(event.currentTarget.value)), key: "input" }),
          h("output", { key: "output" }, `${settings[key]}${key === "blur" ? "px" : "%"}`)
        ])
      ]);
      const mediaRow = (kind) => {
        const record = mediaState.media[kind];
        return h("div", { className: "wm-settings-row", key: `file-${kind}` }, [
          h("div", { className: "wm-settings-copy", key: "copy" }, [
            h("div", { className: "wm-settings-label", key: "label" }, copy[`${kind}File`]),
            h("div", { className: "wm-settings-hint wm-media-name", title: record?.name, key: "name" },
              record ? `${record.name} · ${(record.size / 1048576).toFixed(1)} MB` : copy[`${kind}Empty`])
          ]),
          h("div", { className: "wm-media-actions", key: "actions" }, [
            h("input", { type: "file", accept: `${kind}/*`, hidden: true, disabled: busy,
              "aria-label": copy[`${kind}File`], ref: (input) => { inputs.current[kind] = input; }, key: "file",
              onChange: async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file || busy) return;
                setBusy(true);
                try { setSettings(await controller.importMedia(kind, file)); }
                finally { setBusy(false); }
              } }),
            h("button", { type: "button", className: "wm-settings-option", disabled: busy, key: "choose",
              onClick: () => inputs.current[kind]?.click() }, copy[record ? "replace" : "choose"]),
            record && h("button", { type: "button", className: "wm-settings-option", disabled: busy, key: "remove",
              onClick: async () => { setBusy(true); try { await controller.media.remove(kind); } finally { setBusy(false); } }
            }, copy.remove)
          ])
        ]);
      };

      // Wallpaper Engine (experimental). The scene list is the Host whitelist; when the
      // Host, the packaged helper or the local sample is missing the row stays visible
      // and says why instead of silently doing nothing.
      const wallpaperUnavailable = (reason) => copy[`error${{ platform: "Platform", host: "Host", helper: "Helper", scene: "Scene" }[reason] ?? "Unavailable"}`];
      // Live values come from this client's own metrics; the Host snapshot is only used for
      // the configured limit and for the availability answer.
      const previewLimitSeconds = () => wallpaperStatus.host?.session?.seconds
        ?? wallpaperStatus.host?.previewSeconds?.default
        ?? 180;
      const previewClock = (seconds) => {
        const left = Math.max(0, Math.round(previewLimitSeconds() - seconds));
        return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      };
      const previewStatusText = () => {
        if (wallpaperStatus.host && wallpaperStatus.host.available === false) return wallpaperUnavailable(wallpaperStatus.host.unavailableReason);
        // A failed close is the more actionable message: the old window may still exist, so
        // it must not be masked by the generic unavailable text.
        if (wallpaperStatus.state === "cleanup-failed") return `${copy.previewCleanupFailed}：${wallpaperStatus.error || ""}`;
        if (previewActionError) return `${copy.errorUnavailable}：${previewActionError}`;
        if (wallpaperStatus.error) return `${copy.errorUnavailable}：${wallpaperStatus.error}`;
        // Which mode this run is actually in decides the wording: a daily run has no limit,
        // so showing a preview countdown would be a false promise.
        const mode = wallpaperStatus.mode ?? settings.weMode;
        const daily = mode === "daily";
        const runningClock = (seconds) => {
          const total = Math.max(0, Math.floor(seconds));
          const hours = Math.floor(total / 3600);
          const minutes = Math.floor((total % 3600) / 60);
          const rest = total % 60;
          return hours > 0
            ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
            : `${minutes}:${String(rest).padStart(2, "0")}`;
        };
        switch (wallpaperStatus.state) {
          case "starting": return copy.previewStarting;
          case "connecting": return copy.previewConnecting;
          case "playing": {
            const rendered = wallpaperStatus.rendered ?? 0;
            const seconds = Math.max(1, wallpaperStatus.seconds ?? 1);
            const rate = `${(rendered / seconds).toFixed(1)} 帧/秒`;
            if (daily) {
              // No countdown and no rate claim: the honest numbers are how long this run has
              // been going and how many frames it has drawn.
              return `${copy.dailyPlaying} · ${copy.runningFor} ${runningClock(wallpaperStatus.seconds ?? 0)} · ${copy.framesThisRun} ${rendered}`;
            }
            return `${copy.previewPlaying} · ${rendered} 帧 · ${rate} · ${copy.previewLimit} ${previewClock(wallpaperStatus.seconds ?? 0)}`;
          }
          case "waiting": return `${copy.previewWaiting} · ${wallpaperStatus.rendered ?? 0} 帧`;
          case "stopped": return copy.previewStopped;
          case "cleanup-failed": return `${copy.previewCleanupFailed}：${wallpaperStatus.error || ""}`;
          default: return copy.previewIdle;
        }
      };
      const previewActive = ["starting", "connecting", "playing", "waiting"].includes(wallpaperStatus.state);
      const cleanupFailed = wallpaperStatus.state === "cleanup-failed";
      /**
       * Runs the constrained playback action behind the watched buttons.
       *
       * It only uses the public controller surface: the layer itself is (re)created by the
       * render path when the first frame arrives, so this component must not reach into the
       * backdrop's or the theme's closure state. Every step, including the busy guard, is
       * inside try/finally so a failure never leaves the buttons stuck as busy.
       */
      const runPreview = (action) => async () => {
        if (previewBusy) return;
        try {
          setPreviewBusy(true);
          setPreviewActionError("");
          await controller.wallpaper[action](settings.weScene, settings.weMode);
        } catch (error) {
          setPreviewActionError(String(error?.message || "playback-failed"));
        } finally { setPreviewBusy(false); }
      };
      const wallpaperRow = () => h("div", { className: "wm-settings-row wm-wallpaper-row", key: "wallpaper-engine" }, [
        // The description needs a full-width line of its own: in a narrow panel the old
        // two-column row squeezed this column to zero width and the text wrapped one
        // character per line. Title above, controls below, both able to wrap.
        h("div", { className: "wm-settings-copy wm-wallpaper-copy", key: "copy" }, [
          h("div", { className: "wm-settings-label", key: "label" }, copy.wallpaperEngine),
          h("div", { className: "wm-settings-hint", key: "hint" }, copy.wallpaperEngineHint)
        ]),
        // Fields and actions are two groups: the scene/mode fields describe the next run, the
        // buttons act on it. Keeping them apart is also what keeps the three buttons together
        // on one row and equally sized instead of leaving stop alone on a line of its own.
        h("div", { className: "wm-wallpaper-fields", key: "fields" }, [
          h("label", { className: "wm-inline-field wm-wallpaper-field", key: "scene" }, [
            h("span", { className: "wm-inline-label", key: "label" }, copy.scene),
            h("select", {
              "aria-label": copy.scene, value: settings.weScene, key: "select",
              "data-wm-setting": "weScene", disabled: previewActive,
              onChange: (event) => update("weScene", event.currentTarget.value)
            }, WALLPAPER_SCENES.map(id => h("option", { value: id, key: id }, id === "lucy" ? "Lucy" : id)))
          ]),
          // The mode is stored for the next start; changing it never restarts the live run.
          h("label", { className: "wm-inline-field wm-wallpaper-field", key: "mode" }, [
            h("span", { className: "wm-inline-label", key: "label" }, copy.playMode),
            h("select", {
              "aria-label": copy.playMode, value: settings.weMode, key: "select",
              "data-wm-setting": "weMode",
              onChange: (event) => update("weMode", event.currentTarget.value)
            }, [
              h("option", { value: "daily", key: "daily" }, copy.modeDaily),
              h("option", { value: "preview", key: "preview" }, copy.modePreview)
            ])
          ])
        ]),
        h("div", { className: "wm-wallpaper-actions", key: "actions" }, [
          h("button", { type: "button", className: "wm-settings-option wm-wallpaper-button", key: "start",
            "data-wm-action": "wallpaper-start", disabled: previewBusy || previewActive || cleanupFailed,
            onClick: runPreview("start") }, copy.startPreview),
          h("button", { type: "button", className: "wm-settings-option wm-wallpaper-button", key: "restart",
            "data-wm-action": "wallpaper-restart", disabled: previewBusy || cleanupFailed,
            onClick: runPreview("restart") }, copy.restartPreview),
          // A close that could not be proven keeps the stop control available so the user
          // can retry it; a start stays blocked until the old window is confirmed gone.
          h("button", { type: "button", className: "wm-settings-option wm-wallpaper-button", key: "stop",
            "data-wm-action": "wallpaper-stop", disabled: previewBusy || (!previewActive && !cleanupFailed),
            onClick: runPreview("stop") }, cleanupFailed ? copy.retryCleanup : copy.stopPreview)
        ])
      ]);
      // Opt-in for the next DSH start. It never starts or stops anything by itself, so
      // toggling it cannot end a run the user is watching. This row is NOT a wm-wallpaper-row:
      // it stays a two-column row (text left, box right). Sharing the stacked WE row class made
      // the browser stretch the checkbox to the panel width, because that class sets
      // `align-items: stretch` on the cross axis.
      const autoStartRow = () => h("label", {
        className: "wm-settings-row wm-wallpaper-auto-start",
        key: "wallpaper-auto-start", "data-wm-auto-start": String(settings.weAutoStart)
      }, [
        h("span", { className: "wm-settings-copy", key: "copy" }, [
          h("span", { className: "wm-settings-label", key: "label" }, copy.autoStart),
          h("span", { className: "wm-settings-hint", key: "hint" }, copy.autoStartHint)
        ]),
        h("input", {
          type: "checkbox", checked: settings.weAutoStart, key: "checkbox",
          "aria-label": copy.autoStart, "data-wm-setting": "weAutoStart",
          onChange: (event) => update("weAutoStart", event.currentTarget.checked)
        })
      ]);
      // One row per region the user may cover with its own colour. They are plain checkboxes: the
      // segmented control above is for exclusive choices, these two are independent on/off switches,
      // and either may be combined with the other.
      const regionRow = (key) => h("label", {
        className: "wm-settings-row wm-region-row",
        key: `region-${key}`, "data-wm-region": key
      }, [
        h("span", { className: "wm-settings-copy", key: "copy" }, [
          h("span", { className: "wm-settings-label", key: "label" }, copy[key]),
          h("span", { className: "wm-settings-hint", key: "hint" }, copy[`${key}Hint`])
        ]),
        h("input", {
          type: "checkbox", checked: settings[key] === true, key: "checkbox",
          "aria-label": copy[key], "data-wm-setting": key,
          onChange: (event) => update(key, event.currentTarget.checked)
        })
      ]);
      const wallpaperStatusRow = () => h("p", {
        className: "wm-settings-hint", role: "status", "aria-live": "polite", key: "wallpaper-status",
        "data-wm-wallpaper-state": wallpaperStatus.state
      }, previewStatusText());

      return h("section", {
        className: "wm-settings-group",
        "data-wm-settings": ""
      }, [
        h("div", { className: "wm-settings-head", key: "head" }, [
          h("div", { className: "wm-settings-heading", key: "heading" }, [
            h("span", { className: "wm-settings-title", key: "title" }, copy.title),
            h("span", { className: "wm-settings-badge", key: "badge" }, copy.badge)
          ]),
          h("button", {
            type: "button",
            className: "wm-settings-reset",
            onClick: reset,
            key: "reset"
          }, copy.reset)
        ]),
        h("p", { className: "wm-settings-description", key: "description" }, copy.description),
        row("theme", copy.theme, copy.themeHint, ALLOWED_SETTINGS.theme),
        settings.theme === "abyss" && row("palette", copy.palette, copy.paletteHint, ALLOWED_SETTINGS.palette),
        row("canvas", copy.canvas, copy.canvasHint, ALLOWED_SETTINGS.canvas),
        row("sidebar", copy.sidebar, copy.sidebarHint, ALLOWED_SETTINGS.sidebar),
        row("glass", copy.glass, copy.glassHint, ALLOWED_SETTINGS.glass),
        h("h3", { className: "wm-settings-subtitle", key: "wallpaper-title" }, copy.wallpaper),
        row("background", copy.background, copy.backgroundHint, ALLOWED_SETTINGS.background),
        settings.background === "wallpaper" && wallpaperRow(),
        settings.background === "wallpaper" && autoStartRow(),
        settings.background === "wallpaper" && wallpaperStatusRow(),
        settings.background === "image" && mediaRow("image"),
        settings.background === "video" && mediaRow("video"),
        settings.background === "video" && row("motion", copy.motion, copy.motionHint, ALLOWED_SETTINGS.motion),
        settings.background !== "none" && range("brightness"),
        settings.background !== "none" && range("mask"),
        settings.background !== "none" && range("blur"),
        settings.background !== "none" && range("surface"),
        // Which regions may cover the background. The preference is kept even when no background is
        // selected, so switching back finds the same choice; nothing changes while it is inactive.
        settings.background !== "none" && h("h3", {
          className: "wm-settings-subtitle", key: "region-title" }, copy.regionTitle),
        settings.background !== "none" && regionRow("opaqueSidebar"),
        settings.background !== "none" && regionRow("opaqueChat"),
        (settings.background === "image" || settings.background === "video") && h("p", {
          className: "wm-settings-hint", role: "status", "aria-live": "polite", key: "status" },
          copy.status[mediaState.error || mediaState.status] || "")
      ]);
    }

    function WhaleSessionStatus({ useSession, statusController }) {
      const h = React.createElement;
      const running = useSession((snapshot) => snapshot.running);
      // DSH <= 0.1.1 exposed approval prompts as `pending`; the 0.1.5
      // SessionSnapshot removed that field. Keep the legacy signal when present,
      // but never let a missing optional capability crash the whole header slot.
      const pendingCount = useSession((snapshot) => (
        Array.isArray(snapshot.pending) ? snapshot.pending.length : 0
      ));
      const removed = useSession((snapshot) => snapshot.removed);
      const themeActive = React.useSyncExternalStore(
        statusController.theme.subscribe,
        statusController.theme.getSnapshot,
        statusController.theme.getSnapshot
      );
      const [qaStatus, setQaStatus] = React.useState(null);
      const actualStatus = removed
        ? "idle"
        : pendingCount > 0
          ? "waiting"
          : running
            ? "running"
            : "idle";
      const liveStatus = qaStatus ?? actualStatus;
      const previousStatus = React.useRef(liveStatus);
      const [displayStatus, setDisplayStatus] = React.useState(liveStatus);
      const [leaving, setLeaving] = React.useState(false);

      React.useEffect(() => {
        // Private test signal. Keeping this listener inert until the custom
        // event arrives avoids depending on Harness' short-lived token URL:
        // its query string is cleared before delayed Session headers mount.
        const receivePreview = (event) => {
          const next = event.detail;
          setQaStatus(["idle", "running", "waiting"].includes(next) ? next : null);
        };
        window.addEventListener("dsh-whale-mist:qa-status", receivePreview);
        return () => window.removeEventListener("dsh-whale-mist:qa-status", receivePreview);
      }, []);

      React.useEffect(() => {
        const previous = previousStatus.current;
        previousStatus.current = liveStatus;
        let leaveTimer;
        let clearTimer;

        if (liveStatus !== "idle") {
          setLeaving(false);
          setDisplayStatus(liveStatus);
        } else if (previous === "running" || previous === "waiting") {
          setLeaving(false);
          setDisplayStatus("complete");
          leaveTimer = window.setTimeout(() => setLeaving(true), 1100);
          clearTimer = window.setTimeout(() => {
            setDisplayStatus("idle");
            setLeaving(false);
          }, 1340);
        } else {
          setDisplayStatus("idle");
          setLeaving(false);
        }

        return () => {
          window.clearTimeout(leaveTimer);
          window.clearTimeout(clearTimer);
        };
      }, [liveStatus]);

      if (!themeActive || displayStatus === "idle") return null;

      const chinese = (navigator.language || "").toLowerCase().startsWith("zh");
      const labels = chinese ? {
        running: "运行中",
        waiting: "等待确认",
        complete: "已完成"
      } : {
        running: "Running",
        waiting: "Waiting for you",
        complete: "Complete"
      };
      const label = labels[displayStatus];

      return h("div", {
        className: `wm-session-status wm-session-status-${displayStatus}${leaving ? " is-leaving" : ""}`,
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
        "aria-label": label,
        title: label,
        "data-wm-status": displayStatus
      }, [
        h("span", { className: "wm-status-mark", "aria-hidden": "true", key: "mark" },
          h(FishLogo, { size: 13, className: "wm-status-logo" })
        ),
        h("span", { className: "wm-status-label", key: "label" }, label)
      ]);
    }

    const css = `
      body.${ACTIVE_CLASS} {
        min-height: 100vh;
        background:
          radial-gradient(72rem 46rem at 78% -12%, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.18) 45%, transparent 68%),
          radial-gradient(42rem 32rem at -8% 72%, rgba(181, 222, 250, 0.38) 0%, transparent 70%),
          linear-gradient(145deg, #f4f9ff 0%, #edf6fe 48%, #e6f2fc 100%);
        color: var(--dsw-alias-label-primary);
        font-family: var(--dsw-font-family);
        font-optical-sizing: auto;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }

      body.${ACTIVE_CLASS}::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(108deg, rgba(255, 255, 255, 0.22), transparent 34%, rgba(119, 187, 230, 0.06));
      }

      body.${ACTIVE_CLASS}[data-wm-canvas="clear"] {
        --dsw-alias-bg-base: rgba(244, 250, 255, 0.9) !important;
        --dsw-alias-bg-layer-1: rgba(255, 255, 255, 0.78) !important;
        --dsw-alias-bg-layer-2: rgba(229, 241, 250, 0.82) !important;
        background:
          radial-gradient(68rem 40rem at 80% -10%, #ffffff 0%, rgba(255, 255, 255, 0.2) 48%, transparent 70%),
          linear-gradient(145deg, #f7fbff 0%, #eef7fe 52%, #e7f3fc 100%);
      }

      body.${ACTIVE_CLASS}[data-wm-sidebar="deep"] {
        --dsw-specific-sidebar-fill: rgba(207, 229, 246, 0.9) !important;
        --dsw-specific-sidebar-nav-item-active: rgba(255, 255, 255, 0.7) !important;
        --dsw-specific-sidebar-nav-item-hover: rgba(255, 255, 255, 0.5) !important;
      }

      body.${ACTIVE_CLASS}[data-wm-glass="restrained"] {
        --dsw-alias-bg-layer-1: rgba(251, 254, 255, 0.9) !important;
        --dsw-alias-bg-layer-2: rgba(231, 242, 250, 0.92) !important;
        --dsw-alias-bg-layer-3: rgba(252, 254, 255, 0.94) !important;
        --dsw-alias-bg-overlay: #f8fbfe !important;
        --dsw-specific-menu: #f8fbfe !important;
        --dsw-specific-selector: rgba(248, 252, 255, 0.9) !important;
        --dsw-mask-blur: blur(12px) saturate(112%) !important;
      }

      body.${ABYSS_ACTIVE_CLASS} {
        min-height: 100vh;
        background:
          radial-gradient(60rem 38rem at 82% -14%, rgba(116, 91, 204, 0.13) 0%, transparent 66%),
          radial-gradient(46rem 34rem at -12% 78%, rgba(64, 111, 151, 0.12) 0%, transparent 72%),
          linear-gradient(145deg, #0b111d 0%, #080b14 52%, #070a12 100%);
        color: var(--dsw-alias-label-primary);
        font-family: var(--dsw-font-family);
        font-optical-sizing: auto;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }

      body.${ABYSS_ACTIVE_CLASS}::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(108deg, rgba(117, 146, 187, 0.025), transparent 38%, rgba(140, 114, 242, 0.035));
      }

      body.${ABYSS_ACTIVE_CLASS}[data-wm-canvas="clear"] {
        --dsw-alias-bg-base: #080b14 !important;
        --dsw-alias-bg-layer-1: #0f1726 !important;
        --dsw-alias-bg-layer-2: #172236 !important;
        background:
          radial-gradient(58rem 36rem at 84% -16%, rgba(116, 91, 204, 0.09) 0%, transparent 68%),
          linear-gradient(145deg, #0c1321 0%, #080b14 58%, #070a12 100%);
      }

      body.${ABYSS_ACTIVE_CLASS}[data-wm-sidebar="deep"] {
        --dsw-specific-sidebar-fill: rgba(10, 16, 28, 0.98) !important;
        --dsw-specific-sidebar-nav-item-active: rgba(140, 114, 242, 0.18) !important;
        --dsw-specific-sidebar-nav-item-hover: rgba(231, 236, 245, 0.055) !important;
      }

      body.${ABYSS_ACTIVE_CLASS}[data-wm-glass="restrained"] {
        --dsw-alias-bg-layer-1: rgba(15, 23, 38, 0.985) !important;
        --dsw-alias-bg-layer-2: rgba(23, 34, 54, 0.985) !important;
        --dsw-alias-bg-layer-3: rgba(28, 40, 62, 0.99) !important;
        --dsw-alias-bg-overlay: #172236 !important;
        --dsw-specific-menu: #131d2f !important;
        --dsw-specific-selector: #1c283e !important;
        --dsw-mask-blur: blur(12px) saturate(106%) !important;
      }

      .wm-settings-group {
        box-sizing: border-box;
        width: 100%;
        border-bottom: 1px solid var(--dsw-alias-border-l2);
        padding: 16px 0;
      }

      .wm-settings-head,
      .wm-settings-heading,
      .wm-settings-row,
      .wm-settings-segment {
        display: flex;
        align-items: center;
      }

      .wm-settings-head {
        justify-content: space-between;
        gap: 16px;
      }

      .wm-settings-heading {
        min-width: 0;
        gap: 8px;
      }

      .wm-settings-title {
        color: var(--dsw-alias-label-primary);
        font-size: 14px;
        font-weight: 500;
        line-height: 22px;
      }

      .wm-settings-badge {
        color: var(--dsw-alias-brand-primary);
        background: var(--dsw-alias-state-business-tertiary);
        border-radius: 999px;
        padding: 1px 7px;
        font-size: 11px;
        font-weight: 600;
        line-height: 18px;
        letter-spacing: 0.01em;
      }

      .wm-settings-description {
        max-width: 38rem;
        margin: 4px 0 10px;
        color: var(--dsw-alias-label-secondary);
        font-size: 13px;
        line-height: 20px;
      }

      .wm-settings-reset {
        flex: none;
        min-height: 30px;
        border: 0;
        border-radius: 9px;
        padding: 4px 9px;
        color: var(--dsw-alias-label-secondary);
        background: transparent;
        font: inherit;
        font-size: 12px;
        line-height: 20px;
        cursor: pointer;
      }

      .wm-settings-reset:hover {
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-interactive-bg-hover);
      }

      .wm-settings-row {
        justify-content: space-between;
        gap: 20px;
        min-height: 52px;
        border-top: 1px solid var(--dsw-alias-separator-primary);
      }

      .wm-settings-copy {
        min-width: 0;
        padding: 8px 0;
      }

      .wm-settings-label {
        color: var(--dsw-alias-label-primary);
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
      }

      .wm-settings-hint {
        color: var(--dsw-alias-label-tertiary);
        font-size: 12px;
        line-height: 18px;
      }

      .wm-settings-segment {
        flex: none;
        gap: 2px;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 11px;
        padding: 2px;
        background: var(--dsw-alias-bg-layer-2);
      }

      .wm-settings-option {
        min-width: 64px;
        min-height: 30px;
        border: 0;
        border-radius: 8px;
        padding: 4px 10px;
        color: var(--dsw-alias-label-secondary);
        background: transparent;
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        line-height: 20px;
        cursor: pointer;
      }

      .wm-settings-option:hover:not(.is-selected) {
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-interactive-bg-hover);
      }

      .wm-settings-option.is-selected {
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-bg-layer-1);
        box-shadow: var(--dsw-shadow-lv1);
      }

      .wm-session-status {
        display: inline-flex;
        align-items: center;
        box-sizing: border-box;
        height: 26px;
        gap: 6px;
        border: 1px solid rgba(54, 101, 136, 0.15);
        border-radius: 999px;
        padding: 0 9px 0 5px;
        color: var(--dsw-alias-label-secondary);
        background: rgba(250, 253, 255, 0.72);
        box-shadow: 0 1px 2px rgba(36, 76, 106, 0.05);
        font-family: var(--dsw-font-family);
        font-size: 12px;
        font-weight: 500;
        line-height: 16px;
        white-space: nowrap;
        pointer-events: none;
        transition: opacity 180ms ease, transform 180ms ease, border-color 160ms ease, color 160ms ease;
        animation: wm-status-arrive 160ms cubic-bezier(0.23, 1, 0.32, 1) both;
      }

      .wm-session-status.is-leaving {
        opacity: 0;
        transform: translateY(-2px) scale(0.98);
      }

      .wm-status-mark {
        position: relative;
        display: grid;
        flex: none;
        width: 18px;
        height: 18px;
        place-items: center;
        border-radius: 50%;
        color: #ffffff;
        background: var(--dsw-alias-brand-primary);
        transition: background-color 160ms ease;
      }

      .wm-status-logo {
        display: block;
      }

      .wm-session-status-running .wm-status-mark::after {
        content: "";
        position: absolute;
        inset: -3px;
        border: 1px solid rgba(20, 104, 168, 0.34);
        border-radius: inherit;
        animation: wm-status-breathe 1.8s ease-out infinite;
      }

      .wm-session-status-waiting {
        color: var(--dsw-alias-state-warn-label);
        border-color: rgba(169, 106, 34, 0.19);
        background: rgba(255, 250, 240, 0.82);
      }

      .wm-session-status-waiting .wm-status-mark {
        background: var(--dsw-alias-state-warn-primary);
      }

      .wm-session-status-complete {
        color: var(--dsw-alias-state-success-primary);
        border-color: rgba(43, 129, 100, 0.18);
        background: rgba(244, 252, 248, 0.84);
      }

      .wm-session-status-complete .wm-status-mark {
        background: var(--dsw-alias-state-success-primary);
      }

      body.${ABYSS_ACTIVE_CLASS} .wm-session-status {
        border-color: rgba(125, 145, 177, 0.17);
        background: rgba(19, 29, 47, 0.9);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.24);
      }

      body.${ABYSS_ACTIVE_CLASS} .wm-session-status-running .wm-status-mark::after {
        border-color: rgba(140, 114, 242, 0.46);
      }

      body.${ABYSS_ACTIVE_CLASS} .wm-session-status-waiting {
        border-color: rgba(227, 168, 93, 0.22);
        background: rgba(53, 40, 27, 0.88);
      }

      body.${ABYSS_ACTIVE_CLASS} .wm-session-status-complete {
        border-color: rgba(100, 205, 162, 0.2);
        background: rgba(19, 47, 40, 0.88);
      }

      @keyframes wm-status-arrive {
        from {
          opacity: 0;
          transform: translateY(2px) scale(0.98);
        }
      }

      @keyframes wm-status-breathe {
        0% {
          opacity: 0;
          transform: scale(0.82);
        }
        42% {
          opacity: 0.62;
        }
        100% {
          opacity: 0;
          transform: scale(1.18);
        }
      }

      @media (max-width: 720px) {
        .wm-settings-row {
          align-items: stretch;
          flex-direction: column;
          gap: 4px;
          padding: 10px 0;
        }

        .wm-settings-segment {
          align-self: stretch;
        }

        .wm-settings-option {
          flex: 1;
        }
      }

      /* Harmonize dsh-reasoning-effort with Whale Mist's light surface.
         Keep the resting track blue-white and let the plugin's moving radiation
         carry the indigo-violet depth without affecting the
         official light/dark themes. */
      body.${ACTIVE_CLASS} .re-effort-track {
        background:
          linear-gradient(100deg, #f8fcff 0%, #edf7ff 48%, #dceefb 100%) !important;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.92),
          inset 0 0 0 1px rgba(72, 124, 164, 0.14),
          0 3px 12px rgba(47, 91, 124, 0.12) !important;
      }

      body.${ACTIVE_CLASS} .re-effort-slider:not([data-effort="off"]) .re-effort-track::before {
        background: linear-gradient(90deg, #e9dcff 0%, #c9a9ff 22%, #8e62dd 56%, #4d278f 100%) !important;
      }

      body.${ACTIVE_CLASS} .re-effort-slider[data-top="true"] .re-effort-track::before,
      body.${ACTIVE_CLASS} .re-effort-slider[data-effort="max"] .re-effort-track::before {
        background: linear-gradient(90deg, #e9dcff 0%, #bc91ff 18%, #7950cf 54%, #3f1b7f 100%) !important;
      }

      body.${ACTIVE_CLASS} .re-effort-slider:not([data-effort="off"]) .re-effort-track::after {
        background:
          radial-gradient(circle at 18% 45%, rgba(137, 96, 230, 0.2), transparent 25%),
          linear-gradient(90deg, rgba(106, 63, 179, 0.08), transparent 42%, rgba(70, 31, 139, 0.18)) !important;
      }

      body.${ACTIVE_CLASS} .re-effort .re-effort-canvas {
        opacity: 0.9;
        mix-blend-mode: multiply;
        filter: hue-rotate(42deg) saturate(1.5) contrast(1.08);
      }

      body.${ACTIVE_CLASS} .re-effort.is-dragging .re-effort-canvas {
        filter: hue-rotate(42deg) saturate(1.66) brightness(1.1) contrast(1.12);
      }

      body.${ACTIVE_CLASS} .re-effort-fx::after {
        content: "";
        position: absolute;
        z-index: 3;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background:
          radial-gradient(ellipse 68px 34px at var(--re-progress) 50%, rgba(198, 156, 255, 0.5) 0%, rgba(137, 96, 234, 0.24) 34%, transparent 72%);
        mix-blend-mode: multiply;
        opacity: 1;
        transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1);
      }

      /* v0.8 renders the lowest position as range value 0 instead of
         exposing the older data-effort attribute. */
      body.${ACTIVE_CLASS} .re-effort-slider[data-effort="off"] .re-effort-fx::after,
      body.${ACTIVE_CLASS} .re-effort-slider:has(.re-effort-input[value="0"]) .re-effort-fx::after {
        opacity: 0;
      }

      body.${ACTIVE_CLASS} .re-effort .re-effort-flare {
        background: radial-gradient(ellipse at 100% 50%, rgba(241, 228, 255, 0.94) 0 4%, rgba(209, 181, 255, 0.84) 12%, rgba(139, 83, 235, 0.58) 30%, rgba(75, 35, 156, 0.22) 53%, transparent 75%);
        filter: blur(2px) saturate(1.24);
        transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1);
      }

      body.${ACTIVE_CLASS} .re-effort .re-effort-flare::before {
        background: linear-gradient(90deg, transparent, rgba(151, 112, 245, 0.46), #eadcff, rgba(116, 53, 202, 0.7), transparent) !important;
        box-shadow: 0 0 7px rgba(155, 103, 235, 0.72), 0 0 13px rgba(91, 70, 201, 0.5) !important;
      }

      body.${ACTIVE_CLASS} .re-effort .re-effort-flare::after {
        background: linear-gradient(180deg, transparent, rgba(222, 194, 255, 0.92), transparent) !important;
        box-shadow: 0 0 7px rgba(140, 83, 223, 0.68) !important;
      }

      body.${ACTIVE_CLASS} .re-effort-slider[data-effort="off"] .re-effort-flare,
      body.${ACTIVE_CLASS} .re-effort-slider:has(.re-effort-input[value="0"]) .re-effort-flare {
        opacity: 0;
      }

      body.${ACTIVE_CLASS} .re-effort.is-dragging .re-effort-flare {
        filter: blur(1.5px) saturate(1.38) brightness(1.22);
      }

      body.${ACTIVE_CLASS} .re-effort .re-effort-knob {
        box-shadow:
          0 0 0 2px rgba(94, 133, 222, 0.16),
          0 0 13px rgba(119, 82, 205, 0.38),
          0 2px 7px rgba(34, 61, 88, 0.24);
      }

      body.${ACTIVE_CLASS} .re-effort-slider[data-effort="off"] .re-effort-knob,
      body.${ACTIVE_CLASS} .re-effort-slider:has(.re-effort-input[value="0"]) .re-effort-knob {
        box-shadow:
          0 0 0 2px rgba(74, 139, 190, 0.12),
          0 3px 9px rgba(42, 86, 119, 0.18);
      }

      body.${ACTIVE_CLASS} .re-effort-slider[data-top="true"] .re-effort-knob,
      body.${ACTIVE_CLASS} .re-effort-slider[data-effort="max"] .re-effort-knob {
        box-shadow:
          0 0 0 3px rgba(126, 99, 221, 0.18),
          0 0 20px rgba(132, 83, 225, 0.62),
          0 0 30px rgba(64, 126, 218, 0.28),
          0 3px 8px rgba(34, 61, 88, 0.24);
      }

      body.${ACTIVE_CLASS} button,
      body.${ACTIVE_CLASS} [role="button"],
      body.${ABYSS_ACTIVE_CLASS} button,
      body.${ABYSS_ACTIVE_CLASS} [role="button"] {
        transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
      }

      body.${ACTIVE_CLASS} button:active,
      body.${ACTIVE_CLASS} [role="button"]:active,
      body.${ABYSS_ACTIVE_CLASS} button:active,
      body.${ABYSS_ACTIVE_CLASS} [role="button"]:active {
        transform: scale(0.975);
      }

      body.${ACTIVE_CLASS} :focus-visible {
        outline: 2px solid rgba(20, 104, 168, 0.62);
        outline-offset: 2px;
      }

      body.${ABYSS_ACTIVE_CLASS} :focus-visible {
        outline: 2px solid rgba(140, 114, 242, 0.72);
        outline-offset: 2px;
      }

      @media (prefers-reduced-motion: reduce) {
        body.${ACTIVE_CLASS} button,
        body.${ACTIVE_CLASS} [role="button"],
        body.${ABYSS_ACTIVE_CLASS} button,
        body.${ABYSS_ACTIVE_CLASS} [role="button"] {
          transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
        }

        body.${ACTIVE_CLASS} button:active,
        body.${ACTIVE_CLASS} [role="button"]:active,
        body.${ABYSS_ACTIVE_CLASS} button:active,
        body.${ABYSS_ACTIVE_CLASS} [role="button"]:active {
          transform: none;
        }

        .wm-session-status,
        .wm-session-status-running .wm-status-mark::after {
          animation: none;
        }

        .wm-session-status {
          transition: opacity 120ms ease, color 120ms ease, border-color 120ms ease;
        }
      }

      @media (prefers-reduced-transparency: reduce) {
        body.${ACTIVE_CLASS} {
          --dsw-alias-bg-base: #eef7fe !important;
          --dsw-alias-bg-layer-1: #f8fbfe !important;
          --dsw-alias-bg-layer-2: #e5f1fa !important;
          --dsw-alias-bg-overlay: #f8fbfe !important;
          --dsw-specific-sidebar-fill: #deedf8 !important;
          --dsw-specific-input-major: #f8fbfe !important;
          --dsw-specific-menu: #f8fbfe !important;
          --dsw-mask-blur: none !important;
        }

        body.${ABYSS_ACTIVE_CLASS} {
          --dsw-alias-bg-base: #080b14 !important;
          --dsw-alias-bg-layer-1: #0f1726 !important;
          --dsw-alias-bg-layer-2: #172236 !important;
          --dsw-alias-bg-overlay: #172236 !important;
          --dsw-specific-sidebar-fill: #0f1726 !important;
          --dsw-specific-input-major: #172236 !important;
          --dsw-specific-menu: #131d2f !important;
          --dsw-mask-blur: none !important;
        }
      }

      @media (prefers-contrast: more) {
        body.${ACTIVE_CLASS} {
          --dsw-alias-label-secondary: #3c566b !important;
          --dsw-alias-label-tertiary: #506b80 !important;
          --dsw-alias-border-l2: rgba(23, 63, 92, 0.38) !important;
          --dsw-alias-border-l3: rgba(16, 55, 83, 0.56) !important;
          --dsw-alias-bg-layer-1: rgba(255, 255, 255, 0.9) !important;
        }

        body.${ABYSS_ACTIVE_CLASS} {
          --dsw-alias-label-secondary: #c0cada !important;
          --dsw-alias-label-tertiary: #a3afc2 !important;
          --dsw-alias-border-l2: rgba(188, 201, 222, 0.38) !important;
          --dsw-alias-border-l3: rgba(204, 214, 231, 0.52) !important;
          --dsw-alias-bg-layer-1: rgba(15, 23, 38, 0.99) !important;
        }
      }
    `;

    const backdropSelector = `body:is(.${ACTIVE_CLASS}, .${ABYSS_ACTIVE_CLASS})[data-wm-backdrop][data-wm-canvas]`;
    const backdropCss = `
      body.${ACTIVE_CLASS} {
        --wm-base-rgb: 239 247 254; --wm-sidebar-rgb: 228 240 249;
        --wm-layer1-rgb: 255 255 255; --wm-layer2-rgb: 230 242 251; --wm-layer3-rgb: 252 254 255;
      }
      body.${ABYSS_ACTIVE_CLASS}[data-wm-palette="ocean"] {
        --wm-base-rgb: 8 11 20; --wm-sidebar-rgb: 15 23 38;
        --wm-layer1-rgb: 15 23 38; --wm-layer2-rgb: 23 34 54; --wm-layer3-rgb: 28 40 62;
      }
      body.${ACTIVE_CLASS}[data-wm-sidebar="deep"] { --wm-sidebar-rgb: 207 229 246; }
      body.${ABYSS_ACTIVE_CLASS}[data-wm-palette="ocean"][data-wm-sidebar="deep"] { --wm-sidebar-rgb: 10 16 28; }
      #wm-backdrop { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
      #wm-backdrop .wm-backdrop-media { width: 100%; height: 100%; object-fit: cover; display: block;
        filter: brightness(var(--wm-bg-brightness, .7)) blur(var(--wm-bg-blur, 0px)); }
      #wm-backdrop .wm-backdrop-mask { position: absolute; inset: 0; background: rgb(var(--wm-base-rgb) / var(--wm-bg-mask, .45)); }
      ${backdropSelector} #root { position: relative; z-index: 1; }
      ${backdropSelector} {
        --dsw-alias-bg-base: transparent !important; --dsw-alias-bg-primary: transparent !important;
        --dsw-alias-bg-layer-1: rgb(var(--wm-layer1-rgb) / var(--wm-ui-alpha)) !important;
        --dsw-alias-bg-layer-2: rgb(var(--wm-layer2-rgb) / var(--wm-ui-alpha)) !important;
        --dsw-alias-bg-layer-3: rgb(var(--wm-layer3-rgb) / var(--wm-ui-alpha)) !important;
        --dsw-specific-sidebar-fill: rgb(var(--wm-sidebar-rgb) / var(--wm-ui-alpha)) !important;
        --dsw-alias-bg-overlay: rgb(var(--wm-layer2-rgb)) !important;
        --dsw-specific-menu: rgb(var(--wm-layer2-rgb)) !important;
        --dsw-specific-selector: rgb(var(--wm-layer3-rgb)) !important;
        --dsw-specific-tip: rgb(var(--wm-layer2-rgb)) !important;
        --dsw-specific-input-major: linear-gradient(rgb(var(--wm-layer2-rgb)), rgb(var(--wm-layer1-rgb))) !important;
      }
      /* V1: the Windows title bar strip must stay opaque whatever the surface transparency is.
         The host paints BOTH the top strip and the whole application frame with the sidebar
         fill: the frame gets padding-top equal to the title bar height plus that same fill as
         its background, while its ::before is the drag strip covering inset 0 0 auto at exactly
         the title bar height. Making the frame opaque therefore covered the entire wallpaper
         (rc.14 defect); the frame background is cleared instead and only the top strip is
         painted, which still covers the padded top band. The sidebar and the content column keep
         their own backgrounds, so they stay translucent.
         V2: the same transparency removed the composer's protection. rc.14/rc.15 painted the seat,
         the overlay and the card with one flat colour, rc.16 turned the seat into a wide dark ramp,
         and both covered the wallpaper around the input box (R4/R5). The model is now:
           - only the input card is opaque, with the surface the host already gives it;
           - nothing else in the composer is painted, so the wallpaper stays visible around and
             below the card;
           - the chat history is cut off by a mask on the message layer itself, so text reaching
             the input area fades out without drawing any background over the wallpaper.
         Scope note: these selectors rely on the hooks the current host ships (the
         data-windows-titlebar attribute, data-phase, and its component class names). They are
         not a public stable API, so if a host update renames them the rules simply stop
         matching and the theme looks like it did before this fix; nothing else breaks. */
      html[data-windows-titlebar]:has(${backdropSelector}) .BynINW_frame {
        background: transparent !important;
      }
      html[data-windows-titlebar]:has(${backdropSelector}) .BynINW_frame::before {
        background: rgb(var(--wm-base-rgb)) !important;
      }
      /* The input card alone is opaque, with the surface it already has. */
      html:has(${backdropSelector}) .Dc7zOa_composerSeat .RlGAzG_card {
        background: var(--dsw-specific-input-major) !important;
      }
      /* Per-region backgrounds: the user decides which areas cover the wallpaper with their own
         colour. Each rule paints one local container, and only while a background is actually
         active, so the frame, the input surroundings, menus and every other region keep the
         behaviour above. The colours are the theme's own: the sidebar colour it already uses
         (including the deep variant and each palette) and the base colour for the chat column.
         The chat switch covers the whole right-hand column, which is the centre column: the session
         title and the conversation/trace tabs live in that column above the body, so painting only
         the body left them showing the wallpaper (R7). The column, not the frame, is painted, so the
         window title bar strip and the left region stay as they are. */
      ${backdropSelector}[data-wm-opaque-sidebar] .BynINW_sidebarCol {
        background: rgb(var(--wm-sidebar-rgb)) !important;
      }
      ${backdropSelector}[data-wm-opaque-chat] .BynINW_centerCol {
        background: rgb(var(--wm-base-rgb)) !important;
      }
      /* The session list ends with its own 24px fade to the sidebar fill, which softens the last
         rows against the account area in the normal theme. In the wallpaper state that fill is
         translucent, so the fade lays a second layer of the same colour over the wallpaper and the
         bottom of the list turns into a measurably darker rectangle (reproduced in
         qa/sidebar-bottom-band.mjs: 39.3 to 32.4 luminance across the band, with hard left and right
         edges). It is removed only when it would do that: with a background active and the sidebar
         still allowed to show it. With the sidebar set to its own solid colour, and in the normal
         theme, the host's fade is left alone. */
      ${backdropSelector}:not([data-wm-opaque-sidebar]) ._9lTDKa_fade {
        background: none !important;
      }
      /* Only measured message siblings receive this attribute. Insets refer to their border
         box, updated on scroll/resize/session changes; the card and its surroundings stay intact. */
      html:has(${backdropSelector}) [data-wm-history-clip] {
        clip-path: inset(0px 0px var(--wm-history-clip-bottom, 0px) 0px) !important;
      }
      @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
        ${backdropSelector} { --wm-ui-alpha: 1 !important; --dsw-alias-bg-base: rgb(var(--wm-base-rgb)) !important;
          --dsw-alias-bg-primary: rgb(var(--wm-base-rgb)) !important; }
        ${backdropSelector} #wm-backdrop { display: none; }
      }
      .wm-settings-label, .wm-settings-hint { display: block; }
      .wm-settings-subtitle { margin: 24px 0 8px; font-size: 14px; font-weight: 500; }
      .wm-media-actions, .wm-range-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      .wm-inline-field { display: inline-flex; align-items: center; gap: 6px; }
      .wm-inline-label { font-size: 12px; opacity: .8; }
      .wm-inline-field select { background: var(--dsw-alias-bg-layer-2); color: inherit; border-radius: 6px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.2)); padding: 3px 6px; font: inherit; }
      /* Wallpaper Engine area only: the description gets its own full-width line and the
         controls sit below it, wrapping when the settings panel is narrow. A two-column row
         here used to collapse the text column to zero width, which wrapped the hint one
         character per line. The other rows (image/video, sliders, theme) keep their layout. */
      .wm-wallpaper-row {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        justify-content: flex-start;
      }
      .wm-wallpaper-copy {
        width: 100%;
        max-width: none;
        padding: 4px 0 0;
      }
      .wm-wallpaper-copy .wm-settings-hint {
        max-width: 68ch;
        overflow-wrap: anywhere;
      }
      .wm-wallpaper-actions {
        /* display is required: flex-wrap/gap/flex on the children do nothing in a block box,
           which is why rc.14 shipped a group with a declared 8px gap and an actual 0px one. */
        display: flex;
        flex-wrap: wrap;
        align-items: stretch;
        justify-content: flex-start;
        gap: 8px;
        flex-shrink: 1;
        min-width: 0;
        max-width: 100%;
      }
      .wm-wallpaper-fields {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        min-width: 0;
        max-width: 100%;
      }
      .wm-wallpaper-field {
        flex: 0 1 auto;
        min-width: 0;
        max-width: 100%;
      }
      .wm-wallpaper-field select {
        min-width: 0;
        max-width: 100%;
      }
      /* V3: the three actions are one equally sized group with a visible surface, so stop is
         never left as a small transparent label on a line of its own. Only the WE buttons get
         this treatment; the shared settings option style is untouched for other settings. */
      .wm-wallpaper-button {
        flex: 1 1 0;
        min-width: 96px;
        min-height: 36px;
        padding: 0 14px;
        font-size: 14px;
        line-height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgb(var(--wm-layer2-rgb)) !important;
        border: 1px solid var(--dsw-alias-border-l2) !important;
        color: var(--dsw-alias-label-primary);
      }
      .wm-wallpaper-button:hover:not(:disabled) {
        background: rgb(var(--wm-layer3-rgb)) !important;
        border-color: var(--dsw-alias-brand-primary) !important;
      }
      /* Below this width the three buttons genuinely cannot share one row, so the whole group
         becomes one column on purpose: every action is full width and stop is never the lone
         straggler on a second line. A container query keeps the decision tied to the group's own
         width, which is what the settings panel changes; hosts without container query support
         just keep the wrapping row above. */
      @supports (container-type: inline-size) {
        .wm-wallpaper-actions {
          container-type: inline-size;
        }
        @container (max-width: 320px) {
          .wm-wallpaper-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .wm-wallpaper-button {
            flex: 0 0 auto;
            width: 100%;
          }
        }
      }
      /* The checkbox row keeps the two-column shape, but its text column may shrink and the
         control itself never does, so a narrow panel cannot squeeze the label to nothing.
         Stretching is reset explicitly: a host form rule can set align-self or a width on
         inputs, and without this the box would fill the row instead of staying square. */
      .wm-wallpaper-auto-start {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 20px;
      }
      .wm-wallpaper-auto-start .wm-settings-copy {
        flex: 1 1 auto;
        min-width: 0;
        width: auto;
      }
      .wm-wallpaper-auto-start input[type="checkbox"] {
        flex: 0 0 auto;
        align-self: center;
        inline-size: 16px;
        block-size: 16px;
        width: 16px;
        height: 16px;
        min-width: 16px;
        max-width: 16px;
        margin: 0;
      }
      /* The region switches share the checkbox row's geometry: text column on the left, a fixed
         square box on the right, wrapping in a narrow panel instead of squeezing the label. */
      .wm-region-row {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 20px;
      }
      .wm-region-row .wm-settings-copy {
        flex: 1 1 auto;
        min-width: 0;
        width: auto;
      }
      .wm-region-row input[type="checkbox"] {
        flex: 0 0 auto;
        align-self: center;
        inline-size: 16px;
        block-size: 16px;
        width: 16px;
        height: 16px;
        min-width: 16px;
        max-width: 16px;
        margin: 0;
      }
      .wm-range-control input { width: 160px; accent-color: var(--dsw-alias-brand-primary); }
      .wm-range-control output { min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; font-size: 12px; }
      .wm-media-name { max-width: 32rem; overflow-wrap: anywhere; }
      .wm-palette-swatch { display: inline-block; width: 12px; height: 12px; border: 1px solid currentColor;
        border-radius: 50%; vertical-align: -2px; margin-right: 5px; }
      .wm-settings-option:disabled { opacity: .5; cursor: wait; }
      .wm-settings-option:focus-visible, .wm-settings-reset:focus-visible, .wm-range-control input:focus-visible {
        outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px;
      }
      @media (max-width: 720px) {
        .wm-settings-segment { flex-wrap: wrap; }
        .wm-range-control { width: 100%; }
        .wm-range-control input { flex: 1; min-width: 0; }
      }
    `;

    const inject = ["theme", "slots"];

    function apply(ctx) {
      let settings = readSettings();
      const query = new URLSearchParams(window.location.search);
      const qaEnabled = query.has("wm-status-qa");
      const qaTheme = query.get("wm-theme-qa");
      if (qaEnabled && ALLOWED_SETTINGS.theme.includes(qaTheme)) {
        settings = normalizeSettings({ ...settings, theme: qaTheme });
      }
      const themeSignal = createBooleanSignal(false);
      // The Host injects nothing here; this only lets the isolated QA page shorten the
      // bounded waits so the same production code paths are checked without waiting them out.
      const wallpaperTimeouts = window.__WM_WALLPAPER_TIMEOUTS__ ?? {};
      const wallpaper = createWallpaperEngine({
        firstFrameTimeoutMs: wallpaperTimeouts.firstFrameTimeoutMs,
        idleTimeoutMs: wallpaperTimeouts.idleTimeoutMs,
        retryDelayMs: wallpaperTimeouts.retryDelayMs,
        hostStatusTimeoutMs: wallpaperTimeouts.hostStatusTimeoutMs,
      });
      const backdrop = createBackdrop(wallpaper);
      let disposed = false;
      let selectionRevision = 0;
      // Bumped by every explicit playback action and by leaving the source. The automatic
      // start checks it before and after its host query, so a late answer from an older
      // intent can never start a run the user stopped or never asked for.
      let userActionRevision = 0;
      /**
       * Bumped by every playback-mode change. The automatic start captures it when the session
       * begins, so a trip to preview and back cancels the pending request instead of letting a
       * late host answer through: checking only the final mode value would miss that.
       */
      let playbackModeRevision = 0;
      /** How many bounded host-readiness checks auto playback may make before giving up. */
      const AUTO_START_MAX_ATTEMPTS = 5;
      /** Total window for the automatic readiness checks, so a dead host cannot stall it. */
      const AUTO_START_WINDOW_MS = 12000;
      /** Read limit for one readiness check, used to shrink it when the window is nearly over. */
      const HOST_STATUS_READ_MS = Number.isFinite(wallpaperTimeouts.hostStatusTimeoutMs) && wallpaperTimeouts.hostStatusTimeoutMs > 0
        ? wallpaperTimeouts.hostStatusTimeoutMs
        : 4000;
      const controller = {
        media: backdrop,
        wallpaper: {
          // The settings UI talks to the public controller only. Every explicit action marks
          // the user's intent, which is what cancels a pending automatic start.
          ...wallpaper,
          start: (scene = "lucy", mode = DEFAULT_PLAYBACK_MODE) => {
            userActionRevision++;
            return wallpaper.start(scene, mode);
          },
          restart: (scene = "lucy", mode = DEFAULT_PLAYBACK_MODE) => {
            userActionRevision++;
            return wallpaper.restart(scene, mode);
          },
          stop: (reason = "user") => {
            userActionRevision++;
            return wallpaper.stop(reason);
          },
        },
        read: () => ({ ...settings }),
        set: (key, value) => {
          if (disposed || !isValidSetting(key, value)) return { ...settings };
          if (key === "background") selectionRevision++;
          settings = normalizeSettings({ ...settings, [key]: value });
          persistSettings(settings);
          projectSettings(settings);
          if (key === "theme") ctx.theme.setTheme(selectedThemeId(settings));
          backdrop.update(settings, themeSignal.getSnapshot());
          // A mode change cancels any automatic start that is still waiting for the host; it
          // does not restart the run that is already active (that keeps its own mode).
          if (key === "weMode") playbackModeRevision++;
          // Leaving the Wallpaper Engine source stops this round's window before any
          // other background is presented; switching back never auto-restarts it.
          if (key === "background") {
            userActionRevision++;
            if (value !== "wallpaper") wallpaper.stop("background-changed").catch(() => {});
          }
          return { ...settings };
        },
        reset: () => {
          if (disposed) return { ...settings };
          selectionRevision++;
          userActionRevision++;
          wallpaper.stop("reset").catch(() => {});
          settings = { ...DEFAULT_SETTINGS };
          persistSettings(settings);
          projectSettings(settings);
          ctx.theme.setTheme(selectedThemeId(settings));
          backdrop.update(settings, themeSignal.getSnapshot());
          return { ...settings };
        },
        async importMedia(kind, file) {
          const revision = selectionRevision;
          const saved = await backdrop.store(kind, file);
          if (saved && !disposed && revision === selectionRevision) return controller.set("background", kind);
          return { ...settings };
        }
      };
      const syncActiveMarker = (snapshot) => {
        const mistActive = snapshot.active.id === THEME_ID;
        const abyssActive = snapshot.active.id === ABYSS_THEME_ID;
        document.body.classList.toggle(ACTIVE_CLASS, mistActive);
        document.body.classList.toggle(ABYSS_ACTIVE_CLASS, abyssActive);
        themeSignal.set(MANAGED_THEME_IDS.has(snapshot.active.id));
        backdrop.update(settings, themeSignal.getSnapshot());
      };

      ctx.effect(() => () => { disposed = true; selectionRevision++; }, "whale: controller lifetime");

      // Auto playback: the persisted choice is only a statement about the NEXT DSH start.
      // This effect fires at most once per page lifetime, only when the source and the theme
      // still apply and the host says the scene is available. A manual stop stays stopped:
      // nothing here re-runs on a settings change, a theme re-sync or a re-mounted component.
      ctx.effect(() => {
        // The choice is frozen here, at the start of this DSH session: toggling the checkbox
        // later only saves the NEXT launch and must never start playback in this one.
        const autoStartWanted = settings.weAutoStart === true && settings.weMode === "daily";
        let cancelled = false;
        let starting = false;
        let started = false;
        // Any explicit user action invalidates the automatic request that is still waiting,
        // so a late host answer can never restart what the user just stopped. Leaving the daily
        // mode also counts as intent: a trip to preview and back must cancel the old request,
        // because checking only the final mode would let it through again.
        const actionsAtStart = userActionRevision;
        const modeAtStart = playbackModeRevision;
        let retry = 0;
        const timers = new Set();
        const deadline = Date.now() + AUTO_START_WINDOW_MS;
        const eligible = () => !cancelled && !disposed && !started && autoStartWanted
          && userActionRevision === actionsAtStart && playbackModeRevision === modeAtStart
          && settings.background === "wallpaper" && settings.weMode === "daily"
          && themeSignal.getSnapshot();
        /** The declared window is the whole budget: nothing may start after it has passed. */
        const windowOpen = () => Date.now() < deadline;
        const remainingMs = () => Math.max(0, deadline - Date.now());
        const clearTimers = () => {
          for (const timer of timers) clearTimeout(timer);
          timers.clear();
        };
        const schedule = (delay) => {
          const timer = setTimeout(() => { timers.delete(timer); attempt().catch(() => {}); }, delay);
          timers.add(timer);
        };
        // A host that answers "not ready" gets another bounded try inside the total window, so
        // a late-ready host still starts exactly one run and a dead one gives up cleanly. The
        // backoff keeps its usual interval but never reaches past the window.
        const scheduleRetry = () => {
          if (!eligible() || retry >= AUTO_START_MAX_ATTEMPTS || !windowOpen()) return;
          retry += 1;
          schedule(Math.min(1500, remainingMs()));
        };
        const attempt = async () => {
          // The deadline also bounds the attempt itself: a timer that fired just before the
          // window closed must not begin a new query.
          if (!eligible() || starting || !windowOpen()) return;
          starting = true;
          try {
            // A readiness query is bounded twice over: by the read limit and by what is left of
            // the total window, so a query started inside the window cannot answer after it.
            const host = await wallpaper.loadHostStatus({ timeoutMs: Math.min(HOST_STATUS_READ_MS, remainingMs()) });
            if (!eligible()) return;
            // A reply that arrives after the window (the read was cut at the deadline) is too
            // late to start anything, and there is nothing left to retry.
            if (!windowOpen()) { clearTimers(); return; }
            if (!host || host.available !== true) { scheduleRetry(); return; }
            started = true;
            await wallpaper.start(settings.weScene, settings.weMode);
          } finally { starting = false; }
        };
        const run = () => {
          if (!eligible() || starting || timers.size > 0) return;
          if (retry >= AUTO_START_MAX_ATTEMPTS || !windowOpen()) return;
          retry += 1;
          schedule(retry === 1 ? 300 : 1500);
        };
        // The theme becomes active slightly after boot, so wait for its signal instead of
        // polling; the retries cover a host that answers "not ready" for a little while.
        const unsubscribeTheme = themeSignal.subscribe(run);
        run();
        return () => {
          cancelled = true;
          unsubscribeTheme();
          clearTimers();
        };
      }, "whale: wallpaper auto playback");

      ctx.effect(() => {
        const disposeMist = ctx.theme.register(theme);
        const disposeAbyss = ctx.theme.register(abyssTheme);
        ctx.theme.setTheme(selectedThemeId(settings));
        return () => {
          disposeAbyss();
          disposeMist();
        };
      }, "whale: theme registration");

      ctx.effect(() => {
        // Current Harness releases may re-apply their persisted preference when
        // model settings change. Retain the selected Whale theme for the whole
        // plugin lifetime instead of only during the first paint.
        let queued = false;
        const off = ctx.on("theme/change", (snapshot) => {
          const desiredThemeId = selectedThemeId(settings);
          if (snapshot.active.id === desiredThemeId || queued) return;
          queued = true;
          queueMicrotask(() => {
            queued = false;
            if (disposed) return;
            let current = ctx.theme.getTheme();
            const currentDesiredThemeId = selectedThemeId(settings);
            if (current.active.id !== currentDesiredThemeId) {
              ctx.theme.setTheme(currentDesiredThemeId);
              current = ctx.theme.getTheme();
            }
            syncActiveMarker(current);
          });
        });
        const receiveThemeReset = (event) => {
          if (qaEnabled) ctx.theme.setTheme(event.detail || "dark");
        };
        window.addEventListener("dsh-whale-mist:qa-theme-reset", receiveThemeReset);
        return () => {
          window.removeEventListener("dsh-whale-mist:qa-theme-reset", receiveThemeReset);
          off();
        };
      }, "whale: active theme retention");

      ctx.effect(() => {
        const previous = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`);
        previous?.remove();
        const tag = document.createElement("style");
        tag.dataset.plugin = "dsh-whale-mist";
        tag.dataset.pluginCss = STYLE_ID;
        tag.textContent = css + Object.entries(PALETTES).map(([id, palette]) => paletteCss(id, palette)).join("\n") + backdropCss;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, "whale-mist: glass material stylesheet");

      ctx.effect(() => {
        syncActiveMarker(ctx.theme.getTheme());
        const off = ctx.on("theme/change", syncActiveMarker);
        return () => {
          off();
          document.body.classList.remove(ACTIVE_CLASS);
          document.body.classList.remove(ABYSS_ACTIVE_CLASS);
          themeSignal.set(false);
        };
      }, "whale: active theme marker");

      ctx.effect(() => {
        projectSettings(settings);
        return clearProjection;
      }, "whale-mist: appearance projection");

      ctx.effect(() => {
        backdrop.start(settings, themeSignal.getSnapshot());
        return () => backdrop.stop();
      }, "whale: local image and video background");

      ctx.effect(() => {
        // Ask the Host once whether the preview can run at all, so the settings row can
        // explain a missing helper or a missing sample instead of failing on first click.
        wallpaper.loadHostStatus().catch(() => {});
        return () => wallpaper.dispose();
      }, "whale: wallpaper engine preview lifetime");

      ctx.slots.inject("settings.general.item", () => ctx.slots.register({
        name: "settings.general.item",
        id: "whale-mist",
        order: 45,
        inject: () => ({ controller })
      }, WhaleAppearanceSettings));

      ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
        name: "conversation.session.header.actions",
        id: "whale-session-status",
        order: -5,
        inject: () => ({ statusController: { theme: themeSignal, qaEnabled } })
      }, WhaleSessionStatus));
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
