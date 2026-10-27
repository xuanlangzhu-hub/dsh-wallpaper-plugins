# rc.50 首次作者读取：Gemini 补验交付报告

2026-10-26，Gemini（Antigravity 会话）。
依据 Codex 复审意见（`docs/RC50_AUTHOR_INITIAL_READ_GEMINI_REVIEW_20261026.md`）完成聚焦补验与口径修正，涵盖 R1（对象准确归属与严密断言）、R2（真实 Windows rc.3 SDK 隔离窄诊断验证）与 R3（推论及文档口径更正）。

---

## 一、R1：测试对象归属与严密断言（P2）

### 1.1 测试对象与环境归属明确
本次验证脚本严格区分被测对象构成，不把诊断探针称为未经修改的完整客户端或生产实机：
1. **客户端测试主体**：
   - R1 采用 `.tmp/rc50-author-initial-read-diagnosis-20261026-a/client-probe-test-hook.js`（SHA256: `1C27CE84587635677B4B4FC851651B20A1E3BE2DFEAE78D68DC123C4F8171BA8`），系包含封闭阶段码逻辑与 VM 导出的诊断探针副本，**非**未经修改的 rc.50 client。
2. **后端解包真实实现**：
   - `createDetachableHttpHost`（`package/src/detachable-host.js`）
   - `createAuthorApplyAdapter`（`package/src/wallpaper/author-properties-apply.js`）
   - `createWallpaperLibrary`（`package/src/wallpaper/library.js`）
   - Lucy 声明文件：`SCENES.lucy.project`（SHA256: `F04E883F00EF2439247E64FF41D3B8EF043CBE1DF584282AE1C5E28560F45944`）
3. **离线隔离替身范围**：
   - 目标窗口识别替身：PID `4321`、HWND `1234`、startUtc `'2026-10-26T00:00:00.1234567Z'`、helper `'C:\\offline-helper.exe'`。
   - 原生执行器替身：`runChild` 若被调用立即抛出错误并记录 `nativeCommands` 计数。

### 1.2 排他输出与补齐断言
执行目录为独立排他新建的 `.tmp/rc50-gemini-repair-verification-20261026-a/`，所有输出与日志均采用 `{ flag: 'wx' }` 排他写入，完整保留既有失败与成功证据。

R1 专项脚本（`verify-r1.mjs`，由 `run-r1.cjs` 父监督运行，耗时 357ms，退出码 0）：
- **原生命令下发**：所有正常与故障场景下断言 `nativeCommands === 0`，全流程无任何原生下发。
- **只读阶段无写请求**：首次读取（无论成功或失败）断言 `writeCallsCount === 0`（未发起任何 `/draft`、`/plan` 或 `/apply` 请求）。
- **无隐式自动重试**：失败后再次调用 `ensureLoaded()`，网络请求增量严格为 0（`implicitRetryAttempts === 0`）。
- **手动恢复确定性**：在 `captureReady = true` 后显式调用 `api.load()`，schema 请求增量恰好为 1（`manualCallIncrement === 1`），最终状态确切达到 `phase === 'ready'` 且 `fields.length === 6`。
- **主会话清理确认**：所有场景在 `finally` 阶段执行 `host.stop()` 后，显式断言 `assert.equal(host.getMainSession(), null)`（`mainSessionNull: true`）。
- **单行删除反例单列**：明确隔离单行删除（移除 `targetActive` 检查）的反例。测试证实该改法导致控制器在目标未验状态下错误进入可编辑状态并产生本机草稿（`/draft` 请求），但后端的 Host `canApply` 门禁与原生执行器依然拦截（`nativeCommands === 0`），证明其为“意外本机草稿”，而非“非法 draft 被后端放行”。

---

## 二、R2：真实 Windows rc.3 SDK 窄诊断验证（P1）

### 2.1 SDK 测试架构与环境配置
- **测试框架**：基于官方 Windows rc.3 前端与 Playwright Edge Headless（`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`），受 `run-sdk-diagnostic.cjs` 父监督保护（限时 45s）。
- **客户端加载**：向 SDK 页面服务完整客户端 `.tmp/rc50-author-initial-read-diagnosis-20261026-a/client-read-diagnostic-probe.js`（SHA256: `5C3DFA4391517899C0CF95B7ED3262B0591AAA48CDF8B5F5C86877235EDCDAF8`），包含原生侧栏、Astra UI 及封闭阶段码诊断逻辑。
- **运行成果**：耗时 5,055ms，11 项场景全部通过，Edge 自有进程退出确认通过（`ownedBrowserExitConfirmed: true`，退出码 0）。

