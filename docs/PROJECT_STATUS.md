# 项目状态与接续入口

更新：2026-10-07。仓库：`xuanlangzhu-hub/dsh-wallpaper-plugins`。本机独立检出：`F:\dsh-wallpaper-plugins`。

## 当前任务：rc.16 观感未通过，R5 改为仅卡片遮挡、消息层裁剪

最新：[RC16_DESKTOP_VISUAL_REVIEW.md](RC16_DESKTOP_VISUAL_REVIEW.md)。用户明确反馈仍是“渐变的大片黑”，要求只有输入卡片本身遮挡，四周和到底部保留壁纸；历史文字靠消息层裁剪/渐隐消失，不能再给外围画黑渐变。
下一轮只修这个遮挡模型，保留顶部、按钮与正常生命周期；用真实结构验证卡片外壁纸可见和旧字不可见同时成立，覆盖输入增高/滚动。DS 交 rc.17（若未占用）和正确对照后复审，不自行安装或抢鼠标，不重复 35 分钟。
候选已撤回，四份 Profile 与 9 文件外观存储恢复哈希已核对，原 WE 与官方 EXE 保留；用户重开确认日常正常、没有实验自动播放，最终采集/源窗口均为 0，见本轮报告和 post-restore.json。日常仍 rc.1。

## 当前完成的阶段

Whale Appearance 源码 `0.6.0-rc.13` 的代码/实际 DOM 短复审和**本机单 Lucy 核心实机验收通过**。
最新：[rc.13 实机验收](B_DAILY_PLAYBACK_RC13_DESKTOP_ACCEPTANCE.md)。同轮 2120.654 秒、42934 帧、0 解码错误；限时预览 180.030 秒自然到期，正常按钮、来源切换、停用、自动播放及正常退出清理均通过。
用户确认缩放、最小化恢复、输入/选字、文字可读与真实动态画面；自动播放关闭后不启动，开启后完整重开每次仅一轮，勾选不即时播放，手动停止后调整外观不自启。

**验收边界**：启动仍会短暂闪出独立窗口；源窗口仍可能有任务栏/Alt-Tab 入口。共享 WE 单 GPU 引擎采样较高，含原桌面与独立源窗口，未做增量对照或完整 renderer GPU 覆盖；不宣称低开销、完全隐藏、所有场景或数小时/数天稳定。

临时 rc.13 已撤回，日常恢复 rc.1；四份 Profile 与测试前外观存储哈希一致，官方 EXE 哈希未变、签名 Valid。用户重开确认正常，采集/源窗口为 0，原 WE 身份保留。正在引用的包与全部旧归档仍保留。

历史：[rc.13 代码复审](B_DAILY_PLAYBACK_RC13_REVIEW.md)、[rc.12](B_DAILY_PLAYBACK_RC12_REVIEW.md)、[rc.11 布局](B_DAILY_PLAYBACK_RC11_DESKTOP_LAYOUT_REVIEW.md)、[rc.11 代码](B_DAILY_PLAYBACK_RC11_REVIEW.md)；早期复审与 rc.7 预览验收记录保留。
实现交付：[B_DAILY_PLAYBACK_DELIVERY.md](../dsh-whale-mist/docs/B_DAILY_PLAYBACK_DELIVERY.md) 是交付时快照，旧“未安装/未验收”描述不替代最新实机结论。

## 下一阶段

先完成 R5 仅卡片遮挡与消息内容层裁剪，后台和用户短实机都通过后，
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
