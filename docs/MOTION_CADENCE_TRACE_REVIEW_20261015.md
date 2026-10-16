# 运动节奏逐帧观测首轮复审：暂不通过，只做局部补修

日期：2026-10-15。审查者：Codex。对应 [任务书](GEMINI_NEXT_MOTION_CADENCE_TRACE_20261015.md) 与 [Gemini交付](MOTION_CADENCE_TRACE_DELIVERY_20261015.md)。

**结论：观测钩子已接入部分真实生产位置，既有回归通过，但当前工具还不能用于下一轮实机诊断。只补以下 R1–R5，再交 Codex 复审。暂不准备候选或安装实验。** 这不是三体忽快忽慢的根因结论，也不是对已通过 P4 等待优化的否定。

本轮没有修改生产实现、版本或资产，没有安装、启动、停止或操作 DSH/WE，没有改变 Profile、打包、提交、推送或向其它助手发送消息。任务继续由用户手动交给小 G。

## 1. 独立证据与复跑结果

证据目录：`F:\dsh-wallpaper-plugins\.tmp\motion-cadence-review-20261015-164745-5a51c561`。

- `before.json`、`source/`：固定本次 32 份源码/项目/QA/交付输入。相对上次交接 27 源码，只有 client.js、frame-hub.js、session.js、CaptureArguments.cs、Program.cs 五份已有文件改变；另新增两个 trace 辅助类及两个 QA 文件。
- `author-suite.log`：在本轮 `.tmp` 冻结副本执行作者原样七类套件；真实原生隔离编译及 CLI、自测均经过。没有使用生产 assets 中的旧 helper 冒充当前构建。
- `review-cases.mjs`、`counterexamples.json`、`counterexamples.log`：执行冻结的生产模块、真实客户端 WHL1 入口和真实 canvas 函数，确认下述反例。借用了作者 VM 环境构造器，补上实际流和 backdrop；另调用作者原样场景函数，只增加返回值观测。
- `stop-fault.mjs`、`stop-fault.json`：通过 VM 模块链接将生产 session 的文件写入替换为可控挂起；生产 session 函数体未改，子进程与窗口 helper 均是假对象，没有打开真实窗口。
- `check.log`、`host.log`、`p2.log`、`p3.log`：相关既有回归结果。P3 runner 只调整导入、当前隔离 helper 路径和证据保留，断言不改；适配脚本与 patch 同目录保留。

| 检查 | 本轮结果 | 能证明的范围 |
| --- | --- | --- |
| 作者七类 motion cadence 套件 | 7 类通过 | 原套件现有断言通过；不能覆盖下述反例 |
| 当前原生隔离编译 | 0 warning / 0 error | 当前源码可编译 |
| 当前 helper 自测 | trace 自测通过；P4 54 项通过；P3 实际快照 22 键、mismatches=0 | 对应辅助类与旧等待/统计保护 |
| `npm run check` | 通过 | 语法与模板守卫 |
| `npm run test:wallpaper-host` | 106 项通过 | 现有 Host 回归 |
| `check-frontend-stages.mjs` | 10 类通过 | 现有 P2 阶段回归 |
| `check-native-pacing.mjs`，使用本轮实际编译 helper | 5 类通过 | P3 实际程序集→观察器→分析器接缝及资产门禁 |

## 2. R1：真实客户端握手缺 run/连接身份，正常上报被静默丢弃（P1）

位置：`dsh-whale-mist/src/client.js:476–478, 540–565, 846–849, 1188–1191`；`src/wallpaper/frame-hub.js` 的响应头；`src/wallpaper/session.js:1026–1039`；`src/wallpaper/cadence-trace.js` 的 appendBatch。

生产握手只传 `x-cadence-trace: 1`，客户端只开启数组，没有设置 `cadenceTraceRunId`。唯一赋值入口 `enableCadenceTrace(enabled, runId)` 被 QA 手动调用，正式握手未调用它。客户端事件因此带 `runId: "gen-1"`，批次顶层却带空字符串。Host 对空顶层 runId 放行，appendBatch 将不匹配当前 location 的事件逐条丢掉，仍向客户端返回 204，丢弃数也未保存。