### 2.2 验证场景与 DOM 呈现结果

| 序号 | 场景名称 | 注入/触发机制 | 实际 DOM 呈现与断言 | 结论 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `healthy-initial-read` | 正常播放 Lucy，打开侧栏壁纸页 | 自动发起恰好 1 次 schema GET，0 次写请求，0 次原生命令；Lucy 6 项控件正常渲染且可用；DOM 无任何诊断方括号文本（`0 brackets`） | 通过 |
| 2 | `phase-code-snapshot-http-403` | 拦截 `/api/main/snapshot` 返回 403 Forbidden | `[role="alert"]` 确切渲染 `未能读取设置，请重试 [snapshot.http.403]`；**严格断言不显示 409** | 通过 |
| 3 | `phase-code-snapshot-transport` | 拦截 `/api/main/snapshot` 模拟网络故障（abort） | `[role="alert"]` 确切渲染 `未能读取设置，请重试 [snapshot.transport]` | 通过 |
| 4 | `phase-code-schema-context-409` | 拦截 `/api/author-properties/schema` 返回 409 `author_context_changed` | `[role="alert"]` 确切渲染 `未能读取设置，请重试 [schema.context.409]` | 通过 |
| 5 | `phase-code-schema-metadata-409` | 拦截 `/api/author-properties/schema` 返回 409 `author_library_unavailable` | `[role="alert"]` 确切渲染 `未能读取设置，请重试 [schema.metadata.409]` | 通过 |
| 6 | `phase-code-target-unverified` | 真实 Host/Adapter 返回 `captureStarted: false`（`targetActive: false`） | `[role="alert"]` 确切渲染 `未能读取设置，请重试 [target.unverified]` | 通过 |
| 7 | `phase-code-validation-shape` | 拦截 schema 返回缺少 fields 数组的残缺 JSON | `[role="alert"]` 确切渲染 `未能读取设置，请重试 [validation.shape]` | 通过 |
| 8 | `hidden-view-late-response` | 挂起 schema 请求，切换至界面页，释放错误响应，再切回壁纸页 | 挂起错误不泄露至新视图，请求增量受控（无重试风暴/循环），手动刷新可正常恢复 | 通过 |
| 9 | `generation-change-late-response` | 挂起 schema 请求，停止当前播放，开启新播放代次，释放旧响应 | 旧代次迟到响应被丢弃，不污染新代次上下文，新代次 Lucy 正常就绪 | 通过 |
| 10 | `privacy-desensitization-dom-verification` | 注入含假 Token、敏感文件路径与后端异常的错误响应 | 断言全侧栏 DOM 文本严格不包含敏感标记，仅展示封闭脱敏阶段码 | 通过 |
| 11 | `phase-code-bridge-disconnected` | 模拟 bridge 客户端与 Host 链路断开 | `[role="alert"]` 确切渲染 `未能读取设置，请重试 [bridge.disconnected]` | 通过 |

---

## 三、R3：推论口径与历史更正（P2）

1. **状态码准确性更正**：
   - 确认并纠正此前示意图与文档中关于 snapshot 错误码的笔误：`/api/main/snapshot` 若返回 HTTP 401 或 403，诊断探针准确保留并展示为 `[snapshot.http.401]` 或 `[snapshot.http.403]`，**绝不混淆或归一化为 409**。
2. **两阶段架构方案的定位**：
   - “只读展示”与“编辑下发”两阶段分离方案明确降级为**条件性设计提案**，而非解决现场问题的唯一定论或先决条件。
   - 现场真正的首个失败阶段仍需等待用户方便时的新鲜抓包证据。在获得实机真实 HTTP/Bridge 原始记录前，不假定问题必然出在前端或两阶段状态混用。
3. **单行删除反例口径更正**：
   - 单行删除 `targetActive` 门禁引发的是“本机控制器意外进入可编辑状态并产生本地 draft”的瑕疵，**并未**突破后端的身份校验与写入限制（后端原生下发依然被 `canApply` 严格阻断）。因此更正此前“非法 draft 被放行”的说法。
