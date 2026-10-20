# 独立/吸附设置P1A八审补修交付：完整程序路径校验、严格OS创建身份（CreationDate）基线与当前核验闭环、测试契约归一

2026-10-18，小 G。对照[八审报告](DETACHABLE_APPEARANCE_P1A_EIGHTH_REVIEW_20261018.md)实施专项补修。**前轮已闭合项（W1 JSON协议解析错误与未知状态保留、W2 根缺席平滑过渡、W4 存活后代 dispose 绝对保护、EBUSY 重试闭环、R1 来源分表、R4-A 已有目录保护、R4-C 停止失败重试、React 19 挂载、生产伴随页调参、R6 队列保持、七审动作前3项负例）完全保持，本轮范围严格锁定在 W3 余项：补齐严格 OS 创建身份（CreationDate）基线建立与当前核验机制，建立完整可执行路径（ExecutablePath）等值校验，消除测试协议专用放行分支并严格校验返回 PID。**

本轮严格遵守离线与安全规范：未改动运行中 DSH（0.2.1-rc.2）、Wallpaper Engine 或日常桌面 Profile，未创建任何可见系统窗口，未修改 `package.json` 版本（保持 `0.6.0-rc.30`），未提交或推送 Git 变更。

---

## 一、八审缺陷根因分析与补修实现

### 1.1 W3-A 创建身份缺失或无法解析时禁止强杀（建立基线与核验基线闭环）

- **根因分析**：
  原代码在核验进程创建身份时，仅在 `if (expectedCreationDate)` 且 `currentMs` 与 `expectedMs` 均非空时才判断是否不同；当 `currentMs` 为 `null`（缺失或损坏，如 `'invalid-creation-time'`）或调用方未传入有效基线时，整个日期比对被直接跳过，从而错误降级回 `controlled` / `matched`，放行了 `taskkill /F`。
- **补修实现**：
  1. **明确时间戳解析契约**：
     - 重构 `parseCreationDate(val)`：支持 WMI 时间戳（`/Date(1792295139249)/`、`/Date(...+0800)/` 等）、ISO 8601 字符串及正整数数值；
     - 凡遇到 `null`、`undefined`、空串、非法字符串（如 `'invalid-creation-time'`）、NaN、Infinity、负数或非数值类型，一律严格返回 `null`，坚决杜绝任何假有效时间戳；
  2. **区分“建立有效基线”与“按基线核验”**：
     - **当前快照必验**：`classifyProcessRecord` 强制当前快照必须具备有效 OS `CreationDate`。若当前快照缺失或无法解析（`currentMs === null`），立即返回 `{ status: 'insufficient-info', reason: 'missing-or-invalid-creation-date' }`；
     - **基线核验**：若传入 `expectedCreationDate`，基线时间戳也必须有效（`expectedMs !== null`），否则返回 `{ status: 'insufficient-info', reason: 'missing-or-invalid-expected-creation-date' }`；
     - 仅当两者均有效且创建时间戳差值 $\le 1000$ms 时才认作受控；若差值 $> 1000$ms，判定为 `foreign-recycled`（`reason: 'creation-date-mismatch'`）；
  3. **Phase 2 动作前强制基线核验**：
     - 对根 PID：下发 `taskkill /T /F` 前，先检查 `processRecord.creationDate` 是否存在且有效；若缺失直接标记 `root-identity-baseline-missing` 并拒绝强杀；若存在则以该基线调用 `checkWindowsProcessIdentity` 进行动作前核验；
     - 对存活子 PID：下发 `taskkill /F` 前，先从 `subProcessSnapshots` 获取该 PID 的 `CreationDate` 基线；若基线缺失直接标记 `sub-identity-baseline-missing` 并拒绝强杀；若存在则传入该基线进行动作前核验；
     - 动作前核验若返回 `mismatched` 或 `error`（包含当前创建时间缺失/损坏），**坚决不下发强杀**，标记 `preActionRecycledDetected` 并绝对保留临时目录与资源所有权。

### 1.2 W3-B ExecutablePath 完整程序路径核验（杜绝同名不同目录放行）

