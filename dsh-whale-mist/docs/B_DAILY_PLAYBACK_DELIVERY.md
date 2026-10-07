# B：日常持续播放与启动闪窗优化——交付报告（rc.16 R4 输入区返工版）

日期：2026-10-07。状态：**R4 已返工，待 Codex 复审与用户实机确认**。
起点 `main @ d542ffc`。版本演进：rc.8 → rc.9（R1–R5）→ rc.10（T1–T4）→ rc.11（S1）→ rc.12（L1 布局）→
rc.13（U1，实机核心验收通过）→ rc.14（V1–V3，复审未通过）→ rc.15（R1–R3，短实机局部通过）→
**rc.16（R4 输入区层次）**，未安装、未提交。

依据：[rc.15 短实机记录](../../docs/RC15_DESKTOP_VISUAL_REVIEW.md)、
rc.14 复审原文 `F:\deepseekharness\.tmp\b-visual-rc14-review-20261007-111030\RC14_VISUAL_REVIEW.md`、
[整改范围](../../docs/NEXT_RC14_VISUAL_POLISH.md)。

## 0. 本轮（R4）与验收边界

| 项 | 状态 |
| --- | --- |
| R4 输入框附近到页面底部一整片实黑 | 已修复：按官方层次分开渐隐带、输入卡片与座位外围 |
| rc.15 已正常项（顶部局部遮挡、frame 透明、按钮分组/间距/窄容器） | 保留，未回退 |
| 检查 | 像素检查扩到 6 个采样点 + 三组负对照；`check`、外观 30、壁纸外观 136、布局 6 宽度、Host 46、SDK 契约 |
| 实机确认 | **未做**：输入区观感、缩放/最大化、多行输入滚动仍待用户点击 |

Host、原生、长期帧循环与资源归属未改，未重建 `WallpaperProbe`，未重复 35 分钟长跑。

## 0b. R4：遮挡有效但整片实色（P1）

**根因**：官方本来用
`linear-gradient(180deg, transparent 0px, var(--dsw-alias-bg-base) 36px)` 给输入区座位做渐隐，
让历史文字滚到输入区时淡出。主题把 `--dsw-alias-bg-base` 设为 `transparent` 后这条渐变失效，
rc.14/rc.15 的修法是把**整条渐变、座位、overlay 和输入卡片**全部刷成同一个 `--wm-base-rgb` 实色，
于是从输入框到窗口底部成为一块没有层次的深色区域。

**修法（恢复官方层次，只换可解析的颜色）**：

- 渐隐带：`linear-gradient(180deg, color-mix(in srgb, rgb(var(--wm-base-rgb)) 0%, transparent) 0px,
  rgb(var(--wm-base-rgb)) var(--dsh-composer-fade-height, 36px))`——遮字能力保留，顶部仍是透明起笔。
- 输入卡片：恢复 `var(--dsw-specific-input-major)`，保留自身表面渐变，与外围区分。
- 座位与 overlay：**不再加实色背景**，只有渐隐带在输入区起始处落地。

**实测（隔离真实层级，1000×600，洋红测试壁纸，采样点由实测几何取得）**：

| 采样点 | 像素 | 含义 |
| --- | --- | --- |
| 座位顶部（渐隐起笔） | `rgb(165,0,166)` | 仍见壁纸，说明不是整片实色 |
| 座位内、卡片上方 | `rgb(43,8,53)` | 仍见少量壁纸，处于渐隐带内 |
| 输入卡片中心 | `rgb(20,30,48)` | 不透明、无壁纸，且是卡片自身渐变（`linear-gradient(rgb(23,34,54), rgb(15,23,38))`） |
| 卡片下方（座位到底部） | `rgb(8,11,20)` | 渐隐带落地后的主题实色，范围仅限座位自身 |

座位渐变实测解析为 `linear-gradient(color(srgb 0 0 0 / 0) 0px, rgb(8, 11, 20) 36px)`：
起点透明、末端不透明，与官方 ramp 形状一致，颜色可解析，遮字能力保留。

## 0c. 负对照（三组，逐一证明检查能抓住对应缺陷）

| 负对照 | 复现的缺陷 | 检查失败于 |
| --- | --- | --- |
| 去掉渐隐带 | 原缺陷：历史文字可滚过输入区 | `the seat is a ramp rather than one flat colour`（顶部读到 `rgb(178,0,178)`，即纯壁纸） |
| 整条座位刷实色 | **rc.15 的 R4 缺陷** | `the fade starts translucent …`（顶部读到 `rgb(8,11,20)`，即整片实色） |
| frame 不透明 | rc.14 的整框架遮挡 | `the application frame is cleared so the wallpaper can show` |

