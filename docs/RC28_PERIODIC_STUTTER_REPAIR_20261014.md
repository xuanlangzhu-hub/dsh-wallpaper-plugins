# rc.28 周期卡顿修复与本机短验

2026-10-14，Codex。**rc.27 的周期停顿已定位并修复，用户确认「不卡了，画面持续，任务栏消失」；本机日常安装已保留 rc.28。** 当前 DSH 打开、播放停止，采集/worker/本轮源窗口均为 0。没有恢复旧外观，也没有修改全局显卡或 WE 设置。

## 触发与原因

用户在 rc.27 日常播放后发现，所有试过的场景都会大约每秒停一下，持续数分钟仍存在。早前 rc.27 的七轮生命周期短验通过，并不能证明持续播放平滑。

正式采集循环每秒调用 `TaskbarHideRuntime.GetStatus()`。旧实现为填充 `cleanupSafe`，同步调用完整的 `CanCloseOwned()`；实际 `RealWindowProbe.Inspect()` 会核验窗口、进程身份并枚举窗口。这项查询运行在采集循环内，造成周期阻塞。后台 DeleteTab worker 的等待本身不是这个持续停顿的原因。

旧 DLL 对当时仍存在的源窗口执行只读查询，三次 `GetStatus()` 为 923.7633、758.1657、925.0577ms；JSON 序列化平均 0.025051ms。修正后，对当前真实源窗口的直接身份查询仍需 998.0302ms，但周期 `GetStatus()` 三次为 0.6711、0.0007、0.0002ms。该探针未创建或操纵窗口、未调用 Shell 动作。

原始帧记录中的长间隔紧跟 `[Status]`；同期源时间戳间隔以及 readback/JPEG/pipe 时间不足以解释这些停顿。没有以更改 FPS、全局 GPU 或主题外观掩盖问题。

## 最小修正与安全边界

- `TaskbarHideStrategy.WorkerCleanupSafe` 仅读取已记录的 worker/动作进度。
- `TaskbarHideRuntime.GetStatus()` 不再枚举进程或窗口。worker 已安全结束时，周期 `cleanupSafe` 为 null，另报 `workerCleanupSafe=true`；不将周期进度当成关闭源窗口的授权。
- `GetSummary()`、动作执行前后和最终关源仍做新的完整身份核验。没有缓存一个过去的 `true` 来放行清理。
- 原生自检新增四项，覆盖周期无枚举、周期无关源授权，以及最终身份变化拒绝/身份匹配允许。其它 Host/客户端/worker 逻辑保持原样。

新增回归在修前为 115/117，恰有两项周期状态检查失败；修后为 117/117。独立正式 DLL 的慢 probe 反例也经历 fail → pass，最终强身份清理检查持续通过。修后原生 publish、Host 105/105、生成接缝 19/19、语法/CSS 检查通过。没有重复 GPU、35 分钟或完整旧生命周期实验。

诊断期间首次修后只读 benchmark 遇到用户已重启的旧源身份，结果无效，未当作通过；后续在真实存在的新源窗口上重新取证。仅回收对应诊断进程，原 WE 未动。

## 候选与保护

归档：`release/plugins/dsh-whale-mist-0.6.0-rc.28.tgz`，28 个文件，7,357,296 字节。

SHA256：`58F5B6233882D269083D7E478B8ED920E690675A22F868B4BC0E4DD618B9F2FC`。

相对 rc.27 tgz，仅 `package.json`、包内 README 和 `assets/wallpaper/WallpaperProbe.dll` 不同；其余客户端/Host 和原生运行时文件一致。12 个运行时文件与独立 fixed build 一致。通过官方 CLI 安装后、短验结束后，分别核验 28 个安装文件与归档逐字节一致。归档 README 是打包时的候选快照；最终安装/短验状态以本记录为准，不覆盖同版本包。

用户暂停其它助手、确认无运行任务后，先保存 5 份 Profile；由用户正常退出 DSH，确认旧源/采集已结束，再保存关闭状态的 10 个 Local Storage 文件和 8 个播放日志目录。安装前后这些外观文件和两份插件配置哈希一致。保留原 rc.27 与更早归档，没有盲覆早晨的 rc.24 或旧外观。

原 WE 仍为 PID 12056、UTC StartTime `2026-10-14T00:48:37.3926153Z`。官方 DSH/WE EXE 哈希未变，DSH 签名仍 Valid；未修改 app.asar、系统安全设置或全局 GPU/FPS。

## 同场景实机对照

重开后继续同一个 `we-41612c520dd4406e48dea550` scene，用户按要求不调整窗口或外观参数、不点击 Wallpaper 任务栏入口。用户观察约一分钟并确认周期卡顿消失、画面持续、入口消失。

