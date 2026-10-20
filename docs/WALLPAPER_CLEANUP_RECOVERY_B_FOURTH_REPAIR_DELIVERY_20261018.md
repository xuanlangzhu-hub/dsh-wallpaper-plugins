# 日常壁纸清理恢复 B 四审补修交付报告

**日期**：2026-10-18\
**交付范围**：日常壁纸清理恢复 B 阶段四审专项离线补修（Q1–Q3 及必要 QA、独立 RC.35 整合）\
**约束执行**：严格离线，未安装发布，未触碰或重启日常 DSH（0.2.1-rc.2）与 Wallpaper Engine，未改动原生二进制与版本号，暂不转滚动 A。

---

## 1. 四审核心补修内容（Q1–Q3）逐项闭环

### Q1：返回 PID 与根结构校验闭环，杜绝歧义记录与假基线
- **缺陷表现**：原 `queryWindowsProcessCreationUtc` 使用 `Array.isArray(parsed) ? parsed[0] : parsed`，未核验 `record.ProcessId`，并将请求 PID 回填至成功对象。当底层返回 PID 为 `999999`、缺少 PID 字段或包含多条记录数组时，仍返回 `ok: true, pid: 1122`，使后续 session 误认为基线可信并关窗。
- **补修实现**：
  1. **严格根结构校验**：`parsed` 必须为单一非 null 的普通对象（`typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)`）；若为数组立即报错 `process-identity-ambiguous-array-records`，杜绝任何数组歧义或多记录回退。
  2. **严格 PID 字段与正整数校验**：提取 `parsed.ProcessId ?? parsed.processId`，必须存在且通过 `Number.isInteger(returnedPid) && returnedPid > 0`，否则报错 `process-identity-missing-pid` 或 `process-identity-invalid-pid-type`。
  3. **请求 PID 严格等值比对**：必须满足 `returnedPid === numPid`，一旦不一致立即返回 `{ ok: false, error: 'process-identity-pid-mismatch: requested ..., returned ...', startUtc: null }`。严禁回填请求 PID 掩盖响应错误。
  4. **失败保护贯通**：查询失败时 `windowStartUtc` 严格保留为 `null`，重试 `stop()` 触发 `missing expected creation identity baseline for window`，窗体关闭调用为 0，会话与锁严格保留。

### Q2：真实 Shell 纯对象序列化契约与 7 位微秒精度来源
- **缺陷表现**：原生 `WallpaperProbe.exe` 采用 `System.Diagnostics.Process.StartTime.ToUniversalTime().ToString("O")` 生成 7 位小数 round-trip 时间戳（如 `.6092543Z`）。Windows PowerShell 5.1 的 `ConvertTo-Json` 对原生 `[DateTime]` 对象默认采用 JavaScriptSerializer 序列化为毫秒级 `\/Date(epochMs)\/`，丢弃最后 4 位（微秒/纳秒 tick 精度），导致真实 action 匹配失败。
- **补修实现**：
  1. **相同物理来源与显式格式化**：生产查询命令采用与原生 probe 完全相同的 .NET `System.Diagnostics.Process` 来源：
     ```powershell
     $p = Get-Process -Id ${numPid} -ErrorAction Stop; [pscustomobject]@{ ProcessId = $p.Id; CreationDate = $p.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress
     ```
     通过在 PowerShell 端将 `CreationDate` 显式转换为 Round-trip 字符串（`.ToString('o')`），使 `ConvertTo-Json` 输出合法的 7 位小数 ISO 字符串（`"2026-10-17T09:20:20.6092543Z"`），不再退化为 `\/Date(...)\/`。
  2. **严格日历与微秒比较契约**：同一物理身份在两端均输出完全相同的 7 位小数，`areStartUtcsEquivalent` 严格等值匹配；缺失小数位或降级为毫秒的对象（如 `.609Z` 与 `.6092543Z`）坚决拒绝，绝不添加时间容差，不截断原生精度，不以伪零冒充还原。
  3. **离线纯契约验证脚本**：交付 `qa/wallpaper/offline-date-serialization-contract.ps1`，纯固定对象离线运行，复现并验证了默认 `[DateTime]` 降级为 `\/Date(ms)\/` 与 `.ToString('o')` 保持 7 位全精度的契约对比。

### Q3：异步回调异常边界与有界落定防护
- **缺陷表现**：超大数值（如 `1e20`）或非法时间戳直接传入 `new Date(...).toISOString()` 会抛出 `RangeError: Invalid time value`。在真实异步回调（如 `queueMicrotask` 或 `execFile`）下，由于在异步事件循环中抛出，外层同步 try/catch 无法捕获，导致长驻 Node 进程崩溃（退出码 1）。
- **补修实现**：
  1. **格式转换前严格范围校验**：针对数字或 `/Date(...)` 时间戳，转换前强制检查 `Number.isFinite(ms) && ms >= 0 && ms <= 8640000000000000`（ECMAScript 规定最大有效时间范围），且 `!Number.isNaN(new Date(ms).getTime())`。超出范围立即安全收敛为 `process-identity-date-out-of-range`。
  2. **异步回调全景 try/catch 兜底**：`onResult` 整个回调函数体置于 `try { ... } catch (handlerErr) { return finish({ ok: false, error: ... }); }` 之中，杜绝任何同步/异步异常逃逸至 Node 事件循环。
  3. **超时有界落定（Bounded Settling）**：在 `queryWindowsProcessCreationUtc` 内部设立安全定时器（`timeoutMs + 1000`），无论底通信挂起、回调丢失或超时，Promise 均保证严格有界 settle，无悬挂 Promise，无进程退出。

