# P4 原生等待接入最终复审：实现通过，附表需更正

日期：2026-10-15。复核 [第二轮剩余 F1/F2](NATIVE_WAIT_P4_INTEGRATION_SECOND_REVIEW_20261015.md) 及 [最新交付](NATIVE_WAIT_P4_INTEGRATION_DELIVERY_20261015.md)。

**2026-10-15 文档收尾追加：交付附表已更正，30 行样本数/均值/合并 P95 与原始样本全部一致，文档问题已闭合。** 本文下方“附表需更正”和“只需更正附表”为原最终复审时的历史状态；实现无需继续返工。当前下一步是准备并核对独立新候选，之后另约临时安装及短前台测试，见文末收尾计划。本轮尚未打包、安装或操作 DSH/WE。

**本轮源码与离线接缝复审通过，没有发现需要继续返工的实现阻塞项。** F1 稳定父 token 下的回退 CTS 复用、F2 正式 stop/EOF 共用读取入口均已验证，原 R1/R2/R3 保持通过。小 G 无需继续改实现或重跑实验；交付 4.2 附表的合并 P95 仍有数值错误，按下面准确表更正即可，不必再启动一轮实现复审。

本轮未准备候选、安装或操作 DSH/WE。日常仍为 rc.28，工作区版本仍为 rc.30；实现复审通过不代表真实播放达到 30fps，也不代表壁纸鼠标联动停顿已解决。

## F1：回退取消源复用通过

NativePacingDelay 增加稳定父 token 的实例预绑定与回退缓存复用。正式 Program 创建实例时传入 stopSignal.Token，普通等待继续传入同一个 token，因此稳态等待复用已有 linked CTS；只有切换 token 或取消后重新绑定时才创建新的取消源。正常高精度路径与 KernelWaitTimer 保持原逻辑。

本轮实际程序集验证：

- 作者 54 项自测包含预绑定只分配一次、50 次等待后分配计数仍为 1。
- 独立注入真正的 Create 故障（不只使用 forceFallback），实际后端为 task-delay；12 次连续等待的 fallbackLinkedCts 对象引用保持相同，计数始终为 1。
- 同一实例的旧父 token 取消后，换用新父 token 可重新等待；旧 token 不污染新等待，新父取消仍有效，分配总数为 2。
- Dispose 能取消已接收的回退等待，外部父 CTS 不被实例 Dispose 反向取消；原单 pending、重用、重复关闭与释放后拒绝检查继续通过。

这些结论限定于取消源复用与生命周期，不把自测名称中的 zero-per-frame-allocations 扩大为整个等待方法零分配。

## F2：正式共用父停止入口通过

Program 将原内联 stdin Task.Run 替换为 ParentStopChannel.Start(Console.In, stopSignal, enabled: mode == "pipe")。新增类由正式 helper 与 QA 项目编译使用；离线 QA 读取逻辑和生产读取逻辑共享同一实现，分别覆盖 stop 命令和 EOF。

本轮独立控制直接反射调用新构建实际程序集的 ParentStopChannel.Start，采用与 Program 相同的外部 CTS 模式，配合实际 NativePacingDelay：

- 原生/回退两个后端各覆盖 stop、EOF，共四个在途等待控制。触发前确认已接收且未完成，随后取消、实例释放、线程退出及句柄关闭均通过。
- 确认 channel.Source 就是传入的父 CTS；没有在 QA 中替换一套独立的读取/取消实现。
- 另验证 enabled=false 不读取或取消、无关命令后仍能消费 stop、IOException 会取消实际在途等待。

Program 相对上一轮只有“共用父读取入口”和“等待实例预绑定父 token”两个局部改动；普通 pacing 委托、30fps 目标、原预算/截断/最低 1ms、空帧 2ms/Task.Delay、parent-stop catch 和最终身份/worker 清理门禁均保持。

边界：作者 ExecuteWaitUnderParentStopAsync 是 QA 协调器，生产不调用这个 QA 包装方法。本轮证明正式共享读取入口到实际等待取消的接缝，并通过差异核对保留既有归因/清理逻辑；没有运行完整 WGC capture 或正式窗口/worker 最终清理实机，不将假接口回调视为实机清理证明。此边界不再构成本轮要求的父停止共用入口缺失。

## 通过的检查