只分析 15 秒以后、序号严格相邻的保留帧，避免将稀疏采样误算成断帧；250ms 为此次诊断的长间隔阈值。以下两个 rc.28 快照来自**同一轮**播放，不是两次独立实验。

| 保留证据 | 相邻帧对 | 含状态上报的相邻帧对 | ≥250ms 间隔 | 其中紧跟状态上报 | 最大间隔 |
| --- | ---: | ---: | ---: | ---: | ---: |
| rc.27 同场景关闭前记录 | 1070 | 97 | 97 | 97 | 3230ms |
| rc.28 约 77 秒播放快照 | 1184 | 54 | 0 | 0 | 124ms |
| rc.28 结束后的最终快照 | 1150 | 61 | 0 | 0 | 132ms |

播放快照中状态上报后的最大间隔为 115ms，最终快照为 132ms；周期 `cleanupSafe=null`、`workerCleanupSafe=true` 符合新协议。原记录与新记录时长不同且帧日志有界，因此这不是源 FPS、GPU 功耗或同条件吞吐性能测评，也不能证明所有场景/长时运行均无卡顿。

主对照最终 Host 收到 2631 帧、客户端绘制 2259 帧，decodeErrors=0、Host failure=null。DeleteTab 单次 S_OK，约 10.011 秒触发、13.312 秒完成，等待期间继续传递 71 帧。未将接收/绘制数当成源 FPS。

## 实际结束与清理

用户补充「刚刚手快不小心给退出了，现在停止并且保持打开」。据此保留实际退出/重开后的全部记录，不要求重做，也不把它描述为精确按计划执行的一次独立停止实验。

| 实际运行 | Host 收到 / 客户端绘制 | 原生最终阶段 | 结果 |
| --- | ---: | --- | --- |
| 同场景主对照，原生约 134.66 秒 | 2631 / 2259 | action-done | 新身份核验允许关源，已关闭 |
| 随后 Lucy，约 12.57 秒 | 220 / 201 | action-failed | stop-requested-before-worker-start，安全取消并关源 |
| 随后 Lucy，约 2.03 秒 | 0 / 0 | stopped-before-action | 早停并关源；不当作动态播放验收 |

三轮均为 `reason=parent-stop`，原生 `windowClose.closed=true`、最终 `taskbarHide.cleanupSafe=true`；Host 再确认 absent/closed，failure=null、解码错误 0。最终只读枚举本轮源窗口为 0，采集/worker 为 0，DSH 已重开。没有外部强关源或终止原 WE 来补救清理。

## 日常保留与接续

本次是已保留 rc.27 的局部回归修复，日常依赖更新为：

`file:F:/dsh-wallpaper-plugins/release/plugins/dsh-whale-mist-0.6.0-rc.28.tgz`

保留当前用户控制的外观/选择/自动播放设置，没有恢复旧存储；当前播放停止。保留 rc.28 的 5 份 Profile 副本及指纹另存。若以后回退，先保存届时的新设置并确认范围；不能直接执行本轮恢复脚本去覆盖后续试用数据。脚本仅准备/解析，未执行。

本机还观察到部分场景的鼠标跟随，这是用户确认的现象。代码只有画面传输，没有 DSH 鼠标坐标或点击转发通道；推断源壁纸原有的鼠标视差响应被采集进了 DSH。WE 的[鼠标视差说明](https://docs.wallpaperengine.io/en/scene/parallax/introduction.html)支持这种机制，但没有验证所有场景的点击/坐标映射兼容。

自动播放已验证名单仍只有 Lucy；未因本次手动 scene 对照扩大。C1 生命周期与本次周期停顿修复均完成本机核心短验；后续新功能另按用户选择划定范围，不重复旧 GPU/长测。本轮未提交或推送。

## 证据位置

- 诊断/修前修后回归：`F:/dsh-wallpaper-plugins/.tmp/rc27-pacing-diagnosis-20261014-c0bada48`。
- 候选核包：`F:/dsh-wallpaper-plugins/.tmp/rc28-candidate-20261014-52074310/package-audit.json`。
- 本轮实机：`F:/dsh-wallpaper-plugins/.tmp/rc28-desktop-20261014-105251-6875f0`。
- 当前开始前备份：`C:/Users/HP/.dsh/backups/official-desktop-before-pacing-rc28-20261014-105251-afe9e4`。
- 汇总：实机目录内 `acceptance-digest.json`、`playing-pacing-comparison.json`、`final-pacing-comparison.json`、`stopped-confirmed/summary.json`、`daily-keep-confirmed.json`、`rc28-installed-final.json`。

原始记录和样本完整保留，没有清 Temp 或历史证据。
