# 前端性能观测 (P2) 交付记录

- **交付日期**: 2026-10-14
- **任务依据**: [GEMINI_NEXT_FRONTEND_PERF_P2_20261014.md](GEMINI_NEXT_FRONTEND_PERF_P2_20261014.md)
- **对应实测基线**: [COMPLEX_SCENE_P1_FOREGROUND_RESULT_20261014.md](COMPLEX_SCENE_P1_FOREGROUND_RESULT_20261014.md)
- **工作区**: `F:\dsh-wallpaper-plugins`
- **日常基线**: 保留 `0.6.0-rc.28`，不改动生产包、不改调度策略、不改动视频流水线、不作提高帧率承诺。

---

## 1. 实施内容与修改文件清单

| 文件路径 | 修改类型 | 职责与变更说明 |
|---|---|---|
| `dsh-whale-mist/src/client.js` | 核心实现 | 1. 注入单调时钟 `monotonicNow`（优先 `performance.now()`，不使用 `Date.now()` 墙钟差）。<br>2. 增加 27 项分阶段耗时与丢帧细分累计字段（Wait callback、Decode、Sync、Draw、Overwrite breakdown）。<br>3. 解耦异常处理：`createImageBitmap` 失败计入 `decodeFailCount` 与 `decodeErrors`；订阅者抛错计入 `syncErrorCount`，严禁污染解码失败计数。<br>4. 画布调用观测：在 `paintWallpaper` 中包裹 `drawImage` 耗时测量，上报 `recordDraw`；无图层、无 canvas、停止状态均安全提前退出且不虚计成功次数。<br>5. 待处理旧帧覆盖细分：在 `accept` 覆盖 `latest` 瞬间严格互斥区分为 `dropWaitingCallback`、`dropDecoding`、`dropSync`、`dropOther`，四者之和严格等于 `metrics.dropped` 增量。<br>6. 代际隔离与重置：`resetRunMetrics` 在新 run 开始时清零全部 27 项阶段计数；`stop()` 时记录未决回调取消数 `waitCancelledCount`；迟到解码和迟到 `recordDraw` 严格忽略，不污染新 run。<br>7. 导出 `createWallpaperEngine`、`createBackdrop` 与安全测试接缝 `acceptFrame`。 |
| `dsh-whale-mist/src/wallpaper/session.js` | 路由与协议 | 在 `/whale-wallpaper/metrics` POST 处理器白名单中补充全部 27 项新增指标，严格校验为有限非负数值，并在 2048 字节请求体上限内安全存储至 Session，保持对旧客户端的向后兼容。 |
| `dsh-whale-mist/qa/perf/watch-playback.mjs` | 观测采样器 | 在 `sanitizePreviewStatus` 中解析并保留全部 27 项客户端分阶段指标，对未提供或缺失字段保持 `null`，严禁虚构零值。 |
| `dsh-whale-mist/qa/perf/analyze-playback.mjs` | 离线分析器 | 1. 口径纠正：将 `clientThroughput` 的标签更正为“前端解码准备投递速率”，明确 `rendered` 发生在解码完成准备投递给订阅者阶段（进入 `paintWallpaper` 之前），不代表 canvas `drawImage` 或物理屏幕呈现。<br>2. 新增 `result.frontendStages` 计算：按段内样本差值计算均值（count=0 时严格为 `null`/unknown，仅实测到 0ms 允许 0；累计 max 明确标注为会话全局累计值，绝不冒充阶段 max 或 P95）；校验 `droppedBreakdownMatches`；段内计数回退即判 `valid: false` 并阻断。<br>3. 对比增强：在 `compareSegments` 中计算 `clientDrawRateFps` 与 `frontendStageDeltas`。<br>4. 报告渲染：在 `analysis.md` 中渲染“## 4. 前端分阶段耗时与丢帧分解”表格及覆盖分析表；更新“口径与边界说明”。 |
| `dsh-whale-mist/qa/perf/check-frontend-stages.mjs` | 专项目标测试 | 新增 8 类针对性验证套件，覆盖时钟延迟、超时兜底竞合与取消、覆盖分类互斥与求和、解码后丢弃、异常解耦、代际隔离、报文字节体积（实测 654 字节 < 2048 字节）以及观察器/分析器端到端接缝。 |
| `dsh-whale-mist/qa/perf/README.md` | 文档与规范 | 记录 P2 阶段指标定义、单位、零值语义、报文约束及 `check-frontend-stages.mjs` 测试套件执行说明。 |

