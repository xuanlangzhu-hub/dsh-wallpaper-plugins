# 日常壁纸清理恢复 B 离线交付报告

- **日期**：2026-10-18
- **任务代号**：WALLPAPER_CLEANUP_RECOVERY_B
- **基线输入**：DSH 0.2.1-rc.2 / 外观 rc.35 / Git Bash 0.1.1
- **任务单依据**：`docs/GEMINI_NEXT_WALLPAPER_CLEANUP_RECOVERY_20261018.md`
- **复审转交人**：Codex / 用户代理
- **工作边界**：严格仅实现与交付 **日常壁纸清理恢复 B**；滚动问题 A 留后单独复现；不包含 P1B，不安装/发布候选，不操作日常 DSH/WE 运行实例，不修改生产 assets/版本号，不提交推送，不发跨会话消息。

---

## 1. 实际输入/输出目录与指纹核对

### 1.1 输入基底与冻结故障指纹
- **日常包原件**：`release/plugins/dsh-whale-mist-0.6.0-rc.35.tgz`
  - SHA256：`20D35ED1A63E2272FF50E44A9A38891F1D973994BED446FB19D79B0A9E6FAE58`（与任务单严格一致）
- **冻结故障现场证据**：`.tmp/daily-incidents-20261018-ede83704`
  - `installed/src/wallpaper/session.js` SHA256：`670DE9B99AC9F89751234F7C018923537DB97B42D04AAFCC8F10E1766F3FB527`
  - `logs/taskbar-action.json`：证明 worker 实际已执行 `DeleteTab` 并落盘 `action-done`, `cleanupSafe: true`, `exited: true`。
  - `logs/preview-final.json`：证明 capture 进程超时 force-killed 导致 stderr 无 `[Summary]`，原逻辑重复重试 3 次仍然永远处于 `worker-unconfirmed` 锁死状态。

### 1.2 本轮改动文件与相对差异
- **源码修改文件**：`dsh-whale-mist/src/wallpaper/session.js`
  - 修改前起点 SHA256：`81DBE2E94C30D6C2CB11618E6B8C453CDC17FBDC689439ED0DB6FA24A149E162`
  - 修改后产物 SHA256：`C67AB483ABF8C34AC991336EFDE4F97B73461171CF278C6505FDDACE284A74B3`
- **相对当前源码工作区（含 Cadence Trace）与 rc.35 安装版的对应说明**：
  - 当前源码树（工作区）相较于 rc.35 原生安装版包含 P1A 成果与可选的 Cadence Trace 插桩。
  - **本轮在 `session.js` 中新增/修改的逻辑完全自洽且解耦**：
    1. 新增 `queryWindowsProcesses(location, options)`：基于 Windows CIM (`Win32_Process`) 严格按 `CommandLine like '%<location>%'` 查询当前 OS 存活目标，错误/超时严格返回失败结构，绝不误判为空集。
    2. 新增 `verifyIndependentWorkerCleanup(...)`：提供当 stderr 流无法获取 `[Summary]` 时的可信独立核验入口。结合 OS 存活进程、主动写 `stop.txt` 信号，以及 `taskbar-action.json` 的严格 Schema (v1)/代次 location/HWND/PID/非 pending 终态核验。
    3. `runClose()` 状态机分层：
       - **首次停止（closeAttempts = 1）**：缺失 Summary 或 force-killed 时，保持未知保护，返回 `{ outcome: 'worker-unconfirmed', closed: false }`，不提前关闭源窗，不释放锁。
       - **后续重试（closeAttempts > 1）**：触发独立核验；核验不通过继续保留错误与锁；核验合法通过后方才调用 `--window-ensure-closed` 收尾源窗。源窗确认关闭后置 `cleanupResult.closed = true`，清除 failure，并在 Host 路由层彻底释放 session 锁。
  - 上述逻辑同样适用于纯净 rc.35 基线（已在 `.tmp/wallpaper-cleanup-b-replay-20261018/rc35-test/` 独立重放验证）。

---

## 2. 资源状态表与收尾规则

