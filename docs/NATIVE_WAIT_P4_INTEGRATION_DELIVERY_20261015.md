# P4 原生局部等待接入交付与复审补修记录 (2026-10-15)

## 1. 任务概述与定位

本轮按照任务书 [GEMINI_NEXT_NATIVE_WAIT_P4_INTEGRATION_20261015.md](GEMINI_NEXT_NATIVE_WAIT_P4_INTEGRATION_20261015.md)、首轮复审 [NATIVE_WAIT_P4_INTEGRATION_REVIEW_20261015.md](NATIVE_WAIT_P4_INTEGRATION_REVIEW_20261015.md) 及二次复审报告 [NATIVE_WAIT_P4_INTEGRATION_SECOND_REVIEW_20261015.md](NATIVE_WAIT_P4_INTEGRATION_SECOND_REVIEW_20261015.md) 要求，已确认 R1（回退 Dispose 结清）、R2（当次 cancel 失败异常暴露）和 R3（工作区 rc.30 资产基准恢复与固定哈希门禁）独立复核闭合。本轮严格仅针对二次复审指出的 **F1（消除回退逐帧创建 linked CTS）** 与 **F2（提取并补齐正式 stdin stop/EOF 父停止共用接缝）** 进行局部收尾，并对报告中的精度数据表述进行严格口径澄清。不改写 P3 观测口径，不修改 RAF/JPEG 编码尺寸/自动播放名单，不处理壁纸响应鼠标移动的画面停顿问题。

> [!IMPORTANT]
> **关于鼠标联动停顿与目标帧率的明确边界：**
> 1. 用户反馈的“壁纸在响应鼠标移动时画面停住接近一秒”系源壁纸响应鼠标事件的画面行为与传输/显示延迟，尚未解耦分析，**本次等待方案接入绝不宣称该问题已修复，也不宣称前端卡顿已完全定位**。
> 2. 目标帧率维持 30fps，保留原有即时预算、整数截断规则、最低 1ms 下限及测量边界。
> 3. 空帧重试机制 `ExecuteEmptyRetryWaitAsync` 保持现有的 `2ms / Task.Delay`，避免将局部等待修改扩写为高频空帧轮询。

---

## 2. 核心架构与二次复审局部补修实现

### 2.1 生产级高精度等待组件与 F1 优化 (`NativePacingDelay.cs` / `KernelWaitTimer.cs`)

1. **`KernelWaitTimer.cs`**：
   - 封装 Windows 原生 `CreateWaitableTimerExW`（`CREATE_WAITABLE_TIMER_HIGH_RESOLUTION = 0x00000002`，最小同步+修改权限 `0x00100002`）。
   - 实现相对到期转换 `RelativeDueTime`（`checked(-10000L * milliseconds)`，限制 `1 <= ms <= 10000`）。
   - 内置看门狗超时保护与非阻塞预消费（`timer.WaitOne(0)`）防止信号残留。
   - **R2 修复保持**：跟踪 `primaryException`；当取消失败记录 `LastCancelError` 时，若当次无其他主异常则直接抛出 `Win32Exception(LastCancelError, "CancelWaitableTimer failed")`。

2. **`NativePacingDelay.cs` (F1 局部补修：消除回退逐帧创建 linked CTS)**：
   - **单线程与单请求约束**：每个实例最多 1 个后台计时线程（`Thread.IsBackground = true, Name = "Whale-Probe-PacingDelay"`），至多允许 1 个待处理等待请求（并发调用抛出 `InvalidOperationException`）。
   - **异步恢复解耦**：使用 `TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously)`，确保调用方的异步延续绝不执行在后台计时线程上。
   - **F1 优化实现**：
     - 首轮 R1 补修在回退模式下每次 `DelayAsync` 都调用 `CreateLinkedTokenSource(token, lifetime.Token)` 并在完成时释放，引入了逐帧取消源分配，违反了设计约束。
     - 本轮重构为 **实例作用域预绑定与等效无逐帧分配缓存复用**：
       1. 构造函数新增重载 `NativePacingDelay(bool forceFallback, CancellationToken parentToken)` 及 `NativePacingDelay(CancellationToken parentToken)`，在 capture 初始化时支持将稳定的 `stopSignal.Token` 预绑定一次；
       2. 在 `DelayAsync` 中校验 `if (fallbackLinkedCts is not null && !fallbackLinkedCts.IsCancellationRequested && token == lastFallbackToken)`：当 token 与当前已绑定的 token 一致且未触发取消时，**直接复用已有的 `fallbackLinkedCts.Token`**，完全消除每帧分配；
       3. 仅当外部传入不同 token 或前一个 token 发生取消后，才按需重新绑定；
       4. `Dispose()` 阶段统一释放 `fallbackLinkedCts`。
     - **断言与验证**：自测用例 `fallback-steady-state-zero-per-frame-allocations` 验证在 50 次连续 1ms 等待中，`FallbackLinkedCtsAllocations` 计数自始至终严格等于 1，稳态逐帧 CTS 分配彻底降为 **0**。

