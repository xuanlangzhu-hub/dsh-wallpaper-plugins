# 给Gemini：首次作者读取等待同会话就绪的最小修复

2026-10-27。用户继续，最后文档更正已由Codex核对，离线诊断阶段结束。**本任务取代上一条“只更正文档”的阶段限制，允许隔离源码与QA最小修复。** 不需要先写方案等待用户转述；先明确下列合同，再做红绿回归和实现，交Codex独立复审。不安装，不操作日常DSH／WE。

## 基线与范围

先读AGENTS、NEXT_TASK、PROJECT_STATUS、`RC51_TARGET_UNVERIFIED_OFFLINE_CLOSEOUT_20261027.md`和`RC51_TARGET_UNVERIFIED_FINAL_SEAM_REVIEW_20261027.md`。保留脏改动；当前日常DSHrc.3／Whalerc.48／GitBash0.1.2。工作区manifest／生产assets仍rc.30，不能整体打包或从共享client覆盖固定包。

固定输入为`.tmp/rc51-author-read-diagnostic-candidate-20261027-a/unpacked/`，归档SHA256 A8AA341F560C17CB7AC85817DFB205404AE7C2765F2F29B15CF436F912313725；实际client SHA256 62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8。在全新排他目录复制所需src／package.json为隔离实现，保留模块依赖完整，资源路径只读引用，原生执行底层全部替身。**不得修改固定解包、共享dsh-whale-mist源码、manifest、assets、旧报告／测试输出。** 交付修复副本及拟提升最少文件，复审后再决定提升或候选。

本次仅修已复现的就绪时序：画面playing时session.captureStarted可能尚false，前端首次读只尝试一次即blocked。不能宣称所有target.unverified都由它造成；windowStartUtc为空、ID／PID／HWND／helper等非法、adapter缺失、busy等其它原因必须继续拒绝。

## 选定的修复合同

**只在GET作者schema的同一次请求内，为“已确认同一当前session、仅采集证明仍待就绪”的目标等待一个事件。** 就绪后重新验证完整目标与上下文，再返回；无第二次HTTP读取，无参数POST，无自动应用。

1. 优先复用session生命周期通知；如无适用通知，只加一个小型订阅／等待接口，在现有captureStarted由false→true处发通知，并在stop／失败／清理终止处结算等待者。不要新开SSE通道、interval轮询、周期GET，或依赖下一帧／固定sleep推定身份已就绪。最终以已有实际capture证明为准。
2. 等待者绑定**具体session对象及既有generation／scene／location身份**。读取开始时捕获，等待期间任何代次、选择、owner／权限／分级／源身份变化均取消／拒绝；新session即使同Lucy／同ID也不能继承旧就绪结果。等待前后均保留真实target校验，成功不得缓存成跨请求／代次的全局布尔值。
3. 只允许区分“目标其它字段合法、captureStarted尚待证明”的状态。缺失／非法startUtc、HWND、PID、helper、location、scene／generation、已经stopping或applying busy等不能当成可等待就绪；不伪造UTC／HWND，不补默认值，不把unknown当ready。已有canApply仍是响应及所有写入的最终验证。
4. 复用作者读取现有AbortController、取消合同及**同一timeoutMs总预算**（当前默认1500ms），元数据读取＋就绪等待合计不得重新计时或加倍。只在GET路径显式启用；schemaFor也被POST draft／plan／apply复用，禁止无意改变写路由的等待／重放语义。请求中断、author Host dispose、停止／换代及超时，均结算并解绑监听；未知／失败仍诚实返回失败，不无限spinner。
5. 就绪比请求早时直接通过；通知比订阅早／同步触发时也不能丢失（注册前后双检查或等价原子合同）。等待恢复后先重验ticket／session／generation，再构造state；等待期间不产生草稿写入、默认参数下发或canEdit提前开启。保留旧记录／schema变化、脏／未知状态合同。
6. 尽量不改client和原生侧栏生成块、不改变既有schema包络／前端错误分类。若必须修改公共接口，在交付中指出兼容旧测试适配器的办法及生产接线证明，不能用测试中手填canApply=true掩盖生产入口没接上。

