# B：日常持续播放与启动闪窗优化——交付报告（rc.15 R1–R3 返工版）

日期：2026-10-07。状态：**R1–R3 已返工，待 Codex 复审与用户实机确认**。
起点 `main @ d542ffc`。版本演进：rc.8 → rc.9（R1–R5）→ rc.10（T1–T4）→ rc.11（S1）→ rc.12（L1 布局）→
rc.13（U1 收尾，实机核心验收通过）→ rc.14（V1–V3，复审未通过）→ **rc.15（R1–R3 返工）**，未安装、未提交。

依据：rc.14 视觉复审（原文 `F:\deepseekharness\.tmp\b-visual-rc14-review-20261007-111030\RC14_VISUAL_REVIEW.md`，
本轮不复制该证据）、[本轮整改范围](../../docs/NEXT_RC14_VISUAL_POLISH.md)。
范围文档：[B 日常持续播放](../../docs/NEXT_B_DAILY_PLAYBACK.md)。

## 0. 本轮（R1–R3）与验收边界

| 项 | 状态 |
| --- | --- |
| R1 顶栏修复把整张壁纸遮掉 | 已修复：只清 frame 背景 + 只给顶部条 `::before` 上色；像素检查证明内容区与侧栏仍见壁纸 |
| R2 遮挡测试假通过（透明渐变判为不透明） | 已修复：解析器去掉模板反斜杠陷阱 + `CSS.supports` 拒绝无效色 + 解析器 sanity + 负对照 |
| R3 按钮组漏 `display`，间距 0，280px 停止落单 | 已修复：`display: flex` + 真实 8px 间距；≤320px 容器整组单列 |
| 检查手段 | 新增**渲染像素**检查（真实宿主 CSS 层级 + 官方声明基线 + 截图采样），旧样式检查已被取代 |
| 检查结果 | `check`（含新增 CSS 模板守卫）、外观 30、壁纸外观 136、布局（6 宽度）、像素、Host 46、SDK 契约 |
| 实机确认 | **未做**：真实高透明度、缩放/最大化、多行输入滚动仍待用户点击 |

Host、原生、长期帧循环与资源归属未改，因此未重建 `WallpaperProbe`，也未重复 35 分钟长跑。

## 1. R1：顶栏修复把整张壁纸遮掉（P1）

**根因**：宿主对同一个框架元素做了两件事——
`[data-windows-titlebar] .BynINW_frame` 用侧栏填充色绘制**整个应用框架**（同时加
`padding-top: 标题栏高度`），而它的 `::before` 才是那条 `inset: 0 0 auto`、高度恰为标题栏高度的拖拽条。
rc.14 把两者都涂成实色，于是覆盖了整个视口。

**修法**：把 frame 本体的背景**清成透明**，只给 `::before` 上主题实色。padding-top 那条带仍由
`::before` 覆盖，侧栏列与内容列各自的背景不受影响，因此壁纸在内容区与侧栏照常可见。

**实测（渲染像素，1000×600，壁纸为纯洋红、35% 不透明度）**：

| 采样点 | rc.14 | rc.15 |
| --- | --- | --- |
| 顶部条 (500,16) | 全遮 | `rgb(8,11,20)` 不透明（遮住源装饰） |
| 聊天区 (610,92) | `rgb(8,11,20)`，只剩实色 | `rgb(178,0,178)`，壁纸可见（宿主 6% 底色叠加） |
| 侧栏 (110,284) | 无壁纸 | `rgb(121,8,129)`，壁纸透过半透明侧栏 |

`rgba(0,0,0,0)` 的 frame 背景与 178/0/178、121/8/129 的实测像素共同证明壁纸仍被呈现。

## 2. R2：遮挡检查假通过（P2）

**根因**：检查脚本里 `part.split(/\s+/)` 位于模板字符串中，`\s` 到浏览器变成 `s`，长度没被剥掉，
`style.color` 被赋了带长度的无效值而被忽略，探针于是读到继承的前景色并返回 alpha 1——
**完全透明的渐变被判成不透明**。

**修法（检查侧，生产保护保留）**：

- 解析器不再使用正则，改为纯字符串/字符扫描；赋值前用 `CSS.supports('color', value)` 拒绝无效颜色。
- 加入解析器 sanity：透明对 `0`、半透明停点 `0.35`、不透明 `1`、带长度颜色 `null`、非颜色 `null`。
- 新增**负对照**：把输入区遮挡规则去掉后，检查必须失败——实测得到
  `the composer gradient ends opaque, got 0 (linear-gradient(color(srgb 0 0 0 / 0) 0px, rgba(0, 0, 0, 0) 36px))`。
