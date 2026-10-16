# C1 正式接入第三轮复审与当日收尾

2026-10-13，Codex。用户要求复核后今天结束，本轮仅做后台检查和记录，没有继续编码、安装、开窗或推送。

**仍暂不打包。** 缺失终态拒关、等待 close/stdio、Job 创建失败拒绝和绑定失败终止均已补上；独立候选/102 Host/check/SDK/QA112/19/5通过。剩余启动屏障未实现，严格终态门禁又暴露出提前停止的正式 producer/consumer 不一致。只补下列两处，已有修正保留，明天再接续。

证据根：`F:/dsh-wallpaper-plugins/.tmp/c1-host-third-review-20261013-ec2619b1`。保留 Gemini 交付、Host/原生源码快照、独立候选、编译/检查日志和反例。运行的进程只属于自建无窗口测试，所有窗口/身份观察与 COM 调用均为假边界；真实 Shell 和窗口操作 0。

## 已确认

- 102/102 Host 测试通过，显式候选 EXE 检查；check、SDK 契约退出 0。
- 候选与 QA 独立构建退出 0；112/112 自检、19/19 生成场景、5/5 假 worker 检查通过。
- Job 创建失败返回 Started=false，无 worker 启动；立即绑定失败时终止已启动 worker，Started/Exited/TerminationRequested/Terminated 事实保留。
- 父身份获取失败已拒绝，Summary 与真实 close 消费、缺失终态/周期旧状态拒绝、延迟输出/重试及状态兼容的现有回归保留。
- 14 个非任务目标保护文件和 14 个原生输入在复审期间未变；日常仍 rc.24，资产/归档/配置保留。

## F1 剩余 / P1：处理绑定失败并没有建立执行前屏障

RealWorker.Start 仍是 Process.Start → AssignProcessToJobObject；工作进程开始运行后不等待父侧“监督已建立”的授权。父进程存活只能说明它未退出，不能说明 Job 已绑定成功。遇到调度滞后，worker 可在 Assign 完成之前进入 HrInit/DeleteTab，事后杀掉 worker 不能撤回已经执行的动作。

`recheck-supervision.mjs` 保留正常、创建失败、立即绑定失败的对照，另在真实 Assign 边界暂停父进程，让 child 先执行，随后返回绑定失败。使用实际 TaskbarWorker/TaskbarList，verify 为假身份回调，不调用 Shell；输出显示 beforeBindingConfirmed=true。

为区分“只进行身份观察”和“已进入动作”，`recheck-startup-call-boundary.mjs` 在复审副本仅把 NativeCalls 接口替换为无 COM 的假 ICalls，保留实际 ExecuteCalls 顺序。相同启动排序下，假 HrInit/DeleteTab 已发生，标记 `fakeDeleteBeforeBinding: before-binding-confirmed`；随后父才发现绑定失败、终止并记录 Worker 失败。证据 `startup-call-boundary-counterexample.json`。这是受控调度/失败注入，不声称真实桌面已经触发此竞态。

最小补修仍是上轮要求的启动屏障：worker 在监督建立前不进入 Shell 动作，父侧确认绑定后才授权；绑定失败/父在授权前丢失，没有任何动作。可用受控握手或等效机制，不必重写 COM、帧循环和状态机。回归采用真实共用入口和假 ICalls，在父侧延迟绑定并失败时证明调用次数 0，同时保留正常绑定及退出门禁。

## F2 回归 / P2：10 秒前停止的真实终态被 Host 永久拒绝

本轮严格终态门禁只接受手工列出的 stage。实际 TaskbarHideStrategy.CaptureInitialState 设置 observing；尚未触发动作时 Finish/SettlePending 不改变该 stage。因此在 10 秒前正常停止，正式 TaskbarHideRuntime.GetSummary 的实际结果是：

```json
{"stage":"observing","attempted":false,"cleanupSafe":true,"warning":null}
```

Host 的 validNotStarted/validSettled 列表没有 observing，即便明确收到 Summary 和 close，仍报 worker-unconfirmed，重试仍失败。会话保留所有权，后续开始/重新开始被阻断；新检查中的 armed 假数据没有覆盖真实生产终态。

`recheck-early-stop.mjs` 直接引用本轮编译出的 WallpaperProbe.dll，通过正式 runtime 的真实 constructor/AfterFrame/Finish/GetSummary 生成该结果，仅替换窗口观察边界。1 秒已发布帧后停止，worker 未尝试；再把真实 summary 喂给本轮 Host 的原生消息入口。`early-stop-counterexample.json` 记录首次 stop 和 retry 均 closed=false，关源调用 0；真实 Shell/窗口操作 0。

最小補修：在正式 runtime 收尾后明确产出“安全未启动”的终态，或由 Host 基于实际 final Summary、attempted=false、cleanupSafe=true 接受真实 no-action 结果。周期 observing 仍不能当终态，cleanupSafe=false/未知不能放行。补正式 producer→Host 的提前停止回归，覆盖零帧/首帧/未满 10 秒停止及同一实例收尾后的下一轮，不只手工造 stage=armed。

## 明天接续

保留已通过的失败处理、父丢失检查、完整 close 等待、状态兼容、A2 选择及单次非阻塞帧策略；只补执行前屏障和提前停止终态。不要重复独立 40 秒、GPU 对照或长测。

版本仍 rc.26，生产 assets、已发布 tgz 和日常 rc.24 保留。修后 Codex 再复核两个正式接缝，通过后另取新版本候选并约正式生命周期短验。今天到此，不安排自动续跑、实机或推送。
