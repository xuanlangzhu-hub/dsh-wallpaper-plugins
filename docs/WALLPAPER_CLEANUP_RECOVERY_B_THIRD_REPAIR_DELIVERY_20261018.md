# 日常壁纸清理恢复 B 第三轮补修交付报告

**日期**：2026-10-18\
**执行角色**：Antigravity (Pair Programming Agent)\
**审查输入**：[`WALLPAPER_CLEANUP_RECOVERY_B_THIRD_REVIEW_20261018.md`](file:///F:/dsh-wallpaper-plugins/docs/WALLPAPER_CLEANUP_RECOVERY_B_THIRD_REVIEW_20261018.md)\
**任务目标**：针对三审中指出的 T1（默认创建身份入口未接通）、T2（时间分数/日历严格契约）、T3（未启动分支缺字段/冲突校验）及 QA 跨轮路由/监听器流断言进行离线闭环修复，并在全新独立目录建立可独立运行的 rc.35 对应整合版，保持历史证据完整。

---

## 一、核心问题诊断与修复方案

### 1. T1（P1）：默认可调用的可信本轮创建身份入口与真实原生协议闭环

- **问题根源**：现有真实的 rc.35 原生二进制辅助进程 `SourceWindowHelper.WindowState` 仅返回 `{ Hwnd, Pid, ProcessName, Title, Visible }`，不提供 `startUtc`。此前测试通过替身人工注入 `startUtc` 掩盖了该缺口，导致在真实 native 形状下 `windowStartUtc` 始终为 null，二次/三次 stop 总是被 `missing expected creation identity baseline for window` 永久拒绝。
- **修复方案**：
  1. **真实可信身份入口**：在 `src/wallpaper/session.js` 中实现只读进程创建时间查询入口 `queryWindowsProcessCreationUtc(pid, { execCommand, timeoutMs })`，通过 CIM 查询 `Win32_Process` 获取真实进程的 `CreationDate`（兼容 ISO、`/Date(...)` 及 WMI 时间戳），并提供高层依赖注入入口 `queryProcessIdentity(pid)`。
  2. **会话创建绑定**：在 `createPreviewSession.create()` 中，当获取到 `window.pid` 且 `window.startUtc` 为空时，自动调用 `queryProcessIdentity(windowPid)` 或 `queryWindowsProcessCreationUtc(windowPid)` 绑定该 PID 的物理创建时间到 `windowStartUtc`。
  3. **rc.35 原生二进制兼容性**：无需修改不可信或未发布的 C# 二进制资产，现役未修改的 rc.35 `WallpaperProbe.exe` 产生的 window-find 结果即可直接无缝配合操作系统级只读进程身份校验；若将来引入自身提供 `StartUtc` 的新原生 helper，亦可直接使用，保持向前兼容。
  4. **全链路恢复闭环**：验证在真实 native window-find 形状（无 startUtc）下，第一轮 stop 保持未知并阻止关窗释锁，补齐合法 action 证明后，二次 stop 成功完成关窗核验（`--window-ensure-closed` 恰好 1 次）、路由 status 清除错误、释放会话，并允许后续 start 成功创建。

### 2. T2（P1）：小数秒缺省按零规范化与严格日历/物理时刻等值契约

- **问题根源**：
  1. 此前 `areStartUtcsEquivalent` 仅在两边 `frac` 非空时比较，导致 `.0005000Z` 与缺少小数的 `Z`（相差 500 微秒）被判等放行。
  2. 依赖 `Date.parse` 会自动将非法日历日期（如 `2026-02-30`）溢出归一化为合法日期（`2026-03-02`），从而放行不可能的日期。
- **修复方案**：
  1. **严格正则捕获**：`ISO_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})$/`，明确提取年月日、时分秒、小数部分及完整时区。
  2. **严格日历校验**：根据月份校验范围（1–12），判断闰年（`(y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)`），计算对应天数（平年二月 28 天，闰年 29 天），严格拒绝 `2026-02-30` 等非法日期（返回 null）。
  3. **7 位微秒/100ns 规范化**：缺省小数部分严格按全零补齐到 7 位（`frac7 = rawFrac.slice(0, 7).padEnd(7, '0')`），超过 7 位且非零的拒绝。
  4. **时区物理秒规范化**：计算 `baseUtcSec = Math.floor(Date.UTC(...) / 1000) - tzOffsetSeconds`。
  5. **严格判等**：`parsedA.baseUtcSec === parsedB.baseUtcSec && parsedA.frac7 === parsedB.frac7`。
  - 效果验证：
    - `2026-10-17T09:20:20.0000000Z` vs `2026-10-17T09:20:20Z` -> `true`（合法零补齐通过）
    - `2026-10-17T09:20:20.0005000Z` vs `2026-10-17T09:20:20Z` -> `false`（500us 差异严格拒绝）
    - `2026-03-02T09:20:20Z` vs `2026-02-30T09:20:20Z` -> `false`（非法日历严格拒绝）
    - `2026-10-17T09:20:20.6092543Z` vs `2026-10-17T17:20:20.6092543+08:00` -> `true`（物理等值时区通过）

### 3. T3（P1）：未启动分支（stopped-before-action）显式属性与严格布尔状态约束

- **问题根源**：此前 `stopped-before-action` 允许 `action` 或 `trigger` 为 `undefined`，且对 `action.started` 仅判断 `!== true`，导致损坏/缺字段对象或包含矛盾状态（如 `started: 'true'`、`timedOut: true`）的对象被放行。
- **修复方案**：
  1. 显式属性存在性检查：要求 `'action' in record && 'trigger' in record`。
  2. 触发器约束：必须 `record.trigger === null`。
  3. 显式 null 支持：保留原生协议在未动作时的真实形状 `action: null, trigger: null`。
  4. 严格对象组合校验：若 `action !== null`，必须为非数组对象，且同时满足：
     - `action.started === false`（严格全等 false，拒绝 `'true'`、`true`、`undefined`）
     - `action.cleanupSafe === true`
     - `action.pending === false`
     - `action.timedOut === false`
     - `action.terminated === false`
     - `action.exited === false || action.exited === null`
  - 任何字段缺失、类型错误或矛盾状态立即判为不安全，保留未知及零关窗。

### 4. QA 与路由层断言补齐

- **数据流监听器计数**：修正 `stats()` 中的 `stdoutListeners` 与 `stderrListeners`，分别统计各自流的监听器计数：
  `stdoutListeners: child?.stdout ? child.stdout.listenerCount('data') : 0`
  `stderrListeners: child?.stderr ? child.stderr.listenerCount('data') : 0`
- **真实路由跨轮隔离与迟到事件用例**：
  - 在 Scenario 8 中使用真实原生 window-find 形状（不带 `startUtc`），通过 `queryProcessIdentity` 贯通。
  - 在第 1 轮会话安全闭合、第 2 轮会话已 `start` 处于**活跃运行期间**，向已终止的第 1 轮 child 发送 late stderr/stdout 字节。
  - 断言第 1 轮 child 监听器完全为 0（无泄漏）；断言第 2 轮会话 `report().failure === null`、`diagnostics.firstError === null`，日志无污染；断言路由控制器代次 `controller.generation() >= 1`。

---

## 二、代码指纹与独立证据

### 1. 核心文件 SHA256 指纹

| 路径 / 资产 | SHA256 哈希值 | 说明 |
| --- | --- | --- |
| `dsh-whale-mist/src/wallpaper/session.js` | `F0A0FD93254755B99D6FC5DCAD6B0695C3CA5E59334E5E2452F54BC6B3A04418` | 工作区核心修复实现 |
| `dsh-whale-mist/src/wallpaper/managed-window.js` | `703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A` | 保持三审输入哈希一致 |
| `.tmp/.../rc35-base/src/wallpaper/session.js` | `670DE9B99AC9F89751234F7C018923537DB97B42D04AAFCC8F10E1766F3FB527` | 冻结纯净 rc.35 基线（12项资产基底） |
| `.tmp/.../rc35-base/src/wallpaper/managed-window.js` | `B76B9724BC43AA2F8193D3E0FBCB98B955991BFBDE4304D6CF41C77B9B46D192` | 冻结纯净 rc.35 基线 |
| `.tmp/.../rc35-repaired/src/wallpaper/session.js` | `7127D2F4C7B38C8B821B82761887E7CBFB4BF83C70CEE72DAB7F816214842C9D` | 独立 rc.35 对应修复版 |
| `.tmp/.../rc35-repaired/src/wallpaper/managed-window.js` | `703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A` | 独立 rc.35 对应修复版 |
| `.tmp/.../rc35-minimal-diff.patch` | `98BE1843FA7A8DE5A93BCBCF2F9C402AC249201A3AE5F9ACEE1FF496790757F8` | UTF-8 编码最小差异补丁（仅2个文件） |

### 2. 独立证据目录与历史保护

- 新证据目录：`.tmp/wallpaper-cleanup-b-third-repaired-rc35-20261018/`
  - `rc35-base/`：包含 12 项冻结 rc.35 原生资产
  - `rc35-repaired/`：可独立执行的 rc.35 修复版本
  - `rc35-minimal-diff.patch`：UTF-8 补丁
  - `verify-rc35-probes.mjs`：基于独立 rc.35 的全量探针验证脚本
  - `incident-recovery-replay-rc35.mjs`：基于独立 rc.35 的两种事故回放
  - `rc35-probes-run.log`：独立探针运行日志（100% 通过）
  - `rc35-replay-run.log`：独立事故回放日志（100% 通过）
- 历史证据保留：`.tmp/wallpaper-cleanup-b-repaired-rc35-20261018/` 及 `.tmp/wallpaper-cleanup-b-third-review-20261018-bdace015/` 完全保留，未做任何修改或覆盖。

---

## 三、验证结果矩阵

### 1. 语法与静态检查

- `npm run check`：通过（11 个核心文件语法检查 + CSS 模板防护全部通过，退出码 0）。

### 2. 宿主 JS 测试套件（Host JS 108/108）

运行全量离线宿主 JS 测试：
- `qa/wallpaper/cleanup-recovery-b.test.mjs`（17 项全部通过）
- `qa/wallpaper/session.test.mjs`（24 项全部通过）
- `qa/wallpaper/library.test.mjs`（21 项全部通过）
- `qa/wallpaper/routes.test.mjs`（17 项全部通过）
- `qa/wallpaper/ui-library.test.mjs`（12 项全部通过）
- `qa/wallpaper/catalog.test.mjs`（10 项全部通过）
- `qa/wallpaper/scenes.test.mjs`（7 项全部通过）
- **总计**：108 / 108 全部通过，退出码 0。

### 3. 全量探针验收矩阵（工作区与独立 rc.35 均跑通）

脚本：`qa/wallpaper/verify-b-review-probes.mjs` 及 `.tmp/.../verify-rc35-probes.mjs`

| 序号 | 探针测试用例 | 输入条件与变异 | 预期结果 | 实际执行结果 |
| --- | --- | --- | --- | --- |
| 1 | `parser/empty-object` | PowerShell CIM 输出 `{}` | ok=false, 0 进程 | PASS (process-query-missing-process-id) |
| 2 | `parser/missing-pid` | 输出缺少 PID 行 | ok=false, 0 进程 | PASS (process-query-missing-process-id) |
| 3 | `parser/invalid-row` | 输出 `[null]` | ok=false, 0 进程 | PASS (process-query-contains-invalid-item) |
| 4 | `time/zero-fraction-control` | `.0000000Z` vs `Z` | 物理等值 (true) | PASS (areStartUtcsEquivalent=true) |
| 5 | `time/nonzero-fraction-omitted` | `.0005000Z` vs `Z` | 500us 差异拒绝 (false) | PASS (areStartUtcsEquivalent=false) |
| 6 | `time/invalid-calendar` | `2026-03-02Z` vs `2026-02-30Z` | 非法日历拒绝 (false) | PASS (areStartUtcsEquivalent=false) |
| 7 | `time/timezone-equivalent` | `Z` vs `+08:00` | 物理时刻等值 (true) | PASS (areStartUtcsEquivalent=true) |
| 8 | `session/valid-control` | 合法完整 Summary + Action | closed=true, closes=1 | PASS (closed=true, closes=1) |
| 9 | `session/missing-identity-baseline` | 缺失基线且未提供查询入口 | closed=false, closes=0 | PASS (missing expected creation identity baseline) |
| 10 | `session/real-native-window-shape-recovers` | 真实 native helper 形状（无 startUtc），进程查询提供出生时间 | 绑定基线并恢复，closed=true, closes=1 | PASS (closed=true, closes=1, 成功恢复) |
| 11 | `session/past-birth-mismatch` | 出生时间差 1 秒 | closed=false, closes=0 | PASS (startUtc mismatch with expected) |
| 12 | `session/non-iso-date` | 文本日期 `October 17, 2026` | closed=false, closes=0 | PASS (invalid format) |
| 13 | `session/iso-equivalent-control` | UTC 与 +00:00 等值 ISO | closed=true, closes=1 | PASS (closed=true, closes=1) |
| 14 | `session/zero-fraction-control` | `.0000000Z` vs `Z` | closed=true, closes=1 | PASS (closed=true, closes=1) |
| 15 | `session/nonzero-fraction-omitted` | `.0005000Z` vs `Z` | closed=false, closes=0 | PASS (startUtc mismatch) |
| 16 | `session/invalid-calendar` | `2026-02-30Z` | closed=false, closes=0 | PASS (invalid format) |
| 17 | `session/future-startUtc` | 2099 年未来时间 | closed=false, closes=0 | PASS (startUtc is in the future) |
| 18 | `session/missing-identity-and-action` | 缺失 requestedIdentity | closed=false, closes=0 | PASS (missing requestedIdentity) |
| 19 | `session/missing-cleanup-safe` | 缺失 cleanupSafe 字段 | closed=false, closes=0 | PASS (cleanupSafe is not true) |
| 20 | `session/exited-false` | exited=false | closed=false, closes=0 | PASS (not confirmed exited) |
| 21 | `session/pending-string` | pending="true"（字符串） | closed=false, closes=0 | PASS (pending is not false) |
| 22 | `session/pending-missing` | 缺失 pending 字段 | closed=false, closes=0 | PASS (pending is not false) |
| 23 | `session/timedOut-string` | timedOut="true"（字符串） | closed=false, closes=0 | PASS (timedOut is not false) |
| 24 | `session/never-started-terminal` | `stage: stopped-before-action`, `action: null`, `trigger: null` | 合法未启动终止，closed=true, closes=1 | PASS (closed=true, closes=1) |
| 25 | `session/never-started-missing-fields` | 同上但 `delete action; delete trigger;` | 缺失字段拒绝，closed=false, closes=0 | PASS (missing action or trigger property) |
| 26 | `session/never-started-conflicting-flags` | 同上但 `action.started: 'true'` 与 `timedOut: true` | 矛盾状态拒绝，closed=false, closes=0 | PASS (action.started is not false) |
| 27 | `session/unsettled-stage-armed` | stage: armed | closed=false, closes=0 | PASS (unsettled taskbar stage: armed) |
| 28 | `session/malformed-process-record` | 进程查询返回 `{}` | closed=false, closes=0 | PASS (process-query-missing-process-id) |
| 29 | `session/no-status-no-action` | 无 Summary 无 Action，第3次补齐 | 前2次 closed=false, 第3次 closed=true | PASS (第3次提供合法 Action 成功恢复) |
| 30 | `session/foreign-location-control` | location 归属不符 | closed=false, closes=0 | PASS (location mismatch) |
| 31 | `session/live-worker-control` | worker 仍在系统运行 | closed=false, closes=0 | PASS (worker process 7788 is still running) |
| 32 | `concurrent-stop` | 并发同时调用 2 次 stop() | 单次关窗幂等，closes=1 | PASS (恰好 1 次关窗) |
| 33 | `cross-round-isolation` | 真实第 2 轮活跃期间接收第 1 轮迟到字节 | 0 状态污染，0 监听器泄漏，diagnostics 纯净 | PASS (0 泄漏，0 污染) |

### 4. 独立 rc.35 真实事故数据回放验证

脚本：`.tmp/.../incident-recovery-replay-rc35.mjs`
- 事故用例 1（`timeout-force-killed`）：第一次 stop 保持未知状态拒绝关窗（`closed: false`）；第二次 stop 在独立进程核验证实安全后，成功关窗释锁（`closed: true`，`ensure-closed` 恰好 1 次）。
- 事故用例 2（`normal-exit-missing-summary`）：第一次 stop 保持未知状态拒绝关窗（`closed: false`）；第二次 stop 在独立进程核验证实安全后，成功关窗释锁（`closed: true`，`ensure-closed` 恰好 1 次）。

---

## 四、约束与合规声明

1. **工作边界**：严格仅执行壁纸清理恢复 B 的离线修复；日常滚动壁纸断流 A 保持独立挂起，初次断流原因仍按客观记录保持为“未知”，未混入滚动处理。
2. **日常环境与资产零污染**：
   - 未安装、未发布、未打包任何插件资产。
   - 未触碰、未退出、未重启日常运行的 DeepSeek Harness (0.2.1-rc.2) 及 Wallpaper Engine。
   - 未改动生产 assets（`WallpaperProbe.exe` 保持原样）、未改动安装目录、未修改 `package.json` 版本号（保持 `0.6.0-rc.30`）。
3. **安全操作**：
   - 未向日常 DSH 模型任务发出任何请求。
   - 未进行 git commit 或 push，未向其他对话发送跨会话消息。
   - 所有测试均在离线替身及本地隔离临时目录下完成，无真实桌面干扰。

---

## 五、交付结论

日常壁纸清理恢复 B 的三审全部整改项（T1 默认身份来源与恢复入口、T2 严格日历与微秒契约、T3 严格未启动状态机约束、QA 跨轮隔离与流计数）已在工作区源码及独立 rc.35 整合环境中全部闭环，经全量 108 项 Host JS 测试、33 项严格正反例探针及 2 项真实事故回放验证，均达到预期安全与恢复效果。现正式提交 Codex 进行复审。
