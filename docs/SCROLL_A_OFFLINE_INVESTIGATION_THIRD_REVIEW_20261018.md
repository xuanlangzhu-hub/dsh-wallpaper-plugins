# 滚动A三审：Q1与连接挂起已闭合，仅补取证scope和清理反馈

2026-10-18，复审[二审补修交付](SCROLL_A_OFFLINE_INVESTIGATION_SECOND_REPAIR_DELIVERY_20261018.md)。**Q1通过；Q3的连接open前close挂起反例已修。还有下述C1/C2两个QA边界，暂不将整份调查工具标记为通过。** A仍是有限模型未复现、真实根因未知，不启动生产修复或实机操作。

## 独立验证及保持项

独立输出：`.tmp/scroll-a-third-review-20261018-d777140b`。冻结交付顶层文件和报告，指纹见`inputs.json`，没有复制/清理小G旧profile；交付结束时未漂移。

- 原交付默认脚本在冻结副本复跑：Q3六项通过，Q2四场景通过，Q1双视口六状态动态调查通过，日志分别为`q3.log`、`q2.log`、`q1.log`。
- 两视口`streamCompletedRunningHidden`均为true；运行可见、结束DOM仍在但display:none、恢复可见的断言生效。Q1先前错误修正，模型与时钟局限、overflow:hidden因果降级的说明可接受，不再要求返工。
- 连接close/error/timeout的负例及已退出子进程不等新exit均通过。Q3六项中前四项使用假WebSocket，后两项实际启动并终止各自新建的短命Node子进程；并非六项全部是纯替身，但没有操作日常进程。
- 双视口各六状态均未出现截图中的悬空或状态落到卡片下方。保留not-reproduced范围，不能扩称外观已排除或问题已解决。
- `preservation.json`确认：P1A十审161项输入仅既有B两JS不同，59资产归档不变，B六审session指纹保持。没有改生产实现、日常安装/Profile/版本或操作DSH/WE，没有提交推送、发布、清理。

## C1（P2，Q2剩余）：scope不可用时仍采文档/首个会话并给确定布局结论

当前inspectElement总会返回第一个节点，或一个可见节点，即使候选隐藏/不唯一。`activeScrollFound`只检查节点存在；没有scroll时sessionScope退回document。虽然ambiguous标志有所改善，但派生布局及其它元素仍呈现为正常有效，违反“先定位唯一可见活动会话，再在同一scope取证”的要求。

独立CDP真实隔离页新增五场景，见`delivery/independent-scope-results.json`和`scope-summary.json`：

| 输入 | 实际输出 | 问题 |
| --- | --- | --- |
| 1个可见scope | found=true，card visible | 正例保持 |
| 移除scroll标记，保留其它节点 | found=false、scroll missing，但card visible、派生ABOVE_CARD | 没有scope仍退回document生成正常结论 |
| 只有隐藏scope | found=true，scroll hidden | 隐藏节点被称为活动会话 |
| 2个可见scope | ambiguity=true且found=true，首个scope的card visible、派生ABOVE_CARD | 没有唯一目标仍选择并计算 |
| 1可见+1隐藏scope | ambiguity=true | 仅按原始总数判断，未明确区分可见/活动候选 |

只补最小门禁：明确记录total/visible/active候选及选择依据；仅唯一可用scope可采其子节点。没有可用scope或多个可用scope时，不退回document/首个scope采集，不生成确定布局；顶层/派生输出明确unknown或scope-missing/scope-ambiguous，元素不要冒充正常。已定位scope内的目标元素也须处理候选歧义，不能拿任意第一个算位置。缺失、隐藏、歧义与未采样要区分。正文仍不读取。

加上述负例及目标重复负例，合法唯一scope、隐藏running与同节点scroll/reserve正例保持。可直接沿用本轮独立DOM样本，不必重跑Q1全部矩阵或扩展宿主功能。

## C2（P2，Q3剩余）：超时退出未确认的返回值被忽略，仍删除profile并宣称成功

`safelyTerminateProcess`的有界返回本身可接受；问题在调用方：investigation-runner-repaired.mjs、debug-layout.mjs、verify-collector-probes.mjs均丢弃返回值，直接rm profile，吞掉错误并打印“Socket, server, browser and temp profile cleaned up”。

独立`termination-probe.mjs`仅使用EventEmitter假子进程，不启动/杀真实进程：kill和SIGKILL均不发exit，10ms后返回`terminated:false,timedOut:true`，见`termination-result.json`。由当前调用代码可知此结果仍会落入无条件删profile/成功日志；本轮未实际制造顽固Edge或对其发动作。

最小补修：三个调用方消费并保存退出/清理结果。未确认退出时保留自有profile，输出路径和未完成原因，退出码/报告不得为全成功；必要时再作有界等待，不能把发了SIGKILL等同已退出。删除异常也不能被吞成“已清理”。不清旧profile或他人进程。

用纯替身验证“成功退出→可删”、“已退出→即时收尾”、“超时未确认→不删、不报成功”、“删除失败→明确失败”。必须覆盖实际共用清理路径或三个实际调用方，不能只验证helper返回false就称调用链已验。不需要启动长时间真实进程。

## 接续

只补C1/C2，交`docs/SCROLL_A_OFFLINE_INVESTIGATION_THIRD_REPAIR_DELIVERY_20261018.md`，新独立输出目录保留全部旧证据。已通过Q1、9模块CSS提取及连接一次性落定保持，不再重写这些部分；不用硬凑截图根因。通过后可按有限模型未复现结束A离线调查，实机取证和B候选安装均等用户另安排。

小G当前对话`44d9b078-56c9-47a4-aa8a-a1f673d23d0e`，Scroll A Investigation Q1-Q3 Repairs，保持Gemini 3.8 Flash High；旧长对话不再续。定时任务g保持PAUSED，日常不动。

转达记录：19:52已通过computer-use发至上述新对话，核验新用户消息、输入清空与Working/Cancel，模型保持。只发送一次，等待C1/C2补修交付。
