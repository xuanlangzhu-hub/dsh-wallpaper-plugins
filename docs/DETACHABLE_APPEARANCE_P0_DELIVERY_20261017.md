# 可分离与吸附的外观设置 P0 可行性调研与最小接缝离线交付报告

2026-10-17，小G。根据 [可分离与吸附外观设置 P0 任务](GEMINI_NEXT_DETACHABLE_APPEARANCE_P0_20261017.md)，完成了独立操作系统窗口承载方式调研、双向状态同步接缝设计以及全套最小离线证明。

---

## 一、调研结论与明确答复

### 1. 是否存在尚未检查到的正式通用窗口扩展接口？
**答：当前未找到。**
> [!NOTE] 勘误说明（对照二审意见修正）
> - 官方 Preload 暴露的实际接口为 `acquire/release/onOpenRequested`（以及系统 `openExternal`），而非 `browser.open`。
> - `PLATFORM_IPC.open` 允许的硬编码页面为 `usage` 与 `top-up`（kebab-case），而非 `/top_up`。
> - 主产品渲染窗口拦截外部开窗主要是针对主要导航视口，不作“所有 WebContentsView 一律 deny”的绝对化表述。

- **检查证据**：
  1. **主页面阻止弹窗**：在官方 `lib/main.js`（`createWindow` 等处）中，主产品页的 `setWindowOpenHandler` 配置为 `{ action: "deny" }`；外部链接交由操作系统默认浏览器 `shell.openExternal()` 处理。插件直接调用 `window.open()` 会被直接拦截或跳转至默认外部浏览器，无法创建应用内子窗口。
  2. **渲染沙箱限制**：主窗口配置为 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。渲染插件无法直接调用 Electron 的 `BrowserWindow`、`WebContentsView` 或 `ipcRenderer`。
  3. **Preload 暴露能力有限**：`createProductApi()` 仅暴露 `protocolVersion: 1`、`acquire`/`release`/`onOpenRequested`、`deviceInfo`、`keyboard`（`closeWindow`, `subscribe`）、`shortcuts` 与 `updates`，不存在通用窗口创建接口。
  4. **`dshPlatform.open` 不可用作插件窗口**：`PLATFORM_IPC.open` 在主进程硬编码仅允许 `page === "usage"` 或 `"top-up"`，且仅作为主窗口内部的 WebContentsView 挂载，不能加载插件自定义 URL 或创建新系统窗口。

---

### 2. 插件范围内伴随窗口路线的可行性比较与推荐
**答：推荐候选一（Microsoft Edge 应用模式伴随窗口，作为有条件候选方案，待实测）。**

> [!NOTE] 勘误与待实测标记
> 下表列出的“30–50MB 内存”、“DPI 缩放”、“独立任务栏图标”均为架构设计推断与预研估算，尚未经过真实环境的物理实测，需在后续实装阶段进行实际验证。Edge 应用模式保留为有条件候选，不借用账号 IPC，不关闭安全隔离。

| 比较维度 | 候选一（有条件候选）：Microsoft Edge 应用模式 (`msedge.exe --app=<url>`) | 候选二：C# / .NET 原生窗口 (WinForms / WPF / WebView2) |
| --- | --- | --- |
| **创建者** | 由插件 Host 进程（或现有原生辅助进程）以独立子进程拉起 | 由内置 `csc.exe` 编译生成的独立 `.exe` 拉起 |
| **运行时依赖** | **依赖系统 Edge**：利用 Windows 10/11 预装的 Edge 浏览器，不修改官方 DSH，不下载任何新运行时 | 需依赖 WebView2 Runtime 及 SDK DLL；若用纯 WinForms 则无法复用 Web UI |
| **UI 承载与复用** | **最大化复用 Web 资产**：直接加载插件本地页面，复用现有 React 控件、主题 CSS 变量、Slider、颜色选择器与无障碍属性 | 纯 WinForms 需从头重写全部外观控件，无法共享 CSS；WebView2 需引入繁琐 C# 互操作 |
| **系统窗口特性** | **操作系统窗口**：独立顶层 HWND、独立任务栏项、多显示器自由拖拽、支持 DPI 缩放（待实测）、无浏览器地址栏/标签栏 | 具备原生窗口特性 |
| **识别与关闭** | 携带会话 Token 与实例 ID；页面关闭或断线时通知主 DSH；主端可随时通过信号或进程关闭 | 需通过进程 Job Object 或管道监控 |
| **预估开销** | 额外消耗预计约 30–50MB 内存（待实测）；需建立本地安全通信通道 | 需维护 C# 编译链路与 DLL 打包，重写 UI 成本极高 |

