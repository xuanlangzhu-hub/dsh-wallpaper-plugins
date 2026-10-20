# 按壁纸保存外观预设 P1（手动保存、应用、删除）交付报告

日期：2026-10-16\
任务执行者：小G (Gemini)\
复审交接：Codex\
任务依据：`docs/GEMINI_NEXT_WALLPAPER_APPEARANCE_PRESETS_P1_20261016.md`\

---

## 1. 交付目标与完成概览

本次完成了按壁纸保存外观预设的第一阶段（P1）纯前端与 Controller 链路实现：
- **按合法 Scene ID 归属**：支持已验证样例 `lucy` 及工坊目录 `we-[0-9a-f]{24}`。
- **四项外观属性**：仅保存与应用 `brightness`（20–120）、`mask`（0–90）、`blur`（0–24）、`surface`（40–100），默认值仍为 70 / 45 / 0 / 82。
- **纯手动操作语义**：仅用户点击按钮时执行保存、应用、删除；目录刷新、选择列表项、开始/停止播放均不自动套用预设。
- **严格归属与状态防护**：
  - 停止/idle 态：目标为所选壁纸，清楚标注“所选壁纸：...（未保存预设 / 已保存预设）”。
  - 稳定播放且 Host 确认 ID 一致：目标为播放壁纸，标注“播放壁纸：...”。
  - 播放 A 但已选 B（Mismatch）：按钮完全禁用，明确提示“请先停止当前播放或切换到所选壁纸”；Controller 底层同时防御并拒绝写入。
  - Starting / Connecting / Waiting / Cleanup-failed / Error 态：按钮完全禁用，Controller 底层拒绝操作。
- **独立存储与 Reset 隔离**：使用独立存储键 `dsh-whale-mist.wallpaper-appearance-presets.v1`；全局“恢复默认”（`controller.reset()`）仅重置当前画面至默认外观，不删除预设库；删除预设仅移除该壁纸配置，不改动当前滑块画面。
- **兼容与异常健壮性**：历史候选超标亮度（如 200）冷启动按 120 安全夹取；坏 JSON 或未知版本安全退回空库且不覆盖原始存储；存储写入失败（Quota 等）拒绝操作且不假报成功。
- **验证通过**：`npm run check` 静态与 CSS 模板守卫通过；`npm run test:appearance` 104 项测试全部通过（原 65 项 + 新增 39 项断言）；`--scene-selection-only` 回归通过。

---

## 2. 详细改动清单

### 2.1 `dsh-whale-mist/src/client.js`

1. **预设存储键与数据校验/规整函数**：
   - 定义 `PRESETS_STORAGE_KEY = "dsh-whale-mist.wallpaper-appearance-presets.v1"`。
   - 定义 `PRESET_PROPERTIES = Object.freeze(["brightness", "mask", "blur", "surface"])`。
   - `sanitizePresetEntry(raw)`：验证对象形状与有限数值，调用 `clampRange(key, raw[key])` 进行整数夹取，返回冻结对象。
   - `normalizePresets(raw)`：版本校验（`version === 1`），过滤 `__proto__`, `constructor`, `prototype` 原型污染键，验证合法 Scene ID（`isSceneId`），返回结构冻结的 `{ version: 1, entries }`。
   - `readPresets()`：安全解析 JSON，异常时安全回退为空字典，不改写损坏的本地存储。
   - `persistPresets(presets)`：捕获异常（QuotaExceeded / SecurityError），成功返回 `true`，失败返回 `false`。

2. **中英文国际化 Copy 字典**：
   - 补齐 `presetTitle`, `presetHint`, `presetSelectedTarget`, `presetPlayingTarget`, `presetSaved`, `presetEmpty`, `presetSave`, `presetApply`, `presetDelete`, `presetMismatch`, `presetBusy`, `presetStorageError` 对应文案。

