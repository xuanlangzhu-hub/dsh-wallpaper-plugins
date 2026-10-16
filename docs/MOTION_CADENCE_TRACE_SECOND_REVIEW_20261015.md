# 逐帧节奏观测补修复审：保留已通过项，只补剩余 F1–F4

日期：2026-10-15。Codex 独立复核 [首轮 R1–R5](MOTION_CADENCE_TRACE_REVIEW_20261015.md) 与最新 [Gemini交付](MOTION_CADENCE_TRACE_DELIVERY_20261015.md)。

**结论：这次有实质补修，但暂不进入候选或安装实验。正式握手空 runId、原回放零 draw、容量不足、已知 latest 跳过等反例已闭合；剩余 F1–F4 是输入校验、分析隔离、批次数据完整性和导出超时后的资源/失败边界。小 G 只补这些及相应真实入口控制，不重写已通过部分。** 三体忽快忽慢的根因仍未定位，未修复视觉症状。

本轮只读实现、在仓库新 `.tmp` 隔离构建/回放、写审查与接续文档；没有修改生产源码、版本、assets、安装、Profile，没有操作 DSH/WE、打包、提交推送或自动消息。

## 1. 已确认通过的补修

| 原项 | 本次独立复核 | 后续范围 |
| --- | --- | --- |
| R1 正式握手缺 runId | 从实际 streamFrames 响应头，经真实 runStream→WHL1→accept→decode→paintWallpaper→POST，成功 draw 1 次、释放 1 次、Host 收留 6 条阶段记录；无需 enableCadenceTrace | 保留；连接与记录 schema 仍见 F1 |
| R2 跨 run 负间隔、缺 WGC 沿用更早源值、latest 跳过缺失 | 作者对应断言通过；实际 Host 写出 `[1,4]`，现在记录 latest-overwritten、跳过 2..3、count=2 | 保留；同 run 内连接/generation/clock 隔离与有效性见 F2 |
| R3 容量/关闭态/无限并发 | 三域容量已为 8192 事件，JS 关闭态 events=null，150 条切片与单在途锁已接入 | 不再要求重做扩容；确认与收尾仍见 F3 |
| R4 原场景实际 canvas=0 | 独立执行作者原样 Steady 场景，draw=15、rendered=15、bitmap close=15；原七类套件中的 Burst/Jitter 及 off/on 计数对照均通过 | 零 draw 已闭合；完整流、导出、故障证据仍须如实补齐，见第 6 节 |
| R5 写盘挂起使 stop 永不返回 | Host 200ms、native 20ms 故障控制的函数均能按预算返回；native 的生产默认预算为 500ms | 返回边界已改善；底层任务未取消/失败未导出等见 F4 |

这些“实际 draw”指执行生产 paintWallpaper 包围的 drawImage 调用接缝，环境仍为 VM 假画布。没有打开浏览器 HTMLCanvas、观察 DSH 或验证物理呈现。

## 2. F1：连接身份与逐条 schema 仍未校验（P2，原 R1 剩余）

位置：`dsh-whale-mist/src/wallpaper/session.js:1048–1065`；`src/wallpaper/cadence-trace.js:66–89`。

当前路由只检查顶层 runId、非空数组；appendBatch 只检查每条 runId 及“有提供时”的 clockDomain。没有验证 connectionId 是否属于该 run 的实际流、generation、合法事件/序号/有限非负时刻。缺少字段时 record() 还会补成 sequence=0、atMonoMs=0。批次顶层也只有 runId，交付关于顶层 connId 的说法不符合代码。

独立执行真实 POST 路由：

- runId 正确、connectionId=`never-issued`、generation=999 的 draw-end 返回 204，并完整收留；没有已建立连接的校验。
- 只带当前 runId、event、success 的记录，没有连接/generation/clockDomain/sequence/时刻，也返回 204，被补成 `client-draw-end, sequence=0, atMonoMs=0`。

**只补：** 为实际流身份建立受限关联，按约定校验完整 scope 与事件 schema；缺身份、外来连接、缺/非法时刻不能被补成真实零值。旧连接尾批如需接收，必须保留其原身份与明确接收边界，不能伪装成当前连接。缺失/失配与部分批次拒绝应有可导出的计数/结果，不能只给总 204。保持 Host 本地开关及旧指标载荷不变，增加正式握手正例和上述路由反例。

## 3. F2：同 run 仍混算连接/代次，异常记录仍被宣告 available（P1，原 R2 剩余）

位置：`dsh-whale-mist/qa/perf/analyze-motion-cadence.mjs:126–168, 229–263, 294–353, 382–390`。

虽然已按 run 分组，frame key 仍只有 run+seq。hostStreamWrites/clientDraws 数组保存了部分连接事件，但实际间隔统计仍读取最后一次覆盖的标量，未按连接/generation/时钟原点分组；duplicate key 也没有 generation。`isDegraded` 只看 degraded/overflow/droppedBatchRecords，不看 clock mismatch、重复、逆序或缺失。异常计数存在，不等于结论受到限制。

