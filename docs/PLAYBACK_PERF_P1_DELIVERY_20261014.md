# 复杂壁纸回放性能测量工具（第一步 P1）交付报告

- **交付日期**: 2026-10-14
- **基线版本**: `0.6.0-rc.28`
- **执行原则**: 只读采样、离线分析、严格口径、数值断言检验、绝不修改日常播放实现。

---

## 1. 实际改动清单

本次交付聚焦于**只读测量工具与离线阶段分析**，不修改任何生产代码、不增加日常埋点或计数器、不修改 Profile/配置、不调用正式 helper、不枚举系统窗口或进程：

1. **`dsh-whale-mist/qa/perf/watch-playback.mjs`**:
   - 只读观测采样器，定期（默认约 1 秒，最长 120 秒）读取指定播放目录的 `status.json`、`preview-status.json`、`frames.jsonl`。
   - 记录单调时钟 `elapsedMs`、UTC 时间、读取耗时、文件 `mtime` 及大小。
   - 区分真正 0 增量（mtime/seconds 推进但帧计数未变）与陈旧重复读（mtime/内容相同未更新）。
   - 严格在总时限预算内等待（截断 sleep 至 `remainingMs`），即使指定超长 interval 也绝不超出总时限。
   - 保存有界的初末帧快照（`raw/frames-initial.jsonl` 与 `raw/frames.jsonl`）及对应读时刻与大小。
   - 严禁补 0 或虚构帧，缺失字段保持 `null`。
   - 支持输出目录内 `STOP` 哨兵文件或 SIGINT 优雅退出，原子创建输出目录（拒绝覆写）。

2. **`dsh-whale-mist/qa/perf/analyze-playback.mjs`**:
   - 离线阶段与区间分析器，接受 `observation.json` 与阶段清单 `segments.json`。
   - 严格区分原生处理送帧速率、Host 接收速率与前端绘制报告速率。
   - 实施全套严格门禁与输入校验：
     - **R1 可比性与条件**: 校验段内所有样本尺寸一致性（中间尺寸变动即阻断）；比对所有声明的固定条件（除预定自变量 `userManualMouseAction` 外均须一致）；DSH 前台条件不满足或客户端指标不可用时，整体判定 `dataReady = false` 与 `comparable = false`，绝不以虚假 true 掩盖缺口。
     - **R2 缺失与段内重置**: 校验各计数字段为有限数值，null/缺失保持未知，绝不因算术运算变成 0；遍历段内所有样本检测 Native、Host、Client 计数或秒数回退/重置；剔除重复 status 样本避免虚增耗时分布。
     - **R3 输入与容错**: 捕获 previewStatus 全缺异常，正常输出 inconclusive 报告保留 Native 行；严格校验负相对时间、非有限数值（如 `1e309`）与同序号冲突帧，坏输入退出码 3 且不留坏报告；全程保留并高亮 `state`（`real` vs `synthetic`）。
     - **R4 帧覆盖**: 输出相邻帧对数、覆盖时间跨度、阶段占比与充足性标记，无相邻对时明确说明，绝不把无数据写成 0 长停顿证据。
   - 输出结构化 `analysis.json` 与易审阅的 `analysis.md`。

3. **`dsh-whale-mist/qa/perf/check-playback.mjs`**:
   - 覆盖原 6 大类全部关键场景，并新增第 7 类覆盖全部 12 个 Codex 复审反例的端到端 CLI 回归测试。
   - 不调用实时硬件与真实窗口，完全基于合成 fixture 保证确定性与边界严密性。

4. **`dsh-whale-mist/qa/perf/README.md`**:
   - 补充 `watch-playback.mjs`、`analyze-playback.mjs` 与 `check-playback.mjs` 的使用说明、参数文档、字段口径、门禁规范与解释指南。

---

## 2. 数据 Schema 与指标口径

### 2.1 文件格式与 Schema

| 文件 | 用途 | 核心字段与规范 |
|---|---|---|
| `observation.json` | 观测归档 | `schemaVersion: 1`, `tool: "watch-playback"`, `state: "real" \| "synthetic"`, `session`, `summary`, `framesSnapshot`（含 initial/terminal 元数据与快照）, `samples[]` |
| `segments.json` | 阶段清单 | `schemaVersion: 1`, `userNamedScene`, `segments[]`（含 `startElapsedMs`/`endElapsedMs` 及 `conditions` 如 `userManualDshForeground`, `userManualMouseAction`, `expectedWidth`, `expectedHeight` 等） |
| `analysis.json` | 分析结论 | `schemaVersion: 1`, `state`, `status: { reportWritten, dataReady, inconclusive, reasons }`, `segments[]`, `comparison: { comparable, deltas, blockedReasons }`, `boundaries[]` |
| `analysis.md` | 人工审阅 | Markdown 表格与警示框，呈现数据来源高亮、阶段概览、各阶段耗时分布、相邻帧间隔与覆盖占比、差值对比及边界口径 |