### 2.2 正式父停止与等待共用接缝 (F2 局部补修：`ParentStopChannel.cs` 与 `Program.cs`)

1. **`ParentStopChannel.cs`（新提取的正式共用组件）**：
   - 统一抽象管理从 `TextReader`（生产为 `Console.In`，测试为自定义模拟 Reader）异步监听行命令的循环。
   - 遇到 `"stop"` 命令或 stdin 流 EOF（`ReadLineAsync` 返回 `null`）时，受控调用 `cts.Cancel()` 触发父停止信号；安全处理 `ObjectDisposedException` 与 `IOException`。
   - 暴露公共接缝测试工具 `ParentStopChannel.ExecuteWaitUnderParentStopAsync`：在等待布置并处于 in-flight 状态时触发 `"stop"` 或 `EOF`，统一验证：
     - 等待中断并抛出 `OperationCanceledException`；
     - 捕获后归因为 `reason = "parent-stop"`；
     - `delay.Dispose()` 执行后工作线程退出（`IsStopped == true`）且内核句柄关闭（`IsHandleClosed == true`）；
     - 当满足 `canClosePredicate` 门禁时安全执行假接口源窗口清理回调。

2. **`Program.cs` 采集接入**：
   - 行 122 原内联 `Task.Run` 替换为共用实现：
     `using var parentStopChannel = ParentStopChannel.Start(Console.In, stopSignal, enabled: mode == "pipe");`
   - 行 175 传递父级 token 预绑定：
     `using var pacingDelay = new NativePacingDelay(parentToken: stopSignal.Token);`
   - 行 318 保持原委托注入：
     `ms => pacingDelay.DelayAsync(ms, stopSignal.Token)`
   - 保持原退出归因 `reason = "parent-stop"` 及源窗口保护清理逻辑不变。

---

## 3. 独立控制与故障注入验证

### 3.1 Codex 独立控制套件验证 (6/6 满足契约全部通过)

使用 Codex 提供的独立控制测试项目（`.tmp/native-wait-p4-review-20261015-135958-4004c01b/controls/Controls.csproj`）直接加载本次编译产物 `.tmp/p4-probe-build/WallpaperProbe.dll` 进行真实类型测试，结果如下：

| 测试用例名称 | 预期行为 | 实际观测结果 | 是否满足契约 (`meetsContract`) |
| :--- | :--- | :--- | :---: |
| **`fallback_dispose_accepted_wait`** (R1 反例) | Dispose 时立即取消已接收任务 | `completedWithin150Ms: true`, `cancelled: true`, `disposeMs: 1.3024ms`, `backend: "task-delay"` | **true** |
| **`fallback_parent_token_positive_control`** | 父级 token 取消时取消任务 | `outcome: "cancelled"` | **true** |
| **`native_cancel_failure_current_wait`** (R2 反例) | 取消失败时当次等待报错 | `outcome: "Win32Exception"`, `lastCancelError: 87`, `nextOutcome: "Win32Exception"` | **true** |
| **`worker_set_failure_positive_control`** | SetTimer 失败暴露异常 | `outcome: "Win32Exception"` | **true** |
| **`worker_watchdog_positive_control`** | 看门狗超时暴露异常 | `outcome: "TimeoutException"` | **true** |
| **`native_parent_cancel_positive_control`** | 父级取消安全退出并清理 | `outcome: "cancelled"`, `stopAndDisposeMs: 0.2646ms`, `stopped: true`, `handleClosed: true` | **true** |

### 3.2 内置自测套件 (54 项检查全数通过)

通过 `WallpaperProbe.exe --self-test-native-wait`（无窗口/无捕获环境）运行，**54 项检查全数通过**：

