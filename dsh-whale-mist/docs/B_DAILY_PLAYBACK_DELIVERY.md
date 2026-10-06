# B：日常持续播放与启动闪窗优化——交付报告（rc.13 U1 收尾版）

日期：2026-10-06。状态：**L1 竖排问题已复审通过；U1 自动播放复选框拉伸已修复，待短复审；
真实设置布局与 35 分钟日常播放实机验收均未开始**。
起点 `main @ bf96cbb`。版本演进：rc.8 → rc.9（R1–R5）→ rc.10（T1–T4）→ rc.11（S1）→ rc.12（L1 布局）→ **rc.13（U1 收尾）**，未安装、未提交。

审查单：[rc.12 复审](../../docs/B_DAILY_PLAYBACK_RC12_REVIEW.md)、[rc.11 实机布局未通过](../../docs/B_DAILY_PLAYBACK_RC11_DESKTOP_LAYOUT_REVIEW.md)、
[rc.10 复审](../../docs/B_DAILY_PLAYBACK_RC10_REVIEW.md)、[rc.9 续审](../../docs/B_DAILY_PLAYBACK_RC9_REVIEW.md)、
[rc.8 复审](../../docs/B_DAILY_PLAYBACK_RC8_REVIEW.md)。
范围文档：[B 日常持续播放](../../docs/NEXT_B_DAILY_PLAYBACK.md)。

## 0. 本轮（U1）与验收边界

| 项 | 状态 |
| --- | --- |
| U1 自动播放复选框被拉伸成整行宽 | 已修复：方框回到 16×16，行恢复两列；几何断言已补 |
| L1 WE 设置区逐字换行 | rc.12 复审已独立复现确认修复，本轮未回退 |
| S1 / T1–T4 / R1–R5 | 前几轮复审已确认，本轮未改 Host、原生、播放语义 |
| 逻辑与既有回归 | `check`、外观 30 项、壁纸外观 136 项、Host 46 项、SDK 契约全部通过 |
| 真实设置布局、35 分钟日常播放、自动播放、闪窗 | **未验收**；本轮是隔离 DOM 检查，不等于 DSH 实机 |

## 0b. U1：自动播放行继承 column/stretch，复选框变成整行宽

**根因**：`autoStartRow` 为了 L1 也加上了 `wm-wallpaper-row`，于是继承了该类的
`flex-direction: column; align-items: stretch`；后面的自动播放专用规则只设置文字与复选框的 `flex`，
没有恢复行方向，也没有约束复选框的横向尺寸。实测复选框在 400/480/560/640/720px 面板下
分别是 400/480/560/640/720px 宽、高 13px，浏览器把方框画在整行中央。

**修法**（只改这一行的 class 与专用 CSS，未动 WE 主行）：

- 该行移除 `wm-wallpaper-row`，只保留 `wm-settings-row wm-wallpaper-auto-start`，
  **不再继承纵向堆叠**。
- 专用规则显式恢复并约束：`flex-direction: row; flex-wrap: wrap; align-items: center;
  justify-content: space-between; gap: 8px 20px`。
- 复选框显式定尺寸，避免宿主表单规则把它拉满：`flex: 0 0 auto; align-self: center;
  inline-size/block-size/width/height: 16px; min-width: 16px; max-width: 16px; margin: 0`。
- 文案列保持 `flex: 1 1 auto; min-width: 0; width: auto`（窄面板可读、不挤压）。
- 模式与自动播放语义、checkbox 的「只影响下次启动」、按钮回调、取消/清理行为均未改动。

**实测（修复后，隔离 DOM，1280px 视口）**：

