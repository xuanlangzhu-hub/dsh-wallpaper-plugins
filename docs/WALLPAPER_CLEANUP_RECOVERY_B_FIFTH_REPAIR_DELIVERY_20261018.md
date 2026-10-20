# 日常壁纸清理恢复 B 五审补修交付报告

**日期**：2026-10-18\
**交付范围**：日常壁纸清理恢复 B 阶段五审专项离线补修（S1 PID 原始类型门禁、JS 侧宿主 PID 跳过分支复核、贯通负例矩阵与独立 RC.35 整合）\
**约束执行**：严格离线，未安装发布，未触碰或重启日常 DSH（0.2.1-rc.2）与 Wallpaper Engine，未改动原生二进制与版本号，暂不转滚动 A。

---

## 1. 五审核心补修内容（S1，原 Q1）逐项闭环

### 1.1 两个默认进程解析入口消除提前 `Number()` 强转，建立严格数值类型门禁
- **缺陷表现**：原 `queryWindowsProcessCreationUtc` 与 `queryWindowsProcesses` 在核验前先调用 `Number(rawPid)` 与 `Number(item.ProcessId)`。在 JavaScript 语义中，`Number([1122]) === 1122` 且 `Number("1122") === 1122`，导致 JSON 数组、数字串等非数值类型被强制转换为合法整数，绕过类型检查。在底层贯通 session 下，返回包含 `[1122]` 或 `"1122"` 的响应仍被当作合法进程身份，二次 `stop()` 错误关窗并释锁。
- **补修实现**：
  1. **原始字段严格数值正整数校验**：
     在两个入口中，提取原始字段后先直接进行纯数值与正整数断言：
     ```javascript
     if (typeof rawPid !== 'number' || !Number.isInteger(rawPid) || rawPid <= 0) { ... }
     ```
     杜绝通过 `Number()` 对输入做任何“容错性转换”。
  2. **细分错误分类**：
     - 若原始字段缺失（`undefined` 或 `null`），返回 `process-identity-missing-pid` / `process-query-missing-process-id`；
     - 若原始字段存在但类型不符（数组、嵌套数组、数字串、布尔、对象、零、负数、浮点数），统一明确返回 `process-identity-invalid-pid-type` / `process-query-invalid-pid-type`。
  3. **函数参数入口保护**：
     `queryWindowsProcessCreationUtc(pid)` 入参第一行同样增加 `typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0` 校验，非法入参立即返回 `invalid-process-id`。

### 1.2 复核并移除 JS 侧宿主 PID 跳过分支，防止活动 Worker 记录被静默吞成空集
- **缺陷表现**：
  原 `queryWindowsProcesses` 包含 `if (typeof process !== 'undefined' && process.pid && pid === process.pid) continue;`。
  在五审审查中发现：若底层返回 worker 记录 `ProcessId: [process.pid]`、`Name: WallpaperProbe.exe`、`CommandLine` 含 `--taskbar-worker` 与本轮 `location`，经提前 `Number()` 转换后等于 Node 宿主 PID，随后被该 `continue` 语句静默跳过，解析结果变成了 `ok: true, pids: [], processes: []` 空集！二次 `stop()` 误判 worker 已退出，导致关窗释锁。
- **补修实现**：
  1. **明确查询者与宿主角色分离**：
     PowerShell 端执行的查询语句已经包含 `Where-Object { $_.ProcessId -ne $PID }`，真实查询进程（`powershell.exe`）已经在原生命令行端完成了自我排除。Node 宿主并不是该 PowerShell 查询进程。
  2. **彻底移除静默吞掉 Worker 的分支**：
     删除 JS 侧单纯依据 `pid === process.pid` 就跳过记录的逻辑。任何声明为 worker 或匹配当前 location 的记录必须严格保留在 `pids` 与 `processes` 数组中。
  3. **双重防御收敛**：
     - 若 worker 记录给出损坏的 PID 类型（如 `ProcessId: [process.pid]`），直接被 1.1 的类型门禁拒绝（`ok: false, error: 'process-query-invalid-pid-type'`），`verifyIndependentWorkerCleanup` 报错阻断关窗；
     - 若 worker 记录给出数值正整数 `ProcessId: process.pid`，记录被完整保留在 `processes` 列表中，`matchingProcs` 检测到活动 worker 存在，返回 `worker process ... is still running`，坚决拒绝关窗释锁。