独立真实路径结果：

```text
完整 WHL1 → runStream 响应头 → accept → RAF → decode → 实际 canvas
actualCanvasDraws=1，bitmap close=1，6 个阶段事件
batch.runId=""；event.runId="gen-1"；connectionId 缺失
POST status=204；Host client trace retained=0
```

反方向也有缺口：省略批次与记录 runId 的一条 `client-draw-end`，甚至声明 `clockDomain: "native-mono"`，会得到 204，并被补成当前 runId 收进客户端 trace。当前路由未校验连接/generation 与记录 schema，不能兑现“跨连接/伪造作用域拒绝”。另外，session.js:625/775 接受浏览器 start body 的 `cadenceTrace: true`，不符合任务书“Host 本地诊断配置开关”的范围。

**局部补修：** 将 Host 明确启用的当前 run、流连接身份经真实握手传到客户端，并随帧传到实际 draw 和批次。入口同时校验顶层及每条记录的 scope/schema，缺失或不一致要有明确拒绝/丢弃计数，不静默确认空批次；迟到上报不能被重新归属到新会话。只保留 Host 本地开关，移除浏览器任意打开诊断的旁路。加入不手动调用 enableCadenceTrace 的真实握手→上报→Host 保留→停止导出正例，以及跨 run/连接、重连、迟到、缺身份反例。

## 3. R2：分析器合并连接、跨 run 算间隔，并隐藏缺口（P1）

位置：`dsh-whale-mist/qa/perf/analyze-motion-cadence.mjs:55–56, 92–163, 178–220`；`src/wallpaper/frame-hub.js` 的 pump/drain/skip 记录。

对齐表只以 `(runId, sequence)` 为 Map key，没有连接/generation/时钟原点维度。同一帧多连接事件和重复事件会覆盖；随后只按 sequence 排所有 run，再用一套前值计算相邻间隔。函数没有数据可用性、覆盖、异常限制结论的输出，也未检查导出的 schema、overflow、degraded 与 clockDomain。

独立反例：

| 输入 | 当前输出与问题 |
| --- | --- |
| 同 run/seq 两个连接，先背压 true、后 false | 合成 1 行，后一次 write 覆盖前一次，backpressureCount=0 |
| 两个 run 各自 draw 间隔 33ms，第二 run 时钟从 1000 开始，且有一条 clockDomain 改变 | 全局按 seq 交错，clientDrawIntervals.min=-967ms、mean=344.333ms；没有跨 run/clock 异常说明 |
| 3 个实际 draw，seq 1/3 的 WGC 分别 0/66，seq 2 缺 WGC；draw 为 0/33/66 | 把跨两帧的 WGC 66 除以最后一帧 draw 33，报告 proxy=2；本应因中间对应源值缺失而限制该相邻比值 |
| 同 run/seq 重复 draw-end | 直接覆盖，3 条输入变 2 行并给出 33ms 间隔，没有重复诊断 |
| 导出 overflowCount 非零或完全无 trace | 前者元数据被忽略；后者只给空统计和零 anomalies，没有 unavailable/unknown 状态 |
| Host 写 seq 1 返回 false，期间完整收到 2/3/4，再 drain | 实际写出 `[1,4]`，已知跳过 2/3；没有 skip 事件，分析器 hostSkipCount=0。当前 skip 只指相同序号重复触发 pump，并非 latest 覆盖 |

**局部补修：** 保留原始事件和异常，不覆盖后再作完整结论。按 run/连接/generation/同一时钟原点分组；跨层共享 native/hub 信息可以关联，但各连接 write、各客户端 draw 必须独立。先验证 schema/顺序/重复/缺失/覆盖/溢出/降级，再给可用范围及限制；无 trace 明确 unknown。代理值的分子、分母必须来自同两个可验证的已绘制帧，缺一端时不能沿用更早的源时间。补真实 Host 背压后 latest 已知跳过范围，并区分重复 pump、明确覆盖和未知缺口；保留 drain/write-error 事实供解释。

