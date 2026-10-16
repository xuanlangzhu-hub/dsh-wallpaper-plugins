# C1 QA 第一轮复审：构建与自检通过，暂不进入实测

2026-10-12，Codex。审查DS的`qa/taskbar-hide`和交付记录，仅重编译/无窗口检查。
**结论：局部返工F1–F4；不要安装、开WE窗口或调用真实DeleteTab。** 日常rc.24保留。
不是PowerShell语法问题；主要遗漏在参数、生成程序的生命周期和动作超时接线。

## 已通过与证据范围

- 独立重编译退出0，accepted源码和资产未变；DS的42项自检复跑42/42通过。
- COM接口槽位和PreserveSig、可见性拒绝、一次尝试、视觉字段null等基本结构保留。
- 原DS文件与报告完整复制到本轮证据；没有修改其实现、覆盖旧日志、安装或真实窗口操作。
- 自检多数直接测试策略，身份错误由FakeProbe预设抛错，COM顺序/释放由FakeAction自身实现；
  这不覆盖生成Program与真实runtime的连接，也不直接验证ComAction的共同控制流程。

独立证据目录：`F:/dsh-wallpaper-plugins/.tmp/taskbar-hide-review-20261012-cccb9d35`。
`rebuild`是此次重编译，`selftest-rerun.json`是42项结果，`ds-delivery-snapshot`和`DS_DELIVERY_SNAPSHOT.md`是原交付副本。
`counterexamples`链接DS实际解析器、runtime、STA执行器及accepted CaptureArguments，只替换窗口/WE/日志边界；没有真实Shell调用。
结果在`counterexamples/bin/Release/net10.0-windows/counterexamples-isolated.json`。
初始化失败用生成Program的相同try位置作无窗口模拟，不是声称实际运行过WGC；结合原生成源码定位可达性。

## F1 / P1：实验选项没有绑定实际捕获

位置：TaskbarQaOptions.cs的Extract/RequireIdentity，build.mjs的入口与TaskbarQaRuntime.Create。

独立组合解析确认：

| 输入 | 实际结果 |
| --- | --- |
| QA默认25秒，原捕获位置参数1800秒 | 两个解析器都接受；实际循环仍1800秒 |
| QA HWND=4242，捕获位置参数HWND=9999 | 接受；动作和采集可以指向不同窗口 |
| frames后跟`--owned-location <name>` | 接受；LastOrDefault取到name，绕过模式检查 |
| min-seconds=1 | 接受，不满足约定的至少5秒正常基线 |
| 无QA标志，accepted合法forever/pipe/owned-location调用 | 被全局Forbidden拒绝，破坏无标志兼容 |

DurationSeconds只进入报告，没改变或交叉验证实际parsed.Duration；报告25秒不等于有25秒上限。

修正：先用同一个CaptureArguments.Parse得到最终捕获请求，再验证QA与其一致。
HWND必须相同；仅memory/pipe、有限实际时长≤60秒、min≥5且小于实际时长。
两套时长字段择一为权威或拒绝矛盾，不允许报告和执行不同；默认25的语义写清楚。
QA专用禁止条件仅在enabled下生效；无标志原accepted合法argv原样通过。
全部校验应在建立实际窗口/COM边界前完成；参数顺序、后置owned-location/echo标志均覆盖。

## F2 / P1：CleanupOuter仍在内层finally

位置：build.mjs的cleanupAnchor/cleanupHook，以及生成Program.cs。

注入点是`session.Dispose()`所在的采集循环finally；此前已执行EnsureDefaultDesktop、身份检查、CreateDevice、CreateItem、
创建pool/session和StartCapture。任一初始化抛错直接落到最外catch，不会进入这个finally。
独立模拟在CreateItem位置抛错时关闭调用0次；正控制手动走同一CleanupOuter时关闭1次。
因此原报告“覆盖CreateItem之前失败”目前不成立。