**结论**：候选一作为有条件的推荐方案，可在零官方修改的前提下，探索“可拖出 DSH、放另一屏”的独立窗口承载，待后续阶段进行真机开窗验证。

---

### 3. 伴随窗口与主 Renderer 如何双向同步？
**答：主 DSH Controller 继续作为唯一权威，通过轻量安全通信桥进行不可变快照同步与受限动作派发。**
1. **主 DSH Controller 为唯一权威**：
   - 伴随窗口**绝不加载**第二套 `apply()`、不运行 `createBackdrop()`、不读取/写入 LocalStorage、不启动第二轮 Wallpaper Engine 播放。
   - 所有状态变更、壁纸生命周期、存储持久化、主题注入均仅由主 DSH Controller 处理。
2. **状态与动作契约（Snapshot & Action Contract）**：
   - **快照（Snapshot）**：主 Bridge 维护不可变、带单调自增 `revision` 的状态快照，包含完整当前设置、预设快照与壁纸状态。
   - **受限动作（Restricted Action）**：伴随窗口仅能派发严格白名单动作（`set-setting`, `reset-settings`, `save-preset`, `apply-preset`, `remove-preset`, `request-dock`, `close-window`），禁止传递任意路径、命令、JS 或 Shell。
3. **安全认证与实例隔离**：
   - 每次弹出生成单次有效（single-use）的随机 `sessionToken`，并绑定当前 DSH 的 `instanceId`。
   - 重启 DSH 或旧窗口尝试连接，因 `instanceId` 或 `sessionToken` 不匹配会被立即拒绝（`unauthorized`）。
4. **防重与时序防御**：
   - 动作携带 `clientActionId`，主端设 LRU 缓存过滤重复请求。
   - 结合 `expectedRevision` 防止由于网络/消息迟到导致的过时覆盖。
5. **断线与故障隔离**：
   - 伴随窗口意外关闭或崩溃时，Bridge 自动切回 `docked` 模式，主 DSH 播放与会话完全不受影响。
   - 主 DSH 退出或插件卸载时，Bridge 自动关闭伴随窗口连接并清理进程，无孤儿残留。

---

### 4. 吸附态能否通过已有 List 槽位实现？
**答：能，通过 `shell.overlay` 实现。**
- **槽位特性**：
  - `rightbar` 是 single 槽，官方已分配给文件/终端/浏览器右栏，插件强行占用会破坏官方功能。
  - `shell.overlay` 是 `ui-layout` 提供的 **root-scope list 槽位**，允许多个插件安全共存。
- **完成度与形态界定**：
  - **吸附态（级别 A，推荐方案）**：在 `shell.overlay` 中渲染靠右固定的侧边面板（宽约 360px），主会话和背景可见且可实时交互，不设遮罩层、不锁死滚动，支持与伴随窗口通过按钮一键互切。
  - **边界明确**：这是一种非模态的页内右侧吸附面板；它不等于侵入并修改官方 DOM 布局的 Flex 侧栏（级别 B），也不等于在桌面上由操作系统强行贴边的辅助原生窗口（级别 C）。

---

## 二、P0 最小接缝实现

### 1. 生产代码微调（`dsh-whale-mist/src/client.js`）
在主 Controller 中补充了稳定的设置快照与订阅机制（满足 `useSyncExternalStore` 要求）：
- 增加 `controller.getSettingsSnapshot()`：返回稳定的不可变对象引用。
- 增加 `controller.subscribeSettings(listener)`：在 `set`, `reset`, `presets.apply` 等所有变更点统一发布更新。
- 在插件卸载（`ctx.effect`）时彻底清理监听器。

### 2. 桥接与协议模块（`dsh-whale-mist/src/detachable-bridge.js`）
全新实现 P0 最小通信与契约桥接：
- `buildAppearanceSnapshot(controller, revision)`：构建权威只读快照。
- `validateDetachableAction(action)`：严格白名单校验（键名、范围、枚举、Scene ID）。
- `buildEdgeAppLaunchSpec(options)`：生成安全的 Edge `--app` 启动参数（禁止 Shell 注入）。
- `createDetachableBridge(controller, options)`：主端桥接器，处理模式切换、Token 鉴权、动作去重与广播。
- `createCompanionClient(options)`：伴随端客户端，支持订阅快照与安全派发动作。
- `createMockTransportPair()`：用于隔离 QA 的内存双向传输管道。

---

## 三、测试与离线验证结果