---

## 2. 报文与指标字段定义（共 36 键，完整大小 654 字节）

客户端向 Host `/whale-wallpaper/metrics` 上报完整的 JSON Snapshot，实测体积极小（约 654 字节），远低于 2048 字节限制：

```json
{
  "received": 0,
  "rendered": 0,
  "dropped": 0,
  "sourceSequence": 0,
  "decodeErrors": 0,
  "seconds": 0,
  "meanLatencyMs": 0,
  "maxLatencyMs": 0,
  "hidden": 0,
  "waitRafCount": 0,
  "waitRafSumMs": 0,
  "waitRafMaxMs": 0,
  "waitTimeoutCount": 0,
  "waitTimeoutSumMs": 0,
  "waitTimeoutMaxMs": 0,
  "waitCancelledCount": 0,
  "decodeSuccessCount": 0,
  "decodeSuccessSumMs": 0,
  "decodeSuccessMaxMs": 0,
  "decodeFailCount": 0,
  "decodeFailSumMs": 0,
  "decodeFailMaxMs": 0,
  "discardHiddenCount": 0,
  "discardStaleCount": 0,
  "syncCount": 0,
  "syncSumMs": 0,
  "syncMaxMs": 0,
  "syncErrorCount": 0,
  "drawCount": 0,
  "drawSumMs": 0,
  "drawMaxMs": 0,
  "drawErrorCount": 0,
  "dropDecodingCount": 0,
  "dropSyncCount": 0,
  "dropWaitingCallbackCount": 0,
  "dropOtherCount": 0
}
```

### 字段分类与语义说明

1. **等待回调阶段 (Wait Callback)**
   - `waitRafCount`, `waitRafSumMs`, `waitRafMaxMs`: 从调用 `schedulePaint` 到该次 `requestAnimationFrame` 回调实际执行的单调耗时（毫秒）。
   - `waitTimeoutCount`, `waitTimeoutSumMs`, `waitTimeoutMaxMs`: 页面处于非合成/后台时，250ms 定时器兜底触发的实际执行耗时与次数。
   - `waitCancelledCount`: 安排了绘制但在回调执行前由于 `stop()` 或 `dispose()` 被取消的次数。
   - **竞合保证**: 每次安排只计一次，RAF 先执行即清除 timeout，timeout 先执行即取消 RAF。

2. **解码阶段 (Decode)**
   - `decodeSuccessCount`, `decodeSuccessSumMs`, `decodeSuccessMaxMs`: 等待 `createImageBitmap` 异步 Promise 成功解析的单调耗时与次数。
   - `decodeFailCount`, `decodeFailSumMs`, `decodeFailMaxMs`: `createImageBitmap` 失败的耗时与次数。
   - `discardHiddenCount`: 解码成功但完成时页面已切入 `document.hidden` 而丢弃并关闭 Bitmap 的次数。
   - `discardStaleCount`: 解码成功但完成时 run 已停止或已被新 generation 取代而放弃的次数。

3. **同步处理阶段 (Sync Notification)**
   - `syncCount`, `syncSumMs`, `syncMaxMs`: 广播 `emitFrame` 及 `emitStatus` 给同步订阅者的单调耗时。
   - `syncErrorCount`: 订阅者抛出异常的次数。严格与解码失败解耦，不影响 `decodeFailCount` 与 `decodeErrors`。

4. **画布绘制阶段 (Canvas Draw)**
   - `drawCount`, `drawSumMs`, `drawMaxMs`: `CanvasRenderingContext2D.drawImage` 同步调用的实际执行耗时与次数。
   - `drawErrorCount`: `drawImage` 抛出异常（如 GPU 上下文丢失）的次数。
   - **调用防线**: 无图层、无 canvas 节点或未运行状态均提前返回，不增加 `drawCount`。

