# P1B-2 首审补修交付：真实播放签名与状态契约、吸附端预览、图片服务安全与并发有界

日期：2026-10-19\
执行者：Antigravity (Pair Programming Assistant)\
依据规范：[P1B-2 首审复审报告](DETACHABLE_APPEARANCE_P1B2_REVIEW_20261019.md)、[P1B-2 任务说明书](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B2_20261019.md) 与 [AGENTS.md 检查与交付守则](../AGENTS.md)

---

## 1. 交付概述

本轮严格对照 Codex 首审复审报告（`docs/DETACHABLE_APPEARANCE_P1B2_REVIEW_20261019.md`）中的 13 项明确缺陷复现及验收标准，完成了 **R1 至 R6** 的全部定向修复与全量验证。

在保持此前已验收的 P1B-1、P1A 与 P0 全部成果零返工的前提下，重点闭合了以下核心问题：
1. **R1**：修复真实播放签名（`(string sceneId, string mode)`）；加入当前目标比对防御（`target-drift-or-mismatch`）；严格对接引擎错误状态（`state === 'error'` 产生外层 `ok: false`）；将 companion 的开始/停止/刷新纳入有序屏障队列与总截止期限（`actionTimeoutMs` + `AbortSignal`）。
2. **R2**：吸附端生产组件（`WhaleDockedAppearancePanel`）实装图片预览能力（渲染真实 `img` 节点）；修复 `readLibrary` 失败时快照回退丢失错误状态的问题，保留权威 `state: 'failed'` 与 `error`；增加类型、目录就绪与样例健康门禁。
3. **R3**：图库卡片与详情改用 Map 共享在途 Promise，消除首绘重复覆盖与空白；加入选择代次（`detailsEpoch`），彻底阻断反序网络回包错配；在 `disposeBlobUrls` 时标记 `isDisposed` 并中止在途请求，防止断开后迟到回包生成泄露的对象 URL；限制 Blob 缓存上限为 64 项。
4. **R4**：`/api/wallpaper-preview` 严格恢复实例隔离与代次校验（主端要求 `token + instanceId + generation + Origin`，吸附/独立端要求 `lease + strict integer generation`）；拒绝 query 凭证（400 `unsupported-query-auth`）与未知 query 参数（400 `unrecognized-parameter`）；`catalog.js` 在 `realpath` 前对原始逻辑路径执行 `noLinks` 校验并绑定 `project.json` 声明，彻底阻断根内/根外 junction 目录替换攻击。
5. **R5**：并发控制名额（`activePreviewReads`）严格绑定底层真实读 Promise 的 `finally` 阶段，避免超时或提前中断导致名额泄漏；在 8 个并发挂起时第 9 个请求严格返回 503；取消信号与计时器完整落定。
6. **R6**：重构并扩展 QA 验证矩阵，采用可解码 1x1 真实光栅图、真实生产组件挂载断言 `img`、真实 junction 替换负例断言、各认证/参数边界断言与严格签名断言，全部通过 `safe-qa-runner.mjs` 有界监督执行。

---

## 2. 关键文件 SHA-256 清单

### 2.1 生产源码文件

| 文件相对路径 | SHA-256 | 核心补修说明 |
|---|---|---|
| `dsh-whale-mist/src/client.js` | `5272B2C67EB62EA60F474ECB452719FFAF227A8421E77CDF79850E596D1F77CC` | 吸附面板渲染真实 preview img；readLibrary 失败保留状态；内联执行器对齐 R1 契约 |
| `dsh-whale-mist/src/detachable-contract.js` | `E71F7160291E8AD22528C314474FA14B288CEBD5F680D3DA64C47C232E3694BF` | 权威动作对齐 start(scene, mode)；目标漂移防御；状态 error 映射；快照保留 failed |
| `dsh-whale-mist/src/detachable-host.js` | `C6FA1CCB168D63112FFBE78F3B2B63EA5B9E5657442E0D3AB913937AAF9060FA` | 严格 header 认证与整数 generation；拒绝 query auth 与未知参数；并发额度仅在底层 resolve/reject 释放 |
| `dsh-whale-mist/src/companion/companion.js` | `CC483EF7046C45D5A53A3E217DE4DF8145BA3A35CF391C6A6C3B24F2F485FAC7` | Map 共享在途 Promise；detailsEpoch 防反序覆盖；dispose 标记与防迟到 URL；动作接入有序队列与截止 |
| `dsh-whale-mist/src/wallpaper/catalog.js` | `D225219FFF0892BC9FD759CDE6EBA9BB7E76B779398FEF424B8FBF22EFB1DE47` | realpath 前逻辑路径 noLinks 检查；绑定 project.json 声明验证；double-stat 比对 |
| `dsh-whale-mist/src/wallpaper/library.js` | `1B3F98E5D5DEDABCC57CB3F33A9CD28BB11E3A88511ADAADE25BEB7E8E7135B8` | 传递 AbortSignal 至 catalog 校验并透传取消 |

### 2.2 QA 测试与监督文件（`.tmp/detachable-p1b2-20261019-c7e2b10a/`）