| 面板宽度 | 行方向 | 复选框 | 文案列宽 | 方框在文案右侧 | 同一行 | 中心命中为方框 | 横向溢出 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 720px | row | 16×16 | 684px | 是 | 是 | 是 | 0 |
| 640px | row | 16×16 | 604px | 是 | 是 | 是 | 0 |
| 560px | row | 16×16 | 524px | 是 | 是 | 是 | 0 |
| 480px | row | 16×16 | 444px | 是 | 是 | 是 | 0 |
| 400px | row | 16×16 | 364px | 是 | 是 | 是 | 0 |

窄视口（640px 整窗）同样为 `row`、16×16、在面板内。修复前同口径为 400–720px 宽 × 13px 高。

**回归补强**（复审指出原 QA 只断言 `checkboxWidth > 0` 且未越界，因此整行拉伸也能通过）：
现在每个面板宽度都断言行方向为 `row`、复选框宽高在 12–24px、不超过文案列宽、
方框位于文案右侧、与文案同一行、中心命中测试为方框自身、行无横向溢出、文案列宽 ≥ 120px；
窄视口另测方向与方框尺寸。

## 1. L1：右侧控件不换行，文字列被挤到零宽（rc.12，已复审通过）

**根因**（复审定位准确）：`wallpaperRow` 把标题/说明与场景、模式、三个按钮放在同一个
`.wm-settings-row`（两列 flex）里；`.wm-settings-copy` 允许缩到 `min-width: 0`，而
`.wm-media-actions` 是 `flex-shrink: 0` 且不换行。面板变窄时控件列保持 551px，文字列被压到 0 宽，
说明文字于是逐字换行（写作模式仍是 `horizontal-tb`，不是真的竖排）。
现有响应式规则依据整个视口 `max-width: 720px`，窗口宽而设置面板窄时不会触发。

**修法**（只动 WE 新区域，未改 `.wm-settings-row` 或 `.wm-media-actions` 的全局规则）：

- WE 行加专用 class `wm-wallpaper-row`：`flex-direction: column; align-items: stretch`，
  **标题与说明独占上方整行**，控件在下方。
- 控件容器 `wm-wallpaper-actions`：`flex-wrap: wrap`、`min-width: 0`、`max-width: 100%`，
  字段 `wm-wallpaper-field` 允许收缩且不超过容器；按钮沿用既有 `wm-settings-option`。
- 文案列 `wm-wallpaper-copy`：`width: 100%`，说明 `max-width: 68ch` 且 `overflow-wrap: anywhere`。
- 自动播放行 `wm-wallpaper-auto-start`：**rc.12 时它错误地继承了 `wm-wallpaper-row` 的纵向拉伸**，
  当时文档写的「保留两列」与 DOM 不符；rc.13 已移除该 class 并显式恢复横排（见 0b 节）。
- 模式与自动播放设置、开始/重新开始/停止的语义、`data-wm-*` 钩子与控制器调用**均未改动**。

## 2. 新增实际 DOM 几何回归

`qa/appearance-wallpaper-layout.mjs`：把真实设置 VNode 树渲染成真实 DOM、加载插件 CSS，
固定 1280px 视口，设置内容容器取 400/480/560/640/720px，另测窄视口与 `width:100%` 面板。
用 `no-store` + 每次唯一的 `?v=` 载入源码，避免缓存命中旧代码。

每个宽度断言：说明与标题为 `horizontal-tb`、文字列宽 > 0、说明可用行宽 ≥ 200px、
说明按段落换行（≤6 行）、WE 行为纵向堆叠、控件可换行、行无横向溢出、
所有控件在面板内、**按钮中心点命中测试为按钮自身**（先 `scrollIntoView` 再 `elementFromPoint`）、
按钮与两个 select 保持可点击宽度、自动播放行不溢出且标签宽度 ≥ 120px。
（rc.13 起该处断言已加强为：行方向、复选框尺寸上限、方框在文案右侧、同行、中心命中。）

**实测（短文案，与复审同一视口 1280px）**：

