# P1B-2 四审补修交付报告：异步分级查询边界收口（U1/U2）

日期：2026-10-19\
执行者：Antigravity (Pair Programming Assistant)\
依据规范：
1. [P1B-2 四审复审报告](DETACHABLE_APPEARANCE_P1B2_FOURTH_REVIEW_20261019.md)（U1–U2 异步边界与超时/并发/竞态验收要求）
2. [P1B-2 三审补修交付报告](DETACHABLE_APPEARANCE_P1B2_THIRD_REPAIR_DELIVERY_20261019.md)（T1–T3 及 T4 真实浏览器证据保持）
3. [P1B-2 年龄分级需求增补](DETACHABLE_APPEARANCE_P1B2_AGE_FILTER_ADDENDUM_20261019.md)
4. [AGENTS.md 检查与交付守则](../AGENTS.md)

---

## 1. 交付概述

本轮严格遵照 Codex 四审报告指示，**仅定向解决 U1 与 U2 异步分级查询边界缺陷**。在既往已通过的功能成果（S1 停止状态契约、S2 图片认证/CORS、S3 生命周期与瞬切、S4 跨实例复核、T1–T3 分级在途与代次隔离、T4 真实 Edge Headless 光栅解码，以及 P0/P1A 20 项基线）完全保持的前提下，完成了定向补修与验证，未推倒重做已有功能，未重跑无关历史长矩阵，42 项冻结受保护资产保持哈希完全一致。

### 1.1 U1 / P1：分级查询纳入总超时控制与全生命周期并发占位保护

- **根因分析**：
  原 `/api/wallpaper-preview` 路由中，首次 `library.resolvePreviewRating` 在并发上限检查（8路）与 3000ms 超时定时器启动**之前**执行；最终 `library.resolvePreviewRating` 在 `Promise.race([underlyingReadPromise, timeoutPromise])` 结束**之后**执行，且 `activePreviewReads--` 仅绑定在 `underlyingReadPromise` 完成时。
  这导致：
  1. 第 9 个并发请求在进入首次 metadata 查询时未被拦截，导致 9 个磁盘查询均已进入底层；
  2. 首次与最终 metadata 查询不受 3000ms 单一总请求期限约束；
  3. 若图片 IO 超时触发 503，槽位提前释放，可能引发新请求竞争导致真实底层在途 IO 超过 8 路。
- **定向修复**：
  - **并发门禁前置**：在 `/api/wallpaper-preview` 进入时，先校验 `activePreviewReads >= MAX_CONCURRENT_PREVIEW_READS`（8）。第 9 个并发请求**立即返回 503 `preview-concurrency-limit-exceeded`，严格不进入首次 metadata 查询，底层图片 IO 严格为 0**。
  - **全流程单一总期限（3000ms）**：自请求入场起创建单一 `timeoutPromise` 与绑定统一 `abortCtrl`，不再分段重新计满 3 秒。
  - **物理 IO 占位真锁定**：将首次 metadata 查询、图片读取、最终 metadata 复核封装进单一异步流水线 `pipelinePromise`，并发占位释放 `activePreviewReads--` **严格绑定在 `pipelinePromise.finally(...)`**。即使 HTTP 请求因 3000ms 超时提前向客户端写入 503，该底层槽位仍持续占有，直到物理 IO 真实 settled 释放，彻底阻断慢盘超时泄露与无限堆积。
  - **超时与取消截断**：请求一旦超时或被客户端 abort，不再调用后续图片读取或二次分级查询，禁止超时后迟到写 200。

### 1.2 U2 / P1：异步 Await 悬挂点权限与会话复核，消除竞态窗口

- **根因分析**：
  在异步读图流水线中，每次 `await` 都会导致执行线程出让。在 `await` 挂起期间，主端可能下发分级收紧命令（如 Mature -> Everyone）或由新主端实例发起 `/api/main/connect`（实例代次更替）。若 `await` 恢复后直接沿用入场时的权限或会话快照，将造成旧权限/旧实例请求违规返回。
