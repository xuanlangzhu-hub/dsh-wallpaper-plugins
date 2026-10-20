# 独立/吸附设置P1A四审补修交付：正常关窗意图、强身份核对、资源组检查与目录清理失败保留闭合

2026-10-17，小 G。对照[四审报告](DETACHABLE_APPEARANCE_P1A_FOURTH_REVIEW_20261017.md)实施专项补修。**前轮已闭合项（R1 来源分表、R4-A 已有目录保护、R4-C 停止失败重试、React 19 挂载、生产伴随页调参、R6 调参保持）完全保持，本轮范围严格锁定在 R4-B 窗口正常生命周期机制与 R4-P2 临时目录清理失败保留重试。**

本轮严格遵守离线与安全规范：未改动运行中 DSH（0.2.1-rc.2）、Wallpaper Engine 或日常桌面 Profile，未创建任何可见系统窗口，未修改 `package.json` 版本（保持 `0.6.0-rc.30`），未提交或推送 Git 变更。

---

## 一、补修核心机制与设计实现

针对四审指出的两处关键缺陷：
1. **R4-B [P1]**：Windows 上 `child.kill()` 实际上是 `TerminateProcess` 强杀，缺乏正常关窗意图；仅依赖首个 `child.exit` 会漏过 Edge 渲染器/后代子进程；强身份核对与资源集合检查缺失。
2. **R4-P2**：`cleanupProfileDir` 遇到 `EBUSY`/`EPERM` 失败时，`close()` 却删除了记录并从 `ownedProfileDirs` 丢掉归属，导致后续 `dispose()` 无法重试。

### 1.1 明确分阶段的窗口生命周期（正常关窗意图 -> 资源组检查 -> 强杀兜底）

