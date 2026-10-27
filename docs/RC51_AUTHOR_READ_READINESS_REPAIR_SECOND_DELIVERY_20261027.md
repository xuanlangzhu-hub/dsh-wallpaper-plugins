# rc.51首次作者读取等待同会话就绪最小修复二审交付报告

- 交付日期: 2026-10-27
- 交付性质: 隔离最小修复 R1/R2 复审项补修交付（未改动共享开发树及固定解包，未安装/未操作日常）
- 依据复审: [docs/RC51_AUTHOR_READ_READINESS_REPAIR_REVIEW_20261027.md](file:///F:/dsh-wallpaper-plugins/docs/RC51_AUTHOR_READ_READINESS_REPAIR_REVIEW_20261027.md)
- 依据任务: [docs/RC51_AUTHOR_READ_READINESS_REPAIR_TASK_20261027.md](file:///F:/dsh-wallpaper-plugins/docs/RC51_AUTHOR_READ_READINESS_REPAIR_TASK_20261027.md)
- 新排他工作区: `F:\dsh-wallpaper-plugins\.tmp\rc51-gemini-readiness-repair-20261027-b\`
- 上一轮见证与原件: 完整保留于 `.tmp/rc51-gemini-readiness-repair-20261027-a\`，未覆盖、未覆盖旧输出

---

## 1. R1 实现边界补修

### 1.1 R1.1 完整身份冻结与漂移绝对拒绝 (`waitForReady` & `matchBoundIdentity`)

在 [`src/wallpaper/author-properties-apply.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-b/src/wallpaper/author-properties-apply.js) 中重构身份绑定逻辑：

1. **冻结归一化完整初始身份**：
   - 进入 `waitForReady` 时，通过 `inspectTarget(readTarget())` 归一化并冻结完整身份对象：
     ```javascript
     const boundIdentity = {
       wallpaperId: String(initial.target.wallpaperId),
       generation: Number(initial.target.generation),
       location: String(initial.target.location),
       hwnd: Number(initial.target.hwnd),
       pid: Number(initial.target.pid),
       startUtc: String(initial.target.startUtc),
       helper: String(initial.target.helper),
       session: initialRaw.session // 强引用绑定具体 Session 实例
     };
     ```
2. **注册后双检查与就绪事件双重校验 (`matchBoundIdentity`)**：
   - 无论是注册后微任务双检查，还是 `onCaptureReady` 事件触发，均调用 `matchBoundIdentity(currentRaw, boundIdentity)` 逐字段比对；
   - 比较 `currentRaw.session === bound.session`（不符报 `'session_changed'`）；
   - 比较 `t.hwnd === bound.hwnd`、`t.pid === bound.pid`、`t.helper === bound.helper`、`areStartUtcsEquivalent(t.startUtc, bound.startUtc)`、`t.wallpaperId`、`t.generation`、`t.location`（任意漂移立即报 `'identity_changed'`）；
   - 检查 `stopping`、`busy`、`isDisposed`；
   - 唯独允许 `captureStarted` 由 false 迁为 true。
3. **独立反例核验证据 (`verify-counterexamples.mjs`)**：
   - 对保持同 session/scene/gen/location 但分别更改合法 `hwnd: 333`、`pid: 444`、`startUtc`（漂移 1 秒）、`helper` 的 4 项负例：全部返回 `{ ok: false, reason: 'identity_changed' }`；
   - 真实 Host + 适配器在 HWND 漂移场景下发起请求：HTTP 响应 200 且 `application.targetActive === false`，漂移成功被阻断。

### 1.2 R1.2 Host 显式消费等待器拒绝 (`author-properties-host.js`)

在 [`src/wallpaper/author-properties-host.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-b/src/wallpaper/author-properties-host.js) 的 `readSchemaForGet` 中：

1. **消费等待结果，禁止兜底 `canApply` 重新激活**：
   ```javascript
   let targetActive = false;
   if (applyAdapter) {
     if (applyAdapter.canApply(ticket.selectedId, ticket.lifecycle.generation)) {
       targetActive = true;
     } else if (typeof applyAdapter.waitForReady === 'function') {
       const waitResult = await applyAdapter.waitForReady(ticket.selectedId, ticket.lifecycle.generation, { signal: controller.signal });
       if (waitResult?.ok === true) {
         check(req, ticket);
         targetActive = applyAdapter.canApply(ticket.selectedId, ticket.lifecycle.generation) === true;
       } else {
         // 显式消费等待拒绝：session_changed、identity_changed、cancelled 等结果不可被覆盖为 true
         targetActive = false;
       }
     } else {
       targetActive = false;
     }
   }
   ```
2. **在 `state(schema, ticket, { targetActive })` 中消费该布尔状态**：
   - `application.targetActive` 严格使用 `readSchemaForGet` 传递的 `targetActive`，彻底消除了“等待器返回 `session_changed` 但 Host 最终仍返回 `targetActive: true`”的反例；
   - 独立负例运行断言确认：替换 session 但 ticket 保持不变时，HTTP 200 返回且 `application.targetActive === false`。

### 1.3 R1.3 适配器生命周期与等待资源解绑 (`adapter.dispose`)

在 [`src/wallpaper/author-properties-apply.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-b/src/wallpaper/author-properties-apply.js) 中：

1. **跟踪活动等待者集合 `pendingWaiters = new Set()`**；
2. **在 `adapter.dispose()` 中主动结算并注销**：
   - 遍历 `pendingWaiters`，触发 `waiter.abort('disposed')`；
   - 执行 `unbind()` 将会话上的监听器立即注销，Promise 立即结算为 `{ ok: false, reason: 'disposed' }`；
3. **独立反例核验证据**：
   - 挂载等待者后调用 `adapter.dispose()`：`session.listeners.size` 立即由 1 降为 0；
   - 稍后触发 `ready()`：等待 Promise 保持 `{ ok: false, reason: 'disposed' }`，`canApply` 保持 false。

---

## 2. R2 QA 真实门禁与补全回归

### 2.1 R2.1 剔除后置改报告，恢复真实清理失败验收

1. **彻底删除 `test-readiness-repair.mjs` 原 1139–1146 行的后置改报告逻辑**；
2. **真实底层清理故障注入**：
   - 当环境变量 `QA_INJECT_TEARDOWN_FAILURE === '1'` 时，在 Case 1 中让 helperRun 对 `--window-ensure-closed` 返回 `{ outcome: 'failed', closed: false }`；
   - 导致 `session.stop()` 内部状态未关闭（`session.isClosed() === false`）；
   - 在测试用例的 `finally` 中严格断言：
     ```javascript
     c.cleanupSuccessful = sessClosed && stopClosed;
     assert.equal(c.cleanupSuccessful, true, 'Session must be verified closed');
     ```
   - Case 1 自然抛出 `AssertionError [ERR_ASSERTION]: Session must be verified closed: false !== true`；
   - `c.passed` 自然为 `false`，`[Case FAIL] case1-red-old-adapter-blocked` 自然打印到 stderr；
   - 统计自然得出 `passedCases: 7, totalCases: 8, allPassed: false, cleanupSuccessfulForAll: false`；
   - 脚本自然以退出码 1 退出。
3. **故障监督器 (`fault/run-fault.cjs`) 验收**：
   - 监督器在 979ms 退出 0；
   - 核验子进程退出码 1、`expectedFailureConfirmed === true`、`case1Passed === false`、`case1CleanupSuccessful === false`；
   - 严格拒绝逻辑失败但清理成功的伪故障（`isLogicFailureWithSuccessfulCleanup === false`）。

### 2.2 R2.2 补全未覆盖的小组与真实接缝

1. **真实 POST 校验与零等待断言 (Case 8D)**：
   - 发送合法的 `POST /api/author-properties/draft`，包含真实的 Lucy fingerprint、`expectedRevision: 0` 与 `values: { particles: false }`；
   - 断言经由真实 metadata / schema / validation 逻辑成功返回 200 与 `mutation: 'set'`；
   - **严格断言**：`waitForReady` 调用次数为 0，底层原生子命令执行次数为 0。
2. **在途 Host.dispose 与客户端 Abort (Case 6)**：
   - **Subcase 6A**：请求发出且正在在途等待就绪（`captureReadyListeners === 1`），此时直接调用 `host.dispose()`。断言 `session.stats().captureReadyListeners` 立即降为 0，请求被中止结算；
   - **Subcase 6B**：请求在途等待期间客户端触发 `abortController.abort()`。断言监听器立即解绑注销（降为 0）。
3. **真实受控耗时与预算共享 (Case 5)**：
   - `mockLibrary` 在 `getAuthorMetadata` 注入 120ms 受控耗时；
   - 总预算设置为 300ms，采集就绪永不发生；
   - 测得总耗时为 305ms（严格处于 [280ms, 400ms] 区间，远小于重置加倍所需的 420ms+）；
   - 确证元数据耗时与就绪等待共享同一个 300ms deadline，返回 504 `author_read_timeout` 且监听器完全注销。
4. **ABA 代次切换双在途隔离 (Case 7)**：
   - Session A (Lucy, gen 1) 发起请求并处于在途等待（listeners: 1）；
   - 切换至 Session B (Lucy, gen 2) 并发起独立在途请求（listeners: 1）；
   - Session A 触发就绪事件：Session A 请求因代次变更返回 409 `author_context_changed`；
   - **关键断言**：Session B 的请求**未被释放**，Session B 监听器维持为 1；
   - 直至 Session B 自身的就绪事件触发，Session B 才成功结算为 200 `targetActive: true`。
5. **消除手抄闭包与手填适配器**：
   - 在 [`src/index.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-readiness-repair-20261027-b/src/index.js) 中提取并导出 `createWallpaperReadTarget(wallpaper)` 与 `createWallpaperReadLifecycle(wallpaper)`，生产接线与测试用例 100% 共享相同接线代码；
   - Case 1 (Red) 直接从解包目录引入原件 `createUnrepairedAuthorApplyAdapter`，杜绝手填 mock 掩盖生产入口差异。
6. **所有异步操作阶段有界**：
   - `server.listen`、`session.create`、`fetch`、`session.stop`、`server.close` 等全部封装入 `bounded(promise, label, ms)` 超时保护，杜绝无界挂起。
7. **修正文案与真实 API 路径**：
   - 报告同步测试中真实挂载的 `/api/author-properties/schema` 与 `/api/author-properties/draft`，字段与代码实现完全一致。

---

## 3. 固定输入指纹逐项比对 (`input-hashes.json`)

新工作区经由 `verify-inputs.mjs` / `run-verify-inputs.cjs` 严格核验（退出码 0，`allMatch: true`）：

| 序号 | 来源路径 | 预期 SHA256 | 实际 SHA256 | 匹配 | 备注 |
|---|---|---|---|:---:|---|
| 1 | `unpacked\src\index.js` | `5970769F31A0A0AF9EE87F0C5F0ABDF14741181CC947BBB271305E5E5F2875D4` | `5970769F31A0A0AF9EE87F0C5F0ABDF14741181CC947BBB271305E5E5F2875D4` | **True** | Fixed unpacked index.js |
| 2 | `unpacked\src\client.js` | `62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8` | `62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8` | **True** | Fixed unpacked client.js |
| 3 | `unpacked\src\wallpaper\session.js` | `BFD991CF034B590CDF4740A0771E62C23D9C865834611D29F1CC491FA2149E01` | `BFD991CF034B590CDF4740A0771E62C23D9C865834611D29F1CC491FA2149E01` | **True** | Fixed unpacked session.js |
| 4 | `unpacked\src\wallpaper\author-properties-apply.js` | `14799F8598F0093DF4916B535B62995FC522991BCADFA847EC7DA973E360ADD9` | `14799F8598F0093DF4916B535B62995FC522991BCADFA847EC7DA973E360ADD9` | **True** | Fixed unpacked author-properties-apply.js |
| 5 | `unpacked\src\wallpaper\author-properties-host.js` | `E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97` | `E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97` | **True** | Fixed unpacked author-properties-host.js |
| 6 | `unpacked\src\wallpaper\managed-window.js` | `6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86` | `6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86` | **True** | Fixed unpacked managed-window.js |
| 7 | `unpacked\src\wallpaper\scenes.js` | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` | **True** | Fixed unpacked scenes.js |
| 8 | `unpacked\package.json` | `3C8D61C4786B614E5E01CC359C5242F4E6F8AB7C0D009BD1BD84268D5D0CA189` | `3C8D61C4786B614E5E01CC359C5242F4E6F8AB7C0D009BD1BD84268D5D0CA189` | **True** | Fixed unpacked package.json |
| 9 | `docs\RC51_AUTHOR_READ_READINESS_REPAIR_TASK_20261027.md` | `1B6F497A89D813C839E9FAB878914CD97CB965FBD570477B25AA75E63165E8B3` | `1B6F497A89D813C839E9FAB878914CD97CB965FBD570477B25AA75E63165E8B3` | **True** | Task document |
| 10 | `docs\RC51_TARGET_UNVERIFIED_OFFLINE_CLOSEOUT_20261027.md` | `9F1383C2E128C264A5B967E4FA0BFA13A8815E59BF627E022C0E67240E8C6789` | `9F1383C2E128C264A5B967E4FA0BFA13A8815E59BF627E022C0E67240E8C6789` | **True** | Closeout document |
| 11 | `docs\RC51_AUTHOR_READ_READINESS_REPAIR_REVIEW_20261027.md` | `F8CF023550F7E7ABE8C53D8CB17B8807A61F944F5A2CD8AE8F3C7A583A5E586A` | `F8CF023550F7E7ABE8C53D8CB17B8807A61F944F5A2CD8AE8F3C7A583A5E586A` | **True** | Review document |

---

## 4. 排他模式双监督器执行与报告数据

### 4.1 正常模式监督器 (`normal/run-normal.cjs`)
- **命令**: `Set-Location normal; node run-normal.cjs`
- **监督器执行耗时**: 1017ms，退出码 0
- **产物文件**:
  - `normal/normal-report.json`
  - `normal/normal-run.json`
- **关键数据**:
  - `totalCases`: 8
  - `passedCases`: 8
  - `allPassed`: true
  - `cleanupSuccessfulForAll`: true
  - `childCode`: 0

### 4.2 故障注入模式监督器 (`fault/run-fault.cjs`)
- **命令**: `Set-Location fault; node run-fault.cjs`
- **监督器执行耗时**: 979ms，退出码 0
- **产物文件**:
  - `fault/fault-report.json`
  - `fault/fault-run.json`
- **故障核验结果**:
  - `childCode`: 1
  - `expectedFailureConfirmed`: true
  - `case1Passed`: false
  - `case1CleanupSuccessful`: false
  - `case1Error`: `"AssertionError [ERR_ASSERTION]: Session must be verified closed\n\nfalse !== true"`
  - `isLogicFailureWithSuccessfulCleanup`: false
  - `specificCleanupFailureConfirmed`: true
  - `passedCases`: 7，`totalCases`: 8

---

## 5. 真实组件与底层 IO 替身边界

### 5.1 真实运行组件
1. **客户端引擎与 Effect**: candidate `client.js` 真实 `createWallpaperEngine` 状态机与真实 `AuthorSwitches` React effect 函数体回放；
2. **协议帧与图像**: 真实 24 字节大端 WHL1 魔数及小端格式二进制帧头，承载工坊 62,886 字节有效全标记 JPEG 图像包；
3. **真实接线与闭包**: 真实 `index.js` 导出的 `createWallpaperReadTarget` 与 `createWallpaperReadLifecycle`；
4. **后端核心服务**: 修复版 `session.js`、`author-properties-apply.js`、`author-properties-host.js`，运行真实 Node.js HTTP Server 与完整身份判定逻辑。

### 5.2 底层 IO 替身边界（不冒充完整端到端）
1. **原生二进制与进程执行**: `execCommand`（如 `Get-Process` 查启动时间）采用固定回调模拟，未调用外部 PowerShell/WMIC 进程；
2. **图形与窗口渲染**: `createImageBitmap`、`canvas.getContext('2d')` 采用底层尺寸与无损替身，未调用系统 DirectX/GPU 硬件渲染；
3. **桌面窗口捕获**: `--we-open`、`--window-find`、Win32 HWND 枚举采用会话替身，未依赖实际 Windows 桌面管理器或壁纸注入窗口。

---

## 6. 拟提升最少文件清单 (严格保持 4 个源码文件)

1. `src/wallpaper/session.js`
2. `src/wallpaper/author-properties-apply.js`
3. `src/wallpaper/author-properties-host.js`
4. `src/index.js`

**零包依赖变更、零资源文件变更、零前端 Client 变更、零 Native 二进制变更。**
