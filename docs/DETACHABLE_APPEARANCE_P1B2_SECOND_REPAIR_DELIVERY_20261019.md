# P1B-2 二审补修与年龄分级筛选交付报告

日期：2026-10-19\
执行者：Antigravity (Pair Programming Assistant)\
依据规范：
1. [P1B-2 二审复审报告](DETACHABLE_APPEARANCE_P1B2_SECOND_REVIEW_20261019.md)（S1–S4 缺陷复现与最小验收）
2. [P1B-2 年龄分级筛选需求增补](DETACHABLE_APPEARANCE_P1B2_AGE_FILTER_ADDENDUM_20261019.md)（Lucy 字段证据、三级独立勾选、读图前拦截、两端同步）
3. [AGENTS.md 检查与交付守则](../AGENTS.md)

---

## 1. 交付概述

本轮严格遵照 Codex 二审报告与用户追加的年龄分级筛选需求，在保持首审通过项、P0/P1A 20项及 42 项冻结受保护资产零破坏、零返工的前提下，完成了 **S1 至 S4** 缺陷的定向补修与**年龄分级独立筛选增量**的完整闭环开发与 QA 验收。

### 1.1 S1–S4 核心缺陷补修
1. **S1 / P1：真实引擎停止状态契约与两端执行/界面门禁统一**
   - 真实 `engine.stop('user')` 清理确认后落定为 `state: 'stopped', cleanupPending: false`（并不变回 `idle`）。
   - 修复了 `detachable-contract.js`、`client.js`（模块与内联执行器、吸附端面板）及 `companion.js`（详情视图）的开始播放门禁：将仅允许 `idle` 修正为允许已完成清理的可开始状态集合 `['idle', 'stopped', 'error']`，并严格限制 `!cleanupPending && wpState !== 'cleanup-failed' && activeSceneId == null`。
   - 验证了「开始 A → 正常停止 → 再次开始 A/B」、「重复停止」、「失败恢复」全流程，彻底消除了正常停止后因停留在 `stopped` 状态导致开始壁纸被拒绝的问题。

2. **S2 / P1：吸附端真实图片认证、Origin/CORS 允许与光栅解码闭环**
   - 修复了此前吸附面板直接在 `img.src` 填写相对 `/api/wallpaper-preview` 裸 URL 导致 401 认证失败及丢失端口的问题；坚决不在 URL 中暴露令牌。
   - 桥接客户端暴露 `fetchPreviewBlob(sceneId, { signal })`，携带受限 Header 凭证（`X-Whale-Main-Token`、`X-Whale-Instance-Id`、`X-Whale-Generation`）请求目标 Host 端口，将返回的图像数据转换为局部生命周期受控的 `blob:` URL。
   - `detachable-host.js` 修复外层 Origin 守卫 `isAllowedOrigin`，支持 `dsh-app://app` 与配置的 `mainAllowedOrigins` 访问 `/api/wallpaper-preview`；在预检 OPTIONS 的 `Access-Control-Allow-Headers` 中完整包含 `X-Whale-Instance-Id`。
   - 生产组件挂载真实 1x1 光栅图，断言 `img.complete && naturalWidth > 0`，验证解码成功及无图时的 fallback 占位。

3. **S3 / P1：断线独立失效、目录版本刷新缓存失效、即时切图占位与解码降级**
   - 区分“连接断开”与“组件销毁”：在 `companion.js` 中新增 `cleanupBlobsOnDisconnect()`。即便未显式调用 `dispose()`，仅断线（`disconnect`）时立即中止在途请求、清空 DOM 图片节点、重置占位并释放已建立的 Blob URL；迟到回包因处于断开态被安全丢弃，绝不创建新 URL。
   - 目录版本联动：监听快照中 `catalog.scannedAt`。当扫描时间戳变化时，清空历史 Blob 缓存并递增详情代次 `detailsEpoch`，确保同 ID 换图场景下刷新能获取最新图像。
   - 即时切图占位：在选择发生变化时，立即重置 `detailsPreviewImg.src = ''`、隐藏图片并展示占位，彻底消除等待回包期间旧图配新标题的视觉错配。
   - 解码错误降级：实装 `img.onerror` 事件监听，图片解码失败时自动隐藏图片、回滚并显示错误提示占位，不引起运行时崩溃。

