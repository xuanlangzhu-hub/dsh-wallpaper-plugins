# 逐帧观测七审：容量与分析校验通过，只余真实收尾及Host skip身份两处

日期：2026-10-16。Codex 对照[六审](MOTION_CADENCE_TRACE_SIXTH_REVIEW_20261016.md)、[Gemini附评](MOTION_CADENCE_TRACE_GEMINI_ASSESSMENT_20261016.md)、[最新交付](MOTION_CADENCE_TRACE_DELIVERY_20261015.md)与[作者修复说明](MOTION_CADENCE_TRACE_GEMINI_REVIEW_20261016.md)独立复核。

**结论：保留本轮大部分补修；暂不准备候选，只补 G1-I/O 与 G7-skip 两处 P2 剩余边界。** 容量淘汰、信封校验、原非法/错域数值及健康标志反例已独立通过，五审ACK时机、连接/代次隔离等保持有效。不要把全部分组重新返工。

本轮只固定输入、隔离构建/离线受控回放及写文档；未改生产实现、版本、assets、Profile，没有安装或操作DSH/WE、打包、提交推送或自动发消息。127.0.0.1临时端口只用于本轮测试进程，结束时已关闭；不是DSH实机测试。球运动忽快忽慢的视觉根因仍未定位。

## 1. 已独立通过的补修

证据目录：`F:\dsh-wallpaper-plugins\.tmp\motion-cadence-seventh-review-20261016-100038-e6040409`。固定33份输入后检查。

| 项目 | 本轮结果 |
| --- | --- |
| G2 自然EOF的客户端钩子 | 真实connect/runStream关闭后送1个isStop批次、2条尾部记录，本地缓冲0，不额外发stop；失败路径仍正常发停止批次/stop。这里通过的是客户端触发，完整Host收尾仍受第2节限制 |
| G4 信封schema | 原缺generation、负generation、错误计数类型、信封/记录代次不一致四个实际路由反例全部400，schemaViolationCount=4，不再生成错误流状态 |
| G5/L1-B-cap | 原32→33、单连接33代次、未确认早期0/3均保持degraded；优先保留未完成流，压缩健康完成流。另造32个全未完成流，强制淘汰后其余流全部确认，仍保留evictedUnfinalizedStreams=1/未发3、degraded。33个全健康流正例available，Map保持32 |
| G7 原跨连接覆盖 | A latest跳5帧、B duplicate与两次背压：latest=1、skipped=5、duplicateSkip=1、backpressure=2，write的sequence保留；同连接真实skip身份另见第3节 |
| G8/G9 分析器 | 负native时刻被排除，schema违规1、degraded、有效间隔数0；错域Host记录排除后间隔数0；flushFailed=true明确degraded |
| G9 原生成功重试语义 | 原样当前C# collector配假Publish：超时/迟到清理后再成功发布，落盘flushFailed=false、内存FlushFailed=false，前次失败不污染重试JSON |
| G10/G11 资源与导出 | 当前collector的假Publish控制保持真实pending=1，重试不叠加，释放后pending0/迟到文件删除；Host实际session的慢write/rename与重试也保持1在途、迟到清理，两份collector均degraded。源码已加入CTS Dispose与重入timer清理 |
| 既有边界 | 普通ACK先于/晚于stop的摄取窗口开放正例、A/B和代次隔离、两轮挂起取消pending0、409未知降级、L2双连接decode/draw均值30/5与失败保留均通过 |

作者七类、check、Host106、P2十类、P3五类全部通过；冻结副本当前原生隔离构建0警告/错误，等待54项、P3快照22键及trace正常自测通过。它们不覆盖下述真实I/O时序与同连接的两个合法skip。

## 2. G1-I/O（P2）：24轮微任务不能等待网络响应，关闭竞争仍成立

位置：`dsh-whale-mist/src/client.js` 的 `finalizeRunCadenceTrace()`、24次`await Promise.resolve()`与`traceDrain.then(invokeStop)`；Host路由/关闭导出接缝保持原实现。

微任务排空只适用于已经能在当前微任务队列结清的替身请求。HTTP响应要等I/O事件推进，循环24次不会为它提供15ms或任何明确墙钟预算；增大循环次数也不能解决。

独立证据 `closure-io-controls.mjs/json/log` 使用：

- 真实生产client、注册POST路由与collector；Node真实HTTP/127.0.0.1临时端口。
- session的窗口/进程关闭为受控替身，stop时实际写出client快照JSON；没有DSH、WE或WGC。
- 普通批次seq1/2已在Host摄取，只将204响应受控延迟15ms（小于客户端100/200ms取消期限）；期间追加seq3并调用client.stop。

实际顺序：

```text
普通批次已摄取（204响应待15ms释放）
stop已返回，快照已写出
普通204释放
最终isStop批次seq3抵达 -> 409
```

