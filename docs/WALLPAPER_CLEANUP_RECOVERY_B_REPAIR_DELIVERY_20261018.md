# 日常壁纸清理恢复 B 首轮复审补修交付报告

日期：2026-10-18\
责任人：小G（Gemini 3.8 Flash High）\
复审输入：[日常壁纸清理恢复 B 首轮复审报告](WALLPAPER_CLEANUP_RECOVERY_B_REVIEW_20261018.md)、[恢复 B 原任务单](GEMINI_NEXT_WALLPAPER_CLEANUP_RECOVERY_20261018.md)、[现场事故排查记录](DAILY_SCROLL_WALLPAPER_INCIDENT_TRIAGE_20261018.md)。\
交付范围：**严格仅做日常壁纸清理恢复 B 离线补修**（R1–R4），不转滚动 A，不修改生产资产或版本号，不操作日常运行中的 DSH 与 Wallpaper Engine，初次断流根因如实记录为未知。

---

## 1. 事故因果与离线回放表述校正

依据复审意见，对首轮交付报告中的因果表述与回放性质作严格校正：
1. **初次断流原因仍为未知**：事故现场证据仅支持“日志窗口中未见最终 `[Summary]`，且收尾保护没有收敛”。此前关于“父进程 force-kill 导致缺 Summary”的因果推论撤回并纠正为“可能的相关现象，但真实首发断流根因仍未知”。
2. **事故数据离线回放性质**：所有回放与测试均为使用真实事故日志（`preview-final.json`、`taskbar-action.json`）在离线沙盒中使用替身进行的逻辑回放与协议验证，非现场真实进程强杀，亦不宣称现场当前物理资源已被探测释放。
3. **日常环境零干扰承诺保持**：全程未安装、打包、重启或采样日常应用（DSH 0.2.1-rc.2 / 外观 rc.35 / WE），未修改版本号（`0.6.0-rc.30`）或二进制 `WallpaperProbe.exe`，P1A 十审 161 项输入与 59 项资产归档保持一致。

---

## 2. R1–R4 补修实现与代码指纹

### 2.1 R1（P1）：修复损坏查询记录被误判为空集
- **缺陷**：此前 `queryWindowsProcesses` 遇到 `{}`、`[{"Name":"WallpaperProbe.exe"}]`（缺失 ProcessId）或 `[null]` 时，循环过滤非法项后返回 `ok: true, processes: []`，导致“查询协议损坏”被误认为“确认无目标进程”，使二次 stop 错误释锁并关窗。且此前通过命令行包含 `Get-CimInstance`/`Win32_Process` 粗暴丢弃记录。
- **修复**：
  1. 增加严格字段与行有效性校验：对每个条目严格验证 `item !== null`、`Number.isInteger(Number(item.ProcessId))`，且必须具备合法的 `ProcessId`、`Name`、`CommandLine`。
  2. 遇到空对象 `{}`、缺 PID、包含 null 条目、非对象非数组输出时，一律返回 `{ ok: false, error: 'process-query-missing-process-id' | 'process-query-contains-invalid-item' | ... }`，禁止静默过滤为空集。
  3. 移除粗暴的 `Get-CimInstance`/`Win32_Process` 子串过滤，改为在 PowerShell 命令端明确过滤 `$_.ProcessId -ne $PID`（排除当前查询者自身），并在 JS 端核验 `pid !== process.pid`。
  4. 遇到查询失败时，`verifyIndependentWorkerCleanup` 一律返回 `{ safe: false, reason: 'process query failed: ...' }`，严格保留会话锁，零调用源窗口关闭。

### 2.2 R2（P1）：动作报告必要字段、身份绑定与终结证据严格校验
- **缺陷**：此前在缺少 `requestedIdentity`/`action`、缺少 `cleanupSafe`、`action.exited = false` 或 `startUtc` 为 2099 年未来时间时，逻辑仍因 `!== false` 等宽松判断返回 safe。
- **修复**：
  1. 结构与版本校验：严格要求 `record.schemaVersion === 1`、`location` 严格全等匹配。
  2. 终结状态校验：拒绝 `action-pending`、`action-unconfirmed`、`pending` 等中间态；要求 `stage` 必须在合法完结状态集合内。
  3. 身份与时间绑定：
     - 严格要求 `requestedIdentity` 包含合法的整数 `hwnd > 0` 和 `pid > 0`，若创建时已知窗口 HWND/PID 则必须全等比对。
     - 严格要求 `requestedIdentity.startUtc` 为合法且可解析的 ISO 时间串，且不得超出当前时间 60 秒以上（拒绝 2099 年未来伪造时间）。
     - 若包含 `beforeIdentity.startUtc`，必须与 `requestedIdentity.startUtc` 严格一致；若会话记录了 `expectedStartUtc`，也必须严格一致。
  4. 动作安全与终结证据：
     - 严格要求 `record.action` 必须存在且为对象。
     - 严格要求 `action.cleanupSafe === true`（禁止缺省或非布尔 true）。
     - 严格要求 `action.exited === true`（禁止 `exited !== false` 容差）。
     - 严格拒绝 `action.pending === true`、`action.timedOut === true`、`action.terminated === true`。