4. **S4 / P1：异步读图后半程会话有效性复核与跨实例隔离**
   - 在 `detachable-host.js` 的 `/api/wallpaper-preview` 处理流程中，请求入场时绑定所属的 `main` 会话（`instanceId`、`generation`）或 `companion` 租约（`leaseId`、`generation`）。
   - 在底层 `library.getPreview` 真实 settle 之后、向客户端写入 200 Header 及图片字节之前，强制复核该请求绑定的会话在 Host 中是否依然处于活跃且未被新实例替换。
   - 验证了「合法 gen1 读图挂起 → main 重新连接升级为 gen2 → 底层 IO 返回」场景：旧请求被拦截并返回 403 `session-invalidated-during-read`，并发名额安全在底层 settled 后释放，绝不把图片发送给已失效的旧实例。

### 1.2 年龄分级独立筛选增量（Age Rating Filter Addendum）
1. **真实 Wallpaper Engine 元数据确认**
   - 检查真实 Lucy `project.json`（`E:\SteamLibrary\steamapps\workshop\content\431960\3521337568\project.json`），证据确凿：第 3 行为 `"contentrating": "Everyone"`。
   - 规范 Wallpaper Engine 官方三个分级值：`'Everyone'`、`'Questionable'`、`'Mature'`；缺失、损坏或非法的字段一律严格规范化为 `'unknown'`。
2. **权威偏好设置与两端同步**
   - 在权威设置白名单中增加 `weAgeRatings`（允许值由三个分级以逗号组合，如 `'Everyone,Questionable'`，默认值 `'Everyone'`；全不选空字符串 `""` 属于合法设置；损坏或空值安全回退到 `'Everyone'`）。
   - `detachable-contract.js` 提供 `parseAgeRatings` 与 `formatAgeRatings`，确保分级数组规范化排序与去重。
   - 吸附端 `WhaleDockedAppearancePanel` 与独立端 `companion` 均提供三个独立的复选框（所有人 Everyone / 敏感内容 Questionable / 成人内容 Mature），互不干扰，支持任意 0~3 项组合，两端设置通过权威快照毫秒级双向同步。
3. **读图前严格门禁（Zero Pre-Fetch / Zero Read）**
   - 过滤逻辑发生于任何网络请求与磁盘读取之前：未勾选类别的项目在吸附端和 companion 均不渲染图片节点、不发起 `fetch`、不占用 Host 底层读图并发、不创建 Blob URL。
   - 未标注/缺失分级的 `'unknown'` 项目默认归入隐藏，不乐观假定为 `'Everyone'`。
   - Host 侧防御：`/api/wallpaper-preview` 结合权威 `weAgeRatings` 进行入场校验，若请求的项目分级未被允许，直接返回 403 `preview-rating-filtered`，**底层磁盘读取次数严格保持为 0**；在读图 settle 之后再次校验分级，防御读取期间用户收紧筛选的竞态。
4. **筛选收紧与选中隐藏状态保护**
   - 当用户在两端收紧筛选取消勾选时，已缓存的不可见条目 Blob URL 立即撤销，正在进行的在途请求立即 abort，详情页如果属于被隐藏项目则立即清空图片并切换为文字提示 `已被年龄分级筛选隐藏`。
   - 当当前选中/正在播放的壁纸被筛选隐藏时：**不自动切换壁纸、不自动停止后台播放**；详情视图如实显示其标题与“已被年龄分级筛选隐藏”提示，同时禁用“开始播放”按钮，阻断不可见项目的重新启动。

---

## 2. 关键文件 SHA-256 清单

### 2.1 生产源码文件（8 项）