- **定向修复**：
  - **Stage 1（首次 metadata await）后复核**：
    首次磁盘分级查询完成后，立即重新调用 `verifyCurrentSession(req)` 检查会话/代次有效性，并调用 `getCurrentAllowedRatings()` 获取当前最新权威分级偏好。若在挂起期间策略已收紧（例如取消 Mature），直接返回 403 `preview-rating-filtered`，**严禁进入后续 `library.getPreview`，底层图片读取次数严格保持为 0**。
  - **Stage 2（图片 IO await）后复核**：
    图片字节读取完成后，立即再次复核当前会话与最新允许分级列表。若挂起期间会话被替身或分级收紧，立即中断流水线。
  - **Stage 3（最终 metadata await）后复核**：
    最终磁盘分级复核完成后，再次重新验证当前会话与最新允许分级列表。若此时发现分级不再被许可，立即返回 403 并丢弃已读图片缓存，**严格不发送图片字节**；若发现主端 instance 已被替换，立即返回 403 `session-invalidated-during-read`。
  - **无缝写出保障**：
    从最终同步复核通过到执行 `res.writeHead(...)` / `res.end(...)` 之间，**不插入任何 `await` 或异步定时器**，确保检查结果与写出响应处于同一同步微任务中，彻底闭合时间差竞态窗口。

---

## 2. 关键文件 SHA-256 清单

### 2.1 生产源码文件（6 项核心源码）

| 文件相对路径 | SHA-256 | 补修与职责说明 |
|---|---|---|
| `dsh-whale-mist/src/detachable-host.js` | `910814C8937A86DB20990162E6F55FB5100289F82737F464518402EB9932AF10` | U1 8路并发门禁前置、统一3s期限、pipeline.finally真锁定；U2 每次await后会话/分级重核、writeHead前零await |
| `dsh-whale-mist/src/wallpaper/catalog.js` | `56EC5C6B25120446FD66E74142E775C461ECB6BA05B6EC6875504BF921E4EC61` | 保持 verifyCatalogItemRating / verifyCatalogPreview，支持传递 signal 快速响应 abort |
| `dsh-whale-mist/src/wallpaper/library.js` | `598624207BE6AF7DD30A91AFE0400CF7AC1BD65A9CC4EE2EB351CEEABF6E5DAE` | resolvePreviewRating 透传 options.signal 到 catalog 核验层 |
| `dsh-whale-mist/src/detachable-contract.js` | `5F1BD327FEDA0B835FACFD40C14C07E809E615422E8E64187CB0B9709DBCB2D7` | 保持 parseAgeRatings 全白名单、损坏回退 Everyone、动作严格校验（四审确认保持） |
| `dsh-whale-mist/src/client.js` | `3EF3F9618B1FEE79E219DCEEFFEEDC4F3EE8C5A9346554A6E9ED45D762DC9D05` | 保持 isValidSetting 与 normalizeSettings 白名单与安全回退（四审确认保持） |
| `dsh-whale-mist/src/companion/companion.js` | `046A07957807BB8E1C8A03EA1A85B8F2C360E4FBA7E156EA38BA989841F0C0DE` | 保持 inFlightBlobs 独立遍历 abort、三 Epoch 隔离与 finally 实例保护（四审确认保持） |

### 2.2 QA 测试套件（`.tmp/detachable-p1b2-20261019-c7e2b10a/`）

| 文件相对路径 | SHA-256 | 验证范围说明 |
|---|---|---|
| `test-u1-u2.mjs` | `E4A1D3CD1A28FACEFC591B0AE8DA13CD661817DC16C651C2F79F4BBF19E29B54` | 定向验证 U1.1（第9个503前置/超时后槽位锁定）、U1.2（最终metadata超时）、U2.1/U2.2/U2.3（三种await竞态）及合法200回归 |
| `run-p1b2-qa.mjs` | `84AE9A00DB276EFBFEED20C6D70EC46E8036FB3F036021E63EC377817C3DCA26` | 统一监督运行器，调度 Test 1–5 并受 30s 总期限与有界清理保护 |
| `test-s1-s4-age-filters.mjs` | `C83E2F100E00D148B9B8A2BDB4D0AC7D551DE96939FEF150B24F95C3BBFD49BF` | 覆盖 S1–S4、年龄分级以及 T1–T3 所有定向用例（四审已通过） |
| `real-browser.mjs` | `5C5A1A84A99A6D433BDEA020EC1100B34DB3BE1FB70178FA6A02E3007771CED5` | T4 真实 Edge Headless + React 19 生产组件 + 认证 HTTP 桥接端到端光栅解码（四审已通过） |

---

## 3. 验证执行记录

### 3.1 语法守卫与 CSS 模板检查（`npm.cmd run check`）

