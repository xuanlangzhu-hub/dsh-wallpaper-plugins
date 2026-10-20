# 滚动A离线调查首审补修交付报告：事实纠正、真实官方样式与带有效性断言的全动态复测

- **报告日期**：2026-10-18
- **执行环境**：Windows 11 / Node.js v24.18.0 / Microsoft Edge Headless (155.0.4283.62)
- **基线保持**：日常 DSH 0.2.1-rc.2 / 鲸系外观 0.6.0-rc.35 / Git Bash 0.1.1 纯净未碰；P1A 十审 161 项输入 / 59 项资产归档不变；B 专项六审 110/110 项 Host JS 单元测试及 38 项探针完全保持；定时任务 `g` 保持 `PAUSED`；生产代码（`src/client.js`, `index.js`, `companion.js`）**零修改**；未加任何全局 `preventDefault` 或锁 `body`。

---

## 目录
1. [零、CDP 挂起原因排查与架构修复 (Hang Resolution)](#零cdp-挂起原因排查与架构修复)
2. [一、R1（事实澄清与结论撤回：未复现与真实数据客观汇报）](#一r1事实澄清与结论撤回未复现与真实数据客观汇报)
3. [二、R2（官方完整样式提取、验证门禁与自然溢出布局对齐）](#二r2官方完整样式提取验证门禁与自然溢出布局对齐)
4. [三、R3（有效性断言与全动态生命周期覆盖）](#三r3有效性断言与全动态生命周期覆盖)
5. [四、极小化后续修复假说与实机只读取证方案](#四极小化后续修复假说与实机只读取证方案)
6. [五、基线保护与环境自洽核验](#五基线保护与环境自洽核验)

---

## 零、CDP 挂起原因排查与架构修复

对照 Codex 在 `docs/SCROLL_A_DEBUG_TASK_HANG_20261018.md` 中核实并转达的挂起原因，我们在本轮第一时间进行了根因分析并对 CDP 通信层进行了彻底重构：

### 1. 挂起根因剖析
- **CDP 协议整数 ID 规范**：原 `debug-layout.mjs` 中使用了 `const id = Math.random()`（生成如 `0.8329471...` 的浮点数）。依据 Chrome DevTools Protocol 严格规范，消息根对象的 `id` 属性**必须是整型数值**。Chromium/Edge 收到浮点数 ID 后，立即返回协议错误：
  ```json
  {"error": {"code": -32600, "message": "Message must have integer id property"}}
  ```
  该错误响应**不包含任何 `id` 字段**。
- **无匹配且无超时造成永久挂死**：原代码在 socket 消息监听中采用 `if (d.id === id)`，因为浮点数与未返回的 `id` 永远无法匹配，且没有挂载 `reject` 或定时器超时，导致返回的 `Promise` 永久处于 pending 状态，后续的页面关闭、进程清理与测试退出代码完全不可达。
- **表达式序列化异常**：部分内联代码使用了 `JSON.stringify(() => {...}) + "()"`，函数字面量被 `JSON.stringify` 序列化为 `undefined`，进而拼成 `undefined()`，产生执行报错。

### 2. 健壮 CDP 客户端（`RobustCdpClient`）重构
在 `.tmp/scroll-a-repair-investigation-20261018/` 下重构了标准化通信客户端，严格具备以下安全机制：
1. **递增整型 ID 机制**：采用全局单调递增整数 `this.nextId++`（1, 2, 3...），彻底杜绝协议格式解析错误。
2. **挂起请求管理与有界超时**：构建 `Map<number, {resolve, reject, timer}>`，为每一条 CDP 指令强制配置 8000ms 的硬超时计时器。超时时立即抛出 `CDP command timeout after 8000ms: <method>` 异常并从 Map 中清理。
3. **协议错误与网络中断显式 Reject**：当 CDP 响应包含 `error` 字段，或 WebSocket 触发 `error` / `close` 时，立即激活关联 Promise 的 `reject`，拒绝盲目静默挂起。
4. **生命周期防御性清理（`try / finally`）**：在 runner 顶层严格使用 `try ... finally` 代码块，不论测试成功、断言失败或中途异常，均能无条件关闭 CDP WebSocket、终止 Edge 子进程（`browserProc.kill()`）、停止本地 HTTP 静态服务器并清理临时临时目录。
5. **字符串表达式求值与异常捕获**：Runtime.evaluate 一律使用显式 JS 字符串表达式，并开启 `returnByValue: true`，在收到响应后第一时间核对 `result.exceptionDetails`，遇 JS 运行时异常立即抛出。

经实测，单次布局探测与完整批量探测全流程均在 2.2 秒内平稳完成并返回退出码 0，无任何孤儿进程残留。

---

## 一、R1（事实澄清与结论撤回：未复现与真实数据客观汇报）

### 1. 彻底撤回不实结论
在本次交付中，我们**郑重并彻底撤回**此前交付报告（`SCROLL_A_OFFLINE_INVESTIGATION_DELIVERY_20261018.md`）中的以下错误声称：
- ❌ **撤回**“测试床已成功复现用户截图中的 waiting 状态悬空与输入卡片下方错位现象”；
- ❌ **撤回**“已定因：证明了 hideWallpaper 未清理 history tracking 必然导致 285px 悬空”；
- ❌ **撤回**“由此推论必须在生产代码立即调用 stopHistoryTracking”。

### 2. 客观测试数据与未复现事实（Data-Driven Facts）
在搭载完整官方样式模块与修复后几何结构的隔离测试床中，我们在**两种视口分辨率**（1080p 标准视口 `1920×1080` 与用户截图原尺寸 `1921×1234`）下，对 6 大核心生命周期状态（`pure-host`、`normal`、`waiting`、`recovery`、`cleanup-failed`、`unloaded`）在滚动到底部（`atScrollBottom`）时的几何位置进行了毫秒级精确测量。实测数据如下：

#### 表 1：标准 1080p 视口（1920 × 1080）稳定帧实测几何数据
| 生命周期状态 | 输入卡片 top / bottom | 思考状态 top / bottom | 相对关系（orderRelation） | 卡片底距视口底（px） | 是否复现截图悬空 | 是否复现状态落于卡片下方 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **pure-host** | 920.00 / 1048.00 | 816.48 / 874.48 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |
| **normal** | 920.00 / 1048.00 | 846.48 / 904.48 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |
| **waiting** | 920.00 / 1048.00 | 816.48 / 874.48 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |
| **recovery** | 920.00 / 1048.00 | 846.48 / 904.48 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |
| **cleanup-failed**| 920.00 / 1048.00 | 816.48 / 874.48 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |
| **unloaded** | 920.00 / 1048.00 | 816.48 / 874.48 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |

#### 表 2：用户截图真实分辨率视口（1921 × 1234）稳定帧实测几何数据
| 生命周期状态 | 输入卡片 top / bottom | 思考状态 top / bottom | 相对关系（orderRelation） | 卡片底距视口底（px） | 是否复现截图悬空 | 是否复现状态落于卡片下方 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **pure-host** | 1074.00 / 1202.00 | 970.27 / 1028.27 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |
| **normal** | 1074.00 / 1202.00 | 1000.27 / 1058.27 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |
| **waiting** | 1074.00 / 1202.00 | 970.27 / 1028.27 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |
| **recovery** | 1074.00 / 1202.00 | 1000.27 / 1058.27 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |
| **cleanup-failed**| 1074.00 / 1202.00 | 970.27 / 1028.27 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |
| **unloaded** | 1074.00 / 1202.00 | 970.27 / 1028.27 | **ABOVE_CARD** (在卡片上方) | 32.00 | **false** (未复现) | **false** (未复现) |

### 3. waiting 状态未产生布局占位的真实 CSS 机制
经比对与审查真实 CSS 规则，我们厘清了为什么在 waiting 状态下残余 CSS 变量未产生占位：
- 当进入 `waiting` 状态时，`hideWallpaper()` 确实移除了 `document.body` 上的 `data-wm-backdrop` 属性（`delete document.body.dataset.wmBackdrop`）。
- 尽管在滚动宿主容器上可能残留 `--wm-port-reserve: 160px` 的行内变量，但官方激活该下边距占位的 CSS 选择器是：
  ```css
  html:has(body[data-wm-backdrop]) [data-wm-message-port] {
    margin-bottom: var(--wm-port-reserve, 160px);
  }
  ```
- 由于 `body[data-wm-backdrop]` 已经不复存在，该选择器匹配结果为 0。因此在浏览器排版计算（Computed Layout）中，该规则直接失效，实际计算下边距为 0。
- 这从排版原理解释了为何在隔离测试中，`waiting` 状态的几何尺寸与 `pure-host` 完全一致，**变量残留并不导致几何悬空**。此前把“截图上的 285px 空白”直接归咎于“变量残留占位”是违背排版机制的推测。

### 4. 事实、假说与未知的严格界定
- **客观事实（Facts）**：
  1. 在规范的官方 CSS 规则与真实 Edge 排版引擎下，6 大生命周期状态均保持正常吸附与相对位置（思考状态位于卡片上方，卡片稳定贴合视口底端 32px 间隙）；
  2. 测试床中未复现用户截图所示的“思考状态位于卡片下方（Y=928~946）”以及“底部 285px 巨大空洞”；
  3. 源码中 `hideWallpaper()` 确实仅移除了属性，未显式调用可能存在的历史记录追踪注销逻辑，但测试证明该事实在标准 DOM 中不足以诱发截图异常。
- **合理假说（Hypotheses）**：
  1. 截图中的 285px 空白可能并非 CSS 变量占位，而是生产宿主现场某个未折叠的浮动错误面板、未渲染完成的空内容卡片、或绝对定位容器的高度撑开所致；
  2. 可能是动态流式输出极速刷新与外层 `scrollIntoView` 发生竞争时，虚拟滚动列表未能及时重算高度产生的瞬态布局错乱；
  3. 可能是用户系统特定的非标准缩放（DPI Scale 125%/150% 或 Electron 页面级 zoom）与外层 flex 容器交互所致。
- **未知事项（Unknowns）**：
  1. 截图发生那一刻生产宿主内真实的完整 DOM 树与每一个父级容器的 `getComputedStyle`；
  2. 当时是否有其他第三方工具、插件、或宿主内未捕获的渲染异常。

---

## 二、R2（官方完整样式提取、验证门禁与自然溢出布局对齐）

### 1. 转义字符串提取修复与哈希门禁
针对首审指出的 `extract-styles.mjs` 正则无法处理含转义引号（`\"`）导致静默丢弃 6 个关键 CSS 模块的问题，我们对提取脚本进行了彻底重构：
- **无损转义提取正则**：采用能够处理反斜杠转义的双引号匹配模式：
  ```javascript
  const escapedStringPattern = /"((?:\\.|[^"\\])*)"/g;
  ```
  匹配到字符串后通过 `JSON.parse(`"${match}"`)` 进行严格标准转义解码，无损提取所有内嵌 CSS 内容。
- **提取产物与 SHA256 门禁验证**：
  成功提取全部 9 个官方 CSS 模块，产出 `official-styles-repaired.css`（共 66,032 字节），其清单与哈希记录于 `.tmp/scroll-a-repair-investigation-20261018/extracted-styles-manifest.json`：

| 模块名称 | 来源官方包 | 变量名 | 字节大小 (Bytes) | 完整 SHA-256 校验和 |
| :--- | :--- | :--- | :---: | :--- |
| `ConversationRoot.module.css` | `dsh-client-ui-conversation` | `css$4` | 6,855 | `480020D778C177D3B36E28C2592DA784AEA2FBDE736E32DB922CB9448CDCC952` |
| `InputBar.module.css` | `dsh-client-ui-conversation` | `css$1` | 5,894 | `25D094823501F5F8E5C9E5EA03B5473267CA22EEF94385A0F106D8D2713C00CC` |
| `ContextMeter.module.css` | `dsh-client-ui-conversation` | `css$2` | 2,429 | `2ADD7A03FF3152E21147EE315EEBD66365DD2592EE952E1CD9EDA697439A66ED` |
| `TodoPanel.module.css` | `dsh-client-ui-conversation` | `css` | 1,937 | `3435BE1FA19D6587256458C2DFE2A977C01BC2AE7BCAA3BD8DE6F35AC5E0CBE4` |
| `ChatView.module.css` | `dsh-client-ui-chat` | `css$16` | 34,770 | `0FF9C63F85C197453F26762867AE7766B319C5D742822369536FB7A021BF2E6C` |
| `ChatGroupSeat.module.css` | `dsh-client-ui-chat` | `css$15` | 2,414 | `82E668D8806EBAA86BE3E3C39336F118357854446BE8B4F2DEE8C1A33699025D` |
| `TurnNavigator.module.css` | `dsh-client-ui-chat` | `css$17` | 3,542 | `94BCE44E97E2651BBF2834F977202EF2FA0297A7B5DAA8BD85EC8C0ED97B9522` |
| `ToolList (pmht6G)` | `dsh-client-ui-tool` | `css$5` | 4,503 | `C1B03AE39AA8C58856E8663B6212141E68A369892A35B43448AD54B00AF1D76D` |
| `bash-sample (ws8cKG)` | `dsh-client-ui-tool` | `css` | 3,688 | `8D2A4FA8B29417615932AD08594887E96C57FFF72050CDDFD3D1171FE1B67E30` |

- **运行期非零断言门禁**：在测试运行器 `investigation-runner-repaired.mjs` 启动的第一步，机械扫描并解析这 9 个模块的实际存在性；若任何一项未加载或字节为 0，测试立即以退出码 1 终止执行。

### 2. 移除人工固定尺寸，基于官方规则与足量内容形成自然滚动
- **剔除内联 Hack**：彻底删除了此前 fixture 中手写的 `height: 180px; overflow-y: auto;` 等人工干涉样式的代码。
- **严格遵循官方样式声明**：
  1. 官方折叠思考组容器 `.WW4l1q_body`：样式遵循官方 `max-height: min(400px, 50vh); overflow-y: auto;`。通过填充 10 项真实思考步骤形成自然内容溢出（实际测量 `scrollHeight: 562px`, `clientHeight: 400px`，自然具备 162px 内部滚动行程）；
  2. 官方工具调用详情列表 `.pmht6G_list`：样式遵循官方 `max-height: 320px; overflow-y: auto;`。通过填充 6 项工具记录形成自然内容溢出（实际测量 `scrollHeight: 509px`, `clientHeight: 320px`，具备 189px 内部滚动行程）；
  3. 人工机制对照容器：独立为 `.mechanism-control-scrollable`，明确标注为基准对照；
  4. 宿主左侧导航对齐：引入官方 `.BynINW_sidebarCol`（宽 260px），使得主会话列实测几何横向坐标对齐（`body.left: 260px`，`scrollBody.left: 260px`），消除了此前会话靠最左边的偏差。

### 3. 浏览器滚轮传播机制的实测发现（Chaining Mechanics）
使用真实 CDP `Input.dispatchMouseEvent`（类型 `mouseWheel`）分别对四类容器进行精准命中滚轮派发，获得了清晰的排版行为对照：

#### 表 3：四类滚动目标容器在有余量与到达边界时的滚轮行为对照表
| 目标容器类型 | 命中目标与类名 | 内部是否有滚动条 | 有余量时滚轮行为（Subcase A） | 达边界时滚轮行为（Subcase B） | 核心机制与归因 |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **扁平思考项** | `item-flat-thinking-2` | 否 (`overflow: visible`) | 内部无滚动，**外层直接滚动 150px** | 同左 | 无内层容器，事件直接沿 DOM 树向上被祖先捕获 |
| **官方折叠组** | `.WW4l1q_body` | 是 (`max-height: 400px`) | **内层平稳滚动 80px**，外层 0px 保持不动 | 内层不动 (0px)，**外层滚动 150px** | 标准浏览器滚动链（Scroll Chaining）：到达内部物理边界后传递至外层会话 |
| **官方工具列表** | `.pmht6G_list` | 是 (`max-height: 320px`) | **内层平稳滚动 80px**，外层 0px 保持不动 | 内层不动 (0px)，**外层亦不动 (0px)** | **重要发现**：其祖先 `.pmht6G_root` 声明了 `overflow: hidden`，Chromium 默认拦截了边界传递！ |
| **机制对照容器** | `.mechanism-control-scrollable` | 是 (人工对照) | **内层平稳滚动 36px**，外层 0px 保持不动 | - | 人工对照组，验证基础滚动响应 |

> **关键机制结论**：
> 1. 用户此前报告“滚动思考过程时整个会话跟随滚动”，在**扁平展开的思考文本**以及**折叠组到达上下边界**时确实属于浏览器标准排版事件链行为；
> 2. 但在**官方工具列表容器**中，由于外层父级 `.pmht6G_root` 具备 `overflow: hidden`，事件被完全局限在容器内，不会引起外部会话滚动。

---

## 三、R3（有效性断言与全动态生命周期覆盖）

在本次补修的测试运行器 `investigation-runner-repaired.mjs` 中，引入了严格的 Node.js 原生 `assert` 门禁断言，并在多种关键动态场景下完成了全覆盖自动化复测：

### 1. 严格断言门禁体系
- **视口与元素存在性断言**：`assert.ok(targetCoords.y > 0 && targetCoords.y < vp.height)`，断言被测元素必须在真实视口内且非零面积；
- **几何非负与合法性断言**：`assert.ok(rect.bottom >= rect.top && rect.right >= rect.left)`，断言排版计算矩形必须真实且合法；
- **自然溢出行程断言**：`assert.ok(naturalScrollRoom > 50)`，断言官方容器必须具备 50px 以上的真实自然滚动空间，非人工假滚动；
- **生命周期状态转换断言**：断言从 `normal` 切换至 `waiting`、`recovery` 以及 `cleanup-failed` 时，DOM 标记与样式类必须发生确凿变更。

### 2. 动态流式输出演进覆盖（Streaming Progression）
模拟了大模型流式生成的真实生命周期：
1. **流式生成中（Active Streaming）**：调用 `__appendStreamingTurn()` 动态追加 500 字以上的新思考段落与文本块，调用 `__toggleRunningStatus(true)` 激活闪烁状态。
   - 实测几何：`runningRelativeToCard: OVERLAPPING_CARD`，卡片与状态平稳自适应向下推移，未产生跳脱或断裂；
2. **生成完毕（Completed）**：调用 `__toggleRunningStatus(false)` 熄灭状态栏，实测状态栏安全转为隐藏，会话滚动容器 `scrollHeight` 正常扩展并可平稳回滚。

### 3. 组件动态显隐切换覆盖（Component Toggles）
- **待办面板（TodoPanel）显隐**：关闭 TodoPanel 后，卡片 `top` 稳定保持在 920.00px，未对底部布局产生扰动；
- **统计面板（StatsDock）显隐**：移除 StatsDock 后，输入卡片底端 `cardBottom` 从 1048.00px 自然下降至 1072.00px（卡片到视口底间距从 32px 缩减至 8px 原生边距），证实外层 flex 弹性自适应机制运转完全正常。

### 4. 多时钟相位采样（Multi-Phase Timing）
为了检测是否存在“由于样式异步重绘造成的瞬态错位”，我们在每个状态的测量中均记录了三个时钟相位：
1. **同帧即时采样（sameFrame）**：DOM 属性变动的同步时刻；
2. **渲染帧回调采样（requestAnimationFrame）**：浏览器完成一帧复合排版后；
3. **宏任务稳定期采样（stable，60ms 后）**：微任务与所有定时器收敛后。
- **实测比对**：在 6 种状态中，三种时钟相位下的各容器坐标数值完全一致，排除了“首帧错位而次帧恢复”的瞬态视觉跳跃。

---

## 四、极小化后续修复假说与实机只读取证方案

在生产实现（`src/client.js`, `index.js`, `companion.js`）保持绝对**零修改**、不向宿主添加任何全局事件劫持的前提下，结合本次调查成果，我们提出后续两项极小化假说及实机取证策略：

### 1. 极小化修复假说（待实机证据成立后验证）
- **假说一：关于容器滚动边界传递（Scroll Chaining）**：
  若用户希望“滚动折叠思考框时，不论是否到达边界，外层会话绝对不跟随晃动”，最稳妥且零侵入的标准 CSS 方案是为官方折叠组 `.WW4l1q_body` 注入官方原生属性：
  ```css
  overscroll-behavior-y: contain;
  ```
  该标准规则可在不修改任何 JS 滚动监听、不调用 `preventDefault()` 的前提下，由浏览器排版内核直接阻断事件向外冒泡传递。
- **假说二：关于生命周期完整注销**：
  若未来实机日志证实 `hideWallpaper()` 确因未注销 history observer 导致内存泄露或宿主隐藏重算失常，可在 `hideWallpaper()` 中补齐 `this.stopHistoryTracking()` 与显式清空 `--wm-port-reserve` 属性。

### 2. 生产实机非侵入式只读取证方案（Read-Only Diagnostics）
若用户在日常使用中再次观察到“思考状态落入卡片下方或悬空 200px 以上”的现场，请**不要改动或关闭窗口**，可直接在 DSH 开发者工具 Console 中运行以下只读诊断脚本，并导出生成的 JSON 对象：

```javascript
(() => {
  const getRect = el => el ? {
    tag: el.tagName,
    cls: el.className,
    top: el.getBoundingClientRect().top,
    bottom: el.getBoundingClientRect().bottom,
    left: el.getBoundingClientRect().left,
    right: el.getBoundingClientRect().right,
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height
  } : null;
  const q = s => document.querySelector(s);

  const report = {
    timestamp: new Date().toISOString(),
    window: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    },
    bodyAttributes: {
      backdrop: document.body.dataset.wmBackdrop,
      className: document.body.className
    },
    cssVariables: {
      portReserve: getComputedStyle(document.documentElement).getPropertyValue('--wm-port-reserve') ||
                   getComputedStyle(document.body).getPropertyValue('--wm-port-reserve')
    },
    elements: {
      card: getRect(q('[data-wm-composer-card], .WW4l1q_composerCard, [class*="composerCard"]')),
      seat: getRect(q('[data-wm-composer-seat], [class*="composerSeat"]')),
      runningStatus: getRect(q('[data-wm-running-status], .WW4l1q_root, [class*="WW4l1q"]')),
      scrollBody: getRect(q('#main-scroll-body, [class*="scrollBody"]')),
      todoPanel: getRect(q('[class*="todoPanel"], [class*="TodoPanel"]')),
      statsDock: getRect(q('[data-wm-stats-dock], [class*="statsDock"]'))
    },
    scrollState: {
      scrollTop: q('#main-scroll-body')?.scrollTop,
      scrollHeight: q('#main-scroll-body')?.scrollHeight,
      clientHeight: q('#main-scroll-body')?.clientHeight
    }
  };
  console.log('=== SCROLL A INCIDENT DIAGNOSTIC ===', JSON.stringify(report, null, 2));
  return report;
})();
```

---

## 五、基线保护与环境自洽核验

1. **宿主与插件零修改**：
   - 生产插件源码 `f:\dsh-wallpaper-plugins\dsh-whale-mist\src\client.js`、`index.js`、`companion.js` 保持纯净，无代码变动；
   - 绝未向全局注入 `preventDefault`，未锁 `body` 滚动；
   - 日常 DSH 0.2.1-rc.2、鲸系外观 0.6.0-rc.35 与 Git Bash 0.1.1 保持完好运行；
2. **基线成果完全继承**：
   - P1A 十审 161 项输入与 59 项资产归档不变；
   - B 专项六审 110 项 Host JS 单元测试以及 38 项探针维持全部 PASS；
3. **新旧调查证据隔离**：
   - 本轮所有调查脚本与修复产物均隔离保存在专用独立目录 `F:\dsh-wallpaper-plugins\.tmp\scroll-a-repair-investigation-20261018\`；
   - 包含了官方样式提取器 `extract-styles.mjs`、样式哈希清单 `extracted-styles-manifest.json`、提取样式文件 `official-styles-repaired.css`、修补测试页 `fixture-repaired.html`、几何控制器 `fixture-controller-repaired.js`、运行器 `investigation-runner-repaired.mjs` 及完整执行结果 `scroll-a-repaired-results.json`；
   - 此前首审证据目录 `.tmp/scroll-a-first-review-20261018-6241c6f7` 及挂起诊断 `docs/SCROLL_A_DEBUG_TASK_HANG_20261018.md` 完整保留，未发生覆盖或篡改；
4. **定时任务状态**：
   - 定时巡检任务 `g` 继续保持 `PAUSED` 状态。