## 4. R3：容量单位与批次/失败边界不成立（P2）

位置：`qa/wallpaper-probe/CadenceTrace.cs` 的 DefaultCapacity/Record；`src/wallpaper/cadence-trace.js`；`src/client.js:540–565`。

`2048` 实际是事件条数，交付却按帧计算为约 68 秒，NEXT_TASK 也写成 2048 帧。正常 pipe 每帧原生约 4 条事件，实际成功绘制客户端约 6 条；30fps 时原生最多约 17 秒，Host 的 client collector 约 11.4 秒，不能共同覆盖 20–30 秒短测。客户端周期 flush 也不能挽救 Host collector 对已收历史的覆盖。

按 900 帧/30 秒事件量喂入实际 JS collector，6 条/帧时 retained=2048、overflow=3352，首序号=559；这项是合成容量控制。原生 4 条/帧容量由实际调用数和环形实现计算，并非新实机采样。

客户端 flush 不按字节切片，先 splice 清空再发请求；不检查 HTTP 状态、不记录失败/重试/覆盖，且没有在途请求上限。实际客户端输入反例：2100 条 accept 积压后只剩 2048 条、首序号 53，没有客户端覆盖计数；一批 JSON **291,907 bytes**，超过 Host 的 **262,144 bytes** 限额。连续 flush 可以同时留下 **21 个**未完成请求；全部回复 400 后，客户端记录仍为 0，没有丢弃或降级说明。挂起请求持续积累时，数组容量并不等于总资源有界。

默认关闭时，两个 JS collector 仍各自创建 `events=[]`，也不符合任务书的关闭态不建 trace 数组要求；这只是契约缺口，不据此宣称造成当前视觉问题。

**局部补修：** 按完整帧容量或足够的事件容量保障所需短窗口；明确每域字节/帧/事件上限、首尾覆盖及累计丢弃。传输采用受限增量批次和有界在途数，区分成功、拒绝、失败、覆盖及降级，不能先清空再无条件忽略失败。故障不改变播放调度，不新增无限重试/队列。关闭态按任务书保持惰性资源分配。补 30 秒容量、慢请求/拒绝/断网/超限等实际入口控制，并修正交付中的容量与零开销表述。

## 5. R4：回放没有经过真实 draw，不能证明连续节奏和 off/on 行为（P2）

位置：`dsh-whale-mist/qa/perf/check-motion-cadence.mjs:372–498, 500–536`。

三组场景直接调用 acceptFrame，没有从流读取完整 WHL1，没有创建/启动实际 backdrop。整个输入循环没有等待时间推进与调度交错，修改 RAF 函数也不是一个可推进的回放时钟。结果是一轮只完成一次解码投递；decodeDelays 用实际 drawCount 索引，而 drawCount 始终是 0，所谓 5/25/45ms jitter 没有被真正轮换。

独立调用作者原样 Steady 场景，只读取其返回值：

```text
received=15；rendered=1
实际 canvas drawCount=0；旧 metrics.drawCount=0；trace draw-end=0
```

所以不能将 rendered=1 写为“真实绘制”，也不能从这三组相等计数推出连续播放平权。缺 canvas 的用例直接调用 `recordCadenceDrawSkipped`，没有执行缺 canvas 下的 paintWallpaper；旧 generation 用例也只调用 recorder，没有覆盖迟到 decode 或上报。Section 5 是手工 JSON，不是回放 trace 经真实接收/导出后进入分析器的证据。原生新增观测自测只验证收集器，不覆盖真实发送调用前后、取消/失败记录含义。

