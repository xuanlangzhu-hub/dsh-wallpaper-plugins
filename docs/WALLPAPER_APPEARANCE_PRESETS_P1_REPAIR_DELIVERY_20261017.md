# 外观预设 P1 补修（R1 停止清理窗口 / R2 可用性边界）交付报告

日期：2026-10-17\
任务执行者：小G (Gemini)\
复审交接：Codex\
任务依据：`docs/WALLPAPER_APPEARANCE_PRESETS_P1_REVIEW_20261017.md`

---

## 1. 交付概览

针对 Codex 在 `docs/WALLPAPER_APPEARANCE_PRESETS_P1_REVIEW_20261017.md` 中复现并提出的两个 P2 级问题（R1 与 R2），已在前端和 Controller 层完成最小闭环补修，并补充了真实状态生命周期与假 Host 延迟测试：

1. **R1 [P2] 停止清理未完成时预设提前开放操作**：
   - 根因：`createWallpaperEngine:stop()` 发出 Host `/whale-wallpaper/stop` 前即发布 `stopped/idle` 状态，`resolvePresetTarget()` 仅根据状态字符串即判定已可编辑。
   - 修复：在 `createWallpaperEngine` 中引入 `cleanupPending` 状态标志、`activeStopGeneration` 请求轮次追踪及 `hasPendingCleanup()` 探针。停止在途期间保持 `cleanupPending: true`；Controller `resolvePresetTarget()` 与 UI 共享待清理屏障，一律返回 `{ ok: false, error: 'transition', state: 'stopping' }` 并禁用保存/应用/删除三按钮。清理成功确认后开放，清理失败保持拒绝；直接 `stop()`、`reset()`、背景切换等入口均严格闭合，旧轮次迟到回复不影响新轮次。

2. **R2 [P2] 未确认目录项可保存，已知不可用项绕过 UI 写入**：
   - 根因：UI 预设行使用 `!selectionKnownUnusable()` 误放行了 `pending` 状态；Controller `resolvePresetTarget()` 仅校验 ID 语法合法即放行，未校验受限目录/Host 确认快照。
   - 修复：在 `createWallpaperEngine` 中管理 `librarySnapshot` 及请求版本号 `libraryRevision`，仅在 Host 回复成功且就绪时冻结更新，刷新或失败时清除；`WhaleAppearanceSettings` 初始化自引擎快照并在就绪时同步；UI 闲置判定严格改为 `selectionUsable()`；Controller `resolvePresetTarget()` 引入 `checkSceneAvailability()`，对工坊目录项严格要求快照确认且 `available === true`，对未确认拒绝为 `scene-unconfirmed`、对不可用拒绝为 `scene-unavailable`；完整保留 Lucy 独立样例回退机制，但当 Host status 明确声明 Lucy 不可用时同样拒绝。

3. **测试与反例闭环**：
   - Codex 证据探针 `.tmp/wallpaper-appearance-presets-p1-review-20261017-b766789f/probe/appearance-regression.mjs --preset-review` 两项反例均从 `regressionObserved: true` 转为 **`regressionObserved: false`**。
   - `npm run check` 静态与 CSS 模板守卫通过。
   - `npm run test:appearance` 从原 104 项扩展为 **120 项全部通过**，涵盖真实 stop Promise 挂起延迟、未确认目录项拒绝、明确不可用目录项拒绝、Lucy 回退与 Host 明确不可用拦截、reset 待清理屏障测试。
   - `node qa/appearance-regression.mjs --scene-selection-only` 验证通过。

---

## 2. 详细改动清单

### 2.1 `dsh-whale-mist/src/client.js`