---

## 2. 真实测试分项核对与覆盖范围

> **核对说明**：三审报告中曾误列不存在的 `catalog.test.mjs` 与 `scenes.test.mjs`。现按工作区与仓库实际存在的测试文件与实际命令进行逐项核验，确保分项列表与实际执行 100% 对应。

### A. Host JS 单元与集成测试（实际 5 个测试文件）

命令：`node --test qa/wallpaper/cleanup-recovery-b.test.mjs qa/wallpaper/library.test.mjs qa/wallpaper/routes.test.mjs qa/wallpaper/session.test.mjs qa/wallpaper/ui-library.test.mjs`

| 测试文件 | 实际用例数 | 状态 | 核心覆盖范围 |
| :--- | :---: | :---: | :--- |
| `qa/wallpaper/cleanup-recovery-b.test.mjs` | 18 | PASS | 故障回放全场景、缺 Summary 恢复、并发 stop、跨轮 late 数据、Scenario 15 默认身份查询负例矩阵（foreign/missing/multiple/serialized/authentic） |
| `qa/wallpaper/library.test.mjs` | 26 | PASS | 壁纸库扫描、缓存复用、安全路径校验、失效项过滤、并发安全 |
| `qa/wallpaper/routes.test.mjs` | 17 | PASS | 路由注册、状态轮询、并发 start 互斥、stop 幂等、屏幕外启动参数 |
| `qa/wallpaper/session.test.mjs` | 36 | PASS | Session 生命周期、日志轮转、白名单校验、无窗口回滚、流监听器泄漏检查 |
| `qa/wallpaper/ui-library.test.mjs` | 12 | PASS | UI 组件交互状态、选择器布局契约、状态栏渲染约束 |
| **合计** | **109** | **全部 PASS** | 耗时约 25.8s，0 失败 |

### B. 专项审查探针 (`qa/wallpaper/verify-b-review-probes.mjs`)

共 41 项审查探针，全量通过：
- **PART 1**（3 项）：非法 stdout 解析（empty-object, missing-pid, invalid-row）。
- **PART 1B**（4 项）：严格 ISO 时间等值、Gregorian 日历有效性（拒绝 2026-02-30）、微秒严格比较（拒绝 500us 差异）、跨时区物理等值（Z vs +08:00）。
- **PART 2**（17 项）：真实无 startUtc 窗口形状（`real-native-window-shape-recovers`）、missing 基线保护、未来时间拒绝、未动作显式 null 与冲突拒绝。
- **PART 3**（1 项）：真实并发 `stop()` 调用（单次关窗）。
- **PART 4**（1 项）：跨轮次活跃期间旧子进程迟到字节隔离与 0 监听器泄漏。
- **PART 5（四审新增 15 项）**：
  - Q1 解析器：foreign PID (999999) 拒绝、missing PID 拒绝、multiple records array 拒绝、correct 接受。
  - Q2 精度契约：`/Date(ms)/` 降级对象与原生 action 判不等、显式 `.ToString('o')` 7 位全精度等值。
  - Q3 异步异常：`queueMicrotask` 下 1e20 安全拦截、越界 `/Date(...)` 安全拦截、异步超时有界落定。
  - 默认 session 贯通：correct 成功关窗 1 次；foreign、missing、multiple、serialized、query-error 均 0 次关窗且安全释锁阻断。

### C. 生产脚本与静态检查
- `npm run check`：0 error。
- `npm run test:sdk-contract`：全部 PASS。
- `npm run test:detachable-p1a`：5/5 PASS。
- `npm run test:detachable-p0`：15/15 PASS。
- `node qa/verify-ninth-review-probes.mjs`：7/7 PASS。
- `git diff --check`：0 error。

---

## 3. 独立 RC.35 整合基底与证据

为了保证纯净性，四审建立了全新的独立目录：\
`F:\dsh-wallpaper-plugins\.tmp\wallpaper-cleanup-b-fourth-repaired-rc35-20261018/`\
历史证据目录完整保留未覆盖。

### 目录结构与指纹

