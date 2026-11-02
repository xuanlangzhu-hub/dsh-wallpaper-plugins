# rc.55阶段计时实测：worker身份检查耗时明显，已恢复rc.53

2026-10-29。用户本轮确认“已正常退出，可以临时安装诊断短验”后，新备份、临时安装并由助手操作一轮Lucy。**两份真实计时文件均取得：本轮DeleteTab前后记录差约1.2624ms，而worker内两次身份检查分别约921.3161ms、886.4631ms。不能再将此前3–4秒整体等待笼统归因于COM。**

本轮是一次诊断样本，不证明所有机器／场景都如此，也没有单独验收任务栏视觉消失时间或主观流畅度。已按约定恢复 **DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2**，原WE保持；正常重开后用户确认“原外观和布局正常，播放停止”。未留rc.55日常，未发布、提交推送、派发或清理。

## 固定包、新授权与备份

- [本机rc.55候选](RC55_TASKBAR_STAGE_TIMING_CANDIDATE_20261029.md)：43文件，SHA256 `0D93C59FF1D5E408C3763439A8197CC69F8054CC23064FDDC6A0B3FB6D60FC29`。临时安装后逐文件与原包一致。
- 本轮工具／证据：`.tmp/rc55-taskbar-stage-short-trial-20261029-a/`；新备份：`C:/Users/HP/.dsh/backups/rc55-taskbar-stage-short-trial-20261029-a`。
- 用户确认后才新建authorization，核对关闭状态，备份5个顶层Profile文件、11个关闭状态Local Storage文件、活动rc.53与两归档、3项目标布局和2项目标／9文件媒体存储。没有复用旧许可、PID、端点或备份。
- 本轮使用更新的computer-use技能与`node_repl`／`@oai/sky`操作窗口。CLI执行安装与文件核对，正常应用菜单退出／重开，没有直接PowerShell UI自动化、结束原WE、改系统任务栏或发DSH模型请求。
- 安装后先完成layoutAfter和关闭状态runtime检查，再重开，未重演上一轮先后顺序错误。

## 实际播放与时长偏差

只选已验证Lucy，日常模式、本轮关闭自动播放，不改作者或外观值；一轮开始、正常停止，无重启或重复试播。成功snapshotPlaying记录本轮location、HWND、源PID与capture PID，verifyLiveCleanup随后确认停止和所属源窗消失。

**原计划约20秒，但本轮交互取证控制流程实际没有按计划及时停止。** 点击开始02:00:48.941Z、停止02:01:51.359Z，间隔 **62.418秒**；原生Summary为 **61.36653秒**。如实保留这个偏差，不写成20秒测试，也不把它解释成插件配置了62秒定时。单步脚本均未超时；本轮没有细分这段控制流程的额外耗时原因。

| 原生／清理事实 | 结果 |
| --- | --- |
| 本轮location | `WhaleWallpaperProbe-261029020049-f889` |
| 配置及首个发布帧 | minSeconds=0，sequence1，采集时钟0.127秒，published=true |
| 总体动作报告完成 | 采集时钟4.371秒；与触发相差4.244秒 |
| 异步期间 | framesWhilePending119；动作完成后新帧sequence122 |
| Shell与worker | HrInit／DeleteTab均S_OK，worker started／exited／cleanupSafe=true，pending=false，无超时或强制终止 |
| 窗口 | 动作前后完整identity记录相同；源由原WE同PID承载，只关闭本轮location窗口，不结束该进程 |
| 停止 | parent-stop；源正常关闭，Host inactive／session空，capture0、所属源窗0，原WE身份保持 |

0.127秒仍是采集时钟，不是点击或窗口创建时钟。Summary1673帧／changed1672，日志total1673、保留1200条；是有限日志及不同计数语义，不作为屏幕FPS或流畅度验收。原始taskbarHidden／altTabHidden仍null。

## 两个独立时钟中的实际阶段

日志收集器在已有严格清理证明后复制6份原生日志和2份可选计时文件，按location／HWND／源PID／capture PID及目标StartUtc绑定。8份均逐字节留存于`native-run-evidence/`，指纹见evidence-collection.json；两份sidecar均state=observed、truncated=false。它们不是清理证明，worker的clockId中PID也没有单独通过OS再次核验。

### 捕获父侧：capture-parent自身时钟