1. **`createWallpaperEngine` 状态与清理生命周期强化**：
   - 初始化增加 `status.cleanupPending: false`、`activeStopGeneration = 0`、`librarySnapshot = null`、`libraryRevision = 0`。
   - `stop(reason, { bump = true })`：
     - 记录 `activeStopGeneration = stopGeneration`。
     - 发出请求前发布 `emitStatus({ ..., cleanupPending: true })`。
     - `command("stop")` 结束时对比 `activeStopGeneration === stopGeneration`，当前轮次完成则重置 `activeStopGeneration = 0`。
     - 清理确认成功发布 `cleanupPending: false`；清理未确认或网络异常发布 `state: "cleanup-failed", cleanupPending: false`。
   - `start()` 与 `restart()`：
     - 清理前序停止轮次 `activeStopGeneration = 0`，发布 `cleanupPending: false`，避免旧 stop 迟到回复产生干扰。
   - `dispose()`：
     - 显式重置 `activeStopGeneration = 0`。
   - `readLibrary({ refresh, ensure, signal })`：
     - 递增 `libraryRevision`。若 `refresh: true` 先行清空旧快照 `librarySnapshot = null`。
     - 仅当轮次匹配且响应成功、载入完成（`result.state === "ready" && result.loaded`）时更新冻结快照 `librarySnapshot = Object.freeze(result)`；失败则重置为 `null`。
   - 暴露公共方法：
     - `hasPendingCleanup: () => Boolean(status.cleanupPending || activeStopGeneration !== 0)`
     - `getLibrarySnapshot: () => librarySnapshot`
     - `setLibrarySnapshot: (s) => ...`（仅接收合法 ready 快照或清空）

2. **`WhaleAppearanceSettings` 交互组件修正**：
   - `library` 状态初始化时优先读取 `controller.wallpaper.getLibrarySnapshot()`，避免组件初始空列表覆盖已有可用快照。
   - 当 `library?.loaded` 时将快照同步给 `controller.wallpaper.setLibrarySnapshot(library)`。
   - `wallpaperPresetsRow`：
     - 闲置状态可操作判定从 `!selectionKnownUnusable()` 修正为 `selectionUsable()`：
       `const usableInIdle = Boolean(targetResolution.ok && !isPlaying && selectionUsable());`
     - 提示信息分支补齐：
       - `targetResolution.error === "scene-unconfirmed"`：提示 `copy.selectedPending`（正在等待列表确认所选壁纸，确认前不能开始）。
       - `targetResolution.error === "scene-unavailable"`：提示 `copy.selectedUnavailable`（所选壁纸已不可用）。
       - `targetResolution.error === "transition"`：提示 `copy.presetBusy`（播放状态切换中，预设暂不可用）。

3. **`apply(ctx)` Controller 逻辑修正**：
   - 实现 `checkSceneAvailability(sceneId)`：
     - 语法不合法返回 `{ ok: false, error: "invalid-scene" }`。
     - `sceneId === "lucy"`：先查 `status.host.scenes` 与 `librarySnapshot.items`，若有 Lucy 且 `available === false` 或 host 整体不可用原因为 `"scene"`，则拒绝 `{ ok: false, error: "scene-unavailable" }`；否则保留已验证样例独立回退返回 `{ ok: true, targetId: "lucy" }`。
     - 工坊目录 ID：若快照未载入或未 ready 返回 `{ ok: false, error: "scene-unconfirmed" }`；若快照中不存在或 `available !== true` 返回 `{ ok: false, error: "scene-unavailable" }`；仅当 `available === true` 返回 `{ ok: true, targetId: sceneId }`。
   - `resolvePresetTarget()`：
     - 优先检查 `status.cleanupPending || wp.hasPendingCleanup()`，在途时一律返回 `{ ok: false, error: "transition", state: "stopping" }`。
     - `playing` 态且无 mismatch 时调用 `checkSceneAvailability(activeId)`。
     - `idle / stopped` 态时调用 `checkSceneAvailability(settings.weScene)`。
   - `controller.presets.save / apply / remove` 严格由 `checkPresetTarget` 拦截，全部遵守上述可用性与待清理屏障。

