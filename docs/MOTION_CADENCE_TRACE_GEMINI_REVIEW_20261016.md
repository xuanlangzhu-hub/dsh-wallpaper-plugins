# Motion Cadence Trace 深度代码审查与对照附评修复记录（2026-10-16）

日期：2026-10-16\
关联文档：
- [Codex 逐条核实附评](MOTION_CADENCE_TRACE_GEMINI_ASSESSMENT_20261016.md)
- [Codex 六审报告](MOTION_CADENCE_TRACE_SIXTH_REVIEW_20261016.md)
- [Codex 七审报告](MOTION_CADENCE_TRACE_SEVENTH_REVIEW_20261016.md)
- [运动节奏逐帧观测交付说明](MOTION_CADENCE_TRACE_DELIVERY_20261015.md)

---

## 一、 审查结论校准与七审收口（对照 Codex 独立附评与七审报告）

根据 [Codex 逐条核实附评](MOTION_CADENCE_TRACE_GEMINI_ASSESSMENT_20261016.md) 与 [Codex 七审报告](MOTION_CADENCE_TRACE_SEVENTH_REVIEW_20261016.md) 对照源码与真实 I/O 回放的验证，原 11 项发现按真实触发条件、严重度（均为 P2/P3 诊断完整性与资源卫生边界，不构成日常播放故障根因）校准并收口如下：

| 分组 | 编号与事项 | 核实结论与口径校准 | 本轮处理结果 |
| --- | --- | --- | --- |
| **1. 收尾一组 (P2)** | **G1 / G1-I/O** 停止与尾批跨真实 I/O 竞争<br>**G2** 自然结束 (`stream-end`) 尾批与 Host 导出 | **G1-I/O**：固定微任务排空（`Promise.resolve()` 循环）无法等待跨事件循环的真实 HTTP I/O（如 15ms 本地响应延迟），会导致 `/stop` 先关闭会话落盘而使后续尾批得 `409`；**G2**：自然 EOF 需既触发客户端 `isStop: true` 尾批，又在 Host 自然结束落盘前完成尾批摄取。 | **已修补并补齐真实 I/O 正反例（Test 3.15）**：移除客户端 24 轮微任务排空，`finalizeRunCadenceTrace(activeRun)` 改为纯非阻塞触发（置 `stopped = true`、发 `isStop: true` 尾批、挂 100ms 取消 deadline，`connect()` 自然 EOF 与 `stop()` 均不阻塞等待网络）；Host `CadenceTraceCollector` 新增有界收尾窗口 `waitForClientFinalize(100, issuedConnections)`，且仅当 `isStop === true && !(trailingUnsentCount > 0)` 时置 `stream.finalized = true`（多切片尾批未发完不提前结清）；`createPreviewSession.runClose()` 在完成原生进程与窗口清理后、置 `isClosed()` 与写盘导出前有界等待客户端尾批确认（`registerWallpaperRoutes.closeSession()` 对无内置排空的桩会话同样执行有界等待），既不让播放停止/原生资源释放等待网络，又确保 15ms 真实 HTTP 延迟、多切片尾批及自然 EOF 均完整落盘（204 + `available`），超 100ms 慢请求则如实返回 `409` 并降级为 `degraded`。 |
| **2. 身份/容量一组 (P2)** | **G4** 顶层信封 `generation`/计数校验与记录一致性<br>**G5 (L1-B-cap)** 32 流上限静默淘汰未完成状态 | **G4** 成立（七审已独立通过）：空尾批缺 `generation`、负 `generation`、错误健康计数类型、记录与信封 `generation` 不一致均须拒绝；**G5** 与六审 **L1-B-cap** 一致（七审已独立通过）：第 33 流淘汰不得静默丢掉未确认/未发证据。 | **七审已确认通过（Test 4.12、4.13 保持）**：`session.js` 严格校验顶层 `generation` 与健康计数，`appendBatch` 校验记录与信封 `generation` 一致，违规计入 `schemaViolationCount` 并返回 `400`；`clientStreams` 保持 32 上限，优先压缩已完成健康流，被迫淘汰流状态沉淀至 `evictedUnfinalizedStreams`、`evictedTrailingUnsentCount` 等有界摘要。 |
| **3. 分析一组 (P2)** | **G7 / G7-skip** Host 事件标量覆盖与同连接多条 skip 身份<br>**G8** Native/Host 字段校验与异域时钟过滤<br>**G9** 原生 `flushFailed` 健康标志语义 | **G7-skip**：同连接背压连续两次 `drain` 在同一 `(runId, connectionId, sequence)` 上先记 `latest-overwritten`、后记 `duplicate-sequence`，原 `checkDuplicate` 仅按 `runId:connId:gen:seq:event` 去重，会将第二条合法 skip 误判为重复事件并漏计 `hostDuplicateSkipCount`；**G8、G9** 七审已独立通过。 | **已修补并补齐正反例（Test 5.18、5.19）**：`analyze-motion-cadence.mjs` 在 `checkDuplicate` 中为 Host 事件纳入 `hostExtraKey`（`host-stream-skip` 附加 `${reason}:${skippedFrom}:${skippedTo}`，`host-stream-drain` 附加 `${atMonoMs}`），使真实 `FrameDecoder -> FrameHub -> streamFrames` 同连接同一序号上的 `latest-overwritten` 与 `duplicate-sequence` 均完整保留并计入各自指标（`duplicateEventCount = 0, state = 'available'`），同时完全相同的真重复 skip 记录仍被检出并触发 `duplicateEventCount = 1, state = 'degraded'`。G8/G9 保持通过。 |
| **4. 资源卫生小修 (P3)** | **G10** C# `CancellationTokenSource` 释放<br>**G11** Host 重入导出定时器清理与 `clientTrace` 降级同步 | **G10、G11** 七审已独立确认通过。 | **保持通过**：`CadenceTrace.cs` 在 `finally` 中安全调用 `cts.Dispose()`；`session.js` 的 `writeCadenceTrace` 重入分支清理 `reentrantTimer` 并在导出超时/失败时同步标记 `clientTrace.degraded = true`。 |
| **5. 撤回不成立推演** | **G3** 重连递增 `generation` 且旧流不完成<br>**G6** 同 `activeRun` 跨代重连健康计数翻倍<br>**G10 误删推演** 迟到清理越过门禁删新文件 | **已按附评核实撤回**：客户端 `connect()` 会调用 `resetRunMetrics()` 重建 `activeRun`，流重试不递增 `generation`；C# `_activePublishTask` 在 `TryDelete` 结束后的 `finally` 才释放，旧清理不会越过门禁误删新发布文件。 | **不作无效扩改**。 |