4. **启动锁时序描述修正**：
   - 移除关于“状态流先于锁释放”的绝对化结论，将其标示为基于代码逻辑推演的假设，不当做已在生产实机捕获的事实。
5. **工作区状态更正**：
   - 更正此前“工作区纯净”的表述：当前工作区存在 205 项长期存在的未提交修改与历史遗留文件（18 项受版本控制修改，其余为多轮沉淀的文档、QA 与临时夹具），本轮严格保持既有脏改动不清理、不提交、不覆盖，42 项核心受保护实现与资源逐字节未变。

---

## 四、输入与交付物清单及哈希指纹

### 4.1 关键输入文件哈希
- `client-probe-test-hook.js`：`1C27CE84587635677B4B4FC851651B20A1E3BE2DFEAE78D68DC123C4F8171BA8`
- `client-read-diagnostic-probe.js`：`5C3DFA4391517899C0CF95B7ED3262B0591AAA48CDF8B5F5C86877235EDCDAF8`
- Lucy project 资产（`SCENES.lucy.project`）：`F04E883F00EF2439247E64FF41D3B8EF043CBE1DF584282AE1C5E28560F45944`

### 4.2 本轮排他交付成果（`.tmp/rc50-gemini-repair-verification-20261026-a/`）
| 文件名 | 大小 (Bytes) | SHA256 指纹 |
| :--- | :--- | :--- |
| `verify-r1.mjs` | 13,438 | `1C32D1E4DCAD07669FB3DDA3693C06796CBC50FCA244DD22D857CB7D6778128B` |
| `run-r1.cjs` | 1,929 | `BF6C625442FA742FC0A1A0B89B850BA0AF5AD7354A9366F770D62A810ED192D6` |
| `r1-verification-run.json` | 163 | `DDD9EB95392E43C7C2690222C8183D4A5DC7B3E25002E790E0274543BA4FB1D7` |
| `r1-verification-report.json` | 12,024 | `ABE49A688675FC4A24261DCB586D2FD0FF94027EA31C230F0BF638F50448D7E3` |
| `r1-verification.stdout.log` | 1,336 | `DD3875118C18F17F5FEC4EC3C5BAC7AB7E2A85FE0F92BFF1C00B8943DDE79C9A` |
| `r1-verification.stderr.log` | 0 | `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` |
| `sdk-diagnostic-test.mjs` | 25,789 | `F70C9AFFD5306F789F2A4700BA5189E5EE227F5406F3609DEA37CA73FB0A4DDB` |
| `run-sdk-diagnostic.cjs` | 1,938 | `5B7AFCE63E55734506188EFE99495E1DA521FD15DAB038BE2D5C521E96C6BDE9` |
| `sdk-diagnostic-run.json` | 163 | `1713DD4DD7E9B0A2993C5C693AFF1B2C872B70DBB694C9D4BFB9848D181718E3` |
| `sdk-diagnostic-report.json` | 3,725 | `C2D9C112BE0960792F17136C4BA2774E31381BB2D21994F7C8A73D8E72A9861D` |
| `sdk-diagnostic.stdout.log` | 1,143 | `C2AC3F253BD1991D4DF1CDB4EA813EBE85C86D208AD9999587497B8160A96A3D` |
| `sdk-diagnostic.stderr.log` | 0 | `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` |

---

## 五、当前未决与下一步接续建议

1. **未决事项**：
   - 现场实机（23张图库翻阅后首次加载 Lucy）究竟因哪一具体阶段失败（bridge / snapshot / schema / target）依然缺失原始网络追踪。
   - 现已完备验证的封闭阶段码探针已具备在 UI 层面提供精准定位的能力。
2. **生产环境与日常状态**：
   - 日常环境保持 DSH 0.2.1-rc.3、Whale rc.48、Git Bash 0.1.2 稳定运行。
   - 本轮未改动生产源码，未打包安装，未操作日常 DSH/WE，未清理推送。
3. **交付交接**：
   - 交付 `docs/RC50_AUTHOR_INITIAL_READ_GEMINI_REPAIR_DELIVERY_20261026.md`，交由 Codex 独立复审。
