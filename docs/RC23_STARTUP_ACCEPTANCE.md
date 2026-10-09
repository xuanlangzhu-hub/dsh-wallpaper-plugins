# rc.23：启动与白条短实机通过，日常已恢复

2026-10-09。正式 Windows Desktop、Lucy、低不透明度、日常模式且自动播放关闭。用户点击，Codex 备份/安装/核验，其它助手暂停。

rc.22 首轮用户更正“顶部有白条”，以更正为准，未通过。失败配置/外观与原包保留。rc.23 使用 WE 官方 -borderless 创建正坐标屏幕外源，不改 TOOLWINDOW/owner 或可见属性，不加黑罩。原生 25 秒 519 帧及 JPEG 核查已无标题栏。

用户正式确认：白条消失，没有主动闪窗/抢焦点，动态清楚；缩放/最大化、长消息滚动与多行输入正常，无闪字。重新开始直接出图、计数归零，仍无白条或主动抢焦点；停止恢复主题并清理。**仍能看到 Wallpaper 任务栏入口**，不宣称完全隐藏；Alt-Tab/音频/鼠标交互未验。自动播放逻辑未改，本轮没有重复自动播放冷启动/35 分钟。

Host 两轮均为 initial-position，无重复尺寸设置，实际帧 1302×776。首次核验 966 采集/399 绘制帧；重启最终 442/421 帧，decodeErrors=0、failure=null。结束 captureAlive=false、本轮窗口 0、cleanup.closed=true/error=null。

官方 CLI 恢复 rc.1，关闭状态下 5 份配置/9 个 Local Storage 文件逐项哈希相同。中间和测试后数据分别保留；原 WE PID/启动身份、官方 EXE 哈希保留，签名 Valid。用户重开确认日常正常、无实验自播；重开后配置仍一致、采集/本轮窗口 0。

候选 release/plugins/dsh-whale-mist-0.6.0-rc.23.tgz，SHA256 **F6BF83FEEA77F737BF2F2B550C0B3DDE9AF0D8CF0F08B85EC5CFA017E3821969**。
26 文件匹配源码；相对 rc.21 仅 README/package、Host session、WallpaperProbe.exe/dll 改动，src/client.js 相同。包内 README 是打包快照，最新结论以本文为准。旧包和日常引用包不覆盖。

实机证据：`F:\deepseekharness\.tmp\wallpaper-rc22-desktop-20261009-102747`。
备份：`C:\Users\HP\.dsh\backups\official-desktop-before-rc22-20261009-102747`。
包括 rc.22 更正及失败中间状态、rc.23 两次播放/停止、恢复前后与 CLI 日志；原生/性能初筛见 [RC22_STARTUP_REVIEW.md](RC22_STARTUP_REVIEW.md)。其 B2 采样是保留尺寸的有边框独立源，不能当最终无边框 rc.23 完整 DSH 成本。

启动短验完成，任务栏入口保留为独立目标；源渲染仍是性能重点，未声称总体低开销。下一轮按 [性能接续](NEXT_SOURCE_PERFORMANCE.md)，用户选择后开工，不自行留候选作日常。
