# C1 QA 第二轮复审：F1闭合，剩余三处接线待修

2026-10-12，Codex。独立重编译退出0，DS自检复跑58/58；未操作真实窗口/WE/Shell，日常rc.24保留。
**仍暂不实测。只修R1–R3，不重做已经修好的参数和帧时点。**

## 已确认修好

- 同生产CaptureArguments组合验证：25秒控制组通过；1800秒、HWND不一致、后置owned-location的frames模式、min=1均拒绝。
- 无QA的合法forever/pipe捕获请求恢复兼容。F1核心边界闭合。
- 生成hook已移到JPEG处理/pipe发布后，使用当前frames计数；策略阻止未发布帧和已知停止帧，首帧/精确location也补上。
- 引入独立worker进程的方向正确，身份在执行侧复核；以下是接线仍缺失，不要求换成新方案。

新证据：`F:/dsh-wallpaper-plugins/.tmp/taskbar-hide-second-review-20261012-13f128ed`。
`rebuild`为独立构建，`selftest-rerun.json`为58项结果；原DS源码与交付在`ds-source-snapshot`和`DS_DELIVERY_SNAPSHOT.md`。
`counterexamples`链接真实DS解析器/策略/生成runtime，只替换窗口/WE边界，不创建真实worker或COM。
结果：`counterexamples/bin/Release/net10.0-windows/observations.json`。保留前轮证据，不覆盖。

## R1 / P1：初始化失败仍跳过清理，还报告为已结束

build.mjs没有把资源阶段移入新的外层try：实际生成Program仍是CreateDevice/CreateItem/pool/session/StartCapture在前，
采集循环try/finally在后。注释和交付里“try在CreateDevice前”与源码不符。
TakeOwnership已在该段之前执行，源窗口是本轮已有资源，不能因为没有取得capture item就声称无需清理。

假初始化失败沿同样scope，调用真实ReportBeforeResources：关闭调用0，假源仍存在；
报告为`outcome=not-needed, closed=true`。这不是WGC实测，是入口可达性与真实runtime反例。

修正：为已验证并接管的本轮源建立真正的外层finally，覆盖初始化、开始采集、发布/循环失败、正常退出与停止。
报告只把未接管的情况标未接管，不写closed=true冒充已关闭。源接管后都走同一清理入口；
生成QA分支不要再执行accepted父断开分支的另一条关闭（否则也会绕过R2）。
已确认目标不存在时直接记已结束，不再按名字关闭可能重现的新窗口；身份不明记未确认/非零，不杀原WE。
检查应在生成程序/真实runtime接缝上触发CreateDevice、CreateItem、StartCapture等假失败，再断言关闭和报告结果；
不要只测RecordCleanup或在报告里改解释。

## R2 / P1：worker未结束的状态没有阻止实际清理，停止也未传播

策略OnFrame把`CleanupSafe=false`写成action-unconfirmed，但CanCloseOwned只检查窗口身份，未保存/查询该执行约束。
真实runtime的CleanupOwned仅调用CanCloseOwned，因此最后仍关闭源。
独立反例：注入“超时且未确认worker退出”的Execution → stage=action-unconfirmed → cleanupAllowed=true → 关闭调用1、退出0。
DS“refuses cleanup”自检只断言了stage和报告Action非null，没调用清理入口。

此外生成RunWorkerEntry给停止回调固定`() => false`；执行侧实际看不到主采集stdin停止、stop.txt或Esc。
RunWorker阻塞等进程，没有接主停止信号；发生异常时只Dispose进程对象，也不保证仍在运行的worker终止。
不能用error字符串包含“was terminated”代替明确的退出确认状态。

修正：持久化worker是否已确认结束；所有关闭入口先检查该状态，未确认则拒绝关闭并非零退出。
RunWorker返回结构化Started/Exited/TimedOut/Cancelled/Terminated事实；所有异常/停止/超时路径均处理本轮worker归属，
确认它退出后才清理源。停止信号实际接到执行器，worker侧最后复核也须读取真实停止来源，不用恒false占位。
把“worker未确认→调用真实CleanupOwned→closeCalls=0/退出非零”加入检查；
用无窗口假worker验证停止/超时/异常后无迟到动作或遗留工作者，不调用真实Shell。

## R3 / P2：报告存在不等于最新写入成功，成功HrInit仍被丢掉

Runtime.Write吞掉IOException/UnauthorizedAccessException，WriteReport只检查File.Exists。
独立反例：先生成报告，再用仅允许读共享的句柄锁住本轮测试文件，执行真实Finish。
关闭调用1，最终报告还没有cleanup字段内容，退出却0；当前报告存在掩盖了写入失败。

Execution.FromWorker总令HrInit=null，把最终Result塞进DeleteTab；worker JSON和主进程读取也只传最终Result。
因此成功路径HrInit并未被保留，无法支持交付所称“两者各自记录”；超时/Verify失败也不能伪装成已调用DeleteTab。

修正：报告写入有明确成功/失败返回并由runtime记录，最终存在旧文件不能抵销失败；失败仍完成必要清理，但非零并报告原因。
仅在成功写出最终状态后认为证据完成；仍拒绝既有证据，不覆盖别人目录。
COM流程/worker协议/Execution变换完整保留实际HrInit和DeleteTab结果；未执行或未知写null并说明，不能构造成功值。
补已有文件随后写失败、HrInit成功/Delete成功、HrInit失败、Verify拒绝和worker超时的共同执行路径检查；
不由FakeAction自己实现调用顺序来冒充真实ComAction的共同流程验证。

## 返工范围与成本控制

仅`dsh-whale-mist/qa/taskbar-hide/`与交付记录；不动src/accepted原生/assets/版本/配置，不安装/实测/提交推送或清Temp。
F1和已修正帧hook不重写；优先R1，再R2，最后R3，每项先在接缝上看失败再修，不重跑GPU/长测/React。
新增检查重点断言真实清理/退出/报告结果，不只断言一个stage字段。
生成项目的重复Compile警告不作为独立阻塞项，可顺手整理。完成后交Codex复审。
