# 独立/吸附设置P1A六审补修交付：进程快照结构化输出协议、严格身份与参数边界核验、Pre-Action定向核杀与全部系统调用统一超时

2026-10-18，小 G。对照[六审报告](DETACHABLE_APPEARANCE_P1A_SIXTH_REVIEW_20261017.md)实施专项补修。**前轮已闭合项（W2 根缺席平滑过渡、W4 存活后代 dispose 绝对保护、EBUSY 重试闭环、R1 来源分表、R4-A 已有目录保护、R4-C 停止失败重试、React 19 挂载、生产伴随页调参、R6 队列保持）完全保持，本轮范围严格锁定在 W1 输出解析协议与未知状态保留、W3 生产进程快照归属核验与系统调用统一 runner。**

本轮严格遵守离线与安全规范：未改动运行中 DSH（0.2.1-rc.2）、Wallpaper Engine 或日常桌面 Profile，未创建任何可见系统窗口，未修改 `package.json` 版本（保持 `0.6.0-rc.30`），未提交或推送 Git 变更。

---

## 一、六审两项缺陷的根因分析与补修实现

### 1.1 W1 [P1] 明确输出协议与解析失败/未知状态绝对保护（杜绝假空集误删）

- **根因分析**：
  原代码在命令执行无报错时，若输出内容为非 JSON 杂质文本（如 `not a process result\r\n`）或截断的残缺 JSON（如 `[{"ProcessId":987655001`），`JSON.parse` 报错被 `catch` 吞掉，随后静默回退至逐行 `parseInt`；由于文本无法被解析为合法正整数 PID，过滤后得到空数组 `[]`，从而将“非空但解析失败”错误归纳为“0 个进程存活”，放行了后续的目录清理。
- **补修实现**：
  1. **采用明确可验证的输出协议**：
     - 若 stdout 为空或纯空白（`!stdout || !stdout.trim()`），确认为合法空集（CIM 无任何匹配进程），安全返回 `{ ok: true, pids: [], processes: [] }`；
     - 若 stdout 非空，必须严格走 `JSON.parse`。一旦解析抛出异常（截断、乱码、非结构化文本），**立即报错返回 `{ ok: false, error: 'process-query-parse-failed: ...' }`**，坚决杜绝静默降级或吞咽；
     - 若解析后根对象非对象/数组，返回 `{ ok: false, error: 'process-query-invalid-structure' }`。
  2. **区分“已核验”、“非本轮”与“身份信息不足”**：
     - 单独提取 `classifyProcessRecord`，遍历列表中的每一个进程快照；
     - 若任何匹配项存在缺失必填字段（缺少合法 PID、缺少 `CommandLine`、缺少可执行体名称等），一律归类为 `insufficient-info`；
     - 凡出现 `insufficient-info` 或非法记录，查询立即返回 `{ ok: false, error: 'insufficient-process-identity: ...' }`；
  3. **未知状态下失败保留闭环**：
     - `performResourceGroupInspection` 遇查询失败/结构不符/信息不足时，明确返回 `{ ok: false, alive: true, unknown: true }`；
     - `close()` 严禁在 `unknown: true` 状态下执行 Phase 2 强杀动作，严禁清理 `targetProfileDir`，完整保留 `activeProcesses` 跟踪记录与 `ownedProfileDirs` 所有权，并返回失败；
     - `dispose()` 严格保护活体及失败目录，唯有在条件解除（如重试时确认为空）后才执行物理删除。

### 1.2 W3 [P1] 生产查询接入完整快照，消除前缀碰撞与非 Edge 误判，Pre-Action 二次核杀与统一 Runner

