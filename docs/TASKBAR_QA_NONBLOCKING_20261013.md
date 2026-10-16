# C1 QA 非阻塞 Worker 修复与离线验收报告

2026-10-13，Antigravity。依据 [`docs/GEMINI_NEXT_C1_NONBLOCKING_QA_20261012.md`](file:///F:/dsh-wallpaper-plugins/docs/GEMINI_NEXT_C1_NONBLOCKING_QA_20261012.md) 与 [`docs/C1_TASKBAR_DESKTOP_SHORT_TEST_20261012.md`](file:///F:/dsh-wallpaper-plugins/docs/C1_TASKBAR_DESKTOP_SHORT_TEST_20261012.md)，完成 C1 任务栏按钮移除 QA 工具的**非阻塞后台 Worker 执行与收尾门禁同步**改造，并在全新目录完成全量离线验证。

**安全边界与承诺确认**：
- **日常环境未动**：`rc.24`（`dsh-whale-mist-0.6.0-rc.24.tgz`）与 Desktop Profile 严格未动。
- **纯离线验证**：未开启真实 Wallpaper Engine 窗口、未调用真实 Shell `ITaskbarList`、未安装或改写生产包、未执行 `git commit`/`push`。
- **全新证据目录**：[`F:\dsh-wallpaper-plugins\.tmp\taskbar-nonblocking-20261013-e34ddf3a`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a)。

---

## 一、核心修改点

### 1. [`TaskbarHideStrategy.cs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideStrategy.cs)：非阻塞触发、时序分离与有界收尾
- **非阻塞帧入口 [`OnFrameAsync`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideStrategy.cs#L197-L284)**：
  - 满足“已有真实编码且发布的 JPEG 帧 + 达到 `minSeconds` + 未请求停止”时，在 `_sync` 锁内原子置位 `_attempted = true`、`_actionCompleted = false`、`_cleanupSafe = false`、`_stage = "action-pending"`，写入初始 `"action-pending"` 报告（`pending: true, succeeded: false, completedAtSeconds: null, postActionFrame: null`），并通过 `Task.Run(RunActionCore)` 在后台启动动作，主捕获循环立即返回继续抓帧、编码和发布。
  - 动作前窗口枚举（`_probe.Inspect`）、子进程启动与等待（`Execute`）、动作后窗口枚举全部移出捕获主循环线程。
- **在飞帧统计与完成帧严格分离**：
  - Worker 在飞期间（`!_actionCompleted`），后续已发布帧累加 `_framesWhilePending` 并返回 `"action-pending"`，绝不重复启动第 2 个 Worker，也绝不把在飞帧冒充为动作完成后的帧。
  - Worker 完成后记录 `_completedAtSeconds` 与 `_completedAfterFrameSequence = _lastObservedSequence`；此后首帧满足 `frame.Sequence > _completedAfterFrameSequence` 的已发布帧才写入 `_firstFrameAfterAction`（即报告中的 `postActionFrame`）。
- **有界收尾与清理门禁 [`SettlePending`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideStrategy.cs#L467-L514) / [`CanCloseOwned`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideStrategy.cs#L520-L542)**：
  - `SettlePending(timeoutMs, requestStop)` 先传播停止信号（`_stopRequested = true`），再按有界超时等待 `_pendingAction`。
  - 若超时未收敛或 Worker 退出未确认，锁定 `_settled = true`、`_cleanupSafe = false`、`_stage = "action-unconfirmed"` 并落盘；即使被放弃的后台线程稍后返回，也会因 `_settled` 门禁直接丢弃，不会篡改未确认状态。
  - `CanCloseOwned()` 在 `_pendingAction` 未完成或 `!_cleanupSafe` 时一律拒绝关闭源窗口。

### 2. [`TaskbarQaRuntime.cs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarQaRuntime.cs)：主循环非阻塞接入与 `Finish()` 同步收尾
- **[`AfterFrame`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarQaRuntime.cs#L106-L111)** 直接调用 `_strategy.OnFrameAsync(...)`，使生成后的 `Program.cs` 捕获主循环无需阻塞等待 Worker。
- **并发写入互斥 [`TryWrite`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarQaRuntime.cs#L81-L95)**：通过 `_writeSync` 串行化后台完成回调与主线程 `Finish()`/`WriteReport()` 对 `taskbar-action.json` 的落盘，杜绝并发截断或文件共享冲突；保留任何一次写失败置 `_reportFailed = true` 与 `Environment.ExitCode = 1` 的 R3 门禁。
- **[`Finish()`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarQaRuntime.cs#L117-L161)**：
  - 进入时立即置 `_stopping = true`（通过 `ExternalStopRequested` 向在飞 Worker 监控循环传播取消信号），并调用 `_strategy.SettlePending(SettleTimeoutMs, requestStop: true)`。
  - 待在飞 Worker 被终止并确认退出后，再执行 `CanCloseOwned()` 与源窗口关闭；若 Worker 退出未确认，拒绝关窗（`outcome = "not-confirmed", closed = false`）并以非零退出码结束。

### 3. 离线自检与回归脚本扩充
- [`TaskbarHideSelfTest.cs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideSelfTest.cs#L315-L377)：新增阻塞式 Fake Worker 策略级测试，验证 `action-pending` 期间连续多帧通过、`triggeredAtSeconds < completedAtSeconds`、`completedAfterFrameSequence` 之前的帧不入 `postActionFrame`、完成后首帧记录 `postActionFrame`。
- [`TaskbarRuntimeSelfTest.cs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarRuntimeSelfTest.cs#L200-L350)：新增 Runtime 级非阻塞回归，覆盖在飞多帧继续发布、在飞期间 `duration-expiry` / `bound-stop` / `frame-stop` / `capture-exception` 四类收尾路径，以及 `kill-unconfirmed` / `settle-timeout` 两类未确认拒绝关窗路径。
- [`check-generated.mjs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/check-generated.mjs)：从生成的 `generated/Program.cs` 中直接提取 `AfterFrame` 帧发布钩子与外层 `try/catch/finally` 共同编译执行，在原有 13 个生命周期阶段基础上新增 5 个非阻塞生成帧循环阶段（`PendingFramesThenComplete`、`PendingDurationExpiry`、`PendingStopSignal`、`PendingCaptureException`、`PendingUnconfirmedBlocksClose`）。
- [`check-worker.mjs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/check-worker.mjs)：新增 `hold-until-release` 真实无窗口控制台子进程后台运行检查，验证子进程在飞期间父循环推进 4 帧后再释放子进程并确认退出。
- [`dsh-whale-mist/qa/taskbar-hide/README.md`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/README.md)：同步更新非阻塞执行说明与 `taskbar-action.json` 字段文档。

---

## 二、离线验证结果与证据路径

证据根目录：[`F:\dsh-wallpaper-plugins\.tmp\taskbar-nonblocking-20261013-e34ddf3a`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a)

| 检查项 | 命令 / 入口 | 退出码 | 结果 | 证据文件 |
| --- | --- | --- | --- | --- |
| 隔离构建 | `node dsh-whale-mist/qa/taskbar-hide/build.mjs --output .../build` | `0` | `acceptedUnchanged: true` | [`build-result.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/build/build-result.json)、[`build.log`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/build/build.log) |
| 全量离线自检 | `WallpaperProbeTaskbarQa.exe --taskbar-self-test` | `0` | **104 / 104 PASS**（原 92 项 + 新增 12 项非阻塞检查） | [`selftest.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/selftest.json)、[`selftest.log`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/selftest.log) |
| 选项自检 | `WallpaperProbeTaskbarQa.exe --taskbar-self-test-options` | `0` | **14 / 14 PASS** | [`selftest-options.log`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/selftest-options.log) |
| COM 包装自检 | `WallpaperProbeTaskbarQa.exe --taskbar-self-test-com` | `0` | **7 / 7 PASS** | [`selftest-com.log`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/selftest-com.log) |
| Worker 坏参数门禁 | `WallpaperProbeTaskbarQa.exe --taskbar-worker 42 7` | `2` | 拒绝访问桌面/COM 并输出结构化错误 JSON | [`worker-bad-argv.log`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/worker-bad-argv.log) |
| 生成代码生命周期与帧循环 | `node dsh-whale-mist/qa/taskbar-hide/check-generated.mjs` | `0` | **18 / 18 PASS**（13 项外层生命周期 + 5 项生成帧循环非阻塞检查） | [`integration.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/generated-check/bin/Release/net10.0-windows/integration.json)、[`result.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/generated-check/result.json) |
| 真实控制台子进程监控 | `node dsh-whale-mist/qa/taskbar-hide/check-worker.mjs` | `0` | **5 / 5 PASS**（含 `hold-until-release` 在飞推进 4 帧，`lateActions: 0`） | [`worker-check.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/worker-check/bin/Release/net10.0-windows/worker-check.json)、[`check.log`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/worker-check/check.log) |
| 受保护文件哈希核验 | 19 项受保护源码/资产/包/Profile SHA256 核对 | `0` | **19 / 19 全部一致（`unchanged: true`）** | [`protected-hashes.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/protected-hashes.json)、[`summary.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-20261013-e34ddf3a/summary.json) |

---

## 三、复审局部补修（F1–F3）与二次离线验收

依据 [`docs/TASKBAR_QA_NONBLOCKING_REVIEW_20261013.md`](file:///F:/dsh-wallpaper-plugins/docs/TASKBAR_QA_NONBLOCKING_REVIEW_20261013.md)，在不推翻非阻塞架构与退出保护门禁的前提下，完成了 F1、F2、F3 三个时序/取证问题的局部补修：

1. **F1 / P2（`postActionFrame` 采集时间 vs 发布时间边界）**：
   - [`TaskbarQaRuntime.AfterFrame`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarQaRuntime.cs#L106-L111) 将 `capturedAt` 传入 [`FrameObservation`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideStrategy.cs#L9-L17)。
   - [`TaskbarHideStrategy.CompleteTimingLocked`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideStrategy.cs#L618-L625) 在动作完成时记录与 WGC `frame.SystemRelativeTime.TotalMilliseconds` 同源的单调时钟界限 `_completedAfterSourceTimestampMs = Math.Max(_lastObservedSourceTimestampMs, SourceClockMs())` 及 `_completedAfterFrameSequence`。
   - 动作完成后发布的帧，必须同时满足 `frame.Sequence > _completedAfterFrameSequence` 且 `frame.SourceTimestampMs > _completedAfterSourceTimestampMs` 才能写入 `postActionFrame`；若某帧在动作完成前已由 WGC 采下、但在动作完成后才完成编码发布（在途编码帧），则单独计入 `preCompletionFramesPublishedAfter` 与 `lastPreCompletionFrameAfter` 并返回 `pre-action-frame`，绝不冒充动作完成后的新画面。
2. **F2 / P2（触发与完成秒数统一捕获时钟原点）**：
   - 触发时记录捕获时钟 `triggeredAtSeconds`、Runtime 时钟读数 `_triggeredNowSeconds` 与两钟起点偏移 `runtimeClockOffsetSeconds = Math.Round(_triggeredNowSeconds - _triggeredAtSeconds, 3)`。
   - 完成时间 [`CurrentCaptureSeconds`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideStrategy.cs#L627-L634) 按触发后的单调增量（`_triggeredAtSeconds + deltaSeconds`）计算，不再对不同起点的捕获钟与 Runtime 钟直接取 `Math.Max`，消除“完成后的帧 `elapsedSeconds` 比 `completedAtSeconds` 还早”的跨钟矛盾。
3. **F3 / P2（区分任务已调度 `actionScheduled` 与子进程已启动 `started`）**：
   - [`BuildPendingActionPayload`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideStrategy.cs#L636-L663) 显式区分 `actionScheduled: true`、`executorEntered: bool` 与子进程事实 `started: bool?`、`exited: bool?`。
   - 当后台任务尚在动作前 `_probe.Inspect(Hwnd)` 或尚未确认子进程启动时，报告写 `started: null, exited: null`（未知），不再硬编码 `started: true`。
   - [`TaskbarWorker.Run`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarWorker.cs#L31-L48) 在 `worker.Start(request)` 真正成功后触发 `onStarted` 回调（[`NotifyWorkerStarted`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideStrategy.cs#L157-L169)），此时才将 `started` 置为 `true`。
   - 若在动作前 `_probe.Inspect(Hwnd)` 期间收到停止请求，直接取消收尾而不调用 `Execute`，并如实记录 `executorEntered: false, started: false, exited: false, cancelled: true, cleanupSafe: true`。

### 二次离线验证证据（全新目录）

二次验收证据根目录：[`F:\dsh-wallpaper-plugins\.tmp\taskbar-nonblocking-r2-20261013-5d2fcd69`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69)（原首轮证据目录 `.tmp/taskbar-nonblocking-20261013-e34ddf3a` 完整保留）。

| 检查项 | 命令 / 入口 | 退出码 | 结果 | 证据文件 |
| --- | --- | --- | --- | --- |
| 隔离构建 | `node dsh-whale-mist/qa/taskbar-hide/build.mjs --output .../build` | `0` | `acceptedUnchanged: true` | [`build-result.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69/build/build-result.json)、[`build.log`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69/build/build.log) |
| 全量离线自检 | `WallpaperProbeTaskbarQa.exe --taskbar-self-test` | `0` | **109 / 109 PASS**（含 F1 在途旧帧过滤、F2 时钟偏移、F3 前置枚举阻塞与取消） | [`selftest.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69/selftest/selftest.json)、[`stdout.log`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69/selftest/stdout.log) |
| 生成代码生命周期与帧循环 | `node dsh-whale-mist/qa/taskbar-hide/check-generated.mjs` | `0` | **19 / 19 PASS**（13 项外层生命周期 + 6 项生成帧循环与 F1/F2/F3 检查） | [`integration.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69/generated-check/bin/Release/net10.0-windows/integration.json)、[`result.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69/generated-check/result.json) |
| 真实控制台子进程监控 | `node dsh-whale-mist/qa/taskbar-hide/check-worker.mjs` | `0` | **5 / 5 PASS**（`lateActions: 0, realShellActions: 0`） | [`worker-check.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69/worker-check/bin/Release/net10.0-windows/worker-check.json)、[`check.log`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69/worker-check/check.log) |
| 复审三项独立反例复测 | `dotnet run --project .../counterexamples-recheck/Check.csproj -c Release` | `0` | **3 / 3 反例全部消除**（`falselyMarkedPostAction: false`、`contradictoryTimeline: false`、`reportedStarted: null`） | [`recheck.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69/counterexamples-recheck/recheck.json) |
| 受保护文件哈希核验 | 19 项受保护源码/资产/包/Profile SHA256 核对 | `0` | **19 / 19 全部一致（`unchanged: true`）** | [`protected-hashes.json`](file:///F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-r2-20261013-5d2fcd69/protected-hashes.json) |

---

## 四、边界与下一步说明

1. **离线验证不等于真实桌面效果通过**：
   - 本轮离线测试证明了生成的 `Program.cs` 与 `TaskbarQaRuntime` 在 Worker 在飞期间不会阻塞主捕获帧循环，且 F1–F3 的取证时序（在途旧帧过滤、同一捕获钟原点、子进程真实启动状态区分）与退出保护门禁均已闭合。
   - 真实桌面下 `DeleteTab` 执行期间是否已完全消除 `3069ms` 断帧（满足 `gap <= 250ms`、任务栏图标消失、卡片持续播放、结束后干净关窗且日常 `rc.24` 不变），须在复审通过并与用户确认方便后，再进行一轮 40 秒受控桌面短验才能判定；本轮未声称已消除。
