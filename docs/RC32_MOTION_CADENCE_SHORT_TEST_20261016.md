# rc.32 逐帧诊断临时短测记录

2026-10-16后续：[用户新增场景差异观察](MOTION_CADENCE_SCENE_SPECIFIC_OBSERVATION_20261016.md)。三体背景与其它水流平滑、球体突变；本机作者说明实时演算及超高品质/>60fps提示已只读核对。先分离独立源实例演算与DSH输出，30fps采集不等于源30fps；下文569ms接收波动保留但不当唯一视觉成因。上轮恢复/保持停止是当时确认，用户随后自行试壁纸，不能套用为当前播放状态。

2026-10-16，Codex。用户回复“好推出了，你继续吧”，接续此前确认方便、暂停其它助手/DSH无任务、正常退出后临时安装与短测的询问。本轮已核验 DSH 与 capture/worker 为零，不复用昨日的退出确认。

## 最终状态：短测结束，已恢复日常rc.28

14:13恢复完成：官方CLI装回rc.28，28安装文件逐字节匹配；当轮五Profile/十Local Storage恢复，诊断进程退出，父进程/用户/系统trace变量均与原环境一致。原WE PID11992/启动身份与官方EXE/asar/WE文件保持；独立源窗口、capture/worker均为0。用户确认“重开正常，播放已保持停止”。第一次恢复门禁遇到DSH仍在退出收尾，修改前即拒绝，待只读检查进程为0后重试成功，没有强杀或绕过门禁。

用户鼠标轮反馈原文：**“好了，还是会加速，减速”**。rc.32是诊断候选，本轮没有修复运动不匀。具体接缝线索与下一步见下文；不能据此宣布唯一视觉根因。

## 三个实际run与证据资格

| run（目录时间为UTC） | 实际采集总时长 / 原生帧数 | 客户端trace | 解释 |
| --- | --- | --- | --- |
| `060759-f845` | 35.679s / 993 | 5765保留，溢出0，未终态确认，重复事件78，degraded | 用户说明鼠标动了、放过后台，然后手动重新开始；保留为受干扰样本，不当静止轮，也不推定自动重启缺陷 |
| `060839-014c` | 48.465s / 1372 | 8081保留，溢出0，终态确认，重复0，available | 据两条合并回复解释为重新开始后的预期静止轮；用户约20s是观察时长，不等于run全生命周期；available只表示诊断健康，不证明全程前台/静止 |
| `061123-adba` | 55.250s / 1572 | 总9027/保留8192，头部覆盖835，终态确认，重复事件191，degraded | 按鼠标轮提示操作，用户确认症状仍在；保留部分证据，不能称完整窗验收通过 |

三轮尺寸均为1302×776、目标30fps、实际kernel-highres-worker。停止均为parent-stop，原生owned窗口closed、taskbar cleanupSafe，Host cleanup absent/closed且failure=null。真实helper命令含`--cadence-trace`，三域enabled=true，原生flushFailed=false；启用已实证，不只依赖启动环境推断。

实际run明显长于预设15–20s，原样保留，不改时间标签、不删835溢出和191重复标记、不扩大容量，也不重跑凑available。没有逐秒证明整个run的鼠标/前台状态；特别是静止run的>100ms接收长间隔仅出现在原生时钟30s之后，不能将这些尾部波动直接定性为已确认静止观察期。

## 已确认的时序接缝

严格使用同一run、同一连接/代次、相邻seq；每个间隔都在自己的单调时钟域内求差，**不直接跨域相减**。

鼠标run `WhaleWallpaperProbe-261016061123-1e62`、`conn-d5a64a`、generation4，seq423→424：

| 同两帧的测点 | 间隔ms |
| --- | ---: |
| WGC源时间戳 | 29.164 |
| 原生pipe write | 39.825 |
| Host hub收到 | 39.768 |
| Host stream write调用 | 39.762 |
| 客户端accept | **569.1** |

随后客户端seq425→426→427→428→429→430的接收间隔为3.1、0.3、2.6、4.1、3.4ms，存在“先隔很久、再密集接收”的具体记录。seq423的重复trace是同时间戳的重复副本；独立接缝分析只去掉完全相同的seq/时间戳副本后取上述例子，原记录及degraded标志完整保留，不把过滤后的局部例子当成整体恢复健康。鼠标重复键共191个且时间戳均相同，来源机制尚未定位，不直接认定实际帧重复/原生重复发送。

原生时钟10–20s对应的一段也显示：重新开始后的静止run seq297–593，accept间隔最大42.5ms、draw调用间隔最大49.3ms；鼠标run seq296–592的保留段内仍出现569.1ms accept及566.7ms draw间隔。该固定窗口按源码时钟/seq选择，**不是已逐时对齐用户动作的严格A/B**。鼠标分析器统计包含重复及缺头影响，不能把其汇总均值/P95当成干净对照或通过标准。