- 换掉只读计算样式的旧检查：新增 `qa/appearance-wallpaper-pixels.mjs`，在**真实层级**上截屏采样
  （壁纸层在后、frame/列/输入区在前），并保留 `npm run test:appearance-wallpaper-overlay`
  作为转发入口，避免旧命令继续给出假结论。

## 3. R3：按钮组漏 `display`、间距 0、280px 停止落单（P2）

**根因**：rc.14 把原来的 `wm-media-actions`（自带 `display: flex`）换成了只有
`flex-wrap/align-items/gap` 的 `.wm-wallpaper-actions`，块级盒子里 `gap` 与子项 `flex` 都不生效：
三按钮 0 间距，280px 下开始/重启同排、停止落到下一排。

**修法**：补 `display: flex`；正常宽度下三按钮等宽同排（真实 8px 间距）；
用容器查询让「整组单列」在**容器自身** ≤320px 时生效，停止不再落单，也不依赖整窗宽度。

**实测（隔离真实设置 DOM）**：

| 面板宽度 | display | 实测间距 | 行数 | 按钮宽 | 高 | 字号 |
| --- | --- | --- | --- | --- | --- | --- |
| 720 / 640 / 560 / 480 / 400px | flex | 8px / 8px | 1 | 235 / 208 / 181 / 155 / 128px（等宽） | 36px | 14px |
| 280px | flex | 8px / 8px | 3（单列） | 280px ×3 | 36px | 14px |

对比 rc.14：`display: block`、实测间距 0px、280px 时 `stopAlone: true`。

## 4. 负对照（证明新检查真的能抓住旧缺陷）

把 rc.14 的 `src/client.js` 放进同一套新检查下运行：

- 布局检查失败于 `panel 720px: the action group is a flex container, got block`；
- 像素检查失败于 `the application frame is cleared so the wallpaper can show, got rgb(8, 11, 20)`；
- 遮挡检查在禁用输入区遮挡时失败于渐变末端 alpha `0`（见 R2）。

修复版在同一套检查下全部通过；这组对照是本轮新增检查可采信的依据。

## 5. 检查结果

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 通过，并新增 `qa/css-template-guard.mjs`（防止 CSS 模板里的反引号与单反斜杠再次酿成缺陷） |
| `npm run test:appearance` | 30 项通过 |
| `npm run test:appearance-wallpaper` | 136 项通过（逻辑与就绪/模式语义未回退） |
| `npm run test:appearance-wallpaper-layout` | 6 个面板宽度（含 280px）+ 窄视口 + 长文案；断言 display、真实间距、等宽/单列、按钮尺寸与底色 |
| `npm run test:appearance-wallpaper-pixels`（新） | 顶部条 / 聊天区 / 侧栏 / 输入区四点像素 + 解析器 sanity，全部通过 |
| `npm run test:wallpaper-host` | 46 项通过（未改 Host，作回归确认） |
| `npm run test:sdk-contract` | 通过；加载本检出源码 |

## 6. 候选包

- 路径：`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.15.tgz`
- SHA256：`A3C6886C87C4C956CB17BA13BE96C4638595CDBC8E515307A5B7C5009E3C83F3`
- 大小 6.95 MB，26 个文件；rc.15 在两个工作区此前都不存在，rc.8–rc.14 及更早归档未改动。
- 相对 rc.14：包内只有 `src/client.js`（R1 清 frame 背景、R3 补 display 与单列规则）、
  `README.md`（版本段）、`package.json`（版本号与检查命令）改变；Host、原生、资产未变。
  检查脚本不随包发布，改动记录在本报告与源码检出的 `qa/` 目录。
- 未安装、未提交、未退出 DSH、未操作真实壁纸窗口；用户日常仍为 rc.1。

## 7. 未验收项与边界

真实 DSH 中的高透明度顶部表现、缩放/最大化、多行输入滚动、真实按钮观感需用户短实机确认；
启动闪窗实验与 GPU 增量对照仍在其后。本轮结论来自隔离浏览器 DOM 与渲染像素检查，
**不等于真实宿主验收**；共享 WE 单 GPU 引擎的开销结论沿用 rc.13 实机记录，未在本轮重测。


## rc.14 交付记录（历史）

日期：2026-10-07。状态：**V1–V3 三处视觉问题已按整改单修复，待 Codex 复审与用户实机确认**。
起点 `main @ d542ffc`。版本演进：rc.8 → rc.9（R1–R5）→ rc.10（T1–T4）→ rc.11（S1）→ rc.12（L1 布局）→
rc.13（U1 收尾，已通过实机核心验收）→ **rc.14（V1–V3 视觉整改）**，未安装、未提交。

