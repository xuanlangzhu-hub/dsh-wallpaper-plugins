# 项目状态与接续入口

更新：2026-10-08。仓库：`xuanlangzhu-hub/dsh-wallpaper-plugins`。本机独立检出：`F:\dsh-wallpaper-plugins`。

## 当前任务：R7 / rc.19 后台复审通过，待短实机

最新：[RC19_REGION_REVIEW.md](RC19_REGION_REVIEW.md)。聊天 header/正文的四组合像素通过；补齐侧栏两层夹具并将恢复渐变负对照放到实际背景激活状态，新版额外暗带 0、旧版/对照被识别。外观 30/WE 136/Host 46/SDK、布局/区域/裁剪通过；26 包文件匹配源码，候选原 SHA 保持。Codex 仅补 QA，没有修改交付实现或操作日常 DSH。下一步用户配合真实顶部、侧栏底部/列表/菜单及恢复短验。

以下为 DS 交付时记录；原“未提交/指标”不代替上述最新复审。

rc.18 短实机确认默认两区能见壁纸、布局正常，但勾选聊天（或两区）时会话标题与「对话／轨迹」栏仍透出壁纸；
用户截图另指出侧栏底部、头像上方的矩形暗带。见 [rc.18 实机复审](RC18_DESKTOP_REGION_REVIEW.md) 与
[侧栏底部补查](SIDEBAR_BOTTOM_FADE_NOTE.md)。rc.19 只做这两件事：

- **聊天区范围**：勾选后覆盖整个右侧聊天列（`.BynINW_centerCol`），包含会话标题与「对话／轨迹」标签栏；
  文案同步。区域检查同时采 header 与正文，并新增“只遮正文”负对照 `bodyOnlyPainter`。
- **侧栏底部暗带**：已用官方侧栏夹具复现——透明壁纸态下官方 `._9lTDKa_fade` 的 24px 渐隐再叠一层
  半透明 sidebar-fill，渐变带内亮度 39.3 → 32.4 且左右为硬边界。现仅当「背景激活且侧栏仍透出壁纸」时
  移除该渐隐的颜色绘制；侧栏选实色或不使用背景时宿主渐隐原样保留。负对照 `restoreFade` 可复现暗带。

候选 `release/plugins/dsh-whale-mist-0.6.0-rc.19.tgz`，
SHA256 `B3F31578D522B82DF9F40DDC49FC190A39B73E533275C7C544E3074A1E8D6341`，未安装、未提交。
检查：`check`、外观 30、壁纸外观 136、布局 6 宽度、区域、消息裁剪、侧栏暗带、Host 46、SDK 契约全部通过；
相对 rc.18 包内仅 `package.json`、`README.md`、`src/client.js` 变化，原生资产未动。

**未验收**：chat=true 的 header/正文覆盖、四种组合观感、侧栏底部观感、缩放与多行输入需用户短实机确认。
日常仍 rc.1；rc.18 及全部旧包未改动。

以下为 DS 交付摘要（rc.18/R6），保留作为历史。

rc.17 短实机通过后（[rc.17 验收](RC17_DESKTOP_VISUAL_ACCEPTANCE.md)：卡片外围与底部壁纸可见、无大片黑底、
旧字不透、多行输入与缩放/菜单正常、清理通过），本轮按 [区域底色计划](NEXT_REGION_BACKGROUNDS.md) 实现 R6：

- 新增两个独立开关 `opaqueSidebar` / `opaqueChat`，默认 `false`（视觉与 rc.17 相同）；
  非显式 `true`（缺字段、字符串、数字）一律回落到关闭，旧配置与损坏值不会误开区域。
- 仅在壁纸态给**局部容器**着色：侧栏用主题侧栏色（含 deep 与四配色），聊天区用主题底色；
  未改任何全局变量，frame、顶部条、输入卡片、菜单不受影响；偏好随外观设置保存，
  无背景时保留偏好但不绘制，切换开关不启停 WE 轮次。
- 新增 `qa/appearance-wallpaper-regions.mjs`：四种组合逐一测像素（默认两侧见壁纸、只开侧栏、
  只开聊天、两开各自成立），并断言标题栏/卡片/frame 不变；另覆盖 UI 回调、持久化与非法值回退、
  重置、无背景不绘制、停止后不遗留绘制，以及四配色与 deep 的对应底色。
- 三组负对照（开关联动、整列涂实、座位涂实）各自命中预期检查；替换目标不匹配会直接报错。

