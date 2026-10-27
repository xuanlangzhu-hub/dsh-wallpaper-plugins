# 同会话就绪最小修复复审：正向可用，身份绑定与QA门禁需补修

2026-10-27，Codex。复审`RC51_AUTHOR_READ_READINESS_REPAIR_DELIVERY_20261027.md`。结论：**部分通过，不能提升或打包安装。** 事件驱动／同一次GET的正向行为有进展，但完整身份绑定不满足合同，部分QA声称未被实际执行。保持隔离修复，不改共享源码／日常rc.48。

## 独立核验

独立目录`.tmp/rc51-readiness-repair-review-20261027-a/`。固定43文件与归档保持，281共享源码／QA／资产保持；冻结新交付38项，运行源码仅index／session／author ApplyAdapter／作者Host四文件变化，符合范围。

原脚本与父监督未改字节，在本轮副本复跑：正常外监督989ms退出0，内正常8／8；fault外监督976ms退出0，其内子退出1。但fault的含义只到报告层，见R2。独立负例377ms及追加真实Host负例259ms退出0、全部退出确认；这些“退出0”表示反例观察成立，不是修复通过。无原生进程／真实窗口操作。

可接受的实现方向：session发送采集就绪通知；GET独立readSchemaForGet沿用一个timeout与AbortController，POST仍走旧schemaFor；正向case2一次schema GET／零作者POST即可ready／6字段。client与native资产未改。不重做此基础架构或重新讨论已接受诊断。

## R1：绑定不完整，等待失败／dispose没有形成可靠拒绝

### R1.1 只钉session／generation／location，没有钉完整源身份

`waitForReady`保存boundSession和boundLocation，事件后只检查session、wallpaperId、generation、location一致，再验证当前HWND／PID／startUtc／helper“格式合法”；没有比较这些字段与等待开始时的值。

`contract-counterexamples.json`中四项独立负例：保持同session／scene／generation／location，分别改成另一个合法HWND、PID、ISO启动时间、exe helper再发ready，实际waitForReady均返回ok:true。实际Host＋适配器的loopback反例也在HWND变化后返回200／application.targetActive=true。它证明的是受控身份输入变化时绑定合同失效，不声称当前日常存在外部攻击或实际错误下发；apply本身的最终native校验仍保持。

**补修**：等待开始时冻结已经验证、归一化的完整身份（wallpaperId、generation、location、HWND、PID、精确startUtc、helper），session对象另用引用比较；唯一允许变化的是captureStarted由未就绪到就绪。事件回调和注册后双检查均检查完整绑定、ID／generation、disposed／busy／stopping及signal。不能接受新的一组“合法字段”冒充原目标，也不能把双检查只剩session相等。

### R1.2 Host忽略等待器明确拒绝

Host只await waitForReady，没有使用返回的ok／reason。在`host-ignored-rejection.json`中，实际等待器返回`{ok:false,reason:'session_changed'}`，但Host最终仍200／targetActive=true。该反例刻意替换session对象、保持公开lifecycle ticket值不变，检验独立对象绑定；不推断正常生产generation一定不变。正因为合同要求双重绑定，Host不能仅依赖ticket／最终canApply掩盖等待阶段已经拒绝。

**补修**：明确消费等待结算结果，session_changed／身份变更／取消等不可在后面变为成功；保留非法初始目标的既有诚实拒绝语义，不能新增重试或重新绑定新目标。事件后仍要重验完整ticket／target，写路由不变。

### R1.3 新等待资源没有随adapter.dispose释放

独立适配器生命周期负例：挂1个等待者后dispose，监听仍为1，稍后ready仍使该Promise返回ok:true；同时canApply正确为false。因此不能说实际写门禁被绕过，但新增等待资源未继承dispose合同。Host.dispose当前先abort自己的controller，能覆盖其请求，不代替adapter自身的完整清理。