**局部补修：** 用可推进且能交错处理到达、RAF/timeout、decode 完成的时钟，走实际 WHL1 decoder→accept→scheduler→decode→真实 backdrop/canvas。每组产生足够多的成功 draw，保存实际绘制 seq/时间、释放、错误和停止结果；off/on 逐项对照。真实 trace 协商与 POST、Host 导出、分析器串起来，不能手工注入正确身份替代入口。补缺 canvas、draw 抛错、迟到 decode/上报、重启、RAF 0/旧回调、批次/容量故障的受影响路径；原生用实际共用发送接缝配假 I/O 验证前后/取消/故障，不打开 WGC/WE。同步改正交付中“已全面覆盖/证明”的措辞。

本轮独立正例已确认：生产 paintWallpaper 的 draw-start/end 钩子确实能包住一次成功的真实 canvas 调用；无需因原 QA 漏测而重写已接上的画布功能。

## 6. R5：新增诊断写盘会无界阻挡 stop/终态（P2）

位置：`dsh-whale-mist/src/wallpaper/session.js:155–160, 253, 281`；`qa/wallpaper-probe/Program.cs:334`；`CadenceTrace.cs` 的 FlushAsync。

Host cleanup 直接 await 两次诊断 writeFile，没有期限或取消。catch 只能处理已拒绝的写入，无法处理一直 pending 的 I/O。原生同样 await trace 导出，位于父断开后的源关闭与 Summary 之前，没有独立诊断预算；native AtomicFile 的移动重试次数不等于 WriteAllBytesAsync 有时限。

实际生产 session 的假 I/O 控制结果：

```text
正常假 child close、worker 安全 Summary、源关闭确认均完成
trace OFF：stop 在 50ms 检查时已返回
trace ON：只挂起 cadence-trace-host.json 的 writeFile，50ms 时 stop 仍 pending
解除该写入后 stop 才返回；生产函数没有任何后续自动截止分支
```

50ms 是此反例的观察点，不是给产品新增的超时标准。本例证明诊断导出在等待链上且无自身截止，没有操作真实应用，也不宣称实机已经出现停不下来。

Host 导出还是直接覆盖最终 JSON，交付的“原子落盘”表述不成立；native 已使用 AtomicFile，但忽略返回 false，未记录导出失败。

**局部补修：** 保持原有清理身份/worker/超时策略，给诊断导出明确的短预算与可结清的资源/失败计数，不能挡住必要清理或最终结果，不能把超时任务留成无限后台队列。确需原子发布则实现并验证；否则如实说明截断/不完整导出并由分析器拒绝完整结论。补慢写/拒绝/异常与关闭态对照，不再把 best-effort catch 当作有界证明。

## 7. 保护核对与下一步

相对任务书基线，27 份原源码中 22 份未改、上述 5 份为允许的观测接入变更；旧 54 份保护表中 50 份仍匹配，4 份变化恰为本轮获准修改的 client/Host/CaptureArguments，不能错误声称 54 份全部未改。前次 26 份 P4 复审输入中只有 Program/CaptureArguments 两份获准变化。NativePacingDelay、KernelWaitTimer、ParentStopChannel、NativePacingTracker 以及原 framing/旧指标相关保护保持。

工作区仍 rc.30；12 份原生运行资产与原保护值匹配，三份重点 DLL/EXE/deps 仍为任务书 rc.30 哈希。rc.28/29/30/31 四归档匹配；五份 Profile 匹配交接值；实际日常安装 28 个文件逐一匹配 rc.28 归档。Git 相对 HEAD 的历史未提交改动不是本轮变化基线，未作清理或回退。收尾 `after.json` 已确认：32 份输入在审查期间零变化，资产/归档/Profile/日常安装保护仍匹配；报告及接续文档的空白检查通过。

**小 G 下一步只补 R1–R5、相关真实入口反例/正例和交付说明，再让用户叫 Codex 复审。** 保留通过的 P4/P3/P2 逻辑、原生产 assets/版本、旧 tgz 与全部历史证据；不盲调 FPS/RAF/latest/缓冲/JPEG，不重跑 GPU/长测，不打包、安装、操作 DSH/WE、改 Profile、提交推送或自动消息。复审通过以后，才准备独立新候选并另约方便的针对性短测；目前尚未定位或修复球运动忽快忽慢。