---

## 二、 具体代码修改清单

1. [`dsh-whale-mist/src/client.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/client.js#L1088-L1200)
   - `finalizeRunCadenceTrace(targetRun)` 设为同步非阻塞函数：标记 `targetRun.stopped = true`，启动 100ms `stop-deadline` 取消保护，触发 `flushCadenceTrace(targetRun, { isStop: true })`（或在途置 `cadenceTraceStopPending = true`），移除无效的 24 轮 `Promise.resolve()` 微任务循环。
   - 在 `connect()` 自然流结束分支（`!failed`）与 `stop()` 中直接调用 `finalizeRunCadenceTrace(activeRun)`（不 `await` 网络完成），保证播放停止与 UI 状态切换绝不等待不受控网络。

2. [`dsh-whale-mist/src/wallpaper/cadence-trace.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/wallpaper/cadence-trace.js#L41-L210)
   - `updateClientStream` 仅当 `update.isStop === true && !(update.trailingUnsentCount > 0)` 时将 `stream.finalized` 置为 `true`（多切片停止尾批若仍有 `trailingUnsentCount > 0`，保持 `finalized: false` 直至最后一片 `trailingUnsentCount === 0` 到达）。
   - 新增 `hasPendingClientFinalization(issuedConnections)`、`notifyFinalizationWaiters()` 与有界等待方法 `waitForClientFinalize(timeoutMs = 100, issuedConnections)`：当存在已签发连接或未完成流时，有界等待客户端完成尾批上报，收到最终尾批后由 `notifyFinalizationWaiters()` 立即唤醒，超时则立即放行并保留 `clientFinalized: false` 如实降级。
   - 保持 G4（`generation` 与计数器严格校验）与 G5 / L1-B-cap（32 流有界压缩与淘汰摘要）不变。

3. [`dsh-whale-mist/src/wallpaper/session.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/wallpaper/session.js#L250-L280) & [`session.js:840-855`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/wallpaper/session.js#L840-L855) & [`session.js:1220-1240`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/wallpaper/session.js#L1220-L1240)
   - `createPreviewSession.runClose()` 在 `hub.close()`、子进程退出与 `--window-ensure-closed` 原生窗口清理全部完成后，并在写入 `cleanupResult`（使 `isClosed()` 变为 `true`）及调用 `writeCadenceTrace()` 导出文件前，调用 `await clientTrace.waitForClientFinalize(100, issuedConnections)`，覆盖显式 `/stop` 与 Host 自然结束（G2）两条路径。
   - `registerWallpaperRoutes.closeSession()` 对未内置 `hasInternalCadenceDrain` 的外部注入会话（如受控路由桩），在 `current.stop()` 前先行关闭 `hub` 并调用 `await current.cadenceTrace.client.waitForClientFinalize(100, current.issuedConnections)`。
   - `POST /whale-wallpaper/cadence-trace` 在完成批次摄取与 `updateClientStream` 后调用 `clientCollector?.notifyFinalizationWaiters?.()` 立即唤醒收尾等待。

4. [`dsh-whale-mist/qa/perf/analyze-motion-cadence.mjs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/perf/analyze-motion-cadence.mjs#L110-L125) & [`analyze-motion-cadence.mjs:230-285`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/perf/analyze-motion-cadence.mjs#L230-L285)
   - `checkDuplicate(runId, connId, gen, seq, event, extraKey = '')` 扩展支持 `extraKey`：对 `host-stream-skip` 传入 `${r.reason ?? 'skip'}:${r.skippedFrom ?? ''}:${r.skippedTo ?? ''}`，对 `host-stream-drain` 传入 `String(r.atMonoMs)`，使同连接同一序号上的合法不同原因 skip（如首次 `drain` 的 `latest-overwritten` 与二次 `drain` 的 `duplicate-sequence`）不再被误判为重复事件，同时真重复记录仍准确检出并降级。

5. [`dsh-whale-mist/qa/wallpaper-probe/CadenceTrace.cs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/wallpaper-probe/CadenceTrace.cs#L153-L217)
   - 保持六审/附评已通过的 G9（`FlushFailed` 当次重置）与 G10（`cts.Dispose()`）实现不变。