### 1.3 原始字段类型负例矩阵与端到端贯通断言
- 针对 `queryWindowsProcessCreationUtc` 与 `queryWindowsProcesses` 覆盖以下 9 类原始输入：
  - 数组（`[1122]`）
  - 嵌套数组（`[[1122]]`）
  - 数字串（`"1122"`）
  - 布尔值（`true`）
  - 对象（`{}`）
  - null（`null`）
  - 缺失（`undefined`）
  - 零（`0`）
  - 负数（`-5`）
  - 非整数浮点数（`1122.5`）
- 贯通 Session 与路由测试：
  - 坏类型与 `[process.pid]` worker 记录注入底层 `execCommand`；
  - 确保 0 次关窗、会话保持未释放状态、路由返回 409 Conflict、阻止后续并发/新 start 请求；
  - 补齐真实合法身份（如正整数 PID 1122 及 7 位微秒 ISO 时间戳）并在 worker 退出后重试，会话成功恢复（关窗 1 次，返回 200 OK，会话安全释放，新 start 成功）。

---

## 2. 真实测试核对与覆盖范围

### A. Host JS 单元与集成测试（实际 5 个测试文件）

命令：`node --test qa/wallpaper/cleanup-recovery-b.test.mjs qa/wallpaper/library.test.mjs qa/wallpaper/routes.test.mjs qa/wallpaper/session.test.mjs qa/wallpaper/ui-library.test.mjs`

| 测试文件 | 实际用例数 | 状态 | 核心覆盖范围 |
| :--- | :---: | :---: | :--- |
| `qa/wallpaper/cleanup-recovery-b.test.mjs` | 19 | PASS | 新增 Scenario 16（worker PID 数组与数值排除校验，阻断关窗并在退出后恢复），Scenario 15 扩充 S1 PID 原始类型矩阵，Scenario 1–14 保持全绿 |
| `qa/wallpaper/library.test.mjs` | 26 | PASS | 壁纸库扫描、缓存复用、安全路径校验、失效项过滤、并发安全 |
| `qa/wallpaper/routes.test.mjs` | 17 | PASS | 路由注册、状态轮询、并发 start 互斥、stop 幂等、屏幕外启动参数 |
| `qa/wallpaper/session.test.mjs` | 36 | PASS | Session 生命周期、日志轮转、白名单校验、无窗口回滚、流监听器泄漏检查 |
| `qa/wallpaper/ui-library.test.mjs` | 12 | PASS | UI 组件交互状态、选择器布局契约、状态栏渲染约束 |
| **合计** | **110** | **全部 PASS** | 耗时约 25.1s，0 失败 |

### B. 专项审查探针 (`qa/wallpaper/verify-b-review-probes.mjs`)

全量运行通过，包含旧 PART 1–5 以及五审新增的 **PART 6**：
- **PART 1 - PART 5**：非法 stdout、ISO 时间等值契约、无 startUtc 真实窗口形状、并发 stop、跨轮监听器隔离、Q1-Q3 精度与异步保护全部保持通过。
- **PART 6（五审新增）**：
  1. 6.1 `queryWindowsProcessCreationUtc` PID 原始类型矩阵（9 种错误类型均被严格拒绝）。
  2. 6.2 `queryWindowsProcesses` PID 原始类型矩阵（9 种错误类型均被严格拒绝）。
  3. 6.3 Worker PID 数组 `[process.pid]` 拒绝与数值 `process.pid` 保留非空（不再被吞为空集）。
  4. 6.4 默认 session 贯通（`session-identity-array` 保持阻断、`session-worker-pid-array` 与 `session-worker-pid-numeric` 阻断关窗且 clean 后重试恢复）。
  5. 6.5 路由级端到端测试（坏 worker 记录阻断释锁与新 start，恢复后释锁并成功启动）。

### C. 五审复现脚本反转验证（36 项）