| 面板宽度 | 文字列 | 说明行宽 | 说明行数 | 控件行数 | 横向溢出 | 按钮宽 |
| --- | --- | --- | --- | --- | --- | --- |
| 720px | 720px | 479px | 1 | 2 | 0 | 68px |
| 640px | 640px | 479px | 1 | 2 | 0 | 68px |
| 560px | 560px | 479px | 1 | 3 | 0 | 68px |
| 480px | 480px | 479px | 1 | 3 | 0 | 68px |
| 400px | 400px | 400px | 1 | 2 | 0 | 68px |

对照复审的修复前数据（560px 起文字列 0px、说明高 468px、行 `scrollWidth` 571px）：

| 面板宽度 | 修复前：文字列 / 说明高 | 修复后：文字列 / 说明高 |
| --- | --- | --- |
| 720px | 149px / 54px | 720px / 18px（1 行） |
| 640px | 69px / 108px | 640px / 18px（1 行） |
| 560px | 0px / 468px | 560px / 18px（1 行） |
| 480px | 0px / 468px | 480px / 18px（1 行） |
| 400px | 0px / 468px | 400px / 18px（1 行） |

还补了**长说明文字**用例（发布文案较短，原缺陷只在文字需要换行时暴露）：
把说明替换为一段完整中文说明后，各宽度实测 2 行（720/640/560px）到 4 行（480/400px），
行宽 400–720px、横向溢出 0。

**未回归的部分**：图片/视频行实测仍为 `flex-direction: row`、控件不换行
（copy 宽 399px / 486px，actions 宽 76px），主题行、滑块布局未触碰。

检查文件自身的路径约定：输出用 `WM_LAYOUT_OUTPUT` 指定，缺省写入系统临时目录；
本轮实测写入 `.tmp/layout-rc12/`，不覆盖复审证据目录里的任何文件。

## 3. 检查结果

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test:appearance` | 30 项断言通过 |
| `npm run test:appearance-wallpaper` | **136 项断言通过**（含 8 个独立就绪/模式场景） |
| `npm run test:appearance-wallpaper-layout` | **5 个面板宽度 + 窄视口 + 长文案用例全部通过**；
  本轮在此加入 U1 断言（行方向、复选框 12–24px、方框在文案右侧、同行、中心命中） |
| `npm run test:wallpaper-host` | 46 项通过 / 0 失败（未改 Host，作回归确认） |
| `npm run test:sdk-contract` | 通过；加载本检出源码 |

未改 Host / 原生 / 资产，因此 rc.13 未重建 `WallpaperProbe`；`assets/wallpaper` 与 rc.11 相同。

## 4. 候选包

- 路径：`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.13.tgz`
- SHA256：`DA2C08A187C8A031E6D92DAD416C41A397D273B2EBF5F472590D6FED8DBD81C5`
- 大小 6.95 MB，26 个文件；rc.13 在两个工作区此前都不存在，rc.8–rc.12 及更早归档未改动。
- 一致性：包内 11 个文本文件与源码逐文件 SHA256 一致；包内版本为 `0.6.0-rc.13`。
- 相对 rc.12：包内只有 `src/client.js` 与 `package.json` 改变——前者仅移除自动播放行的
  `wm-wallpaper-row` class、补专用横排与 16px 复选框规则和注释；后者仅版本号。
  Host、原生、资产与其它设置区未变（因此未重建 `WallpaperProbe`）。
- 未安装、未提交、未退出 DSH、未操作真实壁纸窗口；用户日常仍为 rc.1。

## 5. 未验收项

真实 DSH 设置面板中的实际布局（需用户点击核对）、真实 ≥35 分钟日常播放、DSH 完整重开的自动播放、
最小化开销、初始屏幕外闪窗、真实长跑中逐帧日志体积。
本轮全部结论来自隔离浏览器 DOM 检查，**不能称为 DSH 实机验收**。

下一步顺序：代码 / 实际 DOM 短复审 → 用户点击核对真实设置布局 → 再继续日常播放、自动播放与清理验收。
