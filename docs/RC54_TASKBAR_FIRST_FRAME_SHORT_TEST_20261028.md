# rc.54 任务栏首帧实测：技术链路通过，视觉仍待确认，已恢复rc.53

2026-10-28。用户当轮确认“退出了……你自己操作吧，继续吧”后，由Codex新备份、临时安装、操作Lucy并收尾恢复。**真实原生记录确认首个发布帧、采集时钟0.119秒即触发动作；不再等待10秒。worker完成和停止清理通过，但不能据此宣布任务栏从创建起不可见。**

日常已恢复DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2，正常重开，助手核对原外观／布局，后台inactive、session空、capture0，原WE保持。用户离开期间委托助手操作，没有用户主观任务栏／流畅度验收；未改作rc.54日常，未发布或提交推送。

## 来源、授权与本轮备份

- 固定rc.54候选SHA256 `D9E28918522C3ABFF974465D53604583BAC520806D388EAE773F84BCDAF2F096`；临时安装43文件与原包匹配。
- 回退固定rc.53，SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`。范围见[候选与准备](RC54_TASKBAR_FIRST_FRAME_CANDIDATE_20261028.md)。
- 工具及证据：`.tmp/rc54-taskbar-first-frame-short-trial-20261028-a/`。本轮authorization在直接用户退出确认后新建，未复用旧许可、PID或端点。
- 新备份：`C:\Users\HP\.dsh\backups\rc54-taskbar-first-frame-short-trial-20261028-a`，包含5个顶层Profile文件、11个关闭状态Local Storage文件、活动rc.53安装／两原包、3项目标布局及媒体存储。恢复前另保留测后文件，没有覆盖失败记录或丢弃本轮新增数据。
- Computer Use先验证可用，再开始安装。UI操作仅用`node_repl`的`@oai/sky`；菜单正常退出／重开，没有终止原WE或改全局任务栏设置，没有发送DSH模型请求。

## 本轮实际播放

只选已验证Lucy、日常模式、自动播放关闭，没有切作者参数或外观值。开始后助手在DSH窗口中观察到真实背景画面，随后正常点击停止。仅一轮，没有重新开始或第二次试播。

原计划15–20秒观察，但初次快照未就绪及证据接线处理使实际播放延长：点击开始11:52:41.210Z，点击停止11:53:36.968Z，相隔55.758秒；原生Summary为54.265秒。不能把本轮写成20秒测试。

| 本轮原生证据 | 结果 |
| --- | --- |
| 目标location | `WhaleWallpaperProbe-261028115241-a0c5`，与有效播放快照、原生Summary和清理证明一致 |
| 真实请求配置 | `minSeconds:0`，HWND／PID／启动时间绑定本轮目标 |
| 首帧／触发 | sequence均为1，published=true，采集时钟0.119秒 |
| worker完成 | 报告采集时钟4.322秒，触发至完成差4.203秒；started／exited／cleanupSafe均true，无超时或终止 |
| 动作 | HrInit和DeleteTab均返回`0x00000000`，一次执行，无重试 |
| 在飞期间 | `framesWhilePending:122`，完成后的有效帧记录sequence125；没有等待worker结束才继续采集 |
| 源窗口 | 动作前后身份、可见／非最小化／非cloaked、位置、尺寸、style／owner等记录一致 |
| 停止／清理 | 原生reason=parent-stop，源关闭确认；Host inactive／session空，采集0、同location源窗0，原WE身份保持 |

**0.119秒是采集时钟，不是点击播放或源窗口创建后的时间。** 4.203秒还包括独立worker启动、验证、COM及监督收尾，当前未细分，不能直接说“Shell调用本身耗时4.2秒”。接口可能在worker退出前已经影响任务栏，本轮也没有对应视觉时间点。

Summary的frames=1542，而落盘帧日志total=1541、保留1200条，是计数与逐帧落盘不同的记录点；没有补造最后一条。1200条保留记录的hash均不同，原生最大cycleInterval记录169.73ms，但环形日志含抽样，不能把非相邻序号间隔当掉帧，也不把这些数值当显示FPS或主观流畅度。

原生原始文件6份已按location及capture PID核对后逐字节复制到工具目录`native-run-evidence/`，哈希与分析见`native-trial-analysis.json`。原路径`%LOCALAPPDATA%/Whale Appearance/wallpaper-preview/2026-10-28T115241-f69b-lucy/`保持。`taskbarHidden`／`altTabHidden`仍为null；没有用S_OK或DSH局部截图把它们改成true。

## 过程偏差和失败证据

1. 操作顺序有误：首次重开后才调用关闭状态runtime检查，且当时缺layoutAfter，工具在前置证明门禁拒绝。正常菜单退出、核对layoutAfter后，以独立`runtimeRecheck`标签重跑原检查并通过，原失败结果保留，没有放宽条件或伪造通过。
2. 重开后的第一次点选遇到`coordinate input geometry is unavailable`；按Computer Use规则刷新窗口绑定／激活及截图后重试一次成功，未复用旧坐标继续点击。
3. 首次`snapshotFinal`在启动期轮询后仍未满足captureStarted门槛，拒绝且未写身份文件。随后同一轮成功的`snapshotPlaying`记录了真实location／HWND／capture PID。清理和恢复使用独立脚本副本，明确绑定该成功快照及proof标签；其余身份／终结门禁保持，未复制快照冒充final通过。
4. 适配runner时发现restore脚本名同时用于默认和quiescent两个分支，精确锚点计数先拒绝；核实两处后在新副本分别指向同一严格恢复脚本，原工具／失败输出未覆盖。本轮实际走played恢复分支，不将已有播放说成“从未启动”。

新增副本和对应哈希在`runtime-recheck-adaptation.json`、`played-evidence-adaptation.json`。原34个模板保持。两次失败属于操作者时序／工具前置证明，不是rc.54播放故障，也不能从日志中删掉。

## 恢复及结论

恢复前确认DSH／采集／独立窗关闭、当前源消失及原WE身份，保留测后数据后依次恢复包、设置、布局及媒体。

- 关闭状态核对rc.53原43文件一致，5个Profile／11个外观存储文件一致；媒体两目标及布局三目标恢复检查通过，官方EXE／ASAR／WE文件和原WE身份保持。
- 正常重开后使用新鲜窗口／端点核对：inactive、session空、capture0，助手观察原外观及窗口布局正常。打开后的Electron存储会自然更新，关闭状态的精确哈希证明与重开后的运行证明分开保留。
- 该试验轮关闭，不继续操作旧轮工具；如需再测，另起新轮、重新确认方便并新备份。

本轮可定案的是：**实验10秒延时已从真实运行链中移除，异步动作后仍有新帧，正常停止／清理／回退通过。** 未定案的是任务栏初始入口是否可见、何时实际消失，以及用户感知流畅度；不标记“完全隐藏已解决”。

下一步等用户补充是否看到入口／接受当前表现，再决定是否另做一次专注视觉确认、保留候选日常或继续调查创建期入口／worker耗时；不自动进入owner／TOOLWINDOW、TS迁移、三体、GPU专项或公开发行。