三组都由环境变量开关驱动，替换失败会立刻抛错（`the … negative control replaced …`），
避免出现「负对照其实没生效、检查仍然通过」的假象——这是 rc.14 那轮的教训。


日期：2026-10-07。状态：**R1–R3 已返工，待 Codex 复审与用户实机确认**。
起点 `main @ d542ffc`。版本演进：rc.8 → rc.9（R1–R5）→ rc.10（T1–T4）→ rc.11（S1）→ rc.12（L1 布局）→
### 以下为 rc.15（R1–R3）当时的历史记录

rc.13（U1 收尾，实机核心验收通过）→ rc.14（V1–V3，复审未通过）→ **rc.15（R1–R3 返工）**，未安装、未提交。

依据：rc.14 视觉复审（原文 `F:\deepseekharness\.tmp\b-visual-rc14-review-20261007-111030\RC14_VISUAL_REVIEW.md`，
本轮不复制该证据）、[本轮整改范围](../../docs/NEXT_RC14_VISUAL_POLISH.md)。
范围文档：[B 日常持续播放](../../docs/NEXT_B_DAILY_PLAYBACK.md)。

#### R1–R3 范围与边界

| 项 | 状态 |
| --- | --- |
| R1 顶栏修复把整张壁纸遮掉 | 已修复：只清 frame 背景 + 只给顶部条 `::before` 上色；像素检查证明内容区与侧栏仍见壁纸 |
| R2 遮挡测试假通过（透明渐变判为不透明） | 已修复：解析器去掉模板反斜杠陷阱 + `CSS.supports` 拒绝无效色 + 解析器 sanity + 负对照 |
| R3 按钮组漏 `display`，间距 0，280px 停止落单 | 已修复：`display: flex` + 真实 8px 间距；≤320px 容器整组单列 |
| 检查手段 | 新增**渲染像素**检查（真实宿主 CSS 层级 + 官方声明基线 + 截图采样），旧样式检查已被取代 |
| 检查结果 | `check`（含新增 CSS 模板守卫）、外观 30、壁纸外观 136、布局（6 宽度）、像素、Host 46、SDK 契约 |
| 实机确认 | **未做**：真实高透明度、缩放/最大化、多行输入滚动仍待用户点击 |

Host、原生、长期帧循环与资源归属未改，因此未重建 `WallpaperProbe`，也未重复 35 分钟长跑。

#### R1：顶栏修复把整张壁纸遮掉

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

#### R2：遮挡检查假通过

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

#### R3：按钮组漏 display、间距 0、280px 停止落单

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

#### R1–R3 时的负对照

把 rc.14 的 `src/client.js` 放进同一套新检查下运行：

- 布局检查失败于 `panel 720px: the action group is a flex container, got block`；
- 像素检查失败于 `the application frame is cleared so the wallpaper can show, got rgb(8, 11, 20)`；
- 遮挡检查在禁用输入区遮挡时失败于渐变末端 alpha `0`（见 R2）。

修复版在同一套检查下全部通过；这组对照是本轮新增检查可采信的依据。

#### R1–R3 时的检查结果

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

- 路径：`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.16.tgz`
- SHA256：`9B4A4B4784B6CE6FAB425D38ED6B43DC127FF337E2837AD6972DBF575888B5EA`
- 大小 6.95 MB，26 个文件；rc.16 在两个工作区此前都不存在，rc.8–rc.15 及更早归档未改动。
- 相对 rc.15：包内只有 `src/client.js`（座位渐隐带改为透明起笔的官方 ramp、卡片恢复自身渐变、
  去掉座位/overlay 的实色底）、`README.md`（版本段）、`package.json`（版本号）改变；
  Host、原生、资产未变，故未重建 `WallpaperProbe`。
- 未安装、未提交、未退出 DSH、未操作真实壁纸窗口；用户日常仍为 rc.1。

## 7. 未验收项与边界

真实 DSH 中的输入区观感（是否仍有黑块感）、缩放/最大化、多行输入与滚动、顶部与按钮观感需用户短实机确认。
本轮结论来自隔离浏览器渲染像素与三组负对照，**不等于真实宿主验收**；共享 WE 单 GPU 引擎的开销结论沿用
rc.13 实机记录，未在本轮重测。图片/视频背景共用这些背景态规则，布局与像素检查覆盖面相同。