- **1–14 (组件与内核基础)**：`fallback-backend-name`、`fallback-is-not-highres`、`fallback-reason-recorded`、`fallback-no-thread-running`、`fallback-delay-executes`、`fallback-pre-cancelled-task`、`fallback-accepted-delay-running`、`fallback-dispose-cancels-accepted-delay`、`relative-100ns-due-time` (含 1ms/10ms)、`invalid-duration-rejected`、`high-resolution-requested`、`arm-failure-injection`、`watchdog-timeout-injection`。
- **15–28 (取消与并发边界)**：`cancel-error-recorded`、`next-wait-gated-on-cancel-error`、`pre-cancelled-does-not-arm`、`concurrent-wait-rejected`、`dispose-while-waiting-rejected`、`in-flight-five-second-wait-cancelled`、`twenty-cancel-and-rearm-cycles`、`native-handle-closed`、`disposed-wait-rejected`、`double-dispose-safe`、`worker-backend-name`、`worker-is-highres`、`worker-pre-cancelled-task`、`worker-caller-remains-asynchronous`。
- **29–41 (Worker 生命周期与 R2)**：`worker-concurrent-delay-rejected`、`worker-in-flight-cancellation`、`worker-twenty-cancel-and-rearm-cycles`、`worker-stopped-handle-closed`、`worker-disposed-delay-rejected`、`worker-cancel-failure-current-wait`、`worker-cancel-error-code-87`、`worker-armed-delay-dispose-completes`、`worker-accepted-delay-dispose-race-completes`。
- **42–43 (F1 逐帧 CTS 优化验证)**：
  - `fallback-prebound-cts-allocated-once`：验证构造时预绑定 CTS 分配计数为 1；
  - `fallback-steady-state-zero-per-frame-allocations`：验证 50 次稳态延时执行后分配计数依然为 1（逐帧新增为 0）。
- **44–54 (F2 正式父停止共用接缝验证)**：
  - `parent-stop-command-reason` / `parent-stop-command-delay-canceled` / `parent-stop-command-cleaned` / `parent-stop-command-mock-close`：验证原生等待在途接收 "stop" 命令的立即取消、归因与假接口清理；
  - `parent-eof-reason` / `parent-eof-delay-canceled` / `parent-eof-cleaned` / `parent-eof-mock-close`：验证原生等待在途遭遇 stdin EOF 的立即取消、归因与假接口清理；
  - `fallback-parent-stop-command-reason` / `fallback-parent-stop-command-delay-canceled` / `fallback-parent-stop-command-mock-close`：验证回退等待在途接收 "stop" 命令的立即取消、归因与清理；
  - `fallback-parent-eof-reason` / `fallback-parent-eof-delay-canceled` / `fallback-parent-eof-mock-close`：验证回退等待在途遭遇 stdin EOF 的立即取消、归因与清理。

---

## 4. 本机隔离对照测试数据与精度报告口径澄清

### 4.1 对照工具原始数据与逐轮门槛说明

在独立对照运行（`.tmp/p4-comparison-run-repaired/results.json`，原始 SHA256: `FBA6AB85945917BBC7FDC34F0A666AB92BC8EF2769BEBD637B363D6A35B1B3CB`）中，测试工具设置了严格的逐轮单队门槛（`precisionGoal: { meanExcessAtMostMs: 2, p95ExcessAtMostMs: 5, evaluatedCohorts: 24 }`）。

> [!IMPORTANT]
> **关于 `precisionGoal.passed = false` 的事实说明：**
> 1. 原对照工具的整体判定字段实际为 **`passed: false`**。
> 2. 原因是在评估的 24 个独立单轮队列中，有 4 个队列的尾部波动使单轮 P95 额外延时超出了 5ms 门槛：
>    - `kernel-highres-direct`（轮 0，10ms 请求）：额外均值 2.22ms，额外 P95 10.15ms；
>    - `kernel-highres-direct`（轮 0，16ms 请求）：额外均值 1.22ms，额外 P95 5.60ms；
>    - `kernel-highres-worker`（轮 1，18ms 请求）：额外均值 1.54ms，额外 P95 5.55ms；
>    - `kernel-highres-worker`（轮 1，16ms 请求）：额外均值 1.30ms，额外 P95 5.46ms。
> 3. 本交付严格保留原始样本与 `passed: false` 事实，不调高门槛，也不反复重跑以挑选偶发全绿数据。

### 4.2 双向平衡轮次合并统计数据

将两轮双向顺序采样（轮 0 与轮 1，每方法每请求共 48 次采样）合并后，生产组件 `kernel-highres-worker` 展现出显著的延时偏差收窄效果：