依据：[本轮整改范围](../../docs/NEXT_RC14_VISUAL_POLISH.md)、[rc.13 实机验收](../../docs/B_DAILY_PLAYBACK_RC13_DESKTOP_ACCEPTANCE.md)、
[rc.13 代码复审](../../docs/B_DAILY_PLAYBACK_RC13_REVIEW.md)。
范围文档：[B 日常持续播放](../../docs/NEXT_B_DAILY_PLAYBACK.md)。

## 0. 本轮范围与边界

| 项 | 状态 |
| --- | --- |
| V1 高透明度下 DSH 顶部透出源窗口标题栏 | 已修复：顶栏与拖拽条强制为主题实色 |
| V2 聊天历史透过输入区域 | 已修复：输入区座位、覆盖层与输入卡片恢复实色遮挡 |
| V3 停止按钮落单、偏小、不醒目 | 已修复：字段与按钮分组，三按钮统一 36px / 14px 并带底色边框 |
| 修改范围 | 仅 `src/client.js`（样式与 WE 设置区结构）与版本号；Host、原生、资产未改 |
| 检查 | `check`、外观 30 项、壁纸外观 136 项、布局回归、**新增遮挡回归**、Host 46 项、SDK 契约 |
| 实机确认 | **未做**：真实 DSH 布局、高透明度、缩放/最大化、多行输入滚动仍待用户点击 |

三处改动都只作用于**壁纸背景呈现时**的主题状态，或只作用于 WE 设置区；普通主题、其它设置区、
图片/视频背景、Host 与播放语义均未改动。

## 1. V1：DSH 顶部透出独立源窗口标题栏

**根因**：宿主用侧栏填充色绘制 Windows 标题栏条（`[data-windows-titlebar] .BynINW_frame` 与它的
`::before` 拖拽条都取 `--dsw-specific-sidebar-fill`），而本主题把该变量变成
`rgb(var(--wm-sidebar-rgb) / var(--wm-ui-alpha))`。界面不透明度越低，顶栏越透明，
位于其后的源窗口标题文字（截图中的 `Probe...`）就越明显。

**修法**：在壁纸状态范围内把顶栏条与拖拽条重新画成主题实色 `rgb(var(--wm-base-rgb))`，
**不随 surface 变化**；侧栏保持用户选择的透明度。限定方式写成
`html[data-windows-titlebar]:has(body:is(.…-active)[data-wm-backdrop][data-wm-canvas]) …`：
标题栏钩子在 `html` 上，壁纸状态在 `body` 上，写成前置 `body` 选择器会要求 `html` 是 `body` 的后代，
永远不匹配（本轮实测踩到过这一点，已在代码注释里写明）。

**实测（隔离 DOM，含官方基线规则）**：

| 状态 | 顶栏条 | 顶栏（frame 背景） | 侧栏 |
| --- | --- | --- | --- |
| 壁纸，不透明度 35% | `rgb(8, 11, 20)` 不透明 | `rgb(8, 11, 20)` 不透明 | `rgba(15, 23, 38, 0.35)` 半透明 |
| 壁纸，不透明度 100% | `rgb(8, 11, 20)` 不透明 | `rgb(8, 11, 20)` 不透明 | `rgb(15, 23, 38)` 不透明 |
| 普通主题（无壁纸） | `rgba(15, 23, 38, 0.94)` | 同左 | 同左 |

即：顶栏在两种不透明度下都不透光，侧栏仍按用户设置。未用「固定放大/上移壁纸」方案，
也未改源窗口为 SW_HIDE 或工具窗口；**不宣称源帧已无标题栏**。

## 2. V2：聊天文字滚到输入区域仍穿过去

**根因**：宿主的输入区座位用
`linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-bg-base) 0%, transparent) 0, var(--dsw-alias-bg-base) 36px)`
做底部遮挡渐变；本主题在壁纸状态把 `--dsw-alias-bg-base` 设为 `transparent`，
整条渐变随之全透明，滚动到输入区的历史文字因此可见（复审隔离对照已复现：
普通态 36px 处 `rgb(8,11,20)`，壁纸态 `rgba(0,0,0,0)`）。

**修法**：在壁纸状态范围内，把输入区座位重新画成主题实色遮挡
（`html:has(<壁纸状态>) [data-phase="active"] .Dc7zOa_composerSeat`，
以及座位与覆盖层 `[data-conversation-composer-overlay]` 的 `background-color`、
输入卡片 `.Dc7zOa_composerSeat .RlGAzG_card` 的实色背景）。
范围限定在输入区，**没有恢复整个 body 不透明**，壁纸其余区域照常显示。

**实测**：

| 状态 | 座位渐变最后一段 | 输入卡片 |
| --- | --- | --- |
| 壁纸，不透明度 35% | alpha **1**（`linear-gradient(rgb(8, 11, 20) 0px, rgb(8, 11, 20) 100%)`） | `rgb(8, 11, 20)` 不透明 |
| 壁纸，不透明度 100% | alpha **1** | `rgb(8, 11, 20)` 不透明 |
| 普通主题 | alpha 1（宿主自带渐变保持） | 宿主值 |