| 资源实体 | 身份标识 (Identity) | 终结证据来源 | 何时判定已退/安全 | 何时必须保留 (不收尾) | 允许执行的操作 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **采集进程 (Capture Child)** | `child.pid`, `--owned-location <location>` | Node `childClosed` 事件 + CIM 进程查询 | Node 进程关闭且 OS 中无该 PID 运行本轮 location | PID 仍存活于 OS，或查询超时/失败 | 首次 close 超时预算内 `child.kill()`；禁止基于陌生 PID 盲目杀进程 |
| **任务栏 Worker 进程** | `--taskbar-worker <hwnd> <pid> <startUtc> <location> <stopFile>` | 1. 采集流 `[Summary]`<br>2. (重试) CIM 进程查询 + `taskbar-action.json` | 1. `terminalTaskbarHide.cleanupSafe === true` 且非 pending 终态；<br>2. 或 OS 中 0 存活 worker 且 `taskbar-action.json` 通过严格身份/终态校验；<br>3. 或确认从未启动 (attempted=false) | OS 中仍有 worker 进程存活，或 action 文件缺失/损坏/代次不匹配/仍标记 pending / cleanupSafe=false，或查询报错 | 向 output 目录写入 `stop.txt` 请求退出；绝不直接 taskkill 未知进程 |
| **源窗口 (Source Window)** | `location`, `windowPid` (及 `config.window`) | Native helper `--window-ensure-closed <location> 15000 [--expect-pid <pid>]` | helper 返回 `{ closed: true, outcome: 'absent'\|'closed' }` | Capture 或 Worker 尚未确认安全前绝对禁止调用；或 helper 返回 `{ closed: false }` / 超时 | 仅在 Capture 与 Worker **双重确认安全后**，方允许调用 `--window-ensure-closed` 关闭源窗 |
| **Session 播放锁** | `registerWallpaperRoutes` 中的 `session` 实例 | `cleanupResult.closed === true` | 当源窗口确认已关闭（`closed: true`）且清理无残留 | `cleanupResult.closed !== true`，无论重试多少次，持续保留锁并返回 409 | 确认关闭后赋值 `session = null`，清空 `lastError`，状态恢复为可重新选择与开始 |

---

## 3. 验收矩阵逐项实测结果

本轮在 `qa/wallpaper/cleanup-recovery-b.test.mjs` 中构建了面向 9 大场景的完整回归套件，执行 `node --test` 全部 12/12 严格通过：

| 场景 | 验收要求 | 实际判断与调用序列 | 覆盖范围与覆盖形式 | 测试结果 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 正常终结Summary齐全** | 正常停止释放保持；不引入不必要的常态重查询 | 流中接收 `[Summary]` -> 直接判断 `workerCleanupSafe = true` -> 调用 `--window-ensure-closed` -> 释放 session。`queryProcesses` 调用次数为 **0**。 | 真实逻辑 + IO替身 | **PASS** |
| **2. 正常退出但无Summary** | 首次未知保留；后续取得独立证明后可收尾，不永远等待旧流 | 首次 stop -> `closed: false, outcome: 'worker-unconfirmed'`（源窗关闭调用 0 次）。二次 stop -> 触发独立核验 -> OS 存活进程 0，`taskbar-action.json` 校验通过 -> 调用源窗关闭 -> `closed: true` -> 释放 session。 | 真实逻辑 + 故障数据回放 | **PASS** |
| **3. 超时强制/异常退出无Summary** | 经历未知保留 -> 重新核验 -> 合法条件解除后成功 | 采集挂起 -> 触发 force-kill -> 首次 stop 返回 `worker-unconfirmed`。二次 stop 独立核验确认子进程与 worker 皆退出且 action 文件合法 -> 关闭源窗 -> 释放 session。 | 真实逻辑 + 定时器预算替身 | **PASS** |
| **4. worker仍活或可能操作源窗** | 不提前关闭源窗，不释放锁，不开第二轮 | 二次 stop 时 OS 查询检测到 PID 6677 `--taskbar-worker` 仍存活 -> 判定 `worker process 6677 is still running` -> **禁止**调用源窗关闭 -> 保持锁，拒绝新 start。worker 退出后再次 stop 顺利释放。 | 真实逻辑 + 进程查询替身 | **PASS** |
| **5. PID复用/字段缺失损坏/查询报错** | 不对陌生进程发动作；不报假成功；证明不足保留 | 5a. PowerShell 查询超时 -> 报错保留。<br>5b. action 文件 JSON 损坏 -> 报错保留。<br>5c. `schemaVersion: 99` -> 报错保留。<br>均未调用源窗关闭，未释放锁。 | 真实解析逻辑（JSON.parse/Schema）+ 负例注入 | **PASS** |
| **6. worker安全但源窗关闭失败** | 保留本轮归属；重试最终确认无残留后再释放 | Worker 核验通过，但 `--window-ensure-closed` 首次返回 `closed: false` -> session 保持锁定与 failure。三次 stop 时 helper 恢复并返回 `closed: true` -> 成功释放。 | 真实状态机 + helper 故障注入 | **PASS** |
| **7. 状态/动作文件来自旧代次/旧身份** | 不被用作本轮终结授权 | 7a. action 文件 location 为 `FOREIGN-LOCATION` -> 拒绝。<br>7b. action 文件 PID 为 `999999` (PID 复用/篡改) -> 拒绝。<br>均阻断源窗关闭。 | 真实身份断言（location/hwnd/pid） | **PASS** |
| **8. 重复/并发stop与恢复后重新选择** | 清理幂等，无重复监听/timer；无旧锁，清空失败标记 | 贯穿 HTTP 路由：首次 stop 返回 409 Conflict（failed: true）；再次 POST `/whale-wallpaper/stop` 触发独立核验恢复返回 200 OK（failed: false, session: null）；后续 POST `/whale-wallpaper/start` 成功返回 200。 | 真实路由 (`registerWallpaperRoutes`) + 虚拟 HTTP 流 | **PASS** |
| **9. 原WE主进程与其它轮资源** | 零非本轮终止动作，未动原WE | 进程查询严格使用 `CommandLine like '%${location}%'`，绝对不包含 `wallpaper64.exe` 或 `wallpaper32.exe` 主进程名。无任何跨进程强制 Kill。 | 真实 CIM 脚本生成与断言 | **PASS** |