候选 `release/plugins/dsh-whale-mist-0.6.0-rc.18.tgz`，
SHA256 `AF931967464DD2D276E40C47C88E05DA69E585FC95E71DE9C2E33A12F432C5E8`，未安装、未提交。
检查：`check`、外观 30、壁纸外观 136、布局 6 宽度（含新复选框几何）、区域、像素/裁剪、Host 46、SDK 契约。
相对 rc.17 包内仅 `package.json`、`README.md`、`src/client.js` 三个文件变化，原生资产未动。

**未验收**：四种组合的真实观感、缩放/最大化、多行输入与滚动、四配色在真实壁纸下的层次需用户短实机确认。
日常仍 rc.1；rc.17 及全部旧包未改动。

## 当前完成的阶段

Whale Appearance 源码 `0.6.0-rc.13` 的代码/实际 DOM 短复审和**本机单 Lucy 核心实机验收通过**。
最新：[rc.13 实机验收](B_DAILY_PLAYBACK_RC13_DESKTOP_ACCEPTANCE.md)。同轮 2120.654 秒、42934 帧、0 解码错误；限时预览 180.030 秒自然到期，正常按钮、来源切换、停用、自动播放及正常退出清理均通过。
用户确认缩放、最小化恢复、输入/选字、文字可读与真实动态画面；自动播放关闭后不启动，开启后完整重开每次仅一轮，勾选不即时播放，手动停止后调整外观不自启。

**验收边界**：启动仍会短暂闪出独立窗口；源窗口仍可能有任务栏/Alt-Tab 入口。共享 WE 单 GPU 引擎采样较高，含原桌面与独立源窗口，未做增量对照或完整 renderer GPU 覆盖；不宣称低开销、完全隐藏、所有场景或数小时/数天稳定。

临时 rc.13 已撤回，日常恢复 rc.1；四份 Profile 与测试前外观存储哈希一致，官方 EXE 哈希未变、签名 Valid。用户重开确认正常，采集/源窗口为 0，原 WE 身份保留。正在引用的包与全部旧归档仍保留。

历史：[rc.13 代码复审](B_DAILY_PLAYBACK_RC13_REVIEW.md)、[rc.12](B_DAILY_PLAYBACK_RC12_REVIEW.md)、[rc.11 布局](B_DAILY_PLAYBACK_RC11_DESKTOP_LAYOUT_REVIEW.md)、[rc.11 代码](B_DAILY_PLAYBACK_RC11_REVIEW.md)；早期复审与 rc.7 预览验收记录保留。
实现交付：[B_DAILY_PLAYBACK_DELIVERY.md](../dsh-whale-mist/docs/B_DAILY_PLAYBACK_DELIVERY.md) 是交付时快照，旧“未安装/未验收”描述不替代最新实机结论。

## 下一阶段

rc.19 后台复审通过，下一步由用户配合一次短实机，优先核 `chat=true` 下会话标题与标签栏、正文是否都被覆盖，
以及透明壁纸态下侧栏底部是否还有暗带。
通过后再安排启动闪窗小验证、GPU 增量对照及 A 多壁纸/E 打包复现；音频、鼠标交互、全屏坐标锚定后置。
无需为同一实现重复 35 分钟；若后续改变长期帧循环、资源归属或清理机制，再按影响补测。

## rc.13 长跑归档（历史）

- 验收证据：`F:\deepseekharness\.tmp\wallpaper-daily-rc13-desktop-20261007-085935`。
- 起点备份：`C:\Users\HP\.dsh\backups\official-desktop-before-daily-rc13-20261007-085935`。
- rc.13 归档包 SHA256：`DA2C08A187C8A031E6D92DAD416C41A397D273B2EBF5F472590D6FED8DBD81C5`。未重打/覆盖；当前源码 README 的验收补记不在原包里。
- 本轮仅新增验收/接续文档并更新 README，没有修改实现、原生资产或版本号。

## 本机历史资料

- 原工作区 `F:\deepseekharness` 保留，用于历史源码、资产、归档与验收证据。
- rc.7 证据：`F:\deepseekharness\.tmp\wallpaper-settings-rc7-desktop-20261006-102024`。
- rc.7 起点备份：`C:\Users\HP\.dsh\backups\official-desktop-before-settings-rc7-20261006-102024`。
- 官方程序与 `.dsh` 属于运行环境，不作为源码开发目录。

这些是本机历史路径，不能复用旧 PID、窗口名或证据目录。新检查写入本轮独立目录，保留旧证据。

## 拆分来源

原工作区的插件提交为 `bbab190`、`c838b82`、`8aab3e2`、`a986196` 和 `ff19f3b`；本仓库以最后一项的已提交插件快照为起点。迁移后原工作区的来源历史与正在引用的包均保留。
