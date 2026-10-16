# P4 原生等待补修复审：原反例闭合，保留两项接入收尾

日期：2026-10-15。范围限于 [R1/R2 与资产门禁补修](NATIVE_WAIT_P4_INTEGRATION_REVIEW_20261015.md)；未修改作者实现或交付报告。

**暂不准备新候选。R1 的 Dispose 反例、R2 的当次 cancel 失败反例和 R3 资产哈希门禁均已通过独立复核。** 仍须局部处理 F1 回退路径逐次创建 linked CTS，以及上一轮已要求但尚未补上的 F2 正式父停止共用接缝；另按原始数据澄清交付中的精度结论。正常高精度方案和已通过的 P3/P2 保留，不重写、不重跑 GPU 或长测。

## 已闭合的 R1、R2 和 R3

本轮先固定 25 份审查输入，再从冻结源码在新目录独立构建实际 WallpaperProbe，0 警告、0 错误。相对上一轮只改变 KernelWaitTimer.cs、NativePacingDelay.cs、交付报告和 check-native-pacing.mjs，Program.cs 字节未变。

| 项目 | 实际程序集复核结果 |
| --- | --- |
| R1 回退 Dispose | 原独立反例中，无需取消父 token，Dispose 约 1.1247ms，已接收的 5000ms 等待在 150ms 内完成且为取消态。 |
| R1 边界 | 无外部 token 的 Dispose、重复 Dispose、释放后拒绝请求、回退单 pending、父取消后重用均通过。作者新增的原生/回退各 20 次接收即关闭竞态也在本轮 38 项自测中通过。 |
| R2 当次 cancel 失败 | 当次等待返回 Win32Exception，LastCancelError=87；下一轮拒绝仍保持。另做“不再请求下一帧，直接退出”的控制，当次已失败，Dispose 后线程退出、句柄关闭。 |
| R2 主异常保持 | 同时注入 cancel 错误与 watchdog 时保留 TimeoutException；与父取消同时发生时保留原父 token 的取消结果，错误码仍记录为 87。 |
| 原四个正例 | 回退父 token 取消、Set 失败、watchdog 超时、原生父取消/Dispose 均通过；最后一项约 0.6131ms，线程退出和句柄关闭为 true。 |
| R3 资产门禁 | DLL 固定哈希已改为已核对的 rc.30 FD69… 基线。12 份工作区原生运行资产与不可变 rc.30 归档逐字节一致；未再次回退资产。 |

本轮实际 helper 的作者 38 项等待自测、原六个独立控制、新增五个边界控制、P3 实际 22 字段自测、P3 五类套件以及 npm run check 均通过。未重跑 P2、Host 全套、GPU 或真实窗口实验。

P3 脚本原来固定读取 .tmp/p3-probe-build。为了使用本轮实际程序集并保留历史证据，本轮只在新证据目录生成运行副本，调整导入、实际 helper 路径和证据保留位置；所有断言（包括固定资产哈希）保持。运行副本及差异补丁一并保存，原 QA 源文件未改。

## F1 [P2] R1 补修在回退的每次等待中创建 linked CTS

