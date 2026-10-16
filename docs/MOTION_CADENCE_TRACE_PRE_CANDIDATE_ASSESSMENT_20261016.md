# 候选前Argon审查的Codex核对与勘误

日期：2026-10-16。核对[Argon集中审查](MOTION_CADENCE_TRACE_PRE_CANDIDATE_REVIEW_20261016.md)及[Codex收尾复审](MOTION_CADENCE_TRACE_FINAL_REVIEW_20261016.md)。

**结论：Argon本次没有报告新增可达问题，与此前已验证的修复收口结论不冲突；但报告包含多处不是当前实现的名称/机制，以及超出证据范围的保证。应连同本勘误阅读，不能将整页PASS视为准确的逐行审计或“已证明零缺陷”。** 当前已指派补修继续保持闭合，本轮未确认新的生产阻塞项，不因文档写串再启动一轮实现返工。

## 1. 当前版本核对

证据目录：`F:\dsh-wallpaper-plugins\.tmp\motion-cadence-pre-candidate-assessment-20261016-112713-45846faf`。

固定34输入（此前33项加本次Argon报告）。相对收尾复审仅交付文档改变，生产、原生、QA、analyzer、旧作者审查记录均未变。开始/收尾指纹一致，四归档、五Profile与日常rc.28的28安装文件保持，工作区rc.30与12原生运行资产保持。因此此前正式七类与确定性写盘等待控制的结论可沿用，本轮不重复构建/跑全套或GPU长测。

本次是静态审查核实及两个小型分析器合成控制，没有安装或操作DSH/WE、实采、修改实现/QA、打包、提交推送或自动消息。

## 2. 报告中需要按当前源码更正的事实

| 原报告表述 | 当前实际情况 |
| --- | --- |
| 引用Codex收尾报告“第6节指引” | 当前收尾报告只有第1至第3节，交接指引在第3节 |
| 原生环形缓冲`_writeIndex` | 当前使用`_head`、`_count`，覆盖时推进`_head` |
| ACK按`item.sequence > ackedUpToSeq`清理 | 当前按私有`_batchId !== batchId`清理已确认批次，这是此前回绕安全的关键实现，不应改回报告所述机制 |
| 最终确认写`cadenceTraceStopSent` | 当前字段为`cadenceTraceStopConfirmed`，且必须实际停止批次成功并排空队列 |
| collector的`isAllFinalized()` | 当前为`getClientFinalized()`及`syncClientAggregates()` |
| `sourceToDrawProxyRatio`、`decodeFailureCount`/`drawFailureCount` | 当前公开统计名为`cadenceProxyRatio`、`decodeFailCount`/`drawFailCount` |
| generation/健康计数均使用“安全整数”校验 | 当前相关路由使用`Number.isInteger`，不能写成已经使用`Number.isSafeInteger` |
| 非法载荷一律增加schema计数 | 具体schema分支会记账；run/clock/连接等早期拒绝分支不能笼统算作全部增加同一计数 |
| 全部负间隔“检测并剔除” | 当前检测后降级，但统计数组未统一过滤负值。合成native写时刻10→5，结果degraded、间隔mean=-5，并没有剔除 |
| “管道错误”必然使分析器degraded | 单独加入`native-pipe-write-error`记录、其它client记录健康时，当前分析仍available；不能声称所有管道失败已经单独接入健康门禁 |

前六项主要是审计表描述与当前代码不符；后几项涉及验收语义，应以真实实现/已执行控制为准。源码行号也有多处偏移，报告没有固定源码哈希或新运行日志可用于重建其逐行走查过程。

“管道错误”的小型控制只反驳报告的全覆盖断言，不冒充真实管道故障重现，也不凭一条合成输入判定新的生产根因/阻塞项。原始错误记录、summary退出原因与analyzer.state是不同层的证据，后续实采应一起看；若要承诺所有传输错误均统一降级，需要先明确语义并补可达接缝控制。

同样，当前代理是相邻**实际绘制帧**的源时间推进/绘制时间推进比率，不能改称小球速度；报告关于“中间帧均无缺失”的广泛保证也不能替代实际相邻端点校验规则。“默认关闭零开销”应理解为门控诊断采样与传输，不作为严格零CPU/零对象开销的性能测量结论。

## 3. 哪些结论可以继续使用

- 五至八审及收尾复审已具体复现/验证的ACK、连接代次、容量摘要、schema、Host skip、分域过滤、真实HTTP收尾、原生/Host落盘门禁及QA-EOF修复，仍按原证据通过。
- Argon此次静态走查**未报告**新增可达问题，可以作为第二视角；“未发现”不等于数学证明不存在缺陷，不应扩写为所有边界皆已完整验证。
- 诊断工具编码/离线补修阶段可以收口。三体运动忽快忽慢仍未定位，尚未准备本轮候选、安装或进行针对性实机验收。

两个分析器控制及原始结果位于`report-claims-controls.mjs/json/log`，34输入审计在`before.json`/`after.json`。Argon原文完整保留，不由Codex代写成另一份“独立审查”。无需再消耗Argon额度改名词或润色；本勘误随原报告一起交接即可。

下一步如用户继续安排，可准备隔离诊断候选并核包，实际安装与短测仍要按届时运行状态协调、保护rc.28和当轮配置。本轮停在文档核实，不自动执行后续步骤或给其他助手发消息。
