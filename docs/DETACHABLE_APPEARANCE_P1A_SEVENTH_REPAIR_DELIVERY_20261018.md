# 独立/吸附设置P1A七审补修交付：根与子进程动作前严格身份复核、OS创建身份与全量JSON快照比对、杜绝PID复用误杀与资产绝对保护

2026-10-18，小 G。对照[七审报告](DETACHABLE_APPEARANCE_P1A_SEVENTH_REVIEW_20261018.md)实施专项补修。**前轮已闭合项（W1 JSON协议解析错误与未知状态保留、W2 根缺席平滑过渡、W4 存活后代 dispose 绝对保护、EBUSY 重试闭环、R1 来源分表、R4-A 已有目录保护、R4-C 停止失败重试、React 19 挂载、生产伴随页调参、R6 队列保持）完全保持，本轮范围严格锁定在 W3：消除动作前退回 profile 子串检查与根分支跳过复核漏洞，建立根/子进程动作前严格身份复核与 OS 创建身份（CreationDate）校验机制。**

本轮严格遵守离线与安全规范：未改动运行中 DSH（0.2.1-rc.2）、Wallpaper Engine 或日常桌面 Profile，未创建任何可见系统窗口，未修改 `package.json` 版本（保持 `0.6.0-rc.30`），未提交或推送 Git 变更。

---

## 一、七审缺陷根因分析与补修实现

### 1.1 缺陷根因分析

在七审报告中，Codex 指出虽然 W1 解析闭合、W3 扫描阶段过滤已接入严格快照，但在 Phase 2 强制回收动作前仍存在严重身份漏洞：
1. **子进程动作前检查退回子串匹配**：`checkWindowsProcessIdentity` 原实现采用 PowerShell 脚本 `$p.CommandLine -like '*<profile>*'`，没有调用生产分类器 `classifyProcessRecord`，未精确检查可执行体全名和 `--user-data-dir` 完整参数边界，更未对比 OS 创建身份（`CreationDate`）。当子进程退出且其 PID 被外部 shell 或不同 profile 的 Edge 复用时，只要其命令行中出现该 profile 路径，便会被误判为 `matched` 并下发 `taskkill`；
2. **根进程强制回收跳过动作前复核**：Phase 2 在 `groupStatus.rootAlive` 为真时直接下发 `taskkill.exe /PID <root> /T /F`，未做任何动作前核验。最初的身份检查发生在关窗与等待之前，不能作为动作发生时刻的身份凭据；若根进程退出且 PID 被无关进程复用，该无关进程将被强杀；
3. **缺少 OS 级别进程创建时间凭据**：原有查询仅拉取 `ProcessId, Name, ExecutablePath, CommandLine`，本地句柄缓存的 `createdAt: Date.now()` 属于 Node 端时间戳，无法辨识 Windows OS 层面复用同一数字 PID 的新生命周期。

### 1.2 补修实现要点

在 `src/detachable-edge-adapter.js` 中实施了如下针对性补修：

1. **引入 OS 创建身份解析与比对机制**：
   - 新增 `parseCreationDate(val)`：支持 Windows WMI 格式（`/Date(1792295139249)/`）与 ISO 8601 字符串格式，统一解析为 Unix epoch 毫秒数；
   - 升级 `queryWindowsProcessesByProfile`：PowerShell CIM 查询显式提取 `CreationDate`：
     ```powershell
     Get-CimInstance Win32_Process -Filter "CommandLine like '%<profile>%'" -ErrorAction Stop |
       Where-Object { $_.ProcessId -ne $PID } |
       Select-Object ProcessId, Name, ExecutablePath, CommandLine, CreationDate |
       ConvertTo-Json -Compress
     ```
   - 升级 `classifyProcessRecord(proc, profileDir, expectedExecutable, expectedCreationDate = null)`：
     - **矛盾防线**：若 `Name` 与 `ExecutablePath` 冲突（如 Name 为 `powershell.exe` 但 ExecutablePath 指向 `msedge.exe`），判定为 `foreign-executable`（`reason: 'name-executablepath-contradiction'`）；
     - **可执行体精准全名比对**：可执行体必须规范化为预期 Edge 路径或基础名（`msedge.exe`），彻底拦截 `knowledge.exe` 等含 edge 字样的外部程序；
     - **精确参数边界比对**：通过 `extractUserDataDir` 提取 `--user-data-dir` 实际路径并进行绝对路径规范化比对，阻断 `--user-data-dir=<profile>-other` 前缀碰撞；
     - **创建身份比对**：若提供 `expectedCreationDate`，比对两者的创建时间戳（容差 <= 1000ms），若不符判定为 `foreign-recycled`（`reason: 'creation-date-mismatch'`）。