3. **`WhaleAppearanceSettings` 交互组件**：
   - 在 `library` state 后挂接 `presetsState`（`React.useSyncExternalStore` 外部监听）与 `presetActionError`，保证 Hook Slot 稳定性。
   - 实现 `wallpaperPresetsRow` 组件：
     - 实时调用 `controller.presets.resolveTarget()`。
     - 当 `targetResolution.ok` 时展示归属壁纸标题与状态（已保存/未保存），根据存在性启用“应用已保存外观”与“删除预设”按钮。
     - 当 Mismatch 时展示冲突壁纸信息并提示“请先停止当前播放或切换到所选壁纸”；Transition 或 Cleanup-failed 时禁用并提示对应状态。
     - 按钮使用 `.wm-settings-reset.wm-preset-button` 统一设计语言，具备键盘焦点高亮（`:focus-visible`）与禁用态（`:disabled`）。
   - 将 `wallpaperPresetsRow` 挂载在 `range("surface")` 之后，且仅当 `settings.background === "wallpaper"` 时呈现。

4. **CSS 样式补充**：
   - 增加 `.wm-wallpaper-presets-row`, `.wm-wallpaper-preset-target`, `.wm-wallpaper-preset-actions`, `.wm-preset-button` 及响应式规则。
   - 严格遵循 `qa/css-template-guard.mjs` 要求，无行内反引号与单反斜杠转义符。

5. **`apply(ctx)` Controller 扩展与生命周期管理**：
   - 维护内存预设对象 `presets` 与监听器集合 `presetListeners`。
   - 实现目标判定边界 `resolvePresetTarget()` 与校验函数 `checkPresetTarget(expectedSceneId)`。
   - 在 `controller` 挂载 `presets` API：
     - `getSnapshot()`：返回深层冻结的预设快照。
     - `subscribe(listener)`：提供外部订阅并在销毁时注销。
     - `get(sceneId)`：安全读取特定 Scene 预设。
     - `getAll()`：安全浅拷贝返回所有预设。
     - `resolveTarget()`：获取当前合法操作目标或错误原因。
     - `save(sceneId?)`：校验目标，提取当前四项并夹取，持久化成功后更新内存与广播；失败返回 `{ ok: false, error: 'storage-failed' }`。
     - `apply(sceneId?)`：校验目标，读取预设并更新 `settings` 对应四项，调用 `persistSettings`、`projectSettings` 与 `backdrop.update`；不改动 `weScene/weMode/weAutoStart`，不触发壁纸重启。
     - `remove(sceneId?)`：校验目标，删除预设，持久化成功后更新内存与广播。
   - 在控制器注销钩子 `ctx.effect(() => () => { disposed = true; ... })` 中清空 `presetListeners`，并在销毁后所有操作均安全返回 `{ ok: false, error: 'disposed' }`。

### 2.2 `dsh-whale-mist/qa/appearance-harness.js`

在 `fixture.run` 中增加了覆盖全部验证场景的综合测试：
- **A/B 预设隔离**：对 Lucy 和 `we-bbbbbbbbbbbbbbbbbbbbbbbb` 分别保存不同四项数值，删除 Lucy 不影响 Scene B；标题或列表状态不影响 ID 归属。
- **真实控件链路**：通过 `fixture.controls()` 触发实际 `onClick`，验证 Controller 值、CSS 变量投影（如 `--wm-bg-brightness: 1.15`、`--wm-bg-mask: 0.3`）、LocalStorage 存储与 UI 状态同步；应用不改动 `weScene`、`weMode`、`weAutoStart`。
- **已选与播放不一致（Mismatch）**：模拟 Host 上报播放 Lucy 但界面已选 Scene B 时，UI 按钮全部置灰禁用，Controller 底层 `save / apply / remove` 均返回 `{ ok: false, error: 'mismatch' }`。
- **过渡态与异常态防护**：在 `starting` 与 `cleanup-failed` 状态下，按钮禁用且 Controller 拒绝误操作。
- **兼容与容错**：冷启动加载包含候选值 `brightness: 200` 的预设，成功夹取为 120；损坏 JSON 安全退回空预设且保留原始存储文本；未知版本协议号安全退回空预设。
- **全局 Reset 隔离**：调用 `c.reset()` 全局恢复默认后，当前外观重置为默认值，但壁纸预设库完整保留在内存与存储中。
- **存储失败回退**：模拟 LocalStorage 抛出 QuotaExceededError，保存与删除均拒绝并返回 `storage-failed`，内存预设不受损坏。
- **销毁边界**：Controller 销毁后所有预设操作均返回 `disposed`。