| 文件相对路径 | SHA-256 | 说明 |
|---|---|---|
| `test-image-service.mjs` | `A63196B0EE9158461A69420921EDF3E9418FD333105025A9DFCA191604890F53` | 1x1 可解码图、junction 替换拦截、头认证/参数白名单、8 并发挂起 + 9th 503 验证 |
| `test-ui-components.mjs` | `1D14469204DD53A51C99237C3B4F7AB084B6CCD8AF5DE3E8C5E1FF13F17709BF` | 吸附端 3 个 img 渲染、失败快照保留、Map 共享 Promise、代次防错配、断开迟到防御、50ms 截止 |
| `test-sync-races.mjs` | `E6EDB9884E1B0B14E0107AFD2CEB6310AA6CC08D05202D631524D7D9640E7511` | 双执行器验证字符串签名、目标漂移拦截、引擎 error 状态传递、10 次快速切换 0 自动启动 |
| `safe-qa-runner.mjs` | `0128591FA1C8115FEA2B4ACAF83D98E3BBB2306D284E6BE95E5EC9B17B34B66A` | 已经六审验证的消除汇总竞态、超时单次锁定的子进程监督器 |
| `run-p1b2-qa.mjs` | `3446D647E326E2DC6EBE11F68A42BF5C9341EC129DEE9C67DD34BC8E7BDD2862` | 监督串行执行器，硬超时 15 秒 |

---

## 3. R1–R6 修复细节逐项说明

### R1：真实播放签名与状态契约、目标漂移防御、有序队列与截止
- **签名修复**：真实引擎 `createWallpaperEngine.start(scene, mode)` 接收两个字符串参数。修复了此前传递 `{ scene, mode }` 对象的错误，在 `detachable-contract.js` 与 `client.js` 统一传递 `(action.sceneId, currentMode)`。
- **目标漂移防御**：在调用引擎前严格核对 `action.sceneId === currentSelectedScene`。若当前设置中选中的不是该壁纸，立即拒绝并返回 `target-drift-or-mismatch`，绝不进入真实 start 流程。
- **状态契约对齐**：检查引擎返回的 `startRes`，当 `startRes.ok === false || startRes.state === 'error' || startRes.state === 'cleanup-failed'` 时，权威动作外层明确判定为 `ok: false` 并返回实际错误，不虚报成功或活动 ID。
- **队列与截止**：`companion.js` 中的 `startWallpaper`、`stopWallpaper`、`refreshCatalog` 彻底接入 `actionQueue` 序列化队列，支持绝对截止时间 `actionTimeoutMs` 与 `AbortController` 信号传递，与选择、预设动作具备统一的屏障行为。

### R2：吸附端真实预览与目录失败状态保留
- **吸附端真实渲染**：在 `client.js` 的 `WhaleDockedAppearancePanel` 中，紧凑卡片列表与详情区域均添加了带安全同源认证 URL 的 `img` 节点及平滑 fallback 占位，在虚拟 DOM 树中成功断言产生 3 个 `img` 节点。
- **目录失败状态保留**：修复了 `readLibrary` 在网络失败或异常时丢失 `state: 'failed'` 与 `error` 的缺陷。失败结果直接存入 `librarySnapshot`，`buildAppearanceSnapshot` 忠实呈现 `catalog.state: 'failed'` 与真实错误信息，不再伪造可用 Lucy。
- **门禁严格化**：卡片与详情对非 `scene` 类型、未配置、目录未就绪或未通过样例健康检查的项明确标记为不可用，吸附端与独立端在不可用卡片点击行为上保持严格一致（仅浏览不可启动）。

### R3：Map 共享在途 Promise、代次隔离与销毁防护
- **Promise 共享**：在 `companion.js` 中将 `inFlightBlobs` 由 Set 改为 Map，存储 `{ promise, abortCtrl, timer, callbacks }`。首次请求不仅发起读取，更允许卡片与详情同时 await 相同的 Promise，图像返回时一并唤醒并挂载，消除首绘重复覆盖导致的空白卡片。
- **代次防护（detailsEpoch）**：引入自增的 `detailsEpoch`。详情页发起的预览请求绑定当前代次，当用户连续选择 X 后切至 Y 时，若 X 迟到回包，比对代次不匹配直接作废，绝不覆盖当前选中的 Y。
- **销毁与清理**：`disposeBlobUrls()` 立即设置 `isDisposed = true`，中止所有在途 `abortCtrl`，清除所有计时器并撤销全部已创建的 Object URL。已销毁状态下迟到返回的二进制数据严禁创建新 URL，防止内存泄漏。
- **容量上限**：`MAX_BLOB_URLS` 严格限制为 64，超出时采用 FIFO 释放旧 URL。

