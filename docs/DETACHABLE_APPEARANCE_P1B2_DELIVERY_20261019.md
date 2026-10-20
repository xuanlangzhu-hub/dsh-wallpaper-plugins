# P1B-2 壁纸预览库与详情页交付报告

- **日期**：2026-10-19
- **任务**：P1B-2 壁纸预览库与详情页离线实现
- **规范文档**：[GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B2_20261019.md](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B2_20261019.md)
- **前序验收基线**：[P1B-1六审](DETACHABLE_APPEARANCE_P1B1_SIXTH_REVIEW_20261018.md)（已在离线源码与QA范围收尾，无返工）
- **交付执行方**：小G
- **复审责任方**：Codex

---

## 一、最终 UI 结构与交互方案

本轮严格遵照 [DETACHABLE_APPEARANCE_UI_DIRECTION_20261017.md](DETACHABLE_APPEARANCE_UI_DIRECTION_20261017.md)，不照搬通用设置长列表，完成桌面独立外观窗（Edge Companion）与主端吸附面板（`WhaleDockedAppearancePanel`）的视觉层次和控件划分：

```
+----------------------------------------------------------------------------------------------------+
|                                    独立外观窗 (宽屏模式 >= 720px)                                   |
| +-----------------------------------------------+ +----------------------------------------------+ |
| |  左栏：壁纸库网格 (#column-gallery)           | |  右栏：所选详情与调节 (#column-details)        | |
| |  [刷新目录] (#btn-refresh-catalog)             | |  [大图预览] (#details-preview-container)       | |
| |                                               | |  [标题与ID] (#details-title, #details-id)      | |
| |  +-------------------+  +-------------------+ | |  [播放控制] [开始播放] [停止播放/重试清理]     | |
| |  | [缩略图]          |  | [缩略图]          | | |  [状态提示] (运行中 / 空闲 / 状态不匹配警告) | |
| |  | Lucy              |  | Cyberpunk 2077    | | |  ------------------------------------------  | |
| |  | [播放中][当前选中]|  | [未播放]          | | |  画面调节 (四项已有滑块: 亮度/遮罩/模糊/底色)| |
| |  +-------------------+  +-------------------+ | |  壁纸预设 (四字段手动保存/应用/删除，受门禁保护)| |
| |  ...                                          | |  ------------------------------------------  | |
| |                                               | |  界面外观分区 (DSH主题/调色板/对比度/强调色)  | |
| +-----------------------------------------------+ +----------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+

+-------------------------------------------------+     +--------------------------------------------+
|        独立外观窗 (窄屏模式 < 720px)             |     |        主端吸附面板 (窄宽 380px ~ 720px)   |
| [切换标签页: 壁纸库 | 所选详情] (#view-switcher)|     | Group 0: 壁纸库与播放控制                  |
| 详情页提供显式 [< 返回壁纸库] (#btn-back-to-g.) |     | - 壁纸卡片横向紧凑网格 (无横向溢出)        |
| 其余控件与宽屏完全一致，自适应单列纵向排列      |     | - 所选详情子卡片 (状态、开始/停止、四项)   |
+-------------------------------------------------+     +--------------------------------------------+
```

### 1. 宽独立页（`>= 720px`）与窄独立页（`< 720px`）
- **宽屏响应**：采用 `grid-template-columns: 310px 1fr` 双栏并列结构。左侧为壁纸库网格（`#column-gallery`），右侧为所选详情与综合控制面板（`#column-details`）。
- **窄屏响应**：当窗口宽度小于 `720px` 时，自动显示头部视图切换器（`#view-switcher`），允许用户在“壁纸库”与“所选详情”之间平滑切换；同时在详情视图头部提供直观的“< 返回壁纸库”（`#btn-back-to-gallery`）按钮，满足窄窗移动与单手操作体验。
- **吸附面板**：在 `WhaleDockedAppearancePanel` 中新增 Group 0 紧凑卡片网格与垂直详情子卡片。采用 CSS 容器约束与弹性伸缩，并在 380px 与 720px 宽度下均实现 `overflow-x: hidden`，杜绝横向滚动条或布局错位。

### 2. 选择与播放状态严格解耦（Zero Auto-Play 验证通过）
- **标记分离**：
  - “选中”标记严格绑定权威设置中的选中项 `settings.weScene`。
  - “正在播放”徽章严格绑定权威壁纸运行时状态 `wallpaper.activeSceneId`。