### 2.2 `dsh-whale-mist/qa/appearance-harness.js`

扩展预设套件，新增 16 项精准回归断言（总断言数由 104 增至 120）：
- **真实 stop Promise 挂起拦截（R1）**：通过真实 `c.wallpaper.stop('user')` 与延迟假 Host 回复，验证在挂起期间 `hasPendingCleanup() === true`、`resolveTarget` 返回 `transition/stopping`、UI 预设三按钮全禁用、Controller `save` 被拒绝；回复释放确认后 `hasPendingCleanup() === false`、`resolveTarget` 恢复可用。
- **未确认目录项拒绝（R2）**：验证目录未加载时 Scene B 的 UI 预设按钮禁用，Controller `save/apply/remove` 均被拒绝为 `scene-unconfirmed`。
- **已确认可用目录项放行（R2）**：快照确认可用后，按钮启用，Controller 保存成功并保持 A/B 隔离。
- **明确不可用目录项拒绝（R2）**：快照标记 `available: false` 后，UI 按钮禁用，Controller `save` 拒绝为 `scene-unavailable`。
- **Lucy 样例回退与明确不可用拦截**：无快照时 Lucy 回退可用；Host status 明确上报 Lucy 不可用时严格拒绝。
- **全局 Reset 停止待清理屏障**：验证 `c.reset()` 触发的 stop 在途期间同样维持 `hasPendingCleanup() === true`，避免清理空窗。

---

## 3. 验证证据与命令结果

### 3.1 Codex 缺陷复现探针验证
运行命令：
```bash
node .tmp/wallpaper-appearance-presets-p1-review-20261017-b766789f/probe/appearance-regression.mjs --preset-review
```
执行输出：
```json
{
  "isolated": true,
  "productionGetStatusNotReplaced": true,
  "realWeWindows": false,
  "rows": [
    {
      "case": "real-stop-promise-pending",
      "beforeStop": {
        "ok": false,
        "error": "transition",
        "state": "connecting"
      },
      "duringStop": {
        "state": "stopped",
        "hostActive": true,
        "target": {
          "ok": false,
          "error": "transition",
          "state": "stopping"
        },
        "buttons": [
          { "action": "preset-save", "disabled": true },
          { "action": "preset-apply", "disabled": true },
          { "action": "preset-delete", "disabled": true }
        ],
        "save": {
          "ok": false,
          "error": "transition",
          "state": "stopping"
        }
      },
      "afterStop": {
        "ok": true,
        "targetId": "we-bbbbbbbbbbbbbbbbbbbbbbbb",
        "isPlaying": false
      },
      "required": "all preset operations blocked until stop/cleanup settles",
      "regressionObserved": false
    },
    {
      "case": "unconfirmed-and-unavailable-selection",
      "unknown": {
        "target": {
          "ok": false,
          "error": "scene-unconfirmed",
          "sceneId": "we-bbbbbbbbbbbbbbbbbbbbbbbb"
        },
        "buttons": [
          { "action": "preset-save", "disabled": true },
          { "action": "preset-apply", "disabled": true },
          { "action": "preset-delete", "disabled": true }
        ],
        "save": {
          "ok": false,
          "error": "scene-unconfirmed",
          "sceneId": "we-bbbbbbbbbbbbbbbbbbbbbbbb"
        }
      },
      "unavailable": {
        "library": [
          {
            "id": "we-bbbbbbbbbbbbbbbbbbbbbbbb",
            "title": "Scene B",
            "type": "scene",
            "available": false,
            "playbackVerified": false,
            "reason": null
          }
        ],
        "buttons": [
          { "action": "preset-save", "disabled": true },
          { "action": "preset-apply", "disabled": true },
          { "action": "preset-delete", "disabled": true }
        ],
        "save": {
          "ok": false,
          "error": "scene-unavailable",
          "sceneId": "we-bbbbbbbbbbbbbbbbbbbbbbbb"
        }
      },
      "required": "unknown/pending selection blocked in UI; unavailable selection also blocked in controller",
      "regressionObserved": false
    }
  ],
  "requestCounts": {
    "/whale-wallpaper/status": 2,
    "/whale-wallpaper/start": 1,
    "/whale-wallpaper/stream": 1,
    "/whale-wallpaper/stop": 1,
    "/whale-wallpaper/library": 4
  }
}
```
**结论**：两项测试均确认 `regressionObserved: false`，R1 与 R2 缺陷已完全修复。

