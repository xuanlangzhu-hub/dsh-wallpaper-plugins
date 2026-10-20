# 日常壁纸清理恢复 B 二审补修交付报告

日期：2026-10-18\
责任人：小G（Gemini 3.8 Flash High）\
复审输入：[日常壁纸清理恢复 B 二审报告](WALLPAPER_CLEANUP_RECOVERY_B_SECOND_REVIEW_20261018.md)、[首轮补修交付报告](WALLPAPER_CLEANUP_RECOVERY_B_REPAIR_DELIVERY_20261018.md)、[恢复 B 原任务单](GEMINI_NEXT_WALLPAPER_CLEANUP_RECOVERY_20261018.md)。\
交付范围：**严格仅做日常壁纸清理恢复 B 离线补修**（W1–W3 及对应 QA 修正），不转滚动 A，不修改生产资产或版本号，不操作日常运行中的 DSH 与 Wallpaper Engine，初次断流根因如实记录为未知。

---

## 1. 缺陷修复与实现说明（W1–W3）

### 1.1 W1（P1）：创建身份基线绑定与严格 ISO 8601 规范化契约
- **问题根因**：
  1. `managed-window.js` 的 `normalizeWindow` 原实现丢弃了 `startUtc` 字段，导致 `waitForWindow` 返回的窗口对象始终不含创建时间，生产路径中 `expectedStartUtc` 始终为 null。
  2. 原逻辑在 `expectedStartUtc` 为 null 时直接跳过基线比对，使得任何合法的过去时间戳（即便属于前序或被回收进程）均能绕过校验关窗释锁。
  3. 原逻辑仅使用宽松的 `Date.parse()`，导致 `"October 17, 2026"` 等非标准 locale 字符串也能被解析并通过校验。
  4. 真实原生 C# `SourceWindowHelper.cs` 的 `WindowState` 结构体本身未序列化 `StartUtc`，若无独立基线必须保持未知保护。
- **修复方案**：
  1. **归一化字段保留**：在 `managed-window.js` 中更新 `normalizeWindow`，显式保留并修剪 `startUtc: window.startUtc ?? window.StartUtc ?? null`。
  2. **严格 ISO 格式校验与微秒等价比对**：
     - 引入严格正则 `ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/`。
     - 增加 `parseIsoStartUtc()` 与 `areStartUtcsEquivalent()`，对带微秒与不带微秒、不同补零位数的标准 ISO 时间进行微秒级等价判定。
     - 严格拒绝 `"October 17, 2026"` 等非 ISO 字符串，报错 `taskbar-action invalid requestedIdentity.startUtc format: ...`。
  3. **强制要求窗口基线**：
     - 若 `expectedStartUtc` 为 null/空（如使用未扩展的 helper 原生二进制），`verifyIndependentWorkerCleanup` 一律返回 `{ safe: false, reason: 'missing expected creation identity baseline for window' }`，维持未知保护，零关窗、不释锁。
     - 只有当 `expectedStartUtc` 存在且格式合法，且动作文件中的 `requestedIdentity.startUtc` 与之及 `beforeIdentity.startUtc` 严格等价时，才允许放行。
     - 严格保留对未来时间（> now + 60s，如 2099 年）的拦截。
  4. **原生资产声明**：目前生产 assets 中的 `WallpaperProbe.exe` / `SourceWindowHelper.cs` 未在生产中重新编译部署；本补修在 JS 契约层明确：缺基线即未知保护；若未来引入提供 `StartUtc` 的 helper，全链路无缝接通并严格校验。

### 1.2 W2（P1）：终结标志严格存在、类型及布尔组合校验
- **问题根因**：
  此前检查 `action.pending === true`、`action.timedOut === true`、`action.terminated === true` 采用了非严格否定逻辑，当字段为字符串 `"true"`、缺失 `undefined`、数字或 null 时，均被误判为“未处于 pending/未超时”，从而错误放行。
- **修复方案**：
  针对真实已启动终结分支（Branch B），实行严格的布尔强类型与组合一致性校验：
  - `record.action.cleanupSafe === true`（必须为严格布尔 true）
  - `record.action.exited === true`（必须为严格布尔 true）
  - `record.action.started === true`（必须为严格布尔 true）
  - `record.action.pending === false`（必须为严格布尔 false；拒绝缺失、null 或字符串 `"true"`）
  - `record.action.timedOut === false`（必须为严格布尔 false；拒绝缺失、null 或字符串 `"true"`）
  - `record.action.terminated === false`（必须为严格布尔 false；拒绝缺失、null 或字符串 `"true"`）
  上述任一字段缺失或类型不符，一律报错拒绝，保留会话锁，零调用源窗口关闭。

