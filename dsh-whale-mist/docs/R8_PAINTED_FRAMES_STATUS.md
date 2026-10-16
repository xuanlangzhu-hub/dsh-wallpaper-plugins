# R8 第三轮：输出边界已修；绘制帧证据"原因未区分"（本文结论已按第四轮复审修正）

> **2026-10-08 修正（依 [R8_THIRD_REVIEW.md](../../docs/R8_THIRD_REVIEW.md)）**：
> 本文下面「滚动中的截图会落后一帧」以及由此得出的"已推翻自然滚动泄漏"**撤回**。
> 两条原因：①`scroll-painted-view.mjs` 把页内 `performance.now()` 与 Node `Date.now()` 直接比较，
> 所有帧必然配到最后一条 tick，"98 帧 scrollTop 全 0"是该 bug 的产物；
> ②第一张有字、第二张无字只能说明所读状态与两次异步取图不一致，不能唯一归因于旧帧。
> 原始图片与数据保留，判据改为"原因未区分"。修正后的结论见
> [R8_TIMEBASE_AND_BOUNDARIES.md](R8_TIMEBASE_AND_BOUNDARIES.md)：校准后**裁剪写入没有落后**，
> 且滞后帧与带内文字**不相关**，「滞后」与「旧帧」两个解释都不成立。

2026-10-08。基线 rc.20。依据 [R8_SECOND_REVIEW.md](../../docs/R8_SECOND_REVIEW.md)。
本轮按复审只做两项。**`src/client.js` 未改动，未出 rc.21。**

## 第二项：输出保护（已完成，可验收）

`qa/temp-profile.mjs` 新增三件东西：

- `assertOutsideProfiles(path, label)`：拒绝任何解析后落在**本轮已创建 profile** 内的路径，
  同时检查父子两个方向（既拒绝 profile 内的文件，也拒绝把 profile 包在里面的目录）。
- `evidencePath(envName, runDir, fileName)`：所有检查的报告路径统一走它。环境变量覆盖会被先校验，
  不合格直接抛错；默认落在 `runDir`。
- `createRunDirectory()`：默认基目录为 `dsh-whale-mist/.tmp`，且用 `mkdtemp` 生成**真正唯一**的新目录
  （不再用 `Date.now()`，避免同毫秒同标签互相覆盖）；`WM_RUN_DIR` 会被先校验。

已接入：`layout`、`regions`（含 supplement）、`sidebar-band`、`pixels`、`scroll-clip-frames`、
`band-identity`、`below-card`。

自测（`selfcheck-output.mjs`，全部只用本轮合成目录）：

| 用例 | 结果 |
| --- | --- |
| 两个同标签 run 目录 | 路径不同（唯一） |
| `WM_RUN_DIR` = profile 本身 | 拒绝 |
| `WM_RUN_DIR` = profile 子目录 | 拒绝 |
| `WM_PIXEL_OUTPUT` = profile 内文件 | 拒绝 |
| 覆盖在 profile 外 | 采纳并创建、校验通过 |
| 对 profile 内已存在文件调用 `verifyPersisted` | 拒绝 |
| 目标目录把 profile 包在里面 | 拒绝 |
| 默认证据在 cleanup 后仍存在、profile 已删除、登记表清空 | 通过 |

复审提到的复现方式（"verify 成功、报告最后不存在"）在现在这版已经不可能出现：写入前就会被拒。

## 第一项：真实绘制帧（做到了一半，且推翻了一个我先前的说法）

### 已建立

- `qa/scroll-candidate-leak.mjs`：反向滚动逐步进行，每步读裁剪边界（并与应有值对比）
  + 取图 + 统计卡片下方/两侧带的黄色像素。**负对照 `WM_LAG_EXTRA=160` 时 10 例中 9 例报泄漏**，
  证明检测能力；rc.20 自然滚动 22 例 **0 泄漏**、停稳样本干净。
- `qa/scroll-paint-compare.mjs`：同一滚动过程连拍两张，并在每张前后各读一次状态。
- `qa/scroll-painted-view.mjs`：`Page.startScreencast`（JPEG、quality 92、`everyNthFrame=1`、
  逐帧 `screencastFrameAck`），页内导出逐帧表（帧时间、scrollTop、clip、卡片位置）与报告一起落盘；
  帧文件写到 `runDir/frames/`。QA 侧用 `CSSStyleDeclaration.prototype.setProperty` 钩子记录
  `--wm-history-clip-bottom` 的每次写入（不改生产代码）；`WM_DELAY_CLIP_FRAMES=1` 可把 RAF 回调整体
  推迟一帧，作为"明确延迟更新"的负对照。