---

## 3. 存储结构规范

键名：
```text
dsh-whale-mist.wallpaper-appearance-presets.v1
```

结构格式：
```json
{
  "version": 1,
  "entries": {
    "lucy": {
      "brightness": 115,
      "mask": 30,
      "blur": 12,
      "surface": 90
    },
    "we-bbbbbbbbbbbbbbbbbbbbbbbb": {
      "brightness": 85,
      "mask": 55,
      "blur": 4,
      "surface": 70
    }
  }
}
```

---

## 4. 验证命令与结果

### 4.1 静态与模板检查
```bash
npm run check
```
执行结果：
```text
> dsh-whale-mist@0.6.0-rc.30 check
> node --check src/index.js && node --check src/client.js && node --check src/wallpaper/session.js && node --check src/wallpaper/scenes.js && node --check src/wallpaper/catalog.js && node --check src/wallpaper/library.js && node qa/css-template-guard.mjs

css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
```

### 4.2 外观全量隔离测试
```bash
npm run test:appearance
```
执行结果：
```json
{
  "passed": 104,
  "results": [
    "legacy settings retained with additive defaults",
    "legacy default brightness and mask retained as 70 and 45",
    "legacy brightness preserved: 20",
    "legacy brightness preserved: 70",
    "legacy brightness preserved: 100",
    "cold boot clamps stored candidate brightness 200 to 120 preserving other settings",
    "clamped stored brightness 200 projects 1.2 to CSS",
    "the fixture second scene is selectable",
    "clicking a second scene changes the real controller selection",
    "picker selection is persisted through the real controller",
    "a subsequent picker render highlights the chosen scene",
    "a fresh plugin instance retains the chosen scene",
    "invalid scene values cannot replace the saved selection: ../project.json",
    "invalid scene values cannot replace the saved selection: __proto__",
    "invalid scene values cannot replace the saved selection: we-zzzzzzzzzzzzzzzzzzzzzzzz",
    "invalid scene values cannot replace the saved selection: null",
    "the real controller can switch the selection back to Lucy",
    "wallpaper presets row renders for Lucy with empty status",
    "save preset button enabled when target is idle/stopped and usable",
    "apply preset button disabled when no preset is saved",
    "delete preset button disabled when no preset is saved",
    "save button stores 4 appearance fields for Lucy",
    "preset is persisted to localStorage",
    "preset snapshot is frozen against external mutation",
    "UI reflects preset saved for Lucy",
    "apply and delete buttons enabled once preset is saved",
    "controller saves preset for scene B",
    "A and B presets are strictly isolated",
    "apply button restores Lucy preset appearance",
    "applied preset projects to CSS variables",
    "preset apply preserves weScene, weMode, and weAutoStart",
    "delete button removes Lucy preset",
    "deleting Lucy preset leaves scene B preset intact",
    "deleting preset leaves current slider values unchanged",
    "UI reflects preset deleted",
    "all preset buttons disabled when active wallpaper mismatches selection",
    "controller rejects save when active scene mismatches selection",
    "controller rejects apply on mismatch",
    "controller rejects delete on mismatch",
    "buttons disabled during starting transition",
    "controller rejects save during transition",
    "buttons disabled on cleanup-failed",
    "controller rejects save on cleanup-failed",
    "cold boot clamps stored candidate high brightness 200 to 120",
    "cold boot reloads scene B preset correctly",
    "corrupted presets JSON safely defaults to empty library",
    "reading bad JSON does not overwrite stored string",
    "unsupported schema version safely yields empty library",
    "Lucy preset saved before global reset",
    "global reset restores appearance defaults",
    "global reset preserves preset library",
    "global reset keeps preset in localStorage",
    "save rejects with storage-failed when localStorage throws",
    "delete rejects with storage-failed when localStorage throws",
    "storage write failure does not corrupt in-memory preset",
    "controller presets reject operations once disposed",
    "four palettes produce distinct computed accent colors",
    "all four palette buttons are connected",
    "no file input is offered while no background is selected",
    "the selected source offers its file input",
    "range settings clamp",
    "clamped brightness 120 projects 1.2 to CSS",
    "lower clamped brightness 20 projects 0.2 to CSS",
    "controller accepts brightness 110 and projects 1.1",
    "controller accepts brightness 120 and projects 1.2",
    "invalid and prototype settings ignored",
    "mask 0 projects 0 without changing brightness",
    "mask 90 projects 0.9 without changing brightness",
    "real PNG decoded and background mounted once",
    "background cannot intercept clicks",
    "clear canvas stays transparent with background",
    "surface slider reaches rendered surface opacity",
    "composer remains opaque",
    "four background sliders are connected",
    "brightness slider has min 20, max 120, step 1",
    "slider onChange updates brightness to 110",
    "slider onChange projects --wm-bg-brightness to 1.1",
    "slider onChange persists brightness 110",
    "slider output displays 110%",
    "slider onChange updates brightness to 120",
    "slider onChange projects --wm-bg-brightness to 1.2",
    "slider onChange persists brightness 120",
    "slider output displays 120%",
    "brightness hint explains 100% baseline and further brightening",
    "mask hint explains theme base overlay",
    "invalid replacement preserves saved image",
    "quota failure preserves prior media and reports an error",
    "storage read failure restores plain theme",
    "stored media reloads after storage recovers",
    "background survives switching to Mist",
    "host theme reset is repaired",
    "dispose removes media URLs and projections",
    "new plugin instance reloads saved blob from real IndexedDB",
    "new plugin instance reloads saved brightness 120 and projects 1.2",
    "reset during import does not reenable background",
    "reset restores default brightness 70 and projects 0.7",
    "reset preserves chosen media",
    "removing active media restores theme",
    "real WebM decoded and plays muted in a loop",
    "focus policy pauses on blur",
    "reduced motion pauses video",
    "reduced transparency hides backdrop",
    "rapid switches discard stale loads and URLs",
    "disposal cancels pending loads"
  ]
}
```

### 4.3 场景选择与自动启动边界检查
```bash
node qa/appearance-regression.mjs --scene-selection-only
```
执行结果：
```json
{
  "sceneSelection": [
    {
      "changed": false,
      "starts": 1,
      "bodies": [
        {
          "scene": "lucy",
          "mode": "daily"
        }
      ]
    },
    {
      "changed": true,
      "starts": 0,
      "bodies": []
    }
  ]
}
```

---

## 5. 环境状态与边界保持

- **日常安装**：继续保持 `rc.31` 运行基线；不执行打包（tgz）、不安装包、不热改运行目录文件。
- **工作区状态**：manifest 与原生 assets 保持 `rc.30` 冻结；源码包含 P4/Trace 及 120% 亮度与预设功能，供后续功能包统一审计交付。
- **未验收/后续规划**：
  - 自动随播放切换壁纸外观预设（计划在 P2 接入）。
  - 主题/调色板（Palette）/区域底色等多维度完整预设。
  - 独立命名管理、预设导入导出。
- **分支与提交**：按工作流规则，保持现有改动与文档未提交状态，等待 Codex 复审。
