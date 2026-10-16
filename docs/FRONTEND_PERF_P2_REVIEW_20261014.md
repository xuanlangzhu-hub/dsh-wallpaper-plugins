# P2 前端观测复审：仅补 R1–R4，暂不准备实机候选

2026-10-14，Codex。依据 [P2任务书](GEMINI_NEXT_FRONTEND_PERF_P2_20261014.md)，复核 [Gemini交付记录](FRONTEND_PERF_P2_DELIVERY_20261014.md)与实际源码。本轮只运行离线测试和独立反例，日常 **rc.28** 保持。**复审暂不通过：真实计时接缝已接通，但代际隔离、异常位图释放和坏P2数据的比较门禁仍需局部补齐。**

## 已确认的部分

- `npm run check` 通过，包括生产JS语法和CSS模板检查；提交的 P2 八类、P1 九类、Host 105 项均独立复跑通过。
- Host路由新增27字段白名单，与旧客户端兼容，2048字节上限保持；观察器实际保留新字段。`session.js` 相对rc.28归档仅为该白名单增量，P1检查文件未变化。
- 独立正例走真实 WHL1 stream→controller→`paintWallpaper`→fake canvas `drawImage`：等回调15ms、解码20ms、真实draw调用5ms，位图正常关闭。这里是受控离线时钟，不是实机耗时。
- 另一独立正例走上述链路、现有500ms reporter、真实POST metrics/GET status路由、preview-status文件、实际`watchPlayback`与`analyzeSegment`。7个样本，非零完整报文669字节，draw均值5ms、decode均值20ms，P2阶段有效；均为synthetic，未创建原生窗口。
- 原字段`rendered`的解码后投递口径、count=0均值unknown、实测0耗时、累计max不冒充阶段P95等方向正确，保留。

提交套件的“代际隔离”主要直接调用`recordDraw`，没有覆盖旧解码在新run开始后完成；“端到端”部分直接构造observation，没有实际执行观察器。复审新增上述正例及下列真实controller反例，不能把原套件通过当作这些边界已通过。

## R1：迟到解码先写新run统计，再检查generation

位置：`dsh-whale-mist/src/client.js:559–582`，以及`:606–610`。

成功分支在`:570`增加`decodeSuccessCount/sum/max`，之后才检查generation；失败分支在`:560–564`直接增加`decodeErrors/decodeFail*`。它们都引用被新run清零后继续共用的变量。旧paint的finally也直接改变共享的`painting/paintPhase`和安排回调。

独立执行：run A收到WHL1帧且进入受控解码Promise→停止→run B开始且统计清零→再让A的解码成功/失败返回。

| 旧解码结果 | B预期 | B实际 |
| --- | ---: | ---: |
| 成功返回 | decodeSuccessCount=0 | 1 |
| 失败返回 | decodeFailCount=0 | 1，且decodeErrors增加 |

成功反例中旧bitmap确实关闭，没有旧帧投递；**不投递旧帧仍不足以证明统计隔离**。旧异常/共享paint状态在旧代码中也有隐患，本条不宣称所有问题均由P2首次引入；本轮新增计数必须按任务要求隔离。

补修要求：给本次解码/paint捕获明确的run统计与状态归属；迟到成功、失败、finally、安排回调都不能修改新run。旧bitmap仍释放，当前run可正常处理自己的帧。补实际stream上的成功与拒绝两种交错断言，不能仅调用recordDraw验证。

## R2：同步订阅者异常后仍把bitmap视为已交出

位置：`client.js:591–607`。

`emitFrame`或后续通知抛错后，catch只增加`syncErrorCount`，随后无条件`bitmap=null`。如果订阅者在接管位图前抛错，finally不再关闭该bitmap。

同一真实controller/stream、相同失败订阅者比较：**rc.28归档源码调用close 1次，P2源码0次**。基线仅临时增加函数导出以进入同一测试接缝，未改处理代码或归档。异常分离本身保留，但不能引入释放行为回归。

补修要求：明确是否已经交给订阅者；未交出的bitmap在异常路径正确释放，正常图层接管和关闭的约定保持。新增断言同时检查计数、未实际draw、释放次数；现有5b只检查错误计数，遗漏释放。

## R3：有效RAF句柄0未取消，旧回调可取消新回调

位置：`client.js:619–634`、`:878–883`、`:1037–1042`。