| 文件相对路径 | SHA-256 | 核心补修与增量内容 |
|---|---|---|
| `dsh-whale-mist/src/detachable-contract.js` | `AEABCB081FBEF8BDC794803C50123F67C8F504251C1BEAA718781F424E828F2B` | S1 契约放宽至 stopped/error；S2 fetchPreviewBlob 暴露；weAgeRatings 校验与规范化；快照注入 contentRating |
| `dsh-whale-mist/src/detachable-host.js` | `F88C62E107EF11E6A539D929CE62CA85E83D3FAB04FB32D33AFE2F5266D26827` | S2 允许 dsh-app Origin 与预检 X-Whale-Instance-Id；S4 读后会话复核拦截 403；年龄分级读图前 403 门禁 |
| `dsh-whale-mist/src/wallpaper/catalog.js` | `3CF6A3F842507CF17EF79B22981C81BEF4D6553394AB1475D4283AA0EE31B844` | 解析 project.json 中的 contentrating，规范映射至 Everyone/Questionable/Mature/unknown |
| `dsh-whale-mist/src/wallpaper/library.js` | `499692FDFCEFDC41EF9F7128A6DE8C0B8D8466C1F972D260B5F14B22B41DD4C9` | resolvePreviewItem 与 publicEntry 明确注入 contentRating（Lucy 权威赋予 Everyone） |
| `dsh-whale-mist/src/client.js` | `B8BED653AF8492C33F48E8FE290DDE83F39C2DDABC47DFE1F9E3DEAEC2B26AF7` | S1 契约允许 stopped；S2 认证 fetchPreviewBlob 与 DockedPreviewImage；cleanLibraryItem 保留 rating；吸附端 3 复选框与隐藏提示 |
| `dsh-whale-mist/src/companion/index.html` | `0BE5D6C5AB4C630004A9D029DC1DB0930CC2AC80B63647F3001903C511FDC5D5` | 增加 #gallery-age-filters 容器及三个独立分级复选框 |
| `dsh-whale-mist/src/companion/companion.css` | `70E08FEF78DDBDAC523195BB77DE2B927EA764AD98FD8A5B96662152F6EDE91A` | 年龄分级复选框样式与自适应布局规则 |
| `dsh-whale-mist/src/companion/companion.js` | `28F18DBBAB703EB4961063F2553ADDC3492B0CB5EE5C9FA8537927F6DDEA6DA2` | S1 按钮门禁；S3 disconnect 释放与即时切图清空；年龄分级事件绑定、快照同步、读前拦截与隐藏禁用 |

### 2.2 QA 测试套件（`.tmp/detachable-p1b2-20261019-c7e2b10a/`）

| 文件相对路径 | SHA-256 | 验证范围说明 |
|---|---|---|
| `test-s1-s4-age-filters.mjs` | `C58C3DDAC3262D5FAD2582515775DAF3542EB6296516DDF2A11C00125AA01E03` | S1–S4 缺陷针对性验证、Lucy project.json 实机校验、年龄分级独立组合、0-fetch 读前拦截与 403 拦截 |
| `run-p1b2-qa.mjs` | `3446D647E326E2DC6EBE11F68A42BF5C9341EC129DEE9C67DD34BC8E7BDD2862` | 原交付三组 QA 监督调度器，硬上限 15 秒 |
| `test-image-service.mjs` | `A63196B0EE9158461A69420921EDF3E9418FD333105025A9DFCA191604890F53` | 原交付 Test 1：图片安全路由、Junction 拦截与并发边界（保持通过） |
| `test-ui-components.mjs` | `1D14469204DD53A51C99237C3B4F7AB084B6CCD8AF5DE3E8C5E1FF13F17709BF` | 原交付 Test 2：UI 组件、双向同步与 50ms 动作期限（保持通过） |
| `test-sync-races.mjs` | `E6EDB9884E1B0B14E0107AFD2CEB6310AA6CC08D05202D631524D7D9640E7511` | 原交付 Test 3：签名契约、漂移拦截与 0 自动播放（保持通过） |

---

## 3. 验证执行记录

### 3.1 语法守卫与 CSS 模板检查（`npm.cmd run check`）

```text
> dsh-whale-mist@0.6.0-rc.30 check
> node --check src/index.js && node --check src/client.js && node --check src/detachable-contract.js && node --check src/detachable-bridge.js && node --check src/detachable-host.js && node --check src/detachable-edge-adapter.js && node --check src/companion/companion.js && node --check src/wallpaper/session.js && node --check src/wallpaper/scenes.js && node --check src/wallpaper/catalog.js && node --check src/wallpaper/library.js && node qa/css-template-guard.mjs

css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
```
- **退出码**：`0`
- **耗时**：约 2.1 秒

### 3.2 S1–S4 与年龄分级独立专项测试（`node test-s1-s4-age-filters.mjs`）

