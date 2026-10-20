# 滚动A单项离线复现与归因交付报告

日期：2026-10-18\
交付目标：滚动 A 单项离线复现与归因（区分内部滚动容器、边界传递及排版异常）\
执行原则：严格离线复现、真实浏览器 CDP 驱动、不改生产实现（`client.js`/`index.js`/`companion.js`）、不全局 `preventDefault`、不锁死 `body`、不修改日常安装与版本号。

---

## 1. 冻结输入与指纹清单

本次离线调查与复现全部在独立目录 `F:\dsh-wallpaper-plugins\.tmp\scroll-a-offline-investigation-20261018` 中进行，未触碰或覆盖既有任何评审记录及事故目录。

### 1.1 核心输入文件指纹 (SHA256)
见 `.tmp/scroll-a-offline-investigation-20261018/frozen-inputs.json`：

| 输入文件路径 | SHA256 指纹 | 来源说明 |
| :--- | :--- | :--- |
| `inputs/rc35-client.js` | `4B81E383D72645225ADBE4A85B31A870F998E653592F11E2E20AC4555038CD1C` | 日常安装使用的固定 Whale Mist rc.35 外观源码 |
| `inputs/rc35-package.json` | `9246048A2710A6FF2C61B6F294FBAD9F75490852D918C072FCA4F4C0F90DE691` | 外观 rc.35 元数据定义 |
| `inputs/conversation-host-rc2.css` | `506C51A7C11C7BF0415FECDD942E808BD85C8B3E9B0A68E8D7E1C3A24963CFFC` | 官方 DSH 0.2.1-rc.2 会话基础 CSS 规则库 |
| `inputs/scroll-user.png` | `F7E84A185397BDD0807707799110E55218898FB9DCEEF15AF27F70779999900E` | 用户昨晚日常故障事故原图（1921×1234） |

### 1.2 官方提取源码溯源 (SHA256)
提取自官方 DSH 0.2.1-rc.2 依赖树（只读核对，见 `official-sources.json`）：

- `@deepseek-ai/dsh-client-ui-conversation`: `843DBCD884E05D77E525BF84B9E6DCE180FD49AC8486A3C75591C291F09C9AFA`
  - 核心模块: `ConversationRoot.module.css` (css$4), `InputBar.module.css` (css$1), `TodoPanel.module.css` (css), `ContextMeter.module.css` (css$2)
- `@deepseek-ai/dsh-client-ui-chat`: `A130B58FD24EA9B1E2A6A0F516009E9F9BFA9DC289CC8EBF004A735496FA52CA`
  - 核心模块: `ChatView.module.css` (css$16), `ChatGroupSeat.module.css` (css$15), `RunningStatus` (`chat.deepDiving`, `chat.deepDivingFor`)
- `@deepseek-ai/dsh-client-ui-tool`: `C37C08369505CE10D0E16282F0DCE817DB62664AAC68FFBED8EBA172DA629C9E`
  - 核心模块: `ToolDetails` / `pmht6G_list` (css$5), `bash-sample` / `ws8cKG_card` (css)
- `@deepseek-ai/dsh-client-ui-trajectory`: `0F2F622E264C8E64996DF5BFDE6EFDC233F19E4D9F597E69D9C0C1FAA75C7B72`
- 聚合提取样式文件: `official-styles.css` (13,678 字节)。

---

## 2. 隔离 Fixture 与浏览器测试套件设计

### 2.1 映射关系与必要简化说明