新增专门的 P0 契约与离线验证套件 [`qa/detachable-appearance-p0.test.mjs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/detachable-appearance-p0.test.mjs)，包含 10 项针对性检查：

| 测试项 | 验证内容 | 结果 |
| --- | --- | --- |
| **1. 快照构建与动作校验白名单** | 验证不可变快照结构，负例拦截 `__proto__`, `shellExecute`, 越界数值, 非法 Hex, 非法路径 | **通过** |
| **2. 唯一权威与动作幂等去重** | 验证双端订阅同一 Controller，任意一端修改即时同步另一端；重复 `clientActionId` 拒绝二次递增 | **通过** |
| **3. 模式切换对壁纸 0 干扰** | Docked <-> Detached 往返切换过程中，验证 `start/stop/restart` 均未调用，壁纸保持 `playing` | **通过** |
| **4. 安全与连接边界隔离** | 错误 Token、旧 `instanceId`、Token 二次复用均被拒绝；伴随端关闭自动重置为主端 `docked` | **通过** |
| **5. Edge App 启动参数安全性** | 验证 `--app` 参数安全拼接，禁止 Shell 扩展，端口/Token 非法时安全报错 | **通过** |
| **6. 过期 Revision 防御** | 客户端携带过时 `expectedRevision` 时被检测并返回最新权威快照 | **通过** |
| **7. 注入与非法 Payload 防御** | 拦截 `fetch`, `window.open`, `eval`, 系统命令等非法调用 | **通过** |
| **8. 卸载与生命周期清理** | 主端 `dispose` 时关闭伴随窗口适配器、清空 Token，已注销 Bridge 拒绝后续调用 | **通过** |
| **9. 预设增删改查跨端同步** | 在伴随端执行 `save-preset`, `apply-preset`, `remove-preset`，双端快照即时同步 | **通过** |
| **10. 全量外观属性双向往返** | 覆盖 `theme`, `palette`, `textContrast`, `chatBackdrop`, `opaqueChat`, `accentColor` 等全属性往返 | **通过** |

### 全量回归命令与结果

```
npm run check
> dsh-whale-mist@0.6.0-rc.30 check
> node --check src/index.js && node --check src/client.js && node --check src/detachable-bridge.js && node --check src/wallpaper/session.js && node --check src/wallpaper/scenes.js && node --check src/wallpaper/catalog.js && node --check src/wallpaper/library.js && node qa/css-template-guard.mjs
css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes [退出码: 0]

npm run test:detachable-p0
> node --test qa/detachable-appearance-p0.test.mjs
✔ 10/10 测试全部通过 (耗时约 130ms) [退出码: 0]

npm run test:appearance
> 570 项全量外观回归通过 [退出码: 0]

node qa/appearance-regression.mjs --english-suite
> 566 项英文套件回归通过 [退出码: 0]

node qa/appearance-regression.mjs --scene-selection-only
> 场景选择回归通过 [退出码: 0]

npm run test:check-pairing
> 8/8 通过 [退出码: 0]

npm run test:temp-profile-boundaries
> 11/11 通过 [退出码: 0]
```

---

## 四、未覆盖项与 P1 推进范围

### P0 未覆盖项（明确界限）
1. **本轮未开原生窗口**：未真正调用 `msedge.exe` 开窗，未进行真实双屏显示器拖拽。
2. **本轮未挂真实 UI 面板**：未进行真实的 React UI 控件迁移与顶栏入口挂载。
3. **本轮未操作真实 DSH/WE**：不影响日常 rc.34。

### P1 推进范围（待 Codex 复核通过后启动）
1. **Host 伴随服务路由**：在 `ctx.webServer` 上挂载轻量伴随页面宿主（`assets/whale-companion.html`）与 SSE / WebSocket 消息端点。
2. **顶栏一键入口**：在 `conversation.session.header.actions` 挂载“鲸系外观”按钮。
3. **吸附态右侧面板**：在 `shell.overlay` 注册吸附态外观设置面板（360px 非模态浮层）。
4. **双形态切换按钮**：在面板头部放置“弹出至独立窗口 / 吸附回主界面”切换按钮，通过 `createDetachableBridge` 驱动模式流转。
5. **实际 React 挂载检查套件**：编写隔离的 React 挂载测试，覆盖真实组件交互与拖动即时反馈。

---

## 五、现场保护说明
- 用户继续使用日常 `rc.34`。
- 本机开发工作区 manifest 及 assets 保持冻结在 `rc.30`。
- 未打包安装、未修改官方 DSH 文件、未提交推送、未向其它会话发送消息。