### 决定性发现：滚动进行中的 `Page.captureScreenshot` 会返回落后一帧的画面

连拍四组，每组前读状态、拍两张、后读状态：

| 组 | scrollTop | clip | 应有 clip | 第 1 张（下方/两侧） | 第 2 张 |
| --- | --- | --- | --- | --- | --- |
| 0 | 2240 | 198 | **198** | 0 / 0 | 0 / 0 |
| 1 | 800 | 1638 | **1638** | **1740 / 2223** | **0 / 0** |
| 2 | 480 | 1958 | **1958** | 0 / 0 | 0 / 0 |
| 3 | 480 | 1958 | **1958** | 0 / 0 | 0 / 0 |

两个结论：

1. **裁剪并不滞后**：每一步 `clip` 都恰好等于 `view.bottom - cardTop`（198、1638、1958…）。
   也就是说主题在滚动事件期间就已经把裁剪更新到位，不是等到下一帧才补。
2. 第 1 组里第 1 张截图显示卡片周围有文字，但同一时刻读到的状态是"边界正确"，第 2 张随即干净。
   这只能解释为**截图返回了滚动前的旧画面**。因此我此前基于"滚动中途截图"得出的
   「自然滚动会漏字」是**假象，撤回**。

### screencast 的进展与限制（如实记录）

- `Page.startScreencast` 可用，帧能到、ack 正常（一次运行收到 98 帧，另有流程收到 22–24 帧）。
- 但与滚动对齐失败：把帧按到达时间配到最近的逐帧记录后，**98 帧的 scrollTop 全是 0**，
  而同一进程里用 `Runtime.evaluate` 读到的 scrollTop 明明在变（2240→2080→…→800）。
  即 screencast 交付的是积压/重复的旧画面，不能直接当"当帧画面"用。
- 负对照（`WM_DELAY_CLIP_FRAMES=1`，把 RAF 回调整体推迟一帧）跑出 100 帧、其中 5 帧卡片下方有文字，
  但**这 5 帧的 scrollTop 同样是 0**：它们出现在滚动开始之前（那时裁剪尚未应用），
  无法据此判断"滚动过程中是否画了旧值"。
- 所以 screencast 这一路**当前不能用于定论**：不是"无头浏览器读不到帧"，而是**帧的时效性**问题——
  需要按 `metadata.timestamp` 与页内 `performance.now()` 统一时基、丢弃过期帧之后再判断，
  并且该方法的负对照必须能稳定抓到"滚动中"的画面才算可用（现在做不到）。
  `metadata.scrollOffsetY` 在本环境恒为 0，不可用。
- 因此"自然滚动下是否真实漏字"**仍未闭合**。现有全部证据（裁剪逐步对齐、22 例抽样 0 泄漏、
  负对照 9/10 有效）都指向"没有漏字"，但我还没有拿到一份时间戳可信的连续绘制帧序列来定论。

## 下一步建议（只做这一件）

给 screencast 帧建立可信时间轴：客户端在每帧记录 `performance.now()` 与 clip，
服务端用 `metadata.timestamp`（CDP 的单调时钟）换算到同一时基，**丢弃早于最近一次滚动事件的帧**，
只保留"该帧时间戳落在某次滚动之后、下一次滚动之前"的帧，再判断这些帧里是否有卡片周围的文字。
**判据**：`WM_DELAY_CLIP_FRAMES=1` 的负对照必须在"滚动中"的帧上抓到文字；抓不到就说明方法仍不可用，
不能据此报告任何结论。

如果这条路仍走不通，退路是：把"边界是否落后"作为主判据（`clip` vs `view.bottom - cardTop`），
它在两种模式下都可精确测量，并配一个把裁剪真正写迟一帧的负对照；这样即使没有可信绘制帧，
也能证明/否定"边界落后"这一机制本身，而不再依赖截图时机。

## 已确认不变的部分

顶部遮挡、左上角点、侧栏暗带、两个区域开关、消息裁剪、host 46 项与 SDK 契约全部照旧通过；
`src/client.js` 一行未改；未安装、未退出 DSH、未创建真实 WE 窗口；历史临时目录未动。