在 [`src/detachable-edge-adapter.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-edge-adapter.js) 中重构了 `close(handle)` 的控制流：

- **强身份防回收核验**：
  - 校验 `handle.createdAt` 与 `handle.instanceId`，防御迟到的过期旧句柄（`stale-handle-identity-mismatch`、`instance-identity-mismatch`）。
  - 在操作 OS 进程前，通过 `verifyProcessIdentity` 钩子或 Windows 命令执行 `checkWindowsProcessCommandLine(pid, profileDir)`，核实目标 PID 的命令行中确实包含本适配器创建的 `--user-data-dir` 临时目录，杜绝误杀 OS 回收后赋予其他程序的相同 PID（`pid-identity-mismatch`）。
- **Phase 1: 发送明确正常关窗意图（Graceful Close Intent）**：
  - 不再将 `child.kill()` 作为“正常关窗”。
  - 优先调用 `requestWindowClose(record)` 钩子或 `child.requestClose()`；在 Windows 生产环境，通过 PowerShell 调用 `.NET Process.CloseMainWindow()` 发送系统级 `WM_CLOSE` 正常关窗消息；仅在只支持 `.kill()` 的基础测试替身中才降级回退。
  - 标记 `processRecord.closeIntentSent = true` 并递增 `closeIntentCalls` 计数。
  - 等待根进程在 `gracefulTimeoutMs` 内正常响应退出。
- **资源组全量检查（Resource Group Inspection）**：
  - 根进程退出并不代表 Edge 整个资源组已退出。适配器调用 `performResourceGroupInspection`，不仅检查根进程，还通过 `inspectResourceGroup` 钩子或 Windows `Get-CimInstance Win32_Process -Filter "CommandLine like '%<profileDir>%'"` 扫描所有仍持有该专属 profile 目录的渲染器、GPU 或后代进程。
  - 累计记录 `resourceGroupInspectionCalls` 检查次数。
- **Phase 2: 资源组存活触发强制回收与二次核实**：
  - 若 Phase 1 后仍有后代进程存活（`groupStatus.alive === true`），执行定向强制树终止（`forceTerminateResourceGroup` 或 `taskkill.exe /PID <pid> /T /F`）。
  - 强杀执行后，**重新执行资源组检查**以核验后代进程是否彻底退出。
  - 若二次检查依然存活，拒绝删除 profile 目录，返回 `{ ok: false, error: 'resource-group-still-alive', alivePids, processTerminated: false }`，并完整保留适配器内的进程与目录记录。
- **Phase 3: 进程终止确认与目录删除状态分离**：
  - 资源组确认全部退出后，正式标记 `processRecord.processTerminated = true`。
  - 此时才进入物理目录清理阶段。

### 1.2 目录清理失败归属保留与重试（EBUSY / EPERM 防御）

- **归属严格保留**：
  - 若 `cleanupProfileDir` 遇到 `EBUSY` / `EPERM` 返回 `false`：
    - `ownedProfileDirs` **严禁删除该目录路径**；
    - `activeProcesses` **完整保留该进程记录**（状态为 `processTerminated: true`, `profileDirCleaned: false`, `lastError: 'profile-dir-cleanup-failed'`）；
    - `close()` 明确返回 `{ ok: false, error: 'profile-dir-cleanup-failed', closedPid: pid, processTerminated: true, profileDirCleaned: false, profileDir }`，向调用方暴露失败。
- **`close()` 与 `dispose()` 幂等重试支持**：
  - 若调用方重试 `close(handle)`：检测到 `processRecord.processTerminated === true`，跳过进程杀灭与 OS PID 核验，直接重试 Phase 3 目录删除；成功后才从 `activeProcesses` 和 `ownedProfileDirs` 中移除。
  - `dispose()` 遍历 `activeProcesses` 与 `ownedProfileDirs`：区分“进程未关”与“目录清理失败”。当文件锁解除后，再次调用 `dispose()` 可彻底完成残留目录的重试清理并返回 `{ ok: true }`。

---

## 二、测试边界澄清与误述修正

根据四审第 3 节评审意见，纠正上一轮交付报告中的误述，明晰测试与验证的边界：

1. **单元替身与契约测试（Mock Emulation）**：
   - `qa/detachable-appearance-p0.test.mjs` 与 `qa/verify-fourth-review-probes.mjs` 中的 `spawnProcess`、`inspectResourceGroup`、`requestWindowClose` 均为注入的 EventEmitter 替身与状态捕获器。
   - 这类测试用于验证状态机分支、资源组二次检查、迟到句柄防护、PID 身份核验和 EBUSY 保留/重试逻辑，不代表操作系统内核真实进程行为。
2. **无窗口双浏览器通信验证（Headless Edge Multi-Tab）**：
   - `qa/detachable-browser-e2e.mjs` 通过真实 headless Chromium 启动主端与伴随端两个 Tab，测试 127.0.0.1 HTTP/SSE 通信、鉴权门禁、双向数据流和动作去重。
   - **注意**：测试中注入的 `windowAdapter` 仅记录调用次数（`spawnCount: 3, closeCount: 3`），headless 浏览器由测试框架统一启动与回收。这**不代表**生产适配器在 Windows 桌面真实启动或关闭了 3 次 Edge App 原生窗口。
3. **未执行的原生可见窗口验收（Native OS Visible Windows）**：
   - 本轮开发与验证**未在日常桌面创建任何可见的 Edge App 原生窗口**，未执行涉及真实桌面交互的原生窗口验收。生产 Windows 逻辑（`.CloseMainWindow()`、`Get-CimInstance`、`taskkill /T`）已具备纯代码实现和离线自测注入点，实机原生交互验收留待后续专人上机安排。

---

## 三、专项探针与回归测试结果

### 3.1 专用四审验证探针（`qa/verify-fourth-review-probes.mjs`）

新建专项探针覆盖四审全部核心场景，7 项探针全部通过：

- **Probe 1（正常关窗意图与资源组检查）**：
  - 验证 `requestWindowClose` 优先触发，`child.kill` 未被调用；`closeIntentCount === 1`；`inspectResourceGroup` 至少执行 1 次；进程与目录全部确认后才清除跟踪。
- **Probe 2（后代子进程存活触发 Phase 2 树终止与二次确认）**：
  - 模拟根进程退出但子进程（渲染器/GPU）存活；验证适配器触发 `forceTerminateResourceGroup`，并执行第 2 次资源组检查；二次核实全部退出后才放行清理。
- **Probe 3（顽固子进程无法杀灭的失败与保留）**：
  - 模拟后代进程强杀后依然存活；验证 `close()` 拒绝清理目录，返回 `error: 'resource-group-still-alive'`，且 `trackedProcessCount === 1`、`ownedProfileCount === 1` 完整保留。
- **Probe 4（PID 回收防误杀身份核验）**：
  - 模拟 OS 回收 PID 给其他应用（`verifyProcessIdentity` 返回 `false`）；验证适配器拒绝发送关窗意图，拒绝执行强杀，返回 `error: 'pid-identity-mismatch'`，保护 OS 其他进程。
- **Probe 5（过期旧句柄与实例代次隔离）**：
  - 验证过期 `createdAt` 拒绝（`stale-handle-identity-mismatch`）、异代 `instanceId` 拒绝（`instance-identity-mismatch`）、未受控 PID 拒绝（`unowned-handle`）。
- **Probe 6（EBUSY 清理失败保留、错误暴露与 dispose 重试闭环）**：
  - 专属目录注入 `EBUSY` 故障；
  - 第一次 `close(handle)`：返回 `ok: false, error: 'profile-dir-cleanup-failed', processTerminated: true, profileDirCleaned: false`；
  - 核心核验：`ownedProfileCount === 1`、`trackedProcessCount === 1`，目录与进程记录未被丢弃；
  - 锁存续期间调用 `dispose()`：返回 `ok: false, error: 'some-profiles-failed-to-clean'`，目录归属依然保留；
  - 解除文件锁后再次调用 `dispose()`：重试成功，`ownedProfileCount === 0`、`trackedProcessCount === 0`，物理目录彻底移除。
- **Probe 7（EBUSY 后直接重试 close(handle)）**：
  - 验证在解除锁后，直接对已标记 `processTerminated: true` 的 handle 再次调用 `close(handle)`，跳过杀进程直接完成目录重试清理并返回 `ok: true`。

### 3.2 完整回归测试套件结果

```text
> npm run check
node --check 11 files + css-template-guard
css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
Exit: 0

> node qa/verify-third-review-probes.mjs
[PASS] Probe 1: Production Origin Fence verified successfully.
[PASS] Probe 2: Pre-existing profile preservation verified successfully.
[PASS] Probe 3: Normal profile exclusive creation and cleanup verified.
[PASS] Probe 4: Stop retry on unconfirmed cleanup verified successfully.
[PASS] Probe 5: Persistent failure continues reporting unconfirmed cleanup.
--- ALL THIRD REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> node qa/verify-fourth-review-probes.mjs
[PROBE 1] Testing Graceful Close Intent & Resource Group Inspection... -> PASS
[PROBE 2] Testing Surviving Sub-processes and Forceful Tree Termination... -> PASS
[PROBE 3] Testing Stubborn Surviving Sub-processes Retention... -> PASS
[PROBE 4] Testing PID Recycling / Identity Mismatch Defense... -> PASS
[PROBE 5] Testing Stale Handle Identity Mismatch Defense... -> PASS
[PROBE 6] Testing Profile EBUSY Cleanup Failure Retention & Dispose Retry... -> PASS
[PROBE 7] Testing Profile EBUSY Retry via Direct close() Call... -> PASS
--- ALL FOURTH REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> npm run test:detachable-p1a
✔ 1. Host Lifecycle, Index Injection, and Protected Bootstrap Route
✔ 2. Edge Window Adapter: Discovery, Sandbox Arguments, Dedicated Profiles, and Orderly Close
✔ 3. Static Companion Assets: Manifest Serving, Method Guard, and Traversal Defense
✔ 4. Dual Views (Docked Panel & Companion Window) with Single Authoritative Controller
✔ 5. Companion Application (companion.js) Token Scrubbing, DOM Sync, and Error Guard
tests 5, pass 5, fail 0
Exit: 0

> npm run test:detachable-p0
✔ 1-15 全部通过（包含 F3 会话隔离、G1/G2/G3 五审与 H1/H2 六审队列边界）
tests 15, pass 15, fail 0
Exit: 0

> npm run test:detachable-e2e
status: "PASSED", tests: 11 passed, spawnCount: 3, closeCount: 3
Exit: 0

> npm run test:appearance-selection
sceneSelection passed (0 errors)
Exit: 0

> npm run test:appearance
570 项外观回归与媒体准备全量通过（0 failures, 0 timeouts）
Exit: 0

> git diff --check
无多余空白、换行符冲突或语法错误
Exit: 0
```

---

## 四、修改清单与交付状态

| 涉及文件 | 关键变动说明 |
| :--- | :--- |
| [`src/detachable-edge-adapter.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-edge-adapter.js) | 1. 增加 `requestWindowClose`、`inspectResourceGroup`、`verifyProcessIdentity`、`forceTerminateResourceGroup`、`rmDir` 选项；<br>2. 增加 Windows 原生 PowerShell 进程树查询与命令行核验辅助函数；<br>3. `close(handle)` 实现强身份核验 -> 正常关窗意图 (Phase 1) -> 资源组检查 -> 强杀兜底 (Phase 2) -> 二次资源组确认；<br>4. 分离 `processTerminated` 与 `profileDirCleaned`；清理失败保留进程记录与 `ownedProfileDirs` 归属，支持 `close()` 与 `dispose()` 幂等重试。 |
| [`qa/verify-fourth-review-probes.mjs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/verify-fourth-review-probes.mjs) | 新建四审 7 项专项验证探针（正常意图、后代存活树强杀、顽固子进程保留、PID 回收防护、迟到句柄防护、EBUSY 失败保留与 dispose 重试、直接 close 重试）。 |

**结论**：四审遗留的 R4-B 窗口生命周期缺陷及 R4-P2 临时目录删除失败保留重试均已完全闭合，测试边界已如实纠正与区分。请复审。