2. **重构 `checkWindowsProcessIdentity` 为全量 JSON 校验管道**：
   - 彻底废除旧的 `$p.CommandLine -like '*<profile>*'` 字符串脚本；
   - 统一由 PowerShell 获取当前 PID 的全量属性并压缩输出 JSON：
     ```powershell
     $p = Get-CimInstance Win32_Process -Filter 'ProcessId = <pid>' -ErrorAction SilentlyContinue
     if ($null -eq $p) { exit 2 }
     $p | Select-Object ProcessId, Name, ExecutablePath, CommandLine, CreationDate | ConvertTo-Json -Compress
     ```
   - 在 Node 端解析该 JSON，直接调用 `classifyProcessRecord(procRecord, expectedProfileDir, expectedExecutable, expectedCreationDate)` 执行权威校验：
     - 判定为 `controlled-edge` 时，返回 `'matched'`；
     - PID 不存在（退出码 2 或 JSON 为空）时，返回 `'not-found'`；
     - 出现外来 shell、前缀碰撞、可执行体不符、创建时间改变或字段不足时，返回 `'mismatched'`。
3. **Phase 2 根进程动作前严格核验**：
   - 在对根 PID 执行 `taskkill /PID <root> /T /F` 前，调用 `checkWindowsProcessIdentity(processRecord.pid, profileDir, expectedExecutable, execCommand, processRecord.creationDate || null)`；
   - 若返回 `'matched'`，才允许执行 `taskkill`；
   - 若返回 `'not-found'`，说明已自然退出，不发 `taskkill` 并标记 `groupStatus.rootAlive = false`；
   - 若返回 `'mismatched'` 或查询异常，**坚决不发强杀**，标记 `preActionRecycledDetected = true` 并记录原因。
4. **Phase 2 存活子进程动作前严格核验**：
   - 在 `performResourceGroupInspection` 阶段将合法的存活子进程快照（含 PID 与 `CreationDate`）暂存在 `processRecord.subProcessSnapshots`；
   - 在向每一个存活子 PID 发出 `taskkill /F` 前，以缓存的 `creationDate` 作为比对依据，调用 `checkWindowsProcessIdentity(subPid, profileDir, expectedExecutable, execCommand, cachedSnapshot.creationDate)`；
   - 若返回 `'matched'`，执行精确定向强杀；
   - 若返回 `'not-found'`，平滑跳过；
   - 若返回 `'mismatched'` 或查询异常，**坚决不发强杀**，标记 `preActionRecycledDetected = true` 并记录原因。
5. **PID 复用异常保留与目录保护**：
   - 一旦在 Phase 2 检测到根或子 PID 复用（`preActionRecycledDetected = true`），`close()` 明确返回：
     ```javascript
     return {
       ok: false,
       error: rootRecycled ? 'root-process-pid-recycled: ...' : 'sub-process-pid-recycled: ...',
       profilePreserved: true,
       rootExited: processRecord.exited,
       subProcessesRemaining: survivingSubPids.length,
     };
     ```
   - 严禁执行临时目录删除，完整保留所有权 `ownedProfileDirs` 和进程监控表，允许调用者后续重试安全清理。

---

## 二、七审专项与安全门禁探针验证（`qa/verify-seventh-review-probes.mjs`）

新建 `qa/verify-seventh-review-probes.mjs`，完整复现七审报告中的 3 项对抗性 VM 测试用例及合法子进程正常强杀用例：