- **零隐式启动**：点击壁纸卡片仅调用 `setSetting('weScene', id)` 更新用户关注的壁纸项，**绝不自动触发壁纸播放、停止或应用预设**。在快速连续选择场景下（如快速从 A 切换到 B 再切换到 C），自动 start/restart 派发次数为严格的 **0 次**（由集成测试计数探针直接断言证实）。
- **播放中选中另一壁纸的冲突警示**：当活动播放 A 而用户在界面选择 B 时，详情区顶部立即呈现醒目的警示横幅（`#mismatch-banner`），明示“当前正在播放 Lucy，已选中的是 Cyberpunk 2077。以下画面调节及预设操作均受到保护，需先显式开始播放新壁纸方可应用预设”，有效杜绝将针对 A 的调节误解为已作用于 B。

### 3. 壁纸画面与 DSH 界面外观明确分区
- **四项壁纸画面调节**：亮度（20–120）、遮罩（0–90）、模糊（0–24）、界面不透明度（40–100），明确归属为 DSH 背景层显示渲染参数，不做虚假壁纸作者参数。
- **手动预设门禁保护**：复用 P1B-1 的权威 `presetTarget` 门禁。当存在播放目标与选择目标冲突（`mismatch`）或未落定状态时，保存、应用、删除按钮统统被禁用，底层 controller 执行同样返回 `{ ok: false, error: 'mismatch' }`。
- **DSH 界面外观分区**：主题（Mist / Abyss）、配色调色板、文字对比度（Standard / Enhanced）、强调色模式与取色器单独归入“界面外观”独立分组（`#group-dsh-appearance`），其配置全局生效，不随壁纸卡片切换而发生意外联动。

---

## 二、受限认证图片服务与安全架构

针对此前仅有 `previewRef` 却无实际图片读取路由的现状，建立了最小化、受限且经过深度加固的安全图片服务：