修正：真正建立跨整个已取得资源阶段的外层try/finally，初始化之前的失败也走受绑定清理。
先验证输入/身份，再接管本轮source；不要因无效或不完整输入清理一个未获授权窗口。
正常、停止、stdin断开、WGC初始化/发布异常共享一条QA清理路径，避免CleanupOuter/Cleanup和accepted父丢失分支重复关闭。
清理检查与实际EnsureProbeWindowClosed调用之间不能退回仅location验证，至少传expectedPid并保留HWND/StartTime复核；
已无目标时直接记已结束，不能因名字后来重现又关闭新窗口。身份无法确认时非零结束，不杀原WE。
补生成程序生命周期接缝上的假初始化、假窗口关闭检查，不能只调用策略的CanCloseOwned证明finally正确。

## F3 / P1：线程等待超时没有终止后台动作

位置：TaskbarList.Run中的Thread.Join，以及策略在创建线程前完成的身份验证。

独立假动作延迟120ms，Run等待20ms后报告失败；随后同一后台线程仍执行了一次动作。
这证明的是执行器的超时语义，不是声称Windows真的误删按钮。
真实COM初始化/调用迟到时，主线程可能已开始关闭源，但后台仍持有旧HWND；不会因Join超时自动取消。

修正：将“等待超时”与“操作已终止”分开；不能超时后放任原工作线程继续执行并开始清理目标。
建议用独立、受控的QA动作worker进程承载COM：超时/停止先终止并确认该worker退出，再关闭源；不结束WE/DSH。
如果选其它方案，必须证明不存在报告超时后继续触碰窗口的路径，不能仅增加一个CancellationToken而不处理在途调用。
身份和停止状态在实际执行侧、紧靠DeleteTab再次验证（HrInit后也复核），不能仅把之前验证过的裸HWND送进队列。
COM创建/调用/释放保持同一线程策略；对wrapper下面的接口/工厂注入假边界，测试真实HrInit→DeleteTab→释放流程。
补迟到/阻塞/停止/目标复用反例，保证退出后无遗留工作者和迟到窗口动作。

## F4 / P2：动作时点与取证记录不够准确

位置：build.mjs的frameHook，TaskbarHideStrategy.Write/TaskbarQaRuntime.Write。

- hook在frames++和FramePipe.Write之前，sequence比实际发布帧小1；当前帧也还没成功发布。
  pipe发布失败仍可能先删按钮，不能用这个记录说明“已发布有效帧后操作”。
- 已从stdin收到stop的时刻可能在帧处理期间；触发处没有再次检查stopSignal。
- action JSON的location恒null；首个有效帧事实未单独保存，成功路径只保留DeleteTab HRESULT，没有HrInit结果。
- 报告写入IO异常静默忽略，默认固定文件可覆盖上轮；报告缺失仍可能退出0。

修正：把触发放在有效JPEG已完成发布之后，使用同一帧的真实sequence/hash/sourceTimestamp；动作前再次检查停止状态。
单独记录首个有效帧、触发时点、精确location及请求/实际身份，保留HrInit和DeleteTab各自结果，视觉字段继续unknown。
报告放本轮新输出目录，拒绝已有证据文件；写入失败可继续执行必要清理，但最终明确失败/非零，不静默吞证据。
使用假发布成功/失败和停止检查覆盖hook顺序，别把前一帧归为动作之后的画面。

## DS本次返工范围

仍仅改`dsh-whale-mist/qa/taskbar-hide/`和`dsh-whale-mist/docs/TASKBAR_QA_DELIVERY.md`。
不改src/accepted原生/资产/包版本/SDK/配置/外观，不安装或真实实测，不提交推送/清Temp。
按F1–F4补接缝和检查，不扩owner/TOOLWINDOW、任务栏事件循环、UI美化或完整隐藏方案。

保留此次失败证据，改后另建输出目录；交付记录改写为当前实际结论，并明确此前“外层清理/有界动作”哪些断言已补证。
无需重复GPU/长时/React流程。构建的CS2002重复Compile警告可顺手消除，属于小整理，不能代替四项修正。
自检入口仍须在窗口/COM/WGC前返回。完成后交Codex复审，再另约用户实测。
