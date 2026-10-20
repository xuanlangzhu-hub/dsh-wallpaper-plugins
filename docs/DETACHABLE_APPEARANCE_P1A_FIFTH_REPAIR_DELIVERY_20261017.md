# 独立/吸附设置P1A五审补修交付：默认Windows资源核验、根缺席自适应、受控子进程定向回收与存活资源目录绝对保护

2026-10-17，小 G。对照[五审报告](DETACHABLE_APPEARANCE_P1A_FIFTH_REVIEW_20261017.md)实施专项补修。**前轮已闭合项（R1 来源分表、R4-A 已有目录保护、R4-C 停止失败重试、React 19 挂载、生产伴随页调参、R6 调参保持、已终止进程的 EBUSY 目录重试闭环）完全保持，本轮范围严格锁定在 W1–W4 默认 Windows 系统分支资源核验与失败保留。**

本轮严格遵守离线与安全规范：未改动运行中 DSH（0.2.1-rc.2）、Wallpaper Engine 或日常桌面 Profile，未创建任何可见系统窗口，未修改 `package.json` 版本（保持 `0.6.0-rc.30`），未提交或推送 Git 变更。

---

## 一、五审四项缺陷的根因分析与补修实现

五审指出了在脱离注入钩子、走底层 `execCommand` / Windows 默认分支时的四个核心缺陷：

### 1.1 W1 [P1] 查询错误结构化与未知状态保护（彻底阻断假死误删）
- **根因**：原 `queryWindowsProcessesByProfile` 在执行出错、超时或空输出时无差别返回 `[]`，外层将其认作“全部进程已死”而放行目录删除。
- **补修**：
  - `queryWindowsProcessesByProfile` 返回结构化结果 `{ ok: true, pids: [...], processes: [...] }` 或 `{ ok: false, error: ... }`；
  - `performResourceGroupInspection` 遇查询错误明确标记 `{ alive: true, unknown: true, error: queryRes.error }`；
  - `close()` 严禁在未知状态下报告成功或删除目录，直接返回 `{ ok: false, error: 'resource-inspection-failed' }`（或透传具体 CIM 错误），并完整保留 `activeProcesses` 跟踪记录与 `ownedProfileDirs` 目录归属。

### 1.2 W2 [P1] 根窗口已被用户手动关闭（Absent）的平滑过渡与收尾
- **根因**：用户提前手动关闭窗口后，根 PID 已在 OS 进程表中消失，旧代码因 PowerShell 查无此 PID 统一抛出退出码 1，被一律判定为 `pid-identity-mismatch`，导致资源组检查被跳过（`resourceQueries: 0`），目录永远无法清理。
- **补修**：
  - 重构 `checkWindowsProcessIdentity`：严格区分 `matched`（存在且匹配）、`not-found`（进程不存在/已提前退出）、`mismatched`（存在但命令行不匹配，属于 PID 回收）及 `error`（查询超时/故障）；
  - 当根进程为 `not-found` 时，适配器将其识别为**合法的提前关窗生命周期状态**，自动标记 `processRecord.exited = true`，跳过向已死 PID 发送 `CloseMainWindow`，平滑进入资源组检查（`performResourceGroupInspection`）；
  - 若资源组确认无残留渲染器/子进程，顺利完成目录清理并返回 `ok: true`；若有存活子进程，进入 Phase 2 定向回收。只有真实 `mismatched` 时才拒绝操作并报 `pid-identity-mismatch`。

### 1.3 W3 [P1] 消除查询自身干扰，定向强制回收存活子 PID（杜绝误伤已死根 PID）
- **根因**：
  1. PowerShell 命令行内含 `profileDir`，原脚本未排除查询者自身 PID；
  2. 根进程已退出但子进程存活时，Phase 2 仍盲目调用 `taskkill.exe /PID <rootPid> /T /F`（指向已死的根 PID），未对实际存活的子进程下发终结。
- **补修**：
  - 查询命令增加 `Where-Object { $_.ProcessId -ne $PID }` 排除 PowerShell 查询进程自身；
  - 增加生产级过滤器 `isControlledEdgeProcess`：排除 PowerShell、cmd、bash 等外壳，核对可执行体名称（`msedge.exe`），且严格核对命令行中精确的 `--user-data-dir=<profileDir>` 参数，拦截任何无关进程或仅字面提及目录的非受控程序；
  - Phase 2 强制回收重构：若根进程已退出（`!groupStatus.rootAlive`），强制终结动作（`taskkill.exe /PID <subPid> /F`）**直接精准指向 `groupStatus.pids` 中的实际存活子 PID**，绝不再将死掉的根 PID 传给 taskkill；回收后再次执行资源组二次核验。

### 1.4 W4 [P1] `dispose()` 存活资源目录绝对保护（失败保留完整闭合）
- **根因**：原 `dispose()` 仅在 `processTerminated: true` 时才将目录加入 `failedDirs`；当进程资源组仍存活（`resource-group-still-alive`）时，`dispose()` 的第二轮孤儿目录扫描误将活进程的目录删掉。
- **补修**：
  - 在 `dispose()` 启动时，预先收集 `activeProcesses` 中所有活动的 profile 目录（`activeDirs`）；
  - 第一轮遍历各进程 `close()`：若失败（无论是进程未退还是目录未删），目录无条件追加到 `failedDirs`；
  - 第二轮孤儿目录清理：只要目录存在于 `activeDirs` 或 `failedDirs` 中，**绝对禁止调用 `cleanupProfileDir`**；
  - 只有在未来条件解除（所有进程与资源组彻底确认为空）后，再次调用 `dispose()` 才会执行清理并返回 `ok: true`。

