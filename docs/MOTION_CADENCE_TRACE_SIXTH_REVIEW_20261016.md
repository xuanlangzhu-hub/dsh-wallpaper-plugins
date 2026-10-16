# 逐帧观测六审：五审原反例通过，只余流状态容量淘汰边界

日期：2026-10-16。Codex 对照[五审](MOTION_CADENCE_TRACE_FIFTH_REVIEW_20261015.md)和[小G最新交付](MOTION_CADENCE_TRACE_DELIVERY_20261015.md)独立复核。

**结论：L1-A 已闭合，L1-B 原有 A/B 与代次隔离反例已通过；仅剩新增 32 流上限的静默淘汰问题（L1-B-cap，P2），暂不准备候选。** 保留本轮有效修复，不重做已通过项，不扩大到播放调度或原生等待。

本轮只固定输入、隔离构建/离线回放和写文档；未修生产实现、改版本/assets/Profile、安装或操作 DSH/WE、打包、提交推送或自动消息。小球忽快忽慢的视觉根因仍未定位。

## 1. 已通过，保留不返工

证据目录：`F:\dsh-wallpaper-plugins\.tmp\motion-cadence-sixth-review-20261016-091443-bf855d92`。32 份输入冻结后运行检查；独立控制使用真实 client、POST 路由、collector 与 analyzer，网络/stop 命令为离线受控替身。

| 具体控制 | 独立结果 |
| --- | --- |
| L1-A：普通 ACK 先于 stop | 普通 POST 完成后 stop，补发 records=[]、isStop=true；Host finalized=true，分析 available |
| L1-A：普通 ACK 晚于 stop | stop 后释放普通 POST 的204，随后确实补发空停止批次；POST数从原1变2，Host finalized=true，本地缓冲0，分析 available |
| L1-B：A 完成、B 未发3条 | A 的停止确认不再清除 B 状态；finalized=false、trailing=3、degraded |
| L1-B：A/B 分别完成 | B 再完成后 finalized=true、trailing=0、available |
| 旧代次不能认证新代次 | 代次1确认不能认证代次2，保留未发3条并 degraded；代次2随后完成则 available |
| 仅签发但未参与 trace 的 ID | 不强制等待该 ID 的确认；正常参与流完成仍 available |
| 原挂起与409控制 | 两轮挂起请求带 AbortSignal，stop 后300ms时 pending=0、aborted=2；迟到409的未确认状态仍降级 |
| 原 L2 阶段统计 | 双连接 decode/draw 各2条，均值30/5ms，RAF/timeout各1；一方失败仍记1次并 degraded |

普通 ACK 的判断已收窄到实际停止批次，客户端 finally 会补最终确认；Host 新增有界 clientStreams，按连接/代次保存终态。这些改动有效，无需重写或回退。

## 2. L1-B-cap（P2）：超过32流会丢掉未确认/未发状态，误报完整

位置：`dsh-whale-mist/src/wallpaper/cadence-trace.js:55–57`，以及后续 `syncClientAggregates()`、`snapshot()` 对剩余 Map 的汇总。

`updateClientStream()` 遇到第33个键时，无条件删除最早的流。没有判断该流是否完成，也没有将被删流的未确认/未发状态保留为有界摘要或显式降级标记。汇总只看剩下的32流，导致本来不能认证完整的数据重新变成 available。

`finalization-controls.mjs/json/log` 经真实生产 POST 摄取路由复现：

1. 同 run 的 c0 送两条合法 draw，报告未发3条，不发送停止确认。
2. c1至c31各送两条合法 draw 并确认完成。此时64条记录，32个流，finalized=false、trailing=3，分析 degraded。
3. c32再送两条合法 draw 并确认完成，c0的流状态被静默删除。
4. 结果：**66条事件仍全部保留，包括c0的两条；流状态只剩32个，finalized=true、trailing=0，分析 available/clientUnfinalized=0。** 事件环形溢出0、schema违规0、collector.degraded=false，没有任何信号说明 c0 的终态证据已丢失。

这不需要33个并发窗口：一个已签发连接的33个不同代次，通过同一路由也得到相同错误；同一 run 内多次接续/重连接缝没有32个历史流的强制限制。

另一个控制将最早流的早期未发量改成0，但仍不确认停止：淘汰后同样误报 available。**所以仅保留“已知未发量之和”仍不够，还必须保留“终态未知”这个事实。** 对照控制中，33流都各自完成且健康时，正常 available，证明问题在于淘汰时丢掉未完成证据，而非超过32就必然不能统计。

### 最小补修与验收

- 保持流状态容量有界。淘汰前只能安全压缩已完整确认且健康的状态；如需丢弃未完成状态，应保留有界的未确认/已知未发摘要，或将本轮 trace 显式标为不完整并传递到导出和分析器。不能静默删除后重新认证完整。
- 不以提高容量或无限 Map 代替正确处理；不更改播放停止、调度、FPS、协议或 P4 等待。
- 回归至少包含：32→33边界；淘汰流未确认且未发3条；未确认但早期未发0；单连接多代次同边界；全部相关流已完成的健康正例。保留上述 L1-A、双连接及代次隔离已过断言。
- 交付应说明本项仍待闭合；修后再由 Codex 独立复核。无需返工旧 L2/F1/F4 或重复原生慢盘、GPU和长测。

## 3. 执行与保护结果

| 证据 | 结果 |
| --- | --- |
| `author-suite.log`、冻结副本 `source/.tmp/motion-cadence-check-1792113309153/` | 作者原七类全通过，含3.14与4.11；当前原生隔离构建0警告/错误、trace正常自测、P4等待54与P3快照22键通过 |
| `check.log`、`host.log`、`p2.log`、`p3.log` | check、Host106、P2十类、P3五类全过；P3使用本轮构建helper，仅适配导入/路径及证据保留，patch同目录 |
| `network-stage-controls.*` | 五审原挂起、迟到409及多连接阶段独立控制保持通过 |
| `prepare-controls.py`、`finalization-controls.*` | 五审原反例改用修后预期，另补容量边界及健康正例；退出0表示观测结果与断言一致，容量反例仍为实现缺陷 |
| `audit.py`、`before.json`、`after.json` | 32输入复审中零变化；相对五审仅5份实现/QA和1份交付改变 |

资产保护确认：12份工作区原生运行资产、rc.28/29/30/31四归档、五份Profile及日常rc.28的28个安装文件保持；工作区版本rc.30。旧54保护50份匹配，另4份是此前获准修改的观测接入文件。P4核心等待/停止文件、Program/CaptureArguments、frame-hub相对五审均未再改变。

本报告和接续文档已完成空白检查，历史报告/证据保留，Codex不代改作者交付。离线回放不是本机物理呈现或视觉根因证明。

**下一步仅由用户将本报告交小G，补 L1-B-cap、必要QA及交付口径，再交Codex复核。** 暂不准备候选/打包安装/操作DSH或WE/改设置调度/提交推送/自动消息，不重跑GPU长测。