根据五审审查要求，将 `.tmp/wallpaper-cleanup-b-fifth-review-20261018-b3f7fedc/fifth-probes.mjs` 中的坏类型断言反转为修复后的正确预期：
- 身份解析：`string` 和 `array` 预期由 `ok: true` 反转为 `ok: false`；
- 会话关窗：`string`、`array`、`worker-pid-array` 预期由 `closed: true` 反转为 `closed: false`（0 次关窗，会话保持）；仅 `authentic` 与 `correct` 允许关窗 1 次。
- **执行结果**：在工作区与独立 RC.35 目录下分别运行 18 项，共 36 项，**全部 100% PASS**。

### D. 生产脚本与静态检查
- `npm run check`：0 error。
- `npm run test:sdk-contract`：全部 PASS。
- `npm run test:detachable-p1a`：5/5 PASS。
- `npm run test:detachable-p0`：15/15 PASS。
- `git diff --check`：0 error。

---

## 3. 独立 RC.35 整合基底与证据

五审建立了全新的独立目录：\
`F:\dsh-wallpaper-plugins\.tmp\wallpaper-cleanup-b-fifth-repaired-rc35-20261018/`\
历史四审及五审审查目录完整保留未覆盖。

### 目录结构与指纹

```
.tmp/wallpaper-cleanup-b-fifth-repaired-rc35-20261018/
├── rc35-base/                       # 12 个未修改的冻结 rc.35 原始基底文件
├── rc35-repaired/                   # 仅修改 managed-window.js 和 session.js
│   └── src/wallpaper/
│       ├── managed-window.js
│       └── session.js
├── incident-recovery-replay-rc35.mjs# 事故回放脚本（事故数据 + IO替身）
├── verify-rc35-probes.mjs          # 包含 PART 6 的专项审查探针
├── rc35-minimal-diff.patch         # 仅针对 managed-window.js 和 session.js 的最小补丁 (UTF-8, 72,494 字节)
├── rc35-probes-run.log             # 探针运行日志 (全部 PASS)
├── rc35-replay-run.log             # 回放运行日志 (2 种故障模式全部成功复原)
├── replay-timeout-force-killed/    # 回放产生的证据输出
└── replay-normal-exit-missing-summary/
```

### 关键交付物 SHA-256 指纹列表

| 文件路径 | SHA-256 哈希值 | 说明 |
| :--- | :--- | :--- |
| `dsh-whale-mist/src/wallpaper/session.js` | `DE7C5A9DA5AE3A892D5D9B39BAF36E95B0A2A6596C936E98F8001AC9FD18CB8A` | 工作区修复后的 session.js |
| `dsh-whale-mist/src/wallpaper/managed-window.js` | `703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A` | 工作区 managed-window.js |
| `.tmp/.../rc35-repaired/src/wallpaper/session.js` | `2AF9E5011933844E2B4DCE53D99E867E49C1AFB8DF67CC3B499244155EE4E4E5` | 独立 rc.35 整合 session.js |
| `.tmp/.../rc35-repaired/src/wallpaper/managed-window.js` | `703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A` | 独立 rc.35 managed-window.js |
| `.tmp/.../rc35-base/src/wallpaper/session.js` | `670DE9B99AC9F89751234F7C018923537DB97B42D04AAFCC8F10E1766F3FB527` | 冻结未修复 rc.35 session.js |
| `.tmp/.../rc35-minimal-diff.patch` | `B0B5811A27C263E80FE672042343A3158E7719E1FB2AE22A06A705B974837D5F` | 独立 rc.35 整合的最小补丁 |

---

## 4. 规范与边界承诺

1. **严格离线推进**：全程使用离线 IO 替身与注入数据测试，未执行真实进程强杀，未对宿主系统发起侵入式查询。
2. **日常运行环境零干扰**：日常运行的 DSH（0.2.1-rc.2）、外观插件（rc.35）与 Wallpaper Engine 未受任何修改、重启或退出影响。
3. **交付范围收敛**：严格仅针对日常壁纸清理恢复 B 中的 S1 缺陷进行补修，未更改 production binaries 或 `package.json` 版本号，暂不转滚动 A，首次断流原因如实记录为未知。
4. **历史资产保全**：所有既往审查证据目录、P1A 十审成果（161 项输入）及 59 项归档资产均完整保全。
