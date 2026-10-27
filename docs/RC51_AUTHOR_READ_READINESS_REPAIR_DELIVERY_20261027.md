# rc.51首次作者读取等待同会话就绪最小修复交付报告

- 交付日期: 2026-10-27
- 交付性质: 离线隔离最小修复与红绿/因果/负例全面QA验证交付（未改动共享开发树及固定解包，未安装/未操作日常）
- 依据任务: [docs/RC51_AUTHOR_READ_READINESS_REPAIR_TASK_20261027.md](file:///F:/dsh-wallpaper-plugins/docs/RC51_AUTHOR_READ_READINESS_REPAIR_TASK_20261027.md)
- 关联收尾: [docs/RC51_TARGET_UNVERIFIED_OFFLINE_CLOSEOUT_20261027.md](file:///F:/dsh-wallpaper-plugins/docs/RC51_TARGET_UNVERIFIED_OFFLINE_CLOSEOUT_20261027.md)
- 隔离修复工作区: `F:\dsh-wallpaper-plugins\.tmp\rc51-gemini-readiness-repair-20261027-a\`

---

## 1. 选定的四态与同会话就绪等待合同

### 1.1 目标状态四分类机制 (`inspectTarget`)

在 [`src/wallpaper/author-properties-apply.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-a/src/wallpaper/author-properties-apply.js) 中引入严格的四态判决函数 `inspectTarget(value)`：

1. **`available` (已就绪)**：目标全部身份字段合法、未处于忙碌状态、且 `target.captureStarted === true`。由 `canApply()` 判定为真，直接返回就绪响应，无需任何等待。
2. **`capture_pending` (仅采集待证明)**：
   - 目标存在且结构完整；
   - 具有合法的 `generation`、`location`、`sceneId`、`mode`、`boundSession`；
   - 具有合法的 `hwnd`（有效数字且非 0）、`pid`（大于 0）、`startUtc`（有效 ISO 8601 字符串且未解析失败）；
   - `busy !== true`、`closing !== true`；
   - **唯独 `captureStarted !== true`**。
   - **合同约束**：系统**只允许**对此状态进入同会话就绪等待，且**仅限 GET schema 请求**。
3. **`rejected` (非法/未验证)**：
   - `startUtc` 为空或无效；
   - `hwnd`、`pid`、`helper`、`location` 缺失或不匹配；
   - `applyAdapter === null` 或未配置；
   - 立即返回 200 `{ targetActive: false, error: 'target.unverified' }`，**绝不进入等待**。
4. **`busy` (互斥锁忙碌)**：
   - `busy === true` 或处于参数应用锁竞争态；
   - 立即返回 409 Conflict，**绝不进入等待**。

### 1.2 单次 GET 内部就绪等待合同

1. **单次 HTTP GET 解决**：
   - 前端 `AuthorSwitches` 发出首次 `GET /api/wallpaper/author/properties/schema`。
   - 在后端等待事件释放期间，客户端控制器处于 `phase: 'reading'`，`canEdit === false`，草稿被抑制，零参数写入。
   - 后端在收到 `onCaptureReady` 事件后，重新原子校验 `readTarget(ticket)`，通过后返回 200 与完整 6 项参数字段。
   - 前端在**同一次 GET** 响应后直接迁入 `phase: 'ready'`。前端无需二次 GET、无需重试、无需轮询。
2. **同一 1500ms 预算共享，严禁加倍/重置**：
   - 在 [`src/wallpaper/author-properties-host.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-a/src/wallpaper/author-properties-host.js) 中实现 `readSchemaForGet(req, ticket)`。
   - 单次请求由同一个 `AbortController` 和唯一的 `timeoutMs`（默认 1500ms）总预算约束。
   - `library.getAuthorMetadata` 的耗时与 `applyAdapter.waitForReady` 共享该时钟，等待者自动计算剩余时间 `remainingMs = timeoutMs - elapsedMs`。
   - 若超时，抛出 504 `author_read_timeout`，立即解绑等待者并回收资源。
3. **原子注册与双检查防丢**：
   - `waitForReady` 在向 session 注册监听器前先调用 `inspectTarget`；
   - 注册监听器后再立即复核一次 `inspectTarget`。若在注册瞬间 `captureStarted` 已变为 true，立即解绑并返回，杜绝注册竞态丢失。
4. **精确绑定具体 Session 实例与 Generation**：
   - `waitForReady(id, generation, { signal })` 严格校验 `applyAdapter.target()` 绑定的 `boundSession` 实例。
   - 当收到会话通知时，若会话实例或代次已切换（例如 ABA 切换同名 Lucy），旧会话事件直接丢弃，不解除新会话等待。
5. **写路由严格隔离**：
   - `POST /apply`、`POST /plan`、`POST /draft` 继续复用同步 `schemaFor(req, ticket)`，禁止进入等待流程。

---

## 2. 实际修改文件与固定输入指纹

### 2.1 隔离修复区 4 个文件实现差异

| 源码文件 | 修改点概述 |
|---|---|
| [`src/wallpaper/session.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-a/src/wallpaper/session.js) | 增加 `captureListeners = new Set()` 与 `onCaptureReady(listener)`；在 `stderr` 收到 `Status(captureSource:window)` 时发通知；在会话 `runClose()`、子进程退出及报错时通知等待者结算并清理监听集合。增加 `stats().captureReadyListeners` 供观测。 |
| [`src/wallpaper/author-properties-apply.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-a/src/wallpaper/author-properties-apply.js) | 实现 `inspectTarget(value)` 严格隔离 `capture_pending`；实现 `waitForReady(id, generation, { signal })`，绑定具体 `boundSession`、`generation`、`location`，实现注册前后双检查及 abort 监听器自动注销。 |
| [`src/wallpaper/author-properties-host.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-a/src/wallpaper/author-properties-host.js) | 引入 `readSchemaForGet(req, ticket)` 专供 `req.method === 'GET'`；严格复用单一 `AbortController` 和 1500ms 总预算，扣除元数据耗时后向 adapter 传递剩余时间；POST 路由保持同步 `schemaFor`；在 host `dispose()` 时统一中止所有 pending 等待。 |
| [`src/index.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-a/src/index.js) | 在 `readTarget()` 中将 `session: wallpaper.currentSession()` 传递至 `authorPropertiesAdapter`，使 adapter 获得具体会话实例引用。 |

### 2.2 固定输入 10 项 SHA256 逐项校验表 (`input-hashes.json`)

通过独立脚本 `verify-inputs.mjs` / `run-verify-inputs.cjs` 严格核验（退出码 0，`allMatch: true`）：

| 序号 | 来源路径 | 预期 SHA256 | 实际 SHA256 | 匹配 | 备注 |
|---|---|---|---|:---:|---|
| 1 | `.tmp\...\unpacked\src\index.js` | `5970769F31A0A0AF9EE87F0C5F0ABDF14741181CC947BBB271305E5E5F2875D4` | `5970769F31A0A0AF9EE87F0C5F0ABDF14741181CC947BBB271305E5E5F2875D4` | **True** | Fixed unpacked index.js |
| 2 | `.tmp\...\unpacked\src\client.js` | `62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8` | `62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8` | **True** | Fixed unpacked client.js |
| 3 | `.tmp\...\unpacked\src\wallpaper\session.js` | `BFD991CF034B590CDF4740A0771E62C23D9C865834611D29F1CC491FA2149E01` | `BFD991CF034B590CDF4740A0771E62C23D9C865834611D29F1CC491FA2149E01` | **True** | Fixed unpacked session.js |
| 4 | `.tmp\...\unpacked\src\wallpaper\author-properties-apply.js` | `14799F8598F0093DF4916B535B62995FC522991BCADFA847EC7DA973E360ADD9` | `14799F8598F0093DF4916B535B62995FC522991BCADFA847EC7DA973E360ADD9` | **True** | Fixed unpacked author-properties-apply.js |
| 5 | `.tmp\...\unpacked\src\wallpaper\author-properties-host.js` | `E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97` | `E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97` | **True** | Fixed unpacked author-properties-host.js |
| 6 | `.tmp\...\unpacked\src\wallpaper\managed-window.js` | `6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86` | `6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86` | **True** | Fixed unpacked managed-window.js |
| 7 | `.tmp\...\unpacked\src\wallpaper\scenes.js` | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` | **True** | Fixed unpacked scenes.js |
| 8 | `.tmp\...\unpacked\package.json` | `3C8D61C4786B614E5E01CC359C5242F4E6F8AB7C0D009BD1BD84268D5D0CA189` | `3C8D61C4786B614E5E01CC359C5242F4E6F8AB7C0D009BD1BD84268D5D0CA189` | **True** | Fixed unpacked package.json |
| 9 | `docs\RC51_AUTHOR_READ_READINESS_REPAIR_TASK_20261027.md` | `1B6F497A89D813C839E9FAB878914CD97CB965FBD570477B25AA75E63165E8B3` | `1B6F497A89D813C839E9FAB878914CD97CB965FBD570477B25AA75E63165E8B3` | **True** | New task document |
| 10 | `docs\RC51_TARGET_UNVERIFIED_OFFLINE_CLOSEOUT_20261027.md` | `9F1383C2E128C264A5B967E4FA0BFA13A8815E59BF627E022C0E67240E8C6789` | `9F1383C2E128C264A5B967E4FA0BFA13A8815E59BF627E022C0E67240E8C6789` | **True** | Offline closeout document |

---

## 3. 先红后绿与负例验证结果 (Cases 1–8)

完整的离线自动化回归测试集中于 [`test-readiness-repair.mjs`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-a/test-readiness-repair.mjs)，包含真实固定引擎、原版 `AuthorSwitches` effect 函数体回放与真实修复后端：

### 3.1 用例矩阵与执行结果

1. **Case 1: Red 基线缺口（旧实现阻断）**
   - **条件**：首帧到达触发引擎 `playing`，立即发起首次读取，此时 `captureStarted === false`；使用未修复的旧 ApplyAdapter（无 `waitForReady`）。
   - **结果**：首次读取立即失败，返回 `target.unverified`，进入 `phase: 'blocked'`。确证缺口真实可复现。
2. **Case 2: Green 修复验证（同 GET 等待释放直达 Ready）**
   - **条件**：首帧先到达触发读取，此时 `captureStarted === false`；使用修复版 ApplyAdapter + Host。
   - **断言**：
     - 在请求在途期间采样，前端处于 `phase: 'reading'`，`canEdit === false`，草稿写入为 0；
     - 触发 session 的 `Status(captureSource:window)` 模拟就绪事件；
     - 同一次 GET 请求返回 200，前端直接进入 `phase: 'ready'`；
     - 6 项作者设置（开场动画、粒子、光照、水袋、开关、关闭营销词）全部就绪，`schemaCalls === 1`，`authorPostsCount === 0`。
3. **Case 3: Green 对照用例（就绪先于首帧）**
   - **条件**：stderr 采集就绪先于首帧到达；首帧到达时 `captureStarted === true`。
   - **结果**：首次 GET 直接通过，立即 ready，6 项参数完整，`schemaCalls === 1`。
4. **Case 4: 反事实零帧对照**
   - **条件**：在 100ms 观察窗口内交付 0 帧。
   - **结果**：渲染引擎维持 `connecting`，`schemaCalls === 0`，未触发任何自动读取，前端维持 `phase: 'idle'`。
5. **Case 5: 预算共享与超时不重置**
   - **条件**：设置 `timeoutMs: 250`，且采集就绪事件始终不发生。
   - **结果**：在 255ms 内触发超时，返回 504 `author_read_timeout`，未发生计时加倍或重置，会话监听器解绑注销。
6. **Case 6: 取消与 Host Dispose 立即解绑**
   - **条件**：发起在途等待请求，客户端主动 abort 或 host 调用 `dispose()`。
   - **结果**：`session.stats().captureReadyListeners` 立即降为 0，等待者完全解绑，无资源泄漏。
7. **Case 7: 代次切换与 ABA 隔离**
   - **条件**：旧会话 Session A 处于等待中，切换到新会话 Session B（即使同为 Lucy 场景）。Session A 迟到的 `captureStarted` 事件触发。
   - **结果**：Session B 的等待者未被释放（`abaOutcome === 'session_changed'`），确证基于具体会话对象身份强绑定。
8. **Case 8: 保守拒绝与 POST 不等待**
   - **条件**：分别测试 `windowStartUtc` 无效、`applyAdapter === null`、`busy === true` 以及 `POST /apply`。
   - **结果**：无效 `startUtc` 立即判为 `target.unverified` 且不等待；`applyAdapter === null` 直接返回 `targetActive: false` 且不等待；`busy === true` 立即返回 409 Conflict 且不等待；POST 路由直接执行同步门禁，完全不挂载等待。

---

## 4. 排他模式双监督器执行与报告数据

所有测试通过父外监督进程拉起，标准输入断开（`stdio: ['ignore', 'pipe', 'pipe']`），配置 25 秒强制超时兜底并严格确认进程退出，产物使用 `{ flag: 'wx' }` 排他写入。

### 4.1 正常模式监督器 (`normal/run-normal.cjs`)
- **命令**: `node normal/run-normal.cjs`
- **监督器执行耗时**: 826ms，退出码 0
- **产物文件**:
  - `normal/normal-report.json`
  - `normal/normal-run.json`
- **关键数据**:
  - `totalCases`: 8
  - `passedCases`: 8
  - `allPassed`: true
  - `cleanupSuccessfulForAll`: true
  - `childExitCode`: 0

### 4.2 故障注入模式监督器 (`fault/run-fault.cjs`)
- **命令**: `node fault/run-fault.cjs`
- **监督器执行耗时**: 735ms，退出码 0
- **产物文件**:
  - `fault/fault-report.json`
  - `fault/fault-run.json`
- **故障注入机理**: 在 Case 1 中注入 `session.close()` 失败（强制未释放句柄导致 `session.isClosed() === false`）。
- **监督器核验结果**:
  - `childExitCode`: 1
  - `expectedFailureConfirmed`: true
  - `case1Passed`: false
  - `case1CleanupSuccessful`: false
  - `error`: `"AssertionError [ERR_ASSERTION]: Session must be verified closed\n\nfalse !== true"`
  - `isLogicFailureWithSuccessfulCleanup`: false（拒绝假故障）

---

## 5. 真实组件与底层 IO 替身边界说明

### 5.1 真实运行组件
1. **客户端引擎与 Effect**: 固定 candidate `client.js` 中的真实 `createWallpaperEngine` 状态机与真实 `AuthorSwitches` React effect 函数体回放。
2. **协议帧与图像**: 真实 24 字节大端 WHL1 魔数及小端格式二进制帧头，承载工坊 62,886 字节有效全标记 JPEG 图像包。
3. **后端核心服务**: 修复版 `session.js`、`author-properties-apply.js`、`author-properties-host.js`、`index.js`，运行真实 Node.js HTTP Server、SSE 事件分发与四态判定逻辑。

### 5.2 底层 IO 替身边界（不冒充完整端到端）
1. **原生二进制与进程执行**: `execCommand`（如 `wmic/Get-Process` 查启动时间）采用固定回调模拟，未调用外部 PowerShell/WMIC 进程。
2. **图形与窗口渲染**: `createImageBitmap`、`canvas.getContext('2d').drawImage` 采用底层尺寸与无损替身，未调用系统 DirectX/GPU 硬件渲染。
3. **桌面窗口捕获**: `--we-open`、`--window-find`、Win32 HWND 枚举采用会话替身，未依赖实际 Windows 桌面管理器或壁纸注入窗口。

---

## 6. 未覆盖项说明

1. 本次修复仅针对离线已证实的“画面 playing 触发首次读取时，`session.captureStarted` 尚未就绪的时序竞态”；
2. 不宣称解决了生产环境由权限不足、防病毒软件拦截、显卡驱动挂起等导致的系统级 `target.unverified`；
3. 未包含“▶ 播放”按钮文案等 UI 视觉优化项（按既定约束后排）；
4. 本次为纯离线代码修复与 QA，未打包安装至系统日常 DSH rc.3 / Whale rc.48，日常环境保持原状。

---

## 7. 拟提升最少文件清单 (仅 4 个源码文件)

如 Codex 独立复审通过且决定合并提升，仅需自隔离区提取以下 4 个文件至候选包或开发树：
1. `src/wallpaper/session.js`
2. `src/wallpaper/author-properties-apply.js`
3. `src/wallpaper/author-properties-host.js`
4. `src/index.js`

**零包依赖变更、零资源文件变更、零前端 Client 变更、零 Native 二进制变更。**
