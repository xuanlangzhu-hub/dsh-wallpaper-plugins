# 滚动A离线调查二审补修交付报告：测量严密化、实机取证脚本重构与CDP全异常边界收尾

- **报告日期**：2026-10-18
- **执行环境**：Windows 11 / Node.js v24.18.0 / Microsoft Edge Headless (155.0.4283.62)
- **基线与现场保护**：
  - 日常环境保持：DSH 0.2.1-rc.2 / 鲸系外观 0.6.0-rc.35 / Git Bash 0.1.1 纯净未碰；
  - 资产与门禁保持：工作区 manifest/生产 assets 冻结 rc.30；P1A 十审 161 项输入与 59 项归档资产不变；B 专项六审 110 项 Host JS 测试保持；
  - 生产代码零修改：`src/client.js`、`src/index.js`、`src/companion.js` 零修改；未修改任何宿主代码；未注入任何全局 `preventDefault` 或锁 `body`；
  - 任务与操作边界：定时任务 `g` 保持 `PAUSED`；未安装发布、未发 DSH 模型请求、未操作退出重开采样、未杀原 WE、未提交推送或清理，未开启 P1B 或其他专项；
  - 证据目录完全隔离：本轮所有补修脚本与证据产物存放于全新独立目录 `F:\dsh-wallpaper-plugins\.tmp\scroll-a-second-repair-20261018\`，历史二审证据 `.tmp/scroll-a-second-review-20261018-a4890924` 与首审补修目录 `.tmp/scroll-a-repair-investigation-20261018` 完整保留、零覆盖。

---

## 目录
1. [一、Q1 补修：运行状态隐藏测量严密化、数据一致性与模型局限澄清](#一q1-补修运行状态隐藏测量严密化数据一致性与模型局限澄清)
2. [二、Q2 补修：将来实机取证脚本重构与隔离页多场景验证](#二q2-补修将来实机取证脚本重构与隔离页多场景验证)
3. [三、Q3 补修：CDP 连接与进程清理全异常边界一次性落定与纯替身验证](#三q3-补修cdp-连接与进程清理全异常边界一次性落定与纯替身验证)
4. [四、交付文件清单、SHA256 指纹与验证命令](#四交付文件清单sha256-指纹与验证命令)
5. [五、调查收尾诚实结论与待办规划](#五调查收尾诚实结论与待办规划)

---

## 一、Q1 补修：运行状态隐藏测量严密化、数据一致性与模型局限澄清

对照 Codex 二审指出的问题：“两份视口结果的 `streamCompletedRunningHidden` 实际均为 false，报告却说隐藏通过；控制器没有生产 rc.35 的真实观察器与时钟链路，不能声称排除流式竞态；工具列表外层没动只是单次输入观察，overflow:hidden 阻断因果未经验证”，我们在本轮完成了系统性纠正：

### 1. 测量与断言严密化（报告与数据 100% 一致）
- **根因分析**：原 `fixture-controller-repaired.js` 中的 `getElementSnapshot` 仅依据 DOM 节点是否存在返回对象，当组件调用 `style.display = 'none'` 隐藏时，节点在 DOM 中仍然存在，导致 runner 中 `streamDoneGeom.stable.elements.runningStatus ? false : true` 错误计算为 `false`，形成了“报告称通过，JSON 实际为 false”的不一致。
- **计算可见性（Computed Visibility）判定**：在 `getElementSnapshot` 中重构可见性判断：
  ```javascript
  const visible = style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  style.opacity !== '0' &&
                  (rect.width > 0 || rect.height > 0 || element.getClientRects().length > 0);
  ```
  元素快照同时包含 `exists: true`（DOM 存在性）与 `visible`（渲染可见性）、`display`、`visibility`。
- **完整生命周期三相断言**：
  在 runner 中严格断言，绝不为了迎合断言而修改 DOM（保留真实节点仅切 `display: none`）：
  1. **流式进行中**：断言 `runningStatus.exists === true && runningStatus.visible === true`；
  2. **生成完毕隐藏**：断言节点仍存留在 DOM（`runningStatus.exists === true`），但渲染不可见（`runningStatus.visible === false && runningStatus.display === 'none'`）；
  3. **恢复显示**：断言恢复后 `runningStatus.visible === true`。
- **实测数据验证**：
  实测两套视口（1080p 与 1921×1234）的 `streamCompletedRunningHidden` **均为 true**，报告与证据 JSON 完全一致。

### 2. 澄清手写简化模型与观察器时钟局限（明确未覆盖范围）
我们在报告与证据元数据中明确界定本离线调查的边界，撤回任何“已排除流式/观察器/第一帧竞态”或“已排除外观插件影响”的过强断言：
1. **缺少生产级观察器**：离线 fixture 是简化的手写静态/控制模型，未搭载生产 DSH 宿主的真实 `MutationObserver`、`ResizeObserver`、`atHistoryEnd` 状态保持以及复杂的视口历史裁剪链路（history clipping）；
2. **时钟相位局限**：测试控制器中的 `measureHistory()` 是在 `setBackgroundState()` 及显隐切换函数内部同步触发的；runner 的“sameFrame”测量是在 CDP 状态变更指令执行完成之后，再发另一条 CDP `Runtime.evaluate` 指令查询，并非浏览器排版管线内部绝对的零时延原生采样；
3. **样式简化**：fixture 手写覆盖了 running 排版等局部类名，因此该模型仅代表在给定规范几何结构下的表现，**不能以此排除生产宿主在真实流式高速推送或首帧渲染时的竞态问题**。

### 3. 工具列表滚动阻断因果降级为“观察与假设”
- 针对工具列表（`.pmht6G_list`）在到达滚动边界后“外层会话没有跟随滚动”的现象，我们在代码与报告中**撤回“必然由 overflow:hidden 阻断”的确定性因果声称**；
- 降级为客观事实记录：
  - **实测观察（Observation）**：在当前 DOM 结构下，当 `.pmht6G_list` 内部到达边界后，派发的 CDP 滚轮事件未引起外层会话滚动；
  - **合理假设（Hypothesis）**：其祖先 `.pmht6G_root` 声明了 `overflow: hidden`，可能对 Chromium 滚动链产生了截断；但在缺乏单变量对比（去除 `overflow: hidden` 的反事实对照）及未记录各层实际滚动的条件下，该因果关系维持为推测/假设，不作为定论；
  - **机制澄清**：明确指出浏览器的**滚动边界链式传递（Scroll Chaining）**与**DOM 事件冒泡（Event Bubbling）**属于不同的底层排版机制，不作混淆。

---

## 二、Q2 补修：将来实机取证脚本重构与隔离页多场景验证

针对二审指出的问题：“原取证脚本选不到 card/todo/stats，把折叠组当 running，scrollState 取错 ID，reserve 取错节点”，我们独立重构了取证脚本并在隔离测试页上完成了多场景验证：

### 1. 独立可复用取证脚本（`scroll-incident-collector.js`）架构
脚本保持纯只读，**绝不读取任何聊天正文、思考文本或用户输入**，严格实施以下定位与提取规范：
1. **活动会话唯一 Scope 定位**：
   - 首先定位 `[data-conversation-scroll]` 候选；
   - 记录 `candidateCount` 并进行可见性过滤；若为 0 标记缺失，若 >1 则诚实标记 `ambiguity: true`，避免跨多会话或后台隐藏节点误查；
   - 以该活动滚动节点向上检索最近的会话宿主（如 `.Dc7zOa_root`），锁定局部作用域 `sessionScope`；
2. **精准核实选择器**：
   - **会话滚动体**：`[data-conversation-scroll]`；
   - **输入卡片**：`[data-composer-seat] .RlGAzG_card`，回退 `.RlGAzG_card`；
   - **输入底栏**：`[data-composer-seat]`，回退 `.Dc7zOa_composerSeat`；
   - **运行状态**：`[data-chat-running]`，回退 `.xz4KEq_running`（**严格排除 `.WW4l1q_root`**，彻底消除把折叠过程组误作运行状态的缺陷）；
   - **待办面板**：`.aSus8q_root`，回退 `[class*="todoPanel"]`；
   - **统计底栏**：`.RlGAzG_dock`，回退 `[data-wm-stats-dock]`；
3. **同源采集滚动数据与 CSS 变量**：
   - `scrollState`（`scrollTop`, `scrollHeight`, `clientHeight`）与 CSS 变量 `--wm-port-reserve` 均从**同一个活动 `[data-conversation-scroll]` 节点**提取，不再盲目读取不存在的 `#main-scroll-body` 或 `body`/`html`；