5. **覆盖丢帧分解 (Dropped Breakdown)**
   当新帧进入 `accept()` 且待处理槽 `latest` 已有旧帧时，根据管线瞬时状态严格互斥分类：
   - `dropWaitingCallbackCount`: `painting === false && frameRequest !== 0`（等待 RAF 或兜底定时器执行期间被覆盖）。
   - `dropDecodingCount`: `painting === true && paintPhase === 'decoding'`（正在执行 `createImageBitmap` 异步解码期间被覆盖）。
   - `dropSyncCount`: `painting === true && paintPhase === 'sync'`（正在同步通知订阅者期间被覆盖）。
   - `dropOtherCount`: 其它偶发瞬时状态。
   - **恒等校验**: `dropWaitingCallbackCount + dropDecodingCount + dropSyncCount + dropOtherCount === metrics.dropped`。

---

## 3. 统计计算与边界原则

1. **均值与零值语义**:
   - 阶段均值按段内增量计算：`meanMs = sumDelta / countDelta`。
   - 若 `countDelta === 0`，均值严格为 `null` (unknown)，**绝不虚构为 0**。
   - 只有在段内实际测得耗时总和为 0ms 且有效计数大于 0 时，均值才允许为 `0`。
2. **累计值防伪冒**:
   - `cumulative*MaxMs` 字段为客户端会话级别的全局累计最大值，**严禁当作本测量阶段的实际最大值或 P95**。
   - 在未采集逐帧离散数据的情况下，分析器绝不伪造阶段 P95。
3. **回退与代际防御**:
   - 段内任一计数器若出现后一采样点数值小于前一采样点，立即标记 `frontendStages.valid = false` 并提示 `frontend_stages_counter_reset`。
   - 旧代际的迟到帧或迟到 `recordDraw` 调用直接抛弃，不能污染当前代际的统计指标。
4. **口径与因果防御**:
   - `rendered` 为前端解码准备投递计数，在进入 `paintWallpaper` 前统计；`drawCount` 为画布同步 `drawImage` 调用完成计数；两者均不等于物理屏幕呈现或 DWM 合成器呈现。
   - 待处理帧覆盖分类反映新帧到达时最新帧在前端管线中所处的状态，**不构成用户鼠标操作的因果结论**。

---

## 4. 离线验证执行与全套回归结果

在 `F:\dsh-wallpaper-plugins\dsh-whale-mist` 目录下执行全套离线验证与既有回归套件：

### 4.1 语法检查 (`node --check`)
- `node --check src/client.js` -> Exit code 0
- `node --check src/wallpaper/session.js` -> Exit code 0
- `node --check qa/perf/watch-playback.mjs` -> Exit code 0
- `node --check qa/perf/analyze-playback.mjs` -> Exit code 0
- `node --check qa/perf/check-frontend-stages.mjs` -> Exit code 0

### 4.2 P2 专项套件 (`check-frontend-stages.mjs`)
```powershell
node qa/perf/check-frontend-stages.mjs
```
**执行输出**:
```text
=== Starting Frontend Stages (P2) Verification Suite ===
--- Test 1: Stage delays & monotonic timing ---
✓ Test 1 passed: Stage delays and monotonic timing measured accurately.
--- Test 2: RAF vs Timeout backstop race & cancellation ---
✓ Test 2 passed: Timeout backstop single-execution and wait cancellation verified.
--- Test 3: Dropped overwrite classification ---
✓ Test 3 passed: Dropped overwrite categories mutually exclusive and sum exactly to dropped.
--- Test 4: Post-decode discards (hidden & stale) ---
✓ Test 4 passed: Hidden and stale generation post-decode discards verified.
--- Test 5: Error decoupling & canvas guards ---
✓ Test 5 passed: Errors strictly separated between decode, sync, and canvas draw.
--- Test 6: Run generation isolation & metric resets ---
✓ Test 6 passed: Run generation isolation and counter resets verified.
--- Test 7: Client snapshot payload size & Host route seam ---
✓ Test 7 passed: Payload size is 654 bytes (<2048) and Host route filters safely.
--- Test 8: Observer & Analyzer end-to-end seam ---
✓ Test 8 passed: Observer and Analyzer end-to-end seam completely verified.

======================================================
ALL FRONTEND STAGE (P2) VERIFICATION CHECKS PASSED!
======================================================
```