```text
====================================================
   P1B-2 S1–S4 Repairs & Age Filter QA Suite
====================================================

>>> [Section S1] Real engine stop state contract & execution gating...
✓ Section S1 verified: Real stopped state recognized as startable across executors and UI

>>> [Section S2] Authenticated preview bridge, Origin guards & OPTIONS headers...
✓ Section S2 verified: Authenticated preview bridge, CORS headers, Origin guards & decodable image verified

>>> [Section S3] Disconnect lifecycle, cache invalidation, instant switch & error fallbacks...
✓ Section S3 verified: Instant switch clearing, disconnect cleanup & decode error fallbacks

>>> [Section S4] Post-read session re-verification & superseded request rejection...
✓ Section S4 verified: In-flight request superseded by new instance rejected with 403

>>> [Section Age Filter Addendum] WE metadata, strict pre-fetch gating & tightening...
✓ Real Lucy project.json confirmed: "contentrating": "Everyone"
✓ Section Age Filter verified: WE metadata parsed, strict 0-fetch pre-filtering, 403 direct rejection, and UI gating

====================================================
   ALL S1–S4 REPAIRS & AGE FILTER TESTS PASSED!
====================================================
```
- **退出码**：`0`
- **耗时**：约 1.2 秒
- **覆盖断言点**：
  1. Section S1：真实 `engine.stop('user')` 返回 `stopped` 状态且 `cleanupPending: false`；通过模块与内联执行器分别成功从 `stopped` 启动不同壁纸；吸附端与 companion 面板在 `stopped` 下按钮状态为可启动。
  2. Section S2：认证请求携带 `X-Whale-Main-Token`、`X-Whale-Instance-Id`、`X-Whale-Generation` 以及 `dsh-app://app` Origin 获 200；预检 OPTIONS 的 `Access-Control-Allow-Headers` 严格包含 `X-Whale-Instance-Id`；伪造/无凭证获 401；真实 1x1 光栅图渲染且 `complete && naturalWidth > 0`。
  3. Section S3：仅调用 `disconnect()` 时立即触发 `cleanupBlobsOnDisconnect()`，在途回包拒绝创建 URL（URL 创建计数为 0）；`catalog.scannedAt` 更新触发历史缓存失效与新请求；选中切换瞬间 `detailsPreviewImg.src` 置空并显示占位；`onerror` 触发降级占位。
  4. Section S4：合法 gen1 读图挂起，通过 `/api/main/connect` 替换为 gen2，释放底层 IO 后旧请求被拒绝为 403 `session-invalidated-during-read`；并发名额在底层 settled 时安全释放。
  5. Section Age Filter：实机真实 Lucy `project.json` 读取证实 `"contentrating": "Everyone"`；`parseAgeRatings` 规范化排序与容错；Everyone / Questionable / Mature 独立勾选；未选类别条目前端 0 fetch 请求、Host 0 读图；直接请求隐藏 ID 获 403 `preview-rating-filtered`；选中隐藏项目详情显示“已被年龄分级筛选隐藏”且禁用开始播放。

### 3.3 原交付三组 QA 监督回放（`node run-p1b2-qa.mjs`）

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
[PASS] Test 1: Image Service Security & Bounds (code 0, 385ms)

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
[PASS] Test 2: Companion & Docked Panel UI (code 0, 322ms)

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
[PASS] Test 3: Synchronization, Racing & Zero Auto-Play (code 0, 95ms)

====================================================
                 QA Suite Summary
====================================================
- Test 1: Image Service Security & Bounds: PASSED (code=0, timedOut=false, 385ms)
- Test 2: Companion & Docked Panel UI: PASSED (code=0, timedOut=false, 322ms)
- Test 3: Synchronization, Racing & Zero Auto-Play: PASSED (code=0, timedOut=false, 95ms)
====================================================

All P1B-2 QA Tests Passed Successfully!
```
- **退出码**：`0`
- **耗时**：约 1.5 秒

---

## 4. 安全保护与红线核查

1. **工作区状态与脏改动保护**：工作区原有未跟踪文件、历史补修报告、前序交付分支保持完整；未执行任何 `git commit`、`git push` 或破坏性清理操作。
2. **冻结资产与生产版本不动**：工作区 42 项受保护的 assets / tgz 校验哈希保持原样未动；日常生产包版本（`0.6.0-rc.30`）及日常环境（`DSH 0.2.1-rc.2 / rc.35`、`Git Bash 0.1.1`）未发生修改。
3. **隔离执行与资源有界**：所有网络端口使用动态分配（port 0）；HTTP 连接禁用 Keep-Alive Agent 避免 socket 残留；各独立 QA 均包含独立软限与监督硬限，所有进程均在 1~2 秒内确定性退出，无任何挂起进程或内存泄漏。
4. **禁止项遵守**：未启动真实系统桌面 Edge 或 DSH 主程序；未修改 Steam / Wallpaper Engine 内容偏好或直接读取用户私密壁纸；未发送模型外部请求；未全局杀死 node 进程；三体与 GPU 试验保持暂停。

---

## 5. 结论

P1B-2 二审发现的 S1–S4 缺陷以及用户增补的年龄分级筛选需求已全部定向闭环解决，并通过了语法检查、专项定向测试与全量历史回归。

按规范要求，本轮工作已全部落定并提交交付报告，**现停下等待 Codex 第三次独立复审**。
