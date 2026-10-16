# P4 原生等待隔离对照

2026-10-15，Codex。沿用 [P3 实测](COMPLEX_SCENE_P3_FOREGROUND_RESULT_20261015.md)，本轮只验证等待偏差的最小方案。**独立程序复现了请求18ms、实际约31ms；高精度计时器及异步专用线程原型将该请求的实际均值收窄到约18.4–19ms。尚未接入真实采集或验证提帧。**

用户已澄清另一症状是“壁纸在响应鼠标移动时画面停住接近一秒”，并非光标或DSH界面卡顿。该问题仍未解决；此轮不把它直接定性为前端积压，也不将等待原型通过当作它已修复。

## 假设与最小复现

测试前列出三个可区分方向：等待本身精度、唤醒后的异步排队、只有采集负载才出现。独立项目直接链接实际NativePacingTracker及其原预算方法，没有WGC、JPEG或壁纸操作；默认SynchronizationContext为none。

首份基线24次/请求：1ms→15.50ms、2ms→15.41ms、10ms→15.44ms、16ms→29.66ms、18ms→30.90ms。按预先声明的平均额外≤2ms/P95额外≤5ms门槛退出5，保存原始样本。无需追加采集或复杂壁纸负载即可出现同量级偏差。

随后做五方案两轮反向顺序对照，每请求每轮24次：

| 请求18ms，合并两轮48次 | 实际均值 | 实际P95 |
| --- | ---: | ---: |
| 直接 Task.Delay | 31.04ms | 31.91ms |
| 实际 Tracker + Task.Delay | 31.09ms | 32.04ms |
| 普通内核计时器，直接等待 | 31.20ms | 32.29ms |
| 高精度内核计时器，直接等待 | 19.71ms | 22.11ms |
| 高精度计时器，专用线程异步恢复 | 18.96ms | 21.50ms |

带Tracker与裸调用相近，直接等待普通计时器也有约13ms偏差；改变计时器类别后明显缩小。因此本机隔离证据更支持当前计时路径的精度问题，而非P3统计开销或必须存在的采集负载。它不能穷尽真实helper里内核调度/线程池/同步上下文的贡献。

## 异步原型与资源复用

没有把阻塞对照直接塞进异步采集循环。另建一个QA原型：每实例复用一个后台计时线程和一个原生计时器，单个待处理请求，TCS使用RunContinuationsAsynchronously；调用方可异步等待。它没有每帧Task.Run/新线程或忙等。

首份异步对照自身CPU累计109.375ms/3926.43ms墙钟，约单核2.79%。检查发现每次等待新建链接CTS/事件，随后改为复用调用方/实例取消事件。只重测高精度直接/异步两方案，两轮反向，每请求每轮64次，各768个计时样本；普通/Task.Delay控制仍保留前一份记录，没有伪造成同轮补测。

资源复用后的异步原型：

| 请求 | 实际均值（128次） | 实际P95 |
| --- | ---: | ---: |
| 1ms | 1.31ms | 1.63ms |
| 2ms | 2.38ms | 2.59ms |
| 10ms | 10.44ms | 10.73ms |
| 16ms | 16.44ms | 16.79ms |
| 18ms | 18.44ms | 18.81ms |
| 30ms | 30.47ms | 30.83ms |

768次中没有超0.1ms的提前返回；各组均满足原门槛。自身CPU累计31.25ms/10176.95ms墙钟，约单核0.31%。CPU计数约15.625ms粒度，0不能当零开销；不同轮系统负载和请求频率不同，不能宣称精确节能比例或实际采集CPU也会如此。此处没有测功耗、GPU或游戏影响。

## 安全与工具检查

最终构建0警告/0错误；20项检查通过。包括请求转100ns相对到期、参数边界、取消前不布置、并发拒绝、等待中不关句柄、5秒等待在途取消、反复取消后重用、后台线程/句柄退出、已接收请求与关闭竞态、重复关闭。

最终一轮控制中，异步在途取消约0.368ms、已布置5秒等待的Dispose约0.084ms完成；这是控制样本，不是停止P95/所有机器保证。补测了没有高精度候选的CLI子集，门槛结果为null，不误报通过；旧输出路径拒绝覆盖。

原型还没有生产级创建失败回退/运行期故障注入，以及实际采集helper父停止/清理接缝验收。不能凭这20项把它当作可直接发布的生产组件。

## 接续

下一小步按[给Gemini的P4接入范围](GEMINI_NEXT_NATIVE_WAIT_P4_INTEGRATION_20261015.md)将受控异步等待接入正式helper，仅替换普通pacing等待，保留目标30fps、即时预算/截断/最低1ms及原P3观测。空帧2ms重试策略保持，避免额外唤醒开销混入本次改动。先做故障/取消及真实helper接缝复审，再准备独立新版本候选并约用户方便短验。

用户可手动转交任务书；本轮未向小G或其它聊天自动发消息。壁纸联动停顿另列源画面响应与传输/显示延迟调查，不在同一候选中混改前端、GPU或主题。

## 边界与保护

新增qa/perf/native-wait-probe/隔离项目及说明，不进入插件files清单。原生capture实现、P3工具、前端/Host、生产assets、版本、rc.28/29/30归档均未改。没有安装、操作DSH/WE窗口、改系统计时器/显卡设置、提交或推送。

日常安装仍rc.28；结束时核对日常28文件、五份Profile及本轮保护清单。复用现有记录，未重跑GPU/P2/实机长测。

## 依据与证据

API口径核对：[Task.Delay](https://learn.microsoft.com/dotnet/api/system.threading.tasks.task.delay)、[CreateWaitableTimerExW](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-createwaitabletimerexw)、[SetWaitableTimerEx](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-setwaitabletimerex)、[CancelWaitableTimer](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-cancelwaitabletimer)。高精度标志、单次相对到期、独立取消事件及句柄生命周期按公开接口实现；未用全局timeBeginPeriod或未文档化接口。

证据目录：F:\dsh-wallpaper-plugins\.tmp\native-wait-p4-20261015-111857-4541fdc4

- baseline-build/、baseline/、baseline.log：原始复现，退出5。
- comparison/：最初四方案；worker-comparison/：五方案同轮原始样本。
- reuse-comparison/：复用事件后两方案各768样本；comparison-source/固定该次代码。
- final-build/、final-self-test/及日志：最终CLI/20项检查；计时器两份实现与补测时一致。
- no-candidate-control/：仅控制组时门槛为null。
- summarize.mjs、interpreted-results.json：从原始样本重算均值/P95/样本量/CPU，保留局限。
- before.json、final-protection.json、daily-before.json、daily-final.json：保护核验。