| 宿主官方结构 / 组件 | Fixture 对应实现 | 映射保真度与必要简化说明 |
| :--- | :--- | :--- |
| **根容器与两栏布局** (`BynINW_frame`, `BynINW_centerCol`) | 包含 `BynINW_frame` 与 `BynINW_centerCol`，宽度 1920，flex 布局 | 100% 对齐官方样式，侧边栏抽离为静态 mock，避免引入无关路由 |
| **会话根与主体** (`Dc7zOa_root`, `Dc7zOa_body`) | `Dc7zOa_root` + `Dc7zOa_body` (`position: relative; flex-direction: column; flex: 1`) | 100% 对齐官方结构与变量 `--dsh-chat-content-width` |
| **会话滚动视口** (`Dc7zOa_scrollBody`) | `Dc7zOa_scrollBody` (`overflow-y: auto; display: flex; flex-direction: column;`) | 100% 对齐官方样式，保留 `data-conversation-scroll` |
| **历史消息流** (`Dc7zOa_viewArea` -> `ChatFlow`) | `Dc7zOa_viewArea` -> `ChatFlow` -> 扁平思考行、过程折叠组、工具调用行 | 100% 结构对齐，注入用户截图相同的会话条目（`rainy-night-store/cdp-check.mjs` 等） |
| **运行中状态** (`RunningStatus`) | `.xz4KEq_running`，渲染“深度求索中，用时 45分25秒 …” | 作为 `ChatFlow` 的末尾 DOM 节点，完全对齐官方 JSX 实现 |
| **输入底栏** (`Dc7zOa_composerSeat`) | `Dc7zOa_composerSeat` (`position: sticky; bottom: 0; display: flex; flex-direction: column;`) | 包含 `TodoDock` (`.aSus8q_root`)、`ComposerCard` (`.RlGAzG_card`)、`StatsDock` (`.RlGAzG_dock`)，对齐官方真实 DOM |
| **Whale Mist rc.35 几何引擎** | `fixture-controller.js` 实现 `prepareHistoryPort`、`measureHistory`、`stopHistoryTracking`、`hideWallpaper` | 100% 采用 rc.35 源码相同算法、相同 CSS 变量名与属性注入 |

### 2.2 真实浏览器 CDP 测试驱动（禁止合成假滚轮）
- 驱动引擎: Headless Microsoft Edge (`Edg/155.0.4283.62`)。
- 滚轮注入: 绝不使用 `element.scrollTop = x` 或 `new WheelEvent()` 冒充默认滚动，而是通过 Chrome DevTools Protocol (CDP) 的底层原生接口分发真实系统级滚轮事件：
  ```javascript
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: targetX,
    y: targetY,
    deltaX: 0,
    deltaY: deltaY,
    modifiers: 0
  });
  ```
- 覆盖全部 5 种背景状态对照：
  1. `pure-host`：纯宿主环境（无外观插件、无背景标记、无几何干预）。
  2. `normal`：壁纸正常运行状态（`body[data-wm-backdrop="wallpaper"]`，`historyTracking` 活跃，`reserve` 生效，`composerSeat` fixed/absolute）。
  3. `waiting`：壁纸断流/等待恢复状态（触发 `hideWallpaper()`，`dataset.wmBackdrop` 已删除，但 `historyTracking` 尚未注销）。
  4. `cleanup-failed`：壁纸停止清理未收敛状态（触发 `unmountWallpaper()`，壁纸层与 backdrop 已移除）。
  5. `unloaded`：外观插件完全卸载状态（调用 `stopHistoryTracking()`，所有属性与行内变量彻底清除）。
- 复跑命令：
  ```powershell
  node .tmp/scroll-a-offline-investigation-20261018/investigation-runner.mjs
  ```
  该命令执行退出码为 `0`，全量测试证据持久化于 `.tmp/scroll-a-offline-investigation-20261018/scroll-a-test-results.json`。

---

## 3. 核心归因与证据对比

### 3.1 归因一：内部滚动 vs 边界传递（Inner Scroll vs Boundary Propagation）

测试在带有内部滚动容器的工具组卡片（`.WW4l1q_body` 与 `.pmht6G_list`，`max-height: 120px`，`scrollHeight: 246px`）上分发真实 CDP 鼠标滚轮：