| 检查 | 本轮结果 |
| --- | --- |
| 冻结源码独立构建 WallpaperProbe | 0 警告、0 错误 |
| 实际 helper --self-test-native-wait | 54 项通过 |
| 原独立组件控制 | 6/6，包含原 R1/R2 反例 |
| 上轮扩展边界控制 | 5/5，含 R2 不请求下一帧即退出、主异常保持 |
| 本轮独立 F1/F2 控制 | 9/9 |
| P3 五类（使用本轮实际新程序集） | 通过，含 22 字段、生命周期/预算与资产固定哈希 |
| npm run check | 通过 |

P3 仍只在独立运行副本调整导入、helper/证据路径和证据保留；原断言不变，原 QA 源文件不改。未重跑 P2/Host 全套、GPU、长测或时间精度实验。

## 文档更正：4.2 合并 P95 的 28 个数字不符

最新报告已正确保留原始 precisionGoal.passed=false 和四个未过逐轮门槛的队列，也明确合并统计不能替代逐轮门槛，这项口径问题已闭合。

但从同一原始 JSON 重算 4.2 的 30 行合并 P95，有 28 行与表内数值相差超过四舍五入误差。例如 worker 的 10ms 请求写成额外 P95 1.85ms，实际为 1.2659ms；task-delay-tracked 的 30ms 请求写成 4.10ms，实际为 15.4012ms。不能继续使用这些誊写数字。

按现有对照工具相同的最近秩规则：每方法/请求合并两轮共 48 个原始 samplesMs，排序取第 ceil(48*0.95)=46 个样本，再减请求值。准确替换数据如下（保留四位小数；若交付保留两位，请从这里正常四舍五入）：

| 方法 | 请求 ms | 合并样本数 | 合并实际均值 ms | 合并额外 P95 ms |
| --- | ---: | ---: | ---: | ---: |
| task-delay-plain | 1 | 48 | 14.8205 | 15.2055 |
| task-delay-plain | 2 | 48 | 15.4587 | 14.0862 |
| task-delay-plain | 10 | 48 | 15.5089 | 6.5558 |
| task-delay-plain | 16 | 48 | 30.1909 | 15.7823 |
| task-delay-plain | 18 | 48 | 30.8011 | 13.9828 |
| task-delay-plain | 30 | 48 | 31.5250 | 2.0155 |
| task-delay-tracked | 1 | 48 | 15.4676 | 15.2398 |
| task-delay-tracked | 2 | 48 | 15.4414 | 14.6681 |
| task-delay-tracked | 10 | 48 | 15.4424 | 6.3302 |
| task-delay-tracked | 16 | 48 | 29.7096 | 15.9064 |
| task-delay-tracked | 18 | 48 | 30.8182 | 13.7539 |
| task-delay-tracked | 30 | 48 | 33.0895 | 15.4012 |
| kernel-normal-direct | 1 | 48 | 15.5355 | 15.4318 |
| kernel-normal-direct | 2 | 48 | 15.5723 | 14.6193 |
| kernel-normal-direct | 10 | 48 | 15.4577 | 6.2465 |
| kernel-normal-direct | 16 | 48 | 30.0124 | 16.9849 |
| kernel-normal-direct | 18 | 48 | 30.9479 | 14.3444 |
| kernel-normal-direct | 30 | 48 | 32.3957 | 15.1731 |
| kernel-highres-direct | 1 | 48 | 1.4057 | 0.6989 |
| kernel-highres-direct | 2 | 48 | 2.3912 | 0.6455 |
| kernel-highres-direct | 10 | 48 | 11.4326 | 4.6141 |
| kernel-highres-direct | 16 | 48 | 16.8154 | 4.9251 |
| kernel-highres-direct | 18 | 48 | 18.4115 | 0.7535 |
| kernel-highres-direct | 30 | 48 | 30.3750 | 0.6176 |
| kernel-highres-worker | 1 | 48 | 1.4888 | 0.7689 |
| kernel-highres-worker | 2 | 48 | 2.5849 | 0.8760 |
| kernel-highres-worker | 10 | 48 | 10.7922 | 1.2659 |
| kernel-highres-worker | 16 | 48 | 16.9073 | 3.1588 |
| kernel-highres-worker | 18 | 48 | 19.0660 | 4.3771 |
| kernel-highres-worker | 30 | 48 | 30.7028 | 1.1291 |

worker 六档合并额外 P95 仍全部低于 5ms；18ms 请求合并实际均值约 19.0660ms、额外 P95 约 4.3771ms。原始逐轮整体 false 仍保持。原数据 SHA256 为 FBA6AB85945917BBC7FDC34F0A666AB92BC8EF2769BEBD637B363D6A35B1B3CB，没有重跑或修改数据。