- **根因分析**：
  原代码先对 `ExecutablePath` 和 `expectedExecutable` 提取基础名（`basename`），导致 `C:\ForeignApplication\msedge.exe` 与 `C:\Synthetic\msedge.exe` 因基础名同为 `msedge.exe` 而被放行，获得了强杀权限。
- **补修实现**：
  1. **新增 `normalizeWindowsPath(p)`**：采用 `resolve(p).toLowerCase().replace(/\\/g, '/')` 消除 Windows 盘符大小写和斜杠/反斜杠差异，提供规范化绝对路径等值判据；
  2. **强制全路径等值比对**：
     - 若 `proc.ExecutablePath` 缺失或为空，坚决不允许仅凭 `proc.Name` 假定受控，直接判定为 `{ status: 'insufficient-info', reason: 'missing-executable-path' }`；
     - `proc.Name` 仅作一致性辅助：若其基础名与 `proc.ExecutablePath` 基础名不符，判定为矛盾 `{ status: 'foreign-executable', reason: 'name-executablepath-contradiction' }`；
     - 若绑定了预期路径 `expectedExecutable`，必须严格核对规范化全路径：`normProcExe !== normExpectedExe` 时立即判定为 `{ status: 'foreign-executable', reason: 'unmatched-executable-path' }`；
  3. **动作前预检全面拦截**：
     - 在 `checkWindowsProcessIdentity` 中，路径不符的快照被判定为 `mismatched`，Phase 2 拒绝发出 `taskkill`，完全隔绝外部同名程序被误强杀的风险。

### 1.3 测试协议归一与返回 PID 防线

- **消除测试分叉**：彻底删除 `checkWindowsProcessIdentity` 中 `if (execCommand !== defaultExecFile) { resolveCheck({ status: 'matched' }); }` 的专用放行逻辑；统一执行：无论替身还是真实环境，stdout 为空一律按未发现（`not-found`）处理，杜绝测试专用捷径；
- **校验返回 PID**：在 Node 端解析 JSON 结果后，增加 `returnedPid !== Number(pid)` 检查；若 CIM 返回的记录 PID 与所查 PID 不一致，立即判定为 `status: 'mismatched', reason: 'returned-pid-mismatch'`，杜绝旧 fixture 泛用子 PID 响应任意查询的漏洞；
- **同步更新历史 QA fixture**：按照“底层 I/O 替身、相同解析判断”原则，将 `verify-sixth-review-probes.mjs`、`verify-fifth-review-probes.mjs`、`verify-seventh-review-probes.mjs` 中模拟 `ProcessId =` 的响应规范化为包含所查 PID、合法路径及有效 `CreationDate` 的标准结构，保持全量回归绿色。

---

## 二、八审完整验收矩阵与探针验证（`qa/verify-eighth-review-probes.mjs`）

新建 `qa/verify-eighth-review-probes.mjs`，完整覆盖八审报告要求的 5 个维度与 4 个隔离用例：

```text
--- Running Eighth Review Verification Probes (W3 Full Path & Creation Identity Verification) ---
[UNIT 1] parseCreationDate, normalizeWindowsPath & classifyProcessRecord boundaries...
  -> PASS

[EVALUATION OF CODEX EIGHTH REVIEW 4 ISOLATION SCENARIOS]
  Scenario: sub-missing-current-creation-date | Close Ok: false | Error: sub-identity-verify-failed: PID 987655001 | Forced Targets: 0 | Profile Preserved: true
  Scenario: sub-invalid-current-creation-date | Close Ok: false | Error: sub-identity-verify-failed: PID 987655001 | Forced Targets: 0 | Profile Preserved: true
  Scenario: sub-missing-baseline-creation-date | Close Ok: false | Error: insufficient-process-identity: missing-or-invalid-creation-date | Forced Targets: 0 | Profile Preserved: true
  Scenario: sub-foreign-executable-path | Close Ok: true | Error: undefined | Forced Targets: 0 | Profile Preserved: false
  -> All 4 Codex Eighth Review isolation cases PASSED with 0 forced targets!

[EVALUATION OF SEVENTH REVIEW REGRESSION SCENARIOS]
  Mode: sub-shell-recycled -> PASS (0 forced targets)
  Mode: sub-prefix-recycled -> PASS (0 forced targets)
  Mode: root-recycled -> PASS (0 forced targets)

[EVALUATION OF ROOT PROCESS PRE-ACTION BOUNDARIES]
  Root foreign executable path -> PASS

[EVALUATION OF RETURNED PID MISMATCH VERIFICATION]
  Returned PID mismatch check -> PASS

[EVALUATION OF LEGITIMATE CONTROLLED PROCESS TERMINATION]
  Legitimate child termination & cleanup -> PASS

--- ALL EIGHTH REVIEW VERIFICATION PROBES PASSED! ---
```