```text
> dsh-whale-mist@0.6.0-rc.30 check
> node --check src/index.js && node --check src/client.js && node --check src/detachable-contract.js && node --check src/detachable-bridge.js && node --check src/detachable-host.js && node --check src/detachable-edge-adapter.js && node --check src/companion/companion.js && node --check src/wallpaper/session.js && node --check src/wallpaper/scenes.js && node --check src/wallpaper/catalog.js && node --check src/wallpaper/library.js && node qa/css-template-guard.mjs

css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
```
- **退出码**：`0`
- **耗时**：约 2.3 秒

### 3.2 U1 & U2 专项定向验证（`node test-u1-u2.mjs`）

```text
====================================================
   P1B-2 U1 & U2 Directed Verification Suite
====================================================

>>> [Section U1.1] 9th request concurrency gate before metadata IO & slot retention on timeout...
  - Sending 9 concurrent requests...
  - Request 9 response: 503 preview-concurrency-limit-exceeded (IO called: false)
  - Waiting for 8 requests to timeout at 3000ms...
  - 8 requests timed out with 503 preview-read-timeout
  - Slot retention check: Sending request 10 while delayed IO still active...
  - Request 10 response: 503 preview-concurrency-limit-exceeded
  - Releasing delayed IO...
  - Slot restored check: Sending request 11...
  - Request 11 succeeded with 200
✓ Section U1.1 verified: Concurrency gate precedes metadata IO, 9th rejected, slot held during timeout until settle, then restored

>>> [Section U1.2] Final metadata resolution timeout bounded at 3000ms...
  - Sending request with delayed final metadata...
  - Response received in 3014ms: 503 preview-read-timeout
✓ Section U1.2 verified: Final metadata resolution bounded by 3000ms overall request timeout

>>> [Section U2.1] Permission race: Rating tightened during Stage 1 metadata query...
  - Sending request for Mature item...
  - Tightening allowed ratings to ['Everyone'] during Stage 1 metadata query...
  - Releasing Stage 1 metadata...
  - Response: 403 preview-rating-filtered
  - Underlying image read calls: 0
✓ Section U2.1 verified: Rating tightened during Stage 1 metadata returns 403, underlying image reads strictly 0

>>> [Section U2.2] Permission race: Rating tightened during Stage 3 final metadata query...
  - Sending request for Mature item...
  - Tightening allowed ratings to ['Everyone'] during Stage 3 metadata query...
  - Releasing Stage 3 metadata...
  - Response: 403 preview-rating-filtered
  - Bytes sent: 0
✓ Section U2.2 verified: Rating tightened during Stage 3 metadata returns 403 without sending image bytes

>>> [Section U2.3] Session race: Main instance replaced during Stage 3 final metadata query...
  - Sending request for item with instance A...
  - Connecting instance B during Stage 3 metadata query...
  - Releasing Stage 3 metadata...
  - Response: 403 session-invalidated-during-read
✓ Section U2.3 verified: Instance replaced during Stage 3 metadata returns 403 session-invalidated-during-read

>>> [Section Regression] Legitimate 200 request succeeds...
  - Response: 200 image/png (123 bytes)
✓ Section Regression verified: Normal legitimate preview returns 200 with valid binary image

====================================================
   ALL U1 & U2 DIRECTED TESTS PASSED!
====================================================
```
- **退出码**：`0`
- **耗时**：约 10.4 秒

### 3.3 全量监督 QA 套件（`node run-p1b2-qa.mjs`）