**补修**：跟踪待结算readiness等待者，dispose立即拒绝并解绑；保证settle／unsubscribe幂等，含订阅同步回调时的解绑顺序。补同目标就绪前dispose及迟到ready负例；验证Host.dispose在真正有请求等待时也会结算，而非只在finally调用。

## R2：报告层伪故障与遗漏回归，不能作为完整修复验收

### R2.1 故障分支并未让清理失败

`test-readiness-repair.mjs:1139–1146`在所有case运行完成后，根据QA_INJECT_TEARDOWN_FAILURE直接改cases[0].cleanupSuccessful／passed／error及summary布尔值，没有改变helper／session关闭结果，也没走真实失败验收。独立fault重跑stdout仍打印8个Case PASS、stderr为空，但报告末尾被改为失败，passedCases仍8。父监督只是识别了人为填入的错误字段。

**补修**：删除这种后置改报告的模拟。像前轮已验做法一样，从底层关闭IO返回closed:false或缺证明，让实际session.stop／isClosed及同一验收函数真的失败；case／总体passed和退出码自然计算，统计前后一致。正常／fault仍排他分目录wx，不覆盖旧证据。不要求真实Windows进程或故意长挂起。

### R2.2 补宣称过但没覆盖的最小接缝

- Case8没有任何POST请求；不能声称POST不等待已测试。补一个经过真实POST校验与metadata路径的请求，断言readiness等待调用次数0、无原生命令；无效JSON入口就拒绝不能充当证据。
- Case6实际只abort客户端，Host.dispose是在请求已结束后的finally；补Host在等待中dispose的独立动作及监听释放。
- Case5元数据没有受控耗时，250ms预算却允许到600ms，无法区分预算重置／加倍。补元数据先消耗一部分预算的确定阶段，再永不就绪，证明metadata＋等待共享原deadline。源码现有单timer方向可保留，不为测试而增加新计时器。
- Case7只有A的等待，未启动B的等待；补新B（同Lucy）自己的在途请求，旧A迟到事件不释放B，直到B自己的证明才可成功，两个监听都结算。
- 这轮重新手写了index两个闭包，并用手填oldApplyAdapter作为红例。请恢复从隔离index提取或实际入口的接线校验，旧红例用固定旧实现；不以“等价”替身掩盖实际接线漏改。已审真实引擎／原版effect及解码hook边界继续复用，不再重做SDK。
- listen／firstReadPromise／fetch／server.close仍有无阶段deadline的await，不符合本任务。为新QA加阶段截止及最终收尾，外层watchdog照旧保留；不用数分钟等待，不全局kill。

## 补修与交付

只补R1实现边界及R2必要QA，保持四文件范围与GET-only／原总预算／零前端重试／最终写门禁；不能整体重写client、增加轮询或扩大壁纸资格。新交付`docs/RC51_AUTHOR_READ_READINESS_REPAIR_SECOND_DELIVERY_20261027.md`，使用新的隔离目录，保留本轮实现、测试和失败见证；记录实际变更、上述反例的修前红／修后绿及原正向继续通过，声明真实组件／IO替身。

文档同步真实API路径与实际字段；当前报告的`/api/wallpaper/author/properties/schema`、boundSession／mode及remainingMs描述不对应实际代码。只对照已运行实现修正文案，不再手填未验证结果。原现场仍未唯一确定，当前没有任何生产修复／提升／安装。Codex不并行改实现，日常DSHrc.3／Whalerc.48／GitBash0.1.2及原WE保持，不推送清理／开定时。

## 发送记录

R1实现边界与R2必要QA已单次发送至原Scroll A Investigation Q1-Q3 Repairs（44d9b078-56c9-47a4-aa8a-a1f673d23d0e），保持Gemini3.8FlashMedium／Turbo，确认新用户消息／空输入／Working。证据为本轮独立目录dispatch.json、sent-task.txt。等待新隔离目录与SECOND_DELIVERY，不创建监控，Codex不并行改实现。