| 方法 | 请求 ms | 合并样本数 | 合并实际均值 ms | 合并额外 P95 ms |
| :--- | ---: | ---: | ---: | ---: |
| **task-delay-plain** | 1 | 48 | 14.8205 | 15.2055 |
| | 2 | 48 | 15.4587 | 14.0862 |
| | 10 | 48 | 15.5089 | 6.5558 |
| | 16 | 48 | 30.1909 | 15.7823 |
| | 18 | 48 | 30.8011 | 13.9828 |
| | 30 | 48 | 31.5250 | 2.0155 |
| **task-delay-tracked** | 1 | 48 | 15.4676 | 15.2398 |
| | 2 | 48 | 15.4414 | 14.6681 |
| | 10 | 48 | 15.4424 | 6.3302 |
| | 16 | 48 | 29.7096 | 15.9064 |
| | 18 | 48 | 30.8182 | 13.7539 |
| | 30 | 48 | 33.0895 | 15.4012 |
| **kernel-normal-direct** | 1 | 48 | 15.5355 | 15.4318 |
| | 2 | 48 | 15.5723 | 14.6193 |
| | 10 | 48 | 15.4577 | 6.2465 |
| | 16 | 48 | 30.0124 | 16.9849 |
| | 18 | 48 | 30.9479 | 14.3444 |
| | 30 | 48 | 32.3957 | 15.1731 |
| **kernel-highres-direct** | 1 | 48 | 1.4057 | 0.6989 |
| | 2 | 48 | 2.3912 | 0.6455 |
| | 10 | 48 | 11.4326 | 4.6141 |
| | 16 | 48 | 16.8154 | 4.9251 |
| | 18 | 48 | 18.4115 | 0.7535 |
| | 30 | 48 | 30.3750 | 0.6176 |
| **kernel-highres-worker**<br>(生产组件 `NativePacingDelay`) | 1 | 48 | 1.4888 | **0.7689** |
| | 2 | 48 | 2.5849 | **0.8760** |
| | 10 | 48 | 10.7922 | **1.2659** |
| | 16 | 48 | 16.9073 | **3.1588** |
| | 18 | 48 | 19.0660 | **4.3771** |
| | 30 | 48 | 30.7028 | **1.1291** |

> [!NOTE]
> - `task-delay` 与普通计时器在请求 18ms 时，实际等待时间均在 30.8ms 左右（额外偏差约 12.8ms，合并 P95 额外延时 13.75ms–13.98ms）。
> - 补修后的生产组件 `NativePacingDelay`（`kernel-highres-worker`）在异步桥接后，各档位合并平均额外延时均在 **0.49ms – 1.07ms** 之间，合并额外 P95 延时全部低于 5ms 门槛（1ms: 0.77ms, 2ms: 0.88ms, 10ms: 1.27ms, 16ms: 3.16ms, 18ms: 4.38ms, 30ms: 1.13ms），且无提前返回（early > 0.1ms 样本数为 0）。
> - 本项对照仅证明独立组件局部等待调度的精度提升，不替代整条管线的真实 30fps，也不涉及鼠标联动停顿。

---

## 5. 全量套件回归验证

执行项目现存的所有自动化套件，结果均为 100% 通过：

1. **前端与模板语法检查**：
   `npm run check` -> **通过**（无悬挂反引号、无单反斜杠转义）。
2. **Host 核心路由与会话生命周期测试**：
   `npm run test:wallpaper-host` -> **105 项测试全数通过**（覆盖受控关闭、超时确认、TaskbarHide 阶段防重入与回退等）。
3. **P3 原生节奏度量与资产白名单测试**：
   `node dsh-whale-mist/qa/perf/check-native-pacing.mjs` -> **5 项检查全部通过**（覆盖 22 项度量字段、截断口径、R2 反例及恢复后的 rc.30 资产哈希保护验证）。
4. **回放性能分析器与三次复审反例套件**：
   `node dsh-whale-mist/qa/perf/check-playback.mjs` -> **9 类测试（含 12+8+3 共 23 个反例用例）全部通过**。
5. **对比分析阶段测试**：
   `node dsh-whale-mist/qa/perf/check-compare.mjs` -> **40 项检查全数通过**。
6. **前端阶段耗时分析测试**：
   `node dsh-whale-mist/qa/perf/check-frontend-stages.mjs` -> **10 项检查全数通过**。
7. **独立编译 helper CLI 验证**：
   - `WallpaperProbe.exe --self-test-lifecycle` -> `mismatches: 0`。
   - `WallpaperProbe.exe --self-test-native-pacing <dir>` -> `ok: true, mismatches: 0, snapshotFields: 22`。
   - `WallpaperProbe.exe --self-test-native-wait <dir>` -> `passed: true, checks: 54`。

---

## 6. 文件指纹与环境基准保护

### 6.1 关键文件 SHA-256 指纹