### 2.2 核心指标口径与边界定义

1. **原生处理/送帧速率 (`nativeDeliveryRateFps`)**:
   - 计算公式: `(frames_end - frames_start) / (native_seconds_end - native_seconds_start)`。
   - 口径明确为：原生向 Host 管道每秒交付的帧数，**不是** Wallpaper Engine 的原生渲染 FPS。包含 WGC 采集、回读、JPEG 编码与管道传输全链路耗时。
2. **Host 接收速率 (`hostReceivedRateFps`)**:
   - 计算公式: `(received_end - received_start) / effective_seconds_delta`。
   - 记录 Host 端接收到的帧速率，`preview-status.json` 的 `updatedAt` 为画面到达 Host 时间，不是客户端上报时间。
3. **前端绘制报告速率 (`clientRenderRateFps`)**:
   - 计算公式: `(rendered_end - rendered_start) / (client.seconds_end - client.seconds_start)`。
   - **严格门禁**: 若区间内任意样本 `client.hidden === 1`，则判定为后台页面（此时丢帧属于前端主动停绘以节约能耗），不输出前台 FPS，标记 `client_hidden`；若 `client.seconds` 未推进，标记 `client_stale`；若计数缺失保持 null 不虚构为 0。
   - 明确 `rendered` 仅代表前端 canvas 执行 drawImage/createImageBitmap 次数，**不是** DWM 合成器实际向屏幕呈现的时间。
4. **原生各阶段耗时分布 (`acquireMs`, `readbackMs`, `jpegMs`, `packHashMs`, `pipeMs`, `encodeMs`)**:
   - 输出 Mean、P50 (中位数)、P95、Max。
   - 过滤重复 status 样本，避免因未刷新造成样本数虚高。
   - **层级关系说明**: `encodeMs`（整帧编码总耗时）已经包含了 `readbackMs`（回读等待）与 `jpegMs`（JPEG 编码）等耗时，**绝不能**把 `encodeMs + readbackMs + jpegMs` 再次求和作为总耗时；`sourceAgeMs` 语义不同，不可相加。
5. **帧间隔与长间隔 (`frameIntervals`)**:
   - 仅对帧日志中**严格相邻的序号**（`curr.frames === prev.frames + 1`）计算 `(b.seconds - a.seconds) * 1000`。
   - 稀疏抽样或历史序号跳跃（例如 1 → 2 → 30）**不计入**帧间隔统计，**绝不伪造**为 ≥250ms 的长停顿或断帧；无相邻对时明确标记覆盖不足，不将长停顿 0 视作流畅证据。
6. **延迟指标 (`latencyReference`)**:
   - `meanLatencyMs` 与 `maxLatencyMs` 为客户端自建立连接起至当前时刻的全局累计值，仅作参考；不伪造为本阶段的 P95 延迟，也不冒充鼠标到屏幕的端到端响应时间。
7. **对比差值门禁 (`comparison`)**:
   - 只有在以下门禁全部通过时才输出 `deltas`：
     - 会话一致性：同一 `runDir`、同一 `childPid`、同一 `window.location`（未发生重启）。
     - 尺寸一致性：相同 `width` 与 `height`，且两段各自内部无尺寸跳变。
     - 固定条件一致性：声明的 `userManualDshForeground`、`expectedWidth`、`expectedHeight`、`captureLimitFps` 等必须完全相等（除预定自变量 `userManualMouseAction` 外）。
     - 前台有效性：两段均须为前台（`userManualDshForeground: true`），且客户端指标均可用有效（`clientThroughput.valid: true`）。
     - 计数单调性：两段各自内部无计数回退或重置。
   - 门禁不满足时，`comparable = false`, `deltas = null`，并在 `blockedReasons` 中详细列明。

---

## 3. 命令与退出码