```
.tmp/wallpaper-cleanup-b-fourth-repaired-rc35-20261018/
├── rc35-base/                       # 12 个未修改的冻结 rc.35 原始文件
├── rc35-repaired/                   # 仅修改 managed-window.js 和 session.js
│   └── src/wallpaper/
│       ├── managed-window.js
│       └── session.js
├── incident-recovery-replay-rc35.mjs# 事故回放脚本（事故数据 + IO替身）
├── verify-rc35-probes.mjs          # 41 项审查专项探针
├── rc35-minimal-diff.patch         # 仅针对 managed-window.js 和 session.js 的最小补丁 (UTF-8, 35,753 字节)
├── rc35-probes-run.log             # 探针运行日志 (41/41 PASS)
├── rc35-replay-run.log             # 回放运行日志
└── replay-result-rc35.json         # 回放输出 JSON 证据
```

### 关键文件 SHA256 指纹

| 文件 | SHA256 哈希值 |
| :--- | :--- |
| `workspace/session.js` | `78F88A1B16B5997A89F08B60933FACF12E79C3A524EB7D2FF42A0E836D92DB11` |
| `workspace/managed-window.js` | `703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A` |
| `rc35-repaired/session.js` | `CDEAC8716DF6ACCEDC151FB91AD5184CCD6B01545EAD5EF46E2A2FA5083EF91D` |
| `rc35-repaired/managed-window.js` | `703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A` |
| `rc35-base/session.js` (冻结) | `670DE9B99AC9F89751234F7C018923537DB97B42D04AAFCC8F10E1766F3FB527` |
| `rc35-base/managed-window.js` (冻结)| `B76B9724BC43AA2F8193D3E0FBCB98B955991BFBDE4304D6CF41C77B9B46D192` |
| `rc35-minimal-diff.patch` | `EF70FDEE512393C355B563C11CFF10068F67811882A7A32E7D399E2AFEB4FFE8` |
| `qa/cleanup-recovery-b.test.mjs` | `6426CE37E3D7FA4945CBD3F56D147ACDE820EA597DF56658FD1D66AE47E8A820` |
| `qa/verify-b-review-probes.mjs` | `087D2FE766A57F1D0175AA8AF6D6883F56CA05260B29A2051FE505AA7B18F643` |
| `qa/offline-date-serialization-contract.ps1` | `68327CEBDD33289C4054B9C413A9AB303EA52497B2808EE2FBD7C9E808A2634C` |

### 独立 RC.35 执行结果
- **探针执行 (`node verify-rc35-probes.mjs`)**：41/41 PASS（覆盖 PART 1 到 PART 5 全量场景）。
- **事故回放 (`node incident-recovery-replay-rc35.mjs`)**：
  - 基于真实事故冻结数据（`taskbar-action.json` 与 `preview-final.json`）结合离线 I/O 替身（非实机运行）。
  - `timeout-force-killed` 模式：首轮 stop 保持 worker-unconfirmed，二次 stop 成功关闭窗口，会话锁成功释放。
  - `normal-exit-missing-summary` 模式：首轮 stop 保持 worker-unconfirmed，二次 stop 成功关闭窗口，会话锁成功释放。

---

## 4. 真实解析、I/O 替身、二进制与未实机覆盖范围声明

1. **真实解析（Authentic Parsing）**：
   - 本地实际执行 `powershell.exe` 对纯固定 `[DateTime]` 对象的真实序列化测试（`offline-date-serialization-contract.ps1`），证明了默认 `[DateTime]` 序列化会丢失精度，而显式 `.ToString('o')` 能够保留原生 7 位小数。
   - `queryWindowsProcessCreationUtc` 针对根结构（非数组）、PID 等值性、7 位小数时间戳及有效 Gregorian 日历进行真实纯 JS 严格解析与校验。
2. **I/O 替身（Mock / Stubs）**：
   - 自动测试中，`execCommand`、`helperRun`、`spawnChild` 为离线受控替身，用于向 `queryWindowsProcessCreationUtc` 和 `verifyIndependentWorkerCleanup` 注入合法/非法进程快照、`taskbar-action.json` 与退出码。
3. **原生二进制与现役资产**：
   - 现役生产原生资产 `WallpaperProbe.exe` 保持冻结未改动；其 `WindowState` 接口仍不返回 `startUtc`。
   - 默认身份查询直接通过 Windows OS 进程接口（`Get-Process`）在 `session.create()` 时建立可信创建时间基线，无需热换或重编译生产原生 helper 二进制。
4. **未实机覆盖范围**：
   - 本次回放与测试均基于受控离线数据与合成替身，**未在真实 Wallpaper Engine 播放及日常 DSH 运行环境下执行实机恢复**。
   - 滚动故障 A 的初次断流原因仍然未知，本轮严格遵循指令不转入滚动 A，不做任何日常实机操作。

---

## 5. 交付结论

日常壁纸清理恢复 B 的四审补修已全面闭环：
- Q1（返回 PID 与根结构校验）、Q2（7 位小数显式 Round-trip 契约）、Q3（异步越界安全校验与有界落定）全部落实到位；
- 测试分项与实际文件完全吻合；
- 独立 RC.35 整合基底验证通过，最小补丁清晰可审计。

等待 Codex 四审复核。