预期运行修改集中在session、index接线、author ApplyAdapter和作者Host的GET读取路径；可增极小模块以减少耦合，但不为此重构整个链。不要改变采集帧／stderr协议、native二进制、关闭恢复逻辑或其它UI。“▶ 播放”文案后排。

## 先红后绿：只测改变所需的接缝

复用已通过的实际固定引擎＋原版AuthorSwitches effect函数体回放，保留解码／hook／元数据与原生IO替身边界，不重跑旧SDK／全部7项／性能或全部壁纸。修复版更换真实后端组件，不以人工完整target替代session默认身份查询或index接线。

- **原缺口红例与修复绿例**：首帧先到，首次GET已经发出而captureStarted=false；旧实现blocked。修复后同一请求在等待读取、控件不可编辑且零写；实际capture就绪事件释放后首次响应ready／6字段。明确schema GET恰1次，未点重试／手动load，未发draft／apply／默认值。事件先于帧的正常对照仍一次成功；无帧不人为发起读取。
- **预算／取消**：证明未就绪不会成功且在原总预算内失败；元数据耗时不能再获得一整段新预算。取消、停止、Host dispose后等待者解绑；真实超时用可控时钟或有界小预算，不长睡眠。listener／timer／pending计数恢复，超时后迟到事件不改变前端或发新请求。
- **代次与ABA**：旧A在等，切换／停止／新B（包括同Lucy）后旧事件不能释放B或污染B；旧成功／失败均不得发写入／通知到已销毁视图。使用具体完成信号，不把60／100ms采样声称所有physical作业完成。
- **保守拒绝**：保留startUtc无效、其它身份字段不匹配、adapter缺失、busy／cleanup pending与未授权／分级拒绝。挑与新等待分类相关的最小负例；已审既有解析／鉴权大套件不重跑，不能靠canApply替身绕过。
- **收尾**：所有测试同一验收函数核对session／Host／controller／server与自有子进程退出；失败和缺报告不能转绿。按前轮已验的排他normal／fault模式使用实际错误分类，不把预期子失败包装成子passed=true。

## 所有脚本保持有界

此前诊断脚本有schemaSignal／phase轮询缺阶段deadline，不直接沿用该缺口。使用已审通用有界监督器，或在新隔离QA中补每阶段截止及最终退出报告；HTTP／body／listen／close／事件等待／child退出均有界，父监督超时及kill后未知出口也落结构化非零报告。所有命令包括准备／哈希都断stdin并有父截止，不用嵌套PowerShell拼接，不再制造无返回任务；仅回收本轮且证明身份的资源，不全局kill、不触碰旧后台任务。

## 交付

交付`docs/RC51_AUTHOR_READ_READINESS_REPAIR_DELIVERY_20261027.md`：四态／等待合同、实际修改文件及固定输入指纹、红绿与相关负例精确命令／排他输出、预算／取消／ABA和监听释放证据、真实组件／底层IO替身覆盖、未覆盖项、拟提升最少文件。失败尝试保留，不修改旧报告结论。同步接续后原会话回复路径等复审；Codex不并行改实现。

无打包安装发布、日常采样或DSH模型请求、Profile／外观／媒体／生产assets／版本写入，无提交推送清理、定时或跨任务派发。任何未来实机另准备新轮备份／回退并确认当时方便，不复用rc.51旧授权或PID。

## 发送记录

已单次发送至Antigravity原Scroll A Investigation Q1-Q3 Repairs（44d9b078-56c9-47a4-aa8a-a1f673d23d0e），保持Gemini3.8FlashMedium／Turbo；已确认新用户消息、空输入和执行中状态。见`.tmp/rc51-readiness-repair-handoff-20261027-a/dispatch.json`、sent-task.txt。等待隔离修复交付，Codex不并行改实现，不创建自动监控。