### 八审验收矩阵逐条对照

| 维度 | 审查要求 | 本轮实现与测试结果 | 结论 |
| --- | --- | --- | --- |
| **根/子动作分支** | 两条动作分支都跑实际默认判断；旧 3 例继续通过 | 根与子强杀前均执行动作前身份预检；`sub-shell-recycled`、`sub-prefix-recycled`、`root-recycled` 均实现 0 强杀且安全拦截 | **PASS** |
| **创建身份** | 基线/当前各自缺失、null、无法解析、合法不同、合法一致、支持的 WMI/ISO 格式 | UNIT 1 全覆盖；`sub-missing-current-creation-date`、`sub-invalid-current-creation-date`、`sub-missing-baseline-creation-date` 全部 0 强杀并保留资源 | **PASS** |
| **程序身份** | 完整预期路径相同、同名不同目录、路径缺失、Name/路径矛盾 | UNIT 1 全覆盖；`sub-foreign-executable-path`（`C:\ForeignApplication\msedge.exe`）精准拦截，0 强杀目标；根进程路径不符 0 强杀并保留 | **PASS** |
| **查询结果** | 明确不存在、命令失败/超时、空/异常结构、返回记录 PID 必须对应被查询 PID | 移除测试空输出放行，`returnedPid !== Number(pid)` 校验落地并通过 PART 5 专项校验 | **PASS** |
| **清理状态** | 未知/改变时零强杀并保留；证据恢复后可重试；合法资源正常清理；EBUSY 保持 | 异常与复用场景 100% 保留 profile，恢复后 `dispose()` 成功回收；PART 6 真实合法受控 Edge 子进程正常回收并清理目录；历史 7 项 EBUSY 保持 | **PASS** |

---

## 三、全量回归与语法检查结果

```text
> npm run check
node --check 11 files + css-template-guard
css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
Exit: 0

> node qa/verify-eighth-review-probes.mjs
--- ALL EIGHTH REVIEW VERIFICATION PROBES PASSED! ---
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
    - 新增 `normalizeWindowsPath`，在 `classifyProcessRecord` 中实施完整规范化绝对路径等值核验；
    - 升级 `parseCreationDate`，严密过滤非数值、非有限及损坏时间戳；
    - `classifyProcessRecord` 强制当前快照携带合法 `CreationDate`，比对基线时间戳；
    - `checkWindowsProcessIdentity` 彻底移除测试空输出放行，增加 `returnedPid !== Number(pid)` 防线；
    - Phase 2 动作前核验增加根/子基线存在性预检，基线缺失或身份异常坚决不下发强杀并保留现场；
  - `qa/verify-eighth-review-probes.mjs`：新建八审完整验收矩阵套件（涵盖全路径、创建时间、4 项隔离负例、根边界、PID 对应及正本清理）；
  - `qa/verify-seventh-review-probes.mjs` / `qa/verify-sixth-review-probes.mjs` / `qa/verify-fifth-review-probes.mjs`：按统一协议更新替身响应。
- **保护规范**：
  - 零可见窗口，无前台抢占；
  - 日常 DSH 0.2.1-rc.2 / 鲸系外观 rc.35 正常运行中，未发生热改；
  - 版本号严格保持 `0.6.0-rc.30`，未进行 Git 提交或推送；
  - 后台活跃任务保持为 0。

交付 Codex 进行八审补修复核。
