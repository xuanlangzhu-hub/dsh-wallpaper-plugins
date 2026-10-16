# R8 第五轮：F1–F4 已处理，裁剪改为滚动时同步更新；固定区域像素信号仍在，未闭合

2026-10-08。基线 rc.20。依据 [R8_FOURTH_REVIEW.md](../../docs/R8_FOURTH_REVIEW.md)。
**本轮改动了 `src/client.js`**（第一处生产修改），未出 rc.21。

## F1/F2：收回排他性结论

同意复审。固定屏幕区域里存在消息色像素，就是可用的失败信号；配对误差只能影响**因果解释**，
不能把图里实际存在的像素解释掉。已收回的说法：

- 「已推翻自然滚动泄漏」
- 「裁剪始终正确」
- 「16 个样本只是采样顺序假象」
- 把平均 1.44 ms 当作"画面归属已验证的误差"（frame-pairing 仍按绝对差取最近样本，
  可能选到帧生成**之后**的样本；该近似已标注，不再用于否定早先画面）

保留的说法：**写入记录未检测到计算值落后**（这一条只描述写入值与写入当时几何的关系）。

## F3：传输延迟换算（已修）

`frame-pairing.mjs` 原先算 `deliveredAtEpochMs - generatedPageTime`（epoch 减页面相对时间，
得到的数字接近 `timeOrigin`，毫无意义）。现在要求同时传入 `generatedAtEpochMs`，
计算 `deliveredAtEpochMs - generatedAtEpochMs`；无该字段时 `measured = 0`，
不再拿混用结果充当延迟。人工回归改为真实同一 epoch 的数值：

- 正常投递 → `minOffsetMs ≈ 5.8`（小毫秒数）；
- 提前 20 ms 投递 → 被识别为 `early`，偏移为 −20；
- 缺 epoch 生成时间 → `measured = 0`（不可测，不冒充延迟）。

`pairing checks: 8/8 passed`。

## F4：目录回归加断言（已修）

`temp-profile-boundaries.mjs` 重写：每个用例都断言**预期结果**（`expectRefused(label, 期望理由, action)`），
setup 失败（junction 创建不成功）直接失败而非跳过，finally 里先解除本次 junction、
再恢复环境变量与被冻结的 `Date.now`、最后只清理本次登记的目录；失败时 `process.exitCode = 1`。

实跑：`boundary regression: 11/11 passed`，退出码 0。用例含直路径、junction 路径、
**junction 下尚不存在的后缀**、junction 下已存在文件、自定义基目录落在 profile 内、
默认/自定义/冻结时钟三组唯一性、正常外部覆盖、cleanup 后证据仍在。

## 生产修正：裁剪在滚动事件里同步计算

`src/client.js` 改动（`git diff --stat`：32 insertions, 7 deletions）：

把裁剪值计算抽成 `applyHistoryClip(view, cardTop)`，新增 `updateHistoryClip()`，
并让滚动监听调用 `onHistoryScroll()`（先同步重算，再照旧排队 RAF 全量测量）：

```
document.addEventListener("scroll", onHistoryScroll, true);
```

理由（写在代码注释里）：`scroll` 事件在位置变化之后、下一次绘制之前触发，
在这里重算 `view` 与 `card` 两个盒子，边界就和内容处在同一帧；
原先只排到下一次 RAF，边界描述的是上一个滚动位置。
观察者（ResizeObserver / MutationObserver）保持不变，仍负责不产生滚动事件的布局变化。
没有整体裁掉含 composer 的父层、没有移动 React 节点、没有劫持滚轮、没有加大黑罩。

## 实测效果

同一入口（`scroll-calibrated-frames.mjs`，reverse 场景，143 帧全部配对成功）：

| 指标 | 旧版 rc.20 | 修正版 |
| --- | --- | --- |
| `samplerLagging`（可见下界越过卡片顶的样本） | 16 | **0** |
| `staleFrames`（该帧边界落后） | 7–12 | **0** |
| 配对 | 141 帧 matched 141 | 143 帧 matched 143，平均误差 1.54 ms |
| 固定区域（y 673–699）消息色像素帧 | 8–11 | **5–8** |

几何层面的滞后**已被这次修正彻底消除**（`samplerLagging`/`staleFrames` 归零），
这是可复现的改进。

## 仍未闭合：固定区域的像素信号

严格模式（`WM_STRICT=1`，断言卡片位置固定、断言对照带能看到正常内容、禁止区域出现消息色像素即失败）
在修正版上仍然失败：每轮 5–8 帧在 y 673–699 检出 1740–2262 个黄色像素。
已有的判据与对比：

- 卡片位置在整轮内恒为 `[552,672]`（`ROI.valid = true`），固定区域定义有效；
- 对照带（卡片上方 60px）在 133/143 帧有文字 → 扫描确实在读消息层；
- 泄漏帧的投递延迟 6.5–8.5 ms、配对误差 1.6–2.1 ms，与干净帧（延迟 4.2–17.1 ms、误差 0–3.5 ms）
  **没有可区分差异**，所以"图晚到"这个解释缺少支持；
- 人工看原图（`leak-0-scrollTop1678.jpg`）：黄色消息条从聊天列顶部一直铺到卡片下方，
  卡片浮在其上——看起来更像 `clip-path` 在该帧整体未生效，而不是边界落后；
- 但我为区分这两者加的两层判定（列顶 100–160、层中 cardTop−420…−360）在页面返回值里是 `null`，
  原因未查明（同一返回对象里 `belowCard` 正常，仅这两个字段为空）。

**因此本轮不宣称闪字已修**。像素信号在旧版与修正版都存在，而修正版消除了几何滞后；
两者之间的关系仍待一个不依赖 screencast 投递的解释来判定。按复审要求，未拿到可信闭环前不出 rc.21。

## 下一步（一条，不再堆近似探针）

给这两层判定查清 `null` 的来源（页面侧 `count(100,160)` 的返回值为什么没有到达 Node 侧），
拿到"该帧裁剪是否整体未生效"的判据后，就能把「边界落后」与「裁剪未生效」分开；
届时应能在修正版上判定像素信号是否随之消失。在此之前不改更多生产代码。

## 已确认不变

顶部遮挡、左上角点、侧栏暗带、两个区域开关、消息裁剪（历史像素检查）、host 46 项与 SDK 契约
全部通过；未安装、未退出 DSH、未创建真实 WE 窗口；历史临时目录未动。