- **根因分析**：
  1. 原 PowerShell 查询采用 `Select-Object -ExpandProperty ProcessId`，输出被压扁为纯 PID 文本，丢失了 `Name`、`ExecutablePath` 与 `CommandLine`；生产分支走逐行数字解析，根本未调用快照过滤器 `isControlledEdgeProcess`；
  2. 原过滤器采用 `cmd.includes('--user-data-dir='+dir)`，会将 `--user-data-dir=<profile>-other` 前缀碰撞误认为匹配；且可执行体校验仅用了 `includes('edge')`，会将 `knowledge.exe` 等字面包含 edge 的外部程序放行；
  3. Phase 2 在对存活子 PID 发出 `taskkill` 前未做二次存活与身份核验，可能在极端竞态下误伤被 OS 回收并复用 PID 的无关进程；
  4. 存在部分 `taskkill` 分支直接调用 `execCommand`，未走统一带 3000ms 超时的 `runExec` 管道。
- **补修实现**：
  1. **生产查询命令接入完整快照**：
     - 命令生成重构为：
       ```powershell
       Get-CimInstance Win32_Process -Filter "CommandLine like '%<profile>%'" -ErrorAction Stop |
         Where-Object { $_.ProcessId -ne $PID } |
         Select-Object ProcessId, Name, ExecutablePath, CommandLine |
         ConvertTo-Json -Compress
       ```
     - 彻底摒弃 `-ExpandProperty ProcessId`，保留查询自身排除，确保返回包含完整字段的可校验进程快照；
  2. **精确参数边界与完整可执行体核验**：
     - 新增 `extractUserDataDir(commandLine)`：准确提取 `--user-data-dir` 实际参数值，完整处理引号包裹（`"--user-data-dir=..."` / `--user-data-dir="..."` / `'...'`）、空格分隔（`--user-data-dir <path>`）与无引号格式；
     - 校验目标路径采用 `resolve` 路径规范化后的精确等值比对，彻底封死 `--user-data-dir=<profile>-other` 等前缀碰撞；
     - 排除 `powershell`、`pwsh`、`cmd`、`bash`、`sh` 等所有常见 shell；
     - 可执行体名称进行基础名比对（`basename(name).toLowerCase()`），必须与预期（如 `msedge.exe` / `msedge`）全字匹配，杜绝 `includes('edge')` 导致的 `knowledge.exe` 误放行；
     - 外部无 `--user-data-dir` 参数的字符串提及（如 `powershell.exe -Command Write-Output '<profile>'`）归类为 `foreign-mention`，确认为无关进程，绝不赋予强杀权限，亦不阻碍正常关窗收尾；
  3. **Pre-Action 二次存活与身份确认**：
     - 在 Phase 2 向每个存活子 PID 下发强杀前，先调用 `checkWindowsProcessIdentity(subPid, profileDir, execCommand)` 执行预检；
     - 仅当明确返回 `matched` 时才下发 `taskkill`；
     - 若返回 `mismatched`（PID 已被 OS 回收）或 `error`，**绝不下发强杀**，记录 `sub-process-pid-recycled` 并保留失败状态，杜绝任何误杀可能；
  4. **底层系统调用统一收敛至带超时的 `runExec`**：
     - 修正 Phase 2 中直接调用 `execCommand('taskkill.exe', ...)` 的遗留分支，所有 `taskkill.exe` 与 `powershell.exe` 调用全部统一收敛至 `runExec(execCommand, ...)`；
     - 默认在原生系统调用携带 `{ timeout: 3000 }` 超时防护，且安全兼容 Node 原生与 3/4 参数测试替身。

---

## 二、六审安全门禁（Safety Gate）与专项探针验证

### 2.1 六审专项与安全门禁探针（`qa/verify-sixth-review-probes.mjs`）

新建 `qa/verify-sixth-review-probes.mjs`，包含单元参数解析校验、Codex 六审 8 项安全门禁对照复测、以及 Phase 2 存活子进程定向回收与 PID 复用拦截探针：