独立反例均调用当前真实 align/analyze：

| 输入 | 当前输出 |
| --- | --- |
| 同一 run，第二 draw 声明 foreign-clock | clockDomainMismatchCount=1，但 state=available、unknown=false，仍计算 33ms 间隔 |
| 连接 A 的 seq1/2 时刻 1000/1033；连接 B 只有 seq1 时刻 0 | 标量 seq1 被 B 覆盖，报告 1033ms；A 本身的可验证相邻间隔是 33ms |
| 同 run 的 generation1 seq1=1000、generation2 seq2=0 | available，draw 间隔 -1000ms |
| seq1 draw=0，重复 seq1 draw=100，再 seq2 draw=33 | duplicateEventCount=1，但 available，并报告 -67ms |
| draw 缺时刻，或只有 Host trace、根本没有客户端 trace | 前者仍 available、被过滤为空间隔；后者 available、unknown=false，不符合客户端节奏未知的边界 |

另一个过度限制：当前代理强制 `curr.sequence === prev.sequence + 1`。任务要比较的是同一播放流中相邻的、可验证的**已绘制帧**，不要求采集序号连续。例如实际只画 seq1/3，两帧 WGC 与 draw 都是 0/66ms，正确代理可为 1；当前 count=0。原缺 WGC 反例应通过更新相邻 draw 配对并检查两端来阻断，不应把正常跳帧也一律排除。

**只补：** 实际统计使用每个连接/generation/同一原点的独立时间线；共享 native/Host 信息只按正确帧关联，不以最后标量跨流相减。先验证完整字段、原始顺序、重复、缺失、时钟与覆盖，再分别给出各域可用范围、unknown/invalid/degraded 和理由；错误样本保留但不生成可当作有效节奏的数字。代理使用同两个可验证的相邻已绘制帧；缺中间实际 draw 的源值仍拒绝该配对，正常已知跳帧允许配对。保留已修复的跨 run 分组与 latest 跳过。

## 4. F3：确认回调会误删未发数据，停止尾批仍静默遗失（P1，原 R3 剩余）

位置：`dsh-whale-mist/src/client.js:547–588, 1035–1045, 1229`。

单在途锁阻止了并发请求，但在途期间记录仍可因环形覆盖而 shift。成功/400 回调用 `splice(0, batch.length)` 删除当前数组头，数组头已可能不是发出的那一批。

独立执行实际 recorder/flush：

```text
先填满 8192 条，发出 seq1..150，响应暂挂
再追加 150 条，环形覆盖后当前头为 seq151
seq1..150 的 204 到达：splice 又删 seq151..300
结果头变为 seq301；这 150 条从未发送，却当成已确认移除
```

停止仍只调用一次非等待 flush，并立刻撤销报告定时器。控制输入 350 条记录后停止，即使 POST 全成功，也只发 150 条，余 200 条永不提交；若停止时已有在途请求，最后一次 flush 直接返回。`cadenceTraceDroppedCount`/`cadenceTraceOverflowCount` 目前仅在私有 run 中增加，没有出现在 trace 批次、独立快照或 Host 导出，工具无法知道客户端已覆盖或停止尾部未发送。HTTP 409/其它拒绝及网络失败也没有可导出的降级说明。

**只补：** 在途批次有稳定身份/归属，确认只移除确实属于该批的记录；环形覆盖不能改变确认对象。保持总容量和在途有界。停止用不拖延原清理的有界尾批策略；未送完就明确记录截断/失败和数量，不能默默遗留。把客户端覆盖/丢弃/请求失败/尾批状态通过独立 trace schema 导出供分析器限制结论，不扩写旧 36/22 指标。增加 ACK 与覆盖交错、400、拒绝、挂起以及 stop 时有/无在途的正反控制。

## 5. F4：超时只停止等待，仍有迟到发布与静默失败（P2，原 R5 剩余）

位置：`dsh-whale-mist/src/wallpaper/session.js:150–184`；`qa/wallpaper-probe/CadenceTrace.cs:107–165`；`Program.cs:334`。

Host 的 Promise.race 没有取消实际文件任务；native 的 CancellationToken 只传给了 Task.Delay，没有传给 AtomicFile.Publish，Task.WhenAny 返回也不取消 publish。Host catch 不标记降级或记录一次诊断；native FlushFailed 虽已新增，但 Program 忽略 FlushAsync 返回值，导出 payload 和终态也没有报告该失败。超时之后的任务仍能继续重命名/写最终文件；Host 清理重试时也没有共用写入在途门禁。

独立故障控制：

