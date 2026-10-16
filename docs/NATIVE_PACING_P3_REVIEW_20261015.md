# P3 原生节奏观测复审：仅补 R1–R3

2026-10-15，Codex。审查 [Gemini交付](NATIVE_PACING_P3_DELIVERY_20261015.md) 与 [原任务范围](GEMINI_NEXT_NATIVE_PACING_P3_20261015.md)。**隔离构建、现有专项与正常数值控制通过，但暂不准备安装候选；只需局部补 R1–R3。** 已有分类、统计字段、原生循环位置和报告主体保留，不重做P2/GPU/长测。

本次只做源码/隔离离线核验，未修改实现、未安装/打开壁纸、未操作DSH或停止原WE、未提交/推送。20份审查输入与32份保护输入前后哈希一致，五份Profile配置不变；日常rc.28的28安装文件仍与活动归档一致，rc.28/rc.29包未覆盖。

## 已通过的部分

- 固定输入独立复制后构建实际WallpaperProbe工程：0警告/0错误，输出在本轮独立目录。
- npm run check通过；P3五类、P1九类复跑通过。Host源码未改，本轮未额外重复Host/P2全套。
- 用实际NativePacingTracker.cs独立编译数值控制：请求10/实际25、记录后20/总工作35、三次空帧请求2/实际5得到各自正确计数/和；新tracker初始零和nullable max保持，实际序列化字段数为22。
- 正常实际tracker序列化值进入真实分析器，阶段均值10/25、比较有效。
- 数值溢出1e309经完整analyzePlayback入口被既有全局有限数守卫拒绝，**没有把这一控制误列为缺陷**。
- 当前原生资产、manifest/主题/client/Host非目标源码与日常安装保护通过。

这些是离线/合成证据，不代表实机等待偏差或帧率改善。

## R1：纯观测改动改变了请求等待算法

位置：dsh-whale-mist/qa/wallpaper-probe/Program.cs:307。

既有算法对剩余预算作int截断；新实现改为Math.Round后取int，同时用beforeSleep取得的totalWorkMs替代原等待点即时读取的elapsed。新统计自身执行后，计入等待预算的边界也不再一致。

实际新表达式的C#数值控制：

| fps | 同一总工作ms | 既有截断请求ms | 新四舍五入请求ms |
| --- | ---: | ---: | ---: |
| 30 | 15.6 | 17 | 18 |
| 30 | 17.8 | 15 | 16 |
| 30 | 34 | 1 | 1 |

因此“未改调度策略”的声明不成立。这里不声称已测得真实额外延迟；但在测定时/调度偏差之前，不应改变被测算法。

补法：恢复原截断、最低1ms和等待点的即时工作扣除规则，仅增加旁路计时/记录。把预算边界和非整数剩余毫秒锁进新增回归；不改目标FPS或引入全局定时器/自旋。

## R2：按单个计数类型先过滤，隐藏中间异常与回退

位置：dsh-whale-mist/qa/perf/analyze-playback.mjs:936–939及后续校验。

samplesWithPacing先要求typeof pacingWaitCount为number，才进行其它必需字段/回退检查。独立完整入口反例：
1. 首尾样本正常；
2. 中间样本pacing对象仍在，但pacingWaitCount是错误类型，经真实sanitizeStatus变为null；
3. 同一中间样本postRecordCount与postRecordSumMs从已正计数回到0。

该整条样本被过滤掉。结果仍segmentValid=true、nativePacing.valid=true、dataReady=true、nativePacingDeltas存在且没有reason，观察到的回退被隐藏。

补法：区分“旧helper没有P3对象”和“P3对象已存在但字段缺失/错误”。后者不能先排除再把剩余数据判有效；必须保留异常/回退理由并抑制相应P3差值。保留合法旧日志兼容、真实零值/无观测null语义，不因为此项重写其它分析逻辑。加本例从sanitize到完整analyzePlayback的回归。

## R3：专项通过未覆盖新增原生计时与实际Host接缝

位置：check-native-pacing.mjs:575、665、671、679。

- Test1–3主要直接构造JS计数，验证分析算术；不会发现R1的原生请求算法变化。
- Test4先写手造JSON，再clone样本并直接改计数进行分析，没有调用新增NativePacingTracker，也没有实际Host runtime。
- Test5运行的是--parse-check与--self-test-lifecycle；两者不进入新增计时代码。资产保护断言仅mtime不等，不能证明资产字节未变。
- Codex本轮补充实际tracker数值控制，确认tracker基础数学和序列化正常；但实际Program时钟/上一帧归属→journal→Host→文件→watch→analysis尚未被提供的回归验证。

补法：补小型可注入时钟/等待的实际新增测量方法，并让正式循环调用同一方法；只抽测量接缝，不抽象或重写整套WGC。离线用请求10/实际25、记录后20/总工作35、连续空帧、状态帧边界、停止/终态/新run零值验证。让实际原生序列化/ProbeJournal输出经真实Host假子进程输入落盘，再经真实watch/analyze核验数值；仍不开真实窗口。资产保护改为固定SHA或归档字节核验，输出在新的独立目录并保留证据。

## Gemini下一轮范围

只补R1–R3、必要回归与交付说明，保留已通过功能。编码/隔离构建后交Codex复审；不打包、安装、开真窗口或改日常Profile/Local Storage/生产assets/归档。不要重复GPU或P2全套，不增加帧率或改视频链路。

交付说明顺便校正：
- 实际累计/极值字段数22，不是21；
- 分析器源码路径应为F:\dsh-wallpaper-plugins\dsh-whale-mist\qa\perf\analyze-playback.mjs；
- postRecord计时从record组装完成后开始；pipe发送已在此前，不属于该区间。totalWork从循环起点到beforeSleep，中间还有record组装/统计开销，不保证严格等于encodeMs+postRecordMs。
- 五类测试的覆盖应照实写，不把参数/生命周期自测写成新增原生计时已经验证。

## 证据

本轮目录：F:\dsh-wallpaper-plugins\.tmp\native-pacing-p3-review-20261015-5a4a526d

- before.json/source-reviewed/：固定20输入、32保护输入与5配置基线；
- native-source/build/build.log：独立实际工程与构建；
- p3-check.log、p1-check.log、check.log：复跑结果；
- native-control/、native-control.json：实际tracker与请求表达式的C#控制，state=synthetic；
- counterexamples.mjs、counterexamples-final/：正常、缺计数隐藏回退、溢出被正确拒绝的完整输入/工具输出；
- qa-seam-audit.json：提供的专项实际调用与覆盖；
- after.json：20/32/5指纹一致，未改实现或日常。

初次溢出探索触发了正确拒绝，原输出留存；最终控制以counterexamples-final结果为准。本轮未取得新实机数据，约46ms周期的根因仍unknown。