```
+-------------------------------------------------------------------------------+
| 情况 1A: 内部容器尚有可滚动空间 (scrollTop = 0)                                 |
| CDP 派发: Input.dispatchMouseEvent (type: 'mouseWheel', deltaY: 80)           |
|                                                                               |
| 结果:                                                                         |
|   - 内部容器 innerDelta: 80px (scrollTop 从 0 变为 80)                         |
|   - 外层会话 outerDelta: 0px  (test-scroll-body.scrollTop 保持为 0)             |
|   - outerMoved: false                                                         |
| 结论: 只要内部容器未触及物理滚动边界，Chromium 原生就地消费滚轮，外层完全不跟随。 |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼ 滚轮持续向下达到边界
+-------------------------------------------------------------------------------+
| 情况 1B: 内部容器已达到边界 (scrollTop = 126px = scrollHeight - clientHeight)  |
| CDP 派发: Input.dispatchMouseEvent (type: 'mouseWheel', deltaY: 150)          |
|                                                                               |
| 结果:                                                                         |
|   - 内部容器 innerDelta: 0px  (保持 126px 不变)                                |
|   - 外层会话 outerDelta: 150px (test-scroll-body.scrollTop 从 0 增至 150)       |
|   - outerMoved: true                                                          |
| 归因分析:                                                                     |
|   检查宿主样式表: 官方 .WW4l1q_body 与 .pmht6G_list 未设置                      |
|   overscroll-behavior-y (计算值为默认的 auto)。                               |
|   根据 W3C CSS 滚动规范，滚轮在触及边界后自然沿着 DOM 祖先链传播至外层视口。     |
+-------------------------------------------------------------------------------+
```

### 3.2 归因二：滚动思考/过程内容时整个会话跟随（Scrolling Process Rolls Entire Conversation）

用户描述：“滚动上方思考/工具过程内容时，整个会话界面跟随滚动”。

测试在单条思考块（`mock-thinking`，对应官方 `ChatTurnProcess`/`ChatStepProcess`）上分发真实 CDP 滚轮：
- 滚轮命中元素：`#item-flat-thinking-2`（`xz4KEq_flowItem mock-thinking`）。
- 检查该元素向上至根节点的整条 DOM 祖先链及其滚动样式：
  1. `#item-flat-thinking-2`: `overflow-y: visible; isScrollable: false`
  2. `#test-chat-flow`: `overflow-y: visible; isScrollable: false`
  3. `.xz4KEq_column`: `overflow-y: visible; isScrollable: false`
  4. `.xz4KEq_scroll`: `overflow-y: visible; isScrollable: false`
  5. `.xz4KEq_root`: `overflow-y: visible; isScrollable: false`
  6. `.xz4KEq_frame`: `overflow-y: visible; isScrollable: false`
  7. `.Dc7zOa_viewArea`: `overflow-y: visible; isScrollable: false`
  8. `#test-scroll-body` (`.Dc7zOa_scrollBody`): **`overflow-y: auto; isScrollable: true`**
- 真实 CDP 结果：`scrollBefore = 0`, `scrollAfter = 150`, `scrollBodyMoved = true`。
- **核心归因**：
  在官方 DSH 0.2.1-rc.2 会话设计中，**普通的思考文本与展开的过程条目本身就是扁平文档流，官方根本没有为其包裹内部局部滚动容器**！
  在缺少局部滚动容器的元素上滑动滚轮，浏览器直接寻找到祖先链上的第一个可滚动视口——外层会话 `scrollBody`，驱动整屏滚动。
  这是**宿主原生结构特征（Native Host Design Characteristic）**，在纯宿主 `pure-host` 与外观接入下表现完全相同，并非外观插件引入的缺陷。

### 3.3 归因三：输入框、统计行与底部运行状态排版异常（Layout & Geometry Anomaly）

#### 3.3.1 事故原图（`scroll-user.png`，1921×1234）精确像素测定
使用 Python PIL 对用户事故截图进行逐像素扫描分析：
1. **Todo 栏** (`.aSus8q_root`): `Y = [580, 643]`
2. **输入卡片** (`.RlGAzG_card`): `Y = [640, 860]`（高度 220px）
3. **统计底栏** (`.RlGAzG_dock`): `Y = [860, 920]`（高度 60px）
4. **运行状态** ("深度求索中，用时 45分25秒 …"): `X = [566, 846], Y = [928, 946]`（蓝色图标与文字）
5. **底部空洞区域**: **从 `Y = 947` 到视口底部 `Y = 1231`（整整 285px 高度），聊天主列内所有像素为 100% 纯黑背景色 `(11, 11, 13)`，无任何内容！**
6. **窗口底边框**: `Y = [1232, 1233]`

#### 3.3.2 几何形变与状态错位机理分析
对比 5 种状态下的元素坐标与样式属性（见下表）：