### 2.3 R3（P1）：删除依据观测缺失推断“未启动”的放行逻辑
- **缺陷**：此前若采集进程已被 `spawn`，但因异常未发送任何 `Status`/`Summary` 且无 action 文件时，因 `!captureStarted` 返回 safe。
- **修复**：
  1. 区分“真实未创建采集”与“已创建但未收到日志”：通过 `captureSpawned: Boolean(child)` 显式传入实际阶段。
  2. 只有当采集进程确实从未被创建（`!captureSpawned`）且无 action 文件时，才视为安全的未启动阶段。
  3. 若采集进程已被创建（`captureSpawned === true`），哪怕未收到任何首条状态、无日志输出，只要缺少 `taskbar-action.json`，一律返回 `{ safe: false, reason: 'taskbar-action.json missing; cannot confirm worker state' }`，维持未知状态保护，拒绝关窗，保留会话锁。
  4. 在后续第 3 次重试中，若补齐合法 action 文件，能够正常恢复并成功关闭源窗口、释放会话锁。

### 2.4 R4（P2）：独立目录建立纯 rc.35 运行基底、补齐真实并发与迟到覆盖
- **立项与隔离**：
  - 在全新独立目录建立可运行基底：`F:\dsh-wallpaper-plugins\.tmp\wallpaper-cleanup-b-repaired-rc35-20261018/`。
  - 保留冻结未修复基底 `rc35-base`（来源于事故现场安装包，完全未修复，SHA256: `670DE9B99AC9F89751234F7C018923537DB97B42D04AAFCC8F10E1766F3FB527`）。
  - 在 `rc35-repaired` 中最小整合本轮 B 修复。
  - 生成基底补丁：`rc35-minimal-diff.patch`。
  - 编写并执行纯 rc.35 回放脚本与探针脚本，直接 `import('./rc35-repaired/src/wallpaper/session.js')`，完全独立于工作区源码。
- **并发与迟到结果覆盖**：
  - 真实并发 `stop()`：使用 `await Promise.all([session.stop(), session.stop()])`，验证在首次证明不足时并发调用均返回 `closed: false` 且 0 次关窗；在补齐合法 action 证明后并发调用均返回 `closed: true`，且底层 `--window-ensure-closed` **恰好只执行 1 次**，锁安全释放。
  - 迟到数据与监听器泄漏：在会话安全关闭后，向已退出的旧子进程 `oldChild.stderr` 和 `oldChild.stdout` 触发迟到数据，验证安全忽略无报错；并显式断言 `oldChild` 的 `close`、`error`、`stderr.data`、`stdout.data` 监听器数量全为 0，零定时器与监听器泄漏。

---

## 3. 文件与代码指纹清单

| 文件路径 | 状态 | SHA256 指纹 |
| --- | --- | --- |
| `dsh-whale-mist/src/wallpaper/session.js` | 工作区补修源码 | `69384D568D25A5BAAFAC7D0165248E191834AD4F646C752EE227CE27185D5BA5` |
| `.tmp/wallpaper-cleanup-b-repaired-rc35-20261018/rc35-base/src/wallpaper/session.js` | 事故现场冻结基底（未修复） | `670DE9B99AC9F89751234F7C018923537DB97B42D04AAFCC8F10E1766F3FB527` |
| `.tmp/wallpaper-cleanup-b-repaired-rc35-20261018/rc35-repaired/src/wallpaper/session.js` | Standalone rc.35 补修基底 | `504FE868E66774378B626CEC4F3B3DD87008D64704A0372C51042B7AE3C8AB73` |
| `.tmp/daily-incidents-20261018-ede83704/logs/preview-final.json` | 事故现场真实预览日志（冻结） | `261E094DF31EB7FFFE42AF2EE1F44E7EE9B67DBFEE678287F6AF6D02598375EE` |
| `.tmp/daily-incidents-20261018-ede83704/logs/taskbar-action.json` | 事故现场真实动作日志（冻结） | `BD6E45E200C6777323CC0BD774F1F54B007FE36EF797DA3474F2F113DC8EB321` |

---

## 4. 独立验证结果与测试矩阵

