# 项目状态与接续入口

更新：2026-10-07。仓库：`xuanlangzhu-hub/dsh-wallpaper-plugins`。本机独立检出：`F:\dsh-wallpaper-plugins`。

## 当前任务：rc.15 独立复审通过，待短实机确认

最新：[RC15_VISUAL_REVIEW.md](RC15_VISUAL_REVIEW.md)。独立像素/布局和三项负对照通过，外观 30、WE 136 项重跑通过；运行代码/资产与归档一致。包内 README 仍为 rc.14 说明，作为非阻塞文档项记录，下次新版本同步，不覆盖归档。DS 先暂停；下一步用户点击、外部 Codex 临时安装与短实机确认，日常仍 rc.1。

rc.14 的 V1–V3 方向被复审认可，但发现三处问题，rc.15 已按
[rc.14 复审](RC14_VISUAL_REVIEW.md) 返工：

- **R1**：rc.14 把整个 `.BynINW_frame` 涂成实色，等于遮掉整张壁纸。宿主对同一元素既画整个框架、
  又在 `::before` 上画顶栏条；现在**清掉 frame 背景、只给 `::before` 上色**，内容区与侧栏仍见壁纸。
- **R2**：旧遮挡检查的解析器在模板字符串里丢了反斜杠，把完全透明渐变读成 alpha 1（假通过）。
  改为纯字符串解析 + `CSS.supports` + 解析器 sanity，并新增**渲染像素**检查
  `qa/appearance-wallpaper-pixels.mjs`（真实层级 + 官方基线 + 截屏采样）。
- **R3**：`.wm-wallpaper-actions` 漏 `display: flex`（实测间距 0px）；已补上，正常宽度三按钮等宽同排、
  真实 8px 间距，容器 ≤320px 时整组单列，停止不再落单。

候选包 `release/plugins/dsh-whale-mist-0.6.0-rc.15.tgz`，
SHA256 `A3C6886C87C4C956CB17BA13BE96C4638595CDBC8E515307A5B7C5009E3C83F3`，未安装、未提交。
检查：`check`（含新增 CSS 模板守卫）、外观 30 项、壁纸外观 136 项、布局 6 个宽度（含 280px）、
像素四点、Host 46 项、SDK 契约全部通过；负对照证明 rc.14 在布局与像素两项新检查上都会失败。

**未验收**：真实 DSH 高透明度顶部、缩放/最大化、多行输入滚动与按钮观感需用户点击核对；
本轮结论来自隔离 DOM 与渲染像素检查。先不混做闪窗/GPU/多壁纸实验。
核心播放/清理记录保留，但不作为高透明度与滚动视觉无缺陷的证明。日常仍 rc.1。

## 当前完成的阶段

Whale Appearance 源码 `0.6.0-rc.13` 的代码/实际 DOM 短复审和**本机单 Lucy 核心实机验收通过**。
最新：[rc.13 实机验收](B_DAILY_PLAYBACK_RC13_DESKTOP_ACCEPTANCE.md)。同轮 2120.654 秒、42934 帧、0 解码错误；限时预览 180.030 秒自然到期，正常按钮、来源切换、停用、自动播放及正常退出清理均通过。
用户确认缩放、最小化恢复、输入/选字、文字可读与真实动态画面；自动播放关闭后不启动，开启后完整重开每次仅一轮，勾选不即时播放，手动停止后调整外观不自启。

**验收边界**：启动仍会短暂闪出独立窗口；源窗口仍可能有任务栏/Alt-Tab 入口。共享 WE 单 GPU 引擎采样较高，含原桌面与独立源窗口，未做增量对照或完整 renderer GPU 覆盖；不宣称低开销、完全隐藏、所有场景或数小时/数天稳定。

临时 rc.13 已撤回，日常恢复 rc.1；四份 Profile 与测试前外观存储哈希一致，官方 EXE 哈希未变、签名 Valid。用户重开确认正常，采集/源窗口为 0，原 WE 身份保留。正在引用的包与全部旧归档仍保留。

历史：[rc.13 代码复审](B_DAILY_PLAYBACK_RC13_REVIEW.md)、[rc.12](B_DAILY_PLAYBACK_RC12_REVIEW.md)、[rc.11 布局](B_DAILY_PLAYBACK_RC11_DESKTOP_LAYOUT_REVIEW.md)、[rc.11 代码](B_DAILY_PLAYBACK_RC11_REVIEW.md)；早期复审与 rc.7 预览验收记录保留。
实现交付：[B_DAILY_PLAYBACK_DELIVERY.md](../dsh-whale-mist/docs/B_DAILY_PLAYBACK_DELIVERY.md) 是交付时快照，旧“未安装/未验收”描述不替代最新实机结论。

## 下一阶段

rc.15 已通过独立短复审，下一步先由用户短实机确认高透明度、缩放/最大化、多行输入滚动与按钮观感；通过后，
再安排启动闪窗小验证和 GPU 增量对照，以及 A 多壁纸/E 打包复现；音频、鼠标交互、全屏坐标锚定后置。
无需为同一实现重复 35 分钟；若后续改变长期帧循环、资源归属或清理机制，再按影响补测。

## 本轮归档

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