4. **诚实状态输出体系**：
   每一个元素均返回标准化的状态标识：
   - `visible`：在 DOM 中且计算样式可见、尺寸大于 0；
   - `hidden`：在 DOM 中但 `display: none` / `visibility: hidden` / 尺寸为 0；
   - `missing`：DOM 中未检索到候选（`candidateCount === 0`）；
   - `ambiguous`：检测到多个候选（`candidateCount > 1`）。

### 2. 隔离页多场景自动化验证（`verify-collector-probes.mjs`）
在受控 Edge 隔离页（`fixture-repaired.html`）中，自动化验证了 4 大关键场景：
- **场景 1（正常可见）**：
  - `activeScrollFound: true`，`scrollCandidateCount: 1`，`scrollAmbiguity: false`；
  - `card`、`seat`、`runningStatus`、`todoPanel`、`statsDock` 全部正确匹配，状态均为 `visible`；
  - `runningStatus` 匹配到 `.xz4KEq_running`，`WW4l1q_root` 未混入；
  - `scrollState` 与 `--wm-port-reserve` 均成功从滚动节点取值（`scrollTop: 120`）；
- **场景 2（流式结束隐藏）**：
  - 调用 `window.__toggleRunningStatus(false)`；
  - 采集脚本诚实输出：`runningStatus.exists === true`，`runningStatus.visible === false`，`runningStatus.display === 'none'`，状态为 `hidden`，派生关系为 `RUNNING_HIDDEN`；