### 3.1 `watch-playback.mjs`
```powershell
node qa/perf/watch-playback.mjs --run-dir <run-dir> --output <new-dir> [--seconds 90] [--interval-ms 1000] [--state real|synthetic]
```
- 退出码 **`0`**: 采样结束并成功写入 `observation.json`（达到预定时长且不超时、检测到 `STOP` 哨兵文件、或收到 SIGINT 中断退出）。
- 退出码 **`2`**: 参数错误（缺少参数、`run-dir` 不存在、秒数非法）。
- 退出码 **`3`**: 输出目录已存在或无法创建（原子保护，拒绝覆写已有内容）。

### 3.2 `analyze-playback.mjs`
```powershell
node qa/perf/analyze-playback.mjs --input <observation.json|dir> --segments <segments.json> --output <new-dir>
```
- 退出码 **`0`**: 成功生成分析报告 `analysis.json` 与 `analysis.md`（报告内部通过 `dataReady: true|false` 和 `status.reasons` 说明数据是否充足可比）。
- 退出码 **`2`**: 参数缺失或调用方式错误。
- 退出码 **`3`**: 输入非法（损坏的 JSON、坏 schema、负数时间戳、非有限边界、同序号冲突帧等）或输出目录已存在（拒绝写入，不留半截报告）。

---

## 4. 首轮、二次与三次复审问题补修说明

### 4.1 首轮复审修复 (R1–R4)

| 编号 | 复审发现的反例缺陷 | 修复位置与机制 | 验证结果 |
|---|---|---|---|
| **R1** | 全部 `hidden=1` 仍标 `dataReady=true/comparable=true`；段内尺寸跳变仍放行；固定条件改变仍放行 | 在 `analyzeSegment` 中逐样本比对尺寸变动；在 `compareSegments` 中核验固定条件匹配（除预定自变量 `userManualMouseAction`）；客户端失效或非前台时前台比较 `dataReady = false` | `hidden-background-readiness`、`interior-size-change`、`changed-manual-conditions` 均判定 `dataReady=false, comparable=false` |
| **R2** | `rendered/received` 为 null 算成 0fps；段内计数/秒数重置漏检；重复状态重复进入耗时统计 | 校验数值合法性，缺失保持 null；遍历段内所有样本检测 Native/Host/Client 计数与秒数单调性，遇回退标记 reset 并置 invalid；剔除重复 status 样本 | `missing-client-counts` 保持 null 不出 0；`interior-client-reset` 与 `interior-native-reset` 准确捕获回退并阻断 |
| **R3** | `previewStatus` 全缺触发属性读取崩溃；负数时间与非有限数值（`1e309`）放行；冲突帧放行；合成数据未保留标记 | 增加可选链与空值保护，全缺正常生成报告（`dataReady=false`）；在校验器中严格检查 `elapsedMs >= 0`、`Number.isFinite` 与相同序号冲突帧，违规退出码 3；`state` 全程保留在根层级与 Markdown 顶端 | `missing-preview-reports` 退出 0 无异常；负时间、`1e309`、冲突帧均严格退出 3；`stateRetained: synthetic` |
| **R4** | `--seconds 0.1 --interval-ms 2000` 实际等待 2181ms 超限；初始帧无文件快照；覆盖率说明不足 | 在采样循环中截断 sleep 时间至 `remainingMs` 预算，保证时限严守；初末均保存有界帧日志快照及时间/大小元数据；分析器中计算帧覆盖时间与占比，无数据时不伪造长停顿 0 证据 | `watch-duration` 请求 100ms 在 118ms 内完成并标记 completed；帧覆盖率准确报告 |

### 4.2 二次复审修复 (F1–F4)

