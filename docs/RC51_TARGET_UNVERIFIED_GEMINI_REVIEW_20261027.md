# rc.51 target.unverified接缝交付独立复审：门禁复现接受，首帧因果证明及收尾需补

2026-10-27，Codex。复审`RC51_TARGET_UNVERIFIED_GEMINI_DELIVERY_20261027.md`及实际脚本。结论：**部分通过，暂不据此修复生产实现或生成候选。** 接受实际session与适配器／作者Host／控制器组合能复现target未验证与稍后就绪恢复；不接受已经走通完整首帧→真实renderer playing→自动读取或已经确认本次现场竞态。无实现修改，日常DSHrc.3／Whalerc.48／GitBash0.1.2及原WE不动。

## 独立核验与可接受部分

证据目录`.tmp/rc51-target-unverified-review-20261027-a/`。prepare阶段逐字节核对固定tgz全部43文件；与候选准备时基线相比281项共享源码／QA／资产保持；冻结本轮交付8项输入。原脚本排他复制后复跑5项通过，422ms退出0；追加观察、保持原断言不变的副本5项通过，423ms退出0。最后核对281保护／8交付未变，217ms退出0。

可接受：captureStarted=false能使真实canApply返回false，随后实际session接收stderr状态置true后手动load可恢复；真实session在**注入的高层身份查询**返回失败时保留null并阻断读取；adapter不存在产生同码；busy上下文在作者Host先被拒绝。以上属于实际组件加IO／上下文替身证据，仍有价值，但不补足下述调用点缺口。

## R1：所谓首帧用例没有一帧通过，实际自动触发链未运行

交付脚本`reproduce-target-unverified.mjs:86`发10字节JPEG前缀；固定FrameDecoder需要24字节WHL1头及声明payload。实际session只将这10字节保留在pending，未产生frame。脚本随后在232／371行**直接await author.ensureLoaded()**，没有运行renderer、stream解码／绘制、playing事件或React的自动读取effect。报告所写`view.state='playing'`并未出现在可执行路径。

观察结果（observer/target-unverified-report.json）：两例均hub.received=0、latest=null、pendingBytes=10。独立反事实仅删除两处mockChild.emitFrame调用、其它所有断言保留，5项依然通过（noFrames目录，332ms退出0）。所以目前红绿对照检验的是**人工选择何时调用ensureLoaded与captureStarted门禁的关系**，并未证明帧是触发原因。

另外：index的readTarget／readWallpaperLifecycle是手抄闭包，无从固定源提取或等同性断言；readContext硬编码authorized=true，未走主renderer桥接／实际鉴权。报告“完整真实链／完整请求头认证”的表述超出覆盖。session.create参数放错层：实际签名读取scene对象，脚本把sceneId／mode等放顶层，因此观察到config.mode=preview、output未提供，并不是声称的daily调用。

**最小补验**：正确scene参数；使用合法WHL1包和至少一帧真实可消费的图像；断言实际hub接受帧。将帧流连到固定client的实际renderer状态推进和自动读取调用点，可替身底层图像解码／画布，但必须明确边界，不能直接置playing或手动ensureLoaded充当自动触发。精确控制stderr就绪在前／后两个顺序，记录playing、首次schema请求、captureStarted及response的先后，只有顺序一变量不同。断言帧被阻止时不会走同一自动读取；若轮询等另有真实触发，独立记录并约束，不可强凑原结论。index闭包从固定源提取并校验，或真实注册入口；使用已审主桥接／Host路由，无法覆盖的认证部分明确标为替身。无需重跑旧SDK大套件或再开实机。

## R2：启动时间失败测的是高层结果替身，没有经过默认查询边界

409行注入queryProcessIdentity async()=>({ok:false,...})，跳过了session默认queryWindowsProcessCreationUtc及execFile回调／响应解析。这可证明null目标受阻，不能声称已验默认PowerShell查询失败／超时链。正例的启动时间也为模拟值，不是本轮真实源进程启动时间。

**最小补验**：不传queryProcessIdentity，只替换session的execCommand底层IO，实际执行默认查询函数及其验证器；用合法PID／ISO响应与明确错误回调对照，记录查询被调用且PID绑定正确，session字段到真实target结果不丢失。若不测试真实定时超时，准确写“错误回调替身，真实超时未验”；无需为覆盖名词故意等长超时。不得执行真实PowerShell或采样日常进程。

## R3：未确认的session清理被测试忽略，缺失败收尾门禁及阶段截止

三处finally仅await session.stop()，既不检查返回值，也不检查session.isClosed。独立观察三个session全部返回：`outcome=worker-unconfirmed, closed=false, error='worker exit could not be confirmed'`，sourceClosed=false；但原断言与allPassed仍true、父进程报告通过。原因是MockCaptureChild无合法终结worker证明，helper兜底{ok:true}也不是源关闭协议。此为**离线替身清理证明不完整／验收漏判**，不是实际生产进程泄漏的证据；本轮没有启动原生进程。

此外server.listen、fetch／json、server.close没有各阶段deadline；父监督仅25秒kill，缺kill后的有限等待／退出未确认最终报告。不能把快速退出0等同于已经满足既有收尾合同。

**最小补验**：为自有替身提供与实际协议相符的worker终结状态与带正确location／PID绑定的源closed结果，明确await并检查session.stop、isClosed、controller／host释放、server关闭。让cleanupSuccessful进入同一allPassed及子退出码。用同一实际验收函数作一次缺终结／源未关闭故障注入：子报告passed=false、非零退出；独立验证器可以准确确认预期失败后退出0，不能把故障子报告转绿。每阶段请求／退出／关闭有界，父监督kill后仍有退出确认和有限最终报告。不要全局kill或触碰历史任务。

## 文档收敛与交付边界

保留原始脚本／失败见证，不覆盖本次交付。新补验排他目录，交付`docs/RC51_TARGET_UNVERIFIED_GEMINI_REPAIR_DELIVERY_20261027.md`；只补R1–R3及相关结论，不重复旧六／十一项或无关QA。报告将“100%现场复现／天然竞态已证实／彻底排除锁竞争”等收回为实际覆盖范围：同步busy上下文先拒409已验，不概括所有并发／代次变化。helper门禁目前只验字符串以.exe结尾，表格不要额外声称target本身验证绝对路径。

本次先补复现与收尾，**不改生产实现／不做自动重试方案**；因果链能通过正确接缝锁定后再评估最小修复。先前本轮现场仍只有target.unverified码，available／targetActive瞬间值及windowStartUtc未取到，不宣称已解决。Codex不并行改实现，不安装、不操作日常、不推送清理／开定时。

独立结论机器记录：independent-findings.json；原复跑、观察、去帧反事实分别为original-run.json／observer-run.json／noFrames-run.json。各子进程退出已确认；所有新增结果位于本轮审查独立目录。

## 发送记录

R1–R3最小补验已单次发送至Antigravity原“Scroll A Investigation Q1-Q3 Repairs”会话（44d9b078-56c9-47a4-aa8a-a1f673d23d0e），保持Gemini3.8FlashMedium／Turbo，确认新用户消息／输入清空／Working。发送前的控件几何及用户输入检测错误均只刷新，没有提交或重复消息。证据repair-dispatch.json与repair-sent-task.txt。等待新补验交付，不创建自动监控，Codex不并行改实现。
