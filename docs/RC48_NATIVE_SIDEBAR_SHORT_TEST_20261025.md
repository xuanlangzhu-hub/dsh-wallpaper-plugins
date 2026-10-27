# rc.48 原生侧栏临时短验

2026-10-25。**当前范围通过，已恢复日常 rc.47 与本轮原设置，正常重开后播放停止；用户确认“原外观和布局正常”，本轮闭合。** 日常为 DSH 0.2.1-rc.3／Whale 0.6.0-rc.47／Git Bash 0.1.2，未保留 rc.48。

## 授权、候选与保护

用户本轮回复“已正常退出，可以临时安装短验”。按[准备记录](RC48_NATIVE_SIDEBAR_SHORT_TEST_PREPARATION_20261025.md)执行新备份、临时安装、代点及恢复；不沿用历史退出状态。电脑操作使用 computer-use 技能的 @oai/sky，退出使用“应用→退出”。

- 证据：`F:\dsh-wallpaper-plugins\.tmp\rc48-native-sidebar-short-trial-20261025-7a8e9caf`。
- 新备份：`C:\Users\HP\.dsh\backups\rc48-native-sidebar-short-trial-20261025-7a8e9caf`。
- 新备份并核验 5 个 Profile、10 个关闭状态 Local Storage 文件；另存当前安装、固定原包、desktop／Preferences／Local State 三项目标及 IndexedDB／blob_storage 的 9 个媒体文件。
- rc.48 固定包 SHA256：`93290398BEAFBDCB5B01CB4273D4759A92D4325934CD2FBFA2D1FC26B88CAEAE`；官方 CLI 临时安装后，43 个文件完整集合与哈希一致。
- 原 EXE／app.asar、原 WE 身份以及 283 项共享源码／QA／资产／归档保护输入保持。开发 manifest／生产 assets 仍为 rc.30，未整体打包工作区。

## 原生侧栏与实际效果

重开后因原设置自动播放为开启，Lucy 曾自动开始；先正常停止，再临时关闭自动播放，进行一次明确的手动播放。此初始轮与后续正式手动轮分开，不当作异常自动重启。

助手实际观察到：桌面端最右侧原生容器打开，原文件标签保留；当前 Lucy 小预览加载，图库只勾选 Everyone。图库向下滚动约 549px 时，当前对象与播放／停止区保持固定，聊天没有随图库滚动；未进入可见范围的懒加载预览随后出现。壁纸／界面两页切换正常。未弹出外部浏览器窗口。

通过“读取作者设置”加载 Lucy 的 6 项简单布尔参数；初始参考值显示复选状态，没有把参考值称作壁纸实际读取值。仅修改“粒子/Particles”，未点击保存／应用按钮：

1. 关闭时出现处理状态，随后出现 ✓ 与“下发已确认，效果请观察”。用户确认“明显减少或消失了”。
2. 在同一轮播放中重新勾选，再次即时下发并显示 ✓。用户确认“粒子动效恢复了”。
3. 点击“重新读取”一次，参考值保留、本地 ✓ 清除。此项仅记录界面观察，不声称单靠截图证明全部底层命令未重放；相关语义沿用既有离线证据。

正式手动轮的 playing／off／on 快照绑定同一来源：`WhaleWallpaperProbe-261025065521-0602`，采集 PID 14460。没有通过重启壁纸替代即时参数应用。上述 PID／来源仅用于本轮证据，未来不得复用。

## 停止、退出与恢复

停止后核验 Host inactive、session 为空，清理结果 `closed:true, outcome:absent, waitedMs:155, error:null`；本轮源窗口与采集进程均为 0，原 WE 保持。

通过菜单正常退出后，第一次恢复预检仍发现 DSH／关联进程未完全退出，约 11.7 秒以非零拒绝；**该失败门禁后没有进行恢复写入**。保留失败输出至 `first-restore-preflight`，重新只读列应用／进程确认自然退出，再运行同一有界预检通过。未强杀、放宽超时或绕过门禁。

恢复前另存 18 项测后数据。随后官方 CLI 恢复固定 rc.47，37 个安装文件完整集合与哈希一致，候选新增模块不残留；5 个 Profile、10 个关闭存储文件恢复一致。三项布局目标本来就与原备份一致，实际覆盖数为 0；9 个原媒体文件恢复／核验一致，新数据先保留。官方 EXE／app.asar／原 WE 身份保持，关闭状态恢复核验无 Profile 差异。

助手正常重开日常 rc.47；原自动播放开启设置已恢复，Lucy 随之自动开始，助手通过原快捷面板正常停止一次后收起面板，未改原自动播放选项。新鲜发现的当前 DSH 所属 Host 核验 inactive、session 为空、目录 ready、采集为 0，原 WE 保持；283 项保护输入再次全量哈希一致。用户最终确认“原外观和布局正常”。

主要证据：`live-cleanup-verified.json`、`after-test-retention.json`、`settings-restored.json`、`layout-restored.json`、`media-storage-verify-restored.json`、`restored-daily-closed.json`、`restored-final-runtime.json`、`daily-reopen-discovery.json`、`daily-reopen-result.json`、`live-trial-summary.json`。本轮工具已有总期限，后台步骤结果均回收；首次恢复预检失败已如实留存，不称所有步骤一次通过。

## 验收边界与接续

本轮只覆盖当前主题／普通窗口宽度的原生容器、预览／图库滚动、页签／固定区、作者参考值与确认反馈，以及 Lucy 粒子关闭／恢复的真实效果。未实机覆盖其它作者类型、全部主题／窄栏、全部壁纸或长期稳定；候选核包既有 995 项／52 阶段和 Windows rc.3 SDK 130 项不能计作本轮新增实机用例。

整体 UI 与自绘下拉改版继续后置。本轮只完成临时短验和恢复；后续若用户选择保留 rc.48 日常，另做当时方便／无任务确认与新备份，不能复用本次关闭状态。未提交推送、清理、派发或创建定时任务。