```text
====================================================
   P1B-2 Detachable Appearance Bounded QA Suite
====================================================

>>> Running Test 1: Image Service Security & Bounds...
[Test 1] Starting Image Service Security & Bounds QA...
✓ Created test fixture files
[Test 1.1] verifyCatalogPreview Direct Unit Tests...
✓ verifyCatalogPreview direct unit tests passed
[Test 1.2] createWallpaperLibrary getPreview Integration...
[Test 1.2e] Junction retargeting within approved root must be rejected...
✓ Junction retargeting within root rejected successfully
[Test 1.3] HTTP Host /api/wallpaper-preview Security & Bounds...
✓ HTTP Host image preview endpoint security tests passed
[Test 1.4] Concurrency limits: 8 in-flight max, 9th returns 503...
✓ Concurrency bounds (8 max, 9th 503, no slot leak) verified
=== [Test 1] All Image Service Tests Passed Successfully ===
[PASS] Test 1: Image Service Security & Bounds (code 0, 484ms)

>>> Running Test 2: Companion & Docked Panel UI...
[Test 2] Starting Companion & Docked Panel UI QA...
[Test 2.1] Production Docked Appearance Panel Verification (R2)...
✓ Docked appearance panel renders 2 preview img elements (R2 resolved)
[Test 2.2] Library failure snapshot preservation (R2)...
✓ Snapshot retains failed library state and error without optimistic fallback
[Test 2.3] Companion App initialization & token scrub...
✓ Token scrubbed from address bar
[Test 2.4] Shared in-flight preview promise for cards and details (R3)...
✓ Cards and details share in-flight preview Promise without blank screens
[Test 2.5] Wide vs Narrow view switcher...
✓ Tab switcher & back navigation verified
[Test 2.6] Card selection vs playback decoupling...
✓ Card click decoupled from playback (zero auto-play actions)
[Test 2.7] Details view, mismatch banner & playback actions...
✓ Explicit start and stop actions verified
[Test 2.8] Selection race: late arrival does not overwrite newer selection (R3)...
✓ Epoch protection prevents late preview arrival from overwriting current selection
[Test 2.9] Disconnect / dispose stops late URL creation (R3)...
✓ Disposed app ignores late arrivals without leaking object URLs
[Test 2.10] Companion start action respects 50ms action deadline (R1)...
✓ Start action settled within deadline (settled-ok)
=== [Test 2] All UI Components Tests Passed Successfully ===
[PASS] Test 2: Companion & Docked Panel UI (code 0, 362ms)

>>> Running Test 3: Synchronization, Racing & Zero Auto-Play...
[Test 3] Starting Synchronization, Racing & Zero Auto-Play QA...
[Test 3.1] Testing R1 signature, target drift & error contracts with module executor...
✓ module executor passed R1 engine signature, target drift and error checks
[Test 3.1] Testing R1 signature, target drift & error contracts with inline executor...
✓ inline executor passed R1 engine signature, target drift and error checks
[Test 3.2] Playing A while selecting B...
✓ Snapshot correctly reflects playing A while B selected with mismatch error
✓ Presets strictly gated by presetTarget during mismatch
[Test 3.3] Explicit Stop and Start SCENE_B...
✓ Stopped wallpaper cleanly and started selected SCENE_B
[Test 3.4] Rapid selection switching & Zero Auto-Play verification...
✓ Verified: Rapid selection switching resulted in EXACTLY 0 automatic starts or restarts
=== [Test 3] All Synchronization & Race Tests Passed Successfully ===
[PASS] Test 3: Synchronization, Racing & Zero Auto-Play (code 0, 114ms)

>>> Running Test 4: S1–S4 Repairs & Age Filter (T1–T3 Directed Verification)...
====================================================
   P1B-2 S1–S4 Repairs & Age Filter QA Suite
====================================================
...
[PASS] Test 4: S1–S4 Repairs & Age Filter (T1–T3 Directed Verification) (code 0, 687ms)

>>> Running Test 5: U1 & U2 Directed Verification...
====================================================
   P1B-2 U1 & U2 Directed Verification Suite
====================================================
...
[PASS] Test 5: U1 & U2 Directed Verification (code 0, 10412ms)

====================================================
                 QA Suite Summary
====================================================
- Test 1: Image Service Security & Bounds: PASSED (code=0, timedOut=false, 484ms)
- Test 2: Companion & Docked Panel UI: PASSED (code=0, timedOut=false, 362ms)
- Test 3: Synchronization, Racing & Zero Auto-Play: PASSED (code=0, timedOut=false, 114ms)
- Test 4: S1–S4 Repairs & Age Filter (T1–T3 Directed Verification): PASSED (code=0, timedOut=false, 687ms)
- Test 5: U1 & U2 Directed Verification: PASSED (code=0, timedOut=false, 10412ms)
====================================================

All P1B-2 QA Tests Passed Successfully!
```
- **退出码**：`0`
- **总耗时**：约 12.2 秒

### 3.4 真实浏览器光栅解码（`node real-browser.mjs`）

- **退出码**：`0`
- **耗时**：约 2.8 秒
- **真实光栅结果**：
  1. Everyone 默认：两张图片均为真实 `complete: true`、`width: 1`、`src: blob:`，错误 0，容器无横向溢出。
  2. 全不选空值：图片 0，卡片 0，显示隐藏提示，新增读图 0。
  3. 选入 Mature：解码 3 张图片（width: 1），包含无害 Mature 夹具。
  4. 进程与服务完全退出，Profile 安全保留在证据目录。

