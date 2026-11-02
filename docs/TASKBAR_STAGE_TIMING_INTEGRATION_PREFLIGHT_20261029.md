# M1阶段计时固定包整合预检：通过，尚未生成或安装候选

2026-10-29。用户要求继续后，在固定rc.54载荷上仅替换[M1阶段计时补丁](TASKBAR_STAGE_TIMING_OFFLINE_REPAIR_20261029.md)的已审DLL，完成离线依赖、启动入口、定义差异和协议预检。**43文件中只有WallpaperProbe.dll改变，其余42文件保持；原启动器、deps／runtimeconfig和8个依赖DLL保持。** 未改日常rc.53或原rc.54归档，没有生成安装包、版本、发布或真实运行诊断。

最终证据：`.tmp/taskbar-stage-integration-20261029-c/`，六个直接子阶段退出0、无超时、退出已确认；总截止120秒。14项纯原生协议检查、17项固定Host检查及3项实际Host argv→原生解析往返通过。上轮70／41项未机械重跑，凭固定源和产物指纹继承，不累计成新实机结果。

持久工具：`dsh-whale-mist/qa/taskbar-stage-timing/preflight.py`、`MetadataProbe.cs`、`metadata-allowlist.json`、`sidecar-host.test.mjs`及`INTEGRATION.md`。本轮只有离线副本、QA和文档，没有共享实现／生产assets／Profile／DSH／WE操作、进程窗口查询、提交推送、清理或派发。

## 固定载荷与依赖

- 原rc.54归档SHA256：`D9E28918522C3ABFF974465D53604583BAC520806D388EAE773F84BCDAF2F096`，严格按`release-sources/rc54/package-manifest.json`逐成员核对并解出43文件，拒绝重复／意外成员及路径越界。
- 原rc.54 DLL：`6313602FE6CB8E8A80DCB93BE0D3D44EF8E961CCA1B7CC10E8F4F1AD5CCCD37D`。
- M1 DLL：`2C2C1FFEF7D0B491ED4EA68BC63FD60C32D58338DB2E008CD19938EC1EF4BB5F`，来自`.tmp/taskbar-stage-timing-20261029-b/isolated/native-source/bin/Release/net10.0-windows10.0.19041.0/`。本轮未重编该DLL，检查了19份源及上轮各产物指纹。
- 新旧deps的RID命名差异归一化后target图与libraries相同；8个供应商依赖DLL逐字节一致，不引入新依赖。保留原apphost、deps、runtimeconfig，不复制新编译的EXE／PDB或整个bin目录。
- 原apphost中固定托管入口名仍为WallpaperProbe.dll；新旧程序集身份均WallpaperProbe1.0.0.0，Amd64，19项程序集引用、程序集入口的语义签名一致。这是静态入口核对，不是旧apphost已经真实启动新DLL的运行验收。
- staging-manifest.json列出43文件指纹，仅一DLL变化。固定rc.54 JS／UI／作者读取、媒体桥等相对日常rc.53的既有成果保持。离线staging仍带原rc.54 manifest，不能直接拿它当新的同版本安装包。

## 定义／IL差异严格列明

检查使用PEReader，不加载目标程序集。类型、字段、方法、属性用语义名称和签名解码比较；IL元数据操作数、局部签名和异常类型按语义归一化，避免新类型插入造成的token编号变化被误判为所有代码都变了。

| 结果 | 数量与解释 |
| --- | --- |
| 定义总数 | 3255→3399，包含私有、编译器生成项和属性，**不是公开API数量**；也不能与旧工具不含属性的2717项直接比较 |
| 新增定义 | 198，其中TaskbarTiming及其record／闭包子树133项；其余为计时字段、观察属性、内部参数／包装方法和既有闭包重编号 |
| 删除定义 | 54，包含被新签名替换的方法／构造函数及编译器闭包编号／静态缓存变化，不是删除业务功能 |
| 同键定义属性／签名变更 | 0；参数新增表现为旧键删除、新键增加 |
| 有方法体的方法 | 1490→1564；共有键中归一化方法体改变12项，逐项固定旧／新哈希 |

