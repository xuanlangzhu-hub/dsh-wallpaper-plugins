# rc.51 target.unverified真实自动触发接缝与排他收尾交付报告（已更正版）

**日期**：2026-10-27\
**交付者**：Gemini\
**复审目标**：Codex\
**对应复审任务**：`docs/RC51_TARGET_UNVERIFIED_GEMINI_SECOND_REVIEW_20261027.md` 及 `docs/RC51_TARGET_UNVERIFIED_FINAL_SEAM_REVIEW_20261027.md`\
**工作区状态**：离线诊断与QA阶段；日常DSH 0.2.1-rc.3、Whale rc.48、Git Bash保持不动；不修改生产源码，不打包安装，不修改Profile或生产资产，不推送清理。

---

## 一、交付概述与执行口径

本轮完全响应 Codex 二审与复审意见，聚焦解决两项补验要求（**R1 实际renderer与React effect产品接缝**，以及 **R3 排他独立目录、错因分类与进程退出确认**），并对文档中涉及协议格式、IO替身边界、时序观察窗以及输入哈希映射进行精确更正与收敛：

1. **真实引擎与原版 Effect 执行，准确界定交付接缝与底层 IO 替身**：
   - 从固定候选解包源码 [`unpacked/src/client.js`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-author-read-diagnostic-candidate-20261027-a/unpacked/src/client.js) 中完整提取真实的 `createWallpaperEngine` 实现与原版 `AuthorSwitches` 组件函数体（包含真实的 `autoEligible` 与 `React.useEffect` 依赖）；
   - 使用来自工坊实际预览图（`3346750532/preview.jpg`，62,886 字节，具有完整 SOI/APP0/SOF0/SOS/EOI 二进制标记）构建 24 字节 WHL1 帧头；
   - 帧在 session `FrameHub` 完成解析后，由测试代码通过 `engine.acceptFrame(frame)` 入口递送给真实渲染器；流请求 `fetchImpl('/whale-wallpaper/stream')` 提供带有 abort 监听的空 `ReadableStream`，**未走完整网络 HTTP 流消费管道**；
   - 渲染器调度真实 `schedulePaint` -> `paint`。全局注入的 `createImageBitmap` 固定返回 1920×1080 尺寸对象，作为**底层解码 IO 替身**（无 Chromium Skia/libjpeg 原生解码）；测试中 `ctx.drawImage` 为桩实现，**未执行真实 GPU 硬件光栅化与画布绘制**；
   - 解码替身 resolve 后，真实渲染器代码调用 `emitStatus({ state: 'playing' })`；
   - 状态变更通过自写轻量 React hook 调度器（运行原版 `AuthorSwitches` 函数体，**非官方 ReactDOM 挂载**）驱动原版 `useEffect` 执行 `author.ensureLoaded()`。测试代码未直接调用 `ensureLoaded()` 或手动置 `playing`；
2. **三时序真实链路对照与观察窗界定**：
   - **时序 1（红例 / 竞态还原）**：首帧触发 playing 与自动读取在先，stderr `Status(captureSource:window)` 就绪在后。初次读取确切命中 `target.unverified`，稍后在 `captureStarted: true` 状态下手读恢复为 `ready`（6项全字段，0次参数写入）；
   - **时序 2（绿例 / 对照组）**：stderr 先就绪，首帧到达触发 playing 后初次读取直接成功进入 `ready`；
   - **时序 3（反事实对照 / 零帧阻断）**：100ms 观察窗内无可用帧抵达，渲染器停留在 `connecting`，`AuthorSwitches` 的 effect 不触发，schema 接口调用次数确为 0，状态保持 `idle`（是有界观察窗内的反事实证据，不泛化为“未来所有时间均不请求”）。
3. **独立排他输出目录与严格父监督（R3）**：
   - 彻底隔离正常运行与故障注入的输出路径，分别为 `normal/` 与 `fault/` 目录；
   - 所有产物均以 `{ flag: 'wx' }` 排他模式写入，严防覆盖；
   - 故障注入父监督（`run-fault.cjs`）严格核验 `cleanupSuccessful === false`、`session.isClosed() === false` 及具体清理断言错误，**显式拒绝**“逻辑失败但清理成功”的伪故障；
   - 监督进程配置 25 秒超时及 2 秒 SIGKILL 退出核验；正常退出与指定清理故障已验证，真实超时挂起或 kill 后未知状态未实测。
4. **Codex 独立 VM 错因对照证据引用**：
   - 准确引用 Codex 在 `.tmp/rc51-target-unverified-final-review-20261027-a/` 中使用实际未改父监督源码＋child/文件/计时 IO 替身完成的 3 项对照证据（163ms 退出 0）：真实清理失败接受并退出 0、逻辑失败但清理成功拒绝并退出 1、缺报告拒绝并退出 1。此为 Codex 独立 VM 验证，非原进程执行产物。