```text
# 生产资产完整性基准 (Codex 已从 rc.30 tgz 完整恢复，严格未触碰)
FD69D9B9C42376A99A29DAFCFA53071CB282F21D5FBF29FC738405646581FF34 : dsh-whale-mist\assets\wallpaper\WallpaperProbe.dll
C2727F2BAD7CA64F97059BE781F4E2DE5214440BD94B704D58993FD0A1C12731 : dsh-whale-mist\assets\wallpaper\WallpaperProbe.exe
8356139AA4F13D3C11051CEB2DF5C22B1AC7F9A0E87CDAE003095960698EEB95 : dsh-whale-mist\assets\wallpaper\WallpaperProbe.deps.json

# 本次接入核心生产组件与调用代码 (已完成 R1–R3 闭合与 F1/F2 局部补修)
0525013D23F7B67A08E03A4AAAD31D934993C0EE86759EF13368A030D83CCE6E : dsh-whale-mist\qa\wallpaper-probe\KernelWaitTimer.cs
513ED01ABBBF2EA30BEC42EBF8F35CA3950F526B047A64BF1337EBD5198B56E1 : dsh-whale-mist\qa\wallpaper-probe\NativePacingDelay.cs
C63BE4F34F821CC4D795FC3885D3A6C5B333B85BB99FE216A5D5D26F34C5563A : dsh-whale-mist\qa\wallpaper-probe\ParentStopChannel.cs
6E784094B9458C3DE23323726DFA0F7A7A7880F730E3C8039F242475C531E39F : dsh-whale-mist\qa\wallpaper-probe\Program.cs
4B577DC92794ADF0AC3203DC28899C8CAD028DED4C5D51001C7ADEDB12ED8D8D : dsh-whale-mist\qa\perf\check-native-pacing.mjs

# 独立构建产物 (.tmp 目录，0 警告 0 错误)
080E7F4CA595327FB2E716806A811986B8386BA97FDE4431068BCEE084B0FB2A : .tmp\p4-probe-build\WallpaperProbe.dll
C2727F2BAD7CA64F97059BE781F4E2DE5214440BD94B704D58993FD0A1C12731 : .tmp\p4-probe-build\WallpaperProbe.exe
```

### 6.2 保护约束检查清单

- [x] **日常 rc.28 保护**：未向系统安装新版本，日常安装运行环境保持 rc.28 未变。
- [x] **生产资源保护**：`dsh-whale-mist/assets/wallpaper/` 生产二进制（DLL SHA256: `FD69D9B9...`）已由 Codex 从 rc.30 tgz 完整恢复，未被后续步骤覆盖；三个 `.tgz` 归档文件均未修改。
- [x] **工作区版本保持**：`package.json` 维持 `0.6.0-rc.30`，未私自发版或修改工作区主版本号。
- [x] **环境安全**：未启动真实 Wallpaper Engine 或真实壁纸播放窗口；未操作 DSH 用户配置/Local Storage/显卡全局设置；未执行 `git commit` 或 `git push`。
- [x] **边界清晰**：不将本次等待延时改善混淆为“壁纸响应鼠标停顿问题已解决”；明确记录该表现为源画面响应与传输/显示延迟，留待独立专题排查。

---

## 7. 交付物与复审入口

- **生产代码文件**：
  - `dsh-whale-mist/qa/wallpaper-probe/KernelWaitTimer.cs`
  - `dsh-whale-mist/qa/wallpaper-probe/NativePacingDelay.cs`
  - `dsh-whale-mist/qa/wallpaper-probe/ParentStopChannel.cs`
  - `dsh-whale-mist/qa/wallpaper-probe/Program.cs`
  - `dsh-whale-mist/qa/perf/check-native-pacing.mjs`
- **QA 对照项目**：
  - `dsh-whale-mist/qa/perf/native-wait-probe/`（链接实际组件，无副本）
- **证据输出目录**：
  - `F:\dsh-wallpaper-plugins\.tmp\p4-comparison-run-repaired\`（对比运行数据与原始样本，SHA256: `FBA6AB85...`）
  - `F:\dsh-wallpaper-plugins\.tmp\p4-probe-build\`（独立编译 helper 二进制及 54 项自测结果）
  - `F:\dsh-wallpaper-plugins\.tmp\codex-controls-verification-second\`（Codex 6 项控制用例全数通过证据）
  - `F:\dsh-wallpaper-plugins\.tmp\native-wait-p4-rereview-20261015-145029-3308ddf9\`（二次复审起点与证据目录）

**本交付报告已完成 F1、F2 局部补修及精度表述口径澄清，现交由 Codex / GPT 进行最终复审。**