### 4.1 Standalone RC.35 运行结果（`rc35-repaired`）
在 `.tmp/wallpaper-cleanup-b-repaired-rc35-20261018` 目录下直接执行：
1. **事故数据离线回放（`incident-recovery-replay-rc35.mjs`）**：
   - `timeout-force-killed` 模式：
     - Attempt 1（缺 Summary、无 Action 文件）：`outcome: 'worker-unconfirmed', closed: false`，关窗调用 0 次，会话未关闭（锁保留）。
     - Attempt 2（提供合法 Action 证明）：`outcome: 'absent', closed: true`，关窗调用 1 次，会话成功关闭（锁释放）。
   - `normal-exit-missing-summary` 模式：
     - Attempt 1（缺 Summary、无 Action 文件）：`outcome: 'worker-unconfirmed', closed: false`，关窗调用 0 次，会话未关闭（锁保留）。
     - Attempt 2（提供合法 Action 证明）：`outcome: 'absent', closed: true`，关窗调用 1 次，会话成功关闭（锁释放）。
   - 结果落盘于 `replay-result-rc35.json`，退出码 0。
2. **纯 RC.35 探针与边界负例（`verify-rc35-probes.mjs`）**：
   - 3 项解析负例：`empty-object` (`{}`)、`missing-pid`、`invalid-row` (`[null]`) 全部返回 `ok: false` 并标明具体解析错误。
   - 6 项危险放行全部修复并被拦截（0 危险关窗，`closed: false`，关窗调用 0 次）：
     - `missing-identity-and-action`: 拦截（`taskbar-action missing requestedIdentity`）。
     - `missing-cleanup-safe`: 拦截（`cleanupSafe is not true`）。
     - `exited-false`: 拦截（`got exited=false`）。
     - `different-startUtc`: 拦截（`startUtc is in the future: 2099-01-01T00:00:00Z`）。
     - `malformed-process-record`: 底层 `execCommand` 注入 `{}`，拦截（`process query failed: process-query-missing-process-id`）。
     - `no-status-no-action`: 拦截（`taskbar-action.json missing; cannot confirm worker state`）。并在 attempt 3 补齐合法证明后成功恢复。
   - 2 项拒绝对照（保留）：
     - `foreign-location-control`: 拦截（`location mismatch`）。
     - `live-worker-control`: 拦截（`worker process 7788 is still running`）。
   - 1 项合法对照：
     - `valid-control`: 成功恢复（`closed: true`，关窗调用 1 次）。
   - PART 3 真实并发 stop：`Promise.all` 两个并发请求，底层关窗恰好只调用 1 次，均安全解析。
   - PART 4 迟到数据与监听器泄漏：迟到数据不抛错，监听器计数均为 0。
   - 结果落盘于 `rc35-probes-result.json`，全部 PASS。

### 4.2 工作区测试矩阵
1. **静态检查**：`npm run check` -> 0 错误通过。
2. **底层 Review Probes 验证**：`node qa/wallpaper/verify-b-review-probes.mjs` -> 全部 12 项场景 + 并发 + 迟到断言 100% 通过（0 危险放行）。
3. **工作区壁纸完整测试套件**：
   `node --test qa/wallpaper/session.test.mjs qa/wallpaper/routes.test.mjs qa/wallpaper/cleanup-recovery-b.test.mjs`
   -> **71 / 71 PASS**（0 fail, 0 cancelled, 0 skipped）。
4. **P1A 十审回归保护**：
   `npm run test:detachable-p1a` -> **5 / 5 PASS**。
   `node qa/verify-ninth-review-probes.mjs` -> **7 / 7 PASS**。

---

## 5. 覆盖与未覆盖声明

1. **已覆盖范围**：
   - 进程查询原始输出异常与损坏解析（`{}`、缺 PID、`[null]`、非法 JSON、非对象等）。
   - 查询者自身过滤机制脱离关键字误杀，精准按 PID 排除。
   - 动作报告严格模式：必要字段（`schemaVersion`、`location`、`requestedIdentity`、`action`）、时间戳非未来性与跨结构一致性、`cleanupSafe === true` 与 `exited === true` 终结态强断言。
   - 采集进程启动后即使无状态也维持未知状态保护，删除观测缺失推断未启动漏洞。
   - 证明不足保持会话锁且 0 次关窗，后续轮次补齐合法证明后恢复。
   - 独立目录构建纯 rc.35 基底回放与全套探针，证明修复有效性脱离工作区源码依赖。
   - 真实并发 `stop()` 防重入与幂等性保障。
   - 进程退出后迟到日志安全丢弃，定时器与事件监听器 100% 释放。
2. **未覆盖范围（真实离线边界）**：
   - 未实机执行真实的 Windows PowerShell 进程扫描（全部通过注入 `execCommand` 替身覆盖协议）。
   - 未实机强杀真实 Windows 进程或关闭真实 Wallpaper Engine 预览窗口。
   - 未对滚动断流 A 进行前端重构或排查（严格遵从指令，保持隔离留后）。
   - 未打包或安装到日常环境，日常运行的 DSH 0.2.1-rc.2 与 Wallpaper Engine 保持未触碰。

---

## 6. 接续与交付状态

本补修已全部闭环，所有证据、补丁与独立回放日志已就绪。
请 Codex 进行日常壁纸清理恢复 B 的复审核验。