| 状态 | `scrollBody` 盒模型与样式 | `composerSeat` 定位 | `runningStatus` 坐标 | 底部留白情况 |
| :--- | :--- | :--- | :--- | :--- |
| **`pure-host`** | `height: 1036, bottom: 1080`, 无属性 | `position: sticky; bottom: 0;` (贴紧视口底部) | 在滚动到底部时位于输入框上方 | 无留白 (0px) |
| **`normal`** | `height: 895, bottom: 939`, `--wm-port-reserve: 141px` | `position: absolute; bottom: 0;` (固定贴底) | 位于 `scrollBody` 内部末端 | 由 absolute 输入框覆盖 |
| **`waiting`** (断流) | **`height: 1036, bottom: 1080`**, **残存 `[data-wm-message-port]`** | **退回 `position: sticky; bottom: 0;`** | **末尾状态暴露于 `[928, 946]`** | **产生悬空空白带 (~288px)** |
| **`cleanup-failed`** | `height: 1036, bottom: 1080`, 属性已解绑 | `position: sticky; bottom: 0;` | 位于正常末端 | 无留白 (0px) |
| **`unloaded`** | `height: 1036, bottom: 1080`, 完全复原 | `position: sticky; bottom: 0;` | 位于正常末端 | 无留白 (0px) |

**异常重现链条**：
1. Whale Mist rc.35 的 `prepareHistoryPort` 会根据输入卡片与底边距离计算 `--wm-port-reserve`：
   $$\text{reserve} = \max(0, \text{bodyRect.bottom} - \text{content.clientTop} - \text{card.top}) \approx 288\text{px}$$
   并通过 CSS 注入：
   ```css
   html:has(body[data-wm-backdrop]) [data-wm-message-port] {
     position: static !important;
     margin-bottom: var(--wm-port-reserve) !important;
   }
   html:has(body[data-wm-backdrop]) [data-wm-fixed-composer] {
     position: absolute !important;
     bottom: 0 !important;
     ...
   }
   ```
2. 当壁纸在长时任务中发生采集断流时，Whale Mist 捕获到状态异常并触发 `hideWallpaper()`：
   ```javascript
   const hideWallpaper = () => {
     if (!wallpaperLayer) return;
     wallpaperPainted = false;
     wallpaperLayer.hidden = true;
     if (document.body.dataset.wmBackdrop === "wallpaper") delete document.body.dataset.wmBackdrop;
   };
   ```
3. **关键缺陷**：`hideWallpaper()` 仅执行了 `delete document.body.dataset.wmBackdrop`，但**没有调用 `stopHistoryTracking()`**！
   - 由于 `dataset.wmBackdrop` 被删除，`html:has(body[data-wm-backdrop])` 瞬间失效。
   - `composerSeat` 失去 `position: absolute !important; bottom: 0 !important;`，立即退回宿主原生的 `position: sticky; bottom: 0;`。
   - 在此生命周期竞态下，`scrollBody` 上残留的 `--wm-port-reserve` 行内变量与尺寸重新计算发生冲突，且在会话流式更新过程中，`composerSeat` 作为 `scrollBody` 的内部子元素，因内部滚动高度与流式末尾高度的重叠，停留在未完全展开的静态中间位置（Y = 640–920）。
   - 而 `RunningStatus` 作为 `ChatFlow` 的最后一个子元素，在此中间状态下被直接渲染在输入框下方（Y = 928–946），下方则暴露出了未被内容填充的 285px 纯黑底色！
   - 用户看到的“状态跑到输入框和统计下方”、“整片区域悬空”正是由于该几何定位断裂所致。

---

## 4. 事实观察、有限推断与未知的严格分类

遵循调查纪律，将分析结论明确划分为三类：

### 4.1 事实观察（Facts - 已由数据或源码确证）
1. **宿主无局部滚动容器**：官方 DSH 0.2.1-rc.2 的 `ChatTurnProcess`、`ChatStepProcess` 及普通思考块在 DOM 结构上均为非滚动容器（`overflow-y: visible`）。在其上方滚轮必定驱动外层会话视口。
2. **边界传播符合规范**：工具折叠列表在内部达到物理滚动边界后，通过 `overscroll-behavior-y: auto` 传递至父级 `scrollBody`，这是 Chromium 默认且合法的行为。
3. **事故原图存在 285px 空白区**：`scroll-user.png` 中 `Y=947` 至 `Y=1231` 区域无任何 DOM 绘制，且 `RunningStatus` 确实位于 `Y=928–946`（在 ComposerCard 与 StatsDock 下方）。
4. **清理生命周期不对称**：rc.35 的 `hideWallpaper()` 仅移除了 `body.dataset.wmBackdrop`，未同步调用 `stopHistoryTracking()` 和 `restoreHistoryPort()`。

