# rc.5 实机验收返工：D1–D3 修复与新候选包 0.6.0-rc.6

日期：2026-10-06。范围：只修 `wallpaper-settings-desktop-acceptance.md` 的 D1–D3，未加功能、未安装包、未创建真实 WE 窗口、未退出宿主。
交付包：`release/plugins/dsh-whale-mist-0.6.0-rc.6.tgz`
SHA256：`EEA57B4327B7144E6B9025036FF3FECF3653F59FCA8E47B797A3F5835DDC9305`（26 文件，6.93 MB；rc.5 及更早包全部保留）。

## 1. D1 [P1] 停止后开始/重新开始可能没有背景

**根因**：停止会移除画面层（`unmountWallpaper`），而画面回调在层为空时直接丢帧；重新开始只调用传输层，
没有保证新一轮有层，所以要等某个无关的设置变化触发 `reconcile()` 才出现画面。实机第一轮之后的重复开始就是这样。

**修法**（两层保障，都不依赖用户改参数）：

1. 渲染路径的不变式：`paintWallpaper` 在「当前来源仍是 wallpaper、主题仍启用、本轮仍在运行」时，
   若发现层不存在就先 `mountWallpaper()` 重建层与订阅，再绘制。这样任何代码路径（UI 按钮、测试、将来的调用者）
   都不会因为层缺失而丢帧；
2. UI 路径的即时性：`runPreview` 在开始/重新开始前先用当前选择 `reconcile()` 一次，让层在开始瞬间就位；
   响应返回后若选择代号仍是本次的，再校正一次；来源已切换或主题已停用的迟到响应不会挂层。

旧层与旧订阅不重复：`mountWallpaper` 仍以 `wallpaperLayer` 为唯一实例，`onStop` 会整层移除并撤销订阅。

**反向复现**（实机验收用的 `repeat-preview-repro.mjs`，以副本运行、输出到本轮目录）：

| 指标 | rc.5 | rc.6 |
| --- | --- | --- |
| 第二次开始后是否存在画面层 | false | **true** |
| 改亮度后才恢复画面 | true（被迫） | 不再需要（仍为 true，说明改参数照常工作） |

仓库回归新增 5b/5c：停止后再开始与重新开始都断言「层存在、`data-wm-backdrop="wallpaper"`、帧序增长」，
且不修改任何设置。

## 2. D2 [P2] 新一轮沿用累计帧数与延迟

**根因**：`metrics` 与延迟累计只在控制器创建时初始化；新一轮只重置了 `startedAt` 与状态里的 `rendered`，
底层计数仍是历史累计，导致 UI 帧率虚高、提交给 Host 的指标也偏大。

**修法**：新增 `resetRunMetrics()`（`received`/`rendered`/`dropped`/`sourceSequence`/`decodeErrors`/延迟累计/隐藏标记），
在 `connect()` 开头、且仅当 `runGeneration === generation` 时执行——即真正取得本轮启动成功后才归零，
旧代号的回调无法影响新一轮。`stop()` 同时清掉本轮的计时基准（`startedAt = 0`），
所以停止后的状态显示 `0` 秒，而不是上一轮的累计时长。

**反向复现**：`repeat-preview-repro.json` 中第二次开始的绘制数在 rc.5 是从上一轮继续累加，
rc.6 为 `afterSecondStartRendered = 8`（本轮自身计数，约 0.36 秒）。

仓库回归新增断言：每轮提交给 Host 的指标样本必须落在该轮实际绘制/接收数之内（`rendered ≤ 本轮 rendered`、
`received ≤ 本轮 received`），秒数属于本轮；`restart` 同样按新轮次归零。这覆盖了「不能只改文字显示」的要求。

## 3. D3 [P2] WE 背景选项误标成“背景壁纸”

**根因**：通用 `row()` 对背景选项直接取 `copy[value]`，而 `copy.wallpaper` 是章节标题“背景壁纸”，
于是实验来源的按钮显示成章节名，用户找不到入口。

**修法**：背景来源里 `wallpaper` 这一项改用 `copy.wallpaperEngine`（中文「Wallpaper Engine（实验）」、
英文「Wallpaper Engine (experimental)」）；章节标题（`wm-settings-subtitle`）仍用 `copy.wallpaper`，
原意保留；`none`/`image`/`video` 文案不变。

**回归**：断言不再只检查 `data-wm-value=wallpaper` 存在，而是读取选项真实文字——中文选项含
「Wallpaper Engine」且不等于「背景壁纸」，章节标题仍精确为「背景壁纸」，另外三项文案不变，
英文环境下选项也含「Wallpaper Engine」（临时切换 `navigator.language` 后复原）。

## 4. 检查结果（无窗口）

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test:sdk-contract`（真实 Cordis Context） | 通过（退出码 0） |
| Host 测试 | **34 项通过 / 0 失败**（session 17 + routes 17） |
| 浏览器侧（WE） | **66 项断言通过**（rc.6 前为 47），含 D1/D2/D3 新增回归、stall / recovery / healthy 三组输出 |
| 原有外观回归 | 30 项断言通过 |
| `git diff --check` | 无行尾空格 |

证据目录：`.tmp/wallpaper-settings-rework-20261005/`（`repeat-preview-after-fix.mjs` 与两份 json、
`browser-repro-u1.mjs`、历史复现输出、`sdk-contract.json`）。本轮的 `repeat-preview-after-fix.mjs`
只改输出文件名与 root，使用自己创建的目录，并在结束后结束浏览器进程与临时目录。

## 5. 包与一致性

- `release/plugins/dsh-whale-mist-0.6.0-rc.6.tgz`，SHA256 见文首；`0.5.0`、`0.5.2`、`0.6.0-rc.1`–`rc.5` 全部保留。
- 包内 10 个文本文件与源码逐文件 SHA256 一致；`assets/wallpaper/WallpaperProbe.exe` 与 `qa/wallpaper-probe/bin` 一致。
- 原生依赖与样例范围不变（框架依赖、需 .NET 10；仅 Lucy）。

## 6. 实机复测建议（按验收报告口径）

审阅通过后只需复测受影响场景：重复开始、重新开始、新一轮计数与倒计时、入口文案
（含英文界面）；已通过的播放与退出清理可引用 `wallpaper-settings-desktop-acceptance.md`，除非实现再次变化。
本轮未创建真实窗口，`wallpaper64` 与桌面壁纸未受影响，日常 Profile 仍是 rc.1，未提交未推送。