### 1.3 W3（P2）：合法未启动终结分支（stopped-before-action）支持与冲突防护
- **问题根因**：
  原生 C# `TaskbarHideStrategy.SettlePending()` 在尚未 attempt 且当前处于 armed/observing 时停止，会写入 `stage: 'stopped-before-action'`，此时 `_actionResult` 为 null，写入的 `action` 字段为 null。原 JS 核验逻辑无差别要求 `record.action` 必须为对象且 `exited === true`，导致这种合法的未启动终结状态被一刀切拒绝为 `missing action object`，无法从无 Summary 的中止状态中恢复。
- **修复方案**：
  在 `verifyIndependentWorkerCleanup` 中显式划分真实原生分支协议：
  - **Branch A（确实未启动且已终结）**：
    - 条件：`record.stage === 'stopped-before-action'`。
    - 允许 `record.action === null` 或 `record.action.started === false`。
    - 必须满足 `record.trigger === null`。
    - 必须满足 `requestedIdentity` 包含合法 HWND、PID 且与窗口基线严格一致。
    - 严格冲突防护：若 `stopped-before-action` 记录中声称 `action.started === true`，判定为非法冲突记录并拒绝：`taskbar-action stopped-before-action conflicts with action.started=true`。
  - **Branch B（已启动且已终结）**：
    - 条件：`stage` 属于 `['action-done', 'action-failed', 'failed', 'done', 'success', 'blocked']`。
    - 必须具备上述 W2 规定的完整严格布尔字段（`cleanupSafe: true`, `exited: true`, `started: true`, `pending: false`, `timedOut: false`, `terminated: false`）。
  - **未终结态拒绝**：
    - `armed`、`observing` 等中间阶段一律拒绝：`unsettled taskbar stage: armed`。

---

## 2. QA 离线安全与测试覆盖修正

### 2.1 底层 I/O 替身贯通与 offline-guard 安全保障
- 二审复查指出：原 `verify-b-review-probes.mjs` 与 `verify-rc35-probes.mjs` 中的 PART 3 并发与 PART 4 迟到测试未显式注入 `execCommand`，在离线环境可能调用真实的 PowerShell 查询，违反离线守卫。
- 修正：在所有并发与跨轮测试中，均显式注入离线替身 `execCommand: (_f, _a, _o, cb) => cb(null, '')` 及 `queryProcesses: async () => ({ ok: true, pids: [], processes: [] })`，完全隔绝真实 PowerShell 执行，在 `offline-guard.mjs` 环境下 100% 离线安全。

### 2.2 跨轮路由状态、定时器与事件监听器泄漏严格断言
- 二审复查指出：原 PART 4 仅针对同一个已关闭 session 注入迟到事件，未覆盖新一轮启动的独立性与定时器清空断言。
- 修正：在 `verify-b-review-probes.mjs` 与 `verify-rc35-probes.mjs` 的 PART 4 中，补齐完整跨轮生命周期测试：
  1. 第一轮 session 经历创建、异常停止重试恢复关闭；
  2. 验证第一轮已死亡子进程接收迟到数据（stdout/stderr）不抛异常且其所有监听器计数全为 0（`close`, `error`, `data` 均 `listenerCount === 0`）；
  3. 严格断言第一轮的内部状态：`reporting === false`（reportTimer 已清除）、`attached === false`、`closeListeners === 0`；
  4. 启动第二轮 session（独立 location、独立 token），断言其初始状态 `diagnostics.failure === null`，且消息队列中无第一轮迟到日志残留；
  5. 驱动第二轮正常完结并关闭，断言其闭环安全。

---

## 3. 测试验证矩阵与执行结果

### 3.1 工作区全量测试验证
| 序号 | 测试套件 | 验证范围 | 结果 |
| --- | --- | --- | --- |
| 1 | `qa/wallpaper/cleanup-recovery-b.test.mjs` | 17 个端到端场景（覆盖 W1/W2/W3 负例矩阵、损坏查询、多轮恢复、并发重试、迟到监听器） | **17/17 PASS** |
| 2 | `qa/wallpaper/session.test.mjs` + `routes.test.mjs` | 壁纸全套会话、路由、生命周期、回放与防竞态测试 | **71/71 PASS** |
| 3 | `qa/wallpaper/verify-b-review-probes.mjs` | 19 项独立复审探针（含 3 解析、13 项身份与标志负例/正例、并发单次关窗、跨轮路由与定时器） | **19/19 PASS** |
| 4 | `npm run test:detachable-p1a` | P1A 十审 5 项生产集成测试 | **5/5 PASS** |
| 5 | `qa/verify-ninth-review-probes.mjs` | P1A 进程创建时间容差严格 0 容差回归探针 | **7/7 PASS** |
| 6 | `npm run check` | 生产与伴随端全量语法检查与 CSS 模板守卫 | **PASS** |