---

## 二、系统调用适配器与调用契约统一

针对五审提出的“将系统调用、结果解析与资源归属判定作为一个可注入但默认生产实现完整的边界”的建议：

1. **统一底层命令执行入口（`runExec`）**：
   - 提取 `runExec(execCommand, file, args, callback)` 统一适配器，兼顾 Node 原生 `defaultExecFile`（携带 `{ timeout: 3000 }`）与测试打桩（`fakeExec(cmd, args, cb)`）；
   - 所有 Windows 系统级操作（PID 身份核对、`.CloseMainWindow()`、CIM 资源组扫描、`taskkill.exe`）一律走统一管道，彻底消除生产实现与测试桩的分离。
2. **多态测试桩兼容（`isWindowsTarget`）**：
   - 定义 `isWindowsTarget = (process.platform === 'win32' && !isMockSpawn) || execCommand !== defaultExecFile`；
   - 在真实 Windows 生产与注入了 `execCommand` 的 VM/专项测试中完整执行生产解析链路，既允许底层 I/O 替换，又杜绝了跳过生产业务判断的假测试。

---

## 三、专项探针与全量回归测试结果

### 3.1 五审专项探针（`qa/verify-fifth-review-probes.mjs`）

新建专项探针覆盖五审提出的全部缺陷场景与 VM 原型测试，5 项探针全部 PASS：

- **Probe 1（W1 查询错误保留资源）**：
  - 模拟 CIM 查询报错；`close()` 明确返回 `ok: false, error: 'synthetic-CIM-failed', processTerminated: false`；
  - 核验 `tracked === 1`、`owned === 1`、`existsSync(profileDir) === true`，目录和记录严密保留；
  - 随后的 `dispose()` 同样拒绝删除目录。
- **Probe 2（W2 用户提前关窗平滑收尾）**：
  - 模拟根 PID 提前在 OS 中消失；核验未触发 `pid-identity-mismatch`；
  - 自动递进至资源组核查（`resourceQueries === 1`）；无子进程残留时顺利完成目录清理与记录清空。
- **Probe 3（W3 Taskkill 定向命中存活子 PID）**：
  - 模拟根退出但子进程 `987655001` 存活；
  - 核验 Taskkill 强制目标精准为 `['987655001']`，未向旧根 PID（`987654712`）发送动作；
  - 二次资源扫描确认为空后闭环退出。
- **Probe 4（W4 Dispose 存活资源目录绝对保护）**：
  - 模拟后代存活；第一次 `close()` 失败后调用 `dispose()`；
  - 核验 `dispose()` 返回 `some-processes-failed-to-close`，且 `existsSync(h.profileDir) === true`，`ownedProfileCount === 1`；
  - 模拟后代进程退出后再次调用 `dispose()`，顺利完成目录删除并返回 `ok: true`。
- **Probe 5（Codex exact VM 原型全量通过）**：
  - 直接运行 Codex 五审原型 VM 场景（`queryFailure`、`alreadyClosedRoot`、`querySelfMatch`）；
  - `alreadyClosedRoot` 跑通 2 次资源查询，taskkillTarget 正确命中 `987655001`，全量断言通过。

### 3.2 完整回归测试套件结果

```text
> npm run check
node --check 11 files + css-template-guard
css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
Exit: 0

> node qa/verify-fifth-review-probes.mjs
[PROBE 1 - W1] Testing that query error preserves process and profile directory... -> PASS
[PROBE 2 - W2] Testing that user closing window prior to close() is handled gracefully... -> PASS
[PROBE 3 - W3] Testing that Phase 2 taskkill targets surviving child PIDs... -> PASS
[PROBE 4 - W4] Testing that dispose preserves profile directory when sub-process survives... -> PASS
[PROBE 5] Running Codex exact VM test fixture checks... -> PASS
--- ALL FIFTH REVIEW VERIFICATION PROBES (W1-W4) PASSED! ---
Exit: 0

> node qa/verify-fourth-review-probes.mjs
7 项四审探针全部 PASS（EBUSY 失败保留重试保持有效）
Exit: 0

> node qa/verify-third-review-probes.mjs
5 项三审探针全部 PASS
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
15/15 专项全部 PASS
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
无多余空白或格式冲突
Exit: 0
```

---

## 四、修改清单与交付状态

| 涉及文件 | 关键变动说明 |
| :--- | :--- |
| [`src/detachable-edge-adapter.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-edge-adapter.js) | 1. 增加 `isControlledEdgeProcess`，排除查询器/外壳，精确校验 `--user-data-dir` 与 Edge 可执行体；<br>2. `queryWindowsProcessesByProfile` 返回结构化结果，排查自身 `$PID`，错误不再降级为空数组；<br>3. `checkWindowsProcessIdentity` 区分 `not-found`（提前关窗）、`mismatched`（复用）与 `matched`；<br>4. Phase 2 强制回收针对 `groupStatus.pids` 中的实际存活子 PID 发送 `taskkill`；<br>5. `dispose()` 预收 `activeDirs`，活进程或失败进程的 profile 目录绝对禁止在孤儿扫描中清理。 |
| [`qa/verify-fifth-review-probes.mjs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/verify-fifth-review-probes.mjs) | 新建五审 W1–W4 专项验证探针及 Codex VM 复现用例。 |

**结论**：五审报告指出的 W1、W2、W3、W4 默认 Windows 系统分支缺陷均已彻底修复闭合，无任何回归。请复审。
