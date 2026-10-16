# C1非阻塞QA复审：调度检查通过，时序证据需局部补齐

2026-10-13，Codex。复核Gemini的TASKBAR_QA_NONBLOCKING_20261013.md及当前QA实现。
**非阻塞调度、单次执行与关闭门禁在离线检查中成立；还不能按当前记录验收“动作后新帧”，先补下面三处取证语义。**
本轮没有改实现、安装、调用真实Shell/WE、创建窗口或推送；本机仍rc.24。

## 已确认的进展

- 生成捕获入口调用真实Runtime.AfterFrame，实际走OnFrameAsync；枚举、启动/等待worker及动作后观察在后台执行。
- 策略单次触发、pending期间继续处理已发布帧、最终Finish传播停止并有界等待；未确认worker不关源。
- 写报告互斥、原R1/R3/Release回归保留，不把HRESULT成功当桌面视觉通过。
- 独立构建退出0；复跑104/104自检、18/18生成入口场景、5/5无窗口假worker进程场景均通过。

独立证据根：`F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-review-20261013-0ba3b6c3`。
构建在`.tmp/taskbar-nonblocking-review-20261013-build-01`；源码/交付快照及全部复跑日志保留。
补充反例在evidence-counterexamples，链接真实runtime/strategy，只替换窗口/worker等边界，不执行真实原生动作。

## F1 / P2：序号增加不证明画面在动作完成后才采到

TaskbarHideStrategy.cs:231只要求新发布帧Sequence大于完成时的_lastObservedSequence。
真实捕获入口先从WGC取帧、再await复制/编码并发布，最后调用AfterFrame；因此新帧可以在动作完成前采到、完成后才发布。
Runtime.AfterFrame虽接收capturedAt，却没有把它传入FrameObservation；sourceTimestampMs也没有参与新旧判定。

独立反例：worker仍在等待时采下第11帧的真实单调时间值；随后让fake API完成，再经真实Runtime.AfterFrame发布该帧。
API完成时间2589144.5105ms，图像采集时间2589122.9961ms，报告仍将第11帧列为postActionFrame。
这不是GPU实测，而是实际帧处理入口可接受的事件顺序；明确违反“不把旧帧当完成后新画面”的任务要求。
既有检查只在完成后构造序号更大的帧，没有覆盖“采集在前、发布在后”的在途编码/队列情况。

修正：记录可与源帧采集时间比较的动作完成界限；严格满足采集时间晚于该界限且发布成功才列入postActionFrame。
完成前采下但晚到的帧可以继续播放/计数，应单独归类，不能升级成完成后新画面。
回归用真实Runtime入口与生成钩子，覆盖旧队列帧、在途编码和真正新采集帧；不要靠人为把帧序号跳大或预设新鲜结论通过。

## F2 / P2：触发与完成秒数来自不同起点的时钟

TaskbarQaRuntime.cs:11的_clock在创建runtime时已开始；accepted Program的捕获clock在设备、捕获项、会话准备后才开始。
触发时间来自frame.ElapsedSeconds（捕获钟），CurrentSeconds却取捕获钟估算与runtime钟_now的最大值，混入初始化时长。
一旦初始化占用时间超过其估算误差，完成时间会多计初始化，不是与触发同一原点的时间。

独立反例模拟两钟正常的1.2秒起点差：triggeredAt=5、completedAt=6.2，真正完成后新发布帧elapsed=5.1，
报告同时把它列为postActionFrame，出现“完成后的帧比完成时间还早”的矛盾。
当前假时钟检查人为对齐_now与frame.ElapsedSeconds，不能覆盖真实runtime/捕获初始化的起点差异。

修正：触发/完成/帧采集/发布使用明确的同一单调时间轴，或记录各自原点并显式转换；不对两个起点直接Math.Max。
保留触发与完成两阶段信息，检查带初始化偏移的实际runtime接缝，不靠额外sleep或舍入掩盖差异。

## F3 / P2：pending就写worker started=true，早于执行器被调用

BuildPendingActionPayload把started硬编码为true。独立反例让后台停在动作前Inspect，Execute调用次数仍0，
初始报告却已有started=true。这是任务被调度，不是worker进程已经启动；最终Execution.Started又代表真实进程事实，语义不同。

修正：区分actionScheduled与worker启动；尚未得到进程事实时写未知，或保留独立的已确认标记。
未知/未执行结果继续为null，不通过写false换一种方式冒充事实。加前置枚举被阻塞、调度后取消及确实启动后的协议检查。

## 最小返工和后续

以上是同一组时序/取证问题，不要求重写异步执行方案、退出门禁或正式Host接入。
只修qa/taskbar-hide及交付文档；现有104/18/5检查保留，新增上述实际接缝回归，使用新目录，保留原证据。
不改生产源码、资产、版本、Profile/外观、GPU/FPS，不安装/开窗/推送。
修后复审，再与用户确认方便做一轮40秒独立短验，才能判断昨天3069ms断帧是否消除；本轮未声称已消除。
