# 外观预设 P1 第二轮续修交付：R1 旧请求回调隔离与 R2 目录确认失效闭合

日期：2026-10-17\
执行人：小 G（PAIR ASSISTANT）\
复审依据：[WALLPAPER_APPEARANCE_PRESETS_P1_SECOND_REVIEW_20261017.md](WALLPAPER_APPEARANCE_PRESETS_P1_SECOND_REVIEW_20261017.md)\
关联历史交付：[WALLPAPER_APPEARANCE_PRESETS_P1_REPAIR_DELIVERY_20261017.md](WALLPAPER_APPEARANCE_PRESETS_P1_REPAIR_DELIVERY_20261017.md)

---

## 1. 续修完成概述

本轮续修针对 Codex 第二轮复审报告中指出的两项 P2 异步接缝缺口进行了最小闭环修复，未改动 Host、原生扩展或打包版本，保持 rc.30 工作区冻结及日常 rc.31 现状：

1. **R1 旧 stop 回复隔离与清理失败保护**：
   - 在 `wallpaper` 引擎中引入 `stopRevision`、`activeStopId` 和 `activeStopGeneration` 三重版本归属管理；
   - 在 `stop()` 的 `.then` 与 `.catch` 回调最顶端，严格执行 `const isCurrent = (activeStopId === stopId) && (generation === stopGeneration) && !disposed; if (!isCurrent) return status;`；
   - 彻底拒绝迟到的旧 stop 成功、失败或异常回复修改 `lastCleanup`、修改 `state`/`error`/`host` 快照或发布 `emitStatus`；
   - 保证较新的 `cleanup-failed` 终态绝不被较旧的迟到成功回复冲掉，新 `start()`/`restart()` 正在进行的 `connecting` 状态绝不被旧停止回复误报为 `stopped`，预设屏障全程持续生效；
   - 在 `start()`、`restart()` 与 `dispose()` 统一清理 `activeStopId = 0; activeStopGeneration = 0;`，并在 `hasPendingCleanup()` 中严格纳管。

2. **R2 目录确认失效、UI 组件回写与异常失效闭合**：
   - 彻底移除了 `WhaleAppearanceSettings` 组件内部在 render 和 `useEffect` 中反向调用 `controller.wallpaper.setLibrarySnapshot(library)` 的逻辑，杜绝组件局部旧列表 `{ ...loaded, loading: true }` 在刷新等待期反向恢复已清空快照的隐患；
   - 引擎内部 `setLibrarySnapshot` 增加 `if (libraryRefreshing) return;` 保护，并显式拒绝 `s.loading === true` 的非最终快照；
   - `readLibrary()` 使用 `try ... catch` 完整包裹，在网络异常、fetch 拒绝或解析失败时，只要属于当前请求版本（`reqId === libraryRevision`），立即将 `librarySnapshot = null` 并复位 `libraryRefreshing = false`，杜绝异常保留旧确认。

---

## 2. 代码修改定位

### 2.1 `dsh-whale-mist/src/client.js`
- **行 1166–1206 (`readLibrary`)**：
  - 显式刷新时设置 `librarySnapshot = null; libraryRefreshing = true;`；
  - `try ... catch` 捕获所有网络与解析异常，在当前请求（`reqId === libraryRevision`）失败或抛错时无条件清除 `librarySnapshot = null` 并复位 `libraryRefreshing = false`。
- **行 1244–1295 (`stop`)**：
  - 引入递增 `stopRevision`，每次 `stop()` 生成唯一 `stopId` 并记录 `activeStopId`、`activeStopGeneration`；
  - `.then` 和 `.catch` 回调最前端进行强一致归属判定 `if (!isCurrent) return status;`；
  - 仅当前有效轮次才清空标识、记录 `lastCleanup` 并触发 `emitStatus`。
- **行 1363–1421 (`start`, `restart`)**：
  - 启动和重启时统一重置 `activeStopId = 0; activeStopGeneration = 0;`。
- **行 1425–1436 (`hasPendingCleanup`, `setLibrarySnapshot`, `dispose`)**：
  - `hasPendingCleanup` 纳入 `activeStopId !== 0 || activeStopGeneration !== 0` 统一判定；
  - `setLibrarySnapshot` 在 `libraryRefreshing` 或 `s.loading === true` 时拒绝写入，注入有效快照时自增 `libraryRevision`；
  - `dispose` 统一清空 `activeStopId = 0; activeStopGeneration = 0;`。
- **行 2270–2280 (`WhaleAppearanceSettings`)**：
  - 完全移除组件向引擎回写 `setLibrarySnapshot` 的调用。

