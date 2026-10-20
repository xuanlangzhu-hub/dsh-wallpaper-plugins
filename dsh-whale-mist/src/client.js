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
      accentMode: "theme",
      accentColor: "#8c72f2",
      canvas: "soft",
      sidebar: "balanced",
      glass: "standard",
      textContrast: "standard",
      background: "none",
      motion: "focus",
      weScene: "lucy",
      weMode: "preview",
      weAutoStart: false,
      weAgeRatings: "Everyone",
      // Per-region backgrounds: which areas may cover the wallpaper with their own colour. Both
      // default to off, so the visual result stays exactly what the previous release shipped.
      opaqueSidebar: false,
      opaqueChat: false,
      chatBackdrop: 0,
      brightness: 70,
      mask: 45,
      blur: 0,
      surface: 82
    });
    const ALLOWED_SETTINGS = Object.freeze({
      theme: Object.freeze(["mist", "abyss"]),
      palette: Object.freeze(["ocean", "graphite", "violet", "jade"]),
      accentMode: Object.freeze(["theme", "custom"]),
      canvas: Object.freeze(["soft", "clear"]),
      sidebar: Object.freeze(["balanced", "deep"]),
      glass: Object.freeze(["standard", "restrained"]),
      textContrast: Object.freeze(["standard", "enhanced"]),
      background: Object.freeze(["none", "image", "video", "wallpaper"]),
      motion: Object.freeze(["focus", "always"]),
      /** `daily` is the daily-driver mode; `preview` is the supervised time-boxed one. */
      weMode: Object.freeze(["daily", "preview"])
    });
    /**
     * Strict 6-digit hex color format.
     */
    const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
    /**
     * Scene ids come from the Host whitelist; a stale stored value falls back to Lucy.
     *
     * This list is only the set of ids with a supervised acceptance behind them, so it decides what
     * may be called "verified". Every other id the Host can resolve is an experimental selection and
     * never part of it.
     */
    const VERIFIED_SCENE_IDS = Object.freeze(["lucy"]);
    /**
     * The shape of a catalogue id, mirrored from the Host rules so a stored selection survives a
     * reload before the list has loaded. This is only a syntax check: whether the item still exists
     * and is playable is decided by the Host, which is the only side allowed to look at files.
     */
    const CATALOG_ID_PATTERN = /^we-[0-9a-f]{24}$/;
    const isSceneId = (value) => value === "lucy" || (typeof value === "string" && CATALOG_ID_PATTERN.test(value));
    /**
     * The migration default, matching the Host (`DEFAULT_PLAYBACK_MODE = 'preview'`): an older
     * stored setting that predates the mode field stays a time-boxed preview until the user
     * explicitly picks the daily mode.
     */
    const DEFAULT_PLAYBACK_MODE = "preview";
    const RANGE_SETTINGS = Object.freeze({
      brightness: Object.freeze([20, 120]),
      mask: Object.freeze([0, 90]),
      blur: Object.freeze([0, 24]),
      surface: Object.freeze([40, 100]),
      chatBackdrop: Object.freeze([0, 100])
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
      if (key === "weScene") return isSceneId(value);
      if (key === "accentColor") return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
      if (key === "weAgeRatings") {
        if (typeof value !== "string") return false;
        if (value.trim() === "") return true;
        const parts = value.split(",").map(s => s.trim()).filter(Boolean);
        return parts.length > 0 && parts.every(p => ["Everyone", "Questionable", "Mature"].includes(p));
      }
      if (Object.hasOwn(ALLOWED_SETTINGS, key)) return ALLOWED_SETTINGS[key].includes(value);
      if (BOOLEAN_SETTINGS.includes(key)) return typeof value === "boolean";
      return Object.hasOwn(RANGE_SETTINGS, key) && typeof value === "number" && Number.isFinite(value);
    }

    function normalizeSettings(value) {
      const source = value && typeof value === "object" ? value : {};
      let chatBackdrop;
      if (typeof source.chatBackdrop === "number" && Number.isFinite(source.chatBackdrop)) {
        chatBackdrop = clampRange("chatBackdrop", source.chatBackdrop);
      } else {
        chatBackdrop = source.opaqueChat === true ? 100 : 0;
      }
      const opaqueChat = chatBackdrop === 100;

      let accentColor = DEFAULT_SETTINGS.accentColor;
      let hasValidColor = false;
      if (typeof source.accentColor === "string" && HEX_COLOR_PATTERN.test(source.accentColor)) {
        accentColor = source.accentColor.toLowerCase();
        hasValidColor = true;
      }

      let accentMode = DEFAULT_SETTINGS.accentMode;
      if (source.accentMode === "custom") {
        // Fall back to theme mode if custom is claimed without a valid color
        accentMode = hasValidColor ? "custom" : "theme";
      } else if (source.accentMode === "theme") {
        accentMode = "theme";
      }

      let weAgeRatings = DEFAULT_SETTINGS.weAgeRatings;
      if (typeof source.weAgeRatings === "string") {
        const trimmed = source.weAgeRatings.trim();
        if (trimmed === "") {
          weAgeRatings = "";
        } else {
          const parts = trimmed.split(",").map(s => s.trim()).filter(Boolean);
          const allValid = parts.length > 0 && parts.every(p => ["Everyone", "Questionable", "Mature"].includes(p));
          if (allValid) {
            const unique = [...new Set(parts)].sort((a, b) => ["Everyone", "Questionable", "Mature"].indexOf(a) - ["Everyone", "Questionable", "Mature"].indexOf(b));
            weAgeRatings = unique.join(",");
          } else {
            weAgeRatings = DEFAULT_SETTINGS.weAgeRatings;
          }
        }
      }

      return {
        ...Object.fromEntries(Object.entries(ALLOWED_SETTINGS).filter(([k]) => k !== "accentMode").map(([key, allowed]) => [
          key,
          allowed.includes(source[key]) ? source[key] : DEFAULT_SETTINGS[key]
        ])),
        ...Object.fromEntries(Object.keys(RANGE_SETTINGS).filter((k) => k !== "chatBackdrop").map((key) => [key, clampRange(key, source[key])])),
        accentMode,
        accentColor,
        chatBackdrop,
        weAgeRatings,
        // A well-formed catalogue id is kept even before the list has loaded: normalizing it away
        // would silently replace the user's wallpaper with the sample. The Host still refuses an id
        // it cannot re-verify, so this keeps the choice without granting it.
        weScene: isSceneId(source.weScene) ? source.weScene : DEFAULT_SETTINGS.weScene,
        // Opt-in flags: only an explicit boolean true turns one on.
        ...Object.fromEntries(BOOLEAN_SETTINGS.filter((k) => k !== "opaqueChat").map((key) => [key, source[key] === true])),
        opaqueChat
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

    const PRESETS_STORAGE_KEY = "dsh-whale-mist.wallpaper-appearance-presets.v1";
    const PRESET_PROPERTIES = Object.freeze(["brightness", "mask", "blur", "surface"]);

    function sanitizePresetEntry(raw) {
      if (!raw || typeof raw !== "object") return null;
      const entry = {};
      for (const key of PRESET_PROPERTIES) {
        if (typeof raw[key] !== "number" || !Number.isFinite(raw[key])) return null;
        entry[key] = clampRange(key, raw[key]);
      }
      return Object.freeze(entry);
    }

    function normalizePresets(raw) {
      if (!raw || typeof raw !== "object" || raw.version !== 1 || !raw.entries || typeof raw.entries !== "object") {
        return Object.freeze({ version: 1, entries: Object.freeze({}) });
      }
      const entries = {};
      for (const [key, value] of Object.entries(raw.entries)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        if (!isSceneId(key)) continue;
        const sanitized = sanitizePresetEntry(value);
        if (sanitized) entries[key] = sanitized;
      }
      return Object.freeze({ version: 1, entries: Object.freeze(entries) });
    }

    function readPresets() {
      try {
        const raw = JSON.parse(localStorage.getItem(PRESETS_STORAGE_KEY) ?? "null");
        return normalizePresets(raw);
      } catch {
        return Object.freeze({ version: 1, entries: Object.freeze({}) });
      }
    }

    function persistPresets(presets) {
      try {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
        return true;
      } catch {
        return false;
      }
    }

    const PROJECTED_VARIABLES = Object.freeze({
      brightness: ["--wm-bg-brightness", (value) => String(value / 100)],
      mask: ["--wm-bg-mask", (value) => String(value / 100)],
      blur: ["--wm-bg-blur", (value) => `${value}px`],
      surface: ["--wm-ui-alpha", (value) => String(value / 100)],
      chatBackdrop: ["--wm-chat-alpha", (value) => String(value / 100)]
    });
    /** Region switches are projected as body attributes, one per region. */
    const PROJECTED_FLAGS = Object.freeze({
      opaqueSidebar: "wmOpaqueSidebar"
    });

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

    const CUSTOM_ACCENT_VARIABLES = Object.freeze([
      "--wm-custom-raw",
      "--wm-custom-btn-hover",
      "--wm-custom-btn-fg",
      "--wm-custom-ink",
      "--wm-custom-business-tertiary",
      "--wm-custom-btn-info-fill",
      "--wm-custom-btn-info-hover",
      "--wm-custom-ghost-active-fill",
      "--wm-custom-interactive-primary",
      "--wm-custom-interactive-hover",
      "--wm-custom-interactive-active",
      "--wm-custom-sidebar-nav-active"
    ]);

    function hexToRgb(hex) {
      const num = parseInt(hex.slice(1), 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    function rgbToHex(rgbArray) {
      return "#" + rgbArray.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
    }
    function srgbToLinear(val255) {
      const v = val255 / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    function relativeLuminance(rgbArray) {
      return 0.2126 * srgbToLinear(rgbArray[0]) + 0.7152 * srgbToLinear(rgbArray[1]) + 0.0722 * srgbToLinear(rgbArray[2]);
    }
    function contrastRatio(rgb1, rgb2) {
      const l1 = relativeLuminance(rgb1);
      const l2 = relativeLuminance(rgb2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    function deriveButtonForeground(rawRgb) {
      const ratioBlack = contrastRatio(rawRgb, [0, 0, 0]);
      const ratioWhite = contrastRatio(rawRgb, [255, 255, 255]);
      return ratioBlack >= ratioWhite ? "#000000" : "#ffffff";
    }

    function deriveButtonHover(rawRgb, fgHex) {
      const fgRgb = fgHex === "#000000" ? [0, 0, 0] : [255, 255, 255];
      const oppRgb = fgHex === "#000000" ? [255, 255, 255] : [0, 0, 0];
      const h1 = rawRgb.map((c, i) => Math.round(c * 0.88 + fgRgb[i] * 0.12));
      if (contrastRatio(h1, fgRgb) >= 4.5) {
        return rgbToHex(h1);
      }
      const h2 = rawRgb.map((c, i) => Math.round(c * 0.88 + oppRgb[i] * 0.12));
      return rgbToHex(h2);
    }

    function getReferenceSurfaces(theme, palette) {
      if (theme === "mist") {
        return [
          [239, 247, 254],
          [255, 255, 255],
          [230, 242, 251],
          [252, 254, 255],
          [228, 240, 249],
          [207, 229, 246]
        ];
      }
      const p = PALETTES[palette];
      if (p) {
        return [
          p.base,
          p.l1,
          p.l2,
          p.l3,
          p.sidebar,
          p.sidebarDeep
        ];
      }
      return [
        [8, 11, 20],
        [15, 23, 38],
        [23, 34, 54],
        [28, 40, 62],
        [15, 23, 38],
        [10, 16, 28]
      ];
    }

    function deriveInkColor(rawRgb, theme, palette) {
      const surfaces = getReferenceSurfaces(theme, palette);
      const satisfies = (rgbArray) => {
        for (let i = 0; i < surfaces.length; i++) {
          if (contrastRatio(rgbArray, surfaces[i]) < 4.5) return false;
        }
        return true;
      };
      if (satisfies(rawRgb)) {
        return rgbToHex(rawRgb);
      }
      const target = theme === "mist" ? [0, 0, 0] : [255, 255, 255];
      for (let k = 1; k <= 255; k++) {
        const factor = k / 255;
        const cand = [
          Math.round(rawRgb[0] * (1 - factor) + target[0] * factor),
          Math.round(rawRgb[1] * (1 - factor) + target[1] * factor),
          Math.round(rawRgb[2] * (1 - factor) + target[2] * factor)
        ];
        if (satisfies(cand)) {
          return rgbToHex(cand);
        }
      }
      return rgbToHex(target);
    }

    function deriveAccentValues(accentColor, theme, palette) {
      const rawRgb = hexToRgb(accentColor);
      const raw = accentColor.toLowerCase();
      const btnFg = deriveButtonForeground(rawRgb);
      const btnHover = deriveButtonHover(rawRgb, btnFg);
      const ink = deriveInkColor(rawRgb, theme, palette);
      return {
        raw,
        btnHover,
        btnFg,
        ink,
        businessTertiary: `rgba(${rawRgb.join(", ")}, 0.2)`,
        btnInfoFill: `rgba(${rawRgb.join(", ")}, 0.18)`,
        btnInfoHover: `rgba(${rawRgb.join(", ")}, 0.26)`,
        ghostActiveFill: `rgba(${rawRgb.join(", ")}, 0.2)`,
        interactivePrimary: `rgba(${rawRgb.join(", ")}, 0.16)`,
        interactiveHover: `rgba(${rawRgb.join(", ")}, 0.12)`,
        interactiveActive: `rgba(${rawRgb.join(", ")}, 0.2)`,
        sidebarNavActive: `rgba(${rawRgb.join(", ")}, 0.16)`
      };
    }

    function projectSettings(settings) {
      const body = document.body;
      body.dataset.wmTheme = settings.theme;
      body.dataset.wmPalette = settings.palette;
      body.dataset.wmCanvas = settings.canvas;
      body.dataset.wmSidebar = settings.sidebar;
      body.dataset.wmGlass = settings.glass;
      body.dataset.wmTextContrast = settings.textContrast;
      body.dataset.wmAccentMode = settings.accentMode;
      for (const [key, name] of Object.entries(PROJECTED_FLAGS)) {
        if (settings[key]) body.dataset[name] = "true";
        else delete body.dataset[name];
      }
      if (settings.chatBackdrop === 100) {
        body.dataset.wmOpaqueChat = "true";
        delete body.dataset.wmChatTint;
      } else if (settings.chatBackdrop > 0) {
        delete body.dataset.wmOpaqueChat;
        body.dataset.wmChatTint = "true";
      } else {
        delete body.dataset.wmOpaqueChat;
        delete body.dataset.wmChatTint;
      }
      for (const [key, [name, format]] of Object.entries(PROJECTED_VARIABLES)) {
        body.style.setProperty(name, format(settings[key]));
      }
      if (settings.accentMode === "custom") {
        const derived = deriveAccentValues(settings.accentColor, settings.theme, settings.palette);
        body.style.setProperty("--wm-custom-raw", derived.raw);
        body.style.setProperty("--wm-custom-btn-hover", derived.btnHover);
        body.style.setProperty("--wm-custom-btn-fg", derived.btnFg);
        body.style.setProperty("--wm-custom-ink", derived.ink);
        body.style.setProperty("--wm-custom-business-tertiary", derived.businessTertiary);
        body.style.setProperty("--wm-custom-btn-info-fill", derived.btnInfoFill);
        body.style.setProperty("--wm-custom-btn-info-hover", derived.btnInfoHover);
        body.style.setProperty("--wm-custom-ghost-active-fill", derived.ghostActiveFill);
        body.style.setProperty("--wm-custom-interactive-primary", derived.interactivePrimary);
        body.style.setProperty("--wm-custom-interactive-hover", derived.interactiveHover);
        body.style.setProperty("--wm-custom-interactive-active", derived.interactiveActive);
        body.style.setProperty("--wm-custom-sidebar-nav-active", derived.sidebarNavActive);
      } else {
        for (const prop of CUSTOM_ACCENT_VARIABLES) {
          body.style.removeProperty(prop);
        }
      }
    }

    function clearProjection() {
      const body = document.body;
      for (const key of ["wmTheme", "wmPalette", "wmCanvas", "wmSidebar", "wmGlass", "wmTextContrast", "wmAccentMode", "wmOpaqueChat", "wmChatTint"]) delete body.dataset[key];
      for (const name of Object.values(PROJECTED_FLAGS)) delete body.dataset[name];
      for (const [name] of Object.values(PROJECTED_VARIABLES)) body.style.removeProperty(name);
      for (const prop of CUSTOM_ACCENT_VARIABLES) body.style.removeProperty(prop);
    }

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
    function createWallpaperEngine({ fetchImpl = (...args) => fetch(...args), now = () => Date.now(), monotonicNow, firstFrameTimeoutMs, idleTimeoutMs, retryDelayMs, hostStatusTimeoutMs } = {}) {
      const monoNow = typeof monotonicNow === "function"
        ? monotonicNow
        : (typeof performance !== "undefined" && typeof performance.now === "function" ? () => performance.now() : now);
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
      const libraryListeners = new Set();
      let hideStalledFrames = false;
      let running = false;
      let busy = false;
      let disposed = false;
      let abort = null;
      let pollTimer = null;
      let status = Object.freeze({ state: "idle", error: "", host: null, generation: 0, cleanupPending: false });
      let stopRevision = 0;
      let activeStopId = 0;
      let activeStopGeneration = 0;
      let librarySnapshot = null;
      let libraryRevision = 0;
      let libraryRefreshing = false;
      let startedAt = 0;
      let lastFrameAt = 0;

      function createRunContext(gen) {
        return {
          generation: gen,
          metrics: { received: 0, rendered: 0, dropped: 0, sourceSequence: 0, decodeErrors: 0 },
          startedAt: 0,
          lastFrameAt: 0,
          hideStalledFrames: false,
          latencySum: 0,
          latencyMax: 0,
          waitRafCount: 0,
          waitRafSumMs: 0,
          waitRafMaxMs: 0,
          waitTimeoutCount: 0,
          waitTimeoutSumMs: 0,
          waitTimeoutMaxMs: 0,
          waitCancelledCount: 0,
          decodeSuccessCount: 0,
          decodeSuccessSumMs: 0,
          decodeSuccessMaxMs: 0,
          decodeFailCount: 0,
          decodeFailSumMs: 0,
          decodeFailMaxMs: 0,
          discardHiddenCount: 0,
          discardStaleCount: 0,
          syncCount: 0,
          syncSumMs: 0,
          syncMaxMs: 0,
          syncErrorCount: 0,
          drawCount: 0,
          drawSumMs: 0,
          drawMaxMs: 0,
          drawErrorCount: 0,
          dropDecodingCount: 0,
          dropSyncCount: 0,
          dropWaitingCallbackCount: 0,
          dropOtherCount: 0,
          painting: false,
          paintPhase: "idle",
          currentSchedule: null,
          latest: null,
          cadenceTraceEnabled: false,
          cadenceTraceRecords: null,
          cadenceTraceRunId: '',
          cadenceTraceConnectionId: '',
          cadenceTraceInFlight: false,
          cadenceTraceDroppedCount: 0,
          cadenceTraceOverflowCount: 0,
          cadenceTraceTrailingUnsentCount: 0,
          cadenceTraceStopPending: false,
        };
      }

      let activeRun = createRunContext(0);

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

      const snapshot = () => {
        const r = activeRun;
        return Object.freeze({
          received: r.metrics.received,
          rendered: r.metrics.rendered,
          dropped: r.metrics.dropped,
          sourceSequence: r.metrics.sourceSequence,
          decodeErrors: r.metrics.decodeErrors,
          seconds: r.startedAt ? Math.max(0, (now() - r.startedAt) / 1000) : 0,
          meanLatencyMs: r.metrics.rendered ? r.latencySum / r.metrics.rendered : 0,
          maxLatencyMs: r.latencyMax,
          hidden: Number(document.hidden),
          waitRafCount: r.waitRafCount,
          waitRafSumMs: Number(r.waitRafSumMs.toFixed(3)),
          waitRafMaxMs: Number(r.waitRafMaxMs.toFixed(3)),
          waitTimeoutCount: r.waitTimeoutCount,
          waitTimeoutSumMs: Number(r.waitTimeoutSumMs.toFixed(3)),
          waitTimeoutMaxMs: Number(r.waitTimeoutMaxMs.toFixed(3)),
          waitCancelledCount: r.waitCancelledCount,
          decodeSuccessCount: r.decodeSuccessCount,
          decodeSuccessSumMs: Number(r.decodeSuccessSumMs.toFixed(3)),
          decodeSuccessMaxMs: Number(r.decodeSuccessMaxMs.toFixed(3)),
          decodeFailCount: r.decodeFailCount,
          decodeFailSumMs: Number(r.decodeFailSumMs.toFixed(3)),
          decodeFailMaxMs: Number(r.decodeFailMaxMs.toFixed(3)),
          discardHiddenCount: r.discardHiddenCount,
          discardStaleCount: r.discardStaleCount,
          syncCount: r.syncCount,
          syncSumMs: Number(r.syncSumMs.toFixed(3)),
          syncMaxMs: Number(r.syncMaxMs.toFixed(3)),
          syncErrorCount: r.syncErrorCount,
          drawCount: r.drawCount,
          drawSumMs: Number(r.drawSumMs.toFixed(3)),
          drawMaxMs: Number(r.drawMaxMs.toFixed(3)),
          drawErrorCount: r.drawErrorCount,
          dropDecodingCount: r.dropDecodingCount,
          dropSyncCount: r.dropSyncCount,
          dropWaitingCallbackCount: r.dropWaitingCallbackCount,
          dropOtherCount: r.dropOtherCount,
        });
      };

      const CADENCE_CLIENT_CAPACITY = 8192;
      const CADENCE_CLIENT_BATCH_LIMIT = 150;
      const MAX_STOP_FLUSH_ATTEMPTS = 4;
      let cadenceBatchCounter = 0;

      const flushCadenceTrace = (targetRun = activeRun, options = {}) => {
        const r = targetRun;
        if (!r || !r.cadenceTraceEnabled) return;
        if (r.cadenceTraceStopTerminated) return;

        const hasRecords = Boolean(r.cadenceTraceRecords && r.cadenceTraceRecords.length > 0);
        if (!hasRecords && !options.isStop) return;
        if (!hasRecords && (r.cadenceTraceStopConfirmed || r.cadenceTraceStopTerminated)) return;

        if (r.cadenceTraceInFlight) {
          if (options.isStop) r.cadenceTraceStopPending = true;
          return;
        }

        const isStop = Boolean(options.isStop || r.stopped);

        if (isStop) {
          r.cadenceTraceStopAttempts = (r.cadenceTraceStopAttempts || 0) + 1;
          if (r.cadenceTraceStopAttempts > MAX_STOP_FLUSH_ATTEMPTS) {
            r.cadenceTraceStopTerminated = true;
            r.cadenceTraceStopPending = false;
            r.cadenceTraceTrailingUnsentCount = (r.cadenceTraceTrailingUnsentCount || 0) + (r.cadenceTraceRecords?.length || 0);
            r.cadenceTraceRecords = [];
            return;
          }
        }

        const batch = r.cadenceTraceRecords ? r.cadenceTraceRecords.slice(0, CADENCE_CLIENT_BATCH_LIMIT) : [];
        if (batch.length === 0 && !isStop) return;

        const batchId = ++cadenceBatchCounter;
        for (const item of batch) {
          item._batchId = batchId;
        }
        r.cadenceTraceInFlight = true;

        const payload = {
          runId: r.cadenceTraceRunId || `gen-${r.generation}`,
          connectionId: r.cadenceTraceConnectionId || '',
          generation: r.generation,
          clockDomain: "client-mono",
          overflowCount: r.cadenceTraceOverflowCount || 0,
          droppedCount: r.cadenceTraceDroppedCount || 0,
          trailingUnsentCount: r.cadenceTraceRecords ? Math.max(0, r.cadenceTraceRecords.length - batch.length) : (r.cadenceTraceTrailingUnsentCount || 0),
          isStop,
          records: batch.map(({ _batchId, ...clean }) => clean),
        };

        const setTimer = typeof window !== 'undefined' && typeof window.setTimeout === 'function' ? window.setTimeout : setTimeout;
        const clearTimer = typeof window !== 'undefined' && typeof window.clearTimeout === 'function' ? window.clearTimeout : clearTimeout;
        const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        r.cadenceTraceAbortController = abortController;
        let timeoutId = null;
        if (abortController) {
          timeoutId = setTimer(() => {
            try { abortController.abort(new Error('trace-timeout')); } catch {}
          }, isStop ? 150 : 200);
        }

        fetchImpl("/whale-wallpaper/cadence-trace", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
          ...(abortController ? { signal: abortController.signal } : {}),
        }).then(res => {
          if (res?.ok || res?.status === 204) {
            // Remove ONLY the records that belong to this acknowledged batch
            if (r.cadenceTraceRecords) {
              r.cadenceTraceRecords = r.cadenceTraceRecords.filter(item => item._batchId !== batchId);
            }
            if (payload.isStop === true && (!r.cadenceTraceRecords || r.cadenceTraceRecords.length === 0)) {
              r.cadenceTraceStopConfirmed = true;
            }
          } else if (res?.status === 400) {
            // Schema violation: permanently drop records from this batch
            if (r.cadenceTraceRecords) {
              const prevLen = r.cadenceTraceRecords.length;
              r.cadenceTraceRecords = r.cadenceTraceRecords.filter(item => item._batchId !== batchId);
              const removed = prevLen - r.cadenceTraceRecords.length;
              r.cadenceTraceDroppedCount = (r.cadenceTraceDroppedCount || 0) + Math.max(batch.length, removed);
            } else {
              r.cadenceTraceDroppedCount = (r.cadenceTraceDroppedCount || 0) + batch.length;
            }
          } else if (res?.status === 409) {
            // Terminal conflict: Host session is closed, stop immediately
            r.cadenceTraceStopTerminated = true;
            r.cadenceTraceStopPending = false;
            if (r.cadenceTraceRecords) {
              r.cadenceTraceTrailingUnsentCount = (r.cadenceTraceTrailingUnsentCount || 0) + r.cadenceTraceRecords.length;
              r.cadenceTraceRecords = [];
            }
          } else {
            // Other status / error: if stopping, terminate to avoid infinite retry
            if (isStop || r.stopped) {
              r.cadenceTraceStopTerminated = true;
              r.cadenceTraceStopPending = false;
              if (r.cadenceTraceRecords) {
                r.cadenceTraceTrailingUnsentCount = (r.cadenceTraceTrailingUnsentCount || 0) + r.cadenceTraceRecords.length;
                r.cadenceTraceRecords = [];
              }
            } else if (r.cadenceTraceRecords) {
              for (const item of r.cadenceTraceRecords) {
                if (item._batchId === batchId) delete item._batchId;
              }
            }
          }
        }).catch(() => {
          // Network failure or timeout: if stopping, terminate stop retries immediately
          if (isStop || r.stopped) {
            r.cadenceTraceStopTerminated = true;
            r.cadenceTraceStopPending = false;
            if (r.cadenceTraceRecords) {
              r.cadenceTraceTrailingUnsentCount = (r.cadenceTraceTrailingUnsentCount || 0) + r.cadenceTraceRecords.length;
              r.cadenceTraceRecords = [];
            }
          } else if (r.cadenceTraceRecords) {
            for (const item of r.cadenceTraceRecords) {
              if (item._batchId === batchId) delete item._batchId;
            }
          }
        }).finally(() => {
          if (timeoutId) clearTimer(timeoutId);
          if (r.cadenceTraceAbortController === abortController) {
            r.cadenceTraceAbortController = null;
          }
          r.cadenceTraceInFlight = false;
          // Check ONLY r (never activeRun)
          if (!r.cadenceTraceStopTerminated) {
            if (r.cadenceTraceStopPending || (r.stopped && !r.cadenceTraceStopConfirmed)) {
              r.cadenceTraceStopPending = false;
              flushCadenceTrace(r, { isStop: true });
            }
          }
        });
      };

      const recordCadence = (run, event, fields = {}) => {
        if (!run || !run.cadenceTraceEnabled || !run.cadenceTraceRecords) return;
        if (run.cadenceTraceRecords.length >= CADENCE_CLIENT_CAPACITY) {
          run.cadenceTraceRecords.shift();
          run.cadenceTraceOverflowCount = (run.cadenceTraceOverflowCount || 0) + 1;
        }
        run.cadenceTraceRecords.push({
          runId: run.cadenceTraceRunId || `gen-${run.generation}`,
          connectionId: run.cadenceTraceConnectionId || '',
          sequence: fields.sequence ?? 0,
          clockDomain: "client-mono",
          event,
          atMonoMs: Number((fields.atMonoMs ?? monoNow()).toFixed(3)),
          generation: run.generation,
          ...fields,
        });
      };

      const recordCadenceDrawStart = (frameGeneration, seq, atMonoMs) => {
        if (!running || frameGeneration !== activeRun.generation || !activeRun.cadenceTraceEnabled) return;
        recordCadence(activeRun, "client-draw-start", { sequence: seq, atMonoMs: Number(atMonoMs.toFixed(3)) });
      };

      const recordCadenceDrawEnd = (frameGeneration, seq, ok, durationMs) => {
        if (!running || frameGeneration !== activeRun.generation || !activeRun.cadenceTraceEnabled) return;
        recordCadence(activeRun, "client-draw-end", {
          sequence: seq,
          success: ok,
          durationMs: Number(durationMs.toFixed(3)),
          reason: ok ? null : "draw-error",
        });
      };

      const recordCadenceDrawSkipped = (frameGeneration, seq, reason) => {
        if (!running || frameGeneration !== activeRun.generation || !activeRun.cadenceTraceEnabled) return;
        recordCadence(activeRun, "client-draw-skipped", { sequence: seq, success: false, reason });
      };

      const reportMetrics = () => {
        if (!running) return;
        fetchImpl("/whale-wallpaper/metrics", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(snapshot()), keepalive: true }).catch(() => {});
        flushCadenceTrace();
      };

      const recordDraw = (frameGeneration, ok, durationMs) => {
        if (!running || frameGeneration !== activeRun.generation) return;
        if (ok) {
          activeRun.drawCount++;
          activeRun.drawSumMs += durationMs;
          activeRun.drawMaxMs = Math.max(activeRun.drawMaxMs, durationMs);
        } else {
          activeRun.drawErrorCount++;
        }
      };

      const cancelSchedule = (sch) => {
        if (!sch || sch.cancelled || sch.completed) return;
        sch.cancelled = true;
        if (sch.rafId !== null) {
          cancelAnimationFrame(sch.rafId);
          sch.rafId = null;
        }
        if (sch.timeoutId !== null) {
          window.clearTimeout(sch.timeoutId);
          sch.timeoutId = null;
        }
      };

      const paint = async (run) => {
        if (!running || run !== activeRun || run.painting || !run.latest || document.hidden) return;
        run.painting = true;
        run.paintPhase = "decoding";
        const frame = run.latest;
        run.latest = null;
        let bitmap = null;
        let decodeErr = null;
        const decodeStart = monoNow();
        if (run.cadenceTraceEnabled) {
          recordCadence(run, "client-decode-start", { sequence: frame.sequence, atMonoMs: Number(decodeStart.toFixed(3)) });
        }
        try {
          bitmap = await createImageBitmap(new Blob([frame.jpeg], { type: "image/jpeg" }));
        } catch (err) {
          decodeErr = err;
        }

        try {
          if (run !== activeRun) {
            // A new run has started: clean up old bitmap and do not mutate activeRun
            bitmap?.close?.();
            bitmap = null;
            return;
          }

          if (decodeErr) {
            run.metrics.decodeErrors++;
            run.decodeFailCount++;
            const decodeFailMs = Math.max(0, monoNow() - decodeStart);
            run.decodeFailSumMs += decodeFailMs;
            run.decodeFailMaxMs = Math.max(run.decodeFailMaxMs, decodeFailMs);
            if (run.cadenceTraceEnabled) {
              recordCadence(run, "client-decode-end", {
                sequence: frame.sequence,
                durationMs: Number(decodeFailMs.toFixed(3)),
                success: false,
                reason: String(decodeErr.message ?? decodeErr),
              });
            }
            return;
          }

          const decodeMs = Math.max(0, monoNow() - decodeStart);
          run.decodeSuccessCount++;
          run.decodeSuccessSumMs += decodeMs;
          run.decodeSuccessMaxMs = Math.max(run.decodeSuccessMaxMs, decodeMs);
          if (run.cadenceTraceEnabled) {
            recordCadence(run, "client-decode-end", {
              sequence: frame.sequence,
              durationMs: Number(decodeMs.toFixed(3)),
              success: true,
            });
          }

          if (!running) {
            run.discardStaleCount++;
            bitmap?.close?.();
            bitmap = null;
            return;
          }

          if (document.hidden) {
            run.discardHiddenCount++;
            bitmap?.close?.();
            bitmap = null;
            return;
          }

          run.paintPhase = "sync";
          run.metrics.rendered++;
          run.metrics.sourceSequence = frame.sequence;
          const latency = Math.max(0, now() - frame.capturedAt);
          run.latencySum += latency;
          run.latencyMax = Math.max(run.latencyMax, latency);

          const syncStart = monoNow();
          try {
            emitFrame(bitmap, { ...frame, generation: run.generation });
            emitStatus({ rendered: run.metrics.rendered, decodeErrors: run.metrics.decodeErrors, state: "playing", error: "" });
            bitmap = null; // ownership moved to subscriber ONLY on successful notification
          } catch {
            run.syncErrorCount++;
          } finally {
            const syncMs = Math.max(0, monoNow() - syncStart);
            run.syncCount++;
            run.syncSumMs += syncMs;
            run.syncMaxMs = Math.max(run.syncMaxMs, syncMs);
          }
        } finally {
          bitmap?.close?.();
          run.painting = false;
          run.paintPhase = "idle";
          if (run === activeRun && running && !document.hidden && run.latest) {
            schedulePaint(run);
          }
        }
      };

      // requestAnimationFrame keeps painting aligned with the display, but it does not
      // fire in a hidden or non-composited page (and may hand back 0). The timeout
      // backstop guarantees an already running preview still paints instead of stalling.
      const schedulePaint = (run) => {
        if (!running || run !== activeRun || run.currentSchedule || run.painting) return;
        const schedule = {
          generation: run.generation,
          startTime: monoNow(),
          cancelled: false,
          completed: false,
          rafId: null,
          timeoutId: null,
        };
        run.currentSchedule = schedule;

        const onFire = (source) => {
          if (schedule.cancelled || schedule.completed) return;
          schedule.completed = true;
          if (schedule.rafId !== null) {
            cancelAnimationFrame(schedule.rafId);
            schedule.rafId = null;
          }
          if (schedule.timeoutId !== null) {
            window.clearTimeout(schedule.timeoutId);
            schedule.timeoutId = null;
          }
          if (run.currentSchedule === schedule) {
            run.currentSchedule = null;
          }
          if (!running || run !== activeRun) return;

          const waitMs = Math.max(0, monoNow() - schedule.startTime);
          if (run.cadenceTraceEnabled) {
            recordCadence(run, "client-schedule-fire", {
              sequence: run.latest?.sequence ?? 0,
              durationMs: Number(waitMs.toFixed(3)),
              scheduleSource: source,
            });
          }
          if (source === "timeout") {
            run.waitTimeoutCount++;
            run.waitTimeoutSumMs += waitMs;
            run.waitTimeoutMaxMs = Math.max(run.waitTimeoutMaxMs, waitMs);
          } else {
            run.waitRafCount++;
            run.waitRafSumMs += waitMs;
            run.waitRafMaxMs = Math.max(run.waitRafMaxMs, waitMs);
          }
          if (run.latest) paint(run);
        };

        schedule.rafId = requestAnimationFrame(() => onFire("raf"));
        schedule.timeoutId = window.setTimeout(() => onFire("timeout"), 250);
      };

      const accept = (runGeneration, frame) => {
        if (!running || runGeneration !== activeRun.generation) return;
        const r = activeRun;
        r.metrics.received++;
        r.lastFrameAt = now();
        lastFrameAt = r.lastFrameAt;
        if (r.cadenceTraceEnabled) {
          recordCadence(r, "client-accept", {
            sequence: frame.sequence,
            capturedAt: frame.capturedAt,
          });
        }
        if (r.latest) {
          r.metrics.dropped++;
          const dropReason = r.painting
            ? (r.paintPhase === "decoding" ? "drop-decoding" : r.paintPhase === "sync" ? "drop-sync" : "drop-other")
            : (r.currentSchedule && !r.currentSchedule.cancelled && !r.currentSchedule.completed ? "drop-waiting-callback" : "drop-other");
          if (r.cadenceTraceEnabled) {
            recordCadence(r, "client-drop-latest", {
              sequence: r.latest.sequence,
              supersededBy: frame.sequence,
              reason: dropReason,
            });
          }
          if (r.painting) {
            if (r.paintPhase === "decoding") {
              r.dropDecodingCount++;
            } else if (r.paintPhase === "sync") {
              r.dropSyncCount++;
            } else {
              r.dropOtherCount++;
            }
          } else if (r.currentSchedule && !r.currentSchedule.cancelled && !r.currentSchedule.completed) {
            r.dropWaitingCallbackCount++;
          } else {
            r.dropOtherCount++;
          }
        }
        r.latest = { ...frame, jpeg: frame.jpeg.slice() };
        if (!r.painting && !r.currentSchedule && !document.hidden) schedulePaint(r);
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
          if (response.headers?.get?.("x-cadence-trace") === "1" && runGeneration === activeRun.generation) {
            activeRun.cadenceTraceEnabled = true;
            activeRun.cadenceTraceRunId = response.headers.get("x-cadence-run-id") || '';
            activeRun.cadenceTraceConnectionId = response.headers.get("x-cadence-connection-id") || '';
            if (!activeRun.cadenceTraceRecords) activeRun.cadenceTraceRecords = [];
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
        activeRun = createRunContext(generation);
        activeRun.startedAt = startedAt || now();
        activeRun.lastFrameAt = lastFrameAt || now();
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
          if (hideStalledFrames || activeRun.hideStalledFrames) {
            hideStalledFrames = false;
            activeRun.hideStalledFrames = false;
            return;
          }
          const fresh = now() - (activeRun.lastFrameAt || lastFrameAt) < idleTimeoutMs;
          // A preview that stopped delivering frames stops presenting the last one: the
          // ordinary theme comes back while the client keeps trying to recover.
          emitStatus(fresh
            ? { state: "playing", error: "", rendered: activeRun.metrics.rendered, decodeErrors: activeRun.metrics.decodeErrors, seconds }
            : { state: "waiting", error: "", rendered: activeRun.metrics.rendered, decodeErrors: activeRun.metrics.decodeErrors, seconds });
        }, 500);
        const outcome = await runStream(runGeneration);
        window.clearInterval(pollTimer); pollTimer = null;
        if (!running || runGeneration !== generation || outcome.ending === "stopped") return;
        running = false; busy = false;
        const message = outcome.ending === "stream-end" ? "" : String(outcome.error || outcome.ending);
        const failed = outcome.ending !== "stream-end";
        if (!failed) {
          finalizeRunCadenceTrace(activeRun);
        }
        emitStatus({ state: failed ? "error" : "stopped", error: message,
          rendered: activeRun.metrics.rendered, decodeErrors: activeRun.metrics.decodeErrors });
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

      /**
       * Read the bounded wallpaper list. Only the id, the title (plain text), the type, the
       * availability and a short reason reach this side; the Host never sends a path.
       * `refresh: true` asks the Host to rescan; everything else is a cached read and never
       * starts, stops or rescans anything.
       */
      async function readLibrary({ refresh = false, ensure = false, signal = null } = {}) {
        const reqId = ++libraryRevision;
        if (refresh) {
          libraryRefreshing = true;
          if (librarySnapshot) {
            librarySnapshot = Object.freeze({ ...librarySnapshot, loading: true });
          } else {
            librarySnapshot = Object.freeze({ items: [], state: "loading", loaded: false, loading: true, error: null });
          }
          for (const listener of libraryListeners) {
            try { listener(librarySnapshot); } catch {}
          }
        }
        try {
          const path = refresh ? "/whale-wallpaper/library/refresh" : ensure ? "/whale-wallpaper/library?ensure=1" : "/whale-wallpaper/library";
          const response = await fetchImpl(path,
            { method: refresh ? "POST" : "GET", cache: "no-store", ...(signal ? { signal } : {}) });
          const payload = await response.json().catch(() => null);
          const items = Array.isArray(payload?.items) ? payload.items.map(cleanLibraryItem).filter(Boolean) : [];
          const result = {
            ok: response.ok,
            items,
            state: typeof payload?.state === "string" ? payload.state : (response.ok ? "ready" : "failed"),
            loaded: payload?.loaded === true,
            ensureScan: payload?.ensureScan === true,
            truncated: payload?.truncated === true,
            scannedAt: typeof payload?.scannedAt === "string" ? payload.scannedAt : null,
            error: typeof payload?.error === "string" ? payload.error : (response.ok ? "" : `library-${response.status}`),
            rootsConfigured: Number.isInteger(payload?.rootsConfigured) ? payload.rootsConfigured : 0,
            rootsAvailable: Number.isInteger(payload?.rootsAvailable) ? payload.rootsAvailable : 0,
            rootWarnings: Array.isArray(payload?.rootWarnings) ? payload.rootWarnings.map(entry => String(entry?.reason ?? "")).filter(Boolean) : [],
          };
          if (reqId === libraryRevision) {
            libraryRefreshing = false;
            librarySnapshot = Object.freeze(result);
            for (const listener of libraryListeners) {
              try { listener(librarySnapshot); } catch {}
            }
          }
          return result;
        } catch (error) {
          if (reqId === libraryRevision) {
            libraryRefreshing = false;
            librarySnapshot = Object.freeze({
              ok: false,
              items: librarySnapshot?.items || [],
              state: "failed",
              loaded: Boolean(librarySnapshot?.loaded),
              loading: false,
              truncated: false,
              error: error.message || "library_fetch_failed",
              rootsConfigured: 0,
              rootsAvailable: 0,
              rootWarnings: [],
            });
            for (const listener of libraryListeners) {
              try { listener(librarySnapshot); } catch {}
            }
          }
          throw error;
        }
      }

      /** Keep only the fields the UI is allowed to show, and never treat a title as markup. */
      function cleanLibraryItem(raw) {
        if (!raw || typeof raw !== "object") return null;
        if (!isSceneId(raw.id)) return null;
        return {
          id: raw.id,
          title: typeof raw.title === "string" ? raw.title.slice(0, 200) : raw.id,
          type: ["scene", "video", "web", "unknown"].includes(raw.type) ? raw.type : "unknown",
          available: raw.available === true,
          contentRating: ["Everyone", "Questionable", "Mature"].includes(raw.contentRating) ? raw.contentRating : (raw.id === "lucy" ? "Everyone" : "unknown"),
          // Anything the Host did not mark as verified stays experimental, whatever the field says.
          playbackVerified: raw.playbackVerified === true && raw.id === "lucy",
          reason: typeof raw.reason === "string" ? raw.reason : null,
          previewRef: raw.previewRef && typeof raw.previewRef === "object" ? {
            wallpaperId: raw.previewRef.wallpaperId || raw.id,
            kind: raw.previewRef.kind || "preview",
          } : { wallpaperId: raw.id, kind: "preview" },
        };
      }

      const invalidate = () => { generation += 1; return generation; };

      const finalizeRunCadenceTrace = (targetRun = activeRun) => {
        if (!targetRun) return;
        targetRun.stopped = true;
        if (targetRun.cadenceTraceInFlight && targetRun.cadenceTraceAbortController) {
          const inFlightCtrl = targetRun.cadenceTraceAbortController;
          setTimeout(() => {
            try { inFlightCtrl.abort(new Error('stop-deadline')); } catch {}
          }, 100);
        }
        if (targetRun.cadenceTraceEnabled && targetRun.cadenceTraceConnectionId) {
          if (targetRun.cadenceTraceInFlight) {
            targetRun.cadenceTraceStopPending = true;
          } else {
            flushCadenceTrace(targetRun, { isStop: true });
          }
        }
      };

      const stop = (reason = "user", { bump = true } = {}) => {
        // A user stop uses a new generation so a late start reply cannot revive the run.
        // The internal close that follows a terminal failure keeps the generation: that run
        // is already over, and bumping it would erase the failure the user must see.
        const stopId = ++stopRevision;
        activeStopId = stopId;
        const stopGeneration = bump ? invalidate() : generation;
        activeStopGeneration = stopGeneration;
        const keptError = reason === "failed" ? status.error : "";
        const keptState = reason === "failed" && ["error", "cleanup-failed"].includes(status.state) ? status.state : null;
        running = false; busy = false;
        abort?.abort(); abort = null;
        window.clearInterval(pollTimer); pollTimer = null;
        finalizeRunCadenceTrace(activeRun);
        if (activeRun.currentSchedule) {
          cancelSchedule(activeRun.currentSchedule);
          activeRun.currentSchedule = null;
          activeRun.waitCancelledCount++;
        }
        activeRun.latest = null;
        // The ended run keeps no live timing: a later run measures its own elapsed time
        // instead of inheriting the stopped one's total.
        startedAt = 0;
        activeRun.startedAt = 0;
        hideStalledFrames = false;
        emitStatus({ state: keptState ?? (reason === "user" ? "stopped" : "idle"), error: keptError, generation: stopGeneration, seconds: 0, cleanupPending: true });
        // The layer is dropped right away; a close that cannot be proven is reported
        // afterwards so the UI can say so instead of pretending the run stopped cleanly.
        notifyStop(reason);
        return command("stop").then(({ ok, payload }) => {
          const isCurrent = (activeStopId === stopId) && (generation === stopGeneration) && !disposed;
          if (!isCurrent) return status;
          activeStopId = 0;
          activeStopGeneration = 0;
          lastCleanup = payload?.cleanup ?? payload?.lastCleanup ?? null;
          const proven = ok && lastCleanup?.closed !== false;
          if (!proven) {
            const detail = payload?.error || lastCleanup?.error || `cleanup not confirmed (${lastCleanup?.outcome ?? "unknown"})`;
            emitStatus({ state: "cleanup-failed", error: String(detail), host: payload, cleanupPending: false });
          } else {
            emitStatus({ state: keptState ?? (reason === "user" ? "stopped" : "idle"), error: keptError, host: payload, cleanupPending: false });
          }
          return status;
        }).catch(error => {
          const isCurrent = (activeStopId === stopId) && (generation === stopGeneration) && !disposed;
          if (!isCurrent) return status;
          activeStopId = 0;
          activeStopGeneration = 0;
          emitStatus({ state: "cleanup-failed", error: String(error?.message || "stop-failed"), cleanupPending: false });
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
          activeStopId = 0;
          activeStopGeneration = 0;
          busy = true;
          const runGeneration = invalidate();
          emitStatus({ state: "starting", error: "", generation: runGeneration, cleanupPending: false });
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
            activeRun = createRunContext(runGeneration);
            activeRun.startedAt = startedAt;
            activeRun.lastFrameAt = lastFrameAt;
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
          activeStopId = 0;
          activeStopGeneration = 0;
          busy = true;
          const restartGeneration = invalidate();
          emitStatus({ state: "starting", error: "", generation: restartGeneration, cleanupPending: false });
          try {
            const { ok, payload } = await command("restart", { scene, mode });
            if (disposed || restartGeneration !== generation) {
              if (ok) await command("stop").catch(() => {});
              return status;
            }
            if (!ok) throw new Error(payload?.error || "restart-failed");
            running = true; busy = false;
            startedAt = now(); lastFrameAt = now();
            activeRun = createRunContext(restartGeneration);
            activeRun.startedAt = startedAt;
            activeRun.lastFrameAt = lastFrameAt;
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
        readLibrary,
        hasPendingCleanup: () => Boolean(status.cleanupPending || activeStopId !== 0 || activeStopGeneration !== 0),
        getLibrarySnapshot: () => librarySnapshot,
        setLibrarySnapshot: (s) => {
          if (libraryRefreshing) return;
          if (s && s.loaded && s.state === "ready" && !s.loading) {
            libraryRevision++;
            librarySnapshot = Object.freeze({
              ...s,
              items: Array.isArray(s.items) ? s.items.map(cleanLibraryItem).filter(Boolean) : []
            });
          } else {
            librarySnapshot = null;
          }
          for (const listener of libraryListeners) {
            try { listener(librarySnapshot); } catch {}
          }
        },
        subscribeLibrary(listener) {
          libraryListeners.add(listener);
          return () => libraryListeners.delete(listener);
        },
        /** Last close result reported by the Host, or null when nothing was closed yet. */
        lastCleanup: () => lastCleanup,
        dispose() {
          disposed = true;
          activeStopId = 0;
          activeStopGeneration = 0;
          invalidate();
          running = false; busy = false;
          abort?.abort(); abort = null;
          window.clearInterval(pollTimer); pollTimer = null;
          if (activeRun.currentSchedule) {
            cancelSchedule(activeRun.currentSchedule);
            activeRun.currentSchedule = null;
            activeRun.waitCancelledCount++;
          }
          frameListeners.clear(); statusListeners.clear(); listeners.clear(); stallListeners.clear();
          activeRun.latest = null;
        },
        recordDraw,
        recordCadenceDrawStart,
        recordCadenceDrawEnd,
        recordCadenceDrawSkipped,
        enableCadenceTrace: (enabled, runId, connectionId) => {
          activeRun.cadenceTraceEnabled = Boolean(enabled);
          activeRun.cadenceTraceRunId = runId || '';
          activeRun.cadenceTraceConnectionId = connectionId || '';
          activeRun.cadenceTraceRecords = enabled ? (activeRun.cadenceTraceRecords || []) : null;
        },
        getCadenceTrace: () => activeRun.cadenceTraceRecords ? [...activeRun.cadenceTraceRecords] : [],
        flushCadenceTrace,
        monotonicNow: monoNow,
        acceptFrame: (frame) => accept(activeRun.generation, frame),
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

      // A sticky composer shares the scrollport with a potentially very tall view. A clip measured
      // from that moving view cannot keep up with compositor scrolling. On the recognized host use
      // a stationary native message viewport and dock the existing seat outside its clipping block;
      // keep the measured sibling clip only as a fallback. No opaque cover or React node move.
      const HISTORY_CLIP = "--wm-history-clip-bottom";
      const HISTORY_ATTRIBUTE = "data-wm-history-clip";
      const clippedViews = new Map();
      const historyPorts = new Map();
      const PORT_ATTRIBUTE = "data-wm-message-port";
      const SEAT_ATTRIBUTE = "data-wm-fixed-composer";
      const PORT_PROPERTIES = ["--wm-port-reserve"];
      const SEAT_PROPERTIES = ["--wm-port-width", "--wm-port-left"];
      const rememberPortNode = (node, attribute, properties) => ({
        node, attribute, previous: node.getAttribute(attribute),
        properties: properties.map(name => ({ name, value: node.style.getPropertyValue(name), priority: node.style.getPropertyPriority(name) })),
      });
      const restorePortNode = ({ node, attribute, previous, properties }) => {
        if (previous === null) node.removeAttribute(attribute);
        else node.setAttribute(attribute, previous);
        for (const { name, value, priority } of properties) {
          if (value) node.style.setProperty(name, value, priority);
          else node.style.removeProperty(name);
        }
      };
      const setPortProperty = (node, name, value) => {
        if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
      };
      const atHistoryEnd = scroll => scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop <= 1;
      const restoreHistoryPort = (scroll, state) => {
        const atEnd = scroll.isConnected && atHistoryEnd(scroll);
        restorePortNode(state.scroll);
        restorePortNode(state.seat);
        historyPorts.delete(scroll);
        if (atEnd) scroll.scrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      };
      // The host already supplies a positioned body and a message/seat sibling structure. Keep those
      // nodes: the seat's containing block is the body outside the scrollport, so the native scroll
      // clip only contains messages. Its bottom edge stays on the card's top even during compositor
      // scrolling. No opaque cover, wheel handler, or per-scroll moving clip is needed for this edge.
      const prepareHistoryPort = (scroll, content, seat, card) => {
        if (getComputedStyle(content).position !== "relative") return false;
        let state = historyPorts.get(scroll);
        if (state && state.seat.node !== seat) { restoreHistoryPort(scroll, state); state = null; }
        if (!state) {
          state = { scroll: rememberPortNode(scroll, PORT_ATTRIBUTE, PORT_PROPERTIES), seat: rememberPortNode(seat, SEAT_ATTRIBUTE, SEAT_PROPERTIES) };
          historyPorts.set(scroll, state);
        }
        const atEnd = atHistoryEnd(scroll);
        const bodyRect = content.getBoundingClientRect();
        const scrollRect = scroll.getBoundingClientRect();
        const width = `${scroll.clientWidth}px`;
        const left = `${scrollRect.left + scroll.clientLeft - bodyRect.left - content.clientLeft}px`;
        scroll.setAttribute(PORT_ATTRIBUTE, "");
        seat.setAttribute(SEAT_ATTRIBUTE, "");
        setPortProperty(seat, "--wm-port-width", width);
        setPortProperty(seat, "--wm-port-left", left);
        // Read after docking: growing drafts and toolbar/attachment changes affect the card's top.
        const reserve = `${Math.max(0, bodyRect.bottom - content.clientTop - card.getBoundingClientRect().top)}px`;
        setPortProperty(scroll, "--wm-port-reserve", reserve);
        if (atEnd) scroll.scrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
        return true;
      };
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
        const ports = new Set();
        const observed = new Set();
        const scrollElements = typeof document.querySelectorAll === "function" ? document.querySelectorAll("[data-conversation-scroll]") : [];
        for (const scroll of scrollElements) {
          const content = scroll.closest("[data-conversation-content]");
          if (content?.dataset.contentPhase !== "active") continue;
          const seat = scroll.querySelector(":scope > [data-composer-seat]");
          const card = seat?.querySelector(".RlGAzG_card");
          if (!card || !card.getClientRects().length) continue;
          if (prepareHistoryPort(scroll, content, seat, card)) ports.add(scroll);
          const cardTop = card.getBoundingClientRect().top;
          observed.add(content); observed.add(scroll); observed.add(seat); observed.add(card);
          for (const view of scroll.querySelectorAll(":scope > .Dc7zOa_viewArea, :scope > [data-slot='conversation.session'] > .Dc7zOa_viewArea")) {
            if (!view.getClientRects().length) continue;
            found.add(view); observed.add(view);
            if (!clippedViews.has(view)) clippedViews.set(view, {
              value: view.style.getPropertyValue(HISTORY_CLIP),
              priority: view.style.getPropertyPriority(HISTORY_CLIP),
              attribute: view.getAttribute(HISTORY_ATTRIBUTE),
            });
            applyHistoryClip(view, cardTop);
            if (!view.hasAttribute(HISTORY_ATTRIBUTE)) view.setAttribute(HISTORY_ATTRIBUTE, "");
          }
        }
        for (const [view, previous] of clippedViews) if (!found.has(view)) restoreHistoryView(view, previous);
        for (const [scroll, state] of historyPorts) if (!ports.has(scroll)) restoreHistoryPort(scroll, state);
        if (historyResize) {
          for (const target of historyObserved) if (!observed.has(target)) historyResize.unobserve(target);
          for (const target of observed) if (!historyObserved.has(target)) historyResize.observe(target);
        }
        historyObserved = observed;
      };
      // The inset is measured from the view's own border box: `bottom` removes the last `bottom` pixels
      // of that box, so the visible part ends where the card begins. Rounding outward hides subpixel
      // text at the boundary rather than leaving a sliver.
      //
      // This remains a fallback for hosts without the recognized positioned body. On the supported
      // host the native message scrollport is the visible boundary, independent of this moving inset.
      function applyHistoryClip(view, cardTop) {
        const rect = view.getBoundingClientRect();
        const bottom = Math.ceil(Math.max(0, Math.min(rect.height, rect.bottom - cardTop)));
        const value = `${bottom}px`;
        if (view.style.getPropertyValue(HISTORY_CLIP) !== value) view.style.setProperty(HISTORY_CLIP, value);
      }
      // Updating the inset only on the next animation frame left it describing the previous scroll
      // position. Recomputing it here, where the scroll event has already been delivered, reduces that
      // lag at the callback. Whether a frame that reaches the screen can still show text near the card
      // is decided by the painted-frame check, not by this comment: the geometry improvement observed
      // here is not a guarantee about what the compositor presents.
      const updateHistoryClip = () => {
        if (!historyTracking || clippedViews.size === 0) return;
        for (const view of clippedViews.keys()) {
          if (!view.getClientRects().length) continue;
          const scroll = view.closest("[data-conversation-scroll]");
          if (historyPorts.has(scroll)) continue;
          const card = scroll?.querySelector("[data-composer-seat] .RlGAzG_card");
          if (!card || !card.getClientRects().length) continue;
          applyHistoryClip(view, card.getBoundingClientRect().top);
        }
      };
      const queueHistoryMeasure = () => {
        if (historyTracking && historyFrame === null) historyFrame = requestAnimationFrame(measureHistory);
      };
      const onHistoryScroll = () => {
        updateHistoryClip();
        queueHistoryMeasure();
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
        document.addEventListener("scroll", onHistoryScroll, true);
        window.addEventListener("resize", queueHistoryMeasure);
        measureHistory();
      };
      function stopHistoryTracking() {
        historyTracking = false;
        historyResize?.disconnect(); historyResize = null;
        historyMutation?.disconnect(); historyMutation = null;
        if (historyFrame !== null) cancelAnimationFrame(historyFrame);
        historyFrame = null;
        document.removeEventListener("scroll", onHistoryScroll, true);
        window.removeEventListener("resize", queueHistoryMeasure);
        for (const [view, previous] of clippedViews) restoreHistoryView(view, previous);
        for (const [scroll, state] of historyPorts) restoreHistoryPort(scroll, state);
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
        if (!wallpaperLayer || !running) {
          engine?.recordCadenceDrawSkipped?.(frame?.generation, frame?.sequence, !wallpaperLayer ? 'no-layer' : 'not-running');
          bitmap.close?.(); return;
        }
        const canvas = wallpaperLayer.querySelector(".wm-backdrop-media");
        if (!canvas) {
          engine?.recordCadenceDrawSkipped?.(frame?.generation, frame?.sequence, 'no-canvas');
          bitmap.close?.(); return;
        }
        if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
          canvas.width = bitmap.width; canvas.height = bitmap.height;
        }
        const mono = engine?.monotonicNow ?? (typeof performance !== "undefined" && typeof performance.now === "function" ? () => performance.now() : () => Date.now());
        const drawStart = mono();
        engine?.recordCadenceDrawStart?.(frame?.generation, frame?.sequence, drawStart);
        let drawSuccess = false;
        try {
          canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0);
          drawSuccess = true;
        } catch {
          drawSuccess = false;
        } finally {
          const drawMs = Math.max(0, mono() - drawStart);
          engine?.recordDraw?.(frame?.generation, drawSuccess, drawMs);
          engine?.recordCadenceDrawEnd?.(frame?.generation, frame?.sequence, drawSuccess, drawMs);
        }
        bitmap.close?.();
        if (drawSuccess) {
          // The layer becomes visible and the UI becomes transparent only together with a
          // real frame, so a loading or stalled preview never leaves the chat see-through.
          wallpaperPainted = true;
          wallpaperLayer.hidden = false;
          document.body.dataset.wmBackdrop = "wallpaper";
          startHistoryTracking();
          wallpaperLayer.dataset.wmSequence = String(frame.sequence);
        }
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
      // The bounded wallpaper list. It is read on demand (the settings panel opening) and on an
      // explicit refresh; a status poll, a frame or a re-render never scans the library.
      const [library, setLibrary] = React.useState(() => {
        const existing = typeof controller?.wallpaper?.getLibrarySnapshot === "function"
          ? controller.wallpaper.getLibrarySnapshot()
          : null;
        return existing ?? { items: [], state: "idle", loaded: false, loading: false, truncated: false, error: "", scannedAt: null, rootWarnings: [] };
      });
      const presetsState = React.useSyncExternalStore(controller.presets.subscribe, controller.presets.getSnapshot);
      const [presetActionError, setPresetActionError] = React.useState("");
      const libraryRequest = React.useRef(0);
      const libraryAbort = React.useRef(null);
      const mounted = React.useRef(true);
      React.useEffect(() => () => {
        mounted.current = false;
        libraryAbort.current?.abort?.();
      }, []);
      const loadLibrary = React.useCallback(async (refresh = false) => {
        const request = ++libraryRequest.current;
        libraryAbort.current?.abort?.();
        const controllerForRead = typeof AbortController === "function" ? new AbortController() : null;
        libraryAbort.current = controllerForRead;
        setLibrary(current => ({ ...current, loading: true }));
        try {
          // Opening the area asks for a list, not just a cache peek: `ensure` lets the Host perform
          // the first bounded scan. With a snapshot already present the Host answers from the cache,
          // so reopening the area does not walk the library again.
          const payload = await controller.wallpaper.readLibrary({ refresh, ensure: !refresh, signal: controllerForRead?.signal });
          // A late answer from a superseded read (or an unmounted panel) must not replace the
          // current list.
          if (!mounted.current || request !== libraryRequest.current) return;
          setLibrary({ ...payload, loading: false });
        } catch (error) {
          if (!mounted.current || request !== libraryRequest.current) return;
          setLibrary(current => ({ ...current, loading: false, state: "failed", error: String(error?.message || "library-failed") }));
        }
      }, [controller]);
      // On-demand load: opening the settings area loads the list once (scanning on the first open
      // and reading the cache afterwards); it never starts or stops playback.
      React.useEffect(() => { loadLibrary(false); }, [loadLibrary]);
      const inputs = React.useRef({});
      const chinese = (navigator.language || "").toLowerCase().startsWith("zh");
      const copy = chinese ? {
        title: "鲸系外观",
        badge: "Whale",
        description: "选择浅雾或深色配色，可设置图片或视频背景；输入卡片始终保持不透明。",
        reset: "恢复默认",
        readabilityTitle: "界面可读性",
        textContrast: "文字可读性",
        textContrastStandardHint: "保持主题原有文字，跟随系统高对比度",
        textContrastEnhancedHint: "提高正文、次要说明和普通工具行的区分，不改变状态含义",
        enhanced: "增强",
        chatBackdrop: "聊天底色强度",
        chatBackdropHint: "0%保留壁纸，100%使用主题实色；覆盖整个聊天列，与侧栏/卡片不透明度分开",
        theme: "主题",
        themeHint: "在鲸雾蓝与鲸渊深色之间切换",
        mist: "鲸雾",
        abyss: "鲸渊",
        palette: "深色配色",
        paletteHint: "鲸渊的主题底色；跟随主题时同时决定强调色",
        ocean: "深海",
        graphite: "石墨",
        violet: "暗紫",
        jade: "墨绿",
        accentMode: "强调色",
        accentTheme: "跟随主题",
        accentCustom: "自定义",
        accentHint: "按钮使用所选颜色；链接、高亮和焦点会随主题调整深浅以便识别。跟随主题恢复原配色",
        customAccent: "自定义颜色",
        customAccentHint: "仅使用 6 位十六进制色值；自动调整文字与焦点对比度",
        previewButton: "主按钮",
        previewLink: "链接",
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
        wallpaperEngineHint: "从本机已登记的壁纸里选择；只有 Lucy 经过实机验收，其它场景属于实验播放",
        scene: "壁纸列表",
        sceneHint: "只列出本机工坊里已登记的项目，点击选中；不可用项会说明原因",
        sceneRefresh: "刷新壁纸列表",
        sceneRefreshing: "正在扫描…",
        sceneEmpty: "没有登记到壁纸。确认工坊目录存在后刷新",
        sceneLoading: "正在读取列表…",
        sceneLoadFailed: "列表读取失败",
        sceneUnconfigured: "本机未配置壁纸库目录",
        sceneTruncated: "列表已达到扫描上限，只显示部分结果",
        sceneRootMissing: "配置的壁纸目录不可用",
        sceneVerified: "已验证样例",
        sceneExperimental: "未验证，实验播放",
        sceneUnavailable: "不可用",
        sceneReasonUnsupported: "本版本仅支持 scene 和 MP4 视频",
        sceneReasonUnknownType: "类型未知",
        sceneReasonMissing: "文件登记不完整",
        sceneReasonUnsafe: "路径不安全",
        sceneReasonOther: "不可播放",
        selectedItem: "本次选择",
        playingItem: "当前播放",
        notPlaying: "未播放",
        selectedUnavailable: "所选壁纸已不可用",
        selectedPending: "正在等待列表确认所选壁纸，确认前不能开始",
        autoStartSkipped: "未验证的壁纸不会自动播放，请手动点「开始播放」",
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
        brightnessHint: "100%保留原亮度，可继续提亮；最终效果还受遮罩和界面底色影响",
        mask: "遮罩",
        maskHint: "叠加主题底色；数值越大，主题底色覆盖越强，0%关闭这层遮罩",
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
        },
        presetTitle: "壁纸外观预设",
        presetHint: "每张壁纸保存一份亮度、遮罩、模糊与不透明度；手动应用到当前外观，全局恢复默认不删除预设",
        presetSelectedTarget: "所选壁纸",
        presetPlayingTarget: "播放壁纸",
        presetSaved: "已保存预设",
        presetEmpty: "未保存预设",
        presetSave: "保存当前外观",
        presetApply: "应用已保存外观",
        presetDelete: "删除预设",
        presetMismatch: "请先停止当前播放或切换到所选壁纸",
        presetBusy: "播放状态切换中，预设暂不可用",
        presetStorageError: "本机存储不可用，无法保存预设"
      } : {
        title: "Whale appearance",
        badge: "Whale",
        description: "Choose mist or a dark palette, and optionally an image or video background. The composer stays opaque.",
        reset: "Reset",
        readabilityTitle: "Interface readability",
        textContrast: "Text readability",
        textContrastStandardHint: "Preserves original theme text and follows system high contrast",
        textContrastEnhancedHint: "Increases separation between body text, secondary notes, and normal tool rows without altering semantic states",
        enhanced: "Enhanced",
        chatBackdrop: "Chat backdrop opacity",
        chatBackdropHint: "0% preserves wallpaper, 100% uses solid theme color; covers the whole chat column, separate from sidebar/card opacity",
        theme: "Theme",
        themeHint: "Switch between Whale Mist and Whale Abyss",
        mist: "Mist",
        abyss: "Abyss",
        palette: "Dark palette",
        paletteHint: "Base color for Whale Abyss; also decides accent color when following theme",
        ocean: "Ocean",
        graphite: "Graphite",
        violet: "Violet",
        jade: "Jade",
        accentMode: "Accent color",
        accentTheme: "Follow theme",
        accentCustom: "Custom",
        accentHint: "Buttons use the selected color; links, highlights, and focus rings adapt to maintain readability across themes. Follow theme restores default colors.",
        customAccent: "Custom color",
        customAccentHint: "6-digit hex color only; text and focus contrast adjust automatically",
        previewButton: "Primary button",
        previewLink: "Link",
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
        wallpaperEngineHint: "Pick from the wallpapers registered on this machine; only Lucy has a supervised acceptance, everything else is experimental",
        scene: "Wallpapers",
        sceneHint: "Lists the projects registered in the local workshop folder; click to select, unavailable items say why",
        sceneRefresh: "Refresh list",
        sceneRefreshing: "Scanning…",
        sceneEmpty: "No wallpaper registered. Check the workshop folder and refresh",
        sceneLoading: "Reading the list…",
        sceneLoadFailed: "The list could not be read",
        sceneUnconfigured: "No wallpaper library folder is configured",
        sceneTruncated: "The list hit the scan limit and shows only part of the result",
        sceneRootMissing: "A configured wallpaper folder is unavailable",
        sceneVerified: "Verified sample",
        sceneExperimental: "Unverified, experimental",
        sceneUnavailable: "Unavailable",
        sceneReasonUnsupported: "This version supports scenes and MP4 videos only",
        sceneReasonUnknownType: "Unknown type",
        sceneReasonMissing: "Incomplete file registration",
        sceneReasonUnsafe: "Unsafe path",
        sceneReasonOther: "Not playable",
        selectedItem: "Next selection",
        playingItem: "Now playing",
        notPlaying: "Nothing",
        selectedUnavailable: "The selected wallpaper is no longer available",
        selectedPending: "Waiting for the list to confirm this wallpaper; it cannot start yet",
        autoStartSkipped: "Unverified wallpapers never start automatically; use Start playing",
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
        brightnessHint: "100% preserves original brightness, higher values brighten further; final look is also affected by scrim and surface opacity",
        mask: "Scrim",
        maskHint: "Overlays the theme base colour; higher values cover more, 0% turns this scrim off",
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
        },
        presetTitle: "Wallpaper appearance preset",
        presetHint: "Saves brightness, scrim, blur, and opacity per wallpaper; manually apply to current look; global reset preserves presets",
        presetSelectedTarget: "Selected wallpaper",
        presetPlayingTarget: "Playing wallpaper",
        presetSaved: "Preset saved",
        presetEmpty: "No preset saved",
        presetSave: "Save current look",
        presetApply: "Apply saved look",
        presetDelete: "Delete preset",
        presetMismatch: "Stop current playback or switch to the selected wallpaper first",
        presetBusy: "Playback in transition; presets temporarily unavailable",
        presetStorageError: "Local storage unavailable; cannot save preset"
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
        ] : key === "accentMode" ? (value === "theme" ? copy.accentTheme : copy.accentCustom)
          : key === "background" && value === "wallpaper" ? copy.wallpaperEngine : copy[value])))
      ]);

      const customAccentRow = () => h("div", {
        className: "wm-settings-row wm-accent-custom-row",
        key: "accent-custom"
      }, [
        h("div", { className: "wm-settings-copy", key: "copy" }, [
          h("div", { className: "wm-settings-label", key: "label" }, copy.customAccent),
          h("div", { className: "wm-settings-hint", key: "hint" }, copy.customAccentHint)
        ]),
        h("div", { className: "wm-accent-controls", key: "controls" }, [
          h("input", {
            type: "color",
            className: "wm-accent-picker",
            key: "picker",
            value: settings.accentColor,
            "aria-label": copy.customAccent,
            "data-wm-setting": "accentColor",
            onChange: (event) => update("accentColor", event.currentTarget.value),
            onInput: (event) => update("accentColor", event.currentTarget.value)
          }),
          h("span", {
            className: "wm-accent-hex",
            key: "hex",
            "data-wm-accent-hex": settings.accentColor
          }, settings.accentColor),
          h("div", { className: "wm-accent-preview", key: "preview" }, [
            h("button", {
              type: "button",
              className: "wm-accent-preview-button",
              key: "preview-button",
              "data-wm-preview": "button",
              tabIndex: -1,
              style: {
                background: "var(--dsw-alias-button-primary-fill)",
                color: "var(--dsw-alias-label-primary-foreground)"
              }
            }, copy.previewButton),
            h("span", {
              className: "wm-accent-preview-link",
              key: "preview-link",
              "data-wm-preview": "link",
              style: {
                color: "var(--dsw-alias-link)"
              }
            }, copy.previewLink)
          ])
        ])
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
        // The buttons are already disabled for an unusable selection; this is the second line of
        // defence, so a programmatic call cannot submit a switch the Host would refuse (which for a
        // restart would have closed the working picture first).
        if (!selectionUsable() && !(action === "stop")) {
          setPreviewActionError(copy.selectedUnavailable);
          return;
        }
        try {
          setPreviewBusy(true);
          setPreviewActionError("");
          await controller.wallpaper[action](settings.weScene, settings.weMode);
        } catch (error) {
          setPreviewActionError(String(error?.message || "playback-failed"));
        } finally { setPreviewBusy(false); }
      };
      // A short, plain-text reason for an item that cannot be started. The Host reports a machine
      // reason code; this side only turns it into wording and never renders it as markup.
      const sceneReasonText = (item) => {
        if (item.available) return "";
        const map = { playback_type_not_supported: copy.sceneReasonUnsupported, unknown_type: copy.sceneReasonUnknownType, unsafe_path: copy.sceneReasonUnsafe, unsafe_preview: copy.sceneReasonUnsafe };
        if (item.type && !["scene", "video"].includes(item.type)) return map.playback_type_not_supported;
        return map[item.reason] ?? copy.sceneReasonOther;
      };
      const sceneItemTitle = (item) => {
        const parts = [item.title];
        if (item.playbackVerified) parts.push(`（${copy.sceneVerified}）`);
        else if (["scene", "video"].includes(item.type) && item.available) parts.push(`（${copy.sceneExperimental}）`);
        if (!item.available) parts.push(`（${copy.sceneUnavailable}：${sceneReasonText(item)}）`);
        return parts.join(" ");
      };
      // The list is the Host's snapshot plus whatever the status payload already knows about the
      // verified sample, so a library that failed to load still shows the sample it can start.
      const knownItems = () => {
        const items = [...library.items];
        if (!items.some(item => item.id === "lucy")) {
          const verified = Array.isArray(wallpaperStatus.host?.scenes) ? wallpaperStatus.host.scenes.find(scene => scene.id === "lucy") : null;
          items.unshift({ id: "lucy", title: "Lucy", type: "scene", available: verified ? verified.available !== false : true, playbackVerified: true, reason: null });
        }
        return items;
      };
      const selectedItem = () => knownItems().find(item => item.id === settings.weScene) ?? null;
      /** True when the selection is the sample, which carries its own verified file. */
      const selectionIsSample = () => settings.weScene === "lucy";
      /**
       * The state of the current selection, as the buttons and the warning both need it.
       *
       *  - `verified`  the sample, or a catalogue entry the Host has confirmed available;
       *  - `pending`   a catalogue id the list has not confirmed yet (still loading, a failed read,
       *                an empty snapshot): NOT usable, because nothing has proved it exists, and not
       *                reported as deleted either;
       *  - `unusable`  the list was read and this entry is missing or listed unavailable;
       *  - `unknown`   no usable id at all (a corrupted stored value).
       *
       * An empty library is the normal result of "every subscription was removed" or "the library
       * drive is away", so a stored catalogue id in that state is waiting for confirmation, never a
       * wallpaper that may be started on the strength of a remembered id.
       */
      const selectionState = () => {
        if (!isSceneId(settings.weScene)) return "unknown";
        const item = selectedItem();
        if (selectionIsSample()) {
          // The sample is decided by its own file, as the Host reports it, independently of the
          // bounded library: a sample whose file is gone must block its own start.
          return item && item.available === false ? "unusable" : "verified";
        }
        if (item) return item.available === false ? "unusable" : "verified";
        // The entry is not in the list this client has: only a successful read can call it missing.
        if (library.loaded && library.state === "ready") return "unusable";
        return "pending";
      };
      const selectionUsable = () => selectionState() === "verified";
      const selectionKnownUnusable = () => selectionState() === "unusable";
      const selectionPending = () => selectionState() === "pending";
      // Which scene the live run is really capturing. The host answer wins; the selection is never
      // presented as if the picture had already switched.
      const playingSceneId = () => (previewActive ? wallpaperStatus.host?.activeSceneId ?? null : null);
      const playingItem = () => {
        const id = playingSceneId();
        return id ? knownItems().find(item => item.id === id) ?? { id, title: id, playbackVerified: false } : null;
      };
      const libraryStatusText = () => {
        if (library.loading) return copy.sceneLoading;
        if (library.state === "unconfigured") return copy.sceneUnconfigured;
        if (library.state === "failed") return `${copy.sceneLoadFailed}：${library.error || ""}`;
        if (Array.isArray(library.rootWarnings) && library.rootWarnings.length) return copy.sceneRootMissing;
        if (library.loaded && library.items.length === 0) return copy.sceneEmpty;
        return "";
      };
      const libraryList = () => h("div", { className: "wm-wallpaper-list", key: "list", role: "radiogroup", "aria-label": copy.scene },
        knownItems().map(item => h("button", {
          type: "button", key: item.id, role: "radio",
          className: "wm-wallpaper-item" + (item.id === settings.weScene ? " is-selected" : ""),
          "aria-checked": item.id === settings.weScene, "aria-disabled": !item.available,
          "data-wm-scene-item": item.id, "data-wm-scene-available": String(item.available),
          title: sceneItemTitle(item),
          // An unavailable item stays visible and explainable but cannot become the selection.
          onClick: () => { if (item.available) update("weScene", item.id); }
        }, [
          h("span", { className: "wm-wallpaper-item-title", key: "title" }, item.title),
          h("span", { className: "wm-wallpaper-item-meta", key: "meta" }, [
            h("span", { className: "wm-wallpaper-item-type", key: "type" }, item.type === "scene" ? "scene" : item.type),
            item.playbackVerified
              ? h("span", { className: "wm-wallpaper-item-badge is-verified", key: "badge" }, copy.sceneVerified)
              : h("span", { className: "wm-wallpaper-item-badge", key: "badge" }, item.available ? copy.sceneExperimental : copy.sceneUnavailable),
            item.available ? null : h("span", { className: "wm-wallpaper-item-reason", key: "reason" }, sceneReasonText(item))
          ])
        ])));
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
          // The list is the field that describes the NEXT run: browsing, refreshing and selecting
          // never start, stop or switch anything.
          h("div", { className: "wm-inline-field wm-wallpaper-field wm-wallpaper-field-selection", key: "scene" }, [
            h("span", { className: "wm-inline-label", key: "label" }, copy.scene),
            h("div", { className: "wm-wallpaper-selection", key: "selection" }, [
              h("div", { className: "wm-wallpaper-selection-head", key: "head" }, [
                h("span", { className: "wm-wallpaper-selected", key: "selected", "data-wm-selected-scene": settings.weScene },
                  `${copy.selectedItem}：${selectedItem()?.title ?? settings.weScene}`),
                // Current picture and next selection are two separate statements.
                h("span", { className: "wm-wallpaper-playing", key: "playing", "data-wm-playing-scene": playingSceneId() ?? "" },
                  `${copy.playingItem}：${playingItem()?.title ?? copy.notPlaying}`),
                h("button", {
                  type: "button", className: "wm-wallpaper-refresh", key: "refresh",
                  "data-wm-action": "wallpaper-refresh", disabled: library.loading,
                  onClick: () => loadLibrary(true)
                }, library.loading ? copy.sceneRefreshing : copy.sceneRefresh)
              ]),
              libraryList(),
              libraryStatusText() ? h("p", { className: "wm-wallpaper-list-status", key: "status", role: "status" }, libraryStatusText()) : null,
              library.truncated ? h("p", { className: "wm-wallpaper-list-status", key: "truncated" }, copy.sceneTruncated) : null,
              // The selection survives a missing item, but the user is told instead of being
              // silently moved to another wallpaper.
              selectionKnownUnusable()
                ? h("p", { className: "wm-wallpaper-list-status is-warning", key: "unavailable" }, copy.selectedUnavailable)
                : null,
              // A stored catalogue id that no successful read has confirmed yet: that is "waiting",
              // not "deleted", and the start buttons stay disabled until it is confirmed.
              selectionPending()
                ? h("p", { className: "wm-wallpaper-list-status", key: "pending" }, copy.selectedPending)
                : null,
              // An unverified selection is experimental: it never starts by itself.
              selectedItem() && selectedItem().id !== "lucy" && selectedItem().available && settings.weAutoStart
                ? h("p", { className: "wm-wallpaper-list-status", key: "manual-only" }, copy.autoStartSkipped)
                : null
            ])
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
          // Start and restart need a selection the Host has confirmed usable: submitting an
          // unavailable one is refused anyway, and a restart would close a working picture first.
          h("button", { type: "button", className: "wm-settings-option wm-wallpaper-button", key: "start",
            "data-wm-action": "wallpaper-start", disabled: previewBusy || previewActive || cleanupFailed || !selectionUsable(),
            onClick: runPreview("start") }, copy.startPreview),
          h("button", { type: "button", className: "wm-settings-option wm-wallpaper-button", key: "restart",
            "data-wm-action": "wallpaper-restart", disabled: previewBusy || cleanupFailed || !selectionUsable(),
            onClick: runPreview("restart") }, copy.restartPreview),
          // Stop and retry-cleanup stay independent of the list: loading, a failed refresh or an
          // unusable selection must never take the stop control away.
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
      const wallpaperPresetsRow = () => {
        const targetResolution = controller.presets.resolveTarget();
        const targetId = targetResolution.ok ? targetResolution.targetId : null;
        const isPlaying = Boolean(targetResolution.ok && targetResolution.isPlaying);
        const targetItem = targetId ? (knownItems().find(item => item.id === targetId) ?? { id: targetId, title: targetId }) : null;
        const hasPreset = Boolean(targetId && presetsState.entries[targetId]);
        const usableInIdle = Boolean(targetResolution.ok && !isPlaying && selectionUsable());
        const canOperate = Boolean(targetResolution.ok && (isPlaying || usableInIdle));

        const canSave = canOperate;
        const canApply = canOperate && hasPreset;
        const canDelete = canOperate && hasPreset;

        let targetLine = "";
        let hintLine = presetActionError;

        if (targetResolution.ok) {
          const prefix = isPlaying ? copy.presetPlayingTarget : copy.presetSelectedTarget;
          const statusText = hasPreset ? copy.presetSaved : copy.presetEmpty;
          targetLine = `${prefix}：${targetItem?.title || targetId}（${statusText}）`;
          if (!hintLine) {
            if (!isPlaying) {
              if (selectionPending()) hintLine = copy.selectedPending;
              else if (selectionKnownUnusable()) hintLine = copy.selectedUnavailable;
              else hintLine = copy.presetHint;
            } else {
              hintLine = copy.presetHint;
            }
          }
        } else {
          if (targetResolution.error === "mismatch") {
            const activeTitle = (knownItems().find(i => i.id === targetResolution.activeId) ?? { title: targetResolution.activeId }).title;
            const selectedTitle = (knownItems().find(i => i.id === settings.weScene) ?? { title: settings.weScene }).title;
            targetLine = `${copy.presetPlayingTarget}：${activeTitle}（${copy.selectedItem}：${selectedTitle}）`;
            if (!hintLine) hintLine = copy.presetMismatch;
          } else if (targetResolution.error === "transition") {
            targetLine = `${copy.presetPlayingTarget}：…`;
            if (!hintLine) hintLine = copy.presetBusy;
          } else if (targetResolution.error === "cleanup-failed") {
            targetLine = `${copy.presetPlayingTarget}：…`;
            if (!hintLine) hintLine = copy.previewCleanupFailed;
          } else if (targetResolution.error === "error") {
            targetLine = "--";
            if (!hintLine) hintLine = copy.errorUnavailable;
          } else if (targetResolution.error === "scene-unconfirmed") {
            const selectedTitle = (knownItems().find(i => i.id === settings.weScene) ?? { title: settings.weScene }).title;
            targetLine = `${copy.presetSelectedTarget}：${selectedTitle}`;
            if (!hintLine) hintLine = copy.selectedPending;
          } else if (targetResolution.error === "scene-unavailable") {
            const selectedTitle = (knownItems().find(i => i.id === settings.weScene) ?? { title: settings.weScene }).title;
            targetLine = `${copy.presetSelectedTarget}：${selectedTitle}`;
            if (!hintLine) hintLine = copy.selectedUnavailable;
          } else {
            targetLine = "--";
            if (!hintLine) hintLine = copy.presetHint;
          }
        }

        return h("div", {
          className: "wm-settings-row wm-wallpaper-presets-row",
          key: "wallpaper-presets",
          "data-wm-presets-target": targetId || "",
          "data-wm-presets-has": String(hasPreset)
        }, [
          h("div", { className: "wm-settings-copy", key: "copy" }, [
            h("div", { className: "wm-settings-label", key: "label" }, copy.presetTitle),
            h("div", { className: "wm-wallpaper-preset-target", key: "target" }, targetLine),
            h("div", { className: "wm-settings-hint", key: "hint", role: "status", "aria-live": "polite" }, hintLine)
          ]),
          h("div", { className: "wm-wallpaper-preset-actions", key: "actions" }, [
            h("button", {
              type: "button",
              className: "wm-settings-reset wm-preset-button",
              key: "save",
              "data-wm-action": "preset-save",
              disabled: !canSave,
              onClick: () => {
                setPresetActionError("");
                const res = controller.presets.save();
                if (!res.ok) {
                  if (res.error === "storage-failed") setPresetActionError(copy.presetStorageError);
                  else if (res.error === "mismatch") setPresetActionError(copy.presetMismatch);
                  else if (res.error === "transition") setPresetActionError(copy.presetBusy);
                  else setPresetActionError(res.error);
                }
              }
            }, copy.presetSave),
            h("button", {
              type: "button",
              className: "wm-settings-reset wm-preset-button",
              key: "apply",
              "data-wm-action": "preset-apply",
              disabled: !canApply,
              onClick: () => {
                setPresetActionError("");
                const res = controller.presets.apply();
                if (res.ok) {
                  setSettings(controller.read());
                } else {
                  if (res.error === "mismatch") setPresetActionError(copy.presetMismatch);
                  else if (res.error === "transition") setPresetActionError(copy.presetBusy);
                  else setPresetActionError(res.error);
                }
              }
            }, copy.presetApply),
            h("button", {
              type: "button",
              className: "wm-settings-reset wm-preset-button",
              key: "delete",
              "data-wm-action": "preset-delete",
              disabled: !canDelete,
              onClick: () => {
                setPresetActionError("");
                const res = controller.presets.remove();
                if (!res.ok) {
                  if (res.error === "storage-failed") setPresetActionError(copy.presetStorageError);
                  else if (res.error === "mismatch") setPresetActionError(copy.presetMismatch);
                  else if (res.error === "transition") setPresetActionError(copy.presetBusy);
                  else setPresetActionError(res.error);
                }
              }
            }, copy.presetDelete)
          ])
        ]);
      };

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
        row("accentMode", copy.accentMode, copy.accentHint, ALLOWED_SETTINGS.accentMode),
        settings.accentMode === "custom" && customAccentRow(),
        row("canvas", copy.canvas, copy.canvasHint, ALLOWED_SETTINGS.canvas),
        row("sidebar", copy.sidebar, copy.sidebarHint, ALLOWED_SETTINGS.sidebar),
        row("glass", copy.glass, copy.glassHint, ALLOWED_SETTINGS.glass),
        h("h3", { className: "wm-settings-subtitle", key: "readability-title" }, copy.readabilityTitle),
        row("textContrast", copy.textContrast, settings.textContrast === "enhanced" ? copy.textContrastEnhancedHint : copy.textContrastStandardHint, ALLOWED_SETTINGS.textContrast),
        settings.background !== "none" && range("chatBackdrop"),
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
        settings.background === "wallpaper" && wallpaperPresetsRow(),
        // Which regions may cover the background. The preference is kept even when no background is
        // selected, so switching back finds the same choice; nothing changes while it is inactive.
        settings.background !== "none" && h("h3", {
          className: "wm-settings-subtitle", key: "region-title" }, copy.regionTitle),
        settings.background !== "none" && regionRow("opaqueSidebar"),
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

      body.${ACTIVE_CLASS}[data-wm-text-contrast="enhanced"] {
        --dsw-alias-label-primary: #0c263b !important;
        --dsw-alias-label-secondary: #3c566b !important;
        --dsw-alias-label-tertiary: #506b80 !important;
      }

      body.${ABYSS_ACTIVE_CLASS}[data-wm-text-contrast="enhanced"] {
        --dsw-alias-label-primary: #f2f5fc !important;
        --dsw-alias-label-secondary: #c0cada !important;
        --dsw-alias-label-tertiary: #a3afc2 !important;
      }
    `;

    const backdropSelector = `body:is(.${ACTIVE_CLASS}, .${ABYSS_ACTIVE_CLASS})[data-wm-backdrop][data-wm-canvas]`;
    const accentSelector = `body:is(.${ACTIVE_CLASS}, .${ABYSS_ACTIVE_CLASS})[data-wm-accent-mode="custom"]`;
    const accentPaletteSelector = `body:is(.${ACTIVE_CLASS}, .${ABYSS_ACTIVE_CLASS})[data-wm-palette][data-wm-accent-mode="custom"]`;
    const accentDeepSidebarSelector = `body:is(.${ACTIVE_CLASS}, .${ABYSS_ACTIVE_CLASS})[data-wm-palette][data-wm-sidebar][data-wm-accent-mode="custom"]`;
    const backdropCss = `
      ${accentSelector},
      ${accentPaletteSelector},
      ${accentDeepSidebarSelector} {
        --dsw-alias-button-primary-fill: var(--wm-custom-raw) !important;
        --dsw-alias-button-primary-hover: var(--wm-custom-btn-hover) !important;
        --dsw-alias-label-primary-foreground: var(--wm-custom-btn-fg) !important;
        --dsw-alias-brand-primary: var(--wm-custom-ink) !important;
        --dsw-alias-brand-primary-new-colorprimary-new-color: var(--wm-custom-ink) !important;
        --dsw-alias-link: var(--wm-custom-ink) !important;
        --dsw-alias-markdown-citation: var(--wm-custom-ink) !important;
        --dsw-alias-state-business-primary: var(--wm-custom-ink) !important;
        --dsw-alias-state-business-tertiary: var(--wm-custom-business-tertiary) !important;
        --dsw-alias-button-info-fill: var(--wm-custom-btn-info-fill) !important;
        --dsw-alias-button-info-hover: var(--wm-custom-btn-info-hover) !important;
        --dsw-alias-button-ghost-active-fill: var(--wm-custom-ghost-active-fill) !important;
        --dsw-alias-interactive-bg-primary: var(--wm-custom-interactive-primary) !important;
        --dsw-alias-interactive-bg-hover: var(--wm-custom-interactive-hover) !important;
        --dsw-alias-interactive-bg-active: var(--wm-custom-interactive-active) !important;
        --dsw-specific-sidebar-nav-item-active: var(--wm-custom-sidebar-nav-active) !important;
        --dsw-specific-sidebar-nav-item-active-accent: var(--wm-custom-ink) !important;
        --dsw-focus-ring-color: var(--wm-custom-ink) !important;
      }

      ${accentSelector} :focus-visible {
        outline: 2px solid var(--wm-custom-ink) !important;
        outline-offset: 2px !important;
      }

      ${accentSelector} .wm-session-status:not(.wm-session-status-waiting):not(.wm-session-status-complete) .wm-status-mark {
        background: var(--wm-custom-raw) !important;
        color: var(--wm-custom-btn-fg) !important;
      }

      ${accentSelector} .wm-session-status-running .wm-status-mark::after {
        border-color: var(--wm-custom-interactive-primary) !important;
      }

      ${accentSelector} .wm-settings-option.is-selected,
      ${accentPaletteSelector} .wm-settings-option.is-selected,
      ${accentDeepSidebarSelector} .wm-settings-option.is-selected {
        color: var(--dsw-alias-label-primary) !important;
        background: var(--wm-custom-interactive-active) !important;
      }

      .wm-accent-controls { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      .wm-accent-picker {
        width: 28px;
        height: 28px;
        padding: 0;
        border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.2));
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
      }
      .wm-accent-picker::-webkit-color-swatch-wrapper { padding: 2px; }
      .wm-accent-picker::-webkit-color-swatch { border: 0; border-radius: 4px; }
      .wm-accent-hex {
        font-family: var(--dsw-font-mono, monospace);
        font-size: 12px;
        color: var(--dsw-alias-label-secondary);
        user-select: all;
      }
      .wm-accent-preview {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-left: 4px;
      }
      .wm-accent-preview-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        padding: 2px 8px;
        border: 0;
        border-radius: 6px;
        font: inherit;
        font-size: 11px;
        font-weight: 500;
        cursor: default;
      }
      .wm-accent-preview-link {
        font-size: 12px;
        text-decoration: underline;
        cursor: default;
      }

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
        /* The host rounds this corner by 16px. An opaque chat must also cover its tip;
           otherwise the transparent frame exposes a wedge of wallpaper beside the sidebar. */
        border-top-left-radius: 0 !important;
      }
      ${backdropSelector}[data-wm-chat-tint] .BynINW_centerCol {
        background: rgb(var(--wm-base-rgb) / var(--wm-chat-alpha)) !important;
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
      html:has(${backdropSelector}) [data-wm-message-port] {
        position: static !important;
        margin-bottom: var(--wm-port-reserve) !important;
      }
      html:has(${backdropSelector}) [data-wm-message-port] [data-wm-history-clip] {
        clip-path: none !important;
      }
      html:has(${backdropSelector}) [data-wm-fixed-composer] {
        position: absolute !important;
        bottom: 0 !important;
        left: var(--wm-port-left) !important;
        right: auto !important;
        width: var(--wm-port-width) !important;
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
      /* The bounded wallpaper list. It gets its own width so it stays readable in a narrow panel,
         scrolls instead of stretching the settings area, and keeps the refresh control and the
         three actions visible while it scrolls. */
      .wm-wallpaper-field-selection {
        flex: 1 1 320px;
      }
      .wm-wallpaper-selection {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        max-width: 100%;
      }
      .wm-wallpaper-selection-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 10px;
        min-width: 0;
      }
      .wm-wallpaper-selected,
      .wm-wallpaper-playing {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        line-height: 18px;
        color: var(--dsw-alias-label-secondary);
      }
      .wm-wallpaper-playing {
        color: var(--dsw-alias-label-primary);
      }
      .wm-wallpaper-refresh {
        margin-left: auto;
        flex: 0 0 auto;
        min-height: 26px;
        padding: 0 10px;
        font-size: 12px;
        line-height: 18px;
        border-radius: 6px;
        background: rgb(var(--wm-layer2-rgb)) !important;
        border: 1px solid var(--dsw-alias-border-l2) !important;
        color: var(--dsw-alias-label-primary);
      }
      .wm-wallpaper-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 168px;
        overflow-y: auto;
        padding: 4px;
        border-radius: 8px;
        background: rgb(var(--wm-layer1-rgb) / 0.6);
        border: 1px solid var(--dsw-alias-border-l2);
      }
      .wm-wallpaper-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
        padding: 6px 8px;
        text-align: left;
        border-radius: 6px;
        background: transparent;
        border: 1px solid transparent;
        color: var(--dsw-alias-label-primary);
      }
      .wm-wallpaper-item:hover:not([aria-disabled="true"]) {
        background: rgb(var(--wm-layer2-rgb)) !important;
      }
      .wm-wallpaper-item.is-selected {
        border-color: var(--dsw-alias-brand-primary) !important;
        background: rgb(var(--wm-layer2-rgb)) !important;
      }
      /* An unavailable item stays readable and explainable; it is visibly inert, not hidden. */
      .wm-wallpaper-item[aria-disabled="true"] {
        opacity: 0.62;
        cursor: not-allowed;
      }
      .wm-wallpaper-item-title {
        font-size: 13px;
        line-height: 18px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wm-wallpaper-item-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
        font-size: 11px;
        line-height: 16px;
        color: var(--dsw-alias-label-secondary);
      }
      .wm-wallpaper-item-badge.is-verified {
        color: var(--dsw-alias-state-success-primary, #64cda2);
      }
      .wm-wallpaper-list-status {
        margin: 0;
        font-size: 12px;
        line-height: 17px;
        color: var(--dsw-alias-label-secondary);
      }
      .wm-wallpaper-list-status.is-warning {
        color: var(--dsw-alias-state-warn-primary, #e3a85d);
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
      .wm-wallpaper-presets-row { align-items: flex-start; }
      .wm-wallpaper-preset-target { font-size: 12px; color: var(--dsw-alias-label-primary); margin-top: 2px; font-weight: 500; }
      .wm-wallpaper-preset-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      .wm-preset-button { white-space: nowrap; }
      @media (max-width: 720px) {
        .wm-settings-segment { flex-wrap: wrap; }
        .wm-range-control { width: 100%; }
        .wm-range-control input { flex: 1; min-width: 0; }
        .wm-wallpaper-preset-actions { width: 100%; justify-content: flex-start; }
      }
    `;

    const DETACHABLE_MODES = Object.freeze({
      DOCKED: 'docked',
      DETACHING: 'detaching',
      DETACHED: 'detached',
      DOCKING: 'docking',
    });

    const DETACHABLE_ACTIONS = Object.freeze({
      SET_SETTING: 'set-setting',
      RESET_SETTINGS: 'reset-settings',
      SAVE_PRESET: 'save-preset',
      APPLY_PRESET: 'apply-preset',
      REMOVE_PRESET: 'remove-preset',
      REQUEST_DOCK: 'request-dock',
      CLOSE_WINDOW: 'close-window',
      START_WALLPAPER: 'start-wallpaper',
      STOP_WALLPAPER: 'stop-wallpaper',
      REFRESH_CATALOG: 'refresh-catalog',
    });

    const DETACHABLE_RANGE_BOUNDS = Object.freeze({
      brightness: Object.freeze({ min: 20, max: 120 }),
      mask: Object.freeze({ min: 0, max: 90 }),
      blur: Object.freeze({ min: 0, max: 24 }),
      surface: Object.freeze({ min: 40, max: 100 }),
      chatBackdrop: Object.freeze({ min: 0, max: 100 }),
    });

    function buildAppearanceSnapshot(controller, revision = 1) {
      const currentSettings = controller.read ? controller.read() : controller.getSettingsSnapshot?.() || {};
      const presets = controller.presets?.getSnapshot ? controller.presets.getSnapshot() : { version: 1, entries: {} };
      const wp = controller.wallpaper?.getStatus ? controller.wallpaper.getStatus() : null;
      const presetTarget = controller.presets?.resolveTarget
        ? Object.freeze({ ...controller.presets.resolveTarget() })
        : null;

      const catalogSource = (typeof controller.wallpaper?.getLibrarySnapshot === 'function'
        ? controller.wallpaper.getLibrarySnapshot()
        : controller.catalog) || { items: [], state: 'idle', loaded: false, loading: false, truncated: false, error: null, scannedAt: null, rootWarnings: [] };

      const rawItems = Array.isArray(catalogSource.items) ? [...catalogSource.items] : [];
      if (catalogSource.state !== 'failed' && !rawItems.some(item => item.id === 'lucy')) {
        const verified = Array.isArray(wp?.host?.scenes) ? wp.host.scenes.find(scene => scene.id === 'lucy') : null;
        rawItems.unshift({
          id: 'lucy',
          title: 'Lucy',
          type: 'scene',
          available: verified ? verified.available !== false : true,
          playbackVerified: true,
          reason: null,
          warnings: [],
          previewRef: { wallpaperId: 'lucy', kind: 'preview' },
        });
      }

      const catalog = Object.freeze({
        items: Object.freeze(rawItems),
        state: catalogSource.state || 'idle',
        loaded: Boolean(catalogSource.loaded),
        loading: Boolean(catalogSource.loading),
        truncated: Boolean(catalogSource.truncated),
        error: catalogSource.error || null,
        scannedAt: catalogSource.scannedAt || null,
        rootWarnings: Array.isArray(catalogSource.rootWarnings) ? catalogSource.rootWarnings : [],
      });

      return Object.freeze({
        protocolVersion: 1,
        revision,
        settings: Object.freeze({ ...currentSettings }),
        presets,
        presetTarget,
        catalog,
        wallpaper: Object.freeze({
          state: wp?.state ?? 'idle',
          activeSceneId: wp?.activeSceneId ?? wp?.host?.activeSceneId ?? null,
          cleanupPending: Boolean(wp?.cleanupPending),
        }),
      });
    }

    function validateDetachableAction(action) {
      if (!action || typeof action !== 'object' || Array.isArray(action)) {
        return { valid: false, error: 'action-invalid-object' };
      }
      if (!Object.values(DETACHABLE_ACTIONS).includes(action.type)) {
        return { valid: false, error: 'action-unsupported-type' };
      }
      if (!action.clientActionId || typeof action.clientActionId !== 'string') {
        return { valid: false, error: 'action-missing-client-id' };
      }
      if (!Number.isInteger(action.expectedRevision) || action.expectedRevision <= 0) {
        return { valid: false, error: 'action-invalid-expected-revision' };
      }
      if (action.type === DETACHABLE_ACTIONS.SET_SETTING) {
        if (!isValidSetting(action.key, action.value)) {
          return { valid: false, error: 'setting-key-disallowed', key: action.key };
        }
        if (Object.hasOwn(DETACHABLE_RANGE_BOUNDS, action.key)) {
          if (typeof action.value !== 'number' || !Number.isFinite(action.value)) {
            return { valid: false, error: 'setting-value-not-numeric', key: action.key };
          }
          const bounds = DETACHABLE_RANGE_BOUNDS[action.key];
          if (action.value < bounds.min || action.value > bounds.max) {
            return { valid: false, error: 'setting-value-out-of-bounds', key: action.key, min: bounds.min, max: bounds.max };
          }
        }
      } else if (
        action.type === DETACHABLE_ACTIONS.SAVE_PRESET ||
        action.type === DETACHABLE_ACTIONS.APPLY_PRESET ||
        action.type === DETACHABLE_ACTIONS.REMOVE_PRESET
      ) {
        if (!isSceneId(action.sceneId)) {
          return { valid: false, error: 'preset-scene-invalid', sceneId: action.sceneId };
        }
      } else if (action.type === DETACHABLE_ACTIONS.START_WALLPAPER) {
        if (!isSceneId(action.sceneId)) {
          return { valid: false, error: 'wallpaper-scene-invalid', sceneId: action.sceneId };
        }
        if (action.mode !== undefined && !['preview', 'daily'].includes(action.mode)) {
          return { valid: false, error: 'wallpaper-mode-invalid', mode: action.mode };
        }
      }
      return { valid: true };
    }

    async function executeAuthoritativeAction({
      controller,
      action,
      expectedRevisionCheck = true,
      currentRevision = 1,
      actionCache = null,
      onRequestDock = null,
      getSnapshot = null,
    }) {
      const val = validateDetachableAction(action);
      if (!val.valid) {
        return {
          ok: false,
          error: val.error,
          snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined,
        };
      }

      const fingerprint = JSON.stringify({
        type: action.type,
        clientActionId: action.clientActionId,
        expectedRevision: action.expectedRevision,
        key: action.key,
        value: action.value,
        sceneId: action.sceneId,
        mode: action.mode,
      });

      if (actionCache && actionCache.has(action.clientActionId)) {
        const cached = actionCache.get(action.clientActionId);
        if (cached.fingerprint !== fingerprint) {
          return {
            ok: false,
            error: 'action-payload-mismatch',
            clientActionId: action.clientActionId,
            snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined,
          };
        }
        return { ...cached.result, duplicate: true, snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined };
      }

      if (expectedRevisionCheck && action.expectedRevision !== currentRevision) {
        return {
          ok: false,
          error: 'stale-revision',
          expectedRevision: action.expectedRevision,
          latestRevision: currentRevision,
          snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined,
        };
      }

      let executionResult = null;
      try {
        if (action.type === DETACHABLE_ACTIONS.SET_SETTING) {
          const res = controller.set(action.key, action.value);
          if (!res || typeof res !== 'object') {
            executionResult = { ok: false, error: 'set-setting-rejected' };
          } else {
            executionResult = { ok: true };
          }
        } else if (action.type === DETACHABLE_ACTIONS.RESET_SETTINGS) {
          controller.reset?.();
          executionResult = { ok: true };
        } else if (
          action.type === DETACHABLE_ACTIONS.SAVE_PRESET ||
          action.type === DETACHABLE_ACTIONS.APPLY_PRESET ||
          action.type === DETACHABLE_ACTIONS.REMOVE_PRESET
        ) {
          const op =
            action.type === DETACHABLE_ACTIONS.SAVE_PRESET
              ? 'save'
              : action.type === DETACHABLE_ACTIONS.APPLY_PRESET
              ? 'apply'
              : 'remove';
          const fn = controller.presets?.[op];
          if (typeof fn !== 'function') {
            executionResult = { ok: false, error: `preset-op-unsupported: ${op}` };
          } else {
            const res = fn(action.sceneId, action.name);
            if (res && typeof res === 'object' && res.ok === false) {
              executionResult = { ok: false, error: res.error || 'preset-op-failed', details: res };
            } else {
              executionResult = { ok: true, result: res };
            }
          }
        } else if (action.type === DETACHABLE_ACTIONS.START_WALLPAPER) {
          const currentSettings = typeof controller.read === 'function'
            ? controller.read()
            : (typeof controller.getSettingsSnapshot === 'function' ? controller.getSettingsSnapshot() : null);
          const currentSelectedScene = currentSettings?.weScene || 'lucy';
          const currentMode = action.mode || currentSettings?.weMode || 'daily';

          const wp = controller.wallpaper?.getStatus ? controller.wallpaper.getStatus() : null;
          const wpState = wp?.state ?? 'idle';
          const cleanupPending = Boolean(wp?.cleanupPending);
          const activeSceneId = wp?.activeSceneId ?? wp?.host?.activeSceneId ?? null;

          if (action.sceneId !== currentSelectedScene) {
            executionResult = {
              ok: false,
              error: 'target-drift-or-mismatch',
              selectedSceneId: currentSelectedScene,
              requestedSceneId: action.sceneId,
            };
          } else if (!['idle', 'stopped', 'error'].includes(wpState) || cleanupPending || wpState === 'cleanup-failed' || activeSceneId != null) {
            executionResult = { ok: false, error: 'playback-active-or-transitioning', state: wpState, activeSceneId };
          } else {
            const catalog = controller.wallpaper?.getLibrarySnapshot ? controller.wallpaper.getLibrarySnapshot() : null;
            const catalogReady = catalog?.state === 'ready' && catalog?.loaded === true;
            if (!catalogReady) {
              executionResult = { ok: false, error: 'catalog-not-ready', state: catalog?.state || 'unloaded' };
            } else {
              const items = Array.isArray(catalog?.items) ? catalog.items : [];
              const isLucy = action.sceneId === 'lucy';
              const catalogItem = items.find(item => item.id === action.sceneId);

              const lucyHostScene = Array.isArray(wp?.host?.scenes) ? wp.host.scenes.find(s => s.id === 'lucy') : null;
              const lucyAvailable = lucyHostScene ? lucyHostScene.available !== false : true;

              if (isLucy && !lucyAvailable) {
                executionResult = { ok: false, error: 'scene-unavailable', sceneId: 'lucy', reason: 'sample_unavailable' };
              } else if (!isLucy && (!catalogItem || catalogItem.available !== true || !['scene', 'video'].includes(catalogItem.type))) {
                executionResult = {
                  ok: false,
                  error: 'scene-unavailable',
                  sceneId: action.sceneId,
                  reason: catalogItem?.reason || 'not_available',
                };
              } else if (typeof controller.wallpaper?.start === 'function') {
                try {
                  const startRes = await controller.wallpaper.start(action.sceneId, currentMode);
                  if (!startRes || startRes.ok === false || startRes.state === 'error' || startRes.state === 'cleanup-failed') {
                    executionResult = {
                      ok: false,
                      error: startRes?.error || `start-failed: ${startRes?.state || 'error'}`,
                      state: startRes?.state || 'error',
                      result: startRes,
                    };
                  } else {
                    executionResult = { ok: true, activeSceneId: action.sceneId, result: startRes };
                  }
                } catch (err) {
                  executionResult = { ok: false, error: `start-failed: ${err.message}` };
                }
              } else {
                executionResult = { ok: false, error: 'wallpaper-controller-unavailable' };
              }
            }
          }
        } else if (action.type === DETACHABLE_ACTIONS.STOP_WALLPAPER) {
          if (typeof controller.wallpaper?.stop === 'function') {
            try {
              const stopRes = await controller.wallpaper.stop('user');
              if (!stopRes || stopRes.ok === false || stopRes.state === 'cleanup-failed' || stopRes.state === 'error') {
                executionResult = {
                  ok: false,
                  error: stopRes?.error || `stop-failed: ${stopRes?.state || 'error'}`,
                  state: stopRes?.state || 'error',
                  result: stopRes,
                };
              } else {
                executionResult = { ok: true, result: stopRes };
              }
            } catch (err) {
              executionResult = { ok: false, error: `stop-failed: ${err.message}` };
            }
          } else {
            executionResult = { ok: false, error: 'wallpaper-controller-unavailable' };
          }
        } else if (action.type === DETACHABLE_ACTIONS.REFRESH_CATALOG) {
          if (typeof controller.wallpaper?.readLibrary === 'function') {
            try {
              const libRes = await controller.wallpaper.readLibrary({ refresh: true });
              if (!libRes || libRes.ok === false || libRes.state === 'failed') {
                executionResult = {
                  ok: false,
                  error: libRes?.error || 'refresh-failed',
                  state: libRes?.state || 'failed',
                  result: libRes,
                };
              } else {
                executionResult = { ok: true, result: libRes };
              }
            } catch (err) {
              executionResult = { ok: false, error: `refresh-failed: ${err.message}` };
            }
          } else {
            executionResult = { ok: false, error: 'wallpaper-controller-unavailable' };
          }
        } else if (
          action.type === DETACHABLE_ACTIONS.REQUEST_DOCK ||
          action.type === DETACHABLE_ACTIONS.CLOSE_WINDOW
        ) {
          if (typeof onRequestDock === 'function') {
            const dockRes = await onRequestDock();
            if (!dockRes || !dockRes.ok) {
              executionResult = { ok: false, error: dockRes?.error || 'dock-failed' };
            } else {
              executionResult = { ok: true, mode: DETACHABLE_MODES.DOCKED };
            }
          } else {
            executionResult = { ok: false, error: 'dock-handler-unavailable' };
          }
        } else {
          executionResult = { ok: false, error: 'action-unsupported-type' };
        }
      } catch (err) {
        executionResult = { ok: false, error: `controller-error: ${err.message}` };
      }

      if (actionCache && executionResult != null) {
        actionCache.set(action.clientActionId, {
          fingerprint,
          result: executionResult,
        });
        if (actionCache.size > 200) {
          const oldest = actionCache.keys().next().value;
          actionCache.delete(oldest);
        }
      }

      return { ...executionResult, snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined };
    }

    function createMainRendererBridgeClient({ baseUrl, instanceId, mainToken, controller }) {
      let mode = DETACHABLE_MODES.DOCKED;
      let unconfirmedCleanup = false;
      let lastCleanupError = null;
      let revision = 1;
      let currentGeneration = 1;
      let activeToken = null;
      let sseAbort = null;
      let disposed = false;
      const subscribers = new Set();
      const actionCache = new Map();

      const getSnapshot = () => buildAppearanceSnapshot(controller, revision);

      function notify() {
        const snap = getSnapshot();
        for (const sub of subscribers) {
          try {
            sub({
              snapshot: snap,
              mode,
              revision,
              generation: currentGeneration,
              unconfirmedCleanup,
              lastError: lastCleanupError,
            });
          } catch {}
        }
      }

      const pushSnapshotToHost = async () => {
        if (disposed) return;
        try {
          await fetch(`${baseUrl}/api/main/snapshot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Whale-Main-Token': mainToken,
              'X-Whale-Generation': String(currentGeneration),
            },
            body: JSON.stringify({ snapshot: getSnapshot(), revision, instanceId, generation: currentGeneration }),
          });
        } catch {}
      };

      const unsubSettings = controller.subscribeSettings?.(() => {
        revision++;
        notify();
        pushSnapshotToHost();
      });

      const unsubPresets = controller.presets?.subscribe?.(() => {
        revision++;
        notify();
        pushSnapshotToHost();
      });

      const unsubWallpaper = controller.wallpaper?.subscribeStatus?.(() => {
        revision++;
        notify();
        pushSnapshotToHost();
      });

      const unsubLibrary = controller.wallpaper?.subscribeLibrary?.(() => {
        revision++;
        notify();
        pushSnapshotToHost();
      });

      const handlePageUnload = () => {
        try {
          const url = `${baseUrl}/api/main/disconnect?mainToken=${encodeURIComponent(mainToken)}&instanceId=${encodeURIComponent(instanceId)}&generation=${encodeURIComponent(currentGeneration)}`;
          if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            navigator.sendBeacon(url);
          } else {
            fetch(url, {
              method: 'POST',
              mode: 'no-cors',
              keepalive: true,
            }).catch(() => {});
          }
        } catch {}
      };

      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('pagehide', handlePageUnload);
        window.addEventListener('beforeunload', handlePageUnload);
      }

      async function connect() {
        const res = await fetch(`${baseUrl}/api/main/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceId, mainToken, snapshot: getSnapshot() }),
        });
        const data = await res.json();
        if (!data.ok) return data;

        currentGeneration = data.generation ?? 1;
        sseAbort = new AbortController();
        startActionStream().catch(() => {});
        return data;
      }

      async function startActionStream() {
        try {
          const res = await fetch(
            `${baseUrl}/api/main/actions?instanceId=${encodeURIComponent(instanceId)}&mainToken=${encodeURIComponent(mainToken)}&generation=${encodeURIComponent(currentGeneration)}`,
            {
              headers: {
                'Accept': 'text/event-stream',
                'X-Whale-Generation': String(currentGeneration),
              },
              signal: sseAbort.signal,
            }
          );
          if (!res.ok || !res.body?.getReader) return;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!disposed) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split('\n\n');
            buffer = blocks.pop() || '';
            for (const block of blocks) {
              if (!block.trim() || block.startsWith(':')) continue;
              let eventName = 'action';
              let eventData = '';
              for (const line of block.split('\n')) {
                if (line.startsWith('event:')) eventName = line.slice(6).trim();
                else if (line.startsWith('data:')) eventData = line.slice(5).trim();
              }
              if (eventName === 'action') {
                let parsed;
                try {
                  parsed = JSON.parse(eventData);
                } catch {
                  continue;
                }
                const { action, clientActionId } = parsed;
                let result;
                try {
                  result = await executeAuthoritativeAction({
                    controller,
                    action,
                    expectedRevisionCheck: true,
                    currentRevision: revision,
                    actionCache,
                    onRequestDock: async () => {
                      return await requestDock();
                    },
                    getSnapshot,
                  });
                } catch (err) {
                  result = { ok: false, error: `execution-error: ${err.message}`, snapshot: getSnapshot() };
                }

                try {
                  await fetch(`${baseUrl}/api/main/action-result`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Whale-Main-Token': mainToken,
                      'X-Whale-Generation': String(currentGeneration),
                    },
                    body: JSON.stringify({ clientActionId, result, instanceId, generation: currentGeneration }),
                  });
                } catch {}
              } else if (eventName === 'window-state') {
                let state;
                try {
                  state = JSON.parse(eventData);
                } catch {
                  continue;
                }
                if (state.generation != null && state.generation !== currentGeneration) {
                  continue;
                }
                if (state.mode) {
                  mode = state.mode;
                }
                unconfirmedCleanup = Boolean(state.unconfirmedCleanup);
                lastCleanupError = state.lastError || null;
                if (mode === DETACHABLE_MODES.DOCKED && !unconfirmedCleanup) {
                  activeToken = null;
                }
                notify();
              } else if (eventName === 'dock') {
                if (!unconfirmedCleanup) {
                  mode = DETACHABLE_MODES.DOCKED;
                  activeToken = null;
                  notify();
                }
              }
            }
          }
        } catch {}
      }

      async function requestDetach() {
        const res = await fetch(`${baseUrl}/api/main/detach`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Whale-Main-Token': mainToken,
            'X-Whale-Generation': String(currentGeneration),
          },
          body: JSON.stringify({ instanceId, generation: currentGeneration }),
        });
        const data = await res.json();
        if (data.ok) {
          mode = data.mode || DETACHABLE_MODES.DETACHED;
          activeToken = data.token;
          notify();
        }
        return data;
      }

      async function requestDock() {
        const res = await fetch(`${baseUrl}/api/main/dock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Whale-Main-Token': mainToken,
            'X-Whale-Generation': String(currentGeneration),
          },
          body: JSON.stringify({ instanceId, generation: currentGeneration }),
        });
        const data = await res.json();
        if (data.ok) {
          mode = DETACHABLE_MODES.DOCKED;
          unconfirmedCleanup = false;
          lastCleanupError = null;
          activeToken = null;
          notify();
        } else {
          if (data.mode) mode = data.mode;
          unconfirmedCleanup = Boolean(data.unconfirmedCleanup);
          lastCleanupError = data.error || null;
          notify();
        }
        return data;
      }

      async function dispose() {
        if (disposed) return { ok: true };
        disposed = true;
        if (typeof window !== 'undefined' && window.removeEventListener) {
          window.removeEventListener('pagehide', handlePageUnload);
          window.removeEventListener('beforeunload', handlePageUnload);
        }
        try { sseAbort?.abort(); } catch {}
        try { unsubSettings?.(); } catch {}
        try { unsubPresets?.(); } catch {}
        try { unsubWallpaper?.(); } catch {}
        try { unsubLibrary?.(); } catch {}
        subscribers.clear();
        let res = { ok: true };
        try {
          const resp = await fetch(
            `${baseUrl}/api/main/disconnect?mainToken=${encodeURIComponent(mainToken)}&instanceId=${encodeURIComponent(instanceId)}&generation=${encodeURIComponent(currentGeneration)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Whale-Main-Token': mainToken,
                'X-Whale-Generation': String(currentGeneration),
              },
              body: JSON.stringify({ instanceId, generation: currentGeneration }),
            }
          );
          res = await resp.json();
        } catch {}
        mode = DETACHABLE_MODES.DOCKED;
        activeToken = null;
        notify();
        return res;
      }

      async function fetchPreviewBlob(sceneId, { signal } = {}) {
        if (disposed) throw new Error('bridge-disposed');
        if (!baseUrl || !mainToken) throw new Error('bridge-not-connected');
        if (!sceneId) throw new Error('invalid-scene-id');

        const url = `${baseUrl}/api/wallpaper-preview?id=${encodeURIComponent(sceneId)}`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Whale-Main-Token': mainToken,
            'X-Whale-Instance-Id': instanceId,
            'X-Whale-Generation': String(currentGeneration),
          },
          signal,
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          throw new Error(`preview-fetch-failed: ${resp.status} ${errText}`);
        }

        return await resp.blob();
      }

      return {
        get instanceId() { return instanceId; },
        get revision() { return revision; },
        get generation() { return currentGeneration; },
        connect,
        getSnapshot,
        getMode: () => mode,
        hasUnconfirmedCleanup: () => unconfirmedCleanup,
        getLastError: () => lastCleanupError,
        requestDetach,
        requestDock,
        fetchPreviewBlob,
        dispose,
        subscribe(listener) {
          subscribers.add(listener);
          return () => subscribers.delete(listener);
        },
      };
    }

    function WhaleHeaderAppearanceTrigger({ appearanceBridge }) {
      const h = React.createElement;
      const bridgeState = React.useSyncExternalStore(
        appearanceBridge.subscribe,
        appearanceBridge.getSnapshot,
        appearanceBridge.getSnapshot
      );
      const isOpen = bridgeState.isOpen;
      const isDetached = bridgeState.mode === DETACHABLE_MODES.DETACHED;

      return h('button', {
        type: 'button',
        id: 'whale-appearance-header-btn',
        className: 'dsw-btn dsw-header-action-btn' + (isOpen ? ' active' : ''),
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: '500',
          borderRadius: '6px',
          border: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.2))',
          background: isOpen ? 'var(--dsw-alias-brand-primary, #8c72f2)' : 'transparent',
          color: isOpen ? '#ffffff' : 'var(--dsw-alias-text-primary, #e6edf8)',
          cursor: 'pointer',
          lineHeight: '1.2',
          userSelect: 'none',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        },
        title: isDetached ? '外观设置（已在独立窗口打开）' : '切换外观面板',
        onClick: () => {
          appearanceBridge.togglePanel();
        },
      }, [
        h('span', { key: 'badge', style: { fontWeight: '700', fontSize: '11px', opacity: '0.85' } }, 'Whale'),
        h('span', { key: 'label' }, isDetached ? '独立窗口' : '外观'),
      ]);
    }

    function DockedPreviewImage({ sceneId, appearanceBridge, alt, style }) {
      const h = React.createElement;
      const [blobUrl, setBlobUrl] = React.useState(null);
      const [failed, setFailed] = React.useState(false);

      React.useEffect(() => {
        if (!sceneId || !appearanceBridge?.fetchPreviewBlob) {
          setBlobUrl(null);
          setFailed(true);
          return;
        }

        let active = true;
        let createdUrl = null;
        const abortCtrl = new AbortController();

        appearanceBridge.fetchPreviewBlob(sceneId, { signal: abortCtrl.signal })
          .then((blob) => {
            if (!active) return;
            createdUrl = URL.createObjectURL(blob);
            setBlobUrl(createdUrl);
            setFailed(false);
          })
          .catch(() => {
            if (active) {
              setBlobUrl(null);
              setFailed(true);
            }
          });

        return () => {
          active = false;
          try { abortCtrl.abort(); } catch {}
          if (createdUrl) {
            try { URL.revokeObjectURL(createdUrl); } catch {}
          }
        };
      }, [sceneId, appearanceBridge]);

      if (failed || !blobUrl) {
        return h('div', {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
            opacity: 0.6,
          },
        }, '🖼');
      }

      return h('img', {
        src: blobUrl,
        alt: alt || sceneId,
        style,
        onError: () => setFailed(true),
      });
    }

    function WhaleDockedAppearancePanel({ appearanceBridge, controller }) {
      const h = React.createElement;
      const bridgeState = React.useSyncExternalStore(
        appearanceBridge.subscribe,
        appearanceBridge.getSnapshot,
        appearanceBridge.getSnapshot
      );
      const settings = React.useSyncExternalStore(
        controller.subscribeSettings,
        controller.getSettingsSnapshot,
        controller.getSettingsSnapshot
      );
      const presetsState = React.useSyncExternalStore(
        controller.presets?.subscribe ?? (() => () => {}),
        controller.presets?.getSnapshot ?? (() => ({ version: 1, entries: {} })),
        controller.presets?.getSnapshot ?? (() => ({ version: 1, entries: {} }))
      );

      const [inFlightDetach, setInFlightDetach] = React.useState(false);
      const [actionError, setActionError] = React.useState('');

      if (!bridgeState.isOpen) {
        return null;
      }

      const isDetached = bridgeState.mode === DETACHABLE_MODES.DETACHED;
      const isDetaching = bridgeState.mode === DETACHABLE_MODES.DETACHING;
      const unconfirmedCleanup = bridgeState.unconfirmedCleanup;

      // Age ratings filter handling
      const rawAgeRatings = settings.weAgeRatings;
      const parseAgeRatingsLocal = (val) => {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === '') return [];
          const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
          if (parts.length === 0 || !parts.every(p => ['Everyone', 'Questionable', 'Mature'].includes(p))) {
            return ['Everyone'];
          }
          const unique = [...new Set(parts)].sort((a, b) => ['Everyone', 'Questionable', 'Mature'].indexOf(a) - ['Everyone', 'Questionable', 'Mature'].indexOf(b));
          return unique;
        }
        return ['Everyone'];
      };
      const allowedRatings = parseAgeRatingsLocal(rawAgeRatings);

      const handleToggleRating = (rating) => {
        let next;
        if (allowedRatings.includes(rating)) {
          next = allowedRatings.filter(r => r !== rating);
        } else {
          next = [...allowedRatings, rating];
        }
        next.sort((a, b) => ['Everyone', 'Questionable', 'Mature'].indexOf(a) - ['Everyone', 'Questionable', 'Mature'].indexOf(b));
        controller.set('weAgeRatings', next.join(','));
      };

      // Catalog & Wallpaper extraction
      const catalog = bridgeState.snapshot?.catalog || bridgeState.catalog || (controller.wallpaper?.getLibrarySnapshot ? controller.wallpaper.getLibrarySnapshot() : null) || { items: [] };
      const wp = bridgeState.snapshot?.wallpaper || bridgeState.wallpaper || (controller.wallpaper?.getStatus ? controller.wallpaper.getStatus() : null) || {};
      const selectedSceneId = settings.weScene || 'lucy';
      const activeSceneId = isSceneId(wp.activeSceneId) ? wp.activeSceneId : (isSceneId(wp.host && wp.host.activeSceneId) ? wp.host.activeSceneId : null);
      const wpState = wp.state || 'idle';
      const cleanupPending = Boolean(wp.cleanupPending);

      const rawItems = Array.isArray(catalog.items) ? catalog.items.map(i => ({
        ...i,
        contentRating: ['Everyone', 'Questionable', 'Mature'].includes(i.contentRating) ? i.contentRating : (i.id === 'lucy' ? 'Everyone' : 'unknown'),
      })) : [];
      if (catalog.state !== 'failed' && !rawItems.some(item => item.id === 'lucy')) {
        const verified = Array.isArray(wp?.host?.scenes) ? wp.host.scenes.find(scene => scene.id === 'lucy') : null;
        rawItems.unshift({
          id: 'lucy',
          title: 'Lucy',
          type: 'scene',
          contentRating: 'Everyone',
          available: verified ? verified.available !== false : true,
          playbackVerified: true,
          previewRef: { wallpaperId: 'lucy', kind: 'preview' },
        });
      }

      const visibleItems = rawItems.filter(item => allowedRatings.includes(item.contentRating));

      const selectedItem = rawItems.find(i => i.id === selectedSceneId) || {
        id: selectedSceneId,
        title: selectedSceneId,
        type: 'unknown',
        contentRating: selectedSceneId === 'lucy' ? 'Everyone' : 'unknown',
        available: false,
        playbackVerified: false,
        reason: 'unknown_wallpaper',
      };

      const isSelectedHidden = !allowedRatings.includes(selectedItem.contentRating);
      const isBusy = wpState === 'starting' || wpState === 'stopping' || cleanupPending;
      const isCurrentlyPlaying = wpState === 'playing';
      const isMismatch = isCurrentlyPlaying && activeSceneId !== selectedSceneId;
      const isLucy = selectedSceneId === 'lucy';
      const catalogReady = catalog?.state === 'ready' && catalog?.loaded === true;
      const STARTABLE_STATES = ['idle', 'stopped', 'error'];
      const isStartableState = STARTABLE_STATES.includes(wpState) && !cleanupPending && wpState !== 'cleanup-failed' && activeSceneId == null;
      const canStartWp = !isDetached && isStartableState && !isSelectedHidden && catalogReady && (isLucy ? selectedItem.available !== false : (selectedItem.available === true && ['scene', 'video'].includes(selectedItem.type))) && !isMismatch;
      const canStopWp = !isDetached && (isCurrentlyPlaying || wpState === 'starting' || wpState === 'cleanup-failed');

      // Settings extraction
      const brightnessVal = settings.brightness ?? 70;
      const maskVal = settings.mask ?? 45;
      const blurVal = settings.blur ?? 0;
      const surfaceVal = settings.surface ?? 82;
      const chatBackdropVal = settings.chatBackdrop ?? 0;
      const themeVal = settings.theme ?? 'abyss';
      const paletteVal = settings.palette ?? 'ocean';
      const contrastVal = settings.textContrast ?? 'standard';
      const accentModeVal = settings.accentMode ?? 'theme';
      const accentColorVal = settings.accentColor ?? '#8c72f2';

      // Preset target resolution & gating
      const targetResolution = controller.presets?.resolveTarget ? controller.presets.resolveTarget() : { ok: false, error: 'unavailable' };
      const targetId = targetResolution.ok ? targetResolution.targetId : null;
      const isPlaying = Boolean(targetResolution.ok && targetResolution.isPlaying);
      const presetsEntries = presetsState?.entries || {};
      const hasPreset = Boolean(targetId && presetsEntries[targetId]);
      const canOperate = Boolean(targetResolution.ok && !isDetached);
      const canSave = canOperate;
      const canApply = canOperate && hasPreset;
      const canDelete = canOperate && hasPreset;

      let targetLine = '';
      if (targetResolution.ok) {
        const prefix = isPlaying ? '当前播放' : '所选壁纸';
        const title = targetId === 'lucy' ? 'Lucy' : targetId;
        const status = hasPreset ? '已保存预设' : '未保存预设';
        targetLine = `${prefix}：${title}（${status}）`;
      } else {
        if (targetResolution.error === 'transition') targetLine = '播放状态切换中，预设暂不可用';
        else if (targetResolution.error === 'cleanup-failed') targetLine = '源窗口关闭未确认，请重试清理';
        else if (targetResolution.error === 'mismatch') targetLine = '请先停止当前播放或切换到所选壁纸';
        else if (targetResolution.error === 'scene-unconfirmed') targetLine = '壁纸目录未确认，预设暂不可用';
        else if (targetResolution.error === 'scene-unavailable') targetLine = '壁纸当前不可用，预设暂不可用';
        else if (targetResolution.error === 'unknown-scene') targetLine = '当前播放壁纸未知，预设暂不可用';
        else targetLine = '壁纸预设不可用';
      }

      const cardStyle = {
        background: 'rgba(24, 38, 64, 0.55)',
        border: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.16))',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        opacity: isDetached ? '0.45' : '1',
        pointerEvents: isDetached ? 'none' : 'auto',
      };

      const groupHeaderStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingBottom: '4px',
        borderBottom: '1px solid rgba(140, 165, 210, 0.12)',
      };

      const groupTitleStyle = {
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--dsw-alias-text-primary, #e6edf8)',
      };

      const groupSubtitleStyle = {
        fontSize: '11px',
        color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
      };

      const rowLabelStyle = {
        fontSize: '12px',
        fontWeight: '500',
        color: 'var(--dsw-alias-text-primary, #e6edf8)',
      };

      const rowValStyle = {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#8c72f2',
      };

      const hintStyle = {
        fontSize: '10.5px',
        color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
        lineHeight: 1.35,
        margin: 0,
      };

      const segmentGroupStyle = {
        display: 'flex',
        gap: '4px',
        background: 'rgba(10, 16, 28, 0.6)',
        border: '1px solid rgba(140, 165, 210, 0.16)',
        borderRadius: '6px',
        padding: '2px',
      };

      const segmentBtn = (active, label, onClick, id) => h('button', {
        id,
        key: id,
        type: 'button',
        disabled: isDetached,
        style: {
          flex: 1,
          padding: '4px 6px',
          fontSize: '11px',
          border: 'none',
          borderRadius: '4px',
          background: active ? '#8c72f2' : 'transparent',
          color: active ? '#fff' : 'var(--dsw-alias-text-secondary, #9cb0d1)',
          cursor: isDetached ? 'not-allowed' : 'pointer',
          fontWeight: active ? '600' : '400',
          transition: 'all 0.15s ease',
        },
        onClick,
      }, label);

      const renderSliderRow = (key, label, val, min, max, unit, sliderId, valId, hint) => h('div', {
        key,
        style: { display: 'flex', flexDirection: 'column', gap: '4px' },
      }, [
        h('div', {
          key: 'header',
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        }, [
          h('label', { key: 'lbl', htmlFor: sliderId, style: rowLabelStyle }, label),
          h('span', { key: 'val', id: valId, style: rowValStyle }, `${val}${unit}`),
        ]),
        h('input', {
          key: 'slider',
          id: sliderId,
          type: 'range',
          min,
          max,
          step: 1,
          value: val,
          disabled: isDetached,
          style: { width: '100%', cursor: isDetached ? 'not-allowed' : 'pointer' },
          onChange: (e) => {
            const next = parseInt(e.target.value, 10);
            controller.set(key, next);
          },
        }),
        hint ? h('p', { key: 'hint', style: hintStyle }, hint) : null,
      ]);

      return h('div', {
        id: 'whale-docked-panel',
        role: 'region',
        'aria-label': '鲸系外观设置',
        style: {
          position: 'fixed',
          right: '16px',
          top: '64px',
          width: '360px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 80px)',
          zIndex: 1000,
          pointerEvents: 'auto',
          background: 'var(--dsw-specific-menu, rgba(19, 29, 47, 0.96))',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.2))',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          color: 'var(--dsw-alias-text-primary, #e6edf8)',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        },
      }, [
        // 1. Header
        h('div', {
          key: 'header',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.15))',
            flexShrink: 0,
          },
        }, [
          h('div', { key: 'brand', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
            h('span', {
              key: 'badge',
              style: {
                background: 'linear-gradient(135deg, #8c72f2, #4a3891)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: '4px',
              },
            }, 'Whale'),
            h('span', { key: 'title', style: { fontWeight: '600', fontSize: '14px' } }, '外观快捷设置'),
          ]),
          h('button', {
            key: 'close-btn',
            type: 'button',
            id: 'whale-docked-close-x',
            style: {
              background: 'transparent',
              border: 'none',
              color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px',
              borderRadius: '4px',
            },
            onClick: () => appearanceBridge.closePanel(),
            'aria-label': '关闭面板',
          }, '✕'),
        ]),

        // 2. Unconfirmed cleanup alert
        unconfirmedCleanup ? h('div', {
          key: 'cleanup-err',
          id: 'whale-docked-cleanup-error',
          role: 'alert',
          style: {
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'rgba(255, 113, 133, 0.15)',
            border: '1px solid rgba(255, 113, 133, 0.35)',
            color: '#ff7185',
            fontSize: '12px',
            flexShrink: 0,
          },
        }, `窗口关闭待确认: ${bridgeState.lastError || '请重试吸附'}`) : null,

        // 2b. Independent action error alert (R4)
        actionError ? h('div', {
          key: 'action-err',
          id: 'whale-docked-action-error',
          role: 'alert',
          'aria-live': 'assertive',
          style: {
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'rgba(255, 113, 133, 0.15)',
            border: '1px solid rgba(255, 113, 133, 0.35)',
            color: '#ff7185',
            fontSize: '12px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          },
        }, [
          h('span', { key: 'msg' }, actionError),
          h('button', {
            key: 'dismiss',
            type: 'button',
            id: 'whale-docked-action-error-dismiss',
            style: {
              background: 'transparent',
              border: 'none',
              color: '#ff7185',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '2px 4px',
            },
            onClick: () => setActionError(''),
            'aria-label': '清除提示',
          }, '✕'),
        ]) : null,

        // 3. Detached Guidance Banner
        isDetached ? h('div', {
          key: 'detached-banner',
          style: {
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(140, 114, 242, 0.12)',
            border: '1px solid rgba(140, 114, 242, 0.25)',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0,
          },
        }, [
          h('div', { key: 'text' }, '已在独立 Edge 窗口中打开设置。在吸附回主界面之前，本地界面写入已锁定。'),
          h('button', {
            key: 'dock-btn',
            type: 'button',
            id: 'whale-docked-btn-dock',
            style: {
              background: 'var(--dsw-alias-brand-primary, #8c72f2)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
            },
            onClick: async () => {
              setActionError('');
              const res = await appearanceBridge.requestDock();
              if (!res.ok) {
                setActionError(res.error || '吸附失败');
              } else {
                setActionError('');
              }
            },
          }, '吸附回主界面'),
        ]) : null,

        // 4. Scrollable Content Body
        h('div', {
          key: 'scroll-body',
          style: {
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            paddingRight: '2px',
          },
        }, [
          // Group 0: 壁纸图库与所选壁纸 (Wallpaper Gallery & Selection)
          h('div', { key: 'group-wallpaper', id: 'whale-docked-wallpaper-group', style: cardStyle }, [
            h('div', { key: 'gh', style: groupHeaderStyle }, [
              h('div', { key: 'title-wrap', style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
                h('span', { key: 'gt', style: groupTitleStyle }, '壁纸图库'),
                h('span', { key: 'count', id: 'whale-docked-catalog-count', style: { fontSize: '10px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 5px', borderRadius: '4px' } }, `${visibleItems.length} 项`),
              ]),
              h('button', {
                key: 'refresh-btn',
                id: 'whale-docked-catalog-refresh',
                type: 'button',
                disabled: isDetached || catalog.loading,
                style: {
                  background: 'transparent',
                  border: '1px solid rgba(140, 165, 210, 0.16)',
                  borderRadius: '4px',
                  color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
                  fontSize: '11px',
                  padding: '2px 6px',
                  cursor: (isDetached || catalog.loading) ? 'not-allowed' : 'pointer',
                },
                onClick: () => {
                  if (typeof controller.wallpaper?.loadLibrary === 'function') {
                    controller.wallpaper.loadLibrary(true);
                  } else if (typeof controller.wallpaper?.readLibrary === 'function') {
                    controller.wallpaper.readLibrary({ refresh: true });
                  }
                },
              }, catalog.loading ? '刷新中...' : '↻ 刷新'),
            ]),

            // Age rating filter checkboxes
            h('div', {
              key: 'age-filters',
              id: 'whale-docked-age-filters',
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
                padding: '2px 0 4px 0',
              },
            }, [
              h('span', { key: 'lbl' }, '分级：'),
              ...[
                { id: 'Everyone', label: '所有人' },
                { id: 'Questionable', label: '敏感内容' },
                { id: 'Mature', label: '成人内容' },
              ].map(({ id, label }) => {
                const isChecked = allowedRatings.includes(id);
                return h('label', {
                  key: id,
                  style: { display: 'flex', alignItems: 'center', gap: '3px', cursor: isDetached ? 'not-allowed' : 'pointer' },
                }, [
                  h('input', {
                    type: 'checkbox',
                    id: `whale-docked-filter-${id.toLowerCase()}`,
                    checked: isChecked,
                    disabled: isDetached,
                    onChange: () => handleToggleRating(id),
                  }),
                  h('span', null, label),
                ]);
              }),
            ]),

            // Catalog notices
            catalog.loading ? h('div', { key: 'notice-loading', style: hintStyle }, '正在刷新壁纸库...') : null,
            catalog.error ? h('div', { key: 'notice-error', style: { ...hintStyle, color: '#ff7185' } }, `读取失败: ${catalog.error}`) : null,
            catalog.truncated ? h('div', { key: 'notice-truncated', style: { ...hintStyle, color: '#e3a85d' } }, '壁纸较多，已显示前部分条目') : null,
            (catalog.loaded && visibleItems.length === 0) ? h('div', { key: 'notice-empty', style: hintStyle }, allowedRatings.length === 0 ? '未勾选任何年龄分级' : '未发现匹配分级的可用壁纸') : null,

            // Compact Wallpaper Cards List
            h('div', {
              key: 'cards-list',
              id: 'whale-docked-wallpaper-list',
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '160px',
                overflowY: 'auto',
                paddingRight: '2px',
              },
            }, visibleItems.map(item => {
              const isSelected = item.id === selectedSceneId;
              const isPlayingItem = item.id === activeSceneId && (wpState === 'playing' || wpState === 'starting');
              return h('button', {
                key: item.id,
                type: 'button',
                disabled: isDetached || item.available === false,
                'aria-checked': isSelected,
                'data-scene-id': item.id,
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: isSelected ? 'rgba(140, 114, 242, 0.22)' : 'rgba(10, 16, 28, 0.5)',
                  border: isSelected ? '1px solid #8c72f2' : (isPlayingItem ? '1px solid rgba(72, 177, 136, 0.5)' : '1px solid rgba(140, 165, 210, 0.16)'),
                  borderRadius: '6px',
                  padding: '6px 8px',
                  cursor: (isDetached || item.available === false) ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  color: isSelected ? '#ffffff' : 'var(--dsw-alias-text-primary, #e6edf8)',
                },
                onClick: () => {
                  if (!isDetached && item.available !== false) {
                    controller.set('weScene', item.id);
                  }
                },
              }, [
                h('div', {
                  key: 'thumb-title-wrap',
                  style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
                }, [
                  h('div', {
                    key: 'thumb-wrap',
                    style: {
                      width: '36px',
                      height: '24px',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      background: 'rgba(0, 0, 0, 0.3)',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  }, [
                    h(DockedPreviewImage, {
                      key: 'thumb-img',
                      sceneId: item.previewRef ? item.id : null,
                      appearanceBridge,
                      alt: item.title || item.id,
                      style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      },
                    }),
                  ]),
                  h('span', {
                    key: 'title',
                    title: item.title || item.id,
                    style: {
                      fontSize: '12px',
                      fontWeight: isSelected ? '600' : '400',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '140px',
                    },
                  }, item.title || item.id),
                ]),
                h('div', {
                  key: 'tags',
                  style: { display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 },
                }, [
                  h('span', { key: 'type', style: { fontSize: '10px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 4px', borderRadius: '3px' } }, item.type || 'scene'),
                  isPlayingItem ? h('span', { key: 'playing', style: { fontSize: '10px', color: '#48b188', background: 'rgba(72, 177, 136, 0.2)', padding: '1px 4px', borderRadius: '3px', fontWeight: '500' } }, '正在播放') : null,
                  isSelected ? h('span', { key: 'selected', style: { fontSize: '10px', color: '#8c72f2', background: 'rgba(140, 114, 242, 0.25)', padding: '1px 4px', borderRadius: '3px', fontWeight: '500' } }, '本次选择') : null,
                ]),
              ]);
            })),

            // Details and Playback controls
            h('div', {
              key: 'details-wrap',
              id: 'whale-docked-details-wrap',
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(10, 16, 28, 0.4)',
                border: '1px solid rgba(140, 165, 210, 0.14)',
                borderRadius: '6px',
                padding: '8px',
              },
            }, [
              h('div', {
                key: 'details-preview-wrap',
                id: 'whale-docked-details-preview-wrap',
                style: {
                  width: '100%',
                  height: '70px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  background: 'rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              }, [
                isSelectedHidden ? h('div', {
                  key: 'hidden-notice',
                  id: 'whale-docked-details-hidden-notice',
                  style: {
                    fontSize: '11px',
                    color: '#e3a85d',
                    textAlign: 'center',
                    padding: '8px',
                  },
                }, '已被年龄分级筛选隐藏') : h(DockedPreviewImage, {
                  key: `details-img-${selectedItem.id}`,
                  id: 'whale-docked-details-img',
                  sceneId: selectedItem.previewRef ? selectedItem.id : null,
                  appearanceBridge,
                  alt: selectedItem.title || selectedItem.id,
                  style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  },
                }),
              ]),
              h('div', { key: 'details-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                h('span', { key: 'lbl', id: 'whale-docked-selected-title', style: { fontSize: '12px', fontWeight: '600', color: 'var(--dsw-alias-text-primary, #e6edf8)' } }, isSelectedHidden ? `所选壁纸：${selectedItem.title || selectedItem.id}（已被筛选隐藏）` : `所选壁纸：${selectedItem.title || selectedItem.id}`),
                h('span', { key: 'status-tag', style: { fontSize: '10px', color: selectedItem.playbackVerified ? '#48b188' : '#e3a85d' } }, selectedItem.playbackVerified ? '已验证' : (selectedItem.available ? '实验性' : '不可用')),
              ]),
              h('div', { key: 'status-text', id: 'whale-docked-playback-status', style: { fontSize: '11px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } },
                wpState === 'playing' ? `正在播放：${activeSceneId === 'lucy' ? 'Lucy' : (activeSceneId || '未知壁纸')}` :
                (wpState === 'starting' ? '壁纸启动中...' :
                (wpState === 'stopping' || cleanupPending ? '壁纸停止/清理中...' :
                (wpState === 'cleanup-failed' ? '源窗口清理未确认，请重试停止' : '未开始播放')))
              ),
              isMismatch ? h('div', {
                key: 'mismatch-alert',
                id: 'whale-docked-mismatch-banner',
                style: {
                  fontSize: '11px',
                  color: '#e3a85d',
                  background: 'rgba(227, 168, 93, 0.12)',
                  border: '1px solid rgba(227, 168, 93, 0.3)',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  lineHeight: '1.35',
                },
              }, activeSceneId ? `当前正在播放「${activeSceneId === 'lucy' ? 'Lucy' : activeSceneId}」。请先停止当前播放，再开始所选项。` : `当前活动壁纸身份未确认，请先停止播放。`) : null,
              h('div', { key: 'playback-options', className: 'wm-playback-options', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
                h('label', { key: 'mode-label', htmlFor: 'whale-docked-we-mode', style: { fontSize: '11px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } }, '播放模式'),
                h('select', {
                  key: 'we-mode',
                  id: 'whale-docked-we-mode',
                  'data-wm-setting': 'weMode',
                  disabled: isDetached || !isStartableState,
                  value: settings.weMode === 'daily' ? 'daily' : 'preview',
                  onChange: (event) => {
                    const el = event && event.currentTarget;
                    if (isDetached || !isStartableState) return;
                    if (!el || el.disabled) return;
                    const next = el.value;
                    if (next !== 'daily' && next !== 'preview') return;
                    controller.set('weMode', next);
                  },
                }, [
                  h('option', { key: 'daily', value: 'daily' }, '日常（持续播放）'),
                  h('option', { key: 'preview', value: 'preview' }, '预览（限时）'),
                ]),
                h('label', { key: 'autostart-label', htmlFor: 'whale-docked-we-autostart', style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } }, [
                  h('input', {
                    key: 'we-autostart',
                    id: 'whale-docked-we-autostart',
                    type: 'checkbox',
                    'data-wm-setting': 'weAutoStart',
                    disabled: isDetached || !isStartableState,
                    checked: settings.weAutoStart === true,
                    onChange: (event) => {
                      const el = event && event.currentTarget;
                      if (isDetached || !isStartableState) return;
                      if (!el || el.disabled) return;
                      if (el.checked !== true && el.checked !== false) return;
                      controller.set('weAutoStart', el.checked === true);
                    },
                  }),
                  '随 DSH 启动自动播放',
                ]),
                h('div', { key: 'lucy-hint', style: { fontSize: '10px', lineHeight: '1.35', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } }, '仅 Lucy 具备自动播放资格。修改播放模式或自动播放不会开始当前播放。'),
              ]),
              h('div', { key: 'actions-row', style: { display: 'flex', gap: '6px', marginTop: '2px' } }, [
                h('button', {
                  key: 'start-btn',
                  id: 'whale-docked-btn-start',
                  type: 'button',
                  disabled: !canStartWp,
                  style: {
                    flex: 1,
                    padding: '5px 8px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: canStartWp ? '#8c72f2' : 'rgba(255, 255, 255, 0.08)',
                    color: canStartWp ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: canStartWp ? 'pointer' : 'not-allowed',
                  },
                  onClick: async () => {
                    setActionError('');
                    try {
                      const mode = settings.weMode || 'daily';
                      const res = await controller.wallpaper.start(selectedSceneId, mode);
                      if (res && (res.ok === false || res.state === 'error' || res.state === 'cleanup-failed')) {
                        setActionError(res.error || '启动壁纸失败');
                      }
                    } catch (err) {
                      setActionError(err.message || '启动异常');
                    }
                  },
                }, '开始播放'),
                h('button', {
                  key: 'stop-btn',
                  id: 'whale-docked-btn-stop',
                  type: 'button',
                  disabled: !canStopWp,
                  style: {
                    flex: 1,
                    padding: '5px 8px',
                    fontSize: '11px',
                    fontWeight: '500',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: canStopWp ? 'var(--dsw-alias-text-primary, #e6edf8)' : 'rgba(255, 255, 255, 0.3)',
                    border: '1px solid rgba(140, 165, 210, 0.2)',
                    borderRadius: '4px',
                    cursor: canStopWp ? 'pointer' : 'not-allowed',
                  },
                  onClick: async () => {
                    setActionError('');
                    try {
                      const res = await controller.wallpaper.stop('user');
                      if (res && (res.ok === false || res.state === 'cleanup-failed' || res.state === 'error')) {
                        setActionError(res.error || '停止壁纸失败');
                      }
                    } catch (err) {
                      setActionError(err.message || '停止异常');
                    }
                  },
                }, '停止播放'),
              ]),
            ]),
          ]),

          // Group 1: 画面调节 (Visual)
          h('div', { key: 'group-visual', style: cardStyle }, [
            h('div', { key: 'gh', style: groupHeaderStyle }, [
              h('span', { key: 'gt', style: groupTitleStyle }, '壁纸画面效果'),
              h('span', { key: 'gs', style: groupSubtitleStyle }, 'DSH 背景渲染'),
            ]),
            h('div', {
              key: 'visual-notice',
              id: 'whale-docked-visual-notice',
              style: {
                ...hintStyle,
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '4px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(140, 165, 210, 0.12)',
              },
            }, isCurrentlyPlaying ? `调节对当前播放的壁纸「${activeSceneId === 'lucy' ? 'Lucy' : (activeSceneId || '当前壁纸')}」生效` : '当前未播放壁纸；四项调节属于 DSH 背景渲染全局效果'),
            renderSliderRow('brightness', '背景亮度', brightnessVal, 20, 120, '%', 'whale-docked-brightness-slider', 'whale-docked-brightness-val', '100%保留原亮度，可继续提亮；最终效果还受遮罩和界面底色影响'),
            renderSliderRow('mask', '遮罩', maskVal, 0, 90, '%', 'whale-docked-mask-slider', 'whale-docked-mask-val', '叠加主题底色；数值越大覆盖越强，0%关闭'),
            renderSliderRow('blur', '模糊', blurVal, 0, 24, 'px', 'whale-docked-blur-slider', 'whale-docked-blur-val', '柔化壁纸细节，视频较大时会增加显卡负担'),
            renderSliderRow('surface', '界面不透明度', surfaceVal, 40, 100, '%', 'whale-docked-surface-slider', 'whale-docked-surface-val', '侧栏与卡片；菜单和输入卡片保持不透明'),
          ]),

          // Group 2: 界面定制 (Interface)
          h('div', { key: 'group-interface', style: cardStyle }, [
            h('div', { key: 'gh', style: groupHeaderStyle }, [
              h('span', { key: 'gt', style: groupTitleStyle }, '界面定制'),
              h('span', { key: 'gs', style: groupSubtitleStyle }, '主题与配色'),
            ]),
            // Theme
            h('div', { key: 'theme-row', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
              h('span', { key: 'lbl', style: rowLabelStyle }, '主题'),
              h('div', { key: 'seg', id: 'whale-docked-theme-segment', style: segmentGroupStyle }, [
                segmentBtn(themeVal === 'mist', 'Mist (浅色)', () => controller.set('theme', 'mist'), 'whale-docked-theme-mist'),
                segmentBtn(themeVal === 'abyss', 'Abyss (深色)', () => controller.set('theme', 'abyss'), 'whale-docked-theme-abyss'),
              ]),
            ]),
            // Palette
            h('div', { key: 'palette-row', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
              h('div', { key: 'hdr', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                h('span', { key: 'lbl', style: rowLabelStyle }, '深色配色'),
                h('span', { key: 'tag', style: { fontSize: '10px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } }, '仅深色生效'),
              ]),
              h('div', { key: 'seg', id: 'whale-docked-palette-segment', style: segmentGroupStyle }, [
                segmentBtn(paletteVal === 'ocean', 'Ocean', () => controller.set('palette', 'ocean'), 'whale-docked-palette-ocean'),
                segmentBtn(paletteVal === 'graphite', 'Graphite', () => controller.set('palette', 'graphite'), 'whale-docked-palette-graphite'),
                segmentBtn(paletteVal === 'violet', 'Violet', () => controller.set('palette', 'violet'), 'whale-docked-palette-violet'),
                segmentBtn(paletteVal === 'jade', 'Jade', () => controller.set('palette', 'jade'), 'whale-docked-palette-jade'),
              ]),
            ]),
            // Text Contrast
            h('div', { key: 'contrast-row', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
              h('span', { key: 'lbl', style: rowLabelStyle }, '文字可读性'),
              h('div', { key: 'seg', id: 'whale-docked-contrast-segment', style: segmentGroupStyle }, [
                segmentBtn(contrastVal === 'standard', '标准', () => controller.set('textContrast', 'standard'), 'whale-docked-contrast-standard'),
                segmentBtn(contrastVal === 'enhanced', '增强', () => controller.set('textContrast', 'enhanced'), 'whale-docked-contrast-enhanced'),
              ]),
            ]),
            // Chat Backdrop
            renderSliderRow('chatBackdrop', '聊天区底色', chatBackdropVal, 0, 100, '%', 'whale-docked-chatbackdrop-slider', 'whale-docked-chatbackdrop-val', '0%保留壁纸透光，100%完全不透明'),
            // Accent Mode & Color
            h('div', { key: 'accent-row', style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
              h('span', { key: 'lbl', style: rowLabelStyle }, '强调色'),
              h('div', { key: 'seg', id: 'whale-docked-accent-segment', style: segmentGroupStyle }, [
                segmentBtn(accentModeVal === 'theme', '跟随主题', () => controller.set('accentMode', 'theme'), 'whale-docked-accent-theme'),
                segmentBtn(accentModeVal === 'custom', '自定义', () => controller.set('accentMode', 'custom'), 'whale-docked-accent-custom'),
              ]),
              accentModeVal === 'custom' ? h('div', {
                key: 'picker-wrap',
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(10, 16, 28, 0.4)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  marginTop: '4px',
                },
              }, [
                h('span', { key: 'lbl', style: { fontSize: '11px', color: 'var(--dsw-alias-text-secondary, #9cb0d1)' } }, '自定义色值'),
                h('div', { key: 'row', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                  h('input', {
                    key: 'color-input',
                    id: 'whale-docked-accent-color-picker',
                    type: 'color',
                    value: accentColorVal,
                    disabled: isDetached,
                    style: { width: '24px', height: '22px', border: 'none', background: 'transparent', cursor: 'pointer' },
                    onChange: (e) => controller.set('accentColor', e.target.value),
                  }),
                  h('span', { key: 'hex', id: 'whale-docked-accent-hex', style: rowValStyle }, accentColorVal.toLowerCase()),
                ]),
              ]) : null,
            ]),
          ]),

          // Group 3: 壁纸外观预设 (Presets)
          h('div', { key: 'group-presets', style: cardStyle }, [
            h('div', { key: 'gh', style: groupHeaderStyle }, [
              h('span', { key: 'gt', style: groupTitleStyle }, '壁纸外观预设'),
              h('span', { key: 'gs', style: groupSubtitleStyle }, '仅限四项画面参数'),
            ]),
            h('div', {
              key: 'target-line',
              style: { fontSize: '12px', fontWeight: '500', color: 'var(--dsw-alias-text-primary, #e6edf8)' },
            }, targetLine),
            h('p', { key: 'preset-hint', style: hintStyle }, '每张壁纸保存一份亮度、遮罩、模糊与不透明度；手动应用到当前外观，全局恢复默认不删除预设'),
            h('div', { key: 'actions', style: { display: 'flex', gap: '6px', marginTop: '4px' } }, [
              h('button', {
                key: 'save',
                id: 'whale-docked-preset-save',
                type: 'button',
                disabled: !canSave,
                style: {
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: canSave ? '#fff' : 'rgba(255, 255, 255, 0.3)',
                  border: '1px solid rgba(140, 165, 210, 0.2)',
                  borderRadius: '4px',
                  cursor: canSave ? 'pointer' : 'not-allowed',
                },
                onClick: () => {
                  setActionError('');
                  const res = controller.presets.save();
                  if (!res.ok) {
                    setActionError(res.error || '保存预设失败');
                  } else {
                    setActionError('');
                  }
                },
              }, '保存当前外观'),
              h('button', {
                key: 'apply',
                id: 'whale-docked-preset-apply',
                type: 'button',
                disabled: !canApply,
                style: {
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: canApply ? '#fff' : 'rgba(255, 255, 255, 0.3)',
                  border: '1px solid rgba(140, 165, 210, 0.2)',
                  borderRadius: '4px',
                  cursor: canApply ? 'pointer' : 'not-allowed',
                },
                onClick: () => {
                  setActionError('');
                  const res = controller.presets.apply();
                  if (!res.ok) {
                    setActionError(res.error || '应用预设失败');
                  } else {
                    setActionError('');
                  }
                },
              }, '应用已保存外观'),
              h('button', {
                key: 'delete',
                id: 'whale-docked-preset-delete',
                type: 'button',
                disabled: !canDelete,
                style: {
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: '11px',
                  background: 'rgba(255, 113, 133, 0.1)',
                  color: canDelete ? '#ff7185' : 'rgba(255, 113, 133, 0.3)',
                  border: '1px solid rgba(255, 113, 133, 0.25)',
                  borderRadius: '4px',
                  cursor: canDelete ? 'pointer' : 'not-allowed',
                },
                onClick: () => {
                  setActionError('');
                  const res = controller.presets.remove();
                  if (!res.ok) {
                    setActionError(res.error || '删除预设失败');
                  } else {
                    setActionError('');
                  }
                },
              }, '删除预设'),
            ]),
          ]),
        ]),

        // 5. Footer actions
        h('div', {
          key: 'footer',
          style: {
            display: 'flex',
            gap: '8px',
            paddingTop: '8px',
            borderTop: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.15))',
            flexShrink: 0,
          },
        }, [
          !isDetached ? h('button', {
            key: 'detach-btn',
            type: 'button',
            id: 'whale-docked-btn-detach',
            disabled: inFlightDetach || isDetaching || unconfirmedCleanup,
            style: {
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--dsw-alias-brand-primary, #8c72f2)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '500',
              cursor: (inFlightDetach || isDetaching || unconfirmedCleanup) ? 'not-allowed' : 'pointer',
              opacity: (inFlightDetach || isDetaching || unconfirmedCleanup) ? '0.5' : '1',
            },
            onClick: async () => {
              setInFlightDetach(true);
              setActionError('');
              try {
                const res = await appearanceBridge.requestDetach();
                if (!res.ok) {
                  setActionError(res.error || '弹出失败');
                } else {
                  setActionError('');
                }
              } catch (err) {
                setActionError(err.message || '弹出异常');
              } finally {
                setInFlightDetach(false);
              }
            },
          }, isDetaching ? '弹出中...' : '弹出独立窗口') : null,

          h('button', {
            key: 'close-btn-bottom',
            type: 'button',
            id: 'whale-docked-btn-close',
            style: {
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--dsw-alias-border-subtle, rgba(140, 165, 210, 0.2))',
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--dsw-alias-text-secondary, #9cb0d1)',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
            },
            onClick: () => appearanceBridge.closePanel(),
          }, '关闭'),
        ]),
      ]);
    }

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

      let presets = readPresets();
      const presetListeners = new Set();
      const notifyPresetListeners = () => {
        for (const listener of presetListeners) {
          try { listener(); } catch {}
        }
      };

      let settingsSnapshot = Object.freeze({ ...settings });
      const settingsListeners = new Set();
      const notifySettingsListeners = () => {
        settingsSnapshot = Object.freeze({ ...settings });
        for (const listener of settingsListeners) {
          try { listener(settingsSnapshot); } catch {}
        }
      };

      const checkSceneAvailability = (sceneId) => {
        if (!sceneId || !isSceneId(sceneId)) return { ok: false, error: "invalid-scene" };
        const wp = (typeof controller?.wallpaper?.getStatus === "function") ? controller.wallpaper : wallpaper;
        const status = wp.getStatus();
        const snapshot = typeof wp.getLibrarySnapshot === "function" ? wp.getLibrarySnapshot() : null;

        if (sceneId === "lucy") {
          if (Array.isArray(status?.host?.scenes)) {
            const lucyHost = status.host.scenes.find(s => s?.id === "lucy");
            if (lucyHost && lucyHost.available === false) {
              return { ok: false, error: "scene-unavailable", sceneId: "lucy" };
            }
          }
          if (snapshot && Array.isArray(snapshot.items)) {
            const lucyLib = snapshot.items.find(s => s?.id === "lucy");
            if (lucyLib && lucyLib.available === false) {
              return { ok: false, error: "scene-unavailable", sceneId: "lucy" };
            }
          }
          if (status?.host && status.host.available === false && status.host.unavailableReason === "scene") {
            return { ok: false, error: "scene-unavailable", sceneId: "lucy" };
          }
          return { ok: true, targetId: "lucy" };
        }

        if (!snapshot || !snapshot.loaded || snapshot.state !== "ready") {
          return { ok: false, error: "scene-unconfirmed", sceneId };
        }
        const item = Array.isArray(snapshot.items) ? snapshot.items.find(s => s?.id === sceneId) : null;
        if (!item || item.available !== true) {
          return { ok: false, error: "scene-unavailable", sceneId };
        }
        return { ok: true, targetId: sceneId };
      };

      const resolvePresetTarget = () => {
        if (disposed) return { ok: false, error: "disposed" };
        const wp = (typeof controller?.wallpaper?.getStatus === "function") ? controller.wallpaper : wallpaper;
        const status = wp.getStatus();
        if (status.cleanupPending || (typeof wp.hasPendingCleanup === "function" && wp.hasPendingCleanup())) {
          return { ok: false, error: "transition", state: "stopping" };
        }
        if (["starting", "connecting", "waiting"].includes(status.state)) {
          return { ok: false, error: "transition", state: status.state };
        }
        if (status.state === "cleanup-failed") {
          return { ok: false, error: "cleanup-failed" };
        }
        if (status.state === "error") {
          return { ok: false, error: "error" };
        }
        if (status.state === "playing") {
          const activeId = status.host?.activeSceneId;
          if (!activeId || !isSceneId(activeId)) return { ok: false, error: "unknown-scene" };
          if (activeId !== settings.weScene) return { ok: false, error: "mismatch", activeId, selectedId: settings.weScene };
          const avail = checkSceneAvailability(activeId);
          if (!avail.ok) return avail;
          return { ok: true, targetId: activeId, isPlaying: true };
        }
        if (["idle", "stopped"].includes(status.state)) {
          if (!isSceneId(settings.weScene)) return { ok: false, error: "invalid-scene" };
          const avail = checkSceneAvailability(settings.weScene);
          if (!avail.ok) return avail;
          return { ok: true, targetId: settings.weScene, isPlaying: false };
        }
        return { ok: false, error: "state-disallowed", state: status.state };
      };

      const checkPresetTarget = (expectedSceneId) => {
        const target = resolvePresetTarget();
        if (!target.ok) return target;
        if (expectedSceneId && expectedSceneId !== target.targetId) {
          return { ok: false, error: "target-mismatch", expected: expectedSceneId, actual: target.targetId };
        }
        return target;
      };

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
        presets: {
          getSnapshot: () => presets,
          subscribe: (listener) => {
            presetListeners.add(listener);
            return () => presetListeners.delete(listener);
          },
          get: (sceneId) => {
            if (!sceneId || !isSceneId(sceneId)) return null;
            const entry = presets.entries[sceneId];
            return entry ? { ...entry } : null;
          },
          getAll: () => {
            const result = {};
            for (const [k, v] of Object.entries(presets.entries)) {
              result[k] = { ...v };
            }
            return result;
          },
          resolveTarget: resolvePresetTarget,
          save: (sceneId) => {
            const target = checkPresetTarget(sceneId);
            if (!target.ok) return target;
            const entry = {
              brightness: clampRange("brightness", settings.brightness),
              mask: clampRange("mask", settings.mask),
              blur: clampRange("blur", settings.blur),
              surface: clampRange("surface", settings.surface),
            };
            const nextEntries = { ...presets.entries, [target.targetId]: Object.freeze(entry) };
            const nextPresets = Object.freeze({ version: 1, entries: Object.freeze(nextEntries) });
            if (!persistPresets(nextPresets)) {
              return { ok: false, error: "storage-failed" };
            }
            presets = nextPresets;
            notifyPresetListeners();
            return { ok: true, targetId: target.targetId, preset: entry };
          },
          apply: (sceneId) => {
            const target = checkPresetTarget(sceneId);
            if (!target.ok) return target;
            const entry = presets.entries[target.targetId];
            if (!entry) return { ok: false, error: "preset-missing" };
            const nextSettings = normalizeSettings({
              ...settings,
              brightness: entry.brightness,
              mask: entry.mask,
              blur: entry.blur,
              surface: entry.surface,
            });
            const hasChanges = Object.keys(nextSettings).some((k) => nextSettings[k] !== settings[k]);
            settings = nextSettings;
            persistSettings(settings);
            projectSettings(settings);
            backdrop.update(settings, themeSignal.getSnapshot());
            if (hasChanges) {
              notifySettingsListeners();
            }
            return { ok: true, targetId: target.targetId, preset: entry, settings: { ...settings } };
          },
          remove: (sceneId) => {
            const target = checkPresetTarget(sceneId);
            if (!target.ok) return target;
            if (!presets.entries[target.targetId]) return { ok: false, error: "preset-missing" };
            const nextEntries = { ...presets.entries };
            delete nextEntries[target.targetId];
            const nextPresets = Object.freeze({ version: 1, entries: Object.freeze(nextEntries) });
            if (!persistPresets(nextPresets)) {
              return { ok: false, error: "storage-failed" };
            }
            presets = nextPresets;
            notifyPresetListeners();
            return { ok: true, targetId: target.targetId };
          },
        },
        read: () => ({ ...settings }),
        getSettingsSnapshot: () => settingsSnapshot,
        subscribeSettings: (listener) => {
          settingsListeners.add(listener);
          return () => settingsListeners.delete(listener);
        },
        set: (key, value) => {
          if (disposed || !isValidSetting(key, value)) return { ...settings };
          // Picking the next scene is manual intent; a late automatic-start answer must not apply it.
          if (key === "weScene") userActionRevision++;
          if (key === "background") selectionRevision++;
          let patch = { [key]: value };
          if (key === "opaqueChat") {
            patch = { opaqueChat: value, chatBackdrop: value ? 100 : 0 };
          } else if (key === "chatBackdrop") {
            const clamped = clampRange("chatBackdrop", value);
            patch = { chatBackdrop: clamped, opaqueChat: clamped === 100 };
          }
          const nextSettings = normalizeSettings({ ...settings, ...patch });
          const hasChanges = Object.keys(nextSettings).some((k) => nextSettings[k] !== settings[k]);

          // A mode change cancels any automatic start that is still waiting for the host; it
          // does not restart the run that is already active (that keeps its own mode).
          if (key === "weMode") playbackModeRevision++;
          // Leaving the Wallpaper Engine source stops this round's window before any
          // other background is presented; switching back never auto-restarts it.
          if (key === "background") {
            userActionRevision++;
            if (value !== "wallpaper") wallpaper.stop("background-changed").catch(() => {});
          }

          if (!hasChanges) {
            return { ...settings };
          }

          settings = nextSettings;
          persistSettings(settings);
          projectSettings(settings);
          if (key === "theme") ctx.theme.setTheme(selectedThemeId(settings));
          backdrop.update(settings, themeSignal.getSnapshot());
          notifySettingsListeners();
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
          notifySettingsListeners();
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

      ctx.effect(() => () => { disposed = true; selectionRevision++; presetListeners.clear(); settingsListeners.clear(); }, "whale: controller lifetime");

      // Auto playback: the persisted choice is only a statement about the NEXT DSH start.
      // This effect fires at most once per page lifetime, only when the source and the theme
      // still apply and the host says the scene is available. A manual stop stays stopped:
      // nothing here re-runs on a settings change, a theme re-sync or a re-mounted component.
      ctx.effect(() => {
        // The choice is frozen here, at the start of this DSH session: toggling the checkbox
        // later only saves the NEXT launch and must never start playback in this one.
        const autoStartWanted = settings.weAutoStart === true && settings.weMode === "daily"
          // An unverified library wallpaper is manual-only: it must never start by itself on the
          // strength of one successful run. Only the accepted sample keeps its automatic path.
          && VERIFIED_SCENE_IDS.includes(settings.weScene);
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

      // Detachable Appearance Seam & Bridge State
      const bridgeListeners = new Set();
      let bridgeClientInstance = null;
      const bridgeState = {
        mode: DETACHABLE_MODES.DOCKED,
        isOpen: false,
        unconfirmedCleanup: false,
        lastError: null,
      };
      let cachedBridgeSnapshot = Object.freeze({ ...bridgeState });

      const notifyBridge = () => {
        cachedBridgeSnapshot = Object.freeze({ ...bridgeState });
        for (const l of bridgeListeners) {
          try { l(cachedBridgeSnapshot); } catch {}
        }
      };

      let catalogReadRequest = null;
      const cancelCatalogRead = () => {
        const req = catalogReadRequest;
        if (!req) return;
        catalogReadRequest = null;
        clearTimeout(req.timer);
        req.abort.abort();
      };
      const ensureCatalogRead = () => {
        if (disposed || bridgeState.mode !== DETACHABLE_MODES.DOCKED || typeof controller.wallpaper?.readLibrary !== "function" || catalogReadRequest) return;
        const cache = controller.wallpaper.getLibrarySnapshot?.();
        if (cache?.loading === true || (cache?.state === "ready" && cache?.loaded === true)) return;
        const req = { abort: new AbortController(), timer: null };
        catalogReadRequest = req;
        req.timer = setTimeout(() => {
          if (catalogReadRequest === req) cancelCatalogRead();
        }, 4000);
        try {
          Promise.resolve(controller.wallpaper.readLibrary({ ensure: true, signal: req.abort.signal })).catch(() => {}).finally(() => {
            clearTimeout(req.timer);
            if (catalogReadRequest === req) catalogReadRequest = null;
          });
        } catch {
          clearTimeout(req.timer);
          if (catalogReadRequest === req) catalogReadRequest = null;
        }
      };
      ctx.effect(() => () => cancelCatalogRead());
      const appearanceBridge = {
        getSnapshot: () => cachedBridgeSnapshot,
        subscribe: (listener) => {
          bridgeListeners.add(listener);
          return () => bridgeListeners.delete(listener);
        },
        togglePanel: () => {
          bridgeState.isOpen = !bridgeState.isOpen;
          if (bridgeState.isOpen) ensureCatalogRead();
          else cancelCatalogRead();
          notifyBridge();
        },
        openPanel: () => {
          if (!bridgeState.isOpen) {
            bridgeState.isOpen = true;
            ensureCatalogRead();
            notifyBridge();
          }
        },
        closePanel: () => {
          cancelCatalogRead();
          if (bridgeState.isOpen) {
            bridgeState.isOpen = false;
            notifyBridge();
          }
        },
        requestDetach: async () => {
          if (!bridgeClientInstance) return { ok: false, error: 'bridge-not-connected' };
          return await bridgeClientInstance.requestDetach();
        },
        requestDock: async () => {
          if (!bridgeClientInstance) return { ok: false, error: 'bridge-not-connected' };
          return await bridgeClientInstance.requestDock();
        },
        fetchPreviewBlob: (sceneId, options) => {
          if (!bridgeClientInstance) return Promise.reject(new Error('bridge-not-connected'));
          return bridgeClientInstance.fetchPreviewBlob(sceneId, options);
        },
        getClient: () => bridgeClientInstance,
      };

      const initBridge = async () => {
        let boot = typeof globalThis !== 'undefined' ? globalThis.__WHALE_DETACHABLE_BOOT__ : null;
        let port = boot?.port;
        let mainToken = boot?.mainToken;

        if (!mainToken && typeof fetch === 'function') {
          try {
            const resp = await fetch('/whale-appearance/bootstrap', { cache: 'no-store' });
            if (resp.ok) {
              const data = await resp.json();
              if (data.ok && data.port && data.mainToken) {
                port = data.port;
                mainToken = data.mainToken;
              }
            }
          } catch {}
        }

        if (port && mainToken && !disposed) {
          const baseUrl = `http://127.0.0.1:${port}`;
          const instanceId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `main-${Date.now()}`;
          bridgeClientInstance = createMainRendererBridgeClient({
            baseUrl,
            instanceId,
            mainToken,
            controller,
          });

          bridgeClientInstance.subscribe((state) => {
            bridgeState.mode = state.mode;
            bridgeState.unconfirmedCleanup = Boolean(state.unconfirmedCleanup);
            bridgeState.lastError = state.lastError;
            notifyBridge();
          });

          await bridgeClientInstance.connect().catch(() => {});
        }
      };

      initBridge().catch(() => {});

      ctx.effect(() => () => {
        if (bridgeClientInstance) {
          bridgeClientInstance.dispose().catch(() => {});
        }
      }, "whale: detachable bridge lifetime");

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

      ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
        name: "conversation.session.header.actions",
        id: "whale-appearance-trigger",
        order: -4,
        inject: () => ({ appearanceBridge })
      }, WhaleHeaderAppearanceTrigger));

      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "whale-docked-appearance-panel",
        order: 100,
        inject: () => ({ appearanceBridge, controller })
      }, WhaleDockedAppearancePanel));
    }

    exports.createWallpaperEngine = createWallpaperEngine;
    exports.createBackdrop = createBackdrop;
    exports.inject = inject;
    exports.apply = apply;
    exports.deriveAccentValues = deriveAccentValues;
    exports.deriveButtonForeground = deriveButtonForeground;
    exports.deriveButtonHover = deriveButtonHover;
    exports.deriveInkColor = deriveInkColor;
    exports.contrastRatio = contrastRatio;
    exports.relativeLuminance = relativeLuminance;
    exports.HEX_COLOR_PATTERN = HEX_COLOR_PATTERN;
    exports.createMainRendererBridgeClient = createMainRendererBridgeClient;
    exports.executeAuthoritativeAction = executeAuthoritativeAction;
    exports.buildAppearanceSnapshot = buildAppearanceSnapshot;
    exports.WhaleHeaderAppearanceTrigger = WhaleHeaderAppearanceTrigger;
    exports.WhaleDockedAppearancePanel = WhaleDockedAppearancePanel;
    exports.DETACHABLE_MODES = DETACHABLE_MODES;
    return module.exports;
  }
});