这项只需修正文档附表，不改变本轮实现通过结论，不要求调阈值、增加实验或重写等待方案。本表本身也不是对最新代码重新做的精度测量。

## 证据与保护

本轮目录：

`F:\dsh-wallpaper-plugins\.tmp\native-wait-p4-final-review-20261015-151206-c4122df2`

- before.json、source-reviewed/、native-source/：冻结 26 份输入；相对上一轮仅 NativePacingDelay、Program、交付、QA csproj 和新增 ParentStopChannel 不同。
- build/、build.log、author-self-test/：独立构建与 54 项自测。
- independent-controls/、extended-control-results/：原 11 个控制在新实际程序集上的结果；控制代码仍为上一轮已保存源码。
- seam-controls/、seam-control-results/：本轮新增 9 项独立控制源码和实际结果。
- p3-check-isolated.mjs、p3-runner-adaptation.patch、p3-check.log、p3-suite-evidence/：P3 原断言及本轮实际程序集。
- program-diff.patch：Program 仅两个局部改动的差异。
- author-comparison-results.json、precision-document-audit.json、corrected-precision-table.md：原始短对照副本、30 行重算及准确表。
- final-protection.json：26 审查输入、54 保护文件、五份 Profile 和日常 rc.28 的 28 安装文件保持。54 项中 53 项与接入前一致，另 1 项为已复审的固定哈希 QA 门禁；12 工作区原生运行资产与不可变 rc.30 归档一致，rc.28/rc.29/rc.30 三归档均保持。

本轮仅独立复核、添加证据与更新接续文档。没有改作者实现/交付/原 QA、生产 assets、工作区版本、归档、安装或 Profile；没有操作 DSH/WE、打包、提交、推送或自动给其它助手发消息。历史失败报告和证据全部保留，不能按旧阻塞项继续机械返工。

下一步：小 G 只需按准确表更正交付附表。等待实现无需继续补修；后续可另行准备独立新候选并核包，不覆盖 rc.30 或活动 rc.28。当前用户只授权复审，本轮不自动进入打包/安装/实机；实机阶段仍需另确认方便并按届时设置备份恢复。

## 2026-10-15 文档收尾与下一步

交付 4.2 已按原始样本完整核对：30 行的样本数、合并均值和最近秩合并 P95 全部一致，原始 precisionGoal.passed=false 保留。相对最终复审的 26 份输入，仅交付文档变化，其余 25 份输入保持；54 保护文件、五份 Profile、日常 rc.28 的 28 安装文件与 12 份 rc.30 工作区原生运行资产均保持。本轮不重跑测试或时间精度实验。

证据：F:\dsh-wallpaper-plugins\.tmp\native-wait-p4-doc-closeout-20261015-152222-5ed257c1\verification.json；已核对交付 SHA256 为 65F8440A2B1CDB25A191944245C4C2BE3CB0F4542C272D3F97A78A0FCD5F6F85。该目录保留交付快照和核对脚本。

接下来按以下顺序进入真实播放验证：

1. 从已复审输入准备独立新版本候选（可用尚未占用的 rc.31），隔离 publish，核对包内容/指纹和实际发布 helper 的受影响自测。旧 rc.30 与活动 rc.28 均不覆盖，避免用不含 P4 的旧包误测；本轮还没有执行此步骤。
2. 候选就绪后，重新确认用户方便、其它助手暂停且 DSH 无任务，保存届时的 Profile 和关闭状态外观设置，再临时安装新候选并核验安装文件。不能套用上午或上一轮的旧设置备份。
3. 同一三体 scene、窗口尺寸和外观下，做约 20–30 秒前台静止、20–30 秒鼠标移动短测。确认实际后端诊断，观察请求/实际等待差、完整采集周期、送帧与 draw 计数、前端帧龄/覆盖，同时记录用户看到的鼠标联动画面表现。
4. 停止后核对线程/worker/本轮源窗口清理，保存原始样本，按本轮备份恢复日常 rc.28 与当时设置。是否改留新包另按用户的实际体验决定。

旧 rc.30 的约 13.2ms 等待偏差、46.4ms 周期可作历史参考，跨 run/时间不能当严格同条件因果 A/B。此次主要验收等待改善是否进入真实采集循环，以及停止清理是否保持；不能提前承诺鼠标联动停顿已解决。若该症状仍在，后续独立调查源响应与传输/前端排队，不混入这次等待改动，不重跑 GPU/长测。

当前用户是在确认文档及询问下一步，本轮没有自动打包、安装、退出应用、启动播放或实采；后续操作按用户接下来的授权执行。