### 2.2 `dsh-whale-mist/qa/appearance-harness.js`
- 将原基础 stop 测试扩充为包含 R1/R2 全面边界的测试矩阵：
  1. 单个 stop 挂起与正向恢复；
  2. 乱序 stop：较新 stop 失败（`cleanup-failed`），较旧迟到 stop 成功不冲掉失败，UI 与 controller 持续拦截预设；
  3. 迟到 stop 成功到达新 `start()` 过程，`connecting` 状态及 host 活跃快照不被覆盖，预设持续拦截；
  4. 迟到 stop 到达新 `restart()` 过程，状态不被覆盖；
  5. 刷新目录等待中，组件带有旧列表的 render 不会恢复快照，UI 按钮与 controller 一致拒绝，刷新完成后状态正确；
  6. 普通读取 fetch 网络抛错，快照立即失效，controller 拒绝操作；
  7. 非 ready 返回（如服务异常），快照清除并拒绝操作；
  8. 并发读取乱序（慢速旧请求迟到无法覆盖较新读取结果）；
  9. 目录恢复可用后，正向恢复保存/应用/删除。

---

## 3. 验证结果

### 3.1 语法守卫与 CSS 模板检查
```bash
npm run check
```
- 输出：`css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes`，退出码 0。

### 3.2 外观与预设全量回归测试
```bash
npm run test:appearance
```
- 输出：**159 项检查全部通过**（在原 120 项基础上增加 39 项强断言），退出码 0。
- 关键断言通过记录：
  - `state becomes cleanup-failed on newer stop failure`
  - `resolveTarget rejects with cleanup-failed on newer stop failure`
  - `save rejects with cleanup-failed on newer stop failure`
  - `preset buttons disabled on cleanup-failed`
  - `state remains cleanup-failed after delayed older stop success`
  - `resolveTarget still rejects with cleanup-failed after older stop success`
  - `save still rejects with cleanup-failed after older stop success`
  - `preset buttons remain disabled after older stop success`
  - `new start reaches connecting state`
  - `presets blocked during connecting transition`
  - `state remains connecting after delayed stop reply`
  - `presets remain blocked after delayed stop reply`
  - `save rejects after delayed stop reply`
  - `host active snapshot is not overwritten by delayed stop reply`
  - `host active state is preserved across stale stop reply`
  - `restart reaches connecting state`
  - `state remains connecting after delayed stop reply during restart`
  - `presets remain blocked after delayed stop reply during restart`
  - `scene B confirmed available initially`
  - `library snapshot cleared when refresh starts`
  - `resolveTarget returns scene-unconfirmed during refresh`
  - `component render does not restore library snapshot during refresh`
  - `preset buttons remain disabled during catalog refresh render`
  - `controller rejects save for scene-unconfirmed during refresh`
  - `controller rejects apply for scene-unconfirmed during refresh`
  - `controller rejects delete for scene-unconfirmed during refresh`
  - `controller rejects save for scene-unavailable after refresh finishes`
  - `catalog fetch throws network error`
  - `snapshot cleared on catalog network exception`
  - `resolveTarget returns scene-unconfirmed after network exception`
  - `controller rejects save after network exception`
  - `catalog read returns non-ready failed state`
  - `snapshot cleared on non-ready catalog response`
  - `resolveTarget returns scene-unconfirmed on non-ready response`
  - `controller rejects save on non-ready catalog response`
  - `newer fast read sets scene B unavailable`
  - `older slow read cannot overwrite newer catalog snapshot`
  - `controller recovers and confirms scene B available`

### 3.3 场景选择守卫
```bash
node qa/appearance-regression.mjs --scene-selection-only
```
- 输出：未改动选择启动 1 次，切换过选择不自动启动，退出码 0。

### 3.4 复审查验探针复跑
使用 Codex 复审留存的独立探针验证：
```bash
node .tmp/wallpaper-appearance-presets-p1-repair-review-20261017-cfd5087d/probe/appearance-regression.mjs --preset-review
```
**结果**：
- `old-stop-success-after-new-stop-failure`: `regressionObserved: false`
- `old-stop-reply-after-new-start`: `regressionObserved: false`
- `refresh-old-ui-snapshot-resurrection`: `regressionObserved: false`
- `catalog-fetch-rejection-keeps-confirmation`: `regressionObserved: false`
全部 4 个接缝交错反例均不再复现（`regressionObserved: false`）。

```bash
node .tmp/wallpaper-appearance-presets-p1-repair-review-20261017-cfd5087d/probe/appearance-regression.mjs --original-preset-review
```
**结果**：
- 原首审基础两项反例保持 `regressionObserved: false`。

---

## 4. 交付与环境状态

1. **环境与工作区边界**：
   - 未改动任何 Host 或原生代码；
   - 未修改工作区 manifest、未修改 rc.30 版本号、未打包、未安装；
   - 日常运行环境保持冻结在 rc.31。
2. **功能与范围边界**：
   - 保持 4 字段外观预设（`brightness` 20–120、`mask` 0–90、`blur` 0–24、`surface` 40–100）；
   - 仅支持手动保存/应用/删除，不引入自动应用；全局重置不破坏预设存储。
3. **下一步交接**：
   - 请 Codex 依本文档与正式 QA 断言复审预设 P1 续修结果；
   - 待预设 P1 审核通过后，再行开展[主题可读性/强调色设计](THEME_READABILITY_ACCENT_DESIGN_NOTES_20261016.md)任务拆解。