---

## 二、真实触发接缝与边界定义（R1）

### 2.1 WHL1 帧协议结构更正

WHL1 帧头严格为 24 字节，字段排布如下（更正此前混淆的 format/flags 描述与全大端误述）：
- **偏移 0–3**：`WHL1` Magic 魔数（4 字节，大端 ASCII）；
- **偏移 4–7**：Sequence 序号（4 字节，小端 uint32）；
- **偏移 8–11**：Payload Length 长度（4 字节，小端 uint32，对应 JPEG 长度 62886）；
- **偏移 12–19**：Timestamp 毫秒时间戳（8 字节，小端 int64）；
- **偏移 20–21**：Width 宽度（2 字节，小端 uint16，1920）；
- **偏移 22–23**：Height 高度（2 字节，小端 uint16，1080）；
- **偏移 24 以后**：紧随 JPEG 二进制数据。
协议本身无 format 或 flags 字段，除 Magic 外数值均为小端序。

### 2.2 真实组件与底层 IO 替身精确边界

在排他测试脚本 [`reproduce-final.mjs`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-target-unverified-final-20261027-a/reproduce-final.mjs) 中：
1. **真实引擎**：运行固定解包 `client.js` 的 `createWallpaperEngine`。但流消费为桩：`fetchImpl('/whale-wallpaper/stream')` 返回空 `ReadableStream` 避免死循环，WHL1 帧是在 Session `FrameHub` 接收后通过 `engine.acceptFrame(frame)` 显式送入引擎，**未走完整网络 HTTP 流消费**。
2. **真实 Effect**：提取原版 `AuthorSwitches` 组件（行 8866–8874）：
   ```javascript
   React.useEffect(() => {
     if (visible && autoEligible && !signal?.aborted) {
       void author.ensureLoaded?.();
     }
   }, [visible, autoEligible, signal, state.phase, state.busy, state.canRead]);
   ```
   其中 `autoEligible = (st.state === 'playing')`。React 运行环境为轻量 hook 模拟执行器（按索引管理 state 与 effect 触发），**非真实 ReactDOM 挂载**。
3. **底层解码与绘制替身**：
   - 图像读取自 `E:/SteamLibrary/steamapps/workshop/content/431960/3346750532/preview.jpg`（真实 JPEG 二进制，含 SOI `0xFF,0xD8`、APP0 `0xFF,0xE0`、SOF0 `0xFF,0xC0` 宽度 1920/高度 1080、SOS `0xFF,0xDA`、EOI `0xFF,0xD9`）；
   - 全局注入的 `createImageBitmap` 仅异步返回固定尺寸对象 `{ width: 1920, height: 1080, close() {} }`，属于**底层解码 IO 替身**（无原生 Skia 解码）；
   - 画布上下文 `ctx.drawImage` 为空桩，**未进行硬件光栅化与画布绘制**；
   - 绘制完成后，真实引擎代码调用 `emitStatus({ state: 'playing' })`，该状态流转真实驱动了组件内部 `useEffect`。

### 2.3 三组时序对照验证结果

```text
+-------------------+-----------------------------+-------------------------------+------------------------------+
| 验证条件          | 时序 1：红例 (首帧在前)     | 时序 2：绿例 (首帧在后)       | 时序 3：反事实 (无可用帧)    |
+-------------------+-----------------------------+-------------------------------+------------------------------+
| 首帧触发          | 触发真实 paint()            | 触发真实 paint()              | 无帧抵达 (0 帧)              |
| 渲染器状态        | state: "playing" (真实发出) | state: "playing" (真实发出)   | state: "connecting"          |
| 真实 Effect       | 自动触发 ensureLoaded()     | 自动触发 ensureLoaded()       | 不触发 (0 次调用)            |
| captureStarted    | false (stderr 尚未到达)     | true (stderr 已经就绪)        | false (初始未就绪)           |
| 首读结果          | target.unverified (阻止下发)| ready (6项配置控件全部加载)   | idle (未发生读取请求)        |
| 手动重读 / 重试   | ready (6项字段, 0次写参数)  | N/A                           | N/A                          |
+-------------------+-----------------------------+-------------------------------+------------------------------+
```

---

## 三、排他运行、错因分类与进程监督（R3）

### 3.1 独立目录结构与排他写入
正常测试与故障注入严格分立运行目录，所有文件采用 `{ flag: 'wx' }` 排他写入：
```text
.tmp/rc51-gemini-target-unverified-final-20261027-a/
├── verify-inputs.mjs
├── run-verify-inputs.cjs
├── input-hashes.json                      (13项输入SHA256核验记录, flag: 'wx')
├── reproduce-final.mjs                    (7项完整用例脚本)
├── normal/
│   ├── run-normal.cjs                     (正常模式父监督器)
│   ├── final-normal-report.json           (正常运行完整子报告, flag: 'wx')
│   └── normal-run.json                    (正常监督指标记录, flag: 'wx')
└── fault/
    ├── run-fault.cjs                      (故障注入父监督器)
    ├── final-fault-report.json            (故障运行完整子报告, flag: 'wx')
    └── fault-run.json                     (故障监督核验与错因分类记录, flag: 'wx')
```