### R4：图片路由会话隔离、参数白名单与防 Junction 篡改
- **Header 严格认证**：主端图片读取要求传递 `X-Whale-Main-Token`、`X-Whale-Instance-Id`、严格正整数 `X-Whale-Generation` 以及同源或已准许的 Origin；吸附/独立端要求传递有效 `X-Whale-Lease` 与严格正整数 `X-Whale-Generation`。缺少、伪造或非整数代次均返回 403/401。
- **Query 严格白名单**：URL 查询参数仅允许 `?id=<we-scene-id>` 单一参数。任何包含 `token`、`lease` 的凭证查询返回 400 `unsupported-query-auth`；包含未知参数（如 `path`、`kind`）返回 400 `unrecognized-parameter`。
- **Junction 逐级检验与声明比对**：在 `catalog.js` 中，路径逐级 `noLinks` 检查移至 `realpath` 之前，确保在解析前截获路径各级组件的 symlink/junction；将解析后的物理路径与对应条目的 `project.json` 中声明的 `preview` 字段物理路径进行强一致性校验；结合 open handle 的 double-stat 比对，彻底阻断利用根内/根外 junction 替换冒充壁纸的攻击。

### R5：并发控制名额真实落定与取消传播
- **底层 Promise 绑定**：在 `detachable-host.js` 中，`activePreviewReads--` 计数器**仅且仅在**底层 `library.getPreview` 真实 settle 的 `finally` 阶段触发，绝不在上层 `Promise.race` 3秒超时时提前递减。
- **硬并发上限**：当已有 8 个请求挂起在底层 IO 时，第 9 个并发请求立即返回 503 `preview-concurrency-limit-exceeded`，底层挂起数严格保持 `<= 8`。
- **取消信号传播**：客户端断开或超时均触发 `abortCtrl.abort()`，传播至底层读取流；超时计时器在 finally 中可靠清除。

### R6：QA 验证覆盖与有界证据闭环
- **真实光栅小图**：替换了随意填充的 Dummy Buffer，改用标准 RFC 可解码的真实 1x1 PNG 与 JPEG base64 数据。
- **负例转换为针对修复后的正向断言**：针对 R1–R5 发现的 13 项复现缺陷，全部建立防御成功、返回预定错误码与拦截状态的强断言。
- **有界执行**：三组 QA 均由 `safe-qa-runner.mjs` 在独立 worker 进程中监督执行，设有硬截止时间，并在内部网络 IO 中使用 `agent: false` 保证 Windows libuv socket 干净释放，无挂起、无资源残留。

---

## 4. 验证执行记录

### 4.1 语法守卫与 CSS 模板检查（`npm.cmd run check`）

```text
> dsh-whale-mist@0.6.0-rc.30 check
> node --check src/index.js && node --check src/client.js && node --check src/detachable-contract.js && node --check src/detachable-bridge.js && node --check src/detachable-host.js && node --check src/detachable-edge-adapter.js && node --check src/companion/companion.js && node --check src/wallpaper/session.js && node --check src/wallpaper/scenes.js && node --check src/wallpaper/catalog.js && node --check src/wallpaper/library.js && node qa/css-template-guard.mjs

css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
```
- **退出码**：`0`
- **耗时**：约 1.8 秒

### 4.2 监督式有界 QA 测试套件（`node run-p1b2-qa.mjs`）

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
[PASS] Test 1: Image Service Security & Bounds (code 0, 477ms)

>>> Running Test 2: Companion & Docked Panel UI...
[Test 2] Starting Companion & Docked Panel UI QA...
[Test 2.1] Production Docked Appearance Panel Verification (R2)...
✓ Docked appearance panel renders 3 preview img elements (R2 resolved)
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
[PASS] Test 2: Companion & Docked Panel UI (code 0, 346ms)

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
[PASS] Test 3: Synchronization, Racing & Zero Auto-Play (code 0, 106ms)

====================================================
                 QA Suite Summary
====================================================
- Test 1: Image Service Security & Bounds: PASSED (code=0, timedOut=false, 477ms)
- Test 2: Companion & Docked Panel UI: PASSED (code=0, timedOut=false, 346ms)
- Test 3: Synchronization, Racing & Zero Auto-Play: PASSED (code=0, timedOut=false, 106ms)
====================================================

All P1B-2 QA Tests Passed Successfully!
```
- **退出码**：`0`
- **总耗时**：约 930 毫秒
- **超时状态**：`timedOut: false`（3/3 全部在 500ms 内有界退出）

---

## 5. 现场边界与安全性保证

1. **基线与资产完整性**：
   - 生产环境中受保护的 42 项 `assets/` 与 `.tgz` 包保持完全一致，哈希未改变。
   - `package.json` 版本号（`0.6.0-rc.30`）与依赖保持不变。
   - 工作区历史脏改动完整保留。
2. **进程与系统安全**：
   - 全程未启动全局杀进程命令（无 `taskkill /F /IM node.exe` 或 Edge 相关操作）。
   - 未触碰日常运行的 DSH（0.2.1-rc.2/rc.35）及 Wallpaper Engine 主进程。
   - 测试脚本完全受控于有界超时监督器，所有 HTTP 监听与文件句柄在退出前均经过 `close` 与 `finally` 阶段落定，无遗留后台任务。
3. **交付状态**：
   - 本轮代码已完成全部离线实现与自动化自测，现提交等待 Codex 独立复审。