```text
--- Running Seventh Review Verification Probes (W3 Pre-Action Identity & Recycled Defenses) ---
[UNIT 1] parseCreationDate & Contradiction / Recycled Classification...
  -> PASS

[EVALUATION OF CODEX SEVENTH REVIEW SAFETY GATE]
  Mode: sub-shell-recycled | Close Ok: false | Error: sub-process-pid-recycled: PID 987655001 | Forced Targets: 0 | Profile Preserved: true
  Mode: sub-prefix-recycled | Close Ok: false | Error: sub-process-pid-recycled: PID 987655001 | Forced Targets: 0 | Profile Preserved: true
  Mode: root-recycled | Close Ok: false | Error: root-process-pid-recycled: PID 987654710 | Forced Targets: 0 | Profile Preserved: true
  -> All 3 Codex adversarial cases PASSED with 0 forced targets and 100% profile preservation!

[PROBE 4] Legitimate controlled child process is verified and killed in Phase 2...
  -> PASS

--- ALL SEVENTH REVIEW VERIFICATION PROBES PASSED! ---
```

### 详细断言结果对照

| 场景 | 动作时实际记录 | 适配器选择 | 验证结果 |
| --- | --- | --- | --- |
| **子 PID 被 shell 复用** (`sub-shell-recycled`) | `powershell.exe`，仅提及原 profile | Pre-Action 核查识别为 `foreign-shell`（mismatched），不发 taskkill；`close.ok === false`，`forced.length === 0`，profile 完整保留 | **PASS** |
| **子 PID 被不同 profile Edge 复用** (`sub-prefix-recycled`) | `msedge.exe`，参数为 `<profile>-other` | Pre-Action 核查识别为 `foreign-prefix-collision`（mismatched），不发 taskkill；`close.ok === false`，`forced.length === 0`，profile 完整保留 | **PASS** |
| **根 PID 在快照后被复用** (`root-recycled`) | `powershell.exe`，仅提及原 profile，通知延迟 | Phase 2 动作前核查根 PID 识别为 `foreign-shell`（mismatched），不发 taskkill；`close.ok === false`，`forced.length === 0`，profile 完整保留 | **PASS** |
| **合法存活子进程定向回收** (Probe 4) | `msedge.exe` 正本且 `CreationDate` 匹配 | Pre-Action 核查确认为 `matched`，下发定向强杀 `taskkill /F /PID 987655001`，二次检查确认空集后安全清理临时目录 | **PASS** |

---

## 三、全量回归与语法检查结果

```text
> npm run check
node --check 11 files + css-template-guard
css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
Exit: 0

> node qa/verify-seventh-review-probes.mjs
--- ALL SEVENTH REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> node qa/verify-sixth-review-probes.mjs
--- ALL SIXTH REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> node qa/verify-fifth-review-probes.mjs
--- ALL FIFTH REVIEW VERIFICATION PROBES (W1-W4) PASSED! ---
Exit: 0

> node qa/verify-fourth-review-probes.mjs
--- ALL FOURTH REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> node qa/verify-third-review-probes.mjs
--- ALL THIRD REVIEW VERIFICATION PROBES PASSED! ---
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
tests 15, pass 15, fail 0
Exit: 0

> npm run test:detachable-e2e
status: PASSED, tests: 11, spawnCount: 3, closeCount: 3
Exit: 0

> npm run test:appearance-selection
Exit: 0

> git diff --check
clean (0 errors)
```

---

## 四、安全与交付状态

- **受影响代码**：
  - `src/detachable-edge-adapter.js`：
    - 新增 `parseCreationDate`；
    - 升级 `classifyProcessRecord`，支持 `CreationDate` 校验与 Name/ExecutablePath 矛盾防线；
    - 重构 `checkWindowsProcessIdentity` 为输出并解析结构化 JSON 快照；
    - Phase 2 增加根 PID 与存活子 PID 动作前身份预检，拦截复用 PID，杜绝误杀外来进程；
    - 在检测到 PID 复用时严格保留临时目录与资源所有权，禁止假空集误删；
  - `qa/verify-seventh-review-probes.mjs`：实现七审 3 项对抗性复现用例与合法子进程强杀回归。
- **保护规范**：
  - 零可见窗口，无前台抢占；
  - 日常 DSH 0.2.1-rc.2 / 鲸系外观 rc.35 正常运行中，未发生热改；
  - 版本号严格保持 `0.6.0-rc.30`，未进行 Git 提交或推送；
  - 后台任务保持为 0。

交付 Codex 进行七审补修复核。