- **Host 实际生产 session**：只挂起 trace 临时文件写入。stop 在预算内返回，文件不存在、hostSnapshotDegraded=false；之后解除挂起，Host/client 两份最终 JSON 仍在 stop 返回后被发布。这证明返回有界已修好，但任务未结清且失败未标记。
- **原样 CadenceTrace.cs + 假 AtomicFile 编译控制**：20ms 后 returned=false、FlushFailed=true，仍有 1 个 pending publication；解除挂起后文件才出现，payload 不含该次失败状态。20ms 是离线控制预算，不是建议修改产品默认 500ms。

另有原子性缺口：Host rename 失败会回退为直接 writeFile 最终文件（session.js:173/178），因此不能无条件声明原子发布。该点由源码确认，未操作真实 Profile 或模拟系统磁盘故障。

**只补：** 导出任务必须有界且可管理，超时后实际 I/O 可取消/结清，或以明确受限的在途状态管理迟到完成；不能让新一轮导出不断叠加，也不能让迟到成功冒充及时完整完成。通过独立 trace 健康状态/一次诊断记录超时与失败；native 调用方处理返回值。原子发布失败不能直接改写最终文件后仍报原子成功。不要为了诊断改变 P4 等待、worker/源身份门禁、播放/停止策略或 Host 超时。

## 6. 交付与 QA 需要同步改正的证据范围

这轮真实绘制回放已有价值，不能再按首轮“0 draw”返工。但以下交付声明仍超过代码实际覆盖：

- Section 3 场景仍手动 enableCadenceTrace、直接 acceptFrame；没有返回 `/stream` 流响应，也没有经 WHL1 decoder。它证明生产 scheduler/decode/backdrop 调用，不能称完整握手与 WHL1 流回放。需将这个已能绘制的场景接上真实流入口，并核对实际绘制序号/时间，而不只对照计数。
- Section 4.2 POST 是手工构造的两条记录，没有连接与 generation；并非真实握手生成的批次。
- Section 4.5 只做正常磁盘写入，没有挂起、延迟或异常注入；“7ms”只是该次正常 stop 的耗时，不能当作慢盘故障验证。
- Section 5.1 读取的文件虽然由真实 session 导出，但内容是 Section 4.5 手工 `record` 的一条 Host 和一条 client，再配手写 native JSON；不是三种回放经过 POST、Host 导出后进入分析器的证据。
- native selftest 中的“timeout/failure resilience”仍是正常写盘成功控制；新增真实发送观测的取消/故障前后含义也未由该自测覆盖。使用实际共用方法配假 I/O 补窄接缝，不开 WGC/WE，不复制一份播放器/发送实现。

随 F1–F4 局部补齐实际入口控制并更新交付；不需要重跑 GPU、旧实机矩阵或长期试验，不要再写“全部闭合/绝不改变任何行为”的绝对结论。

## 7. 本轮证据、检查与保护

独立目录：`F:\dsh-wallpaper-plugins\.tmp\motion-cadence-second-review-20261015-172433-8f0731d8`。

| 证据/检查 | 结果 |
| --- | --- |
| before.json、source/ | 冻结 32 输入；相对首轮只有 7 份实现/QA 与 1 份交付变化，Program/CaptureArguments 未再改变 |
| author-suite.log | 冻结副本原七类全通过；实际 helper 隔离编译 0 警告/错误、trace 自测、P4 等待54项、P3实际快照22键通过 |
| counterexamples.json / review-cases.mjs | 正式握手/真实 draw/latest 跳过正例，以及 F1/F2/F3 独立反例 |
| stop-fault-final.json / stop-fault.mjs | 有输出目录的 Host 慢写控制；早期未建目录的调试输出另保留，不作迟到发布结论依据 |
| native-fault.log / native-fault/ / native-fault-build.log | 原样原生 collector + 假 Publish；0 警告/错误，超时后 pending 与迟到发布控制 |
| check.log / host.log / p2.log / p3.log | check、Host106、P2十类、P3五类全部通过；P3 使用本轮实际构建 helper，仅适配路径和证据保留，patch 在同目录 |

开头及收尾 after.json 均已核对：32 输入在复审期间零变化；工作区 rc.30、12 原生运行资产、rc.28/29/30/31 四归档、五份 Profile、日常 rc.28 的 28 安装文件保持。旧54保护50份匹配，另4份仍为任务书允许的观测接入文件，未出现其它保护漂移；原 P4 四个核心等待/停止/统计文件保持。审查与接续文档空白检查通过。

**下一步：用户手动交小 G，仅补 F1–F4 与第 6 节对应证据，再让 Codex 复审。** 保留本轮已闭合项及全部历史证据，不改生产 assets/版本，不覆盖 rc.31，不安装或操作 DSH/WE、不改 Profile/系统设置、不打包/提交推送/自动消息。复审通过后再准备独立候选、另约针对性短测；不要现在开始实机实验。
