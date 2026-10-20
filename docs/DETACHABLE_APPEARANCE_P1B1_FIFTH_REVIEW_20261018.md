# P1B-1五审：F1通过，F2退出链路已生效，仅补QA汇总竞态G1

2026-10-18，Codex独立离线复审[四审补修交付](DETACHABLE_APPEARANCE_P1B1_FOURTH_REPAIR_DELIVERY_20261018.md)，对照[四审F1/F2](DETACHABLE_APPEARANCE_P1B1_FOURTH_REVIEW_20261018.md)。

结论：**F1生产源码本轮离线范围通过**：固定总预算、真实响应入口AbortSignal/代次拦截、独立SSE更新和实际HTTP取消已有独立证据。F2的实际软截止进入finally、独立进程硬截止终止worker也已验证生效。当前仅余一个**QA汇总竞态G1**：硬超时之后，正常exit分支仍能抢先返回timedOut=false，受控exit0时甚至错误报告成功。只修这个QA余项，不再返工生产源码、UI或已过边界，暂不进入P1B-2/候选安装。

## 本轮冻结与验证

目录`.tmp/detachable-p1b1-fifth-review-20261018-72cf905b/`，冻结158项src/qa与交付脚本，结束时无漂移。相对四审只有companion.js和detachable-contract.js变化，59项生产资产/归档保持。见`inputs.json`、`preservation.json`。

关键SHA256：companion.js `28FC29BC6D4A1E1607F5F0428B1F314F847479693F05FD8893249CC216F1E1AC`；contract `E572AB18034DBEC3E4E8733D57913FFBACDC80DFB22294CCE5E73C141315FF7B`；safe-qa-runner `8390E46C018E49113F5D002E0D880D3F844590546899E3E1F9703548FC3C6D94`。

| 独立检查 | 结果及证据 |
|---|---|
| check、P0/P1A | 退出0，20/20，check.log、p0-p1a.log |
| 交付F1/F2八项及历史十项 | 18/18，replay-units.log。路径仅调整到冻结副本，不回写旧证据 |
| 独立F1应用层 | deadline-acceptance.mjs/log，3/3：晚回包不再改变client/app/DOM；独立SSE正常更新；预设晚回包不改设置/预设、不重放；显式后续动作可完成。180ms总预算、两次stale/共3请求，约185ms结束 |
| 实际HTTP取消 | http-abort-check.mjs/log，1/1：真实createHttpCompanionTransport+createCompanionClient通过自有loopback HTTP取消在途action，响应连接关闭，revision/settings不被吸收。无DSH服务或模型请求 |
| 实际监督/runner控制流 | supervisor-check.mjs/log，4/4：真实runSupervisedScript按180ms壁钟终止自有有限忙循环Node；两个实际runner抽取其真实软截止/try/catch/finally、替换工作及资源IO，25ms软截止进入清理并以1退出；另成功复现G1假成功 |

初版独立70ms探针因Windows调度使第二请求尚未发出就已耗尽预算，错误断言必须发2次，记录保留`deadline-acceptance-initial-scheduling.log`。该结果本身仍符合总截止，不列产品问题；扩大为180ms、两次受控stale后重跑通过，避免用紧凑计时强迫实现超预算发请求。

所有新增测试有限期限：测试1.5–4秒、短命子进程父级1秒左右或实际监督器有明确硬截止；忙循环自身也有1200ms有限上限。未启动Edge或顽固真实进程，不重复未变React/布局/E2E。真实系统窗/吸附体验和实机验收仍未进行。未改日常DSH/WE、安装/Profile、manifest/生产assets/版本，无提交推送清理，定时PAUSED。

## G1：硬截止触发后，exitPromise仍可抢先覆盖监督结果

位置：本轮`safe-qa-runner.mjs`的runSupervisedScript末尾。timeoutPromise的回调先await safelyTerminateProcess，而exitPromise在child退出时立即resolve。两者Promise.race通常先得到exitPromise，因此硬截止事实和termRes丢失。

两种独立结果：

1. **真实自有Node子进程**：180ms硬限已触发，实际worker被SIGTERM终止，日志正确输出HARD TIMEOUT/CLEANUP；返回却是`{ timedOut:false, code:1, signal:'SIGTERM' }`，且无termRes。非零退出有效，不能说看门狗没生效；缺陷是结果来源被误标。
2. **底层spawn/ChildProcess受控替身**：仅替换builtin spawn返回的子进程对象，不替换runSupervisedScript判断/汇总逻辑。硬截止15ms触发后，定向kill导致exit(0)事件；返回`{ timedOut:false, code:0 }`。两个真实runner只检查timedOut/code，会把已发生硬超时的一轮当成功。它也对应截止触发后自然退出0或自行清理后退出0的边界；不能依赖当前Windows强杀通常给非零来保证协议结果。

交付F2.2虽然测试了独立父进程，但写的是另一段手工监督代码，没有调用实际runSupervisedScript，故未覆盖此竞态。本轮已直接调用真实入口取证。

### 最小补修及验收

- 硬截止一旦触发就同步锁定timeout结果，此后exit/error不能改写为普通成功；实际退出信息可以补充，但最终必须`timedOut:true, code:1`。
- 仅一次最终落定，汇总需消费本轮有界终止结果termRes，再返回；不是在后台继续清理却先返回不完整结果。失败/未确认保留已有证据与告警，不扩大资源处理范围。
- 在**实际runSupervisedScript**入口测：正常exit0、工作错误非零、硬超时后signal退出、硬超时后exit0、超时/exit/error竞争、终止未确认。断言timeout标记、code、termRes与一次性落定；用纯IO替身和短命自有Node，无需真实浏览器长测。
- 两个实际runner继续使用这一个共享入口。只改本轮QA，不再改companion、contract、UI或P1A/B实现。

交`docs/DETACHABLE_APPEARANCE_P1B1_FIFTH_REPAIR_DELIVERY_20261018.md`及新独立证据目录，完成停等复审。此前F1/保存屏障/清理失败消费均保持，不为G1重新跑整个产品矩阵。G1闭合后才将P1B-1离线阶段整体收尾，再另排P1B-2或候选；真实系统窗体验仍不能由离线通过代替。

日常DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1和工作区manifest/生产assets rc.30保持；A低优先级，不操作DSH/WE/发模型请求、不安装发布、不提交推送清理，定时PAUSED。

转达记录：23:22通过computer-use向同一小G新对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次仅QA G1补修；核验新用户消息、输入清空及Working/Cancel，Gemini 3.8 Flash High保持。明确生产源码停止返工，等G1交付，定时PAUSED。