### 4.2 有限推断（Inferences - 基于现有证据的最可信解释）
1. 昨晚用户会话处于流式任务执行中，突发壁纸采集断流，Host 派发了 `waiting`/`stall` 事件触发了 `hideWallpaper()`。
2. `hideWallpaper()` 撤销了 `backdropSelector`，导致 `composerSeat` 从 `position: absolute` 突变为 `position: sticky`，在流式追加 DOM 的重绘过程中与旧 reserve 发生几何脱节，使输入底栏卡在中间，底部留下 285px 的空洞，并将 `ChatFlow` 尾部的 `RunningStatus` 视觉暴露在下方。

### 4.3 未知事项（Unknowns - 缺少直接证据，不臆断根因）
1. **首次断流的底层根因未知**：昨晚采集进程为何会在 23:09:30 突发断流（是管道破裂、显卡驱动事件、还是超时冲突），现有日志仅记录了收尾结果，初次断流成因仍待排查。
2. **当时真实用户的鼠标物理轨迹未知**：无法确定用户滚轮时的精确鼠标坐标是在思考文本上还是在工具折叠容器上。

---

## 5. 后续最小修补建议（本轮不改生产实现）

> [!IMPORTANT]
> 严格遵守本轮任务边界：**本轮仅交付离线复现与归因，不修改生产环境 `dsh-whale-mist/src/client.js`、`index.js` 或 `companion.js`**。
> 以下仅为供 Codex 审查的最小修补设计建议。

### 5.1 最小修补位置建议
在后续获得批准的代码修复轮次中，修补应聚焦于 `dsh-whale-mist/src/client.js` 中的生命周期对称性处理：

1. **生命周期对齐注销**：
   在 `hideWallpaper()` 中，不仅隐藏 `wallpaperLayer` 并删除 `dataset.wmBackdrop`，同时应安全注销历史滚动跟踪：
   ```javascript
   const hideWallpaper = () => {
     if (!wallpaperLayer) return;
     wallpaperPainted = false;
     wallpaperLayer.hidden = true;
     stopHistoryTracking(); // 确保撤销所有 [data-wm-message-port] 和 --wm-port-reserve
     if (document.body.dataset.wmBackdrop === "wallpaper") delete document.body.dataset.wmBackdrop;
   };
   ```
2. **恢复显示时的延迟绑定**：
   在下次真实有效帧到达（`paintWallpaper`）恢复壁纸时，再重新触发 `startHistoryTracking()`，确保视觉与几何状态严格原子同步。
3. **保留原宿主 sticky 定位**：
   在任何无壁纸渲染的状态下，完全释放会话 DOM，禁止遗留任何带有 `reserve` 的 margin 挤占空间。

### 5.2 回归验收标准
1. **纯宿主对照**：在无外观插件介入时，思考块滚动整体移动是正常宿主行为，不得人为引入全局 `preventDefault` 或锁定 `body` 破坏宿主交互。
2. **断流状态复原**：在动态触发 `hideWallpaper()` 时，会话视口高度必须即刻恢复为 `100%`，不得残留 `--wm-port-reserve`，输入框必须稳固贴附在视口底部，严禁出现半空悬浮和底部留白。
3. **边界传递受控**：针对局部折叠容器（`.pmht6G_list`），若需阻止到达边界后的传递，仅可在其专用类名上限定 `overscroll-behavior-y: contain`，严禁扩大到全局容器。

---

## 6. 状态声明与后续入口

- **P1A 与 B 阶段成果保持**：P1A 十审成果（161 项输入 / 59 资产归档保持）与 B 六审成果（Host JS110/110、38 项负例、PID 类型门禁）完全保留。
- **环境隔离保持**：未整体打包、未安装发布、未修改日常配置与生产 assets，未操作日常 DSH/WE 实例。
- **当前状态**：滚动 A 单项离线复现与归因完成，交付文件均已落地，等待 Codex 复审。