停用只在`if (paintFrameId)`时取消RAF，合法句柄0被跳过。回调本身只检查共享待执行标志，尚未检查自己的generation/安排身份就清当前timeout/RAF并计时。

独立控制让A的RAF返回0：停止后它仍待执行；B的RAF句柄1已安排时，再执行未取消的A回调。实际B的回调1被取消，B的waitRafCount从0变1，待处理B帧没有绘制。**不是强行执行已取消回调**，而是句柄0确实未被取消。

这是任务要求的有效句柄/旧回调边界，未认定它是已在真实DSH出现的卡顿原因，也不据此宣称旧版所有调度边界正确。

补修要求：安排对象/回调捕获自身generation、终结状态及句柄，确认归属后才操作和计数；句柄0也正确取消。同一安排RAF/兜底最多记一次，旧安排不能碰新安排。保留250ms兜底、latest-only和现有绘制策略；不靠改大timeout处理。

## R4：覆盖分类总和不一致，P2仍被认定有效并比较

位置：`dsh-whale-mist/qa/perf/analyze-playback.mjs:808–817`、`:864–871`、`:1052–1077`。

分析器计算`droppedBreakdown.matches`，但`frontendStages.valid`仅采用clientThroughput有效性，忽略matches。对合法基础fixture，保持总dropped增量0，只把分类覆盖增量改成1，实际结果：

- `matches=false`，同时`frontendStages.valid=true`。
- `comparison.frontendStageDeltas`仍有数值。
- 真实CLI退出0、`status.dataReady=true`、`inconclusive=false`，并写出“data sufficient to compare = yes”。

补修要求：P2计数关系不一致时，明确给P2 invalid/unknown及reason，并抑制P2分类与阶段对比。合法Native/Host/P1数据可以独立保留；旧客户端缺P2仍兼容，不能为了本条把所有旧P1报告判坏。整体P1 dataReady不等于P2比较通过，报告须说清楚。

同步补“总和不一致”的数值反例；保留原来的计数回退/缺字段/零值控制。

## 复跑入口与证据

证据根：`F:\dsh-wallpaper-plugins\.tmp\frontend-perf-p2-review-20261014-3c4955c1`。

- `source-reviewed/`及`reviewed-source-hashes.json`：8份交付输入快照；`baseline-rc28/`：归档源码对照。
- `reported-p2-suite.log`、`reported-p1-suite.log`、`check.log`、`wallpaper-host.log`：原有检查独立复跑。
- `counterexamples.mjs`、`counterexamples-verified.log`、`counterexample-results.json`：5个反例（R1两种完成方式）和真实canvas正例。
- `mismatched-drops-*`：R4原始fixture、真实CLI报告与输出。
- `roundtrip-control.mjs`、`roundtrip-control-verified.log`、`roundtrip-verified-result.json`、`roundtrip-verified-observation/`：真实生产接缝的离线正常控制。

反例入口在仓库根执行：

```powershell
node .tmp/frontend-perf-p2-review-20261014-3c4955c1/counterexamples.mjs
node .tmp/frontend-perf-p2-review-20261014-3c4955c1/roundtrip-control.mjs <全新trial名称>
```

反例脚本已有证据文件用wx保护，修后重跑应复制脚本、source-reviewed与baseline-rc28结构到新目录并放入修后源码；用`node <新目录>/counterexamples.mjs --expect-fixed`要求五个问题均不再出现。默认模式只用于确认本轮坏版本，不可误当成修后通过标准。不要在旧证据目录原地改源或覆盖结果。roundtrip的trial必须是全新短名称。初期脚本调用错误日志保留，结论取`*-verified.log`与对应结果，不把脚本调用错误当成生产失败。

`final-fingerprints.json`确认8份复审输入全过程稳定、5项非目标保护输入及15个资产/版本文件一致；`installed-rc28-verification.json`确认日常安装28文件与活动rc.28归档一致。本轮未修改播放实现、安装/Profile/外观、原生资产或归档，未操作DSH/WE、新建壁纸窗口、提交/推送。未做实机性能优化验收。

下一步由Gemini**仅补R1–R4及对应实际接缝回归**，保留已通过部分，交Codex再次复审；通过后再准备独立候选并另约用户短测。不要重做P1平台/GPU矩阵/长测，也不要在本轮更改采集上限、JPEG或硬件视频链路。