### 4.3 P1 回放性能全套回归套件 (`check-playback.mjs`)
```powershell
node qa/perf/check-playback.mjs
```
**执行输出**:
```text
=== Starting Playback Performance Verification Suite ===
Test evidence root: F:\dsh-wallpaper-plugins\.tmp\playback-perf-check-1791971511195-xa4neu
--- Test 1: Normal two-segment flow & CLI execution ---
✓ Test 1 passed: Normal two-segment flow verified with exact expected deltas.
--- Test 2: Client hidden/stale guards & true 0 increment vs duplicate ---
✓ Test 2 passed: Hidden/stale guards and true zero vs duplicate distinguished correctly.
--- Test 3: Sparse frame sequences & adjacent intervals ---
✓ Test 3 passed: Strictly adjacent frame sequence intervals verified; no false long gaps.
--- Test 4: Session identity, dimension gates & source foreground ---
✓ Test 4 passed: Comparability gates and native foreground semantics verified.
--- Test 5: Timing hierarchy & latency truthfulness ---
✓ Test 5 passed: Hierarchy notice and latency truthfulness verified.
--- Test 6: Robustness, schema rejection, existing dir & STOP sentinel ---
✓ Test 6 passed: Robustness, schema rejection, existing dir guard, and STOP sentinel verified.
--- Test 7: Review R1-R4 Counterexample Regression Suite (12 cases) ---
✓ Test 7 passed: All 12 review R1-R4 counterexample cases verified.
--- Test 8: Second Review F1-F4 Counterexample Regression Suite (8 cases) ---
✓ Test 8 passed: All 8 Second Review F1-F4 counterexample cases verified.
--- Test 9: Third Review G1-G3 counterexample cases ---
✓ Test 9 passed: All Third Review G1-G3 counterexample cases verified.

======================================================
ALL PLAYBACK PERFORMANCE TEST CATEGORIES PASSED!
======================================================
```

### 4.4 既有离线对比套件 (`check-compare.mjs`)
```powershell
node qa/perf/check-compare.mjs
```
**执行输出**:
```text
compare checks: 40/40 passed
evidence: F:\dsh-wallpaper-plugins\dsh-whale-mist\.tmp\perf\compare-check-20261014095304-20144
```

### 4.5 既有 Host 会话与路由回归套件
```powershell
node --test qa/wallpaper/routes.test.mjs
node --test qa/wallpaper/session.test.mjs
```
**执行输出**:
- `routes.test.mjs`: `pass 17 / fail 0` (100% 通过)
- `session.test.mjs`: `pass 37 / fail 0` (100% 通过)

---

## 5. 仍处于 Unknown 的范围与后续建议

1. **不可知范围（保持实事求是）**:
   - `drawImage` 返回耗时仅代表 Canvas2D 上下文同步操作耗时，GPU 光栅化及向 DWM 提交仍位于浏览器渲染管线深处，本轮离线插桩无法推断物理屏幕呈现时间。
   - 待处理旧帧覆盖发生在何处已能精确量化（等待回调 vs 解码中 vs 同步处理中），但该阶段丢弃是否与用户鼠标输入直接因果绑定，仍需依赖受控实测数据比对。
2. **下一步计划**:
   - 本交付单提交交由 Codex 进行离线复审。
   - 复审通过后，由用户安排一次真实环境下的短实测（例如对比前台静止与前台划动的分阶段耗时分布），根据实测数据定位瓶颈究竟在等待 RAF、解码还是同步处理，再做最小化针对性优化。

---

## 6. P2 复审局部补修记录 (R1–R4)

依据 [FRONTEND_PERF_P2_REVIEW_20261014.md](FRONTEND_PERF_P2_REVIEW_20261014.md) 复审意见，针对 4 处独立反例边界完成局部补齐：

### 6.1 补修内容对照