| 记录点区间 | 本轮差值 |
| --- | --- |
| action-scheduled→executor-entered | 996.6537ms |
| worker-start-begin→worker-start-returned | 37.8924ms |
| 其中Process.Start前后 | 31.4336ms |
| Job创建／绑定 | 0.7394ms／0.6028ms |
| worker.Start返回→观察到退出 | 2091.2995ms |
| 读取终结结果 | 17.1009ms |

**996.6537ms不是纯线程排队时间。** 源码`RunActionCore`在进入执行器前先执行`_probe.Inspect`并检查状态；该区间包含调度、一次身份／状态检查、记录和其它调用开销，当前没有再细拆。worker等待区间包含子进程运行，不能把它与子侧各阶段再相加计算总耗时。

### Shell worker：shell-worker自身时钟

| 记录点区间 | 本轮差值 |
| --- | --- |
| 托管入口中的DefaultDesktop检查 | 58.4896ms |
| worker核心入口→监督授权通过 | 8.8339ms |
| 第一次身份检查 | **921.3161ms** |
| COM对象创建 | 7.8419ms |
| HrInit前后 | 0.9115ms |
| 第二次身份检查 | **886.4631ms** |
| DeleteTab前后 | **1.2624ms** |
| COM释放 | 0.5687ms |

这些是本进程诊断记录点之间的差值，含少量记录开销，不是通用API性能基准或图标消失时间。没有相减父／子不同起点的elapsed，也没有把worker托管入口当作OS进程创建瞬间。

本轮可以确定的是：在已测worker阶段中，两次身份检查远长于实际DeleteTab调用。不能确定的是身份检查内部每一子步骤各用了多少、调度区间中哪部分是排队，以及用户看到图标实际消失的时刻。父侧在worker结果返回后还会再次Inspect以记录afterIdentity，M1未单独包围这次检查，不能给它填一个精确耗时。

## 源码核对与下一项最小范围

读取固定M1源而没有更改它，确认`RealWindowProbe.Inspect`依次经过：

1. `SourceWindowHelperQa.FindExactTitle`→`FindProbeWindows`，进行一遍顶层枚举。
2. `SourceWindowHelper.VerifyExpectedWindow`→`FindWindowsByTitle`，再进行一遍顶层枚举并复验。
3. 构造快照时`ZOrderIndexOf`再次调用`FindProbeWindows`。

`FindProbeWindows`和`FindWindowsByTitle`当前在检查标题之前，先对枚举到的窗口查询`Process.ProcessName`，因此不相关窗口也会触发进程元数据读取。**这是可复核的开销模式和下一步假设，不是已经测得ProcessName独占0.9秒。** 单次样本及当前阶段粒度不足以把全部耗时归因到这个函数。

下一步仅离线研究并回归一个小改法：在既有枚举中先按标题筛选，再对候选查询进程；比较返回对象和拒绝分支是否保持，同时计数无关进程查询是否减少。保持每次校验的新鲜性、同名歧义拒绝、目标HWND／PID／StartUtc、wallpaper64、可见／最小化／cloaked要求及关闭围栏；不删除复验，不跨帧缓存身份，不预热worker，不改owner／TOOLWINDOW／SW_HIDE。先在新的隔离源上用底层IO替身和有界回放验证，再决定后续候选，不自动实机。

## 恢复与收尾

29个运行步骤均退出0、无超时，包含成功的playing证明、清理、8文件收集和严格played恢复。没有把计时成功当成worker终结依据，也没有使用未产生的final快照或quiescent“未启动”分支。

正常退出后先保留测后数据，再恢复rc.53原43文件、5个Profile／11个外观存储、媒体2目标／9文件及布局3目标，关闭状态精确核对通过；官方EXE／ASAR／WE文件和原WE身份保持。正常重开后用新窗口和新端点确认inactive／session空／capture0，助手观察外观布局正常，用户随后明确确认“原外观和布局正常，播放停止”。打开后的Electron存储自然变化，不与关闭状态哈希证明混用。

`native-trial-analysis.json`、`closeout-integrity.json`和`closed-out.json`已写；本轮不可复用。361保护输入、37模板／收集器、rc.53及rc.55归档保持。真实截图只在本机工具显示，没有加入Git或公开包。本轮无实现补修、发布、提交推送、派发或清理。TS随后、UI保持、三体暂缓。