| 编号 | 复审发现的反例缺陷 | 修复位置与机制 | 验证结果 |
|---|---|---|---|
| **F1** | 采样循环在初次等待后提前退出（请求 2 秒约 129ms 即结束，sampleCount=1）；导出参数未校验，大文件未限界 | `stopReason` 初始置 `null`，仅当真正超时或接收 sentinel 时设置并退出；添加导出函数 `watchPlayback(options)` 参数合法性检查（`seconds` 0-120、`intervalMs` >= 10、`state`）；初末读取 `frames.jsonl` 施加 50MB 严格内存安全界限 | `multi-sample-duration` 2秒采样运行 2017ms，采集 17 个样本，`stopReason: 'completed'` |
| **F2** | 前台状态未知（缺失 `userManualDshForeground`）、可见性未知（`client.hidden = null`）或运行身份未知（`childPid/location = null`）时被默认放行 | `compareSegments` 要求严格 `userManualDshForeground === true`；`analyzeSegment` 区分 `hidden === 1`（`client_hidden`）与 `hidden !== 0`（`client_visibility_unknown`）；比对段内与全局 `childPid/location` 必须已知且非空一致 | `unknown-manual-foreground`、`unknown-client-visibility`、`unknown-run-identity` 均正确判定 `dataReady=false, comparable=false`，客户端指标保持 `valid: false` |
| **F3** | 原生/客户端时钟为 `null` 仍参与减法算出虚假速率（如 `12 - null = 12` 算出 1.67fps）；非有限数字（`1e309`）未在生成报告前拒绝 | 原生与客户端时钟差计算前必须确保所有相关样本时钟均为有限数值，缺时钟保持 `null` 速率并阻断前台比较；递归校验观测与清单所有数字，遇 `Infinity/NaN` 直接抛 `BadInput` 退出 3 且不留坏报告 | `missing-client-clock` 与 `missing-native-clock` 速率保持 null 且退出 0；`nonfinite-client-count` 严格退出 3 且未生成报告 |
| **F4** | 相邻对之间的稀疏跳跃未观察空档（如 100-101 与 119-120 仅覆盖 150ms / 2000ms = 7.5%）被误算为 100% 充分覆盖 | `computeAdjacentIntervals` 将首尾跨度 `coverageSpanSeconds` 与有效相邻区间并集覆盖时长 `coveredSeconds` 严格拆分；覆盖率取并集覆盖时长 / 段总时长；覆盖不足 50% 标记 `coverageAdequate = false`，不宣称阶段 P50/P95 差值 | `sparse-disjoint-frame-coverage` 正确输出有效覆盖 0.15s（占比 7.5%），`coverageAdequate: false`，两段差值保持为 null，长停顿数为 0 且明确说明稀疏跳帧不代表流畅 |

### 4.3 三次复审修复 (G1–G3)

| 编号 | 复审发现的反例缺陷 | 修复位置与机制 | 验证结果 |
|---|---|---|---|
| **G1** | 20秒观测窗口内客户端仅推进10ms（0.01s），即使采样1秒且文件时间戳新鲜，仍被报出100fps并判为全阶段可比（`dataReady=true, comparable=true`） | 在 `analyzeSegment` 中新增客户端推进覆盖率检测：`clientSecondsDelta / segDurationSec >= 0.5` 为充分；不足 50% 时标记 `coverageAdequate = false, valid = false`，说明不足以代表完整阶段；在 `compareSegments` 门禁 5 中阻断前台比较，输出 `dataReady = false, comparable = false`，差值置 `null` | `scant-client-progress` 与 `scant-client-progress-1s-sampling`（42样本）均正确阻断比较并判定 `dataReady=false, comparable=false`；全阶段推进且计数为0的真正 idle 依然正常输出 0fps 并通过比较 |
| **G2** | 去重后仅剩 1 份独立 status（其余为 duplicate 重复读），耗时统计却回退使用全量 3 份样本虚增统计 | 修正 `analyzeSegment` 耗时统计源：严格使用 `nonDuplicateStatus.map(s => s.status.data)`，严禁当去重样本数不足 2 时回退到 `validStatusSamples`；1 份独立样本时严格统计 1 个耗时样本并记录忽略 2 个重复样本 | `duplicate-only-one-unique-status` 准确输出 `observedSamples === 1`、`encodeMs.count === 1` 与 `duplicateSamplesIgnored === 2` |
| **G3** | 负数相对时钟（`client.seconds < 0` 或 `Native.seconds < 0`）被直接接受，未按非有限或越界坏输入拒绝 | 在 `validateObservation` 与 `analyzeSegment` 开头加入相对时钟与计数非负性校验（`seconds >= 0`、`frames/received/rendered >= 0`）；若小于 0 则抛出 `BadInput` 并在 CLI 退出码 3 且不落盘任何分析报告（保持缺失 null 为合法未知） | `negative-client-relative-clock` 与 `negative-native-relative-clock` 均返回退出码 3 且无分析报告输出 |

---

## 5. 数值检查与测试结果

运行完整测试套件 `node dsh-whale-mist/qa/perf/check-playback.mjs`：