### 1. 服务路由与严格参数校验
- **路径**：`GET /api/wallpaper-preview?id=<sceneId>`（同时别名支持 `/api/wallpaper/preview`）。
- **参数白名单**：仅接受单参 `id`。拒绝任何 `path`、`url`、`kind` 或客户端根目录参数。
- **ID 格式约束**：仅允许已登记合法 ID：`lucy` 或匹配 `^we-[0-9a-f]{24}$` 的 SHA256 目录哈希。任何试图通过 `..`、`\`、`/` 或非法字符进行目录穿越的请求，一律在进入文件系统前由入参守卫直接返回 `400 invalid-scene-id`，且响应 JSON 绝不泄露服务器内部绝对路径。

### 2. 本地文件系统防篡改与符号链接防御
- **批准根目录限定**：仅在 Host 启动时显式批准的 `approvedRoots` 绝对物理路径内寻址。
- **逐级符号链接拒绝**：通过 `boundFile` 与 `noLinks` 对项目目录和预览文件每一级路径组件进行 `lstat` 检查。一旦发现符号链接（Symbolic Link）或 Windows Junction，立即拒绝并抛出 `link_refused`。
- **双重 Stat 防 TOCTOU 攻击**：在读取文件前后分别进行 `stat` 采样，比对 `ino`、`dev`、`size`、`mtimeMs`。若发现扫描后文件被替换、删除或改向，立即抛出 `preview_changed`。

### 3. 栅格格式 Magic Bytes 校验与资源边界
- **二进制格式特征校验**：不轻信文件扩展名或扫描元数据。直接检查文件首部二进制签名：
  - `image/png`: `89 50 4E 47 0D 0A 1A 0A`
  - `image/jpeg`: `FF D8 FF`
  - `image/webp`: `52 49 46 46 ... 57 45 42 50`
  - `image/gif`: `GIF87a` / `GIF89a`
  - `image/bmp`: `42 4D`
- **非栅格与脚本注入严防**：SVG、HTML、脚本文件一律抛出 `unsupported_image_format`，绝不向浏览器发送可能导致 XSS 的非栅格内容。
- **物理大小与并发有界控制**：
  - 单图物理大小上限：`10 MB`（超出抛出 `preview_too_large`，HTTP 端返回 404）。
  - 单图读取超时：`3000 ms`（超时由 Promise.race 终止）。
  - 全局并发读取上限：`8`（超出返回 `503 preview-concurrency-exceeded`）。

### 4. 传输安全与双通道凭证隔离
- **响应头安全配置**：
  - `Cache-Control: private, no-store`（禁止代理与公共缓存存储）。
  - `X-Content-Type-Options: nosniff`（杜绝 MIME 探测混淆）。
  - CSP 明确限制：`img-src 'self' data: blob:`。
- **凭证验证隔离**：
  - 伴侣窗（Companion）：请求头必须携带有效的 `X-Whale-Lease` 与匹配当前会话的 `X-Whale-Generation`。旧租约或 generation 不匹配时立即返回 `401 unauthorized-lease`。
  - 主端渲染进程（Main Renderer）：通过 `X-Whale-Main-Token` 进行认证。
  - **令牌不入 URL**：图片请求 URL 中绝不包含 `mainToken` 或 `leaseId` 查询参数，防止通过浏览器历史记录、Referer 或日志造成凭据泄漏。
- **Blob 生命周期管理**：前端采用 `fetch` + `blob:` URL 异步加载机制。组件卸载（`beforeunload`）或由于选择切换导致预览过期时，严格调用 `URL.revokeObjectURL` 及时释放内存，防止长时间运行造成内存泄漏。

---

## 三、代码变更清单与哈希记录

### 1. 源码修改清单
| 文件路径 | 模块性质 | 变更说明 | SHA256 哈希 |
| :--- | :--- | :--- | :--- |
| `dsh-whale-mist/src/wallpaper/catalog.js` | 核心目录扫描 | 导出 `boundFile`；新增 `verifyCatalogPreview` 栅格二进制签名/双重 stat 校验 | `B5D1549F941DE9568063703555FD087BD047191AE049841515CADE270194D8D6` |
| `dsh-whale-mist/src/wallpaper/library.js` | 权威壁纸库 | 新增 `resolvePreviewItem`、`getPreview`，暴露 `subscribe` 监听更新 | `1B3F98E5D5DEDABCC57CB3F33A9CD28BB11E3A88511ADAADE25BEB7E8E7135B8` |
| `dsh-whale-mist/src/index.js` | 插件初始化入口 | 共享单例 `library` 依赖给 `registerWallpaper` 与 `registerDetachableHost` | `0CE08E6E8DCAE3771E737BBD864E2E07EC7159EC4F711E608311E22AC3CEAE67` |
| `dsh-whale-mist/src/detachable-contract.js` | 跨端通信契约 | 增加 `START_WALLPAPER`、`STOP_WALLPAPER`、`REFRESH_CATALOG` 动作白名单及执行器；快照注入目录；提供 `fetchPreviewBlob` | `6B04C08BCFA18F744E79C95F1CDE9BFC706453ADB14828316211B90BE148E2C1` |
| `dsh-whale-mist/src/detachable-bridge.js` | 渲染端桥接器 | 订阅 `controller.wallpaper.subscribeLibrary`，目录变更时推增量快照 | `18F17C2E82BEFBCC1A9EEECFFB681BFAD83F1704B0945AFA1E6750343669215F` |
| `dsh-whale-mist/src/detachable-host.js` | Node 本地 Host | 增加 `GET /api/wallpaper-preview` 受限认证路由，受 generation、租约、并发与超时保护 | `EA9574C2A827885C6A317D302E0BE98D93D4CB0A1FDA76930270D7ACC344E0EB` |
| `dsh-whale-mist/src/client.js` | 主端吸附面板 | 适配 `catalog` 快照；`WhaleDockedAppearancePanel` 增加 Group 0 壁纸库、详情与冲突提示 | `ADD6F5B9D65894307B6BAAB11F9B7C06BC4EF55F507A0EB9ABD53BF0BB8445E1` |
| `dsh-whale-mist/src/companion/index.html` | 伴侣窗结构 | 布局重构：宽屏双栏并列、窄屏 Tab 切换器、卡片网格、详情区、冲突横幅 | `C0B1559D51200631F0A1D7F538BE491E9AF4A08397A1DD88942E58EB1C67BFB9` |
| `dsh-whale-mist/src/companion/companion.css` | 伴侣窗样式 | 媒体查询、卡片布局、纯文本截断与换行保护、状态徽章、无横向溢出规则 | `275E0EA285642C914CF45E9E3C5F513B7CFCD0350D209C72E7E41257A4D3B600` |
| `dsh-whale-mist/src/companion/companion.js` | 伴侣窗逻辑 | 标签页导航、异步 Blob 缓存、卡片选择与播放解耦、刷新与开始/停止处理 | `AC649E7DCA9DFF33973AAF1F7036C77421A94F915CF988DACB961989BE141DB2` |

### 2. 有界 QA 测试脚本清单
| 文件路径 | 角色说明 | SHA256 哈希 |
| :--- | :--- | :--- |
| `.tmp/detachable-p1b2-20261019-c7e2b10a/safe-qa-runner.mjs` | 监督器（复用五审/六审验收文件） | `0128591FA1C8115FEA2B4ACAF83D98E3BBB2306D284E6BE95E5EC9B17B34B66A` |
| `.tmp/detachable-p1b2-20261019-c7e2b10a/run-p1b2-qa.mjs` | 主测试运行器（外层有界总控） | `3446D647E326E2DC6EBE11F68A42BF5C9341EC129DEE9C67DD34BC8E7BDD2862` |
| `.tmp/detachable-p1b2-20261019-c7e2b10a/test-image-service.mjs` | Test 1: 图片服务安全与边界测试 | `7525499DF3BD97C9D47B6BB3BE1BC2052DB96E025C6A4C79CA00AC532214ABA8` |
| `.tmp/detachable-p1b2-20261019-c7e2b10a/test-ui-components.mjs` | Test 2: 界面布局与组件契约测试 | `0594210861663DB078C00EA55ED6A3DD57587B0BB9EEC471E48DFF354F87D336` |
| `.tmp/detachable-p1b2-20261019-c7e2b10a/test-sync-races.mjs` | Test 3: 状态同步、竞争与零自动启动测试 | `9C040EF721190D6A9EEE591E91C0058813DD65C4756F2736E7BEB7A09E7E9851` |

---

## 四、有界 QA 验证过程与执行结果

所有测试均通过受监督的 `runSupervisedScript` 执行，每个子测试具备独立 15s 墙钟硬期限与进程级异常兜底，严守“零无返回脚本”铁律。

### 1. `npm run check` 静态与语法核验
- **执行命令**：`npm run check`（在 `dsh-whale-mist` 目录）
- **退出码**：`0`
- **执行耗时**：约 2.1 秒
- **输出结果**：
  ```
  > dsh-whale-mist@0.6.0-rc.30 check
  > node --check src/index.js && node --check src/client.js && node --check src/detachable-contract.js && node --check src/detachable-bridge.js && node --check src/detachable-host.js && node --check src/detachable-edge-adapter.js && node --check src/companion/companion.js && node --check src/wallpaper/session.js && node --check src/wallpaper/scenes.js && node --check src/wallpaper/catalog.js && node --check src/wallpaper/library.js && node qa/css-template-guard.mjs

  css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
  ```

### 2. P1B-2 专项有界 QA 套件测试
- **执行命令**：`node .tmp\detachable-p1b2-20261019-c7e2b10a\run-p1b2-qa.mjs`
- **退出码**：`0`
- **总耗时**：约 1.2 秒
- **控制台实际输出**：
  ```
  ====================================================
     P1B-2 Detachable Appearance Bounded QA Suite
  ====================================================

  >>> Running Test 1: Image Service Security & Bounds...
  [Test 1] Starting Image Service Security & Bounds QA...
  ✓ Created test fixture files
  [Test 1.1] verifyCatalogPreview Direct Unit Tests...
  ✓ verifyCatalogPreview direct unit tests passed
  [Test 1.2] createWallpaperLibrary getPreview Integration...
  ✓ createWallpaperLibrary getPreview tests passed
  [Test 1.3] HTTP Host /api/wallpaper-preview Security & Bounds...
  ✓ HTTP Host image preview endpoint security tests passed
  === [Test 1] All Image Service Tests Passed Successfully ===
  [PASS] Test 1: Image Service Security & Bounds (code 0, 366ms)

  >>> Running Test 2: Companion & Docked Panel UI...
  [Test 2] Starting Companion & Docked Panel UI QA...
  [Test 2.1] Companion App initialization & token scrub...
  ✓ Token scrubbed from address bar
  [Test 2.2] Wide vs Narrow view switcher...
  ✓ Tab switcher & back navigation verified
  [Test 2.3] Card selection vs playback decoupling...
  ✓ Card click decoupled from playback (zero auto-play actions)
  [Test 2.4] Details view, mismatch banner & playback actions...
  ✓ Explicit stop action triggered
  ✓ Explicit start action triggered with selected wallpaper
  [Test 2.5] Docked Panel structure & responsive boundaries...
  [Test 2.6] Blob URL cleanup...
  ✓ Blob URLs disposed safely
  === [Test 2] All UI Components Tests Passed Successfully ===
  [PASS] Test 2: Companion & Docked Panel UI (code 0, 186ms)

  >>> Running Test 3: Synchronization, Racing & Zero Auto-Play...
  [Test 3] Starting Synchronization, Racing & Zero Auto-Play QA...
  [Test 3.1] Playing A while selecting B...
  ✓ Snapshot correctly reflects playing A while B selected with mismatch error
  ✓ Presets strictly gated by presetTarget during mismatch
  ✓ START_WALLPAPER rejected while playback is active
  [Test 3.2] Explicit Stop action...
  ✓ Stopped wallpaper cleanly; presetTarget now resolved to selected SCENE_B
  [Test 3.3] Explicit Start validation & execution...
  ✓ START_WALLPAPER validated scene availability and executed cleanly
  [Test 4] Rapid selection switching & Zero Auto-Play verification...
  ✓ Verified: Rapid selection switching resulted in EXACTLY 0 automatic starts or restarts
  === [Test 3] All Synchronization & Race Tests Passed Successfully ===
  [PASS] Test 3: Synchronization, Racing & Zero Auto-Play (code 0, 98ms)

  ====================================================
                   QA Suite Summary
  ====================================================
  - Test 1: Image Service Security & Bounds: PASSED (code=0, timedOut=false, 366ms)
  - Test 2: Companion & Docked Panel UI: PASSED (code=0, timedOut=false, 186ms)
  - Test 3: Synchronization, Racing & Zero Auto-Play: PASSED (code=0, timedOut=false, 98ms)
  ====================================================

  All P1B-2 QA Tests Passed Successfully!
  ```

---

## 五、替身范围说明与未验收边界

根据任务规范，本轮属于离线代码与单元/轻量集成验证阶段：
1. **替代边界说明**：
   - 测试中的文件系统目录基于独立的临时目录（`.tmp/p1b2_img_test_*`），涵盖合法 PNG/JPEG、伪装 SVG 文本、超限 10MB 文件及根外文件的真实扫描与读取，未侵入生产壁纸库。
   - 播放器控制器在 `test-sync-races.mjs` 中采用了高精度可计数的生产契约替身对象（直接对接 `detachable-contract.js` 的 `executeAuthoritativeAction`），用以精确统计并断言 `start` / `restart` 调用次数为严格的 0 次。
   - UI 测试针对伴侣窗实际 DOM 结构与逻辑进行无头沙盒加载验证，涵盖双向状态绑定、Token 清洗、Tab 导航与 Blob 对象释放。
2. **明确未验收内容（不作过度声明）**：
   - **未包含真实 Windows 11 系统级独立外窗渲染与吸附拖拽验收**：由于环境无头约束，本次未启动实际微软 Edge 弹出 OS 系统级顶层外框。
   - **未改动日常运行环境**：生产环境 DSH 0.2.1-rc.2 / rc.35 与 Git Bash 0.1.1 保持原样，未启动或操作日常 DSH/WE 实例，亦未发起模型 API 网络请求。
   - **59 项受保护资产完整保留**：`git status --short dsh-whale-mist/assets/ *.tgz` 验证为空，全部现有归档资产与版本号（0.6.0-rc.30）保持未碰。

---

## 六、现场状态与交接结论

- **现场 Git 状态**：除上述列出的必要源码文件修改及临时测试/文档生成外，现有工作区所有脏改动保持原样保护，未执行 `git commit` 或 `git push`。
- **任务状态**：P1B-2 离线实现与自动化有界 QA 验证已完整执行完毕，各项指标均达标且通过。
- **后续安排**：请 Codex 进行独立复审。实现方小G已停止后续代码修改与测试执行，等待下一步指令。