| 缺陷编号 | 问题位置 | 根因与修复说明 |
|---|---|---|
| **R1 (迟到解码污染新轮)** | `client.js: paint()` / `createWallpaperEngine()` | **根因**: 旧解码成功或失败在返回时直接修改闭包内共用的统计变量，随后才检查代际或完全未检查代际；旧 `paint` 的 `finally` 还会重置共用的 `painting` 状态。<br>**修复**: 引入 `createRunContext(gen)` 将每次运行的全部 27 项统计、`latest`、`painting`、`paintPhase` 及调度句柄完整封装在 `activeRun` 中；`paint(run)` 捕获当前 run 实体，在 `createImageBitmap` 异步等待返回后，若 `run !== activeRun`（新 run 已开始），立即安全关闭旧 bitmap 并返回，严禁修改新 run 的任何计数或调度状态。 |
| **R2 (订阅者异常位图泄漏)** | `client.js: paint()` | **根因**: 同步订阅者抛错后，`catch` 仅递增 `syncErrorCount`，随后无条件执行 `bitmap = null`，导致外层 `finally` 无法关闭尚未交接完成的位图。<br>**修复**: 仅当 `emitFrame` 及 `emitStatus` 真正成功执行后才将 `bitmap` 置为 `null`（移交所有权）；若订阅者抛错，`bitmap` 保持非空并在外层 `finally` 中严格调用 `bitmap?.close?.()` 安全释放。同时对 `measureHistory` 中 `document.querySelectorAll` 作防御保护。 |
| **R3 (RAF 句柄 0 取消不完整)** | `client.js: schedulePaint()` / `stop()` / `dispose()` | **根因**: 停用时采用 `if (paintFrameId)` 判断，导致合法句柄 `0` 被跳过未调用 `cancelAnimationFrame(0)`；旧回调执行时也缺乏自身归属代际检查。<br>**修复**: 调度对象捕获自身 `generation`、`startTime`、`cancelled`、`completed` 及句柄引用；取消与清理时严格检查 `rafId !== null` 与 `timeoutId !== null`，确保句柄 `0` 也被正确取消；回调执行时若已取消、已完成或 `run !== activeRun` 立即提前退出，严禁触碰或取消新 run 的调度安排。 |
| **R4 (覆盖总和不一致门禁)** | `analyze-playback.mjs: analyzeSegment()` / `compareSegments()` / `renderMarkdownReport()` | **根因**: 计算了 `droppedBreakdown.matches`，但 `frontendStages.valid` 仅参考 `clientThroughput.valid`，忽略了 matches 为 false 的情况。<br>**修复**: 当覆盖分类增量之和与总 dropped 增量不一致时，显式将 `result.frontendStages.valid` 判定为 `false`，并记录原因 `frontend_stages_dropped_mismatch`；在 `compareSegments` 中抑制 `frontendStageDeltas` 与 `clientDrawRateFps` 为 `null`；并在 Markdown 报告对比区给出告警提示，清晰说明“整体 P1 数据对比依然有效（dataReady），但不代表 P2 前端分阶段指标通过核对”。 |

### 6.2 Codex 独立反例套件与回归验证

1. **Codex 反例套件 (`counterexamples.mjs --expect-fixed`)**:
   ```powershell
   node .tmp/frontend-perf-p2-review-20261014-repair/counterexamples.mjs --expect-fixed
   ```
   ```text
   {"id":"positive-actual-stream-canvas","confirmed":true}
   {"id":"R1-late-decode-success","confirmed":false}
   {"id":"R1-late-decode-rejection","confirmed":false}
   {"id":"R2-bitmap-ownership-on-subscriber-error","confirmed":false}
   {"id":"R3-raf-zero-old-callback-new-run","confirmed":false}
   {"id":"R4-inconsistent-dropped-breakdown-still-comparable","confirmed":false}
   ```
   **结果**: 全部 5 项反例问题均确认已修复（`confirmed: false`），真实 canvas 正例保持通过（`confirmed: true`），脚本返回码 0。

2. **真实生产接缝控制套件 (`roundtrip-control.mjs`)**:
   ```powershell
   node .tmp/frontend-perf-p2-review-20261014-repair/roundtrip-control.mjs repairtrial2
   ```
   ```text
   {"passed":true,"samples":6,"bytes":669,"stagesValid":true,"actualDrawMeanMs":5}
   ```
   **结果**: 真实接缝（WHL1 流、controller 调度与解码、fake canvas drawImage、500ms 上报、POST metrics、GET status、watchPlayback、analyzeSegment）端到端通过，载荷 669 字节，有效 draw 耗时均值 5ms。

3. **专项目标测试 (`check-frontend-stages.mjs`)**:
   新增 `Test 9: Review R1-R4 Counterexample Regression Suite`，全套 9/9 大类全部通过。

4. **全量基线回归**:
   - `npm run check`: 语法与 CSS 模板全部通过。
   - `node qa/perf/check-playback.mjs`: 9/9 大类全部通过。
   - `node qa/perf/check-compare.mjs`: 40/40 项全部通过。
   - `node --test qa/wallpaper/routes.test.mjs`: 17/17 项全部通过。
   - `node --test qa/wallpaper/session.test.mjs`: 37/37 项全部通过。