### 3.2 正常模式监督结果（`normal/run-normal.cjs`）
- **退出码**：0
- **执行耗时**：673ms（Codex 独立外监督复跑 830ms 退出 0，子进程 677ms 退出 0）
- **子用例结果**：7 / 7 全部通过（`allPassed: true`，`cleanupSuccessfulForAll: true`）
- **核心指标**：
  - `case1Metrics.actualRendererStateAtSchema`: `"playing"`
  - `case1Metrics.captureStartedAtSchema`: `false`
  - `case1Metrics.firstReadResult`: `"未能读取设置，请重试 [target.unverified]"`
  - `case1Metrics.secondReadPhase`: `"ready"`
  - `case1Metrics.authorPostsCount`: `0`（严格零写入）

### 3.3 故障注入监督结果（`fault/run-fault.cjs`）
- **退出码**：0（父监督器确认预期故障后退出 0；子进程退出码为 1）
- **执行耗时**：663ms（Codex 独立外监督复跑 817ms 退出 0）
- **子用例结果**：6 / 7 通过，Case 1 预期失败
- **严格错因分类核验**：
  ```json
  {
    "test": "reproduce-final-fault-injection",
    "expectedFailureConfirmed": true,
    "childCode": 1,
    "case1Passed": false,
    "case1CleanupSuccessful": false,
    "case1SessClosed": false,
    "case1Error": "AssertionError [ERR_ASSERTION]: Session must be verified closed\n\nfalse !== true...",
    "isLogicFailureWithSuccessfulCleanup": false,
    "specificCleanupFailureConfirmed": true
  }
  ```
  父监督器明确断言并证实：
  1. 子进程退出码为 1；
  2. `case1.cleanupSuccessful === false` 且 `case1.cleanup.sessClosed === false`；
  3. 错误确为 `Session must be verified closed`；
  4. `isLogicFailureWithSuccessfulCleanup` 为 `false`（严格拒绝“逻辑断言失败但清理成功”的假故障）。
- **进程截止与未知退出边界说明**：
  - 测试脚本内 `schemaSignal` 为读取响应包装信号，后续由 10ms 轮询观察控制器终态；反事实零帧例为 100ms 观察窗；
  - 脚本内部 `fetch` 与轮询无独立阶段 deadline，整体由外层父监督 25 秒超时及 2 秒 SIGKILL 兜底；
  - 若子进程发生真实超时或异常挂起，监督器兜底分支仅打印 `console.error` 并以非零退出，未写结构化失败 `run.json`。正常退出与指定清理故障已验证，未实测真实强制 kill 分支。

### 3.4 Codex 独立 VM 错因对照证据引用
在 `.tmp/rc51-target-unverified-final-review-20261027-a/` 中，Codex 使用未修改的父监督源码，在 VM 中以替换 child、文件系统及计时器 IO 的方式运行了 3 项独立对照（163ms 退出 0）：
1. **真实清理失败对照**：接受并父退出 0；
2. **逻辑失败但清理成功对照**：拒绝并父退出 1；
3. **缺失子报告对照**：拒绝并父退出 1。
上述结果独立验证了父监督器契约的严密性。

---

## 四、真实输入指纹核验记录（更正转写自 `input-hashes.json`）

测试前通过 `run-verify-inputs.cjs` 严格核验了 13 项关键输入文件的 SHA256，真实比对结果转写如下（杜绝此前路径混淆与哈希错位）：