座位用 `background` 简写，会重置 `background-color`，所以该处断言看的是渐变末端 alpha，
而不是 `background-color`；这一点已在检查里写清，避免以后误判。

## 3. V3：停止按钮落单且太小、不醒目

**根因**：场景、模式与三个按钮同在一个可换行容器里；560px 面板下「开始播放」「重新开始」占一行，
「停止播放」被挤到下一行，且三按钮均为 68×30px、12px 字、背景透明（复审
`visual-repro.json` 记录了 720/640/560/480/400px 五个宽度的坐标与尺寸）。

**修法**：

- 结构上分成两组：`wm-wallpaper-fields`（场景、模式）与 `wm-wallpaper-actions`（三个按钮）。
- 三个按钮加 `wm-wallpaper-button`：`flex: 1 1 0`、`min-width: 96px`、`min-height: 36px`、
  14px 字，并给出实色背景与 1px 边框、主题前景色；悬停变亮。
- 只作用于 WE 按钮，未改全局 `.wm-settings-option`，其它设置区不受影响。
- `disabled`、busy、清理失败可重试的语义、`data-wm-action` 钩子与控制器调用完全未变。

**实测（隔离 DOM，1280px 视口）**：

| 面板宽度 | 三按钮同一行 | 高度 | 宽度 | 字号 | 背景 | 边框 | 横向溢出 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 720px | 是 | 36px ×3 | 96px ×3 | 14px | `rgb(23, 34, 54)` | 1px solid | 0 |
| 640px | 是 | 36px ×3 | 96px ×3 | 14px | 同上 | 1px solid | 0 |
| 560px | 是 | 36px ×3 | 96px ×3 | 14px | 同上 | 1px solid | 0 |
| 480px | 是 | 36px ×3 | 96px ×3 | 14px | 同上 | 1px solid | 0 |
| 400px | 是 | 36px ×3 | 96px ×3 | 14px | 同上 | 1px solid | 0 |

修复前：560px 时停止按钮单独在下一行；三按钮均 68×30px、12px 字、`rgba(0, 0, 0, 0)` 背景。

## 4. 检查结果

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test:appearance` | 30 项断言通过 |
| `npm run test:appearance-wallpaper` | 136 项断言通过（逻辑与就绪/模式语义未回退） |
| `npm run test:appearance-wallpaper-layout` | 5 个面板宽度 + 窄视口 + 长文案；**本轮加入 V3 断言**（分组、同行、≥36px、等宽、14px、可见底色与边框、停止按钮可点击面积） |
| `npm run test:appearance-wallpaper-overlay`（新） | **3 个状态全部通过**：V1 顶栏不透明、侧栏按设置、V2 渐变末端不透明与卡片实色、普通主题不受影响、规则确实命中（避免空过） |
| `npm run test:wallpaper-host` | 46 项通过（未改 Host，作回归确认） |
| `npm run test:sdk-contract` | 通过；加载本检出源码 |

新增遮挡回归的要点：把官方对这些元素的实际声明原样复制到隔离页作为**基线**（否则主题什么都不写也会通过）、
按状态断言主题规则确实选中目标元素、用计算值而非文本匹配判断不透明度、
并明确区分「隔离 DOM 检查」与「DSH 实机」。

## 5. 候选包

- 路径：`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.14.tgz`
- SHA256：`F94D429BDE366303E238E03F9D058EE1E15AE804A6B20CC0DE218A0DE69EFCE8`
- 大小 6.95 MB，26 个文件；rc.14 在两个工作区此前都不存在，rc.8–rc.13 及更早归档未改动。
- 相对 rc.13：包内只有 `src/client.js`、`README.md`、`package.json` 改变
  （V1/V2 遮挡规则、V3 分组与按钮样式；README 版本段与检查命令；版本号）。
  Host、原生、资产未变，因此未重建 `WallpaperProbe`。
- 未安装、未提交、未退出 DSH、未操作真实壁纸窗口；用户日常仍为 rc.1。

## 6. 模拟与真实的边界

本轮全部结论来自隔离浏览器 DOM 检查（复制官方声明的基线 + 真实插件样式表 + 计算值断言），
**不是** DSH 实机验收：真实窗口的层叠上下文、`color-mix`、`data-phase` 的实际取值、
多行输入滚动与缩放/最大化表现都可能在实机不同。请用户短实机确认三项，
尤其是高透明度、缩放/最大化与多行输入滚动；不需要机械重复 35 分钟长跑。
启动闪窗实验与 GPU 增量对照仍在后续安排，不在本轮。