六处内部签名替换：Runtime.RunWorkerEntry、TaskbarList.RunWorkerEntry、TaskbarList.ExecuteCalls、ComAction参数构造函数、TaskbarWorker.Run以及RealWorker构造函数；新增entry-core包装、DiagnosticStage属性及访问器。计时类有6个类型定义，既有相关闭包还有编号变化，不能概括成只有一个类型变化。

12项共有方法体变化已核对：Program的异步Main.MoveNext；Runtime构造／Create／Finish；Strategy.OnFrameAsync；TaskbarList的RunTrace／RunWorker／SelfTest；ComAction无参构造／DeleteTabTrace；RealWorker.ReadTrace／Start。其中部分只由闭包编号或可选参数调用点的编译变化引起，并未改相应源方法体。

`metadata-allowlist.json`固定新增／删除／变化的完整键、定义值、12项方法体旧新哈希，以及两DLL指纹；不使用“所有Taskbar相关变化都允许”的泛化规则。没有沿用旧“定义签名全相同”的断言，也没有放行白名单外变化。此结论面向当前固定载荷，不承诺任意外部调用者仍能按旧内部方法签名调用。

## 帧、日志、argv和清理证明

独立的纯测试入口链接与已审DLL对应的冻结源，**不执行WallpaperProbe的Program入口**，没有DefaultDesktop／窗口／真实worker／COM／采集。元数据检查针对实际DLL，协议样本来自同源真实类；不能把两者合并叙述为已运行了安装包。

- 真实FramePipe类生成WHL1字节，固定Host解码器按分片读取，并拒绝损坏头和截断载荷。样本是4字节JPEG标记占位，不进行图像解码或视觉验收。
- 原生参数解析拒绝重复／未知／无所属location等负例；固定Host生成的daily、preview和关闭taskbar-hide回退三类argv再交回原生解析器，保持启动参数与模式。
- 真实Runtime／Strategy使用窗口和动作IO替身生成周期状态、确认／未确认／未启动Summary，以及终结action文件；Host保持原成功和拒绝分支。替身成功使用Execution.FromWorker的完整WorkerOutcome，不把单纯API成功当作worker已退出。
- 额外6项固定Host测试直接调用其独立清理验证实现：只有计时文件而缺action、action损坏、worker未确认退出、OS报告worker仍在时均不能清理；有效action即使没有计时文件或计时文件损坏也能通过。计时文件故意带伪造cleanupSafe／exited仍未被读取或采信。
- 所有Host过程／身份查询和helper均注入底层替身；意外execCommand抛错。既有测试模板的默认OS查询在本轮明确替换，不依赖当时机器进程空集；本轮实际查询当前进程次数为0。

## 失败夹具与留档

`-a`只生成元数据清单并明确integrationAccepted=false，供逐项复核白名单，不是通过报告。

`-b`预检中，14项原生和15／17项Host检查通过，但两个新增正例被严格文件门禁拒绝：旧协议夹具用Execution.FromResult表达API成功，实际action的worker started／exited为null。该正例并不具备它声称的独立worker终结事实。未修改Host、终结字段或放宽门禁；改为让真实Execution.FromWorker从完整进程IO替身结果生成样本，再在全新`-c`目录完整运行通过。旧失败结果、样本、日志均保留。

没有新增执行真实worker的测试；父失联、Job绑定和真实COM耗时的覆盖界限仍按M1报告说明。新sidecar没有参与清理授权，也没有写入帧stdout／worker终结JSON。

## 保护与下一步

361项保护输入、M1冻结源／产物、实际43文件旧归档与原启动资产保持，源、DLL、QA在检查前后指纹一致。日常仍DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2，原WE、公开GitHub／npm和备份未操作。没有新的真实阶段耗时，也未修复创建期闪现。

下一项可准备**单独新版本的本机诊断候选**：固定rc.54载荷只换本轮DLL，候选版本／README另列；不覆盖rc.54同版本原包，不整体打包共享rc.30／Trace树或复制新apphost／deps。核包和全新短验工具准备后，真实安装仍先取得当时方便／无任务与正常退出确认、新备份，默认恢复日常rc.53。本轮没有提前生成候选或请求实机操作。

任务栏先取得分段证据，再决定优化路径；不自动预热worker、改owner／TOOLWINDOW／SW_HIDE或删监督。TS随后、UI保持、三体暂缓。