```
=== Starting Playback Performance Verification Suite ===
Test evidence root: F:\dsh-wallpaper-plugins\.tmp\playback-perf-check-1791964334204-ac7asd
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

各分类具体验证内容：
1. **分类 1**: 同轮前台两段增量（Idle 15.0fps vs Mouse 10.0fps），CLI 端到端生成 `analysis.json` / `analysis.md`，精确验证差值 -5.0fps 与耗时增量 +10.0ms。
2. **分类 2**: `client.hidden = 1` 时客户端 FPS 为 `null`（原生送帧仍有效计算为 10.0fps）；客户端秒数未推进时判定 `client_stale`；mtime/秒数推进但帧数不变时合法输出 0.0fps；duplicate 样本不计作虚假 0fps。
3. **分类 3**: 序列 `[1, 2, 30, 31]` 仅计算 (1, 2) 与 (30, 31) 两个严格相邻对，跳步 2 → 30 绝不计入长停顿（`longGapsOver250ms === 0`）。
4. **分类 4**: 进程 PID 变更或窗口尺寸从 1302x776 变为 1920x1080 时阻断比较（`comparable: false`）；原生 `foreground = false` 仅作为源窗口属性，不误判 DSH 前台丢失。
5. **分类 5**: 严禁将 `encodeMs` (85ms) 与 `readbackMs` (62ms) + `jpegMs` (21ms) 再次相加求和（避免虚增为 168ms）；客户端累计最大延迟不伪造为区间 P95。
6. **分类 6**: 损坏的 JSONL 单行安全跳过不中断；坏 schema/负数时间使 CLI 退出码为 3 且不创建目录；已有输出目录拒绝覆写且原有文件完整保留；`STOP` 哨兵文件使 `watch-playback.mjs` 优雅退出并在 `observation.json` 中记录 `stopReason: "sentinel"`。
7. **分类 7 (首轮复审回归套件，12例)**:
   - `baseline`: 退出 0，`dataReady=true`，`state: synthetic`。
   - `hidden-background-readiness`: 退出 0，`dataReady=false, comparable=false`。
   - `missing-client-counts`: 退出 0，客户端速率保持 null 不虚构为 0。
   - `interior-client-reset`: 退出 0，段内客户端回退导致客户端速率为 null 并标记 reset。
   - `interior-native-reset`: 退出 0，段内原生回退导致 `dataReady=false, comparable=false`。
   - `interior-size-change`: 退出 0，段内尺寸跳变阻断比较。
   - `changed-manual-conditions`: 退出 0，固定条件不匹配阻断比较。
   - `missing-preview-reports`: 退出 0，安全生成报告不抛未捕获异常。
   - `negative-observer-time`: 退出 3，坏相对时间输入被拒绝且不建输出目录。
   - `conflicting-frame-records`: 退出 3，同序号时间戳冲突被拒绝且不建输出目录。
   - `nonfinite-segment-bound`: 退出 3，`1e309` 非有限数值被拒绝且不建输出目录。
   - `watch-duration`: 退出 0，请求 100ms 在 118ms 内受控完成，`stopReason: 'completed'`。
8. **分类 8 (二次复审回归套件，8例)**:
   - `unknown-manual-foreground`: 退出 0，缺少人工前台确认判定 `dataReady=false, comparable=false`。
   - `unknown-client-visibility`: 退出 0，`hidden=null` 判定 `dataReady=false`，客户端指标 `valid: false`。
   - `unknown-run-identity`: 退出 0，`childPid/location=null` 阻断比较（`comparable=false, dataReady=false`）。
   - `missing-client-clock`: 退出 0，客户端时钟为 null 不参与减法，速率保持 null，`dataReady=false`。
   - `missing-native-clock`: 退出 0，原生时钟为 null 不被强制转为 0，速率保持 null，`dataReady=false`。
   - `nonfinite-client-count`: 退出 3，`1e309` 非有限输入直接拒绝，不输出分析报告。
   - `sparse-disjoint-frame-coverage`: 退出 0，四帧两对仅覆盖 0.15s / 2.0s（7.5%），`coverageAdequate=false`，不报虚假 100% 覆盖。
   - `multi-sample-duration`: 退出 0，请求 2 秒实测持续 2017ms 采集 17 个样本，`stopReason: 'completed'`。
9. **分类 9 (三次复审回归套件，7例)**:
   - `scant-client-progress`: 退出 0，20s 观测内客户端仅推进 10ms，判定 `dataReady=false, comparable=false`，差值置 null。
   - `duplicate-only-one-unique-status`: 退出 0，1 份唯一样本加 2 份重复样本严格输出 1 个耗时样本与 2 个忽略重复，绝不回退至 3 份统计。
   - `negative-client-relative-clock`: 退出 3，客户端负数相对时钟直接拒绝且不生成报告。
   - `negative-native-relative-clock`: 退出 3，原生负数相对时钟直接拒绝且不生成报告。
   - `true-zero-with-progressing-client-clock`: 退出 0，客户端时钟跨整段推进但计数未增，合法输出 0fps 且通过可比性比较。
   - `export-parameter-validation`: `watchPlayback` 导出参数非法（`seconds: 0/121/NaN`、`intervalMs: 1`、`state: 'unknown'`）均抛出异常且不创建目录。
   - `stop-after-multiple-samples`: 退出 0，观测在多次采样后接收 `STOP` 哨兵，输出 `stopReason: 'sentinel'` 且样本数 ≥3。

既有测试回归兼容性：
- `node qa/perf/check-compare.mjs`: **40/40 passed**
- `node qa/perf/check-sampler.mjs`: **25/25 passed**

---

## 6. 重点保护文件指纹核对

7 项受保护文件在本次工作前后 SHA-256 哈希值完全一致，未被任何修改：

| 保护文件 | 期望 SHA-256 | 本次实测 SHA-256 | 状态 |
|---|---|---|---|
| `dsh-whale-mist/package.json` | `A0D2D83A3B7F14CB3A5180975D4C67FF9BB6B0AA7A6A1D3B98940A67B58E52D2` | `A0D2D83A3B7F14CB3A5180975D4C67FF9BB6B0AA7A6A1D3B98940A67B58E52D2` | 一致 |
| `dsh-whale-mist/src/client.js` | `4BD16FB8DBB4D3D135EFF8300EE71F0B25C6078174AC6846BAF325EFA4422182` | `4BD16FB8DBB4D3D135EFF8300EE71F0B25C6078174AC6846BAF325EFA4422182` | 一致 |
| `dsh-whale-mist/src/wallpaper/session.js` | `EA5829583129E2917B6718402B1CADBE2E8B480DF23C7DA8B0F2B70EF3821E5C` | `EA5829583129E2917B6718402B1CADBE2E8B480DF23C7DA8B0F2B70EF3821E5C` | 一致 |
| `dsh-whale-mist/qa/wallpaper-probe/Program.cs` | `D8FAA6B764D7559319ACD52E3194000073CCE0717C43F7C8767507781793AC7A` | `D8FAA6B764D7559319ACD52E3194000073CCE0717C43F7C8767507781793AC7A` | 一致 |
| `dsh-whale-mist/qa/wallpaper-probe/TaskbarHideRuntime.cs` | `A0E1FD3130C3DD041017A82BAD727FF453FB62D9665AAF21566AE6633E79A34F` | `A0E1FD3130C3DD041017A82BAD727FF453FB62D9665AAF21566AE6633E79A34F` | 一致 |
| `dsh-whale-mist/qa/wallpaper-probe/TaskbarHideStrategy.cs` | `27EF741D6358FB55F0D008C65A8D11822D6218E77FF1431685E3A1D2585EEA25` | `27EF741D6358FB55F0D008C65A8D11822D6218E77FF1431685E3A1D2585EEA25` | 一致 |
| `release/plugins/dsh-whale-mist-0.6.0-rc.28.tgz` | `58F5B6233882D269083D7E478B8ED920E690675A22F868B4BC0E4DD618B9F2FC` | `58F5B6233882D269083D7E478B8ED920E690675A22F868B4BC0E4DD618B9F2FC` | 一致 |

---

## 7. 当前阶段仍未知项与后续说明

1. **Wallpaper Engine 源端真实渲染 FPS 仍未知**:
   - 现有的捕获帧间隔和时间戳包含了采集丢帧与跳帧，不能直接反推出 WE 源窗口内部的 Draw/Present 真实帧率。
2. **DWM 合成器呈现到屏幕的物理时序仍未知**:
   - 前端上报的 `rendered` 计数代表 JavaScript 层面的 canvas 绘制完成，不代表显示器扫描线刷新呈现时刻。
3. **鼠标动作到画面的端到端物理响应时间仍未知**:
   - 本阶段不伪造未测量的物理延迟，仅依赖前端累计延迟基线。
4. **后续流程**:
   - 本三次复审补修（G1–G3）已全部完成，并通过 Codex 反例验证与 9 大类回归套件。
   - 复审确认后，可由用户与 Codex 在保持 DSH 前台的环境下进行短时间（约 20–30 秒）静止与（约 20–30 秒）鼠标移动实测，生成真实对照数据后再确定第二步最小优化。