- **场景 3（组件缺失）**：
  - 动态从 DOM 移除 TodoPanel 与 StatsDock；
  - 采集脚本诚实输出：`exists: false`，`visible: false`，`status: 'missing'`，`candidateCount: 0`；绝不用空字段或静默忽略假充正常；
- **场景 4（多候选歧义检测）**：
  - 动态向 DOM 注入第二个带有 `data-conversation-scroll` 的节点；
  - 采集脚本诚实输出：`scrollCandidateCount: 2`，`scrollAmbiguity: true`，`status: 'ambiguous'`，明确报警候选不唯一。

四项测试全部 PASS，执行耗时 2.1 秒，产出独立证据 `collector-probe-results.json`。日常实机取证仍待用户另行安排，严禁擅自操作 DSH。

---

## 三、Q3 补修：CDP 连接与进程清理全异常边界一次性落定与纯替身验证

针对二审指出的问题：“两个 CDP connect 的 onclose 在 open 前清除了定时器却没有 reject，导致连接 Promise 仍会永久 pending；自有浏览器退出必须有界，已退出不能等新 exit”，我们重构了通信与生命周期层：

### 1. 一次性落定（One-Shot Settle）重构
在新建的模块 `cdp-client.mjs` 中对 `RobustCdpClient` 进行了安全加固，并在 `investigation-runner-repaired.mjs` 与 `debug-layout.mjs` 中统一引入：
```javascript
async connect(timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settle(new Error(`CDP connect timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const settle = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        this.rejectAll(err);
        if (this.ws) {
          try { this.ws.close(); } catch (_) {}
        }
        reject(err);
      } else {
        resolve();
      }
    };
    // ...
    ws.onopen = () => settle(null);
    ws.onerror = (e) => {
      const err = (e instanceof Error) ? e : new Error(`WebSocket error: ${e?.message || 'unknown'}`);
      if (!settled) settle(err);
      else this.rejectAll(err);
    };
    ws.onclose = (event) => {
      const err = new Error(`WebSocket closed (code: ${event?.code ?? 'unknown'}, reason: ${event?.reason || 'none'})`);
      if (!settled) settle(err);
      else this.rejectAll(err);
    };
  });
}
```
- **核心保障**：
  1. `open` 之前发生 `close`、`error` 或 `timeout`，统一通过 `settle(err)` 触发 `reject(err)` 并关闭 socket，彻底消除 Promise 悬挂；
  2. `open` 之后若触发 `close` 或 `error`，因 `settled === true` 不重复 reject 连接，但会调用 `this.rejectAll(err)` 迅速 reject 所有在途的指令 Promise；
  3. 请求超时（8000ms）、整数 ID 自增（`nextId++`）、运行时求值异常解构均完整保留。

### 2. 有界且免疫“已退出重复等待”的进程终止（`safelyTerminateProcess`）
重构了进程退出等待机制：
```javascript
async function safelyTerminateProcess(proc, timeoutMs = 3000) {
  if (!proc) return { terminated: true, alreadyExited: true, exitCode: null };
  if (proc.exitCode !== null || proc.signalCode !== null) {
    return {
      terminated: true,
      alreadyExited: true,
      exitCode: proc.exitCode,
      signalCode: proc.signalCode
    };
  }
  return new Promise((resolve) => {
    // 注册 once('exit') 并设置有界超时
    // 若 3000ms 未退出，强杀 SIGKILL 并有界返回，绝不永久等待
  });
}
```
- **边界防御**：
  1. 若进程已经退出（`proc.exitCode !== null`），**立即返回**，绝不调用 `proc.on('exit')` 去盲等一个永远不会再次触发的事件；
  2. 若进程未退出，挂载 3000ms 超时计时器并发送 `kill()`；若超时未退出则强制 SIGKILL，保障退出逻辑绝对有界。

### 3. 纯替身负例测试套件验证（`cdp-boundary-probes.mjs`）
无需启动真实 Edge 或建立网络连接，编写了纯 Mock WebSocket 替身测试套件：
- **T1（open 前 close 负例 - Codex 二审原挂起 case）**：
  - 替身在 microtask 中直接触发 `onclose`；
  - 实测：`outcome === 'rejected'`，耗时 **1ms**（此前挂起探针在 100ms 后报 `still-pending-after-timeout`）；
- **T2（open 前 error 负例）**：
  - 替身在 microtask 中触发 `onerror`；
  - 实测：`outcome === 'rejected'`，耗时 **1ms**；
- **T3（连接超时负例）**：
  - 替身 socket 挂起不响应；
  - 实测：在配置的 40ms 超时到达时精确 reject，耗时 **40ms**；
- **T4（连接后在途请求遇 close 负例）**：
  - 连接建立后发指令，随后 socket 关闭；
  - 实测：在途指令 Promise 立即被 reject；
- **T5（已退出子进程终止边界）**：
  - 针对 `exitCode: 0` 的已退出子进程执行 `safelyTerminateProcess`；
  - 实测：耗时 **0ms** 立即返回 `{ terminated: true, alreadyExited: true }`，未挂起；
- **T6（运行中子进程有界终止）**：
  - 针对活动子进程执行 `safelyTerminateProcess`；
  - 实测：在 3ms 内平稳终止并返回。

6 项纯替身与生命周期测试全部 PASS，产出证据 `cdp-boundary-results.json`。

---

## 四、交付文件清单、SHA256 指纹与验证命令

所有补修产物与证据均存放于全新隔离目录 `F:\dsh-wallpaper-plugins\.tmp\scroll-a-second-repair-20261018\`：

### 1. 文件清单与 SHA256 校验和

| 文件名 | 类别 | 大小 (Bytes) | 完整 SHA-256 校验和 |
| :--- | :--- | :---: | :--- |
| `cdp-client.mjs` | CDP 通信与进程终止核心模块 | 5,289 | `160A6F61C81FDDD76C63DD06BE3B84D97F01BB03BEAE37A5A1DB0DA083DD95E6` |
| `cdp-boundary-probes.mjs` | Q3 纯替身异常边界测试套件 | 8,173 | `CD5ED9F1CFD29B0D4191154D700735A8FCFAD3251B3F183DD0AA153B7E1DFDC1` |
| `cdp-boundary-results.json` | Q3 替身测试实测证据产物 | 1,605 | `D8010FD937A0C066136D6539297AE70E0C26A447A5973A2D8814D13F450B57A9` |
| `scroll-incident-collector.js` | Q2 独立实机只读取证脚本 | 8,403 | `FBB55E93DE9CCBA2F28FB889CB380CDC76723FD7EF637C7AE5CE0F7BF9208095` |
| `verify-collector-probes.mjs` | Q2 采集脚本 4 场景隔离验证器 | 12,337 | `67C6DF852663287175DE4DC84AE95E460BFECAF9FF83BBCE9D17A830156100EC` |
| `collector-probe-results.json` | Q2 采集验证实测证据产物 | 19,356 | `C2EC5452C1664D6CE4B10908F914F56BBA056EDF69E97FED82FBB6B161F1D7D6` |
| `fixture-controller-repaired.js` | Q1 计算可见性与几何控制器 | 12,778 | `9758C92909CF4186E1DD7671BC93D54EE0952EB0D708480A50B3393E038DE5B6` |
| `fixture-repaired.html` | 隔离测试宿主页面 | 15,320 | `058DEA356E6EEB93FEDD6217316CAF304E23FCE2A5E91220844333707552F3AE` |
| `debug-layout.mjs` | 快速布局验证脚本 (加固版) | 5,256 | `06F83F1D109CDBDFAC0092A072BCBEE19AEAE11CBB700C495C3E99D202242022` |
| `investigation-runner-repaired.mjs` | 全动态生命周期调查运行器 | 26,994 | `1B7F907597FFED1550D38F7C2465F2BB9BA82DE9F6341F77893FB09F9B3EACA5` |
| `scroll-a-second-repair-results.json` | 全动态调查实测证据产物 | 528,557 | `3FD37C5661CAFBBBB886701506BE07A4DFE6F8829FACF98A73E62112ADF840E3` |
| `official-styles-repaired.css` | 官方提取 9 模块聚合样式 (继承) | 67,501 | `3E8BE882E350B57ACA2C4931D20CE9161CD0EF69FF66EFC1968AFE5153493BCB` |
| `extracted-styles-manifest.json` | 样式提取哈希清单 (继承) | 1,937 | `165688C9BF7C628C1AB807454FA2711B7783D3DD9DD4DA913126BA9B31730ECA` |
| `extract-styles.mjs` | 样式提取源码 (继承) | 3,822 | `D5EA788B3D038CFEA4E7FD9BB39BDDE7ECAF0AD7404D2263662A12F416F30BF9` |

### 2. 独立验证执行命令

本轮全部脚本均具备有界超时与内部清理，单项耗时均在 1~8 秒内：

```bash
# 1. 验证 Q3 CDP 连接全异常边界与进程生命周期 (纯替身，无网络/浏览器，~40ms)
node F:\dsh-wallpaper-plugins\.tmp\scroll-a-second-repair-20261018\cdp-boundary-probes.mjs