真实文件只含seq1/2、clientFinalized=false、分析degraded。没有挂起超过100ms，也不是永不返回的网络异常。作者3.15 G1正例用的是立即返回204、微任务内完成的替身，不能据此宣称正常真实请求已获得收尾窗口。

**最小补修：** 用明确有界的诊断收尾机制覆盖跨I/O事件循环的响应；可以考虑关闭后的短诊断摄取/最终导出窗口等局部方案，播放停止和资源释放仍不得等待不受控网络。测试应实际推进I/O/定时器，包含快速真实响应、普通ACK在途、分片、自然结束关闭窗口、截止耗尽/409及旧run隔离。不要再靠固定Promise.resolve次数凑顺序，也不要承诺所有网络情况下必然完整；截止耗尽须如实降级。

G2客户端EOF钩子已经补上，不要求重写；应与本项共同验证自然结束时Host是否仍能接收并导出尾批。交付所写`await finalizeRunCadenceTrace(currentRun)`与当前实际fire-and-forget调用也应按最终实现如实更正。

## 3. G7-skip（P2）：同连接合法的两类skip被当成重复事件

位置：`qa/perf/analyze-motion-cadence.mjs` 的 `checkDuplicate()`及Host循环。重复键仍是`runId:connectionId:generation:sequence:event`，对Host两个不同原因/时间的`host-stream-skip`没有区分；后一个被标成isDuplicate，计数时跳过，并使整个结果degraded。

`host-skip-controls.mjs/json/log` 不手工拼Host事件，实际运行 **FrameDecoder→FrameHub→streamFrames**：

1. 发送seq1，response.write返回false，进入背压。
2. hub更新至seq5；第一次drain发送seq5，真实记录`latest-overwritten`、跳2..4共3帧；write再次返回false。
3. 第二次drain时latest仍是seq5，生产代码合法记录`duplicate-sequence` skip，同连接同seq，但原因与发生时刻不同。

实际写出序号[1,5]，collector保留两条真实skip。分析结果却是：latest=1/skipped=3、**duplicateSkip=0、duplicateEventCount=1、state=degraded**。移除第二条合法skip的对照便回到available。

预期应保留两类真实事件：duplicateSkip=1，而观测记录本身重复数为0；“本次没有重复发送帧”的正常skip不是“trace记录被重复摄取”。跨连接分组与数组修复有效，不需要回退；只补同连接事件身份。

**最小补修：** 为可多次发生的Host事件采用合适身份，至少不能把不同reason的真实skip折叠为同一条。保留真正重复摄取的诊断能力，别简单关掉所有重复检查；补上述真实背压/drain链正例及真实重复记录反例，不改FrameHub/调度行为来隐藏观测问题。

## 4. 执行记录与保护

| 证据 | 用途 |
| --- | --- |
| `author-suite.log`、冻结`source/.tmp/motion-cadence-check-*` | 作者原七类与新增QA、当前原生构建/自测 |
| `check.log`、`host.log`、`p2.log`、`p3.log` | 既有回归；P3只适配导入/当前helper路径/证据保留，patch同目录 |
| `assess-controls.*`、`finalization-controls.*`、`network-stage-controls.*` | 上轮具体反例按修后预期独立重放，以及强制淘汰控制 |
| `closure-io-controls.*`、`closure-archived-client.json` | 真实loopback HTTP、15ms响应与落盘快照反例 |
| `host-skip-controls.*` | 生产Host背压/drain事件链，证明G7剩余身份问题 |
| `export-faults.*` | 当前Host真实session的慢write/rename、重入与迟到清理 |
| `native-fault/`、`native-fault-build.log`、`native-fault.log` | 当前原样C# collector配假Publish，0警告/错误、在途/迟到清理及成功重试快照 |
| `audit.py`、`before.json`、`after.json` | 33输入开始/收尾指纹与资产/归档/Profile/日常安装比对 |

33份输入在本轮复审期间零变化；相对附评时六份实现/QA及交付改变，作者Gemini自评也已更新并冻结。旧54保护50份匹配，另4份为此前获准修改的观测接入文件；12份工作区原生运行资产、rc.28/29/30/31四归档、五Profile及日常rc.28的28安装文件保持，工作区版本rc.30。P4四个核心等待/停止文件、Program/CaptureArguments、AtomicFile及frame-hub本轮未再改变。

本报告与接续文档已完成空白检查；历史报告/证据保留，Codex未代改作者交付或生产实现。

**下一步由用户交Gemini只补G1-I/O、G7-skip及对应QA/交付，再Codex复核。** 已通过项不再机械返工；暂不准备候选/安装或操作DSH、WE/改设置调度/打包/提交推送或自动消息，不重跑GPU长测，不宣称视觉根因已定位。