| 序号 | 来源文件路径 (`source`) | 预期哈希 (`expected`) | 实际哈希 (`actual`) | 匹配 (`match`) | 备注说明 |
|:---:|:---|:---:|:---:|:---:|:---|
| 1 | `rc51-author-read-diagnostic-candidate-20261027-a\unpacked\src\index.js` | `5970769F31A0A0AF9EE87F0C5F0ABDF14741181CC947BBB271305E5E5F2875D4` | `5970769F31A0A0AF9EE87F0C5F0ABDF14741181CC947BBB271305E5E5F2875D4` | true | 固定解包 index 原件 |
| 2 | `rc51-author-read-diagnostic-candidate-20261027-a\unpacked\src\client.js` | `62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8` | `62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8` | true | 固定解包 client 原件 |
| 3 | `rc51-author-read-diagnostic-candidate-20261027-a\unpacked\src\wallpaper\session.js` | `BFD991CF034B590CDF4740A0771E62C23D9C865834611D29F1CC491FA2149E01` | `BFD991CF034B590CDF4740A0771E62C23D9C865834611D29F1CC491FA2149E01` | true | 固定解包 session 原件 |
| 4 | `rc51-author-read-diagnostic-candidate-20261027-a\unpacked\src\wallpaper\author-properties-apply.js` | `14799F8598F0093DF4916B535B62995FC522991BCADFA847EC7DA973E360ADD9` | `14799F8598F0093DF4916B535B62995FC522991BCADFA847EC7DA973E360ADD9` | true | 固定解包 apply 原件 |
| 5 | `rc51-author-read-diagnostic-candidate-20261027-a\unpacked\src\wallpaper\author-properties-host.js` | `E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97` | `E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97` | true | 固定解包 host 原件 |
| 6 | `rc51-author-read-diagnostic-candidate-20261027-a\unpacked\src\wallpaper\managed-window.js` | `6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86` | `6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86` | true | 固定解包 managed-window 原件 |
| 7 | `rc51-author-read-diagnostic-candidate-20261027-a\unpacked\src\wallpaper\scenes.js` | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` | true | 固定解包 scenes 原件 |
| 8 | `rc51-author-read-diagnostic-candidate-20261027-a\unpacked\package.json` | `3C8D61C4786B614E5E01CC359C5242F4E6F8AB7C0D009BD1BD84268D5D0CA189` | `3C8D61C4786B614E5E01CC359C5242F4E6F8AB7C0D009BD1BD84268D5D0CA189` | true | 固定解包 package.json |
| 9 | `rc51-author-read-short-trial-20261027-a\first-read-outcome.json` | `A8A9D2BF64B4A0B07CF45AE02E5D3885306948EA706395D092A449C114B6A671` | `A8A9D2BF64B4A0B07CF45AE02E5D3885306948EA706395D092A449C114B6A671` | true | 现场取证首次读取结果 |
| 10 | `rc51-author-read-short-trial-20261027-a\author-read-failed-status.json` | `85624CDF223FDA647792D6849DD86F90ACFF8FB17D776673BFB2CFA9104BADC5` | `85624CDF223FDA647792D6849DD86F90ACFF8FB17D776673BFB2CFA9104BADC5` | true | 现场取证状态记录 |
| 11 | `rc51-author-read-short-trial-20261027-a\closed-out.json` | `0A7C7E164F1955E684A4BE88F834DFAE28154297EF8209A1C00697499041BFB7` | `0A7C7E164F1955E684A4BE88F834DFAE28154297EF8209A1C00697499041BFB7` | true | 现场取证收尾记录 |
| 12 | `dsh-whale-mist\qa\wallpaper\session.test.mjs` | `37624D4EF4DEC2E99046331BA3FA73D4344A0A30DBF7E67DC663EFAD1DB5D72F` | `37624D4EF4DEC2E99046331BA3FA73D4344A0A30DBF7E67DC663EFAD1DB5D72F` | true | 共享测试基线文件 |
| 13 | `docs\RC51_TARGET_UNVERIFIED_GEMINI_TASK_20261027.md` | `0751FD938273A73368EEA2E0F4588AB390947C437F81462283B7B7FC07F3021B` | `AC38AD6652FF23C5927F076D3B003EB6381945B03B5026ED4F690F5EB386756B` | true | 任务冻结交接副本为 `0751FD93...`；后追加第5节当前文件为 `AC38AD66...`，均确证匹配 |

---

## 五、结论与后续边界

1. **实际调用链已闭环**：
   运行固定 `client.js` 的 `createWallpaperEngine` 与 `AuthorSwitches` 原版 effect，由合法 WHL1 帧驱动底层解码 IO 替身自然发出 `emitStatus({ state: 'playing' })`，进而触发自动读取。完整排除了前次自写 `ClientPlaybackSeam` 模型的人为假设。
2. **定性克制与证据边界声明**：
   - 本次回放确证了“播放状态早于采集就绪信号到达”在离线逻辑上必然导致 `target.unverified`；
   - 此结果是在受控离线管道与底层解码 IO 替身下测得，仍定性为**强因果关联的高置信候选机制**，不轻率宣告 100% 穷尽实机现场全部可能变数；
   - 现场实际微观根因仍未定，不能仅靠单一机制排除其它可能性；
   - 本轮离线诊断与因果接缝验证现已完整收尾，本阶段不进行任何生产修复、轮询/延迟调整或门禁放宽。
3. **后续收尾与接续口径**：
   - 离线因果诊断阶段已闭环，保留全部原件与失败证据；
   - 日常环境（DSH 0.2.1-rc.3、Whale rc.48、Git Bash 0.1.2、WE、Profile、生产 assets、版本号）保持纯净，无安装、无日常操作、无推送清理、无定时任务；
   - 待下一次用户继续时，再行评估最小修复合同与实现。