位置：[NativePacingDelay.cs:84](../dsh-whale-mist/qa/wallpaper-probe/NativePacingDelay.cs#L84)，正式委托见 [Program.cs:318](../dsh-whale-mist/qa/wallpaper-probe/Program.cs#L318)。

创建高精度计时器失败后，实例在整个 capture 中使用回退后端。正式调用每次传入 stopSignal.Token，因此 token.CanBeCanceled 始终为 true，新补修每次执行 DelayAsync 都调用 CreateLinkedTokenSource(token, lifetime.Token)，随后每次释放。

这修好了 R1 的退出功能，但不满足原任务“不能每帧创建……链接CTS/事件”的明确实现约束。本轮没有据此声称已产生可感知停顿或量化性能回退；问题是补修引入了被禁止的逐帧取消源分配。

请将稳定的父停止与实例生命周期联动放到每 capture/实例作用域绑定一次，或采用等效的无逐帧 linked CTS 方案；保留已经通过的父取消、Dispose 结清、单 pending、异步 continuation 和准确回退诊断。只局部修回退后端，不改 P3 度量、空帧等待或正常高精度路径。

## F2 [P2] 上轮要求的正式父停止共用接缝仍缺失

位置：[Program.cs:122](../dsh-whale-mist/qa/wallpaper-probe/Program.cs#L122)、[Program.cs:314](../dsh-whale-mist/qa/wallpaper-probe/Program.cs#L314)，以及 NativePacingDelay.RunComprehensiveSelfTests。

正式 stdin 的 stop/EOF 读取与 stopSignal.Cancel 仍是 Program 内联 Task.Run；本轮 Program 与上一轮完全一致。现有等待自测和独立控制均直接对组件调用 CancellationTokenSource.Cancel，P3 接缝仍为原有度量/报告自测。QA 对照项目只链接组件，没有链接或调用正式父停止入口。

因此目前已证明实际组件响应取消，但没有补齐上一轮要求的“真实共用调用路径及隔离假接口覆盖正在等待时父停止/退出”。这是验收覆盖缺口，**没有证据证明正式父停止已经发生故障**，也不要求打开真实 WGC 或 DSH 来补证据。

请提取足够窄的正式父停止/等待共用接缝，让 Program 和离线 QA 调用同一实现，分别覆盖 stop 命令和 stdin EOF；在实际等待已布置时触发，验证任务结束、parent-stop 归因以及等待实例释放/线程退出/句柄关闭。涉及最终源窗口或 worker 清理时使用隔离假接口，保留已有身份与退出门禁，不必重构整个采集循环或 Host。

## 交付说明：精度需区分合并统计与逐轮门槛

交付报告第 139 行称“完全满足”实验门槛，但其引用的 .tmp/p4-comparison-run-repaired/results.json 中 precisionGoal.passed=false。本轮已复制该原始 JSON，并从原始样本重算均值/P95，与记录一致。

未通过逐轮门槛的四组如下：

| 方法 | round（原始索引） | 请求 ms | 额外均值 ms | 额外 P95 ms |
| --- | ---: | ---: | ---: | ---: |
| kernel-highres-direct | 0 | 10 | 2.2234 | 10.1485 |
| kernel-highres-direct | 0 | 16 | 1.2219 | 5.6036 |
| kernel-highres-worker | 1 | 18 | 1.5399 | 5.5470 |
| kernel-highres-worker | 1 | 16 | 1.2988 | 5.4586 |

合并两轮的 worker 每请求 48 样本确实均无提前超过 0.1ms，额外均值约 0.49–1.07ms、额外 P95 均低于 5ms；18ms 请求合并均值约 19.0660ms、额外 P95 约 4.3771ms。两者可以同时成立，但合并通过不能替代原工具的逐轮 false。

请只修正证据表述，保留原始 false 与尾部样本，不改阈值、不重跑凑绿、不将本机局部等待改善扩大为真实 30fps 或壁纸鼠标联动停顿已修复。这属于报告口径澄清，不据此推断 R1/R2 修复失效。

## 证据与保护

本轮目录：

`F:\dsh-wallpaper-plugins\.tmp\native-wait-p4-rereview-20261015-145029-3308ddf9`

- before.json、source-reviewed/、native-source/：25 份输入快照及独立构建源。
- build/、build.log、author-self-test/、p3-self-test/：实际 helper、38 项等待与 22 字段 P3 自测。
- controls/、independent-controls/results.json：原六项独立控制全通过。
- extended-controls/、extended-control-results/results.json：五项针对性边界控制全通过。
- p3-check-isolated.mjs、p3-runner-adaptation.patch、p3-check.log、p3-suite-evidence/：P3 五类、实际新程序集及原断言。
- author-comparison-results.json、author-comparison-audit.json：作者原始短对照副本及逐轮/合并重算。原始 SHA256 为 FBA6AB85945917BBC7FDC34F0A666AB92BC8EF2769BEBD637B363D6A35B1B3CB。
- final-protection.json：25 审查输入、54 保护文件、五份 Profile 和日常 rc.28 的 28 个安装文件在本轮前后保持；12 工作区原生运行资产仍与 rc.30 归档一致。54 项中 53 项与接入前保持，另 1 项为本轮审查的 QA 门禁补修。
- 旧复审、交付修前快照、rc.28/rc.29/rc.30 归档全部保留。

本轮仅离线复核、添加独立证据与更新接续文档；未修改作者实现/交付报告/原 QA、生产 assets、版本、归档、日常安装或 Profile；未安装或操作 DSH/WE、打包、提交、推送、自动向其它助手发消息。没有做新的时间精度实验或实机帧率验收。

下一步仅补 F1、F2 和上述报告澄清，再独立复审。已闭合的 R1 原反例、R2 和 R3 不重复机械返工；通过后另行准备候选。