```text
--- Running Sixth Review Verification Probes (W1, W3, and Safety Gate) ---
[UNIT 1] extractUserDataDir boundary parsing...
  -> PASS
[UNIT 2] classifyProcessRecord and isControlledEdgeProcess...
  -> PASS

[SAFETY GATE EVALUATION]
  PASS: W1 exec error retains profile
  PASS: W2 absent root cleans only after empty resource query
  PASS: W3 query process excluded
  PASS: W3 foreign profile mention never targeted
  PASS: W1 malformed text preserves unknown resources
  PASS: W1 malformed JSON preserves unknown resources
  PASS: W3 JSON profile prefix collision never targeted
  PASS: W3 JSON unrelated executable never targeted

[PROBE 9] Legitimate surviving child process is verified and terminated in Phase 2...
  -> PASS
[PROBE 10] PID recycled before Phase 2 taskkill: must NOT kill and must retain profile...
  -> PASS

--- ALL SIXTH REVIEW VERIFICATION PROBES PASSED! ---
```

- **Check 1（W1 命令错误保留资源）**：CIM 报错返回 `ok: false`，`first` 及 `failedDispose` 均保留 profile，重试恢复后成功清理。
- **Check 2（W2 根已退出平滑收尾）**：根 absent（退出码 2）平滑放行至资源组核验，为空后清理成功。
- **Check 3（W3 查询自身排除）**：PowerShell 命令内建自身排除，`forcedPids.length === 0`。
- **Check 4（W3 外部 profile 提及绝不强杀）**：`Write-Output '<profile>'` 准确识别为 `foreign-shell`，`forcedPids.length === 0`，不发 taskkill。
- **Check 5（W1 异常文本输出保留未知资源）**：`not a process result\r\n` 准确报解析错误，`close.ok === false` 且 profile 严密保留，不降级为空。
- **Check 6（W1 截断 JSON 保留未知资源）**：`[{"ProcessId":987655001` 报 JSON 解析异常，`close.ok === false` 且 profile 严密保留。
- **Check 7（W3 参数前缀碰撞绝不强杀）**：`--user-data-dir=${profile}-other` 准确拦截为 `foreign-prefix-collision`，`forcedPids.length === 0`。
- **Check 8（W3 无关可执行体绝不强杀）**：`knowledge.exe` 准确拦截为 `foreign-executable`，`forcedPids.length === 0`。
- **Probe 9（真正受控 Edge 子进程回收）**：正本 Edge 子进程在 Phase 2 被精确命中（`taskkillTarget: 987655001`），二次核验为空后成功清理。
- **Probe 10（Pre-Action 预检防御 PID 复用）**：模拟子进程 PID 被 OS 回收复用（`mismatched`），Phase 2 拒绝发出 taskkill，严密保护外部进程并保留目录。

---

## 三、全量回归与语法检查结果

```text
> npm run check
node --check 11 files + css-template-guard
css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
Exit: 0

> node qa/verify-sixth-review-probes.mjs
ALL SIXTH REVIEW VERIFICATION PROBES PASSED!
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
  - `src/detachable-edge-adapter.js`：新增 `extractUserDataDir`、`classifyProcessRecord`，更新 `isControlledEdgeProcess`、`queryWindowsProcessesByProfile`，修正 Phase 2 `runExec(execCommand, 'taskkill.exe', ...)` 及 Pre-action PID 预检；
  - `qa/verify-sixth-review-probes.mjs`：新建六审专用安全门禁与极端负例套件（10 项专项）；
  - `qa/verify-fifth-review-probes.mjs`：适配底层 IO fixture 至 JSON 快照协议。
- **保护规范**：
  - 零可见窗口，无前台抢占；
  - 日常 DSH 0.2.1-rc.2 / 鲸系外观 rc.35 正常运行中，未发生热改；
  - 版本号严格保持 `0.6.0-rc.30`，未进行 Git 提交或推送。
- **状态同步**：
  - `F:/dsh-wallpaper-plugins/docs/PROJECT_STATUS.md` 与 `F:/deepseekharness/NEXT_TASK.md` 已同步至六审补修交付状态。

交付 Codex 进行六审补修复核。