---

## 4. 故障现场回放与重放证据

在独立目录 `.tmp/wallpaper-cleanup-b-replay-20261018/` 下部署 `incident-recovery-replay.mjs`，载入原冻结事故现场文件：
- **旧缺陷行为（基于旧 rc.35）**：
  - `retry-lock-replay.mjs` 记录：3 次 stop 全为 `worker-unconfirmed`，源窗关闭调用 0 次，session 永久锁死。
- **新修复行为（基于本轮 session.js 修复）**：
  - 运行结果落盘于 `.tmp/wallpaper-cleanup-b-replay-20261018/replay-result-repaired.json`：
  ```json
  [
    {
      "mode": "timeout-force-killed",
      "captureExitCode": 1,
      "attempt1Outcome": "worker-unconfirmed",
      "attempt1Closed": false,
      "attempt2Outcome": "absent",
      "attempt2Closed": true,
      "attempt3Outcome": "absent",
      "attempt3Closed": true,
      "closedWindowQueries": 1,
      "isClosed": true,
      "terminalSummaryEntriesInCapturedMessages": 0,
      "recoveryVerified": true
    },
    {
      "mode": "normal-exit-missing-summary",
      "captureExitCode": 0,
      "attempt1Outcome": "worker-unconfirmed",
      "attempt1Closed": false,
      "attempt2Outcome": "absent",
      "attempt2Closed": true,
      "attempt3Outcome": "absent",
      "attempt3Closed": true,
      "closedWindowQueries": 1,
      "isClosed": true,
      "terminalSummaryEntriesInCapturedMessages": 0,
      "recoveryVerified": true
    }
  ]
  ```
- **验证结论**：成功证明在真实事故日志输入下，Attempt 1 恪守未知保护，Attempt 2 通过独立可信核验达成源窗关闭与锁释放，Attempt 3 展现幂等性。

---

## 5. 初次断流调查进度

- **当前状态**：**根因仍未知 (Unknown)**。
- **如实记录**：
  - 日志显示原日常实例在运行了 225450 帧（约 8106 秒，折合 2.25 小时）后，采集流停止，触发 parent lost / timeout force kill。
  - 事故现场并未产生 crash dump，且 GPU/D3D11 资源耗尽或驱动重置情况在断流初次发生时由于日志截断无法确认。
  - **本轮遵循任务单约束**，不假定初次断流已解决，未额外引入高频轮询或重开性能专项，仅补全断流发生后的重试清理与恢复收尾闭环。

---

## 6. 未覆盖项目与交付声明

1. **未修改/未交付原生二进制**：本轮不重编译、不修改 `assets/wallpaper/WallpaperProbe.exe`，无需引入新增原生 CLI 命令。
2. **未修改包版本号与资产**：`package.json` 保持 `0.6.0-rc.30`，未打包新 `.tgz`。
3. **未实机安装/未重启日常 DSH**：日常 DSH 0.2.1-rc.2 与 Wallpaper Engine 实例保持原状，无热更新、无进程退出/重启。
4. **滚动问题 A**：未改动前端界面布局，留待后续独立单项处理。

交付完毕，请 Codex 复审。