由此可支持的范围是：**这次trace-on播放中，Host写调用到客户端accept之间出现了明显接收节奏波动；随后latest替换、解码与draw收到的节奏也可能受影响。** Host的res.write返回/drain不证明字节已送达浏览器；目前无法区分Host之后的传输/桌面桥缓冲、reader回调被延迟、主线程阻塞、解析/同步处理，以及trace本身的开销。不能说已证明某个网络层或RAF有错，更不能说球的模拟时钟/屏幕物理速度已被定位。前台尾部切换混杂与诊断观察效应仍需考虑。

本轮没有修改FPS/RAF/latest/P4或协议，既有P4等待改善保留；也没有足够依据盲改上述部分。下一步可交[小G窄调查任务](GEMINI_NEXT_MOTION_CADENCE_INGRESS_20261016.md)，先拆开reader/解析/主线程这段，Codex独立复核后再决定最小改动，不直接进入又一轮实机。

## 最终保护与证据

34复审输入、54当前保护、29工作区打包源、旧24归档及新增rc.32指纹均保持；工作区rc.30/12运行资产保持，日常rc.28恢复。`final-protection.json`、`final-process-state.json`通过，用户重开确认已记录。未改生产实现/调度/持久环境、未提交推送或自动发消息，未额外录屏或重跑GPU/长测。

本轮目录内每个`run-*/`保存九份原始元数据及SHA256清单，分析器副本与固定源码一致：

- `user-first-runs.json`、`user-final-context.json`：用户操作澄清、症状反馈与恢复确认。
- `idle-run-observation.json`、`mouse-run-observation.json`：只读逐秒原始状态；静止观察器最先匹配到受干扰run，不冒充第二run连续采样。
- `run-*/cadence-analysis.json`、`aligned-frames.json`：三域实际数据与原健康标志。
- `same-sequence-gap-evidence-v2.json`：同seq严格相邻接收间隔及各域对应间隔；v2仅把初版误称nextFive但实际列六个跟随间隔的字段改为following，数据不变、初版保留。`native-window-10-20s.json`：固定原生时钟窗口的辅助分析。
- `restored-before-reopen.json`、`rc28-installed-restored.json`、`restored-environment.json`、`source-windows-after-restore.json`、`final-protection.json`、`final-process-state.json`：恢复/清理/保护证据。

## 历史：安装与等待第一轮时快照

- 14:06 完成当轮五份 Profile 与关闭状态十份 Local Storage 文件备份并逐一核验。
- 14:06 通过官方 CLI 临时安装 rc.32；29 个实际安装文件与[候选归档](RC32_MOTION_CADENCE_CANDIDATE_20261016.md)逐字节一致，关闭状态存储十文件未变。
- 14:07:37 打开官方 DSH，启动 PID 53088；仅本次子进程启动环境增加 `WM_WALLPAPER_CADENCE_TRACE=1`，未修改父进程、用户或系统环境变量。Host 是否在真实播放时启用仍需据 helper 参数与三域 trace 实证核查。
- 用户已收到第一轮操作提示：三体、日常模式、自动播放关闭、原窗口/外观，前台鼠标静止约20秒后立即停止，清理完成再回复；整轮尽量30秒内结束。
- 正在仅从新 run 目录读取状态，等待用户操作。尚无真实测量结论，不称运动问题已修复。第二轮鼠标短测与最终恢复尚未执行。

上述安装时刻，安装为临时rc.32、恢复尚未完成；此历史快照现已被开头的最终恢复记录取代。原 WE PID 11992 / 启动时间 `2026-10-16T00:50:46.4381463Z` 保持，未执行退出/重启原 WE。

## 本轮路径与恢复入口

- 证据：`F:\dsh-wallpaper-plugins\.tmp\rc32-desktop-20261016-140559-617cb33f`
- 备份：`C:\Users\HP\.dsh\backups\official-desktop-before-cadence-rc32-20261016-140559-617cb33f`
- `baseline.json`：本轮 Profile/Local Storage/官方文件/归档/原 WE 身份与旧 run 列表。
- `installed-rc32.json`、`install-rc32.log`：官方安装与实际29文件核验。
- `launch-environment-before.json`、`diagnostic-launch.json`、`launch-trace.ps1`：原 trace 环境均为空；只对子进程提供启用值，原启动环境保留。
- `watch-run.py`：只读新 run 状态，不启动/停止播放，不采 CPU/GPU 或图像。每轮保留独立原始状态。
- `trial.ps1 -Stage restore`：**须用户停止清理并正常退出DSH后**，核验DSH/capture/worker为零与原WE身份，保存测试时配置，再用官方CLI装回rc.28，恢复当轮五Profile/十存储文件；最后运行 `python verify-installed.py daily` 核对。不得在DSH运行时恢复，也不得套用上一轮备份。

待两轮结束后保存三域 trace、分析健康与节奏代理并填写结果；若缺失或溢出按 degraded/unknown 保留，不改容量、FPS、RAF/latest/P4 或协议。