# 2. 验证 Q2 取证脚本 4 场景隔离页断言 (Edge CDP，约 2 秒)
node F:\dsh-wallpaper-plugins\.tmp\scroll-a-second-repair-20261018\verify-collector-probes.mjs

# 3. 验证快速布局探测 (Edge CDP，约 1 秒)
node F:\dsh-wallpaper-plugins\.tmp\scroll-a-second-repair-20261018\debug-layout.mjs

# 4. 验证 Q1 完整动态调查与双视口矩阵 (Edge CDP，约 7 秒)
node F:\dsh-wallpaper-plugins\.tmp\scroll-a-second-repair-20261018\investigation-runner-repaired.mjs
```

---

## 五、调查收尾诚实结论与待办规划

### 1. 调查诚实收尾结论
1. **有限手写模型未复现（Not Reproduced）**：
   在搭载 9 模块官方真实 CSS 样式与规范几何排版的隔离测试床中，经历两种视口分辨率（1080p 标准屏与 1921×1234 用户截图尺寸）及 6 大生命周期状态，**均未复现截图所示的底部 285px 悬空及思考状态掉落卡片下方现象**；
2. **根因依然未知（Root Cause Unknown）**：
   由于手写模型无法还原生产宿主内部复杂的流式竞态、实际 DOM 树上下文与渲染器异步重排，本次调查**不能、也不会宣称已经排除了外观插件或宿主渲染的嫌疑**，未复现仅代表本套测试床内的数据事实；
3. **QA 质量闭环完成**：
   首审交付中存在的数据不一致（Q1）、实机取证误选（Q2）以及 CDP 连接悬挂（Q3）缺陷已通过严格测量、作用域绑定、一次性落定及独立多场景验证全面闭环修复。

### 2. 待办与后续建议（待用户指示）
- **日常实机取证待命**：若未来用户在日常 DSH 0.2.1-rc.2 / 外观 rc.35 运行中再次亲历类似截图异常，可由用户安排直接在宿主 Console 中执行 `scroll-incident-collector.js`，无侵入获取包含精准 Scope、DOM 状态与共存变量的真实第一现场数据；
- **保持停下等复审**：本轮不自动推进实机测试，不提交推送，不修改生产环境，立即停下等待 Codex 独立复审。