### 3.2 静态代码与模板语法守卫
运行命令：
```bash
npm run check
```
执行输出：
```text
> dsh-whale-mist@0.6.0-rc.30 check
> node --check src/index.js && node --check src/client.js && node --check src/wallpaper/session.js && node --check src/wallpaper/scenes.js && node --check src/wallpaper/catalog.js && node --check src/wallpaper/library.js && node qa/css-template-guard.mjs

css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
```

### 3.3 外观套件全量回归（120 项断言）
运行命令：
```bash
npm run test:appearance
```
执行输出（节选关键断言）：
```json
{
  "passed": 120,
  "results": [
    "... (原基础外观与预设断言)",
    "all preset buttons disabled when scene B is unconfirmed",
    "controller rejects save for unconfirmed scene B",
    "controller rejects apply for unconfirmed scene B",
    "controller rejects delete for unconfirmed scene B",
    "save preset button enabled for confirmed scene B",
    "controller saves preset for confirmed scene B",
    "A and B presets are strictly isolated",
    "all preset buttons disabled when scene B is explicitly unavailable",
    "controller rejects save for unavailable scene B",
    "... (应用、删除与 mismatch 断言)",
    "Lucy sample fallback allows Lucy preset operations without catalog entry",
    "explicit Lucy unavailable in host status rejects Lucy preset",
    "wallpaper hasPendingCleanup returns true during stop",
    "resolveTarget rejects during real stop promise pending",
    "preset buttons disabled during real stop promise pending",
    "controller save rejected during real stop promise pending",
    "wallpaper hasPendingCleanup returns false after stop resolves",
    "resolveTarget succeeds after real stop completes",
    "... (冷启动与持久化断言)",
    "Lucy preset saved before global reset",
    "global reset leaves no window during pending stop cleanup",
    "global reset restores appearance defaults",
    "global reset preserves preset library",
    "global reset keeps preset in localStorage",
    "... (其余外观与视频断言全部通过)"
  ]
}
```

### 3.4 场景选择与自动播放防抖检查
运行命令：
```bash
node qa/appearance-regression.mjs --scene-selection-only
```
执行输出：
```json
{
  "sceneSelection": [
    { "changed": false, "starts": 1, "bodies": [{ "scene": "lucy", "mode": "daily" }] },
    { "changed": true, "starts": 0, "bodies": [] }
  ]
}
```

---

## 4. 边界约束核对与状态保持

1. **日常安装保持冻结**：日常运行环境仍严格保持为 `rc.31`；未执行打包（tgz）、未执行安装、未改写运行目录。
2. **工作区状态保持冻结**：工作区 manifest 与原生 assets 保持 `rc.30`；无新版本号提升，无二进制重建。
3. **改动范围隔离**：修改仅限于前端渲染与控制器逻辑（`dsh-whale-mist/src/client.js`）及 QA 测试断言（`dsh-whale-mist/qa/appearance-harness.js`）。未修改 Host 或原生采集端代码。
4. **功能范围克制**：维持四字段（`brightness`, `mask`, `blur`, `surface`）范围、纯手动操作语义、120% 亮度上限、数据与 reset 隔离；未扩展到主题、底色预设或发布打包。
5. **工作流保持**：全部改动保留在本地未暂存/未提交状态，交付文档与 `NEXT_TASK.md` 准备就绪，等待 Codex 最终复审。