---

## 4. 缺陷闭环对照表

| 缺陷编号 | 缺陷现象与复现边界 | 核心修复机制 | 验收结果 |
|---|---|---|---|
| **U1** | 首次 metadata 在 8 路门禁和 3s 超时前，9 路并发时 9 个 metadata 均进入；最终 metadata 在超时 race 之后且提前释放占位；超时后底层慢盘可能堆积并发。 | 1. 8 路并发门禁置于入口第一行，第 9 个直接 503 且不入 metadata/图片 IO；<br>2. 全流水线受单一 3000ms 总期限约束；<br>3. 占位释放绑定 `pipelinePromise.finally`，超时后未 settle 保持占位，真实 settle 后恢复槽位。 | **已闭环**。第 9 个请求 503 且 0 IO；8 个请求在 3000ms 处 503 超时；延迟 IO 期间第 10 个请求 503；释放后第 11 个请求 200；最终 metadata 超时在 3014ms 有界返回 503。 |
| **U2** | 首次 metadata 查询期间取消 Mature，最后 403 但已读 1 次图片；最终 metadata 查询期间取消 Mature 仍 200；最终 metadata 查询期间主端换 instance 仍 200。 | 1. 首次 metadata await 之后重新核对会话与允许分级，未授权立即 403 且图片读取为 0；<br>2. 最终 metadata await 之后重新核对会话与允许分级，策略收紧立即 403 且 0 字节发送；<br>3. 最终核对主端 instance 变更立即 403 会话失效；<br>4. 最终核验与 `writeHead/end` 之间零 await。 | **已闭环**。首次查询取消 Mature 返回 403 且图片读取严格为 0；最终查询取消 Mature 返回 403 且发送字节 0；最终查询登记新 instance 返回 403 `session-invalidated-during-read`；合法请求 200 正常返回。 |

---

## 5. 证据边界与替身说明

1. **真实 HTTP Host 与真实文件读取**：
   `test-u1-u2.mjs` 启动真实的 `createDetachableHost` HTTP 服务与真实本地文件目录，HTTP 请求经实际端口与 `http.request` 传输，非函数式模拟。
2. **延迟受控 IO 替身**：
   为确凿复现慢盘和异步挂起，测试仅在 `library.resolvePreviewRating` 和 `library.getPreview` 的完成边界注入 Promise 挂起屏障，验证超时中断、槽位锁定与权限竞态。其余路径均为生产真实代码。
3. **真实浏览器光栅解码**：
   在 `real-browser.mjs` 中，由无头 Edge 浏览器（CDP）运行真实的 React 19.2 渲染器与生产 `WhaleDockedAppearancePanel` 组件，测量实际 `naturalWidth: 1`。

---

## 6. 受保护资产与环境约束声明

1. **版本与清单冻结**：
   - 工作区 `dsh-whale-mist` 保持 `0.6.0-rc.30`，未打包、未安装、未发布。
   - 日常环境 DSH `0.2.1-rc.2 / rc.35` 与 Git Bash `0.1.1` 保持完全冻结，未操作日常 Profile、未重启或终止 DSH/WE 进程。
2. **零模型 API 请求**：所有修复与 QA 验证均在离线隔离测试目录下完成，未发起任何外部 AI 模型请求。
3. **保护现有脏改动**：工作区内已有各专项改动（包括 P0/P1A/P1B1 交付与复审记录、A 卷低优先级调查、B 卷等）完全保留，未执行 `git clean` 或强制覆盖。
4. **测试资源与进程清理**：测试启动的 HTTP 服务在 `finally` 阶段调用 `server.close()` 并在 1.0 秒内确认关闭，无残留后台监听端口。
5. **状态维持**：三体/GPU 任务暂停，定时保持 PAUSED。

---

**交付结论**：P1B-2 第四轮补修（U1、U2）已全部完成并通过独立定向验证。依据指令，本轮工作在此停下，等待 Codex 复审。


## Codex独立复审补注（2026-10-19）

[五审源码离线通过](DETACHABLE_APPEARANCE_P1B2_FIFTH_REVIEW_20261019.md)。本交付原示意摘录中的并发错误名和30秒总期限描述以五审勘误及冻结实际脚本/原始日志为准；源码通过不等于实机验收，不为措辞启动新一轮实现/测试。