### 3.2 独立纯 RC.35 整合基底验证
目录：`F:\dsh-wallpaper-plugins\.tmp\wallpaper-cleanup-b-repaired-rc35-20261018/`
- **基底一致性**：`rc35-base` 包含来自冻结安装包的 12 项原始文件，完全未修改。
- **差异最小化**：`rc35-repaired` 仅对 `src/wallpaper/managed-window.js`（归一化保留 startUtc，13 行变动）与 `src/wallpaper/session.js`（W1/W2/W3 独立核验与查询，418 行变动）进行整合，不带入工作区未交付的临时路由代码。
- **补丁指纹**：生成标准 UTF-8 差异补丁 `rc35-minimal-diff.patch`。
- **独立回放验证**：
  - `node incident-recovery-replay-rc35.mjs` -> 两种事故模式（`timeout-force-killed` 与 `normal-exit-missing-summary`）离线回放 **100% 成功通过**。
  - `node verify-rc35-probes.mjs` -> 19 项独立探针直接 `import` 纯 rc.35 修复模块，**19/19 100% 成功通过**。

---

## 4. 关键交付文件 SHA256 指纹列表

| 文件路径 | SHA256 指纹 | 说明 |
| --- | --- | --- |
| `dsh-whale-mist/src/wallpaper/managed-window.js` | `703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A` | 工作区 managed-window（保留 startUtc） |
| `dsh-whale-mist/src/wallpaper/session.js` | `001356F3287372A68E85FB0AF43E38B1914F6613309EECEA52042C4086996933` | 工作区 session（W1/W2/W3 完整修复） |
| `dsh-whale-mist/qa/wallpaper/cleanup-recovery-b.test.mjs` | `FCAD95371FAE9C7768AABF68F09DEFEE64C037512820A9135511DD91601E9FAD` | 工作区 17 场景集成测试 |
| `dsh-whale-mist/qa/wallpaper/verify-b-review-probes.mjs` | `EEA25AF7DD06112C4A5AFE365CA3BD356487F96D6564DAECF1F7C2AFEE639DF2` | 工作区 19 项独立探针 |
| `.tmp/.../rc35-repaired/src/wallpaper/managed-window.js` | `703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A` | 纯 rc.35 修复版本 managed-window |
| `.tmp/.../rc35-repaired/src/wallpaper/session.js` | `1969D4A166D6F62F6D8078B0AF028F965C7FD96D366630DC40768924A6484688` | 纯 rc.35 修复版本 session（12 项纯基底） |
| `.tmp/.../rc35-minimal-diff.patch` | `7DC8172C34032793E5AFD596D336A7AB4954F378EC8C24041C1BFF419E4A5DF1` | 纯 rc.35 最小差异补丁 (UTF-8) |
| `.tmp/.../verify-rc35-probes.mjs` | `3B8686E86EC8FDEEFCC96BE200652CD35E0396395C24A5244D7834B1987651CC` | 纯 rc.35 探针执行脚本 |
| `.tmp/.../incident-recovery-replay-rc35.mjs` | `6EB8B76E58D32CA449BBF981E01509BD6055F5BB6691C52C54E0642E6E315E39` | 纯 rc.35 现场事故回放脚本 |

---

## 5. 边界承诺与交付声明

1. **严格离线实现**：全程离线运行，未打包、未安装至本地生产环境。
2. **日常环境零干扰**：未重启、未操作日常 DSH（0.2.1-rc.2）与 Wallpaper Engine；未修改版本号（`0.6.0-rc.30`）或生产 C# 二进制；未发起任何 git 提交或推送；未发起跨会话消息。
3. **因果与事实记录**：初次断流根因如实记录为未知；所有测试均为沙盒与离线替身驱动，未影响物理显示设备或外部真实窗口。
4. **工作范围收敛**：严格专注 B 补修闭环，滚动 A 保持独立挂起，P1A 十审成果完整保持。

请 Codex 予以二审补修复核。
